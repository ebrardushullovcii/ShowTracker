import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShareComposer from "./ShareComposer";
import type { ShareCollection } from "@/lib/sharing/types";

export function ShareModal({ collection, onClose }: { collection: ShareCollection | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const phone = width < 700;
  return <Modal visible={!!collection} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: phone ? "flex-end" : "center", alignItems: "center", padding: phone ? 0 : 24 }}>
      <Pressable onPress={onClose} accessibilityLabel="Close share preview" style={{ position: "absolute", inset: 0 }} />
      <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 1180, height: phone ? height - insets.top - 12 : Math.min(height - 48, 900), borderRadius: 16, overflow: "hidden", backgroundColor: "#09090b", paddingBottom: phone ? insets.bottom : 0, borderWidth: 1, borderColor: "#3f3f46" }}>
        <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-2">
          <View><Text className="font-mono text-lg font-black text-zinc-50">Share shows</Text><Text className="text-xs text-zinc-400" numberOfLines={1}>{collection?.context}</Text></View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close share preview" className="h-11 w-11 items-center justify-center rounded-lg bg-zinc-900"><Ionicons name="close" size={22} color="#fafafa" /></Pressable>
        </View>
        <View style={{ flex: 1 }}>{collection ? <ShareComposer collection={collection} onClose={onClose} /> : null}</View>
      </View>
    </View>
  </Modal>;
}
