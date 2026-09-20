# ADR-0065: Bounded confirmed release timing

## Context

Mushoku Tensei S03E13 was available September 20, 2026 at 15:00 UTC,
while TMDB's date-only row said September 21. The nightly job ran before
both candidate times; ADR-0033 therefore retained TMDB's future date. Once
TVMaze's airtime passed, ADR-0016 would prefer its released row, but no
intraday reconciliation ran. Detail independently used the TMDB date.

The full nightly workflow must not run more frequently. Its import, nearby
schedule-cache pruning (45 days each side), provider maintenance, and full
user projection replacement are inappropriate for a frequent timer.

## Decision

Keep nightly provider priorities, matching, canonical coordinates, and count
repair policies unchanged. Add a separate VPS pass every 15 minutes under the
nightly job's lock. It reads SQLite first and contacts no provider or Convex
when there is no due conflict or pending bounded page.

Only existing TMDB/TVMaze ID pairs qualify. Fresh provider responses must
agree on season, episode, and a non-generic normalized name; the precise
TVMaze timestamp must have passed by five minutes, be within the last day,
and precede TMDB's still-future date by at most 24 hours. The episode must be
TMDB's first future episode. Provider regular released counts must differ
by exactly one and remain inside TMDB's catalogue total. Ambiguous names,
numbering aliases, large date moves, missing IDs, larger count discrepancies,
and provider failures defer to nightly maintenance rather than guessing.

The token-protected Convex mutation updates only this episode in the two
indexed TV date buckets. It preserves unrelated entries and refuses duplicate
buckets or buckets larger than 128,000 string characters. Each call processes
at most 25 tracking rows for the one show, using the existing show/user/route/date
indexes. It updates existing exact episode projections and the affected feed
rows; it never scans watched history or regenerates whole user windows.
Watch counters and companion names remain unchanged. Manual Paused, Dropped,
and Planned states are preserved; genuinely newly released content retains
the existing Completed/auto-paused reactivation behavior.

One small confirmed episode and a resumable cursor live on the existing show
document. Detail receives the proof through its existing tracking query—no
extra subscription, timer, or provider action. The proof only corrects the
exact canonical episode while TMDB still supplies the original date. A short
released-count floor prevents metadata refresh from undoing it; it cannot
expand the catalogue and expires the day after TMDB's date. Later catalogue
repair remains authoritative. The regular nightly delta path honors that floor.

## Cost and failure bounds

- No due work: zero additional Convex calls, reads, writes, or provider requests.
- At most two provider-verification attempts per tick and eight per UTC day;
  a verification may make multiple provider HTTP requests, all on the VPS.
- At most four mutation pages per tick and 64 per UTC day. Capacity is up to
  1,600 user/show updates per day, not 64 full-library reconciliations.
- At most three verification attempts per episode and three failed mutation
  attempts before the job is visibly blocked. Budgets are reserved before
  dispatch and survive crashes. Lost responses replay the server-owned cursor.
- Each page reads one show, at most 25 user rows, their indexed feed row and
  two route/date ranges (at most 17 rows each). Only the initial page reads
  the two shared schedule buckets. Unchanged completed jobs write nothing.
- No new table or index in Convex; storage is bounded per show. VPS job history
  and daily counters are pruned locally after 14 days, except unfinished work.

Daily caps deliberately defer excess work instead of increasing spend. Logs
report candidates, provider attempts, mutation calls, affected users, writes,
deferred work, and blocked jobs. Growth-related backlog must be reviewed before
raising caps. These are work bounds, not a dollar-cost guarantee: subscription
invalidation, document sizes, and OCC retries still contribute to billing.

## Verification and rollback

Tests cover exact identity/date matching, first-future selection, early/future
timestamps, count inflation, temporary metadata floors, 55-user pagination,
replay, preserved manual/shared states and history, and zero-work idle ticks.
The baseline fixture's terminal total assertion is aligned with ADR-0054;
provider timeout tests keep the event loop alive and CLI main is awaited so
premature exit cannot masquerade as a passing validation.

Run a provider-only shadow pass first. Snapshot production Home and tracking,
apply the confirmed target, verify the live detail/Calendar/Home, and repeat
the runner to demonstrate no additional writes. Disable the release-timing
timer for rollback; nightly maintenance remains independent. Corrected release
evidence should not be erased merely to undo the timer. Revert UI and backend
code together only if necessary, preserving the target evidence first.
