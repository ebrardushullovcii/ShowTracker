import { useMemo, useRef } from "react";
import { Alert, Share } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { createShareDocument } from "@/lib/sharing/document";
import type { ShareCollection } from "@/lib/sharing/types";

export default function ShareComposer({ collection }: { collection: ShareCollection; onClose?: () => void }) {
  const webView = useRef<WebView>(null);
  const sharing = useRef(false);
  const html = useMemo(() => createShareDocument(collection, true), [collection]);
  const onMessage = async (event: WebViewMessageEvent) => {
    if (sharing.current) return;
    sharing.current = true;
    try {
      const message = JSON.parse(event.nativeEvent.data);
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
