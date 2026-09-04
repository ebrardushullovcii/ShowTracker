# ADR 0061: Minimal agent guidance

Status: accepted (2026-09-04).

## Context

The guidance cleanup in commit `40a1123` removed vendored skills and redundant workflow docs. Their skill lock remained even though no project skills were installed. Requiring another ADR for every patch also duplicates decisions already recorded by the existing ADRs.

## Decision

Keep the root agent guide, all existing ADRs and their index, and product and operational references. Do not recreate removed skill directories, lock files, generated adapters, status logs, or handoff plans. Current task state belongs in the session and git history.

Read relevant ADRs before changing the behavior they govern. Create an ADR for a new or revised durable decision, including a deliberate change to an existing contract. A fix restoring an accepted decision can cite that ADR. This replaces the blanket new-ADR-per-behavior-change rule in the agent guide and decision map.

## Consequences

Decisions remain discoverable without prescribing a documentation task for every code change. Observed code behavior does not automatically supersede an accepted decision. Deployment preferences, provider identity and release correctness constraints remain unchanged.
