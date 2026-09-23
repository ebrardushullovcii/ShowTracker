export type ScrollEndMetrics = {
  scrollOffset: number;
  viewportLength: number;
  contentLength: number;
};

// The bottom Home section starts its next page before the reader reaches the
// last row, so appended cards are already laid out when they scroll into view.
export const SCROLL_AUTO_LOAD_MIN_DISTANCE_PX = 480;
export const SCROLL_AUTO_LOAD_VIEWPORT_RATIO = 0.75;

export function getSectionQueryLimit(visibleCount: number, pageSize: number) {
  return Math.max(visibleCount + pageSize * 2, pageSize * 4);
}

export function hasMoreSectionRows({
  visibleCount,
  sectionLength,
  loadedFeedLength,
  queryLimit,
}: {
  visibleCount: number;
  sectionLength: number;
  loadedFeedLength: number;
  queryLimit: number;
}) {
  return visibleCount < sectionLength || loadedFeedLength >= queryLimit;
}

export function getScrollAutoLoadDistance(viewportLength: number) {
  return Math.max(
    SCROLL_AUTO_LOAD_MIN_DISTANCE_PX,
    viewportLength * SCROLL_AUTO_LOAD_VIEWPORT_RATIO
  );
}

export function isNearScrollEnd({
  scrollOffset,
  viewportLength,
  contentLength,
}: ScrollEndMetrics) {
  if (
    !Number.isFinite(scrollOffset) ||
    !Number.isFinite(viewportLength) ||
    !Number.isFinite(contentLength) ||
    viewportLength <= 0
  ) {
    return false;
  }

  const distanceFromEnd = contentLength - (scrollOffset + viewportLength);
  return distanceFromEnd <= getScrollAutoLoadDistance(viewportLength);
}
