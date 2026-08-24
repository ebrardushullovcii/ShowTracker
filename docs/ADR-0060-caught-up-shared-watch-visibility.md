# ADR-0060: Caught-up shared watches wait for actionable episodes

## Context

Production Home showed Bleach in the Watching with others section as `411/411`
and `Caught up` after the user marked every released episode watched. The stored
tracking and release state was correct: Bleach remained in shared-watch mode
with Vigan and Gent, while its feed projection had `remainingEpisodes: 0`, no
fresh release signal, and schedule counts reported five future-only episodes.

## Current behavior

The normal active Watchlist applies the release-aware Home availability guard
from ADR-0027 before rendering a row. The Watching with others section only
checked the underlying Watching status, shared-watch marker, and media filter.
It therefore displayed every shared-watch row even when no episode was
currently watchable.

## Decision

The Watching with others section must apply the same actionable-episode policy
as the normal active Watchlist. A shared-watch row remains stored with its
people metadata, but Home hides it while it is caught up and has no actionable
schedule episode.

The shared row becomes visible again automatically when its projection or
schedule counts prove an episode is watchable under the user's configured
same-day or after-airtime mode. The common schedule-attention and actionable
episode helpers move into a pure shared module so active and shared sections
cannot silently drift apart and the behavior can be regression-tested.

## Reasoning

Watching with others describes who the user watches with; it does not mean a
caught-up title should permanently occupy Home. Preserving the metadata while
filtering the Home projection keeps the show ready to return with the same names
when a real episode releases.

Using the existing Home availability contract avoids inventing a second meaning
for caught up. It also preserves ADR-0027's distinction between future-known
episodes and episodes that can be watched now.

## Provider and data assumptions

`remainingEpisodes` represents released regular-episode backlog. Raw
`totalEpisodes` may include future episodes and does not create Home attention.
The user-specific schedule-count projection determines whether a schedule row
is available, same-day, or future-only for the configured airtime mode.

The `watchingWithOthers` marker and `watchingWithNames` remain user-owned Convex
metadata. This decision does not clear, rewrite, or migrate either field and
does not change provider identity, episode coordinates, or schedule-confidence
reconciliation.

## Edge cases

- A caught-up shared watch with only future episodes is hidden.
- A positive released backlog remains visible unless schedule counts prove the
  entire apparent backlog is future-only.
- A date-only episode can surface on release day in same-day mode but waits for
  its airtime in after-airtime mode.
- An available post-airtime episode surfaces in both modes.
- A fresh signal alone cannot revive a zero-remaining row when schedule counts
  show no actionable episode.
- Paused, dropped, and non-shared rows remain excluded from the shared section.

## Verification

Required checks:

```bash
npx tsx --test lib/tracking/home-watchlist-visibility.test.ts lib/tracking/home-schedule-signal.test.ts
npx tsc --noEmit --pretty false
npm run lint
git diff --check
npx convex deploy --dry-run --yes
```

Production verification must preserve the complete pre-change Home baseline,
confirm that Bleach alone leaves the shared section, confirm its Vigan and Gent
metadata remains stored, and verify the shared count changes from eight to
seven while all other active, shared, paused, and planned rows remain intact.

## Rollback notes

Revert the shared-section predicate and restore the Home-local helper functions.
No data rollback is required because this decision changes only read-time Home
visibility and preserves the existing shared-watch fields.
