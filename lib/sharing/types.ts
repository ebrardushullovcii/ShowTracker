import { toHttpsImageUrl } from "../image-url";

/** Only public catalogue fields cross into an export. Never pass tracking records. */
export type ShareShow = {
  id: string;
  title: string;
  year: string;
  kind: string;
  genres: string[];
  runtime: number | null;
  poster: string;
  url: string;
  appUrl: string;
};

export type ShareCollection = {
  title: string;
  context: string;
  backlog?: boolean;
  shows: ShareShow[];
};

export function toShareShow(show: {
  title: string;
  mediaType: string;
  firstAired?: string | null;
  genres?: string[];
  episodeRuntime?: number | null;
  posterUrl?: string | null;
}, routeId: string): ShareShow {
  // Normalized catalogue IDs omit the media segment; routes include it (ADR-0001).
  const shortId = routeId.match(/^(tmdb|anilist|jikan|tvmaze|imdb):([^:]+)$/);
  const canonicalId = shortId ? `${shortId[1]}:${show.mediaType}:${shortId[2]}` : routeId;
  const parts = canonicalId.match(/^(tmdb|anilist|jikan|tvmaze|imdb):(tv|anime|movie):([a-z0-9]+)$/i);
  const catalogUrl = !parts ? "" : parts[1] === "tmdb" ? `https://www.themoviedb.org/${parts[2] === "movie" ? "movie" : "tv"}/${parts[3]}`
    : parts[1] === "anilist" ? `https://anilist.co/anime/${parts[3]}`
      : parts[1] === "jikan" ? `https://myanimelist.net/anime/${parts[3]}`
        : parts[1] === "tvmaze" ? `https://www.tvmaze.com/shows/${parts[3]}`
          : `https://www.imdb.com/title/${parts[3]}/`;
  return {
    id: canonicalId,
    title: show.title,
    year: show.firstAired?.slice(0, 4) ?? "",
    kind: show.mediaType === "movie" ? "Movie" : show.mediaType === "anime" ? "Anime" : "TV Show",
    genres: show.genres ?? [],
    runtime: show.episodeRuntime ?? null,
    poster: /^https?:\/\//.test(toHttpsImageUrl(show.posterUrl)) ? toHttpsImageUrl(show.posterUrl) : "",
    url: catalogUrl,
    appUrl: parts
      ? `https://showtrackerapp.netlify.app/show/${encodeURIComponent(canonicalId)}`
      : "",
  };
}
