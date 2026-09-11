# 0026. The work is specified in documents, then built by specialised agents

- **Status:** ✅ Accepted
- **Date:** 2026-09-01
- **Source:** [feature-14](../../specs/features/feature-14/briefing.md) · [docs/skills.md](../skills.md)

## Context

Every feature was taking longer than the last. `GroovePuzzle.tsx` was touched in
13 of the last 14 feature commits, which serialised the implementation waves,
and every dispatched worker carried the whole of the documentation with it.

## Decision

A feature goes through five documents in one order — briefing, roadmap, PRDs,
tech specs, code — each read by the step after it. Questions are asked as
tickable options inside the document and folded in on the next run, so a step
cannot proceed on unsettled requirements. Six role agents do the building:
`architect`, `implementer`, `test-writer`, `verifier`, `musician`, `sam`. A
quick door — one ticket, built in the lead — exists for changes too small to be
worth the chain.

## Consequences

- Each agent carries only its role's documentation, which is what made the
  dispatch affordable.
- Epics own disjoint files so they can be built at once, and the tech spec's
  tracks declare a role each for exactly that reason.
- The `verifier` grades and cannot fix, which is the one property the lead
  cannot have. The `musician` decides and writes no generator file, for the same
  reason [0008 — How a groove sounds is settled by ear](0008-how-a-groove-sounds-is-settled-by-ear.md) separates the judgement
  from the edit.
- `sam` answers as the persona, so a product call is made in the player's voice
  rather than by whoever is holding the keyboard — and answers "no persona
  bearing" when it is not its business.
- The process is the repo's largest single cost. Four documents precede any
  code, and skipping step 3 is the failure mode `docs/skills.md` warns about
  twice.
- Nothing is committed until the row in `specs/features.md` reads ✅ Done.
