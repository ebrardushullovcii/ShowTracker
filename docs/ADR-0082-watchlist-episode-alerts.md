# ADR-0082: Watchlist episode alerts

Home Watchlist and iOS episode alerts use the same Episode Availability
preference. Same-day episodes become actionable at the start of their scheduled
day in the user's time zone. Confirmed timestamps are interpreted in that zone.
After-airtime episodes become actionable at the confirmed timestamp. Schedule
entries with a date alone become actionable at the start of that day in either
mode. Alert wording distinguishes a date alone from a confirmed airtime.

ShowTracker enables alerts by default and prompts approved users for iOS
permission. The ShowTracker switch applies across the account and iOS permissions
apply to each device. The last registered iPhone supplies the account time zone
for background scheduling. Device registrations are tied to the active auth
session and removed during account deletion.

Convex uses existing schedule projections, cached facts, and the Watchlist's
watched-episode filtering. Schedule reconciliation and timing-setting changes
can bring forward the next scheduled check. Each check covers the surrounding
schedule dates and sets the next relevant airtime or local day boundary. Episode
delivery is claimed by the user's tracked show and episode coordinates so
rescheduling the same episode does not send another alert. The delivery claim
is recorded before the Expo request to avoid duplicate alerts when delivery is
ambiguous. Expo receipts retire invalid device tokens. iOS and Expo control
delivery after the request, and same-day alerts use passive presentation.
