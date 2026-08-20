export const MAX_WATCHING_WITH_NAMES = 5;
export const MAX_WATCHING_WITH_NAME_LENGTH = 40;

export function normalizeWatchingWithNames(names?: string[]) {
  if (!names) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawName of names) {
    const name = rawName.trim().slice(0, MAX_WATCHING_WITH_NAME_LENGTH);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;

    seen.add(key);
    normalized.push(name);
    if (normalized.length >= MAX_WATCHING_WITH_NAMES) break;
  }

  return normalized;
}

export function areWatchingWithNamesEqual(left?: string[], right?: string[]) {
  const leftNames = left ?? [];
  const rightNames = right ?? [];
  return (
    leftNames.length === rightNames.length &&
    leftNames.every((name, index) => name === rightNames[index])
  );
}
