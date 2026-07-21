import type { EventBus } from "@karya/event-bus";
import type { Repository, SyncOperationRepository } from "@karya/persistence";
import type {
  EditableResourceContent,
  EntityId,
  KaryaNotification,
  Profile,
  Resource,
  SyncConflict,
  SyncDeviceState,
  SyncEntityType,
  SyncOperation,
  SyncReplayReceipt,
  SyncStatus,
  Workspace,
} from "@karya/types";

export interface SyncRepositories {
  operations: SyncOperationRepository;
  deviceStates: Repository<SyncDeviceState>;
  receipts: Repository<SyncReplayReceipt>;
  conflicts: Repository<SyncConflict>;
}

export interface SyncReplayTarget {
  getUpdatedAt(entityType: SyncEntityType, entityId: EntityId): Promise<string | undefined>;
  apply(operation: SyncOperation): Promise<boolean>;
}

export interface SyncAuthorizationProvider {
  authorize(deviceId: EntityId): Promise<boolean>;
}

export class SynchronizationEngine {
  private state?: SyncDeviceState;
  private replaying = false;
  private unsubscribers: Array<() => void> = [];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly repositories: SyncRepositories,
    private readonly target: SyncReplayTarget,
    private readonly authorization?: SyncAuthorizationProvider,
  ) {}

  async start(): Promise<void> {
    this.state = await this.repositories.deviceStates.get("local-device");
    if (!this.state) {
      this.state = { id: "local-device", deviceId: crypto.randomUUID(), nextSequence: 1 };
      await this.repositories.deviceStates.save(this.state);
    }
    if (this.unsubscribers.length === 0) this.subscribeToChanges();
  }

  async stop(): Promise<void> {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }

  async status(): Promise<SyncStatus> {
    const state = await this.requireState();
    const [pending, acknowledged] = await Promise.all([
      this.repositories.operations.list("pending"),
      this.repositories.operations.list("acknowledged"),
    ]);
    return {
      deviceId: state.deviceId,
      pendingOperations: pending.length,
      acknowledgedOperations: acknowledged.length,
      queueSize: pending.length,
      lastReplayAt: state.lastReplayAt,
    };
  }

  async pending(): Promise<SyncOperation[]> {
    return (await this.repositories.operations.list("pending")).map(operationForSynchronization);
  }
  async deviceId(): Promise<EntityId> {
    return (await this.requireState()).deviceId;
  }
  async acknowledged(): Promise<SyncOperation[]> {
    return (await this.repositories.operations.list("acknowledged")).map(operationForSynchronization);
  }
  conflicts(): Promise<SyncConflict[]> {
    return this.repositories.conflicts.list();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async acknowledge(operationIds: readonly EntityId[]): Promise<void> {
    for (const id of operationIds) {
      const operation = await this.repositories.operations.updateAcknowledgement(
        id,
        "acknowledged",
        new Date().toISOString(),
      );
      await this.eventBus.publish("SyncAcknowledged", { operation });
      this.notify();
    }
  }

  async replay(operations?: readonly SyncOperation[]): Promise<void> {
    const replayOperations = operations ?? (await this.repositories.operations.list());
    this.replaying = true;
    try {
      for (const storedOperation of [...replayOperations].sort(compareOperations)) {
        const operation = operationForSynchronization(storedOperation);
        if (await this.repositories.receipts.get(operation.id)) continue;
        const state = await this.requireState();
        if (
          this.authorization &&
          operation.deviceId !== state.deviceId &&
          !(await this.authorization.authorize(operation.deviceId))
        ) {
          throw new Error(`Synchronization is not authorized for device: ${operation.deviceId}`);
        }
        for (const dependencyId of operation.dependencies) {
          const dependency = await this.repositories.operations.get(dependencyId);
          if (dependency && !(await this.repositories.receipts.get(dependencyId))) {
            await this.recordConflict(operation, "missing-dependency");
            break;
          }
        }
        const localTimestamp = await this.target.getUpdatedAt(operation.entityType, operation.entityId);
        const conflict =
          localTimestamp && localTimestamp > operation.timestamp
            ? await this.recordConflict(operation, "concurrent-modification", localTimestamp)
            : undefined;
        const applied = await this.target.apply(operation);
        if (!applied) await this.recordConflict(operation, "unsupported-operation");
        const replayedAt = new Date().toISOString();
        await this.repositories.receipts.save({ id: operation.id, operationId: operation.id, replayedAt });
        await this.eventBus.publish("SyncReplayed", { operation, conflict });
      }
      const state = await this.requireState();
      this.state = { ...state, lastReplayAt: new Date().toISOString() };
      await this.repositories.deviceStates.save(this.state);
      this.notify();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Synchronization replay failed";
      await this.eventBus.publish("SyncFailed", { message });
      throw cause;
    } finally {
      this.replaying = false;
    }
  }

  private subscribeToChanges() {
    const record =
      <T>(
        entityType: SyncEntityType,
        operationType: string,
        select: (payload: T) => { id: EntityId; value: unknown; dependencies?: EntityId[] },
      ) =>
      async (payload: T) => {
        if (!this.replaying) {
          const selected = select(payload);
          await this.queue(entityType, selected.id, operationType, selected.value, selected.dependencies);
        }
      };
    const recordResource =
      (operationType: string) =>
      async ({ resource }: { resource: Resource }) => {
        if (!this.replaying) {
          await this.queue("resource", resource.id, operationType, resourceForSynchronization(resource), [
            resource.profileId,
            ...resource.workspaceRefs,
          ]);
        }
      };
    this.unsubscribers = [
      this.eventBus.subscribe(
        "ProfileCreated",
        record("profile", "ProfileCreated", ({ profile }) => ({ id: profile.id, value: profile })),
      ),
      this.eventBus.subscribe(
        "ProfileUpdated",
        record("profile", "ProfileUpdated", ({ profile }) => ({ id: profile.id, value: profile })),
      ),
      this.eventBus.subscribe(
        "ProfileArchived",
        record("profile", "ProfileArchived", ({ profile }) => ({ id: profile.id, value: profile })),
      ),
      this.eventBus.subscribe(
        "ProfileRestored",
        record("profile", "ProfileRestored", ({ profile }) => ({ id: profile.id, value: profile })),
      ),
      this.eventBus.subscribe(
        "WorkspaceCreated",
        record("workspace", "WorkspaceCreated", ({ workspace }) => ({
          id: workspace.id,
          value: workspace,
          dependencies: [workspace.profileId],
        })),
      ),
      this.eventBus.subscribe(
        "WorkspaceUpdated",
        record("workspace", "WorkspaceUpdated", ({ workspace }) => ({
          id: workspace.id,
          value: workspace,
          dependencies: [workspace.profileId],
        })),
      ),
      this.eventBus.subscribe(
        "WorkspaceArchived",
        record("workspace", "WorkspaceArchived", ({ workspace }) => ({
          id: workspace.id,
          value: workspace,
          dependencies: [workspace.profileId],
        })),
      ),
      this.eventBus.subscribe(
        "WorkspaceRestored",
        record("workspace", "WorkspaceRestored", ({ workspace }) => ({
          id: workspace.id,
          value: workspace,
          dependencies: [workspace.profileId],
        })),
      ),
      this.eventBus.subscribe("ResourceCreated", recordResource("ResourceCreated")),
      this.eventBus.subscribe("ResourceUpdated", recordResource("ResourceUpdated")),
      this.eventBus.subscribe("AutosaveCompleted", async ({ content, resource }) => {
        if (!this.replaying && isKaryaOwnedResource(resource)) {
          await this.queue("resource-content", content.resourceId, "ResourceContentUpdated", content, [
            content.resourceId,
          ]);
        }
      }),
      this.eventBus.subscribe(
        "CaptureCompleted",
        record("capture", "CaptureCompleted", ({ capture, resource }) => ({
          id: capture.id,
          value: { capture, resource },
          dependencies: [resource.id],
        })),
      ),
      this.eventBus.subscribe("NotificationUpdated", async ({ notification }) => {
        if (!this.replaying && notification.status === "read")
          await this.queue(
            "notification",
            notification.id,
            "NotificationRead",
            notification,
            [notification.profileId].filter(Boolean) as string[],
          );
      }),
    ];
  }

  private async queue(
    entityType: SyncEntityType,
    entityId: EntityId,
    operationType: string,
    value: unknown,
    dependencies: EntityId[] = [],
  ) {
    const state = await this.requireState();
    const operation: SyncOperation = {
      id: crypto.randomUUID(),
      deviceId: state.deviceId,
      sequence: state.nextSequence,
      timestamp: new Date().toISOString(),
      entityType,
      entityId,
      operationType,
      payload: JSON.stringify(value),
      dependencies: [...new Set(dependencies)],
      acknowledgementState: "pending",
    };
    if (await this.repositories.operations.append(operation)) {
      this.state = { ...state, nextSequence: state.nextSequence + 1 };
      await this.repositories.deviceStates.save(this.state);
      await this.eventBus.publish("SyncQueued", { operation });
      this.notify();
    }
  }

  private async requireState() {
    if (!this.state) await this.start();
    return this.state as SyncDeviceState;
  }
  private async recordConflict(operation: SyncOperation, reason: SyncConflict["reason"], localTimestamp?: string) {
    const conflict: SyncConflict = {
      id: `conflict:${operation.id}:${reason}`,
      operationId: operation.id,
      entityType: operation.entityType,
      entityId: operation.entityId,
      detectedAt: new Date().toISOString(),
      reason,
      localTimestamp,
      remoteTimestamp: operation.timestamp,
      resolved: false,
    };
    await this.repositories.conflicts.save(conflict);
    return conflict;
  }
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export function compareOperations(left: SyncOperation, right: SyncOperation) {
  return (
    left.timestamp.localeCompare(right.timestamp) ||
    left.deviceId.localeCompare(right.deviceId) ||
    left.sequence - right.sequence ||
    left.id.localeCompare(right.id)
  );
}

export function isKaryaOwnedResource(resource: Resource): boolean {
  return !isExternallyOwnedResource(resource);
}

export function resourceForSynchronization(resource: Resource): Resource {
  if (!isExternallyOwnedResource(resource)) return resource;

  const attributes = { ...(resource.metadata.attributes ?? {}) };
  delete attributes.noteContent;
  delete attributes.noteIndexedContent;
  delete attributes.noteHeadings;
  delete attributes.contentAddress;

  return {
    ...resource,
    metadata: {
      ...resource.metadata,
      description: resource.metadata.kind === "folder" ? "Referenced folder" : "Referenced file",
      attributes,
    },
  };
}

export function operationForSynchronization(operation: SyncOperation): SyncOperation {
  if (operation.entityType !== "resource") return operation;
  try {
    const resource = JSON.parse(operation.payload) as Resource;
    return {
      ...operation,
      payload: JSON.stringify(resourceForSynchronization(resource)),
    };
  } catch {
    return operation;
  }
}

function isExternallyOwnedResource(resource: Resource): boolean {
  const locationKind = resource.metadata.attributes?.resourceLocationKind;
  const noteOrigin = resource.metadata.attributes?.noteOrigin;
  return (
    locationKind === "local-linked" ||
    resource.tags.includes("linked") ||
    noteOrigin === "linked" ||
    noteOrigin === "imported" ||
    (resource.tags.includes("imported") && typeof resource.metadata.attributes?.contentSourcePath === "string")
  );
}

export type ReplicatedEntity = Profile | Workspace | Resource | EditableResourceContent | KaryaNotification;
