import type { KaryaColorScheme } from "@karya/design-tokens";
import type { TransportStatus } from "@karya/types";
import { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, useColorScheme, View } from "react-native";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { createTransportStatusStyles } from "./TransportStatusScreen.styles";

export function TransportStatusScreen() {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createTransportStatusStyles(scheme), [scheme]);
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const [status, setStatus] = useState<TransportStatus>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!core) return;
    let active = true;
    const refresh = () =>
      void core.shell
        .getTransportStatus()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "Transport status unavailable.");
        });
    const unsubscribe = core.shell.subscribeToTransportStatus(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [core]);

  if (!status && !error)
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading transport status" />
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
      <Text style={styles.eyebrow}>REMOTE TRANSPORT</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Transport Status
      </Text>
      <Text style={styles.body}>Operations remain local until a transport session is explicitly connected.</Text>
      <View style={styles.card}>
        <Row label="Connection" value={status?.state ?? "idle"} styles={styles} />
        <Row label="Provider" value={status?.provider ?? "—"} styles={styles} />
        <Row label="Queue size" value={String(status?.queueSize ?? 0)} styles={styles} />
        <Row label="Pending batches" value={String(status?.pendingBatches ?? 0)} styles={styles} />
        <Row label="Retry count" value={String(status?.retryCount ?? 0)} styles={styles} />
        <Row
          label="Last successful synchronization"
          value={
            status?.lastSuccessfulSynchronization
              ? new Date(status.lastSuccessfulSynchronization).toLocaleString()
              : "Not synchronized"
          }
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
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createTransportStatusStyles>;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
