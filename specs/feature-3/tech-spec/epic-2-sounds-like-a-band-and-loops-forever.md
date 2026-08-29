# Tech spec — Epic 2: Grooves that sound like a band, and loop forever

PRD: [../prd/epic-2-sounds-like-a-band-and-loops-forever.md](../prd/epic-2-sounds-like-a-band-and-loops-forever.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Epic 1 froze four stage boundaries; this epic replaces the innards of three of them and
adds nothing new to the pipeline's shape. **Events** gains swing, humanization and
dynamics. **Voices** starts honouring the velocity layers and round-robins the pack has
declared since Epic 1, and starts rendering past the loop end so tails can wrap.
**Mix** gains per-voice panning, bus processing and true-peak normalization, and folds
the overhang back onto the start so the loop closes. One small change lands in the app:
`createAudioPlayer` loops.

Because the three stages are independent modules with frozen signatures, they are three
parallel tracks that meet at a single wrap-and-normalize step. Nothing here changes a
type, so no other epic is disturbed.

## Architecture

- **Humanization lives in the events stage**, not the voices stage. Timing and velocity
  deviation is musical information, so it belongs where the music is decided — and
  putting it there keeps it pure, deterministic and testable without rendering a sample.
- **The seam is solved by overhang, not crossfade.** `renderVoices` renders a buffer one
  bar longer than the loop; `mixTracks` adds the overhang region back onto the start and
  truncates to exactly 4 bars. A decaying cymbal at bar 4 therefore rings over bar 1 the
  way it would if the loop were really repeating, and no fade is needed. A crossfade
  would blur the downbeat, which is the one moment that must be sharp.
- **Determinism is preserved** by drawing every humanization and round-robin choice from
  `rngFor(`${spec.id}:humanize`)` and `rngFor(`${spec.id}:rr`)`. The PRD's determinism
  requirement from Epic 1 still holds after this epic; Step I1 re-asserts it.
- **Loudness is peak-based.** `mixTracks` normalizes true peak to a fixed ceiling. This
  is a peak measure, not a perceived-loudness one, so the residual gap between a dense
  and a sparse groove is closed by per-template `gain` values, tuned by ear.
- **The app loops** via the audio element's own `loop` property. No re-triggering on
  `ended`, which would gap.
- **Pitch shifting stays linear.** Rather than a better interpolator, the pack is
  sampled densely enough — a note every third semitone or closer — that no sample is
  ever shifted more than two semitones, where linear interpolation is transparent. The
  quality problem is solved at sourcing time instead of at render time, which costs
  nothing per render and no code.

## Contracts

No contract changes. Every signature frozen in Epic 1 is unchanged, and this is what
lets the epic proceed as three parallel tracks.

Two internal constants become shared and are set here:

```ts
// scripts/grooves/mix.ts
export const PEAK_CEILING_DBFS = -1.0
export const SEAM_THRESHOLD = 0.02   // max |sample[last] - sample[0]| after wrap
```

One field of the Epic 1 contract starts being read for the first time:

```ts
// FeelTemplate.humanize — declared in Epic 1, applied here
humanize: { timingMs: number; velocity: number }
```

And one app-side signature gains a parameter:

```ts
// src/features/daily-groove/lib/audio.ts
export function createAudioPlayer(src: string, opts?: { loop?: boolean }): AudioPlayer
```

## Tracks

### Track A — Feel: swing, humanization, dynamics

- **Goal** — the event stream stops being a grid and starts being a performance.
- **Owns** — `scripts/grooves/events.ts`, `scripts/grooves/humanize.ts`,
  `scripts/grooves/templates/**`
- **Depends on** — the `NoteEvent` and `FeelTemplate` contracts only.
- **Parallel with** — Tracks B, C, D
- **Done when** — its tests pass with no audio rendered.

### Track B — Voices: layers, round-robins, overhang

- **Goal** — the renderer uses everything the pack declares, and renders past the end.
- **Owns** — `scripts/grooves/voices.ts`
- **Depends on** — the `SamplePack` and `Track` contracts only. Its tests build event
  arrays by hand, so it never waits on Track A.
- **Parallel with** — Tracks A, C, D
- **Done when** — layer and round-robin selection are proven, and a track is one bar
  longer than the loop.

### Track C — Mix: pan, bus, normalize, wrap

- **Goal** — one balanced, non-clipping, seamless 4-bar buffer.
- **Owns** — `scripts/grooves/mix.ts`
- **Depends on** — the `Track` and `Pcm` contracts only.
- **Parallel with** — Tracks A, B, D
- **Done when** — a synthetic overhang wraps correctly and the peak lands on the
  ceiling.

### Track D — Looping playback

- **Goal** — the app repeats the groove until stopped.
- **Owns** — `src/features/daily-groove/lib/audio.ts` and its test
- **Depends on** — nothing in this epic.
- **Parallel with** — Tracks A, B, C
- **Done when** — its tests pass. This track is a handful of lines and can be taken by
  whoever finishes first.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D
- **Wave 2:** Integration — the three stages meet, the seam is measured end to end, and
  the sign-off listening session happens.

## Implementation

### Track A — Feel: swing, humanization, dynamics

#### Step A1 — Swing displaces the off-beats only

Covers: R4, AC3

- **Test first** — `scripts/grooves/humanize.test.ts`: `applySwing(events, 0.3, subdivision)`
  leaves every event on an even subdivision at its original `timeSec` and moves every
  event on an odd subdivision later; with `swing: 0` nothing moves. Run it: fails,
  "applySwing is not a function".
- **Implement** — `scripts/grooves/humanize.ts`: `applySwing(events, swing, subdivision, tempo)`,
  delaying odd subdivisions by `swing × halfSubdivision`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A2 — Every note is nudged, within declared bounds

Covers: R5, R7, AC4, AC5

- **Test first** — same file: `humanize(events, template, rng)` returns events whose
  `timeSec` each differ from the input by at most `template.humanize.timingMs`, whose
  velocities differ by at most `template.humanize.velocity` and stay within 0..1, and
  where no event has crossed into a neighbouring subdivision. Run it: fails,
  "humanize is not a function".
- **Implement** — `humanize.ts`: `humanize(events, template, rng)` drawing a bipolar
  deviation per event and clamping the timing offset to half a subdivision.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A3 — Humanization is reproducible

Covers: R5, AC4

- **Test first** — same file: `humanize(events, t, rngFor('g:humanize'))` called twice
  with freshly seeded generators deep-equals itself. Run it: fails if the deviation is
  drawn from anything but the seeded generator.
- **Implement** — thread `rngFor` through; no `Math.random`.
- **Green when** — the two results are identical.
- **Refactor** — none.

#### Step A4 — Grooves have ghost notes and accents

Covers: R6, AC6

- **Test first** — `scripts/grooves/events.test.ts`: for a built groove, the set of
  distinct velocities has more than one member; the snare backbeat events are louder
  than the mean hat velocity; and at least one hat event is below the ghost threshold.
  Run it: fails while Epic 1's flat velocities hold.
- **Implement** — `events.ts`: assign velocities by metric position — backbeats
  accented, off-beat 16ths ghosted — before humanization runs.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A5 — The feel pipeline is wired into event building

Covers: R4, R5, R6, R9, AC13

- **Test first** — same file: a groove built from a swung template has off-beat events
  later than the straight grid, and every event's onset still maps to a subdivision of
  the stated tempo across all 4 bars. Run it: fails until `buildEvents` calls the new
  stages.
- **Implement** — `events.ts`: after placement, apply accents, then `applySwing`, then
  `humanize`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A6 — No lead voice occupies the soloist's register

Covers: R8, R10

- **Test first** — same file: no event uses a voice outside
  `['kick','snare','hatClosed','hatOpen','rim','bass','comp']`, every `comp` event's
  `midi` sits below the register ceiling constant, and every `bass` event sits below the
  comp's lowest note. Run it: fails if comp voicings drift upward.
- **Implement** — `events.ts`: voice the comp chords within a fixed register window and
  keep bass below it.
- **Green when** — all three assertions pass.
- **Refactor** — none.

### Track B — Voices: layers, round-robins, overhang

#### Step B1 — Velocity picks a different recording

Covers: R1, AC1

- **Test first** — `scripts/grooves/voices.test.ts`: against a pack declaring two kick
  layers with distinguishable samples, rendering one event at `velocity: 0.2` and one at
  `velocity: 0.95` produces regions whose samples differ beyond a gain scaling — assert
  the two normalized regions are not equal. Run it: fails while `renderVoices` passes
  `velocity: 1`.
- **Implement** — `voices.ts`: pass each event's own `velocity` to `pack.get`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step B2 — Repeated hits rotate through alternates

Covers: R2, AC2

- **Test first** — same file: four consecutive equal-velocity kick events against a pack
  with three round-robin files produce at least two distinct source regions. Run it:
  fails while `index: 0` is hard-coded.
- **Implement** — `voices.ts`: keep a per-voice counter and pass it as `index`, so
  `pack.get` rotates. Seed the starting offset from `rngFor(`${id}:rr`)` so it is
  deterministic but not always the same alternate first.
- **Green when** — the assertion passes.
- **Refactor** — extract the counter into a small `RoundRobin` helper.

#### Step B2b — No sample is shifted more than two semitones

Covers: R3

- **Test first** — `scripts/grooves/voices.test.ts`: for every pitched event across a
  full groove rendered against the real pack declaration, the distance between the
  event's `midi` and the sampled note chosen for it is two semitones or fewer. Run it:
  fails against a sparsely sampled pack, which is exactly the signal that the pack needs
  more notes rather than that the renderer needs a better interpolator.
- **Implement** — `voices.ts`: nothing beyond Epic 1's nearest-note selection; if the
  assertion fails, the fix belongs in the pack, not here.
- **Green when** — the assertion passes for every pitched event.
- **Refactor** — none.

#### Step B3 — Tracks are rendered one bar past the loop

Covers: R14

- **Test first** — same file: `renderVoices(events, pack, sampleRate, { overhangBars: 1 })`
  returns tracks whose length is 5 bars at the stated tempo, and an event placed at bar
  4 with a long sample writes non-zero samples into the fifth bar. Run it: fails while
  writes past the end are clipped.
- **Implement** — `voices.ts`: size buffers to `bars + overhangBars` and stop clipping.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track C — Mix: pan, bus, normalize, wrap

#### Step C1 — Voices are panned

Covers: R11

- **Test first** — `scripts/grooves/mix.test.ts`: mixing a single hard-panned track
  produces a buffer whose left and right energies differ; a centred track produces equal
  energies. Run it: fails while `mixTracks` sums both channels identically.
- **Implement** — `mix.ts`: read a `pan` map from the template alongside `gain`, and
  apply equal-power panning per voice.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — The overhang wraps onto the start

Covers: R14, R15, AC9

- **Test first** — same file: given a track of 5 bars whose fifth bar holds a known
  ramp and whose first bar is silent, `mixTracks(tracks, template, { loopBars: 4 })`
  returns a 4-bar buffer whose first bar contains that ramp. Run it: fails,
  `mixTracks` takes no loop length.
- **Implement** — `mix.ts`: sum the region past `loopBars` back onto the start, then
  truncate to exactly `loopBars`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C3 — The master sits on the ceiling and never clips

Covers: R12, R13, AC7, AC8

- **Test first** — same file: a deliberately over-loud mix returns a buffer whose true
  peak equals `PEAK_CEILING_DBFS` within a small tolerance and whose maximum absolute
  sample is below 1.0; a quiet mix is brought *up* to the same ceiling. Run it: fails
  while normalization only attenuates.
- **Implement** — `mix.ts`: measure true peak with inter-sample estimation over a 4×
  oversampled window, then scale to the ceiling in both directions.
- **Green when** — all three assertions pass.
- **Refactor** — extract `truePeak(pcm)`.

#### Step C4 — The seam is measurably closed

Covers: R15, AC9

- **Test first** — same file: for a mixed buffer, `|left[last] - left[0]|` and the same
  for right are both below `SEAM_THRESHOLD`, and the mean energy of the last 512 samples
  is within a factor of two of the first 512. Run it: fails on a buffer built without
  the wrap.
- **Implement** — nothing new if C2 is correct; if the assertion fails, the wrap region
  length is wrong.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track D — Looping playback

#### Step D1 — The player loops until stopped

Covers: R17, AC11, AC12

- **Test first** — `src/features/daily-groove/lib/audio.test.ts`: `createAudioPlayer(src, { loop: true })`
  produces a player whose underlying element has `loop === true`; with no options it is
  `false`; and after `stop()` the element is paused. Run it: fails,
  `createAudioPlayer` takes one argument.
- **Implement** — `audio.ts`: accept `opts` and set `element.loop = opts?.loop ?? false`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step D2 — The feature plays the groove looped

Covers: R17, AC11

- **Test first** — `src/features/daily-groove/components/GroovePuzzle.test.tsx`: the
  player created for today's groove is constructed with `{ loop: true }`. Run it: fails
  while the call site passes only `src`.
- **Implement** — update the call site.
- **Green when** — the assertion passes and every existing feature test stays green.
- **Refactor** — none.

### Wave 2 — Integration and verification

#### Step I1 — The whole pipeline is still deterministic

Covers: R5, AC4

- **Test first** — `scripts/grooves/cli.test.ts`: `generate` run twice produces
  identical pre-encode PCM, as it did in Epic 1. Run it: fails if any of swing,
  humanization or round-robin selection drew from an unseeded source.
- **Implement** — fix the offending draw.
- **Green when** — the buffers are byte-identical.
- **Refactor** — none.

#### Step I2 — The rendered groove passes every audio assertion at once

Covers: R9, R12, R15, R16, AC7, AC9, AC10, AC13

- **Test first** — `scripts/grooves/cli.test.ts`: render the real catalogue entry
  through the full pipeline and assert, on one buffer: peak at the ceiling, no sample at
  or beyond 1.0, seam below threshold, onsets on the tempo grid across all 4 bars, and —
  after encoding and decoding the mp3 — no leading or trailing silence beyond 10 ms.
- **Implement** — adjust `encode.ts`'s ffmpeg flags if the decode shows encoder padding.
- **Green when** — every assertion passes.
- **Refactor** — none.

#### Step I3 — The sign-off

Covers: R18, AC14

- Run `npm run grooves`, open the app, press play, and leave it looping.
- The briefing's author plays along on an instrument for a few minutes and confirms the
  groove is natural and funky enough to jam with, and that the loop point is inaudible.
- **A rejection is not a waiver.** It returns to Track A's template values — swing
  amount, humanize bounds, accent depths — and Track C's per-voice gain and pan, and the
  session is repeated.
- Record the outcome in the PR.

#### Step I4 — Full verification

- `npm test`, `npm run lint`, `npx tsc --noEmit` all green.
- Epic 1's determinism and manifest tests still pass unchanged — no contract moved.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1 |
| R2 | B2 |
| R3 | B1, B2, B2b |
| R4 | A1, A5 |
| R5 | A2, A3, A5, I1 |
| R6 | A4, A5 |
| R7 | A2 |
| R8 | A6 |
| R9 | A5, I2 |
| R10 | A6 |
| R11 | C1 |
| R12 | C3, I2 |
| R13 | C3 |
| R14 | B3, C2 |
| R15 | C2, C4, I2 |
| R16 | I2 |
| R17 | D1, D2 |
| R18 | I3 |
| AC1 | B1 |
| AC2 | B2 |
| AC3 | A1 |
| AC4 | A2, A3, I1 |
| AC5 | A2 |
| AC6 | A4 |
| AC7 | C3, I2 |
| AC8 | C3 |
| AC9 | C2, C4, I2 |
| AC10 | I2 |
| AC11 | D1, D2 |
| AC12 | D1 |
| AC13 | A5, I2 |
| AC14 | I3 |

## Assumptions

- `pan` joins `gain` as a per-voice map on `FeelTemplate`. It is an additive field on a
  type Epic 1 froze, so no existing consumer breaks.
- The register ceiling for comp voicings and the ghost-note threshold are named
  constants in `events.ts`.
- Round-robin rotation is per voice per render, with a seeded starting offset — so two
  grooves do not always open on the same alternate.
- True peak is estimated by 4× oversampling, which is adequate at the ceiling we use.
- Linear interpolation is retained for pitch shifting. If a later template needs a
  register the pack does not cover densely, the fix is more sampled notes, not a better
  interpolator — Step B2b is the assertion that forces that choice.
- The overhang is one bar. A groove with a longer tail than that would need more, and
  Step C4's seam assertion is what would reveal it.
- Epic 3 does not start until this epic merges, so no catalogue audio is being rendered
  while these stages are in flux.

## Decision log

### Cycle 1 — 2026-08-29

**Q2. Epic 1 resamples by linear interpolation. Does the pitched path need better?**
Decision: **A) Keep linear interpolation and sample the pack more densely** — the
quality problem moves to sourcing time, where it costs nothing per render.
Changed: Architecture gains the shift-bound rule; new Step B2b asserts the bound;
Epic 1's Step D3 tightened to require a sampled note every third semitone.

### Cycle 2 — 2026-08-29

**Q1. How is the loop's tail actually produced?**
Decision: **A) Render one bar of overhang and sum it back onto the start** — it is what
a real repeating loop sounds like, and a crossfade would blur the downbeat.
Changed: nothing — the Architecture and Steps B3, C2 and C4 were already written this
way, and are now settled rather than provisional.

---

**This spec is ready to execute.** Every architectural decision is settled.
