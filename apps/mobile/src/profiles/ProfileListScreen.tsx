import type { KaryaColorScheme } from "@karya/design-tokens";
import type { Profile } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { useProfiles } from "./useProfiles";
import { archiveProfile, restoreProfile, switchProfile } from "./profile-interactions";
import { createProfileListStyles } from "./ProfileListScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "Profiles">;

export function ProfileListScreen({ navigation, route }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createProfileListStyles(scheme), [scheme]);
  const { core, status, startupError, active, profiles, archived } = useProfiles();
  const [pendingId, setPendingId] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  const run = async (id: string, action: () => Promise<unknown>) => {
    setPendingId(id);
    setActionError(undefined);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The profile could not be updated.");
    } finally {
      setPendingId(undefined);
    }
  };

  const requestArchive = (profile: Profile) => {
    Alert.alert("Archive profile?", `${profile.name} will remain available to restore.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: () => void run(profile.id, () => archiveProfile(core!.shell, profile.id)),
      },
    ]);
  };

  if (status === "starting" || !core) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Starting Karya" />
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{startupError?.message ?? "Karya could not start."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>KARYA</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Profiles
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.navigate("CreateProfile")}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>New profile</Text>
        </Pressable>
      </View>
      <Text style={styles.intro}>
        Profiles separate the roles you work in—such as personal, study, or company. Each keeps its own workspaces.
      </Text>
      {actionError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {actionError}
        </Text>
      ) : null}
      <Text style={styles.sectionTitle}>Available</Text>
      <View style={styles.group}>
        {profiles.map((profile, index) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            active={profile.id === active?.id}
            disabled={pendingId === profile.id}
            last={index === profiles.length - 1}
            onSelect={() =>
              void run(profile.id, async () => {
                await switchProfile(core.shell, profile.id);
                navigation.navigate(route.params?.returnTo === "Home" ? "Home" : "Workspaces");
              })
            }
            onArchive={() => requestArchive(profile)}
            styles={styles}
          />
        ))}
      </View>
      {archived.length ? (
        <>
          <Text style={styles.sectionTitle}>Archived</Text>
          <View style={styles.group}>
            {archived.map((profile, index) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                disabled={pendingId === profile.id}
                last={index === archived.length - 1}
                onSelect={() => void run(profile.id, () => restoreProfile(core.shell, profile.id))}
                styles={styles}
                archived
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function ProfileRow({
  profile,
  active,
  archived,
  disabled,
  last,
  onSelect,
  onArchive,
  styles,
}: {
  profile: Profile;
  active?: boolean;
  archived?: boolean;
  disabled: boolean;
  last: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  styles: ReturnType<typeof createProfileListStyles>;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={onSelect}
        style={styles.rowMain}
      >
        <View style={[styles.avatar, { backgroundColor: profile.accentColor }]}>
          <Text style={styles.avatarText}>{profile.icon || profile.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.meta}>{archived ? "Tap to restore" : active ? "Current profile" : "Tap to switch"}</Text>
        </View>
      </Pressable>
      {!archived && onArchive ? (
        <Pressable
          accessibilityLabel={`Archive ${profile.name}`}
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
