# Tech spec — Epic 1: Tap a mode, hear a lick in it

PRD: [../prd/epic-1-tap-a-mode-hear-a-lick.md](../prd/epic-1-tap-a-mode-hear-a-lick.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Eight tracks over three waves of work, then integration. On the generator
side, `noteSpecs()` grows from
twelve entries to twenty-four — C4–B5, one real sampled pitch each through the
pack's own transpose — the manifest gains a second export beside the twelve the
root row already reads, and the lock and `grooves:verify` grow to twenty-four
entries without either of them learning to render anything. On the app side, a
lick is data: `lib/theory/licks.ts` declares twelve phrases as scale degrees
against beat positions, `lib/theory/phrase.ts` turns one of those plus a root
and a tempo into a list of `{ midi, offsetSeconds, durationSeconds }`, and
`lib/audio/lick.ts` schedules that list on the shared `AudioContext` with a gain
envelope per note. `hooks/useModeLick.ts` holds the voice for the page's
lifetime, and `GuessCard`'s mode row does what it already does plus one call.

Three decisions shape everything below.

**The twelve committed note files do not move.** R27 and AC17 are about the
files that exist today, so the base octave keeps its historical names —
`note-c.mp3` is still C4 — and the new octave takes an explicit suffix,
`note-c-5.mp3`. The whole widening then shows up in `git status` as twelve
additions and no modifications, which is how R27 is verified rather than
asserted.

**`NOTES` keeps its twelve entries and its shape.** Epic 3 owns
`lib/audio/reference.ts` outright and this epic may not edit it — and that file
builds `new Map(notes.map((n) => [n.root, n.audioSrc]))`, which with
twenty-four entries would silently re-key every root to the octave above and
transpose feature-10's row. So the widened set ships as a *second* export,
`PITCHES`, and the root row's twelve are untouched.

**Every contract this epic takes from Epic 3 is injected, not imported.** The
groove clock, the declared level and the single owner of the output are all
passed in as values, typed structurally against the shapes Epic 3 froze. Exactly
one file in this epic — `GroovePuzzle.tsx`, in Wave 3 — names Epic 3's modules.
Tracks A, B, C, D and G are independent of Epic 3 outright; Track E needs only
the gain support Epic 3's Track D adds to the fake context, and Track F needs
nothing of Epic 3's at all.

## Architecture

### Generator side

`renderNote(pack, midi, sampleRate)` is unchanged: the render is a pure function
of the pack and a MIDI number, and 72–83 goes through it exactly as 60–71 does.
The comp voice is sampled every four semitones from MIDI 45 to 85
(`samples/pack.json`), so C5–B5 sits inside the pack's declared range with the
same two-semitone worst case the base octave already has. Nothing about the
render changes; only the list of pitches it is asked for.

What changes is identity. A note used to be keyed by its root, because there was
one octave and `Root` was unique. There are now two, so a note is keyed by its
**scientific pitch id** — `C4`, `C♯4`, … `B5` — and the file name is derived
from that id in two places, as it already is: `noteFileName` in `notes.ts` for
the render, and `noteFile` in `lock.ts` for the guard. `lock.ts` cannot import
`notes.ts` (that would pull `mix.ts` and `voices.ts` into the guard, which
`lock.test.ts` forbids by reading the source against an allowlist of
`node:fs`, `node:crypto`, `node:path`, `./types.ts`, `./lock.ts`, `./uuid.ts`
and `./catalogue.ts`), so the rule stays written twice and tested twice. That
is the existing arrangement, extended, not a new one.

The base octave's carve-out is one branch in each copy:

```
id 'C4'  → note-c.mp3          (historical; R27 forbids moving it)
id 'C♯4' → note-c-sharp.mp3
id 'C5'  → note-c-5.mp3
id 'C♯5' → note-c-sharp-5.mp3
```

### App side

```
GuessCard  ── onHearMode ──▶  GroovePuzzle
                                  │
                                  ├─ simpleLickMode()      lib/theory/simpleModes.ts
                                  ├─ useModeLick()         hooks/useModeLick.ts
                                  │      ├─ lickFor()      lib/theory/licks.ts
                                  │      ├─ scheduleLick() lib/theory/phrase.ts
                                  │      └─ createLickVoice()  lib/audio/lick.ts
                                  │             └─ sharedAudioContext()
                                  └─ clock / REFERENCE_LEVEL / referenceOutput()   ← Epic 3
```

A tap on a mode chip resolves to a `Flavour` (in simple mode, through
`simpleLickMode`), then to a `LickNote[]`, then to a `ScheduledNote[]` at the
day's tempo, then to one `start(when)` per note on the shared context. The
voice reads no transport and writes nothing to one: the only thing it holds is
Epic 3's `GrooveClock`, whose whole surface is `nextBeat(now)`, `isRunning()`
and `subscribe()`.

**The clock is asked after the fetch, not before.** A phrase's buffers may take
a fetch and a decode to arrive, and a beat time computed before that wait is a
beat time in the past by the time anything is scheduled. So the voice — not the
hook and not the page — holds the clock and calls `nextBeat(ctx.currentTime)`
once every buffer is in hand, immediately before its first `start`. Epic 3's
reference voice takes its clock for the same reason, and this mirrors it.

**Register.** `rootMidiOf` puts the phrase's root in the octave the reference
notes already occupy — `60 + pitchClass(root)`, so 60–71 — and every degree a
lick declares must resolve to at most twelve semitones above it. That is the
whole reason the render widened: root B4 (71) plus an octave is B5 (83), the top
of the new range. A lick that reaches higher is a lick with no file behind it,
so the bound is asserted rather than assumed.

**One sound at a time.** Both voices go through Epic 3's `referenceOutput()`.
This epic's voice calls `claim(cancelAll)` once its buffers are in hand and
before its first `start`; the claim cancels whatever held the output, whichever
row it belonged to. `cancelAll` fades a note that is already sounding over
`REFERENCE_FADE_SECONDS` and stops outright a note scheduled for a beat that has
not arrived — a node `stop()`ped before its start time never sounds at all,
which is what R8 means by "cancelling notes that were scheduled but have not yet
sounded". Every node the phrase creates is guarded by `claim.isHeld()`, so a
claim lost part-way through scheduling stops the rest of the phrase being
scheduled at all rather than relying on the cancel to unpick it. The last note's
`onended` releases the claim if it still holds it.

## Contracts

Frozen. Tracks build against these rather than against each other.

### The generated manifest

```ts
// src/features/daily-groove/data/notes.generated.ts  (GENERATED — never hand-edited)
import type { Root } from '@/lib/groove'

/** One reference note per chromatic root. Unchanged: the root row's twelve. */
export type ReferenceNote = {
  root: Root
  audioSrc: string
  midi: number
}
export const NOTES: ReferenceNote[] = [/* twelve entries, ROOTS order, midi 60..71 */]

/** Every rendered pitch, C4 to B5. What a lick is sequenced from. */
export type PitchSample = {
  /** Scientific pitch, e.g. 'C4', 'C♯5'. Unique across the set. */
  id: string
  root: Root
  /** 4 or 5. */
  octave: number
  /** 60..83. */
  midi: number
  /** URL under /notes, e.g. '/notes/note-c-sharp-5.mp3' */
  audioSrc: string
}
export const PITCHES: PitchSample[] = [/* twenty-four entries, ascending by midi */]
```

`NOTES` stays first in the file and stays byte-for-byte the entries it holds
today, so `lib/audio/reference.ts` — Epic 3's file — needs no edit.

### The generator

```ts
// scripts/grooves/notes.ts
export const BASE_OCTAVE = 4
export const NOTE_OCTAVES = [4, 5] as const

export type ReferenceNote = {
  /** Scientific pitch, e.g. 'C♯5'. The lock's id and the manifest's key. */
  id: string
  root: Root
  octave: number
  audioSrc: string
  midi: number
}

/** The file one pitch renders to. Base octave keeps its historical name (R27). */
export function noteFileName(root: Root, octave: number): string
/** The twenty-four notes to render, ascending by midi. */
export function noteSpecs(): ReferenceNote[]
/** Unchanged. */
export function renderNote(pack: SamplePack, midi: number, sampleRate: number): Pcm
```

```ts
// scripts/grooves/lock.ts — one function changes, the Lock shape does not
/** The audio file one note id renders to. `'C4'` → `note-c.mp3`, `'C5'` → `note-c-5.mp3`. */
export function noteFile(notesDir: string, id: string): string
```

`Lock`, `LockPaths`, `buildLock`, `mergeLock`, `verifyLock` and every field of
`grooves.lock.json` keep the shape feature-10 froze. Twenty-four is a longer
`notes` array, not a new family.

### The theory

```ts
// src/features/daily-groove/lib/theory/licks.ts
/** One note of a lick: a scale degree at a beat position. */
export type LickNote = {
  /** Index into the mode's interval table. 0 is the root; 7 is the root an octave up. */
  degree: number
  /** Onset, in beats from the start of the phrase. */
  beat: number
  /** Sounding length, in beats. */
  beats: number
}

/** One phrase per catalogue flavour, twelve entries. */
export const LICKS: Record<Flavour, LickNote[]>

/** The phrase for a mode, or `null` for a mode with none. Never throws. */
export function lickFor(flavour: Flavour): LickNote[] | null
```

```ts
// src/features/daily-groove/lib/theory/phrase.ts
/** One note of a lick, resolved against a root and a tempo. */
export type ScheduledNote = {
  /** 60..83 — a pitch the manifest has a file for. */
  midi: number
  /** Onset in seconds from the start of the phrase. The first note is 0. */
  offsetSeconds: number
  durationSeconds: number
}

/** The lowest and highest pitch the render provides. */
export const LOWEST_MIDI = 60
export const HIGHEST_MIDI = 83

/** The root in the reference octave: 60..71. */
export function rootMidiOf(root: Root): number
/** Semitones above the root for a degree index, wrapping the scale into octaves. */
export function degreeSemitones(flavour: Flavour, degree: number): number
/** A mode, a root and a tempo become the notes to schedule. `[]` for a mode with no lick. */
export function scheduleLick(input: {
  flavour: Flavour
  root: Root
  bpm: number
}): ScheduledNote[]
```

```ts
// src/features/daily-groove/lib/theory/simpleModes.ts
/** Which real mode each simple-mode chip sounds, for one day. */
export function simpleLickMode(input: {
  /** The chip that was tapped. */
  family: Family
  /** The day's answer. */
  answer: Answer
  /** The catalogue's flavours, as `flavourPool(GROOVES)` derives them. */
  pool: Flavour[]
  /** The day, for the seed. */
  date: Date
}): Flavour | null
```

### The voice

```ts
// src/features/daily-groove/lib/audio/lick.ts

/**
 * The two things this voice needs from Epic 3, declared structurally so this
 * module imports nothing of Epic 3's and its tests need none of it on disk.
 * Epic 3's `referenceOutput()` and `createGrooveClock()` satisfy them exactly —
 * these are narrowings of `lib/audio/output.ts`'s and `lib/audio/beat.ts`'s
 * frozen types, never a second declaration of them.
 */
export type OutputClaim = { isHeld(): boolean; release(): void }
export type ReferenceOutput = { claim(cancel: () => void): OutputClaim }
/** Just the member this voice calls. Epic 3's `GrooveClock` is a supertype. */
export type PhraseClock = { nextBeat(now: number): number | null }

export type LickVoice = {
  /**
   * Best effort. Resolves when the phrase is scheduled, or silently when it
   * cannot be. The start time is the clock's, read after the buffers land: the
   * next beat while the groove runs, `ctx.currentTime` when it does not.
   */
  play(notes: ScheduledNote[]): Promise<void>
  /** Fetch and decode every pitch without sounding anything. Best effort. */
  warm(): Promise<void>
  dispose(): void
}

export function createLickVoice(deps: {
  pitches: PitchSample[]
  output: ReferenceOutput
  /** Epic 3's `REFERENCE_LEVEL`, the peak gain of every note. */
  level: number
  /** Epic 3's `REFERENCE_FADE_SECONDS`, the ramp on every note's tail and on a cancel. */
  fadeSeconds: number
  /** Epic 3's `GrooveClock`. Absent means every phrase is immediate. */
  clock?: PhraseClock
}): LickVoice
```

No gain or fade constant is declared in this module. Epic 3's Step B2 reads
every file under `lib/audio/` from disk and fails on a second one, and it is
right to: two numbers for one level is exactly the drift the single declaration
exists to prevent.

### The hook

```ts
// src/features/daily-groove/hooks/useModeLick.ts
export type UseModeLick = {
  /** Sound a mode's lick. Returns nothing, never throws, never rejects. */
  playMode: (flavour: Flavour) => void
  /** Fetch and decode the twenty-four pitches in the background. */
  warm: () => void
}

export function useModeLick(input: {
  pitches: PitchSample[]
  /** The day's root. Every lick is transposed to it. */
  root: Root
  /** The day's stated tempo. */
  bpm: number
  /**
   * Epic 3's `GrooveClock`, as `useTransport(source, bpm)` returns it. Handed
   * straight to the voice, which is what asks it and when.
   */
  clock?: PhraseClock
  /** Epic 3's `REFERENCE_LEVEL`. */
  level: number
  /** Epic 3's `REFERENCE_FADE_SECONDS`. */
  fadeSeconds: number
  /** Epic 3's `referenceOutput()`. */
  output: ReferenceOutput
  /** Injection seam, following `useReferenceNote`'s `voice`. Read once. */
  voice?: LickVoice
}): UseModeLick
```

### What Epic 3 owes, and where it is named

Read from
[epic-3-the-root-note-quieter-and-on-the-beat.md](epic-3-the-root-note-quieter-and-on-the-beat.md)'s
Contracts section, which is where these are frozen. All four are imported in
exactly one file in this epic — `components/GroovePuzzle.tsx`, Track H:

| From | What | Used for |
| :-- | :-- | :-- |
| `lib/audio/level.ts` | `REFERENCE_LEVEL: number` | the peak gain of every lick note (R7) |
| `lib/audio/level.ts` | `REFERENCE_FADE_SECONDS: number` | the ramp on a note's tail and on a cancel (R5, R8) |
| `lib/audio/beat.ts` | `GrooveClock`, via `useTransport(source, bpm).clock` | where the phrase starts (R11, R12) |
| `lib/audio/output.ts` | `referenceOutput(): ReferenceOutput` | one sound across both rows (R8, R8a) |

Two of Epic 3's decisions this epic simply inherits and must not re-litigate.
The clock is built on `getStartTime()` — the graph's **emission** clock — and
not on the latency-corrected `getElapsed()` the progress bar reads, because a
phrase scheduled against the corrected clock lands one output latency late:
10–40 ms wired, 150–300 ms over Bluetooth. And there is no shared master gain;
each voice builds its own `GainNode` from `REFERENCE_LEVEL`, because the fade is
per-note and a shared node would duck the arriving note along with the departing
one.

This epic creates no fallback for any of the four. A second level, a second beat
grid or a second output owner is precisely what the roadmap forbids, and Epic
3's Step B2 has a structural test that fails on the first of those.

`testing/fakeAudioContext.ts` is Epic 3's Track D as well: it adds
`createGain()`, `FakeGainNode`, `FakeAudioParam` and a `gains` array. **This
epic consumes them and adds nothing to that file.**

### The card

```ts
// src/features/daily-groove/components/puzzle/GuessCard.tsx — added props
type GuessCardProps = {
  // …existing props unchanged…
  /**
   * Sound the mode that was just tapped. Called on every mode tap, including a
   * re-tap of the chip already selected (R1, AC2). Best effort by contract: it
   * returns nothing and must never throw — `onSelectFlavour` has already run
   * and no audio failure may undo the selection (R19).
   */
  onHearMode(f: Flavour): void
}
```

## Tracks

### Track A — Two octaves of reference notes

- **Goal** — `npm run notes` renders twenty-four mp3s and writes a manifest with
  both `NOTES` and `PITCHES`; the twelve committed files are untouched.
- **Owns** — `scripts/grooves/notes.ts`, `scripts/grooves/notes.test.ts`,
  `scripts/grooves/notes-manifest.ts`, `scripts/grooves/notes-manifest.test.ts`,
  `scripts/grooves/notes-cli.ts`, `scripts/grooves/notes-cli.test.ts`,
  `src/features/daily-groove/data/notes.generated.ts`,
  `src/features/daily-groove/data/notes.generated.test.ts`, `public/notes/**`,
  `scripts/grooves/grooves.lock.json` (written at Step I1, never by hand)
- **Role** — `musician`
- **Command** — `npm run test:all` (it owns files in the generator tier and in
  the app tier)
- **Depends on** — the id and file-name contract only
- **Parallel with** — every other track
- **Done when** — `npm run test:gen` and `npm test` pass with the render
  exercised into a temp directory. The committed artifacts land at Step I1,
  which needs Track B's `noteFile`.

### Track B — The lock and the guard cover twenty-four

- **Goal** — `noteFile` resolves a scientific-pitch id to the right file in both
  octaves, and `grooves:verify` checks twenty-four notes with no new machinery.
- **Owns** — `scripts/grooves/lock.ts`, `scripts/grooves/lock.test.ts`,
  `scripts/grooves/verify-cli.ts`, `scripts/grooves/verify-cli.test.ts`
- **Role** — `musician`
- **Command** — `npm run test:gen`
- **Depends on** — the id and file-name contract only
- **Parallel with** — every other track
- **Done when** — `npm run test:gen` passes, `lock.ts` still imports only `fs`,
  `crypto`, `path` and the allowlisted three, and no `Lock` field was added.

### Track C — The twelve phrases and the arithmetic

- **Goal** — twelve licks exist as data, and a lick plus a root plus a tempo
  resolves to the notes to schedule.
- **Owns** — `src/features/daily-groove/lib/theory/licks.ts`,
  `lib/theory/licks.test.ts`, `lib/theory/phrase.ts`, `lib/theory/phrase.test.ts`
- **Role** — `implementer`
- **Command** — `npm test`
- **Depends on** — nothing; `FLAVOUR_INTERVALS` in `lib/theory/notes.ts` already
  exists
- **Parallel with** — every other track
- **Done when** — its own tests pass with no voice, no context and no clock.
  The twelve figures are a musical decision: the tests below fix the properties
  they must have, and Step I3 is where they are listened to.

### Track D — Simple mode's two modes

- **Goal** — the matching chip resolves to the day's mode and the other to a
  date-seeded mode of the other family, stable for the day.
- **Owns** — `src/features/daily-groove/lib/theory/simpleModes.ts`,
  `lib/theory/simpleModes.test.ts`, `lib/theory/families.test.ts`
- **Role** — `implementer`
- **Command** — `npm test`
- **Depends on** — `familyOf` and `seededShuffle`, both already shipped
- **Parallel with** — every other track
- **Done when** — its own tests pass, including the two properties the roadmap
  asks to be asserted rather than assumed.

### Track E — The lick voice

- **Goal** — a `ScheduledNote[]` sounds on the shared context, one envelope per
  note, taking the shared output over and cancelling whatever it replaced.
- **Owns** — `src/features/daily-groove/lib/audio/lick.ts`,
  `lib/audio/lick.test.ts`
- **Role** — `implementer`
- **Command** — `npm test`
- **Depends on** — the `ScheduledNote`, `PitchSample`, `ReferenceOutput` and
  `PhraseClock` shapes; `lib/audio/context.ts`, already shipped. **Its gain
  assertions need Epic 3's Track D**, which adds `createGain`, `FakeGainNode`
  and `gains` to `testing/fakeAudioContext.ts` — this epic consumes that and
  writes nothing in the file. Step E2 is the gated one; every other step runs
  without it.
- **Parallel with** — every other track. It imports neither `phrase.ts` nor
  Epic 3: its tests hand it literal notes, a literal pitch list, a stub output
  and a stub clock.
- **Done when** — its tests pass against `testing/fakeAudioContext.ts` with the
  fake clock, and `lick.ts` declares no gain or fade constant of its own.

### Track F — The hook that holds the voice

- **Goal** — one `LickVoice` for the life of the page, and one call that turns a
  `Flavour` into a scheduled phrase.
- **Owns** — `src/features/daily-groove/hooks/useModeLick.ts`,
  `hooks/useModeLick.test.ts`
- **Role** — `implementer`
- **Command** — `npm test`
- **Depends on** — Track C's `lickFor` and `scheduleLick`, Track E's
  `createLickVoice`. Nothing of Epic 3's: the clock is a value it forwards, and
  its tests forward a stub.
- **Parallel with** — Track G, Track A, Track B
- **Done when** — its tests pass with an injected voice.

### Track G — The mode row sounds, and says so

- **Goal** — the mode `ChipGroup` calls `onHearMode` on every tap and carries
  the `♪`.
- **Owns** — `src/features/daily-groove/components/puzzle/GuessCard.tsx`,
  `components/puzzle/GuessCard.test.tsx`
- **Role** — `implementer`
- **Command** — `npm test`
- **Depends on** — nothing; the prop is a prop
- **Parallel with** — every other track
- **Done when** — its tests pass. **File-ownership seam:** this track owns the
  mode `ChipGroup`'s props and nothing else in the file. Epic 2 owns the toggle
  stack above the rows, the root row's gated adornment and the `Check` control
  below; whichever epic lands second passes the mode row's `adornment` through
  Epic 2's condition, which is one attribute.

### Track H — The page wires it

- **Goal** — tapping a mode on the real page sounds a lick, in time, and the
  caption says both rows sound.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `components/GroovePuzzle.sounding.test.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Command** — `npm test`
- **Depends on** — Tracks C, D, F, G; and **Epic 3's Track E**, which must
  already have landed in these files (see *The wiring order* below). This is the
  only file in the epic that names Epic 3's modules.
- **Parallel with** — nothing in this epic, and nothing in Epic 2 or Epic 3 —
  all three page-wiring tracks own the same two files.
- **Done when** — the composed tests pass and the full suite is green.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D, Track E, Track G
- **Wave 2:** Track F — needs C's `scheduleLick` and E's `createLickVoice` on
  disk
- **Wave 3:** Track H — needs F's hook, D's `simpleLickMode`, G's prop, and
  Epic 3's Track E already landed in `GroovePuzzle.tsx` (Step I0)
- **Wave 4:** Integration — Step I1 renders and commits the artifacts (needs A
  and B), Step I2 is the demo path, Step I3 is the listen, Step I4 is the suite.
  Step I0 is the ordering check Track H runs before it opens a file.

**Cross-epic.** Wave 3 is where Epic 1 meets Epic 3, and Waves 1–2 do not wait
for it except for Step E2's gain assertions, which need the fake context Epic
3's Track D extends. The roadmap has Epic 3 shipping first, and its Tracks A, B
and C — the three contracts — are its own Wave 1.

**The wiring order, and it is not negotiable.** Three tracks across three epics
own `components/GroovePuzzle.tsx` and `components/GroovePuzzle.sounding.test.tsx`,
and two of them also own `testing/puzzleHarness.tsx`. They cannot run
concurrently:

1. **Epic 3's Track E** — adds `bpm` to the `useTransport` call and `clock` to
   the `useReferenceNote` call, and reorders the two so the transport is built
   first.
2. **Epic 1's Track H** — consumes that `clock`, adds `useModeLick` and the mode
   handler.
3. **Epic 2's Track E** — adds `useTapSounds` and routes the mode handler, the
   root handler, both warms and the caption through the gate.

**What Track H expects to find in the file when it starts:** a
`useTransport(source, groove.bpm)` call that returns `clock` alongside
`isPlaying`, `loading`, `position`, `error` and `toggle`; a
`useReferenceNote(NOTES, { clock })` call built *after* it; and
`lib/audio/level.ts`, `lib/audio/beat.ts` and `lib/audio/output.ts` on disk. If
`useTransport` still takes one argument, Epic 3's Track E has not landed and
Track H waits — it does not add the parameter itself.

**A second cross-epic file.** `components/puzzle/GuessCard.tsx` is Track G's
here and Epic 2's Tracks C and D's. Track G must land before Epic 2's Track D,
so that D routes the mode row's `adornment` through `tapSounds` in the same pass
it does the root row's; Epic 2's Track C (the `Check` size) touches a different
region and may go either side. And Epic 2's Track A rewrites one line of
`GroovePuzzle.sounding.test.tsx` — the harness's `enableSimpleMode` helper moves
from `.set({ simpleMode: true })` to `.update({ simpleMode: true })`, which Step
H2 uses; if Epic 2's Track A has landed first, use `update`.

## Implementation

### Track A — Two octaves of reference notes

#### Step A1 — A pitch has an id, and the base octave keeps its file name

Covers: R26, R27

- **Test first** — `scripts/grooves/notes.test.ts`: extend the `noteFileName`
  describe to assert `noteFileName('C', 4) === 'note-c.mp3'`,
  `noteFileName('C♯', 4) === 'note-c-sharp.mp3'`,
  `noteFileName('E♭', 4) === 'note-e-flat.mp3'`,
  `noteFileName('C', 5) === 'note-c-5.mp3'`,
  `noteFileName('C♯', 5) === 'note-c-sharp-5.mp3'` and
  `noteFileName('E♭', 5) === 'note-e-flat-5.mp3'`. Run it: fails with
  `AssertionError: expected 'note-c.mp3' to be 'note-c-5.mp3'` (the second
  argument is ignored by the one-argument function).
- **Implement** — `scripts/grooves/notes.ts`: `export const BASE_OCTAVE = 4`,
  `export const NOTE_OCTAVES = [4, 5] as const`, and
  `noteFileName(root: Root, octave: number)` returning `note-<slug>.mp3` at
  `BASE_OCTAVE` and `note-<slug>-<octave>.mp3` above it. The comment names R27
  as the reason for the branch: the twelve committed URLs and lock hashes must
  not move. Delete `NOTE_OCTAVE`; nothing outside this module reads it.
- **Green when** — the six assertions pass and the rest of `notes.test.ts` is
  untouched.
- **Refactor** — none.

#### Step A2 — Twenty-four specs, ascending, each with a unique id

Covers: R26, R27, AC17

- **Test first** — `scripts/grooves/notes.test.ts`, in the `noteSpecs` describe:
  assert `noteSpecs()` has length 24; that `noteSpecs().map((s) => s.midi)`
  equals `[60, 61, …, 83]`; that the first twelve `root` values equal `ROOTS` and
  the second twelve equal `ROOTS` again; that `noteSpecs().map((s) => s.id)`
  starts `['C4', 'C♯4', 'D4', …]` and ends `[…, 'B♭5', 'B5']`; that
  `new Set(noteSpecs().map((s) => s.id)).size === 24`; and that the twelve specs
  with `octave === 4` have exactly the `audioSrc` values the committed manifest
  carries today (`/notes/note-c.mp3` … `/notes/note-b.mp3`). Run it: fails with
  `AssertionError: expected 12 to be 24`.
- **Implement** — `scripts/grooves/notes.ts`: `ReferenceNote` gains `id` and
  `octave`; `noteSpecs()` maps `NOTE_OCTAVES` over `ROOTS`, ascending by midi,
  with `id` the root followed by the octave (`'C♯5'`), `midi` from
  `midiOf(root, octave)`, and `audioSrc` the file name under `/notes/`.
- **Green when** — the new assertions pass and the existing render cases —
  which take a midi, not a spec — are untouched.
- **Refactor** — none.

#### Step A3 — The upper octave renders like the lower one

Covers: R7, R26, R28

- **Test first** — `scripts/grooves/notes.test.ts`, in *the reference notes are
  answers, not performances*: add a case asserting that for all twenty-four
  specs `renderNote(pack, spec.midi, SAMPLE_RATE)` has
  `left.length === Math.round(NOTE_SECONDS * SAMPLE_RATE)`, that a second render
  of the same midi is sample-for-sample equal, that exactly one `comp` request
  is made at one velocity per spec, and that the loudest and quietest peak
  across all twenty-four differ by less than 0.001. Run it: fails with
  `AssertionError: expected 12 to be 24` from the spec count, then passes on
  the measurements — which is the point: the render needed no change.
- **Implement** — nothing in `notes.ts`. If a peak or a length disagrees, the
  fix is here and the step is not green.
- **Green when** — all four assertions hold over twenty-four pitches.
- **Refactor** — none.

#### Step A4 — The manifest carries both exports

Covers: R29, AC17

- **Test first** — `scripts/grooves/notes-manifest.test.ts`: assert
  `renderNotesManifest(noteSpecs())` contains
  `export const NOTES: ReferenceNote[] = [` with exactly twelve `    root: `
  lines before `export const PITCHES: PitchSample[] = [`; contains
  `export type PitchSample = {`; that the whole source has exactly 36
  `    root: ` lines; that `PITCHES` entries appear ascending by `midi` from 60
  to 83; that the rendered source contains no `"` outside the banner (the
  existing single-quote case, extended); and that two renders of the same specs
  are identical strings. Run it: fails with
  `AssertionError: expected '…' to contain 'export const PITCHES'`.
- **Implement** — `scripts/grooves/notes-manifest.ts`: a second `TYPE` block for
  `PitchSample`, a second `FIELDS` tuple `['id', 'root', 'octave', 'midi',
  'audioSrc']`, and `renderNotesManifest` emitting `NOTES` from the
  `octave === BASE_OCTAVE` specs (projected to `root`, `audioSrc`, `midi`) and
  `PITCHES` from all of them. `NOTES` stays first so a reader meets the row's
  twelve before the sequencer's twenty-four.
- **Green when** — the assertions pass and `writeNotesManifest` still writes
  exactly what `renderNotesManifest` returns.
- **Refactor** — the two `renderEntry` helpers become one taking a field list.

#### Step A5 — `npm run notes` renders and records twenty-four

Covers: R26, R28, R29, R30

- **Test first** — `scripts/grooves/notes-cli.test.ts`: in the ffmpeg-gated
  suite, assert a non-empty mp3 exists at
  `join(outDir, noteFileName(spec.root, spec.octave))` for all twenty-four
  specs; that the manifest source has 36 `    root: ` lines; that `lock.notes`
  has 24 entries whose ids sorted equal `noteSpecs().map((s) => s.id).sort()`;
  and that the groove side of the lock is untouched. In the *run twice* suite,
  assert every one of the twenty-four files is byte-identical across the two
  runs and the two locks are deep-equal. Run it: fails with
  `AssertionError: expected 12 to be 24`.
- **Implement** — `scripts/grooves/notes-cli.ts`: `noteFileName(spec.root,
  spec.octave)` at the encode site, and `noteFile(targets.outDir, spec.id)` in
  `recordInLock`. No other change — the loop already walks `noteSpecs()`.
- **Green when** — both ffmpeg-gated suites pass.
- **Refactor** — none.

#### Step A6 — The shipped manifest describes twenty-four real files

Covers: R26, R29, AC17

- **Test first** — `src/features/daily-groove/data/notes.generated.test.ts`:
  keep every existing case about `NOTES` verbatim — twelve entries, `ROOTS`
  order, three fields, unique `/notes/` paths, a real non-empty file each, one
  per catalogue root. Add a `PITCHES` describe: 24 entries; `midi` ascending
  from 60 to 83 with no gaps; unique `id` and unique `audioSrc`; a real
  non-empty file behind every entry; and that the twelve `PITCHES` with
  `octave === 4`, projected to `{ root, audioSrc, midi }`, deep-equal `NOTES`.
  Run it: fails with `SyntaxError: The requested module './notes.generated'
  does not provide an export named 'PITCHES'`.
- **Implement** — nothing by hand. This step goes green at Step I1, when the
  render is run and the generated module is replaced.
- **Green when** — `npm test` passes after I1.
- **Refactor** — none.

### Track B — The lock and the guard cover twenty-four

#### Step B1 — `noteFile` reads a scientific-pitch id

Covers: R30

- **Test first** — `scripts/grooves/lock.test.ts`: replace the three `noteFile`
  assertions with `noteFile('/notes', 'C4') === '/notes/note-c.mp3'`,
  `noteFile('/notes', 'C♯4') === '/notes/note-c-sharp.mp3'`,
  `noteFile('/notes', 'E♭4') === '/notes/note-e-flat.mp3'`,
  `noteFile('/notes', 'C5') === '/notes/note-c-5.mp3'`,
  `noteFile('/notes', 'C♯5') === '/notes/note-c-sharp-5.mp3'`; and widen the
  shape case to `expect(noteFile('/notes', id)).toMatch(/^\/notes\/note-[a-z0-9-]+\.mp3$/)`
  over both octaves. Run it: fails with
  `AssertionError: expected '/notes/note-c4.mp3' to be '/notes/note-c.mp3'`.
- **Implement** — `scripts/grooves/lock.ts`: `noteFile` splits the trailing
  digits off the id as the octave, slugs the remainder as today, and appends
  `-<octave>` only when the octave is not 4. The comment says why the base
  octave is bare — R27, the twelve committed files — and that the rule is
  written a second time in `notes.ts` because this module may not import it.
- **Green when** — the assertions pass.
- **Refactor** — none. Resist folding the two slug functions together: the
  import that would take is exactly what Step B2 forbids.

#### Step B2 — The guard still renders nothing

Covers: R31

- **Test first** — `scripts/grooves/lock.test.ts`: the two source-reading cases
  are unchanged and must stay green — `lock.ts` and `verify-cli.ts` import only
  the allowlisted seven and reach for no audio module. Run the file: it passes
  unless B1's implementation reached for `notes.ts`, in which case it fails with
  `AssertionError: lock.ts imports ./notes.ts: expected false to be true`.
- **Implement** — nothing, if B1 was done right.
- **Green when** — both cases pass and
  `verifies a whole fixture without any audio module being loadable` still
  passes.
- **Refactor** — none.

#### Step B3 — Verify reports twenty-four, and fails on a missing one

Covers: R30, R31, AC19

- **Test first** — `scripts/grooves/verify-cli.test.ts`: build a fixture with 24
  note entries across both octaves and assert `main` returns 0 and logs
  `24 notes`; then delete `note-c-5.mp3` and assert it returns 1 with a
  `[missing]` failure naming that file; then rewrite one byte of the notes
  manifest and assert a `[notes-manifest-stale]` failure whose detail ends with
  the words *run `npm run notes` to re-render the reference notes*. Run it:
  fails with
  `AssertionError: expected 1 to be 0` on the first case (the fixture's upper
  octave resolves to the wrong paths until B1 lands).
- **Implement** — nothing in `verify-cli.ts`: `verifyLock` already iterates
  `lock.notes` through `noteFile`, so the count and the failures follow from B1.
  If a path constant had to change, this is where it changes.
- **Green when** — all three cases pass.
- **Refactor** — none.

### Track C — The twelve phrases and the arithmetic

#### Step C1 — A root sits in the reference octave

Covers: R1, R13

- **Test first** — `src/features/daily-groove/lib/theory/phrase.test.ts`:
  assert `rootMidiOf('C') === 60`, `rootMidiOf('E♭') === 63`,
  `rootMidiOf('B') === 71`, and that `ROOTS.map(rootMidiOf)` equals
  `[60, 61, …, 71]`. Run it: fails with
  `Error: Failed to resolve import "./phrase" from
  "src/features/daily-groove/lib/theory/phrase.test.ts"`.
- **Implement** — `lib/theory/phrase.ts`: `LOWEST_MIDI = 60`,
  `HIGHEST_MIDI = 83`, and `rootMidiOf(root)` = `LOWEST_MIDI +
  ROOTS.indexOf(root)`, throwing `UnknownRootError` for anything else.
- **Green when** — the four assertions pass.
- **Refactor** — none.

#### Step C2 — A degree resolves through the mode, and wraps

Covers: R5, R6

- **Test first** — `lib/theory/phrase.test.ts`: assert
  `degreeSemitones('Lydian', 3) === 6` (the ♯4),
  `degreeSemitones('Ionian', 3) === 5`,
  `degreeSemitones('Phrygian', 1) === 1` (the ♭2),
  `degreeSemitones('Aeolian', 1) === 2`,
  `degreeSemitones('Dorian', 5) === 9` against `degreeSemitones('Aeolian', 5) === 8`,
  `degreeSemitones('Ionian', 7) === 12` (the root an octave up),
  `degreeSemitones('Blues', 6) === 12` (a six-note scale wraps at six), and
  `degreeSemitones('Blues', 3) === 6`. Run it: fails with
  `TypeError: degreeSemitones is not a function`.
- **Implement** — `lib/theory/phrase.ts`: look the flavour up in
  `FLAVOUR_INTERVALS` (case-insensitively, as `notes.ts` does), then
  `intervals[degree % intervals.length] + 12 * Math.floor(degree / intervals.length)`.
  Throws `UnknownFlavourError` for a flavour with no table.
- **Green when** — all eight assertions pass.
- **Refactor** — none.

#### Step C3 — Twelve phrases exist, each leaning on what makes its mode

Covers: R4, R5, R5a, R5b, R6, AC4, AC6c

- **Test first** — `lib/theory/licks.test.ts`, four cases:
  1. **Every catalogue mode has one.** `flavourPool(GROOVES).forEach((f) =>
     expect(lickFor(f), f).not.toBeNull())`, and `Object.keys(LICKS)` sorted
     equals `flavourPool(GROOVES)` sorted — twelve entries, the same tripwire
     `families.test.ts` uses rather than a hardcoded list.
  2. **Each is a phrase, roughly a bar.** For every lick: at least 4 and at most
     12 notes; `notes[0].beat === 0`; every `beat` strictly ascending; every
     `beats > 0`; and the last note's `beat + beats <= 4.5` — about a bar, with
     room for a note that rings over the bar line.
  3. **Each leans on its own interval.** A table in the test file, asserted
     entry by entry: every degree listed must appear in that mode's lick.

     | Mode | Degrees that must appear |
     | :-- | :-- |
     | Ionian | 2, 3, 5, 6 |
     | Dorian | 2 and 5 |
     | Phrygian | 1 |
     | Lydian | 3 |
     | Mixolydian | 2, 5, 6 |
     | Aeolian | 1, 2, 5, 6 |
     | Blues | 3 |
     | Harmonic minor | 5 and 6 |
     | Melodic minor | 5 and 6 |
     | Harmonic major | 2, 5, 6 |
     | Lydian dominant | 3 and 6 |
     | Phrygian dominant | 1 and 2 |

     Spell it as `Record<Flavour, { present: number[] }>`. **There is no
     `absent`, and one must not be added.** A `LickNote` carries a degree index
     resolved through the tapped mode's own interval table, so a degree that
     resolves to the same pitch in two modes cannot make them confusable —
     forbidding it removes information and no ambiguity. More generally,
     deleting a pitch class can only grow the set of scales a phrase fits, so an
     exclusion is strictly counterproductive. An earlier draft of this table
     read "Dorian: 2 is absent", to stop Dorian being mistaken for Aeolian; the
     phrase it produced had no minor third and was, note for note, a legal
     *Mixolydian* phrase — a mode that can be the chip sitting next to it.
  3a. **Each phrase belongs to exactly one scale.** This is what the exclusion
     was reaching for, stated so that it can only be satisfied by adding tones:
     a phrase's pitch-class set, taken from the root, is contained in its own
     mode's scale and in no other scale in `FLAVOUR_INTERVALS`. Iterate all
     thirteen keys, Locrian included, and resolve through `degreeSemitones` so
     the test measures the pitches the app actually schedules.
  3b. **No note outlasts its file.** No `LickNote` declares `beats > 2`. The
     note files are 2.0s and the browser ramps a note to zero at
     `durationSeconds + REFERENCE_FADE_SECONDS`; at open-ballad's 62 bpm — the
     slowest tempo any template can draw, below the catalogue's current 67 —
     two beats is 1.935s + 0.03 = 1.965s, leaving 35ms of file. 2.25 beats
     overruns. The failure mode is a note that goes quiet early at ballad tempo
     only.
  4. **No two are the same, in either dimension.** The twelve
     `notes.map((n) => n.degree)` sequences are all distinct (R5b), and the
     twelve sequences of `beat` paired with `beats` are all
     distinct (R5a).

  Run it: fails with `Error: Failed to resolve import "./licks"`.
- **Implement** — `lib/theory/licks.ts`: the `LICKS` table and `lickFor`.
  `lickFor` returns `null` for an unknown flavour rather than throwing — unlike
  `familyOf`, a missing lick must be silence, because it is reached from a click
  handler after the selection has already happened (R19, R20). Writing the
  twelve figures is the musical work in this track: pick a rhythm that suits
  each mode, keep every degree within twelve semitones of the root, and read
  [docs/music.md](../../../docs/music.md) before choosing registers.
- **Green when** — all four cases pass.
- **Refactor** — none. Do not extract a shared "figure" the twelve vary: R5a
  exists to forbid exactly that.

#### Step C4 — A lick, a root and a tempo become notes to schedule

Covers: R1, R13, AC5, AC10

- **Test first** — `lib/theory/phrase.test.ts`, five cases:
  1. `scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 120 })` returns one
     entry per `LICKS.Lydian` note, in order, with `offsetSeconds` equal to
     `beat * 0.5` and `durationSeconds` equal to `beats * 0.5`, and the first
     entry's `offsetSeconds === 0`.
  2. **Tempo scales it (AC10).** For every catalogue flavour, the same call at
     `bpm: 67` and at `bpm: 130` produces the same `midi` sequence, and every
     `offsetSeconds` at 67 is `130 / 67` times the one at 130, to within
     `1e-9`.
  3. **In range.** For every flavour and every one of the twelve roots, every
     `midi` is `>= LOWEST_MIDI` and `<= HIGHEST_MIDI`.
  4. **The twelve are distinct from one root (AC5).** From `root: 'C'` at
     `bpm: 100`, the twelve `midi` sequences are all distinct.
  5. **A mode with no lick is silence, not a throw.**
     `scheduleLick({ flavour: 'Locrian', root: 'C', bpm: 100 })` returns `[]`.

  Run it: fails with `TypeError: scheduleLick is not a function`.
- **Implement** — `lib/theory/phrase.ts`: `scheduleLick` reads `lickFor`, and
  for each note emits `{ midi: rootMidiOf(root) + degreeSemitones(flavour,
  note.degree), offsetSeconds: note.beat * 60 / bpm, durationSeconds:
  note.beats * 60 / bpm }`. Returns `[]` for a null lick or a non-finite,
  non-positive `bpm`.
- **Green when** — all five cases pass.
- **Refactor** — none.

### Track D — Simple mode's two modes

#### Step D1 — The families table is disjoint and even

Covers: R16

- **Test first** — `lib/theory/families.test.ts`: add two cases. Every mode in
  `flavourPool(GROOVES)` grades to exactly one family — assert `familyOf` is
  total (the existing case) and that the two family lists, derived by filtering
  the pool, share no member and together cover it. And each family has exactly
  six members. Run it: passes today, and it is the tripwire that fails the day a
  thirteenth mode lands in one family alone or in neither.
- **Implement** — nothing; a green red step here is the assertion the roadmap
  asked to be made explicit rather than assumed.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step D2 — The matching chip is the day's own mode

Covers: R15, AC11

- **Test first** — `lib/theory/simpleModes.test.ts`: for a day whose answer is
  `{ root: 'C', flavour: 'Lydian' }` (a Major mode), assert
  `simpleLickMode({ family: 'Major', answer, pool, date })` returns `'Lydian'`;
  for `{ root: 'C', flavour: 'Dorian' }`, that `family: 'Minor'` returns
  `'Dorian'`. Run it: fails with
  `Error: Failed to resolve import "./simpleModes"`.
- **Implement** — `lib/theory/simpleModes.ts`: when
  `familyOf(answer.flavour) === family`, return `answer.flavour`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D3 — The other chip is a date-seeded mode of the other family

Covers: R16, R17, AC11, AC12

- **Test first** — `lib/theory/simpleModes.test.ts`, four cases: for an answer
  of `Lydian`, `family: 'Minor'` returns a flavour whose `familyOf` is `Minor`
  and which is not `'Lydian'`; the same call twice with the same `date` returns
  the same flavour; two different dates over a week produce at least two
  different flavours; and over all twelve catalogue answers, the non-matching
  chip never returns the day's own mode. Run it: fails with
  `AssertionError: expected undefined to be a string`.
- **Implement** — `lib/theory/simpleModes.ts`: filter `pool` by
  `familyOf(f) === family`, `seededShuffle(candidates, isoDate(date))[0]`,
  returning `null` for an empty pool. The guard against colliding with the day's
  mode is the families table being disjoint (Step D1), not a filter — record
  that in the comment, as the PRD does.
- **Green when** — all four cases pass.
- **Refactor** — none.

### Track E — The lick voice

#### Step E1 — A phrase sounds, one node per note

Covers: R1, R12, R32

- **Test first** — `lib/audio/lick.test.ts`, against
  `installFakeAudioContext()` with `resetReferenceOutput()` in `afterEach`:
  build a voice over three `PitchSample`s, with no clock, and call
  `play([{ midi: 60, offsetSeconds: 0, durationSeconds: 0.5 }, { midi: 64,
  offsetSeconds: 0.5, durationSeconds: 0.5 }])`. Assert two source nodes were
  created; each `start` was called with a `when` of
  `fake.currentTime + offsetSeconds`, so the first is exactly the context's
  clock; each node's `buffer` is the decoded one; and `fake.fetchCalls === 2`.
  Run it: fails with `Error: Failed to resolve import "./lick"`.
- **Implement** — `lib/audio/lick.ts`: `createLickVoice` holds a
  `Map<number, AudioBuffer>` keyed by midi, a `Map<number, Promise<AudioBuffer>>`
  of in-flight decodes, the live nodes and the current `OutputClaim`. `play`
  awaits every buffer, resumes a suspended context, reads
  `const now = ctx.currentTime` **after** the await, takes
  `const origin = clock?.nextBeat(now) ?? now`, then creates one
  `BufferSource` → `GainNode` → `ctx.destination` chain per note and calls
  `start(origin + note.offsetSeconds)`. No lead constant: `start` with a `when`
  at or fractionally before `currentTime` fires at once, which is what R12 asks
  for, and every later note is already in the future.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step E2 — Each note is shaped down, so the phrase is a line

Covers: R5, R7

**Gated on Epic 3's Track D**, which adds `createGain()`, `FakeGainNode`,
`FakeAudioParam` and the `gains` array to `testing/fakeAudioContext.ts`. This
epic consumes them and writes nothing in that file — adding `createGain` here
would collide with the track that owns it.

- **Test first** — `lib/audio/lick.test.ts`: assert `fake.gains` holds one node
  per note; that each one's `gain.value` — or its `setValueAtTime` call — is
  `REFERENCE_LEVEL` as handed to the voice, and that the same number is used for
  every note of every phrase (R7); that each received a
  `linearRampToValueAtTime(0, when + durationSeconds + fadeSeconds)`; and that
  each source's `stop` was scheduled for that same time. Run it: fails with
  `TypeError: ctx.createGain is not a function` until Epic 3's Track D lands,
  then with `AssertionError: expected [] to have a length of 2`.
- **Implement** — the gain node in `lib/audio/lick.ts`, built from the injected
  `level` and ramped over the injected `fadeSeconds`. **No constant is declared
  here.** Epic 3's `REFERENCE_FADE_SECONDS` is the ramp for a note's tail as
  well as for a cancel: one fade, one number, one place — a `NOTE_RELEASE_SECONDS`
  of this epic's own would be the second gain-adjacent constant Epic 3's Step B2
  fails on.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step E3 — A phrase starts on the beat the clock names, asked after the fetch

Covers: R11, R12, R14, AC8, AC9

- **Test first** — `lib/audio/lick.test.ts`, three cases. With
  `fake.advance(3)` and a stub clock whose `nextBeat` returns `4.25`, call
  `play(notes)` and assert the first `start` was called with exactly `4.25` and
  the second with `4.25 + offsetSeconds` (AC8). With a stub clock whose
  `nextBeat` returns `null`, assert the first `start` is exactly
  `fake.currentTime` (AC9). And the ordering case: `fake.deferNextDecode()`,
  call `play(notes)`, `fake.advance(2)`, then `fake.releaseDecodes()` — assert
  the stub's `nextBeat` was called **once**, with the clock value *after* the
  advance, not before it. Run it: fails with
  `AssertionError: expected 3 to be 4.25`.
- **Implement** — the `const now = ctx.currentTime` / `clock?.nextBeat(now)`
  pair from Step E1, placed after the buffer await. The stub clock is a literal
  `{ nextBeat: vi.fn(() => 4.25) }` — the voice calls nothing else on it, which
  is what `PhraseClock` narrowing the contract to one member records.
- **Green when** — all three cases pass.
- **Refactor** — none.

#### Step E4 — A second phrase claims the output, pending notes and all

Covers: R8, R8a, AC6

- **Test first** — `lib/audio/lick.test.ts`, against the **real**
  `referenceOutput()` from Epic 3 where it is on disk and a hand-made stand-in
  of the same shape where it is not. Play a four-note phrase against a clock
  returning `10`, await it, then play another. Assert:
  - `output.claim` was called once per `play`, and the second call happened
    before the second phrase's first `start`;
  - every node from the first phrase had `stop()` and `disconnect()` called —
    including the three whose `when` was still in the future;
  - the four nodes of the second phrase are the only ones without a `stop`;
  - the first phrase's `OutputClaim.isHeld()` is now `false`;
  - and, driving it from the other side, invoking the `cancel` the voice handed
    to `claim` stops that phrase's nodes — which is how a *root* tap silences a
    lick (R8a, the half of AC6b this epic owns).

  Run it: fails with `AssertionError: expected "stop" to be called at least once`.
- **Implement** — once every buffer is in hand and immediately before the first
  `start`, `play` calls `const claim = output.claim(cancelAll)`. `cancelAll`
  ramps a sounding note's gain to zero over `fadeSeconds` and calls `stop` on
  every node in the live list, then empties it. Each note's creation is guarded
  by `claim.isHeld()`, so a claim taken away mid-loop stops the rest of the
  phrase being scheduled at all. The last note's `onended` calls
  `claim.release()` — idempotent, and a no-op once superseded, which is why it
  needs no `isHeld` check of its own.
- **Green when** — all five assertions pass.
- **Refactor** — none.

#### Step E5 — A pitch is fetched once, and a tap that arrives first still sounds

Covers: R32, R33, AC20

- **Test first** — `lib/audio/lick.test.ts`: play a phrase twice and assert
  `fake.fetchCalls` and `fake.decodeCalls` did not increase on the second call.
  Separately, on a fresh voice with no `warm()` at all, play a phrase and assert
  the nodes were created and started. And: `warm()` on a voice whose pitch list
  contains one `failFetchFor` URL still resolves and still decodes the others.
  Run it: fails with `AssertionError: expected 4 to be 2`.
- **Implement** — the buffer and in-flight maps from Step E1, cleared on failure
  the way `reference.ts` clears its `pending`; `warm()` is
  `Promise.allSettled` over every pitch.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step E6 — Every failure is silence

Covers: R20, R21, AC14

- **Test first** — `lib/audio/lick.test.ts`: with `vi.stubGlobal('AudioContext',
  undefined)`, assert `play(notes)` resolves and creates no node. With
  `fake.failNextDecode()`, assert `play` resolves, nothing sounds, and a
  *previously* sounding phrase is not cut — `output.claim` was not called, so
  `referenceOutput().isClaimed()` is still true for the earlier holder. With a
  `midi` the pitch list does not carry, assert `play` resolves and creates no
  node. Assert `console.error` was not called in any of the three. Run it: fails
  with `Error: Audio playback is unavailable in this browser`.
- **Implement** — one `try { … } catch { }` around the whole of `play`, with the
  `output.claim` deliberately placed after every buffer is in hand, exactly as
  `reference.ts` places its own take-over: a fetch that failed must not cut off
  what is already ringing.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step E7 — The coupling to the transport is one-way

Covers: R9, R10, R14

- **Test first** — `lib/audio/lick.test.ts`: read
  `src/features/daily-groove/lib/audio/lick.ts` from disk and assert no import
  specifier matches `/transport|loop|\/audio\/audio/`, and that the source
  contains none of `getElapsed`, `getPosition`, `getStartTime` or `toggle`. The
  clock arrives as an argument and its only member this voice may call is
  `nextBeat` — assert the source names neither `subscribe` nor `isRunning`, so
  the read stays a single question asked once per phrase. Run it: passes, and
  stays as the guard. Model it on the source-reading cases in
  `structure.test.ts`.
- **Implement** — nothing.
- **Green when** — the case passes.
- **Refactor** — none.

### Track F — The hook that holds the voice

#### Step F1 — One voice for the life of the page

Covers: R32

- **Test first** — `hooks/useModeLick.test.ts`: render the hook with an injected
  stub voice via `renderHook`, re-render three times, and assert the stub's
  factory was not called again and `dispose` was not called; unmount and assert
  `dispose` was called once. Run it: fails with
  `Error: Failed to resolve import "../hooks/useModeLick"`.
- **Implement** — `hooks/useModeLick.ts`, modelled line for line on
  `useReferenceNote`: a lazy `useState` initialiser holding
  `voice ?? createLickVoice({ pitches, output, level, fadeSeconds, clock })`,
  and a `useEffect` cleanup that disposes it. The clock is read once, when the
  voice is first held — `useTransport` builds one per groove and the page has
  one groove, so it is stable for the life of the component.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step F2 — A mode becomes a scheduled phrase at the day's tempo

Covers: R1, R13, AC4

- **Test first** — `hooks/useModeLick.test.ts`: with `root: 'C'` and `bpm: 96`,
  call `playMode('Lydian')` and assert the stub voice's `play` was called once
  with `scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 96 })` deep-equal as
  its only argument. Repeat for all twelve catalogue flavours and assert twelve
  distinct arguments. Run it: fails with
  `TypeError: playMode is not a function`.
- **Implement** — `playMode` calls `scheduleLick`, returns early on `[]`, and
  calls `voice.play(notes)`. It computes no time of its own: when a phrase
  starts is the voice's question to the clock, asked after the fetch.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step F3 — The clock reaches the voice, and nothing else does

Covers: R11, R12, R14

- **Test first** — `hooks/useModeLick.test.ts`: render the hook with a stub
  clock `{ nextBeat: vi.fn() }` and a **real** `createLickVoice` — no injected
  voice — and assert the clock object the hook was given is the one the voice
  asks, by calling `playMode('Dorian')` and checking `nextBeat` was called once.
  Then re-render with a different `clock` and assert the voice was **not**
  rebuilt and still holds the first one: the clock is read when the voice is
  held, and the page has one groove. Add a source-reading case: `useModeLick.ts`
  names no transport module and neither `getElapsed` nor `getPosition` nor
  `getStartTime` (R14). Run it: fails with
  `AssertionError: expected "nextBeat" to be called 1 times, but got 0 times`.
- **Implement** — pass `clock` straight into `createLickVoice`. The hook
  computes no time, reads no transport and holds no reference to one.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step F4 — Nothing here can throw at the call site

Covers: R19, R20, AC14

- **Test first** — `hooks/useModeLick.test.ts`: inject a voice whose `play`
  throws synchronously, and another whose `play` returns a rejected promise;
  assert `playMode('Dorian')` returns `undefined` in both cases, throws nothing,
  and produces no unhandled rejection (`process.on('unhandledRejection')` spy,
  or the `vi.spyOn(console, 'error')` the repo already uses). Run it: fails with
  `Error: boom`.
- **Implement** — the same double guard `useReferenceNote` uses:
  `try { void Promise.resolve(held.play(…)).catch(() => {}) } catch { }`.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step F5 — Warming is an optimisation

Covers: R33, R34

- **Test first** — `hooks/useModeLick.test.ts`: assert `warm()` forwards to the
  voice and swallows a rejection; and assert that rendering the hook alone,
  with no `warm()` call, fetches nothing. Run it: fails with
  `TypeError: warm is not a function`.
- **Implement** — `warm` mirrors `useReferenceNote`'s.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track G — The mode row sounds, and says so

#### Step G1 — A mode tap selects and asks for the sound

Covers: R1, R2, R3, AC1, AC2, AC3

- **Test first** — `components/puzzle/GuessCard.test.tsx`: render the card with
  spies for `onSelectFlavour` and `onHearMode`, click a mode chip, and assert
  both were called once with the same flavour, `onSelectFlavour` first. Click
  the chip that is *already* `selectedFlavour` and assert `onHearMode` was
  called again while `onSelectFlavour` was too (AC2). Assert the attempt dots,
  the feedback line and the check control's label and disabled state are
  identical before and after three mode taps (AC3). Run it: fails with
  `AssertionError: expected "onHearMode" to be called 1 times, but got 0 times`.
- **Implement** — `GuessCard.tsx`: add `onHearMode` to the props type and call
  it inside the mode `ChipGroup`'s existing `disarming` handler, immediately
  after `onSelectFlavour(option)`. The comment mirrors the root row's: selection
  goes first because it is the half allowed to fail loudly, and the second call
  is deliberately unguarded so a re-tap sounds again.
- **Green when** — the three assertions pass and every existing `GuessCard` case
  still passes with a no-op `onHearMode` added to its props.
- **Refactor** — none.

#### Step G2 — The row wears the mark, and its names do not change

Covers: R23, R24, AC16

- **Test first** — `components/puzzle/GuessCard.test.tsx`: assert every chip in
  the `Mode` radiogroup has `chipAdornment(chip) === '♪'`, that the adornment
  element carries `aria-hidden="true"`, and that every chip's accessible name is
  its label alone — `getByRole('button', { name: 'Lydian' })` resolves. Assert
  the same holds while the card is `solved` and while it is `revealed`. Run it:
  fails with `AssertionError: expected null to be '♪'`.
- **Implement** — `adornment="♪"` on the mode `ChipGroup`, outside the `over`
  lock exactly as the root row's is. The comment says the glyph's meaning is
  decided here and not in the primitive, and names the Epic 2 seam: this
  attribute is what Epic 2 later routes through its own condition.
- **Green when** — the assertions pass.
- **Refactor** — none.

### Track H — The page wires it

#### Step H1 — The page holds a lick voice beside the reference one

Covers: R1, R7, R32

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`: render the
  composed puzzle, click a mode chip, and assert a source node was created and
  started on the fake context. Run it: fails with
  `AssertionError: expected [] to have a length of at least 1`.
- **Implement** — `GroovePuzzle.tsx`: import `PITCHES` beside `NOTES`,
  `REFERENCE_LEVEL` and `REFERENCE_FADE_SECONDS` from `../lib/audio/level`, and
  `referenceOutput` from `../lib/audio/output` — the only lines in this epic
  that name Epic 3's modules. The clock is **not** imported: it arrives as
  `clock` from the `useTransport(source, groove.bpm)` call Epic 3's Track E
  already left in this file. Build
  `const { playMode, warm: warmLicks } = useModeLick({ pitches: PITCHES, root:
  answer.root, bpm: groove.bpm, clock, level: REFERENCE_LEVEL, fadeSeconds:
  REFERENCE_FADE_SECONDS, output: referenceOutput() })`, placed directly after
  the `useReferenceNote` call so the two voices are built together and both
  after the transport. Nothing computes an elapsed time here: the clock reads
  `getStartTime()` for itself.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step H2 — Simple mode's two chips sound two real modes

Covers: R15, R16, R17, R18, AC11, AC12, AC13

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`: with simple mode
  enabled through the real `PreferenceStore` (the harness's
  `enableSimpleMode`) and a Major-family day, tap `Major` and assert the phrase
  scheduled matches `scheduleLick({ flavour: <the day's mode>, root, bpm })`;
  tap `Minor` and assert the phrase matches `scheduleLick({ flavour:
  simpleLickMode({ family: 'Minor', … }), … })`, that the flavour it resolves to
  is a Minor mode, and that it is not the day's. Re-render the page and assert
  the `Minor` chip schedules the same phrase (AC12). Assert no mode name appears
  anywhere in the card's text (AC13) — `expect(guessCard).not.toHaveTextContent`
  over `flavourPool(GROOVES)`. Run it: fails with
  `AssertionError: expected [] to deeply equal [ { midi: 62, … } ]`.
- **Implement** — `GroovePuzzle.tsx`: a `handleHearMode` that maps the chip's
  label through `simpleLickMode` when `simple` is on and passes it straight
  through when it is off, then calls `playMode`. The chip labels stay `Major`
  and `Minor`; nothing renders the resolved mode.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step H3 — The lick lands on the beat, over an untouched groove

Covers: R9, R10, R11, R12, AC7, AC8, AC9

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`, four cases:
  press play, `advance` the fake clock to a point between beats, tap a mode, and
  assert the first `start` argument equals `startedAt + n × beatSeconds(GROOVE.bpm)`
  for the first whole `n` past `fake.currentTime`, and is strictly greater than
  `fake.currentTime` (AC8) — derived from the emission clock the transport now
  exposes, not from `position`; assert `isPlaying` is still true, the
  transport's node was not stopped, and `loopFraction()` is unchanged across the
  tap (AC7, R9); tap a mode with the loop stopped and assert the first `start`
  is exactly `fake.currentTime` (AC9); and stop the groove immediately after a
  tap and assert none of the lick's nodes had `stop()` called (R10). Run it:
  fails with `AssertionError: expected 0 to be 4.5`.
- **Implement** — nothing beyond H1. Epic 3's `GrooveClock` supplies the time
  and this epic's voice asks it; if a case fails here, the fault is in one of
  those two and not in a third place to fix it.
- **Green when** — all four cases pass.
- **Refactor** — none.

#### Step H4 — The two rows are one instrument

Covers: R8, R8a, AC6, AC6a, AC6b

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`, with
  `resetReferenceOutput()` in the teardown: tap `Lydian` then `Phrygian` and
  assert every node of the first phrase was stopped and the second's were not
  (AC6); tap a root, then a mode, and assert the root's node was faded and
  stopped (AC6a); tap a mode, then a root, and assert every node of the phrase —
  including those scheduled for a future beat — was stopped (AC6b). In each
  case assert `referenceOutput().isClaimed()` is true and that exactly one
  claim is held. Run it: fails with
  `AssertionError: expected "stop" to be called at least once`.
- **Implement** — nothing in this epic. AC6 is Track E's `output.claim`; AC6a
  and AC6b hold because Epic 3's reference voice claims and releases the same
  `referenceOutput()` singleton. This step is the proof that both halves are
  wired to one owner, and it is why the claim model is Epic 3's to define rather
  than something each voice invents.
- **Green when** — all three cases pass. Epic 3's Track D and Track E must both
  have landed; per *The wiring order*, they have.
- **Refactor** — none.

#### Step H5 — The caption says both rows sound

Covers: R25

- **Test first** — `testing/puzzleHarness.tsx`: change `CAPTION` to
  `'Find the note that feels like home — Play along with your instrument, or
  tap a root or a mode to hear it.'`
  `components/GroovePuzzle.sounding.test.tsx`: the three existing cases
  (`play.nextElementSibling` has the caption, the caption renders, the caption's
  placement under the control) keep their subjects and now assert the new
  wording; add one asserting the caption's rendered text contains no name from
  `flavourPool(GROOVES)` and is a single sentence — no `\n`, and one `—`. Run
  it: fails with `Unable to find an element with the text: Find the note that
  feels like home — Play along with your instrument, or tap a root or a mode to
  hear it.`
- **Implement** — `GroovePuzzle.tsx`: the caption's copy. It stays one `Text`,
  one tone, one size, in the same place.
- **Green when** — the four cases pass, and `GroovePuzzle.page.test.tsx`'s
  caption snapshot line passes unchanged because it reads `CAPTION`.
- **Refactor** — none.

#### Step H6 — A dead day stays silent, and a dead browser stays quiet

Covers: R19, R20, R21, R22, AC14, AC15

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`: solve the day,
  then tap a mode chip and assert no node was created and the selected flavour
  did not change (AC15); repeat for a revealed day. With
  `vi.stubGlobal('AudioContext', undefined)`, tap a mode and assert the chip
  becomes selected, no node exists, `screen.queryByRole('alert')` is null and
  `console.error` was not called (AC14, R21). Run it: fails with
  `AssertionError: expected 1 to be 0`.
- **Implement** — nothing: the chips are already `disabled` when `over`, and
  every failure path is swallowed. If either assertion fails, the fix is in the
  handler, not in a new guard.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step H7 — Warming waits for the groove

Covers: R33, R34

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`: render, and
  before any play press assert `fake.fetchCalls === 0`; press play, settle, and
  assert the fetch count reaches 36 (twelve notes plus twenty-four pitches)
  only after the groove's own fetch resolved. Then, on a fresh render with no
  play press at all, tap a mode and assert it still sounds (AC20). Run it: fails
  with `AssertionError: expected 13 to be 36`.
- **Implement** — `GroovePuzzle.tsx`: call `warmLicks()` inside the existing
  `warmed` effect, after `warm()`. Same gate, same ref, no second effect.
- **Green when** — both assertions pass.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Render and commit the twenty-four

Covers: R26, R27, R28, R29, R30, AC17, AC18

Needs Track A and Track B.

- Run `npm run notes`. It re-renders all twenty-four, rewrites
  `src/features/daily-groove/data/notes.generated.ts` and merges twenty-four
  entries into `scripts/grooves/grooves.lock.json`.
- **The R27 check, and it is a `git` command, not an assertion.**
  `git status --porcelain public/notes` must list exactly twelve untracked
  additions — `note-c-5.mp3` … `note-b-5.mp3` — and no modified file. If any of
  the twelve existing mp3s shows as modified, stop: the render is not
  reproducible and nothing below is trustworthy.
- **The lock check.** `git diff scripts/grooves/grooves.lock.json` must show the
  twelve base-octave entries with their `sha256` and `bytes` unchanged and only
  their `id` gaining the `4`, plus twelve additions. `catalogueSha256`,
  `manifestSha256` and `grooves` must be untouched.
- Run `npm run notes` a second time into a scratch tree and diff the outputs
  against the committed ones: byte-identical (AC18). The `run twice` suite in
  `notes-cli.test.ts` covers this automatically where ffmpeg is present.
- Run `npm run grooves:verify`: it must report `30 grooves, 24 notes, the
  manifests and the catalogue all match the lock.` Then delete
  `public/notes/note-c-5.mp3` and run it again: exit 1 with a `[missing]`
  failure naming the file. Restore it. Change one character of a comment in
  `notes.generated.ts` and run it again: exit 1 with `[notes-manifest-stale]`.
  Restore it (AC19).
- `npm run test:all` green.

#### Step I2 — The demo path

Covers: R1, R2, R3, R6, R9, R11, R12, R15, R16, R23, R25

The PRD's and the roadmap's own walk-through, by hand:

1. Load cold. Before touching anything, the mode chips carry the `♪` and the
   caption under the play control says both rows sound.
2. Tap `Lydian` before pressing play. A phrase sounds immediately.
3. Press play. Tap along the full mode row — four modes in a row read as four
   colours over one loop, each landing on a beat rather than under your thumb.
4. The attempt dots, the feedback line and the `Check` control are unchanged
   throughout, and the progress bar never jumps.
5. Switch to simple mode. `Major` and `Minor` sound two different things, one of
   which fits the loop. Reload twice: the same two, both days' worth of taps.
6. In a browser with Web Audio disabled, tap a mode: it selects, nothing sounds,
   no banner appears and the console is clean.

#### Step I3 — The listen

Covers: R5, R5a, R5b, R6, R7, R13

The step the tests cannot do, and the one the epic is judged on.

- Play the twelve licks back to back from one root. Twelve different things
  should be audible to someone who cannot name one of them. **Ionian against
  Lydian, Aeolian against Dorian, and Aeolian against Phrygian** are the three
  pairs to check by name: if a pair is indistinguishable, the phrase is wrong.
- Disregard the rhythms — hum the pitches alone — and check the twelve are still
  tellable apart (R5b). A pair that separates only by rhythm fails.
- Tap a mode over the catalogue's slowest groove (67 bpm) and its fastest
  (130 bpm). The phrase must sit in the pulse in both, not merely start near a
  beat and drift.
- Run a finger fast down the row: phrases replace, never layer, and nothing
  queues up to fire after the finger has stopped.
- Check no mode reads as louder or duller than its neighbour (R7).
- On a phone speaker as well as headphones — the persona is on a phone before
  dinner.

Fixing what this finds means editing `LICKS`, and nothing else. That is what
declaring a lick as data buys.

#### Step I0 — The wiring order, before Track H opens a file

Not a code step. Three epics own `components/GroovePuzzle.tsx` and
`components/GroovePuzzle.sounding.test.tsx`; two of them also own
`testing/puzzleHarness.tsx`; and `components/puzzle/GuessCard.tsx` is opened by
this epic and by two of Epic 2's tracks. None of those pairs may run at the same
time. The order:

| # | Track | What it leaves behind |
| :-- | :-- | :-- |
| 1 | **Epic 3, Track E** | `useTransport(source, groove.bpm)` returning `clock`; `useReferenceNote(NOTES, { clock })` built after it |
| 2 | **Epic 1, Track H** (this) | `useModeLick(...)` beside it, `onHearMode` on the card, the two-row caption |
| 3 | **Epic 2, Track E** | `useTapSounds`, and both handlers, both warms and the caption routed through the gate |

And for `GuessCard.tsx`: **Epic 1's Track G before Epic 2's Track D**, so D
routes the mode row's `adornment` through `tapSounds` in the same pass it does
the root row's. Epic 2's Track C — the `Check` size — touches a different region
of the file and may go either side.

Before Track H starts, check the file: if `useTransport` still takes one
argument, step 1 has not landed and Track H waits. It does not add the parameter
itself — that is Epic 3's line, and adding it twice is a conflict, not a
head start. If Epic 2's Track A has already landed, the harness's
`enableSimpleMode` reads `.update({ simpleMode: true })` rather than `.set(…)`,
which is what Step H2 should call.

#### Step I4 — The suite

- `npm run test:all` green, including `structure.test.ts` (three modules added
  to the existing `audio/`, `data/` and `theory/` folders; no new folder),
  `boundary.test.ts`, `route-boundary.test.ts`, `lock.test.ts`'s source-reading
  cases and Epic 3's Step B2 structural test over `lib/audio/` — which
  `lib/audio/lick.ts` passes only because it declares no level or fade of its
  own.
- `npm run lint` clean — the five import zones bind these new test files exactly
  as they bind source.
- `npm run build` green, which runs `grooves:verify` through `prebuild`.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, C4, E1, F2, G1, H1, I2 |
| R2 | G1, I2 |
| R3 | G1, I2 |
| R4 | C3, F2 |
| R5 | C2, C3, E2, I3 |
| R5a | C3, I3 |
| R5b | C3, I3 |
| R6 | C2, C3, I2, I3 |
| R7 | A3, E2, H1, I3 |
| R8 | E4, H4 |
| R8a | E4, H4 |
| R9 | E7, H3, I2 |
| R10 | E7, H3 |
| R11 | E3, F3, H3, I2 |
| R12 | E1, E3, F3, H3, I2 |
| R13 | C1, C4, F2, I3 |
| R14 | E3, E7, F3 |
| R15 | D2, H2, I2 |
| R16 | D1, D3, H2, I2 |
| R17 | D3, H2 |
| R18 | H2 |
| R19 | C3, F4, H6 |
| R20 | C3, E6, F4, H6 |
| R21 | E6, H6 |
| R22 | H6 |
| R23 | G2, I2 |
| R24 | G2 |
| R25 | H5, I2 |
| R26 | A1, A2, A3, A5, A6, I1 |
| R27 | A1, A2, I1 |
| R28 | A3, A5, I1 |
| R29 | A4, A5, A6, I1 |
| R30 | A5, B1, B3, I1 |
| R31 | B2, B3, I1 |
| R32 | E1, E5, F1, H1 |
| R33 | E5, F5, H7 |
| R34 | F5, H7 |
| AC1 | G1 |
| AC2 | G1 |
| AC3 | G1 |
| AC4 | C3, F2 |
| AC5 | C4 |
| AC6 | E4, H4 |
| AC6a | H4 |
| AC6b | H4 |
| AC6c | C3 |
| AC7 | H3 |
| AC8 | E3, H3 |
| AC9 | E3, H3 |
| AC10 | C4 |
| AC11 | D2, D3, H2 |
| AC12 | D3, H2 |
| AC13 | H2 |
| AC14 | E6, F4, H6 |
| AC15 | H6 |
| AC16 | G2 |
| AC17 | A2, A4, A6, I1 |
| AC18 | A5, I1 |
| AC19 | B3, I1 |
| AC20 | E5, H7 |

## Assumptions

- **No scheduling lead.** A stopped groove schedules the phrase's origin at
  `ctx.currentTime` exactly. Web Audio fires a `start(when)` at or fractionally
  before the current time immediately, and every later note of the phrase is
  already in the future, so the offset arithmetic survives. An earlier draft
  added a 20 ms lead; it bought nothing and was a constant to explain.
- **Epic 3's `REFERENCE_FADE_SECONDS` is also the per-note tail.** The PRD asks
  for per-note envelopes so eight notes read as a line rather than eight
  two-second samples piling up, and Epic 3 already declares a fade for a sound
  being cut short. Reusing it keeps one number for one behaviour, and Epic 3's
  Step B2 fails on a second. If Step I3 finds the phrases still cluster, the
  honest fix is to raise Epic 3's number and re-listen to the root row with it,
  not to grow a lick-only constant here.
- **The two voices each decode their own copy of the base octave.** The root row
  fetches twelve URLs into `reference.ts`'s cache and the lick voice fetches
  twenty-four into its own, so twelve URLs are decoded twice. The browser's HTTP
  cache covers the network; the duplicate decode is a few milliseconds once per
  session. Sharing one cache means editing `reference.ts`, which is Epic 3's,
  and it is not worth a cross-epic seam.
- **The voice holds the clock; the hook and the page only pass it.** An earlier
  draft had the page compute elapsed seconds from the rendered `position` and
  the hook turn that into a beat time. Both halves are gone: Epic 3's
  `GrooveClock` reads `getStartTime()` directly, and the voice asks it after the
  fetch rather than before, so neither a stale render nor a slow decode can put
  the origin in the past.
- **A lick's degrees may not span more than an octave.** Not a musical
  principle — a consequence of the render being two octaves and the root sitting
  in the lower one. It is asserted in Step C4, so a phrase that wants more range
  fails a test rather than fetching a file that does not exist.
- **`lickFor` returns `null` where `familyOf` throws.** The two are reached
  differently: a mode with no family makes the day unwinnable and must fail
  loudly, while a mode with no lick costs a sound the player never knew was
  coming. Silence is the failure mode for everything audio in this feature.
- **The base octave's bare file names are permanent.** Once this epic ships,
  `note-c.mp3` means C4 and `note-c-5.mp3` means C5 forever. A third octave
  would take `-3` or `-6` and the carve-out stays exactly one branch.

## Decision log

### Cycle 1 — 2026-09-02

**Q1. How do twenty-four notes reach the app without re-keying the root row?**
Decision: **A second export, `PITCHES`, beside an unchanged `NOTES`** —
`lib/audio/reference.ts` keys its buffer map by `Root`, and it is Epic 3's file,
which this epic may not edit. Twenty-four entries in `NOTES` would silently
transpose feature-10's row an octave up.
Changed: Contracts (the manifest), Track A Steps A4 and A6.

**Q2. Do the twelve committed note files keep their names?**
Decision: **Yes — the base octave stays bare and the new octave takes a
suffix.** R27 and AC17 are about the files that exist today, and keeping the
names makes them verifiable with `git status` rather than with a rename
comparison. The cost is one branch in each of the two places the slug rule is
written.
Changed: Architecture, Contracts (`noteFileName`, `noteFile`), Steps A1, B1, I1.

**Q3. How does this epic take Epic 3's three contracts without waiting for it?**
Decision: **Inject them, and type them structurally.** The beat grid, the level
and the output owner are values passed into `useModeLick` and `createLickVoice`;
`ReferenceOutput` is declared in `lib/audio/lick.ts` rather than imported.
Exactly one file — `GroovePuzzle.tsx`, in Wave 3 — names Epic 3's modules, so
seven of the eight tracks ship whether or not Epic 3 has landed.
Changed: Contracts (*What Epic 3 owes*), Tracks E and F, Execution waves,
Step H1.

### Cycle 2 — 2026-09-02

Epic 3's spec landed and froze the three contracts differently from the shapes
guessed in Cycle 1. Epic 3 owns them, so this spec moved to them. Four
corrections, all mechanical except the second.

**Q4. The level.**
Correction: **`REFERENCE_LEVEL` and `REFERENCE_FADE_SECONDS`, both from
`lib/audio/level.ts`** — not a single `REFERENCE_GAIN`. The fade is what a note's
tail and a cancel both ramp over, so this epic's `NOTE_RELEASE_SECONDS` is
deleted rather than renamed: Epic 3's Step B2 reads every file under
`lib/audio/` and fails on a second gain constant, and it is right to.
Changed: Contracts (the voice, the hook, *What Epic 3 owes*), Steps E1, E2, F1,
H1, Assumptions.

**Q5. The beat grid — the substantive one.**
Correction: **a `GrooveClock` from `createGrooveClock(source, bpm)`, taken by
the voice**, not a free `nextBeatAt(elapsed, bpm, now)` fed by the page. Two
things follow, and both are improvements this spec did not see:
- Epic 3's clock is built on a new read-only `getStartTime()` — the graph's
  **emission** clock — rather than on the latency-corrected `getElapsed()` the
  progress bar reads. Cycle 1 planned to derive elapsed seconds from the
  rendered `position`, which is that same corrected timeline: every note would
  have landed one output latency late, 10–40 ms wired and 150–300 ms over
  Bluetooth. The staleness assumption recorded in Cycle 1 was answering the
  wrong question — the error was not the frame, it was the timeline.
- The clock is asked *after* the buffers land, inside the voice, not before the
  await in the hook. A phrase whose first fetch takes 200 ms would otherwise be
  scheduled against a beat 200 ms in the past.

`elapsedSeconds` and `nextBeatAt` are gone from `useModeLick`'s input; `clock`
replaces both, and `play` loses its `startAt` argument.
Changed: Architecture (*App side*), Contracts (the voice, the hook, *What Epic 3
owes*), Steps E1, E3, F1, F2, F3, H1, H3, Assumptions.

**Q6. The output owner.**
Correction: **the claim model** — `referenceOutput().claim(cancel)` returning an
`OutputClaim` with `isHeld()` and `release()`, from `lib/audio/output.ts` — not
`take`/`release` on a bare object. The claim is taken once the buffers are in
hand and before the first `start`; `cancel` fades a sounding note and stops a
scheduled one; every node creation is guarded by `claim.isHeld()`, so a claim
lost mid-phrase stops the rest being scheduled rather than being unpicked
afterwards; the last `onended` releases. `resetReferenceOutput()` is the
teardown.
Changed: Architecture (*One sound at a time*), Contracts (the voice), Steps E4,
E6, H4.

**Q7. Two files this epic must not touch, and one order it must keep.**
Correction: `testing/fakeAudioContext.ts` is Epic 3's Track D — this epic
consumes `createGain`, `FakeGainNode`, `FakeAudioParam` and `gains` and adds
nothing, which makes Step E2 the one step in Wave 1 gated on Epic 3. And the
three page-wiring tracks across the three epics own the same files, so they run
Epic 3's Track E → this epic's Track H → Epic 2's Track E, with Track G before
Epic 2's Track D on `GuessCard.tsx`.
Changed: Track E, Track H, Execution waves (*The wiring order*), new Step I0,
Step E2, Step I4.

The spec is ready to implement: no architectural decision left open.
