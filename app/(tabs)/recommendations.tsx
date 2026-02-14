import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { PageIntro } from "@/components/PageIntro";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { SegmentedControl } from "@/components/SegmentedControl";
import { normalizeTmdbMedia } from "@/lib/api/normalize";
import {
  getMovieRecommendations,
  getTvRecommendations,
  getSimilarMovies,
  getSimilarTv,
} from "@/lib/api/tmdb";
import type { NormalizedShow } from "@/lib/api/types";
import { createShowRouteId } from "@/lib/show-route";

type RecTab = "tv" | "movie" | "all";

const tabOptions = [
  { value: "all" as const, label: "All" },
  { value: "tv" as const, label: "TV Shows" },
  { value: "movie" as const, label: "Movies" },
];

const GRID_GAP = 12;

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function getGridColumnCount(width: number, isWeb: boolean) {
  if (!isWeb) return 2;
  if (width >= 1800) return 8;
  if (width >= 1500) return 7;
  if (width >= 1260) return 6;
  if (width >= 1040) return 5;
  if (width >= 920) return 4;
  return 3;
}

export default function RecommendationsScreen() {
  const [activeTab, setActiveTab] = useState<RecTab>("all");
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const columns = getGridColumnCount(width, isWeb);

  const [recommendations, setRecommendations] = useState<NormalizedShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user's watch history from Convex
  const seedShows = useQuery(api.shows.getRecommendations, {
    mediaType: activeTab === "all" ? undefined : activeTab,
    limit: 10,
  });

  useEffect(() => {
    const controller = new AbortController();

    const fetchRecommendations = async () => {
      const { signal } = controller;

      if (seedShows === undefined) {
        if (!signal.aborted) {
          setIsLoading(true);
        }
        return;
      }

      if (seedShows.length === 0) {
        if (!signal.aborted) {
          setRecommendations([]);
          setIsLoading(false);
        }
        return;
      }

      if (signal.aborted) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const allRecommendations: NormalizedShow[] = [];
        const seenIds = new Set<string>();

        const seedResults = await Promise.all(
          seedShows.slice(0, 5).map(async (seed) => {
            if (signal.aborted) {
              return [];
            }
            if (!seed.tmdbId) {
              return [];
            }

            try {
              if (seed.mediaType === "movie") {
                const [recs, similar] = await Promise.all([
                  getMovieRecommendations(seed.tmdbId, 1, { signal }),
                  getSimilarMovies(seed.tmdbId, 1, { signal }),
                ]);

                if (signal.aborted) {
                  return [];
                }

                return [
                  ...recs.results,
                  ...similar.results.filter(
                    (s) => !recs.results.some((r) => r.id === s.id)
                  ),
                ].map((item) => ({ item, seedMediaType: seed.mediaType, seedTitle: seed.title }));
              }

              const [recs, similar] = await Promise.all([
                getTvRecommendations(seed.tmdbId, 1, { signal }),
                getSimilarTv(seed.tmdbId, 1, { signal }),
              ]);

              if (signal.aborted) {
                return [];
              }

              return [
                ...recs.results,
                ...similar.results.filter(
                  (s) => !recs.results.some((r) => r.id === s.id)
                  ),
                ].map((item) => ({ item, seedMediaType: seed.mediaType, seedTitle: seed.title }));
            } catch (err) {
              if (signal.aborted || isAbortError(err)) {
                return [];
              }
              console.error(`Failed to get recommendations for ${seed.title}:`, err);
              return [];
            }
          })
        );

        if (signal.aborted) {
          return;
        }

        for (const resultSet of seedResults) {
          for (const { item } of resultSet) {
            if (signal.aborted) {
              return;
            }

            const normalized = normalizeTmdbMedia(item);
            const key = `${item.id}:${normalized.mediaType}`;
            if (seenIds.has(key)) continue;

            if (activeTab !== "all" && normalized.mediaType !== activeTab) {
              continue;
            }

            seenIds.add(key);
            allRecommendations.push(normalized);
          }
        }

        if (!signal.aborted) {
          setRecommendations(allRecommendations.slice(0, 50));
        }
      } catch (err) {
        if (!signal.aborted && !isAbortError(err)) {
          setError("Failed to load recommendations. Please try again.");
          console.error(err);
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchRecommendations();

    return () => {
      controller.abort();
    };
  }, [seedShows, activeTab]);

  const headerTitle = useMemo(() => {
    switch (activeTab) {
      case "movie":
        return "Movie Recommendations";
      case "tv":
        return "TV Show Recommendations";
      default:
        return "Recommended For You";
    }
  }, [activeTab]);

  const headerSubtitle = useMemo(() => {
    if (seedShows?.length === 0) {
      return "Watch some shows to get personalized recommendations";
    }
    return `Based on your watch history`;
  }, [seedShows]);

  return (
    <ScreenWrapper>
      <View className="flex-1 px-4">
        <FlashList
          data={recommendations}
          key={`rec-grid-${columns}`}
          numColumns={columns}
          keyExtractor={(item) => `${item.id}-${item.mediaType}`}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <View className="pb-2">
              <PageIntro
                title={headerTitle}
                subtitle={headerSubtitle}
                eyebrow="Personalized"
                icon="sparkles-outline"
                rightLabel={
                  !isLoading && recommendations.length > 0
                    ? `${recommendations.length} suggestions`
                    : undefined
                }
                className="mb-4"
              />

              <SegmentedControl
                options={tabOptions}
                value={activeTab}
                onValueChange={setActiveTab}
                className="mb-4"
              />

              {isLoading && (
                <View className="mb-4 items-center gap-2 rounded-xl border-2 border-border-default bg-bg-surface py-8">
                  <ActivityIndicator size="small" color="#ef4444" />
                  <Text className="text-sm text-text-secondary">
                    Finding shows you'll love...
                  </Text>
                </View>
              )}

              {error && (
                <View className="mb-4 rounded-xl border-2 border-warning/30 bg-warning/10 p-4">
                  <Text className="text-sm text-warning">{error}</Text>
                </View>
              )}

              {!isLoading && seedShows?.length === 0 && (
                <View className="mb-4 rounded-xl border-2 border-border-default bg-bg-surface px-4 py-8">
                  <Text className="text-lg font-bold text-text-primary">
                    Start Watching to Get Recommendations
                  </Text>
                  <Text className="mt-2 text-sm text-text-secondary">
                    We'll analyze your watch history and suggest shows based on what you like.
                    Try searching for shows or browsing the Discover page.
                  </Text>
                </View>
              )}

              {!isLoading && recommendations.length === 0 && seedShows && seedShows.length > 0 && (
                <View className="mb-4 rounded-xl border-2 border-border-default bg-bg-surface px-4 py-8">
                  <Text className="text-lg font-bold text-text-primary">
                    No Recommendations Found
                  </Text>
                  <Text className="mt-2 text-sm text-text-secondary">
                    We couldn't find recommendations for your current watch history.
                    Try watching more shows or switching to a different tab.
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, paddingHorizontal: GRID_GAP / 2 }}>
              <MediaPosterCard
                show={item}
                href={{
                  pathname: "/show/[id]",
                  params: { id: createShowRouteId(item) },
                }}
                className="w-full"
                posterClassName={isWeb ? "h-56" : "h-64"}
              />
            </View>
          )}
          ListEmptyComponent={null}
        />
      </View>
    </ScreenWrapper>
  );
}
