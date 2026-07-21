import { colors, type KaryaColorScheme } from "@karya/design-tokens";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { useProfiles } from "./useProfiles";
import { createAndActivateProfile } from "./profile-interactions";
import { createCreateProfileStyles } from "./CreateProfileScreen.styles";
import { CREATION_ACCENT_COLORS, PROFILE_NAME_MAX_LENGTH, PROFILE_NAME_PLACEHOLDER } from "../constants";

type Props = NativeStackScreenProps<RootNavigationParamList, "CreateProfile">;

export function CreateProfileScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createCreateProfileStyles(scheme), [scheme]);
  const { core } = useProfiles();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [accentColor, setAccentColor] = useState<string>(CREATION_ACCENT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const create = async () => {
    if (!core || !name.trim()) {
      setError("Enter a profile name.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await createAndActivateProfile(core.shell, { name, icon, accentColor });
      navigation.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The profile could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Profile name"
          autoCapitalize="words"
          autoFocus
          maxLength={PROFILE_NAME_MAX_LENGTH}
          onChangeText={setName}
          placeholder={PROFILE_NAME_PLACEHOLDER}
          placeholderTextColor={colors[scheme].contentTertiary}
          style={styles.input}
          value={name}
        />
        <Text style={styles.label}>
          Icon <Text style={styles.optional}>optional</Text>
        </Text>
        <TextInput
          accessibilityLabel="Profile icon"
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
              accessibilityState={{ checked: accentColor === accent }}
              hitSlop={6}
              onPress={() => setAccentColor(accent)}
              style={[styles.swatchOuter, accentColor === accent && styles.swatchSelected]}
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
          <Text style={styles.createText}>{saving ? "Creating…" : "Create profile"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
