import type { EntityId, ISODateString } from "./common";

export type ApplicationPlatform = "darwin" | "windows" | "linux" | "web" | "karya" | "unknown";

export type ApplicationCategory =
  | "browser"
  | "development"
  | "productivity"
  | "communication"
  | "design"
  | "media"
  | "office"
  | "utility"
  | "system"
  | "ai"
  | "database"
  | "virtualization"
  | "other";

export type ApplicationLifecycleState = "discovered" | "installed" | "available" | "unavailable" | "removed";

export interface ApplicationMetadata {
  id: EntityId;
  name: string;
  description: string;
  icon: string;
  version: string;
  category?: ApplicationCategory;
  platform?: ApplicationPlatform;
  executableIdentifier?: string;
  bundleIdentifier?: string;
  packageIdentifier?: string;
  iconRef?: string;
  installLocation?: string;
  executablePath?: string;
  launchArguments?: string[];
  workingDirectory?: string;
  supportedFileTypes?: string[];
  supportedUrlSchemes?: string[];
  lastUpdatedAt?: ISODateString;
  capabilities: string[];
  attributes?: Record<string, string | number | boolean>;
}

export interface InstalledApplication {
  metadata: ApplicationMetadata;
  installedAt: ISODateString;
  lifecycleState: ApplicationLifecycleState;
  pinned: boolean;
  favorite: boolean;
  hidden: boolean;
  defaultApplication: boolean;
  lastLaunchedAt?: ISODateString;
  launchCount: number;
}
