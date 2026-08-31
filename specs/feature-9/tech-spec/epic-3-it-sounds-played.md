# Tech spec — Epic 3: It sounds played

PRD: [../prd/epic-3-it-sounds-played.md](../prd/epic-3-it-sounds-played.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four tracks that barely touch each other. `humanize.ts` gains the whole timing
model — a per-voice lean, a correlated gaussian walk, and a per-pass tempo
drift — behind its existing signature. `pack.ts` starts reporting which velocity
band the sample it returned represents, and `voices.ts` scales relative to that
instead of multiplying by raw velocity, which is the doubled-dynamics fix.
`events.ts` gains snare ghosts and a hat accent pattern. The templates gain the
data all three read, plus re-tuned density bands and levels.

The timing model is the interesting part and it is entirely a function of the
`rng` already passed in, so determinism is preserved for free. The dynamics fix
is small but touches the pack contract, which Epic 2 is authoring against
concurrently — so that contract is frozen here before either starts.

## Architecture

**A hit's onset**, in the order the terms are applied:

```
grid position
  + swing                          applySwing        (unchanged)
  + lean[voice]                    constant per template
  + walk(voice, n)                 gaussian random walk, seeded
  + drift(t)                       zero at every pass boundary
  ─────────────────────────────────
  clamped so |lean + walk| < 0.49 × step             (the sum, not each term)
```

The clamp moves from being per-term to being on the sum. A 15 ms lean plus an
11 ms walk at 68 bpm is comfortably inside a sixteenth, but the guard has to be
on what actually displaces the note.

**The walk** is a bounded random walk per voice: `d[n] = clamp(d[n-1] +
gaussian(rng) × step, -bound, +bound)`, with `d[-1] = 0` and one series per
voice per pass. Consecutive hits therefore move together; independent draws are
what today's `bipolar()` produces and what reads as sloppiness.

**Gaussian from a uniform rng** without a dependency: sum three uniform draws
and centre them. It is not a true normal, but it concentrates near zero, which
is the property R4 asks for, and it costs three calls to the existing generator.

**Drift** is `sin(2π × passPhase)` scaled by the template's depth — zero at both
ends of every pass by construction, so `fitToLoop` has nothing to correct and
the seam is untouched.

**The dynamics fix.** Today:

```
layer = first layer whose maxVelocity ≥ v      → an already-loud sample
addAt(..., gain: v)                            → multiplied by v again
```

After:

```
layer = first layer whose maxVelocity ≥ v      → unchanged
nominal = midpoint of that layer's band
addAt(..., gain: v / nominal)                  → 1.0 at the band's centre
```

At a boundary the two neighbouring layers now meet: v just under the boundary
gives the quieter sample scaled up, v just over gives the louder sample scaled
down, and the curve is continuous. `PackSample` carries the nominal so the
arithmetic stays in `voices.ts` and the pack stays declarative.

## Contracts

Frozen before any track starts. The first is shared with Epic 2.

```ts
// scripts/grooves/types.ts
export type VelocityLayer = {
  maxVelocity: number
  files: string[]
  /** Optional. Defaults to the midpoint of this layer's band. */
  nominalVelocity?: number
}

export type PackSample = {
  pcm: Pcm
  rootMidi?: number
  /** The velocity this layer's samples were recorded at, 0..1. */
  nominalVelocity: number
}

export type FeelTemplate = {
  // ...existing fields
  humanize: {
    timingMs: number
    velocity: number
    /** Signed ms per voice. Negative pushes, positive lays back. */
    lean: Partial<Record<VoiceName, number>>
    /** Fractional tempo deviation, e.g. 0.006 for ±0.6 %. */
    driftDepth: number
  }
}
```

```ts
// scripts/grooves/humanize.ts
export function humanize(
  events: NoteEvent[],
  template: FeelTemplate,
  rng: () => number,
  bpm?: number,
): NoteEvent[]                              // signature unchanged

export function applyDrift(
  events: NoteEvent[],
  depth: number,
  passSec: number,
): NoteEvent[]
```

`humanize()` keeps its signature so Epic 1's per-pass call site does not move.

## Tracks

### Track A — The timing model

- **Goal** — lean, correlated gaussian deviation and per-pass drift, bounded.
- **Owns** — `scripts/grooves/humanize.ts`, `scripts/grooves/humanize.test.ts`.
- **Depends on** — the `FeelTemplate.humanize` contract.
- **Parallel with** — B, C, D.
- **Done when** — its own tests pass with a hand-built template.

### Track B — The dynamics fix

- **Goal** — a velocity sweep produces a continuous level curve.
- **Owns** — `scripts/grooves/pack.ts`, `scripts/grooves/voices.ts` and their
  tests; the `VelocityLayer` and `PackSample` fields in `types.ts`.
- **Depends on** — the `PackSample` contract.
- **Parallel with** — A, C, D.
- **Done when** — the sweep test passes against a synthetic two-layer pack.

### Track C — Ghosts and accents

- **Goal** — the snare plays ghost notes; the hats follow an accent pattern.
- **Owns** — `scripts/grooves/events.ts` (the `VELOCITIES` table, `velocityFor`
  and the snare placement) and `scripts/grooves/events.test.ts`.
- **Depends on** — nothing. It shares `events.ts` with Epic 1, which owns the
  pass loop and rng labels; this track owns only what is emitted inside it.
- **Parallel with** — A, B, D.
- **Done when** — its own tests pass.

### Track D — Bands and levels

- **Goal** — the gate admits the grooves the other tracks produce, at a balance
  someone chose.
- **Owns** — `scripts/grooves/templates/*.ts` (`humanize`, `density` and `gain`).
- **Depends on** — A, B and C merged; there is nothing to tune before then.
- **Parallel with** — nothing.
- **Done when** — the catalogue renders and passes the gate.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C.
- **Wave 2:** Track D — needs all three merged to have something to balance.
- **Wave 3:** Integration — re-render, verify, listen. Epic 2 rebases onto the
  levels Track D lands.

## Implementation

### Track A — The timing model

#### Step A1 — A voice leans consistently

Covers: R1, R2, AC1, AC2

- **Test first** — `scripts/grooves/humanize.test.ts`: build a template with
  `humanize: { timingMs: 0, velocity: 0, lean: { snare: 12, hatClosed: -4 },
  driftDepth: 0 }`, humanize four snare and four hat events on the grid, and
  assert every snare `timeSec` is exactly `+0.012` from its input and every hat
  `-0.004`. Run it: fails with `expected 1 to be 1.012`.
- **Implement** — `scripts/grooves/humanize.ts`: read
  `template.humanize.lean[event.voice] ?? 0`, convert to seconds, and add it
  before the random term. Keep the early return for the all-zero case, extended
  to require an empty `lean` too.
- **Green when** — both assertions pass and the existing zero-deviation test
  stays green.
- **Refactor** — none.

#### Step A2 — Deviations concentrate near zero

Covers: R4, R7, AC4, AC7

- **Test first** — `scripts/grooves/humanize.test.ts`: draw 2000 deviations from
  the new `gaussianUnit(rng)` and assert more than half fall within a third of
  the bound, and that fewer than 5 % fall in the outer tenth. Run it: fails with
  `gaussianUnit is not a function`.
- **Implement** — `humanize.ts`: `function gaussianUnit(rng: () => number):
  number` returning `(rng() + rng() + rng()) / 1.5 - 1`, in −1..1, concentrated
  at 0. Replace `bipolar()`'s use in the velocity term with it.
- **Green when** — both assertions pass, and rendering the same spec twice still
  produces identical output.
- **Refactor** — delete `bipolar()` once nothing calls it.

#### Step A3 — Adjacent hits move together

Covers: R3, AC3

- **Test first** — `scripts/grooves/humanize.test.ts`: humanize sixteen kick
  events with `timingMs: 10`, collect the deviations, and assert the mean
  absolute difference between neighbours is less than half the mean absolute
  deviation — a walk moves less between steps than it does from zero. Run it:
  fails, because independent uniform draws make the two roughly equal.
- **Implement** — `humanize.ts`: keep a `Map<VoiceName, number>` of the running
  deviation; per event, `next = clamp(previous + gaussianUnit(rng) * bound,
  -bound, bound)`, store it, apply it.
- **Green when** — the assertion passes and A2's distribution assertion still
  holds.
- **Refactor** — none.

#### Step A4 — Nothing crosses a subdivision

Covers: R6, AC6

- **Test first** — `scripts/grooves/humanize.test.ts`: with an extreme template
  — `timingMs: 60, lean: { snare: 40 }` at 68 bpm on a sixteenth grid — assert
  every returned `timeSec` rounds to the grid step it started on. Run it: fails,
  because the lean is added outside the existing clamp.
- **Implement** — `humanize.ts`: compute `displacement = lean + walk`, then clamp
  the **sum** to `±0.49 × stepSec` before adding it to `timeSec`.
- **Green when** — the assertion passes for every voice and both grids.
- **Refactor** — none.

#### Step A5 — The tempo breathes and comes back

Covers: R13, AC12

- **Test first** — `scripts/grooves/humanize.test.ts`: call `applyDrift` on
  events at t=0, t=passSec/2 and t=passSec with `depth: 0.006`, and assert the
  first and last are unmoved and the middle is displaced by a non-zero amount
  under `0.006 × passSec`. Run it: fails with `applyDrift is not a function`.
- **Implement** — `humanize.ts`: `applyDrift(events, depth, passSec)` displaces
  each event by `depth * passSec * sin(2π * ((timeSec % passSec) / passSec))`.
  Zero at both ends by construction.
- **Green when** — the assertions pass and the total loop length is unchanged.
- **Refactor** — none.

### Track B — The dynamics fix

#### Step B1 — The pack reports which band it answered from

Covers: R8, AC8

- **Test first** — `scripts/grooves/pack.test.ts`: build a pack from a synthetic
  declaration with layers at `maxVelocity` 0.45 and 1.0 and assert
  `pack.get('kick', { velocity: 0.3, index: 0 })!.nominalVelocity` is `0.225`
  and that `velocity: 0.9` gives `0.725`. Run it: fails with
  `expected undefined to be 0.225`.
- **Implement** — `scripts/grooves/types.ts`: add `nominalVelocity` to
  `PackSample` and the optional field to `VelocityLayer`. `pack.ts`: `pick()`
  returns the layer alongside the PCM; `get()` sets `nominalVelocity` to
  `layer.nominalVelocity ?? (lowerBound + layer.maxVelocity) / 2`, where
  `lowerBound` is the previous layer's `maxVelocity` or 0.
- **Green when** — both assertions pass and every existing pack test stays green.
- **Refactor** — none.

#### Step B2 — Level is continuous across a layer boundary

Covers: R8, R9, AC8

- **Test first** — `scripts/grooves/voices.test.ts`: with a two-layer synthetic
  pack whose layers differ in recorded level by 6 dB, render one event at each of
  40 velocities from 0.02 to 1.0, measure each track's peak, and assert the
  sequence is non-decreasing and that no step-to-step ratio exceeds 1.3. Run it:
  fails at the 0.45 boundary with a ratio near 2.
- **Implement** — `scripts/grooves/voices.ts`: `addAt(track.pcm, source, offset,
  event.velocity / sample.nominalVelocity)`, clamped to a sane ceiling so a very
  quiet layer cannot be scaled into distortion.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track C — Ghosts and accents

#### Step C1 — The snare plays ghost notes

Covers: R10, AC9

- **Test first** — `scripts/grooves/events.test.ts`: build a `straight-funk`
  groove and assert at least two snare events fall on odd sixteenth steps with
  `velocity < GHOST_VELOCITY_THRESHOLD`, and that every backbeat snare is louder
  than every ghost. Run it: fails with `expected 0 to be greater than 1`.
- **Implement** — `scripts/grooves/events.ts`: add `SNARE_GHOST_PATTERNS`, a
  small vocabulary of off-sixteenth step lists, drawn from the rhythm generator
  like the other patterns; emit them at velocity 0.15–0.25 via a `ghost` branch
  in the snare loop.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — The hats follow an accent pattern

Covers: R11, R12, AC10, AC11

- **Test first** — `scripts/grooves/events.test.ts`: assert the hat velocities of
  one bar are not determined by metric position alone — concretely, that two hat
  events on the same metric class (both odd sixteenths, say) carry different
  velocities; and separately that the backbeat snare is louder than the snare
  events adjacent to it. Run it: fails, because `velocityFor` is a pure function
  of the step.
- **Implement** — `events.ts`: add `HAT_ACCENTS`, a four-step multiplier cycle,
  applied to `velocityFor('hatClosed' | 'hatOpen', step)` by position within the
  cycle. Kick, snare, bass and comp keep `velocityFor` unchanged.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track D — Bands and levels

#### Step D1 — Every template declares its lean and drift

Covers: R1, R2, R13, AC2

- **Test first** — `scripts/grooves/templates/index.test.ts`: for every template
  assert `humanize.lean` has an entry for `snare` and at least one hat voice,
  that `lean.snare > 0`, that every hat lean is `<= 0`, and that
  `humanize.driftDepth` is between 0 and 0.01. Run it: fails with
  `expected undefined to be defined`.
- **Implement** — the four template files: add `lean` and `driftDepth`, with a
  comment on each naming the feel's intent. A shuffle lays back further than a
  bright straight-eighths feel.
- **Green when** — the assertions pass.
- **Refactor** — none.

#### Step D2 — The bands admit the new grooves

Covers: R14, R15, AC13

- **Test first** — `scripts/grooves/cli.test.ts`: render the whole catalogue with
  `encode: false` and assert `gateCandidate` returns `null` for every entry.
  Run it: fails with density failures on the ghost-carrying templates.
- **Implement** — the four template files: widen `density.maxPerBar` to cover
  the ghosts, deliberately, with a comment saying what the ghosts added.
- **Green when** — every entry gates clean.
- **Refactor** — none.

#### Step D3 — The levels suit the fixed scaling

Covers: R14a, R14b, AC13, AC13a

- **Test first** — `scripts/grooves/cli.test.ts`: assert every rendered master's
  true peak sits on `PEAK_CEILING` and no per-voice track is more than 30 dB
  below the loudest. Run it: passes or fails depending on how far the fix moved
  things; either way it is the guard.
- **Implement** — the four template files: adjust `gain` per voice for the
  corrected scaling. These are a baseline for Epic 2 to rebase onto, so no test
  pins a specific value.
- **Green when** — the assertions pass and the catalogue sounds balanced.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Re-render and lock

Covers: R15, R16, AC14

- Run `npm run grooves`. Epic 1's answer-pinning test must stay green and the
  manifest must differ only by `headDelaySeconds`.
- Run twice; `git status` clean. Then `npm run grooves:verify` and `npm test`.

#### Step I2 — The demo path

Covers: R1–R3, R10, R11, AC15

- Play the same seeds before and after across all four templates. The snare sits
  behind the beat, ghosts are audible between the backbeats, and no hi-hat jumps
  in level. Confirm the shuffle still swings and the half-time feel has not
  become busy.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, D1 |
| R2 | A1, D1 |
| R3 | A3 |
| R4 | A2 |
| R5 | A3 (the bass shares the kick's series — see Assumptions) |
| R6 | A4 |
| R7 | A2, I1 |
| R8 | B1, B2 |
| R9 | B2 |
| R10 | C1 |
| R11 | C2 |
| R12 | C2 |
| R13 | A5, D1 |
| R14 | D2 |
| R14a, R14b | D3 |
| R15 | D2, D3, I1 |
| R16 | I1 |
| AC1 | A1 |
| AC2 | D1 |
| AC3 | A3 |
| AC4 | A2 |
| AC5 | A3 |
| AC6 | A4 |
| AC7 | A2, I1 |
| AC8 | B1, B2 |
| AC9 | C1 |
| AC10 | C2 |
| AC11 | C2 |
| AC12 | A5 |
| AC13, AC13a | D2, D3 |
| AC14 | I1 |
| AC15 | I2 |

## Assumptions

- **R5 (bass locks to kick)** is implemented as a shared walk series: the walk
  map is keyed by a *group* rather than a voice, with `kick` and `bass` in one
  group and every other voice in its own. That is the smallest change that makes
  the bass track the kick without a second mechanism, and AC5 asserts the
  outcome rather than the mechanism.
- `gaussianUnit` is a sum of three uniforms rather than Box–Muller. The
  requirement is concentration near zero, not normality, and three calls keep
  the seeded stream cheap and reproducible.
- The walk bound is `template.humanize.timingMs`, unchanged in meaning — it is
  now the walk's ceiling rather than a uniform half-width.
- Drift is applied after swing and lean and before `fitToLoop`, on the whole
  event list, using the pass length Epic 1 makes available.
- Ghost velocities are literals in `events.ts` rather than template data. If a
  template turns out to want its own, that is a field, and it belongs here
  before Epic 6 starts.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/writespec feature-9 epic-3` — the answer gets applied to the
design and steps, moved into the log, and replaced by whatever it opens up.

### Q1. Where does a velocity layer's nominal loudness come from?

Step B1 defaults it to the midpoint of the layer's declared band. The alternative
is to declare it per layer in `pack.json`, measured from the samples. This is
shared with Epic 2, which is authoring `pack.json` at the same time, and
changing it afterwards means re-tuning every template level again.

- [ ] A) Derived from the band, with an optional per-layer override in
      `pack.json` *(recommended — it needs no work from Epic 2 to be correct on
      day one, and the override exists for the case where a layer's recorded
      level turns out not to sit where its band says; the contract above already
      carries both)*
- [ ] B) Declared per layer, measured at prepare time — the levels then reflect
      the samples rather than the declaration, at the cost of Epic 2 having to
      measure every layer
- [ ] C) Measured at load time from the decoded PCM's peak, so the declaration
      cannot drift from the audio — at the cost of load-time work and a render
      that changes when a sample is re-trimmed
- [ ] D) Neither: normalise the layers on the way into the pack and carry the
      dynamics entirely in the velocity multiply, reversing the "layers are not
      normalised" rule
