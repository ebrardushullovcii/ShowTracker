import { OverlayHeader } from "@/components/OverlayHeader";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShareComposer from "./ShareComposer";
import type { ShareCollection } from "@/lib/sharing/types";

export function ShareModal({ collection, onClose }: { collection: ShareCollection | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const phone = width < 700;

  return (
    <Modal visible={!!collection} transparent animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1 items-center bg-black/75"
        style={{ justifyContent: phone ? "flex-end" : "center", padding: phone ? 4 : 24 }}
      >
        <Pressable className="absolute inset-0" accessible={false} focusable={false} onPress={onClose} />
        <View
          accessibilityViewIsModal
          className="overlay-outline w-full bg-bg-base"
          style={{
            maxWidth: 1180,
            height: phone ? height - insets.top - 12 : Math.min(height - 48, 900),
            paddingBottom: phone ? insets.bottom : 0,
          }}
        >
          <OverlayHeader
            title="Share shows"
            subtitle={collection?.context}
            onClose={onClose}
            closeAccessibilityLabel="Close share preview"
          />
          <View className="flex-1">
            {collection ? <ShareComposer collection={collection} onClose={onClose} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
