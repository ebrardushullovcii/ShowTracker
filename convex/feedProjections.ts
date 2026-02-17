import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function buildProjectionFields(
  userShow: Doc<"userShows">,
  show: Doc<"shows">
) {
  const watchedCount = Math.max(0, Math.floor(userShow.watchedEpisodesCount ?? 0));
  const totalEpisodes =
    typeof show.totalEpisodes === "number" ? show.totalEpisodes : undefined;
  const remaining =
    typeof totalEpisodes === "number"
      ? Math.max(totalEpisodes - watchedCount, 0)
      : undefined;

  return {
    userId: userShow.userId,
    showId: userShow.showId,
    userShowId: userShow._id,

    // Show metadata
    title: show.title,
    mediaType: show.mediaType,
    posterUrl: show.posterUrl,
    backdropUrl: show.backdropUrl,
    tmdbId: show.tmdbId,
    anilistId: show.anilistId,
    malId: show.malId,
    tvmazeId: show.tvmazeId,
    imdbId: show.imdbId,
    firstAired: show.firstAired,
    anilistFormat: show.anilistFormat,
    animeSeason: show.animeSeason,
    animeSeasonYear: show.animeSeasonYear,
    totalEpisodes,

    // Tracking state
    status: userShow.status,
    isAutoTracked: userShow.isAutoTracked,
    relationRootAnilistId:
      userShow.relationRootAnilistId ?? show.rootAnilistId ?? show.anilistId,
    watchedEpisodesCount: watchedCount,
    remainingEpisodes: remaining,
    lastWatchedAt: userShow.lastWatchedAt ?? userShow.addedAt,

    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────
// Single-show upsert — called after any mutation that changes
// one userShow or its associated show document.
// ────────────────────────────────────────────────────────────

export async function upsertFeedProjection(
  ctx: MutationCtx,
  userShowId: Id<"userShows">
) {
  const userShow = await ctx.db.get(userShowId);
  if (!userShow) return;

  const show = await ctx.db.get(userShow.showId);
  if (!show) return;

  const existing = await ctx.db
    .query("feedProjections")
    .withIndex("by_userShow", (q) => q.eq("userShowId", userShowId))
    .unique();

  const fields = buildProjectionFields(userShow, show);

  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert("feedProjections", fields);
  }
}

// ────────────────────────────────────────────────────────────
// Delete projection when a userShow is removed.
// ────────────────────────────────────────────────────────────

export async function deleteFeedProjection(
  ctx: MutationCtx,
  userShowId: Id<"userShows">
) {
  const existing = await ctx.db
    .query("feedProjections")
    .withIndex("by_userShow", (q) => q.eq("userShowId", userShowId))
    .unique();

  if (existing) {
    await ctx.db.delete(existing._id);
  }
}

// ────────────────────────────────────────────────────────────
// Full rebuild for one user — used during migration and as a
// fallback repair mechanism.
// ────────────────────────────────────────────────────────────

export const rebuildFeedProjectionsForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Delete all existing projections for this user.
    const existing = await ctx.db
      .query("feedProjections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    // Rebuild from userShows.
    const userShows = await ctx.db
      .query("userShows")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let created = 0;
    for (const userShow of userShows) {
      const show = await ctx.db.get(userShow.showId);
      if (!show) continue;

      const fields = buildProjectionFields(userShow, show);
      await ctx.db.insert("feedProjections", fields);
      created++;
    }

    return { deleted: existing.length, created };
  },
});

// ────────────────────────────────────────────────────────────
// Refresh projections for all users who track a specific show.
// Called when show metadata changes (e.g., totalEpisodes update,
// new season discovery).
// ────────────────────────────────────────────────────────────

export const refreshProjectionsForShow = internalMutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) return { updated: 0 };

    // Find all users tracking this show via userShows, then update their projections.
    const userShows = await ctx.db
      .query("userShows")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    let updated = 0;
    for (const userShow of userShows) {
      const existing = await ctx.db
        .query("feedProjections")
        .withIndex("by_userShow", (q) => q.eq("userShowId", userShow._id))
        .unique();

      const fields = buildProjectionFields(userShow, show);

      if (existing) {
        await ctx.db.patch(existing._id, fields);
      } else {
        await ctx.db.insert("feedProjections", fields);
      }
      updated++;
    }

    return { updated };
  },
});

// ────────────────────────────────────────────────────────────
// Query: Home feed backed by projections.
// Replaces the N+1 getWatchlist query with a single indexed read.
// ────────────────────────────────────────────────────────────

const seasonMonthOffsetByName: Record<string, number> = {
  WINTER: 0,
  SPRING: 3,
  SUMMER: 6,
  FALL: 9,
};

const mainlineFormats = new Set(["TV", "TV_SHORT"]);

const formatWeightByType: Record<string, number> = {
  TV: 0,
  TV_SHORT: 1,
  MOVIE: 2,
  ONA: 3,
  OVA: 4,
  SPECIAL: 5,
  MUSIC: 6,
};

type FeedEntry = {
  title: string;
  firstAired: string | null;
  animeSeason: string | null;
  animeSeasonYear: number | null;
  anilistFormat: string | null;
  anilistId: number | null;
  malId: number | null;
};

type AnimeHomeRelationMode = "core_only" | "all_relations";

const DEFAULT_ANIME_HOME_RELATION_MODE: AnimeHomeRelationMode = "core_only";

function getChronologyValue(entry: Pick<FeedEntry, "firstAired" | "animeSeason" | "animeSeasonYear">) {
  const firstAired = entry.firstAired?.trim();
  if (firstAired) {
    const match = firstAired.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const asDate = Date.UTC(
        Number.parseInt(match[1], 10),
        Number.parseInt(match[2], 10) - 1,
        Number.parseInt(match[3], 10)
      );
      if (Number.isFinite(asDate)) return asDate;
    }
    const parsed = new Date(firstAired).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof entry.animeSeasonYear === "number") {
    const season = entry.animeSeason?.toUpperCase() ?? "";
    const monthOffset = seasonMonthOffsetByName[season] ?? 0;
    return Date.UTC(entry.animeSeasonYear, monthOffset, 1);
  }
  return Number.MAX_SAFE_INTEGER;
}

function getFormatWeight(entry: Pick<FeedEntry, "anilistFormat">) {
  const format = entry.anilistFormat?.toUpperCase();
  if (!format) return 99;
  return formatWeightByType[format] ?? 99;
}

function isMainlineAnime(entry: Pick<FeedEntry, "anilistFormat">) {
  const format = entry.anilistFormat?.toUpperCase();
  if (!format) return true;
  return mainlineFormats.has(format);
}

function sortAnimeCandidates(a: FeedEntry, b: FeedEntry) {
  const chronoA = getChronologyValue(a);
  const chronoB = getChronologyValue(b);
  if (chronoA !== chronoB) return chronoA - chronoB;

  const fmtA = getFormatWeight(a);
  const fmtB = getFormatWeight(b);
  if (fmtA !== fmtB) return fmtA - fmtB;

  if (a.title !== b.title) return a.title.localeCompare(b.title);

  const idA = a.anilistId ?? a.malId ?? Number.MAX_SAFE_INTEGER;
  const idB = b.anilistId ?? b.malId ?? Number.MAX_SAFE_INTEGER;
  return idA - idB;
}

function getExternalShowIdFromProjection(p: {
  mediaType: string;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  tvmazeId?: number;
  imdbId?: string;
}) {
  if (p.mediaType === "anime") {
    if (typeof p.anilistId === "number") return `anilist:anime:${p.anilistId}`;
    if (typeof p.malId === "number") return `jikan:anime:${p.malId}`;
  }
  if (typeof p.tmdbId === "number") return `tmdb:${p.mediaType}:${p.tmdbId}`;
  if (typeof p.tvmazeId === "number") return `tvmaze:tv:${p.tvmazeId}`;
  if (typeof p.imdbId === "string") return `imdb:${p.mediaType}:${p.imdbId}`;
  return null;
}

export const getHomeFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const typedUserId = userId as Id<"users">;

    const [tvProjections, animeProjections, homeSettings, franchiseSettings] = await Promise.all([
      ctx.db
        .query("feedProjections")
        .withIndex("by_user_media", (q) =>
          q.eq("userId", typedUserId).eq("mediaType", "tv")
        )
        .collect(),
      ctx.db
        .query("feedProjections")
        .withIndex("by_user_media", (q) =>
          q.eq("userId", typedUserId).eq("mediaType", "anime")
        )
        .collect(),
      ctx.db
        .query("userAnimeHomeSettings")
        .withIndex("by_user", (q) => q.eq("userId", typedUserId))
        .unique(),
      ctx.db
        .query("userAnimeFranchiseSettings")
        .withIndex("by_user", (q) => q.eq("userId", typedUserId))
        .collect(),
    ]);

    const globalRelationMode =
      (homeSettings?.relationMode as AnimeHomeRelationMode | undefined) ??
      DEFAULT_ANIME_HOME_RELATION_MODE;
    const relationModeByRoot = new Map<number, AnimeHomeRelationMode>();
    for (const row of franchiseSettings) {
      relationModeByRoot.set(
        row.relationRootAnilistId,
        row.relationMode as AnimeHomeRelationMode
      );
    }

    // Only TV + anime projections are needed for Home.
    const nonMovies = [...tvProjections, ...animeProjections];

    // Build hydrated items from projections (no show doc reads needed!).
    const hydrated = nonMovies.map((p) => {
      const watchedCount = p.watchedEpisodesCount;
      const totalEpisodes = p.totalEpisodes ?? null;
      const remaining = p.remainingEpisodes ?? null;

      const progressPercent =
        totalEpisodes && totalEpisodes > 0
          ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100))
          : null;

      const trackingState =
        totalEpisodes === null
          ? watchedCount > 0
            ? "upcoming"
            : "tba"
          : watchedCount === 0
            ? "not_started"
            : "in_progress";

      return {
        id: getExternalShowIdFromProjection(p) ?? String(p.showId),
        title: p.title,
        mediaType: p.mediaType,
        posterUrl: p.posterUrl ?? null,
        backdropUrl: p.backdropUrl ?? null,
        overview: null as string | null,
        firstAired: p.firstAired ?? null,
        tmdbId: p.tmdbId ?? null,
        anilistId: p.anilistId ?? null,
        malId: p.malId ?? null,
        tvmazeId: p.tvmazeId ?? null,
        imdbId: p.imdbId ?? null,
        status: p.status,
        isAutoTracked: p.isAutoTracked ?? false,
        trackingState,
        relationRootAnilistId: p.relationRootAnilistId ?? null,
        anilistFormat: p.anilistFormat ?? null,
        animeSeason: p.animeSeason ?? null,
        animeSeasonYear: p.animeSeasonYear ?? null,
        watchedEpisodes: watchedCount,
        totalEpisodes,
        remainingEpisodes: remaining,
        progressPercent,
        lastWatchedAt: p.lastWatchedAt,
      };
    });

    // ── Anime franchise grouping (same logic as original getWatchlist) ──
    const groupedAnime = new Map<string, (typeof hydrated)[number][]>();
    const selectedEntries: (typeof hydrated)[number][] = [];

    const isCompletedEntry = (entry: {
      status: string;
      remainingEpisodes: number | null;
    }) =>
      entry.status === "completed" ||
      (typeof entry.remainingEpisodes === "number" && entry.remainingEpisodes <= 0);

    for (const item of hydrated) {
      if (item.mediaType !== "anime") {
        selectedEntries.push(item);
        continue;
      }

      const groupKey =
        typeof item.relationRootAnilistId === "number"
          ? `root:${item.relationRootAnilistId}`
          : typeof item.anilistId === "number"
            ? `anilist:${item.anilistId}`
            : typeof item.malId === "number"
              ? `mal:${item.malId}`
              : `show:${item.id}`;

      const group = groupedAnime.get(groupKey) ?? [];
      group.push(item);
      groupedAnime.set(groupKey, group);
    }

    for (const entries of groupedAnime.values()) {
      const relationRootAnilistId =
        typeof entries[0]?.relationRootAnilistId === "number"
          ? entries[0].relationRootAnilistId
          : null;
      const effectiveRelationMode =
        relationRootAnilistId !== null
          ? relationModeByRoot.get(relationRootAnilistId) ?? globalRelationMode
          : globalRelationMode;

      const nonCompleted = entries.filter((e) => !isCompletedEntry(e));
      const watching = nonCompleted.filter((e) => e.status === "watching");
      const paused = nonCompleted.filter((e) => e.status === "paused");
      const planned = nonCompleted.filter((e) => e.status === "plan_to_watch");
      const dropped = nonCompleted.filter((e) => e.status === "dropped");

      const displayable =
        watching.length > 0
          ? watching
          : paused.length > 0
            ? paused
            : planned.length > 0
              ? planned
              : dropped.length > 0
                ? dropped
                : nonCompleted.length > 0
                  ? nonCompleted
                  : entries;

      if (displayable.length === 0) continue;

      const mainline = displayable.filter((e) => isMainlineAnime(e));
      const pool =
        effectiveRelationMode === "core_only" && mainline.length > 0
          ? mainline
          : displayable;
      const sorted = [...pool].sort(sortAnimeCandidates);
      if (sorted.length === 0) continue;

      selectedEntries.push(sorted[0]);
    }

    return selectedEntries
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
      .map(
        ({
          relationRootAnilistId: _rr,
          anilistFormat: _af,
          animeSeason: _as,
          animeSeasonYear: _asy,
          ...rest
        }) => rest
      );
  },
});

// ────────────────────────────────────────────────────────────
// Daily reconciliation — discovers all users with tracked shows
// and rebuilds their projections. This catches any drift from
// missed mutation hooks or show metadata changes.
// ────────────────────────────────────────────────────────────

/** Return distinct user IDs that have at least one tracked show. */
export const getDistinctTrackedUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    // userShows doesn't have a user-only unique index, so we scan and dedupe.
    // This is acceptable for a daily cron job.
    const rows = await ctx.db.query("userShows").collect();
    const userIds = new Set<string>();
    for (const row of rows) {
      userIds.add(row.userId.toString());
    }
    return Array.from(userIds);
  },
});

/**
 * Daily cron action: iterate all users and rebuild their feed projections.
 * Also backfills mediaType on userShows if missing.
 */
export const dailyReconcileProjections = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Backfill userShows.mediaType for any rows still missing it.
    let backfillResult = { patched: 1, total: 0 };
    while (backfillResult.patched > 0) {
      backfillResult = await ctx.runMutation(
        internal.shows.backfillUserShowsMediaType
      );
    }

    // 2. Get all user IDs that have tracked shows.
    const userIdStrings: string[] = await ctx.runQuery(
      internal.feedProjections.getDistinctTrackedUserIds
    );

    // 3. Rebuild projections for each user.
    let rebuilt = 0;
    for (const userIdStr of userIdStrings) {
      await ctx.runMutation(
        internal.feedProjections.rebuildFeedProjectionsForUser,
        { userId: userIdStr as Id<"users"> }
      );
      rebuilt++;
    }

    return { usersRebuilt: rebuilt, backfillRounds: backfillResult.total };
  },
});
