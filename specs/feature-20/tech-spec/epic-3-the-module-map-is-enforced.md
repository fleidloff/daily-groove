# Tech spec — Epic 3: The module map is written down and enforced

PRD: [../prd/epic-3-the-module-map-is-enforced.md](../prd/epic-3-the-module-map-is-enforced.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This epic writes no feature behaviour. It rescopes one component's presentation
imports onto the door Epic 2 builds, adds three ESLint zones, two structural
guards and four documents — and its whole value is that the guards fire.

**One door, not five.** The guard follows the measured growth.
`lib/presentation/` went from two modules to eleven and supplies six of
`GroovePuzzle.tsx`'s fifteen direct `lib/` imports; theory (4), audio (3),
puzzle (1) and persistence (1) have been stable across nineteen features. Epic 2
already builds the coaching door, so holding the shell to it costs two steps and
no new production file, and the four folders that have not grown keep their
direct imports. A door for each of them was priced and cut.

So the shape is built around one question: **how does a guard get seen to
fail?** For the two structural guards the answer is not a manual break recorded
in a report, which is a demonstration that expires the moment someone edits the
file. Each guard is split into a **pure predicate** and a **disk read**: the
predicate is unit-tested against a hand-written violating source string, so
"this rule fires" is a permanent case in the suite, and the disk read applies it
to the real file. The `src/lib/hash.test.ts` precedent applies to both — a guard
that reads source has to keep itself out of its own search — so the synthetic
violation is assembled from a fragment rather than written as a literal path, or
the guard would count itself as an importer. The three ESLint zones cannot be
demonstrated that way (a fixture violating a zone would fail `npm run lint` for
everyone), so they are demonstrated once by hand, and *Track D* names the exact
throwaway import line and the exact expected message for each.

Second: **the coaching door's export list is derived from the tree, not written
down here.** Epic 2 lands between this spec and its execution, folding the
shell's derived state into one view model consumed by `GuessCard`, so the exact
names the shell still needs from `lib/presentation/` are not knowable today.
*Contracts* C3 freezes the *rule* — the door exports exactly what its consumers
use — and records today's measured baseline as the expectation to re-measure
against.

Third: **the map is corrected against the tree, not the other way round.** R1a
says so, and three of R1b's arrow lines do not survive measurement. C7 records
the corrections with the measurement behind each; Track C writes the corrected
list.

## Architecture

### The one door, and the four folders that get none

```
map module          behind a door                    reached directly by the shell
──────────────────────────────────────────────────────────────────────────────────
catalogue           —                                scripts/grooves/, data/
theory              —                                src/lib/theory/ (4 modules)
audio               —                                lib/audio/ (3 modules)
puzzle              —                                lib/puzzle/ (1), lib/persistence/ (1)
coaching            lib/presentation/index.ts  ←     the epic's one door
shell               —  (GroovePuzzle.tsx, the routes, lib/share/)
```

Three consequences a reader will trip on if they are not said out loud:

- **A door is earned, not granted.** `lib/presentation/` has one because it grew
  — two modules to eleven — and because a composer holding six imports into one
  folder is the shape `coding-guidelines.md` already calls "the tell". A folder
  that has been stable for nineteen features does not need one, and a
  speculative door is a barrel with no measurement behind it. Track C writes
  this as the rule (Step C2), because it is the question a worker will ask when
  it adds a twelfth module to some other folder.
- **The map still groups differently from the doors.** For coaching the two
  coincide — the module *is* one concern folder — but the map's `puzzle` spans
  `lib/puzzle/` and `lib/persistence/`, and its `audio` includes three hooks
  outside `lib/audio/`. R2a asks for that difference to be stated with the map,
  and it is stated for the modules that have no door as much as for the one that
  does.
- **The door binds one file.** `GroovePuzzle.tsx` is the only file held to it
  (R3b). Five other files under `components/` keep importing `lib/presentation/`
  modules by relative path, and `GuessCard.tsx` importing the door is Epic 2's
  design rather than an instance of this rule.

### Where each guard lives

```
src/features/daily-groove/structure.test.ts
    ├── the shell reaches lib/presentation/ only through the door  (R3, R3a, R3b)
    ├── the coaching door is narrow                                (R4, R4a)
    └── no import resolves to the old lib/theory/ path             (R8)

eslint.config.mjs · zones 6, 7, 8                                  (R7)
```

One test file, one config file. There is no new file under `src/lib/` and none
under `scripts/`: with no theory door, Epic 3 has no generator-side work at all
(see *Execution waves*).

### What does not change

- The shell's nine other direct `lib/` imports: four into `src/lib/theory/`,
  three into `lib/audio/`, one into `lib/puzzle/`, one into `lib/persistence/`.
  Untouched, and the fan-in guard is written so it does not look at them (R3a).
- `../types`, `../data/*` and `../hooks/*` in `GroovePuzzle.tsx`. Eight
  specifiers, untouched (R3a).
- Every file in the slice other than `GroovePuzzle.tsx`. Twenty region-component
  imports of `lib/presentation/`, twenty-three of theory, twelve hook imports of
  `lib/audio/` — all keep their relative paths (R3b).
- `src/lib/theory/`, beyond the placement bar Step C4 rewrites. No door, no new
  test, no change to what Epic 1 leaves.
- `scripts/grooves/` and `scripts/tiers.ts`. Epic 1 owns the `src/lib/`
  boundary assertion, the `Flavour` assertion and the narrowed tier trigger;
  with no theory door there is nothing for this epic to add.
- `lib/share/`. No door: the shell does not import it, and only
  `components/header/ShareGroove.tsx` and the feature's `index.ts` do.
- Every rendered string, every behaviour (R11).

## Contracts

Frozen before any track starts.

### C1 — The door path

One, named by the map, the guideline rule and the guard. Fixed:

```
src/features/daily-groove/lib/presentation/index.ts    the coaching door — created by Epic 2
```

`src/lib/theory/`, `lib/audio/`, `lib/puzzle/` and `lib/persistence/` get no
`index.ts` in this epic. That is a decision, not an omission — see *Approach*
and PRD Out of scope.

### C2 — The shell's presentation import, after

The only `lib/presentation`-touching specifier `GroovePuzzle.tsx` may contain:

```ts
import { … } from '../lib/presentation'
```

Everything else the shell imports is unchanged, **including its direct imports of
the four folders that get no door**: `@/lib/theory/*`, `../lib/audio/*`,
`../lib/puzzle/selectGroove`, `../lib/persistence/storage`, plus `react`,
`../types`, `../data/*`, six `../hooks/*`, the region components under
`./header/`, `./intro/`, `./puzzle/`, `./solved/`, and `@/components/*`.

### C3 — The door's export list is derived, and this is the baseline

**The rule, frozen:** the coaching door exports exactly the names its consumers
import through it, plus nothing. No `export *`. The implementer reads the
shell's remaining direct `lib/presentation/` imports and adds them to the door.

**The baseline, measured on the tree today.** `GroovePuzzle.tsx` reaches six
`lib/presentation/` modules:

| Module | Names the shell imports today | After Epic 2 |
| :-- | :-- | :-- |
| `feedback` | `selectFeedback`, `shouldOfferReveal`, `shouldShowNudge` | folded into the view model |
| `coaching` | `selectCoaching` | folded into the view model |
| `verdict` | `shouldShowVerdict` | folded into the view model |
| `confirmed` | `confirmedHalves` | folded into the view model |
| `ruledOut` | `ruledOut` | folded into the view model |
| `date` | `metaLine` | **expected to remain** |

`date` is explicitly not coaching per Epic 2's scope, but it lives in
`lib/presentation/` and the door is per folder — so `metaLine` is the name this
epic expects to add to Epic 2's door. Re-measure: if Epic 2 leaves the shell
needing nothing from `lib/presentation/`, Step A3 adds nothing and Step A4 is a
deletion, which is the better outcome and not a failure.

### C4 — The narrow-door predicate

Two pure functions in `src/features/daily-groove/structure.test.ts`, unit-tested
on synthetic input before either reads disk.

```ts
// fails on sight if the source matches /export\s*\*/
function doorExports(source: string): string[]
// names inside `export { a, b as c, type D } from './x'`
// plus `export (const|function|type|interface) X`
// `b as c` contributes `c` — the name a consumer writes

function importedNamesFrom(source: string, importerPath: string, doorDir: string): string[]
```

**Resolution rule.** A specifier resolves to the door when, after mapping a
leading `@/` to `src/`, resolving a leading `.` against the importing file's
directory, and stripping a trailing `/index.ts`, `/index` or `.ts`, the result
equals `doorDir`. This accepts `'../lib/presentation'` and
`'../../lib/presentation'` and rejects `'../lib/presentation/feedback'`.

**Scan set.** Every `.ts`/`.tsx` under `src/`, tests included, minus the door
file itself and minus the guard file
(`src/features/daily-groove/structure.test.ts`). Excluding the guard is what
keeps it from counting its own synthetic fixture as an importer. `scripts/` is
not scanned: zone 5 forbids the generator from reaching a feature at all, so no
`scripts/` file can be an importer of this door.

**Failure.** For each door export with no importer:

```
lib/presentation/index.ts exports `metaLine`, and nothing in the repo imports it
through the door. Import it through the door or delete the line — a door exports
what its consumers use and nothing more (R4). This is a one-line fix.
```

For `export *`: `lib/presentation/index.ts uses \`export *\`. A door lists its
exports by name, or it is a barrel and the fan-in rule it serves means nothing
(R4a).`

### C5 — The fan-in predicate

```ts
function deepCoachingSpecifiers(source: string): string[]
```

Returns every import, dynamic-import or `vi.mock` specifier that names a path
*inside* `lib/presentation/` — matching `(^|/)lib/presentation/.+` after mapping
`@/` to `src/` — and nothing else. It returns `[]` for
`'../lib/presentation'`, `'../types'`, `'../data/grooves.generated'`,
`'../hooks/useProgress'`, `'@/components/surfaces/Card'` **and for the shell's
four undoored folders**: `'@/lib/theory/music'`, `'../lib/audio/output'`,
`'../lib/puzzle/selectGroove'`, `'../lib/persistence/storage'`.

That last clause is the point of the epic's scope and it is asserted, not
assumed: a guard that quietly widened to every `lib/` folder would fail the tree
this epic deliberately leaves.

Applied to exactly one file:
`src/features/daily-groove/components/GroovePuzzle.tsx` (R3b). The routes are
already covered by `src/app/route-boundary.test.ts`.

### C6 — The three new zones

Appended to the `zones` array of the existing `daily-groove/import-boundaries`
block. `target` is the importing side, `from` the imported side, as the five
existing zones use them. `F = "src/features/daily-groove"`.

| # | `target` | `from` | Rule |
| :-- | :-- | :-- | :-- |
| 6 | `` `${F}/lib` `` | `src/components`, `` `${F}/components` ``, `` `${F}/hooks` ``, `` `${F}/state` `` | No `lib/` module imports UI, hooks or the store. Business logic does not depend on what renders it. |
| 7 | `` `${F}/lib/audio` `` | `` `${F}/lib/presentation` ``, `` `${F}/lib/puzzle` ``, `` `${F}/lib/persistence` `` | Audio imports neither coaching nor the puzzle module. It plays sound; it does not know the game. |
| 8 | `` `${F}/lib/puzzle` ``, `` `${F}/lib/persistence` `` | `` `${F}/lib/presentation` ``, `` `${F}/lib/audio` `` | The puzzle module imports neither coaching nor audio. The rules of the game do not depend on how they are described or heard. |

Zone 6 subsumes R7's "coaching does not import the design system or the shell"
as one case of a stronger rule, which is why R7's four cases become three zones.
`` `${F}/testing` `` is deliberately absent from zone 6's `from`: five
`lib/audio/*.test.ts` files import `../../testing/fakeAudioContext`, which is a
test double, not app UI.

Every zone carries a `message` naming the rule and the reason, as the existing
five do. The shell's own rule is **not** a zone (R7): it is about one file's
specifiers resolving to `index.ts` rather than to a sibling, which
`import/no-restricted-paths` cannot express.

### C7 — The arrow list, corrected against the tree

R1a: the map describes the tree. Three of R1b's lines do not, and Track C writes
these instead. Each correction is a measurement, and each stands regardless of
this epic's scope.

| R1b says | The tree says | Corrected line |
| :-- | :-- | :-- |
| nothing imports the shell | the feature's `index.ts` re-exports `GroovePuzzle`; `testing/puzzleHarness.tsx` renders it | *nothing imports the shell except the feature's `index.ts`, which re-exports it as the slice's public surface, and `testing/puzzleHarness.tsx`, which renders it under test* |
| nothing but the shell imports coaching | five files under `components/` do: `puzzle/FeedbackLine.tsx`, `puzzle/GuessCard.tsx`, `puzzle/NudgeBox.tsx` (all three type-only — `Feedback`, `FeedbackTone`) and `solved/SolvedPanel.tsx` (`selectNearMiss`, `staffLabel`) | *coaching is imported by the shell and by the puzzle- and solved-region components it feeds, and by nothing else* |
| the `audio` module's four hooks | three hooks import `lib/audio/`: `useTransport`, `useReferenceNote`, `useModeLick`. `useTapSounds` and `useSimpleMode` import `lib/persistence/preferences` and no audio module | *audio is `lib/audio/` and the three hooks that drive playback* |

Two lines that survive measurement but need a clause:

- `puzzle → theory` holds, and `lib/persistence/{lapsed,streak}.ts` import
  `parseIsoDate` from `lib/puzzle/selectGroove` — intra-module under the map's
  `puzzle`, and shrinking to `parseIsoDate` alone once Epic 1 takes `isoDate`.
- `audio → theory` is one type import, `ScheduledNote` from `phrase`, in
  `lib/audio/lick.ts`, plus three in audio's own tests. Drawn because it exists.

`the design system imports none of the six` holds, enforced by zone 1.

## Tracks

### Track A — The coaching door and the shell

- **Goal** — `GroovePuzzle.tsx` reaches `lib/presentation/` only through Epic 2's
  door, the door exports nothing nobody imports, and two structural guards fail
  the moment either goes back.
- **Owns** — `src/features/daily-groove/lib/presentation/index.ts`,
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/structure.test.ts`
- **Role** — `implementer`. Its first two steps are test-first and its last two
  are guards, but it is the track that edits production source, and the door and
  its guards are one red-green pair that cannot be split across tracks without
  one of them being red at its own done-condition.
- **Depends on** — Epics 1 and 2 merged. Epic 2 creates the door; Epic 1
  determines what presentation residue the shell still has.
- **Parallel with** — Tracks B, C
- **Command** — `npm test`
- **Done when** — the fan-in guard and the narrow-door guard pass, no other test
  changed, and `GroovePuzzle.tsx`'s diff is import lines only.

### Track B — The three zones and the one arrow they break

- **Goal** — `npm run lint` rejects an import that crosses a concern boundary
  the wrong way, with a message that says why; the single existing violation is
  fixed by moving an assertion, not by weakening a zone.
- **Owns** — `eslint.config.mjs`,
  `src/features/daily-groove/lib/puzzle/narrowing.test.ts`,
  `src/features/daily-groove/lib/presentation/ruledOut.test.ts`
- **Role** — `implementer`
- **Depends on** — Epic 1 merged, so `lib/theory/` is gone from the slice and the
  arrows the zones encode are the arrows the tree draws. Not on Track A: no zone
  names the door.
- **Parallel with** — Tracks A, C
- **Command** — `npm test` plus `npm run lint`
- **Done when** — `npm run lint` is clean, the three zones are in place, and the
  relocated case still asserts its original subject.

### Track C — The module map and the rulebook

- **Goal** — `docs/architecture.md` names six modules and the corrected arrows;
  `docs/coding-guidelines.md` carries the entry-point rule, the shell exception,
  the rewritten `src/lib/` bar and eight zones; the agent definitions carry the
  map.
- **Owns** — `docs/architecture.md`, `docs/coding-guidelines.md`,
  `.claude/agents/architect.md`, `.claude/agents/implementer.md`,
  `.claude/agents/test-writer.md`, `.claude/agents/verifier.md`,
  `.claude/agents/musician.md`
- **Role** — `architect`
- **Depends on** — C1, C6 and C7 only. It writes against the frozen door path,
  zone list and arrow list rather than waiting for Track A.
- **Parallel with** — Tracks A, B
- **Command** — `npm test` (nothing it owns is compiled; the suite must stay
  green because `structure.test.ts` and `boundary.test.ts` read source, and
  feature-19 already removed two guideline mentions)
- **Done when** — every R1b line in the document is one the tree draws, and
  AC5's three additions are present with their reasons.

### Track D — Verification and the deliberate-break pass

- **Goal** — every new zone and every new structural guard has been seen to
  fire; R8's two checks are recorded; the player sees no difference; the gate is
  green.
- **Owns** — no source file. It reverts every change it makes.
- **Role** — `verifier`
- **Depends on** — Tracks A, B, C
- **Parallel with** — nothing
- **Command** — `npm test`, `npm run test:gen`, `npx tsc --noEmit`,
  `npm run lint`, `npm run build`
- **Done when** — every AC is traced to a passing check and the demonstration
  tables in *Integration and verification* are filled in.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Track D

Wave 1's three tracks own disjoint files. Track A holds the door, the shell and
the guard; Track B holds `eslint.config.mjs` and two test files under `lib/`
that Track A does not touch; Track C holds only documents. Nothing in wave 1
waits on anything else in wave 1.

**There is no generator-side track.** The four cut doors took the fifth track
with them: with no `src/lib/theory/index.ts`, R2b's two assertions — that no
generator import resolves to the door, and that the door is not a generator-tier
trigger — have no subject. Both were guards against a file this epic no longer
creates, and asserting that nothing imports a non-existent barrel is the kind of
speculative zone the PRD's Out of scope already rules out. **Epic 1 already owns
everything the generator needs here**: it extends
`scripts/grooves/boundary.test.ts` with the `src/lib/` channel assertion,
rewrites the `Flavour` assertion, narrows the tier trigger to the five modules
the generator imports and tests that narrowing in both directions. Epic 3 adds
nothing under `scripts/` and its one remaining generator-adjacent job is
documentary: Step C5 repoints the guidelines' `Flavour` paragraph at
`src/lib/theory/names.ts`.

**The whole epic waits on Epics 1 and 2.** Named where it bites:

| Waits on | What would break without it |
| :-- | :-- |
| Epic 1 → Track B | zone 6 would have to allow `lib/theory/ → data/`, and zone 8 would fire on `lib/theory/music.ts → lib/puzzle/selectGroove` |
| Epic 1 → Track C | Step C4's `src/lib/` bar rewrite has nothing to describe, and Step C5's `Flavour` paragraph still points at `scripts/grooves/cli.ts` |
| Epic 2 → Track A | `lib/presentation/index.ts` does not exist, and the shell's presentation residue is unknown, so C3's baseline is unmeasurable |

## Implementation

### Track A — The coaching door and the shell

#### Step A1 — The fan-in rule fires, and it leaves the four undoored folders alone

Covers: R3, R3a, R10, AC3

- **Test first** — `src/features/daily-groove/structure.test.ts`: a new
  `describe('the shell reaches coaching only through its door')` holding
  `deepCoachingSpecifiers` (C5) and three cases.
  1. *it fires* — feed it a synthetic source string built from a fragment so
     this file never contains a literal deep path:
     `` const VIOLATION = `import { metaLine } from '../lib/${'presentation'}/date'\nvi.mock('../lib/presentation/coaching')` ``
     and assert `deepCoachingSpecifiers(VIOLATION)` equals
     `['../lib/presentation/date', '../lib/presentation/coaching']`.
  2. *it leaves the rest alone* — assert `[]` for a source naming
     `'../lib/presentation'`, `'../types'`, `'../data/grooves.generated'`,
     `'../hooks/useProgress'`, `'@/components/surfaces/Card'` and the four
     undoored specifiers `'@/lib/theory/music'`, `'../lib/audio/output'`,
     `'../lib/puzzle/selectGroove'`, `'../lib/persistence/storage'`. **This case
     is the scope decision, asserted.** Name it so:
     `'ignores the four folders that get no door'`.
  3. *the shell obeys it* — read `components/GroovePuzzle.tsx` from disk and
     expect `deepCoachingSpecifiers(source)` to equal `[]`.
- **Implement** — nothing. Cases 1 and 2 pass immediately; case 3 is the epic's
  red step and stays red until A4.
- **Green when** — cases 1 and 2 pass now. Case 3 fails with
  `AssertionError: expected [ '../lib/presentation/feedback', '../lib/presentation/coaching', … ] to deeply equal []`,
  listing whatever direct `lib/presentation/` specifiers Epic 2 leaves in the
  shell — six on today's tree, one (`date`) expected after Epic 2. **This is the
  demonstration R10 asks for, in the direction that matters, and it is not a
  manual break: cases 1 and 2 keep it permanent.** The suite is red from A1 to
  A4; the track is not done until A4.
- **Refactor** — reuse the file's existing `importSpecifiers` helper rather than
  writing a second extractor; `deepCoachingSpecifiers` filters its output.

#### Step A2 — The coaching door is narrow

Covers: R4, R4a, R10, AC4

- **Test first** — `src/features/daily-groove/structure.test.ts`: a new
  `describe('the coaching door is narrow')` holding `doorExports` and
  `importedNamesFrom` (C4) and these cases.
  1. *`export *` fails on sight* — `doorExports("export * from './date'")`
     throws or returns the sentinel, and the reported message contains
     `` `export *` `` and `R4a`.
  2. *an importer-less export is named* — with a hand-written door source
     exporting `a` and `b` and a hand-written importer source importing only
     `a`, the checker reports exactly `b`, and its message contains `` `b` ``
     and `This is a one-line fix.`
  3. *the door exists* — `existsSync` for
     `lib/presentation/index.ts`.
  4. *it is narrow* — every name in `doorExports` of that file appears in the
     union of `importedNamesFrom` across the C4 scan set.
- **Implement** — nothing.
- **Green when** — all four cases pass. Case 3 passes on Epic 2's tree; case 4
  passes because Epic 2's view-model export has `GuessCard.tsx` as its importer.
  A3 will make case 4 red on purpose.
- **Refactor** — none. Resist folding `doorExports` into the file's other
  helpers; it is the one thing this guard is about.

#### Step A3 — The door gains the shell's residue

Covers: R2, R2a, R4, AC2

- **Test first** — A2's case 4, already written and green. Adding the export
  turns it red: run `npm test` and expect
  `lib/presentation/index.ts exports \`metaLine\`, and nothing in the repo
  imports it through the door. … This is a one-line fix.`
- **Implement** — `src/features/daily-groove/lib/presentation/index.ts`: add
  `export { metaLine } from './date'`, and any other name the re-measured shell
  still imports from `lib/presentation/`, beside Epic 2's view-model export. Do
  not touch Epic 2's export or its signature. Names only — no `export *`.
- **Green when** — A2's case 4 is red with that exact message. Green at A4.
- **Refactor** — if the re-measure shows the shell needs nothing from
  `lib/presentation/`, this step adds nothing, A4 becomes a pure deletion, and
  A1's case 3 is already green. Record that in Track D rather than inventing an
  export to satisfy the shape of the step.

#### Step A4 — The shell's six become one

Covers: R2, R3, R11, AC2, AC3

- **Test first** — A1's case 3 and A2's case 4, already written and red. Run
  them: A1 names the shell's remaining direct `lib/presentation/` specifiers,
  A2 names `metaLine`.
- **Implement** — `src/features/daily-groove/components/GroovePuzzle.tsx`:
  replace each direct `lib/presentation/` import with one
  `import { … } from '../lib/presentation'` per C2. **Import lines only.** No
  binding renamed, no `useMemo` moved, no JSX touched. Leave the nine imports
  into `src/lib/theory/`, `lib/audio/`, `lib/puzzle/` and `lib/persistence/`
  exactly as they are — they are the four folders that get no door, and
  rewriting them would be the cut scope creeping back in.
- **Green when** — A1's case 3 passes with `[]`, A2's case 4 passes, and every
  existing test in the app tier passes unchanged — `npm test` green,
  `npx tsc --noEmit` clean.
- **Refactor** — none. Anything worth extracting from the shell is a finding for
  a later feature, not a change smuggled into an import rewrite (R11).

#### Step A5 — The rule binds the shell, and the guard says so

Covers: R3b, AC3

- **Test first** — `structure.test.ts`, in A1's describe: a case asserting the
  guard's scope. Assert the file list the guard reads is exactly
  `['components/GroovePuzzle.tsx']`, and — the other direction — that
  `components/puzzle/FeedbackLine.tsx` still contains a specifier
  `deepCoachingSpecifiers` would flag, proving the rule is not applied there.
  Run it: passes if A4 is done and `FeedbackLine.tsx` still imports
  `'../../lib/presentation/feedback'` for `type Feedback`, as it does today and
  after Epic 2.
- **Implement** — nothing, unless the assertion fails because Epic 2 removed
  `FeedbackLine.tsx`'s import. In that case pick another region component that
  has one — `components/solved/SolvedPanel.tsx` imports `selectNearMiss` and
  `staffLabel` — and say so in the case name.
- **Green when** — both directions pass.
- **Refactor** — none.

#### Step A6 — Epic 1's residue is guarded, not just checked

Covers: R8, AC7

- **Test first** — `structure.test.ts`: two cases.
  1. `readdirSync(LIB)` no longer contains `'theory'`. The existing
     `contains exactly the six concern folders` case becomes five; if Epic 1
     already updated it, assert only that `'theory'` is absent.
  2. scan every `.ts`/`.tsx` under `src/` and `scripts/`, excluding this file,
     and expect no import specifier to contain
     `features/daily-groove/lib/theory`.
  Run them: both pass if Epic 1 landed as specified. If either fails, **stop and
  report** — R8 is a check, and a failing check is Epic 1 not being finished, not
  work for this track.
- **Implement** — nothing.
- **Green when** — both pass.
- **Refactor** — none.

### Track B — The three zones and the one arrow they break

#### Step B1 — Zone 6: no `lib/` module imports UI, hooks or the store

Covers: R7, R10, AC6

- **Test first** — this rule's test is `npm run lint`. Write the deliberate
  violation first: add `import { GuessCard } from '../../components/puzzle/GuessCard'`
  to `src/features/daily-groove/lib/presentation/coaching.ts` and run
  `npm run lint`. It passes — **that is the red**: nothing today stops a
  coaching module reaching into UI.
- **Implement** — `eslint.config.mjs`: append zone 6 per C6, with the message
  *"A `lib/` module must not import UI, a hook or the store. `lib/` is where the
  feature's logic lives so it can be tested as plain functions and reused by any
  component; importing what renders it makes it untestable in isolation and
  couples the seam to the screen. Take what you need as an argument, or move the
  logic into the component."*
- **Green when** — `npm run lint` now reports that message against
  `coaching.ts`. Delete the deliberate import; `npm run lint` and `npm test`
  are clean. Record the message text in Track D's table.
- **Refactor** — none.

#### Step B2 — Zone 7: audio imports neither coaching nor the puzzle module

Covers: R7, R10, AC6

- **Test first** — add
  `import { selectCoaching } from '../presentation/coaching'` to
  `src/features/daily-groove/lib/audio/output.ts` and run `npm run lint`:
  passes. Red.
- **Implement** — zone 7 per C6, message *"`lib/audio/` must not import coaching
  or the puzzle module. Audio plays sound; it does not know the rules of the
  game or how they are described. Its one arrow out is to theory —
  `lib/audio/lick.ts` takes `ScheduledNote` from `src/lib/theory/phrase` — and a
  second arrow would make the player unusable outside this puzzle."*
- **Green when** — `npm run lint` reports it against `output.ts`. Remove the
  import; lint clean.
- **Refactor** — none.

#### Step B3 — Zone 8, and the one assertion that has to move first

Covers: R7, R10, AC6

- **Test first** — zone 8 per C6 has a real violation to fire on:
  `src/features/daily-groove/lib/puzzle/narrowing.test.ts:4` imports
  `'../presentation/ruledOut'`. Add zone 8 and run `npm run lint`: it reports
  the new message against `narrowing.test.ts`. **The one zone in this epic whose
  demonstration needed no fixture — and it is in a test file, which is the case
  the guidelines say matters most.**
- **Implement** — two parts.
  1. Move the `ruledOut` half of `narrowing.test.ts`'s
     `'the answer is never a candidate (R7, AC8)'` describe into
     `src/features/daily-groove/lib/presentation/ruledOut.test.ts`, keeping its
     name and its `(R7, AC8)` tags. The moved case brings the `play`/`Shape`
     helper it needs, renamed `playShaped` so it does not collide with
     `ruledOut.test.ts`'s existing `play`. `ruledOut.test.ts` already imports
     `'../puzzle/narrowing'` — coaching → puzzle is a drawn arrow, so the
     assertion is legal in its new home and illegal in its old one.
  2. `narrowing.test.ts` keeps its `eliminatedRoots(pool, root, attempts, seed)
     .not.toContain(root)` assertion and drops the `ruledOut` import. Per
     `docs/testing.md`, this is a move: both subjects survive, one per file.
  Then add zone 8's `message`: *"The puzzle module must not import coaching or
  audio. `lib/puzzle/` and `lib/persistence/` are the rules of the game and the
  record of it; how a state is described (`lib/presentation/`) and how it sounds
  (`lib/audio/`) both depend on those rules, never the other way. If a coaching
  helper is what you want to assert against, the assertion belongs in the
  coaching module's own test."*
- **Green when** — `npm run lint` is clean, `npm test` is green, and the case
  count across the two files is unchanged.
- **Refactor** — none.

### Track C — The module map and the rulebook

Documents are not compiled, so each step names the **check** that makes it fail:
a read-back against the tree, performed here and repeated in Track D. Where a
step's claim is mechanically checkable, the check names the test that already
checks it rather than adding a fourth mechanism.

#### Step C1 — Six modules and the arrows, in `docs/architecture.md`

Covers: R1, R1a, R1b, AC1

- **Check first** — take R1b's arrow list as written and read it against the
  import graph. Three lines fail: they are C7's three rows, each with the files
  behind it. That failure is what this step is fixing.
- **Write** — a new section after *"Why the dependency direction is the
  load-bearing part"*, named for what it adds: the arrows *inside* a slice,
  which the document currently does not draw. It carries (a) the six modules and
  the folders in each, (b) the arrow list with C7's three corrections applied,
  (c) R2a's sentence that the map groups and a door checks — with the
  `puzzle`-spans-two-folders and `audio`-has-hooks-outside cases named, and the
  fact that only `coaching` has a door, and (d) one line saying the map
  describes the tree, so when they disagree the map is what changes (R1a).
- **Check green when** — every folder the section names exists; every arrow it
  lists has at least one import behind it; every arrow it omits has none. Zones
  1 and 6–8, `structure.test.ts`'s fan-in guard and
  `scripts/grooves/boundary.test.ts` are what hold the omissions; the section
  names them so a reader can find the enforcement per arrow. Where an arrow has
  no enforcement, say so rather than implying one — four of the shell's arrows
  are held by review alone, and that is this epic's chosen scope.
- **Refactor** — none. `docs/architecture.md` keeps its shape: model, direction,
  removability.

#### Step C2 — The entry-point rule, beside the no-barrel rule

Covers: R5, AC5

- **Check first** — search `docs/coding-guidelines.md` for the entry-point rule:
  absent. The no-barrel rule is the last rule of *The design system*.
- **Write** — in *Feature slices*, a rule in two halves.
  1. *What a door is.* A concern folder's `index.ts` exports exactly what its
     consumers use, by name, never `export *`. `lib/presentation/index.ts` is
     the one that exists.
  2. *When a folder gets one.* **A door is earned by measured growth, not
     granted by policy.** `lib/presentation/` earned one by going from two
     modules to eleven while supplying six of the composer's fifteen direct
     `lib/` imports — the shape this document already calls "the tell". Theory,
     audio, puzzle and persistence supply four, three, one and one, and have
     been stable across nineteen features, so they have none. Adding a door
     speculatively buys a barrel with no measurement behind it.

  Then the contrast R5 asks for: *the design system is a flat catalogue of
  interchangeable primitives, so a barrel there would make every path end at the
  same place and tell a reader nothing; a feature module is a seam with a job,
  so a door there is the thing that names the job.* Cross-link to the no-barrel
  rule in both directions. Tag it *human-checked*, motivated by
  `src/features/daily-groove/lib/presentation/index.ts`, asserted by
  `src/features/daily-groove/structure.test.ts`.
- **Check green when** — the two rules read as one pair; the reason a reviewer
  would give for the difference is on the page; and a worker adding a twelfth
  module to `lib/audio/` can tell from the page whether it now needs a door.
- **Refactor** — none.

#### Step C3 — The shell is the one named exception

Covers: R3b, AC5

- **Check first** — the guidelines say *"The rule binds consumers, not the
  feature itself: inside its own folder a feature's files import each other
  freely by relative path, which is why `components/puzzle/GuessCard.tsx`
  importing `../../lib/presentation/feedback` is fine."* After Track A that
  sentence is still true of every file but one, and true of that one for four of
  its five concern folders. The document says nothing about either.
- **Write** — keep the sentence and its `GuessCard` example, and add the
  exception with its reason and its exact edge: `GroovePuzzle.tsx` is the
  composer, so its import list is the one place the whole graph is visible and
  the one place it has grown back twice — 362 → 274 (feature-5) → 488
  (feature-14) → 395. It is held to the coaching door and to that door alone;
  its imports into theory, audio, puzzle and persistence are ordinary
  intra-slice imports. A rule binding every intra-slice import would touch
  roughly sixty sites to guard a collision that has never happened between two
  region components. Name `src/features/daily-groove/structure.test.ts` as what
  enforces it and `src/app/route-boundary.test.ts` as what already covers the
  routes.
- **Check green when** — a reader can tell which file and which folder the
  entry-point rule binds without reading a test.
- **Refactor** — none.

#### Step C4 — The `src/lib/` bar, rewritten

Covers: R6, AC5

- **Check first** — read the current fourth bar, *"Genuinely shared — two callers
  on opposite sides of the app/generator boundary"*, against `src/lib/` after
  Epic 1. Eleven of the theory modules — `licks`, `staff`, `character`,
  `numerals`, `degrees`, `difference`, `families`, `options`, `phrase`,
  `simpleModes`, `changes` — have one caller, the app. The bar describes two
  files that are no longer the whole of the directory.
- **Write** — replace the fourth bar with a placement question, keeping the
  other three (pure, dependency-free, runtime-safe) intact and clarifying the
  second: *dependency-free* means importing nothing outside `src/lib/`, and
  `src/lib/groove.ts`'s zero-import property is a stricter promise specific to
  that file, pinned by `src/lib/groove.test.ts`. The new bar:

  > **Domain, not product.** A module earns `src/lib/` when it is knowledge
  > about the domain — what a Dorian scale spells, how a chord is derived from a
  > scale — rather than knowledge about this product: the ladder, the nudge, the
  > streak, the stored result. `src/lib/theory/` qualifies whether or not the
  > generator calls any given module; `lib/puzzle/scoring.ts` and
  > `lib/persistence/streak.ts` never will. Two callers across the
  > app/generator boundary is *sufficient* evidence, not the test — it is what
  > made `hash.ts` and `groove.ts` obvious.

  Then the cost, out loud, from the roadmap's own assumption: deleting
  `src/features/daily-groove/` now leaves eleven theory modules nothing imports.
  `architecture.md`'s removability standard still holds literally — the app
  builds — but the slice stops being a clean cut, and that was the price of one
  theory module.
- **Check green when** — the bar admits every module now in `src/lib/theory/`
  and excludes `scoring.ts`, `streak.ts`, `narrowing.ts` and `coaching.ts`, and
  a reader deciding where to put a new module gets an answer from it.
- **Refactor** — none. Restructuring `docs/coding-guidelines.md` is out of
  scope; this is one bar and one paragraph.

#### Step C5 — Eight zones, and the `Flavour` paragraph Epic 1 moved

Covers: R7, AC5, AC6

- **Check first** — `### The five zones` names five; `eslint.config.mjs` has
  eight after Track B. And the *"`scripts/grooves/types.ts` still declares its
  own `Flavour`"* paragraph points at `displayFlavour()` in
  `scripts/grooves/cli.ts`, which Epic 1 moved to `src/lib/theory/names.ts`.
- **Write** — rename the heading to `### The eight zones` and add rows 6, 7 and 8
  with the rule each encodes and how it is expressed (three static zones). Keep
  the five notes below the table and add one: *zones 6–8 are the first zones
  whose target and from are both inside one slice — they encode the arrows
  between a feature's concern folders, which zones 1–5 say nothing about.* State
  why the shell's rule is not a zone (it is one file's specifiers resolving to
  `index.ts` rather than to a sibling). Repoint the `Flavour` paragraph at
  `src/lib/theory/names.ts` and at whatever Epic 1 left the
  `scripts/grooves/boundary.test.ts` assertion saying, keeping the claim that
  unifying the two spellings would be a behaviour change wearing a
  de-duplication's clothes.
- **Check green when** — the table row count matches `eslint.config.mjs`'s zone
  count, and no paragraph names a path Epic 1 emptied.
- **Refactor** — none.

#### Step C6 — The agent definitions carry the map

Covers: R12

- **Check first** — `.claude/agents/implementer.md` holds a zone table with rows
  4 and 5 and a *"long list of sideways `../lib/` imports"* paragraph;
  `architect.md`, `test-writer.md`, `verifier.md` and `musician.md` hold the
  four-arrow dependency graph and the `src/lib/` bar. None mentions a module
  door, and `implementer.md`'s zone table would be wrong after Track B.
- **Write** — the minimum that makes each role's floor true:
  `implementer.md` gains zones 6–8 in its table and one line saying the shell
  reaches coaching only through its door; `architect.md`, `test-writer.md`,
  `implementer.md` and `verifier.md` get the rewritten `src/lib/` bar from C4,
  since all four state the old "genuinely shared" wording; `musician.md` gets
  the `src/lib/theory/` path in place of the generator-side theory modules Epic 1
  merged. Do not paste the map into five files — link `docs/architecture.md`.
  Do not write "every module has a door": one does.
- **Check green when** — no agent file states the old `src/lib/` bar, a
  five-zone count, or a door that does not exist.
- **Refactor** — none.

## Integration and verification

Track D. Every row below is filled in by hand and reverted; nothing in this
section is committed except the record.

### D1 — The three zones fire

Covers: R7, R10, AC6

For each zone: add the violating import, run `npm run lint`, record the message,
delete the import, confirm lint clean.

| Zone | Throwaway import | In | Expect |
| :-- | :-- | :-- | :-- |
| 6 | `import { GuessCard } from '../../components/puzzle/GuessCard'` | `lib/presentation/coaching.ts` | zone 6's message |
| 6 | `import { useProgress } from '../../hooks/useProgress'` | `lib/puzzle/scoring.ts` | zone 6's message |
| 7 | `import { selectCoaching } from '../presentation/coaching'` | `lib/audio/output.ts` | zone 7's message |
| 8 | `import { selectFeedback } from '../presentation/feedback'` | `lib/puzzle/scoring.ts` | zone 8's message |
| 8 | `import { referenceOutput } from '../audio/output'` | `lib/persistence/streak.ts` | zone 8's message |

Each message must name the rule and the reason, not just the path (R7).
Track B's B3 already saw zone 8 fire on a real violation; the row above is the
second direction, in source rather than a test.

### D2 — The two structural guards fire

Covers: R3, R4, R10, AC3, AC4

The permanent half is already in the suite: A1's cases 1–2 and A2's cases 1–2
feed the predicates a violation and assert they report it. The one-time half:

| Break | Expect from `npm test` |
| :-- | :-- |
| add `import { selectCoaching } from '../lib/presentation/coaching'` to `GroovePuzzle.tsx` | the fan-in case fails naming `'../lib/presentation/coaching'` |
| add `vi.mock('../lib/presentation/verdict')` to `GroovePuzzle.tsx` | the same case fails naming the mocked path |
| add `import { referenceOutput } from '../lib/audio/output'` to `GroovePuzzle.tsx` | **nothing fails.** The scope is deliberate: audio has no door, and A1's case 2 asserts this in the suite |
| add `export { staffLabel } from './staffLabel'` to `lib/presentation/index.ts` | the narrow-door case names `staffLabel` with the one-line-fix message |
| replace a line of `lib/presentation/index.ts` with `export * from './date'` | the narrow-door case fails on sight, message naming `export *` and R4a |
| add `import { GuessCard } from '../../components/puzzle/GuessCard'` to `lib/presentation/index.ts` | zone 6 rejects it |

Revert each before the next. Row three is not a gap in the record — it is the
record of what this epic chose not to guard, and the reason a later feature
adding a fourth module to `lib/audio/` should re-read Step C2's rule.

### D3 — R8's two checks

Covers: R8, AC7, AC8

- Run A6's two cases. Then, once by hand: `grep -rn "lib/theory" src scripts
  --include=*.ts --include=*.tsx` returns only `src/lib/theory/…` paths, and
  `ls src/features/daily-groove/lib/` shows five folders.
- `grep -rn "flavourOptions" src` — every call site passes a pool as its second
  argument. On today's tree the call sites are `GroovePuzzle.tsx` and
  `testing/puzzleHarness.tsx`; re-count after Epic 2, which may remove the
  shell's.
- A failure in either is Epic 1 unfinished, not work for this epic. Report it as
  a blocker.

### D4 — The demo path

Covers: R11, AC9

Play a full session in the browser against the tree this epic leaves, and
compare to a session played against the tree it started from: first visit, a
wrong guess at each rung of the ladder, the nudge, a lock-in, a solve, a give-up,
a shared link. Nothing rendered may differ. This epic changed no expression that
produces output — `GroovePuzzle.tsx`'s diff is import lines — so any difference
is a bug in the rewrite, most likely a name that resolved to a different module
through the door.

Also confirm `npm run grooves:verify` passes and `git status` shows
`grooves.lock.json`, `catalogue.json` and `public/grooves/*.mp3` unchanged. This
epic renders nothing, so a dirty output tree means something else is wrong.

### D5 — The full gate

Covers: AC10

`npm test` · `npm run test:gen` · `npx tsc --noEmit` · `npm run lint` ·
`npm run build`. All five green, in that order. `npm run test:gen` is run
despite this epic owning no file under `scripts/` — Track C repoints a
guidelines paragraph the generator's boundary test reads about, and Epic 1's
narrowed tier trigger means a green generator tier is no longer implied by a
green app tier.

### D6 — The map, read back against the tree

Covers: R1, R1a, AC1

Take `docs/architecture.md`'s new section and check it line by line:

- every folder it names exists;
- every folder under `src/features/daily-groove/` and under `src/lib/theory/` is
  placed in exactly one module;
- every arrow it lists has at least one import behind it — name the file;
- every arrow it does not list has none — name the zone, guard, test or "review
  only" that holds it.

If the map and the folders disagree, the **map** changes (R1a), and the change
goes back to Track C. Report any correction, so the roadmap's "six modules
describes the tree as it is" assumption can be checked against what was found.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, D6 |
| R1a | C1, D6 |
| R1b | C1 (via C7), D6 |
| R1c | C1 (via C7), D6 |
| R2 | A3, A4 |
| R2a | A3, C1, C2 |
| R2b | *withdrawn — no theory door is built, and Epic 1 owns every generator-side assertion. See Execution waves.* |
| R3 | A1, A4, D2 |
| R3a | A1 (case 2), A4, D2 |
| R3b | A5, C3 |
| R4 | A2, A3, D2 |
| R4a | A2 (case 1), D2 |
| R5 | C2 |
| R6 | C4 |
| R7 | B1, B2, B3, C5 |
| R7a | B3 |
| R8 | A6, D3 |
| R10 | A1, A2, B1, B2, B3, D1, D2 |
| R11 | A4, D4 |
| R12 | C6 |
| AC1 | C1, D6 |
| AC2 | A3, A4 |
| AC3 | A1, A4, A5, D2 |
| AC4 | A2, D2 |
| AC5 | C2, C3, C4, C5 |
| AC6 | B1, B2, B3, C5, D1 |
| AC7 | A6, D3 |
| AC8 | D3 |
| AC9 | D4 |
| AC10 | D5 |

**Totals:** 21 steps across 4 tracks in 2 waves — Track A 6, Track B 3,
Track C 6, Track D 6. 19 live requirements and 10 acceptance criteria covered;
R2b withdrawn with its number kept so the ACs' references still resolve. 13
files: 3 in Track A, 3 in Track B, 7 in Track C, none in Track D.

## Assumptions

- **The fan-in guard is targeted, not an equality check.** It forbids deep
  `lib/presentation/` specifiers rather than asserting the shell's whole
  `lib`-touching import list. An equality check would freeze the shell's nine
  undoored imports and fail whenever Epic 2's view model shifts one of them,
  which is a guard failing for the wrong reason.
- **No map-parsing test.** AC1 is verified by D6's read-back, not by a test that
  parses `docs/architecture.md`. Every arrow the map draws is held by zones 1
  and 6–8, the fan-in guard, `route-boundary.test.ts` or `boundary.test.ts`, or
  by review; a parser would be a fourth mechanism for the same arrows, and R7
  says no second mechanism.
- **The narrow-door test's leniency is real and is a known weakness.** R4 counts
  a test file as an importer, so a wide door can be legalised by writing a test
  that imports all of it. That is deliberate — it is what lets the honest order
  of work (export, test, consumer) not fail on the middle step — and it means
  **the guard catches carelessness, not determination.** Stated here rather than
  in the guidelines, where it would read as an invitation. It matters more at
  this scope than it did at five doors: one door means one file a determined
  widener has to get past.
- **One scanner, one copy.** With no door under `src/lib/`, the scan helpers live
  only in `src/features/daily-groove/structure.test.ts`. If a second door ever
  lands outside the slice, that is the moment to ask whether the guard belongs in
  `scripts/` as a tooling-tier test, since `src/lib/` can import neither the
  feature's test helpers nor `scripts/`.
- **Zone 6 does not list `testing/` as a forbidden source.** Five
  `lib/audio/*.test.ts` files import `../../testing/fakeAudioContext`, which is
  a test double, not UI, and forbidding it would move five files for no gain.
- **`GroovePuzzle.tsx`'s line count is not asserted.** The PRD puts a line-count
  test out of scope; the rule is the fan-in rule. Worth knowing that the rewrite
  will shorten the file by roughly five lines and that this epic sets no floor
  under a future regrowth in body rather than in imports — nor under regrowth in
  its theory, audio, puzzle or persistence imports, which is the cost of the
  chosen scope.

## Decision log

### Cycle 1 — 2026-09-03

**Q1. How does a structural guard get "seen to fail" permanently rather than
once?**
Decision: **split each guard into a pure predicate and a disk read, and unit-test
the predicate against a synthetic violation.** A manual break recorded in a
report expires with the next edit; a case in the suite does not. The cost is that
each guard is two functions instead of one inline filter, and that the guard must
exclude itself from its own scan (`src/lib/hash.test.ts`'s rule) — which is why
A1's fixture is assembled from a fragment rather than written as a literal path.
Changed: Contracts C4 and C5, Steps A1, A2; D2 keeps only the one-time half.

**Q2. Do the door and its guards go in one track or two?**
Decision: **one track, ordered steps.** A guard track would be red at its own
done-condition until the door track landed, which breaks the rule that a track's
tests pass without another track existing. The parallelism is bought in the other
two wave-1 tracks instead, which is honest about an epic whose spine is serial.
Changed: Tracks, Execution waves.

**Q3. What replaces the `src/lib/` "genuinely shared" bar?**
Decision: **domain versus product**, with the app/generator crossing demoted to
sufficient-but-not-necessary evidence. The alternative — "genuinely shared *or*
pure domain theory" — says the same thing with an escape hatch in it, and the
whole risk R6 names is `src/lib/` becoming where things go when nobody wants to
decide. One paragraph, cheap to reverse; recorded because it governs every future
placement call.
Changed: Step C4.

**Q4. Three of R1b's arrow lines do not match the tree. Which changes?**
Decision: **the map**, per R1a, and each correction carries its measurement.
`index.ts` and `puzzleHarness.tsx` do import the shell; five region components
import coaching; audio has three hooks, not four. Recording the measurement
beside the correction is what stops the next revision quietly restoring the
tidier claim.
Changed: Contract C7, Step C1, Step D6.

**Q5. R7 lists four cases for the zones. Why three zones?**
Decision: **zone 6 is written at `lib/` granularity**, which subsumes
"coaching does not import the design system or the shell" as one case of "no
`lib/` module imports UI, hooks or the store". Three zones with three reasons
beat four zones two of which share one. The map's `lib/share/` sits inside zone
6's target and passes today.
Changed: Contract C6, Steps B1–B3, Step C5.

### Cycle 2 — 2026-09-03

**Q6. Five doors, or one?**
Decision: **one — the coaching door Epic 2 builds.** The guard follows the
measured growth: `lib/presentation/` went from two modules to eleven and supplies
six of the shell's fifteen direct `lib/` imports, while theory (4), audio (3),
puzzle (1) and persistence (1) have been stable across nineteen features. Epic 2
already builds coaching's door, so this costs two steps and no new production
file. Cut: five steps and one whole track. Reversing it later is additive — each
folder's door is an independent `index.ts` plus one whitelist entry in A1's case
2 — so the choice is cheap to revisit if a folder grows.
Changed: Approach, Architecture, Contracts C1–C5, Tracks (five became four),
Execution waves (three became two), Steps A1–A6 rescoped, old A3/A4/A5 and
Track D's D1/D2 deleted, Requirement coverage, Assumptions, Step C2 (the rule now
says when a folder earns a door), Step C3 (the exception names its one folder),
Step D2 (row three records what is deliberately unguarded).

**Q7. Does anything generator-side survive without the theory door?**
Decision: **no, and Epic 3 owns nothing under `scripts/`.** R2b's two assertions
were guards on a file this epic no longer creates: asserting that no generator
import resolves to a barrel that does not exist is the speculative zone the PRD's
Out of scope already rules out. Epic 1 independently owns the `src/lib/` channel
assertion in `scripts/grooves/boundary.test.ts`, the rewritten `Flavour`
assertion and the narrowed tier trigger with its two-direction test. R2b is
withdrawn with its number kept, following the precedent the PRD set for R9.
Changed: Execution waves (the no-generator-track note), Requirement coverage,
Step C5 (the `Flavour` paragraph is the one generator-adjacent job left, and it
is documentary), Step D5.
