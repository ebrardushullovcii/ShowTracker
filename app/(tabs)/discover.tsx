import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View, Pressable } from "react-native";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { getTrendingAniList } from "@/lib/api/anilist";
import { normalizeAniListMedia, normalizeTmdbMedia } from "@/lib/api/normalize";
import { getTrendingTmdb } from "@/lib/api/tmdb";
import type { NormalizedShow } from "@/lib/api/types";
import { createShowRouteId } from "@/lib/show-route";

type DiscoverTab = "tv" | "anime" | "movie";

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

function getSectionError(reason: unknown, fallback: string) {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (
    typeof reason === "object" &&
    reason !== null &&
    "status" in reason &&
    typeof (reason as { status?: unknown }).status === "number"
  ) {
    return `${fallback} (API ${(reason as { status: number }).status})`;
  }

  return fallback;
}

function DiscoverTabs({
  value,
  onChange,
}: {
  value: DiscoverTab;
  onChange: (next: DiscoverTab) => void;
}) {
  return (
    <View className="mb-4 flex-row rounded-2xl border-2 border-brand-surface/70 bg-brand-light-surface p-1 dark:bg-brand-surface/75">
      {([
        { key: "tv", label: "TV Shows" },
        { key: "anime", label: "Anime" },
        { key: "movie", label: "Movies" },
      ] as const).map((tab) => {
        const active = value === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className={`flex-1 items-center rounded-xl px-2 py-2 ${
              active ? "bg-brand-primary" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-[11px] font-bold uppercase tracking-[1.2px] ${
                active
                  ? "text-white"
                  : "text-brand-light-text dark:text-brand-text"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DiscoverScreen() {
  const [activeTab, setActiveTab] = useState<DiscoverTab>("tv");
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
        getTrendingAniList(1, 24),
        getTrendingTmdb("movie"),
      ]);

      if (isCancelled) {
        return;
      }

      if (tvResult.status === "fulfilled") {
        setTvState({
          isLoading: false,
          error: null,
          items: tvResult.value.results.slice(0, 24).map(normalizeTmdbMedia),
        });
      } else {
        setTvState({
          isLoading: false,
          error: getSectionError(
            tvResult.reason,
            "Could not load trending TV shows right now."
          ),
          items: [],
        });
      }

      if (animeResult.status === "fulfilled") {
        setAnimeState({
          isLoading: false,
          error: null,
          items: animeResult.value.data.Page.media
            .slice(0, 24)
            .map(normalizeAniListMedia),
        });
      } else {
        setAnimeState({
          isLoading: false,
          error: getSectionError(
            animeResult.reason,
            "Could not load trending anime right now."
          ),
          items: [],
        });
      }

      if (movieResult.status === "fulfilled") {
        setMovieState({
          isLoading: false,
          error: null,
          items: movieResult.value.results.slice(0, 24).map(normalizeTmdbMedia),
        });
      } else {
        setMovieState({
          isLoading: false,
          error: getSectionError(
            movieResult.reason,
            "Could not load popular movies right now."
          ),
          items: [],
        });
      }
    };

    void loadDiscovery();

    return () => {
      isCancelled = true;
    };
  }, []);

  const activeState = useMemo(() => {
    if (activeTab === "anime") {
      return animeState;
    }
    if (activeTab === "movie") {
      return movieState;
    }
    return tvState;
  }, [activeTab, animeState, movieState, tvState]);

  const panelTitle =
    activeTab === "anime"
      ? "Anime Heat"
      : activeTab === "movie"
        ? "Movie Momentum"
        : "TV Broadcast";

  const panelSubtitle =
    activeTab === "anime"
      ? "Community favorites airing now"
      : activeTab === "movie"
        ? "Box office picks and crowd favorites"
        : "Series with current buzz";

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-10">
          <View className="mb-4 rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-5 dark:bg-brand-surface/80">
            <Text className="text-[11px] font-bold uppercase tracking-[1.8px] text-brand-primary">
              Discover
            </Text>
            <Text className="mt-1 font-serif text-3xl font-bold leading-9 text-brand-light-text dark:text-brand-text">
              Weekend TV Guide
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Flip through trends by medium and pick your next binge.
            </Text>
          </View>

          <DiscoverTabs value={activeTab} onChange={setActiveTab} />

          <View className="mb-4 rounded-2xl border-2 border-brand-surface/65 bg-brand-light-surface px-4 py-4 dark:bg-brand-surface/75">
            <Text className="font-serif text-2xl font-semibold text-brand-light-text dark:text-brand-text">
              {panelTitle}
            </Text>
            <Text className="mt-1 text-xs uppercase tracking-[1.2px] text-slate-500 dark:text-slate-300">
              {panelSubtitle}
            </Text>
          </View>

          {activeState.isLoading ? (
            <View className="items-center gap-2 rounded-2xl border-2 border-brand-surface/60 bg-brand-light-surface/80 py-8 dark:bg-brand-surface/70">
              <ActivityIndicator size="small" color="#cf5d3f" />
              <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-slate-500 dark:text-slate-300">
                Loading trending titles
              </Text>
            </View>
          ) : null}

          {activeState.error ? (
            <View className="mb-4 rounded-2xl border-2 border-red-400/60 bg-red-500/10 p-4">
              <Text className="text-sm text-red-700 dark:text-red-300">
                {activeState.error}
              </Text>
            </View>
          ) : null}

          <View className="flex-row flex-wrap justify-between gap-y-5">
            {activeState.items.map((item, index) => (
              <MediaPosterCard
                key={`${item.id}-${activeTab}-${index}`}
                show={item}
                href={{
                  pathname: "/show/[id]",
                  params: { id: createShowRouteId(item) },
                }}
                rank={index < 3 ? index + 1 : undefined}
                className="w-[48%]"
                posterClassName="h-64"
              />
            ))}
          </View>

          {!activeState.isLoading && !activeState.error && !activeState.items.length ? (
            <View className="mt-5 rounded-2xl border-2 border-brand-surface/60 bg-brand-light-surface px-4 py-5 dark:bg-brand-surface/70">
              <Text className="text-sm text-slate-600 dark:text-slate-300">
                No discovery data available right now.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
