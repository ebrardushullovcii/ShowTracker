export const ACCESS_TOKEN_DURATION_MS = 60 * 60 * 1000;
// Recheck after every access token issued before deletion has expired.
export const DELETION_FINAL_SWEEP_DELAY_MS = ACCESS_TOKEN_DURATION_MS * 2;
