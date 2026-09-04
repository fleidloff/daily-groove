# PRD — Epic 2: Every feel on the new kit

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The five templates Epic 1 did not touch — `shuffle`, `bright-straight`,
`half-time`, `open-ballad`, `swung-sixteenth` — are rewritten onto the new kit
using the levelling method Epic 1 wrote down. Each one also declares whether the
ride and the bongo are in it. When this is done all six feels play the new kit,
and moving between them is a change of groove rather than a change of volume.

## Problem

Every template's `gain` and `pan` block was tuned against a cajon and the mix
built around it. Those numbers are the wrong numbers for a bass drum: a cajon
with almost no low end was compensated for elsewhere, and each of the five
templates compensated slightly differently. Left alone, the catalogue would step
in volume and in balance from one feel to the next.

The ride and the bongo also need an owner for the question of *which feels get
them*. That is a per-template call and it belongs with the template files.

## Scope

- `shuffle.ts`, `bright-straight.ts`, `half-time.ts`, `open-ballad.ts`,
  `swung-sixteenth.ts`: `voices`, `gain`, `pan`, and `humanize.lean`.
- Declaring per feel whether `ride`, `bongoHigh` and `bongoLow` are in.
- Levelling across templates, not only within them.
- Any shared drum pattern or placement pool in `events.ts` that was written
  around the cajon's envelope.

**Out of scope**
- **`straight-funk.ts`** — Epic 1 owns it, and this epic does not edit it.
- **What the ride and the bongo play** — Epic 3. This epic decides only whether
  each feel lists them.
- **Each feel's identity.** `flavours`, `tempoRange`, `subdivision`, `swing`,
  `passes` and `density` are not this feature's subject.
- **The comp and the bass**, and the comp's velocity curve — Epic 4.
- **Re-rendering anything** — Epic 5.

## Requirements

### The five templates

- **R1** — Each of the five templates has its `gain` and `pan` re-derived for
  the new kit by Epic 1's method. Carrying the cajon-era numbers over, or
  shifting them all by a constant, is not a re-derivation.
- **R1a** — Each template's `humanize.lean` is revisited per voice. A beater and
  a hand place their attack differently against the grid, and the lean values
  were set against the hand.
- **R2** — Each template's `flavours`, `tempoRange`, `subdivision`, `swing`,
  `passes` and `density` are unchanged.
- **R3** — `open-ballad`'s deliberate inversion survives the re-levelling: its
  comp stays above its snare, and its hats stay the quietest of the six. That
  balance is the reason the feel exists — on a slow feel the third of the chord
  is the question being asked, and the kit's job is to state a tempo and get out
  of the way.
- **R4** — Every template keeps a `gain` and `pan` entry for every voice it
  lists, and lists no voice it has no entry for.

### The new voices, per feel

- **R5** — *Withdrawn with the ride.* No feel lists `ride`; the voice is not in
  the pack.
- **R5a** — The bongo goes on **`bright-straight`** and no other feel. One feel
  of six is what makes it a signature: a hand drum on all six would distinguish
  none of them, and `bright-straight` is the brightest, most open feel of the
  set — the one with room for a second pair of hands.
- **R5b** — Neither voice is on all six. A voice present in every feel
  distinguishes none of them, which is the opposite of why they were added.
- **R5c** — `bongoHigh` and `bongoLow` are listed together or not at all. One
  without the other is the single-voice hand drum Epic 1's R4b rules out.
- **R5d** — Every feel has at least one of the two, or neither, but no feel has
  both. With R5 and R5a settled, `straight-funk` and `bright-straight` are the
  bongo's only candidates and the ride's only non-candidates.
- **R6** — *Withdrawn with the ride.* Every feel keeps `hatClosed` as its
  timekeeper, unchanged, and there is no hand-off to arrange.

### Levelling across the set

- **R7** — The six feels are levelled against each other, not only internally. A
  player moving from one day's groove to the next hears a different groove, not
  a different volume.
- **R8** — The measure is RMS over the whole rendered loop, in dBFS, computed
  from the PCM already in memory. Not peak: peak is already checked by
  `checkPeak` and says nothing about how loud a groove *sounds* — a sparse
  ballad and a dense funk can share a peak and differ by several decibels of
  perceived level.
- **R8a** — The tolerance is a band, declared as a constant with the reason for
  its width beside it, and every groove in the catalogue must fall inside it.
- **R9** — The check lives in the quality gate, alongside `checkPeak`,
  `checkSilence`, `checkSeam`, `checkHarmony`, `checkPitch` and `checkDensity`. A
  groove outside the band therefore fails to mint and fails `npm run
  grooves:verify`, which makes the band a build-time guarantee rather than a test
  someone can skip.
- **R9a** — It is a per-groove check, run on all thirty, not a spot check on six
  representative renders. A template's balance is set once and its grooves vary
  in density, so the outlier is a groove rather than a feel.
- **R10** — A groove outside the band fails as a `GateFailure` naming the check,
  the measured RMS and the band it missed — the same shape as every other gate
  failure.

### Shared pools

- **R11** — Where a drum pattern, placement or fill pool in `events.ts` was
  written around the cajon — a figure that only works because the low voice had
  no sustain, or a fill that relies on the toms being the only drums with decay
  — it is rewritten. A change to a shared pool is a change to every feel, and
  this epic is where that is accounted for.
- **R12** — No template gains a voice-specific special case in `events.ts` that
  another template would need too. Anything two feels need lives in the pool or
  in the template's own declared fields.

## Behaviour details

**Why loudness and not peak.** `mixTracks` ends in a bus knee at `BUS_KNEE` with
4× oversampling and `truePeak` is checked against `PEAK_CEILING`, so every groove
already arrives at a similar *ceiling*. That is exactly why peak cannot be the
levelling measure: it is the thing that has already been equalised. Two grooves
at the same true peak differ in loudness by however much their density and
crest factor differ, which across a ballad and a sixteenth funk is substantial.
RMS over the whole loop measures precisely that difference, needs no dependency,
and keeps the gate renderless-adjacent: it reads PCM the renderer has already
produced.

## Acceptance criteria

- **AC1** (R1, R2) — Given each of the five templates, when its fields are
  compared against the version before this epic, then `gain` and `pan` differ,
  and `flavours`, `tempoRange`, `subdivision`, `swing`, `passes` and `density`
  are identical.
- **AC2** (R3) — Given `open-ballad`, when its `gain` entries are read, then
  `comp` is louder than `snare`, and its `hatClosed` is the quietest
  `hatClosed` of the six templates.
- **AC3** (R4) — Given each of the six templates, when its `voices` list is
  compared with its `gain` and `pan` keys, then the three agree exactly.
- **AC4** (R5) — *Withdrawn with the ride.*
- **AC4a** (R5a, R5d) — Given the six templates, when the bongo pair is read,
  then it appears in `bright-straight` and in no other feel.
- **AC5** (R5c) — Given each template, when its `voices` list is read, then it
  contains both `bongoHigh` and `bongoLow` or neither.
- **AC6** (R7, R8, R8a) — Given one groove rendered per template, when the RMS
  of each rendered loop is measured in dBFS, then all six fall inside the
  declared band.
- **AC7** (R9, R9a) — Given every groove in the catalogue, when it is passed to
  `gateCandidate`, then the loudness check runs on each and all thirty pass.
- **AC7a** (R9) — Given a groove whose RMS is outside the band, when
  `gateCandidate` is called, then it returns a failure and the groove does not
  mint.
- **AC8** (R10) — Given that failure, when it is read, then it names the check,
  the measured RMS and the band it missed.
- **AC9** (R6) — *Withdrawn with the ride.*
- **AC10** (R11) — Given the shared pattern pools, when a groove is rendered for
  each of the six feels, then every one passes `gateCandidate` including its own
  `density` band.

## Dependencies

**Needs to start:** Epic 1's frozen contracts — the ten `VoiceName`s, the
`pack.json` voice keys, and the levelling method in `samples/README.md`. It
cannot begin against a placeholder pack, because setting a `gain` requires
hearing the sample the gain applies to.

**Hands to Epic 5:** six templates whose declared voices are the final set, so
the re-cut renders what ships.

**Parallel with Epic 3**, kept apart by file: this epic writes the five template
files, Epic 3 writes the new voices' patterns in `events.ts`. The one shared
surface is the shared pattern pools under R11, which this epic touches only for
cajon-era assumptions and Epic 3 touches only to add the two new voices' pools.

## Assumptions

- The loudness measure is computed in-repo from the rendered PCM rather than by
  shelling out to a loudness meter. `mix.ts` already owns `truePeak`, the render
  is already in memory, and `grooves:verify` must keep running on a machine with
  no ffmpeg.
- A ballad at 62 bpm and a funk at 106 bpm can be brought inside one loudness
  band without flattening either. If it turns out they cannot, the band widens
  and the reason is recorded rather than the ballad being pushed.
- Re-levelling does not change any template's `passes`, so no groove changes
  duration and no committed file changes length for that reason.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-01

**Q1. How is the cross-template loudness check enforced?**
Answer: **A) A check inside the quality gate** — it is where every other
per-groove check lives, and it makes the band a build-time guarantee rather than
a test that can be skipped.
Applied to: R9, R9a, R10, AC7, AC7a, AC8

**Q2. Which loudness measure?**
Answer: **A) RMS over the whole loop, in dBFS** — a few lines over PCM already in
memory, no dependency, and enough to catch the several-decibel steps this is
about.
Applied to: R8, AC6, Behaviour details

**Q3. Which feels get the ride?**
Answer: **A and B together — `half-time`, `open-ballad`, `shuffle` and
`swung-sixteenth`.** Both were ticked and they are compatible: four of six is
inside the rule that forbids all six, and it splits cleanly into the two slowest
and the two swung.
Applied to: R5, R5d, AC4

**Q4. Which feels get the bongo?**
Answer: **A) One or two, chosen by ear, never a feel that also has the ride** —
which, with Q3 taking four feels, leaves `straight-funk` and `bright-straight`
as the only candidates.
Applied to: R5a, R5d, AC4a

### Cycle 2 — 2026-09-01

**Q5. Does R6 survive, and in what form?**
Answer: **A) Hold it, pending Epic 1's Q4.** That question then settled the ride
as the timekeeper, so R6 survives as drafted and gains R6a: the four ride feels
keep `hatClosed` in their voice lists, demoted rather than deleted.
Applied to: R6, R6a, AC9
