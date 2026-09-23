# ADR-0066: Bottom Home Section Loads On Scroll

## Status

Accepted. Refines the section pagination described in ADR-0022.

## Context

On September 23, 2026, the user asked for the Haven't started section to stop
showing Show more. It is the last section on the Home Watchlist. The sections
above it keep Show more because other content follows them, but a button at
the very end of the page only adds a press before the reader can keep
scrolling.

The three secondary sections also shared one query limit derived from the
paused and not-started visible counts. Growing the backlog refetched the paused
and shared feeds with larger limits they did not need, and the shared-watch
section ignored its own visible count, so its Show more could not raise its own
query limit.

## Decision

- Haven't started has no Show more button. On web, it appends its next page
  when the Home scroll position is within `max(480px, 75% of the viewport)` of
  the end of the page. After each appended page or newly resolved feed rows,
  Home re-reads the live scroll node, so a page shorter than the viewport keeps
  filling until it can scroll or the backlog ends.
- A compact loader sits at the end of the section while more rows exist or a
  larger feed page is loading.
- Watching with others, Paused, and the active list keep their buttons.
- Each secondary section computes its own query limit from its own visible
  count, still two pages ahead of what is shown.
- On native, reaching the end of the Home list loads the backlog first when it
  has more rows, and otherwise loads the active list as before.

The rules live in `lib/tracking/home-section-pagination.ts`.

## Reasoning

Loading on scroll matches how people read the end of a list, and nothing below
the backlog needs protecting from an ever-growing section. Starting the load
before the last row is visible hides the append. Per-section limits keep Convex
reads proportional to what each section shows, which matters more once the
backlog can grow without a deliberate press.

ADR-0022's held feed values are unchanged: a larger backlog query keeps the
previous page on screen while it resolves.

## Edge Cases

- A hidden or unmeasured scroll view reports zero height and never loads.
- While a larger feed page resolves, has-more is false until the new rows
  arrive, so loads do not stack. The loader stays visible during that wait.
- One page is requested at a time. The pending request is released after the
  next committed page or feed change.
- Switching to Schedule and back remounts the scroll view at the top, so
  nothing loads until the reader scrolls down again.
- When Haven't started is empty, for example under a media filter with no
  backlog titles, the section above it keeps its Show more button.
- `getHomeNotStartedFeed` returns at most 120 rows, so loading stops there,
  as Show more did before.

## Verification

```bash
npx tsx --test lib/tracking/home-section-pagination.test.ts
npx tsc --noEmit --pretty false
npm run lint
```

Production check on web Home: Haven't started shows no Show more; scrolling to
the bottom appends backlog rows until the count pill loses its `+`; Paused and
Watching with others keep Show more; the same holds at phone width.

## Rollback Notes

Restore the Show more button in the Haven't started section and remove the
scroll handlers from the web Home scroll view. Per-section query limits can
stay; they do not change which rows are eligible for any section.
