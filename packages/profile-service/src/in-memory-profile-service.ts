import type { EventBus } from "@karya/event-bus";
import type { ProfileRepository } from "@karya/persistence";
import type { EntityId, Profile, ProfileTemplate } from "@karya/types";
import type { CreateProfileRequest, ProfileService, UpdateProfileRequest } from "./contracts";
import { randomUUID } from "node:crypto";

export class InMemoryProfileService implements ProfileService {
  private activeProfileId: EntityId;

  constructor(
    private readonly eventBus: EventBus,
    seed: Profile[],
    private readonly repository: ProfileRepository = new InMemoryProfileRepository(seed),
  ) {
    if (seed.length === 0) {
      throw new Error("ProfileService requires at least one profile");
    }
    this.activeProfileId = seed.find((profile) => (profile.lifecycleState ?? "active") === "active")?.id ?? seed[0].id;
  }

  async listProfiles(): Promise<Profile[]> {
    return this.repository.list();
  }

  async getActiveProfile(): Promise<Profile> {
    return this.requireProfile(this.activeProfileId);
  }

  async switchProfile(id: EntityId): Promise<Profile> {
    return this.activateProfile(id);
  }

  async create(request: CreateProfileRequest): Promise<Profile> {
    const now = new Date().toISOString();
    const template = request.template ?? "custom";
    const profileId = randomUUID();
    const defaultSpaceId = `space:${profileId}:default`;
    const profile: Profile = {
      id: profileId,
      name: request.name.trim() || profileDefaults[template].name,
      description: request.description ?? profileDefaults[template].description,
      icon: request.icon ?? profileDefaults[template].icon,
      accentColor: request.accentColor ?? profileDefaults[template].accentColor,
      template,
      lifecycleState: "active",
      defaultSpaceId,
      spaceIds: [defaultSpaceId],
      createdAt: now,
      updatedAt: now,
      preferences: {
        favoriteWorkspaceIds: [],
        defaultApplicationIds: [],
        defaultCreateTemplateIds: [],
      },
    };

    await this.repository.save(profile);
    await this.eventBus.publish("ProfileCreated", { profile });
    await this.eventBus.publish("ProfileUpdated", { profile });
    return profile;
  }

  async activateProfile(id: EntityId): Promise<Profile> {
    const current = await this.requireProfile(id);
    if (this.lifecycleState(current) !== "active") {
      throw new Error(`Profile is not active: ${id}`);
    }

    const profile = {
      ...this.normalizeProfile(current),
      lastActiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save(profile);
    this.activeProfileId = id;
    await this.eventBus.publish("ProfileOpened", { profile, profileId: id });
    await this.eventBus.publish("ActiveProfileChanged", { profileId: id, profile });
    await this.eventBus.publish("profile:activated", { profileId: id });
    await this.eventBus.publish("profile:changed", { profileId: id });
    return profile;
  }

  async rename(id: EntityId, name: string): Promise<Profile> {
    const profile = await this.update({ id, name });
    await this.eventBus.publish("ProfileRenamed", { profile });
    return profile;
  }

  async update(request: UpdateProfileRequest): Promise<Profile> {
    const profile = this.normalizeProfile(await this.requireProfile(request.id));
    const updated: Profile = {
      ...profile,
      name: request.name?.trim() || profile.name,
      description: request.description ?? profile.description,
      icon: request.icon ?? profile.icon,
      accentColor: request.accentColor ?? profile.accentColor,
      defaultSpaceId: request.defaultSpaceId ?? profile.defaultSpaceId,
      spaceIds: request.spaceIds ?? profile.spaceIds,
      preferences: request.preferences ? { ...profile.preferences, ...request.preferences } : profile.preferences,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.save(updated);
    await this.eventBus.publish("ProfileUpdated", { profile: updated });
    if (updated.id === this.activeProfileId) {
      await this.eventBus.publish("profile:changed", { profileId: updated.id });
    }
    return updated;
  }

  async archive(id: EntityId): Promise<Profile> {
    const profile = await this.transition(id, "archived");
    await this.eventBus.publish("ProfileArchived", { profile });
    return profile;
  }

  async restore(id: EntityId): Promise<Profile> {
    const profile = await this.transition(id, "active");
    await this.eventBus.publish("ProfileRestored", { profile });
    return profile;
  }

  async delete(id: EntityId): Promise<Profile> {
    const profile = await this.transition(id, "deleted");
    await this.eventBus.publish("ProfileDeleted", { profile });
    return profile;
  }

  private async requireProfile(id: EntityId): Promise<Profile> {
    const profile = await this.repository.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }
    return profile;
  }

  private lifecycleState(profile: Profile): NonNullable<Profile["lifecycleState"]> {
    return profile.lifecycleState ?? "active";
  }

  private normalizeProfile(profile: Profile): Profile {
    const template = profile.template ?? "custom";
    return {
      ...profile,
      icon: profile.icon ?? profileDefaults[template].icon,
      accentColor: profile.accentColor ?? profileDefaults[template].accentColor,
      description: profile.description ?? profileDefaults[template].description,
      template,
      lifecycleState: profile.lifecycleState ?? "active",
      updatedAt: profile.updatedAt ?? profile.createdAt,
      preferences: {
        favoriteWorkspaceIds: profile.preferences?.favoriteWorkspaceIds ?? [],
        defaultApplicationIds: profile.preferences?.defaultApplicationIds ?? [],
        defaultCreateTemplateIds: profile.preferences?.defaultCreateTemplateIds ?? [],
        banner: profile.preferences?.banner,
      },
    };
  }

  private async transition(id: EntityId, lifecycleState: NonNullable<Profile["lifecycleState"]>): Promise<Profile> {
    const current = this.normalizeProfile(await this.requireProfile(id));
    if (id === this.activeProfileId && lifecycleState !== "active") {
      const fallback = (await this.repository.list()).find((candidate) => candidate.id !== id && this.lifecycleState(candidate) === "active");
      if (!fallback) {
        throw new Error("Cannot archive or delete the last active profile");
      }
    }

    const now = new Date().toISOString();
    const profile: Profile = {
      ...current,
      lifecycleState,
      archivedAt: lifecycleState === "archived" ? now : current.archivedAt,
      deletedAt: lifecycleState === "deleted" ? now : current.deletedAt,
      updatedAt: now,
    };

    await this.repository.save(profile);
    if (id === this.activeProfileId && lifecycleState !== "active") {
      const fallback = (await this.repository.list()).find((candidate) => candidate.id !== id && this.lifecycleState(candidate) === "active");
      if (fallback) {
        await this.activateProfile(fallback.id);
      }
    }
    await this.eventBus.publish("ProfileUpdated", { profile });
    return profile;
  }
}

const profileDefaults: Record<ProfileTemplate, { name: string; description: string; icon: string; accentColor: string }> = {
  personal: {
    name: "Personal",
    description: "Life admin, writing, learning, and personal captures",
    icon: "User",
    accentColor: "#14b8a6",
  },
  startup: {
    name: "Startup",
    description: "Product, customers, hiring, fundraising, and operations",
    icon: "Rocket",
    accentColor: "#f97316",
  },
  university: {
    name: "University",
    description: "Coursework, research, semester planning, and campus work",
    icon: "GraduationCap",
    accentColor: "#8b5cf6",
  },
  freelancing: {
    name: "Freelancing",
    description: "Client projects, deliverables, proposals, and invoices",
    icon: "Briefcase",
    accentColor: "#0ea5e9",
  },
  custom: {
    name: "New Profile",
    description: "A focused responsibility inside Karya",
    icon: "UserCircle",
    accentColor: "#71717a",
  },
};

class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<EntityId, Profile>();

  constructor(seed: Profile[]) {
    seed.forEach((profile) => this.profiles.set(profile.id, profile));
  }

  async list(): Promise<Profile[]> {
    return [...this.profiles.values()];
  }

  async get(id: EntityId): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async save(profile: Profile): Promise<void> {
    this.profiles.set(profile.id, profile);
  }

  async delete(id: EntityId): Promise<void> {
    this.profiles.delete(id);
  }
}
