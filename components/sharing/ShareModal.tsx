import { OverlayHeader } from "@/components/OverlayHeader";
import { TallDialog, useDrawerBottomInset } from "@/components/DialogBackdrop";
import { Modal, View } from "react-native";
import ShareComposer from "./ShareComposer";
import type { ShareCollection } from "@/lib/sharing/types";

export function ShareModal({ collection, onClose }: { collection: ShareCollection | null; onClose: () => void }) {
  const drawerBottomInset = useDrawerBottomInset();

  return (
    <Modal visible={!!collection} transparent animationType="fade" onRequestClose={onClose}>
      <TallDialog onClose={onClose}>
        <OverlayHeader
          title="Share shows"
          subtitle={collection?.context}
          onClose={onClose}
          closeAccessibilityLabel="Close share preview"
        />
        <View className="min-h-0 flex-1" style={{ paddingBottom: drawerBottomInset }}>
          {collection ? <ShareComposer collection={collection} onClose={onClose} /> : null}
        </View>
      </TallDialog>
    </Modal>
  );
}
