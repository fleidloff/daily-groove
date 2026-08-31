# Tech spec — Epic 1: Tap a root, hear it

PRD: [../prd/epic-1-tap-a-root-hear-it.md](../prd/epic-1-tap-a-root-hear-it.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four tracks, three of them independent from the first commit. A new module in
`scripts/grooves/` renders twelve one-note mp3s through the pipeline that
already exists — `loadPack` → `renderVoices` → `mixTracks` → `encodeMp3` — and
writes a second generated module into the feature's `data/`. The lock and
`grooves:verify` grow a second artifact family beside the grooves. In the app, a
new `lib/audio/context.ts` becomes the single owner of the `AudioContext` so a
note can sound over a running groove, and `lib/audio/reference.ts` plays one
note through it. The guess card's root `onSelect` then does what it already
does, plus one call.

Two decisions shape everything below. The `AudioContext` is lifted out of
`createAudioPlayer` into a module-level lazy singleton in `lib/audio/context.ts`,
rather than threaded through props or lent by the transport — a note must be
able to sound before the groove has ever played, which rules out any owner built
by the play press. And the notes are rendered by their own `npm run notes`,
not by `npm run grooves`, so a catalogue edit does not re-render twelve
unrelated files. The cost of that second one is a lock written by two commands,
which is what Steps B5 and B5a exist to make safe.

## Architecture

**Generator side.** A reference note is a degenerate groove: one `NoteEvent` on
the `comp` voice, no template feel, no swing, no humanize. It reuses every
stage, with two deliberate departures:

- **No loop wrap.** `mixTracks`' `loopFrames` option folds the overhang back
  onto the start, which for a single note would fold its tail onto its own
  attack. The note is mixed with no loop option and truncated afterwards.
- **Truncate then fade.** `addAt` copies a whole sample regardless of
  `durationSec`, so length is imposed after the mix: cut at 2.0 s with a 150 ms
  release ramp so nothing ends on a step.

`mixTracks` normalises every mix to `PEAK_CEILING`, which is what makes R8's
even loudness fall out for free — all twelve peak at exactly 0.891 before
encoding.

**Pitch.** `theory/notes.ts` already exports `midiOf(root, octave)`. The twelve
notes are `midiOf(root, 4)` for each of the twelve `ROOTS`, i.e. MIDI 60–71. The
comp voice samples every four semitones from 48 to 84, so no note is resampled
by more than two semitones — inside the pack's own design tolerance.

**App side.** `createAudioPlayer` currently does `new ctor()` inside `decode()`
and `context.close()` inside `dispose()`. Both move: the context comes from a
shared owner, and `dispose()` releases its nodes without closing anything. The
owner constructs lazily on first use, so R15 holds whether the first gesture is
the play press or a chip tap.

The reference voice is a flat map of decoded buffers plus one live node. It
never reads the transport and the transport never reads it — the only thing they
share is the context.

## Contracts

Frozen. Tracks build against these rather than against each other.

```ts
// src/features/daily-groove/data/notes.generated.ts  (GENERATED)
import type { Root } from '@/lib/groove'

/** One reference note per chromatic root. */
export type ReferenceNote = {
  root: Root
  /** URL under /notes, e.g. "/notes/note-c-sharp.mp3" */
  audioSrc: string
  /** Sounding pitch, scientific: C4 is 60. */
  midi: number
}

export const NOTES: ReferenceNote[] = [/* twelve entries, in ROOTS order */]
```

```ts
// src/features/daily-groove/lib/audio/context.ts
/** The page's one AudioContext, constructed on first call, never before. */
export function sharedAudioContext(): AudioContext
/** Whether one has been constructed. Tests and teardown only. */
export function hasAudioContext(): boolean
/** Close and forget it. Test teardown only; nothing in the app calls this. */
export function releaseAudioContext(): Promise<void>
```

```ts
// src/features/daily-groove/lib/audio/reference.ts
export type ReferenceVoice = {
  /** Best effort. Resolves when the note has started, or silently when it cannot. */
  play(root: Root): Promise<void>
  /** Fetch and decode every note without sounding anything. Best effort. */
  warm(): Promise<void>
  dispose(): void
}
export function createReferenceVoice(notes: ReferenceNote[]): ReferenceVoice
```

```ts
// scripts/grooves/lock.ts — extended, shape frozen here
export type Lock = {
  catalogueSha256: string
  manifestSha256: string
  grooves: LockEntry[]
  /** Reference notes. Absent in a lock written before this epic. */
  notes?: LockEntry[]
  notesManifestSha256?: string
  packSha256?: string
}
export type LockPaths = {
  grooveDir: string
  cataloguePath: string
  manifestPath: string
  notesDir?: string
  notesManifestPath?: string
  packDeclarationPath?: string
}
```

Every new field is optional, so a lock written before this epic still parses and
`verifyLock` reports on what it has. That is what keeps Track B from being a
breaking change to the existing guard.

- `renderNote(pack, midi, sampleRate): Pcm` — one mixed, truncated, faded note.
- `noteFileName(root): string` — `'note-c-sharp.mp3'`; ASCII slug, no `♯`/`♭`.

## Tracks

### Track A — The twelve notes exist as files

- **Goal** — `npm run notes` renders twelve mp3s into `public/notes/` and
  writes `data/notes.generated.ts`.
- **Owns** — `scripts/grooves/notes.ts`, `scripts/grooves/notes-cli.ts`,
  `scripts/grooves/notes-manifest.ts`, `package.json` (script entry),
  `public/notes/**`, `src/features/daily-groove/data/notes.generated.ts`
- **Depends on** — the `ReferenceNote` and `renderNote` contracts; `Lock` shape
  for the call it makes into Track B
- **Parallel with** — B, C, D
- **Done when** — its own tests pass and the twelve files exist and play.

### Track B — The build guard covers them

- **Goal** — `grooves:verify` fails on a missing note, a hand-edited notes
  manifest, or a changed pack declaration.
- **Owns** — `scripts/grooves/lock.ts`, `scripts/grooves/lock.test.ts`,
  `scripts/grooves/verify-cli.ts`, `scripts/grooves/verify-cli.test.ts`,
  `scripts/grooves/cli.ts` (the lock write only), `scripts/grooves/cli.test.ts`,
  `scripts/grooves/boundary.test.ts`
- **Depends on** — the `Lock` / `LockPaths` contract only
- **Parallel with** — A, C, D
- **Done when** — its tests pass against fixture directories, with no real
  render.

### Track C — A note can sound over the groove

- **Goal** — `createReferenceVoice` plays a note through the shared context
  while the groove loops.
- **Owns** — `src/features/daily-groove/lib/audio/context.ts`,
  `lib/audio/reference.ts`, `lib/audio/audio.ts` (context lift only),
  and those three files' tests
- **Depends on** — the `ReferenceVoice` and `sharedAudioContext` contracts
- **Parallel with** — A, B, D
- **Done when** — its tests pass against `installFakeAudioContext`, with a
  fixture `ReferenceNote[]` rather than the generated module.

### Track D — The tap sounds

- **Goal** — tapping a root chip selects it and asks the voice for that root.
- **Owns** — `src/features/daily-groove/hooks/useReferenceNote.ts`,
  `components/puzzle/GuessCard.tsx` (the root row's `onSelect` only),
  `components/GroovePuzzle.tsx`
- **Depends on** — the `ReferenceVoice` contract; a fixture manifest
- **Parallel with** — A, B, C
- **Done when** — its feature tests pass with the voice mocked at the hook seam.

**The one cross-epic seam:** Epic 2 also opens `GuessCard`. Track D touches the
root `ChipGroup`'s `onSelect` prop and nothing else in that file; Epic 2 touches
the adornment props and the caption. Neither goes near the other's lines.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D. Four disjoint file
  sets. A is the long pole: it ends in a render and a listen.
- **Wave 2:** Integration — swap Track D's fixture for the generated module,
  wire the warm, run the demo path.

## Implementation

### Track A — The twelve notes exist as files

#### Step A1 — One note renders to PCM of a known length

Covers: R20, R21, AC15

- **Test first** — `scripts/grooves/notes.test.ts`: with the real pack loaded
  from `samples/`, assert `renderNote(pack, 60, 44100)` returns a `Pcm` whose
  `left.length` is `Math.round(2.0 * 44100)`, and that calling it twice returns
  channel data that is element-wise equal. Run it: fails with
  `renderNote is not a function`.
- **Implement** — `scripts/grooves/notes.ts`: `renderNote(pack, midi,
  sampleRate)` builds one `NoteEvent`
  (`{ voice: 'comp', timeSec: 0, durationSec: NOTE_SECONDS, velocity: 0.85, midi }`),
  calls `renderVoices([event], pack, sampleRate)`, mixes with `mixTracks(tracks,
  NOTE_TEMPLATE)` — a local minimal `FeelTemplate` with no gain or pan entries
  and no mix options, so no loop wrap happens — then truncates both channels to
  `NOTE_SECONDS` and applies a `RELEASE_SECONDS` linear ramp to zero at the end.
  Export `NOTE_SECONDS = 2.0` and `RELEASE_SECONDS = 0.15`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A2 — The last sample is silence

Covers: R4, R8

- **Test first** — same file: assert the final sample of both channels is `0`,
  and that the maximum absolute sample in the last 10 ms is below the maximum in
  the 100 ms before the ramp begins. Run it: fails — the untruncated tail is
  still at its natural level.
- **Implement** — `notes.ts`: apply the release ramp over the final
  `RELEASE_SECONDS`, multiplying each sample by a factor falling linearly to 0.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A3 — Every root maps to a MIDI number and an ASCII file name

Covers: R7, R22

- **Test first** — `scripts/grooves/notes.test.ts`: assert
  `noteSpecs()` returns twelve entries whose `root` values equal `ROOTS` in
  order; that their `midi` values are `60..71`; and that every `audioSrc`
  matches `/^\/notes\/note-[a-z-]+\.mp3$/` — no `♯`, `♭` or uppercase. Run it:
  fails with `noteSpecs is not a function`.
- **Implement** — `notes.ts`: `noteSpecs(): ReferenceNote[]`, using `midiOf(root,
  4)` from `theory/notes.ts` and a `noteFileName(root)` that lowercases and maps
  `♯`→`-sharp`, `♭`→`-flat`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A4 — The generated module renders as valid, lint-clean source

Covers: R22

- **Test first** — `scripts/grooves/notes-manifest.test.ts`: assert
  `renderNotesManifest(noteSpecs())` starts with a `GENERATED FILE - DO NOT
  EDIT` banner, imports `Root` from `'@/lib/groove'`, declares
  `export const NOTES: ReferenceNote[]`, contains twelve `root:` lines, and uses
  single quotes throughout. Run it: fails with
  `renderNotesManifest is not a function`.
- **Implement** — `scripts/grooves/notes-manifest.ts`: `renderNotesManifest` and
  `writeNotesManifest`, modelled on `manifest.ts` — same banner style, same
  `literal()` quoting, same `mkdirSync` before write.
- **Green when** — the assertions pass.
- **Refactor** — none. Do **not** import `manifest.ts`'s private helpers; copy
  the two small ones rather than exporting internals of a module that is about
  grooves.

#### Step A5 — The command renders, writes and locks

Covers: R20, R22, R23

- **Test first** — `scripts/grooves/notes-cli.test.ts`: run `main()` against a
  temporary out dir and manifest path with the real pack, then assert twelve
  files exist and are non-zero, the manifest file exists, and the lock at the
  given path has twelve `notes` entries, a `notesManifestSha256` and a
  `packSha256`. Run it: fails with `Cannot find module './notes-cli.ts'`.
- **Implement** — `scripts/grooves/notes-cli.ts` with `DEFAULT_NOTES_DIR =
  join(HERE, '../../public/notes')` and `DEFAULT_NOTES_MANIFEST_PATH =
  join(HERE, '../../src/features/daily-groove/data/notes.generated.ts')`;
  `main()` loads the pack, renders each spec, encodes with `encodeMp3`, writes
  the manifest, then reads the existing lock with `readLock`, merges the notes
  fields in and writes it back with `writeLock` — never rebuilding the groove
  entries, which this command has not rendered and cannot vouch for. Add
  `"notes": "node scripts/grooves/notes-cli.ts"` to `package.json`, beside
  `grooves` and `grooves:add`.
- **Green when** — all four assertions pass. This test needs ffmpeg; mark it so
  it is skipped where ffmpeg is absent, as the existing encode tests do.
- **Refactor** — none.

#### Step A6 — Render for real and listen

Covers: R8, R20

- Not a test step. Run the command, commit `public/notes/**`,
  `data/notes.generated.ts` and the updated lock, then listen to all twelve back
  to back against a groove. Confirm the roots furthest from a sampled note
  (MIDI 62, 66, 70 — two semitones from 60, 64, 68) do not read as duller.
- **Green when** — the listen passes and `npm run grooves:verify` is clean.

### Track B — The build guard covers them

#### Step B1 — A lock without notes still verifies

Covers: R23

- **Test first** — `scripts/grooves/lock.test.ts`: build a `Lock` with no
  `notes`, `notesManifestSha256` or `packSha256`, and assert `verifyLock`
  against a fixture tree returns `[]`. Run it: passes already — this is the
  regression guard that the extension must not break, so write it first and
  keep it green throughout.
- **Implement** — none yet.
- **Green when** — it passes.

#### Step B2 — A missing note file fails

Covers: R24, AC16

- **Test first** — same file: a `Lock` carrying one `notes` entry whose file is
  absent from `notesDir`, asserting `verifyLock` returns one failure with
  `check: 'missing'` whose `detail` names the file. Run it: fails — the returned
  array is empty, because nothing reads `notes`.
- **Implement** — `lock.ts`: add `noteFile(notesDir, id)` beside `grooveFile`
  — the notes are named by root slug, not `<id>.mp3`, so it is its own
  derivation — and extend `verifyLock` to walk `lock.notes ?? []` with the same
  missing / empty / bytes / checksum ladder the grooves use.
- **Green when** — the failure is returned and B1 stays green.
- **Refactor** — the two loops are the same four checks over a different path
  function; extract one `checkEntries(entries, fileOf)` and call it twice.

#### Step B3 — A hand-edited notes manifest fails

Covers: R24, AC17

- **Test first** — same file: a lock whose `notesManifestSha256` disagrees with
  the file on disk, asserting one failure with `check: 'notes-manifest-stale'`.
  Run it: fails — no failure returned.
- **Implement** — `lock.ts`: a second `checkArtifact` call for the notes
  manifest, guarded so it is skipped when `notesManifestPath` or the recorded
  hash is absent.
- **Green when** — the failure is returned.
- **Refactor** — none.

#### Step B4 — A changed pack declaration fails

Covers: R24, AC18

- **Test first** — same file: a lock whose `packSha256` disagrees with a fixture
  `pack.json`, asserting one failure with `check: 'pack-stale'` whose detail
  says the notes must be re-rendered. Run it: fails — no failure returned.
- **Implement** — `lock.ts`: hash `paths.packDeclarationPath` and compare,
  skipped when either side is absent.
- **Green when** — the failure is returned.
- **Refactor** — none.

#### Step B5 — `buildLock` records the notes

Covers: R23

- **Test first** — same file: assert `buildLock(paths, ids, noteIds)` returns a
  lock whose `notes` entries carry a sha and a byte count per note, plus the two
  new hashes. Run it: fails with a type error — `buildLock` takes two arguments.
- **Implement** — `lock.ts`: add the optional third parameter and the three new
  fields; extend `writeLock`'s ordered projection so the committed JSON keeps
  stable key order and sorted note entries.
- **Green when** — the assertion passes and the existing `buildLock` tests stay
  green.
- **Refactor** — none.

#### Step B5a — `npm run grooves` does not drop the notes

Covers: R23

- **Test first** — `scripts/grooves/lock.test.ts`: write a lock carrying `notes`,
  `notesManifestSha256` and `packSha256`; then `writeLock` a lock built for the
  grooves alone over the same path and assert the three note fields survive in
  the file. Run it: fails — `writeLock`'s ordered projection names only
  `catalogueSha256`, `manifestSha256` and `grooves`, so the note fields are
  silently dropped.
- **Implement** — `lock.ts`: extend the ordered projection to carry the optional
  fields through when they are present, and add `mergeLock(existing, next)` that
  keeps each family's fields from whichever lock rendered it. `cli.ts`: read the
  existing lock before writing and merge, so `npm run grooves` preserves what
  `npm run notes` recorded.
- **Green when** — the three fields survive, and the existing `cli.test.ts` lock
  assertions stay green.
- **Refactor** — none.

This step exists because the notes and the grooves are rendered by two commands
into one lock. It is the whole cost of that choice, and it is one function.

#### Step B6 — The guard still imports nothing but fs, crypto and path

Covers: R25, AC19

- **Test first** — `lock.test.ts` already asserts this by reading the source;
  extend it to cover `verify-cli.ts` as well if it does not. Run it: passes —
  and it must keep passing after B2–B5. If any step above reached for `pack.ts`
  or a path helper from `cli.ts`, this is where it fails.
- **Implement** — nothing; this is the constraint, not a feature.
- **Green when** — green after every step in the track.

#### Step B7 — `verify-cli` reports on the notes

Covers: R23, R24

- **Test first** — `scripts/grooves/verify-cli.test.ts`: with a fixture lock
  carrying notes, assert `main()` returns 0 and its log line names the note
  count alongside the groove count; and that with a deleted note it returns 1.
  Run it: fails — the log line has no note count.
- **Implement** — `verify-cli.ts`: add `DEFAULT_NOTES_DIR`,
  `DEFAULT_NOTES_MANIFEST_PATH` and `DEFAULT_PACK_DECLARATION_PATH`, pass them
  in `paths`, and widen the success message.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B8 — The boundary test allows a second write destination

Covers: R22

- **Test first** — `scripts/grooves/boundary.test.ts`: change
  `MANIFEST_OUTPUT_PATH` to a `MANIFEST_OUTPUT_PATHS` array holding both the
  grooves manifest path and
  `'../../src/features/daily-groove/data/notes.generated.ts'`, and strip each in
  turn before the `src/features` check. Add an assertion that the array has
  exactly two entries, so a third write destination is a deliberate edit rather
  than a silent widening. Run it: the *existing* third test fails as soon as
  Track A lands `notes-cli.ts`, which is exactly the failure this step exists to
  answer.
- **Implement** — the change above, with a comment saying why a second
  destination is legitimate: it is a write target, not an import.
- **Green when** — all four boundary assertions pass with Track A's files
  present.
- **Refactor** — none.

### Track C — A note can sound over the groove

#### Step C1 — One context, built on first use and not before

Covers: R14, R15, AC12

- **Test first** — `src/features/daily-groove/lib/audio/context.test.ts`: with
  `installFakeAudioContext()`, assert `hasAudioContext()` is `false` before any
  call; that two `sharedAudioContext()` calls return the same object; and that
  `fake.contexts` has length 1. Run it: fails with
  `Cannot find module './context'`.
- **Implement** — `lib/audio/context.ts`: a module-level `let context: AudioContext
  | null`, the constructor looked up at call time exactly as `audio.ts` does it
  today (so a browser with no Web Audio throws the same `Error`), plus
  `hasAudioContext` and `releaseAudioContext`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C2 — The player takes the shared context and stops closing it

Covers: R14, R16, AC13

- **Test first** — `lib/audio/audio.test.ts`: after `player.dispose()`, assert
  the fake context's `close` was **not** called and `hasAudioContext()` is still
  `true`. Run it: fails — `close` was called once.
- **Implement** — `audio.ts`: replace `new ctor()` in `decode()` with
  `sharedAudioContext()`, and drop `void context?.close()` from `dispose()`,
  leaving the node release and listener clearing. Delete the now-unused
  `audioContextConstructor` if `context.ts` owns it.
- **Green when** — the new assertions pass and every existing `audio.test.ts`
  case stays green, including the no-Web-Audio rejection path.
- **Refactor** — none.

#### Step C3 — Playing a root fetches, decodes and starts a node

Covers: R1, R17, AC1

- **Test first** — `lib/audio/reference.test.ts`: with the fake installed and a
  two-entry fixture, `await voice.play('C')`; assert `fetch` was called once
  with the fixture's `audioSrc`, one source node was created, its `loop` is
  `false`, and `start` was called. Run it: fails with
  `createReferenceVoice is not a function`.
- **Implement** — `lib/audio/reference.ts`: a `Map<Root, AudioBuffer>` cache, a
  `Map<Root, Promise<AudioBuffer>>` for in-flight decodes, and `play(root)` that
  resolves the entry, ensures the buffer, resumes a suspended context, creates a
  source, connects it to `destination` and starts it.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C4 — A second tap does not refetch

Covers: R17, AC14

- **Test first** — same file: play `'C'` twice, assert `fake.fetchCalls` is 1
  and `fake.decodeCalls` is 1, and two source nodes were created. Run it: fails
  — two fetches.
- **Implement** — return the cached buffer, and share the in-flight promise so
  two concurrent plays of the same root decode once.
- **Green when** — the counts are 1, 1, 2.
- **Refactor** — none.

#### Step C5 — A new note takes the voice from the ringing one

Covers: R5, AC4

- **Test first** — same file: play `'C'`, then `'D'`; assert the first node's
  `stop` was called and the second's was not. Run it: fails — nothing stops the
  first.
- **Implement** — hold the live node; on each `play`, stop and disconnect the
  previous one inside a `try/catch` (a node that already ended throws), then
  start the new one. Clear the reference in `onended`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C6 — Every failure is swallowed

Covers: R10, R11, AC8, AC9

- **Test first** — same file, three cases: (a) with no `AudioContext` on
  `globalThis`, `await expect(voice.play('C')).resolves.toBeUndefined()`; (b)
  with `fetch` stubbed to a 404, the same; (c) with `failNextDecode()`, the
  same. In all three assert no node was created and nothing was thrown. Run it:
  fails — the promise rejects.
- **Implement** — wrap the body of `play` in a `try/catch` that returns on any
  throw, and clear the failed in-flight promise so a later tap retries.
- **Green when** — all three resolve and create no node.
- **Refactor** — none.

#### Step C7 — `warm` fetches everything and sounds nothing

Covers: R18, R19a

- **Test first** — same file: `await voice.warm()` over a twelve-entry fixture;
  assert `fetchCalls` is 12, no source node was created, and a subsequent
  `play('F♯')` makes no further fetch. Then a second case: with `fetch` failing
  for one entry, `warm()` still resolves and the other eleven are cached. Run
  it: fails with `voice.warm is not a function`.
- **Implement** — `warm()` maps the entries through the same buffer-ensuring
  path used by `play`, with `Promise.allSettled` so one failure does not abort
  the rest.
- **Green when** — both cases pass.
- **Refactor** — extract `ensureBuffer(root)` shared by `play` and `warm`.

#### Step C8 — Disposing stops the note and keeps the context

Covers: R13, R16

- **Test first** — same file: play `'C'`, `voice.dispose()`, assert the node was
  stopped and the fake context's `close` was not called. Run it: fails with
  `voice.dispose is not a function`.
- **Implement** — `dispose()` stops and disconnects the live node and clears the
  caches. It does not touch the context.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track D — The tap sounds

#### Step D1 — A hook owns the voice's lifetime

Covers: R1, R14

- **Test first** — `hooks/useReferenceNote.test.ts`: render the hook with an
  injected fake voice; assert `playRoot('C')` calls `voice.play('C')` once, and
  that unmounting calls `voice.dispose()` once. Run it: fails with
  `Cannot find module '../hooks/useReferenceNote'`.
- **Implement** — `hooks/useReferenceNote.ts`: `useReferenceNote(notes, voice =
  createReferenceVoice(notes))` holding the voice in `useState(() => …)`,
  disposing on unmount, and returning a stable `playRoot` callback and a `warm`
  callback. Injection follows `useSimpleMode`'s `store` parameter precedent.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D2 — Tapping a root selects it and sounds it

Covers: R1, R2, AC1

- **Test first** — `components/GroovePuzzle.test.tsx` (or the feature test file
  that owns the guess card): with the reference module mocked, render via
  `renderFeature()`, click the `E♭` chip, assert it is `aria-pressed="true"` and
  that the mock's `play` was called with `'E♭'`. Run it: fails — `play` was
  never called.
- **Implement** — `GroovePuzzle.tsx`: call `useReferenceNote(NOTES)` and pass a
  new `onHearRoot` prop to `GuessCard`; `GuessCard.tsx`: the root `ChipGroup`'s
  `onSelect` calls `onHearRoot(option)` after `onSelectRoot(option)`, still
  inside the existing `disarming(...)` wrapper so the give-up arming behaviour
  is unchanged.
- **Green when** — both assertions pass and every existing guess-card test stays
  green.
- **Refactor** — none.

#### Step D3 — Re-tapping the selected root sounds it again

Covers: R1, AC2

- **Test first** — same file: click `E♭` twice; assert `play` was called twice
  and the chip is still selected. Run it: fails — the second call is missing if
  the handler was guarded on a change of value.
- **Implement** — nothing, if D2 was written without a guard. This step exists
  to prove the absence of one.
- **Green when** — two calls recorded.
- **Refactor** — none.

#### Step D4 — Selection survives a voice that throws

Covers: R9, AC8

- **Test first** — same file: mock `play` to reject; click a root chip; assert
  the chip is selected, no `role="alert"` is in the document, and the test does
  not report an unhandled rejection. Run it: fails with an unhandled rejection.
- **Implement** — `GuessCard`'s handler calls `onHearRoot` with `void` and the
  hook's `playRoot` never rejects, matching the voice's own contract.
- **Green when** — the chip is selected and no alert appears.
- **Refactor** — none.

#### Step D5 — A finished day is silent

Covers: R12, AC10

- **Test first** — same file: render a solved day, press a root chip, assert
  `play` was not called and no selection changed. Run it: passes if the chips
  are already `disabled` — write it anyway, as the guard that D2 did not route
  around the `over` lock.
- **Implement** — none.
- **Green when** — green.

#### Step D6 — Simple mode's six sound too

Covers: R7, AC6

- **Test first** — same file: with simple mode on, click each of the six root
  chips and assert `play` was called with each of their labels. Run it: passes
  if D2 is right; it is the proof that nothing special-cases the twelve.
- **Implement** — none.
- **Green when** — six calls, matching the six labels.

#### Step D7 — The groove is untouched

Covers: R6, R13, AC5, AC11

- **Test first** — same file with the fake context: start the groove, advance
  the clock, read the progress track's value, tap a root, advance no further and
  assert the progress value is unchanged and the groove's source node was not
  stopped. Then stop the groove and assert the reference node's `stop` was not
  called. Run it: passes if the two voices are genuinely independent; it fails
  loudly if the transport was reused to play the note.
- **Implement** — none.
- **Green when** — green.

## Integration and verification

#### Step I1 — The generated module replaces the fixture

Covers: R7, R22, AC7

- **Test first** — `src/features/daily-groove/data/notes.generated.test.ts`:
  assert `NOTES` has twelve entries; that their roots equal `ROOTS` exactly, in
  order; that every `audioSrc` resolves to a file under `public/` that is
  non-zero; and that every `root` carried by a groove in `GROOVES` appears in
  `NOTES`. Run it: fails until Track A has committed its output.
- **Implement** — `GroovePuzzle.tsx` imports `NOTES` from the generated module
  instead of the fixture.
- **Green when** — all four assertions pass.

#### Step I2 — The row is warmed after the groove decodes

Covers: R18, R19, AC21

- **Test first** — feature test: render, press play, let the decode settle,
  assert `warm` was called once and that it was called *after* the groove's
  fetch — assert on ordering by recording call order in the mocks. Then a second
  case: without ever pressing play, tap a root and assert it still sounds
  (AC21). Run it: fails — `warm` is never called.
- **Implement** — `GroovePuzzle.tsx`: an effect that calls `warm()` once, gated
  on the transport reporting the groove is no longer loading and has played.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step I3 — The whole suite, the guard, and the listen

- `npm test` green across both projects; `npm run lint`; `npx tsc --noEmit`.
- `npm run grooves:verify` clean, then re-run it with a note deleted, with the
  notes manifest edited by one character, and with `samples/pack.json` touched —
  each must fail with its own check name.
- Demo, per the PRD: press play; tap along the root row and hear each note over
  the loop; re-tap the selected one; switch to simple mode and hear all six;
  solve and confirm the row goes quiet.
- Failure demo: disable Web Audio in the browser, tap a root, confirm it selects
  and nothing is reported.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C3, D1, D2, D3 |
| R2 | D2 |
| R3 | D2 (no scheduling anywhere in C3) |
| R4 | A1, A2 |
| R5 | C5 |
| R6 | D7 |
| R7 | A3, D6, I1 |
| R8 | A1, A2, A6 |
| R9 | D4 |
| R10 | C6 |
| R11 | C6, D4 |
| R12 | D5 |
| R13 | C8, D7 |
| R14 | C1, C2, D1 |
| R15 | C1 |
| R16 | C2, C8 |
| R17 | C3, C4 |
| R18 | C7, I2 |
| R19 | I2 |
| R19a | C7, I2 |
| R20 | A1, A5 |
| R21 | A1 |
| R22 | A3, A4, A5, B8, I1 |
| R23 | A5, B1, B5, B5a, B7 |
| R24 | B2, B3, B4, B7, I3 |
| R25 | B6 |
| AC1 | C3, D2 |
| AC2 | D3 |
| AC3 | I2 |
| AC4 | C5 |
| AC5 | D7 |
| AC6 | D6 |
| AC7 | I1 |
| AC8 | C6, D4 |
| AC9 | C6 |
| AC10 | D5 |
| AC11 | D7 |
| AC12 | C1 |
| AC13 | C2 |
| AC14 | C4 |
| AC15 | A1 |
| AC16 | B2, I3 |
| AC17 | B3, I3 |
| AC18 | B4, I3 |
| AC19 | B6 |
| AC20 | A1, A2, A6 |
| AC21 | C7, I2 |

## Assumptions

- **The comp voice at `midiOf(root, 4)`**, MIDI 60–71 — inside the pack's
  ±2-semitone resample tolerance for every root.
- **Velocity 0.85**, so the pack picks its top layer without the note reading as
  a stab.
- **No `headDelaySeconds` for the notes.** The groove needs it because its loop
  points must bracket the music; a one-shot played from 0 is delayed by the
  encoder's ~25 ms, which is inaudible on an attack.
- **`public/notes/`**, beside `public/grooves/`.
- **Files are named by root slug, not by an index.** `note-e-flat.mp3` survives
  a reordering of `ROOTS`; `note-04.mp3` would not.
- **The generated notes module carries its own `ReferenceNote` type**, exported
  from the generated file, as `grooves.generated.ts` imports `Groove` from
  `src/lib/groove.ts`. If a later feature needs the type outside the feature, it
  moves to `src/lib/groove.ts` then, not now.
- **Track D's tests mock at the hook seam**, not by `vi.mock` of an internal
  path, per `docs/testing.md`.
- **`grooves:add` is untouched.** It mints a groove and re-renders the grooves
  lock; with Step B5a's merge it carries the note fields through without knowing
  what they are.
- **`prebuild` gains nothing.** It still runs `grooves:verify` alone — the notes
  are verified, not re-rendered, on the way to a build.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-08-31

**Q1. Who owns the `AudioContext`?**
Decision: **A) A module-level lazy singleton in `lib/audio/context.ts`** — the
feature has one page and `useTransport` already treats playback as a per-page
singleton. The decisive constraint was AC3 and AC21: a note must sound before the
groove has ever been played, which rules out any owner constructed by the play
press, including the transport.
Changed: nothing — Steps C1, C2 and the Contracts block were written against it
and stand as they are.

**Q2. Which command renders the notes?**
Decision: **A) A new `npm run notes`, merging its fields into the existing
lock** — the notes change only when the pack changes, so folding them into
`npm run grooves` would re-render twelve files on every catalogue edit and hand
the same cost to `grooves:add`.
Changed: Track A's goal and Step A5 now name the command and the `package.json`
entry; Track B gains `cli.ts` and new **Step B5a**, which closes the hole the
decision opens — two writers, one lock, and a `writeLock` projection that would
otherwise drop the note fields on the next `npm run grooves`.
