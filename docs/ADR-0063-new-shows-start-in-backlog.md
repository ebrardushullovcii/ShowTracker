# ADR-0063: Newly added shows start in Haven't started

## Context and decision

ADR-0062 misinterpreted the desired Home placement. Adding a show should put it
in Haven't started, not imply that the user is already watching it. The separate
Show on Home now and Save for later choices made the same basic add action
unnecessarily confusing. This decision supersedes ADR-0062.

Adding a TV series or anime is one action: save it as `plan_to_watch`. It appears
in Home's Haven't started section and Library. There is no first-save placement
dialog. Watching becomes appropriate when an episode is actually marked watched;
the existing progress aggregation already changes Planned to Watching after the
first episode, and back to Planned if all watched progress is undone.

Regular active Home requires positive watched progress. The manual status
mutation converts zero-progress regular Watching requests to Planned, including
requests from cached clients. The frontend uses the returned status. Existing
incorrect zero-progress rows identified in a report can be corrected through
the authenticated status mutation without changing episode history.

The explicit Watching with others mode remains available with its companion
metadata and dedicated Home section (ADR-0059/0060). Movies retain their existing
status meanings. Paused, Dropped, Completed, and provider/release facts are not
reclassified. Caught-up and future-only filters still apply to active/shared rows;
Planned titles remain in Haven't started regardless of release availability.

## Verification and rollback

Verify new additions save as Planned, cached Watching requests with zero progress
normalize to Planned, and progress changes drive the first/last-episode transition.
Check the reported titles in the production Haven't started query and their
absence from active Home; verify unrelated tracking rows are unchanged. Validate
the simplified Add control and deployed bundle, and deploy Convex with the UI.

Rollback requires reverting the UI and mutation together. Corrected Planned rows
need no rollback: they preserve the user's intended unstarted state.
