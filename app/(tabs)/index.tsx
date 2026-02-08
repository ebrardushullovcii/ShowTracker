import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { Badge } from "@/components/Badge";
import { getTrendingAniList } from "@/lib/api/anilist";
import { normalizeAniListMedia, normalizeTmdbMedia } from "@/lib/api/normalize";
import { getTrendingTmdb } from "@/lib/api/tmdb";
import type { NormalizedShow } from "@/lib/api/types";
import { createShowRouteId } from "@/lib/show-route";

type SectionState = {
  isLoading: boolean;
  error: string | null;
  items: NormalizedShow[];
};

const initialSectionState: SectionState = {
  isLoading: true,
  error: null,
  items: [],
};

function DiscoveryRow({
  title,
  subtitle,
  state,
}: {
  title: string;
  subtitle: string;
  state: SectionState;
}) {
  return (
    <View className="mb-8 gap-3">
      <View className="flex-row items-end justify-between">
        <View className="max-w-[70%] gap-1">
          <Text className="text-xl font-bold text-brand-light-text dark:text-brand-text">
            {title}
          </Text>
          <Text className="text-xs uppercase tracking-[1.5px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </Text>
        </View>
      </View>

      {state.error ? (
        <View className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4">
          <Text className="text-sm text-red-600 dark:text-red-300">
            {state.error}
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {state.isLoading
          ? Array.from({ length: 6 }, (_, index) => (
              <View key={`loading-${index}`} className="mr-4 w-36">
                <View className="h-56 animate-pulse rounded-3xl bg-brand-surface/70" />
                <View className="mt-2 h-3 w-24 rounded bg-brand-surface/70" />
                <View className="mt-2 h-2 w-12 rounded bg-brand-surface/60" />
              </View>
            ))
          : state.items.map((item, index) => (
              <MediaPosterCard
                key={item.id}
                show={item}
                href={{
                  pathname: "/show/[id]",
                  params: { id: createShowRouteId(item) },
                }}
                rank={index + 1}
                className="mr-4"
              />
            ))}
      </ScrollView>
    </View>
  );
}

export default function DiscoveryScreen() {
  const [tvState, setTvState] = useState<SectionState>(initialSectionState);
  const [animeState, setAnimeState] = useState<SectionState>(initialSectionState);
  const [movieState, setMovieState] = useState<SectionState>(initialSectionState);

  useEffect(() => {
    let isCancelled = false;

    const loadDiscovery = async () => {
      setTvState(initialSectionState);
      setAnimeState(initialSectionState);
      setMovieState(initialSectionState);

      const [tvResult, animeResult, movieResult] = await Promise.allSettled([
        getTrendingTmdb("tv"),
        getTrendingAniList(1, 20),
        getTrendingTmdb("movie"),
      ]);

      if (isCancelled) {
        return;
      }

      if (tvResult.status === "fulfilled") {
        setTvState({
          isLoading: false,
          error: null,
          items: tvResult.value.results.slice(0, 20).map(normalizeTmdbMedia),
        });
      } else {
        setTvState({
          isLoading: false,
          error: "Could not load trending TV right now.",
          items: [],
        });
      }

      if (animeResult.status === "fulfilled") {
        setAnimeState({
          isLoading: false,
          error: null,
          items: animeResult.value.data.Page.media
            .slice(0, 20)
            .map(normalizeAniListMedia),
        });
      } else {
        setAnimeState({
          isLoading: false,
          error: "Could not load trending anime right now.",
          items: [],
        });
      }

      if (movieResult.status === "fulfilled") {
        setMovieState({
          isLoading: false,
          error: null,
          items: movieResult.value.results
            .slice(0, 20)
            .map(normalizeTmdbMedia),
        });
      } else {
        setMovieState({
          isLoading: false,
          error: "Could not load popular movies right now.",
          items: [],
        });
      }
    };

    void loadDiscovery();

    return () => {
      isCancelled = true;
    };
  }, []);

  const isLoading =
    tvState.isLoading || animeState.isLoading || movieState.isLoading;

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-10">
          <View className="relative mb-8 overflow-hidden rounded-[30px] border border-brand-surface/60 bg-brand-surface/85 px-5 py-6">
            <View className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-brand-primary/20" />
            <View className="absolute -left-24 bottom-[-90] h-56 w-56 rounded-full bg-cyan-400/10" />
            <Badge
              label="Phase 3"
              className="mb-3 self-start border-white/40 bg-white/10"
              textClassName="text-white"
            />
            <Text className="text-3xl font-black tracking-tight text-white">
              Discover Your Next Obsession
            </Text>
            <Text className="mt-2 max-w-[90%] text-sm leading-6 text-slate-300">
              Real-time trending lanes for TV, anime, and movies with instant
              deep dives into details.
            </Text>
            {isLoading ? (
              <View className="mt-4 flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#94a3b8" />
                <Text className="text-xs uppercase tracking-[1.2px] text-slate-400">
                  Loading live trends
                </Text>
              </View>
            ) : null}
          </View>

          <DiscoveryRow
            title="Trending TV"
            subtitle="Freshly buzzing series"
            state={tvState}
          />
          <DiscoveryRow
            title="Trending Anime"
            subtitle="Community heat right now"
            state={animeState}
          />
          <DiscoveryRow
            title="Popular Movies"
            subtitle="Big screen momentum"
            state={movieState}
          />
          {!tvState.items.length &&
          !animeState.items.length &&
          !movieState.items.length &&
          !isLoading ? (
            <View className="rounded-2xl border border-brand-surface/50 bg-brand-surface/50 p-4">
              <Text className="text-sm text-slate-500 dark:text-slate-300">
                No discovery data available at the moment.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
