# Tech spec — Epic 3: The app plays the new grooves

PRD: [../prd/epic-3-the-app-plays-the-new-grooves.md](../prd/epic-3-the-app-plays-the-new-grooves.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This epic produces almost no code and one large diff, so the work is the guards
rather than the output. The PRD's Behaviour details — render to scratch, diff the
harmony, gate, count the changed hashes, listen, and only then commit — is turned
into a single tool that *is* that order: `scripts/grooves/rerender-check.ts`
already renders all thirty into a scratch directory and compares the result
against the committed lock, and this epic grows it into a staged check where each
stage refuses to run until the one before it came back clean, and a `--promote`
mode that copies the exact scratch bytes a person listened to into
`public/grooves/`, the manifest and the lock in one move.

The two judgements the runner needs — *did a harmonic field move?* and *are the
changed audio files exactly the riding feels' grooves?* — are extracted into two
pure modules, `manifestDiff.ts` and `rerenderReport.ts`, so both can be driven
red-green from fixtures without rendering thirty grooves. The expected set of
changed grooves is **derived** from which templates declare `ride`, not written
down as eleven, so if Epic 2 narrowed to one riding feel the check expects six
with no edit here.

`src/` is touched only if Epic 1 flagged the ride library CC-BY, and then by one
snippet key, one type member and four lines of `GrooveCard.tsx`: the credit line
grows a second attribution *outside* the DrumGizmo anchor, assembled from two
snippet keys rather than by splitting one sentence in the component (R7c).
Everything else in `src/` is held still by a new pin on the `puzzle` snippet key
set.

## Architecture

```
node scripts/grooves/rerender-check.ts
  1 render      generate({ outDir, manifestPath, lockPath }) → a scratch dir     (public/ untouched)
  2 harmony     diffManifests(committed text, scratch text)
                    harmonic ≠ [] or unexpected ≠ []  → print every diff, exit 1   ← nothing below runs
  3 loudness    loudnessTable(pcm) over all thirty
                    any row outside −29…−20            → print the table, exit 1
  4 audio       classifyAudio(committed lock, scratch lock) vs ridingIds(catalogue)
                    changed ≠ ridingIds                → print both sets, exit 1
  5 listening   print the changed grooves' scratch paths + two controls, write report.json
                                                       → exit 0

node scripts/grooves/rerender-check.ts --promote <scratchDir>
  re-hash <scratchDir> against its own report.json      → any drift, exit 1
  copy the mp3s over public/grooves/, the manifest over the committed manifest
  writeLock(mergeLock(committed, fresh))
  verifyLock the committed tree                         → not clean, exit 1
```

Four things follow from that shape.

**The order is enforced by the tool, not by a checklist.** Stage 2 is the
expensive mistake the PRD is written around, so it runs before anything is
measured, printed or written, and `report.json` — the only input `--promote`
accepts — exists only after stages 2, 3 and 4 all came back clean. There is no
path to a committed mp3 that does not go through a passing harmonic diff.

**The bytes that were listened to are the bytes that get committed.** Promotion
copies the scratch render rather than re-running `npm run grooves`, and re-hashes
the scratch directory against the report first. A second render would be
byte-identical (`catalogue-gate.test.ts` asserts determinism) but "would be" is
not the standard this epic is held to.

**The harmonic diff reads text, not modules.** `scripts/` may not import
`src/features/**` (zone 5 and `scripts/grooves/boundary.test.ts`), so the
committed manifest is read as a *file* — the path `cli.ts` already holds as
`DEFAULT_MANIFEST_PATH` — and parsed out of its own rendered source. Comparing
rendered text against rendered text also catches more than the nine harmonic
fields: `name`, `audioSrc`, `bars`, `loopBars`, the distractor pools and
`HEARD_IN` all sit in the same document, and every one of them must hold still
too.

**The seven-check gate stays where it lives.** `scripts/grooves/catalogue-gate.test.ts`
already renders every catalogue spec and puts it through `gateCandidate` under
`npm run test:gen`, loudness included. This epic does not re-implement it; the
runner's stage 3 measures loudness for all thirty so a levelling error arrives as
a *table of dBFS values to correct by*, rather than as one failing test case.

### The one precondition, and where it is fixed

`grooves.lock.json` carries `packSha256`, the hash of
`scripts/grooves/samples/pack.json`, and `verifyLock` fails it as `pack-stale`.
Epic 1 adds four voices to that file, and **only `npm run notes` rewrites that
lock field** — `npm run grooves` never touches it. Left alone, that would fail
`npm run grooves:verify`, which runs on `prebuild`, which would fail
`npm run build` and with it AC3.

**Epic 1 fixes it in-epic.** Its Track G runs `npm run notes` and asserts that
only `packSha256` moves, with all twenty-four note mp3s byte-identical; its PRD's
R5b and AC14b make that binding. So Epic 3 inherits a tree whose lock is already
current, and does not run `npm run notes` at all. What it does instead is refuse
to start on a tree that is not green: Step E1 is a precondition check, not a
repair, and a `pack-stale` there is an Epic 1 regression to report rather than
something this epic quietly fixes on the way past.

## Contracts

Frozen before any track starts. Tracks A, B and C build against each other
through these.

```ts
// scripts/grooves/manifestDiff.ts
export type ManifestEntry = { id: string; fields: Record<string, string> }

export type FieldDiff = {
  id: string
  field: string
  committed: string | null   // the source literal, e.g. "'C mixolydian'" or "[0, 2, 6, 3]"
  rendered: string | null
}

export const HARMONIC_FIELDS: readonly string[]   // id, uuid, bpm, root, flavour,
                                                  // scale, chord, progression, progressionDegrees
export const MAY_MOVE: readonly string[]          // ['headDelaySeconds']

export type ManifestDiff = {
  harmonic: FieldDiff[]    // an answer moved — stop the epic
  unexpected: FieldDiff[]  // any other field, and the pools/HEARD_IN tail — stop the epic
  expected: FieldDiff[]    // headDelaySeconds only — report and continue
}

export function readManifestEntries(source: string): ManifestEntry[]
export function diffManifests(committed: string, rendered: string): ManifestDiff
```

```ts
// scripts/grooves/rerenderReport.ts
import type { Lock, LockEntry } from './lock.ts'
import type { FeelTemplate, GrooveSpec, Pcm } from './types.ts'

export type AudioClassification = {
  changed: string[]     // sha256 differs
  unchanged: string[]
  missing: string[]     // in the committed lock, not in the render
  extra: string[]       // in the render, not in the committed lock
}
export function classifyAudio(committed: Lock, rendered: Lock): AudioClassification

export function ridingIds(
  specs: readonly GrooveSpec[],
  templateFor: (id: string) => FeelTemplate,
): string[]           // every spec whose template declares `ride` in its voices

export type CountMismatch = { missed: string[]; surprising: string[] }
export function compareChanged(
  actual: AudioClassification,
  expected: readonly string[],
): CountMismatch      // expected-but-unchanged; changed-but-not-expected

export type LoudnessRow = { id: string; dbfs: number; inWindow: boolean }
export function loudnessTable(pcm: ReadonlyMap<string, Pcm>): LoudnessRow[]
export function formatLoudness(rows: readonly LoudnessRow[]): string[]
```

```ts
// scripts/grooves/rerender-check.ts
export type RenderReport = {
  renderedAt: string
  scratchDir: string
  grooves: LockEntry[]        // the scratch lock's rows
  manifestSha256: string
  changed: string[]
  loudness: LoudnessRow[]
}

export const REPORT_NAME = 'report.json'

export type CheckOptions = {
  lockPath?: string
  manifestPath?: string
  cataloguePath?: string
  grooveDir?: string
  scratchDir?: string
  promoteFrom?: string
  render?: (target: {
    outDir: string
    manifestPath: string
    lockPath: string
  }) => Promise<{ pcm: Map<string, Pcm> }>   // defaults to generate() from ./cli.ts
  log?: (line: string) => void
}

export async function main(options?: CheckOptions): Promise<number>
```

The runner follows `verify-cli.ts`'s shape exactly: an exported `main(options)`
returning an exit code, and

```ts
const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main(optionsFromArgv(process.argv.slice(2)))
}
```

**Commands.** Nothing new is added to `package.json`. The runner is invoked the
way `specs/quick/2-always-four-chords.md` and feature-20's spec already invoke it:
`node scripts/grooves/rerender-check.ts`. Test tiers: every track under
`scripts/grooves/**` runs `npm run test:gen`; Track D runs `npm test`.

**The credit line** (Track D, CC-BY only). Two keys, assembled in the component,
so no rendering decision depends on the punctuation of a translatable sentence:

```ts
// src/lib/snippets/en/puzzle.ts
drumCredit: 'Drum samples provided by DrumGizmo.org',   // unchanged — the anchor's text
rideCredit: ' and <Ride>',                              // new — rendered after the anchor closes

// src/lib/snippets/types.ts — PuzzleSnippets
rideCredit: string
```

```tsx
// src/features/daily-groove/components/puzzle/GrooveCard.tsx
<a href={DRUM_CREDIT_URL} …>{puzzle.drumCredit}</a>
{puzzle.rideCredit}
{' · '}
<a href={DRUM_CREDIT_LICENCE_URL} …>{DRUM_CREDIT_LICENCE}</a>
```

`<Ride>` is the attribution text the ride library's licence names, handed over by
Epic 1. The leading space lives **inside** `rideCredit`, not in the component: the
key owns every character it contributes to the line. `rideCredit` is the only key
added anywhere in this epic, and it is an attribution, not a notice — the
distinction narrowed AC7b turns on.

## Tracks

### Track A — the harmonic diff

- **Goal** — `manifestDiff.ts` can take two manifest sources and say, field by
  field, what moved and which bucket it falls in. No render involved.
- **Owns** — `scripts/grooves/manifestDiff.ts`, `scripts/grooves/manifestDiff.test.ts`
- **Role** — `implementer`. It owns files under `scripts/grooves/**`, but there is
  no musical judgement in a text diff: it decides nothing about how a groove is
  generated, and the `musician` writes no generator file. Track E is where this
  epic's musical decisions actually live.
- **Depends on** — the `ManifestDiff` contract only
- **Parallel with** — Tracks B, C, D
- **Done when** — `npm run test:gen` is green and the diff correctly buckets a
  moved `chord`, a moved `headDelaySeconds`, a moved `name`, an added groove and a
  changed distractor pool, from fixture text.

### Track B — the render report

- **Goal** — `rerenderReport.ts` classifies a fresh lock against the committed
  one, derives the expected changed set from the templates that declare `ride`,
  and turns a PCM map into a loudness table.
- **Owns** — `scripts/grooves/rerenderReport.ts`, `scripts/grooves/rerenderReport.test.ts`
- **Role** — `implementer`, for the reason given in Track A.
- **Depends on** — the `rerenderReport` contract; `Lock`/`LockEntry` from
  `lock.ts` and `rmsDbfs` from `level.ts`, both unchanged
- **Parallel with** — Tracks A, C, D
- **Done when** — `npm run test:gen` is green from hand-built locks and fake
  templates, with no groove rendered.

### Track C — the staged runner

- **Goal** — `rerender-check.ts` runs the PRD's order, stops at the first stage
  that fails, writes `report.json` only on a fully clean run, and promotes a
  scratch directory into the tree.
- **Owns** — `scripts/grooves/rerender-check.ts`, `scripts/grooves/rerender-check.test.ts`
- **Role** — `implementer`, for the reason given in Track A.
- **Depends on** — the Track A and Track B contracts (built against them, not
  behind them; the `render` seam means no groove is rendered in its tests)
- **Parallel with** — Tracks A, B, D
- **Done when** — `npm run test:gen` is green, including a case where a harmonic
  diff is present and the loudness and audio stages provably did not run.

### Track D — the credit line

- **Goal** — the credit line names both libraries on one line if the ride is
  CC-BY, with each name inside the link that points at it and the ride's name
  outside any link, and the `puzzle` snippet key set is pinned either way so R9 has
  a test behind it rather than a diff review.
- **Owns** — `src/lib/snippets/en/puzzle.ts`, `src/lib/snippets/types.ts`,
  `src/lib/snippets/snippets.test.ts`,
  `src/features/daily-groove/components/puzzle/GrooveCard.tsx`,
  `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`. No other track
  writes under `src/` except Track E, which writes only the generated manifest under
  `data/` — the two sets are disjoint.
- **Role** — `implementer`. Two snippet keys, a type member and four lines of a
  region component; nothing about it is a musical decision.
- **Depends on** — Epic 1's licence flag (CC0 or CC-BY, and the attribution text).
  Step D4 does not depend on it and runs either way.
- **Parallel with** — Tracks A, B, C
- **Done when** — `npm test` is green, and `git diff --numstat -- src/` names at
  most those five files.

### Track E — the migration

- **Goal** — the check runs clean, all eleven changed grooves and two controls
  have been played and signed off, and the audio, the manifest and the lock are in
  the tree together.
- **Owns** — `public/grooves/*.mp3`,
  `src/features/daily-groove/data/grooves.generated.ts`,
  `scripts/grooves/grooves.lock.json`. The notes artifacts are Epic 1's and are
  not written here.
- **Role** — `musician`. Every judgement in this track is a musical one: whether a
  groove that fell out of the loudness window is corrected in the pack or in the
  template `gain` (R4, Epic 1's method), what to listen for on each of the eleven,
  and whether what came back is right. It writes no generator file; the levelling
  corrections it decides land in Epic 1's owned files and are applied by an
  implementer, and the re-render then reruns from Step E2.
- **Depends on** — Tracks A, B, C landed. Epic 2 complete: both templates final and
  every groove inside its density band.
- **Parallel with** — nothing. It is the only track that writes the artifacts.
- **Done when** — `node scripts/grooves/rerender-check.ts` exits 0, the sign-off is
  recorded, `--promote` has run, and `npm run grooves:verify` is clean.

### Track F — verification

- **Goal** — the epic is proven end to end, including the one thing no local check
  can see: that a returning browser gets the new bytes.
- **Owns** — no files. It runs commands and reports.
- **Role** — `verifier`
- **Depends on** — Tracks D and E
- **Parallel with** — nothing
- **Done when** — every AC is traced to a passing check or a recorded observation.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D
- **Wave 2:** Track E — needs the runner to exist before a render is worth doing
- **Wave 3:** Track F — needs the committed tree

Wave 1 is genuinely parallel: A, B and C own disjoint files and C builds against
A's and B's frozen signatures rather than their implementations, and D is in `src/`
entirely. Track E cannot join them — it is one render of one catalogue into one
set of files, and every guard it depends on has to exist first. There is no way to
split E further: its steps are ordered by the PRD's spine, not by file ownership.

## Implementation

### Track A — the harmonic diff

#### Step A1 — a manifest's entries can be read back out of its own text

Covers: R2

- **Test first** — `scripts/grooves/manifestDiff.test.ts`: build a manifest source
  with `renderManifest` from `./manifest.ts` over two hand-made `Groove` entries,
  pass it to `readManifestEntries`, and assert the result is two entries whose
  `id`s are the two grooves' and whose `fields` hold every one of the fourteen
  field names with the literal text `renderManifest` wrote (`bpm` as `'105'`,
  `progressionDegrees` as `'[0, 2, 6, 3]'`, `scale` as `"'C mixolydian'"`). Run it:
  fails with `Cannot find module './manifestDiff.ts'`.
- **Implement** — `scripts/grooves/manifestDiff.ts`: `readManifestEntries(source)`
  takes the text between `export const GROOVES: Groove[] = [` and the closing `]`
  at column 0, splits it on the `  },` entry boundary `renderManifest` writes, and
  for each block reads `^    (\w+): (.*),$` into `fields`. An entry with no `id`
  field throws, naming the block — a manifest this cannot parse must fail loudly,
  never silently compare zero grooves.
- **Green when** — the round trip holds for both entries, suite stays green.
- **Refactor** — none.

#### Step A2 — a moved harmonic field is reported as harmonic

Covers: R2, AC2

- **Test first** — same file: render two manifests differing only in one entry's
  `chord`, and assert `diffManifests(a, b).harmonic` is exactly one `FieldDiff`
  with that `id`, `field: 'chord'`, and both literals; `unexpected` and `expected`
  are empty. Add a case per field in `HARMONIC_FIELDS` — nine cases, `it.each` over
  the list — so no field is silently dropped from the comparison. Run it: fails
  with `diffManifests is not a function`.
- **Implement** — `diffManifests` pairs entries by position, then by id, and for
  each pair walks the union of field names: a difference in `HARMONIC_FIELDS` goes
  to `harmonic`, one in `MAY_MOVE` to `expected`, anything else to `unexpected`.
- **Green when** — all nine cases pass.
- **Refactor** — none.

#### Step A3 — an added, removed or reordered groove is harmonic

Covers: R2, AC2

- **Test first** — same file: three cases — a manifest with a thirty-first groove,
  one with a groove removed, one with two grooves swapped. Assert each produces at
  least one `harmonic` entry naming the affected id with `field: 'id'`, and that a
  `null` on the committed side means added and a `null` on the rendered side means
  removed. Run it: fails — the current implementation pairs only by position and
  reports field diffs for the shifted entries.
- **Implement** — compare the id sequences first; any id present on one side only,
  or at a different index, is emitted as a `harmonic` `FieldDiff` before the
  field-by-field walk, and the walk then runs over the ids common to both.
- **Green when** — all three cases pass and the equal-manifest case still produces
  three empty buckets.
- **Refactor** — none.

#### Step A4 — a moved head delay is expected, and everything else is not

Covers: R5, AC2

- **Test first** — same file: (a) two manifests differing only in one entry's
  `headDelaySeconds` → `expected` holds exactly that diff, `harmonic` and
  `unexpected` are both empty; (b) differing only in `name` → `unexpected` holds
  it; (c) differing only in `audioSrc` → `unexpected`; (d) identical `GROOVES` but a
  changed `SCALE_POOL` value in the tail → `unexpected` holds one entry with
  `id: '(manifest tail)'`. Run it: (d) fails — the tail is not compared at all.
- **Implement** — after the entry walk, compare the text following the `GROOVES`
  array verbatim and push one `unexpected` entry when it differs, with the first
  differing line on each side as the literals.
- **Green when** — all four pass. A `headDelaySeconds` move is the only difference
  this function will ever call benign.
- **Refactor** — none.

### Track B — the render report

#### Step B1 — the changed and unchanged grooves are separated by hash

Covers: R1, AC1

- **Test first** — `scripts/grooves/rerenderReport.test.ts`: build two `Lock`
  objects with four groove rows, two of them with differing `sha256`, and assert
  `classifyAudio` returns those two ids in `changed`, the other two in `unchanged`,
  and empty `missing`/`extra`. Run it: fails with `Cannot find module
  './rerenderReport.ts'`.
- **Implement** — `scripts/grooves/rerenderReport.ts`: `classifyAudio` walks the
  committed rows, looks each id up in the rendered rows, and compares `sha256` and
  `bytes`. Differing bytes with an equal hash is impossible and goes to `changed`.
- **Green when** — the four ids land in the right two buckets.
- **Refactor** — none.

#### Step B2 — a groove that did not render, or that appeared, is not a "change"

Covers: R1, AC1

- **Test first** — same file: a rendered lock missing one committed id → that id
  is in `missing` and in neither `changed` nor `unchanged`; a rendered lock with an
  id the committed lock does not have → `extra`. Run it: fails — the current walk
  ignores unmatched rows on both sides.
- **Implement** — collect ids absent from the rendered side into `missing`, and ids
  absent from the committed side into `extra`.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step B3 — the expected set is whichever templates declare a ride

Covers: R1, AC1

- **Test first** — same file: five fake specs across three fake templates, two of
  which have `ride` in `voices`; assert `ridingIds` returns exactly the specs on
  those two, in catalogue order. Add a second case with one riding template, and
  assert the returned list shrinks accordingly — the narrowing Epic 2's R4 allows
  must need no edit here. Then: `compareChanged` over a classification whose
  `changed` equals the expected set returns two empty arrays; drop one id from
  `changed` and it appears in `missed`; add a non-riding id and it appears in
  `surprising`. Run it: fails with `ridingIds is not a function`.
- **Implement** — `ridingIds(specs, templateFor)` filters on
  `templateFor(spec.template).voices.includes('ride')`; `compareChanged` is two set
  differences.
- **Green when** — all four cases pass.
- **Refactor** — none. The count eleven appears nowhere in the source.

#### Step B4 — every groove's loudness is measured against the window

Covers: R4, AC4

- **Test first** — same file: a `Map` of three fake `Pcm` buffers — one at roughly
  −24 dBFS, one near silence, one near full scale — and assert `loudnessTable`
  returns one row per id in insertion order, with `dbfs` matching `rmsDbfs` from
  `./level.ts` and `inWindow` true only for the middle one, using
  `LOUDNESS_FLOOR_DB` and `LOUDNESS_CEILING_DB` imported from `./gate.ts` rather
  than literals. Then assert `formatLoudness` marks each out-of-window row with the
  dB it is out by, so a levelling correction has a number to work from. Run it:
  fails with `loudnessTable is not a function`.
- **Implement** — `loudnessTable` maps over the entries calling `rmsDbfs`;
  `formatLoudness` renders `id  −24.1 dBFS  ok` / `id  −18.7 dBFS  1.3 dB above the ceiling`.
- **Green when** — three rows, one in the window, and the two failing rows carry
  their distance from the band.
- **Refactor** — none. The window is never redefined here; widening it would mean
  editing `gate.ts`, which R4 forbids.

### Track C — the staged runner

#### Step C1 — the runner is a testable `main`, and renders into a scratch directory

Covers: R1

- **Test first** — `scripts/grooves/rerender-check.test.ts`: call `main` with a
  fake `render` that writes a two-groove manifest and lock into the `scratchDir` it
  was handed, a `log` collector, and fixture `lockPath`/`manifestPath` under a
  `mkdtemp` directory. Assert the fake `render` was called with `outDir`,
  `manifestPath` and `lockPath` all inside `scratchDir`, and that nothing under the
  repo's `public/grooves/` or the real manifest path was written (assert by
  comparing their mtimes before and after). Run it: fails with `main is not a
  function`.
- **Implement** — `scripts/grooves/rerender-check.ts` is rewritten from a
  top-level script into an exported `async function main(options)` plus the
  `import.meta.filename` guard from `verify-cli.ts`. `render` defaults to
  `generate` from `./cli.ts`, `scratchDir` to `mkdtempSync(join(tmpdir(), 'groove-rerender-'))`.
- **Green when** — the render target is entirely inside the scratch directory and
  the tree is untouched.
- **Refactor** — none.

#### Step C2 — a moved harmonic field stops everything

Covers: R2, AC2

- **Test first** — same file: a fake render whose manifest differs from the
  committed fixture in one entry's `root`. Assert `main` resolves to `1`, that the
  log names the groove, the field and both values, and that the log contains
  **neither** a loudness row nor a changed-hash count — the later stages did not
  run. Assert no `report.json` exists in the scratch directory. Run it: fails —
  `main` returns 0 and never diffs.
- **Implement** — stage 2 reads both manifest files with `readFileSync`, calls
  `diffManifests`, and on any `harmonic` or `unexpected` entry logs a headline
  naming the count, one line per diff, and returns 1 before stage 3 is reached.
- **Green when** — exit 1, the diff is printed, and the later stages left no trace.
- **Refactor** — none. This is the stage the whole epic exists to make unskippable.

#### Step C3 — the changed audio must be exactly the riding feels' grooves

Covers: R1, AC1

- **Test first** — same file, harmonic diff clean in all cases: (a) the fake
  render's lock changes exactly the ids whose fixture template declares `ride` →
  `main` resolves to 0 and the log names the count and lists them; (b) one extra
  non-riding id changed → resolves to 1, and the log names it under a heading that
  says it was not expected to change; (c) one riding id unchanged → resolves to 1
  and names it as expected to change but did not. Run it: fails — no classification
  stage exists.
- **Implement** — stage 4 reads the committed and scratch locks with `readLock`,
  the catalogue with `readCatalogue`, resolves templates with `templateById`, and
  runs `classifyAudio` / `ridingIds` / `compareChanged`. Any non-empty `missed`,
  `surprising`, `missing` or `extra` logs and returns 1.
- **Green when** — all three cases behave, and the count in the log comes from the
  data rather than from a constant.
- **Refactor** — none.

#### Step C4 — a groove outside the loudness window stops the run before the count

Covers: R4, AC4

- **Test first** — same file: a fake render whose `pcm` map holds one near-silent
  buffer. Assert `main` resolves to 1, the log holds the full `formatLoudness`
  table for every groove (not only the failing one — a levelling pass needs to see
  the whole picture), and the log holds no changed-hash count. Run it: fails —
  loudness is never measured.
- **Implement** — stage 3 calls `loudnessTable(pcm)` on the render's returned map;
  if any row is out of the window, log the table and return 1. On success, keep the
  rows for the report.
- **Green when** — exit 1, the table is complete, stage 4 did not run.
- **Refactor** — none.

#### Step C5 — a clean run prints the listening list and writes the report

Covers: R11, R12, AC9

- **Test first** — same file, the all-clean case from C3(a): assert the log names
  every changed groove with its absolute path under `<scratchDir>/grooves/` and its
  template, and names two unchanged controls, at least one of them from a template
  that is not a riding feel, with their paths. Assert `<scratchDir>/report.json`
  parses as a `RenderReport` whose `grooves` equal the scratch lock's rows, whose
  `changed` equals the changed ids, and whose `loudness` has one row per groove.
  Run it: fails — no report is written.
- **Implement** — stage 5 logs the checklist and writes `report.json`. The controls
  are picked deterministically: the first unchanged id whose template is
  `half-time`, and the first unchanged id from any other non-riding template.
- **Green when** — the checklist is complete and the report round-trips.
- **Refactor** — none.

#### Step C6 — promotion copies the listened bytes, and only those

Covers: R1, R3, AC3

- **Test first** — same file: given a scratch directory holding a green run's
  output and its `report.json`, call `main({ promoteFrom: scratchDir, ... })`
  against fixture destination paths, and assert the destination mp3s are
  byte-identical to the scratch ones, the destination manifest is byte-identical to
  the scratch manifest, and the destination lock's `grooves` and `manifestSha256`
  come from the scratch render **while its `notes`, `notesManifestSha256` and
  `packSha256` are the committed lock's, unchanged**. Then two refusals: mutate one
  scratch mp3 after the report was written → resolves to 1 naming the file; delete
  `report.json` → resolves to 1 saying the directory was never checked. Run it:
  fails — `promoteFrom` is not handled.
- **Implement** — the promote path re-hashes every file named in `report.json`,
  refuses on any mismatch, then copies, then
  `writeLock(mergeLock(readLock(committed), scratchLock), lockPath)`, then runs
  `verifyLock` over the destination and returns 1 with the failures if it is not
  clean.
- **Green when** — both refusals fire and the happy path leaves a tree that
  `verifyLock` accepts with its note rows intact.
- **Refactor** — none.

### Track D — the credit line

#### Step D1 — the credit is unchanged when the ride is CC0

Covers: R8, AC5

- **Test first** — nothing new. `src/lib/snippets/snippets.test.ts`'s existing
  *"holds the drum credit under puzzle (F22 E2 R8)"* case already pins the exact
  string, and it must stay green untouched.
- **Implement** — nothing. If Epic 1 flagged the ride CC0, Steps D2 and D3 are
  skipped, none of Track D's four source files is opened, and the track is D4
  alone.
- **Green when** — `npm test` green with no `src/` diff outside D4's test file.
- **Refactor** — none.

#### Step D2 — the second attribution is its own snippet

Covers: R6, R7c, AC5 · **CC-BY only**

- **Test first** — `src/lib/snippets/snippets.test.ts`: leave the existing drum
  credit case exactly as it is — `drumCredit` does not change, and a green
  untouched case is what proves it — and add one beside it asserting
  `snippets.puzzle.rideCredit` is `' and <Ride>'` with the real attribution text
  substituted, that it starts with `' and '` including the leading space, and that
  `drumCredit + rideCredit` reads `Drum samples provided by DrumGizmo.org and <Ride>`.
  The leading-space assertion is the one that matters: the key owns every character
  it contributes, so nothing about the line is decided in JSX. Run it: fails with
  `expected undefined to be ' and …'`.
- **Implement** — `src/lib/snippets/en/puzzle.ts`: add `rideCredit` after
  `drumCredit`. `src/lib/snippets/types.ts`: add `rideCredit: string` to
  `PuzzleSnippets`, in the same position — the `satisfies PuzzleSnippets` on the
  object is what makes the two files fail together if only one is edited.
- **Green when** — `npm test` green, with the F22 drum-credit case passing
  unedited.
- **Refactor** — none.

#### Step D3 — the ride's name renders on the line, outside every link

Covers: R6, R7, R7b, AC5, AC6 · **CC-BY only**

- **Test first** — `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`,
  in the existing *"the drum samples credit"* block: a new case rendering
  `<GrooveCard groove={GROOVE} meta={metaFor(GROOVE)} />` and asserting (a) the
  credit paragraph's `textContent` is
  `` `${puzzle.drumCredit}${puzzle.rideCredit} · CC BY 4.0` ``; (b)
  `within(paragraph).getAllByRole('link')` has length **2**, so R7b's third-anchor
  ban has a test rather than a promise; (c) no link's `textContent` contains the
  ride's name — `screen.getAllByRole('link').every(a => !a.textContent.includes(RIDE))`
  — which is the assertion the whole decision in the log below turns on. Run it:
  fails, the paragraph reads `…DrumGizmo.org · CC BY 4.0`.
- **Implement** — `GrooveCard.tsx`: render `{puzzle.rideCredit}` between the
  closing `</a>` of the DrumGizmo link and the existing `{' · '}` separator. Four
  lines, no new constant, no new element, no change to either `href`.
- **Green when** — the new case passes **and all seven existing credit cases pass
  unedited**: `drumCredit` is unchanged, so `getByRole('link', { name: SOURCE })`,
  the href-order assertion and the `getAllByRole('link', { name: puzzle.drumCredit })`
  length-1 assertion all still hold. An existing case that needed editing means the
  ride's name leaked into the anchor.
- **Refactor** — none. `DRUM_CREDIT_LICENCE` and both URLs stay hard-coded where
  they are; they are targets, not user-facing prose, and moving them is not this
  epic's business.

#### Step D4 — the app gains no wording that speaks to the player

Covers: R9, AC7b

- **Test first** — `src/lib/snippets/snippets.test.ts`: a new case asserting
  `Object.keys(snippets.puzzle).sort()` equals the exact list the file holds — the
  twenty-three keys committed today, plus `rideCredit` and only `rideCredit` if
  Step D2 ran. Written out in full, not computed. Run it against a deliberately
  added scratch key and it fails naming the extra one; remove the scratch key and it
  passes.
- **Implement** — nothing in source. The test is the implementation. AC7b as
  narrowed forbids a snippet that tells the player about the re-render, and this
  pin is what makes any such addition fail loudly: the only key this epic may add
  is the attribution key Step D2 names, and it is listed here by name so a second
  addition cannot hide behind it.
- **Green when** — `npm test` green, and the case fails when any other key is added
  or any key is removed.
- **Refactor** — none.

### Track E — the migration

The steps are ordered by the PRD's spine and each one's precondition is the
previous one's exit code. None may be reordered.

#### Step E1 — the tree verifies before anything is rendered

Covers: R3, AC3

- **Test first** — `npm run grooves:verify` on the tree as Epics 1–2 left it,
  before a single groove is re-rendered. It must exit 0 on all six of the things
  `verifyLock` checks — the thirty audio files, the twenty-four notes, both
  manifests, the catalogue and `packSha256`.
- **Implement** — nothing. Epic 1's Track G already refreshed the pack row
  (its R5b, AC14b), so this is a precondition, not a repair. A `pack-stale` here
  means Epic 1's Track G did not land and is reported back to Epic 1; a
  `checksum` or `manifest-stale` here means the tree was hand-edited. **This
  epic does not run `npm run notes`.**
- **Green when** — `grooves:verify — 30 grooves, 24 notes, the manifests and the
  catalogue all match the lock.` Only then does Step E2 render anything.
- **Refactor** — none.

#### Step E2 — render to scratch and prove no answer moved

Covers: R1, R2, R5, AC1, AC2

- **Test first** — `node scripts/grooves/rerender-check.ts`. Stage 2 must report
  only `headDelaySeconds` moves, on the changed grooves and nowhere else.
- **Implement** — nothing, if it is clean. A `harmonic` entry stops the epic and is
  reported: a moved answer means Epic 1 or 2 touched something under *What must
  never change* in `docs/music.md`, and the fix is there, not here.
- **Green when** — the run reaches stage 3.
- **Refactor** — none.

#### Step E3 — the gate passes on all thirty

Covers: R4, AC4

- **Test first** — `npm run test:gen`. `scripts/grooves/catalogue-gate.test.ts`
  renders every catalogue spec through all seven `gateCandidate` checks; a failing
  case names the check and the detail.
- **Implement** — nothing, if green. A `loudness` failure is corrected by Epic 1's
  method and in its order — the pack's `nominalVelocity` first, the template `gain`
  only after — using the dB distances stage 3 of the runner printed. The band in
  `gate.ts` is not touched. Any correction lands in Epic 1's or Epic 2's files, and
  the migration restarts from Step E2.
- **Green when** — thirty passing gate cases, and the runner's stage 3 table has
  every row inside −29…−20 dBFS.
- **Refactor** — none.

#### Step E4 — the changed set is exactly the riding feels

Covers: R1, AC1

- **Test first** — the same runner invocation, now reaching stage 4. It lists the
  changed ids and compares them with the ids the catalogue assigns to the templates
  declaring `ride`.
- **Implement** — nothing. A mismatch either way stops the epic: an unexpected
  groove changing means a shared code path moved, and an expected groove not
  changing means the ride never reached it.
- **Green when** — exit 0, `report.json` written, the checklist printed.
- **Refactor** — none.

#### Step E5 — the listening sign-off

Covers: R11, R12, AC9

- **Test first** — none that a machine can run. This is the check feature-13's
  ride failed.
- **Implement** — play every changed groove from the scratch directory, one at a
  time, in the order the checklist prints, plus the two controls. Record per groove:
  its id, its template, its bpm and its key, and whether the cymbal is right *on
  that groove* — a ride that works at 82 in one key can be wrong at 91 in another.
  For the two controls, that they are indistinguishable from the committed files,
  which are still on disk and can be A/B'd directly. Deliver the hand-off the way
  Epic 1 established it: paths and what to listen for.
- **Green when** — every changed groove and both controls are signed off. One "not
  right" sends the fix back to Epic 1 or 2 and the migration restarts at Step E2.
- **Refactor** — none.

#### Step E6 — promote, and commit the three artifacts together

Covers: R1, R3, AC3

- **Test first** — `npm run grooves:verify` before promotion still describes the
  old tree; after promotion it must describe the new one.
- **Implement** — `node scripts/grooves/rerender-check.ts --promote <scratchDir>`,
  where `<scratchDir>` is the directory that was listened to. It re-hashes, copies
  the mp3s and the manifest, merges the lock, and re-verifies. Then one commit
  carrying the eleven changed `public/grooves/*.mp3`,
  `src/features/daily-groove/data/grooves.generated.ts` and
  `scripts/grooves/grooves.lock.json`. `scripts/grooves/catalogue.json` is
  unchanged and stays that way, and so are the notes artifacts Epic 1 committed —
  the merged lock keeps their rows untouched (Step C6).
- **Green when** — `npm run grooves:verify` exits 0 on the committed tree.
- **Refactor** — none.

#### Step E7 — the player is told nothing

Covers: R9, AC7

- **Test first** — `npm test`. The whole app suite, including
  `src/features/daily-groove/data/grooves.generated.test.ts`, the persistence and
  streak tests, and Track D's key-set pin, runs against the new manifest and must
  be green with no edits.
- **Implement** — nothing. An app test that needed changing would mean an answer
  moved, and Step E2 should already have stopped for it.
- **Green when** — `npm test` green with no diff under `src/` beyond Track D's five
  files and the regenerated manifest under `data/`.
- **Refactor** — none.

## Integration and verification

Track F, in order:

1. **The full set.** `npm test`, `npm run test:gen`, `npm run lint`, `npm run build`.
   The build runs `grooves:verify` on `prebuild`, so a stale lock, a stale manifest
   or a stale pack declaration fails the build rather than shipping. (AC3, AC10)
2. **The `src/` diff, read.** `git diff --numstat -- src/` names at most Track D's
   five files plus the regenerated manifest under `src/features/daily-groove/data/`.
   `git diff -U0 -- src/lib/snippets/en/puzzle.ts` shows one added line and no
   changed one — `drumCredit` keeps its words — and
   `git diff -U0 -- src/features/daily-groove/components/puzzle/GrooveCard.tsx`
   shows one added line inside the credit paragraph and nothing else. If the ride is
   CC0, all five files are absent from the diff. (AC5, AC7b)
3. **The demo path, locally.** `npm run dev`; open the app on a day that resolves to
   a `shuffle` groove (or open that groove's share link directly), press play, hear
   a cymbal keeping time. Open a `half-time` groove's share link and hear no
   difference. On the groove box, one credit line renders where it always has, in
   the same faint type, reading `Drum samples provided by DrumGizmo.org and <Ride> ·
   CC BY 4.0` and carrying exactly two links — `Drum samples provided by
   DrumGizmo.org` and `CC BY 4.0`. Hovering the first shows drumgizmo.org and the
   ride's name is not part of it. (AC5, AC6, R7b)
4. **The stored result survives.** With a `localStorage` result recorded before the
   feature — kept from before the re-render, or restored from a copy — open the app
   and that groove's share link: the puzzle, the answer, the attempts and the streak
   are what they were, and the only difference is the audio. (AC7)
5. **The deployed cache, verified not assumed.** After deploy, in a browser that
   played a `shuffle` groove before it: open the app on that groove, and confirm in
   the network panel that `/grooves/<id>.mp3` came back `200` with the new
   `content-length` (the value the lock records), not `304` or `(disk cache)` with
   the old one. If it serves stale, that is a cache-header finding to report, not a
   reason to rename the file — the PRD's assumption is that `public/` is
   revalidated, and this is the step that tests it. (AC8, R10)
6. **The sign-off, recorded.** Step E5's per-groove notes are part of the epic's
   report. The feature is not done without them. (AC9)

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, B2, B3, C1, C3, C6, E2, E4, E6 |
| R2 | A1, A2, A3, C2, E2 |
| R3 | C6, E1, E6, F1 |
| R4 | B4, C4, E3 |
| R5 | A4, E2 |
| R6 | D2, D3 |
| R7 | D3 |
| R7b | D3, F3 |
| R7c | D2 |
| R8 | D1 |
| R9 | D4, E7 |
| R10 | F5 |
| R11 | C5, E5 |
| R12 | C5, E5 |
| AC1 | B1, B2, B3, C3, E4 |
| AC2 | A1, A2, A3, C2, E2 |
| AC3 | C6, E1, E6, F1 |
| AC4 | B4, C4, E3 |
| AC5 | D1, D2, D3, F2 |
| AC6 | D3, F3 |
| AC7 | E7, F4 |
| AC7b | D4, F2 |
| AC8 | F5 |
| AC9 | C5, E5, F6 |
| AC10 | F1 |

## Assumptions

- **The second attribution key is named `rideCredit`, and its leading space is
  part of its value.** The alternative — no leading space, with `{' '}` in the
  component — puts a character of the rendered sentence back in JSX, which is the
  half of R7c that is about where user-facing text lives. Step D2 pins the leading
  space so a formatter or a careless edit fails a test rather than closing up the
  line.
- **The runner is invoked as `node scripts/grooves/rerender-check.ts`, and
  `package.json` gains no script.** That is how `specs/quick/2-always-four-chords.md`
  and feature-20's spec already invoke it, and this epic should not be the one that
  invents a command.
- **Promotion copies rather than re-renders.** The alternative — `npm run grooves`
  after listening — renders thirty grooves a second time and relies on determinism
  to make the committed bytes the listened bytes. Determinism holds
  (`catalogue-gate.test.ts` asserts it) but copying makes it a fact rather than an
  inference, and costs one full render less.
- **The expected changed set is derived from `voices.includes('ride')`, never
  written as eleven.** If Epic 2 narrowed to one riding feel, the check expects six
  and this spec needs no edit. No step names the number.
- **The lock's `packSha256` is already current when this epic starts.** Epic 1's
  Track G runs `npm run notes` and asserts that only that field moves, with all
  twenty-four note mp3s byte-identical (its R5b, AC14b). This spec relies on that
  assertion rather than repeating it, and Step E1 checks the result rather than
  re-deriving it.
- **Tracks A, B and C take `implementer` rather than `musician`** although they own
  files under `scripts/grooves/**`. Nothing in a text diff, a hash comparison or a
  staged CLI decides how a groove is generated, and the `musician` writes no
  generator file. Track E, which owns every musical judgement this epic makes — the
  levelling correction and the listening sign-off — takes it.
- **Track E's levelling corrections land in Epic 1's and Epic 2's files, not this
  epic's.** A groove outside the loudness window is fixed in `samples/pack.json` or
  a template's `gain`; this epic re-renders afterwards. That is why Track E owns no
  file under `scripts/grooves/` except the lock.
- **`heard-in.json` and the distractor pools do not move**, and Step A4's tail
  comparison is what proves it rather than an assumption anyone has to hold.
- **`scripts/grooves/catalogue.json` is not edited by this epic**, so the lock's
  `catalogueSha256` does not move and the uuids cannot.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-09-05

**Q1. The grown credit sits inside the DrumGizmo link — is that the attribution
you want to ship?**
Decision: **B) Split the anchor so each name links to its own source.** Only the
DrumGizmo half is the link's text; the ride's name renders after the anchor
closes, as plain text between the two existing links. A link must not have inside
it the name of something it does not point at, and the alternative — accepting the
imprecision because Epic 1's licence bar makes the second failure mode
unreachable — traded an accuracy problem for a coincidence.

The PRD moved with it: R6 now says only the DrumGizmo half is the anchor's text,
R7b keeps the third-anchor ban with the ride's name as plain text between the two,
and **new R7c** requires the line to be assembled from two snippet keys rather
than by splitting one sentence in the component. AC5 asserts the rendered line and
both snippet values. **AC7b was narrowed**: it had forbidden adding any snippet
key at all, which is what made this rendering illegal in the first place, but it
was written to enforce R9 — the app says nothing to the player about the
re-render — and an attribution is not a notice. It now forbids only a snippet that
speaks to the player about the change.

Changed here: the Approach paragraph, the Contracts section (which now carries the
two-key shape and the JSX assembly instead of one combined string), Track D's Goal
and owned files — it gains `src/lib/snippets/types.ts`,
`GrooveCard.tsx` and `GrooveCard.test.tsx`, and is a component edit rather than a
one-string change — Steps D1–D4 rewritten, the coverage table (new R7c row; AC5
gains D3), Integration steps 2 and 3, and one new assumption about the key's name
and its leading space.

What it cost: Track D is no longer confined to `src/lib/snippets/`, so this epic
touches a region component after all. The blast radius is four lines of JSX and one
new test case, all seven existing credit cases stay green unedited because
`drumCredit` keeps its words, and no other track writes either file.
