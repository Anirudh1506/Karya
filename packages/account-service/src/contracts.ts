import type { Repository } from "@karya/persistence";
import type {
  AccountMetadataExport,
  AccountRecoveryMetadata,
  DeviceTrustState,
  EntityId,
  KaryaAccount,
  ReplicaMembership,
  SyncDeviceState,
  TrustedDevice,
} from "@karya/types";

export interface AccountRepositories {
  accounts: Repository<KaryaAccount>;
  devices: Repository<TrustedDevice>;
  deviceStates: Repository<SyncDeviceState>;
}

export interface LocalDeviceDescriptor {
  name: string;
  platform: TrustedDevice["platform"];
  platformVersion?: string;
}

export interface AccountEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  create(displayName: string, email?: string): Promise<KaryaAccount>;
  current(): Promise<KaryaAccount | undefined>;
  rename(displayName: string): Promise<KaryaAccount>;
  archive(): Promise<KaryaAccount>;
  registerCurrentDevice(): Promise<TrustedDevice>;
  registerDevice(device: Omit<TrustedDevice, "accountId" | "registeredAt" | "lastSeenAt">): Promise<TrustedDevice>;
  unregisterDevice(deviceId: EntityId): Promise<void>;
  renameDevice(deviceId: EntityId, name: string): Promise<TrustedDevice>;
  changeTrust(deviceId: EntityId, trustState: DeviceTrustState): Promise<TrustedDevice>;
  trustedDevices(): Promise<TrustedDevice[]>;
  currentDevice(): Promise<TrustedDevice | undefined>;
  device(deviceId: EntityId): Promise<TrustedDevice | undefined>;
  membership(deviceId: EntityId): Promise<ReplicaMembership | undefined>;
  replicaMembership(): Promise<ReplicaMembership[]>;
  authorizeSynchronization(deviceId: EntityId): Promise<boolean>;
  updateRecovery(patch: Partial<AccountRecoveryMetadata>): Promise<AccountRecoveryMetadata>;
  exportMetadata(): Promise<AccountMetadataExport>;
  importMetadata(value: AccountMetadataExport): Promise<KaryaAccount>;
  attachProfile(profileId: EntityId): Promise<void>;
  subscribe(listener: () => void): () => void;
}
