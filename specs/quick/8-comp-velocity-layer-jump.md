# 8 — Comp velocity layer jump

## What

* The piano comp leaps out on some downbeats — on `groove-40`, bar 2 and bar 3 beat 1 of the first pass.
* Cause: comp velocity crossing 0.8 swaps in the dyn3 sample, recorded ~10 dB hotter, while `gainFor` in `scripts/grooves/voices.ts` normalises only by nominal velocity — a net ~7.5 dB step for 0.002 of velocity.
* On `groove-40` it hits 4 of 96 comp notes: bars 2, 3, 15 and 16, all on beat 1.
* Smooth the step so no single comp note jumps out of the part.
* Three candidates, none picked: calibrate each layer's `nominalVelocity` to its measured loudness; crossfade the layers over a velocity band; keep post-humanize comp velocity under the boundary.
* Confined to `scripts/grooves/` — rendering only, so no RNG draw changes.

## Done when

* Re-rendered `groove-40`: the comp peaks of bars 2 and 3 sit within a few dB of the other fourteen bars, and nothing pops by ear.
* A generator test pins the layer transition — two comp notes either side of a boundary render within a few dB of each other.
* The full catalogue re-renders and the quality gate plus `grooves:verify` still pass.
* `src/lib/hash.ts` and the `events` draw order are untouched: the groove of the day and every past answer are unchanged.
