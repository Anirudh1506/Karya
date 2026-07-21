import type { KaryaColorScheme } from "@karya/design-tokens";
import type { Resource } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { archiveResource, openResource, restoreResource } from "./resource-interactions";
import { useResources } from "./useResources";
import { createResourceListStyles } from "./ResourceListScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "Resources">;
type SortMode = "modified" | "name";

export function ResourceListScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createResourceListStyles(scheme), [scheme]);
  const { core, status, startupError, workspace, active, archived } = useResources();
  const [sort, setSort] = useState<SortMode>("modified");
  const [pendingId, setPendingId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const sorted = useMemo(
    () =>
      [...active].sort(
        sort === "name"
          ? (a, b) => a.metadata.title.localeCompare(b.metadata.title)
          : (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      ),
    [active, sort],
  );
  const run = async (id: string, action: () => Promise<unknown>) => {
    setPendingId(id);
    setActionError(undefined);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The Resource could not be updated.");
    } finally {
      setPendingId(undefined);
    }
  };
  const requestArchive = (resource: Resource) =>
    Alert.alert("Archive Resource?", `${resource.metadata.title} will remain available to restore.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: () => void run(resource.id, () => archiveResource(core!.shell, resource.id)),
      },
    ]);
  if (status === "starting" || !core)
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Starting Karya" />
      </View>
    );
  if (status === "failed")
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{startupError?.message ?? "Karya could not start."}</Text>
      </View>
    );
  if (!workspace)
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Select a Workspace before working with Resources.</Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>Workspace</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {workspace.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("CreateResource")}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>New note</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("ContinueWorking")}
        style={styles.continueButton}
      >
        <Text style={styles.continueButtonText}>Continue working</Text>
        <Text style={styles.continueArrow}>›</Text>
      </Pressable>
      <View style={styles.sortRow}>
        <Text style={styles.sectionTitle}>Notes and resources</Text>
        <View style={styles.segment}>
          <Pressable
            onPress={() => setSort("modified")}
            style={[styles.segmentItem, sort === "modified" && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, sort === "modified" && styles.segmentTextSelected]}>Recent</Text>
          </Pressable>
          <Pressable
            onPress={() => setSort("name")}
            style={[styles.segmentItem, sort === "name" && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, sort === "name" && styles.segmentTextSelected]}>Name</Text>
          </Pressable>
        </View>
      </View>
      {actionError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {actionError}
        </Text>
      ) : null}
      {sorted.length ? (
        <View style={styles.group}>
          {sorted.map((resource, index) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              disabled={pendingId === resource.id}
              last={index === sorted.length - 1}
              onSelect={() =>
                void run(resource.id, async () => {
                  await openResource(core.shell, resource.id);
                  navigation.navigate("ResourceDetail", { resourceId: resource.id });
                })
              }
              onArchive={() => requestArchive(resource)}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No Resources yet. Create a note to begin.</Text>
      )}
      {archived.length ? (
        <>
          <Text style={styles.sectionTitleSpaced}>Archived</Text>
          <View style={styles.group}>
            {archived.map((resource, index) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                archived
                disabled={pendingId === resource.id}
                last={index === archived.length - 1}
                onSelect={() => void run(resource.id, () => restoreResource(core.shell, resource.id))}
                styles={styles}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function ResourceRow({
  resource,
  archived,
  disabled,
  last,
  onSelect,
  onArchive,
  styles,
}: {
  resource: Resource;
  archived?: boolean;
  disabled: boolean;
  last: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  styles: ReturnType<typeof createResourceListStyles>;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onSelect} style={styles.rowMain}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>N</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{resource.metadata.title}</Text>
          <Text style={styles.meta}>
            {archived ? "Tap to restore" : `${displayType(resource)} · ${formatDate(resource.updatedAt)}`}
          </Text>
        </View>
      </Pressable>
      {!archived && onArchive ? (
        <Pressable
          accessibilityLabel={`Archive ${resource.metadata.title}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onArchive}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryActionText}>Archive</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function displayType(resource: Resource) {
  return resource.metadata.kind === "note" ? "Note" : resource.metadata.kind || resource.type;
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
