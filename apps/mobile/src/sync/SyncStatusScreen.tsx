import type { KaryaColorScheme } from "@karya/design-tokens";
import type { SyncStatus } from "@karya/types";
import { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, useColorScheme, View } from "react-native";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { createSyncStatusStyles } from "./SyncStatusScreen.styles";

export function SyncStatusScreen() {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createSyncStatusStyles(scheme), [scheme]);
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const [status, setStatus] = useState<SyncStatus>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!core) return;
    let active = true;
    const refresh = () =>
      void core.shell
        .getSyncStatus()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "Sync status unavailable.");
        });
    const unsubscribe = core.shell.subscribeToSyncStatus(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [core]);

  if (!status && !error)
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading synchronization status" />
      </View>
    );
  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>LOCAL REPLICATION</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Sync Status
      </Text>
      <Text style={styles.body}>Karya is recording local operations. No network or cloud account is connected.</Text>
      <View style={styles.card}>
        <Row label="Device ID" value={status?.deviceId ?? "—"} styles={styles} monospaced />
        <Row label="Pending operations" value={String(status?.pendingOperations ?? 0)} styles={styles} />
        <Row label="Queue size" value={String(status?.queueSize ?? 0)} styles={styles} />
        <Row label="Acknowledged" value={String(status?.acknowledgedOperations ?? 0)} styles={styles} />
        <Row
          label="Last replay"
          value={status?.lastReplayAt ? new Date(status.lastReplayAt).toLocaleString() : "Not replayed"}
          styles={styles}
          last
        />
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  styles,
  last,
  monospaced,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createSyncStatusStyles>;
  last?: boolean;
  monospaced?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        selectable={monospaced}
        numberOfLines={monospaced ? 2 : 1}
        style={[styles.value, monospaced && styles.device]}
      >
        {value}
      </Text>
    </View>
  );
}
