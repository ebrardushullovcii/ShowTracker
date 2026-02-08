import type { Href } from "expo-router";
import { Link } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import type { NormalizedShow } from "@/lib/api/types";
import { Badge } from "@/components/Badge";

type MediaPosterCardProps = {
  show: NormalizedShow;
  href: Href;
  rank?: number;
  className?: string;
  posterClassName?: string;
};

const mediaTypeLabel: Record<NormalizedShow["mediaType"], string> = {
  tv: "TV",
  anime: "Anime",
  movie: "Movie",
};

export function MediaPosterCard({
  show,
  href,
  rank,
  className,
  posterClassName,
}: MediaPosterCardProps) {
  return (
    <Link href={href} asChild>
      <Pressable className={`w-36 ${className ?? ""}`.trim()}>
        <View
          className={`relative overflow-hidden rounded-3xl border border-brand-surface/60 bg-brand-surface ${posterClassName ?? "h-56"}`.trim()}
        >
          {show.posterUrl ? (
            <Image
              source={{ uri: show.posterUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-brand-surface/80 px-3">
              <Text className="text-center text-sm font-semibold text-brand-text">
                {show.title}
              </Text>
            </View>
          )}
          <View className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-2">
            <Text
              className="text-[11px] font-medium uppercase tracking-[1.5px] text-white/80"
              numberOfLines={1}
            >
              {mediaTypeLabel[show.mediaType]}
            </Text>
          </View>
          {typeof rank === "number" ? (
            <Badge
              label={`#${rank}`}
              className="absolute left-2 top-2 border-white/50 bg-white/85"
              textClassName="text-[10px] font-semibold text-black"
            />
          ) : null}
        </View>
        <View className="mt-2 gap-1 px-1">
          <Text
            className="text-sm font-semibold text-brand-light-text dark:text-brand-text"
            numberOfLines={1}
          >
            {show.title}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {show.firstAired?.slice(0, 4) ?? "TBA"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
