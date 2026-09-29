import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

type MaterializedUserStats = {
  uniqueEpisodesWatched: number;
  totalRewatches: number;
  totalEpisodesWatched: number;
  tvEpisodes: number;
  animeEpisodes: number;
  movieCount: number;
  totalWatchTimeMinutes: number;
  tvWatchTimeMinutes: number;
  animeWatchTimeMinutes: number;
  movieWatchTimeMinutes: number;
  currentStreak: number;
  longestStreak: number;
  completedShows: number;
  totalTrackedShows: number;
  topRewatchedShows: Array<{ title: string; watchCount: number }>;
};

async function getCurrentUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId as Id<"users">;
}

function getUserShowHistoryTotals(userShow: Doc<"userShows">) {
  const progressEpisodes = Math.max(
    0,
    Math.floor(userShow.watchedEpisodesCount ?? 0),
  );
  const uniqueEpisodes = Math.max(
    progressEpisodes,
    Math.floor(userShow.watchedHistoryEpisodesCount ?? progressEpisodes),
  );
  const progressTotal = Math.max(
    progressEpisodes,
    Math.floor(userShow.watchedTotalCount ?? progressEpisodes),
  );
  const totalWatches = Math.max(
    uniqueEpisodes,
    progressTotal,
    Math.floor(userShow.watchedHistoryTotalCount ?? progressTotal),
  );

  return {
    uniqueEpisodes,
    totalWatches,
    runtimeMinutes:
      typeof userShow.watchedHistoryRuntimeMinutes === "number"
        ? Math.max(0, Math.floor(userShow.watchedHistoryRuntimeMinutes))
        : typeof userShow.watchedRuntimeMinutes === "number"
          ? Math.max(0, Math.floor(userShow.watchedRuntimeMinutes))
          : null,
  };
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0min";

  const breakdown = formatDurationBreakdown(minutes);

  if (breakdown.months > 0) {
    return `${breakdown.months}mo ${breakdown.days}d ${breakdown.hours}h`;
  }

  if (breakdown.days > 0) {
    return `${breakdown.days}d ${breakdown.hours}h ${breakdown.minutes}min`;
  }

  if (breakdown.hours > 0) {
    return `${breakdown.hours}h ${breakdown.minutes}min`;
  }

  return `${breakdown.minutes}min`;
}

function formatDurationBreakdown(minutes: number): {
  months: number;
  days: number;
  hours: number;
  minutes: number;
} {
  const monthMinutes = 30.44 * 24 * 60;
  let rem = minutes;

  let months = Math.floor(rem / monthMinutes);
  rem -= months * monthMinutes;

  let days = Math.floor(rem / (24 * 60));
  rem -= days * 24 * 60;

  let hours = Math.floor(rem / 60);
  let mins = Math.round(rem - hours * 60);

  if (mins === 60) {
    mins = 0;
    hours += 1;
  }

  if (hours === 24) {
    hours = 0;
    days += 1;
  }

  if (days >= 30) {
    months += Math.floor(days / 30);
    days %= 30;
  }

  return { months, days, hours, minutes: mins };
}

function prettifyHandle(raw: string): string {
  const normalized = raw
    .trim()
    .replace(/^@+/, "")
    .replace(/[|]+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  return normalized
    .split(" ")
    .slice(0, 3)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractCandidateFromTokenIdentifier(tokenIdentifier?: string): string {
  if (!tokenIdentifier) return "";
  const trimmed = tokenIdentifier.trim();
  if (!trimmed) return "";
  let lastSegment = trimmed;
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|");
    lastSegment = parts[parts.length - 1] ?? "";
  }
  if (!lastSegment) return "";
  if (lastSegment.includes("@")) {
    return lastSegment.split("@")[0] ?? "";
  }
  return lastSegment;
}

function resolveDisplayName(args: {
  profileUsername?: string;
  profileTokenIdentifier?: string;
}): string {
  const explicitProfileName = args.profileUsername?.trim() ?? "";
  if (explicitProfileName) return explicitProfileName;

  const tokenCandidate = extractCandidateFromTokenIdentifier(
    args.profileTokenIdentifier,
  );
  if (tokenCandidate) return prettifyHandle(tokenCandidate);

  return "ShowTracker User";
}

function calculateStreak(watchedDates: number[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (watchedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique dates (only count one watch per day for streaks)
  const uniqueDates = Array.from(
    new Set(
      watchedDates.map((timestamp) => {
        const date = new Date(timestamp);
        return new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        ).getTime();
      }),
    ),
  ).sort((a, b) => a - b);

  let currentStreak = 0;
  let longestStreak = 0;
  let currentCount = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  // Check if today has activity
  const hasActivityToday = uniqueDates.includes(todayTime);

  // Calculate current streak
  if (hasActivityToday) {
    currentStreak = 1;
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1);

    while (uniqueDates.includes(checkDate.getTime())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else {
    // Check if yesterday had activity (streak could still be active)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (uniqueDates.includes(yesterday.getTime())) {
      currentStreak = 1;
      let checkDate = new Date(yesterday);
      checkDate.setDate(checkDate.getDate() - 1);

      while (uniqueDates.includes(checkDate.getTime())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
  }

  // Calculate longest streak
  for (let i = 0; i < uniqueDates.length; i++) {
    if (i === 0) {
      currentCount = 1;
    } else {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentCount++;
      } else {
        longestStreak = Math.max(longestStreak, currentCount);
        currentCount = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, currentCount);

  return { currentStreak, longestStreak };
}

function formatStatsResponse(
  stats: MaterializedUserStats,
  profile: {
    followingCount: number;
    followersCount: number;
    commentsCount: number;
    username: string;
    bio: string;
    avatarUrl?: string;
    bannerUrl?: string;
  },
) {
  return {
    uniqueEpisodesWatched: stats.uniqueEpisodesWatched,
    totalRewatches: stats.totalRewatches,
    totalEpisodesWatched: stats.totalEpisodesWatched,
    tvEpisodes: stats.tvEpisodes,
    animeEpisodes: stats.animeEpisodes,
    movieCount: stats.movieCount,
    totalWatchTimeMinutes: stats.totalWatchTimeMinutes,
    totalWatchTimeFormatted: formatDuration(stats.totalWatchTimeMinutes),
    totalWatchTimeBreakdown: formatDurationBreakdown(stats.totalWatchTimeMinutes),
    tvWatchTimeMinutes: stats.tvWatchTimeMinutes,
    tvWatchTimeFormatted: formatDuration(stats.tvWatchTimeMinutes),
    tvWatchTimeBreakdown: formatDurationBreakdown(stats.tvWatchTimeMinutes),
    animeWatchTimeMinutes: stats.animeWatchTimeMinutes,
    animeWatchTimeFormatted: formatDuration(stats.animeWatchTimeMinutes),
    animeWatchTimeBreakdown: formatDurationBreakdown(stats.animeWatchTimeMinutes),
    movieWatchTimeMinutes: stats.movieWatchTimeMinutes,
    movieWatchTimeFormatted: formatDuration(stats.movieWatchTimeMinutes),
    movieWatchTimeBreakdown: formatDurationBreakdown(stats.movieWatchTimeMinutes),
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    completedShows: stats.completedShows,
    totalTrackedShows: stats.totalTrackedShows,
    topRewatchedShows: stats.topRewatchedShows,
    followingCount: profile.followingCount,
    followersCount: profile.followersCount,
    commentsCount: profile.commentsCount,
    username: profile.username,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
  };
}

// Stats are never computed on the request path (ADR-0068). The profile reads the cached
// `userStats` row, tracking changes mark it stale, and a background action rebuilds it in pages
// small enough to stay far under per-function read and time limits on large libraries.
const STATS_SHOW_PAGE_SIZE = 100;
const STATS_TIMESTAMP_PAGE_SIZE = 1000;
// Streaks look at the most recent watched-episode rows only.
const STATS_STREAK_ROW_LIMIT = 10000;
// A scheduled rebuild that has not written after this long is treated as lost.
const STATS_REBUILD_PENDING_MS = 10 * 60 * 1000;

type StatsShowRow = {
  showId: string;
  title: string;
  mediaType: Doc<"shows">["mediaType"] | null;
  episodeRuntime: number;
  status: Doc<"userShows">["status"];
  uniqueEpisodes: number;
  totalWatches: number;
  runtimeMinutes: number | null;
};

type StatsPage<T> = { items: T[]; rowCount: number; continueCursor: string; isDone: boolean };

const materializedStatsValidator = v.object({
  uniqueEpisodesWatched: v.number(),
  totalRewatches: v.number(),
  totalEpisodesWatched: v.number(),
  tvEpisodes: v.number(),
  animeEpisodes: v.number(),
  movieCount: v.number(),
  totalWatchTimeMinutes: v.number(),
  tvWatchTimeMinutes: v.number(),
  animeWatchTimeMinutes: v.number(),
  movieWatchTimeMinutes: v.number(),
  currentStreak: v.number(),
  longestStreak: v.number(),
  completedShows: v.number(),
  totalTrackedShows: v.number(),
  topRewatchedShows: v.array(v.object({ title: v.string(), watchCount: v.number() })),
});

function buildMaterializedStats(
  rows: StatsShowRow[],
  watchedTimestamps: number[],
): MaterializedUserStats {
  let uniqueEpisodesWatched = 0;
  let totalRewatches = 0;
  let tvEpisodes = 0;
  let tvWatchTimeMinutes = 0;
  let animeEpisodes = 0;
  let animeWatchTimeMinutes = 0;
  let movieCount = 0;
  let movieWatchTimeMinutes = 0;
  const rewatchesByShow = new Map<string, { title: string; count: number }>();

  for (const row of rows) {
    if (!row.mediaType) {
      continue;
    }

    const rewatchCount = Math.max(row.totalWatches - row.uniqueEpisodes, 0);
    const watchedRuntimeMinutes = Math.max(
      0,
      Math.floor(
        row.runtimeMinutes !== null ? row.runtimeMinutes : row.episodeRuntime * row.totalWatches,
      ),
    );

    uniqueEpisodesWatched += row.uniqueEpisodes;
    totalRewatches += rewatchCount;
    if (rewatchCount > 0) {
      rewatchesByShow.set(row.showId, { title: row.title, count: rewatchCount });
    }

    if (row.mediaType === "tv") {
      tvEpisodes += row.totalWatches;
      tvWatchTimeMinutes += watchedRuntimeMinutes;
    } else if (row.mediaType === "anime") {
      animeEpisodes += row.totalWatches;
      animeWatchTimeMinutes += watchedRuntimeMinutes;
    } else if (row.mediaType === "movie") {
      if (row.status === "completed") {
        movieCount += 1;
      }
      movieWatchTimeMinutes += watchedRuntimeMinutes;
    }
  }

  const { currentStreak, longestStreak } = calculateStreak(watchedTimestamps);
  const topRewatchedShows = Array.from(rewatchesByShow.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((entry) => ({ title: entry.title, watchCount: entry.count }));

  return {
    uniqueEpisodesWatched,
    totalRewatches,
    totalEpisodesWatched: uniqueEpisodesWatched + totalRewatches,
    tvEpisodes,
    animeEpisodes,
    movieCount,
    totalWatchTimeMinutes: tvWatchTimeMinutes + animeWatchTimeMinutes + movieWatchTimeMinutes,
    tvWatchTimeMinutes,
    animeWatchTimeMinutes,
    movieWatchTimeMinutes,
    currentStreak,
    longestStreak,
    completedShows: rows.filter((row) => row.status === "completed").length,
    totalTrackedShows: rows.length,
    topRewatchedShows,
  };
}

async function scheduleUserStatsRebuild(
  ctx: MutationCtx,
  userId: Id<"users">,
  { force }: { force: boolean },
) {
  const existing = await ctx.db
    .query("userStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const now = Date.now();

  if (existing && !force) {
    const isStale = typeof existing.staleAt === "number";
    const isPending =
      typeof existing.rebuildScheduledAt === "number" &&
      existing.rebuildScheduledAt > existing.rebuiltAt &&
      now - existing.rebuildScheduledAt < STATS_REBUILD_PENDING_MS;
    if (!isStale || isPending) {
      return { scheduled: false };
    }
  }

  if (existing) {
    await ctx.db.patch(existing._id, { rebuildScheduledAt: now });
  }
  await ctx.scheduler.runAfter(0, internal.stats.rebuildUserStatsInBackground, { userId });
  return { scheduled: true };
}

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const cachedStats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // No stats yet: the profile asks for a background rebuild and shows a loader until it lands.
    if (!cachedStats) {
      return null;
    }

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const userSocial = await ctx.db
      .query("userSocial")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const displayName = resolveDisplayName({
      profileUsername: userProfile?.username,
      profileTokenIdentifier: userProfile?.tokenIdentifier,
    });

    return {
      ...formatStatsResponse(cachedStats, {
        followingCount: userSocial?.followingCount ?? 0,
        followersCount: userSocial?.followersCount ?? 0,
        commentsCount: userSocial?.commentsCount ?? 0,
        username: displayName,
        bio: userProfile?.bio ?? "",
        avatarUrl: userProfile?.avatarUrl,
        bannerUrl: userProfile?.bannerUrl,
      }),
      statsRebuiltAt: cachedStats.rebuiltAt,
      statsStale: typeof cachedStats.staleAt === "number",
      statsSource: "cached" as const,
    };
  },
});

/** Called by the profile when its stats are missing or stale. Skips if a rebuild is already running. */
export const requestUserStatsRebuild = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    return await scheduleUserStatsRebuild(ctx, userId, { force: false });
  },
});

/** Explicit refresh from Settings and after imports. Always schedules a rebuild. */
export const rebuildUserStats = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    return await scheduleUserStatsRebuild(ctx, userId, { force: true });
  },
});

export const getStatsShowPage = internalQuery({
  args: { userId: v.id("users"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { userId, cursor }): Promise<StatsPage<StatsShowRow>> => {
    const page = await ctx.db
      .query("userShows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .paginate({ cursor, numItems: STATS_SHOW_PAGE_SIZE });
    const shows = await Promise.all(page.page.map((userShow) => ctx.db.get(userShow.showId)));

    const items = page.page.map((userShow, index): StatsShowRow => {
      const show = shows[index];
      const history = getUserShowHistoryTotals(userShow);
      return {
        showId: userShow.showId,
        title: show?.title ?? "Unknown",
        mediaType: show?.mediaType ?? null,
        episodeRuntime: Math.max(0, show?.episodeRuntime ?? 0),
        status: userShow.status,
        uniqueEpisodes: history.uniqueEpisodes,
        totalWatches: history.totalWatches,
        runtimeMinutes: history.runtimeMinutes,
      };
    });

    return { items, rowCount: page.page.length, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});

export const getStatsTimestampPage = internalQuery({
  args: { userId: v.id("users"), cursor: v.union(v.string(), v.null()), numItems: v.number() },
  handler: async (ctx, { userId, cursor, numItems }): Promise<StatsPage<number>> => {
    const page = await ctx.db
      .query("watchedEpisodes")
      .withIndex("by_watchedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ cursor, numItems });

    const items: number[] = [];
    for (const episode of page.page) {
      items.push(episode.watchedAt);
      if (episode.watchHistory) {
        items.push(...episode.watchHistory);
      }
    }

    return { items, rowCount: page.page.length, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});

export const writeUserStats = internalMutation({
  args: { userId: v.id("users"), startedAt: v.number(), stats: materializedStatsValidator },
  returns: v.null(),
  handler: async (ctx, { userId, startedAt, stats }) => {
    const existing = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const rebuiltAt = Date.now();

    if (!existing) {
      await ctx.db.insert("userStats", { ...stats, userId, rebuiltAt });
      return null;
    }

    // A tracking change that landed after this rebuild started reading keeps the row stale,
    // so the profile asks for one more rebuild.
    const changedDuringRebuild =
      typeof existing.staleAt === "number" && existing.staleAt > startedAt;
    await ctx.db.patch(existing._id, {
      ...stats,
      rebuiltAt,
      staleAt: changedDuringRebuild ? existing.staleAt : undefined,
      rebuildScheduledAt: undefined,
    });
    return null;
  },
});

export const rebuildUserStatsInBackground = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }): Promise<null> => {
    const startedAt = Date.now();

    const rows: StatsShowRow[] = [];
    let showCursor: string | null = null;
    for (;;) {
      const page: StatsPage<StatsShowRow> = await ctx.runQuery(internal.stats.getStatsShowPage, {
        userId,
        cursor: showCursor,
      });
      rows.push(...page.items);
      if (page.isDone) break;
      showCursor = page.continueCursor;
    }

    const watchedTimestamps: number[] = [];
    let timestampCursor: string | null = null;
    let episodeRowsRead = 0;
    while (episodeRowsRead < STATS_STREAK_ROW_LIMIT) {
      const page: StatsPage<number> = await ctx.runQuery(internal.stats.getStatsTimestampPage, {
        userId,
        cursor: timestampCursor,
        numItems: Math.min(STATS_TIMESTAMP_PAGE_SIZE, STATS_STREAK_ROW_LIMIT - episodeRowsRead),
      });
      watchedTimestamps.push(...page.items);
      episodeRowsRead += page.rowCount;
      if (page.isDone) break;
      timestampCursor = page.continueCursor;
    }

    await ctx.runMutation(internal.stats.writeUserStats, {
      userId,
      startedAt,
      stats: buildMaterializedStats(rows, watchedTimestamps),
    });
    return null;
  },
});

export const getUserProfileSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const typedUserId = userId as Id<"users">;

    const userShows = await ctx.db
      .query("userShows")
      .withIndex("by_user", (q) => q.eq("userId", typedUserId))
      .collect();

    let totalEpisodesWatched = 0;
    let completedShows = 0;

    for (const userShow of userShows) {
      const history = getUserShowHistoryTotals(userShow);
      const watchedTotalCount = history.totalWatches;

      totalEpisodesWatched += watchedTotalCount;
      if (userShow.status === "completed") {
        completedShows += 1;
      }
    }

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", typedUserId))
      .first();

    const displayName = resolveDisplayName({
      profileUsername: userProfile?.username,
      profileTokenIdentifier: userProfile?.tokenIdentifier,
    });

    return {
      username: displayName,
      bio: userProfile?.bio ?? "",
      avatarUrl: userProfile?.avatarUrl,
      bannerUrl: userProfile?.bannerUrl,
      completedShows,
      totalTrackedShows: userShows.length,
      totalEpisodesWatched,
      currentStreak: 0,
      longestStreak: 0,
    };
  },
});

export const upsertUserProfile = mutation({
  args: {
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const username = (args.username ?? "").trim().slice(0, 32);
    const bio = (args.bio ?? "").trim().slice(0, 280);
    const avatarUrl = (args.avatarUrl ?? "").trim().slice(0, 500);
    const bannerUrl = (args.bannerUrl ?? "").trim().slice(0, 500);
    const tokenIdentifier = existingProfile?.tokenIdentifier;
    const createdAt = existingProfile?.createdAt ?? Date.now();

    const nextData = {
      username,
      bio,
      avatarUrl,
      bannerUrl,
      createdAt,
      ...(tokenIdentifier ? { tokenIdentifier } : {}),
    };

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, nextData);
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        ...nextData,
      });
    }

    return {
      username,
      bio,
      avatarUrl,
      bannerUrl,
    };
  },
});

export const getUserFavorites = query({
  args: {
    mediaType: v.optional(
      v.union(v.literal("tv"), v.literal("anime"), v.literal("movie")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const limit = args.limit ?? 20;

    let favorites;
    const mediaTypeFilter = args.mediaType;
    if (mediaTypeFilter) {
      favorites = await ctx.db
        .query("userFavorites")
        .withIndex("by_user_mediaType", (q) =>
          q.eq("userId", userId).eq("mediaType", mediaTypeFilter),
        )
        .order("desc")
        .take(limit);
    } else {
      favorites = await ctx.db
        .query("userFavorites")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    }

    const shows = await Promise.all(
      favorites.map(async (fav) => {
        const show = await ctx.db.get(fav.showId);
        return {
          id: fav.showId,
          title: show?.title ?? "Unknown",
          posterUrl: show?.posterUrl,
          backdropUrl: show?.backdropUrl,
          mediaType: show?.mediaType ?? fav.mediaType,
          tmdbId: show?.tmdbId ?? null,
          anilistId: show?.anilistId ?? null,
          malId: show?.malId ?? null,
        };
      }),
    );

    return shows;
  },
});

export const getWatchHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const limit = args.limit ?? 50;

    const watchedEpisodes = await ctx.db
      .query("watchedEpisodes")
      .withIndex("by_watchedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    const history = await Promise.all(
      watchedEpisodes.map(async (entry) => {
        const show = await ctx.db.get(entry.showId);
        return {
          id: entry._id,
          showTitle: show?.title ?? "Unknown",
          mediaType: show?.mediaType ?? "tv",
          season: entry.season,
          episode: entry.episode,
          watchedAt: entry.watchedAt,
          watchCount: entry.watchCount ?? 1,
          watchHistory: entry.watchHistory ?? [entry.watchedAt],
        };
      }),
    );

    return history;
  },
});
