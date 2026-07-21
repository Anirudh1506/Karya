import type {
  ContinuitySession,
  EditableResourceContent,
  EditCheckpoint,
  EditSession,
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
  SyncOperation,
  SyncReplayReceipt,
  KaryaAccount,
  TrustedDevice,
  TransportSessionRecord,
} from "@karya/types";

export interface Repository<TEntity, TId extends EntityId = EntityId> {
  list(): Promise<TEntity[]>;
  get(id: TId): Promise<TEntity | undefined>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}

export interface ResourceRepository extends Repository<Resource> {}

export interface ActivityRepository {
  append(activity: KaryaActivity): Promise<void>;
  list(query?: ActivityRepositoryQuery): Promise<KaryaActivity[]>;
  get(id: EntityId): Promise<KaryaActivity | undefined>;
}

export interface ActivityRepositoryQuery {
  profileId?: EntityId;
  workspaceId?: EntityId;
  resourceId?: EntityId;
  eventType?: string;
  limit?: number;
}

export interface NotificationRepository {
  create(notification: KaryaNotification): Promise<boolean>;
  save(notification: KaryaNotification): Promise<void>;
  list(query?: NotificationRepositoryQuery): Promise<KaryaNotification[]>;
  get(id: EntityId): Promise<KaryaNotification | undefined>;
  countUnread(profileId?: EntityId): Promise<number>;
}

export interface NotificationRepositoryQuery {
  profileId?: EntityId;
  workspaceId?: EntityId;
  unreadOnly?: boolean;
  includeDismissed?: boolean;
  limit?: number;
}

export interface WorkspaceRepository extends Repository<Workspace> {}

export interface ProfileRepository extends Repository<Profile> {}

export interface ApplicationRepository extends Repository<InstalledApplication> {
  get(id: EntityId): Promise<InstalledApplication | undefined>;
}

export interface SettingsRepository extends Repository<SettingDefinition> {}

export interface SearchDocumentRepository extends Repository<SearchDocument> {
  clear(): Promise<void>;
}

export interface SessionRepository extends Repository<ContinuitySession> {
  getCurrent(): Promise<ContinuitySession | undefined>;
  saveCurrent(session: ContinuitySession): Promise<void>;
}

export interface MetadataUnitOfWork {
  transaction<TResult>(operation: () => Promise<TResult>): Promise<TResult>;
}

export interface SyncOperationRepository {
  append(operation: SyncOperation): Promise<boolean>;
  get(id: EntityId): Promise<SyncOperation | undefined>;
  list(state?: SyncOperation["acknowledgementState"]): Promise<SyncOperation[]>;
  updateAcknowledgement(
    id: EntityId,
    state: SyncOperation["acknowledgementState"],
    at?: string,
    reason?: string,
  ): Promise<SyncOperation>;
}

export interface PersistenceProvider {
  accounts: Repository<KaryaAccount>;
  trustedDevices: Repository<TrustedDevice>;
  transportSessions: Repository<TransportSessionRecord>;
  syncOperations: SyncOperationRepository;
  syncDeviceStates: Repository<SyncDeviceState>;
  syncReplayReceipts: Repository<SyncReplayReceipt>;
  syncConflicts: Repository<SyncConflict>;
  editableContents: Repository<EditableResourceContent>;
  editCheckpoints: Repository<EditCheckpoint>;
  editSessions: Repository<EditSession>;
  activities: ActivityRepository;
  notifications: NotificationRepository;
  resources: ResourceRepository;
  workspaces: WorkspaceRepository;
  profiles: ProfileRepository;
  applications: ApplicationRepository;
  settings: SettingsRepository;
  search: SearchDocumentRepository;
  sessions: SessionRepository;
  unitOfWork?: MetadataUnitOfWork;
  initialize(): Promise<void>;
  close(): Promise<void>;
}
