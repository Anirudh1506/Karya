import type { EntityId, ISODateString } from "./common";

export type AccountStatus = "active" | "archived";
export type DeviceTrustState = "trusted" | "untrusted" | "revoked";

export interface DeviceSyncCapabilities {
  operations: boolean;
  content: boolean;
  background: boolean;
}

export interface TrustedDevice {
  id: EntityId;
  accountId: EntityId;
  name: string;
  platform: "ios" | "android" | "macos" | "windows" | "linux" | "unknown";
  platformVersion?: string;
  registeredAt: ISODateString;
  trustState: DeviceTrustState;
  lastSeenAt: ISODateString;
  publicKey?: string;
  syncCapabilities: DeviceSyncCapabilities;
}

export interface AccountRecoveryMetadata {
  id: EntityId;
  recoveryVersion: number;
  accountGeneration: number;
  backupMetadata?: Record<string, string>;
  updatedAt: ISODateString;
}

export interface KaryaAccount {
  id: EntityId;
  displayName: string;
  email?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version: number;
  status: AccountStatus;
  recovery: AccountRecoveryMetadata;
  profileIds: EntityId[];
}

export interface AccountMetadataExport {
  format: "karya-account-metadata";
  formatVersion: 1;
  exportedAt: ISODateString;
  account: KaryaAccount;
  devices: TrustedDevice[];
}

export interface ReplicaMembership {
  accountId: EntityId;
  deviceId: EntityId;
  trusted: boolean;
  authorized: boolean;
  capabilities: DeviceSyncCapabilities;
}

export interface AuthenticationProof {
  providerId: string;
  subject: string;
  issuedAt: ISODateString;
  expiresAt?: ISODateString;
  claims?: Record<string, string>;
}

export interface AuthenticationProvider {
  readonly id: string;
  proveIdentity(): Promise<AuthenticationProof>;
}
