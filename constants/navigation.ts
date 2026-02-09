export const DESKTOP_TAB_RAIL_BREAKPOINT = 880;
export const DESKTOP_TAB_RAIL_WIDTH = 92;
export const DESKTOP_TAB_RAIL_GAP = 2;

export function getTabContentWidth(windowWidth: number, isWeb: boolean) {
  if (!isWeb || windowWidth < DESKTOP_TAB_RAIL_BREAKPOINT) {
    return windowWidth;
  }

  return Math.max(
    360,
    windowWidth - DESKTOP_TAB_RAIL_WIDTH - DESKTOP_TAB_RAIL_GAP - 24
  );
}
