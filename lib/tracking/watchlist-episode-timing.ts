const DAY_MS = 86_400_000;
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

export function normalizeWatchlistTimeZone(timeZone: string) {
  if (timeZone.length > 80) throw new Error("Invalid time zone.");
  return new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
}

export function episodeAirtimeMs(airDate?: string | null) {
  if (!airDate || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(airDate.trim())) return null;
  const timestamp = Date.parse(airDate.trim());
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function watchlistLocalDate(timestamp: number, timeZone: string) {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftWatchlistDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function watchlistDayStart(date: string, timeZone: string) {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  let low = utcMidnight - DAY_MS;
  let high = utcMidnight + DAY_MS;
  // Find the first instant of the local day, including zones where DST skips midnight.
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (watchlistLocalDate(middle, timeZone) < date) low = middle + 1;
    else high = middle;
  }
  return high;
}

export function watchlistDayBuckets(date: string, timeZone?: string) {
  if (!timeZone) return { startDate: date, endDate: date };
  const start = watchlistDayStart(date, timeZone);
  const end = watchlistDayStart(shiftWatchlistDate(date, 1), timeZone);
  return {
    startDate: new Date(start).toISOString().slice(0, 10),
    endDate: new Date(Math.max(start, end - 1)).toISOString().slice(0, 10),
  };
}

export function watchlistEpisodeTiming(date: string, airDate?: string, timeZone?: string) {
  const airtime = episodeAirtimeMs(airDate);
  return {
    airtime,
    day: airtime !== null && timeZone ? watchlistLocalDate(airtime, timeZone) : date,
  };
}
