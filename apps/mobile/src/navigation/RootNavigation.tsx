import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CreateProfileScreen } from "../profiles/CreateProfileScreen";
import { ProfileListScreen } from "../profiles/ProfileListScreen";
import { CreateWorkspaceScreen } from "../workspaces/CreateWorkspaceScreen";
import { WorkspaceListScreen } from "../workspaces/WorkspaceListScreen";
import { CreateResourceScreen } from "../resources/CreateResourceScreen";
import { ResourceDetailScreen } from "../resources/ResourceDetailScreen";
import { ResourceListScreen } from "../resources/ResourceListScreen";
import { ContinueWorkingScreen } from "../continue-working/ContinueWorkingScreen";
import { HomeScreen } from "../home/HomeScreen";
import { SearchScreen } from "../search/SearchScreen";
import { QuickCaptureScreen } from "../capture/QuickCaptureScreen";
import { ActivityTimelineScreen } from "../activity/ActivityTimelineScreen";
import { NotificationCenterScreen } from "../notifications/NotificationCenterScreen";
import { SyncStatusScreen } from "../sync/SyncStatusScreen";
import { AccountScreen } from "../account/AccountScreen";
import { TransportStatusScreen } from "../transport/TransportStatusScreen";
import { linking } from "./linking";
import type { RootNavigationParamList } from "./linking";

interface RootNavigationProps {
  theme: Theme;
}

const Stack = createNativeStackNavigator<RootNavigationParamList>();

export function RootNavigation({ theme }: RootNavigationProps) {
  return (
    <NavigationContainer linking={linking} theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="QuickCapture"
          component={QuickCaptureScreen}
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen name="ActivityTimeline" component={ActivityTimelineScreen} options={{ title: "Activity" }} />
        <Stack.Screen name="Notifications" component={NotificationCenterScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ title: "Synchronization" }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account" }} />
        <Stack.Screen name="TransportStatus" component={TransportStatusScreen} options={{ title: "Transport" }} />
        <Stack.Screen name="Profiles" component={ProfileListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateProfile" component={CreateProfileScreen} options={{ title: "New profile" }} />
        <Stack.Screen name="Workspaces" component={WorkspaceListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateWorkspace" component={CreateWorkspaceScreen} options={{ title: "New workspace" }} />
        <Stack.Screen name="Resources" component={ResourceListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ContinueWorking" component={ContinueWorkingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateResource" component={CreateResourceScreen} options={{ title: "New note" }} />
        <Stack.Screen name="ResourceDetail" component={ResourceDetailScreen} options={{ title: "Resource" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
