import { v } from "convex/values";

export const publicShareShow = v.object({
  id: v.string(), title: v.string(), year: v.string(), kind: v.string(), genres: v.array(v.string()),
  runtime: v.union(v.number(), v.null()), poster: v.string(), url: v.string(), appUrl: v.string(),
});
export const sharedGameFields = {
  mode: v.union(v.literal("duel"), v.literal("shortlist")),
  title: v.string(), note: v.string(), name: v.string(), shows: v.array(publicShareShow),
};
