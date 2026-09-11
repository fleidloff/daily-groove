# 0011. A minted groove's audio is frozen forever

- **Status:** ⛔ Superseded by [0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md)
- **Date:** 2026-08-29
- **Source:** [feature-3, epic 4 Q1 and Q5](../../specs/features/feature-3/prd/)

## Context

A groove a player has heard is history. Re-rendering it changes what a past day
sounded like. The first answer was to forbid it outright, starting at the merge
of feature-3's last epic.

## Decision

Once minted and merged, a groove's audio never changes. `grooves.lock.json`
holds its checksum and the build refuses a mismatch.

## Consequences

- Every improvement to the generator applied only to grooves minted after it,
  so the catalogue would have aged in layers.
- Withdrawn six days later by feature-9, whose whole premise — better samples,
  real fills, correlated timing — was a re-render of everything.
