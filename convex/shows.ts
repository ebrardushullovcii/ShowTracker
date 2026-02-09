import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const showInput = {
  tmdbId: v.optional(v.number()),
  anilistId: v.optional(v.number()),
  tvmazeId: v.optional(v.number()),
  imdbId: v.optional(v.string()),
  mediaType: v.union(v.literal("tv"), v.literal("anime"), v.literal("movie")),
  title: v.string(),
  overview: v.optional(v.string()),
  posterUrl: v.optional(v.string()),
  backdropUrl: v.optional(v.string()),
  genres: v.optional(v.array(v.string())),
  status: v.optional(v.string()),
  totalEpisodes: v.optional(v.number()),
  totalSeasons: v.optional(v.number()),
  episodeRuntime: v.optional(v.number()),
  rating: v.optional(v.number()),
  firstAired: v.optional(v.string()),
  lastUpdated: v.number(),
};

const showLookupInput = {
  tmdbId: v.optional(v.number()),
  anilistId: v.optional(v.number()),
  tvmazeId: v.optional(v.number()),
};

function hasLookupArgs(args: {
  tmdbId?: number;
  anilistId?: number;
  tvmazeId?: number;
}) {
  return (
    typeof args.tmdbId === "number" ||
    typeof args.anilistId === "number" ||
    typeof args.tvmazeId === "number"
  );
}

async function getCurrentUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (!user) {
    throw new Error("User not found");
  }

  return user._id;
}

async function findShowByLookup(
  ctx: any,
  args: {
    tmdbId?: number;
    anilistId?: number;
    tvmazeId?: number;
  }
) {
  const byTmdb =
    typeof args.tmdbId === "number"
      ? await ctx.db
          .query("shows")
          .withIndex("by_tmdbId", (q: any) =>
            q.eq("tmdbId", args.tmdbId as number)
          )
          .unique()
      : null;
  if (byTmdb) {
    return byTmdb;
  }

  const byAniList =
    typeof args.anilistId === "number"
      ? await ctx.db
          .query("shows")
          .withIndex("by_anilistId", (q: any) =>
            q.eq("anilistId", args.anilistId as number)
          )
          .unique()
      : null;
  if (byAniList) {
    return byAniList;
  }

  const byTvMaze =
    typeof args.tvmazeId === "number"
      ? await ctx.db
          .query("shows")
          .withIndex("by_tvmazeId", (q: any) =>
            q.eq("tvmazeId", args.tvmazeId as number)
          )
          .unique()
      : null;

  return byTvMaze;
}

async function ensureShow(
  ctx: any,
  args: {
    tmdbId?: number;
    anilistId?: number;
    tvmazeId?: number;
    imdbId?: string;
    mediaType: "tv" | "anime" | "movie";
    title: string;
    overview?: string;
    posterUrl?: string;
    backdropUrl?: string;
    genres?: string[];
    status?: string;
    totalEpisodes?: number;
    totalSeasons?: number;
    episodeRuntime?: number;
    rating?: number;
    firstAired?: string;
    lastUpdated: number;
  }
) {
  const existing = await findShowByLookup(ctx, args);
  if (existing) {
    await ctx.db.patch(existing._id, args);
    return existing._id;
  }
  return ctx.db.insert("shows", args);
}

export const upsertShow = mutation({
  args: showInput,
  handler: async (ctx, args) => {
    await getCurrentUserId(ctx);
    return ensureShow(ctx, args);
  },
});

export const getUserShowTracking = query({
  args: showLookupInput,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!hasLookupArgs(args)) {
      return {
        showId: null,
        inWatchlist: false,
        status: null,
        watchedEpisodeKeys: [] as string[],
        watchedEpisodes: 0,
      };
    }

    const show = await findShowByLookup(ctx, args);
    if (!show) {
      return {
        showId: null,
        inWatchlist: false,
        status: null,
        watchedEpisodeKeys: [] as string[],
        watchedEpisodes: 0,
      };
    }

    const userShow = await ctx.db
      .query("userShows")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", show._id))
      .unique();

    const watchedEpisodes = await ctx.db
      .query("watchedEpisodes")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", show._id))
      .collect();

    return {
      showId: show._id,
      inWatchlist: userShow !== null,
      status: userShow?.status ?? null,
      watchedEpisodeKeys: watchedEpisodes.map(
        (entry) => `${entry.season}:${entry.episode}`
      ),
      watchedEpisodes: watchedEpisodes.length,
    };
  },
});

export const addToWatchlist = mutation({
  args: showInput,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const showId = await ensureShow(ctx, args);

    const existing = await ctx.db
      .query("userShows")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", showId))
      .unique();

    if (existing) {
      return { showId, status: existing.status };
    }

    await ctx.db.insert("userShows", {
      userId,
      showId,
      status: "plan_to_watch",
      addedAt: Date.now(),
    });

    return { showId, status: "plan_to_watch" as const };
  },
});

export const toggleEpisodeWatched = mutation({
  args: {
    show: v.object(showInput),
    season: v.number(),
    episode: v.number(),
    runtime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const showId = await ensureShow(ctx, args.show);

    let userShow = await ctx.db
      .query("userShows")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", showId))
      .unique();

    if (!userShow) {
      const userShowId = await ctx.db.insert("userShows", {
        userId,
        showId,
        status: "watching",
        addedAt: Date.now(),
        lastWatchedAt: Date.now(),
      });
      userShow = await ctx.db.get(userShowId);
    }

    const watchedEpisodes = await ctx.db
      .query("watchedEpisodes")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", showId))
      .collect();

    const existingEpisode = watchedEpisodes.find(
      (entry) => entry.season === args.season && entry.episode === args.episode
    );

    if (existingEpisode) {
      await ctx.db.delete(existingEpisode._id);

      const remainingCount = watchedEpisodes.length - 1;
      if (
        userShow &&
        userShow.status === "completed" &&
        (!args.show.totalEpisodes || remainingCount < args.show.totalEpisodes)
      ) {
        await ctx.db.patch(userShow._id, { status: "watching" });
      }

      return {
        watched: false,
        watchedEpisodes: remainingCount,
      };
    }

    const now = Date.now();
    await ctx.db.insert("watchedEpisodes", {
      userId,
      showId,
      season: args.season,
      episode: args.episode,
      watchedAt: now,
      runtime: args.runtime,
    });

    const totalWatched = watchedEpisodes.length + 1;
    const nextStatus =
      args.show.totalEpisodes && totalWatched >= args.show.totalEpisodes
        ? "completed"
        : "watching";

    if (userShow) {
      await ctx.db.patch(userShow._id, {
        status: nextStatus,
        lastWatchedAt: now,
      });
    }

    return {
      watched: true,
      watchedEpisodes: totalWatched,
      status: nextStatus,
    };
  },
});

export const markSeasonWatched = mutation({
  args: {
    show: v.object(showInput),
    season: v.number(),
    episodes: v.array(
      v.object({
        episode: v.number(),
        runtime: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const showId = await ensureShow(ctx, args.show);
    const now = Date.now();

    let userShow = await ctx.db
      .query("userShows")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", showId))
      .unique();

    if (!userShow) {
      const userShowId = await ctx.db.insert("userShows", {
        userId,
        showId,
        status: "watching",
        addedAt: now,
        lastWatchedAt: now,
      });
      userShow = await ctx.db.get(userShowId);
    }

    const watchedEpisodes = await ctx.db
      .query("watchedEpisodes")
      .withIndex("by_user_show", (q) => q.eq("userId", userId).eq("showId", showId))
      .collect();

    const existingSeasonEpisodes = new Set(
      watchedEpisodes
        .filter((entry) => entry.season === args.season)
        .map((entry) => entry.episode)
    );

    const uniqueEpisodes = Array.from(
      new Map(args.episodes.map((entry) => [entry.episode, entry])).values()
    );

    let addedCount = 0;
    for (const entry of uniqueEpisodes) {
      if (existingSeasonEpisodes.has(entry.episode)) {
        continue;
      }
      await ctx.db.insert("watchedEpisodes", {
        userId,
        showId,
        season: args.season,
        episode: entry.episode,
        watchedAt: now,
        runtime: entry.runtime,
      });
      addedCount += 1;
    }

    const totalWatched = watchedEpisodes.length + addedCount;
    const nextStatus =
      args.show.totalEpisodes && totalWatched >= args.show.totalEpisodes
        ? "completed"
        : "watching";

    if (userShow) {
      await ctx.db.patch(userShow._id, {
        status: nextStatus,
        lastWatchedAt: now,
      });
    }

    return {
      addedCount,
      watchedEpisodes: totalWatched,
      status: nextStatus,
    };
  },
});
