# PRD — Epic 3: It sounds played

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The deviation model stops being white noise and starts behaving like limbs. Each
voice gets a consistent lean, declared per template — the snare behind the beat,
the hats slightly ahead — deviations correlate from one hit to the next instead
of being drawn independently, the bass locks to the kick, and the snare finally
plays ghost notes. The tempo breathes a little within each pass. Along the way
the pack's dynamics stop being applied twice, which is what makes a hi-hat jump
in level for no musical reason — and because that changes every groove's level,
this epic re-tunes the templates' levels to match.

## Problem

`humanize.ts` draws an independent, uniform, bipolar deviation for every event.
That is jitter, not feel: real timing error is systematic (a drummer's snare
sits consistently behind their kick) and correlated (consecutive hits drift
together). Independently random onsets read as sloppiness. Separately, velocity
is applied twice — `pack.ts` selects a velocity layer, then `voices.ts`
multiplies the chosen sample by velocity again — which squares the dynamic
range and puts an audible level step at every layer boundary. The hats sit right
on a boundary at 0.45, so they flip layers hit to hit as the existing jitter
crosses it.

## Scope

- Per-voice timing lean, declared per template as one signed value per voice.
- Correlated, gaussian deviations replacing independent uniform draws.
- The bass's timing derived from the kick's.
- The doubled-dynamics fix, in the pack interface and the voices stage, and the
  template level re-tune that follows from it.
- Real snare ghost notes and hat accent shapes.
- A small tempo drift within each pass.
- Density bands re-tuned to admit what the above produces.

**Out of scope**
- **Which instrument sounds.** Epic 2 chooses the samples; this epic decides how
  hard and how late they are struck.
- **Which notes are played** — voicings, bass-line writing, note lengths, the
  room. Epic 4.
- **New voices.** Epic 5 adds toms and a crash.
- **The loop's length or pass structure.** Epic 1 owns those; this epic's
  deviations are drawn per pass because Epic 1 made them so.
- **A groove's answer.** Nothing here draws from the `:music` stream.

## Requirements

- **R1** — Each template declares one signed timing offset, in milliseconds, per
  voice, applied consistently to every hit of that voice in every groove
  rendered from it. There is no shared default: a lean is as much a property of
  a feel as its swing is, and a shuffle and a half-time groove do not lay back
  by the same amount.
- **R2** — The snare leans late and the hats lean early.
- **R3** — A voice's deviation from one hit to the next is correlated: adjacent
  hits move together rather than independently.
- **R4** — Deviations are drawn from a distribution concentrated near zero, so
  a large deviation is rarer than a small one.
- **R5** — The bass's timing deviation is derived from the kick's at the same
  metric position rather than drawn independently.
- **R6** — No event is displaced far enough to be read as landing on a
  neighbouring subdivision, whatever combination of lean, correlation and drift
  applies to it.
- **R7** — Deviations remain fully determined by the groove's seed and template.
  Nothing reads the clock or calls `Math.random`.
- **R8** — A sample's loudness is applied once. An event's velocity selects the
  layer, and the rendered level reflects that layer's own recorded loudness plus
  the event's position within the layer's band — never the layer's loudness
  multiplied by the raw velocity again.
- **R9** — Amplitude is monotonic and continuous in velocity: a velocity swept
  from 0 to 1 produces a level curve with no step at a layer boundary.
- **R10** — The snare plays ghost notes on off-beat subdivisions, at velocities
  well below the backbeat.
- **R11** — Hi-hat velocity follows a repeating accent pattern over the bar,
  rather than being a function of metric position alone.
- **R12** — Kick, snare, bass and comp accents continue to read from metric
  position: the backbeat lands above what surrounds it.
- **R13** — A groove's tempo varies slightly within each pass, returning exactly
  to where it started at every pass boundary, so each pass is exactly its
  nominal length, the loop length is unchanged, and the seam is unaffected.
- **R14** — Every template's note-density band admits the grooves this epic
  produces, so the gate rejects for musical reasons and not for arithmetic ones.
- **R14a** — Every template's per-voice levels are re-tuned for the corrected
  dynamics scaling. The fix and the levels it implies land together, so no
  intermediate commit renders the catalogue at a balance nobody chose.
- **R14b** — Those levels are a corrected baseline, not a final answer. Epic 2
  adjusts them freely from this starting point when it swaps the samples
  underneath them.
- **R15** — Every groove still passes peak, silence, seam, harmony and density.
- **R16** — No groove's `id`, `bpm`, `root`, `flavour`, `scale`, `chord` or
  `progression` changes.

## Behaviour details

**The three timing terms, applied in order.** A hit's final onset is its grid
position plus swing, plus:

1. **Lean** — a constant per voice per template. The snare's lean is the same
   8–15 ms on every snare hit in the groove. This is what a listener hears as
   "laid back", and it is the largest audible change in this epic.
2. **Correlated deviation** — a random walk per voice, so hit *n+1* starts from
   near where hit *n* landed. This is the "player" term.
3. **Drift** — a tempo envelope shared by all voices, zero at the start and end
   of each pass.

Only the second and third are random; the first is a declared property of the
feel. All three are bounded together by R6, not individually: the clamp applies
to the sum, because it is the sum that could push a note into the next slot.

**Why the dynamics are wrong today.** `pack.ts` picks the first layer whose
`maxVelocity` covers the request, and returns the sample. `voices.ts` then calls
`addAt(..., gain: event.velocity)`. The layers were deliberately not normalised,
so an `fff` sample is already louder than an `mp` one — multiplying by velocity
on top of that squares the range. Two consequences:

- Ghost notes nearly vanish and accents shout.
- At a boundary, velocity 0.44 gives the `mp` sample at 0.44 and velocity 0.46
  gives the `f` sample at 0.46 — a jump upward in level for a two-percent
  increase in intent. The hats sit at 0.45, and the humanize velocity bound is
  ±0.05 to ±0.13, so they cross that boundary constantly.

The fix is for the pack to report what loudness the chosen layer already
represents, and for the voices stage to scale *relative to* it. R9 states the
property that proves it worked, and it is testable without listening.

**Ghost notes today.** `GHOST_VELOCITY_THRESHOLD` exists and is asserted
against, but nothing plays a ghost — the assertion passes on quiet hi-hats. The
snare plays only the backbeat. Adding ghosts makes the constant mean what it
says.

**Why the drift resolves at every pass boundary.** Epic 1 makes the pass the
unit of performance, and a wander that resolves every four bars reads as a
player breathing rather than as the tape slowing down. It also gives the
zero-crossing guarantee several anchor points instead of one, so a rounding
error at the loop seam has fewer bars to accumulate over.

**Why this epic re-tunes the levels.** The doubled-dynamics fix changes every
groove's balance: ghost notes come up, accents come down, and the overall level
moves. Correcting the scaling without correcting the levels would leave the
catalogue at a balance nobody chose, so the two travel together. Epic 2 then
swaps the samples underneath and rebases its own `gain` work onto these values —
which is why Epic 2 merges after this epic. What this epic hands over is a
baseline computed against a fixed scaling, not a set of numbers Epic 2 has to
honour: the levels have to suit whatever samples are actually playing, so Epic 2
moves them as far as its new pack requires. `pan` is untouched here and remains
Epic 2's.

## Acceptance criteria

- **AC1** (R1, R2) — Given a rendered groove, when its snare onsets are compared
  with the grid, then every one is late by approximately the template's declared
  snare lean; and the hats are correspondingly early.
- **AC2** (R1) — Given every template, when its declaration is read, then it
  carries a signed lean for each voice it plays, with no value inherited from a
  shared default; and changing one changes the render.
- **AC3** (R3) — Given a voice's sequence of deviations in one pass, when
  successive differences are compared with the deviations themselves, then
  adjacent hits are closer to each other than independent draws would be.
- **AC4** (R4) — Given a large sample of deviations, when their distribution is
  measured, then values near zero occur substantially more often than values at
  the bound.
- **AC5** (R5) — Given a groove where kick and bass share a step, when their
  onsets are compared, then the bass tracks the kick rather than varying
  independently of it.
- **AC6** (R6) — Given any groove, template and seed, when every event is
  assigned to its nearest grid position, then every event is assigned to the
  position it was written for.
- **AC7** (R7) — Given the same spec rendered twice, when the two outputs are
  compared, then they are byte-identical.
- **AC8** (R8, R9) — Given a single voice and a velocity swept from 0 to 1, when
  the rendered peak level is plotted, then it increases monotonically and has no
  discontinuity at any layer boundary.
- **AC9** (R10) — Given a rendered groove, when its snare events are listed,
  then some fall on off-beat subdivisions with velocities below the ghost
  threshold, and the backbeat hits remain the loudest snare events in the bar.
- **AC10** (R11) — Given a rendered groove's hi-hat velocities, when they are
  read in order, then they follow a repeating accent pattern rather than being
  determined solely by each step's metric position.
- **AC11** (R12) — Given a rendered groove, when kick and snare velocities are
  compared across the bar, then the backbeat is louder than the events adjacent
  to it.
- **AC12** (R13) — Given a rendered groove, when the elapsed time at each pass
  boundary is measured, then each pass is exactly its nominal length; the whole
  loop is exactly the length the tempo and bar count imply; and the seam is
  within `SEAM_THRESHOLD`.
- **AC13** (R14, R14a, R15) — Given the whole catalogue, when the gate runs,
  then every groove passes every check; and given the template files, when they
  are diffed, then any density band and any level that moved did so there rather
  than in the gate or the mix stage.
- **AC13a** (R14b) — Given this epic's levels, when Epic 2 later changes one,
  then nothing in this epic's tests fails on the new value — the levels are not
  pinned.
- **AC14** (R16) — Given the manifest before and after, when they are diffed,
  then only `headDelaySeconds` differs, and Epic 1's answer-pinning test passes.
- **AC15** — Demo: the same seeds before and after, across all four templates.
  The snare is audibly behind the beat, ghosts are audible between the
  backbeats, and no hi-hat jumps in level.

## Dependencies

Needs nothing to start, and **merges before Epic 2**, which rebases its levels
onto this epic's. Two shared seams:

- **`templates/*.ts`** — this epic owns `humanize`, `density` and the first pass
  at `gain`; Epic 2 owns `pan` and has the last word on `gain` by rebasing;
  Epic 1 owns `passes`. Adding fields to `FeelTemplate` is what Epic 6 waits on,
  so every field this epic intends to add should land early rather than
  trickling in.
- **`events.ts`** — Epic 1 owns the pass loop and rng labels; this epic owns the
  velocities emitted inside it and the deviation model applied after it. The
  per-pass drift envelope reads the pass boundary Epic 1 defines.

It changes `SamplePack.get()`'s return shape to carry the chosen layer's nominal
loudness. Epic 2 only adds declarations to the pack, so the two compose.

## Assumptions

- The lean values are a small table on the template, in milliseconds, signed —
  the same shape as the existing `humanize` bounds rather than a new concept.
  A voice a template does not play needs no entry.
- The correlated deviation is a bounded random walk rather than a filtered noise
  source; both sound the same at this scale and the walk is easier to test.
- Every pass draws the same drift depth; passes differ in their deviations
  rather than in how much they breathe.
- The ghost-note pattern is drawn per template from a small vocabulary, in the
  same way kick and hat patterns already are.
- Layer nominal loudness is the midpoint of the layer's velocity band unless the
  pack declares otherwise. If measurement shows the recorded layers do not line
  up with their declared bands, the declaration is corrected rather than the
  scaling made cleverer.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. Where do the per-voice leans live?**
Answer: **A) Per template, one signed value per voice, no default** — lean is as
much a property of a feel as swing is, and a shuffle and a half-time groove do
not lay back by the same amount.
Applied to: Summary, Scope, R1, R2, AC2, Assumptions

**Q2. How is the loudness rebalance coordinated with Epic 2?**
Answer: **B) This epic re-tunes `gain` too, and Epic 2 rebases onto it** — the
scaling fix and the levels it implies stay in one change.
Applied to: Summary, Scope, R14a, AC13, Behaviour details, Dependencies — and
Epic 2, whose `gain` ownership and merge order this reverses

**Q3. Does tempo drift span the whole loop or each pass?**
Answer: **A) One envelope per pass, zero at each pass boundary** — a wander that
resolves every four bars reads as a player breathing rather than as the tape
slowing down.
Applied to: Summary, Scope, R13, AC12, Behaviour details, Assumptions

### Cycle 2 — 2026-08-31

**Q4. Who has the last word on the levels?**
Answer: **A) Epic 2 adjusts them freely from this epic's starting point** — the
levels have to suit the samples that are actually playing, so this epic's values
are a corrected baseline rather than a final answer.
Applied to: R14b, AC13a, Behaviour details
