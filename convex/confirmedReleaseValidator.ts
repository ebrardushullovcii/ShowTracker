import { v } from "convex/values";

export const confirmedReleaseFields = {
  seasonNumber: v.number(), episodeNumber: v.number(), name: v.string(),
  tmdbAirDate: v.string(), airTimestamp: v.number(), releasedEpisodes: v.number(),
  verifiedAt: v.number(),
};
