import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PageIntro } from "@/components/PageIntro";
import { toHttpsImageUrl } from "@/lib/image-url";
import { FlashList } from "@shopify/flash-list";
import type { MediaType } from "@/lib/api/types";

type HomeTab = "watchlist" | "upcoming";
type HomeFilter = "all" | "tv" | "anime";

type WatchlistItem = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  tmdbId: number | null;
  anilistId: number | null;
  remainingEpisodes: number;
  watchedEpisodes: number;
  totalEpisodes: number;
};

type UpcomingEpisode = {
  routeId: string | null;
  showTitle: string;
  mediaType: "tv" | "anime";
  posterUrl?: string;
  daysUntil: number;
  episode: {
    seasonNumber: number;
    episodeNumber: number;
    name?: string;
  };
};

type UpcomingGroup = {
  date: string;
  episodes: UpcomingEpisode[];
};

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDayLabel(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const dayDiff = Math.floor(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (dayDiff === 0) return "TODAY";
  if (dayDiff === 1) return "TOMORROW";
  if (dayDiff === 2) return "IN 2 DAYS";

  return date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toUpperCase();
}

function getDateLabel(dateString: string) {
  const date = new Date(dateString);
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

function getColumnCount(width: number, isWeb: boolean) {
  if (isWeb) {
    if (width >= 1600) return 6;
    if (width >= 1300) return 5;
    if (width >= 1050) return 4;
    if (width >= 800) return 3;
    return 2;
  }
  return width >= 500 ? 3 : 2;
}

const GRID_GAP = 12;
const INITIAL_PAST_DAYS = 8;
const INITIAL_FUTURE_DAYS = 8;
const RANGE_EXTENSION_DAYS = 8;
const SCROLL_EDGE_THRESHOLD = 180;

function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateForApi(date);
}

function getInclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

function getWatchlistRouteId(item: WatchlistItem) {
  if (
    typeof item.tmdbId === "number" &&
    (item.mediaType === "tv" || item.mediaType === "movie")
  ) {
    return `tmdb:${item.mediaType}:${item.tmdbId}`;
  }
  if (typeof item.anilistId === "number" && item.mediaType === "anime") {
    return `anilist:anime:${item.anilistId}`;
  }
  return null;
}

function WatchlistCard({ item, isWeb }: { item: WatchlistItem; isWeb: boolean }) {
  const routeId = getWatchlistRouteId(item);
  const posterHeight = isWeb ? 280 : 240;

  const card = (
    <View className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <View className="relative overflow-hidden" style={{ height: posterHeight }}>
        {item.posterUrl ? (
          <Image
            source={{ uri: toHttpsImageUrl(item.posterUrl) }}
            className="absolute inset-0"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-zinc-800 px-3">
            <Text className="text-center text-sm font-semibold text-zinc-400">{item.title}</Text>
          </View>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96 }}
        />
        <View className="absolute right-2 top-2 rounded-full border border-primary/40 bg-primary/15 px-2 py-1">
          <Text className="text-xs font-bold text-primary">{item.remainingEpisodes} left</Text>
        </View>
        <View className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5">
          <Text className="mb-0.5 text-sm font-bold text-white" numberOfLines={1}>{item.title}</Text>
          <Text className="text-xs text-zinc-400" numberOfLines={1}>
            {item.watchedEpisodes}/{item.totalEpisodes} episodes
          </Text>
          <View className="mt-1.5 h-0.5 overflow-hidden rounded-sm bg-white/15">
            <View 
              className="h-full rounded-sm bg-red-500" 
              style={{ width: `${Math.round((item.watchedEpisodes / item.totalEpisodes) * 100)}%` }} 
            />
          </View>
        </View>
      </View>
    </View>
  );

  if (!routeId) {
    return card;
  }

  return (
    <Link href={{ pathname: "/show/[id]", params: { id: routeId } }} asChild>
      <Pressable style={({ pressed }) => pressed ? { opacity: 0.95, transform: [{ scale: 0.98 }] } : undefined}>
        {card}
      </Pressable>
    </Link>
  );
}

function UpcomingCard({ episode, isWeb }: { episode: UpcomingEpisode; isWeb: boolean }) {
  const posterHeight = isWeb ? 280 : 240;
  const hasEpisodeName = episode.episode.name && episode.episode.name !== episode.showTitle;

  const card = (
    <View className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <View className="relative overflow-hidden" style={{ height: posterHeight }}>
        {episode.posterUrl ? (
          <Image
            source={{ uri: toHttpsImageUrl(episode.posterUrl) }}
            className="absolute inset-0"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-zinc-800 px-3">
            <Text className="text-center text-sm font-semibold text-zinc-400">{episode.showTitle}</Text>
          </View>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110 }}
        />
        <View className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 flex-row items-center">
          <Text className="text-sm font-bold text-white">{episode.daysUntil}</Text>
          <Text className="text-[10px] font-semibold text-zinc-200 ml-1">
            {episode.daysUntil === 1 ? "DAY" : "DAYS"}
          </Text>
        </View>
        <View className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5">
          <Text className="mb-0.5 text-sm font-bold text-white" numberOfLines={1}>
            {episode.showTitle}
          </Text>
          {hasEpisodeName ? (
            <Text className="text-xs text-primary-glow" numberOfLines={1}>
              {episode.episode.name}
            </Text>
          ) : null}
          <Text className="text-xs text-zinc-400 mt-0.5" numberOfLines={1}>
            S{episode.episode.seasonNumber}E{episode.episode.episodeNumber}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!episode.routeId) {
    return <View className="opacity-70">{card}</View>;
  }

  return (
    <Link href={{ pathname: "/show/[id]", params: { id: episode.routeId } }} asChild>
      <Pressable style={({ pressed }) => pressed ? { opacity: 0.95, transform: [{ scale: 0.98 }] } : undefined}>
        {card}
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<HomeTab>("watchlist");
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [watchlistVisibleCount, setWatchlistVisibleCount] = useState(0);
  const [isLoadingMoreWatchlist, setIsLoadingMoreWatchlist] = useState(false);
  const [isHydratingInitialUpcoming, setIsHydratingInitialUpcoming] = useState(false);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  const [isLoadingFuture, setIsLoadingFuture] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  const todayDate = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateForApi(todayDate), [todayDate]);
  const [rangeStartDate, setRangeStartDate] = useState(() =>
    addDaysToDateString(todayKey, -INITIAL_PAST_DAYS)
  );
  const [rangeEndDate, setRangeEndDate] = useState(() =>
    addDaysToDateString(todayKey, INITIAL_FUTURE_DAYS)
  );

  const upcomingScrollRef = useRef<ScrollView>(null);
  const pastSectionHeightRef = useRef(0);
  const didHydrateInitialUpcomingRef = useRef(false);
  const hydratedRangesRef = useRef(new Set<string>());
  const shouldAnchorTodayRef = useRef(false);
  const previousTabRef = useRef<HomeTab>("watchlist");
  const canLoadPastFromEdgeRef = useRef(true);
  const canLoadFutureFromEdgeRef = useRef(true);
  const watchlistLoadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [upcomingSnapshot, setUpcomingSnapshot] = useState<UpcomingGroup[]>([]);

  const watchlist = useQuery(api.shows.getWatchlist, {});
  const upcoming = useQuery(
    api.schedule.getUpcomingSchedule,
    activeTab === "upcoming" && !isHydratingInitialUpcoming
      ? {
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          mediaFilter: filter === "all" ? undefined : filter,
        }
      : "skip"
  );
  const hydrateScheduleRange = useAction(api.schedule.hydrateScheduleRange);

  const hydrateRange = useCallback(
    async (startDate: string, days: number) => {
      const safeDays = Math.max(1, Math.min(days, 21));
      const cacheKey = `${startDate}:${safeDays}`;
      if (hydratedRangesRef.current.has(cacheKey)) {
        return;
      }

      hydratedRangesRef.current.add(cacheKey);
      await hydrateScheduleRange({
        startDate,
        days: safeDays,
      });
    },
    [hydrateScheduleRange]
  );

  useEffect(() => {
    if (activeTab === "upcoming" && previousTabRef.current !== "upcoming") {
      shouldAnchorTodayRef.current = true;
      canLoadPastFromEdgeRef.current = true;
      canLoadFutureFromEdgeRef.current = true;
    }
    previousTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "upcoming" || didHydrateInitialUpcomingRef.current) {
      return;
    }

    didHydrateInitialUpcomingRef.current = true;
    setIsHydratingInitialUpcoming(true);

    void hydrateRange(
      rangeStartDate,
      getInclusiveDayCount(rangeStartDate, rangeEndDate)
    ).finally(() => {
      setIsHydratingInitialUpcoming(false);
    });
  }, [activeTab, hydrateRange, rangeEndDate, rangeStartDate]);

  const loadPastWeek = useCallback(async () => {
    if (activeTab !== "upcoming" || isLoadingPast) {
      return;
    }

    const newStartDate = addDaysToDateString(rangeStartDate, -RANGE_EXTENSION_DAYS);

    setIsLoadingPast(true);
    try {
      await hydrateRange(newStartDate, RANGE_EXTENSION_DAYS);
      setRangeStartDate(newStartDate);
    } finally {
      setIsLoadingPast(false);
    }
  }, [activeTab, hydrateRange, isLoadingPast, rangeStartDate]);

  const loadFutureWeek = useCallback(async () => {
    if (activeTab !== "upcoming" || isLoadingFuture) {
      return;
    }

    const nextStartDate = addDaysToDateString(rangeEndDate, 1);
    const newEndDate = addDaysToDateString(rangeEndDate, RANGE_EXTENSION_DAYS);

    setIsLoadingFuture(true);
    try {
      await hydrateRange(nextStartDate, RANGE_EXTENSION_DAYS);
      setRangeEndDate(newEndDate);
    } finally {
      setIsLoadingFuture(false);
    }
  }, [activeTab, hydrateRange, isLoadingFuture, rangeEndDate]);

  useEffect(() => {
    if (activeTab === "upcoming" && upcoming !== undefined) {
      setUpcomingSnapshot(upcoming as UpcomingGroup[]);
    }
  }, [activeTab, upcoming]);

  const filteredWatchlist = useMemo(() => {
    const items = (watchlist ?? []) as WatchlistItem[];
    if (filter === "all") return items;
    return items.filter((item) => item.mediaType === filter);
  }, [filter, watchlist]);

  const upcomingGroups = useMemo(
    () => ((upcoming ?? upcomingSnapshot) as UpcomingGroup[]),
    [upcoming, upcomingSnapshot]
  );

  const pastUpcomingGroups = useMemo(
    () => upcomingGroups.filter((group) => group.date < todayKey),
    [todayKey, upcomingGroups]
  );

  const currentAndFutureUpcomingGroups = useMemo(
    () => upcomingGroups.filter((group) => group.date >= todayKey),
    [todayKey, upcomingGroups]
  );

  const isWatchlistLoading = watchlist === undefined;
  const isUpcomingLoading =
    activeTab === "upcoming" &&
    upcomingGroups.length === 0 &&
    (upcoming === undefined || isHydratingInitialUpcoming);

  const effectiveWidth = gridWidth || Math.max(width - 40, 0);
  const columns = getColumnCount(effectiveWidth, isWeb);
  const cardWidth = (effectiveWidth - (columns - 1) * GRID_GAP) / columns;
  const watchlistPageSize = Math.max(columns * 3, 6);

  const getHeaderText = () => {
    switch (activeTab) {
      case "watchlist":
        return { title: "Watchlist", subtitle: "Shows with new episodes to watch" };
      case "upcoming":
        return { title: "Upcoming", subtitle: "Episodes from 8 days before and after today" };
    }
  };

  const headerText = getHeaderText();
  const watchlistCount = filteredWatchlist.length;
  const upcomingCount = upcomingGroups.reduce((sum, group) => sum + group.episodes.length, 0);
  const visibleWatchlistItems = useMemo(
    () => filteredWatchlist.slice(0, watchlistVisibleCount),
    [filteredWatchlist, watchlistVisibleCount]
  );
  const hasMoreWatchlist = watchlistVisibleCount < filteredWatchlist.length;

  useEffect(() => {
    setWatchlistVisibleCount((current) => {
      const next = Math.min(filteredWatchlist.length, Math.max(current, watchlistPageSize));
      return next;
    });
    setIsLoadingMoreWatchlist(false);
  }, [filteredWatchlist.length, watchlistPageSize]);

  useEffect(() => {
    return () => {
      if (watchlistLoadMoreTimerRef.current) {
        clearTimeout(watchlistLoadMoreTimerRef.current);
      }
    };
  }, []);

  const loadMoreWatchlist = useCallback(() => {
    if (!hasMoreWatchlist || isLoadingMoreWatchlist || isWatchlistLoading) {
      return;
    }

    setIsLoadingMoreWatchlist(true);
    watchlistLoadMoreTimerRef.current = setTimeout(() => {
      setWatchlistVisibleCount((count) =>
        Math.min(count + watchlistPageSize, filteredWatchlist.length)
      );
      setIsLoadingMoreWatchlist(false);
    }, 120);
  }, [filteredWatchlist.length, hasMoreWatchlist, isLoadingMoreWatchlist, isWatchlistLoading, watchlistPageSize]);

  const renderUpcomingGroup = useCallback(
    (group: UpcomingGroup) => {
      const isToday = group.date === todayKey;

      return (
        <View key={group.date} className="mb-6">
          <View
            className={`mb-3 self-start rounded-full px-3 py-1 ${
              isToday ? "bg-red-500" : "bg-zinc-700/70"
            }`}
          >
            <Text className="text-xs font-bold text-zinc-100">
              {getDayLabel(group.date)} · {getDateLabel(group.date)}
            </Text>
          </View>

          <View className="flex-row flex-wrap">
            {group.episodes.map((episode, index) => {
              const isLastInRow = index % columns === columns - 1;
              const isLastItem = index === group.episodes.length - 1;

              return (
                <View
                  key={`${group.date}:${episode.routeId ?? episode.showTitle}:${episode.episode.seasonNumber}:${episode.episode.episodeNumber}:${index}`}
                  style={{
                    width: cardWidth,
                    marginRight: isLastInRow || isLastItem ? 0 : GRID_GAP,
                    marginBottom: GRID_GAP,
                  }}
                >
                  <UpcomingCard episode={episode} isWeb={isWeb} />
                </View>
              );
            })}
          </View>
        </View>
      );
    },
    [cardWidth, columns, isWeb, todayKey]
  );

  const onPastSectionLayout = useCallback(
    (event: any) => {
      const nextHeight = event.nativeEvent.layout.height;
      pastSectionHeightRef.current = nextHeight;

      if (shouldAnchorTodayRef.current && activeTab === "upcoming" && !isUpcomingLoading) {
        requestAnimationFrame(() => {
          upcomingScrollRef.current?.scrollTo({ y: nextHeight, animated: false });
        });
        shouldAnchorTodayRef.current = false;
      }
    },
    [activeTab, isUpcomingLoading]
  );

  const onUpcomingScroll = useCallback(
    (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const viewportHeight = event.nativeEvent.layoutMeasurement.height;
      const contentHeight = event.nativeEvent.contentSize.height;
      const distanceFromBottom = contentHeight - (y + viewportHeight);

      if (y > SCROLL_EDGE_THRESHOLD * 2) {
        canLoadPastFromEdgeRef.current = true;
      }

      if (distanceFromBottom > SCROLL_EDGE_THRESHOLD * 2) {
        canLoadFutureFromEdgeRef.current = true;
      }

      if (
        y <= SCROLL_EDGE_THRESHOLD &&
        canLoadPastFromEdgeRef.current &&
        !isHydratingInitialUpcoming &&
        !isLoadingPast
      ) {
        canLoadPastFromEdgeRef.current = false;
        void loadPastWeek();
      }

      if (
        distanceFromBottom <= SCROLL_EDGE_THRESHOLD &&
        canLoadFutureFromEdgeRef.current &&
        !isHydratingInitialUpcoming &&
        !isLoadingFuture
      ) {
        canLoadFutureFromEdgeRef.current = false;
        void loadFutureWeek();
      }
    },
    [isHydratingInitialUpcoming, isLoadingFuture, isLoadingPast, loadFutureWeek, loadPastWeek]
  );

  const renderWatchlistItem = useCallback(
    ({ item, index }: { item: WatchlistItem; index: number }) => {
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
          <WatchlistCard item={item} isWeb={isWeb} />
        </View>
      );
    },
    [columns, isWeb]
  );

  return (
    <ScreenWrapper>
      <View className="flex-1" onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {gridWidth > 0 ? (
          activeTab === "watchlist" ? (
            <FlashList
              data={visibleWatchlistItems}
              keyExtractor={(item: WatchlistItem) => `${item.mediaType}-${item.id}`}
              renderItem={renderWatchlistItem as any}
              numColumns={columns}
              ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
              onEndReached={loadMoreWatchlist}
              onEndReachedThreshold={0.4}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListHeaderComponent={
                <View className="pb-4">
                  <PageIntro
                    title={headerText.title}
                    subtitle={headerText.subtitle}
                    eyebrow="Today"
                    icon="sparkles-outline"
                    rightLabel={`${watchlistCount} pending`}
                    className="mb-4"
                  />

                  <SegmentedControl
                    className="mb-3"
                    options={[
                      { value: "watchlist", label: "Watchlist" },
                      { value: "upcoming", label: "Upcoming" },
                    ]}
                    value={activeTab}
                    onValueChange={(value: HomeTab) => setActiveTab(value)}
                  />

                  <SegmentedControl
                    options={[
                      { value: "all", label: "All" },
                      { value: "tv", label: "TV" },
                      { value: "anime", label: "Anime" },
                    ]}
                    value={filter}
                    onValueChange={(value: HomeFilter) => setFilter(value)}
                  />

                  {isWatchlistLoading ? (
                    <View className="mt-6 items-center py-10">
                      <ActivityIndicator size="small" color="#ef4444" />
                    </View>
                  ) : null}

                  {!isWatchlistLoading && filteredWatchlist.length === 0 ? (
                    <View className="mt-6 items-center rounded-2xl border border-border-default bg-bg-surface px-6 py-12">
                      <Text className="text-lg font-semibold text-text-primary">Nothing in watch list</Text>
                      <Text className="mt-1 text-center text-sm text-text-secondary">
                        Track shows and they will appear here with unwatched episode counts.
                      </Text>
                    </View>
                  ) : null}
                </View>
              }
              ListFooterComponent={
                !isWatchlistLoading && hasMoreWatchlist ? (
                  <View className="items-center py-4">
                    <ActivityIndicator
                      size="small"
                      color={isLoadingMoreWatchlist ? "#ef4444" : "#52525b"}
                    />
                  </View>
                ) : null
              }
            />
          ) : (
            <>
              <View className="pb-4">
                <PageIntro
                  title={headerText.title}
                  subtitle={headerText.subtitle}
                  eyebrow="Calendar"
                  icon="calendar-outline"
                  rightLabel={`${upcomingCount} episodes`}
                  className="mb-4"
                />

                <SegmentedControl
                  className="mb-3"
                  options={[
                    { value: "watchlist", label: "Watchlist" },
                    { value: "upcoming", label: "Upcoming" },
                  ]}
                  value={activeTab}
                  onValueChange={(value: HomeTab) => setActiveTab(value)}
                />

                <SegmentedControl
                  options={[
                    { value: "all", label: "All" },
                    { value: "tv", label: "TV" },
                    { value: "anime", label: "Anime" },
                  ]}
                  value={filter}
                  onValueChange={(value: HomeFilter) => setFilter(value)}
                />
              </View>

              <ScrollView
                ref={upcomingScrollRef}
                showsVerticalScrollIndicator
                onScroll={onUpcomingScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* Loading state */}
                {isUpcomingLoading ? (
                  <View className="py-10 items-center">
                      <ActivityIndicator size="small" color="#ef4444" />
                      <Text className="mt-2 text-xs text-text-secondary">Loading schedule...</Text>
                    </View>
                  ) : upcomingGroups.length === 0 ? (
                    <View className="items-center rounded-2xl border border-border-default bg-bg-surface px-6 py-12">
                      <Text className="text-lg font-semibold text-text-primary">No upcoming episodes</Text>
                      <Text className="mt-1 text-center text-sm text-text-secondary">
                        Shows with future episodes will appear here.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {isLoadingPast ? (
                        <View className="mb-3 items-center py-2">
                          <ActivityIndicator size="small" color="#ef4444" />
                          <Text className="mt-1 text-xs text-text-secondary">Loading earlier days...</Text>
                        </View>
                      ) : null}

                      <View onLayout={onPastSectionLayout}>
                        {pastUpcomingGroups.map(renderUpcomingGroup)}
                      </View>

                      <View>{currentAndFutureUpcomingGroups.map(renderUpcomingGroup)}</View>

                      {isLoadingFuture ? (
                        <View className="items-center py-2">
                          <ActivityIndicator size="small" color="#ef4444" />
                          <Text className="mt-1 text-xs text-text-secondary">Loading later days...</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </ScrollView>
            </>
          )
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#ef4444" />
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}
