import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { KaryaAccount, TrustedDevice } from "@karya/types";
import { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from "react-native";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import type { RootNavigationParamList } from "../navigation/linking";
import { createAccountStyles } from "./AccountScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "Account">;

export function AccountScreen(_props: Props) {
  const lifecycle = useContext(MobileCompositionRootContext);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createAccountStyles(scheme), [scheme]);
  const [account, setAccount] = useState<KaryaAccount>();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [currentDevice, setCurrentDevice] = useState<TrustedDevice>();
  const [accountName, setAccountName] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState<string>();
  const core = lifecycle?.root.getCore();

  useEffect(() => {
    if (!core || lifecycle?.status !== "ready") return;
    let active = true;
    const load = async () => {
      const [nextAccount, nextDevices, nextCurrent] = await Promise.all([
        core.shell.currentAccount(),
        core.shell.trustedDevices(),
        core.shell.currentDevice(),
      ]);
      if (!active) return;
      setAccount(nextAccount);
      setDevices(nextDevices);
      setCurrentDevice(nextCurrent);
      setAccountName(nextAccount?.displayName ?? "");
      setDeviceName(nextCurrent?.name ?? "");
    };
    void load();
    const unsubscribe = core.registry.resolve("accountService").subscribe(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [core, lifecycle?.status]);

  if (!core || !account || !currentDevice)
    return (
      <View style={styles.screen}>
        <ActivityIndicator />
      </View>
    );
  const saveAccount = async () => {
    try {
      setError(undefined);
      await core.shell.renameAccount(accountName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account could not be renamed");
    }
  };
  const saveDevice = async () => {
    try {
      setError(undefined);
      await core.shell.renameDevice(currentDevice.id, deviceName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Device could not be renamed");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.label}>KARYA ACCOUNT</Text>
        <Text style={styles.title}>{account.displayName}</Text>
        <Text selectable style={styles.id}>
          {account.id}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.label}>ACCOUNT NAME</Text>
        <TextInput
          accessibilityLabel="Account name"
          value={accountName}
          onChangeText={setAccountName}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" onPress={() => void saveAccount()} style={styles.button}>
          <Text style={styles.buttonText}>Rename Account</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>CURRENT DEVICE</Text>
        <Text style={styles.deviceName}>{currentDevice.name}</Text>
        <Text style={styles.detail}>
          {currentDevice.platform} · {currentDevice.trustState}
        </Text>
        <Text selectable style={styles.id}>
          {currentDevice.id}
        </Text>
        <TextInput
          accessibilityLabel="Device name"
          value={deviceName}
          onChangeText={setDeviceName}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" onPress={() => void saveDevice()} style={styles.button}>
          <Text style={styles.buttonText}>Rename Device</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>TRUSTED DEVICES</Text>
        {devices.map((device) => (
          <View key={device.id}>
            <Text style={styles.deviceName}>
              {device.name}
              {device.id === currentDevice.id ? " · Current" : ""}
            </Text>
            <Text style={styles.detail}>
              {device.platform} · {device.trustState}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
