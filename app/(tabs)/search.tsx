import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchAniList } from "@/lib/api/anilist";
import { searchJikan } from "@/lib/api/jikan";
import { normalizeAniListMedia, normalizeTmdbMedia } from "@/lib/api/normalize";
import { searchTmdb } from "@/lib/api/tmdb";
import type { NormalizedShow } from "@/lib/api/types";
import { createShowRouteId } from "@/lib/show-route";

type SearchFilter = "all" | "tv" | "anime" | "movie";

const filterOptions: { key: SearchFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tv", label: "TV" },
  { key: "anime", label: "Anime" },
  { key: "movie", label: "Movies" },
];

function mergeUniqueShows(shows: NormalizedShow[]) {
  const seen = new Set<string>();
  const result: NormalizedShow[] = [];

  shows.forEach((show) => {
    const key = `${show.id}:${show.mediaType}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(show);
  });

  return result;
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [results, setResults] = useState<NormalizedShow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (!normalizedQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    setIsLoading(true);
    setError(null);

    const runSearch = async () => {
      const requests: Promise<NormalizedShow[]>[] = [];

      if (filter === "all" || filter === "tv" || filter === "movie") {
        const tmdbType: "multi" | "tv" | "movie" =
          filter === "all" ? "multi" : filter;
        requests.push(
          searchTmdb(normalizedQuery, tmdbType, 1).then((response) =>
            response.results
              .filter((item) => item.media_type !== "person")
              .map(normalizeTmdbMedia)
          )
        );
      }

      if (filter === "all" || filter === "anime") {
        requests.push(
          searchAniList(normalizedQuery, 1, 20)
            .then((response) =>
              response.data.Page.media.map(normalizeAniListMedia)
            )
            .catch(() => searchJikan(normalizedQuery, 1))
        );
      }

      const settled = await Promise.allSettled(requests);

      if (requestIdRef.current !== currentRequestId) {
        return;
      }

      const fulfilledResults = settled
        .filter(
          (entry): entry is PromiseFulfilledResult<NormalizedShow[]> =>
            entry.status === "fulfilled"
        );

      const fulfilled = fulfilledResults.flatMap((entry) => entry.value);
      const failedCount = settled.length - fulfilledResults.length;

      if (!fulfilled.length && failedCount > 0) {
        setResults([]);
        setError("Search is temporarily unavailable. Please try again.");
      } else {
        const merged = mergeUniqueShows(fulfilled);
        setResults(merged);
        setError(
          failedCount > 0
            ? "Some sources are unavailable. Showing partial results."
            : null
        );
      }
      setIsLoading(false);
    };

    runSearch().catch((searchError) => {
      if (requestIdRef.current !== currentRequestId) {
        return;
      }
      console.error("Search failed", searchError);
      setError("Search failed. Please try again.");
      setResults([]);
      setIsLoading(false);
    });
  }, [debouncedQuery, filter]);

  const resultLabel = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return "Start typing to search across TV, anime, and movies.";
    }
    if (isLoading) {
      return "Searching...";
    }
    if (!results.length) {
      return "No results found.";
    }
    return `${results.length} result${results.length === 1 ? "" : "s"}`;
  }, [debouncedQuery, isLoading, results.length]);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-10">
          <View className="mb-6 gap-2">
            <Text className="text-3xl font-black tracking-tight text-brand-light-text dark:text-brand-text">
              Search Everything
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-400">
              Find titles instantly with a blended TMDB + AniList index.
            </Text>
          </View>

          <View className="mb-4 gap-3 rounded-3xl border border-brand-surface/50 bg-brand-light-surface p-4 dark:bg-brand-surface/75">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search shows, anime, movies..."
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              className="rounded-2xl border border-brand-surface/60 bg-white px-4 py-3 text-base text-brand-light-text dark:bg-brand-background dark:text-brand-text"
            />
            <View className="flex-row flex-wrap gap-2">
              {filterOptions.map((option) => {
                const active = option.key === filter;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFilter(option.key)}
                    className={`rounded-full border px-4 py-2 ${
                      active
                        ? "border-brand-primary bg-brand-primary"
                        : "border-brand-surface/60 bg-brand-light-background dark:bg-brand-background"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold uppercase tracking-[1px] ${
                        active
                          ? "text-white"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-[1.2px] text-slate-500 dark:text-slate-400">
              {resultLabel}
            </Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#64748b" />
            ) : null}
          </View>

          {error ? (
            <View className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3">
              <Text className="text-sm text-amber-700 dark:text-amber-300">
                {error}
              </Text>
            </View>
          ) : null}

          <View className="flex-row flex-wrap justify-between gap-y-5">
            {results.map((item) => (
              <MediaPosterCard
                key={`${item.id}-${item.mediaType}`}
                show={item}
                href={{
                  pathname: "/show/[id]",
                  params: { id: createShowRouteId(item) },
                }}
                className="w-[48%]"
                posterClassName="h-64"
              />
            ))}
          </View>

          {!results.length && !isLoading && debouncedQuery.trim() ? (
            <View className="mt-6 rounded-2xl border border-brand-surface/50 bg-brand-surface/40 p-4">
              <Text className="text-sm text-slate-500 dark:text-slate-300">
                Try a different keyword or switch filters.
              </Text>
            </View>
          ) : null}
          {!debouncedQuery.trim() ? (
            <View className="mt-8 rounded-2xl border border-brand-surface/50 bg-brand-surface/35 p-4">
              <Text className="text-sm text-slate-500 dark:text-slate-300">
                Example searches: "Severance", "One Piece", "Dune"
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
