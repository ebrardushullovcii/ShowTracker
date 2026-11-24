import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useRootNavigationState, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppState, Linking, Pressable, Switch, Text, View } from "react-native";
import { api } from "@/convex/_generated/api";
import { parseShowRouteId } from "@/lib/show-route";
import type { WatchlistAirtimeMode } from "@/lib/tracking/home-watchlist-visibility";

const TOKEN_KEY = "watchlist_push_token";
const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async notification => {
      const { content } = notification.request;
      const isWatchlistAlert = typeof content.data.watchlistRouteId === "string";
      const isPassive = "interruptionLevel" in content && content.interruptionLevel === "passive";
      return {
        shouldShowBanner: isWatchlistAlert && !isPassive,
        shouldShowList: isWatchlistAlert,
        shouldPlaySound: isWatchlistAlert && !isPassive,
        shouldSetBadge: false,
      };
    },
  });
}

type DeviceStatus = "allowed" | "blocked" | "error" | null;
const PushPreference = createContext<{ enabled: boolean; deviceStatus: DeviceStatus } | null>(null);

function canShowNotifications(permission: Notifications.NotificationPermissionsStatus) {
  return permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export function WatchlistPushProvider({ canReceive, children }: PropsWithChildren<{ canReceive: boolean }>) {
  const preference = useQuery(api.watchlistPush.preferences, canReceive && supported ? {} : "skip");
  const registerDevice = useMutation(api.watchlistPush.registerDevice);
  const unregisterDevice = useMutation(api.watchlistPush.unregisterDevice);
  const enabled = preference?.enabled;
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(null);
  const router = useRouter();
  const navigationReady = !!useRootNavigationState()?.key;
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!supported || !canReceive || !navigationReady || !response) return;
    const route = response.notification.request.content.data.watchlistRouteId;
    if (typeof route !== "string" || !parseShowRouteId(route)) return;
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: "/show/[id]", params: { id: route } });
  }, [canReceive, navigationReady, response, router]);

  useEffect(() => {
    if (!supported || !canReceive || enabled !== true) return;
    let disposed = false;
    let syncing = false;
    const synchronize = async () => {
      if (syncing || AppState.currentState !== "active") return;
      syncing = true;
      try {
        let permission = await Notifications.getPermissionsAsync();
        if (disposed) return;
        if (permission.ios?.status === Notifications.IosAuthorizationStatus.NOT_DETERMINED) {
          permission = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true },
          });
        }
        if (disposed) return;
        const oldToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (disposed) return;
        if (!canShowNotifications(permission)) {
          setDeviceStatus("blocked");
          if (oldToken) await unregisterDevice({ token: oldToken });
          return;
        }
        if (!Device.isDevice) {
          setDeviceStatus("allowed");
          return;
        }
        if (!projectId) throw new Error("Missing Expo project ID.");
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (disposed) return;
        await registerDevice({ token, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        if (oldToken && oldToken !== token) await unregisterDevice({ token: oldToken });
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        if (!disposed) setDeviceStatus("allowed");
      } catch {
        if (!disposed) setDeviceStatus("error");
      } finally {
        syncing = false;
      }
    };

    void synchronize();
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") void synchronize();
    });
    return () => {
      disposed = true;
      foreground.remove();
    };
  }, [canReceive, enabled, registerDevice, unregisterDevice]);

  return (
    <PushPreference.Provider value={enabled === undefined ? null : { enabled, deviceStatus }}>
      {children}
    </PushPreference.Provider>
  );
}

export function WatchlistPushPreference({ mode }: { mode: WatchlistAirtimeMode }) {
  const preference = useContext(PushPreference);
  const setEnabled = useMutation(api.watchlistPush.setEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  if (!preference) return null;
  const { enabled, deviceStatus } = preference;
  const changeEnabled = async (value: boolean) => {
    setSaving(true);
    setError(false);
    try {
      await setEnabled({ enabled: value });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-3 border-t border-border-default pt-5">
      <Text className="text-xs font-black uppercase tracking-wide text-text-secondary">Notifications</Text>
      <View className="flex-row items-center gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-sm font-bold text-text-primary">New Episodes</Text>
          <Text className="text-xs leading-4 text-text-secondary">
            {mode === "same_day"
              ? "A quiet heads-up at the start of the day when a show on your Watchlist has a new episode."
              : "Get an alert at the scheduled airtime. When we only know the date, you’ll get a quiet heads-up at the start of that day."}
          </Text>
        </View>
        <Switch accessibilityLabel="New Episodes" value={enabled} disabled={saving} onValueChange={changeEnabled} />
      </View>
      {enabled && deviceStatus === "blocked" ? (
        <View className="gap-1">
          <Text className="text-xs text-text-secondary">Notifications for ShowTracker are off in iOS Settings.</Text>
          <Pressable accessibilityRole="button" className="self-start py-2" onPress={() => void Linking.openSettings()}>
            <Text className="text-sm font-bold text-text-primary">Open iOS Settings</Text>
          </Pressable>
        </View>
      ) : null}
      {enabled && deviceStatus === "error" ? (
        <Text className="text-xs text-text-secondary">Couldn’t set up alerts on this device. Reopen ShowTracker to try again.</Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" className="text-xs text-text-primary">Couldn’t save your notification setting.</Text> : null}
    </View>
  );
}
