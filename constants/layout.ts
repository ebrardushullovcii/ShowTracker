// Keep the last item clear of the tab bar or viewport edge at the end of a page.
export const PAGE_SCROLL_CONTENT_STYLE = { paddingBottom: 24 } as const;

export const POSTER_GRID_GAP = 12;

export function getPosterGridCellStyle(index: number, columns: number) {
  const column = index % columns;
  // FlashList gives each column an equal slot. Distribute the gap across
  // those slots so the poster widths match and the outside edges stay flush.
  const step = POSTER_GRID_GAP / columns;

  return {
    flex: 1,
    paddingStart: column * step,
    paddingEnd: (columns - 1 - column) * step,
  };
}

export function getPosterGridColumnCount(width: number, isWeb: boolean) {
  if (!isWeb || width < 640) return 2;
  if (width >= 1800) return 8;
  if (width >= 1500) return 7;
  if (width >= 1260) return 6;
  if (width >= 1040) return 5;
  if (width >= 920) return 4;
  return 3;
}
