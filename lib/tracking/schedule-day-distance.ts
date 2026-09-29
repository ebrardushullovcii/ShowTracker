const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

function dayIndex(dateKey: string): number | null {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms / DAY_IN_MS;
}

/**
 * Calendar days from `fromKey` to `toKey` (both YYYY-MM-DD), independent of timezone.
 *
 * Schedule rows are bucketed by date key on the server, where "today" is the UTC day
 * (ADR-0008). Relative labels must count from the viewer's local day instead, or they
 * run one day ahead or behind whenever the local date differs from the UTC date.
 */
export function getScheduleDayDistance(fromKey: string, toKey: string): number | null {
  const from = dayIndex(fromKey);
  const to = dayIndex(toKey);
  if (from === null || to === null) return null;
  return Math.round(to - from);
}
