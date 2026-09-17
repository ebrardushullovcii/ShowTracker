# ADR-0064: Elided Episode Name Alias Evidence

## Status

Accepted. Extends ADR-0058.

## Context

On September 17, 2026, production Home showed `Hot Ones` as active with
`1 left` while the card read `434/434 episodes`, detail showed every episode
watched, and the feed projection had `remainingEpisodes: 0`.

The reconciler held both provider rows for that day's episode. TMDB listed it
as `S30E18` with the date-only air date and the truncated name
`Ryan Reynolds & Kenneth Branagh... Spicy Wings`. TVMaze listed it as `S31E01`
with a precise noon UTC airtime and the full name
`Ryan Reynolds & Kenneth Branagh ... While Eating Spicy Wings`. The user had
marked TMDB `S30E18` watched.

Release-fact deduplication correctly collapsed the two rows to the TVMaze
timing row. ADR-0058 then attaches TMDB coordinates only when the rows share a
non-generic normalized name or the same episode number. Neither held: TMDB
elided the middle of the name, and the episode numbers were `18` and `1`. The
release fact therefore projected `S31E01`, the user schedule event carried
`S31E01`, and Home's watched matching could not pair it with the `S30E18`
anchor. Under the default same-day airtime mode that unmatched row counted as
one actionable episode.

## Decision

Alias evidence for attaching tracked TMDB coordinates gains a third, narrow
name test in addition to ADR-0058's exact-name and same-number rules. Two
non-generic episode names are alias evidence when either:

- one normalized name is a prefix of the other and the shorter normalized name
  has at least 12 characters; or
- one raw name contains an ellipsis (`...` or `…`), it splits into at least two
  non-empty segments, the first segment normalizes to at least 12 characters,
  and every segment appears in order inside the other normalized name.

All other ADR-0058 conditions are unchanged: the rows must be different
providers on the same schedule date for the same tracked TV title, and TMDB
coordinates are attached only from the direct TMDB event for the tracked show.
The same helper is used for pairwise coordinate preservation and for the final
recovery pass over raw TMDB rows.

## Reasoning

TMDB and TVMaze describe the same weekly episode with the same guest names but
TMDB sometimes stores an elided title. The distinctive part of the name is the
leading guest segment, so an ordered-segment or long-prefix match is strong
evidence that the rows are the same episode, while still rejecting short or
generic names such as `Part 1` versus `Part 2` or `Episode 3`.

This keeps the fix at the provider reconciliation boundary, where ADR-0058
placed it, instead of remapping season numbers inside Home or hiding every
caught-up show with a positive schedule count.

## Edge Cases

Same-day multi-episode drops with genuinely different names remain separate
because neither name is a prefix or elision of the other. Rows whose only
shared text is a generic suffix are not matched, because the prefix and first
segment tests operate on the leading text. Anime and non-TMDB routes are
unchanged.

## Verification

```bash
npm run schedule-confidence:validate
node --check scripts/schedule-confidence.mjs
npx tsc --noEmit --pretty false
npm run lint
git diff --check
```

The fixture uses the exact Hot Ones rows above plus the following week's TBA
episode. It asserts the deduplicated row keeps TVMaze timing and source while
projecting TMDB `S30E18` and its name, and that the following `S31E02` row is
untouched. A second assertion checks the helper rejects short, generic, and
unrelated names.

Production verification runs the VPS reconciler, confirms the Hot Ones release
fact and user schedule events use `S30E18`, and confirms the show leaves the
active Watchlist on the signed-in live Home page while other rows are
unchanged.

## Rollback Notes

Rollback the helper and both call sites together. Raw provider events are not
rewritten, so no migration is needed. Preserve the release fact, user schedule
events, and watched anchor for the affected show before rollback.
