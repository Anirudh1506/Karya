import { colors, type KaryaColorScheme } from "@karya/design-tokens";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { createWorkspace } from "./workspace-interactions";
import { useWorkspaces } from "./useWorkspaces";
import { createCreateWorkspaceStyles } from "./CreateWorkspaceScreen.styles";
import { CREATION_ACCENT_COLORS, WORKSPACE_NAME_MAX_LENGTH, WORKSPACE_NAME_PLACEHOLDER } from "../constants";

type Props = NativeStackScreenProps<RootNavigationParamList, "CreateWorkspace">;

export function CreateWorkspaceScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createCreateWorkspaceStyles(scheme), [scheme]);
  const { core } = useWorkspaces();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string>(CREATION_ACCENT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const create = async () => {
    if (!core || !name.trim()) {
      setError("Enter a workspace name.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await createWorkspace(core.shell, { name, description, icon, color });
      navigation.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The workspace could not be created.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Workspace name"
          autoCapitalize="words"
          autoFocus
          maxLength={WORKSPACE_NAME_MAX_LENGTH}
          onChangeText={setName}
          placeholder={WORKSPACE_NAME_PLACEHOLDER}
          placeholderTextColor={colors[scheme].contentTertiary}
          style={styles.input}
          value={name}
        />
        <Text style={styles.label}>
          Description <Text style={styles.optional}>optional</Text>
        </Text>
        <TextInput
          accessibilityLabel="Workspace description"
          maxLength={240}
          multiline
          onChangeText={setDescription}
          placeholder="What belongs in this workspace?"
          placeholderTextColor={colors[scheme].contentTertiary}
          style={[styles.input, styles.multiline]}
          value={description}
        />
        <Text style={styles.label}>
          Icon <Text style={styles.optional}>optional</Text>
        </Text>
        <TextInput
          accessibilityLabel="Workspace icon"
          maxLength={2}
          onChangeText={setIcon}
          placeholder="Initial or emoji"
          placeholderTextColor={colors[scheme].contentTertiary}
          style={styles.input}
          value={icon}
        />
        <Text style={styles.label}>Color</Text>
        <View accessibilityRole="radiogroup" style={styles.swatches}>
          {CREATION_ACCENT_COLORS.map((accent) => (
            <Pressable
              key={accent}
              accessibilityLabel={`Color ${accent}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: color === accent }}
              hitSlop={6}
              onPress={() => setColor(accent)}
              style={[styles.swatchOuter, color === accent && styles.swatchSelected]}
            >
              <View style={[styles.swatch, { backgroundColor: accent }]} />
            </Pressable>
          ))}
        </View>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !name.trim() }}
          disabled={saving || !name.trim()}
          onPress={() => void create()}
          style={({ pressed }) => [
            styles.createButton,
            (saving || !name.trim()) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.createText}>{saving ? "Creating…" : "Create workspace"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
