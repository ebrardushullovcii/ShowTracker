# ADR-0056: TV Time Resolution Retries

## Status

Accepted

## Context

The browser resolves a full TV Time GDPR archive by calling public metadata providers for hundreds of
titles. A production import resolved most of a 343-item archive but reported 15 common movies as
unresolved, including `Kidnap`, `The Hunger Games: Mockingjay - Part 1`, and `Harry Potter and the
Half-Blood Prince`. The same archive and titles resolved in complete provider-backed audits.

Provider helpers intentionally turn individual request failures into absent candidates so one failed
request does not abort the full import. Under temporary request pressure, that behavior made a failed
batch indistinguishable from a genuine no-match result and silently omitted valid titles.

## Current Behavior

TV Time items resolve with at most two items in flight in the browser. An empty or failed item
resolution is retried up to three times with exponential delay. Successful items are never retried.
If all attempts remain empty, the title is reported both as unresolved and as a failed lookup.

Rerunning an archive remains idempotent. Existing canonical episodes are skipped or enriched, while a
title omitted by an earlier transient lookup is inserted when a later resolution succeeds.

## Decision

- Limit GDPR item-resolution concurrency to two in the browser.
- Retry empty resolutions as well as thrown resolution errors.
- Use three bounded attempts with a short exponential delay.
- Preserve the final empty resolution so genuine no-match titles remain visible to the user.
- Mark exhausted empty resolutions as failed lookups instead of presenting them as ordinary misses
  only.
- Do not retry Convex writes through this mechanism; write idempotency remains owned by the import
  mutation.

## Reasoning

An empty candidate set is not reliable evidence of a missing title when all underlying network errors
are deliberately contained. Retrying only the small failed subset costs less and is safer than raising
global concurrency or restarting the entire import. Lower concurrency reduces burst pressure from each
item's title, alias, year, details, season, and external-ID requests.

## Provider And Data Assumptions

TMDB and TVMaze can temporarily throttle or fail browser requests. Successful responses remain cached
by the provider clients. A second item-resolution attempt therefore reuses successful work while
retrying calls that produced no cached result.

## Edge Cases

- A genuinely unknown title performs three attempts and remains unresolved.
- A thrown provider error on every attempt is surfaced through the existing failed-title reporting.
- A partial archive import can be rerun without resetting the account; source and provider identity
  prevent duplicate watched records.
- Retrying resolution does not retry or duplicate a completed Convex import batch.

## Verification

- Unit-test recovery after two empty results and exhaustion at the configured attempt limit.
- Resolve the complete 343-item archive with browser-equivalent concurrency and verify zero unresolved
  titles.
- Resolve the reported movie titles directly against production provider configuration.
- Run importer tests, TypeScript, lint, React Doctor, and Convex dry-run validation.
- After deployment, rerun the same archive and confirm the previously omitted titles are added while
  existing records are reported as unchanged.

## Rollback Notes

Restore direct single-attempt resolution and concurrency four. No stored-data migration is required;
the retry policy changes only how candidates are gathered before the existing import mutation runs.
