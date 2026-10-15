# ADR-0077: Schedule database I/O

The October 2026 usage report showed about 2.96 GB of database I/O by the
middle of the month. Release-delta application accounted for 1.18 GB,
Home future counts for 701 MB, and tracked-library exports for 492 MB.
Production execution logs confirmed that a future-count refresh could read
over 3,400 documents for a result of about 1.5 KB.

Two repeated operations caused most of this work. Schedule reads loaded the
entire watched history of every matching title, even when using per-user
schedule projections. Nightly exports loaded up to 128 watched documents for
each tracked title. Release application ran one title per mutation and repeatedly
read and rewrote the same shared date buckets during moved-date pruning.

## Decision

Store a lossless coordinate summary on the existing `userShows` document as
`watchedEpisodeRanges`. Consecutive coordinates become `[season, first, last]`
ranges in a JSON string. Gaps, specials, absolute episode numbering,
out-of-catalogue coordinates, and duplicate records are preserved. This is
derived watched evidence, separate from provider-bounded progress counts.

The existing tracking aggregate refresh writes the summary in the same
transaction as watch, rewatch, unwatch, season, import, and multi-episode undo
operations. Partial account/global resets invalidate affected summaries before
deleting watched rows. Removing a tracking row removes its summary with it.
Missing or invalid summaries use the original watched-history read. A genuinely
empty summary is authoritative. An explicit internal, resumable deployment
backfill visits one tracking row per mutation; it is not scheduled or invoked
from navigation. Oversized histories are reported and keep the original path.

Schedule matching uses the summary to construct the same exact/absolute watched
index and season offsets. Exports derive the same descending 128 anchors from
it. The shared future-count path reads its event/duplicate window and feed
projections once. Normal coverage checks read only the schedule-identity stamp;
the general feed timestamp remains available to diagnostics (ADR-0011).

Nightly release application uses batches of 25. Each mutation keeps a private
working copy of the schedule buckets it has read, including empty date ranges.
Overlapping title windows read only uncovered ranges. Subsequent deltas see
preceding changes; the transaction commits each bucket's final content once.
No provider/date/alias pruning policy changes. Writes that return a bucket to
its original content are skipped. Budget guards use a structured `ConvexError`
code because production redacts generic exception messages. The CLI splits resource-limited batches and
marks deltas applied only after successful transactions. Physical bucket/byte
counters in the apply response distinguish this work from logical delta counts.

Moved-date windows can span years when the latest released episode is old and
the next season is newly scheduled. Reading full buckets repeatedly is still
expensive even with batching. Keep a compact `scheduleCacheIndex` row per bucket
containing its unique provider-ID/normalized-title pairs. Pruning reads these
small rows and loads full buckets only for potential matches, using exactly the
existing ID, title, and season-title predicates. The transaction's working copy
includes earlier edits, inserts, and deletes. Exact-date upserts still read all
buckets for that date so duplicate collapse is preserved.

Every cache writer updates or removes its identity index in the same transaction:
provider hydration, nightly pruning/upserts, intraday corrections, synthetic
fixtures/cleanup, and global reset. An internal paged backfill builds existing
index rows and marks complete coverage only on its final page. Until that marker
exists, pruning retains the original full scan. An invalid index encoding widens
the read. Episode facts stay in `scheduleCache`; the index never decides releases.

No release correctness rule, provider priority, status policy, schedule window,
or intraday timer frequency changes. ADR-0065's idle ticks still make no Convex
calls. Heavy provider work remains on the VPS. This does not add an app-driven
repair or a broad aggregate rebuild.

## Verification and rollback

Run `npm run test:convex-io`, `npm run test:schedule-confidence`,
`npm run schedule-confidence:validate`, TypeScript, lint, and a Convex development
push. Tests compare the real export/count handlers and singleton/batched release
handlers, verify lossless sparse/absolute/duplicate coordinates, exercise actual
watch/rewatch/unwatch/undo mutations, and check partial-reset invalidation.

Deployment includes the explicit production summary backfill and a VPS import/apply run.
Run `scheduleCacheIndex:backfillPage` with null cursor and resume its
`continueCursor` until `isDone` before measuring indexed cache pruning.
Compare production future-count results for every existing user and inspect
Convex execution-log database I/O before/after. Verify the live Home and Schedule.
Fixture byte counts exclude Convex index costs and retries; they are not billing
forecasts. Already consumed monthly I/O is not reversed by deployment.

For rollback, restore the original reads and singleton runner. Keep watched
history and user statuses intact. The optional summaries can remain unused;
any later re-enabling must regenerate summaries if watch mutations stopped
maintaining them during rollback.
