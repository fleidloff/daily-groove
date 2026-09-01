# Tech spec — Epic 3: The ride and the bongo get parts

PRD: [../prd/epic-3-the-ride-and-the-bongo-get-parts.md](../prd/epic-3-the-ride-and-the-bongo-get-parts.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Both voices are new arrivals in the same file, so the parallelism here is inside
`events.ts` rather than across it: the ride's work and the bongo's work touch
different regions — different pattern pools, different `VELOCITIES` rows,
different emission blocks — and the one thing they share is the `add()` helper,
which neither changes.

The load-bearing piece is small and easy to get wrong. The timekeeper is
*derived*, once, from `template.voices.includes('ride')`, and everything else
follows from that one boolean: which pool the hat draws from, and which voice
marks the pulse. The alternative — a `timekeeper` field on `FeelTemplate` — was
rejected in the PRD because a template can be authored into breaking it, and
five more templates get authored in Epic 2 by someone who has not read this
document.

Everything is validated on `straight-funk`, which Epic 1 rewrote. That is
deliberate: it keeps this epic out of the five template files Epic 2 owns, so
the two run in the same wave. Tests construct a template variant in-memory —
`{ ...straightFunk, voices: [...straightFunk.voices, 'ride'] }` — rather than
editing any template on disk.

## Architecture

Three additions to `scripts/grooves/events.ts`, each following a pattern the
file already establishes:

1. **`RIDE_PATTERNS` and `HAT_PUNCTUATION_PATTERNS`**, sixteenth-grid arrays
   beside `HAT_PATTERNS`, resolved through the existing `gridSteps` so an
   eighth-note feel reads them at its own resolution. Two of the four ride feels
   are slow — `half-time` at 68–80 bpm and `open-ballad` on an eighth grid — so
   this is not hypothetical.
2. **A derived timekeeper**, computed once in `buildEvents` next to where
   `hatSteps` is drawn.
3. **Accent cycles** for both new voices, built the way `hatAccents` is: a `Map`
   from step to multiplier, indexed by the voice's position in its own sequence
   rather than by grid step.

```
buildEvents(spec, template)
  ridesTime = template.voices.includes('ride')

  hatSteps  = ridesTime ? grid(pick(rng, HAT_PUNCTUATION_PATTERNS))
                        : grid(pick(rng, HAT_PATTERNS))
  rideSteps = ridesTime ? grid(pick(rng, RIDE_PATTERNS)) : []
  bongoFig  = plays('bongoHigh') ? grid(pick(rng, BONGO_PATTERNS)) : []
```

**The draw order is load-bearing.** `MUSIC_LABEL`'s doc comment freezes the
order of draws from the *music* stream; these are all rhythm-stream draws, but
adding a `pick` in the middle of the existing sequence still shifts every
subsequent draw and re-rolls every groove in the catalogue. New picks therefore
go **after** `compSteps`, and the ride's pick is made unconditionally — drawing
and discarding when the feel has no ride — so the sequence does not depend on
the template. A conditional draw would make `straight-funk`'s bass pattern
depend on whether `half-time` has a ride.

## Contracts

### The derived timekeeper

```ts
// scripts/grooves/events.ts — internal, not exported
const ridesTime = template.voices.includes('ride')
```

No `FeelTemplate` field, no export. Epic 2 declares voices; this derives
behaviour from them.

### Pattern pools

```ts
const RIDE_PATTERNS: number[][]              // sixteenth grid, timekeeping density
const HAT_PUNCTUATION_PATTERNS: number[][]   // sparse, off the ride's pulse
const BONGO_PATTERNS: { high: number[]; low: number[] }[]
```

The bongo pool is one figure distributed across two drums, not two independent
pools — two independent draws would produce collisions no player's two hands
could make.

### Velocity rows

```ts
const VELOCITIES: Record<VoiceName, { strong: number; medium: number; weak: number }> = {
  // ...
  ride:      { strong: 0.82, medium: 0.72, weak: 0.64 },
  bongoHigh: { strong: 0.7,  medium: 0.58, weak: 0.46 },
  bongoLow:  { strong: 0.72, medium: 0.6,  weak: 0.48 },
}
```

The ride sits between the snare (`strong: 1`) and the closed hat
(`strong: 0.75`), with a spread of 0.18 against the snare's 0.55 — a cymbal that
varies as much as a snare reads as unsteady.

## Tracks

### Track A — the ride keeps time

- **Goal** — a feel listing `ride` renders a ride part and a demoted hat.
- **Owns** — the ride's pool, `VELOCITIES.ride`, the derived timekeeper, the hat
  punctuation pool, and the hat/ride emission block in `events.ts`.
- **Depends on** — Epic 1's `VoiceName` and pack.
- **Parallel with** — Track B, by region within `events.ts`.
- **Done when** — its cases in `events.test.ts` pass on a `straight-funk`
  variant.

### Track B — the bongo plays a colour

- **Goal** — a feel listing the bongo pair renders a sparse two-drum part.
- **Owns** — `BONGO_PATTERNS`, the two bongo `VELOCITIES` rows, the bongo accent
  cycle and its emission block.
- **Depends on** — Epic 1's `VoiceName` and pack.
- **Parallel with** — Track A.
- **Done when** — its cases pass on a `straight-funk` variant.

### Track C — nothing else moved

- **Goal** — a template listing neither voice renders exactly as before.
- **Owns** — the regression assertions in `events.test.ts`.
- **Depends on** — Tracks A and B.
- **Parallel with** — nothing. Wave 2.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C — the regression proof, which needs both.
- **Wave 3:** Integration.

## Implementation

### Track A — the ride

#### Step A1 — the draw order does not shift

Covers: R13, R15, AC13

- **Test first** — `scripts/grooves/events.test.ts`: capture the full event list
  for three catalogue grooves as a committed fixture *before* any pool is added;
  assert `buildEvents` reproduces it exactly. Run it: passes now. It is the
  guard, and it must exist before A2 so the next step's failure is legible.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step A2 — a ride feel renders ride events

Covers: R1, AC1

- **Test first** — `events.test.ts`: build
  `const withRide = { ...straightFunk, voices: [...straightFunk.voices, 'ride'] }`;
  assert `buildEvents(spec, withRide).events` contains events with
  `voice === 'ride'`, and that two calls with the same spec produce identical
  times and velocities. Run it: fails — no ride events, the array is empty.
- **Implement** — `events.ts`: add `RIDE_PATTERNS`; add `VELOCITIES.ride`; draw
  `rideSteps` **after** `compSteps`, unconditionally, discarding the result when
  the feel has no ride; emit ride events in the non-fill branch beside the hat.
- **Green when** — both assertions pass **and** Step A1's fixture is still
  reproduced exactly. If A1 goes red, the pick landed in the wrong place in the
  draw order.
- **Refactor** — none.

#### Step A3 — the hat stands down

Covers: R2, R2a, R2b, R2c, R2e, AC2, AC2a

- **Test first** — `events.test.ts`: with `withRide`, assert no bar contains a
  `hatClosed` event at a step that also carries a `ride` event, and that the
  closed-hat count is under a third of the ride count. Then with plain
  `straightFunk`, assert `hatClosed` still keeps time — its event count is
  unchanged from the pre-epic fixture. Run it: fails; the hat is still drawing
  from `HAT_PATTERNS` and doubling the ride.
- **Implement** — `events.ts`: add `HAT_PUNCTUATION_PATTERNS`; compute
  `ridesTime` from `template.voices`; select the hat's pool from it. Draw from
  whichever pool is chosen using the *same single* `pick` call so the rhythm
  stream advances once either way.
- **Green when** — all three assertions pass, A1 included.
- **Refactor** — none.

#### Step A4 — the punctuation pool is sparse enough to not be the pulse

Covers: R2d, AC2b

- **Test first** — `events.test.ts`: for every figure in
  `HAT_PUNCTUATION_PATTERNS`, assert its length is at most a third of the
  shortest `RIDE_PATTERNS` figure; and on a rendered ride feel, assert no
  closed-hat event falls on a metric strong position the ride is marking. Run
  it: fails if the punctuation pool was written as "the hat pattern with some
  removed".
- **Implement** — `events.ts`: rewrite the pool as off-beat accents — steps that
  are odd on the sixteenth grid, two or three per bar.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A5 — the ride is not flat

Covers: R4, R5, AC4, AC5

- **Test first** — `events.test.ts`: render a ride feel with
  `humanize.velocity` set to 0; assert the velocities of ride events at the same
  step class are not all equal. Separately, assert
  `VELOCITIES.ride.strong` is between the closed hat's and the snare's, and that
  `strong - weak` for the ride is smaller than for the snare. Run it: the first
  fails — every ride hit at a step class is one value.
- **Implement** — `events.ts`: build a `rideAccents` map the way `hatAccents` is
  built — index into a `RIDE_ACCENTS` cycle by the hit's position in the ride
  sequence, not by grid step — and read it in `accentedVelocity` for
  `voice === 'ride'`.
- **Green when** — both assertions pass.
- **Refactor** — `accentedVelocity` now special-cases three voices. Extract a
  `Map<VoiceName, Map<number, number>>` of accent cycles and look up by voice, so
  a fourth voice is a table entry rather than another branch.

#### Step A6 — the ride rides through the fill

Covers: R6, AC6

- **Test first** — `events.test.ts`: render a multi-pass ride feel; find the
  fill bar via `middlePassOf`/the last pass; assert ride events are present in
  it. Run it: fails — the fill branch replaces the whole bar and emits only the
  fill phrase.
- **Implement** — `events.ts`: in the fill branch, emit the ride's steps for
  that bar alongside the fill phrase.
- **Green when** — the assertion passes and the fill bar stays inside the
  template's `density` band.
- **Refactor** — none.

#### Step A7 — `hatOpen` and its choke are untouched

Covers: R3, AC3

- **Test first** — `events.test.ts`: on a ride feel that lists `hatOpen`, assert
  open-hat events are present. In `voices.test.ts`, assert the existing choke
  case still passes with a ride in the track set. Run it: passes — this is a
  guard, and it fails if A3 filtered the hat too broadly.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

### Track B — the bongo

#### Step B1 — a bongo feel renders both drums

Covers: R7, R8, AC7

- **Test first** — `events.test.ts`: build
  `const withBongo = { ...straightFunk, voices: [...straightFunk.voices, 'bongoHigh', 'bongoLow'] }`;
  assert both voices appear and neither accounts for more than 80 % of the bongo
  events. Run it: fails — no bongo events.
- **Implement** — `events.ts`: add `BONGO_PATTERNS` as `{ high, low }` figures;
  add both `VELOCITIES` rows; draw the figure after the ride's pick,
  unconditionally; emit both voices in the non-fill branch.
- **Green when** — both assertions pass and A1's fixture still reproduces.
- **Refactor** — none.

#### Step B2 — the bongo is a colour, not a pulse

Covers: R12, R12a, R12b, AC10, AC10a

- **Test first** — `events.test.ts`: for every figure in `BONGO_PATTERNS`,
  assert `high.length + low.length` is at most a declared sparse maximum and
  strictly fewer than the template's subdivision — no figure marks every
  subdivision. On a render, assert more bongo hits fall on odd sixteenth
  positions than on `step % 4 === 0` positions. Run it: fails if the pool was
  written as an ostinato.
- **Implement** — `events.ts`: author the pool sparse and off the strong
  positions.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B3 — the bongo is not flat

Covers: R9, R10, AC8

- **Test first** — `events.test.ts`: with `humanize.velocity` at 0, assert bongo
  velocities at the same step class are not all equal. Assert
  `VELOCITIES.bongoHigh.strong` is below the snare's and below the tom rows —
  a hand is not a stick. Run it: the first fails.
- **Implement** — `events.ts`: a `BONGO_ACCENTS` cycle, read through the accent
  table A5 extracted.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B4 — the bongo gets out of the fill's way

Covers: R11, AC9

- **Test first** — `events.test.ts`: assert the fill bar has markedly fewer
  bongo events than the bar before it. Run it: passes if the fill branch already
  omits it — which it does, since the fill branch replaces the bar. Assert it
  anyway: A6 opened that branch for the ride, and the next person to open it may
  not stop to ask which voices belong there.
- **Implement** — nothing if green.
- **Green when** — green.
- **Refactor** — none.

### Track C (wave 2) — nothing else moved

#### Step C1 — a feel with neither voice is byte-identical

Covers: R15, AC13, AC14

- **Test first** — `events.test.ts`: assert Step A1's committed fixture still
  reproduces exactly for all three grooves, and that no event in a
  `straight-funk` render has voice `ride`, `bongoHigh` or `bongoLow`. Run it:
  passes, and is the whole point — a feel that opts out pays nothing.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step C2 — the harmony is untouched

Covers: R13, AC11

- **Test first** — `events.test.ts`: on renders with the ride and with the
  bongo, assert no event of those three voices carries a `midi`, and that
  `music.root`, `flavour`, `scale`, `chord` and `progression` equal the values
  from the same spec rendered without them. Run it: passes if the draw order
  held; fails loudly if a new `pick` was inserted into the music stream.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step C3 — density survives three new voices

Covers: R14, AC12

- **Test first** — `events.test.ts`: render each of the six templates with
  whatever new voices Epic 2 lists for it and assert `gateCandidate` returns
  `null`. Run it: fails if any feel's added voices push it past `maxPerBar`.
- **Implement** — thin the ride or bongo pool for the offending subdivision. Do
  not widen the template's `density` band — the band is the check, and widening
  it to pass is deleting the check.
- **Green when** — all six pass.
- **Refactor** — none.

#### Step C4 — only `straight-funk` was used to build this

Covers: R16, AC14

- **Test first** — a `git diff --name-only` check in review, not a unit test:
  no file under `templates/` other than `straight-funk.ts` appears in this
  epic's diff.
- **Implement** — nothing.
- **Green when** — the diff is clean.
- **Refactor** — none.

## Integration and verification

- **Step I1 — with Epic 2's templates in place**, render all thirty grooves and
  assert every one gates clean. Until Epic 2 lands, run against in-memory
  variants only.
- **Step I2 — the demo path.** `npm run grooves -- <a half-time groove>` and
  listen: a ride keeping time, a hat punctuating, no two voices marking the same
  pulse. Then a `bright-straight` groove: a bongo audible as a colour, the kit
  still keeping time.
- **Step I3 — full suite.** `npm test`, `npx tsc --noEmit`, `npm run lint`.
- **Listening sign-off**, on one ride feel and one bongo feel.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2 |
| R2, R2a | A3 |
| R2b, R2e | A3 |
| R2c | A3 |
| R2d | A4 |
| R3 | A7 |
| R4 | A5 |
| R5 | A5 |
| R6 | A6 |
| R7, R8 | B1 |
| R9, R10 | B3 |
| R11 | B4 |
| R12, R12a, R12b | B2 |
| R13 | C2, A1 |
| R14 | C3 |
| R15 | A1, C1 |
| R16 | C4 |
| AC1 | A2 |
| AC2, AC2a | A3 |
| AC2b | A4 |
| AC3 | A7 |
| AC4, AC5 | A5 |
| AC6 | A6 |
| AC7 | B1 |
| AC8 | B3 |
| AC9 | B4 |
| AC10, AC10a | B2 |
| AC11 | C2 |
| AC12 | C3 |
| AC13 | A1, C1 |
| AC14 | C1, C4 |

## Assumptions

- The accent cycles' lengths are coprime with the typical hits-per-bar of their
  pools, for the reason `roundRobin`'s doc comment gives about alternates: a
  cycle that divides the hit count evenly repeats in lockstep with the bar and
  reintroduces the flatness it exists to remove.
- The hat's punctuation pool is drawn with the same single `pick` as the
  timekeeping pool, so the rhythm stream advances once regardless of which pool
  is used. Two `pick` calls behind a branch would make a groove's later draws
  depend on whether its feel has a ride.
- Neither new voice declares a `lean` by default; a template may add one, as
  templates already do per voice.
- Which four feels carry the ride is Epic 2's declaration. This epic depends only
  on the boolean, so it is unaffected if that set changes.

## Decision log

### Cycle 1 — 2026-09-01

No architectural questions open at drafting. The PRD's second brainstorm cycle
settled the ride's role, the hat's demotion to a punctuation pool, and that the
timekeeper is derived from the voice list rather than declared. The calls this
spec makes alone — where the new `pick`s go in the draw order, the bongo as one
distributed figure, extracting the accent table in A5 — are recorded as
assumptions, and the draw-order one is guarded by Step A1's fixture rather than
by trust.
