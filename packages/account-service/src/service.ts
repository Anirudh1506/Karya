import type { EventBus } from "@karya/event-bus";
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
import type { AccountEngine, AccountRepositories, LocalDeviceDescriptor } from "./contracts";

export class DefaultAccountEngine implements AccountEngine {
  private account?: KaryaAccount;
  private localDeviceId?: EntityId;
  private readonly listeners = new Set<() => void>();
  private unsubscribeProfile?: () => void;

  constructor(
    private readonly eventBus: EventBus,
    private readonly repositories: AccountRepositories,
    private readonly localDevice: LocalDeviceDescriptor,
    private readonly listProfileIds: () => Promise<EntityId[]> = async () => [],
  ) {}

  async start() {
    const state = await this.ensureDeviceIdentity();
    this.localDeviceId = state.deviceId;
    this.account = (await this.repositories.accounts.list()).find((account) => account.status === "active");
    if (this.account && !(await this.repositories.devices.get(state.deviceId))) await this.registerCurrentDevice();
    this.unsubscribeProfile ??= this.eventBus.subscribe("ProfileCreated", ({ profile }) =>
      this.attachProfile(profile.id),
    );
  }

  async stop() {
    this.unsubscribeProfile?.();
    this.unsubscribeProfile = undefined;
  }

  async create(displayName: string, email?: string) {
    if (this.account?.status === "active") return cloneAccount(this.account);
    const now = new Date().toISOString();
    const account: KaryaAccount = {
      id: crypto.randomUUID(),
      displayName: requireName(displayName, "Account name"),
      email: email?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: "active",
      profileIds: [...new Set(await this.listProfileIds())],
      recovery: {
        id: crypto.randomUUID(),
        recoveryVersion: 1,
        accountGeneration: 1,
        updatedAt: now,
      },
    };
    await this.repositories.accounts.save(account);
    this.account = account;
    await this.eventBus.publish("AccountCreated", { account: cloneAccount(account) });
    await this.registerCurrentDevice();
    this.notify();
    return cloneAccount(account);
  }

  async current() {
    return this.account ? cloneAccount(this.account) : undefined;
  }

  async rename(displayName: string) {
    return this.updateAccount({ displayName: requireName(displayName, "Account name") });
  }

  async archive() {
    return this.updateAccount({ status: "archived" });
  }

  async registerCurrentDevice() {
    const account = this.requireAccount();
    const deviceId = await this.requireLocalDeviceId();
    const existing = await this.repositories.devices.get(deviceId);
    if (existing) return cloneDevice(existing);
    return this.registerDevice({
      id: deviceId,
      name: this.localDevice.name,
      platform: this.localDevice.platform,
      platformVersion: this.localDevice.platformVersion,
      trustState: "trusted",
      syncCapabilities: { operations: true, content: true, background: true },
    });
  }

  async registerDevice(input: Omit<TrustedDevice, "accountId" | "registeredAt" | "lastSeenAt">) {
    const account = this.requireAccount();
    const existing = await this.repositories.devices.get(input.id);
    if (existing) return cloneDevice(existing);
    const now = new Date().toISOString();
    const device: TrustedDevice = { ...input, accountId: account.id, registeredAt: now, lastSeenAt: now };
    await this.repositories.devices.save(device);
    await this.eventBus.publish("DeviceRegistered", { account: cloneAccount(account), device: cloneDevice(device) });
    this.notify();
    return cloneDevice(device);
  }

  async unregisterDevice(deviceId: EntityId) {
    const account = this.requireAccount();
    const device = await this.requireDevice(deviceId);
    await this.repositories.devices.delete(deviceId);
    await this.eventBus.publish("DeviceRemoved", { account: cloneAccount(account), device });
    this.notify();
  }

  async renameDevice(deviceId: EntityId, name: string) {
    const account = this.requireAccount();
    const device = {
      ...(await this.requireDevice(deviceId)),
      name: requireName(name, "Device name"),
      lastSeenAt: new Date().toISOString(),
    };
    await this.repositories.devices.save(device);
    await this.eventBus.publish("DeviceRenamed", { account: cloneAccount(account), device: cloneDevice(device) });
    this.notify();
    return cloneDevice(device);
  }

  async changeTrust(deviceId: EntityId, trustState: DeviceTrustState) {
    const account = this.requireAccount();
    const device = { ...(await this.requireDevice(deviceId)), trustState, lastSeenAt: new Date().toISOString() };
    await this.repositories.devices.save(device);
    await this.eventBus.publish("DeviceTrustChanged", { account: cloneAccount(account), device: cloneDevice(device) });
    this.notify();
    return cloneDevice(device);
  }

  async trustedDevices() {
    const account = this.requireAccount();
    return (await this.repositories.devices.list())
      .filter((device) => device.accountId === account.id && device.trustState === "trusted")
      .map(cloneDevice);
  }

  async currentDevice() {
    const id = await this.requireLocalDeviceId();
    const device = await this.repositories.devices.get(id);
    return device ? cloneDevice(device) : undefined;
  }

  async device(deviceId: EntityId) {
    const device = await this.repositories.devices.get(deviceId);
    return device ? cloneDevice(device) : undefined;
  }

  async membership(deviceId: EntityId): Promise<ReplicaMembership | undefined> {
    const account = this.account;
    const device = await this.repositories.devices.get(deviceId);
    if (!account || !device || device.accountId !== account.id) return undefined;
    const trusted = device.trustState === "trusted";
    return {
      accountId: account.id,
      deviceId,
      trusted,
      authorized: trusted && account.status === "active" && device.syncCapabilities.operations,
      capabilities: { ...device.syncCapabilities },
    };
  }

  async replicaMembership() {
    const account = this.requireAccount();
    return (await this.repositories.devices.list())
      .filter((device) => device.accountId === account.id)
      .map((device) => ({
        accountId: account.id,
        deviceId: device.id,
        trusted: device.trustState === "trusted",
        authorized:
          account.status === "active" && device.trustState === "trusted" && device.syncCapabilities.operations,
        capabilities: { ...device.syncCapabilities },
      }));
  }

  async authorizeSynchronization(deviceId: EntityId) {
    return (await this.membership(deviceId))?.authorized ?? false;
  }

  async updateRecovery(patch: Partial<AccountRecoveryMetadata>) {
    const account = this.requireAccount();
    const recovery = { ...account.recovery, ...patch, id: account.recovery.id, updatedAt: new Date().toISOString() };
    await this.updateAccount({ recovery });
    await this.eventBus.publish("RecoveryMetadataUpdated", {
      account: cloneAccount(this.requireAccount()),
      recovery: { ...recovery },
    });
    return { ...recovery };
  }

  async exportMetadata(): Promise<AccountMetadataExport> {
    const account = this.requireAccount();
    return {
      format: "karya-account-metadata",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      account: cloneAccount(account),
      devices: (await this.repositories.devices.list())
        .filter((device) => device.accountId === account.id)
        .map(cloneDevice),
    };
  }

  async importMetadata(value: AccountMetadataExport) {
    if (value.format !== "karya-account-metadata" || value.formatVersion !== 1)
      throw new Error("Unsupported Karya Account metadata");
    await this.repositories.accounts.save(cloneAccount(value.account));
    for (const device of value.devices) await this.repositories.devices.save(cloneDevice(device));
    this.account = cloneAccount(value.account);
    this.notify();
    return cloneAccount(value.account);
  }

  async attachProfile(profileId: EntityId) {
    if (!this.account || this.account.profileIds.includes(profileId)) return;
    await this.updateAccount({ profileIds: [...this.account.profileIds, profileId] });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async updateAccount(patch: Partial<KaryaAccount>) {
    const current = this.requireAccount();
    const account = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    await this.repositories.accounts.save(account);
    this.account = account;
    await this.eventBus.publish("AccountUpdated", { account: cloneAccount(account) });
    this.notify();
    return cloneAccount(account);
  }

  private async ensureDeviceIdentity() {
    const current = await this.repositories.deviceStates.get("local-device");
    if (current) return current;
    const state: SyncDeviceState = { id: "local-device", deviceId: crypto.randomUUID(), nextSequence: 1 };
    await this.repositories.deviceStates.save(state);
    return state;
  }
  private requireAccount() {
    if (!this.account) throw new Error("Karya Account has not been created");
    return this.account;
  }
  private async requireLocalDeviceId() {
    if (!this.localDeviceId) this.localDeviceId = (await this.ensureDeviceIdentity()).deviceId;
    return this.localDeviceId;
  }
  private async requireDevice(id: EntityId) {
    const device = await this.repositories.devices.get(id);
    if (!device || device.accountId !== this.requireAccount().id) throw new Error(`Trusted Device not found: ${id}`);
    return cloneDevice(device);
  }
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

function requireName(value: string, label: string) {
  const name = value.trim();
  if (!name) throw new Error(`${label} is required`);
  return name;
}
function cloneAccount(value: KaryaAccount): KaryaAccount {
  return {
    ...value,
    profileIds: [...value.profileIds],
    recovery: {
      ...value.recovery,
      backupMetadata: value.recovery.backupMetadata ? { ...value.recovery.backupMetadata } : undefined,
    },
  };
}
function cloneDevice(value: TrustedDevice): TrustedDevice {
  return { ...value, syncCapabilities: { ...value.syncCapabilities } };
}
