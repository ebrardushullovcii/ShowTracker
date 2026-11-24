# ADR-0081: Require owner approval for new accounts

ShowTracker can restrict new accounts during its limited rollout. Existing users,
including anonymous users, retain access without a migration: a missing approval
status means approved. Account creation assigns new users a pending status in the
same transaction as their authentication record. The owner can later switch new
registrations to automatic approval; existing pending requests remain pending.

Pending users receive an authenticated session so they can see their status,
sign out, or delete their account. The app withholds private screens and provider
hooks until approval. Public app-data functions enforce approval before doing
work. The AniList HTTP proxy checks approval for requests with a token and
requires a token while registration is restricted. Older web clients can still
use the proxy during open registration. New anonymous sign-in is disabled while
approval is required; existing guest sessions remain valid. Public shared-game
snapshots retain their token-based access. Token-protected schedule maintenance
and all internal jobs retain their existing behavior.

Approval is included in signed access tokens. Older tokens belong to existing
accounts and remain valid. Approved tokens need no extra users lookup on each
request. Pending tokens check the user record so approval works immediately,
without requiring another sign-in. This policy grants access; it does not add
account suspension or revoke already-approved tokens.

The web dashboard is `/admin` on the existing Netlify app. Its Convex functions
require a user ID from the server-only `SHOWTRACKER_ADMIN_USER_IDS` allowlist,
checked against the authenticated caller. Emails and profile fields never grant
owner permissions. Configure the intended deployment's owner ID through the
Convex environment before publishing the dashboard. User lists are paginated,
with an index for pending requests; there is no polling, new server or database.

Ship the backend and dashboard with open registration while the first iPhone
update is in review. Set `SHOWTRACKER_REQUIRE_APPROVAL_BY_DEFAULT=false` on
production before deployment. Once the updated client is available, the owner
can enable approval from the dashboard. A saved registration policy overrides
the deployment default. Development previews use a
separate Convex deployment and token namespace. Production rollout keeps the
existing auth storage namespace (ADR-0079), and pending users keep the account
deletion flow (ADR-0080). Approval does not change provider licensing obligations.
