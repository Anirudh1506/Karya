import type { EventBus } from "@karya/event-bus";
import type { ContinueWorkingItem, ContinuitySession, Profile, Resource, Workspace } from "@karya/types";
import type { ContinueWorkingService } from "./contracts";

export interface ContinueWorkingProviders {
  getSession(): Promise<ContinuitySession>;
  listProfiles(): Promise<Profile[]>;
  listResources(): Promise<Resource[]>;
  listWorkspaces(): Promise<Workspace[]>;
}

export class DefaultContinueWorkingService implements ContinueWorkingService {
  private items: ContinueWorkingItem[] = [];
  private refreshQueue = Promise.resolve<ContinueWorkingItem[]>([]);

  constructor(
    private readonly eventBus: EventBus,
    private readonly providers: ContinueWorkingProviders,
  ) {}

  list(): ContinueWorkingItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  refresh(): Promise<ContinueWorkingItem[]> {
    const performRefresh = async () => {
      const [session, profiles, workspaces, resources] = await Promise.all([
        this.providers.getSession(),
        this.providers.listProfiles(),
        this.providers.listWorkspaces(),
        this.providers.listResources(),
      ]);
      this.items = rankContinueWorking({ session, profiles, workspaces, resources });
      await this.eventBus.publish("ContinueWorkingUpdated", { items: this.list() });
      return this.list();
    };
    this.refreshQueue = this.refreshQueue.then(performRefresh, performRefresh);
    return this.refreshQueue;
  }

  subscribeToEvents(): () => void {
    const refresh = async () => {
      await this.refresh();
    };
    const unsubscribers = [
      this.eventBus.subscribe("ResourceOpened", refresh),
      this.eventBus.subscribe("ResourceCreated", refresh),
      this.eventBus.subscribe("ResourceRenamed", refresh),
      this.eventBus.subscribe("ResourceMoved", refresh),
      this.eventBus.subscribe("ResourceArchived", refresh),
      this.eventBus.subscribe("ResourceRestored", refresh),
      this.eventBus.subscribe("ResourceUpdated", refresh),
      this.eventBus.subscribe("ActiveWorkspaceChanged", refresh),
      this.eventBus.subscribe("ActiveProfileChanged", refresh),
      this.eventBus.subscribe("continuity:session-updated", refresh),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }
}

export function rankContinueWorking(input: {
  session: ContinuitySession;
  profiles: Profile[];
  workspaces: Workspace[];
  resources: Resource[];
}): ContinueWorkingItem[] {
  const { session } = input;
  const profile = input.profiles.find((candidate) => candidate.id === session.activeProfileId);
  const workspace = input.workspaces.find(
    (candidate) =>
      candidate.id === session.activeWorkspaceId &&
      candidate.profileId === profile?.id &&
      candidate.lifecycleState !== "archived" &&
      candidate.lifecycleState !== "deleted",
  );
  if (!profile || !workspace) return [];

  const workspaceSession = session.workspaceSessions?.[workspace.id];
  const createdAtByResource = new Map(input.resources.map((resource) => [resource.id, resource.createdAt]));
  const lastOpenedByResource = new Map<string, string>();
  for (const activity of workspaceSession?.activityTimeline ?? []) {
    if (activity.type !== "resource-opened" || !activity.resourceId) continue;
    const current = lastOpenedByResource.get(activity.resourceId);
    if (!current || activity.occurredAt > current) lastOpenedByResource.set(activity.resourceId, activity.occurredAt);
  }

  return input.resources
    .filter(
      (resource) =>
        resource.lifecycleState === "active" &&
        resource.profileId === profile.id &&
        resource.workspaceRefs.includes(workspace.id),
    )
    .map<ContinueWorkingItem>((resource) => {
      const lastOpened = lastOpenedByResource.get(resource.id);
      const lastModified = resource.metadata.updatedAt ?? resource.updatedAt;
      return {
        kind: "resource",
        resourceId: resource.id,
        resourceName: resource.metadata.title,
        resourceType: resource.metadata.kind || resource.type,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        profileId: profile.id,
        profileName: profile.name,
        lastOpened,
        lastModified,
        resumeTimestamp: newest(lastOpened, lastModified, resource.createdAt),
      };
    })
    .sort((left, right) => {
      const leftActive = left.resourceId === workspaceSession?.lastSelectedResourceId ? 1 : 0;
      const rightActive = right.resourceId === workspaceSession?.lastSelectedResourceId ? 1 : 0;
      if (leftActive !== rightActive) return rightActive - leftActive;
      if ((left.lastOpened ?? "") !== (right.lastOpened ?? ""))
        return (right.lastOpened ?? "").localeCompare(left.lastOpened ?? "");
      if (left.lastModified !== right.lastModified) return right.lastModified.localeCompare(left.lastModified);
      const leftCreated = createdAtByResource.get(left.resourceId) ?? "";
      const rightCreated = createdAtByResource.get(right.resourceId) ?? "";
      if (leftCreated !== rightCreated) return rightCreated.localeCompare(leftCreated);
      const byName = left.resourceName.localeCompare(right.resourceName, undefined, { sensitivity: "base" });
      return byName || left.resourceId.localeCompare(right.resourceId);
    });
}

function newest(...values: Array<string | undefined>): string {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  );
}
