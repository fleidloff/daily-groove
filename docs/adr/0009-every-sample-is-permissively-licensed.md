# 0009. Every sample is permissively licensed, and the credit ships

- **Status:** ✅ Accepted
- **Date:** 2026-08-29
- **Source:** [feature-3, epic 1 Q2 and Q4](../../specs/features/feature-3/prd/)

## Context

A generator is worth nothing without recordings behind it, and the app is
public. Commercial sample libraries are out on licence grounds alone.

## Decision

Only CC0 or CC-BY sources. Every file's origin, licence and preparation is
recorded in `scripts/grooves/samples/provenance.json`, and a CC-BY source's
attribution renders in the app.

## Consequences

- The app owes exactly two credits, both DrumGizmo's — MuldjordKit for the kit
  and DRSKit for the ride — and both are rendered under the groove box.
- Sourcing is a human hand-off and blocks the epic that needs it: the pack had
  to arrive before feature-3's epic 1 could be called done.
- A voice the libraries do not have is a sourcing problem before it is a code
  problem. feature-24 spent its first move auditioning jazz rides and settled
  on DRSKit's over one that measured better, for licence and character reasons
  recorded in `samples/README.md`.
- Sample quality is capped by what CC0 and CC-BY offer, which is the ceiling
  every feel's mix works under.
