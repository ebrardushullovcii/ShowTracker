import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { Badge } from "@/components/Badge";
import { getAniListMediaById } from "@/lib/api/anilist";
import { getJikanAnime } from "@/lib/api/jikan";
import {
  normalizeAniListMedia,
  normalizeTmdbSeason,
  normalizeTmdbShowDetails,
} from "@/lib/api/normalize";
import { getTmdbSeasonDetails, getTmdbShowDetails } from "@/lib/api/tmdb";
import type {
  NormalizedEpisode,
  NormalizedSeason,
  NormalizedShow,
} from "@/lib/api/types";
import { parseShowRouteId } from "@/lib/show-route";

type SeasonLoadState = Record<number, boolean>;
type SeasonErrorState = Record<number, string | null>;
type EpisodePendingState = Record<string, boolean>;
type SeasonActionState = Record<number, boolean>;

function createSeasonPlaceholders(
  count: number,
  seasonSummaries?: {
    season_number: number;
    name?: string;
    episode_count?: number;
  }[]
) {
  if (seasonSummaries?.length) {
    const normalized = seasonSummaries
      .filter((season) => season.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number)
      .map((season) => ({
        seasonNumber: season.season_number,
        name: season.name ?? `Season ${season.season_number}`,
        episodeCount: season.episode_count,
      })) as NormalizedSeason[];

    if (normalized.length) {
      return normalized;
    }
  }

  return Array.from({ length: count }, (_, index) => ({
    seasonNumber: index + 1,
    name: `Season ${index + 1}`,
  })) as NormalizedSeason[];
}

function createAnimeSeason(totalEpisodes?: number) {
  const episodeCount = Math.max(1, Math.min(totalEpisodes ?? 12, 80));
  return [
    {
      seasonNumber: 1,
      name: "Episodes",
      episodeCount,
      episodes: Array.from({ length: episodeCount }, (_, index) => ({
        id: `anime-episode:${index + 1}`,
        seasonNumber: 1,
        episodeNumber: index + 1,
        name: `Episode ${index + 1}`,
      })),
    },
  ] as NormalizedSeason[];
}

function mediaTypeBadge(mediaType: NormalizedShow["mediaType"]) {
  if (mediaType === "movie") {
    return "Movie";
  }
  if (mediaType === "anime") {
    return "Anime";
  }
  return "TV";
}

function buildShowPayload(show: NormalizedShow) {
  return {
    tmdbId: show.tmdbId,
    anilistId: show.anilistId,
    tvmazeId: show.tvmazeId,
    imdbId: show.imdbId,
    mediaType: show.mediaType,
    title: show.title,
    overview: show.overview,
    posterUrl: show.posterUrl,
    backdropUrl: show.backdropUrl,
    genres: show.genres,
    status: show.status,
    totalEpisodes: show.totalEpisodes,
    totalSeasons: show.totalSeasons,
    episodeRuntime: show.episodeRuntime,
    rating: show.rating,
    firstAired: show.firstAired,
    lastUpdated: Date.now(),
  };
}

function buildTrackingArgs(show: NormalizedShow | null) {
  if (!show) {
    return "skip" as const;
  }

  if (typeof show.tmdbId === "number") {
    return { tmdbId: show.tmdbId };
  }

  if (typeof show.anilistId === "number") {
    return { anilistId: show.anilistId };
  }

  if (typeof show.tvmazeId === "number") {
    return { tvmazeId: show.tvmazeId };
  }

  return "skip" as const;
}

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = useMemo(() => parseShowRouteId(id), [id]);

  const [show, setShow] = useState<NormalizedShow | null>(null);
  const [seasons, setSeasons] = useState<NormalizedSeason[]>([]);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>(
    {}
  );
  const [seasonLoading, setSeasonLoading] = useState<SeasonLoadState>({});
  const [seasonErrors, setSeasonErrors] = useState<SeasonErrorState>({});
  const [watchedEpisodeKeys, setWatchedEpisodeKeys] = useState<Set<string>>(
    new Set()
  );
  const [pendingEpisodeKeys, setPendingEpisodeKeys] =
    useState<EpisodePendingState>({});
  const [seasonActionLoading, setSeasonActionLoading] =
    useState<SeasonActionState>({});
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addToWatchlist = useMutation(api.shows.addToWatchlist);
  const toggleEpisodeWatched = useMutation(api.shows.toggleEpisodeWatched);
  const markSeasonWatched = useMutation(api.shows.markSeasonWatched);

  const trackingArgs = useMemo(() => buildTrackingArgs(show), [show]);
  const tracking = useQuery(api.shows.getUserShowTracking, trackingArgs);
  const canTrackShow = trackingArgs !== "skip";

  useEffect(() => {
    const hasPendingEpisodeUpdates = Object.values(pendingEpisodeKeys).some(Boolean);
    const hasPendingSeasonUpdates = Object.values(seasonActionLoading).some(Boolean);
    if (!tracking || hasPendingEpisodeUpdates || hasPendingSeasonUpdates) {
      return;
    }
    setWatchedEpisodeKeys(new Set(tracking.watchedEpisodeKeys));
  }, [pendingEpisodeKeys, seasonActionLoading, tracking]);

  useEffect(() => {
    if (!parsedId) {
      setError("Invalid show ID.");
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadShow = async () => {
      setIsLoading(true);
      setError(null);
      setTrackingError(null);
      setShow(null);
      setSeasons([]);
      setExpandedSeasons({});
      setSeasonLoading({});
      setSeasonErrors({});
      setWatchedEpisodeKeys(new Set());
      setPendingEpisodeKeys({});
      setSeasonActionLoading({});

      try {
        if (parsedId.source === "tmdb") {
          const details = await getTmdbShowDetails(
            parsedId.mediaType === "movie" ? "movie" : "tv",
            parsedId.externalId
          );

          if (isCancelled) {
            return;
          }

          const normalized = normalizeTmdbShowDetails(
            parsedId.mediaType === "movie" ? "movie" : "tv",
            details
          );
          setShow(normalized);

          if (parsedId.mediaType === "tv") {
            setSeasons(
              createSeasonPlaceholders(normalized.totalSeasons ?? 0, details.seasons)
            );
          }
          return;
        }

        if (parsedId.source === "anilist") {
          const media = await getAniListMediaById(parsedId.externalId);
          if (isCancelled) {
            return;
          }
          if (!media) {
            throw new Error("Anime not found.");
          }
          const normalized = normalizeAniListMedia(media);
          setShow(normalized);
          setSeasons(createAnimeSeason(normalized.totalEpisodes));
          return;
        }

        const jikanShow = await getJikanAnime(parsedId.externalId);
        if (isCancelled) {
          return;
        }
        setShow(jikanShow);
        setSeasons(createAnimeSeason(jikanShow.totalEpisodes));
      } catch (loadError) {
        if (isCancelled) {
          return;
        }
        console.error("Failed to load show detail", loadError);
        setError("Could not load show details right now.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadShow();

    return () => {
      isCancelled = true;
    };
  }, [parsedId]);

  const handleAddToWatchlist = async () => {
    if (!show) {
      return;
    }

    if (!canTrackShow) {
      setTrackingError("This title cannot be tracked yet.");
      return;
    }

    setIsAddingToWatchlist(true);
    setTrackingError(null);
    try {
      await addToWatchlist(buildShowPayload(show));
    } catch (mutationError) {
      console.error("Failed to add show to watchlist", mutationError);
      setTrackingError("Could not add this show to watchlist.");
    } finally {
      setIsAddingToWatchlist(false);
    }
  };

  const handleToggleEpisodeWatched = async (episode: NormalizedEpisode) => {
    if (!show) {
      return;
    }

    if (!canTrackShow) {
      setTrackingError("This title cannot be tracked yet.");
      return;
    }

    const key = `${episode.seasonNumber}:${episode.episodeNumber}`;
    if (pendingEpisodeKeys[key]) {
      return;
    }

    const wasWatched = watchedEpisodeKeys.has(key);
    setWatchedEpisodeKeys((prev) => {
      const next = new Set(prev);
      if (wasWatched) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setPendingEpisodeKeys((prev) => ({ ...prev, [key]: true }));
    setTrackingError(null);

    try {
      await toggleEpisodeWatched({
        show: buildShowPayload(show),
        season: episode.seasonNumber,
        episode: episode.episodeNumber,
        runtime: episode.runtime,
      });
    } catch (mutationError) {
      console.error("Failed to toggle episode", mutationError);
      setWatchedEpisodeKeys((prev) => {
        const next = new Set(prev);
        if (wasWatched) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      setTrackingError("Could not update episode status.");
    } finally {
      setPendingEpisodeKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleMarkSeasonWatched = async (season: NormalizedSeason) => {
    if (!show) {
      return;
    }

    if (!canTrackShow) {
      setTrackingError("This title cannot be tracked yet.");
      return;
    }

    const episodes = season.episodes ?? [];
    if (!episodes.length || seasonActionLoading[season.seasonNumber]) {
      return;
    }

    const previousKeys = new Set(watchedEpisodeKeys);
    setWatchedEpisodeKeys((prev) => {
      const next = new Set(prev);
      for (const episode of episodes) {
        next.add(`${episode.seasonNumber}:${episode.episodeNumber}`);
      }
      return next;
    });

    setSeasonActionLoading((prev) => ({ ...prev, [season.seasonNumber]: true }));
    setTrackingError(null);

    try {
      await markSeasonWatched({
        show: buildShowPayload(show),
        season: season.seasonNumber,
        episodes: episodes.map((episode) => ({
          episode: episode.episodeNumber,
          runtime: episode.runtime,
        })),
      });
    } catch (mutationError) {
      console.error("Failed to mark season watched", mutationError);
      setWatchedEpisodeKeys(previousKeys);
      setTrackingError("Could not mark this season as watched.");
    } finally {
      setSeasonActionLoading((prev) => ({
        ...prev,
        [season.seasonNumber]: false,
      }));
    }
  };

  const toggleSeason = async (seasonNumber: number) => {
    const willExpand = !expandedSeasons[seasonNumber];
    setExpandedSeasons((prev) => ({ ...prev, [seasonNumber]: willExpand }));

    if (!willExpand || !parsedId || parsedId.source !== "tmdb") {
      return;
    }

    if (parsedId.mediaType !== "tv") {
      return;
    }

    const season = seasons.find((entry) => entry.seasonNumber === seasonNumber);
    if (season?.episodes || seasonLoading[seasonNumber]) {
      return;
    }

    setSeasonLoading((prev) => ({ ...prev, [seasonNumber]: true }));
    setSeasonErrors((prev) => ({ ...prev, [seasonNumber]: null }));

    try {
      const seasonDetails = await getTmdbSeasonDetails(
        parsedId.externalId,
        seasonNumber
      );
      const normalizedSeason = normalizeTmdbSeason(seasonDetails);
      setSeasons((prev) =>
        prev.map((entry) =>
          entry.seasonNumber === seasonNumber
            ? {
                ...entry,
                ...normalizedSeason,
                episodeCount:
                  normalizedSeason.episodeCount ??
                  entry.episodeCount ??
                  normalizedSeason.episodes?.length,
              }
            : entry
        )
      );
    } catch (seasonError) {
      console.error("Failed to load season details", seasonError);
      setSeasonErrors((prev) => ({
        ...prev,
        [seasonNumber]: "Could not load episodes for this season.",
      }));
    } finally {
      setSeasonLoading((prev) => ({ ...prev, [seasonNumber]: false }));
    }
  };

  const watchlistLabel =
    tracking?.inWatchlist && tracking.status
      ? `In Watchlist (${tracking.status.replaceAll("_", " ")})`
      : "Add to Watchlist";

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View className="items-center gap-3 py-24">
            <ActivityIndicator size="large" color="#5b7cfa" />
            <Text className="text-sm text-slate-500 dark:text-slate-300">
              Loading show details...
            </Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4">
            <Text className="text-sm text-red-600 dark:text-red-300">{error}</Text>
            {id ? (
              <Text className="mt-2 text-xs text-red-500 dark:text-red-200">
                Route ID: {id}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isLoading && !error && show ? (
          <View className="pb-10">
            <View className="relative mb-6 overflow-hidden rounded-[30px] border border-brand-surface/70 bg-brand-surface/80">
              {show.backdropUrl ? (
                <Image
                  source={{ uri: show.backdropUrl }}
                  className="h-64 w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-64 w-full bg-brand-surface/60" />
              )}
              <View className="absolute inset-0 bg-black/40" />
              <View className="absolute bottom-0 left-0 right-0 p-5">
                <View className="mb-2 flex-row items-center gap-2">
                  <Badge
                    label={mediaTypeBadge(show.mediaType)}
                    className="border-white/60 bg-white/90"
                    textClassName="text-black"
                  />
                  {show.firstAired ? (
                    <Text className="text-xs uppercase tracking-[1.2px] text-white/80">
                      {show.firstAired}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-3xl font-black tracking-tight text-white">
                  {show.title}
                </Text>
              </View>
            </View>

            <View className="mb-5 flex-row gap-4">
              <View className="h-44 w-32 overflow-hidden rounded-2xl border border-brand-surface/60 bg-brand-surface">
                {show.posterUrl ? (
                  <Image
                    source={{ uri: show.posterUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center px-3">
                    <Text className="text-center text-xs text-brand-text">
                      No poster
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1 gap-2">
                <Text className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {show.overview ?? "No overview available yet."}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {show.rating ? (
                    <Badge label={`Rating ${show.rating.toFixed(1)}`} />
                  ) : null}
                  {show.totalSeasons ? (
                    <Badge label={`${show.totalSeasons} seasons`} />
                  ) : null}
                  {show.totalEpisodes ? (
                    <Badge label={`${show.totalEpisodes} episodes`} />
                  ) : null}
                </View>
                <Pressable
                  onPress={() => {
                    void handleAddToWatchlist();
                  }}
                  disabled={
                    !canTrackShow ||
                    isAddingToWatchlist ||
                    Boolean(tracking?.inWatchlist)
                  }
                  className={`mt-2 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${
                    tracking?.inWatchlist
                      ? "border-emerald-500/50 bg-emerald-500/15"
                      : "border-brand-primary/60 bg-brand-primary/15"
                  } ${
                    !canTrackShow || isAddingToWatchlist ? "opacity-70" : ""
                  }`}
                >
                  {isAddingToWatchlist ? (
                    <ActivityIndicator size="small" color="#5b7cfa" />
                  ) : null}
                  <Text className="text-sm font-semibold text-brand-light-text dark:text-brand-text">
                    {isAddingToWatchlist ? "Adding..." : watchlistLabel}
                  </Text>
                </Pressable>
                {tracking?.inWatchlist ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-300">
                    Added to your list without marking episodes watched.
                  </Text>
                ) : null}
                {trackingError ? (
                  <Text className="text-xs text-red-600 dark:text-red-300">
                    {trackingError}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-2xl font-black tracking-tight text-brand-light-text dark:text-brand-text">
                Seasons & Episodes
              </Text>
              {!seasons.length ? (
                <View className="rounded-2xl border border-brand-surface/50 bg-brand-surface/35 p-4">
                  <Text className="text-sm text-slate-500 dark:text-slate-300">
                    No episode list for this title.
                  </Text>
                </View>
              ) : null}

              {seasons.map((season) => {
                const expanded = !!expandedSeasons[season.seasonNumber];
                const seasonKey = `season-${season.seasonNumber}`;
                const isSeasonLoading = !!seasonLoading[season.seasonNumber];
                const seasonError = seasonErrors[season.seasonNumber];
                const episodes = season.episodes ?? [];
                const isMarkingSeason = !!seasonActionLoading[season.seasonNumber];

                return (
                  <View
                    key={seasonKey}
                    className="overflow-hidden rounded-2xl border border-brand-surface/55 bg-brand-light-surface dark:bg-brand-surface/55"
                  >
                    <Pressable
                      className="flex-row items-center justify-between px-4 py-4"
                      onPress={() => {
                        void toggleSeason(season.seasonNumber);
                      }}
                    >
                      <View>
                        <Text className="text-base font-semibold text-brand-light-text dark:text-brand-text">
                          {season.name ?? `Season ${season.seasonNumber}`}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400">
                          {season.episodeCount ?? episodes.length} episodes
                        </Text>
                      </View>
                      <Text className="text-lg text-brand-primary">
                        {expanded ? "−" : "+"}
                      </Text>
                    </Pressable>

                    {expanded ? (
                      <View className="border-t border-brand-surface/50 px-4 py-3">
                        {isSeasonLoading ? (
                          <View className="flex-row items-center gap-2 py-2">
                            <ActivityIndicator size="small" color="#5b7cfa" />
                            <Text className="text-sm text-slate-500 dark:text-slate-300">
                              Loading episodes...
                            </Text>
                          </View>
                        ) : null}
                        {seasonError ? (
                          <Text className="text-sm text-red-600 dark:text-red-300">
                            {seasonError}
                          </Text>
                        ) : null}
                        {!isSeasonLoading && !seasonError && !episodes.length ? (
                          <Text className="text-sm text-slate-500 dark:text-slate-300">
                            Episode list not available.
                          </Text>
                        ) : null}

                        {!isSeasonLoading && !seasonError && episodes.length ? (
                          <Pressable
                            className="mb-3 flex-row items-center justify-center gap-2 rounded-xl border border-brand-primary/55 bg-brand-primary/10 px-3 py-2"
                            onPress={() => {
                              void handleMarkSeasonWatched(season);
                            }}
                            disabled={isMarkingSeason}
                          >
                            {isMarkingSeason ? (
                              <ActivityIndicator size="small" color="#5b7cfa" />
                            ) : (
                              <Text className="text-sm font-bold text-brand-primary">✓</Text>
                            )}
                            <Text className="text-sm font-semibold text-brand-light-text dark:text-brand-text">
                              {isMarkingSeason
                                ? "Updating season..."
                                : "Mark Season Watched"}
                            </Text>
                          </Pressable>
                        ) : null}

                        <View className="gap-2">
                          {episodes.map((episode) => {
                            const key = `${episode.seasonNumber}:${episode.episodeNumber}`;
                            const watched = watchedEpisodeKeys.has(key);
                            const isUpdatingEpisode = !!pendingEpisodeKeys[key];

                            return (
                              <Pressable
                                key={episode.id}
                                onPress={() => {
                                  void handleToggleEpisodeWatched(episode);
                                }}
                                disabled={isUpdatingEpisode}
                                className={`rounded-xl border px-3 py-3 ${
                                  watched
                                    ? "border-emerald-400/60 bg-emerald-500/10"
                                    : "border-brand-surface/60 bg-brand-light-background dark:bg-brand-background/50"
                                } ${isUpdatingEpisode ? "opacity-80" : ""}`}
                              >
                                <View className="flex-row items-start justify-between gap-3">
                                  <View className="flex-1">
                                    <Text className="text-xs uppercase tracking-[1.2px] text-slate-500 dark:text-slate-400">
                                      S{String(episode.seasonNumber).padStart(2, "0")}
                                      E{String(episode.episodeNumber).padStart(2, "0")}
                                    </Text>
                                    <Text
                                      className="mt-1 text-sm font-semibold text-brand-light-text dark:text-brand-text"
                                      numberOfLines={1}
                                    >
                                      {episode.name ?? "Untitled episode"}
                                    </Text>
                                    {episode.overview ? (
                                      <Text
                                        className="mt-1 text-xs text-slate-600 dark:text-slate-300"
                                        numberOfLines={2}
                                      >
                                        {episode.overview}
                                      </Text>
                                    ) : null}
                                  </View>
                                  <View
                                    className={`h-6 w-6 items-center justify-center rounded-full border ${
                                      watched
                                        ? "border-emerald-400 bg-emerald-500"
                                        : "border-slate-400/70"
                                    }`}
                                  >
                                    {isUpdatingEpisode ? (
                                      <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                      <Text
                                        className={`text-xs font-bold ${
                                          watched ? "text-white" : "text-transparent"
                                        }`}
                                      >
                                        ✓
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
