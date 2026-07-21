import type { KaryaColorScheme } from "@karya/design-tokens";
import type { Workspace } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { activateWorkspace, archiveWorkspace, restoreWorkspace } from "./workspace-interactions";
import { useWorkspaces } from "./useWorkspaces";
import { createWorkspaceListStyles } from "./WorkspaceListScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "Workspaces">;

export function WorkspaceListScreen({ navigation, route }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createWorkspaceListStyles(scheme), [scheme]);
  const { core, status, startupError, profile, active, workspaces, archived } = useWorkspaces();
  const [pendingId, setPendingId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const routedId = useRef<string | undefined>(undefined);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setPendingId(id);
    setActionError(undefined);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The workspace could not be updated.");
    } finally {
      setPendingId(undefined);
    }
  };

  useEffect(() => {
    const workspaceId = route.params?.workspaceId;
    if (!core || status !== "ready" || !workspaceId || routedId.current === workspaceId) return;
    routedId.current = workspaceId;
    void run(workspaceId, () => activateWorkspace(core.shell, workspaceId));
  }, [core, route.params?.workspaceId, status]);

  const requestArchive = (workspace: Workspace) =>
    Alert.alert("Archive workspace?", `${workspace.name} will remain available to restore.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: () => void run(workspace.id, () => archiveWorkspace(core!.shell, workspace.id)),
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

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>{profile?.name?.toUpperCase() ?? "KARYA"}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Workspaces
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.navigate("CreateWorkspace")}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>New workspace</Text>
        </Pressable>
      </View>
      <Text style={styles.intro}>
        A workspace is a related body of work inside {profile?.name ?? "this profile"}, such as a project, course, or
        area of responsibility.
      </Text>
      {actionError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {actionError}
        </Text>
      ) : null}
      <Text style={styles.sectionTitle}>Available</Text>
      {workspaces.length ? (
        <View style={styles.group}>
          {workspaces.map((workspace, index) => (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              active={workspace.id === active?.id}
              disabled={pendingId === workspace.id}
              last={index === workspaces.length - 1}
              onSelect={() =>
                void run(workspace.id, async () => {
                  await activateWorkspace(core.shell, workspace.id);
                  navigation.navigate(route.params?.returnTo === "Home" ? "Home" : "Resources");
                })
              }
              onArchive={() => requestArchive(workspace)}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No workspaces yet. Create one to begin.</Text>
      )}
      {archived.length ? (
        <>
          <Text style={styles.sectionTitle}>Archived</Text>
          <View style={styles.group}>
            {archived.map((workspace, index) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                archived
                disabled={pendingId === workspace.id}
                last={index === archived.length - 1}
                onSelect={() => void run(workspace.id, () => restoreWorkspace(core.shell, workspace.id))}
                styles={styles}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function WorkspaceRow({
  workspace,
  active,
  archived,
  disabled,
  last,
  onSelect,
  onArchive,
  styles,
}: {
  workspace: Workspace;
  active?: boolean;
  archived?: boolean;
  disabled: boolean;
  last: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  styles: ReturnType<typeof createWorkspaceListStyles>;
}) {
  const color = workspace.metadata.color ?? "#2563EB";
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={onSelect}
        style={styles.rowMain}
      >
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{workspace.metadata.icon || workspace.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{workspace.name}</Text>
          <Text numberOfLines={1} style={styles.meta}>
            {archived
              ? "Tap to restore"
              : active
                ? "Current workspace"
                : workspace.metadata.description || "Tap to switch"}
          </Text>
        </View>
      </Pressable>
      {!archived && onArchive ? (
        <Pressable
          accessibilityLabel={`Archive ${workspace.name}`}
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={8}
          onPress={onArchive}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryActionText}>Archive</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
