/// <reference path="./better-sqlite3.d.ts" />
import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import type { ApplicationRepository } from "@karya/application-registry";
import type { ResourceQueryRepository, SearchQueryRepository, WorkspaceQueryRepository } from "@karya/query-service";
import type {
  PersistenceProvider,
  ActivityRepository,
  NotificationRepository,
  ProfileRepository,
  ResourceRepository,
  SearchDocumentRepository,
  SessionRepository,
  SettingsRepository,
  WorkspaceRepository,
  SyncOperationRepository,
  Repository,
} from "@karya/persistence";
import type {
  ResourceRepository as DomainResourceRepository,
  WorkspaceRepository as DomainWorkspaceRepository,
} from "@karya/domain";
import { Identifier } from "@karya/domain";
import type {
  EditableResourceContent,
  EditCheckpoint,
  EditSession,
  EntityId,
  InstalledApplication,
  Profile,
  Resource,
  SettingDefinition,
  Workspace,
  SyncConflict,
  SyncDeviceState,
  SyncOperation,
  SyncReplayReceipt,
  KaryaAccount,
  TrustedDevice,
  TransportSessionRecord,
} from "@karya/types";
import { toDto as resourceToDto, toDomain as resourceToDomain } from "@karya/resource-service";
import { toDto as workspaceToDto, toDomain as workspaceToDomain } from "@karya/workspace-service";
import { migrateMetadataStore } from "./schema";
import {
  SqliteApplicationRepository,
  SqliteActivityRepository,
  SqliteNotificationRepository,
  SqliteResourceRepository,
  SqliteSearchDocumentRepository,
  SqliteSessionRepository,
  SqliteWorkspaceRepository,
  createProfileRepository,
  createSettingsRepository,
} from "./repositories";
import {
  SqliteResourceQueryRepository,
  SqliteSearchQueryRepository,
  SqliteWorkspaceQueryRepository,
} from "./query-repositories";

export interface MetadataStoreOptions {
  databasePath: string;
}

export interface MetadataStoreSeed {
  applications: InstalledApplication[];
  profiles: Profile[];
  resources: Resource[];
  settings: SettingDefinition[];
  workspaces: Workspace[];
  session: import("@karya/types").ContinuitySession;
}

export class KaryaMetadataStore implements PersistenceProvider {
  private readonly database: SqliteDatabase;
  readonly accounts: Repository<KaryaAccount>;
  readonly trustedDevices: Repository<TrustedDevice>;
  readonly transportSessions: Repository<TransportSessionRecord>;
  readonly aggregateResources: DomainResourceRepository;
  readonly activities: ActivityRepository;
  readonly notifications: NotificationRepository;
  readonly syncOperations: SyncOperationRepository;
  readonly syncDeviceStates: Repository<SyncDeviceState>;
  readonly syncReplayReceipts: Repository<SyncReplayReceipt>;
  readonly syncConflicts: Repository<SyncConflict>;
  readonly editableContents: Repository<EditableResourceContent>;
  readonly editCheckpoints: Repository<EditCheckpoint>;
  readonly editSessions: Repository<EditSession>;
  readonly aggregateWorkspaces: DomainWorkspaceRepository;
  readonly applications: ApplicationRepository;
  readonly profiles: ProfileRepository;
  readonly resources: ResourceRepository;
  readonly resourceQueries: ResourceQueryRepository;
  readonly searchQueries: SearchQueryRepository;
  readonly search: SearchDocumentRepository;
  readonly settings: SettingsRepository;
  readonly sessions: SessionRepository;
  readonly workspaces: WorkspaceRepository;
  readonly workspaceQueries: WorkspaceQueryRepository;

  constructor(options: MetadataStoreOptions) {
    this.database = Database(options.databasePath);
    this.accounts = createEditingRepository<KaryaAccount>(this.database, "accounts");
    this.trustedDevices = createEditingRepository<TrustedDevice>(this.database, "trusted_devices");
    this.transportSessions = createEditingRepository<TransportSessionRecord>(this.database, "transport_sessions");
    this.aggregateResources = new SqliteResourceRepository(this.database);
    this.activities = new SqliteActivityRepository(this.database);
    this.notifications = new SqliteNotificationRepository(this.database);
    this.syncOperations = new SqliteSyncOperationRepository(this.database);
    this.syncDeviceStates = createEditingRepository<SyncDeviceState>(this.database, "sync_device_states");
    this.syncReplayReceipts = createEditingRepository<SyncReplayReceipt>(this.database, "sync_replay_receipts");
    this.syncConflicts = createEditingRepository<SyncConflict>(this.database, "sync_conflicts");
    this.editableContents = createEditingRepository<EditableResourceContent>(this.database, "editable_contents");
    this.editCheckpoints = createEditingRepository<EditCheckpoint>(this.database, "edit_checkpoints");
    this.editSessions = createEditingRepository<EditSession>(this.database, "edit_sessions");
    this.aggregateWorkspaces = new SqliteWorkspaceRepository(this.database);
    this.applications = new SqliteApplicationRepository(this.database);
    this.profiles = createProfileRepository(this.database);
    this.search = new SqliteSearchDocumentRepository(this.database);
    this.settings = createSettingsRepository(this.database);
    this.sessions = new SqliteSessionRepository(this.database);
    this.resources = new ResourceDtoRepository(this.aggregateResources);
    this.resourceQueries = new SqliteResourceQueryRepository(this.database);
    this.searchQueries = new SqliteSearchQueryRepository(this.database);
    this.workspaces = new WorkspaceDtoRepository(this.aggregateWorkspaces);
    this.workspaceQueries = new SqliteWorkspaceQueryRepository(this.database);
  }

  async initialize(): Promise<void> {
    migrateMetadataStore(this.database);
    this.verifyIntegrity();
  }

  async seedIfEmpty(seed: MetadataStoreSeed): Promise<void> {
    await this.initialize();
    const existingProfiles = await this.profiles.list();
    if (existingProfiles.length === 0) {
      await Promise.all(seed.profiles.map((profile) => this.profiles.save(profile)));
    } else {
      const existingIds = new Set(existingProfiles.map((profile) => profile.id));
      await Promise.all(
        seed.profiles.filter((profile) => !existingIds.has(profile.id)).map((profile) => this.profiles.save(profile)),
      );
    }
    const existingResources = await this.aggregateResources.list();
    if (existingResources.length === 0) {
      await Promise.all(seed.resources.map((resource) => this.aggregateResources.save(resourceToDomain(resource))));
    } else {
      const existingIds = new Set(existingResources.map((resource) => resource.toSnapshot().id.value));
      await Promise.all(
        seed.resources
          .filter((resource) => !existingIds.has(resource.id))
          .map((resource) => this.aggregateResources.save(resourceToDomain(resource))),
      );
    }
    const existingWorkspaces = await this.aggregateWorkspaces.list();
    if (existingWorkspaces.length === 0) {
      await Promise.all(
        seed.workspaces.map((workspace) => this.aggregateWorkspaces.save(workspaceToDomain(workspace))),
      );
    } else {
      const existingIds = new Set(existingWorkspaces.map((workspace) => workspace.toSnapshot().id.value));
      await Promise.all(
        seed.workspaces
          .filter((workspace) => !existingIds.has(workspace.id))
          .map((workspace) => this.aggregateWorkspaces.save(workspaceToDomain(workspace))),
      );
    }
    await this.normalizeDesktopDefaultSpace(seed);
    const existingApplications = await this.applications.list();
    if (existingApplications.length === 0) {
      await Promise.all(seed.applications.map((application) => this.applications.save(application)));
    } else {
      const existingIds = new Set(existingApplications.map((application) => application.metadata.id));
      await Promise.all(
        seed.applications
          .filter((application) => !existingIds.has(application.metadata.id))
          .map((application) => this.applications.save(application)),
      );
    }
    const existingSettings = await this.settings.list();
    if (existingSettings.length === 0) {
      await Promise.all(seed.settings.map((setting) => this.settings.save(setting)));
    } else {
      const existingIds = new Set(existingSettings.map((setting) => setting.id));
      await Promise.all(
        seed.settings.filter((setting) => !existingIds.has(setting.id)).map((setting) => this.settings.save(setting)),
      );
    }
    const currentSession = await this.sessions.getCurrent();
    const currentProfileExists = currentSession
      ? Boolean(await this.profiles.get(currentSession.activeProfileId))
      : false;
    const currentWorkspaceExists = currentSession?.activeWorkspaceId
      ? Boolean(await this.workspaces.get(currentSession.activeWorkspaceId))
      : true;
    if (!currentSession || !currentProfileExists || !currentWorkspaceExists) {
      await this.sessions.saveCurrent(seed.session);
    }
  }

  private async normalizeDesktopDefaultSpace(seed: MetadataStoreSeed): Promise<void> {
    const desktopDefaultSpace = seed.workspaces.find(
      (workspace) => workspace.id === "workspace-desktop-home-default-space",
    );
    if (!desktopDefaultSpace) return;

    const existingWorkspace = await this.workspaces.get(desktopDefaultSpace.id);
    if (
      existingWorkspace &&
      (existingWorkspace.profileId !== desktopDefaultSpace.profileId ||
        existingWorkspace.owner !== desktopDefaultSpace.owner ||
        existingWorkspace.name !== desktopDefaultSpace.name)
    ) {
      await this.workspaces.save({
        ...existingWorkspace,
        name: desktopDefaultSpace.name,
        metadata: {
          ...existingWorkspace.metadata,
          name: desktopDefaultSpace.metadata.name,
          description: desktopDefaultSpace.metadata.description,
          updatedAt: new Date().toISOString(),
          updatedBy: desktopDefaultSpace.owner,
        },
        profileId: desktopDefaultSpace.profileId,
        owner: desktopDefaultSpace.owner,
        updatedAt: new Date().toISOString(),
      });
    }

    const resources = await this.resources.list();
    await Promise.all(
      resources
        .filter(
          (resource) => resource.defaultSpace === "user" || resource.workspaceRefs.includes(desktopDefaultSpace.id),
        )
        .filter(
          (resource) =>
            resource.profileId !== desktopDefaultSpace.profileId || resource.owner !== desktopDefaultSpace.owner,
        )
        .map((resource) =>
          this.resources.save({
            ...resource,
            owner: desktopDefaultSpace.owner,
            profileId: desktopDefaultSpace.profileId,
            updatedAt: new Date().toISOString(),
            metadata: {
              ...resource.metadata,
              updatedAt: new Date().toISOString(),
              updatedBy: desktopDefaultSpace.owner,
            },
          }),
        ),
    );
  }

  transaction<TResult>(operation: () => TResult): TResult {
    return this.database.transaction(operation)();
  }

  readonly unitOfWork = {
    transaction: async <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const result = await operation();
        this.database.exec("COMMIT");
        return result;
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    },
  };

  async close(): Promise<void> {
    this.database.close();
  }

  private verifyIntegrity(): void {
    const rows = this.database.pragma("integrity_check") as Array<{ integrity_check: string }>;
    const result = rows[0]?.integrity_check ?? "unknown";
    if (result !== "ok") {
      throw new Error(`Metadata store integrity check failed: ${result}`);
    }
  }
}

function createEditingRepository<TEntity extends { id: EntityId }>(
  database: SqliteDatabase,
  table: string,
): Repository<TEntity> {
  return {
    async list() {
      return (
        database.prepare(`SELECT payload FROM ${table} ORDER BY updated_at ASC, id ASC`).all() as Array<{
          payload: string;
        }>
      ).map((row) => JSON.parse(row.payload) as TEntity);
    },
    async get(id) {
      const row = database.prepare(`SELECT payload FROM ${table} WHERE id = ?`).get(id) as
        { payload: string } | undefined;
      return row ? (JSON.parse(row.payload) as TEntity) : undefined;
    },
    async save(entity) {
      database
        .prepare(
          `INSERT INTO ${table} (id, updated_at, payload) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload`,
        )
        .run(entity.id, new Date().toISOString(), JSON.stringify(entity));
    },
    async delete(id) {
      database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    },
  };
}

class SqliteSyncOperationRepository implements SyncOperationRepository {
  constructor(private readonly database: SqliteDatabase) {}
  async append(operation: SyncOperation): Promise<boolean> {
    const result = this.database
      .prepare(
        `INSERT OR IGNORE INTO sync_operations (id, device_id, sequence, timestamp, acknowledgement_state, payload) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        operation.id,
        operation.deviceId,
        operation.sequence,
        operation.timestamp,
        operation.acknowledgementState,
        JSON.stringify(operation),
      );
    return result.changes > 0;
  }
  async get(id: EntityId) {
    const row = this.database.prepare("SELECT payload FROM sync_operations WHERE id = ?").get(id) as
      { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as SyncOperation) : undefined;
  }
  async list(state?: SyncOperation["acknowledgementState"]) {
    const rows = (
      state
        ? this.database
            .prepare(
              "SELECT payload FROM sync_operations WHERE acknowledgement_state = ? ORDER BY timestamp, device_id, sequence, id",
            )
            .all(state)
        : this.database.prepare("SELECT payload FROM sync_operations ORDER BY timestamp, device_id, sequence, id").all()
    ) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as SyncOperation);
  }
  async updateAcknowledgement(
    id: EntityId,
    state: SyncOperation["acknowledgementState"],
    at?: string,
    reason?: string,
  ) {
    const current = await this.get(id);
    if (!current) throw new Error(`Sync operation not found: ${id}`);
    const updated: SyncOperation = {
      ...current,
      acknowledgementState: state,
      acknowledgedAt: state === "acknowledged" ? at : current.acknowledgedAt,
      failureReason: reason,
    };
    this.database
      .prepare("UPDATE sync_operations SET acknowledgement_state = ?, payload = ? WHERE id = ?")
      .run(state, JSON.stringify(updated), id);
    return updated;
  }
}

class ResourceDtoRepository implements ResourceRepository {
  constructor(private readonly repository: DomainResourceRepository) {}

  async list(): Promise<Resource[]> {
    return (await this.repository.list()).map(resourceToDto);
  }

  async get(id: EntityId): Promise<Resource | undefined> {
    const resource = await this.repository.findById(Identifier.from(id, "ResourceId"));
    return resource ? resourceToDto(resource) : undefined;
  }

  async save(resource: Resource): Promise<void> {
    await this.repository.save(resourceToDomain(resource));
  }

  async delete(id: EntityId): Promise<void> {
    const resource = await this.get(id);
    if (!resource) return;
    await this.save({ ...resource, lifecycleState: "deleted", status: "deleted" });
  }
}

class WorkspaceDtoRepository implements WorkspaceRepository {
  constructor(private readonly repository: DomainWorkspaceRepository) {}

  async list(): Promise<Workspace[]> {
    return (await this.repository.list()).map(workspaceToDto);
  }

  async get(id: EntityId): Promise<Workspace | undefined> {
    const workspace = await this.repository.findById(Identifier.from(id, "WorkspaceId"));
    return workspace ? workspaceToDto(workspace) : undefined;
  }

  async save(workspace: Workspace): Promise<void> {
    await this.repository.save(workspaceToDomain(workspace));
  }

  async delete(id: EntityId): Promise<void> {
    const workspace = await this.get(id);
    if (!workspace) return;
    await this.save({ ...workspace, lifecycleState: "deleted", deletedAt: new Date().toISOString() });
  }
}
