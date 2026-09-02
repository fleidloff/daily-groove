# Tech spec — Epic 3: The root note, quieter and on the beat

PRD: [../prd/epic-3-the-root-note-quieter-and-on-the-beat.md](../prd/epic-3-the-root-note-quieter-and-on-the-beat.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three small modules go into `lib/audio/` beside the voice that already exists,
and the voice grows a gain node and a start time. `level.ts` declares one
number. `beat.ts` is plain arithmetic — seconds per beat, seconds to the next
one — plus a `GrooveClock` that closes that arithmetic over a tempo and a start
time and answers *what graph time do I schedule against*. `output.ts` is a
module-level owner of "which voice is making the reference sound right now",
claimed and released, with no Web Audio in it at all. `reference.ts` then does
four things instead of one: route through a gain at the declared level, fade
that gain instead of cutting it, `start(when)` against the clock instead of
`start()`, and take the shared output rather than owning a node privately.

The one thing the transport has to give up is *when the groove started on the
graph's clock*. `getElapsed()` is latency-corrected — it describes what the
listener is hearing, which is behind what the graph is emitting by the output
latency — and a note scheduled against it would land exactly one output latency
late, which is 10–40ms wired and 150–300ms over Bluetooth. So `AudioPlayer` and
`PageTransport` gain one read-only `getStartTime(): number | null`, the graph
time at which the groove's beat 0 was emitted, and every beat is `startedAt +
n × beatSeconds`. That is still one-way and read-only: nothing added here can
stop, move or reschedule the groove (R9).

Five tracks. Three of them — the grid, the level-and-owner, and the transport's
start time — are independent from the first commit and are the three contracts
Epic 1 is waiting on, so they land first and are frozen below. The voice comes
second because it consumes all three, and the page's wiring last.

## Architecture

**Three timelines, and which one the grid uses.**

| | reads | used for |
| :-- | :-- | :-- |
| `player.getElapsed()` | `now − startedAt − outputLatency` | the progress bar: what is being *heard* |
| `player.getStartTime()` | `startedAt` | the beat grid: what is being *emitted* |
| `ctx.currentTime` | the graph clock | the argument to `start(when)` |

A sample handed to the graph at time `T` reaches the ear at `T + latency`; the
groove's sample for groove-time `g` was handed over at `startedAt + g` and
reaches the ear at `startedAt + g + latency`. The two coincide at the ear when
`T = startedAt + g` — latency cancels, and only if the grid is built on the
emission clock. The PRD's "the transport's own clock" (R8) is that clock, read
one link earlier in the chain than the progress bar reads it.

**The grid is the quarter note, and it never wraps.** `loopSecondsOf(groove)` is
`loopBars × 4 × 60 / bpm`, so every groove's loop is a whole number of beats and
groove-time can grow monotonically past the loop boundary without the grid ever
drifting. Nothing has to know where the bar line is: R8a asks for the beat, not
the bar, so `startedAt + n × beatSeconds` is the whole model.

**One level, per-voice gain nodes.** The declared number lives in `level.ts` and
each voice builds its own `GainNode` from it. There is no shared master gain,
deliberately: the fade that R5 asks for is per-note, and a shared node would
duck the arriving note along with the departing one. "One number, in one place"
(R2) is held by the constant plus a structural test — every module under
`lib/audio/` that calls `createGain(` must import `REFERENCE_LEVEL`.

**One owner of the output, no audio in it.** `output.ts` arbitrates *who* is
sounding, not *what* comes out. A voice claims it with its own cancel callback;
claiming runs the previous holder's cancel first, so a root tap silences a lick
and a mode tap silences a ringing root without either voice knowing the other
exists (R10a, R10b). It is a module-level singleton for the same reason
`context.ts` is one: the two voices are constructed independently by two
different hooks, and neither can be handed the other.

**Cancellation has two shapes, and they are not the same.**

- *Taken over* — another sound claims the output. Fade the gain to zero over
  `REFERENCE_FADE_SECONDS` and `stop(now + fade)`. For a note already sounding
  that is the ramp R5 asks for; for a note still scheduled ahead, the gain
  reaches zero long before its start time and the stop time precedes its start
  time, so it never sounds (R10).
- *The groove stopped under it* — the clock notifies, and only a note that has
  **not yet reached its start time** is released (R12). A note already sounding
  is left alone to ring out (R11). That distinction is the whole of AC9 vs AC10.

```
tap ──► ensureBuffer ──► ctx ──► clock.nextBeat(now) ─┬─ null ──► start(now)
                                                      └─ when ──► start(when)
                                    │
        referenceOutput().claim(cancel) ──► previous holder's cancel() runs
                                    │
        source ──► gain(REFERENCE_LEVEL) ──► ctx.destination
```

## Contracts

Frozen. Tracks build against these rather than against each other, and Epic 1
builds against the first three from day one.

```ts
// src/features/daily-groove/lib/audio/level.ts
/**
 * Peak gain for anything a chip sounds — the root note and, from Epic 1, the
 * mode lick. One number for the whole catalogue (R4) and for both voices (R2).
 */
export const REFERENCE_LEVEL: number
/** Seconds of ramp when a sound is taken over or cut short (R5). */
export const REFERENCE_FADE_SECONDS: number
```

```ts
// src/features/daily-groove/lib/audio/beat.ts

/** A tap this close before a beat counts as that beat and sounds at once (R6a). */
export const BEAT_TOLERANCE_SECONDS: number

/** Seconds per quarter-note beat. 0 for a tempo that cannot describe one. */
export function beatSeconds(bpm: number): number

/**
 * Seconds to wait, from a position in the groove, until the next quarter-note
 * beat. 0 means now: the position is on a beat, is inside the tolerance before
 * one, or there is no usable grid. Never negative — the grid only schedules
 * forward (R6b).
 */
export function secondsToNextBeat(
  grooveSeconds: number,
  beatLength: number,
  tolerance?: number,
): number

/** What a clock needs from the transport. Read-only, both members. */
export type BeatSource = {
  /** Graph time at which the groove's beat 0 was emitted; null when stopped. */
  getStartTime(): number | null
  subscribe(listener: () => void): () => void
}

export type GrooveClock = {
  /**
   * The graph time to schedule against for a tap at graph time `now`, or
   * `null` when the groove is not running — in which case the caller sounds
   * immediately (R7).
   */
  nextBeat(now: number): number | null
  /** Whether the groove is running. */
  isRunning(): boolean
  /** Notified when the groove starts, stops or ticks. Reading only (R9). */
  subscribe(listener: () => void): () => void
}

export function createGrooveClock(source: BeatSource, bpm: number): GrooveClock
```

```ts
// src/features/daily-groove/lib/audio/output.ts

/** One voice's hold on the shared reference output. */
export type OutputClaim = {
  /** False once another sound has taken the output, or `release()` was called. */
  isHeld(): boolean
  /** Give it back. Idempotent, and a no-op once superseded. */
  release(): void
}

export type ReferenceOutput = {
  /**
   * Take the output for a new sound. The current holder's `cancel` runs first,
   * so at most one reference sound is ever live across both chip rows (R10a).
   */
  claim(cancel: () => void): OutputClaim
  /** Whether anything holds it. Tests and teardown only. */
  isClaimed(): boolean
}

/** The page's single owner of the reference output (R10b). */
export function referenceOutput(): ReferenceOutput

/** Drop the holder without cancelling it. Test teardown only. */
export function resetReferenceOutput(): void
```

```ts
// src/features/daily-groove/lib/audio/audio.ts — one method added
export type AudioPlayer = {
  // …unchanged…
  /**
   * Graph time at which the groove's first sample was emitted, or null when
   * stopped. NOT latency-corrected: this is the clock anything scheduled
   * against the groove must use. `getElapsed()` stays the heard timeline.
   */
  getStartTime(): number | null
}

// src/features/daily-groove/lib/audio/transport.ts — one method added
export type PageTransport = {
  // …unchanged…
  /** The player's start time while running; null when stopped or loading. */
  getStartTime(): number | null
}
```

```ts
// src/features/daily-groove/lib/audio/reference.ts — one optional parameter
export function createReferenceVoice(
  notes: ReferenceNote[],
  clock?: GrooveClock,
): ReferenceVoice
// No clock supplied = every note is immediate, which is feature-10's behaviour
// exactly. `ReferenceVoice` itself is unchanged.
```

```ts
// src/features/daily-groove/hooks/useTransport.ts
export type UseTransport = {
  // …unchanged…
  /** The beat grid for this groove. Built once, beside the transport. */
  clock: GrooveClock
}
export function useTransport(source: PlayableSource, bpm?: number): UseTransport

// src/features/daily-groove/hooks/useReferenceNote.ts — options object
export function useReferenceNote(
  notes: ReferenceNote[],
  options?: { clock?: GrooveClock; voice?: ReferenceVoice },
): UseReferenceNote
```

```ts
// src/features/daily-groove/testing/fakeAudioContext.ts — gain support
export type FakeAudioParam = {
  /** Set by `setValueAtTime` and by direct assignment. No automation curve. */
  value: number
  setValueAtTime: Mock<(value: number, when: number) => void>
  linearRampToValueAtTime: Mock<(value: number, when: number) => void>
  cancelScheduledValues: Mock<(when: number) => void>
}
export type FakeGainNode = {
  gain: FakeAudioParam
  connect: Mock<(destination: unknown) => unknown>
  disconnect: Mock<() => void>
}
// FakeAudioContextHandle gains `createGain(): FakeGainNode`
// FakeContext gains `gains: FakeGainNode[]` — creation order, like `sources`
```

**What Epic 1 may rely on, and what it must not do.** It consumes
`REFERENCE_LEVEL`, `createGrooveClock`/`GrooveClock`, and
`referenceOutput()`. It does **not** edit `reference.ts`, does not re-add
`createGain` to the fake context (this epic adds it), and does not declare a
second gain constant — the structural test in Step B2 will fail if it does.

## Tracks

### Track A — The beat grid

- **Goal** — `beat.ts` answers "when is the next beat" as plain arithmetic, and
  a `GrooveClock` over a `BeatSource` answers it as a graph time.
- **Owns** — `src/features/daily-groove/lib/audio/beat.ts`,
  `src/features/daily-groove/lib/audio/beat.test.ts`
- **Role** — `implementer`
- **Depends on** — the `BeatSource` / `GrooveClock` contracts only. No Web
  Audio, no context, no clock, no transport: the tests drive a hand-made
  `BeatSource` literal.
- **Parallel with** — B, C
- **Done when** — its tests pass with `beat.test.ts` importing nothing from
  `./transport`, `./audio` or `./context`.

### Track B — One level, one owner of the output

- **Goal** — the declared level exists and is the only one, and a claim on the
  reference output cancels the holder before it.
- **Owns** — `src/features/daily-groove/lib/audio/level.ts`,
  `lib/audio/level.test.ts`, `lib/audio/output.ts`, `lib/audio/output.test.ts`
- **Role** — `implementer`
- **Depends on** — nothing. Neither module imports Web Audio.
- **Parallel with** — A, C
- **Done when** — its tests pass, including the structural one that reads every
  file under `lib/audio/` from disk. That one has nothing to inspect yet; Track
  D is what gives it a subject.

### Track C — The transport says when the groove started

- **Goal** — `getStartTime()` on the player and the transport, uncorrected for
  latency and null when nothing is running.
- **Owns** — `src/features/daily-groove/lib/audio/audio.ts`,
  `lib/audio/audio.test.ts`, `lib/audio/transport.ts`,
  `lib/audio/transport.test.ts`
- **Role** — `implementer`
- **Depends on** — the `getStartTime` contract only
- **Parallel with** — A, B
- **Done when** — its tests pass and the 5 existing `describe` blocks in
  `transport.test.ts` and everything in `audio.test.ts` are untouched and green.

### Track D — The reference voice: through a gain, on the beat

- **Goal** — a tapped root is routed through a gain at the declared level,
  scheduled for the next beat while the groove runs, faded rather than cut when
  it is taken over, and dropped if the beat it was waiting for never arrives.
- **Owns** — `src/features/daily-groove/lib/audio/reference.ts`,
  `lib/audio/reference.test.ts`,
  `src/features/daily-groove/testing/fakeAudioContext.ts`, and one added
  assertion in `lib/audio/level.test.ts` (Step D1). That last file is Track B's
  in Wave 1 and Track D's in Wave 2, so the two never write it at the same time.
- **Role** — `implementer`
- **Depends on** — Track A (`GrooveClock`), Track B (`REFERENCE_LEVEL`,
  `REFERENCE_FADE_SECONDS`, `referenceOutput`, `resetReferenceOutput`). It does
  **not** depend on Track C: its tests drive a hand-made clock, never a real
  transport.
- **Parallel with** — nothing in this epic; parallel with Epic 1 and Epic 2.
- **Done when** — its tests pass and every test in `reference.test.ts` that
  feature-10 wrote is either green untouched or green with its subject intact
  (Steps D1 and D2 name the two that move).

### Track E — The page wires the clock in

- **Goal** — the day's tempo reaches the grid and the grid reaches the voice, so
  the behaviour is true in the app and not only in the voice's own tests.
- **Owns** — `src/features/daily-groove/hooks/useTransport.ts`,
  `hooks/useTransport.test.ts`, `hooks/useReferenceNote.ts`,
  `hooks/useReferenceNote.test.ts`,
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `components/GroovePuzzle.sounding.test.tsx`, `src/lib/groove.ts` (one doc
  comment)
- **Role** — `implementer`
- **Depends on** — A, C (for the clock it builds) and D (for the voice that
  takes one)
- **Parallel with** — nothing in this epic.
- **Done when** — the feature tests in Step E4–E8 pass and the whole suite is
  green.

**The two cross-epic seams.** `GroovePuzzle.tsx` is opened by all three epics,
and the roadmap already names the split: Epic 1 has the chip rows' props, Epic 2
has the switch stack above them and the control below. Track E touches exactly
three regions of that file — the `source` memo, the `useTransport` call and the
`useReferenceNote` call — and reorders them so the transport is built before the
voice. Nothing else in the file moves. Second seam:
`testing/fakeAudioContext.ts` grows `createGain` here, and Epic 1's lick voice
needs it too; this epic ships first, so Epic 1 consumes it and adds nothing.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C. Three disjoint file sets,
  none of which imports another's module. All three are hours rather than days,
  and between them they are the whole of what Epic 1 is waiting on — land and
  freeze them first.
- **Wave 2:** Track D — needs A's `GrooveClock` and B's `level.ts` and
  `output.ts` on disk to import.
- **Wave 3:** Track E — needs C's `getStartTime`, A's `createGrooveClock` and
  D's clock-taking voice.
- **Wave 4:** Integration and verification, including the two listens (R3 and
  the tolerance).

## Implementation

### Track A — The beat grid

#### Step A1 — A tempo becomes a beat length

Covers: R8, R8a

- **Test first** — `src/features/daily-groove/lib/audio/beat.test.ts`: assert
  `beatSeconds(120)` is `0.5`; `beatSeconds(67)` is close to `0.895522` to 6
  places; `beatSeconds(130)` is close to `0.461538` to 6 places; and that
  `beatSeconds(0)`, `beatSeconds(-1)`, `beatSeconds(NaN)` and
  `beatSeconds(Infinity)` are all `0`. Run it: the file fails to collect with
  `Failed to resolve import "./beat"`.
- **Implement** — `src/features/daily-groove/lib/audio/beat.ts`:
  `beatSeconds(bpm)` returns `Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0`.
  The quarter note is the only division this module knows: no bars, no
  subdivisions (R8a).
- **Green when** — all seven assertions pass.
- **Refactor** — none.

#### Step A2 — The wait to the next beat, and never backwards

Covers: R6, R6b, AC8b

- **Test first** — same file: with `beat = 0.5`, assert
  `secondsToNextBeat(0, 0.5)` is `0` (a position exactly on a beat sounds now);
  `secondsToNextBeat(2.0, 0.5)` is `0` (the fifth beat, likewise);
  `secondsToNextBeat(0.2, 0.5)` is close to `0.3`;
  `secondsToNextBeat(2.2, 0.5)` is close to `0.3` (the grid does not care how
  many beats have gone by); and — this is R6b — `secondsToNextBeat(0.51, 0.5)`
  is close to `0.49`, **not** `-0.01` and not `0`: a tap 10ms after a beat waits
  for the next one. Also assert every return is `>= 0` for a sweep of 200
  positions across four beats. Run it: fails with
  `secondsToNextBeat is not a function`.
- **Implement** — `beat.ts`: `secondsToNextBeat(grooveSeconds, beatLength,
  tolerance = BEAT_TOLERANCE_SECONDS)`. Return `0` when `beatLength` is not
  finite or `<= 0`, or when `grooveSeconds` is not finite. Clamp a negative
  position to `0`. Compute `since = position % beatLength`; return `0` when
  `since === 0`; otherwise `until = beatLength - since` and return `until` unless
  it is inside the tolerance (Step A3).
- **Green when** — all six assertions pass.
- **Refactor** — none.

#### Step A3 — A tap just before a beat is that beat

Covers: R6a, AC8a

- **Test first** — same file: with `beat = 0.5` and the default tolerance,
  assert `secondsToNextBeat(0.5 - BEAT_TOLERANCE_SECONDS / 2, 0.5)` is `0` — a
  tap half a tolerance early sounds at once, not a beat later. Assert
  `secondsToNextBeat(0.5 - BEAT_TOLERANCE_SECONDS * 2, 0.5)` is close to
  `BEAT_TOLERANCE_SECONDS * 2` — a tap outside it still waits. Assert an
  explicit `secondsToNextBeat(0.49, 0.5, 0)` is close to `0.01`, so the
  tolerance is a parameter and not a hard-coded floor. Assert
  `BEAT_TOLERANCE_SECONDS` is `> 0.02` and `< 0.12` — "a few tens of
  milliseconds", per the PRD's assumption. Run it: fails with
  `expected 0.47 to be 0` (the tolerance is not applied yet).
- **Implement** — `beat.ts`: export `BEAT_TOLERANCE_SECONDS = 0.06` and return
  `0` from `secondsToNextBeat` when `until <= Math.max(tolerance, 0)`.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step A4 — The wait scales with the tempo

Covers: R8, AC6

- **Test first** — same file: take `slow = beatSeconds(67)` and
  `fast = beatSeconds(134)`. Tap a quarter of the way into a beat in each —
  `secondsToNextBeat(slow * 0.25, slow)` and
  `secondsToNextBeat(fast * 0.25, fast)` — and assert each is close to three
  quarters of its own beat, and that the slow wait is close to exactly twice the
  fast one. Then the two real ends of the catalogue: assert the worst-case wait
  at 67bpm (`beatSeconds(67)`) is under 0.9s and at 130bpm under 0.47s, which is
  the roadmap's claim about how long a player ever waits. Run it: fails with
  `expected 0 to be close to 0.6716` if A2's modulo is wrong; green from A2/A3
  otherwise — keep the step, it is the AC's own assertion and nothing else
  states it.
- **Implement** — nothing new if A2 and A3 are right. If the assertion fails,
  the bug is in `secondsToNextBeat`, not here.
- **Green when** — all five assertions pass.
- **Refactor** — none.

#### Step A5 — The grid survives every loop wrap, for every groove in the catalogue

Covers: R8, R4

- **Test first** — same file, importing `GROOVES` from `../../data/grooves.generated`
  and `loopSecondsOf` from `../theory/music` (the precedent is `loop.test.ts`,
  which already reads both): for all 30 grooves assert `beatSeconds(groove.bpm)`
  is `> 0`, and that `loopSecondsOf(groove) / beatSeconds(groove.bpm)` is within
  1e-6 of a whole number — every loop is an exact number of quarter notes, so a
  grid counted from the start time never drifts across a wrap. Assert the
  catalogue's tempo span is 67–130, so the worst-case wait claim above is about
  the real data. Run it: fails only if a groove is minted whose loop is not a
  whole number of beats.
- **Implement** — nothing. This is a property of `loopSecondsOf`
  (`loopBars × 4 × 60 / bpm`) that the grid depends on and that no other test
  states.
- **Green when** — the three assertions pass across all 30.
- **Refactor** — none.

#### Step A6 — A clock over a running groove, and nothing over a stopped one

Covers: R6, R7, AC4, AC5

- **Test first** — same file, driving a hand-made `BeatSource`
  (`{ getStartTime: () => started, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) } }`):
  with `started = 10` and `bpm = 120`, assert `createGrooveClock(source, 120).nextBeat(10.2)`
  is close to `10.5` — the graph time of the next beat, not an offset — and that
  `isRunning()` is `true`. Set `started = null` and assert `nextBeat(10.2)` is
  `null` and `isRunning()` is `false`. Assert `nextBeat(10.5)` with
  `started = 10` is `10.5` exactly (on the beat, so now). Assert a clock built
  with `bpm = 0` while running returns `now` rather than `null` — an unusable
  tempo degrades to immediate, not to broken. Run it: fails with
  `createGrooveClock is not a function`.
- **Implement** — `beat.ts`: `createGrooveClock(source, bpm)` closes over
  `beatSeconds(bpm)` and returns `{ nextBeat, isRunning, subscribe }`.
  `nextBeat(now)` reads `source.getStartTime()`, returns `null` when it is
  `null` or `now` is not finite, else
  `now + secondsToNextBeat(now - startedAt, beat)`. `isRunning()` is
  `source.getStartTime() !== null`. `subscribe` forwards to the source through
  an arrow, never by handing the method reference on.
- **Green when** — all five assertions pass.
- **Refactor** — none.

#### Step A7 — The clock reads its source and never writes to it

Covers: R9, AC7

- **Test first** — same file: build a `BeatSource` whose only two members are
  `vi.fn()` spies, call `nextBeat`, `isRunning` and `subscribe`, and assert no
  other property of the source object was ever read — use a `Proxy` recording
  `get` and assert the recorded key set is a subset of
  `['getStartTime', 'subscribe']`. Separately, read `beat.ts` from disk with
  `readFileSync` and assert it contains none of `'./transport'`, `'./audio'`,
  `'./context'`, `'.stop('`, `'.toggle('` or `'.play('` — the module cannot
  write to the transport because it cannot see it. Run it: fails with
  `expected [ 'getStartTime', 'subscribe', 'toggle' ] to satisfy…` only if the
  implementation reaches further; the disk assertion fails if an import creeps
  in later.
- **Implement** — nothing beyond A6. This is the guard that keeps the narrowing
  one-directional.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track B — One level, one owner of the output

#### Step B1 — One declared level, below unity

Covers: R1, R2, R4

- **Test first** — `src/features/daily-groove/lib/audio/level.test.ts`: assert
  `REFERENCE_LEVEL` is `> 0` and `< 1` — below full scale is the requirement,
  and the exact number is a listen, not a test (see Step V2). Assert
  `REFERENCE_FADE_SECONDS` is `> 0` and `<= 0.1` — long enough to stop a click,
  short enough that a finger run down the row does not smear. Run it: fails to
  collect with `Failed to resolve import "./level"`.
- **Implement** — `src/features/daily-groove/lib/audio/level.ts`: export
  `REFERENCE_LEVEL = 0.4` and `REFERENCE_FADE_SECONDS = 0.03`, each with a
  doc comment saying it serves both voices and the whole catalogue, and that the
  number is what a listen produced rather than a computed loudness match.
- **Green when** — all four assertions pass. **No test anywhere may assert the
  literal `0.4`** — assert against the constant, so the calibration listen can
  move it without touching a single test.
- **Refactor** — none.

#### Step B2 — Nothing under `lib/audio/` declares a level of its own

Covers: R2, AC2

- **Test first** — `level.test.ts`: read every `.ts` under
  `src/features/daily-groove/lib/audio/` from disk, skipping `*.test.ts` and
  `level.ts` itself; for each whose source contains `createGain(`, assert its
  source also contains `REFERENCE_LEVEL` and an import from `'./level'`. Collect
  the offenders into an array and `expect(offenders).toEqual([])`, so the
  failure names the file. Run it: passes with nothing to inspect while Track B
  is the only thing on disk — which is correct, and is why the guard against a
  vacuous pass lands in Track D (Step D1) rather than here, where it could only
  be written as a knowingly-red assertion.
- **Implement** — nothing. This is the enforcement of "one number, in one place,
  not a copy per voice", and it is what will catch Epic 1's lick voice if it
  hard-codes a gain.
- **Green when** — the assertion passes, and stays passing as Track D and then
  Epic 1 add gain-using modules.
- **Refactor** — none.

#### Step B3 — A claim cancels the holder before it

Covers: R10, R10a, R10b, AC8, AC8c

- **Test first** — `src/features/daily-groove/lib/audio/output.test.ts`: with
  `resetReferenceOutput()` in `beforeEach`, claim with `cancelA = vi.fn()`,
  then claim with `cancelB = vi.fn()`. Assert `cancelA` was called exactly once
  and `cancelB` not at all; assert the first claim's `isHeld()` is `false` and
  the second's is `true`. Then a third claim and assert `cancelB` fires. Model
  AC8c explicitly with a named comment: the first claim stands in for a lick
  playing, the second for a root tap. Run it: fails to collect with
  `Failed to resolve import "./output"`.
- **Implement** — `src/features/daily-groove/lib/audio/output.ts`: a
  module-level `holder: { cancel: () => void; live: boolean } | null`, a frozen
  singleton returned by `referenceOutput()`, and `claim(cancel)` that (1) takes
  the previous holder, (2) installs the new entry as `holder` **before** running
  the previous cancel, (3) marks the previous entry dead and calls its cancel
  inside a `try/catch`. The ordering in (2) is load-bearing: a cancel callback
  typically calls `release()` on its own claim, which must not clear the holder
  that just replaced it.
- **Green when** — all five assertions pass.
- **Refactor** — none.

#### Step B4 — A cancel that releases its own claim does not evict its successor

Covers: R10b

- **Test first** — same file: claim with a `cancel` that calls its own claim's
  `release()`; claim again; assert `isClaimed()` is `true` and the second
  claim's `isHeld()` is `true`. Run it: fails with `expected false to be true`
  if the ordering in B3 is wrong.
- **Implement** — `output.ts`: `release()` is a no-op when the entry is already
  dead, and clears `holder` only when `holder === entry`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B5 — Releasing frees the output, and does so once

Covers: R10b

- **Test first** — same file: claim, `release()`, assert `isClaimed()` is
  `false` and `isHeld()` is `false`; call `release()` twice more and assert
  nothing throws and `cancel` was never called (a voluntary release is not a
  cancellation). Then: claim A, claim B, then call A's `release()` and assert B
  still holds it. Finally `resetReferenceOutput()` and assert `isClaimed()` is
  `false` and the holder's `cancel` was **not** invoked — teardown forgets, it
  does not reach into a torn-down fake context. Run it: fails with
  `resetReferenceOutput is not a function`.
- **Implement** — `output.ts`: `release`, `isClaimed`, `resetReferenceOutput` as
  described.
- **Green when** — all six assertions pass.
- **Refactor** — none.

### Track C — The transport says when the groove started

#### Step C1 — The player reports the graph time it started at

Covers: R8

- **Test first** — `src/features/daily-groove/lib/audio/audio.test.ts`: with the
  fake context installed, assert `player.getStartTime()` is `null` before
  `play()`. `advance(3)`, `await player.play()`, and assert `getStartTime()` is
  `3` — the graph clock at the moment `start()` was called. `advance(5)` and
  assert it is still `3`: this is a start time, not an elapsed time. `stop()`
  and assert it is `null` again. Run it: fails with
  `player.getStartTime is not a function`.
- **Implement** — `src/features/daily-groove/lib/audio/audio.ts`: add
  `getStartTime(): number | null` to the `AudioPlayer` type and return the
  existing `startedAt` field, which is already set to `ctx.currentTime` in
  `play()` and to `null` in `stop()` and `dispose()`. No new state.
- **Green when** — all four assertions pass and every existing test in the file
  is untouched and green.
- **Refactor** — none. Document on the method that it is deliberately *not*
  latency-corrected, and that `getElapsed()` is the corrected one.

#### Step C2 — The start time is the emission clock, not the heard one

Covers: R8

- **Test first** — same file: install the fake with `outputLatency: 0.2`,
  `advance(1)`, play, `advance(2)`. Assert `getElapsed()` is close to `1.8` and
  `currentTime - getStartTime()` is close to `2.0`, and that the difference
  between the two is exactly the reported latency. Run it: fails with
  `expected 1.8 to be close to 2` if `getStartTime` is wired to the corrected
  value.
- **Implement** — nothing beyond C1. This step exists because it is the whole
  reason the grid uses this method and not `getElapsed()`, and nothing else in
  the suite states it.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C3 — The transport passes it through, and reports nothing when stopped

Covers: R7, R8, AC5

- **Test first** — `src/features/daily-groove/lib/audio/transport.test.ts`, in a
  new `describe('the beat grid’s clock (R8)')`: assert
  `transport.getStartTime()` is `null` before any press; press, flush, and
  assert it is a finite number equal to the fake's `currentTime` at the moment
  the source started; toggle off and assert `null`; toggle on again and assert a
  new, later number — a restart moves the grid with it. Also assert it is `null`
  while the press is still loading (use `deferNextDecode()`), so a tap during
  the gap is immediate rather than scheduled against a groove that has not
  started. Run it: fails with `transport.getStartTime is not a function`.
- **Implement** — `src/features/daily-groove/lib/audio/transport.ts`: add
  `getStartTime()` to `PageTransport`, returning
  `running && player ? player.getStartTime() : null`.
- **Green when** — all five assertions pass and the file's five existing
  `describe` blocks stay green.
- **Refactor** — none.

### Track D — The reference voice: through a gain, on the beat

#### Step D0 — The fake context makes gain nodes

Covers: R1, R5 (infrastructure for both)

- **Test first** — `src/features/daily-groove/lib/audio/reference.test.ts`, a
  small `describe('the fake context’s gain support')`: install the fake, call
  `sharedAudioContext().createGain()`, assert the returned node has a `gain`
  with `value === 1`, that `setValueAtTime(0.5, 0)` sets `value` to `0.5`, that
  `linearRampToValueAtTime(0, 0.03)` records the call and leaves `value` at
  `0.5` (the fake runs no automation curve), and that the node appears in
  `fake.gains`. Run it: fails with `ctx.createGain is not a function`.
- **Implement** — `src/features/daily-groove/testing/fakeAudioContext.ts`: add
  `FakeAudioParam`, `FakeGainNode`, `createGain()` on the context class pushing
  into a module-local `gains` array, and expose `gains` on the returned
  `FakeContext`. Also make `installFakeAudioContext()` call
  `resetReferenceOutput()` alongside the `releaseAudioContext()` it already
  calls — for the same reason: a claim held by a voice built under the previous
  stub is stale the moment a new one is installed, and no existing test file has
  to learn about the output owner to stay isolated.
- **Green when** — all five assertions pass and every other test file that
  installs the fake is still green.
- **Refactor** — none.

#### Step D1 — The note plays through a gain below unity

Covers: R1, R2, AC1, AC2

- **Test first** — `reference.test.ts`. This is the **move** of feature-10's
  Step C3 assertion `expect(node.connect).toHaveBeenCalledWith(fake.contexts[0].destination)`:
  the subject is "the note reaches the output", and it is now reached through a
  gain. Rewrite that one line as three — `expect(fake.gains).toHaveLength(1)`,
  `expect(node.connect).toHaveBeenCalledWith(fake.gains[0])`,
  `expect(fake.gains[0].connect).toHaveBeenCalledWith(fake.contexts[0].destination)`
  — and add `expect(fake.gains[0].gain.value).toBe(REFERENCE_LEVEL)` and
  `expect(fake.gains[0].gain.value).toBeLessThan(1)`. Everything else in that
  test stays exactly as written. Run it: fails with
  `expected "connect" to have been called with [ { name: 'destination' } ]`.
- **Implement** — `src/features/daily-groove/lib/audio/reference.ts`: in `play`,
  build `const gain = ctx.createGain()`, set `gain.gain.value = REFERENCE_LEVEL`
  imported from `./level`, `gain.connect(ctx.destination)`, and connect the
  buffer source to `gain` instead of to `ctx.destination`.
- **Green when** — the five assertions pass. Then add the one line to
  `lib/audio/level.test.ts` that Step B2 left out: `expect(inspected)` — the
  files that call `createGain(` — `.toContain('reference.ts')`, so the
  structural rule can no longer pass by finding nothing to check.
- **Refactor** — update the module doc comment: the voice is no longer "straight
  to the destination", and the level is not its own to choose.

#### Step D2 — A note that takes over is faded, not cut

Covers: R5, AC3

- **Test first** — `reference.test.ts`. This is the **move** of feature-10's
  Step C5 test "stops the previous node and leaves the new one ringing". Its
  subject — the previous note is let go and the new one is not — is kept; what
  changes is how. `advance(1)`, `play('C')`, `advance(1)`, `play('D')`, then
  assert on the first note's gain:
  `cancelScheduledValues` called with `2`, `linearRampToValueAtTime` called with
  `(0, 2 + REFERENCE_FADE_SECONDS)`, and `fake.sources[0].stop` called with
  `2 + REFERENCE_FADE_SECONDS` — **not** with no argument. Assert
  `fake.sources[1].stop` was not called. Then fire `fake.sources[0].onended?.()`
  and assert the first node and its gain are both disconnected — the disconnect
  moved to the end of the ramp, because disconnecting at takeover time would cut
  the fade it exists to allow. Keep the sibling test "survives a node that has
  already ended" as written. Run it: fails with
  `expected "stop" to have been called with [ 2.03 ], but it was called with [ ]`.
- **Implement** — `reference.ts`: a single `release(entry)` used by every
  cancellation path. Read `now = ctx.currentTime`, then
  `gain.gain.cancelScheduledValues(now)`,
  `gain.gain.setValueAtTime(gain.gain.value, now)`,
  `gain.gain.linearRampToValueAtTime(0, now + REFERENCE_FADE_SECONDS)`,
  `node.stop(now + REFERENCE_FADE_SECONDS)`, each in its own `try/catch` for a
  node that has already ended. Set `node.onended` to disconnect the node and the
  gain, clear `current` if it is still this entry, and release the claim.
- **Green when** — all six assertions pass.
- **Refactor** — none.

#### Step D3 — With no clock, the note still starts at once

Covers: R7, AC5

- **Test first** — `reference.test.ts`: build a voice with **no** clock,
  `advance(4)`, `play('C')`, and assert `fake.sources[0].start` was called with
  `4` — the graph clock now, i.e. immediately. This is feature-10's behaviour
  stated as an argument rather than as a call count, and it is also R7's
  stopped-groove case seen from the voice. Add the sibling: a voice built with a
  clock whose `nextBeat` returns `null` also starts at `4`. Run it: fails with
  `expected "start" to have been called with [ 4 ], but it was called with [ ]`.
- **Implement** — `reference.ts`: `createReferenceVoice(notes, clock?)`, and in
  `play` compute
  `const now = ctx.currentTime`, `const when = clock?.nextBeat(now) ?? null`,
  `const startsAt = when !== null && when > now ? when : now`, then
  `next.start(startsAt)`.
- **Green when** — both assertions pass, and every existing test asserting
  `start` was called once stays green.
- **Refactor** — none.

#### Step D4 — With a running groove, the note is scheduled for the next beat

Covers: R6, AC4

- **Test first** — `reference.test.ts`, with a hand-made clock
  (`{ nextBeat: (now) => started === null ? null : now + secondsToNextBeat(now - started, 0.5), isRunning: () => started !== null, subscribe }`)
  built over `beat.ts`'s own arithmetic so the test states the wiring, not the
  maths: `started = 0`, `advance(1.2)`, `play('C')`, assert
  `fake.sources[0].start` called with `1.5` — the next beat boundary, not
  `1.2`. Assert it is strictly greater than the clock at the moment of the tap.
  Run it: fails with `expected "start" to have been called with [ 1.5 ]`.
- **Implement** — nothing beyond D3 if the clock is consulted. If it fails, the
  bug is that `play` ignores `clock`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D5 — Just before a beat sounds now; just after a beat waits

Covers: R6a, R6b, AC8a, AC8b

- **Test first** — `reference.test.ts`, same clock: `advance(0.5 - 0.02)` (20ms
  before a beat, inside the 60ms tolerance), `play('C')`, assert `start` called
  with `0.48` — the tap's own moment, so the note sounds at once. Then a fresh
  voice, `advance(0.52)` (20ms after a beat), `play('D')`, assert `start` called
  with `1.0` — the following beat, never pulled back to `0.5`. Run it: green if
  D4 is right; keep the step, because these are the two criteria the tolerance
  exists for and neither is stated anywhere else at the voice level.
- **Implement** — nothing.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D6 — A second tap cancels a note that has not sounded yet

Covers: R10, AC8

- **Test first** — `reference.test.ts`, same clock: `advance(1.2)`,
  `play('C')` (scheduled for `1.5`), then, with the clock still at `1.2`,
  `play('D')`. Assert the first node's `stop` was called with a time **less than
  or equal to** its own start time of `1.5` (`1.2 + 0.03`), so it never sounds;
  assert its gain was ramped to `0`; and assert the second node's `start` was
  called with `1.5` and its `stop` not at all. That is "running a finger down the
  row leaves exactly one note to arrive". Run it: fails with
  `expected "stop" to have been called` if the takeover path is skipped for a
  pending note.
- **Implement** — nothing beyond D2's single `release` path: it is deliberately
  the same code for a sounding note and a pending one, because a gain ramped to
  zero before the note starts and a stop time before the start time both mean
  silence.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step D7 — Another voice's claim silences the root note

Covers: R10a, R10b, AC8c

- **Test first** — `reference.test.ts`: `play('C')`, then, standing in for
  Epic 1's lick voice, call `referenceOutput().claim(() => {})` directly from the
  test. Assert the root note's gain was ramped to `0` and its `stop` scheduled —
  the root note gets out of the way for the other row without either voice
  naming the other. Then the other direction: `play('D')` and assert the
  stand-in's cancel callback ran exactly once. Run it: fails with
  `expected "linearRampToValueAtTime" to have been called` if the voice keeps
  its own private node instead of claiming the shared output.
- **Implement** — `reference.ts`: in `play`, after the buffer is in hand and the
  nodes are built but **before** `current` is assigned, call
  `entry.claim = referenceOutput().claim(() => release(entry))`. The claim is
  taken only once the note is certain to sound, preserving feature-10's rule
  that a failed fetch must not cut off a ringing note.
- **Green when** — both assertions pass.
- **Refactor** — the voice no longer needs its private "stop the previous node"
  branch in `play`; the owner does it. Delete `releaseNode`'s call site there,
  keep `release(entry)` as the one teardown.

#### Step D8 — A note whose beat the groove never reaches is dropped

Covers: R12, AC10

- **Test first** — `reference.test.ts`, same clock: `advance(1.2)`,
  `play('C')` (scheduled for `1.5`), then set the stand-in clock's `started` to
  `null` and fire its subscribers — the groove stopped. Assert the node's `stop`
  was called with a time before `1.5` and its gain ramped to `0`, so nothing
  sounds. Assert the voice unsubscribed: firing the subscribers a second time
  calls `stop` no more times. Run it: fails with
  `expected "stop" to have been called at least once`.
- **Implement** — `reference.ts`: when `startsAt > now`, subscribe to the clock
  and, on each notification, `if (!clock.isRunning() && entry.startsAt > ctx.currentTime) release(entry)`.
  Store the unsubscribe on the entry and call it from `release` and from
  `onended`. Do not subscribe at all for a note that starts immediately — there
  is nothing to cancel.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D9 — A note already sounding rings on when the groove stops

Covers: R11, AC9

- **Test first** — `reference.test.ts`, same clock: `advance(1.2)`,
  `play('C')` (scheduled for `1.5`), `advance(0.5)` so the clock is past the
  start time, then stop the groove and fire the subscribers. Assert the node's
  `stop` was **not** called and its gain was not ramped: the note rings to its
  own natural end. This is the exact pair to D8 and the only thing separating
  them is whether the note had reached its start time. Run it: fails with
  `expected "stop" not to have been called` if the stop handler releases
  unconditionally.
- **Implement** — nothing beyond D8's `entry.startsAt > ctx.currentTime` guard.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D10 — The voice reads the clock and writes to nothing

Covers: R9, AC7

- **Test first** — `reference.test.ts`: hand `play` a clock built as a `Proxy`
  recording every property read, and assert the recorded key set is a subset of
  `['nextBeat', 'isRunning', 'subscribe']`. Then read `reference.ts` from disk
  and assert it contains none of `'./transport'`, `'./audio'`,
  `'createPageTransport'`, `'createAudioPlayer'` or `'.toggle('`. Run it: the
  disk assertion is the one that will fail if a future change reaches for the
  transport directly.
- **Implement** — nothing. The narrowing is one-directional by construction: the
  voice's only view of the groove is three read-only methods.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D11 — Every failure is still silence

Covers: R14, AC12

- **Test first** — `reference.test.ts`: keep feature-10's whole
  `describe('every failure is swallowed')` block green untouched, and add one
  case for the new node: make `createGain` throw on the context handle and
  assert `play('C')` resolves, sounds nothing, and leaves the output unclaimed
  (`referenceOutput().isClaimed()` is `false`). Add a second: a clock whose
  `nextBeat` throws must not break the tap — assert `play` resolves and the note
  still starts, immediately. Run it: fails with
  `promise rejected "Error: no gain" instead of resolving`.
- **Implement** — `reference.ts`: the existing outer `try/catch` in `play`
  already swallows the gain failure; wrap the `clock?.nextBeat(now)` read in its
  own `try/catch` returning `null`, so a broken clock degrades to immediate
  rather than to silence — a reference note that arrives off the beat is better
  than no reference note.
- **Green when** — both new cases pass and the existing block is unchanged.
- **Refactor** — none.

### Track E — The page wires the clock in

#### Step E1 — The transport hook hands out a clock

Covers: R6, R8

- **Test first** — `src/features/daily-groove/hooks/useTransport.test.ts`, a new
  `describe('the beat grid (R8)')`: render `useTransport(TEN_SECOND_LOOP, 120)`,
  assert `result.current.clock.isRunning()` is `false` and
  `clock.nextBeat(0)` is `null` before any press. Press, flush, `advance(1.2)`,
  and assert `clock.nextBeat(fake.currentTime)` is a number `0.3` past the tap
  — the hook built the grid at the tempo it was given. Assert the clock object
  is identical across a re-render (`toBe`), so the voice below it is never handed
  a new grid mid-day. Assert `useTransport(TEN_SECOND_LOOP)` with no tempo still
  returns a clock, and that while running its `nextBeat` returns `now` — today's
  immediate behaviour, which is what keeps the file's 11 existing
  `useTransport(TODAY)` call sites green. Run it: fails with
  `Cannot read properties of undefined (reading 'isRunning')`.
- **Implement** — `src/features/daily-groove/hooks/useTransport.ts`: widen the
  signature to `(source: PlayableSource, bpm?: number)`, build both in one lazy
  initialiser —
  `useState(() => { const t = createPageTransport(source); return { transport: t, clock: createGrooveClock(t, bpm ?? 0) } })`
  — and return `clock` alongside the existing five values. `PageTransport`
  satisfies `BeatSource` structurally now that Track C landed; no adapter.
- **Green when** — all five assertions pass and the 11 existing call sites are
  untouched and green.
- **Refactor** — none.

#### Step E2 — The note hook builds its voice with the clock

Covers: R6

- **Test first** — `src/features/daily-groove/hooks/useReferenceNote.test.ts`:
  convert the existing calls from `useReferenceNote(NOTES, voice)` to
  `useReferenceNote(NOTES, { voice })` — mechanical, and every assertion in the
  file keeps its subject. Add one case: with **no** injected voice and a spy
  clock, `playRoot('C')` and assert the clock's `nextBeat` was consulted, which
  is the only externally visible proof the hook handed the clock to the voice it
  built. Run it: fails with `expected "nextBeat" to have been called`.
- **Implement** — `src/features/daily-groove/hooks/useReferenceNote.ts`: second
  parameter becomes `options?: { clock?: GrooveClock; voice?: ReferenceVoice }`,
  read once inside the lazy initialiser:
  `options?.voice ?? createReferenceVoice(notes, options?.clock)`. An options
  object rather than a third positional parameter, so the page never has to pass
  `undefined` for the injection seam.
- **Green when** — the new case passes and all existing cases stay green.
- **Refactor** — update the hook's doc comment: "Nothing here reads or touches
  the transport" becomes "reads the transport's clock and writes nothing to it",
  with R9 named.

#### Step E3 — The page passes the day's tempo, and the grid to the voice

Covers: R6, R8, R4

- **Test first** — covered by E4–E7 below; this step has no test of its own.
- **Implement** — `src/features/daily-groove/components/GroovePuzzle.tsx`, three
  edits and no others. (1) Move the `source` memo and the `useTransport` call
  above the `useReferenceNote` call at line 173. (2)
  `useTransport(source, groove.bpm)`, destructuring `clock` with the other five.
  (3) `useReferenceNote(NOTES, { clock })`. Rewrite the comment block above the
  voice: the two voices now share the context *and* the groove's clock, read one
  way.
- **Green when** — E4 onward pass.
- **Refactor** — none.

#### Step E4 — A tap selects at once and sounds on the next beat

Covers: R6, R13, AC4, AC11

- **Test first** — `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`:
  press play, flush, `advance` to a deliberately off-beat position — a quarter
  of a beat past one, computed in the test as
  `beatSeconds(groove.bpm) * 0.25` from the fixture's own tempo rather than
  hard-coded — then click a root chip. Assert two things in this order: the chip
  reads `aria-pressed="true"` **before any clock advance**, so selection did not
  wait (AC11, R13); and the note node's `start` was called with
  `fake.currentTime + beatSeconds(groove.bpm) * 0.75`, not with
  `fake.currentTime`. Run it: fails with
  `expected "start" to have been called with [ 3.14 ]`.
- **Implement** — nothing beyond E3.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step E5 — With the loop stopped the note is immediate

Covers: R7, AC5

- **Test first** — same file: without pressing play, `advance(2)`, click a root
  chip, and assert the note's `start` was called with `2` — the graph clock now.
  Then press play, stop again, and assert a further tap is immediate too: a
  stopped groove has no beat to wait for whether or not it has ever run. Run it:
  green if E3 is right; keep the step, it is AC5's own assertion at the level the
  criterion is written about.
- **Implement** — nothing.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step E6 — Stopping the loop drops a pending note and spares a sounding one

Covers: R11, R12, AC9, AC10

- **Test first** — same file. This is the **update** of feature-10's
  `'leaves the groove untouched, and the groove leaves the note alone'`, whose
  closing assertion `expect(note.stop).not.toHaveBeenCalled()` was written when
  every note was immediate. Its subject — a *sounding* note is not cut by a stop
  — is kept, and made unambiguous: tap at an off-beat position, advance the fake
  clock past the scheduled start time so the note is genuinely sounding, then
  click **Stop the loop** and assert `note.stop` was not called. Add a sibling
  test for the other half: tap at an off-beat position, click **Stop the loop**
  *without* advancing, and assert the pending note's `stop` was called with a
  time before its own start time — it never sounds (AC10). Run the first: green
  once the advance is added; run the second: fails with
  `expected "stop" to have been called`.
- **Implement** — nothing beyond D8, D9 and E3.
- **Green when** — both pass, and the rest of the original test — the groove is
  not stopped, the progress bar does not move, one context — is unchanged.
- **Refactor** — none.

#### Step E7 — The tap leaves the groove exactly where it was

Covers: R9, R15, AC7

- **Test first** — same file: press play, `advance` half a loop, read the
  progress bar's `aria-valuenow` and the transport's start time via a second
  `advance`-and-read, then tap three roots in quick succession. Assert the
  groove node's `stop` was never called, the progress bar reads the same value,
  the control still reads **Stop the loop**, and `fake.sources[0]` — the
  groove — has no new `start` call. Run it: green; this is the regression guard
  that the narrowing stayed one-directional in the composed app, and it is the
  only place AC7 is asserted through the UI.
- **Implement** — nothing.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step E8 — The unchanged promises are still kept

Covers: R13, R14, R16, AC11, AC12, AC13

- **Test first** — same file, no new tests: three existing ones must be green
  untouched — `'stays silent on a day that has been solved'` (R16, AC13),
  `'selects and stays quiet where Web Audio is unavailable'` (R14, AC12), and
  `'sounds the selected root again when it is tapped again'` (R13). Run the file
  and confirm. If the Web Audio one now fails, the cause is a `createGain` or a
  clock read outside the voice's `try/catch`.
- **Implement** — nothing.
- **Green when** — the three pass unmodified.
- **Refactor** — none.

#### Step E9 — `bpm` stops claiming it does not drive playback

Covers: R8

- **Test first** — none; a doc comment.
- **Implement** — `src/lib/groove.ts`: `bpm` is commented
  `// display only; does not drive playback or the progress bar`, which stopped
  being true the moment the beat grid read it. Rewrite it: display, **and** the
  quarter-note grid a tapped chip is scheduled against; still not what drives
  the audio file or the progress bar, both of which are derived from the loop
  length and the graph clock. Comment only — no type or value change, and
  `src/lib/` stays a leaf.
- **Green when** — `npm test` and `npm run lint` are green.
- **Refactor** — none.

## Integration and verification

#### Step V1 — The whole suite, the types, the lint and the build

- `npm test` green — the app and tooling tiers. Nothing in this epic touches
  `scripts/grooves/`, so `npm run test:gen` is not part of its
  done-condition, though `npm run test:all` should be run once before the epic
  is called finished.
- `src/features/daily-groove/structure.test.ts` green **unchanged**: this epic
  adds `beat.ts`, `level.ts` and `output.ts` to the existing `audio/` folder and
  creates no new concern folder, which is exactly what that test asserts.
- `npm run lint` green: `beat.ts`, `level.ts` and `output.ts` are inside the
  slice, so no zone examines their relative imports; `src/lib/groove.ts` gains
  no import.
- `npx tsc --noEmit` green, including the widened `useTransport` and
  `useReferenceNote` signatures at every call site.

#### Step V2 — Choose the level by ear

Covers: R3

Not a test step, and the only step in this epic whose verdict is a listen.
`REFERENCE_LEVEL` ships at `0.4` as a starting point, chosen because the notes
and the grooves are both peak-normalised at mint time, so one number holds
across all 30 (R4).

- Play the loudest groove in the catalogue and tap along the whole root row.
  The note must be clearly audible against the bass and must never be the
  loudest thing in the mix.
- Repeat on phone speakers as well as headphones. The persona is on a phone
  before dinner, and a level judged only on headphones will be inaudible there.
- If it needs to move, change the one constant. No test asserts the literal
  value — Step B1 asserts only that it is below unity — so a recalibration is a
  one-line diff with no test churn. That property is the point of B1's wording.

#### Step V3 — Listen for the timing, at both ends of the catalogue

Covers: R6, R6a, R8, R10

- Play the slowest groove (67bpm), tap roots deliberately off the beat, and hear
  each arrive on the next one — up to 0.9s of wait, which the roadmap flags as
  the case to watch: if it reads as a broken chip rather than as timing, the fix
  is a shorter quantisation, not abandoning it.
- Play the fastest (130bpm) and confirm the wait is barely perceptible.
- Tap deliberately *on* the beat at both tempos. The note must sound at once —
  that is `BEAT_TOLERANCE_SECONDS` doing its job, and if a deliberate on-beat tap
  is ever held back, widen it before anything else.
- Stop the loop and confirm taps are instant again.
- Run a finger down the row fast, while playing: notes replace each other, and
  nothing queues up to fire later. Then run a finger down the row and press
  **Stop** immediately: nothing arrives after the groove has gone.

#### Step V4 — Hand the three contracts to Epic 1

Not a code step. Once Wave 1 lands, `REFERENCE_LEVEL`, `createGrooveClock` /
`GrooveClock` and `referenceOutput()` are frozen and Epic 1 can build against
them without waiting for Track D or E. Tell it two things it cannot see from the
contracts alone: the fake context already makes gain nodes, and a second gain
constant will fail Step B2's structural test.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, D1 |
| R2 | B1, B2, D1 |
| R3 | V2 |
| R4 | B1, A5, V2 |
| R5 | B1, D2 |
| R6 | A2, A6, D4, E1, E3, E4, V3 |
| R6a | A3, D5, V3 |
| R6b | A2, D5 |
| R7 | A6, C3, D3, E5 |
| R8 | A1, A4, A5, C1, C2, C3, E1, E3, E9, V3 |
| R8a | A1, A2 |
| R9 | A7, D10, E7 |
| R10 | B3, D6, V3 |
| R10a | B3, D7 |
| R10b | B3, B4, B5, D7 |
| R11 | D9, E6 |
| R12 | D8, E6, V3 |
| R13 | E4, E8 |
| R14 | D11, E8 |
| R15 | E7 |
| R16 | E8 |
| AC1 | D1 |
| AC2 | B2, D1 |
| AC3 | D2 |
| AC4 | A6, D4, E4 |
| AC5 | A6, C3, D3, E5 |
| AC6 | A4 |
| AC7 | A7, D10, E7 |
| AC8 | B3, D6 |
| AC8a | A3, D5 |
| AC8b | A2, D5 |
| AC8c | B3, D7 |
| AC9 | D9, E6 |
| AC10 | D8, E6 |
| AC11 | E4 |
| AC12 | D11, E8 |
| AC13 | E8 |

Every R and AC in the PRD appears. Nothing below has no requirement above it:
Steps D0 (test infrastructure), E3 (wiring, proved by E4–E7) and V1/V4 are the
only steps that carry no criterion, and each says so.

## Assumptions

- **The grid is built on the emission clock, not the heard one.** The PRD says
  the grid comes from "the transport's own clock" and names the
  latency-corrected `getElapsed()` in passing. Scheduling against a
  latency-corrected figure puts the note exactly one output latency behind the
  beat — inaudible wired, a real flam over Bluetooth — so Track C exposes
  `getStartTime()` instead and the arithmetic is `startedAt + n × beat`. This is
  a refinement of the PRD's wording, not a disagreement with R8, and it is cheap
  to reverse: one method and one line in `createGrooveClock`.
- **`REFERENCE_LEVEL = 0.4` and `BEAT_TOLERANCE_SECONDS = 0.06` are starting
  points, not findings.** Both are calibrated by ear in V2 and V3, and no test
  asserts either literal — only that the level is below unity and the tolerance
  is a few tens of milliseconds.
- **The output owner is a module-level singleton**, like `context.ts`. The two
  voices are built by two different hooks and neither can be handed the other,
  which is what R10b's "owned in one place" means in practice. It holds no Web
  Audio, so it is trivially testable and needs no teardown beyond
  `resetReferenceOutput()`.
- **Each voice builds its own gain node at the shared level**, rather than both
  feeding one master gain. A shared node cannot carry a per-note fade: ramping
  it down to release the departing note would duck the arriving one. "One
  number in one place" is held by the constant and by B2's structural test
  instead.
- **A pending note is cancelled by the same code path as a sounding one.** A
  gain ramped to zero before the note's start time, and a stop time that
  precedes its start time, both produce silence — so R5's fade and R10's
  cancellation are one function, and only the groove-stopped path (R11 vs R12)
  needs the distinction.
- **`useTransport`'s tempo parameter is optional.** Eleven existing call sites
  in its test file pass none, and a missing tempo yields a grid of zero, which
  degrades to today's immediate behaviour rather than to an error.
- **The clock's `subscribe` is the transport's**, which notifies on every
  animation frame while the groove runs. The stop-watch handler is a null check
  and a comparison, so the per-frame cost is nothing, and only a note actually
  scheduled ahead subscribes at all.
- **`GroovePuzzle.tsx` is edited in three places and no others**, so the merge
  with Epic 1's chip-row props and Epic 2's switch stack stays mechanical.

## Decision log

### Cycle 1 — 2026-09-02

**Q1. Which of the transport's clocks does the beat grid read?**
Decision: **the emission clock, via a new `getStartTime()`** — latency cancels
only when both the groove and the note are placed on the graph's own timeline,
and `getElapsed()` is deliberately latency-corrected for the progress bar.
Changed: Contracts (`AudioPlayer.getStartTime`, `PageTransport.getStartTime`),
new Track C, Steps C1–C3, Architecture's three-timeline table.

**Q2. Where does "one reference sound at a time" live?**
Decision: **a module-level `referenceOutput()` in `lib/audio/output.ts`, with no
Web Audio in it** — arbitration is bookkeeping, and keeping the audio out of it
means both voices can be built independently and the owner can be tested with no
context at all. Changed: Contracts (`ReferenceOutput`, `OutputClaim`), Track B,
Steps B3–B5, D7.

**Q3. One shared gain at the declared level, or one per voice?**
Decision: **one per voice, from one exported constant** — the fade R5 asks for
is per-note, and a shared node would duck the arriving note along with the
departing one. The "one number" half of R2 is enforced by a structural test
rather than by a shared node. Changed: Architecture, Steps B1, B2, D1, D2.

**Q4. How does a scheduled note learn the groove stopped?**
Decision: **the voice subscribes to the clock and re-checks**, cancelling only a
note that has not yet reached its start time. The alternative — the hook
watching `isPlaying` and calling a `cancelPending()` on the voice — puts the
rule in the component tree, where Epic 1's second voice would have to repeat it.
Changed: Contracts (`GrooveClock.subscribe`, `isRunning`), Steps D8, D9, E6.

The spec is ready to implement: no decision here is expensive enough to reverse
that it should hold up Wave 1, and there are no open questions.
