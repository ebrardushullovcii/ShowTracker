# UX Plans

Focused implementation plans for UX issues captured in `docs/UX_BACKLOG.md`.

These plans are intentionally separate so each can be designed, implemented, reviewed, and verified independently unless an implementation naturally shares a component.

## Plans

1. `01-tabs-and-filters.md` - Rework in-page tabs, filters, and optional swipe between sections.
2. `02-stable-counts.md` - Keep counts from dropping to zero during loading/refetch transitions.
3. `03-back-navigation-and-headers.md` - Add explicit back affordances to detail/create pages and reuse sparse header space.
4. `04-show-detail-actions.md` - Compact show status and show-level actions into header/action controls.
5. `05-episode-collapse-icons.md` - Improve season accordion collapse and expand affordances.
6. `06-mobile-episode-swipe-actions.md` - Add mobile swipe actions for episode watch-state changes.

## Browser Inspection Notes

Expo web was started with:

```sh
CI=false ./node_modules/.bin/expo start --web
```

The app was inspected at `http://localhost:8081` in the in-app browser on a mobile-width viewport. Authenticated state was already available in the browser session, so `.env.test` credentials were not read or transmitted.

Observed routes:

- `/home`
- `/library`
- `/discover`
- `/show/tmdb%3Atv%3A615`
- `/list/create`

Follow-up visual QA should repeat these routes on both mobile and desktop widths after implementation. Use Chrome DevTools MCP for debugging when needed and `npm run ui:inspect:quick` for route/theme screenshot sweeps after UI changes.
