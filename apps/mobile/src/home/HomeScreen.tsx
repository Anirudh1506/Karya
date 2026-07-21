import type { KaryaColorScheme } from "@karya/design-tokens";
import type { ContinueWorkingItem, Resource } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { openResource } from "../resources/resource-interactions";
import { useHome } from "./useHome";
import { createHomeStyles } from "./HomeScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createHomeStyles(scheme), [scheme]);
  const { core, status, startupError, profile, workspace, continueWorking, recentResources, unreadNotificationCount } =
    useHome();
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [platformExpanded, setPlatformExpanded] = useState(false);

  if (status === "starting" || !core)
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Restoring your work" />
      </View>
    );
  if (status === "failed")
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{startupError?.message ?? "Karya could not start."}</Text>
      </View>
    );

  const open = async (resourceId: string) => {
    setPendingId(resourceId);
    setError(undefined);
    try {
      await openResource(core.shell, resourceId);
      navigation.navigate("ResourceDetail", { resourceId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This Resource could not be opened.");
    } finally {
      setPendingId(undefined);
    }
  };

  const priority = continueWorking[0];
  const isEmpty = recentResources.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <View>
          <Text style={styles.brand}>KARYA</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Home
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Search")} style={styles.searchAction}>
          <Text style={styles.searchActionText}>Search</Text>
        </Pressable>
      </View>
      <View accessibilityLabel="Current context" style={styles.contextBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Profiles", { returnTo: "Home" })}
          style={styles.contextItem}
        >
          <Text style={styles.contextLabel}>Profile</Text>
          <Text numberOfLines={1} style={styles.contextValue}>
            {profile?.name ?? "Choose profile"}
          </Text>
        </Pressable>
        <View style={styles.contextDivider} />
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Workspaces", { returnTo: "Home" })}
          style={styles.contextItem}
        >
          <Text style={styles.contextLabel}>Workspace</Text>
          <Text numberOfLines={1} style={styles.contextValue}>
            {workspace?.name ?? "Choose workspace"}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {!profile ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No profiles yet</Text>
          <Text style={styles.emptyBody}>Create a Profile before organizing work.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("CreateProfile")}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Create profile</Text>
          </Pressable>
        </View>
      ) : !workspace ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No workspace selected</Text>
          <Text style={styles.emptyBody}>Create or choose a Workspace before adding Resources.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("CreateWorkspace")}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Create workspace</Text>
          </Pressable>
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Begin here</Text>
          <Text style={styles.emptyBody}>
            Create your first note in {workspace?.name ?? "this Workspace"}. Karya will remember it for next time.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("QuickCapture")}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Create a note</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {priority ? (
            <Section
              title="Continue working"
              actionLabel="See all"
              onAction={() => navigation.navigate("ContinueWorking")}
              styles={styles}
            >
              <ContinueCard
                item={priority}
                disabled={pendingId === priority.resourceId}
                onPress={() => void open(priority.resourceId)}
                styles={styles}
              />
            </Section>
          ) : null}
          <Section
            title="Recent work"
            actionLabel="See all"
            onAction={() => navigation.navigate("Resources")}
            styles={styles}
          >
            <View style={styles.group}>
              {recentResources.map((resource, index) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  disabled={pendingId === resource.id}
                  last={index === recentResources.length - 1}
                  onPress={() => void open(resource.id)}
                  styles={styles}
                />
              ))}
            </View>
          </Section>
        </>
      )}

      <Section title="Keep moving" styles={styles}>
        <View style={styles.quickActions}>
          <QuickAction label="Quick Capture" onPress={() => navigation.navigate("QuickCapture")} styles={styles} />
          <QuickAction label="Activity" onPress={() => navigation.navigate("ActivityTimeline")} styles={styles} />
          <QuickAction
            label={`Notifications${unreadNotificationCount ? ` (${unreadNotificationCount})` : ""}`}
            onPress={() => navigation.navigate("Notifications")}
            styles={styles}
          />
        </View>
      </Section>
      <View style={styles.platformSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: platformExpanded }}
          onPress={() => setPlatformExpanded((expanded) => !expanded)}
          style={styles.platformToggle}
        >
          <Text style={styles.platformToggleText}>Platform details</Text>
          <Text style={styles.platformToggleIcon}>{platformExpanded ? "−" : "+"}</Text>
        </Pressable>
        {platformExpanded ? (
          <View style={styles.platformActions}>
            <QuickAction label="Account and devices" onPress={() => navigation.navigate("Account")} styles={styles} />
            <QuickAction label="Synchronization" onPress={() => navigation.navigate("SyncStatus")} styles={styles} />
            <QuickAction label="Transport" onPress={() => navigation.navigate("TransportStatus")} styles={styles} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
  styles,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  styles: ReturnType<typeof createHomeStyles>;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
function ContinueCard({
  item,
  disabled,
  onPress,
  styles,
}: {
  item: ContinueWorkingItem;
  disabled: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createHomeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue ${item.resourceName}`}
      disabled={disabled}
      onPress={onPress}
      style={styles.continueCard}
    >
      <View style={styles.noteIcon}>
        <Text style={styles.noteIconText}>N</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.continueName}>{item.resourceName}</Text>
        <Text style={styles.meta}>
          {displayType(item.resourceType)} · {item.workspaceName}
        </Text>
        <Text style={styles.activity}>{continuationReason(item)}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}
function ResourceRow({
  resource,
  disabled,
  last,
  onPress,
  styles,
}: {
  resource: Resource;
  disabled: boolean;
  last: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createHomeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.resourceRow, !last && styles.rowBorder]}
    >
      <View style={styles.noteIconSmall}>
        <Text style={styles.noteIconText}>N</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.resourceName}>{resource.metadata.title}</Text>
        <Text style={styles.meta}>
          {displayType(resource.metadata.kind || resource.type)} ·{" "}
          {formatActivity(resource.metadata.updatedAt ?? resource.updatedAt)}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}
function QuickAction({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createHomeStyles>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickAction}>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}
function displayType(type: string) {
  return type === "text/markdown" || type === "note" ? "Note" : type;
}
function formatActivity(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function continuationReason(item: ContinueWorkingItem) {
  if (item.lastOpened && item.lastOpened === item.resumeTimestamp) return `Opened ${formatActivity(item.lastOpened)}`;
  return `Edited ${formatActivity(item.lastModified)}`;
}
