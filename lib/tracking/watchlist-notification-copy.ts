type Episode = {
  seasonNumber: number;
  episodeNumber: number;
  name?: string;
};

function episodeName(showTitle: string, episode: Episode) {
  const name = episode.name?.trim();
  if (!name || name.toLowerCase() === showTitle.toLowerCase() ||
      /^(?:episode\s*#?\s*\d+|ep\.?\s*#?\s*\d+|e\d+|s\d+\s*e\d+|season\s*\d+,?\s*episode\s*\d+|special(?:\s*#?\s*\d+)?|tba|tbd|untitled)$/i.test(name)) {
    return undefined;
  }
  return name.length <= 80 ? name : `${name.slice(0, 79).trimEnd()}…`;
}

function episodeNumber(episode: Episode) {
  if (episode.episodeNumber <= 0) return undefined;
  return episode.seasonNumber > 0
    ? `S${episode.seasonNumber} E${episode.episodeNumber}`
    : `Special ${episode.episodeNumber}`;
}

export function getWatchlistNotificationBody(args: {
  showTitle: string;
  episodes: Episode[];
  timing: "same_day" | "after_airtime" | "date_only";
  airtime: number | null;
  timeZone: string;
}) {
  const episodes = [...args.episodes].sort((a, b) =>
    a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  const first = episodes[0];
  const last = episodes[episodes.length - 1];
  const localTime = args.timing === "same_day" && args.airtime !== null
    ? new Intl.DateTimeFormat("en", { timeZone: args.timeZone, hour: "numeric", minute: "2-digit" }).format(args.airtime)
    : null;
  const prefix = localTime ? `Today at ${localTime}` :
    args.timing === "after_airtime" ? "Out now" :
    args.timing === "date_only" ? "Coming out today" : "New today";

  if (episodes.length > 1 && first && last) {
    const firstNumber = episodeNumber(first);
    const contiguous = first.seasonNumber > 0 && first.episodeNumber > 0 &&
      episodes.every((episode, i) => episode.seasonNumber === first.seasonNumber &&
        episode.episodeNumber === first.episodeNumber + i);
    const details = contiguous
      ? `${firstNumber}–E${last.episodeNumber}`
      : `${episodes.length} episodes${firstNumber ? `, starting with ${firstNumber}` : ""}`;
    return `${prefix}: ${details}`;
  }

  const details = first ? [episodeNumber(first), episodeName(args.showTitle, first)].filter(Boolean).join(" · ") : "";
  if (details) return `${prefix}: ${details}`;
  if (localTime) return `New episode today at ${localTime}`;
  if (args.timing === "date_only") return "A new episode is coming out today";
  return args.timing === "after_airtime" ? "New episode out now" : "New episode today";
}
