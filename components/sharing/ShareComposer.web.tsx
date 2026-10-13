import { useEffect, useMemo, useRef } from "react";
import { createShareDocument } from "@/lib/sharing/document";
import type { ShareCollection } from "@/lib/sharing/types";

export default function ShareComposer({ collection, onClose }: { collection: ShareCollection; onClose?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => createShareDocument(collection), [collection]);
  useEffect(() => {
    const listener = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data?.type === "showtracker-close-share") onClose?.(); };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onClose]);
  return <iframe ref={frame} title="Share preview and export options" srcDoc={html}
    allow="clipboard-write; web-share" style={{ border: 0, width: "100%", height: "100%", display: "block", background: "#09090b" }} />;
}
