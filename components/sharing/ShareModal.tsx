import { OverlayHeader } from "@/components/OverlayHeader";
import { TallDialog } from "@/components/DialogBackdrop";
import { Modal, View } from "react-native";
import ShareComposer from "./ShareComposer";
import type { ShareCollection } from "@/lib/sharing/types";

export function ShareModal({ collection, onClose }: { collection: ShareCollection | null; onClose: () => void }) {
  return (
    <Modal visible={!!collection} transparent animationType="fade" onRequestClose={onClose}>
      <TallDialog onClose={onClose}>
        <OverlayHeader
          title="Share shows"
          subtitle={collection?.context}
          onClose={onClose}
          closeAccessibilityLabel="Close share preview"
        />
        <View className="min-h-0 flex-1">
          {collection ? <ShareComposer collection={collection} onClose={onClose} /> : null}
        </View>
      </TallDialog>
    </Modal>
  );
}
