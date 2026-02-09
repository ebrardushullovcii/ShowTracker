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
          className={`relative overflow-hidden rounded-2xl border-2 border-brand-surface bg-brand-light-surface ${posterClassName ?? "h-56"}`.trim()}
        >
          {show.posterUrl ? (
            <Image
              source={{ uri: show.posterUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-brand-surface/20 px-3">
              <Text className="text-center text-sm font-semibold text-brand-light-text dark:text-brand-text">
                {show.title}
              </Text>
            </View>
          )}

          <View className="absolute inset-x-0 bottom-0 border-t-2 border-brand-surface bg-[#fff6e3]/90 px-2 py-1.5 dark:bg-brand-surface/90">
            <Text
              className="text-[10px] font-bold uppercase tracking-[1.3px] text-brand-light-text dark:text-brand-text"
              numberOfLines={1}
            >
              {mediaTypeLabel[show.mediaType]}
            </Text>
          </View>

          {typeof rank === "number" ? (
            <Badge
              label={`Top ${rank}`}
              className="absolute left-2 top-2 border-brand-surface bg-[#fff3d8]"
              textClassName="text-[10px] text-brand-light-text"
            />
          ) : null}
        </View>

        <View className="mt-2 gap-1 px-1">
          <Text
            className="font-serif text-sm font-semibold text-brand-light-text dark:text-brand-text"
            numberOfLines={1}
          >
            {show.title}
          </Text>
          <Text className="text-[11px] uppercase tracking-[1.2px] text-slate-500 dark:text-slate-300">
            {show.firstAired?.slice(0, 4) ?? "TBA"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
