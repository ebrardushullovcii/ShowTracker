# ADR-0062: Explicit Watching can appear before the first episode

## Context

The first-save editor promises that Show on Home now sets Watching and puts the
title in the active Home watchlist. Convex already accepts Watching titles with
zero watched episodes, but Home's final client filter rejected them. Newly added
Kyousougiga, Ping Pong the Animation, Run with the Wind, and Descending Stories
therefore disappeared despite positive released backlogs. Save for later placed
titles in Haven't started, contradicting its description that they stay off Home.

## Decision

An explicit Watching status is sufficient intent to enter the active Home queue
before watching episode one. The title must still have an actionable episode
under ADR-0027 and ADR-0029. Caught-up and future-only shows remain hidden until a
release qualifies under the user's airtime setting. Shared watches retain their
own section and ADR-0060 availability rules. Completed titles still need release
attention; Planned, Paused, Dropped, and upcoming tracking keep their section rules.

Save for later continues to mean Planned in Home's Haven't started section and
Library. The editor describes this placement directly. It does not promise that
the title disappears from all of Home.

The active client predicate lives beside the shared visibility predicate so tests
exercise the production section rule. No provider facts, watched episodes,
statuses, companion names, backend functions, or stored projections are rewritten.

## Verification and rollback

Cover zero-progress Watching with released backlog, future-only and caught-up
rows, both airtime modes, other sections, and completed-show reactivation. Check
the affected production titles and compare the other Home sections. Reverting
the client predicate and editor copy rolls this change back without data repair.
