export type EpisodePosition = { season: number; episode: number };

// Viewing order for "this episode and everything after it" (ADR-0072). Specials (season 0)
// sit outside the main run, so they only follow another special.
export function isEpisodeAtOrAfter(candidate: EpisodePosition, anchor: EpisodePosition) {
  if (candidate.season === 0 || anchor.season === 0) {
    return candidate.season === anchor.season && candidate.episode >= anchor.episode;
  }
  return (
    candidate.season > anchor.season ||
    (candidate.season === anchor.season && candidate.episode >= anchor.episode)
  );
}

export function parseEpisodeKey(key: string): EpisodePosition | null {
  const [seasonRaw, episodeRaw] = key.split(":");
  const season = Number(seasonRaw);
  const episode = Number(episodeRaw);
  if (!seasonRaw || !episodeRaw || !Number.isFinite(season) || !Number.isFinite(episode)) {
    return null;
  }
  return { season, episode };
}
