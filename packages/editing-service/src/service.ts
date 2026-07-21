import type { EventBus } from "@karya/event-bus";
import type { Repository } from "@karya/persistence";
import type { ResourceService } from "@karya/resource-service";
import type { EditableResourceContent, EditCheckpoint, EditSelection, EditSession, EntityId } from "@karya/types";

export interface EditingRepositories {
  contents: Repository<EditableResourceContent>;
  sessions: Repository<EditSession>;
  checkpoints: Repository<EditCheckpoint>;
}

export interface ResourceEditingService {
  start(): Promise<void>;
  suspend(): Promise<void>;
  shutdown(): Promise<void>;
  open(resourceId: EntityId): Promise<{ session: EditSession; content: EditableResourceContent }>;
  change(sessionId: EntityId, text: string, selection?: EditSelection): Promise<EditSession>;
  flush(sessionId: EntityId): Promise<EditableResourceContent>;
  close(sessionId: EntityId): Promise<void>;
  getContent(resourceId: EntityId): Promise<EditableResourceContent>;
  getSession(sessionId: EntityId): Promise<EditSession | undefined>;
  listCheckpoints(resourceId: EntityId): Promise<EditCheckpoint[]>;
  subscribe(listener: (session: EditSession) => void): () => void;
  applyReplicaContent(content: EditableResourceContent): Promise<void>;
}

export class DefaultResourceEditingService implements ResourceEditingService {
  private readonly sessions = new Map<EntityId, EditSession>();
  private readonly drafts = new Map<EntityId, EditableResourceContent>();
  private readonly timers = new Map<EntityId, ReturnType<typeof setTimeout>>();
  private readonly listeners = new Set<(session: EditSession) => void>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly resourceService: ResourceService,
    private readonly repositories: EditingRepositories,
    private readonly autosaveDelayMs = 900,
  ) {}

  async start(): Promise<void> {
    for (const session of await this.repositories.sessions.list()) {
      if (session.status === "open") {
        this.sessions.set(session.id, session);
        if (session.dirty) this.schedule(session.id);
      }
    }
  }

  async suspend(): Promise<void> {
    await Promise.all(
      [...this.sessions.values()].filter((session) => session.dirty).map((session) => this.flush(session.id)),
    );
  }

  async shutdown(): Promise<void> {
    await this.suspend();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  async open(resourceId: EntityId) {
    const resource = await this.requireEditable(resourceId);
    const existing = [...this.sessions.values()].find(
      (candidate) => candidate.resourceId === resourceId && candidate.status === "open",
    );
    const content = await this.getContent(resourceId);
    if (existing) return { session: { ...existing }, content };
    const now = new Date().toISOString();
    const session: EditSession = {
      id: crypto.randomUUID(),
      resourceId: resource.id,
      openedAt: now,
      dirty: false,
      autosaveState: "idle",
      status: "open",
    };
    this.sessions.set(session.id, session);
    await this.repositories.sessions.save(session);
    await this.eventBus.publish("EditSessionStarted", { session: { ...session }, content });
    this.notify(session);
    return { session: { ...session }, content };
  }

  async change(sessionId: EntityId, text: string, selection?: EditSelection): Promise<EditSession> {
    const session = this.requireSession(sessionId);
    const previous = await this.getContent(session.resourceId);
    if (!session.lastEditedAt) await this.checkpoint(session, previous, "first-edit");
    const now = new Date().toISOString();
    const draft: EditableResourceContent = { ...previous, text, revision: previous.revision + 1, updatedAt: now };
    const updated: EditSession = {
      ...session,
      lastEditedAt: now,
      dirty: true,
      autosaveState: "scheduled",
      cursorPosition: selection?.end,
      selection,
    };
    this.sessions.set(sessionId, updated);
    this.drafts.set(session.resourceId, draft);
    // Persist recovery state immediately; Resource metadata is only changed by autosave.
    await Promise.all([this.repositories.contents.save(draft), this.repositories.sessions.save(updated)]);
    await this.eventBus.publish("ResourceContentChanged", { session: { ...updated }, content: draft });
    this.schedule(sessionId);
    this.notify(updated);
    return { ...updated };
  }

  async flush(sessionId: EntityId): Promise<EditableResourceContent> {
    const session = this.requireSession(sessionId);
    const content = this.drafts.get(session.resourceId) ?? (await this.getContent(session.resourceId));
    this.cancelTimer(sessionId);
    if (!session.dirty) return content;
    const saving = { ...session, autosaveState: "saving" as const };
    this.sessions.set(sessionId, saving);
    await this.repositories.sessions.save(saving);
    await this.eventBus.publish("AutosaveStarted", { session: { ...saving } });
    const resource = await this.requireEditable(session.resourceId);
    const savedResource = await this.resourceService.updateMetadata(resource.id, {
      attributes: {
        ...(resource.metadata.attributes ?? {}),
        // Legacy Desktop projection. Dedicated editing persistence remains authoritative.
        noteContent: content.text,
        noteLastEditedAt: content.updatedAt,
      },
    });
    const saved = { ...saving, dirty: false, autosaveState: "saved" as const };
    this.sessions.set(sessionId, saved);
    this.drafts.delete(session.resourceId);
    await Promise.all([this.repositories.contents.save(content), this.repositories.sessions.save(saved)]);
    await this.eventBus.publish("AutosaveCompleted", { session: { ...saved }, content, resource: savedResource });
    this.notify(saved);
    return content;
  }

  async close(sessionId: EntityId): Promise<void> {
    const session = this.requireSession(sessionId);
    const content = await this.flush(sessionId);
    const ended: EditSession = {
      ...this.requireSession(sessionId),
      status: "closed",
      closedAt: new Date().toISOString(),
      autosaveState: "idle",
    };
    await this.checkpoint(ended, content, "session-end");
    this.sessions.delete(sessionId);
    await this.repositories.sessions.save(ended);
    await this.eventBus.publish("EditSessionEnded", { session: ended, content });
    this.notify(ended);
  }

  async getContent(resourceId: EntityId): Promise<EditableResourceContent> {
    const draft = this.drafts.get(resourceId);
    if (draft) return { ...draft };
    const stored = await this.repositories.contents.get(resourceId);
    if (stored) return stored;
    const resource = await this.requireEditable(resourceId);
    const legacy =
      typeof resource.metadata.attributes?.noteContent === "string" ? resource.metadata.attributes.noteContent : "";
    return {
      id: resourceId,
      resourceId,
      text: legacy,
      format: "plain-text",
      encoding: "utf-8",
      revision: 0,
      updatedAt: resource.updatedAt,
    };
  }

  async getSession(sessionId: EntityId) {
    return this.sessions.get(sessionId) ?? this.repositories.sessions.get(sessionId);
  }
  async listCheckpoints(resourceId: EntityId) {
    return (await this.repositories.checkpoints.list()).filter((item) => item.resourceId === resourceId);
  }
  subscribe(listener: (session: EditSession) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async applyReplicaContent(content: EditableResourceContent): Promise<void> {
    await this.repositories.contents.save(content);
  }

  private schedule(sessionId: EntityId) {
    this.cancelTimer(sessionId);
    this.timers.set(
      sessionId,
      setTimeout(() => void this.flush(sessionId).catch(() => this.markFailed(sessionId)), this.autosaveDelayMs),
    );
  }
  private cancelTimer(sessionId: EntityId) {
    const timer = this.timers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.timers.delete(sessionId);
  }
  private markFailed(sessionId: EntityId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const failed = { ...session, autosaveState: "failed" as const };
    this.sessions.set(sessionId, failed);
    this.notify(failed);
  }
  private notify(session: EditSession) {
    this.listeners.forEach((listener) => listener({ ...session }));
  }
  private requireSession(id: EntityId) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Edit session not found: ${id}`);
    return session;
  }
  private async requireEditable(id: EntityId) {
    const resource = await this.resourceService.getResource(id);
    if (!resource) throw new Error(`Resource not found: ${id}`);
    if (resource.metadata.kind !== "note") throw new Error("Only Note Resources are editable in this release.");
    return resource;
  }
  private async checkpoint(session: EditSession, content: EditableResourceContent, kind: EditCheckpoint["kind"]) {
    const checkpoint: EditCheckpoint = {
      id: `${session.id}:${kind}`,
      resourceId: session.resourceId,
      sessionId: session.id,
      kind,
      text: content.text,
      revision: content.revision,
      createdAt: new Date().toISOString(),
    };
    await this.repositories.checkpoints.save(checkpoint);
  }
}
