import { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedGame } from "@/lib/sharing/share-link";
import type { ShareShow } from "@/lib/sharing/types";
import { pickTournament, startTournament, type Tournament } from "@/lib/sharing/tournament";

function GameButton({ label, displayLabel, onPress, primary = false, quiet = false, grow = false, disabled = false, icon }: { label: string; displayLabel?: string; onPress: () => void; primary?: boolean; quiet?: boolean; grow?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    className={`${grow ? "flex-1 px-3" : "px-4"} flex-row items-center justify-center gap-2 rounded-xl ${quiet ? "min-h-10 py-2" : "min-h-12 border py-3"} ${primary ? "border-red-500 bg-red-600" : quiet ? "" : "border-zinc-700 bg-zinc-900"}`}
    style={{ opacity: disabled ? 0.35 : 1 }}>
    {icon ? <Ionicons name={icon} size={quiet ? 15 : 17} color={quiet ? "#a1a1aa" : "#fafafa"} /> : null}
    <Text className={quiet ? "text-sm font-semibold text-zinc-400" : "font-semibold text-zinc-50"} style={{ flexShrink: 1, textAlign: "center" }}>{displayLabel ?? label}</Text>
  </Pressable>;
}

function Cover({ show, height }: { show: ShareShow; height: number }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loading = !!show.poster && !failed && !loaded;
  return <View testID={loading ? "game-cover-loading" : "game-cover-ready"} className="items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900" style={{ height, width: "100%" }}>
    {show.poster && !failed ? <Image source={{ uri: show.poster }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} resizeMode="cover" fadeDuration={0} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} accessibilityLabel={`${show.title} poster`} /> : <View className="items-center px-4"><Ionicons name="film-outline" size={32} color="#71717a" /><Text className="mt-3 text-center font-bold text-zinc-300">{show.title}</Text></View>}
    {loading ? <ActivityIndicator color="#71717a" accessibilityLabel="Loading cover" /> : null}
  </View>;
}

export function SharedGameScreen({ snapshot, shareUrl }: { snapshot: SharedGame; shareUrl: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<Tournament | null>(null);
  const [history, setHistory] = useState<Tournament[]>([]);
  const [shortlist, setShortlist] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState("");
  const duel = snapshot.mode === "duel";
  const winner = game?.contenders.length === 1 ? snapshot.shows[game.contenders[0]] : null;
  const results = duel ? winner ? [winner] : [] : snapshot.shows.filter((_, i) => shortlist.has(i));
  const result = duel ? !!winner : finished;
  const playing = duel ? !!game && !winner : !!game && !finished;
  const phone = width < 700;
  const winnerWidth = phone ? Math.min(150, Math.max(110, (height - 470) / 1.5)) : 190;
  const cardHeight = Math.min(phone ? 270 : 360, Math.max(150, height - 390), (width - 52) * 0.72);
  const copy = async (text: string) => {
    try { await Clipboard.setStringAsync(text); setNotice("Copied. Paste it into your chat."); }
    catch { setNotice("Copy is unavailable. Use the result text below."); }
  };
  const resultText = `I’d watch ${results.map((show) => show.title + (show.year ? ` (${show.year})` : "")).join(" or ")}!\n${shareUrl}`;
  const shareResult = async () => {
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: "My show pick", text: resultText });
        else await copy(resultText);
      } else await Share.share({ message: resultText });
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setNotice("Could not share. Copy your result instead."); }
  };
  const start = () => { setGame(startTournament(snapshot.shows.length)); setHistory([]); setShortlist(new Set()); setFinished(false); setNotice(""); };
  const choose = (index: number) => {
    if (!game) return;
    setHistory([...history, game]); setGame(pickTournament(game, index)); setNotice("");
  };
  const undo = () => {
    if (!history.length) return;
    setGame(history[history.length - 1]); setHistory(history.slice(0, -1)); setNotice("");
  };
  return <ScrollView className="flex-1 bg-zinc-950" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: phone ? 16 : 32 }}>
    <View className="mx-auto w-full" style={{ maxWidth: 860 }}>
      <View className={`${phone ? "mb-5" : "mb-7"} flex-row items-center justify-between`}><Text className="font-mono text-sm font-bold text-zinc-400">SHOWTRACKER</Text><Text className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">{duel ? "THIS OR THAT" : "YOUR SHORTLIST"}</Text></View>
      {!playing && !result ? <View className="items-center py-6">
        <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10"><Ionicons name={duel ? "flash-outline" : "star-outline"} size={26} color="#ef4444" /></View>
        <Text accessibilityRole="header" className={`text-center font-mono font-black text-zinc-50 ${phone ? "text-2xl" : "text-3xl"}`} style={{ maxWidth: 640 }}>{snapshot.title}</Text>
        {snapshot.note ? <Text className="mt-3 max-w-xl text-center text-base leading-6 text-zinc-300">{snapshot.note}</Text> : null}
        {snapshot.name ? <Text className="mt-2 text-center text-sm text-zinc-500">From {snapshot.name}</Text> : null}
        <Text className="mb-6 mt-6 text-center text-sm leading-6 text-zinc-400">{duel ? `${snapshot.shows.length} shows · pick one from each pair until one wins` : `${snapshot.shows.length} shows to consider. Choose your favorites, then send back your result.`}</Text>
        <View className="w-full" style={{ maxWidth: 320 }}><GameButton label={duel ? "Start game" : "Choose my favorites"} onPress={start} primary /></View>
        <Text className="mt-3 text-center text-xs text-zinc-500">No account needed</Text>
      </View> : null}
      {playing && duel && game ? <>
        <Text accessibilityRole="header" className="text-center font-mono text-2xl font-black text-zinc-50">{game.contenders.length === 2 ? "The final choice" : "Which would you watch?"}</Text>
        <Text accessibilityLiveRegion="polite" className="mb-4 mt-2 text-center text-sm text-zinc-400">Round {game.round} · {snapshot.shows.length - 1 - game.decisions} {snapshot.shows.length - 1 - game.decisions === 1 ? "choice" : "choices"} to your winner</Text>
        <View className="mb-5 h-1 overflow-hidden rounded-full bg-zinc-800"><View className="h-full bg-red-500" style={{ width: `${100 * game.decisions / (snapshot.shows.length - 1)}%` }} /></View>
        <View className="flex-row justify-center gap-4">
          {game.contenders.slice(game.cursor, game.cursor + 2).map((index) => {
            const show = snapshot.shows[index];
            return <Pressable key={show.id} accessibilityRole="button" accessibilityLabel={`Pick ${show.title}`} onPress={() => choose(index)} className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-2" style={{ maxWidth: 300 }}>
              <Cover key={show.id} show={show} height={cardHeight} />
              <Text className="mt-3 px-1 text-center text-base font-bold text-zinc-50">{show.title}</Text>
              <Text className="mb-3 mt-1 text-center text-xs text-zinc-400">{[show.year, ...show.genres.slice(0, 2)].filter(Boolean).join(" · ")}</Text>
              <View className="mt-auto rounded-lg bg-red-600 py-3"><Text className="text-center text-sm font-bold text-white">Choose this</Text></View>
            </Pressable>;
          })}
        </View>
        <View className="mt-4 flex-row justify-center"><GameButton label="Undo last choice" icon="arrow-undo-outline" onPress={undo} disabled={!history.length} quiet /></View>
      </> : null}
      {playing && !duel ? <>
        <Text accessibilityRole="header" className="mb-5 text-center font-mono text-2xl font-black text-zinc-50">What catches your eye?</Text>
        <View className="gap-3">{snapshot.shows.map((show, i) => <Pressable key={show.id} accessibilityRole="checkbox" accessibilityLabel={`Choose ${show.title}`} accessibilityState={{ checked: shortlist.has(i) }} onPress={() => { const next = new Set(shortlist); if (next.has(i)) next.delete(i); else next.add(i); setShortlist(next); }} className={`flex-row items-center gap-4 rounded-xl border p-3 ${shortlist.has(i) ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-900"}`}>
          <View style={{ width: 64 }}><Cover show={show} height={96} /></View><View className="min-w-0 flex-1"><Text className="text-lg font-bold text-zinc-50">{show.title}</Text><Text className="mt-1 text-sm text-zinc-400">{[show.year, ...show.genres.slice(0, 2)].filter(Boolean).join(" · ")}</Text></View><Ionicons name={shortlist.has(i) ? "checkmark-circle" : "ellipse-outline"} size={26} color={shortlist.has(i) ? "#ef4444" : "#71717a"} />
        </Pressable>)}</View>
        <View className="mt-6"><GameButton label="See my result" onPress={() => setFinished(true)} primary disabled={!shortlist.size} /></View>
      </> : null}
      {result ? <View className="items-center">
        <View className="flex-row items-center gap-2"><Ionicons name={duel ? "trophy-outline" : "checkmark-circle-outline"} size={22} color="#fbbf24" /><Text accessibilityRole="header" className={`font-mono font-black text-zinc-50 ${phone ? "text-2xl" : "text-3xl"}`}>{duel ? "Your winner" : "Your picks"}</Text></View>
        {results.map((show) => <View key={show.id} className="mt-5 w-full items-center"><View style={{ width: duel ? winnerWidth : 120 }}><Cover show={show} height={duel ? winnerWidth * 1.5 : 180} /></View><Text className="mt-4 text-center text-2xl font-bold text-zinc-50">{show.title}</Text><Text className="mt-1 text-center text-sm text-zinc-400">{[show.year, ...show.genres.slice(0, 2)].filter(Boolean).join(" · ")}</Text></View>)}
        <View className="mt-6 w-full gap-3" style={{ maxWidth: 420 }}>
          <View className="flex-row gap-3"><GameButton label="Share my result" displayLabel="Share result" icon="share-outline" onPress={() => void shareResult()} primary grow /><GameButton label="Copy my result" displayLabel="Copy result" icon="copy-outline" onPress={() => void copy(resultText)} grow /></View>
          <Text selectable className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-5 text-zinc-300" style={{ width: "100%" }}>{resultText}</Text>
          <View className="flex-row">{duel ? <GameButton label="Undo last choice" displayLabel="Undo" icon="arrow-undo-outline" onPress={undo} disabled={!history.length} quiet grow /> : <GameButton label="Change my picks" icon="create-outline" onPress={() => setFinished(false)} quiet grow />}<GameButton label="Play again" icon="refresh-outline" onPress={start} quiet grow /></View>
        </View>
      </View> : null}
      {notice ? <Text accessibilityLiveRegion="polite" className="mt-4 text-center text-sm text-zinc-300">{notice}</Text> : null}
    </View>
  </ScrollView>;
}
