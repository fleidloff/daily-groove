# 24 — Raise the bass sustain default

## What

* Every feel's drawn bass notes ring longer, not just `open-ballad`'s.
* `BASS_SUSTAIN_DEFAULT` in `events.ts` is the **cap** that goes 2 → 3. The floor stays
  at 2.
* So a note whose gap to the next bass onset is 3 or more goes from 2 to 3; a note with
  a gap of 1 or 2 does not move at all. No feel gains an overlap it does not already
  have.
* Not a flat 3. The shared `BASS_PATTERNS` are `[0,6,10]`, `[0,3,10]`, `[0,6,10,14]` and
  `[0,8,14]`, and an approach note is inserted on the last sixteenth, so steps 14 and 15
  sit one sixteenth apart — a flat 3 would overrun both by two and ring an off-scale
  approach note ~300 ms under the next chord in every feel.
* `open-ballad` keeps its own `bassSustain: 5` and is unaffected.
* The nine walking-bass grooves are unaffected: their notes set `note.sustain`
  explicitly, which takes precedence.
* **Fred's waiver, in his words: "please make a quick-feature out of it. It affects many
  songs but the implementation is minimal."** Said after being told this fails the size
  test's third question — 45 of 54 grooves re-render and most of the 20 `SIGN_OFFS` pins
  void, each needing an ear.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* A drawn bass note with room rings 3 sixteenths where it rang 2, in every feel that
  declares no `bassSustain`.
* A note whose gap to the next bass onset is 1 or 2 sixteenths is unchanged.
* `open-ballad`'s five grooves and the nine walking-bass grooves render byte-identical.
* Every re-rendered mp3 and the lock are committed, and each feel's `gain.bass` is
  re-measured or explicitly left alone with the measurement that says why.
* Every voided `SIGN_OFFS` pin is re-pinned in the words of a listening pass, or the
  ticket says which are still owed.
* A test covers the raised cap and the unchanged floor.
