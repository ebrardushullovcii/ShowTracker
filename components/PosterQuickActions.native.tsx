import { cloneElement, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Modal, Platform, Pressable, Text, View } from "react-native";
import type { PosterQuickActionsProps } from "./PosterQuickActions";

type PosterAction = "tracking" | "share";

export function PosterQuickActions({ children, routeId, tracked }: PosterQuickActionsProps) {
  const router = useRouter();
  const [menu, setMenu] = useState<"open" | "closing" | PosterAction | null>(null);
  const trackingLabel = tracked === undefined ? "Track Show" : tracked ? "Edit Tracking" : "Add to Library";
  const openAction = (posterAction: PosterAction) => {
    router.push({ pathname: "/show/[id]", params: { id: routeId, posterAction } });
  };
  const closeMenu = () => setMenu("closing");
  const showMenu = () => {
    if (Platform.OS === "ios") {
      setMenu("open");
      return;
    }

    Alert.alert("Show actions", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: trackingLabel, onPress: () => openAction("tracking") },
      { text: "Share", onPress: () => openAction("share") },
    ], { cancelable: true });
  };

  const poster = cloneElement(children, {
    onLongPress: showMenu,
    accessibilityActions: [{ name: "tracking", label: trackingLabel }, { name: "share", label: "Share" }],
    onAccessibilityAction: ({ nativeEvent: { actionName } }) => {
      if (actionName === "tracking" || actionName === "share") openAction(actionName);
    },
  });

  return (
    <>
      {poster}
      {menu !== null ? (
        <Modal
          visible={menu === "open"}
          transparent
          animationType="fade"
          onRequestClose={closeMenu}
          onDismiss={() => {
            setMenu(null);
            // The next action can present its own modal after this one closes.
            if (menu === "tracking" || menu === "share") openAction(menu);
          }}
        >
          <View className="dialog-backdrop">
            <Pressable
              className="absolute inset-0"
              accessible={false}
              onPress={closeMenu}
            />
            <View className="dialog-panel max-w-confirmation" accessibilityViewIsModal onAccessibilityEscape={closeMenu}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={trackingLabel}
                className="min-h-14 flex-row items-center gap-3 px-dialog-gutter py-3 active:bg-bg-elevated"
                onPress={() => setMenu("tracking")}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color="#a1a1aa" />
                <Text className="flex-1 text-base font-semibold text-text-primary">{trackingLabel}</Text>
              </Pressable>
              <View className="mx-dialog-gutter h-px bg-border-default" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share"
                className="min-h-14 flex-row items-center gap-3 px-dialog-gutter py-3 active:bg-bg-elevated"
                onPress={() => setMenu("share")}
              >
                <Ionicons name="share-outline" size={22} color="#a1a1aa" />
                <Text className="flex-1 text-base font-semibold text-text-primary">Share</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
