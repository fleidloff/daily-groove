# PRD — Epic 3: The module map is written down and enforced

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Epics 1 and 2 create boundaries. This one writes them down, puts lint behind
them, and makes the hub file's regrowth a test failure rather than something
noticed a year later. The shell is held to reaching coaching only through the
door Epic 2 builds, and a test keeps that door narrow.

## Problem

`GroovePuzzle.tsx` has been cut twice and grown back twice. Feature-5 took it
from 362 lines to 274. It was 488 by feature-14, which looked at it, declined the
split, and wrote the residual into its assumptions. It is 395 today with the
fan-in worse than at either point: 40 imports, 23 sideways into its own `lib/`,
`data/` and `hooks/`.

Both features shipped without a guard, and feature-14 said so plainly — *"Nothing
here is guarded against decay. No file-size test, no time budget… the only thing
that will notice is someone measuring again."* Someone measured again. That is
this feature.

`docs/architecture.md` draws the dependency arrows *between* `src/app`,
`src/components`, `src/features` and `src/lib`, and none *inside* a slice. So a
worker dispatched at the coaching module has nothing telling it what it may reach,
and the only reason the slice has held its shape is that one person has been
reading every diff.

## Scope

- name the six modules and the arrows between them in `docs/architecture.md`
- a structural test: the shell imports no `lib/presentation/` module directly,
  only the coaching door Epic 2 builds
- a structural test: that door is narrow
- new ESLint zones for the arrows lint can see
- the guidelines: the entry-point rule and when a folder earns a door, the shell
  exception, the `src/lib/` bar

**Out of scope**
- **doors for the other four concern folders.** `src/lib/theory/`, `lib/audio/`,
  `lib/puzzle/` and `lib/persistence/` get no `index.ts`, and the shell keeps
  importing their modules directly — four, three, one and one specifier. This is
  a decision, not an oversight: the guard follows the measured growth.
  `lib/presentation/` went from two modules to eleven and supplies six of the
  shell's fifteen direct `lib/` imports, while the other four have been stable
  across nineteen features. Adding a door to a folder that has not grown buys a
  barrel with no measurement behind it, and R5's rule says so in the guidelines
  so a later feature can add one when a folder does grow.
- **anything generator-side.** With no door in `src/lib/theory/`, this epic owns
  no file under `scripts/`. Epic 1 already extends
  `scripts/grooves/boundary.test.ts` with the `src/lib/` channel assertion,
  rewrites the `Flavour` assertion and narrows the generator tier trigger to the
  five modules the generator imports.
- restructuring `docs/coding-guidelines.md`. It stays the source of truth and
  keeps its shape; this epic adds the entry-point rule, rewrites the `src/lib/`
  "genuinely shared" bar that Epic 1 invalidated, and touches the `Flavour`
  paragraph Epic 1 moved — nothing else
- `docs/music.md`. Epic 1 does not change the generator's musical model
- enforcing anything about `scripts/grooves/` beyond the boundary test that
  already exists
- a second `features/` slice, and any zone written speculatively for one. Zones 2
  and 3 are already generated per feature and a new slice inherits them
- splitting `GroovePuzzle.tsx` further. This epic guards one folder's worth of
  its shape; it does not set a line count
- binding any file other than the shell to the door. Region components, hooks and
  the modules themselves keep importing each other by relative path
- removing re-export shims. Epic 1 left none

## Requirements

- **R1** — `docs/architecture.md` names six modules and the arrows between them:
  **catalogue** (`scripts/grooves/` + the generated manifests), **theory**
  (`src/lib/theory/`), **audio** (`lib/audio/` and the three hooks that drive
  playback), **puzzle** (`state/`, `lib/puzzle/`, `lib/persistence/`, the four
  hooks that carry the session and the settings, and whatever Epic 2 adds),
  **coaching** (`lib/presentation/`), **shell** (`GroovePuzzle`, the routes, and
  `lib/share/`, which exists to build the routes' URLs).
- **R1a** — The map describes the tree as it is. If a module does not survive
  contact with a lint zone, the map is what changes.
- **R1b** — The arrows are the ones the tree draws after Epics 1 and 2, and the
  map states them as a list a reader can check against the import graph:
  - shell → every other module; coaching through its door, the rest directly
  - coaching → theory, puzzle
  - puzzle → theory
  - audio → theory
  - theory → nothing in the app
  - catalogue → theory, by the specific modules it needs; catalogue writes the
    manifests the shell and the modules read
  - nothing imports the shell except the feature's `index.ts`, which re-exports
    `GroovePuzzle` as the slice's public surface, and
    `testing/puzzleHarness.tsx`, which renders it under test
  - coaching is imported by the shell and by the puzzle- and solved-region
    components it feeds — `puzzle/FeedbackLine.tsx`, `puzzle/GuessCard.tsx`,
    `puzzle/NudgeBox.tsx` (all three type-only) and `solved/SolvedPanel.tsx` —
    and by nothing else
  - audio is imported by the shell, by its three hooks and by
    `testing/fakeAudioContext.ts`
  - the design system imports none of the six
- **R1c** — Three claims that looked true when this PRD was first written are
  not, and the map states the measured version. Nothing imports the shell *except*
  the feature's `index.ts` and the test harness. Coaching is imported by five
  region components, not by the shell alone. The audio module has **three** hooks
  — `useTransport`, `useReferenceNote`, `useModeLick`; `useTapSounds` and
  `useSimpleMode` import `lib/persistence/preferences` and no audio module, so
  they sit with puzzle. Each correction carries the files behind it, so a later
  revision cannot quietly restore the tidier claim.
- **R2** — The coaching door, `src/features/daily-groove/lib/presentation/index.ts`,
  is the epic's one entry point, and Epic 2 builds it. `GroovePuzzle.tsx`'s six
  direct `lib/presentation/` imports — `feedback` (3 names), `coaching`,
  `verdict`, `confirmed`, `ruledOut` and `date` — resolve to it. Epic 2 folds
  five of those six into its view model; `date` is the residue this epic expects
  to add to the door, because `metaLine` is not coaching but lives in the folder
  and the door is per folder.
- **R2a** — The door is per concern folder, while the map groups differently: the
  map's `puzzle` module spans `lib/puzzle/` and `lib/persistence/`, and its
  `audio` module includes hooks that sit outside `lib/audio/`. For coaching the
  two coincide — the module is one folder. The map is how a reader groups the
  code; a door is what an import rule can check; and four of the six modules have
  no door at all. All three are stated together.
- **R2b** — *Withdrawn.* It required a theory door,
  `src/lib/theory/index.ts`, and two assertions about the generator not reaching
  it. No theory door is built, so asserting that no generator import resolves to
  a barrel that does not exist is the speculative guard this PRD's Out of scope
  rules out. Epic 1 independently owns every generator-side assertion: the
  `src/lib/` channel, the rewritten `Flavour` assertion and the narrowed tier
  trigger tested in both directions. The number is kept so the acceptance
  criteria's references still resolve, following the precedent set for R9.
- **R3** — `GroovePuzzle.tsx` imports no `lib/presentation/` module directly.
  Only the door. A structural test reads the file from disk and fails otherwise.
- **R3a** — `../types`, `../data/` and `../hooks/` are not `lib/` and are
  unaffected. Types and generated data are not modules with seams, and the hooks
  are the shell's own. **The shell's nine imports into the four undoored folders
  are equally unaffected** — four into `src/lib/theory/`, three into
  `lib/audio/`, one into `lib/puzzle/`, one into `lib/persistence/` — and the
  test asserts that it ignores them, so a guard that quietly widened to every
  `lib/` folder would fail the tree this epic deliberately leaves.
- **R3b** — The rule binds the shell and only the shell, and one folder and only
  one folder: `GroovePuzzle.tsx` reaching `lib/presentation/`, plus the routes,
  which already import nothing deeper than the feature's `index.ts` under
  `route-boundary.test.ts`. Every other file in the slice keeps importing
  sideways by relative path, as `coding-guidelines.md` says it may.
  `GuessCard` importing the coaching door is Epic 2's design, not an instance of
  this rule. The guidelines' sentence *"the rule binds consumers, not the feature
  itself"* gains the shell as its one named exception, with the reason: the
  measured pain is in one file and one folder, and a rule binding sixty import
  sites would guard a collision that has never happened between two region
  components.
- **R4** — The coaching door is narrow: every export of it is imported by at
  least one file in the repo, tests included, and it contains no `export *`. A
  structural test reads the door and every importer from disk and fails on an
  export nobody imports. The failure it produces when a developer adds an export
  before its consumer is a five-second fix, and its message says so.
- **R4a** — R4 is what makes R3 mean anything. A wide barrel would let
  `GroovePuzzle.tsx` read as one import while reaching exactly as far as it does
  today — R3 would pass and the coupling would be invisible. This is the half of
  the `src/components/` no-barrel rule that transfers: *"the grouping would stop
  telling a reader anything, because every path would end at the barrel."* It
  matters more at one door than it would at five: one file is all a determined
  widener has to get past.
- **R5** — `docs/coding-guidelines.md` gains the entry-point rule, placed next to
  the no-barrel rule, in two halves. **What a door is:** a concern folder's
  `index.ts` exporting exactly what its consumers use, by name, never `export *`.
  **When a folder gets one:** a door is earned by measured growth, not granted by
  policy — `lib/presentation/` earned one at eleven modules and six of the
  composer's fifteen direct `lib/` imports; theory, audio, puzzle and persistence
  supply four, three, one and one and have been stable across nineteen features.
  And the reason one folder set gets doors while the design system gets none: the
  design system is a flat catalogue of interchangeable primitives, a feature
  module is a seam with a job.
- **R6** — The `src/lib/` "genuinely shared" bar is rewritten. Epic 1 put eleven
  app-only theory modules there, so the bar as written — *"two callers on opposite
  sides of the app/generator boundary"* — no longer describes the directory. The
  rewrite says what now earns a place and what does not, or `src/lib/` becomes the
  place things go when nobody wants to decide.
- **R7** — New ESLint zones extend the existing
  `daily-groove/import-boundaries` block. No second mechanism. The four missing
  arrows in R1b that lint can express at folder granularity become **three
  zones**, because writing the first at `lib/` granularity — no `lib/` module
  imports UI, hooks or the store — subsumes "coaching does not import the design
  system or the shell" as one case of a stronger rule. The other two are: audio
  imports neither coaching nor the puzzle module; the puzzle module imports
  neither coaching nor audio. Each carries a `message` naming the rule and the
  reason, as the existing five do. The shell's own rule (R3) is a structural
  test, not a zone, because it is about one file's imports resolving to
  `index.ts` and not to siblings.
- **R7a** — One of the three zones has a real violation to fire on:
  `src/features/daily-groove/lib/puzzle/narrowing.test.ts:4` imports
  `'../presentation/ruledOut'`. It is fixed by moving the `ruledOut` half of that
  file's *"the answer is never a candidate"* case into
  `lib/presentation/ruledOut.test.ts`, which already imports `../puzzle/narrowing`
  — coaching → puzzle is a drawn arrow — so the assertion is legal in its new
  home and illegal in its old one. Per `docs/testing.md` this is a move: both
  subjects survive, one per file. The zone is not weakened to accommodate it, and
  it is worth noting that the only violation in the tree is in a test file, which
  is the case the guidelines say matters most.
- **R8** — Nothing from Epic 1 is left to collect. No file in the repo imports
  `src/features/daily-groove/lib/theory/`, the folder does not exist, and every
  `flavourOptions` call passes its pool. This is a check, not work.
- **R10** — Each new zone and each new structural test is demonstrated failing
  once, deliberately, against a violation written for the purpose. A rule that has
  never been seen to fire is a comment. For the two structural tests the
  demonstration is also permanent: each is split into a pure predicate and a disk
  read, and the predicate is unit-tested against a hand-written violating source
  string, so "this rule fires" stays in the suite rather than expiring with the
  next edit.
- **R11** — Nothing the player can observe changes.
- **R12** — The agent definitions under `.claude/agents/` are updated if the module
  map changes what a role needs to know. None of them may claim that every module
  has a door: one does.

## Behaviour details

**What "narrow" means, exactly.** The test compares the door's export list with
the union of what every file in the repo imports from it. An export with no
importer fails; `export *` fails on sight. A test file counts as an importer,
which is a deliberate leniency: it lets the door export something whose only
consumer so far is the test that proves it, and it means the honest order of work
— export, then test, then consumer — never fails on the middle step. What it
still catches is the wide barrel, because a hand-written list of forty
re-exports has forty importers to find or forty lines to delete. What it does not
catch is determination: a door can be legalised by writing a test that imports
all of it. The guard is against carelessness, and saying so here is cheaper than
discovering it later.

**Where the rule stops.** The shell is the only file held to the door, and
`lib/presentation/` is the only folder it is held to. The guidelines currently
say the opposite in general — *"inside its own folder a feature's files import
each other freely by relative path"* — and that sentence stays true for every
file but one, and for four of that one's five concern folders. The shell is the
exception because it is the composer: it assembles every region, so its import
list is the one place the whole graph is visible, and the one place it has grown
back twice.

**Why one door and not five.** The guard follows the measured growth.
`lib/presentation/` went from two modules to eleven while supplying six of the
shell's fifteen direct `lib/` imports; theory (4), audio (3), puzzle (1) and
persistence (1) have been stable across nineteen features. Epic 2 already builds
coaching's door, so holding the shell to it costs no new production file. The
cost of the choice, stated plainly: nothing guards the shell's imports into the
other four folders, so a regrowth there would be caught by review alone — which
is exactly what failed twice before. R5's rule is written so a later feature can
add a door when one of those folders grows, and each addition is one `index.ts`
plus one entry in the fan-in test's ignore list.

## Acceptance criteria

- **AC1** (R1, R1a, R1b, R1c) — Given `docs/architecture.md`, when read against
  the tree, then the six modules it names correspond to folders that exist, every
  folder under the slice and under `src/lib/theory/` is placed in one of them,
  and every arrow it lists has at least one import behind it and every missing
  arrow has none — with the zone, guard, test or "review only" that holds each
  omission named.
- **AC2** (R2, R2a) — Given `lib/presentation/index.ts`, when its exports are
  listed, then `GroovePuzzle.tsx` reaches `lib/presentation/` only through it; and
  given the four undoored concern folders, when the tree is read, then none has
  an `index.ts` and the shell still imports their modules directly.
- **AC3** (R3, R3a, R3b) — Given `GroovePuzzle.tsx`, when the structural test
  reads its imports, then none names a module inside `lib/presentation/`; when a
  direct `lib/presentation/` import or a `vi.mock` of one is added, then the test
  fails; when a direct `lib/audio/` import is added, then nothing fails, and a
  case in the suite asserts that scope rather than leaving it to be inferred; and
  given any other file in the slice importing a `lib/presentation/` module
  directly, then no test or zone objects.
- **AC4** (R4, R4a) — Given the coaching door, when its exports are compared with
  what the repo imports through it, then every export has an importer and no
  `export *` appears; and when an unused re-export or an `export *` is added, then
  the test fails with a message that names the export.
- **AC5** (R5, R6, R3b) — Given `docs/coding-guidelines.md`, when read, then the
  entry-point rule sits beside the no-barrel rule with its reason and with the
  test for when a folder earns a door, the shell is named as the one exception to
  free intra-feature imports with the one folder it is held to, and the
  `src/lib/` bar describes the directory as Epic 1 leaves it.
- **AC6** (R7, R7a, R10) — Given each of the three new zones, when an import that
  violates it is written, then `npm run lint` rejects it with a message naming the
  rule and the reason; and given `narrowing.test.ts`, when the relocated case is
  read, then it asserts what it asserted before, in the file whose arrow allows
  it.
- **AC7** (R8) — Given the repo, when scanned, then no import specifier resolves
  to `src/features/daily-groove/lib/theory/` and the folder is absent.
- **AC8** (R8) — Given every `flavourOptions` call site, when read, then each
  passes its pool explicitly.
- **AC9** (R11) — Given a full session — first visit, a wrong guess at each rung,
  the nudge, a lock-in, a solve, a give-up, a shared link — when played before and
  after, then nothing rendered differs.
- **AC10** — Given the full gate, when `npm test`, `npm run test:gen`, the type
  check, lint and build run, then all pass.

## Dependencies

**Needs to start:** Epics 1 and 2 both merged. Epic 2 creates the door this epic
holds the shell to; Epic 1 determines the presentation residue the shell still
has, and its move is what makes R6's rewrite necessary and R8's check meaningful.

**Hands to:** every feature after this one. The map and the zones are what a
worker dispatched at a module reads instead of the whole rulebook, and R5's rule
is what tells the next feature whether the folder it is growing has earned a
door.

## Assumptions

- The structural tests live beside the code they read, following
  `src/features/daily-groove/structure.test.ts` and `scripts/grooves/boundary.test.ts`
  — the two guards in this repo that already read source from disk. Both of this
  epic's guards go in the feature's structure test; with no door outside the
  slice, nothing needs a second scanner and nothing is added under `src/lib/`.
- The fan-in test names `GroovePuzzle.tsx` specifically rather than "any component
  at the `components/` root". There is one root composer and the guidelines say
  there is one; a generalised rule would be guarding a case that does not exist.
- The fan-in test is targeted rather than an equality check: it forbids deep
  `lib/presentation/` specifiers rather than asserting the shell's whole
  `lib`-touching import list. An equality check would fail whenever Epic 2's view
  model shifts one of the nine undoored imports, which is a guard failing for the
  wrong reason.
- The door is `index.ts` in the concern folder, which is what Epic 2 builds.
- `lib/share/` belongs to the shell in the map. Its two modules build the routes'
  URLs and drive the browser share sheet, and only the header's share button and
  the feature's public `index.ts` import them. It gets no door: the shell does not
  import it and no module does.
- The map's `audio` module names the three hooks that drive playback, and the
  map's `puzzle` module names `usePuzzleSession` and `useProgress`;
  `useSimpleMode` and `useTapSounds` are settings and sit with the puzzle module
  too. The hooks are grouped by the map and reached directly by the shell, which
  R2a states.
- Zone additions are static, not generated. Zones 2 and 3 are generated per
  feature because the feature list varies; the concern folders inside a slice do
  not. The exact zone list is derived from R1b and settled in the tech spec.
- The `audio → theory` arrow is a single type import today (`ScheduledNote` from
  `phrase`). It is drawn as an arrow because it exists, not because audio needs
  much of theory; if it disappears the map loses a line.
- The choice of one door is cheap to revisit. Each additional door is an
  independent `index.ts` plus one entry in the fan-in test's ignore list, so a
  later feature can add one without touching this epic's work.

## Question log

### Cycle 1 — 2026-09-02

**Q1. Does the entry-point rule bind the whole slice, or only the shell?**
Answer: **A) Only the shell — `GroovePuzzle.tsx` and the routes.** The measured
pain is in one file; binding every file would touch roughly sixty import sites
for a collision that has never happened between two region components.
Applied to: R3b, R7, Out of scope, AC3, AC5, Behaviour details.

**Q2. How strict is the narrow-door test?**
Answer: **A) Every export must be imported by at least one consumer in the repo,
tests included** — the only form that catches the wide barrel, and its failure
is a five-second fix with a message that says what to do.
Applied to: R4, AC4, Behaviour details.

**Q3. Does `src/lib/theory/` get a door, given the generator imports it too?**
Answer: **A) A door for the app; the generator keeps importing the specific
modules it needs** — five of eighteen, by the relative paths the leaf rule exists
for, and Epic 1's tier trigger is keyed on exactly those five.
Applied to: R2b, AC2, Assumptions, Behaviour details.
*Superseded by Q4 in cycle 2: no theory door is built, and R2b is withdrawn.*

**Epic 1's Q1 (no shims), applied here.** Epic 1 moves every theory consumer
itself, so this epic's R8 (delete the shims and move ~60 import sites) and R9
(unshim the `flavourOptions` call site) became checks rather than work. R8 is
rewritten as that check; R9 is withdrawn and its number left unused so the ACs
keep their references.
Applied to: Summary, Scope, Out of scope, R8, AC7, AC8, Behaviour details,
Dependencies.

### Cycle 2 — 2026-09-03

**Q4. Five entry points, or one?**
Answer: **B) One — the coaching door Epic 2 builds. The doors for theory, audio,
puzzle and persistence are cut.** The guard follows the measured growth:
`lib/presentation/` went from 2 modules to 11 and supplies 6 of the shell's 15
direct `lib/` imports, while theory, audio, puzzle and persistence have been
stable across nineteen features.

Changed:
- **Summary, Scope** — one door, not five; Epic 2 builds it, so this epic adds no
  new production file.
- **Out of scope** — a new bullet naming the four cut doors with the stability
  argument, so it does not read as an oversight; and a second saying this epic
  owns nothing under `scripts/`.
- **R2** — rewritten around the coaching door and the six presentation
  specifiers, with `date` named as the expected residue after Epic 2.
- **R2a** — rewritten: the map/door mismatch is now stated for the four modules
  that have *no* door as much as for the one that does.
- **R2b** — withdrawn, number kept, following R9's precedent. It required the
  theory door; Epic 1 owns every generator-side assertion independently.
- **R3, R3a** — scoped to `lib/presentation/`. R3a gains the shell's nine
  undoored imports as things the test must be asserted to ignore.
- **R3b** — gains "one folder and only one folder" beside "the shell and only the
  shell".
- **R4, R4a** — singular; R4a notes the leniency matters more at one door.
- **R5** — the guideline rule gains its second half: when a folder earns a door.
  This is what keeps the cut from reading as a permanent verdict on the other
  four folders.
- **R10** — gains the permanent half of the demonstration (predicate unit-tested
  against a synthetic violation), which the tech spec had already settled.
- **R12** — no agent file may claim every module has a door.
- **AC2, AC3, AC4** — rewritten. AC2 now also asserts the four folders have no
  `index.ts`; AC3 gains the "adding a `lib/audio/` import fails nothing" case, so
  the chosen scope is asserted rather than inferred.
- **AC5** — gains the earned-door test and the one-folder clause.
- **Behaviour details** — all three subsections rewritten; a new *"Why one door
  and not five"* states the cost of the choice out loud.
- **Assumptions** — one scanner not two; the fan-in test is targeted not an
  equality check; the choice is cheap to revisit.
- **Dependencies** — Epic 2's role is now creating the door itself.

**Q5. Three of R1b's arrow claims do not match the tree. Which changes?**
Answer: **The map**, per R1a, and each correction carries the files behind it.
Nothing imports the shell *except* the feature's `index.ts` and
`testing/puzzleHarness.tsx`. Coaching is imported by five region components, not
by the shell alone. Audio has three hooks, not four — `useTapSounds` and
`useSimpleMode` import `lib/persistence/preferences` and no audio module.
Applied to: R1, R1b, new R1c, AC1, Assumptions.

**Q6. R7 lists four missing arrows. Why three zones?**
Answer: **Writing the first zone at `lib/` granularity** — no `lib/` module
imports UI, hooks or the store — subsumes "coaching does not import the design
system or the shell" as one case of a stronger rule. Three zones with three
reasons beat four zones two of which share one.
Applied to: R7, new R7a (the one real violation, in a test file, and the move
that fixes it), AC6.
