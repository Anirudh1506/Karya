import type { LinkingOptions } from "@react-navigation/native";

export type RootNavigationParamList = {
  Home: undefined;
  Search: undefined;
  QuickCapture: undefined;
  ActivityTimeline: undefined;
  Notifications: undefined;
  SyncStatus: undefined;
  Account: undefined;
  TransportStatus: undefined;
  Profiles: { returnTo?: "Home" } | undefined;
  CreateProfile: undefined;
  Workspaces: { workspaceId?: string; returnTo?: "Home" } | undefined;
  CreateWorkspace: undefined;
  Resources: undefined;
  ContinueWorking: undefined;
  CreateResource: undefined;
  ResourceDetail: { resourceId: string };
};

export const linking: LinkingOptions<RootNavigationParamList> = {
  prefixes: ["karya://"],
  config: {
    screens: {
      Profiles: "profiles",
      Search: "search",
      QuickCapture: "capture",
      ActivityTimeline: "activity",
      Notifications: "notifications",
      SyncStatus: "sync",
      Account: "account",
      TransportStatus: "transport",
      CreateProfile: "profiles/new",
      Workspaces: "workspaces/:workspaceId?",
      CreateWorkspace: "workspaces/new",
      Resources: "resources",
      ContinueWorking: "continue",
      CreateResource: "resources/new",
      ResourceDetail: "resources/:resourceId",
    },
  },
};
