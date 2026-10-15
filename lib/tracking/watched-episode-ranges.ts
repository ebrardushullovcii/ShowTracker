type EpisodePosition = { season: number; episode: number };
type EpisodeRange = [season: number, first: number, last: number];

// Preserve every stored coordinate, including specials, gaps, out-of-catalogue
// episodes and duplicate rows. This is a lossless read projection, not progress.
export function buildWatchedEpisodeRanges(episodes: EpisodePosition[]): string {
  const ranges: EpisodeRange[] = [];
  const sorted = [...episodes].sort((a, b) => a.season - b.season || a.episode - b.episode);
  for (const { season, episode } of sorted) {
    const previous = ranges[ranges.length - 1];
    if (previous && previous[0] === season && previous[2] + 1 === episode) {
      previous[2] = episode;
    } else {
      ranges.push([season, episode, episode]);
    }
  }
  return JSON.stringify(ranges);
}

export function readWatchedEpisodeRanges(value?: string): EpisodeRange[] | null {
  if (value === undefined) return null;
  try {
    const ranges: unknown = JSON.parse(value);
    if (!Array.isArray(ranges) || !ranges.every(range =>
      Array.isArray(range) && range.length === 3 && range.every(Number.isSafeInteger) &&
      range[0] >= 0 && range[1] >= 0 && range[2] >= range[1]
    )) return null;
    return ranges as EpisodeRange[];
  } catch {
    return null;
  }
}

export function* watchedEpisodesFromRanges(ranges: EpisodeRange[]): Generator<EpisodePosition> {
  for (const [season, first, last] of ranges) {
    for (let episode = first; episode <= last; episode++) yield { season, episode };
  }
}

export function watchedEpisodeAnchorsFromRanges(ranges: EpisodeRange[], limit: number): EpisodePosition[] {
  const anchors: EpisodePosition[] = [];
  for (let i = ranges.length - 1; i >= 0 && anchors.length < limit; i--) {
    const [season, first, last] = ranges[i];
    for (let episode = last; episode >= first && anchors.length < limit; episode--) {
      anchors.push({ season, episode });
    }
  }
  return anchors;
}
