import { colors, type KaryaColorScheme } from "@karya/design-tokens";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { createNoteResource } from "./resource-interactions";
import { useResources } from "./useResources";
import { createCreateResourceStyles } from "./CreateResourceScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "CreateResource">;
export function CreateResourceScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createCreateResourceStyles(scheme), [scheme]);
  const { core, workspace } = useResources();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const create = async () => {
    if (!core || !workspace || !name.trim()) {
      setError("Enter a name and select an active Workspace.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await createNoteResource(core.shell, name);
      navigation.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Resource could not be created.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.context}>Workspace · {workspace?.name ?? "None"}</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Resource name"
          autoCapitalize="sentences"
          autoFocus
          maxLength={120}
          onChangeText={setName}
          placeholder="Untitled note"
          placeholderTextColor={colors[scheme].contentTertiary}
          style={styles.input}
          value={name}
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving || !name.trim()}
          onPress={() => void create()}
          style={({ pressed }) => [
            styles.button,
            (saving || !name.trim()) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>{saving ? "Creating…" : "Create note"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
