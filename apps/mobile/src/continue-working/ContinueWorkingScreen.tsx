import type { KaryaColorScheme } from "@karya/design-tokens";
import type { ContinueWorkingItem } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { openResource } from "../resources/resource-interactions";
import { useContinueWorking } from "./useContinueWorking";
import { createContinueWorkingStyles } from "./ContinueWorkingScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "ContinueWorking">;

export function ContinueWorkingScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createContinueWorkingStyles(scheme), [scheme]);
  const { core, status, startupError, items } = useContinueWorking();
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();

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

  const resume = async (item: ContinueWorkingItem) => {
    setPendingId(item.resourceId);
    setError(undefined);
    try {
      await openResource(core.shell, item.resourceId);
      navigation.navigate("ResourceDetail", { resourceId: item.resourceId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This Resource could not be opened.");
    } finally {
      setPendingId(undefined);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Current context</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Continue Working
      </Text>
      <Text style={styles.intro}>Resume the work most relevant to where you are now.</Text>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {items.length ? (
        <View style={styles.list}>
          {items.map((item, index) => (
            <ContinueCard
              key={`${item.kind}:${item.resourceId}`}
              item={item}
              disabled={pendingId === item.resourceId}
              last={index === items.length - 1}
              onPress={() => void resume(item)}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>There is no work to continue in this Workspace yet.</Text>
      )}
    </ScrollView>
  );
}

function ContinueCard({
  item,
  disabled,
  last,
  onPress,
  styles,
}: {
  item: ContinueWorkingItem;
  disabled: boolean;
  last: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createContinueWorkingStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue ${item.resourceName}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.card, !last && styles.cardBorder]}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>N</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.resourceName}</Text>
        <Text style={styles.meta}>
          {displayType(item.resourceType)} · {item.workspaceName}
        </Text>
        <Text style={styles.activity}>{continuationReason(item)}</Text>
      </View>
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
