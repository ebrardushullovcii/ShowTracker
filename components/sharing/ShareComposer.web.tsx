import { useEffect, useMemo, useRef } from "react";
import { createShareDocument } from "@/lib/sharing/document";
import type { ShareCollection } from "@/lib/sharing/types";
import { useShareLinks } from "./useShareLinks";

export default function ShareComposer({ collection, onClose }: { collection: ShareCollection; onClose?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handleLink = useShareLinks();
  const html = useMemo(() => createShareDocument(collection), [collection]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "showtracker-close-share") onClose?.();
      if (["create-game-link", "revoke-game-link"].includes(event.data?.type) && typeof event.data?.requestId === "number") {
        const requestId = event.data.requestId;
        void handleLink(event.data).then((result) => frame.current?.contentWindow?.postMessage({ type: "game-link-reply", requestId, result }, window.location.origin))
          .catch((error) => frame.current?.contentWindow?.postMessage({ type: "game-link-reply", requestId, error: error instanceof Error ? error.message : "Could not create the link." }, window.location.origin));
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onClose, handleLink]);
  return <iframe ref={frame} title="Share preview and export options" srcDoc={html}
    allow="clipboard-write; web-share" style={{ border: 0, width: "100%", height: "100%", display: "block", background: "#09090b" }} />;
}
