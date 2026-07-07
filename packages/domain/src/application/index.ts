import type {
  ApplicationCategory,
  ApplicationLifecycleState,
  ApplicationMetadata,
  EntityId,
  InstalledApplication,
  ISODateString,
} from "@karya/types";
import { DomainRuleViolation } from "../common";

export type ApplicationId = EntityId;

export interface ApplicationLaunchRecord {
  launchedAt: ISODateString;
  workspaceId?: EntityId;
  profileId?: EntityId;
  workingDirectory?: string;
  launchArguments: string[];
  resourceIds: EntityId[];
}

export class ApplicationAggregate {
  private constructor(private readonly state: InstalledApplication) {
    if (!state.metadata.id.trim()) {
      throw new DomainRuleViolation("Application id cannot be empty");
    }
    if (!state.metadata.name.trim()) {
      throw new DomainRuleViolation("Application display name cannot be empty");
    }
  }

  static create(input: InstalledApplication): ApplicationAggregate {
    return new ApplicationAggregate(normalizeApplication(input));
  }

  updateMetadata(metadata: Partial<ApplicationMetadata>): ApplicationAggregate {
    return new ApplicationAggregate({
      ...this.state,
      metadata: {
        ...this.state.metadata,
        ...metadata,
        capabilities: metadata.capabilities
          ? [...metadata.capabilities]
          : [...this.state.metadata.capabilities],
      },
    });
  }

  categorize(category: ApplicationCategory): ApplicationAggregate {
    return this.updateMetadata({ category });
  }

  markLifecycle(lifecycleState: ApplicationLifecycleState): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, lifecycleState });
  }

  markUnavailable(): ApplicationAggregate {
    return this.markLifecycle("unavailable");
  }

  markRemoved(): ApplicationAggregate {
    return this.markLifecycle("removed");
  }

  pin(): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, pinned: true });
  }

  unpin(): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, pinned: false });
  }

  favorite(): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, favorite: true });
  }

  unfavorite(): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, favorite: false });
  }

  hide(): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, hidden: true });
  }

  show(): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, hidden: false });
  }

  setDefault(isDefault = true): ApplicationAggregate {
    return new ApplicationAggregate({ ...this.state, defaultApplication: isDefault });
  }

  recordLaunch(launchedAt: ISODateString): ApplicationAggregate {
    if (this.state.lifecycleState === "removed") {
      throw new DomainRuleViolation("Removed applications cannot be launched");
    }

    return new ApplicationAggregate({
      ...this.state,
      lifecycleState: this.state.lifecycleState === "unavailable" ? "unavailable" : "available",
      lastLaunchedAt: launchedAt,
      launchCount: this.state.launchCount + 1,
    });
  }

  toSnapshot(): InstalledApplication {
    return normalizeApplication(this.state);
  }
}

export function normalizeApplication(application: InstalledApplication): InstalledApplication {
  return {
    ...application,
    lifecycleState: application.lifecycleState ?? "installed",
    pinned: Boolean(application.pinned),
    favorite: Boolean(application.favorite),
    hidden: Boolean(application.hidden),
    defaultApplication: Boolean(application.defaultApplication),
    launchCount: application.launchCount ?? 0,
    metadata: {
      ...application.metadata,
      category: application.metadata.category ?? "other",
      platform: application.metadata.platform ?? "unknown",
      launchArguments: [...(application.metadata.launchArguments ?? [])],
      supportedFileTypes: [...(application.metadata.supportedFileTypes ?? [])],
      supportedUrlSchemes: [...(application.metadata.supportedUrlSchemes ?? [])],
      capabilities: [...application.metadata.capabilities],
      attributes: { ...(application.metadata.attributes ?? {}) },
    },
  };
}
