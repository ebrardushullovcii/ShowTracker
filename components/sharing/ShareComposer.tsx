import { useMemo, useRef } from "react";
import { Alert, Linking, Share } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { createShareDocument } from "@/lib/sharing/document";
import type { ShareCollection } from "@/lib/sharing/types";
import { useShareLinks } from "./useShareLinks";

export default function ShareComposer({ collection }: { collection: ShareCollection; onClose?: () => void }) {
  const webView = useRef<WebView>(null);
  const sharing = useRef(false);
  const handleLink = useShareLinks();
  const html = useMemo(() => createShareDocument(collection, true), [collection]);
  const onMessage = async (event: WebViewMessageEvent) => {
    let message;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (!message || typeof message !== "object") return;
    if (message.type === "open-game" && typeof message.token === "string" && /^[a-f0-9]{40}$/.test(message.token)) {
      try { await Linking.openURL(`https://showtrackerapp.netlify.app/share/${message.token}`); }
      catch { Alert.alert("Could not open game", "Copy the share link and open it in your browser."); }
      return;
    }
    if (["create-game-link", "revoke-game-link"].includes(message.type) && typeof message.requestId === "number") {
      const requestId = message.requestId;
      try {
        const result = await handleLink(message);
        webView.current?.injectJavaScript(`resolveShareReply(${JSON.stringify({ requestId, result }).replace(/</g, "\\u003c")});true;`);
      } catch (error) {
        webView.current?.injectJavaScript(`resolveShareReply(${JSON.stringify({ requestId, error: error instanceof Error ? error.message : "Could not create the link." }).replace(/</g, "\\u003c")});true;`);
      }
      return;
    }
    if (sharing.current) return;
    sharing.current = true;
    try {
      if (message.type === "copy" && typeof message.text === "string") {
        await Clipboard.setStringAsync(message.text);
        webView.current?.injectJavaScript("toast('Copied. Paste it into your chat.');true;");
      } else if (message.type === "share-text" && typeof message.text === "string") {
        await Share.share({ message: message.text });
      } else if (message.type === "file" && typeof message.base64 === "string" &&
        typeof message.name === "string" && /^showtracker-[a-z0-9.-]+$/.test(message.name)) {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device.");
        const file = new File(Paths.cache, message.name);
        file.create({ overwrite: true });
        file.write(message.base64, { encoding: "base64" });
        await Sharing.shareAsync(file.uri, { mimeType: typeof message.mime === "string" ? message.mime.split(";")[0] : undefined });
      } else return;
    } catch (error) {
      Alert.alert("Could not share", error instanceof Error ? error.message : "Try sharing again.");
    } finally {
      sharing.current = false;
    }
  };
  return <WebView ref={webView} source={{ html, baseUrl: "https://showtrackerapp.netlify.app/" }}
    originWhitelist={["*"]} onMessage={onMessage} style={{ flex: 1, backgroundColor: "#09090b" }}
    onShouldStartLoadWithRequest={(request) => request.isTopFrame === false || request.url === "about:blank" || request.url === "about:srcdoc" || request.url === "https://showtrackerapp.netlify.app/"}
    javaScriptCanOpenWindowsAutomatically={false} />;
}
