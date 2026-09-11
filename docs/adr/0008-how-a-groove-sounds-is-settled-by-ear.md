# 0008. How a groove sounds is settled by ear

- **Status:** ✅ Accepted
- **Date:** 2026-08-29
- **Source:** [feature-3, epic 2 Q1 and Q4](../../specs/features/feature-3/prd/)

## Context

"The grooves must sound natural" was the briefing's hardest requirement and the
one no test can assert. The epic needed an acceptance bar anyway.

## Decision

A listening pass by the briefing's author is the bar. The automated checks — the
quality gate's thresholds, the loudness ceiling, the event-density floors — are
a regression net, not the standard. A rejection sends the epic back to tuning.

## Consequences

- Every release that changes what the grooves sound like ends in a human
  listening to them, which is why `SIGN_OFFS` exists and why re-rendering voids
  its pins ([0024 — Swapping the recording behind a voice is a normal change](0024-swapping-a-voice-is-a-normal-change.md)).
- The `musician` agent decides musical parameters and writes no generator file
  ([0026 — The work is specified in documents, then built by specialised agents](0026-the-work-is-specified-then-built-by-agents.md)), because the decision is
  a judgement and the edit is not.
- An epic can be green and not done, and there is no way to automate the gap.
- feature-18 was accepted on this basis and not on a `/verify-epic` pass.

## Alternatives considered

- **A checklist of measurable proxies as the bar** — gradeable, and it would
  have shipped grooves that pass every number and sound like a drum machine.
