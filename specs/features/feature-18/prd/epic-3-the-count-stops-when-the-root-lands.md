# PRD — Epic 3: The count stops when the root lands

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The `N roots ruled out. Narrowing as you go.` line exists to tell the player the
root row is getting smaller. Once a check has confirmed the root, the row has
already collapsed to one live chip and there is nothing left to narrow, so the
line stops making sense. This epic withdraws it the moment the root is
confirmed, and keeps it withdrawn for the rest of the day.

## Problem

Feature-17 locks the root row to one live chip when a guess matches the root.
The narrowing count keeps counting anyway, so a player who has found the root
reads "2 roots ruled out. Narrowing as you go." under a row that has visibly
finished narrowing. The line contradicts the row above it.

## Scope

- **In:** the condition under which the count line is shown.
- **Out:** the count's copy, how the eliminated roots are computed, the coaching
  line and the verdict line, which Epics 1 and 2 own.

## Requirements

- **R1** — The count line is not shown while the root is confirmed.
- **R2** — Once withdrawn for a confirmed root, it does not come back on a
  later miss that day.
- **R3** — Confirmation is read from the same `confirmedHalves` result the chip
  rows lock from, not re-derived.
- **R4** — Nothing else in the Hint box changes: the coaching line, and the
  verdict where it shows, are untouched.

## Acceptance criteria

- **AC1** (R1, R3) — Given two misses that eliminated roots, when a third guess
  confirms the root, then the count line is gone and the coaching line remains.
- **AC2** (R2) — Given a confirmed root, when another wrong pair is checked,
  then the count line is still absent.
- **AC3** (R1) — Given the first guess confirms the root, when misses follow,
  then the count line never appears.
- **AC4** (R4) — Given a day with no confirmed root, when roots are eliminated,
  then the count line behaves exactly as before.

## Dependencies

Feature-17's `confirmedHalves`. No dependency on Epics 1 or 2 beyond sharing the
Hint box.

## Question log

None — the briefing bullet is unambiguous.
