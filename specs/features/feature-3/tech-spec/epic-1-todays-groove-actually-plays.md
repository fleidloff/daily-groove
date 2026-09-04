# Tech spec — Epic 1: Today's groove actually plays

PRD: [../prd/epic-1-todays-groove-actually-plays.md](../prd/epic-1-todays-groove-actually-plays.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Build `scripts/grooves/` as a four-stage offline pipeline behind one frozen
`types.ts`: **events** (a feel template plus a seed become note events and the words
that describe them), **voices** (events plus a sample pack become per-track PCM),
**mix** (tracks become one stereo buffer), **encode** (buffer becomes an mp3 via
ffmpeg). Because the stage boundaries are frozen types rather than implementations,
the musical half and the audio half are written in parallel by different people, and
Epic 2 later replaces a stage's innards without touching its neighbours.

The sample pack is reached only through a `SamplePack` interface described by a JSON
declaration, which is what lets the audio work proceed against a synthesized
placeholder while the real CC0 pack is being sourced — and what lets the pack declare
velocity layers and round-robins that Epic 1 deliberately ignores.

## Architecture

```
scripts/grooves/
├── types.ts            frozen contracts for all four epics
├── rng.ts              seeded PRNG + string hash
├── theory/
│   ├── notes.ts        note names ↔ MIDI
│   ├── scales.ts       flavour → interval set, degree lookup
│   └── harmony.ts      scale → chord + progression, and their display strings
├── templates/
│   ├── index.ts        template registry by id
│   └── straight-funk.ts   Epic 1's single template
├── events.ts           buildEvents(spec, template) → { events, music }
├── pcmio.ts            interleave/deinterleave raw f32 ↔ Pcm
├── decode.ts           decodeAudioFile(path) → Pcm, via ffmpeg
├── pack.ts             loadPack(dir) → SamplePack, decoding each file once
├── voices.ts           renderVoices(events, pack, sampleRate) → Track[]
├── mix.ts              mixTracks(tracks, template) → Pcm
├── encode.ts           encodeMp3(pcm, outPath) via ffmpeg
├── name.ts             nameFor(seed) → string
├── words.ts            the curated word list
├── manifest.ts         writeManifest(entries) → grooves.generated.ts
├── catalogue.ts        reads/writes catalogue.json
├── catalogue.json      the committed list of { id, template, seed }
├── cli.ts              `npm run grooves`
├── samples/            the real CC0 pack + pack.json + provenance.json
└── testing/
    └── placeholderPack.ts   synthesized pack, built in-memory by tests
```

**Everything is pure except three modules.** `decode.ts`, `pack.ts` and `encode.ts`
touch the filesystem or spawn ffmpeg; `cli.ts` orchestrates. Every other module is a pure
function of its inputs, which is what makes determinism testable without rendering
audio.

**Determinism** comes from one place: `rng.ts` exposes `mulberry32(hash(seedString))`,
and every stage that makes a choice draws from a generator seeded by the groove's seed
plus a stage label. No `Math.random` and no `Date.now` anywhere in the **render path** —
a `GrooveSpec` in, identical PCM out, always. Epic 4's minting command is the single
deliberate exception: it draws its *starting* seed from the clock, records the seed it
chose in `catalogue.json`, and from that moment the groove renders deterministically
like every other. Discovery is non-reproducible; rendering never is.

**ffmpeg is the codec at both ends.** Samples are decoded by piping them through
ffmpeg to raw `f32le`, and the master is encoded by piping raw `f32le` back in. Nothing
in the repository parses or writes a container format, and the pack is free to hold WAV,
FLAC or anything else ffmpeg reads — which widens what can be sourced. The cost is a
subprocess per sample file, paid once: `loadPack` decodes every file on load and holds
the buffers, and the placeholder pack is synthesized in memory, so the render and test
paths never spawn ffmpeg per note.

**PCM representation** is stereo from the start — `{ sampleRate, left, right }` — even
though Epic 1 renders everything centred. Epic 2 needs per-track panning, and widening
a mono buffer later would change every stage signature.

**The generated module is the app's only groove source.** `grooves.generated.ts` is
committed and imported directly by the feature; `seed.ts` keeps only its distractor
pools until Epic 3 deletes it.

## Contracts

Frozen in Step 0c, before any track starts. Epics 2–4 build against these.

```ts
// scripts/grooves/types.ts

export type Flavour =
  | 'major' | 'minor' | 'dorian' | 'mixolydian'
  | 'lydian' | 'phrygian' | 'harmonic-minor' | 'blues'

export type Root =
  | 'C' | 'C#' | 'D' | 'Eb' | 'E' | 'F'
  | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B'

export type VoiceName =
  | 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'rim' | 'bass' | 'comp'

/** Stereo float PCM. Epic 1 renders centred; Epic 2 pans. */
export type Pcm = {
  sampleRate: number
  left: Float32Array
  right: Float32Array
}

export type FeelTemplate = {
  id: string
  tempoRange: [number, number]
  subdivision: 4 | 8 | 16
  swing: number                              // 0 = straight, 0.5 = triplet shuffle
  flavours: Flavour[]                        // Epic 3 gives each template exactly two
  voices: VoiceName[]
  humanize: { timingMs: number; velocity: number }   // bounds; Epic 2 applies them
  gain: Partial<Record<VoiceName, number>>   // per-voice mix level in dBFS
}

/** A groove is fully identified by these two values. */
export type GrooveSpec = {
  id: string
  template: string
  seed: number
}

export type NoteEvent = {
  voice: VoiceName
  timeSec: number
  durationSec: number
  velocity: number       // 0..1
  midi?: number          // pitched voices only
}

/** The words that describe what the events play. */
export type MusicMeta = {
  bpm: number
  bars: number
  root: Root
  flavour: Flavour
  scale: string          // "C minor"
  chord: string          // "Cm7"
  progression: string    // "Cm–Fm–G7"
}

export type PackSample = { pcm: Pcm; rootMidi?: number }

export type SamplePack = {
  id: string
  /** Round-robin `index` and `velocity` are honoured by Epic 2; Epic 1 passes 0 and 1. */
  get(voice: VoiceName, opts: { velocity: number; index: number; midi?: number }): PackSample | null
  /** Declared shape, so tests can assert the pack is stocked for Epic 2. */
  describe(): PackDeclaration
}

export type VelocityLayer = { maxVelocity: number; files: string[] }   // files = round-robins

export type PackDeclaration = {
  id: string
  sampleRate: number
  voices: Partial<Record<VoiceName, {
    layers?: VelocityLayer[]                              // percussive: layers of alternates
    notes?: { midi: number; layers: VelocityLayer[] }[]   // pitched: sampled notes, each layered
  }>>
}

export type Track = { voice: VoiceName; pcm: Pcm }
```

`midi` on a sampled note is its **sounding** pitch, which is not always what the source
file is named — see `scripts/grooves/samples/README.md`.

**Stage signatures — the four pipeline seams.**

```ts
// events.ts
export function buildEvents(spec: GrooveSpec, template: FeelTemplate): { events: NoteEvent[]; music: MusicMeta }

// voices.ts
export function renderVoices(events: NoteEvent[], pack: SamplePack, sampleRate: number): Track[]

// mix.ts
export function mixTracks(tracks: Track[], template: FeelTemplate): Pcm

// encode.ts
export function encodeMp3(pcm: Pcm, outPath: string): Promise<void>
```

**Audio I/O — ffmpeg on both sides.**

```ts
// pcmio.ts   — pure, no subprocess
export function interleave(pcm: Pcm): Float32Array
export function deinterleave(raw: Float32Array, sampleRate: number): Pcm

// decode.ts
export function decodeAudioFile(path: string, sampleRate?: number): Promise<Pcm>
```

**Generated module.** `src/features/daily-groove/lib/grooves.generated.ts`:

```ts
import type { Groove } from '../types'
export const GROOVES: Groove[] = [ /* generated — do not edit */ ]
```

**The widened `Groove`.** `src/features/daily-groove/types.ts`. feature-2 has already
added `name` and `bpm` in the working tree, so this epic adds only the three fields
that are still missing — and uses feature-2's `bpm` rather than introducing a competing
`tempo`:

```ts
export type Groove = {
  id: string
  audioSrc: string
  name: string        // added by feature-2 — "Velvet Pocket"
  bpm: number         // added by feature-2 — display only
  scale: string
  chord: string
  progression: string
  root: string        // added here — "C" … "B"
  flavour: string     // added here — "minor" | "dorian" | …
  bars: number        // added here — 4
}
```

**Catalogue.** `scripts/grooves/catalogue.json` — `GrooveSpec[]`, committed, the input
to every render. Epic 4 appends to it.

## Tracks

### Track A — Music: theory, templates, events

- **Goal** — `buildEvents` turns a spec and a template into note events plus the
  `MusicMeta` that describes them, deterministically.
- **Owns** — `scripts/grooves/rng.ts`, `theory/**`, `templates/**`, `events.ts`
- **Depends on** — the `types.ts` contract only.
- **Parallel with** — Tracks B, C, D
- **Done when** — its tests pass with no audio rendered anywhere.

### Track B — Audio: wav, pack, voices, mix, encode

- **Goal** — events plus a pack become a stereo buffer, and that buffer becomes an mp3.
- **Owns** — `scripts/grooves/wav.ts`, `pack.ts`, `voices.ts`, `mix.ts`, `encode.ts`,
  `testing/placeholderPack.ts`
- **Depends on** — the `NoteEvent`, `SamplePack`, `Pcm`, `Track` contracts only. It
  never imports Track A; tests build event arrays by hand.
- **Parallel with** — Tracks A, C, D
- **Done when** — rendering hand-written events against the placeholder pack produces
  a correct-length, non-silent, non-clipping buffer and a playable mp3.

### Track C — Naming, manifest, and the app

- **Goal** — the generated module exists, is typed, and is the only thing the app reads
  grooves from.
- **Owns** — `scripts/grooves/name.ts`, `words.ts`, `manifest.ts`,
  `src/features/daily-groove/types.ts`, `src/features/daily-groove/lib/seed.ts`,
  and the feature's groove imports
- **Depends on** — the `Groove` and `MusicMeta` contracts only. It writes the manifest
  from hand-written entries in its tests.
- **Parallel with** — Tracks A, B, D
- **Done when** — the app compiles and runs against a generated module, and no import
  of the hand-written `GROOVES` remains.

### Track D — The sample pack

- **Goal** — a real CC0 pack, stocked for Epic 2, with provenance that a test verifies.
- **Owns** — `scripts/grooves/samples/**` (audio, `pack.json`, `provenance.json`) and
  its own validation test
- **Depends on** — the `PackDeclaration` contract only.
- **Parallel with** — Tracks A, B, C
- **Done when** — every file is CC0 with a recorded source, each drum voice has
  multiple velocity layers, and the repeating voices have round-robin alternates.

**This is the track with a human in it.** It is the epic's long pole and does not
block any other track, so start it on day one.

## Execution waves

- **Wave 0:** Step 0a–0c — test runner, run command, frozen contracts.
- **Wave 1 (parallel):** Track A, Track B, Track C, Track D
- **Wave 2:** Integration — `catalogue.json`, `cli.ts`, the real render, the committed
  artifacts, and the manual demo.

## Implementation

### Wave 0 — Bootstrap

#### Step 0a — Generator tests run in a node environment

Covers: R19, AC12

- **Test first** — `scripts/grooves/rng.test.ts`: `expect(typeof process.versions.node).toBe('string')`
  and `expect(typeof window).toBe('undefined')`. Run it: vitest reports no test files
  matched, because `include` is `src/**` only.
- **Implement** — `vitest.config.ts`: replace the single `test` block with two projects
  — `app` (`include: ['src/**/*.{test,spec}.{ts,tsx}']`, `environment: 'jsdom'`,
  `setupFiles: ['./vitest.setup.ts']`) and `generator`
  (`include: ['scripts/**/*.test.ts']`, `environment: 'node'`, no setup file).
- **Green when** — the new test runs and passes under the node project, and every
  existing `src/**` test still passes.
- **Refactor** — none.

#### Step 0b — `npm run grooves` exists and fails loudly

Covers: R1

- **Test first** — none; this is a script entry.
- **Implement** — `package.json`: `"grooves": "node scripts/grooves/cli.ts"`.
  `scripts/grooves/cli.ts`: `throw new Error('not implemented')`.
- **Green when** — `npm run grooves` exits non-zero with that message, proving the TS
  entry point executes under Node's type stripping.
- **Refactor** — none.

#### Step 0c — Freeze the contracts

Covers: R5, R6, R7, R8, R9

- **Test first** — `scripts/grooves/types.test.ts`: a compile-only test that constructs
  one value of each exported type and asserts the object is defined. Run it: fails to
  resolve `./types`.
- **Implement** — `scripts/grooves/types.ts` exactly as in **Contracts** above, and
  widen `src/features/daily-groove/types.ts`'s `Groove` with `root`, `flavour` and
  `bars`. `name` and `bpm` are already there from feature-2 — reuse them rather than
  adding a parallel `tempo`.
- **Green when** — the test passes and `npx tsc --noEmit` is clean. The existing
  hand-written `GROOVES` will now fail type-checking for the three new fields; fill them
  with placeholder values in this step and delete the file's use in Step C4.
- **Refactor** — none. Nothing below may change these types.

### Track A — Music: theory, templates, events

#### Step A1 — The same seed always gives the same numbers

Covers: R3

- **Test first** — `scripts/grooves/rng.test.ts`: `rngFor('groove-01:events')` drawn
  ten times equals a second generator built from the same string; a different string
  differs. Run it: fails with "rngFor is not a function".
- **Implement** — `scripts/grooves/rng.ts`: `hashString(s): number` (FNV-1a, matching
  `src/features/daily-groove/lib/selectGroove.ts`) and
  `rngFor(label: string): () => number` (mulberry32 seeded by that hash), plus
  `pick<T>(rng, items): T` and `intBetween(rng, lo, hi): number`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A2 — A flavour names a set of intervals

Covers: R2

- **Test first** — `scripts/grooves/theory/scales.test.ts`: `intervalsFor('minor')`
  equals `[0,2,3,5,7,8,10]`; `intervalsFor('blues')` equals `[0,3,5,6,7,10]`;
  `scaleName('C','dorian')` equals `'C dorian'`. Run it: fails, module missing.
- **Implement** — `theory/scales.ts`: `INTERVALS: Record<Flavour, number[]>` for all
  eight flavours, `intervalsFor(flavour)`, `scaleName(root, flavour)`, and
  `pitchesOf(root, flavour): number[]` returning MIDI pitch classes.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A3 — Note names convert to MIDI and back

Covers: R2

- **Test first** — `scripts/grooves/theory/notes.test.ts`: `midiOf('C', 4)` is `60`;
  `noteName(60)` is `'C'`; every one of the twelve roots round-trips. Run it: fails,
  module missing.
- **Implement** — `theory/notes.ts`: `ROOTS: Root[]` (the twelve), `midiOf(root, octave)`,
  `noteName(midi): Root`.
- **Green when** — the round-trip holds for all twelve.
- **Refactor** — none.

#### Step A4 — A scale yields a chord and a progression

Covers: R2, R11

- **Test first** — `scripts/grooves/theory/harmony.test.ts`: for root `C`, flavour
  `minor`, `buildHarmony` returns a chord whose `midi` pitches are all members of
  `pitchesOf('C','minor')`, a `chordName` of `'Cm7'`, and a `progression` of three or
  four degrees each of whose chord tones are also in the scale. Run it: fails, module
  missing.
- **Implement** — `theory/harmony.ts`: `buildHarmony(root, flavour, rng)` returning
  `{ chordMidi: number[]; chordName: string; progressionDegrees: number[];
  progressionName: string; progressionMidi: number[][] }`, built by stacking thirds on
  scale degrees and naming the result from its interval structure.
- **Green when** — the assertions pass for `minor`; add `dorian` and `mixolydian` cases
  in the same test.
- **Refactor** — extract chord naming into `chordNameFor(intervals)` once three
  flavours share it.

#### Step A5 — A template describes one feel

Covers: R5

- **Test first** — `scripts/grooves/templates/index.test.ts`: `templateById('straight-funk')`
  returns a template whose `subdivision` is `16`, whose `tempoRange` is within
  90–110, and whose `voices` include `kick`, `snare`, `hatClosed`, `bass`, `comp`. Run
  it: fails, module missing.
- **Implement** — `templates/straight-funk.ts` and `templates/index.ts` with
  `templateById(id): FeelTemplate` throwing on an unknown id.
- **Green when** — the assertions pass.
- **Refactor** — none.

#### Step A6 — A spec becomes note events on the grid

Covers: R2, R7, R10, R12, AC2, AC4

- **Test first** — `scripts/grooves/events.test.ts`: `buildEvents({id:'g1',template:'straight-funk',seed:1}, t)`
  returns events whose `timeSec` values are all non-negative multiples of the
  subdivision within one microsecond; whose last event starts before 4 bars at the
  chosen tempo; whose velocities are all identical (this epic is flat); and which
  include at least one event for each of `kick`, `bass` and `comp`. Run it: fails,
  "buildEvents is not a function".
- **Implement** — `events.ts`: choose tempo, root and flavour from
  `rngFor(`${spec.id}:events`)`, call `buildHarmony`, lay a drum pattern on the
  template's grid, place bass notes on the progression roots and comp chords on the
  progression, and return the events with a `MusicMeta`.
- **Green when** — every assertion passes.
- **Refactor** — none.

#### Step A7 — The same spec builds the same events twice

Covers: R2, R3, AC2

- **Test first** — same file: `buildEvents(spec, t)` called twice deep-equals itself,
  and its `music` deep-equals itself; a spec with a different `seed` produces a
  different `music.scale` or a different event list. Run it: passes only if A6 drew
  everything from the seeded generator — if it used `Math.random` anywhere, this fails.
- **Implement** — fix any non-deterministic draw A6 introduced.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A8 — The events play the harmony the words claim

Covers: R11, AC6

- **Test first** — same file: for a built groove, every pitched event's `midi % 12` is
  a member of `pitchesOf(music.root, music.flavour)`, and the set of comp chord
  pitch-classes in bar 1 equals the pitch-classes named by `music.chord`. Run it: fails
  if A6 placed any pitch outside the scale.
- **Implement** — correct the placement in `events.ts`.
- **Green when** — both assertions pass.
- **Refactor** — extract `pitchClassesOf(chordName)` into `theory/harmony.ts` if the
  assertion needs it.

### Track B — Audio: wav, pack, voices, mix, encode

#### Step B1 — Raw f32 interleaves and deinterleaves losslessly

Covers: R7

- **Test first** — `scripts/grooves/pcmio.test.ts`: `deinterleave(interleave(pcm), 44100)`
  returns a buffer whose `sampleRate` matches and whose channel arrays are exactly equal
  to the original — no tolerance, because f32 round-trips exactly. Run it: fails, module
  missing.
- **Implement** — `pcmio.ts`: `interleave` writing `L,R,L,R…` into one `Float32Array`,
  and `deinterleave` splitting it back.
- **Green when** — both arrays are exactly equal.
- **Refactor** — none.

#### Step B1b — An audio file decodes through ffmpeg

Covers: R4, R7

- **Test first** — `scripts/grooves/decode.test.ts`: write a short WAV to a temp path
  using ffmpeg itself, then `decodeAudioFile(tmp)` returns a `Pcm` at 44100 whose
  duration matches within a millisecond and whose samples are not all zero; and
  `decodeAudioFile('/nope.wav')` rejects with a message containing ffmpeg's stderr. Run
  it: fails, "decodeAudioFile is not a function".
- **Implement** — `decode.ts`: spawn
  `ffmpeg -i <path> -f f32le -acodec pcm_f32le -ac 2 -ar <rate> pipe:1`, collect stdout,
  and hand the bytes to `deinterleave`. Reject on non-zero exit.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B2 — A placeholder pack satisfies the interface

Covers: R6, AC9

- **Test first** — `scripts/grooves/testing/placeholderPack.test.ts`:
  `placeholderPack().get('kick', { velocity: 1, index: 0 })` returns a `PackSample`
  whose `pcm` is non-silent, and `get('bass', { velocity: 1, index: 0, midi: 40 })`
  returns one with a `rootMidi`. Run it: fails, module missing.
- **Implement** — `testing/placeholderPack.ts`: synthesize each voice in memory — a
  short noise burst shaped by an envelope for drums, a decaying sine for pitched voices
  — and return a `SamplePack` closing over them. No files on disk, no binary fixtures.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B3 — A pack directory loads through the same interface

Covers: R6, R17

- **Test first** — `scripts/grooves/pack.test.ts`: given a temp directory holding a
  `pack.json` and one generated WAV per voice, `await loadPack(dir)` returns a
  `SamplePack` whose `get('kick', …)` is non-null and whose `describe()` equals the
  declaration; and calling `get` a hundred times spawns no further processes — assert by
  counting calls to an injected decoder. Run it: fails, "loadPack is not a function".
- **Implement** — `pack.ts`: read `pack.json`, `await decodeAudioFile` for each
  referenced file **once at load time**, hold the buffers, and implement `get`
  synchronously over them — pick the layer whose `maxVelocity` first covers the requested
  velocity, then `files[index % files.length]`; for pitched voices pick the nearest
  `notes[].midi`. Epic 1's callers pass `velocity: 1, index: 0`, so only the top layer
  and first alternate are exercised.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B4 — Events render to per-voice tracks of the right length

Covers: R7, R10, AC4, AC5

- **Test first** — `scripts/grooves/voices.test.ts`: rendering three hand-written
  events across `kick`, `bass` and `comp` against `placeholderPack()` at 44100 returns
  three `Track`s; each `pcm` has `left.length === right.length`; the buffer spans the
  requested duration; and each track has non-zero energy. Run it: fails,
  "renderVoices is not a function".
- **Implement** — `voices.ts`: allocate one stereo buffer per voice sized to the
  requested duration, and for each event fetch its sample, resample it when the event's
  `midi` differs from the sample's `rootMidi`, scale by velocity, and add it at the
  event's sample offset. Writes past the buffer end are clipped for now.
- **Green when** — all four assertions pass.
- **Refactor** — extract `addAt(target, source, offset, gain)`.

#### Step B5 — A pitched sample is transposed to the requested note

Covers: R3 (of the PRD's pitched-voice assumption), R10

- **Test first** — same file: rendering a `bass` event at `midi: 52` against a pack
  whose bass sample has `rootMidi: 40` produces a track whose dominant frequency is
  approximately one octave above the same event at `midi: 40`. Assert via zero-crossing
  rate rather than an FFT. Run it: fails while `renderVoices` ignores pitch.
- **Implement** — `voices.ts`: linear-interpolating resample at
  `2 ** ((midi - rootMidi) / 12)`.
- **Green when** — the ratio is within 10%.
- **Refactor** — extract `resample(pcm, ratio)`.

#### Step B6 — Tracks mix to one buffer that does not clip

Covers: R7, R10, AC5

- **Test first** — `scripts/grooves/mix.test.ts`: mixing three loud tracks returns one
  `Pcm` whose length is the longest input's and whose peak is at or below the ceiling;
  and per-voice `gain` from the template changes the result. Run it: fails,
  "mixTracks is not a function".
- **Implement** — `mix.ts`: sum tracks applying each voice's template gain, then scale
  the whole buffer so its true peak sits at the ceiling constant.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B7 — A buffer encodes to a playable mp3

Covers: R1, R4, R7

- **Test first** — `scripts/grooves/encode.test.ts`: `encodeMp3(pcm, tmp)` writes a
  file larger than 1 KB whose first bytes are an MPEG frame sync or an ID3 header, and
  a second call with an unwritable path rejects. Run it: fails,
  "encodeMp3 is not a function".
- **Implement** — `encode.ts`: `interleave(pcm)` into ffmpeg's stdin via
  `spawn('ffmpeg', ['-f','f32le','-ar',rate,'-ac','2','-i','pipe:0', …, outPath])`,
  rejecting on non-zero exit with ffmpeg's stderr in the message. No container is
  written by hand at either end.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B8 — Rendering the same events twice gives the same PCM

Covers: R3, AC3

- **Test first** — `scripts/grooves/voices.test.ts`: the same events rendered twice
  against the same pack produce byte-identical `Float32Array`s, and so does the mix.
  Run it: passes only if nothing in the audio path is time- or random-dependent.
- **Implement** — remove any such dependency.
- **Green when** — both comparisons are exact.
- **Refactor** — none.

### Track C — Naming, manifest, and the app

#### Step C1 — A seed produces a name that cannot leak the answer

Covers: R13, R14, AC8

- **Test first** — `scripts/grooves/name.test.ts`: `nameFor('groove-01')` is a
  two-word string, is stable across calls, differs from `nameFor('groove-02')`, and —
  across every word in `WORDS` — no word matches a note name (`C`, `C#`, `Db`, … as a
  whole word) or a flavour name. Run it: fails, module missing.
- **Implement** — `words.ts` with `ADJECTIVES` and `NOUNS`, and `name.ts` with
  `nameFor(seedLabel)` drawing one of each via `rngFor`.
- **Green when** — all four assertions pass. The vocabulary assertion is the one that
  keeps R14 true as the list grows.
- **Refactor** — none.

#### Step C2 — The manifest is written as a typed module

Covers: R8, AC7

- **Test first** — `scripts/grooves/manifest.test.ts`: `renderManifest([entry])`
  returns a string containing `import type { Groove }`, `export const GROOVES`, the
  entry's id, and a do-not-edit banner; and `writeManifest` writes it to the given
  path. Run it: fails, module missing.
- **Implement** — `manifest.ts`: `renderManifest(entries: Groove[]): string` and
  `writeManifest(entries, path)`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C3 — The generated module type-checks as `Groove[]`

Covers: R8, R9, AC7

- **Test first** — commit a one-entry `src/features/daily-groove/lib/grooves.generated.ts`
  by hand, and in `src/features/daily-groove/lib/grooves.generated.test.ts` assert
  every entry has all ten fields with the right primitive types, `bars === 4`,
  `bpm > 0`, `name` non-empty, and `audioSrc` starting with `/grooves/`. Run it: fails,
  module missing.
- **Implement** — write the module, all ten fields populated.
- **Green when** — the test passes and `npx tsc --noEmit` is clean.
- **Refactor** — none.

#### Step C4 — The app reads grooves only from the generated module

Covers: R15, AC14

- **Test first** — `src/features/daily-groove/lib/grooves.generated.test.ts`: assert
  that `readFileSync` over `src/features/daily-groove/**` finds no import of `GROOVES`
  from `./seed` or `../lib/seed`. Run it: fails, listing the current importer.
- **Implement** — repoint every `GROOVES` import at `./grooves.generated`, and reduce
  `seed.ts` to the three distractor pools with a comment noting Epic 3 retires it.
- **Green when** — the assertion passes and every existing feature test is green.
- **Refactor** — none.

#### Step C5 — Every date resolves to a groove whose file exists

Covers: R15, R16, AC10

- **Test first** — `src/features/daily-groove/lib/grooves.generated.test.ts`: for each
  of 366 consecutive dates, `selectGrooveForDate(date, GROOVES)` returns an entry whose
  `audioSrc` maps to a file under `public/` that exists and whose size is greater than
  zero. Run it: fails on the zero-byte placeholders.
- **Implement** — nothing yet; this test is the epic's tripwire and goes green in
  Step I3 when real audio is committed. Mark it as the integration gate.
- **Green when** — Step I3 lands. Until then it is the one expected-red test, and the
  spec says so rather than letting someone quietly skip it.
- **Refactor** — none.

### Track D — The sample pack

> **Track D is complete.** The pack is sourced, processed and committed at
> `scripts/grooves/samples/` — 83 files, 4.8 MB, all CC0 from VCSL, with `pack.json`,
> `provenance.json`, `LICENSE.txt` and a README. The steps below record what it had to
> satisfy; their tests still need writing once the generator exists.

#### Step D1 — The pack declares itself

Covers: R6, R17

- **Test first** — `scripts/grooves/samples/pack.test.ts`: `pack.json` parses as a
  `PackDeclaration`, and every file it names exists under `samples/`. Run it: fails,
  no `pack.json`.
- **Implement** — source the CC0 audio and write `samples/pack.json`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D2 — Every sample is CC0 and accounted for

Covers: R18, AC11

- **Test first** — same file: every `.wav` under `samples/` appears in
  `provenance.json`, every entry has a non-empty `source` and a `licence` in
  `['CC0','public-domain']`, and no entry names a file that is absent. Run it: fails,
  no `provenance.json`.
- **Implement** — write `samples/provenance.json`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step D3 — The pack is stocked for Epic 2

Covers: R21, AC15

- **Test first** — same file: every drum voice in the declaration has two or more
  `layers`, and `kick`, `snare` and `hatClosed` each have two or more `files` in their
  top layer. For `bass` and `comp`, assert the sampled `notes` are spaced closely enough
  that **no note in the voice's playable range is more than two semitones from a sampled
  one** — which a 4-semitone spacing satisfies, since the renderer picks the nearest.
  Run it: fails until the sourcing covers layers, alternates and a dense enough note map.
- **Implement** — extend the sourced pack until it does.
- **Green when** — all assertions pass. This is what stops Epic 2 needing a second
  sourcing round, and the note-spacing bound is what keeps linear resampling
  transparent, since the renderer never shifts a sample far.
- **Refactor** — none.

### Wave 2 — Integration

#### Step I1 — Epic 1's renderer ignores what it does not yet use

Covers: R6, R12, R21, AC16

- **Test first** — `scripts/grooves/voices.test.ts`: rendering against a pack declaring
  three velocity layers and three round-robin files per voice produces the same PCM as
  rendering against a pack declaring only the top layer's first file. Run it: fails if
  `renderVoices` reaches for anything but `index: 0` and the top layer.
- **Implement** — fix `renderVoices` to pass `velocity: 1, index: 0` in this epic.
- **Green when** — the two renders are identical, proving Epic 1 leaves the extra
  material for Epic 2 without ignoring the contract.
- **Refactor** — none.

#### Step I2 — The CLI renders the catalogue end to end

Covers: R1, R2, R4, AC1

- **Test first** — `scripts/grooves/cli.test.ts`: `generate({ catalogue, packDir,
  outDir, manifestPath })` — the CLI's exported function, with the placeholder pack
  injected — writes one mp3 per catalogue entry and a manifest whose entries match the
  specs. Run it: fails, "generate is not a function".
- **Implement** — `catalogue.ts` (`readCatalogue()`, `writeCatalogue()`),
  `catalogue.json` with a single entry `{ id: 'groove-01', template: 'straight-funk',
  seed: 1 }`, and `cli.ts` composing
  `buildEvents → renderVoices → mixTracks → encodeMp3` plus `nameFor` and
  `writeManifest`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step I3 — The committed groove comes from the real pack

Covers: R20, AC13

- **Test first** — `scripts/grooves/cli.test.ts`: the committed render configuration
  resolves `packDir` to `scripts/grooves/samples`, not to the placeholder. Run it:
  fails while the default is the placeholder.
- **Implement** — default `packDir` to `samples/`, run `npm run grooves` for real, and
  commit `public/grooves/groove-01.mp3` and the regenerated manifest. Delete
  `groove-02`…`groove-07.mp3` and the placeholder `README.md` story, replacing it with
  how the files are produced.
- **Green when** — the assertion passes **and Step C5 turns green**, since every date
  now resolves to a real file.
- **Refactor** — none.

#### Step I4 — Regeneration changes nothing

Covers: R3, AC3

- **Test first** — `scripts/grooves/cli.test.ts`: running `generate` twice into two
  temp directories produces identical manifests and identical *pre-encode* PCM. The
  mp3 bytes are deliberately not compared.
- **Implement** — expose the pre-encode buffer from `generate` for the assertion.
- **Green when** — both comparisons are exact.
- **Refactor** — none.

#### Step I5 — The demo path, by hand

Covers: R1, R15, R16, AC1

- Run `npm run grooves`, then `npm run dev`, open the app, press play. A 4-bar loop
  plays; no error banner appears. Guess, submit, and confirm the revealed scale, chord
  and progression are the harmony you just heard.
- Run `npm test`, `npm run lint` and `npx tsc --noEmit`. All green.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | 0b, B7, I2, I5 |
| R2 | A2, A3, A4, A6, A7, I2 |
| R3 | A1, A7, B8, I4 |
| R4 | B1b, B7, I2 |
| R5 | 0c, A5 |
| R6 | 0c, B2, B3, D1, I1 |
| R7 | 0c, A6, B1, B1b, B4, B6, B7 |
| R8 | 0c, C2, C3 |
| R9 | 0c, C3 |
| R10 | A6, B4, B5, B6 |
| R11 | A4, A8 |
| R12 | A6, I1 |
| R13 | C1 |
| R14 | C1 |
| R15 | C4, C5, I5 |
| R16 | C5, I5 |
| R17 | B3, D1 |
| R18 | D2 |
| R19 | 0a |
| R20 | I3 |
| R21 | D3, I1 |
| AC1 | I2, I5 |
| AC2 | A6, A7 |
| AC3 | B8, I4 |
| AC4 | A6, B4 |
| AC5 | B4, B6 |
| AC6 | A8 |
| AC7 | C2, C3 |
| AC8 | C1 |
| AC9 | B2 |
| AC10 | C5 |
| AC11 | D2 |
| AC12 | 0a |
| AC13 | I3 |
| AC14 | C4 |
| AC15 | D3 |
| AC16 | I1 |

## Assumptions

- The CLI runs as TypeScript directly under Node 26's type stripping, so no build step
  and no `tsx` dependency. This forbids enums, namespaces and decorators under
  `scripts/` — none are needed. If stripping proves unreliable, adding `tsx` is a
  one-line change to the `grooves` script.
- Sample rate is 44100 throughout; the mp3 bitrate is a constant in `encode.ts`.
- ffmpeg is required to run the generator and to run the tests that load the real pack.
  Those tests fail with a clear message when it is absent rather than skipping — a
  silently skipped audio test is worse than a red one. The build guard in Epic 4 still
  needs no ffmpeg, because it never touches a pack.
- `loadPack` is async because decoding is; `SamplePack.get` stays synchronous, which is
  what keeps the voices stage a pure function over already-decoded buffers.
- Pitch shifting is linear-interpolating resampling. Epic 2 may replace it inside the
  voices stage without touching any other stage.
- The peak ceiling and the mp3 bitrate live as named constants in `mix.ts` and
  `encode.ts` so Epic 2 can tune them in one place.
- `scripts/**` is excluded from the Next build; it is tooling, not app code.
- feature-2 is editing `Groove` in the same working tree and has already added `name`
  and `bpm`. This epic adds `root`, `flavour` and `bars` beside them and adopts `bpm` as
  the tempo field throughout, including inside the generator's `MusicMeta`, so the two
  features never carry two names for one number.
- Track C's Step C5 is knowingly red until Step I3. It is written early because it is
  the assertion that would have caught the zero-byte placeholders in the first place.

## Decision log

### Cycle 1 — 2026-08-29

**Q3. How do the app's tests reach the audio files?**
Decision: **A) Keep it in the app project and read `public/` through `node:fs`** —
jsdom runs in Node, so file access works, and `docs/testing.md` wants the assertion
colocated with the data it validates.
Changed: nothing — Step C5 was already written this way, and is now confirmed rather
than provisional.

**Carried in from Epic 2's Q2 (linear resampling retained):** Step D3 now asserts the
pitched voices are sampled densely enough that the renderer never shifts a sample more
than two semitones.

**Carried in from Epic 4's Q2 (wall-clock start seed for minting):** the Architecture's
determinism rule is narrowed to the render path, with minting named as the one
exception.

### Cycle 2 — 2026-08-29

**Q1. How does the generator decode the sample WAVs?**
Decision: **B) Shell out to ffmpeg to decode each sample to raw f32** — rather than the
hand-rolled parser, accepting a subprocess per sample file in exchange for no format
code of our own and a pack that may hold any format ffmpeg reads.
Changed: `wav.ts` is replaced by `pcmio.ts` (pure interleave/deinterleave) and
`decode.ts` (the ffmpeg call); Step B1 rewritten and Step B1b added; Step B3 now decodes
once at load and asserts `get` spawns nothing; Step B7 pipes raw f32 instead of a
hand-written WAV. The subprocess cost is confined to `loadPack`, since the placeholder
pack is synthesized in memory and the voices tests use it.

**Q2. Where does the list of minted grooves live?**
Decision: **A) `scripts/grooves/catalogue.json`** — committed `GrooveSpec[]` as input,
with the generated module, the mp3s and the lock file as pure output.
Changed: nothing — the Architecture, Contracts and Step I2 were already written this
way, and are now settled rather than provisional.

---

**This spec is ready to execute.** Every architectural decision is settled.
