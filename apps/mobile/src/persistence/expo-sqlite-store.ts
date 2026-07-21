import * as SQLite from "expo-sqlite";
import type { ApplicationRepository as RegistryApplicationRepository } from "@karya/application-registry";
import { Identifier, Resource as ResourceAggregate, Workspace as WorkspaceAggregate } from "@karya/domain";
import type {
  ResourceRepository as DomainResourceRepository,
  WorkspaceRepository as DomainWorkspaceRepository,
} from "@karya/domain";
import type {
  ApplicationRepository,
  ActivityRepository,
  ActivityRepositoryQuery,
  NotificationRepository,
  NotificationRepositoryQuery,
  MetadataUnitOfWork,
  PersistenceProvider,
  ProfileRepository,
  ResourceRepository,
  SearchDocumentRepository,
  SessionRepository,
  SettingsRepository,
  WorkspaceRepository,
  SyncOperationRepository,
  Repository,
} from "@karya/persistence";
import {
  InMemoryResourceQueryRepository,
  InMemorySearchQueryRepository,
  InMemoryWorkspaceQueryRepository,
  type ResourceQueryRepository,
  type SearchQueryRepository,
  type WorkspaceQueryRepository,
} from "@karya/query-service";
import { toDomain as resourceToDomain, toDto as resourceToDto } from "@karya/resource-service";
import type {
  ContinuitySession,
  KaryaActivity,
  KaryaNotification,
  EntityId,
  InstalledApplication,
  Profile,
  Resource,
  SearchDocument,
  SettingDefinition,
  Workspace,
  SyncConflict,
  SyncDeviceState,
  KaryaAccount,
  TrustedDevice,
  SyncOperation,
  SyncReplayReceipt,
  EditableResourceContent,
  EditCheckpoint,
  EditSession,
  TransportSessionRecord,
} from "@karya/types";
import { toDomain as workspaceToDomain, toDto as workspaceToDto } from "@karya/workspace-service";

export interface MobileSeedData {
  applications: InstalledApplication[];
  profiles: Profile[];
  resources: Resource[];
  session: ContinuitySession;
  settings: SettingDefinition[];
  workspaces: Workspace[];
}

export interface ExpoSqliteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SQLite.SQLiteBindValue[]): Promise<unknown>;
  getFirstAsync<TResult>(source: string, ...params: SQLite.SQLiteBindValue[]): Promise<TResult | null>;
  getAllAsync<TResult>(source: string, ...params: SQLite.SQLiteBindValue[]): Promise<TResult[]>;
  withTransactionAsync(operation: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

export type ExpoSqliteOpener = (databaseName: string) => Promise<ExpoSqliteDatabase>;

interface StoredEntityRow {
  id: string;
  payload: string;
}

interface StoredActivityRow {
  payload: string;
}

export class ExpoSqliteStore implements PersistenceProvider {
  private database?: ExpoSqliteDatabase;
  private initialization?: Promise<void>;
  private initialized = false;
  private operationQueue: Promise<unknown> = Promise.resolve();
  private transactionDepth = 0;
  readonly accounts: Repository<KaryaAccount>;
  readonly trustedDevices: Repository<TrustedDevice>;
  readonly transportSessions: Repository<TransportSessionRecord>;

  readonly applications: ApplicationRepository & RegistryApplicationRepository;
  readonly syncOperations: SyncOperationRepository;
  readonly syncDeviceStates: Repository<SyncDeviceState>;
  readonly syncReplayReceipts: Repository<SyncReplayReceipt>;
  readonly syncConflicts: Repository<SyncConflict>;
  readonly editableContents: Repository<EditableResourceContent>;
  readonly editCheckpoints: Repository<EditCheckpoint>;
  readonly editSessions: Repository<EditSession>;
  readonly activities: ActivityRepository;
  readonly notifications: NotificationRepository;
  readonly profiles: ProfileRepository;
  readonly resources: ResourceRepository;
  readonly search: SearchDocumentRepository;
  readonly sessions: SessionRepository;
  readonly settings: SettingsRepository;
  readonly workspaces: WorkspaceRepository;
  readonly aggregateResources: DomainResourceRepository;
  readonly aggregateWorkspaces: DomainWorkspaceRepository;
  readonly resourceQueries: ResourceQueryRepository;
  readonly searchQueries: SearchQueryRepository;
  readonly workspaceQueries: WorkspaceQueryRepository;
  readonly unitOfWork: MetadataUnitOfWork;

  constructor(
    private readonly databaseName = "karya-mobile.db",
    private readonly openDatabase: ExpoSqliteOpener = (name) =>
      SQLite.openDatabaseAsync(name, { useNewConnection: true }),
  ) {
    this.accounts = new JsonRepository(this, "accounts", (item) => item.id);
    this.trustedDevices = new JsonRepository(this, "trusted-devices", (item) => item.id);
    this.transportSessions = new JsonRepository(this, "transport-sessions", (item) => item.id);
    this.applications = new MobileApplicationRepository(this);
    this.syncOperations = new MobileSyncOperationRepository(this);
    this.syncDeviceStates = new JsonRepository(this, "sync-device-states", (item) => item.id);
    this.syncReplayReceipts = new JsonRepository(this, "sync-replay-receipts", (item) => item.id);
    this.syncConflicts = new JsonRepository(this, "sync-conflicts", (item) => item.id);
    this.editableContents = new JsonRepository(this, "editable-contents", (item) => item.id);
    this.editCheckpoints = new JsonRepository(this, "edit-checkpoints", (item) => item.id);
    this.editSessions = new JsonRepository(this, "edit-sessions", (item) => item.id);
    this.activities = new ActivityJsonRepository(this);
    this.notifications = new NotificationJsonRepository(this);
    this.profiles = new JsonRepository(this, "profiles", (item) => item.id);
    this.resources = new JsonRepository(this, "resources", (item) => item.id);
    this.search = new SearchJsonRepository(this);
    this.sessions = new SessionJsonRepository(this);
    this.settings = new JsonRepository(this, "settings", (item) => item.id);
    this.workspaces = new JsonRepository(this, "workspaces", (item) => item.id);
    this.aggregateResources = new AggregateResourceRepository(this.resources);
    this.aggregateWorkspaces = new AggregateWorkspaceRepository(this.workspaces);
    this.resourceQueries = new SqliteResourceQueries(this.resources);
    this.searchQueries = new SqliteSearchQueries(this.search);
    this.workspaceQueries = new SqliteWorkspaceQueries(this.workspaces);
    this.unitOfWork = {
      transaction: async <TResult>(operation: () => Promise<TResult>) => {
        return this.executeSerially(async (database) => {
          let result: TResult | undefined;
          await database.withTransactionAsync(async () => {
            this.transactionDepth += 1;
            try {
              result = await operation();
            } finally {
              this.transactionDepth -= 1;
            }
          });
          return result as TResult;
        });
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      this.database = await this.openDatabase(this.databaseName);
      await this.database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      await this.migrate();
      this.initialized = true;
    })();
    try {
      await this.initialization;
    } finally {
      this.initialization = undefined;
    }
  }

  async seedIfEmpty(seed: MobileSeedData): Promise<void> {
    await this.initialize();
    const existingProfileIds = new Set((await this.profiles.list()).map((profile) => profile.id));
    const existingWorkspaceIds = new Set((await this.workspaces.list()).map((workspace) => workspace.id));
    const existingResourceIds = new Set((await this.resources.list()).map((resource) => resource.id));
    const existingApplicationIds = new Set(
      (await this.applications.list()).map((application) => application.metadata.id),
    );
    const existingSettingIds = new Set((await this.settings.list()).map((setting) => setting.id));
    const currentSession = await this.sessions.getCurrent();
    const currentProfileExists = currentSession ? existingProfileIds.has(currentSession.activeProfileId) : false;
    const currentWorkspaceExists = currentSession?.activeWorkspaceId
      ? existingWorkspaceIds.has(currentSession.activeWorkspaceId)
      : true;

    await this.unitOfWork.transaction(async () => {
      for (const profile of seed.profiles) {
        if (!existingProfileIds.has(profile.id)) await this.profiles.save(profile);
      }
      for (const workspace of seed.workspaces) {
        if (!existingWorkspaceIds.has(workspace.id)) await this.workspaces.save(workspace);
      }
      for (const resource of seed.resources) {
        if (!existingResourceIds.has(resource.id)) await this.resources.save(resource);
      }
      for (const application of seed.applications) {
        if (!existingApplicationIds.has(application.metadata.id)) await this.applications.save(application);
      }
      for (const setting of seed.settings) {
        if (!existingSettingIds.has(setting.id)) await this.settings.save(setting);
      }
      if (!currentSession || !currentProfileExists || !currentWorkspaceExists) {
        await this.sessions.saveCurrent(seed.session);
      }
    });
  }

  async close(): Promise<void> {
    try {
      await this.initialization;
    } catch {
      // Initialization failures are reported by initialize(); close still owns cleanup.
    }
    await this.operationQueue.catch(() => undefined);
    if (!this.database) return;
    const database = this.database;
    this.database = undefined;
    this.initialized = false;
    await database.closeAsync();
  }

  async list<TEntity>(kind: string): Promise<TEntity[]> {
    const rows = await this.executeSerially((database) =>
      database.getAllAsync<StoredEntityRow>(
        "SELECT id, payload FROM karya_entities WHERE kind = ? ORDER BY updated_at ASC, id ASC",
        kind,
      ),
    );
    return rows.map((row) => JSON.parse(row.payload) as TEntity);
  }

  async get<TEntity>(kind: string, id: EntityId): Promise<TEntity | undefined> {
    const row = await this.executeSerially((database) =>
      database.getFirstAsync<StoredEntityRow>(
        "SELECT id, payload FROM karya_entities WHERE kind = ? AND id = ?",
        kind,
        id,
      ),
    );
    return row ? (JSON.parse(row.payload) as TEntity) : undefined;
  }

  async save<TEntity>(kind: string, id: EntityId, entity: TEntity): Promise<void> {
    await this.executeSerially((database) =>
      database.runAsync(
        `INSERT INTO karya_entities (kind, id, payload, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        kind,
        id,
        JSON.stringify(entity),
        new Date().toISOString(),
      ),
    );
  }

  async delete(kind: string, id: EntityId): Promise<void> {
    await this.executeSerially((database) =>
      database.runAsync("DELETE FROM karya_entities WHERE kind = ? AND id = ?", kind, id),
    );
  }

  async clear(kind: string): Promise<void> {
    await this.executeSerially((database) => database.runAsync("DELETE FROM karya_entities WHERE kind = ?", kind));
  }

  async appendActivity(activity: KaryaActivity): Promise<void> {
    await this.executeSerially((database) =>
      database.runAsync(
        `INSERT OR IGNORE INTO karya_activities
          (id, event_type, occurred_at, profile_id, workspace_id, resource_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        activity.id,
        activity.eventType,
        activity.occurredAt,
        activity.profileId ?? null,
        activity.workspaceId ?? null,
        activity.object.type === "resource" ? activity.object.id : null,
        JSON.stringify(activity),
      ),
    );
  }

  async listActivities(query: ActivityRepositoryQuery = {}): Promise<KaryaActivity[]> {
    const clauses: string[] = [];
    const values: SQLite.SQLiteBindValue[] = [];
    if (query.profileId) {
      clauses.push("profile_id = ?");
      values.push(query.profileId);
    }
    if (query.workspaceId) {
      clauses.push("workspace_id = ?");
      values.push(query.workspaceId);
    }
    if (query.resourceId) {
      clauses.push("resource_id = ?");
      values.push(query.resourceId);
    }
    if (query.eventType) {
      clauses.push("event_type = ?");
      values.push(query.eventType);
    }
    values.push(query.limit ?? 500);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.executeSerially((database) =>
      database.getAllAsync<StoredActivityRow>(
        `SELECT payload FROM karya_activities ${where} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
        ...values,
      ),
    );
    return rows.map((row) => JSON.parse(row.payload) as KaryaActivity);
  }

  async getActivity(id: EntityId): Promise<KaryaActivity | undefined> {
    const row = await this.executeSerially((database) =>
      database.getFirstAsync<StoredActivityRow>("SELECT payload FROM karya_activities WHERE id = ?", id),
    );
    return row ? (JSON.parse(row.payload) as KaryaActivity) : undefined;
  }

  async createNotification(notification: KaryaNotification): Promise<boolean> {
    const result = await this.executeSerially((database) =>
      database.runAsync(
        `INSERT OR IGNORE INTO karya_notifications
       (id, activity_id, created_at, profile_id, workspace_id, resource_id, status, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        notification.id,
        notification.activityId ?? null,
        notification.createdAt,
        notification.profileId ?? null,
        notification.workspaceId ?? null,
        notification.resourceId ?? null,
        notification.status,
        JSON.stringify(notification),
      ),
    );
    return (result as { changes?: number }).changes !== 0;
  }

  async saveNotification(notification: KaryaNotification): Promise<void> {
    await this.executeSerially((database) =>
      database.runAsync(
        "UPDATE karya_notifications SET status = ?, payload = ? WHERE id = ?",
        notification.status,
        JSON.stringify(notification),
        notification.id,
      ),
    );
  }

  async listNotifications(query: NotificationRepositoryQuery = {}): Promise<KaryaNotification[]> {
    const clauses: string[] = [];
    const values: SQLite.SQLiteBindValue[] = [];
    if (query.profileId) {
      clauses.push("profile_id = ?");
      values.push(query.profileId);
    }
    if (query.workspaceId) {
      clauses.push("workspace_id = ?");
      values.push(query.workspaceId);
    }
    if (query.unreadOnly) clauses.push("status = 'unread'");
    if (!query.includeDismissed) clauses.push("status NOT IN ('dismissed', 'archived', 'deleted')");
    values.push(query.limit ?? 500);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.executeSerially((database) =>
      database.getAllAsync<StoredActivityRow>(
        `SELECT payload FROM karya_notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
        ...values,
      ),
    );
    return rows.map(({ payload }) => JSON.parse(payload) as KaryaNotification);
  }

  async getNotification(id: EntityId): Promise<KaryaNotification | undefined> {
    const row = await this.executeSerially((database) =>
      database.getFirstAsync<StoredActivityRow>("SELECT payload FROM karya_notifications WHERE id = ?", id),
    );
    return row ? (JSON.parse(row.payload) as KaryaNotification) : undefined;
  }

  async countUnreadNotifications(profileId?: EntityId): Promise<number> {
    const row = await this.executeSerially((database) =>
      database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM karya_notifications WHERE status = 'unread'${profileId ? " AND profile_id = ?" : ""}`,
        ...(profileId ? [profileId] : []),
      ),
    );
    return row?.count ?? 0;
  }

  private requireDatabase(): ExpoSqliteDatabase {
    if (!this.database) throw new Error("Mobile SQLite is not open");
    return this.database;
  }

  private executeSerially<TResult>(operation: (database: ExpoSqliteDatabase) => Promise<TResult>): Promise<TResult> {
    if (this.transactionDepth > 0) return operation(this.requireDatabase());
    const execute = () => operation(this.requireDatabase());
    const result = this.operationQueue.then(execute, execute);
    this.operationQueue = result.catch(() => undefined);
    return result;
  }

  private async migrate(): Promise<void> {
    await this.requireDatabase().execAsync(`
      CREATE TABLE IF NOT EXISTS karya_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS karya_entities (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      );
      CREATE INDEX IF NOT EXISTS karya_entities_kind_updated
        ON karya_entities(kind, updated_at DESC);
      CREATE TABLE IF NOT EXISTS karya_activities (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        profile_id TEXT,
        workspace_id TEXT,
        resource_id TEXT,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS karya_activities_occurred
        ON karya_activities(occurred_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS karya_activities_profile
        ON karya_activities(profile_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS karya_activities_workspace
        ON karya_activities(workspace_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS karya_activities_resource
        ON karya_activities(resource_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS karya_activities_event
        ON karya_activities(event_type, occurred_at DESC);
      CREATE TABLE IF NOT EXISTS karya_notifications (
        id TEXT PRIMARY KEY,
        activity_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        profile_id TEXT,
        workspace_id TEXT,
        resource_id TEXT,
        status TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS karya_notifications_created
        ON karya_notifications(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS karya_notifications_profile_status
        ON karya_notifications(profile_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS karya_notifications_workspace
        ON karya_notifications(workspace_id, created_at DESC);
      INSERT OR IGNORE INTO karya_migrations(version, applied_at)
        VALUES (1, CURRENT_TIMESTAMP);
      INSERT OR IGNORE INTO karya_migrations(version, applied_at)
        VALUES (2, CURRENT_TIMESTAMP);
      INSERT OR IGNORE INTO karya_migrations(version, applied_at)
        VALUES (3, CURRENT_TIMESTAMP);
      INSERT OR IGNORE INTO karya_migrations(version, applied_at)
        VALUES (4, CURRENT_TIMESTAMP);
      INSERT OR IGNORE INTO karya_migrations(version, applied_at)
        VALUES (5, CURRENT_TIMESTAMP);
    `);
  }
}

class JsonRepository<TEntity> {
  constructor(
    protected readonly store: ExpoSqliteStore,
    protected readonly kind: string,
    private readonly idOf: (entity: TEntity) => EntityId,
  ) {}

  list(): Promise<TEntity[]> {
    return this.store.list<TEntity>(this.kind);
  }

  get(id: EntityId): Promise<TEntity | undefined> {
    return this.store.get<TEntity>(this.kind, id);
  }

  save(entity: TEntity): Promise<void> {
    return this.store.save(this.kind, this.idOf(entity), entity);
  }

  delete(id: EntityId): Promise<void> {
    return this.store.delete(this.kind, id);
  }
}

class SearchJsonRepository extends JsonRepository<SearchDocument> implements SearchDocumentRepository {
  constructor(store: ExpoSqliteStore) {
    super(store, "search", (document) => document.id);
  }

  clear(): Promise<void> {
    return this.store.clear(this.kind);
  }
}

class MobileSyncOperationRepository implements SyncOperationRepository {
  private readonly repository: JsonRepository<SyncOperation>;
  constructor(store: ExpoSqliteStore) {
    this.repository = new JsonRepository(store, "sync-operations", (item) => item.id);
  }
  async append(operation: SyncOperation) {
    if (await this.repository.get(operation.id)) return false;
    await this.repository.save(operation);
    return true;
  }
  get(id: EntityId) {
    return this.repository.get(id);
  }
  async list(state?: SyncOperation["acknowledgementState"]) {
    return (await this.repository.list())
      .filter((item) => !state || item.acknowledgementState === state)
      .sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) ||
          a.deviceId.localeCompare(b.deviceId) ||
          a.sequence - b.sequence ||
          a.id.localeCompare(b.id),
      );
  }
  async updateAcknowledgement(
    id: EntityId,
    state: SyncOperation["acknowledgementState"],
    at?: string,
    reason?: string,
  ) {
    const current = await this.repository.get(id);
    if (!current) throw new Error(`Sync operation not found: ${id}`);
    const updated = {
      ...current,
      acknowledgementState: state,
      acknowledgedAt: state === "acknowledged" ? at : current.acknowledgedAt,
      failureReason: reason,
    };
    await this.repository.save(updated);
    return updated;
  }
}

class ActivityJsonRepository implements ActivityRepository {
  constructor(private readonly store: ExpoSqliteStore) {}

  async append(activity: KaryaActivity): Promise<void> {
    await this.store.appendActivity(activity);
  }

  list(query?: ActivityRepositoryQuery): Promise<KaryaActivity[]> {
    return this.store.listActivities(query);
  }

  get(id: EntityId): Promise<KaryaActivity | undefined> {
    return this.store.getActivity(id);
  }
}

class NotificationJsonRepository implements NotificationRepository {
  constructor(private readonly store: ExpoSqliteStore) {}
  create(notification: KaryaNotification) {
    return this.store.createNotification(notification);
  }
  save(notification: KaryaNotification) {
    return this.store.saveNotification(notification);
  }
  list(query?: NotificationRepositoryQuery) {
    return this.store.listNotifications(query);
  }
  get(id: EntityId) {
    return this.store.getNotification(id);
  }
  countUnread(profileId?: EntityId) {
    return this.store.countUnreadNotifications(profileId);
  }
}

class MobileApplicationRepository
  extends JsonRepository<InstalledApplication>
  implements ApplicationRepository, RegistryApplicationRepository
{
  constructor(store: ExpoSqliteStore) {
    super(store, "applications", (application) => application.metadata.id);
  }

  findById(id: EntityId): Promise<InstalledApplication | undefined> {
    return this.get(id);
  }

  remove(id: EntityId): Promise<void> {
    return this.delete(id);
  }
}

class SessionJsonRepository extends JsonRepository<ContinuitySession> implements SessionRepository {
  constructor(store: ExpoSqliteStore) {
    super(store, "sessions", (session) => session.id);
  }

  async getCurrent(): Promise<ContinuitySession | undefined> {
    return (await this.list())[0];
  }

  saveCurrent(session: ContinuitySession): Promise<void> {
    return this.save(session);
  }
}

class AggregateResourceRepository implements DomainResourceRepository {
  constructor(private readonly repository: ResourceRepository) {}

  async save(resource: ResourceAggregate): Promise<void> {
    await this.repository.save(resourceToDto(resource));
  }

  async findById(id: Identifier): Promise<ResourceAggregate | undefined> {
    const resource = await this.repository.get(id.value);
    return resource ? resourceToDomain(resource) : undefined;
  }

  async list(): Promise<ResourceAggregate[]> {
    return (await this.repository.list()).map(resourceToDomain);
  }
}

class AggregateWorkspaceRepository implements DomainWorkspaceRepository {
  constructor(private readonly repository: WorkspaceRepository) {}

  async save(workspace: WorkspaceAggregate): Promise<void> {
    await this.repository.save(workspaceToDto(workspace));
  }

  async findById(id: Identifier): Promise<WorkspaceAggregate | undefined> {
    const workspace = await this.repository.get(id.value);
    return workspace ? workspaceToDomain(workspace) : undefined;
  }

  async list(): Promise<WorkspaceAggregate[]> {
    return (await this.repository.list()).map(workspaceToDomain);
  }
}

class SqliteResourceQueries implements ResourceQueryRepository {
  constructor(private readonly resources: ResourceRepository) {}
  async getResource(id: EntityId) {
    return new InMemoryResourceQueryRepository(await this.resources.list()).getResource(id);
  }
  async listResources(query?: Parameters<ResourceQueryRepository["listResources"]>[0]) {
    return new InMemoryResourceQueryRepository(await this.resources.list()).listResources(query);
  }
  async recentResources(limit?: number) {
    return new InMemoryResourceQueryRepository(await this.resources.list()).recentResources(limit);
  }
}

class SqliteWorkspaceQueries implements WorkspaceQueryRepository {
  constructor(private readonly workspaces: WorkspaceRepository) {}
  async getWorkspace(id: EntityId) {
    return new InMemoryWorkspaceQueryRepository(await this.workspaces.list()).getWorkspace(id);
  }
  async listWorkspaces(query?: Parameters<WorkspaceQueryRepository["listWorkspaces"]>[0]) {
    return new InMemoryWorkspaceQueryRepository(await this.workspaces.list()).listWorkspaces(query);
  }
}

class SqliteSearchQueries implements SearchQueryRepository {
  constructor(private readonly documents: SearchDocumentRepository) {}
  async search(text: string) {
    return new InMemorySearchQueryRepository(await this.documents.list()).search(text);
  }
}
