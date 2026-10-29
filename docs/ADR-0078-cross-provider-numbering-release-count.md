# ADR-0078: Cross-provider numbering does not add released episodes

In late October 2026, Detective Conan (`tmdb:tv:30983`) came back on Home
every night after the schedule-confidence run, even though the user had
watched all 1217 released episodes and the next one airs October 31. When the
user opened the show page, it fetched TMDB again, corrected the count, and the
show left Home until the next night.

TMDB numbers the whole run as season 1, episodes 1 to 1218. TVMaze numbers
it by year (`2026x31`). Most rows pair up by air date, but providers place
a few old episodes in different weeks, such as 1996 summer breaks and
1999/2012/2019 two-parters. Those nine TMDB rows have no TVMaze partner.
Because episode 1218 was already known, the reconciler counted released
episodes as the number of merged rows across providers. That gave 1226, nine
phantom episodes, and the result went to Convex as `releasedEpisodes` and
`totalEpisodes`. The import-floor rule (ADR-0015) then kept the inflated
`remainingEpisodes` going on the next run.

## Decision

When the tracked TMDB catalogue is dense from `S1E1` through its latest
released row (every season from 1 up is present and each season has episodes
1..N with no gaps), the released-episode count is:

```text
min(merged released rows, TMDB released rows + merged rows aired after TMDB's latest released day)
```

Other-provider rows that aired on or before TMDB's latest released day are
treated as different numbering of history TMDB already covers. Newer rows from
any provider still count, so a TVMaze episode that airs before TMDB lists it
still surfaces on Home.

If TMDB's rows are partial, such as only the latest season hydrated
(ADR-0040's Mushoku Tensei shape), the merged count is used as before. Row
sparsity checks still use the raw merged rows.

## Reasoning

Detail progress and Home projections use tracked TMDB coordinates (ADR-0026,
ADR-0058), so an unmatched old TVMaze row can never be marked watched on the
detail page. Counting it creates attention that the user cannot clear. The
rule can only lower the count, and only toward what TMDB itself lists.

## Verification

`npm run schedule-confidence:validate` includes a Conan-shaped fixture. Its
merged count is 14, but it must report 12 released episodes with the delayed
episode upcoming. It must also report 13 when a newer TVMaze row airs before
TMDB has it.

Running the old and new reconciler without provider fetches against a copy of
production SQLite changed only titles whose new count moved toward TMDB's
catalogue: Detective Conan 1226 to 1217, Bleach 419 to 416, The Fairly
OddParents 271 to 268, and Medici 48 to 24. No count went up.
