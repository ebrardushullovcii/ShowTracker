import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useQuery } from "convex/react";
import { FlashList } from "@shopify/flash-list";
import { api } from "@/convex/_generated/api";
import { FilterChipGroup } from "@/components/FilterChipGroup";
import { PageIntro } from "@/components/PageIntro";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  applyTrackingFilters,
  matchesStatusFilter,
  type TrackingStatusFilter,
} from "@/lib/filters/tracking-filters";
import { toHttpsImageUrl } from "@/lib/image-url";

type LibraryMediaTab = "tv" | "anime" | "movie";
type LibraryStatusFilter = TrackingStatusFilter;

type LibraryItem = {
  id: string | null;
  title: string;
  mediaType: "tv" | "anime" | "movie";
  status: "watching" | "paused" | "dropped" | "completed" | "plan_to_watch";
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  firstAired: string | null;
  tmdbId: number | null;
  anilistId: number | null;
  malId: number | null;
  tvmazeId: number | null;
  imdbId: string | null;
  watchedEpisodes: number;
  totalEpisodes: number | null;
  remainingEpisodes: number | null;
  progressPercent: number | null;
  lastActivityAt: number;
  genres: string[];
  rating?: number | null;
};

type LibraryDashboardItem = LibraryItem;

const GRID_GAP = 12;

const tabOptions = [
  { value: "tv" as const, label: "TV" },
  { value: "anime" as const, label: "Anime" },
  { value: "movie" as const, label: "Movies" },
];

const statusOptions: { value: LibraryStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "watching", label: "Watching" },
  { value: "plan_to_watch", label: "Planned" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
  { value: "watched", label: "Watched" },
  { value: "not_watched", label: "Not Watched" },
];

function getRouteId(item: LibraryItem) {
  if (
    typeof item.tmdbId === "number" &&
    (item.mediaType === "tv" || item.mediaType === "movie")
  ) {
    return `tmdb:${item.mediaType}:${item.tmdbId}`;
  }
  if (typeof item.anilistId === "number" && item.mediaType === "anime") {
    return `anilist:anime:${item.anilistId}`;
  }
  if (typeof item.malId === "number" && item.mediaType === "anime") {
    return `jikan:anime:${item.malId}`;
  }
  return null;
}

function getItemKey(item: LibraryItem) {
  return (
    getRouteId(item) ??
    item.id ??
    `${item.mediaType}:${item.title}:${item.firstAired ?? "unknown"}`
  );
}

function formatStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "watchig") return "Watching";
  if (normalized === "plan_to_watch") return "Plan to Watch";
  const spaced = normalized.replaceAll("_", " ");
  return spaced.slice(0, 1).toUpperCase() + spaced.slice(1);
}

function getHomeColumnCount(width: number, isWeb: boolean) {
  if (isWeb) {
    if (width >= 1600) return 6;
    if (width >= 1300) return 5;
    if (width >= 1050) return 4;
    if (width >= 800) return 3;
    return 2;
  }
  return width >= 500 ? 3 : 2;
}

function LibraryCard({ item, isWeb }: { item: LibraryDashboardItem; isWeb: boolean }) {
  const routeId = getRouteId(item);
  const isMovie = item.mediaType === "movie";
  const rawPercent =
    typeof item.progressPercent === "number" ? item.progressPercent : 0;
  const progress = Math.max(0, Math.min(100, rawPercent)) / 100;

  const posterHeight = isWeb ? 280 : 240;

  const card = (
    <View className="overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-900">
      <View className="relative overflow-hidden" style={{ height: posterHeight }}>
        {item.posterUrl ? (
          <Image
            source={{ uri: toHttpsImageUrl(item.posterUrl) }}
            className="absolute inset-0"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-zinc-800 px-3">
            <Text className="text-center text-sm font-semibold text-zinc-400">
              {item.title}
            </Text>
          </View>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96 }}
        />
        {typeof item.remainingEpisodes === "number" && item.remainingEpisodes > 0 ? (
          <View className="absolute right-2 top-2 rounded-md border-2 border-white/20 bg-black/80 px-2.5 py-1.5">
            <Text className="text-[11px] font-black uppercase tracking-wide text-white">
              {item.remainingEpisodes} left
            </Text>
          </View>
        ) : null}
        <View className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5">
          <Text className="mb-0.5 text-sm font-bold text-white" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-xs text-zinc-400" numberOfLines={1}>
            {item.firstAired?.slice(0, 4) ?? "TBA"} · {formatStatus(item.status)}
          </Text>
          {!isMovie && progress > 0 ? (
            <View className="mt-1.5 h-1 overflow-hidden bg-white/15">
              <View
                className="h-full bg-red-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (!routeId) {
    return card;
  }

  return (
    <Link href={{ pathname: "/show/[id]", params: { id: routeId } }} asChild>
      <Pressable
        style={({ pressed }) =>
          pressed ? { opacity: 0.95, transform: [{ scale: 0.98 }] } : undefined
        }
      >
        {card}
      </Pressable>
    </Link>
  );
}

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<LibraryMediaTab>("tv");
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<string>("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const [gridWidth, setGridWidth] = useState(0);
  const dashboard = useQuery(api.shows.getHomeDashboard, {});
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    setGridWidth(e.nativeEvent.layout.width);
  }, []);

  const sourceItems = useMemo(() => {
    if (!dashboard) return [] as LibraryDashboardItem[];
    return [...dashboard.shows, ...dashboard.movies] as LibraryDashboardItem[];
  }, [dashboard]);

  const mediaItems = useMemo(
    () => sourceItems.filter((item) => item.mediaType === activeTab),
    [activeTab, sourceItems]
  );

  // Extract unique genres from library items for current tab
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    mediaItems.forEach((item) => {
      item.genres?.forEach((g) => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [mediaItems]);

  // Filter by status, genres, year, and rating
  const activeItems = useMemo(() => {
    let items = applyTrackingFilters(mediaItems, {
      media: "all",
      status: statusFilter,
    });
    
    // Apply genre filter
    if (selectedGenres.length > 0) {
      items = items.filter((item) =>
        selectedGenres.some((g) => item.genres?.includes(g))
      );
    }
    
    // Apply year filter
    if (selectedYear) {
      const year = selectedYear;
      items = items.filter((item) => {
        const itemYear = item.firstAired?.slice(0, 4);
        return itemYear === year;
      });
    }
    
    // Apply rating filter
    if (selectedRating) {
      const minRating = Number(selectedRating);
      items = items.filter((item) => {
        const rating = item.rating ?? 0;
        return rating >= minRating;
      });
    }
    
    return items;
  }, [mediaItems, statusFilter, selectedGenres, selectedYear, selectedRating]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear("");
    setSelectedRating("");
    setOpenDropdown(null);
  };

  const hasActiveFilters = selectedGenres.length > 0 || selectedYear !== "" || selectedRating !== "";

  const statusOptionsWithCounts = useMemo(
    () =>
      statusOptions.map((option) => ({
        ...option,
        count: mediaItems.filter((item) => matchesStatusFilter(item, option.value))
          .length,
      })),
    [mediaItems]
  );

  const isLoading = dashboard === undefined;
  const effectiveWidth = gridWidth || width;
  const columns = getHomeColumnCount(effectiveWidth, isWeb);
  const pageSize = Math.max(columns * 3, 6);
  const hasMore = visibleCount < activeItems.length;

  useEffect(() => {
    setVisibleCount(Math.min(pageSize, activeItems.length));
    setIsLoadingMore(false);
  }, [activeItems.length, activeTab, pageSize, statusFilter, selectedGenres, selectedYear, selectedRating]);

  useEffect(() => {
    return () => {
      if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
    };
  }, []);

  const visibleItems = useMemo(
    () => activeItems.slice(0, visibleCount),
    [activeItems, visibleCount]
  );

  const loadMoreItems = () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    loadMoreTimerRef.current = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + pageSize, activeItems.length));
      setIsLoadingMore(false);
    }, 140);
  };

  const renderLibraryItem = useCallback(
    ({ item, index }: { item: LibraryDashboardItem; index: number }) => {
      const columnIndex = index % columns;
      const halfGap = GRID_GAP / 2;

      return (
        <View
          style={{
            flex: 1,
            paddingLeft: columnIndex === 0 ? 0 : halfGap,
            paddingRight: columnIndex === columns - 1 ? 0 : halfGap,
          }}
        >
          <LibraryCard item={item} isWeb={isWeb} />
        </View>
      );
    },
    [columns, isWeb]
  );

  const headerText =
    activeTab === "tv"
      ? { title: "TV Library", subtitle: "Your tracked TV shows" }
      : activeTab === "anime"
        ? { title: "Anime Library", subtitle: "Your tracked anime" }
        : { title: "Movie Library", subtitle: "Movies in your queue" };

  return (
    <ScreenWrapper>
      <View className="flex-1" onLayout={onGridLayout}>
        {gridWidth > 0 ? (
          <FlashList
            key={`${activeTab}-${statusFilter}-${selectedGenres.join(",")}`}
            data={visibleItems}
            keyExtractor={getItemKey}
            renderItem={renderLibraryItem}
            numColumns={columns}
            ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
            onEndReached={loadMoreItems}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListHeaderComponent={
              <View className="pb-2">
                <PageIntro
                  title={headerText.title}
                  subtitle={headerText.subtitle}
                  eyebrow="Your library"
                  icon={
                    activeTab === "movie"
                      ? "film-outline"
                      : activeTab === "anime"
                        ? "planet-outline"
                        : "tv-outline"
                  }
                  rightLabel={`${activeItems.length} matched`}
                  className="mb-4"
                />

                <SegmentedControl
                  options={tabOptions}
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mb-3"
                />

                <FilterChipGroup
                  className="mb-3"
                  options={statusOptionsWithCounts}
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value)}
                />

                {/* Filter Buttons */}
                <View className="mb-3">
                  <View className="flex-row flex-wrap gap-2">
                    {/* Genre Button */}
                    {availableGenres.length > 0 && (
                      <Pressable
                        onPress={() => setOpenDropdown(openDropdown === "genres" ? null : "genres")}
                        className={`flex-row items-center gap-2 rounded-full border px-4 py-2 ${
                          selectedGenres.length > 0
                            ? "border-primary bg-primary"
                            : "border-border-default bg-bg-surface"
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${selectedGenres.length > 0 ? "text-white" : "text-text-secondary"}`}>
                          {selectedGenres.length > 0 ? `${selectedGenres.length} Genre${selectedGenres.length > 1 ? "s" : ""}` : "Genre"}
                        </Text>
                        <Text className={selectedGenres.length > 0 ? "text-white" : "text-text-secondary"}>
                          {openDropdown === "genres" ? "▲" : "▼"}
                        </Text>
                      </Pressable>
                    )}

                    {/* Year Button */}
                    <Pressable
                      onPress={() => setOpenDropdown(openDropdown === "year" ? null : "year")}
                      className={`flex-row items-center gap-2 rounded-full border px-4 py-2 ${
                        selectedYear ? "border-primary bg-primary" : "border-border-default bg-bg-surface"
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${selectedYear ? "text-white" : "text-text-secondary"}`}>
                        {selectedYear || "Year"}
                      </Text>
                      <Text className={selectedYear ? "text-white" : "text-text-secondary"}>
                        {openDropdown === "year" ? "▲" : "▼"}
                      </Text>
                    </Pressable>

                    {/* Rating Button */}
                    <Pressable
                      onPress={() => setOpenDropdown(openDropdown === "rating" ? null : "rating")}
                      className={`flex-row items-center gap-2 rounded-full border px-4 py-2 ${
                        selectedRating ? "border-primary bg-primary" : "border-border-default bg-bg-surface"
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${selectedRating ? "text-white" : "text-text-secondary"}`}>
                        {selectedRating ? `${selectedRating}+ ⭐` : "Rating"}
                      </Text>
                      <Text className={selectedRating ? "text-white" : "text-text-secondary"}>
                        {openDropdown === "rating" ? "▲" : "▼"}
                      </Text>
                    </Pressable>

                    {/* Clear Button */}
                    {hasActiveFilters && (
                      <Pressable
                        onPress={clearFilters}
                        className="rounded-full border border-border-default bg-bg-surface px-4 py-2"
                      >
                        <Text className="text-sm font-semibold text-text-secondary">Clear</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Genre Dropdown */}
                  {openDropdown === "genres" && availableGenres.length > 0 && (
                    <View className="mt-2 rounded-xl border border-border-default bg-bg-surface p-3">
                      <Text className="mb-2 text-xs font-bold uppercase text-text-secondary">Select Genres</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {availableGenres.map((genre) => (
                          <Pressable
                            key={genre}
                            onPress={() => toggleGenre(genre)}
                            className={`rounded-full border px-3 py-1.5 ${
                              selectedGenres.includes(genre)
                                ? "border-primary bg-primary"
                                : "border-border-default bg-bg-primary"
                            }`}
                          >
                            <Text className={`text-xs ${selectedGenres.includes(genre) ? "text-white" : "text-text-secondary"}`}>
                              {genre}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Year Dropdown */}
                  {openDropdown === "year" && (
                    <View className="mt-2 rounded-xl border border-border-default bg-bg-surface p-3">
                      <Text className="mb-2 text-xs font-bold uppercase text-text-secondary">Select Year</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={() => { setSelectedYear(""); setOpenDropdown(null); }}
                            className={`rounded-full border px-4 py-2 ${!selectedYear ? "border-primary bg-primary" : "border-border-default bg-bg-primary"}`}
                          >
                            <Text className={`text-sm ${!selectedYear ? "text-white" : "text-text-secondary"}`}>Any</Text>
                          </Pressable>
                          {Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString()).map((year) => (
                            <Pressable
                              key={year}
                              onPress={() => { setSelectedYear(year); setOpenDropdown(null); }}
                              className={`rounded-full border px-4 py-2 ${selectedYear === year ? "border-primary bg-primary" : "border-border-default bg-bg-primary"}`}
                            >
                              <Text className={`text-sm ${selectedYear === year ? "text-white" : "text-text-secondary"}`}>
                                {year}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Rating Dropdown */}
                  {openDropdown === "rating" && (
                    <View className="mt-2 rounded-xl border border-border-default bg-bg-surface p-3">
                      <Text className="mb-2 text-xs font-bold uppercase text-text-secondary">Min Rating</Text>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => { setSelectedRating(""); setOpenDropdown(null); }}
                          className={`flex-1 rounded-lg border py-2 ${!selectedRating ? "border-primary bg-primary" : "border-border-default bg-bg-primary"}`}
                        >
                          <Text className={`text-center text-sm ${!selectedRating ? "text-white" : "text-text-secondary"}`}>Any</Text>
                        </Pressable>
                        {["8", "7", "6", "5"].map((rating) => (
                          <Pressable
                            key={rating}
                            onPress={() => { setSelectedRating(rating); setOpenDropdown(null); }}
                            className={`flex-1 rounded-lg border py-2 ${selectedRating === rating ? "border-primary bg-primary" : "border-border-default bg-bg-primary"}`}
                          >
                            <Text className={`text-center text-sm ${selectedRating === rating ? "text-white" : "text-text-secondary"}`}>
                              {rating}+
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Selected Genre Tags */}
                  {selectedGenres.length > 0 && (
                    <View className="mt-2 flex-row flex-wrap gap-2">
                      {selectedGenres.map((genre) => (
                        <Pressable
                          key={genre}
                          onPress={() => toggleGenre(genre)}
                          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1"
                        >
                          <Text className="text-xs font-medium text-white">{genre}</Text>
                          <Text className="text-xs text-white">×</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Selected Year & Rating Tags */}
                  {(selectedYear || selectedRating) && (
                    <View className="mt-2 flex-row flex-wrap gap-2">
                      {selectedYear && (
                        <Pressable
                          onPress={() => setSelectedYear("")}
                          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1"
                        >
                          <Text className="text-xs font-medium text-white">{selectedYear}</Text>
                          <Text className="text-xs text-white">×</Text>
                        </Pressable>
                      )}
                      {selectedRating && (
                        <Pressable
                          onPress={() => setSelectedRating("")}
                          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1"
                        >
                          <Text className="text-xs font-medium text-white">{selectedRating}+ ⭐</Text>
                          <Text className="text-xs text-white">×</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>

                {isLoading ? (
                  <View className="items-center gap-2 rounded-xl border-2 border-border-default bg-bg-surface py-8">
                    <ActivityIndicator size="small" color="#ef4444" />
                    <Text className="text-sm text-text-secondary">
                      Loading your library
                    </Text>
                  </View>
                ) : null}

                {!isLoading && !activeItems.length ? (
                  <View className="rounded-xl border-2 border-border-default bg-bg-surface px-4 py-6">
                    <Text className="text-lg font-bold text-text-primary">
                      No titles for these filters
                    </Text>
                    <Text className="mt-1 text-sm leading-relaxed text-text-secondary">
                      Try adjusting your status or genre filters.
                    </Text>
                  </View>
                ) : null}
              </View>
            }
            ListFooterComponent={
              !isLoading && hasMore ? (
                <Pressable onPress={loadMoreItems} className="items-center py-4">
                  <ActivityIndicator
                    size="small"
                    color={isLoadingMore ? "#ef4444" : "#52525b"}
                  />
                  <Text className="mt-1 text-xs text-text-secondary">
                    {isLoadingMore ? "Loading more..." : "Tap to load more"}
                  </Text>
                </Pressable>
              ) : null
            }
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#ef4444" />
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}
