# Tech spec — Epic 1: Every repeat is a different take

PRD: [../prd/epic-1-every-repeat-a-different-take.md](../prd/epic-1-every-repeat-a-different-take.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four largely independent pieces. `FeelTemplate` gains a `passes` count;
`buildEvents` turns its bar loop into a pass loop and draws a fresh humanize
generator per pass; `Groove` and `MusicMeta` gain `loopBars` so the app knows
the file is longer than the figure; and `TransportPanel` divides position by the
pass count so a four-segment track still tracks four bars. The freeze rule and
its two dangling references leave the docs.

The one piece of real design is the rng split. Today `buildEvents` draws tempo,
root, flavour, harmony and then four rhythm patterns from a single sequential
stream, so any change to the rhythm side shifts the draws before it and re-keys
the catalogue. Splitting it costs nothing at runtime and buys every later epic
the freedom to change how grooves sound without changing what they are.

## Architecture

```
buildEvents(spec, template)
├── musicRng   = rngFor(`${template}:${seed}:events`)   ← FROZEN LABEL
│   └── bpm → root → flavour → buildHarmony            (draw order also frozen)
├── rhythmRng  = rngFor(`${template}:${seed}:rhythm`)
│   └── kick / hat / bass / comp pattern picks
└── for pass in 0..template.passes-1
    └── for bar in 0..3
        └── chord = harmony.progressionMidi[bar % length]
    then per pass:
      humanizeRng = rngFor(`${template}:${seed}:humanize:${pass}`)
```

**The music label stays the string `events`.** Reproducing today's eighteen
answers is not achieved by a lookup table but by construction: the stream that
draws them keeps its label and its draw order, and everything new draws from a
different label. The constant is named `MUSIC_LABEL` and carries a comment
saying the string is frozen because eighteen committed answers depend on it —
the same class of rule as `src/lib/hash.ts`.

Round-robin variation across passes needs no code: `roundRobin()` in `voices.ts`
already keeps one counter per voice across the whole event list, so pass two
lands on different alternates by construction once the list is longer.

**The transport.** Position is 0..1 over the whole loop. The panel receives
`passes` and derives both numbers from it:

```
soundingBar = floor(position × passes × 4) % 4
trackFill   = (position × passes) % 1
```

Both from one value, so they cannot disagree at a boundary.
`ProgressTrack` is untouched — it is handed `trackFill` as its `value`.

## Contracts

Frozen before any track starts.

```ts
// scripts/grooves/types.ts
export type FeelTemplate = {
  // ...existing fields unchanged
  /** How many passes of the four-bar figure a groove from this feel is. ≥ 2. */
  passes: number
}

export type MusicMeta = {
  // ...existing fields unchanged
  bars: number      // 4 — the musical figure. Unchanged meaning.
  loopBars: number  // bars × template.passes — the rendered loop.
}
```

```ts
// src/lib/groove.ts
export type Groove = {
  // ...existing fields unchanged
  bars: number      // 4 — the musical figure
  loopBars: number  // the file's loop, e.g. 16 or 8
}
```

```ts
// scripts/grooves/events.ts
/** FROZEN. Eighteen committed answers are derived from this exact string. */
const MUSIC_LABEL = 'events'
```

```ts
// src/features/daily-groove/components/puzzle/TransportPanel.tsx
type TransportPanelProps = {
  position: number   // 0..1 over the whole loop
  isPlaying: boolean
  passes: number     // ≥ 1; 1 renders exactly as today
}
```

`manifest.ts`'s `FIELDS` gains `'loopBars'` after `'bars'`.

## Tracks

### Track A — The freeze rule goes

- **Goal** — the docs no longer forbid re-rendering, and the `hash.ts` rule
  stands on the justification that survives.
- **Owns** — `scripts/grooves/README.md`, `docs/coding-guidelines.md`,
  `scripts/grooves/docs.test.ts` (new).
- **Depends on** — nothing.
- **Parallel with** — B, C, D.
- **Done when** — `docs.test.ts` passes and no other suite changes.

### Track B — The generator renders passes

- **Goal** — `buildEvents` emits `passes × 4` bars, splits the rng, and the gate
  measures density over what was rendered.
- **Owns** — `scripts/grooves/types.ts`, `scripts/grooves/templates/*.ts`,
  `scripts/grooves/events.ts`, `scripts/grooves/gate.ts` and their tests.
- **Depends on** — the `FeelTemplate` and `MusicMeta` contracts.
- **Parallel with** — A, C, D.
- **Done when** — the generator suite passes without the manifest or app
  changes existing.

### Track C — The manifest carries both lengths

- **Goal** — `Groove.loopBars` is written, read and locked.
- **Owns** — `src/lib/groove.ts`, `scripts/grooves/manifest.ts`,
  `scripts/grooves/cli.ts` and their tests.
- **Depends on** — the `Groove` and `MusicMeta` contracts.
- **Parallel with** — A, B, D.
- **Done when** — `writeManifest` emits `loopBars` and its tests pass against a
  hand-built entry, with no render involved.

### Track D — The transport divides by passes

- **Goal** — a four-segment track that tracks four bars of a longer file.
- **Owns** — `src/features/daily-groove/lib/theory/music.ts`,
  `src/features/daily-groove/components/puzzle/TransportPanel.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.tsx` and their tests.
- **Depends on** — the `Groove` contract only. It never sees a template.
- **Parallel with** — A, B, C.
- **Done when** — its tests pass against fixture grooves carrying `loopBars`.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D. No file is opened
  by two tracks.
- **Wave 2:** Integration — re-render the catalogue, pin the answers, verify.

## Implementation

### Track A — The freeze rule goes

#### Step A1 — The generator README no longer forbids re-rendering

Covers: R1, AC1

- **Test first** — `scripts/grooves/docs.test.ts` (new): read
  `scripts/grooves/README.md` and assert `/freeze rule/i` does not match, and
  that it still contains the `## Regenerating` heading. Run it: fails with
  `expected 'freeze rule' not to match`.
- **Implement** — `scripts/grooves/README.md`: delete the `## The freeze rule`
  section; rewrite the sentence above *Regenerating* that reads "See the freeze
  rule below before you reach for it on a whim" to say re-rendering is a normal
  operation that changes committed audio; rewrite the troubleshooting line that
  calls a re-render a violation.
- **Green when** — the assertion passes and `npx vitest run --project generator`
  stays green.
- **Refactor** — none.

#### Step A2 — The hash rule stands on the date mapping

Covers: R1a, AC1

- **Test first** — `scripts/grooves/docs.test.ts`: read
  `docs/coding-guidelines.md` and assert it still contains
  `src/lib/hash.ts` is frozen and no longer contains `freeze rule in`. Run it:
  fails with `expected 'freeze rule in' not to match`.
- **Implement** — `docs/coding-guidelines.md`: in the `hash.ts` rule, drop the
  "every groove re-renders … breaking the freeze rule" clause and keep the
  reassigned-past-dates clause as the whole justification.
- **Green when** — both assertions pass; `src/lib/hash.test.ts` is untouched and
  still green.
- **Refactor** — none.

### Track B — The generator renders passes

#### Step B1 — Every template declares a pass count

Covers: R2, R2a, AC2

- **Test first** — `scripts/grooves/templates/index.test.ts`: for every template
  in `allTemplates()`, assert `template.passes >= 2` and
  `Number.isInteger(template.passes)`. Run it: fails with
  `expected undefined to be greater than or equal to 2`.
- **Implement** — `scripts/grooves/types.ts`: add `passes: number` to
  `FeelTemplate`. Set `passes: 4` in `straight-funk.ts`, `shuffle.ts` and
  `bright-straight.ts`, and `passes: 2` in `half-time.ts`, each with a comment
  naming the duration it produces at the tempo range's midpoint.
- **Green when** — the assertion passes; the flavour-pairing assertions in the
  same file stay green.
- **Refactor** — none.

#### Step B2 — The music stream is separated from the rhythm stream

Covers: R6, AC6

- **Test first** — `scripts/grooves/events.test.ts`: build events for
  `{ template: 'straight-funk', seed: 1 }` and capture `music`. Then call
  `buildEvents` again with an extra draw taken from the rhythm generator
  (simulate by exporting `RHYTHM_LABEL` and asserting `rngFor(RHYTHM_LABEL...)`
  is a different stream from `rngFor(MUSIC_LABEL...)` — concretely: assert the
  first ten values of the two streams for the same spec are not pairwise equal).
  Run it: fails with `RHYTHM_LABEL is not exported`.
- **Implement** — `scripts/grooves/events.ts`: export
  `const MUSIC_LABEL = 'events'` and `const RHYTHM_LABEL = 'rhythm'`. Build
  `musicRng = rngFor(\`${spec.template}:${spec.seed}:${MUSIC_LABEL}\`)` and draw
  bpm, root, flavour and `buildHarmony` from it **in that order, unchanged**.
  Build `rhythmRng` from `RHYTHM_LABEL` and draw the four pattern picks from it.
  Comment `MUSIC_LABEL` as frozen.
- **Green when** — the streams differ and every existing `events.test.ts`
  assertion about bpm, root, flavour, chord and progression still passes
  unchanged — that is the proof the answers did not move.
- **Refactor** — none.

#### Step B3 — A groove is as many passes as its template declares

Covers: R3, R5, AC2, AC3, AC5

- **Test first** — `scripts/grooves/events.test.ts`: for a template with
  `passes: 4`, assert the last event's `timeSec + durationSec` equals
  `16 * barSec` within a millisecond; and assert the set of `timeSec % barSec`
  values in bar 0 equals that of bar 4 for the kick voice. Run it: fails with
  `expected 9.6 to be close to 38.4`.
- **Implement** — `scripts/grooves/events.ts`: replace `const BARS = 4` with
  `const BARS_PER_PASS = 4`; loop `for (let pass = 0; pass < template.passes;
  pass++)` around the existing bar loop; index the chord with
  `harmony.progressionMidi[bar % harmony.progressionMidi.length]` where `bar` is
  the bar within the pass; compute the absolute bar as
  `pass * BARS_PER_PASS + bar` when placing events; pass
  `barSec * BARS_PER_PASS * template.passes` to `fitToLoop`.
- **Green when** — both assertions pass and the seam-related tests stay green.
- **Refactor** — none.

#### Step B4 — Each pass is a different performance

Covers: R4, AC4

- **Test first** — `scripts/grooves/events.test.ts`: build a four-pass groove and
  assert that the list of `timeSec - gridPosition` deviations for pass 0 is not
  deep-equal to that of pass 1, while their grid positions are. Run it: fails
  with `expected [...] not to deep equal [...]` because every pass is currently
  humanized by one generator over the whole list.
- **Implement** — `scripts/grooves/events.ts`: apply swing over the whole list as
  now, then humanize **per pass** — slice the events of pass *p* and call
  `humanize(slice, template, rngFor(\`${spec.template}:${spec.seed}:humanize:${p}\`), bpm)`
  — then concatenate and `fitToLoop` the result.
- **Green when** — the deviations differ per pass and the sub-subdivision clamp
  assertions stay green.
- **Refactor** — extract `passOf(event, barSec)` if B3 and B4 both need it.

#### Step B5 — `MusicMeta` states the rendered length

Covers: R7 (generator half), R13, AC13

- **Test first** — `scripts/grooves/gate.test.ts`: gate a synthetic candidate
  with `music.bars = 4`, `music.loopBars = 16` and 16 bars' worth of events at
  the template's mid density, and assert `gateCandidate` returns `null`. Run it:
  fails with a `density` failure reporting roughly four times the real value.
- **Implement** — `scripts/grooves/types.ts`: add `loopBars: number` to
  `MusicMeta`. `events.ts`: set `loopBars: BARS_PER_PASS * template.passes` in
  the returned `music`. `gate.ts`: `checkDensity` divides by `music.loopBars`
  and reports it in the failure detail.
- **Green when** — the candidate passes and every other gate test stays green.
- **Refactor** — none.

### Track C — The manifest carries both lengths

#### Step C1 — `Groove` carries the loop length

Covers: R7, AC8

- **Test first** — `scripts/grooves/manifest.test.ts`: call `writeManifest` with
  one entry carrying `bars: 4, loopBars: 16` and assert the rendered source
  contains `loopBars: 16,` on its own line, positioned after `bars: 4,`. Run it:
  fails with `expected '...' to contain 'loopBars: 16,'`.
- **Implement** — `src/lib/groove.ts`: add `loopBars: number` to `Groove` with a
  doc comment distinguishing it from `bars`. `scripts/grooves/manifest.ts`: add
  `'loopBars'` to `FIELDS` after `'bars'` and update the "eleven fields" comment
  to twelve.
- **Green when** — the assertion passes and the existing manifest round-trip
  tests pass with the new field present.
- **Refactor** — none.

#### Step C2 — The pipeline writes it

Covers: R7, R15, AC8, AC15

- **Test first** — `scripts/grooves/cli.test.ts`: run `generate` with
  `encode: false` over a one-entry catalogue on a `passes: 2` template and
  assert the returned entry has `bars: 4` and `loopBars: 8`. Run it: fails with
  `expected undefined to be 8`.
- **Implement** — `scripts/grooves/cli.ts`: `toGroove` copies `music.loopBars`
  onto the entry; the `renderVoices` and `mixTracks` calls pass
  `bars: music.loopBars` and `loopBars: music.loopBars` instead of `music.bars`.
- **Green when** — the assertion passes and the lock/verify tests stay green.
- **Refactor** — none.

### Track D — The transport divides by passes

#### Step D1 — `loopSecondsOf` measures the file's loop

Covers: R8, AC8

- **Test first** — `src/features/daily-groove/lib/theory/music.test.ts`: assert
  `loopSecondsOf({ ...fixture, bpm: 100, bars: 4, loopBars: 16 })` is
  `38.4`, and that an entry with `loopBars` absent falls back to `bars` and
  returns `9.6`. Run it: fails with `expected 9.6 to be 38.4`.
- **Implement** — `src/features/daily-groove/lib/theory/music.ts`:
  `loopSecondsOf` reads `groove.loopBars` when it is a finite positive number
  and `groove.bars` otherwise.
- **Green when** — both assertions pass; the existing zero-tempo guard test
  stays green.
- **Refactor** — none.

#### Step D2 — The track tracks four bars of a longer loop

Covers: R9, R9a, R11, AC9, AC11

- **Test first** — `src/features/daily-groove/components/puzzle/TransportPanel.test.tsx`:
  render `<TransportPanel position={0.3125} isPlaying passes={4} />` — five
  sixteenths through a sixteen-bar loop, i.e. bar 2 of pass 2 — and assert
  `screen.getByTestId('progress-active')` carries `data-segment="1"` and the
  fill's width is `25%`. Run it: fails with `expected "1" to be "1"` against the
  current `data-segment="1"` but a fill of `31.25%`.
- **Implement** — `TransportPanel.tsx`: add `passes: number` to the props;
  compute `const scaled = position * Math.max(1, passes)`, pass
  `value={scaled % 1}` to `ProgressTrack`, and derive
  `soundingBar = Math.min(3, Math.floor(scaled * BAR_COUNT) % BAR_COUNT)`.
  Keep the `isPlaying` guard that renders no active segment.
- **Green when** — both assertions pass, plus a two-pass case
  (`passes={2}, position={0.625}` → segment 1, fill 25%) and the stopped case.
- **Refactor** — none.

#### Step D3 — The page hands the transport its pass count

Covers: R9a, R10, AC9, AC10

- **Test first** — `src/features/daily-groove/index.test.ts` (through
  `testing/renderFeature.tsx`): render the feature with a groove fixture of
  `bars: 4, loopBars: 8` and assert the progress bar renders, and that
  `screen.queryByText(/of 4/)` and `queryByText(/pass/i)` are both null. Run it:
  fails on the render because `passes` is a required prop that nothing supplies.
- **Implement** — `GroovePuzzle.tsx`: compute
  `const passes = Math.max(1, Math.round(groove.loopBars / groove.bars))` and
  pass it to `<TransportPanel>`.
- **Green when** — the feature renders, no pass wording appears anywhere, and
  the existing feature tests stay green.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Pin the eighteen answers

Covers: R6a, AC7

- **Test first** — `src/features/daily-groove/data/grooves.generated.test.ts`:
  add a table of the eighteen `{ id, bpm, root, flavour, chord, progression }`
  as they stand on `main` today, and assert every entry in `GROOVES` matches its
  row. Run it against the pre-epic manifest: passes immediately — which is the
  point. It is a regression guard, written before the re-render.
- **Implement** — nothing.
- **Green when** — it passes before and after Step I2.
- **Refactor** — none.

#### Step I2 — Re-render and lock

Covers: R14, R15, AC7, AC14, AC15

- Run `npm run grooves`. Inspect `git diff` on
  `src/features/daily-groove/data/grooves.generated.ts`: the only changes must
  be the added `loopBars` line per entry and each `headDelaySeconds`. If any
  answer field moved, the `MUSIC_LABEL` or its draw order is wrong — fix that
  rather than updating the pinning table.
- Run `npm run grooves` a second time; `git status` must be clean.
- Run `npm run grooves:verify` and `npm test`.

#### Step I3 — The demo path

Covers: R3, R4, R9

- Load the page, press play, and listen through two full cycles. Bar 5 is the
  same figure as bar 1 and audibly a different take. The track fills and resets
  four times per cycle on a funk groove and twice on the half-time one, with the
  highlight stepping 1→2→3→4 alongside it. Nothing names a pass.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1, R1a | A1, A2 |
| R2, R2a | B1 |
| R3 | B3 |
| R4 | B4 |
| R5 | B3 |
| R6 | B2 |
| R6a | I1, I2 |
| R7 | B5, C1, C2 |
| R8 | D1 |
| R9, R9a | D2, D3 |
| R10 | D3 |
| R11 | D2 |
| R12 | D2 (asserted by `ProgressTrack` staying untouched) |
| R13 | B5 |
| R14 | I2 |
| R15 | C2, I2 |
| AC1 | A1, A2 |
| AC2 | B1, B3 |
| AC3 | B3 |
| AC4 | B4 |
| AC5 | B3 |
| AC6 | B2 |
| AC7 | I1, I2 |
| AC8 | C1, C2, D1 |
| AC9 | D2, D3 |
| AC10 | D3 |
| AC11 | D2 |
| AC12 | D2 |
| AC13 | B5 |
| AC14 | I2 |
| AC15 | I2 |

## Assumptions

- `docs.test.ts` is a new file in the `generator` project. It reads two markdown
  files from disk, in the same spirit as `boundary.test.ts` and
  `src/lib/hash.test.ts` — conventions no linter can check, guarded by a test.
- The pass counts start at four for the three fast feels and two for
  `half-time`. They are template data, so changing one is a one-line edit and a
  re-render.
- `TransportPanel`'s `passes` prop is required rather than defaulted, so a
  caller that forgets it fails at the type level rather than silently rendering
  a quarter-speed fill.
- `renderVoices` needs no change: its `bars` option already takes a bar count,
  and `cli.ts` simply passes a bigger one.
- `OVERHANG_BARS` is unchanged.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-31

**Q1. How are the eighteen existing answers preserved?**
Decision: **A) Freeze the label — the music stream keeps the string `events`,
drawn in today's order, with a comment saying why** — the PRD's AC7 wants the
manifest diff itself to be the proof, and reproducing by construction means no
table can drift from the audio. Reversing it means every answer moves and every
stored result describes a different puzzle.
Changed: nothing was rewritten — the Architecture, the `MUSIC_LABEL` contract
and Step B2 were already written to this shape. The decision fixes them: the
string `events` is now permanent, and Step B2's green condition — that every
existing bpm, root, flavour, chord and progression assertion passes unchanged —
is the only acceptable evidence.
