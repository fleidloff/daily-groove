# PRD — Epic 4: The comp stops being perfect

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The comp — the chordal keyboard, sampled from VSCO 2 CE's upright piano, the
voice the briefing calls the rhodes — plays every chord at one of three
velocities forever, chosen by nothing but where the chord lands in the bar. This
epic gives it a velocity curve, so the chords breathe across a bar and across a
pass. The instrument does not change: the sound is good, its evenness is the
problem.

## Problem

`accentedVelocity('comp', step, sixteenth)` is a pure function of metric
position. `VELOCITIES.comp` declares `{ strong: 0.72, medium: 0.62, weak: 0.52 }`
and `velocityFor` picks one of the three by `step % 4` and `step % 2`. On top of
that sits a fixed drop per voice down the chord — `COMP_VOICE_DROP` — and the
template's humanize noise, which for `straight-funk` is ±9 %.

So a chord on a downbeat is 0.72 in bar 1 of pass 1 and 0.72 in bar 4 of pass 4,
give or take a few percent of noise. Nothing accents a phrase, nothing leans into
a bar, nothing plays the second half of the loop differently from the first. The
hats were given `HAT_ACCENTS` in feature-9 for exactly this reason, and the doc
comment there says so out loud: without it "every hat at a given step class is
the same velocity forever, which is the flat, machine-like hat the epic is
about". The comp was left out of that fix and is the loudest remaining example of
it — and it is the voice carrying the harmony the player is trying to name.

The samples may be a ceiling. The comp declares eleven sampled notes with three
velocity layers each and a **single** round-robin alternate per layer, so a
wider velocity spread selects between three recordings more often rather than
producing more shades.

## Scope

- A velocity curve for the comp: how hard each chord is struck, across a bar and
  across a pass.
- The interaction with what already shapes the comp — the metric accent, the
  per-voice drop down the voicing, the roll across the chord, and humanize.
- Establishing whether three layers × one alternate can carry the result.
- Keeping the twelve reference notes usable as reference notes.

**Out of scope**
- **Changing the instrument.** No new comp samples, no swap for an actual Rhodes,
  no new pack entry. The briefing is explicit that the sound itself is good.
- **The bass**, which is a separate pitched voice with its own layers and its own
  line.
- **The harmony.** Which notes the comp plays, the voicing, the voice leading and
  the register window are all untouched.
- **The drums** — Epics 1, 2 and 3.
- **Re-rendering the catalogue** — Epic 5.

## Requirements

### The curve

- **R1** — The comp's velocity is no longer a pure function of metric position.
  Two chords at the same step class in the same groove differ in how hard they
  are struck.
- **R2** — The variation is musical, not noise. It is a repeating cycle of
  multipliers over the comp's own hits, declared beside `HAT_ACCENTS` and applied
  the same way: indexed by the chord's position in the bar's comp sequence, not
  by grid step. Indexing by step would partition the bar exactly the way
  `velocityFor` already does and change nothing.
- **R3** — The variation is deterministic. The same `{ template, seed }` renders
  the same velocities every time, so the lock and the re-render both keep
  working.
- **R4** — Successive passes of the four-bar figure differ from each other in
  how the comp plays them, the way `roundRobin` already makes each pass a
  different take. The mechanism is the same one: each pass enters the accent
  cycle at a different offset, so the shape is the same phrase read from a
  different starting point rather than a second, unrelated pattern.
- **R4a** — The rotation is derived from the pass index, not drawn at random, so
  R3's determinism holds without a second seeded generator.
- **R5** — The metric accent survives underneath. A chord on a downbeat is still,
  in general, struck harder than one on an off-sixteenth; the curve modulates
  that relationship rather than replacing it.
- **R6** — The harmony is untouched. Every chord's notes, its voicing, its
  register and its voice leading from the previous bar are what they are today.
  Only the force of the strike changes.
- **R7** — The comp does not become the loudest voice in a mix that did not have
  it loudest. The curve varies velocity around its existing centre rather than
  raising it, so no template's balance is changed by this epic.
- **R8** — `COMP_VOICE_DROP` and the chord roll still apply. The top voice still
  sings over the ones under it, and the chord still arrives across a few
  milliseconds rather than all at once.

### The samples as a ceiling

- **R9** — The velocity range the curve produces is checked against what the
  comp's three layers can express. If the curve spends most of its range inside
  one layer, or crosses boundaries so often that the layer flips hit to hit, that
  is reported as a finding.
- **R10** — No comp event's layer gain reaches `MAX_LAYER_GAIN`. A curve reaching
  for twice a layer's recorded level is asking the pack for a dynamic it does not
  hold.
- **R11** — Adding comp samples is not this epic's remedy, and neither is
  deferring the problem. Where the three layers cannot express a shade, the gain
  applied relative to the layer's `nominalVelocity` carries it: `gainFor` in
  `voices.ts` already scales a layer up or down from what it was recorded at, and
  that is the mechanism the curve leans on between layer boundaries.
- **R11a** — No file under `samples/` and no line of `pack.json` changes in this
  epic. `pack.json` is Epic 1's to write, and two epics inside it at once is a
  conflict for no gain.
- **R11b** — R10 is the binding constraint on how far this can go. Carrying a
  shade the layers do not hold means scaling further from nominal, and
  `MAX_LAYER_GAIN` is where that stops being a dynamic and starts being
  distortion. The curve is tuned to stay inside it, not tuned until it hits it.
- **R11c** — Scaling relative to nominal must not reintroduce the fault
  `gainFor` was written to fix: a step at every layer boundary, where a hit just
  over the line jumps to a louder recording and is then scaled by nearly the same
  number. The two sides of a boundary still meet.

### The reference notes

- **R12** — The twelve reference notes stay clean, even reference notes — a
  player taps a root chip to hear the answer, not a performance, so no accent
  cycle and no per-pass rotation reaches them. Each is
  a single `comp` event rendered by `notes.ts` at a fixed velocity with no
  template and no feel, and a player taps a root chip to *hear the answer*, not
  to hear a performance.
- **R13** — The twelve reference notes are re-rendered through the new code path
  at the same fixed velocity they use today, and whatever that produces is
  asserted as the intended result. They are not held byte-identical by
  construction: `notes.ts` builds a degenerate template with no feel, so what
  reaches them is whatever the changed comp path does with a single event, and
  the honest check is to render it and pin it.
- **R13a** — The assertion is on the audio's measurable properties — length,
  peak, and sounding pitch per root — not on a byte hash. A hash pins the output
  without saying what about it is correct, and would fail on any unrelated
  re-encode.
- **R14** — The twelve stay identical to each other in treatment: same voice,
  same register, same length, same velocity, so no root sounds louder or softer
  than another. That evenness is the point of them and is not the evenness this
  epic is removing.

## Behaviour details

**Four things already shape a comp hit, and the curve is a fifth.** In the order
they apply today:

1. `velocityFor('comp', sixteenth)` — the metric accent, one of three levels.
2. `HAT_ACCENTS`-style shaping — **absent for the comp**; this is the gap.
3. `COMP_VOICE_DROP × below` — each voice below the top struck softer.
4. `humanize` — ±`velocity` from the template, redrawn per pass.
5. `gainFor(velocity, nominalVelocity)` in `voices.ts` — the level relative to
   what the chosen layer was recorded at.

The curve belongs at (2), between the metric accent and the voice drop: it is a
property of which hit this is in the phrase, not of which note in the chord, and
not of the level the sample was recorded at.

**Why humanize is not already the answer.** The template's `humanize.velocity` is
±9 % of white noise redrawn per pass. It makes each pass slightly different and
each hit slightly wrong, which is not the same as a phrase having a shape. Noise
around a constant is still, to the ear, a constant.

## Acceptance criteria

- **AC1** (R1) — Given a rendered groove, when comp events at the same step
  class within one pass are compared, then their velocities are not all equal.
- **AC2** (R2) — Given a rendered groove with the template's `humanize.velocity`
  set to zero, when comp velocities are compared, then they still vary — proving
  the variation is the curve, not the noise.
- **AC3** (R3) — Given the same `{ template, seed }` rendered twice, when the
  comp events are compared, then every velocity is identical.
- **AC4** (R4) — Given a multi-pass groove, when the comp velocity sequence of
  pass 0 is compared with pass 1, then they differ.
- **AC5** (R5) — Given a rendered groove, when the mean velocity of comp hits on
  downbeats is compared with the mean on off-sixteenths, then the downbeats are
  higher.
- **AC6** (R6) — Given a groove rendered before and after this epic, when the
  comp events are compared, then every event has the same `timeSec`, `midi` and
  `durationSec`, and only `velocity` differs.
- **AC7** (R7) — Given every template, when a groove is rendered and the comp's
  mean velocity is compared against the pre-epic mean, then it is within a
  declared tolerance of it.
- **AC8** (R8) — Given a rendered chord, when its events are inspected, then
  each voice below the top is struck softer than the one above and their onsets
  are spread across the roll.
- **AC9** (R10) — Given every groove in the catalogue rendered, when the layer
  gain of each comp event is computed, then none reaches `MAX_LAYER_GAIN`.
- **AC10** (R9) — Given a rendered groove, when comp events are bucketed by the
  velocity layer they select, then the distribution across the three layers is
  reported, and a distribution confined to one layer fails.
- **AC11** (R12, R14) — Given the twelve reference notes rendered, when each is
  measured, then all twelve share the same length and peak within tolerance.
- **AC12** (R13, R13a) — Given the twelve reference notes rendered through the
  new comp path, when each is measured, then its length, peak and sounding pitch
  match asserted values, and those values are committed as the intended result.
- **AC13** (R11a) — Given `pack.json` and the files under `samples/`, when
  compared before and after this epic, then they are unchanged.
- **AC13a** (R11, R11b) — Given every groove in the catalogue rendered, when the
  gain applied to each comp event is computed, then the values span a range wider
  than the three layers' nominals alone would give, and none reaches
  `MAX_LAYER_GAIN`.
- **AC13b** (R11c) — Given comp events whose velocities fall either side of a
  layer boundary, when their applied levels are compared, then no step appears at
  the boundary.
- **AC14** (R6) — Given every groove in the catalogue rendered, when the
  manifest is compared against the current one, then `root`, `flavour`, `scale`,
  `chord` and `progression` are identical for all thirty.

## Dependencies

**Needs to start:** nothing. This epic is parallel with Epic 1 and touches a
different voice through a different code path: Epic 1 owns `samples/`,
`pack.json`, `types.ts` and `straight-funk.ts`; this epic owns the comp's
velocity path in `events.ts` and, if the curve needs a per-template knob, the
`humanize` block's shape.

**Hands to Epic 5:** the final comp velocities, so the re-cut renders what ships.

**A note on file overlap.** Epic 3 also writes `events.ts`. The two are disjoint
by region — Epic 3 adds pattern pools and `VELOCITIES` rows for two new
percussion voices, this epic changes how an existing voice's velocity is
computed — but they run in different waves anyway, so the overlap costs nothing.

## Assumptions

- The curve is one constant in `events.ts`, beside `HAT_ACCENTS`, rather than a
  new `FeelTemplate` field. A per-template curve would be six more numbers to
  tune with no evidence yet that the feels want different ones; if the listening
  pass says they do, that is a field added later.
- The cycle's length is chosen against the comp's hits per bar, not against the
  bar. A cycle whose length divides the hit count evenly repeats in lockstep with
  the bar and reintroduces the flatness it exists to remove — the same trap
  `roundRobin` documents for alternates.
- The comp's existing `VELOCITIES` row stays as the centre the curve varies
  around, so R7 holds without re-levelling any template.
- "A little bit of velocity curve", per the briefing, means a range the ear reads
  as a player rather than as a dynamic swell. The listening sign-off decides how
  much, and it is the criterion that actually settles this epic.
- The bass is left alone even though the same argument applies to it. The
  briefing names the comp, and widening this to the bass would change a voice the
  briefing did not ask about.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-01

**Q1. What shape does the curve have?**
Answer: **A) A repeating accent cycle over the comp's own hits, plus a per-pass
rotation of where the cycle starts** — it is the fix feature-9 already made for
the hats, one mechanism satisfies both the within-bar and across-pass
requirements, and it stays deterministic for free.
Applied to: R2, R4, R4a, Assumptions

**Q2. What if three velocity layers cannot carry the curve?**
Answer: **D) Compensate in `voices.ts` — let the gain relative to
`nominalVelocity` carry the shades the layers cannot.** The pack stays Epic 1's,
and `gainFor` already scales a layer from what it was recorded at.
Applied to: R11, R11a, R11b, R11c, AC13, AC13a, AC13b

**Q3. Should the reference notes change at all?**
Answer: **B) Re-rendered from the same fixed velocity, accepting whatever the new
code path produces, with the result asserted** — rather than held byte-identical
by construction.
Applied to: R13, R13a, AC12
