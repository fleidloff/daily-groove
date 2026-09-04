# Tech spec — Epic 4: The comp stops being perfect

PRD: [../prd/epic-4-the-comp-stops-being-perfect.md](../prd/epic-4-the-comp-stops-being-perfect.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One mechanism, applied in one place, plus the checks that prove it did not reach
anywhere it should not. `HAT_ACCENTS` already exists in `events.ts` and does
exactly this job for the hats; the comp is given the same treatment — a cycle of
multipliers indexed by the chord's position in the bar's comp sequence — with a
per-pass rotation of the cycle's starting offset so successive passes read the
phrase from a different point.

The second half is smaller but easier to get wrong. Three velocity layers with a
single alternate each cannot express every shade the cycle asks for, so the
shades between layer boundaries are carried by `gainFor`'s existing scaling
relative to `nominalVelocity`. No sample and no line of `pack.json` changes —
that file is Epic 1's, and two epics inside it is a conflict for no gain. What
this epic must not do is let the wider range reintroduce the fault `gainFor`'s
doc comment describes: a step at every layer boundary, where a hit just over the
line jumps to a louder recording and is then scaled by nearly the same number.

The twelve reference notes are the same voice, so they are re-rendered through
the changed path and pinned on what they measure — length, peak, pitch — rather
than held byte-identical by construction.

## Architecture

```
add('comp', bar, step, 4, midi, velocity, offsetSec)
                              ▲
   accentedVelocity('comp', step, sixteenth)
     = velocityFor('comp', sixteenth)          ← metric accent, three levels
     × COMP_ACCENTS[(index + pass) % len]      ← NEW: the curve
   then × (1 - COMP_VOICE_DROP * below)        ← voice drop, unchanged
   then ± humanize.velocity                    ← noise, unchanged
   then gainFor(velocity, nominalVelocity)     ← in voices.ts, unchanged code
```

The curve sits between the metric accent and the voice drop, which is where the
PRD's behaviour section places it: it is a property of *which hit this is in the
phrase*, not of which note in the chord, and not of the level the sample was
recorded at.

`accentedVelocity` currently branches on `voice !== 'hatClosed' && voice !==
'hatOpen'`. Epic 3 extracts that into a table of accent cycles keyed by voice;
if Epic 3 has landed, this epic adds a row. If it has not, this epic adds the
third branch and Epic 3 extracts the table. Either order works — they are in
different waves — and whichever lands second does the extraction.

**The pass index is already available.** `buildEvents` loops passes and pushes
`passRanges`; the comp emission block sits inside that loop with `pass` in
scope. No new plumbing and no second seeded generator: the rotation is
`(index + pass)`, which keeps R3's determinism for free.

## Contracts

### The curve

```ts
// scripts/grooves/events.ts, beside HAT_ACCENTS
/**
 * The comp's accent shape: a repeating cycle of multipliers on top of the
 * metric accent, rotated by one step per pass.
 *
 * Length 5 against comp figures of 2-3 hits per bar, so the cycle and the bar
 * do not fall into lockstep - the trap roundRobin documents for alternates.
 */
const COMP_ACCENTS = [1, 0.88, 0.96, 0.82, 0.92]
```

Not a `FeelTemplate` field. Six per-template curves would be six sets of numbers
to tune with no evidence the feels want different ones.

### What does not change

- `pack.json` and every file under `samples/` — asserted, not assumed.
- `notes.ts`'s `NOTE_SECONDS`, `RELEASE_SECONDS`, `NOTE_OCTAVE` and its fixed
  render velocity.
- `COMP_VOICE_DROP`, the chord roll, `COMP_REGISTER_LOW`/`CEILING`,
  `voiceLead`, `playedVoicing` — the harmony and the voicing.
- `gainFor` and `MAX_LAYER_GAIN` in `voices.ts`.

## Tracks

### Track A — the curve

- **Goal** — comp velocities vary within a bar and across passes,
  deterministically.
- **Owns** — `COMP_ACCENTS`, the comp branch of `accentedVelocity`, and the comp
  emission block in `events.ts`.
- **Depends on** — nothing. Parallel with Epic 1 entirely.
- **Parallel with** — Track B.
- **Done when** — its cases in `events.test.ts` pass.

### Track B — the layers as a ceiling

- **Goal** — the range the curve produces is expressible, measured, and stays
  under the clamp with no step at a boundary.
- **Owns** — the layer-distribution and boundary assertions in
  `scripts/grooves/voices.test.ts`.
- **Depends on** — `gainFor`'s existing behaviour only; its tests can drive
  `renderVoices` with hand-built events.
- **Parallel with** — Track A.
- **Done when** — its cases pass.

### Track C — the reference notes

- **Goal** — the twelve roots still sound like answers.
- **Owns** — `scripts/grooves/notes.test.ts`.
- **Depends on** — Track A, to know whether anything reached them.
- **Parallel with** — nothing. Wave 2.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C.
- **Wave 3:** Integration.

## Implementation

### Track A — the curve

#### Step A1 — the comp is flat today, and a test says so

Covers: R1, AC1

- **Test first** — `scripts/grooves/events.test.ts`: render a `straight-funk`
  groove with `{ ...straightFunk, humanize: { ...straightFunk.humanize, velocity: 0 } }`;
  collect comp events, group by `step % 4`, and assert that within a group the
  velocities are **not** all equal. Run it: **fails** — every comp hit at a step
  class is one value, which is the defect. Naming this failure first is what
  proves the later green means something.
- **Implement** — nothing yet.
- **Green when** — not yet. A1 stays red until A2.
- **Refactor** — none.

#### Step A2 — the curve varies the comp within a bar

Covers: R1, R2, R5, AC1, AC2, AC5

- **Test first** — A1's assertion, plus: assert the mean velocity of comp hits
  at `step % 4 === 0` is greater than the mean at odd steps, so the metric accent
  survives underneath.
- **Implement** — `events.ts`: add `COMP_ACCENTS` beside `HAT_ACCENTS`. Build a
  `compAccents` map from `compSteps` the way `hatAccents` is built from
  `hatLine` — index into the cycle by the hit's position in the comp sequence,
  not by grid step. Read it in `accentedVelocity` for `voice === 'comp'`.
- **Green when** — A1 goes green and the metric-accent assertion passes.
- **Refactor** — if Epic 3 has landed its accent table, move `COMP_ACCENTS` into
  it and delete the branch.

#### Step A3 — successive passes read the phrase differently

Covers: R4, R4a, AC4

- **Test first** — `events.test.ts`: on a four-pass groove with humanize at 0,
  slice comp events by `passRanges` and assert pass 0's velocity sequence
  differs from pass 1's. Run it: fails — the cycle restarts identically each
  pass.
- **Implement** — `events.ts`: rotate by the pass index —
  `COMP_ACCENTS[(index + pass) % COMP_ACCENTS.length]`. The comp block is inside
  the pass loop, so `pass` is already in scope.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A4 — the same seed renders the same velocities

Covers: R3, AC3

- **Test first** — `events.test.ts`: call `buildEvents` twice with the same spec
  and template; assert every comp event's `velocity` is exactly equal. Run it:
  passes — and would fail if A3 had reached for a random draw instead of the
  pass index.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step A5 — only the velocity moved

Covers: R6, R8, AC6, AC8, AC14

- **Test first** — `events.test.ts`: capture the pre-epic comp events for three
  catalogue grooves as a committed fixture of `{ timeSec, midi, durationSec }`;
  assert the new render reproduces all three fields exactly for every comp
  event. Separately assert that within one chord, each voice below the top is
  struck softer than the one above, and their onsets are spread across the roll.
  And assert `music.root/flavour/scale/chord/progression` are unchanged for all
  thirty. Run it: passes if the curve went where the architecture says; fails if
  it was applied before the voicing or changed the roll.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step A6 — the comp did not get louder

Covers: R7, AC7

- **Test first** — `events.test.ts`: for each of the six templates, assert the
  mean comp velocity across a rendered groove is within 2 % of the pre-epic mean,
  captured as a fixture. Run it: fails if `COMP_ACCENTS` averages above 1 — the
  easiest way to write a cycle is with 1 as the maximum and everything else
  below, which lowers the mean, or with accents above 1, which raises it.
- **Implement** — `events.ts`: scale `COMP_ACCENTS` so its mean is 1.
- **Green when** — all six are within tolerance.
- **Refactor** — none.

### Track B — the layers as a ceiling

#### Step B1 — the curve's range reaches more than one layer

Covers: R9, AC10

- **Test first** — `scripts/grooves/voices.test.ts`: render a groove's comp
  events through `renderVoices` with a stub pack that records which layer each
  `get` call selected; bucket the calls by layer and assert at least two of the
  three layers are used, and that no single layer takes more than 90 % of the
  hits. Run it: fails if the curve's spread sits inside one band.
- **Implement** — widen or narrow `COMP_ACCENTS` until the distribution spreads.
  This is the measurement the PRD asks to be *reported*, so print the
  distribution in the test output rather than only asserting on it.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B2 — the shades between layers come from the gain, and stay under the clamp

Covers: R11, R11b, AC13a

- **Test first** — `voices.test.ts`: for every comp event of every catalogue
  groove, compute `gainFor(velocity, nominalVelocity)` and assert none reaches
  `MAX_LAYER_GAIN`; and assert the set of distinct gains is larger than three,
  proving the shades are finer than the layer count.
- **Implement** — nothing in `voices.ts`; if the clamp is reached, narrow
  `COMP_ACCENTS`. The clamp is where a dynamic stops being a dynamic and starts
  being distortion, and the curve is tuned to stay inside it rather than tuned
  until it hits it.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B3 — no step at a layer boundary

Covers: R11c, AC13b

- **Test first** — `voices.test.ts`: build two comp events whose velocities sit
  either side of a declared `maxVelocity`, a hair apart; render each and assert
  their peak output levels differ by less than a small tolerance. Run it: passes
  today — `gainFor` was written for exactly this — and this guards the wider
  range from reintroducing it.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step B4 — the pack is untouched

Covers: R11a, AC13

- **Test first** — `voices.test.ts` or a small structural case: assert a
  committed hash of `samples/pack.json` and the list of files under `samples/`
  are unchanged by this epic. In practice a `git diff --name-only` check in
  review, since Epic 1 legitimately changes both in its own wave.
- **Implement** — nothing.
- **Green when** — this epic's diff touches no file under `samples/`.
- **Refactor** — none.

### Track C (wave 2) — the reference notes

#### Step C1 — the curve does not reach a reference note

Covers: R12

- **Test first** — `scripts/grooves/notes.test.ts`: assert `renderNote` produces
  identical PCM for two calls, and that the twelve specs from `noteSpecs()` all
  carry the same velocity. Run it: passes — `notes.ts` builds a degenerate
  template with no feel and renders a single event, so no accent cycle and no
  pass index reaches it. Asserting it is what stops that being an accident.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step C2 — the twelve are pinned on what they measure

Covers: R13, R13a, AC12

- **Test first** — `notes.test.ts`: render all twelve through the current path;
  assert each has the same frame count, that their peaks are within a small
  tolerance of each other, and that each sounds its named chromatic root — reuse
  the pitch measurement the pack's tests already use, per the samples README's
  rule that a sounding pitch is measured, never read off a name. Commit the
  expected values. Run it: fails until the expectations are written.
- **Implement** — commit the measured values as the asserted result.
- **Green when** — all twelve pass.
- **Refactor** — none.

#### Step C3 — the twelve are even with each other

Covers: R14, AC11

- **Test first** — `notes.test.ts`: assert max peak minus min peak across the
  twelve is under a stated tolerance, and all twelve share a frame count. Run
  it: passes; it fails if someone later gives the notes a curve.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

## Integration and verification

- **Step I1 — every groove still gates clean.** Render all thirty and assert
  `gateCandidate` returns `null` — a wider velocity range reaches for
  `MAX_LAYER_GAIN` more often and pushes peak.
- **Step I2 — the demo path.** `npm run grooves -- groove-01`, listen: the
  chords land differently bar to bar and pass to pass, and it is still the same
  piano. Then `npm run notes` and tap a root chip: a clean, even reference note.
- **Step I3 — full suite.** `npm test`, `npx tsc --noEmit`, `npm run lint`.
- **Listening sign-off.** The briefing asks for "a little bit" of curve — a
  player, not a dynamic swell. This is the criterion that actually settles the
  epic; B1's distribution only proves the range is expressible.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2 |
| R2 | A2 |
| R3 | A4 |
| R4, R4a | A3 |
| R5 | A2 |
| R6 | A5 |
| R7 | A6 |
| R8 | A5 |
| R9 | B1 |
| R10 | B2 |
| R11 | B2 |
| R11a | B4 |
| R11b | B2 |
| R11c | B3 |
| R12 | C1 |
| R13, R13a | C2 |
| R14 | C3 |
| AC1 | A1, A2 |
| AC2 | A2 |
| AC3 | A4 |
| AC4 | A3 |
| AC5 | A2 |
| AC6 | A5 |
| AC7 | A6 |
| AC8 | A5 |
| AC9 | B2 |
| AC10 | B1 |
| AC11 | C3 |
| AC12 | C2 |
| AC13 | B4 |
| AC13a | B2 |
| AC13b | B3 |
| AC14 | A5 |

## Assumptions

- `COMP_ACCENTS` has five entries against comp figures of two or three hits per
  bar, so the cycle and the bar do not fall into lockstep. The exact numbers are
  tuning; the coprimality is the design.
- The rotation is `(index + pass)`, matching how `roundRobin` shifts alternates
  per pass, rather than a second seeded stream. One fewer generator, and
  determinism for free.
- The bass is left alone. The same flatness argument applies to it, and the
  briefing named the comp.
- If Epic 3 lands first, `COMP_ACCENTS` becomes a row in its accent table and
  Step A2's refactor is that move. If this epic lands first, Epic 3 does the
  extraction. Neither blocks the other.

## Decision log

### Cycle 1 — 2026-09-01

No architectural questions open at drafting. The PRD settled the curve's shape,
that the shades come from gain relative to `nominalVelocity` rather than from
new samples, and that the reference notes are re-rendered and pinned on measured
properties. The calls this spec makes alone — the cycle length, the
`(index + pass)` rotation, printing the layer distribution rather than only
asserting it — are recorded above as assumptions.
