import { SheetHeader } from "@/components/SheetHeader";
import { Sheet, SheetDragHandle } from "@/components/Sheet";
import { View } from "react-native";
import ShareComposer from "./ShareComposer";
import type { ShareCollection } from "@/lib/sharing/types";

export function ShareModal({ collection, onClose }: { collection: ShareCollection | null; onClose: () => void }) {
  return (
    <Sheet visible={!!collection} onClose={onClose} label="Share shows" size="tall" maxWidth={1180} contentDraggable={false} surface="base">
      <SheetDragHandle>
        <SheetHeader
          title="Share shows"
          detail={collection?.context}
          detailPlacement="stacked"
          onClose={onClose}
          closeLabel="Close share preview"
        />
      </SheetDragHandle>
      <View className="min-h-0 flex-1">
        {collection ? <ShareComposer collection={collection} onClose={onClose} /> : null}
      </View>
    </Sheet>
  );
}
