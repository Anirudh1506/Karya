import type {
  ContinuitySession,
  EntityId,
  InstalledApplication,
  Profile,
  Resource,
  SearchDocument,
  SettingDefinition,
  Workspace,
} from "@karya/types";

export interface Repository<TEntity, TId extends EntityId = EntityId> {
  list(): Promise<TEntity[]>;
  get(id: TId): Promise<TEntity | undefined>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}

export interface ResourceRepository extends Repository<Resource> {}

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

export interface PersistenceProvider {
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
