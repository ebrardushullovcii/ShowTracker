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

      const fulfilledResults = settled.filter(
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
      return "Start typing a title or keyword.";
    }
    if (isLoading) {
      return "Searching the catalog...";
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
          <View className="mb-4 rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-5 dark:bg-brand-surface/80">
            <Text className="text-[11px] font-bold uppercase tracking-[1.8px] text-brand-primary">
              Search
            </Text>
            <Text className="mt-1 font-serif text-3xl font-bold leading-9 text-brand-light-text dark:text-brand-text">
              Catalog Desk
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Pull titles from TV, anime, and movies in one place.
            </Text>
          </View>

          <View className="mb-4 rounded-2xl border-2 border-brand-surface/70 bg-brand-light-surface p-4 dark:bg-brand-surface/75">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search shows, anime, movies..."
              placeholderTextColor="#857861"
              autoCapitalize="none"
              className="rounded-xl border-2 border-brand-surface/55 bg-[#fffaf0] px-4 py-3 text-base text-brand-light-text dark:bg-brand-background/70 dark:text-brand-text"
            />
            <View className="mt-3 flex-row flex-wrap gap-2">
              {filterOptions.map((option) => {
                const active = option.key === filter;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFilter(option.key)}
                    className={`rounded-full border-2 px-4 py-2 ${
                      active
                        ? "border-brand-primary bg-brand-primary"
                        : "border-brand-surface/55 bg-brand-light-background dark:bg-brand-background/65"
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold uppercase tracking-[1.2px] ${
                        active
                          ? "text-white"
                          : "text-brand-light-text dark:text-brand-text"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-slate-500 dark:text-slate-300">
              {resultLabel}
            </Text>
            {isLoading ? <ActivityIndicator size="small" color="#cf5d3f" /> : null}
          </View>

          {error ? (
            <View className="mb-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-3">
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
            <View className="mt-6 rounded-2xl border-2 border-brand-surface/60 bg-brand-light-surface px-4 py-5 dark:bg-brand-surface/70">
              <Text className="text-sm text-slate-600 dark:text-slate-300">
                Try a broader keyword or switch the filter.
              </Text>
            </View>
          ) : null}

          {!debouncedQuery.trim() ? (
            <View className="mt-6 rounded-2xl border-2 border-brand-surface/60 bg-brand-light-surface px-4 py-5 dark:bg-brand-surface/70">
              <Text className="text-sm text-slate-600 dark:text-slate-300">
                Suggestions: “The Last of Us”, “Frieren”, “Oppenheimer”
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
