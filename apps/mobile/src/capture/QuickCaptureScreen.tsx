import { colors, type KaryaColorScheme } from "@karya/design-tokens";
import type { CaptureSession } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import type { RootNavigationParamList } from "../navigation/linking";
import { useCoreSnapshot } from "../profiles/useProfiles";
import { beginCapture, cancelCapture, completeCapture } from "./capture-interactions";
import { createQuickCaptureStyles } from "./QuickCaptureScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "QuickCapture">;

export function QuickCaptureScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createQuickCaptureStyles(scheme), [scheme]);
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);
  const profile = snapshot?.profiles.active;
  const workspace = snapshot?.workspaces.active;
  const sessionRef = useRef<CaptureSession | undefined>(undefined);
  const [session, setSession] = useState<CaptureSession>();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [contextUnavailable, setContextUnavailable] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!core) return;
    let disposed = false;
    void beginCapture(core.shell)
      .then(async (capture) => {
        if (disposed) {
          await cancelCapture(core.shell, capture.id);
          return;
        }
        sessionRef.current = capture;
        setSession(capture);
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setContextUnavailable(true);
        setError(cause instanceof Error ? cause.message : "Quick Capture is unavailable.");
      });
    return () => {
      disposed = true;
      const capture = sessionRef.current;
      sessionRef.current = undefined;
      if (capture) void cancelCapture(core.shell, capture.id);
    };
  }, [core]);

  const cancel = async () => {
    const capture = sessionRef.current;
    sessionRef.current = undefined;
    if (core && capture) await cancelCapture(core.shell, capture.id);
    navigation.goBack();
  };

  const create = async () => {
    if (!core || !session || !name.trim()) return;
    setSaving(true);
    setError(undefined);
    try {
      const resourceId = await completeCapture(core.shell, session.id, name);
      sessionRef.current = undefined;
      navigation.replace("ResourceDetail", { resourceId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The note could not be captured.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Quick capture</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Save this thought
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void cancel()} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {contextUnavailable ? (
          <View>
            <Text style={styles.message}>
              Open a Workspace before capturing. Karya uses the active context to keep ownership and placement
              predictable.
            </Text>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.replace("Workspaces", { returnTo: "Home" })}
              style={styles.workspaceAction}
            >
              <Text style={styles.workspaceActionText}>Choose Workspace</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.context}>
              {workspace?.name ?? "Active workspace"}
              {profile?.name ? ` · ${profile.name}` : ""}
            </Text>
            <Text style={styles.label}>A short name is enough</Text>
            <TextInput
              accessibilityLabel="Captured note name"
              autoCapitalize="sentences"
              autoFocus
              editable={Boolean(session) && !saving}
              maxLength={120}
              onChangeText={setName}
              onSubmitEditing={() => void create()}
              placeholder="What do you want to remember?"
              placeholderTextColor={colors[scheme].contentTertiary}
              returnKeyType="done"
              style={styles.input}
              value={name}
            />
            {!session ? (
              <View style={styles.preparing}>
                <ActivityIndicator size="small" />
                <Text style={styles.preparingText}>Preparing a local capture…</Text>
              </View>
            ) : null}
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!session || saving || !name.trim()}
              onPress={() => void create()}
              style={({ pressed }) => [
                styles.create,
                (!session || saving || !name.trim()) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.createText}>{saving ? "Saving…" : "Capture note"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
