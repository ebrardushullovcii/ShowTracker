import { toShareShow, type ShareShow } from "./types";

export type SharedGame = {
  // Shortlist is read-only compatibility for links created before ADR-0076.
  mode: "duel" | "shortlist";
  title: string;
  note: string;
  name: string;
  shows: ShareShow[];
};

/** One public snapshot boundary for the bridge and the server. */
export function normalizeSharedGame(value: SharedGame): SharedGame & { mode: "duel" } {
  if (!value || value.mode !== "duel") throw new Error("This or that is the only game type.");
  if (!Array.isArray(value.shows)) throw new Error("Invalid game.");
  for (const [field, limit] of [["title", 100], ["note", 130], ["name", 30]] as const) {
    if (typeof value[field] !== "string" || value[field].length > limit) throw new Error(`The ${field} is too long.`);
  }
  if (value.shows.length < 2) throw new Error("Include at least two shows to play This or that.");
  if (value.shows.length > 2000) throw new Error("Too many shows for this game.");
  const ids = new Set<string>();
  const shows = value.shows.map((show) => {
    const id = typeof show.id === "string" ? show.id.match(/^(tmdb|anilist|jikan|tvmaze|imdb):(tv|anime|movie):([a-z0-9]+)$/i) : null;
    if (!id || ids.has(show.id) || typeof show.title !== "string" || !show.title.trim() || show.title.length > 300 || typeof show.year !== "string" || !/^\d{4}$|^$/.test(show.year)) throw new Error("Invalid show in this game.");
    if (!Array.isArray(show.genres) || show.genres.length > 12 || show.genres.some((genre) => typeof genre !== "string" || genre.length > 80)) throw new Error("Invalid genres.");
    if (typeof show.poster !== "string" || show.poster.length > 2048 || (show.poster && !/^https:\/\//.test(show.poster))) throw new Error("Invalid cover URL.");
    if (show.runtime !== null && (!Number.isFinite(show.runtime) || show.runtime <= 0 || show.runtime > 10000)) throw new Error("Invalid runtime.");
    ids.add(show.id);
    return toShareShow({ title: show.title.trim(), mediaType: id[2].toLowerCase(), firstAired: show.year, genres: show.genres, episodeRuntime: show.runtime, posterUrl: show.poster }, show.id);
  });
  const result = { mode: value.mode, title: value.title.trim() || "What should we watch?", note: value.note.trim(), name: value.name.trim(), shows };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 512000) throw new Error("This collection is too large for one link. Include fewer shows.");
  return result;
}
