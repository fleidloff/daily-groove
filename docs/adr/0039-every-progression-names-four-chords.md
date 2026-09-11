# 0039. Every progression names four chords

- **Status:** ✅ Accepted
- **Date:** 2026-09-04
- **Source:** [quick-2](../../specs/quick/2-always-four-chords.md)

## Context

The generator rolls three or four chords and wraps a three-chord cycle over the
four bars. The lead sheet ([0027 — The reveal teaches in degrees, on one screen](0027-the-reveal-teaches-in-degrees.md)) draws one
chord per bar, so seventeen grooves had a bar whose chord the manifest did not
name.

## Decision

Every groove's `progression` and `progressionDegrees` hold four entries, one per
bar. When the roll gives three, the generator appends the home chord as the
fourth — the same chord the audio already plays in that bar. The three-or-four
draw itself stays.

## Consequences

- Nothing re-renders. The draw is untouched, so the `events` stream and every
  MP3 are byte-identical and no past answer moves — the constraint
  [0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md) imposes on any change to the manifest.
- The seventeen affected grooves were fixed with `--manifest-only`, verified
  against `grooves.lock.json`.
- A manifest test asserts the four-ness, so the lead sheet can assume it.
