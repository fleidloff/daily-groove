# Tech spec — Epic 4: It sounds like a band in a room

PRD: [../prd/epic-4-it-sounds-like-a-band-in-a-room.md](../prd/epic-4-it-sounds-like-a-band-in-a-room.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four tracks against four different files. `voices.ts` learns to stop a note and
to choke an open hat. `events.ts` learns to voice-lead, spread and thin the
comp, and to write a bass line with an approach note. `gate.ts` gains the pitch
check that the approach note makes necessary. `mix.ts` gains a reverb send,
placed before the overhang fold so the room folds like every other tail.

The pitch check is the load-bearing piece. `checkHarmony` today validates the
harmony *object* and never reads a `NoteEvent`; the events are in scale only
because every pitch is derived from `harmony.progressionMidi`. This epic breaks
that derivation, so the invariant has to become a check before the thing that
breaks it lands. Track C therefore goes first inside its own wave-1 slot: its
test is written and green against today's catalogue *before* Track B starts
emitting approach notes.

## Architecture

**Note-offs.** `addAt` currently copies the whole sample. It gains a release
window: samples are copied up to `durationSec` and then faded over
`RELEASE_SEC`, so a note has an ending. Percussion is unaffected in practice
because its declared durations already exceed its sample lengths; the comp and
the bass are where this is audible.

`fitToLoop` currently stretches the last-ending event so the buffer measures the
right length. Once duration is audible that stretch is a lengthened note, so it
moves: `fitToLoop` stops touching durations and `renderVoices` sizes the buffer
from `bars`/`bpm`, which it already does whenever `cli.ts` supplies them.

**The hat choke** is a post-pass in `renderVoices`: after all events are placed,
for each `hatClosed` onset, fade the `hatOpen` track to zero over a few
milliseconds at that offset. It is a property of the two tracks, not of a
general choke-group mechanism.

**Comp voicing.** `inCompRegister` folds each tone independently. It is replaced
by `voiceLead(previous, chord)`, which folds each tone of the new chord into the
register window at the octave nearest the previous voicing's corresponding tone,
minimising total motion. The first bar's voicing is the current independent
fold, so `music.chord` still names bar one's pitches exactly.

**The pitch check** lives in `scripts/grooves/theory/pitches.ts`, next to the
harmony rules rather than inside the gate, because it is a musical rule:

```
every pitched event is in scale
  EXCEPT one bass event per chord change, on the last off-beat before it,
  a semitone from the next chord's root
```

**The room.** A Schroeder reverb — four parallel comb filters into two allpass
stages — written in `mix.ts`. It is arithmetic on Float32Arrays: no dependency,
no impulse file, byte-deterministic, and fast enough for a 40-second stereo
buffer. It runs on the summed bus **before** `wrap()`, so its tail lands in the
overhang and folds onto bar one.

```
tracks → gain/pan → sum → reverb send → wrap(overhang) → bus() → normalise()
                                ↑
                        HERE, not after wrap
```

## Contracts

```ts
// scripts/grooves/theory/pitches.ts
export type PitchFailure = { voice: VoiceName; midi: number; timeSec: number }

/** Every pitched event that the scale does not admit, approach notes aside. */
export function offScalePitches(
  events: NoteEvent[],
  music: MusicMeta,
  harmony: Harmony,
): PitchFailure[]
```

```ts
// scripts/grooves/voices.ts
export function addAt(
  target: Pcm,
  source: Pcm,
  offset: number,
  gain: number,
  durationSec?: number,   // new; undefined keeps today's copy-everything behaviour
): void
```

```ts
// scripts/grooves/mix.ts
/** Applied to the summed bus before the overhang is wrapped. */
export function applyRoom(left: Float32Array, right: Float32Array, sampleRate: number): void
export const ROOM_SEND = 0.18   // one amount, whole mix
```

```ts
// scripts/grooves/events.ts
export function voiceLead(previous: number[] | null, chordMidi: number[]): number[]
```

`gate.ts` gains a `pitch` check between `harmony` and `density`.
`FeelTemplate` is **not** extended by this epic.

## Tracks

### Track A — Notes end, and hats choke

- **Goal** — `durationSec` is audible and a closed hat cuts an open one.
- **Owns** — `scripts/grooves/voices.ts`, `scripts/grooves/voices.test.ts`, and
  `fitToLoop` in `scripts/grooves/humanize.ts`.
- **Depends on** — the `addAt` contract.
- **Parallel with** — B, C, D. (It shares `humanize.ts` with Epic 3, which owns
  the deviation model; this track touches only `fitToLoop`.)
- **Done when** — its own tests pass.

### Track B — Hands and fingers

- **Goal** — voice-led, spread, shaped comp; a written bass line with an
  approach note.
- **Owns** — the comp and bass emission in `scripts/grooves/events.ts` and its
  tests.
- **Depends on** — Track C's check existing, so an approach note is validated the
  moment it is written.
- **Parallel with** — A, D.
- **Done when** — its own tests pass and the gate accepts the result.

### Track C — The pitch check

- **Goal** — the gate reads events, not only the harmony object.
- **Owns** — `scripts/grooves/theory/pitches.ts` (new), its test, and the new
  check in `scripts/grooves/gate.ts`.
- **Depends on** — nothing.
- **Parallel with** — A, D. **Merges before B.**
- **Done when** — it passes green against the whole current catalogue and fails
  on a hand-built off-scale event.

### Track D — The room

- **Goal** — one shared reverb, folded into the loop.
- **Owns** — `scripts/grooves/mix.ts`, `scripts/grooves/mix.test.ts`.
- **Depends on** — the `applyRoom` contract.
- **Parallel with** — A, B, C.
- **Done when** — its own tests pass and the seam holds.

## Execution waves

- **Wave 1 (parallel):** Track A, Track C, Track D.
- **Wave 2:** Track B — needs Track C merged so the approach note is checked
  from the moment it exists.
- **Wave 3:** Integration — re-render, verify, listen.

## Implementation

### Track A — Notes end, and hats choke

#### Step A1 — A note stops at its duration

Covers: R1, AC1

- **Test first** — `scripts/grooves/voices.test.ts`: render one `comp` event of
  `durationSec: 0.1` from a synthetic pack whose sample is 2 seconds of steady
  tone, and assert the track's RMS over 0.15–0.5 s is below a thousandth of its
  RMS over 0–0.05 s. Run it: fails — the tail runs the sample's full length.
- **Implement** — `voices.ts`: `addAt` takes `durationSec`; copy up to
  `durationSec × sampleRate` frames at full gain, then fade linearly to zero over
  `RELEASE_SEC = 0.008`. `renderVoices` passes `event.durationSec`.
- **Green when** — the assertion passes and the existing `addAt` tests, which
  omit the argument, stay green.
- **Refactor** — none.

#### Step A2 — The loop's length no longer depends on stretching a note

Covers: R1, AC2

- **Test first** — `scripts/grooves/humanize.test.ts`: call `fitToLoop` on events
  whose last one ends before `loopSec` and assert its `durationSec` is
  unchanged. Run it: fails — `fitToLoop` currently stretches it to the loop end.
- **Implement** — `humanize.ts`: `fitToLoop` keeps clamping onsets and truncating
  overruns, and stops stretching the last event. `renderVoices` already sizes
  the buffer from `bars`/`bpm` whenever `cli.ts` supplies them, which it always
  does.
- **Green when** — the assertion passes and a rendered groove is still exactly
  its loop length.
- **Refactor** — delete the now-unused `last` search in `fitToLoop`.

#### Step A3 — A closed hat chokes an open one

Covers: R2, AC3

- **Test first** — `scripts/grooves/voices.test.ts`: render a `hatOpen` at t=0
  and a `hatClosed` at t=0.2 from a pack whose open-hat sample rings for a
  second, and assert the `hatOpen` track's RMS over 0.25–0.5 s is below a
  hundredth of its RMS over 0–0.1 s. Run it: fails — the open hat rings through.
- **Implement** — `voices.ts`: after placing every event, for each `hatClosed`
  onset fade the `hatOpen` track to zero over `CHOKE_SEC = 0.005` from that
  offset onward.
- **Green when** — the assertion passes and a groove with no closed hats is
  unaffected.
- **Refactor** — none.

### Track C — The pitch check

#### Step C1 — Off-scale pitches are found

Covers: R9, R10, AC10, AC11

- **Test first** — `scripts/grooves/theory/pitches.test.ts` (new): build a C
  dorian harmony and a list of bass events on chord tones, assert
  `offScalePitches` returns `[]`; add one event on C♯ mid-bar and assert it
  returns exactly that event. Run it: fails with
  `Cannot find module './pitches.ts'`.
- **Implement** — `scripts/grooves/theory/pitches.ts`: `offScalePitches` walks
  events with a `midi`, tests `pitchesOf(music.root, music.flavour)` membership,
  and returns the failures. No exception yet.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — The gate rejects a groove whose events contradict its words

Covers: R10, R10a, AC10, AC11, AC11a

- **Test first** — `scripts/grooves/gate.test.ts`: gate a candidate whose events
  contain one off-scale bass note and assert the failure's `check` is `'pitch'`
  and its detail names the MIDI value. Then render every catalogue entry and
  assert none fails the pitch check. Run it: fails with `expected null to have
  property check`.
- **Implement** — `gate.ts`: add `checkPitches(events, music, harmony)` calling
  `offScalePitches`, inserted between `checkHarmony` and `checkDensity` in
  `gateCandidate`. Hard failure, no warning mode.
- **Green when** — both assertions pass — the second is the proof that today's
  catalogue was already honest.
- **Refactor** — none.

#### Step C3 — The approach-note exception

Covers: R8, R8a, AC9, AC9a

- **Test first** — `scripts/grooves/theory/pitches.test.ts`: with a progression
  changing chord into bar 2, assert a bass event a semitone below bar 2's root,
  on the last off-beat of bar 1, returns no failure; assert the same pitch on the
  first beat of bar 1 returns a failure; assert a *comp* event at that same
  position returns a failure. Then the loop-boundary case: an approach note on
  the last off-beat of the final bar, into bar 1's root, returns no failure. Run
  it: fails — every case is currently reported.
- **Implement** — `pitches.ts`: before reporting a bass event, admit it when it
  is within a semitone of the next chord's root, sits on the last off-beat
  subdivision of the bar preceding that chord, and is the only such event for
  that change. The final bar's "next chord" is bar one's. Write the rule beside
  a comment naming it as the one hole in the in-scale guarantee, in the spirit of
  `IDIOMS` in `harmony.ts`.
- **Green when** — all four assertions pass and C2's catalogue sweep stays green.
- **Refactor** — none.

### Track B — Hands and fingers

#### Step B1 — The comp voice-leads

Covers: R3, AC4

- **Test first** — `scripts/grooves/events.test.ts`: build a groove whose
  progression moves by a fourth, sum the absolute semitone motion between the
  comp voicings of bar 1 and bar 2, and assert it is strictly less than the
  independent fold produces for the same chords. Run it: fails — they are equal.
- **Implement** — `events.ts`: export `voiceLead(previous, chordMidi)`; fold each
  tone to the octave nearest the previous voicing's corresponding tone within
  `COMP_REGISTER_LOW`..`COMP_REGISTER_CEILING`; thread the previous voicing
  through the bar loop, seeding it with the independent fold for bar 1.
- **Green when** — the assertion passes and the existing test that bar 1's comp
  pitches are exactly `music.chord`'s stays green.
- **Refactor** — remove `inCompRegister` once `voiceLead` subsumes it.

#### Step B2 — A chord is strummed, not stamped

Covers: R4, R5, AC5, AC6

- **Test first** — `scripts/grooves/events.test.ts`: for one comp chord, assert
  its events' `timeSec` values are not all equal and span less than 0.015 s, and
  that their velocities are not all equal. Run it: fails with
  `expected [ 2, 2, 2, 2 ] not to deep equal [ 2, 2, 2, 2 ]`.
- **Implement** — `events.ts`: within a comp chord, offset the *n*th note by
  `n × spreadSec` where `spreadSec` is drawn per groove from the rhythm stream in
  5–15 ms, and scale velocity so the top voice is loudest and inner voices sit
  below it.
- **Green when** — both assertions pass and the sub-subdivision clamp still holds
  after humanization.
- **Refactor** — none.

#### Step B3 — Four-note chords lose their root

Covers: R6, AC7

- **Test first** — `scripts/grooves/events.test.ts`: for a bar whose chord has
  four pitch classes and whose bass sounds the root, assert the comp's pitch
  classes exclude the root; for a bar whose chord is a triad, assert they
  include it. Run it: fails — the root is always present.
- **Implement** — `events.ts`: when `chord.length >= 4` and the bar's bass
  contains the root's pitch class, drop the root from the comp voicing.
- **Green when** — both assertions pass and `music.chord` is unchanged for both
  bars.
- **Refactor** — none.

#### Step B4 — The bass plays a line

Covers: R7, AC8

- **Test first** — `scripts/grooves/events.test.ts`: for a rendered groove assert
  the bass has at least one repeated consecutive pitch, spans more than 12
  semitones across the loop, and has fewer events than the pattern's step count
  times the bar count. Run it: fails on all three.
- **Implement** — `events.ts`: replace `chord[i % chord.length]` with a line
  writer drawing from the rhythm stream — repeated roots, octave displacement
  within the bass register, and rests.
- **Green when** — all three assertions pass and the gate's pitch check stays
  green.
- **Refactor** — none.

#### Step B5 — The bass approaches the change

Covers: R8, R8a, AC9, AC9a

- **Test first** — `scripts/grooves/events.test.ts`: assert that in at least one
  bar preceding a chord change, the bass's last event is a semitone from the next
  chord's root and the next bass onset is that root; and assert no event's
  `timeSec + durationSec` exceeds the loop length — the boundary approach note
  sounds inside the loop. Run it: fails with `expected 0 to be greater than 0`.
- **Implement** — `events.ts`: on the last off-beat before each chord change, the
  loop boundary included, emit an approach note a semitone above or below the
  next root, chosen per change from the rhythm stream.
- **Green when** — both assertions pass and Track C's gate check accepts every
  entry.
- **Refactor** — none.

### Track D — The room

#### Step D1 — The bus has a room

Covers: R11, R12, AC12

- **Test first** — `scripts/grooves/mix.test.ts`: build a buffer with a single
  impulse at frame 0, call `applyRoom`, and assert the RMS over the following
  0.1–0.4 s is non-zero and decays monotonically over four windows. Run it:
  fails with `applyRoom is not a function`.
- **Implement** — `scripts/grooves/mix.ts`: `applyRoom(left, right, sampleRate)`
  — four parallel comb filters at mutually prime delays with feedback tuned for a
  ~0.6 s decay, into two allpass stages, mixed at `ROOM_SEND`. Pure arithmetic,
  no allocation beyond the delay lines.
- **Green when** — both assertions pass and rendering the same spec twice is
  byte-identical.
- **Refactor** — none.

#### Step D2 — The room folds into the loop

Covers: R13, R15, AC13

- **Test first** — `scripts/grooves/mix.test.ts`: mix a track whose only event is
  near the end of the last bar, with an overhang, and assert the seam measured by
  the same arithmetic `gate.ts` uses is within `SEAM_THRESHOLD`, and that bar
  one's opening frames are non-silent — the room rang over from the end. Run it:
  fails if `applyRoom` is called after `wrap`.
- **Implement** — `mix.ts`: call `applyRoom` on the summed buffer **before**
  `wrap()`, with a comment naming the ordering as load-bearing.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D3 — Nothing was added to the verify path

Covers: R14, AC14

- **Test first** — `scripts/grooves/boundary.test.ts` already asserts
  `verify-cli.ts`'s dependency list is `node:fs`, `node:crypto`, `node:path`.
  Run it: passes — keep it passing.
- **Implement** — nothing. `applyRoom` lives in `mix.ts`, which the verify path
  never imports.
- **Green when** — it stays green.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Re-render and lock

Covers: R15, R16, AC15

- Run `npm run grooves`. Epic 1's answer-pinning test must stay green; the
  manifest must differ only by `headDelaySeconds`.
- Run twice; `git status` clean. `npm run grooves:verify` and `npm test`.

#### Step I2 — The demo path

Covers: R1–R11, AC16

- Play the same seeds before and after with the comp soloed, then the bass, then
  the full mix. The comp moves smoothly between chords and does not double the
  bass's root on four-note chords; the bass walks into each change; notes end;
  the kit sits in one space. If Epic 2 took its per-voice fallback, this is where
  its coherence sign-off is taken too.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2 |
| R2 | A3 |
| R3 | B1 |
| R4 | B2 |
| R5 | B2 |
| R6 | B3 |
| R7 | B4 |
| R8, R8a | C3, B5 |
| R9 | C1, C3 |
| R10, R10a | C2 |
| R11 | D1 |
| R12 | D1, I1 |
| R13 | D2 |
| R14 | D3 |
| R15 | D2, I1 |
| R16 | I1 |
| AC1 | A1 |
| AC2 | A2 |
| AC3 | A3 |
| AC4 | B1 |
| AC5, AC6 | B2 |
| AC7 | B3 |
| AC8 | B4 |
| AC9, AC9a | C3, B5 |
| AC10, AC11, AC11a | C1, C2 |
| AC12 | D1 |
| AC13 | D2 |
| AC14 | D3 |
| AC15 | I1 |
| AC16 | I2 |

## Assumptions

- `RELEASE_SEC = 0.008` and `CHOKE_SEC = 0.005` — long enough to avoid a click,
  short enough to read as a stop. Both are constants in `voices.ts`, tuned by ear.
- The comp spread is one direction per groove, drawn once, rather than
  alternating per chord.
- `voiceLead` pairs tones by index after sorting both voicings ascending. Chords
  of differing size — a triad following a seventh — pair as far as they can and
  fold the remainder independently.
- The bass line writer draws from the rhythm stream, so it is subject to Epic 1's
  split and cannot move any answer.
- `ROOM_SEND` is a module constant, not a template field, so Epic 6 is not held
  up by this epic.
- The reverb's delay lines are allocated per `mixTracks` call. A 40-second stereo
  render is ~7 MB of Float32 already; the delay lines add well under a megabyte.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/writespec feature-9 epic-4` — the answer gets applied to the
design and steps, moved into the log, and replaced by whatever it opens up.

### Q1. How is the room built?

The PRD requires determinism, no new dependency and no committed impulse file.
Two shapes satisfy that, and they produce different sounds and different render
times. Reversing later means re-rendering every groove and re-taking every
listening sign-off in this feature and in Epic 2.

- [ ] A) A Schroeder network — four combs into two allpasses, written in
      `mix.ts` *(recommended — it is about sixty lines of array arithmetic, runs
      in milliseconds on a 40-second buffer, and its decay is a tunable constant;
      the PRD's "algorithmic room, not a shipped IR" is exactly this)*
- [ ] B) A synthesised impulse — exponentially decaying seeded noise — convolved
      with the bus, giving a smoother tail at the cost of a convolution over
      ~1.8 M frames per channel
- [ ] C) A feedback delay network, richer than Schroeder and denser than a plain
      comb bank, at the cost of more tuning to keep it from ringing
- [ ] D) Early reflections only — a short tap delay bank with no tail — cheapest
      and least likely to smear a sixteenth-note funk pattern, but it glues less
