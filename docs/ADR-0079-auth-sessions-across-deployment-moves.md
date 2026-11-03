# ADR-0079: Preserve browser sessions across deployment moves

Convex Auth defaults its token storage namespace to the backend URL. A region
move changes that URL, which otherwise hides the website's existing refresh
tokens. Password users can sign in again, but anonymous users cannot recover
their accounts that way.

The app accepts an optional `EXPO_PUBLIC_AUTH_STORAGE_NAMESPACE`. An existing
website keeps its previous namespace when changing backends; new environments
leave it unset and retain deployment-specific storage. This changes neither
authorization nor ownership checks. The complete auth/session tables must be
restored alongside the application data. An old access token is rejected by the
new issuer and the existing refresh token obtains a token for the destination.

Deployment moves require a final snapshot after source writes have stopped.
Configuration and pending scheduled functions are separate from the snapshot.
`sharedGames.restoreExpirationSchedules` restores share cleanup in bounded,
transactional pages, with a unique restore ID making retries idempotent. It is
an internal operation invoked explicitly after a restore, never from app reads.

Verify both existing-session refresh and fresh password login on the live
website, including a guest account, before considering a move complete.
