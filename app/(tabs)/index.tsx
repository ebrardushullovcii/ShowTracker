import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScreenWrapper } from "@/components/ScreenWrapper";

type HomeTab = "shows" | "movies";

type DashboardItem = {
  id: string;
  title: string;
  mediaType: "tv" | "anime" | "movie";
  status: "watching" | "paused" | "dropped" | "completed" | "plan_to_watch";
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  firstAired: string | null;
  tmdbId: number | null;
  anilistId: number | null;
  tvmazeId: number | null;
  imdbId: string | null;
  watchedEpisodes: number;
  totalEpisodes: number | null;
  remainingEpisodes: number | null;
  progressPercent: number | null;
  lastActivityAt: number;
};

function getRouteId(item: DashboardItem) {
  if (typeof item.tmdbId === "number") {
    if (item.mediaType === "tv" || item.mediaType === "movie") {
      return `tmdb:${item.mediaType}:${item.tmdbId}`;
    }
  }

  if (typeof item.anilistId === "number" && item.mediaType === "anime") {
    return `anilist:anime:${item.anilistId}`;
  }

  return null;
}

function formatStatus(status: DashboardItem["status"]) {
  if (status === "plan_to_watch") {
    return "Plan to Watch";
  }
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

function formatActivity(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "recently";
  }
}

function SegmentTabs({
  value,
  onChange,
}: {
  value: HomeTab;
  onChange: (next: HomeTab) => void;
}) {
  return (
    <View className="mb-4 flex-row rounded-2xl border-2 border-brand-surface/70 bg-brand-light-surface p-1 dark:bg-brand-surface/75">
      {([
        { key: "shows", label: "Shows" },
        { key: "movies", label: "Movies" },
      ] as const).map((tab) => {
        const active = value === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className={`flex-1 items-center rounded-xl px-3 py-2 ${
              active ? "bg-brand-primary" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-xs font-bold uppercase tracking-[1.3px] ${
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

function DashboardCard({ item }: { item: DashboardItem }) {
  const routeId = getRouteId(item);
  const isMovie = item.mediaType === "movie";

  const content = (
    <View className="mb-3 flex-row gap-3 rounded-2xl border-2 border-brand-surface/70 bg-brand-light-surface px-3 py-3 dark:bg-brand-surface/75">
      <View className="h-24 w-16 overflow-hidden rounded-xl border border-brand-surface/60 bg-brand-surface/20">
        {item.posterUrl ? (
          <Image
            source={{ uri: item.posterUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center px-2">
            <Text className="text-center text-[11px] font-semibold uppercase tracking-[1px] text-[#5d4b33] dark:text-[#ebdabc]">
              No Art
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 justify-between">
        <View>
          <Text
            className="font-serif text-lg font-semibold leading-5 text-brand-light-text dark:text-brand-text"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text className="mt-1 text-[11px] uppercase tracking-[1.2px] text-[#5d4b33] dark:text-[#ebdabc]">
            {item.mediaType === "anime"
              ? "Anime"
              : item.mediaType === "tv"
                ? "TV"
                : "Movie"}{" "}
            · {formatStatus(item.status)}
          </Text>
        </View>

        <View className="mt-2 gap-1">
          {isMovie ? (
            <Text className="text-xs font-semibold text-brand-light-text dark:text-brand-text">
              {item.status === "plan_to_watch"
                ? "Queued for movie night"
                : "Movie in progress"}
            </Text>
          ) : (
            <>
              <Text className="text-xs font-semibold text-brand-light-text dark:text-brand-text">
                {item.remainingEpisodes === null
                  ? `${item.watchedEpisodes} watched`
                  : `${item.remainingEpisodes} episodes left`}
              </Text>
              {typeof item.progressPercent === "number" ? (
                <View className="h-1.5 overflow-hidden rounded-full bg-brand-surface/50">
                  <View
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </View>
              ) : null}
            </>
          )}
          <Text className="text-[11px] uppercase tracking-[1.1px] text-[#5d4b33] dark:text-[#ebdabc]">
            Active {formatActivity(item.lastActivityAt)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!routeId) {
    return (
      <View className="opacity-80">
        {content}
        <Text className="mb-3 -mt-1 text-[11px] uppercase tracking-[1.2px] text-amber-700 dark:text-amber-300">
          Detail page unavailable for this source.
        </Text>
      </View>
    );
  }

  return (
    <Link
      href={{ pathname: "/show/[id]", params: { id: routeId } }}
      asChild
    >
      <Pressable>{content}</Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<HomeTab>("shows");
  const dashboard = useQuery(api.shows.getHomeDashboard, {});

  const activeItems = useMemo(() => {
    if (!dashboard) {
      return [] as DashboardItem[];
    }
    return (activeTab === "shows" ? dashboard.shows : dashboard.movies) as DashboardItem[];
  }, [activeTab, dashboard]);

  const isLoading = dashboard === undefined;

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-10">
          <View className="mb-5 rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-4 dark:bg-brand-surface/80">
            <Text className="font-serif text-3xl font-bold leading-9 text-brand-light-text dark:text-brand-text">
              Home
            </Text>
            <Text className="mt-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
              Active queue
            </Text>
          </View>

          <SegmentTabs value={activeTab} onChange={setActiveTab} />

          {isLoading ? (
            <View className="items-center gap-2 rounded-2xl border-2 border-brand-surface/60 bg-brand-light-surface/80 py-8 dark:bg-brand-surface/70">
              <ActivityIndicator size="small" color="#cf5d3f" />
              <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-[#5d4b33] dark:text-[#ebdabc]">
                Loading your dashboard
              </Text>
            </View>
          ) : null}

          {!isLoading && !activeItems.length ? (
            <View className="rounded-2xl border-2 border-brand-surface/60 bg-brand-light-surface px-4 py-5 dark:bg-brand-surface/70">
              <Text className="font-serif text-lg font-semibold text-brand-light-text dark:text-brand-text">
                {activeTab === "shows"
                  ? "No active shows yet"
                  : "No queued movies yet"}
              </Text>
              <Text className="mt-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
                {activeTab === "shows"
                  ? "Start tracking episodes from any show detail page and they will appear here."
                  : "Add movies to your watchlist and they will appear here as your queue."}
              </Text>
            </View>
          ) : null}

          {!isLoading && activeItems.length ? (
            <View>
              {activeItems.map((item) => (
                <DashboardCard key={item.id} item={item} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
