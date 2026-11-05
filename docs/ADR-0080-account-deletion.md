# ADR-0080: Account deletion removes owned data in bounded jobs

App Store distribution requires an account-deletion entry point for password and guest accounts. Profile Settings provides one confirmation that explains the permanent removal and requires typing DELETE. The mutation takes no user ID: ownership comes only from the authenticated caller. Repeated requests share one deletion job.

The job removes sessions and their refresh tokens and verifiers, provider accounts and their verification codes and rate limits, all private account tables, shared games, and the user record. Reads use ownership indexes and bounded pages; large content pages also have a byte budget. Shared catalogue records, provider caches, and other accounts are preserved. This is an explicit account operation, never navigation-triggered repair or an aggregate rebuild (ADR-0077).

JWT creation and refresh reject an account with a pending deletion job. Existing access tokens have the unchanged one-hour lifetime. A second bounded sweep runs after two lifetimes to remove writes from older access tokens or already-running jobs, then removes the deletion marker. The app signs out after accepting the request and states that removal normally completes within 24 hours. The reconciler already removes SQLite library rows absent from each completed Convex import, so its next scheduled import removes the account’s maintenance copy. Backups retain their existing provider retention rather than restoring a deleted account.

Verification covers unauthenticated requests, caller ownership, idempotence, large histories and auth descendants, preservation of another account and shared catalogue, and the delayed sweep. Exercise the real flow with disposable accounts only.
