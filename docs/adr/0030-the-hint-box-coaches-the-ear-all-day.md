# 0030. The hint box coaches the ear for the whole day

- **Status:** ✅ Accepted
- **Date:** 2026-09-02
- **Source:** [feature-18](../../specs/features/feature-18/briefing.md)

## Context

The one piece of ear coaching in the app — "Sing the note that feels like rest
— that's usually the root" — disappeared on the first guess and never came back.
The fastest guesser spent it, and everyone else never saw it again.

## Decision

A how-to-listen line stays in the hint box for as long as the puzzle is open,
and rotates as the misses add up — hum the bass note on beat one, compare the
third against a major scale, listen for what changes in bar three. The move is
chosen from what the miss showed: mode right and root wrong is a different
listening job from root right and mode wrong. It says what to listen for, never
what the answer is.

## Consequences

- The coaching sits in the hint box that already exists, within reach of the
  loop, which is the placement problem [0027 — The reveal teaches in degrees, on one screen](0027-the-reveal-teaches-in-degrees.md)
  left open.
- Nothing new appears once the day is over — the solved panel stays the thing
  that explains the answer.
- It is not a lesson: no curriculum, no levels, no reading, one line at a time.
- The line took the slot the verdict line used to hold, and the narrowing count
  drops once the root is confirmed, because there is nothing left to narrow.
- feature-18 was accepted by ear rather than on a `/verify-epic` pass.
