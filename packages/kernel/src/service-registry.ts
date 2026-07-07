import type { KernelServiceKey, KernelServices, ServiceDescriptor } from "./contracts";

export class ServiceRegistry {
  private readonly descriptors = new Map<KernelServiceKey, ServiceDescriptor>();
  private startupOrder: KernelServiceKey[] = [];
  private started = false;

  register<TKey extends KernelServiceKey>(descriptor: ServiceDescriptor<TKey>): void {
    this.descriptors.set(descriptor.key, descriptor as ServiceDescriptor);
  }

  resolve<TKey extends KernelServiceKey>(key: TKey): KernelServices[TKey] {
    const descriptor = this.descriptors.get(key);
    if (!descriptor) {
      throw new Error(`Kernel service is not registered: ${String(key)}`);
    }
    return descriptor.service as KernelServices[TKey];
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.startupOrder = this.resolveStartupOrder();
    for (const key of this.startupOrder) {
      await this.descriptors.get(key)?.start?.();
    }
    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    for (const key of [...this.startupOrder].reverse()) {
      await this.descriptors.get(key)?.stop?.();
    }
    this.started = false;
    this.startupOrder = [];
  }

  snapshot(): KernelServices {
    return {
      activityService: this.resolve("activityService"),
      applicationRegistry: this.resolve("applicationRegistry"),
      commandRegistry: this.resolve("commandRegistry"),
      continuityService: this.resolve("continuityService"),
      eventService: this.resolve("eventService"),
      eventBus: this.resolve("eventBus"),
      importService: this.resolve("importService"),
      notificationService: this.resolve("notificationService"),
      profileService: this.resolve("profileService"),
      queryService: this.resolve("queryService"),
      relationshipService: this.resolve("relationshipService"),
      resourceService: this.resolve("resourceService"),
      searchService: this.resolve("searchService"),
      settingsService: this.resolve("settingsService"),
      workspaceService: this.resolve("workspaceService"),
    };
  }

  private resolveStartupOrder(): KernelServiceKey[] {
    const visited = new Set<KernelServiceKey>();
    const visiting = new Set<KernelServiceKey>();
    const ordered: KernelServiceKey[] = [];

    const visit = (key: KernelServiceKey): void => {
      if (visited.has(key)) return;
      if (visiting.has(key)) {
        throw new Error(`Circular service dependency detected at ${String(key)}`);
      }

      visiting.add(key);
      const descriptor = this.descriptors.get(key);
      if (!descriptor) {
        throw new Error(`Missing service descriptor: ${String(key)}`);
      }
      descriptor.dependencies?.forEach(visit);
      visiting.delete(key);
      visited.add(key);
      ordered.push(key);
    };

    [...this.descriptors.keys()].forEach(visit);
    return ordered;
  }
}
