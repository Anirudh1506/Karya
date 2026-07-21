import type { KaryaColorScheme } from "@karya/design-tokens";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { moveResource, openResource, renameResource } from "./resource-interactions";
import { useResources } from "./useResources";
import { createResourceDetailStyles } from "./ResourceDetailScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "ResourceDetail">;
export function ResourceDetailScreen({ navigation, route }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createResourceDetailStyles(scheme), [scheme]);
  const { core, workspace, workspaces, active, archived } = useResources();
  const resource = [...active, ...archived].find((item) => item.id === route.params.resourceId);
  const [name, setName] = useState(resource?.metadata.title ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [content, setContent] = useState("");
  const [editSessionId, setEditSessionId] = useState<string>();
  const [autosave, setAutosave] = useState("Opening…");
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (!core) return;
    void openResource(core.shell, route.params.resourceId).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : "Resource unavailable."),
    );
  }, [core, route.params.resourceId]);
  useEffect(() => {
    if (!core || resource?.metadata.kind !== "note") return;
    let active = true;
    let sessionId: string | undefined;
    const unsubscribe = core.shell.subscribeToEditSessions((session) => {
      if (active && session.id === sessionId) setAutosave(autosaveLabel(session.autosaveState));
    });
    void core.shell
      .openEditSession(resource.id)
      .then(({ session, content: initial }) => {
        if (!active) return;
        sessionId = session.id;
        setEditSessionId(session.id);
        setContent(initial.text);
        setAutosave(session.dirty ? "Unsaved changes" : "Saved");
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Editor unavailable."));
    return () => {
      active = false;
      unsubscribe();
      if (sessionId) void core.shell.closeEditSession(sessionId);
    };
  }, [core, resource?.id, resource?.metadata.kind]);
  useEffect(() => {
    if (resource) setName(resource.metadata.title);
  }, [resource]);
  useEffect(() => {
    if (resource) navigation.setOptions({ title: resource.metadata.title });
  }, [navigation, resource]);
  const rename = async () => {
    if (!core || !resource || !name.trim()) return;
    setPending(true);
    setError(undefined);
    try {
      await renameResource(core.shell, resource.id, name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rename failed.");
    } finally {
      setPending(false);
    }
  };
  const move = async (workspaceId: string) => {
    if (!core || !resource) return;
    setPending(true);
    setError(undefined);
    try {
      await moveResource(core.shell, resource.id, workspaceId);
      navigation.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Move failed.");
    } finally {
      setPending(false);
    }
  };
  if (!resource)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Resource not found in the active Workspace."}</Text>
      </View>
    );
  const changeContent = (value: string) => {
    setContent(value);
    setAutosave("Unsaved changes");
    if (core && editSessionId)
      void core.shell
        .updateEditContent(editSessionId, value)
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Autosave failed."));
  };
  const retryAutosave = async () => {
    if (!core || !editSessionId) return;
    setError(undefined);
    setAutosave("Saving…");
    try {
      await core.shell.flushEditSession(editSessionId);
      setAutosave("Saved");
    } catch (cause) {
      setAutosave("Autosave failed");
      setError(cause instanceof Error ? cause.message : "Autosave failed.");
    }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          accessibilityLabel="Resource title"
          maxLength={120}
          onChangeText={setName}
          style={styles.input}
          value={name}
        />
        <Pressable
          accessibilityRole="button"
          disabled={pending || !name.trim() || name.trim() === resource.metadata.title}
          onPress={() => void rename()}
          style={[
            styles.titleAction,
            (pending || !name.trim() || name.trim() === resource.metadata.title) && styles.disabled,
          ]}
        >
          <Text style={styles.titleActionText}>{pending ? "Saving…" : "Save title"}</Text>
        </Pressable>
        {resource.metadata.kind === "note" ? (
          <View style={styles.editorSection}>
            <View style={styles.editorHeader}>
              <Text style={styles.label}>Note</Text>
              {autosave === "Autosave failed" ? (
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void retryAutosave()}>
                  <Text style={styles.retrySave}>Retry save</Text>
                </Pressable>
              ) : (
                <Text accessibilityLiveRegion="polite" style={styles.saveState}>
                  {autosave}
                </Text>
              )}
            </View>
            <TextInput
              accessibilityLabel="Note content"
              multiline
              onChangeText={changeContent}
              placeholder="Start writing…"
              placeholderTextColor={styles.placeholder.color}
              style={styles.editor}
              textAlignVertical="top"
              value={content}
            />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetails }}
          onPress={() => setShowDetails((visible) => !visible)}
          style={styles.detailsAction}
        >
          <Text style={styles.detailsActionText}>{showDetails ? "Hide details" : "Show details and move"}</Text>
          <Text style={styles.detailsIcon}>{showDetails ? "−" : "+"}</Text>
        </Pressable>
        {showDetails ? (
          <View style={styles.details}>
            <Text style={styles.section}>Details</Text>
            <MetadataRow
              label="Type"
              value={resource.metadata.kind === "note" ? "Note" : resource.metadata.kind || resource.type}
              styles={styles}
            />
            <MetadataRow
              label="Workspace"
              value={workspace?.name ?? resource.primaryWorkspaceId ?? "Unknown"}
              styles={styles}
            />
            <MetadataRow label="Created" value={formatDate(resource.createdAt)} styles={styles} />
            <MetadataRow label="Last modified" value={formatDate(resource.updatedAt)} styles={styles} />
            {workspaces.some((candidate) => candidate.id !== workspace?.id) ? (
              <>
                <Text style={styles.section}>Move to workspace</Text>
                {workspaces
                  .filter((candidate) => candidate.id !== workspace?.id)
                  .map((candidate) => (
                    <Pressable
                      accessibilityRole="button"
                      disabled={pending}
                      key={candidate.id}
                      onPress={() => void move(candidate.id)}
                      style={styles.moveRow}
                    >
                      <Text style={styles.moveText}>{candidate.name}</Text>
                    </Pressable>
                  ))}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function autosaveLabel(state: import("@karya/types").AutosaveState) {
  if (state === "scheduled") return "Unsaved changes";
  if (state === "saving") return "Saving…";
  if (state === "failed") return "Autosave failed";
  return "Saved";
}
function MetadataRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createResourceDetailStyles>;
}) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue}>{value}</Text>
    </View>
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
