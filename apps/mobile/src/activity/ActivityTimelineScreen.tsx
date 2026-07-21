import type { KaryaColorScheme } from "@karya/design-tokens";
import type { KaryaActivity } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { createActivityTimelineStyles } from "./ActivityTimelineScreen.styles";
import { useActivityTimeline } from "./useActivityTimeline";

type Props = NativeStackScreenProps<RootNavigationParamList, "ActivityTimeline">;

export function ActivityTimelineScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createActivityTimelineStyles(scheme), [scheme]);
  const { core, status, startupError, activities, profiles, workspaces } = useActivityTimeline();
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
        <Text style={styles.error}>{startupError?.message ?? "Timeline unavailable."}</Text>
      </View>
    );

  const select = async (activity: KaryaActivity) => {
    setError(undefined);
    try {
      await core.shell.openActivity(activity.id);
      if (activity.object.type === "resource")
        navigation.navigate("ResourceDetail", { resourceId: activity.object.id });
      else if (activity.object.type === "workspace")
        navigation.navigate("Workspaces", { workspaceId: activity.object.id, returnTo: "Home" });
      else if (activity.object.type === "profile") navigation.navigate("Profiles", { returnTo: "Home" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The related item is unavailable.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.eyebrow}>HISTORY</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Activity
      </Text>
      <Text style={styles.subtitle}>A trustworthy history of meaningful work.</Text>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {activities.length ? (
        activities.map((activity) => (
          <Pressable
            accessibilityRole="button"
            key={activity.id}
            onPress={() => void select(activity)}
            style={styles.card}
          >
            <View style={styles.icon}>
              <Text style={styles.iconText}>{iconFor(activity)}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.summary}>{activity.title}</Text>
              <Text style={styles.context}>{contextFor(activity, profiles, workspaces)}</Text>
              <Text style={styles.timestamp}>{formatTimestamp(activity.occurredAt)}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))
      ) : (
        <Text style={styles.empty}>Meaningful work will appear here as it happens.</Text>
      )}
    </ScrollView>
  );
}

function iconFor(activity: KaryaActivity): string {
  if (activity.object.type === "resource") return "R";
  if (activity.object.type === "workspace") return "W";
  if (activity.object.type === "profile") return "P";
  return "•";
}

function contextFor(
  activity: KaryaActivity,
  profiles: Array<{ id: string; name: string }>,
  workspaces: Array<{ id: string; name: string }>,
): string {
  return [
    activity.object.title,
    workspaces.find((workspace) => workspace.id === activity.workspaceId)?.name,
    profiles.find((profile) => profile.id === activity.profileId)?.name,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
