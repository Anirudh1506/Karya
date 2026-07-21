import type { KaryaColorScheme } from "@karya/design-tokens";
import type { KaryaNotification } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { createNotificationStyles } from "./NotificationCenterScreen.styles";
import { useNotifications } from "./useNotifications";

type Props = NativeStackScreenProps<RootNavigationParamList, "Notifications">;

export function NotificationCenterScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createNotificationStyles(scheme), [scheme]);
  const { core, status, startupError, notifications } = useNotifications();
  const [error, setError] = useState<string>();
  if (status === "starting" || !core)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  if (status === "failed")
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{startupError?.message ?? "Notifications unavailable."}</Text>
      </View>
    );

  const open = async (item: KaryaNotification) => {
    try {
      await core.shell.openNotification(item.id);
      if (item.resourceId) navigation.navigate("ResourceDetail", { resourceId: item.resourceId });
      else if (item.workspaceId) navigation.navigate("Workspaces", { workspaceId: item.workspaceId, returnTo: "Home" });
      else navigation.navigate("Home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The related item is unavailable.");
    }
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Notifications
        </Text>
        {notifications.some((item) => item.status === "unread") ? (
          <Pressable onPress={() => void core.shell.markAllNotificationsRead()}>
            <Text style={styles.action}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notifications.length ? (
        notifications.map((item) => (
          <Pressable key={item.id} onPress={() => void open(item)} style={styles.card}>
            <View style={styles.row}>
              {item.status === "unread" ? <View style={styles.dot} /> : null}
              <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void core.shell.dismissNotification(item.id);
              }}
            >
              <Text style={styles.dismiss}>Dismiss</Text>
            </Pressable>
          </Pressable>
        ))
      ) : (
        <Text style={styles.empty}>Nothing requires your attention.</Text>
      )}
    </ScrollView>
  );
}
