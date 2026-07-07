import { DomainRuleViolation, Identifier } from "../common";

export type ProfileId = Identifier;
export type WorkspaceId = Identifier;

export interface DefaultSpace {
  workspaceId: WorkspaceId;
  label: string;
}

export interface ProfileSettings {
  theme: "system" | "light" | "dark";
}

export interface ProfileProps {
  id: ProfileId;
  name: string;
  defaultSpace: DefaultSpace;
  workspaceIds: WorkspaceId[];
  settings: ProfileSettings;
}

export class Profile {
  private constructor(private props: ProfileProps) {
    this.assertInvariants();
  }

  static create(props: ProfileProps): Profile {
    return new Profile(props);
  }

  addWorkspace(workspaceId: WorkspaceId): Profile {
    if (!this.props.workspaceIds.some((id) => id.equals(workspaceId))) {
      this.props = { ...this.props, workspaceIds: [...this.props.workspaceIds, workspaceId] };
    }
    return this;
  }

  setDefaultSpace(defaultSpace: DefaultSpace): Profile {
    this.props = { ...this.props, defaultSpace };
    this.assertInvariants();
    return this;
  }

  toSnapshot(): ProfileProps {
    return {
      ...this.props,
      defaultSpace: { ...this.props.defaultSpace },
      workspaceIds: [...this.props.workspaceIds],
      settings: { ...this.props.settings },
    };
  }

  private assertInvariants(): void {
    if (!this.props.name.trim()) {
      throw new DomainRuleViolation("Profile name cannot be empty");
    }
    if (!this.props.workspaceIds.some((id) => id.equals(this.props.defaultSpace.workspaceId))) {
      throw new DomainRuleViolation("Profile default space must belong to the profile");
    }
  }
}
