import { ApplicationAggregate, normalizeApplication } from "@karya/domain";
import type { EventBus } from "@karya/event-bus";
import type { ApplicationProvider } from "@karya/platform";
import type { EntityId, InstalledApplication } from "@karya/types";
import type { ApplicationRegistry, LaunchApplicationRequest } from "./contracts";
import { InMemoryApplicationRepository, type ApplicationRepository } from "./repository";

export class InMemoryApplicationRegistry implements ApplicationRegistry {
  constructor(
    private readonly eventBus: EventBus,
    seed: InstalledApplication[] = [],
    private readonly applicationProvider: ApplicationProvider = createNoopApplicationProvider(),
    private readonly repository: ApplicationRepository = new InMemoryApplicationRepository(seed.map(normalizeApplication)),
  ) {}

  async discoverApplications(): Promise<InstalledApplication[]> {
    const discovered = await this.applicationProvider.discoverInstalledApplications();
    return this.syncDiscoveredApplications(discovered);
  }

  async refreshApplications(): Promise<InstalledApplication[]> {
    const refreshed = await this.applicationProvider.refreshApplications();
    return this.syncDiscoveredApplications(refreshed);
  }

  private async syncDiscoveredApplications(discovered: InstalledApplication[]): Promise<InstalledApplication[]> {
    const existing = await this.repository.list();
    const seenIds = new Set(discovered.map((application) => application.metadata.id));

    await Promise.all(discovered.map((application) => this.registerApplication(application)));
    await Promise.all(
      existing
        .filter((application) => !seenIds.has(application.metadata.id) && application.lifecycleState !== "removed" && application.lifecycleState !== "unavailable")
        .map((application) => this.saveAndPublish(ApplicationAggregate.create(application).markUnavailable(), "ApplicationUpdated")),
    );

    return this.listInstalledApplications();
  }

  async registerApplication(application: InstalledApplication): Promise<InstalledApplication> {
    const existing = await this.repository.findById(application.metadata.id);
    const aggregate = ApplicationAggregate.create({
      ...normalizeApplication(application),
      pinned: existing?.pinned ?? application.pinned,
      favorite: existing?.favorite ?? application.favorite,
      hidden: existing?.hidden ?? application.hidden,
      defaultApplication: existing?.defaultApplication ?? application.defaultApplication,
      launchCount: existing?.launchCount ?? application.launchCount,
      lastLaunchedAt: existing?.lastLaunchedAt ?? application.lastLaunchedAt,
    });

    return this.saveAndPublish(aggregate, existing ? "ApplicationUpdated" : "ApplicationDiscovered");
  }

  async updateMetadata(id: EntityId, metadata: Partial<InstalledApplication["metadata"]>): Promise<InstalledApplication> {
    const application = await this.requireApplication(id);
    return this.saveAndPublish(ApplicationAggregate.create(application).updateMetadata(metadata), "ApplicationUpdated");
  }

  async removeApplication(id: EntityId): Promise<InstalledApplication> {
    const application = await this.requireApplication(id);
    return this.saveAndPublish(ApplicationAggregate.create(application).markRemoved(), "ApplicationRemoved");
  }

  async categorizeApplication(id: EntityId, category: NonNullable<InstalledApplication["metadata"]["category"]>): Promise<InstalledApplication> {
    const application = await this.requireApplication(id);
    return this.saveAndPublish(ApplicationAggregate.create(application).categorize(category), "ApplicationUpdated");
  }

  async searchApplications(term: string): Promise<InstalledApplication[]> {
    const query = term.trim().toLocaleLowerCase();
    if (!query) return [];

    return (await this.listInstalledApplications()).filter((application) => {
      const metadata = application.metadata;
      return [
        metadata.name,
        metadata.description,
        metadata.category ?? "",
        ...metadata.capabilities,
        ...(metadata.supportedFileTypes ?? []),
        ...(metadata.supportedUrlSchemes ?? []),
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }

  async listInstalledApplications(): Promise<InstalledApplication[]> {
    return (await this.repository.list()).filter((application) =>
      application.lifecycleState === "available"
      && application.metadata.platform !== "karya"
      && !application.hidden,
    );
  }

  async listPinnedApplications(): Promise<InstalledApplication[]> {
    return (await this.listInstalledApplications()).filter((application) => application.pinned && !application.hidden);
  }

  async openApplication(id: EntityId): Promise<InstalledApplication> {
    return this.launchApplication({ applicationId: id });
  }

  async launchApplication(request: LaunchApplicationRequest): Promise<InstalledApplication> {
    const application = await this.requireApplication(request.applicationId);
    const launchArguments = request.launchArguments ?? application.metadata.launchArguments ?? [];
    const workingDirectory = request.workingDirectory ?? application.metadata.workingDirectory;

    if (request.resourcePath) {
      await this.applicationProvider.openFile(application.metadata.id, request.resourcePath);
    } else {
      await this.applicationProvider.launch(application.metadata.id, { arguments: launchArguments, workingDirectory });
    }
    const launched = await this.saveAndPublish(
      ApplicationAggregate.create(application).recordLaunch(new Date().toISOString()),
      "ApplicationLaunched",
      {
        workspaceId: request.workspaceId,
        profileId: request.profileId,
        workingDirectory,
        launchArguments,
        resourceIds: request.resourceIds ?? [],
      },
    );
    await this.eventBus.publish("ApplicationOpened", { applicationId: launched.metadata.id, application: launched });
    await this.eventBus.publish("application:opened", { applicationId: launched.metadata.id });
    return launched;
  }

  async pinApplication(id: EntityId): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).pin(), "ApplicationPinned");
  }

  async unpinApplication(id: EntityId): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).unpin(), "ApplicationUnpinned");
  }

  async favoriteApplication(id: EntityId): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).favorite(), "ApplicationFavorited");
  }

  async unfavoriteApplication(id: EntityId): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).unfavorite(), "ApplicationFavorited");
  }

  async hideApplication(id: EntityId): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).hide(), "ApplicationHidden");
  }

  async showApplication(id: EntityId): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).show(), "ApplicationUpdated");
  }

  async setDefaultApplication(id: EntityId, isDefault = true): Promise<InstalledApplication> {
    return this.saveAndPublish(ApplicationAggregate.create(await this.requireApplication(id)).setDefault(isDefault), "ApplicationUpdated");
  }

  private async requireApplication(id: EntityId): Promise<InstalledApplication> {
    const application = await this.repository.findById(id);
    if (!application) {
      throw new Error(`Application not found: ${id}`);
    }
    return application;
  }

  private async saveAndPublish(
    aggregate: ApplicationAggregate,
    eventName:
      | "ApplicationDiscovered"
      | "ApplicationUpdated"
      | "ApplicationRemoved"
      | "ApplicationLaunched"
      | "ApplicationPinned"
      | "ApplicationUnpinned"
      | "ApplicationFavorited"
      | "ApplicationHidden",
    launchContext?: {
      workspaceId?: EntityId;
      profileId?: EntityId;
      workingDirectory?: string;
      launchArguments: string[];
      resourceIds: EntityId[];
    },
  ): Promise<InstalledApplication> {
    const application = aggregate.toSnapshot();
    await this.repository.save(application);
    await this.eventBus.publish(eventName, { application, applicationId: application.metadata.id, ...launchContext });
    return application;
  }
}

function createNoopApplicationProvider(): ApplicationProvider {
  return {
    async discoverInstalledApplications() {
      return [];
    },
    async refreshApplications() {
      return [];
    },
    async getApplicationMetadata() {
      return undefined;
    },
    async getApplicationIcon() {
      return undefined;
    },
    async resolveExecutablePath() {
      return undefined;
    },
    async openExternal() {},
    async launch() {},
    async openFile() {},
  };
}
