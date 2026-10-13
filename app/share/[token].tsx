import { useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { ActivityIndicator, Text, View } from "react-native";
import { api } from "@/convex/_generated/api";
import { SharedGameScreen } from "@/components/sharing/SharedGameScreen";

export default function SharedGameRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const game = useQuery(api.sharedGames.get, typeof token === "string" ? { token } : "skip");
  if (game === undefined) return <View className="flex-1 items-center justify-center bg-zinc-950"><ActivityIndicator color="#ef4444" /><Text className="mt-4 text-zinc-400">Opening your game…</Text></View>;
  if (!game) return <View className="flex-1 items-center justify-center bg-zinc-950 px-6"><Text className="font-mono text-2xl font-bold text-zinc-50">This link is unavailable</Text><Text className="mt-3 text-center text-zinc-400">It may have expired or been removed. Ask your friend for a new link.</Text></View>;
  return <SharedGameScreen key={token} snapshot={game} shareUrl={`https://showtrackerapp.netlify.app/share/${token}`} />;
}
