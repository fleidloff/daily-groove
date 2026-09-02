# PRD — Epic 3: The module map is written down and enforced

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Epics 1 and 2 create boundaries. This one writes them down, puts lint behind
them, and makes the hub file's regrowth a test failure rather than something
noticed a year later. Four modules get the entry point coaching got in Epic 2,
the shell is held to reaching its feature only through those doors, and a test
keeps every door narrow.

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
- entry points for the four modules Epic 2 did not cover
- a structural test: the shell imports no `lib/` module directly
- a structural test: every entry point is narrow
- new ESLint zones for the arrows lint can see
- the guidelines: the entry-point rule, the shell exception, the `src/lib/` bar

**Out of scope**
- restructuring `docs/coding-guidelines.md`. It stays the source of truth and
  keeps its shape; this epic adds the entry-point rule, rewrites the `src/lib/`
  "genuinely shared" bar that Epic 1 invalidated, and touches the `Flavour`
  paragraph Epic 1 moved — nothing else
- `docs/music.md`. Epic 1 does not change the generator's musical model
- enforcing anything about `scripts/grooves/` beyond the boundary test that
  already exists, and the one assertion R2b adds to it
- a second `features/` slice, and any zone written speculatively for one. Zones 2
  and 3 are already generated per feature and a new slice inherits them
- splitting `GroovePuzzle.tsx` further. This epic guards its shape; it does not
  set a line count
- binding any file other than the shell to the entry points. Region components,
  hooks and the modules themselves keep importing each other by relative path
- removing re-export shims. Epic 1 left none

## Requirements

- **R1** — `docs/architecture.md` names six modules and the arrows between them:
  **catalogue** (`scripts/grooves/` + the generated manifests), **theory**
  (`src/lib/theory/`), **audio** (`lib/audio/` and its four hooks), **puzzle**
  (`state/`, `lib/puzzle/`, `lib/persistence/`, and whatever Epic 2 adds to carry
  the session), **coaching** (`lib/presentation/`), **shell** (`GroovePuzzle`,
  the routes, and `lib/share/`, which exists to build the routes' URLs).
- **R1a** — The map describes the tree as it is. If a module does not survive
  contact with a lint zone, the map is what changes.
- **R1b** — The arrows are the ones the tree draws after Epics 1 and 2, and the
  map states them as a list a reader can check against the import graph:
  - shell → every other module, through its door
  - coaching → theory, puzzle
  - puzzle → theory
  - audio → theory
  - theory → nothing in the app
  - catalogue → theory, by the specific modules it needs; catalogue writes the
    manifests the shell and the modules read
  - nothing imports the shell; nothing but the shell imports coaching or audio;
    the design system imports none of the six
- **R2** — Four entry points are added — audio, puzzle, persistence and theory —
  joining coaching's from Epic 2. `GroovePuzzle.tsx`'s fifteen direct `lib/`
  imports resolve to five concern folders: audio (3), presentation (6), theory
  (4, under `src/lib/` after Epic 1), puzzle (1), persistence (1).
- **R2a** — The door is per concern folder, while the map's `puzzle` module spans
  two of them and the map's `audio` module includes hooks that sit outside any
  door. The map is how a reader groups the code; the doors are what an import
  rule can check. Both are stated, and the difference is stated with them.
- **R2b** — The theory door, `src/lib/theory/index.ts`, is for the app. The
  generator keeps importing the specific modules it needs by relative,
  extension-bearing path — five out of eighteen — and `boundary.test.ts` asserts
  that no generator import resolves to the door. The door is not one of the paths
  that trigger the generator test tier.
- **R3** — `GroovePuzzle.tsx` imports no `lib/` module directly. Only entry
  points. A structural test reads the file from disk and fails otherwise.
- **R3a** — `../types`, `../data/` and `../hooks/` are not `lib/` and are
  unaffected. Types and generated data are not modules with seams, and the hooks
  are the shell's own.
- **R3b** — The rule binds the shell and only the shell: `GroovePuzzle.tsx`, and
  the routes, which already import nothing deeper than the feature's `index.ts`
  under `route-boundary.test.ts`. Every other file in the slice keeps importing
  sideways by relative path, as `coding-guidelines.md` says it may.
  `GuessCard` importing the coaching door is Epic 2's design, not an instance of
  this rule. The guidelines' sentence *"the rule binds consumers, not the feature
  itself"* gains the shell as its one named exception, with the reason: the
  measured pain is in one file, and a rule binding sixty import sites would guard
  a collision that has never happened between two region components.
- **R4** — Every entry point is narrow: every export of it is imported by at
  least one file in the repo, tests included, and it contains no `export *`. A
  structural test reads the door and every importer from disk and fails on an
  export nobody imports. The failure it produces when a developer adds an export
  before its consumer is a five-second fix, and its message says so.
- **R4a** — R4 is what makes R3 mean anything. Five wide barrels would let
  `GroovePuzzle.tsx` read as five imports while reaching exactly as far as it does
  today — R3 would pass and the coupling would be invisible. This is the half of
  the `src/components/` no-barrel rule that transfers: *"the grouping would stop
  telling a reader anything, because every path would end at the barrel."*
- **R5** — `docs/coding-guidelines.md` gains the entry-point rule, placed next to
  the no-barrel rule, saying why one folder set gets doors and the other does not:
  the design system is a flat catalogue of interchangeable primitives, a feature
  module is a seam with a job.
- **R6** — The `src/lib/` "genuinely shared" bar is rewritten. Epic 1 put eleven
  app-only theory modules there, so the bar as written — *"two callers on opposite
  sides of the app/generator boundary"* — no longer describes the directory. The
  rewrite says what now earns a place and what does not, or `src/lib/` becomes the
  place things go when nobody wants to decide.
- **R7** — New ESLint zones extend the existing
  `daily-groove/import-boundaries` block. No second mechanism. Every missing arrow
  in R1b that lint can express at folder granularity — coaching not importing the
  design system or the shell, audio not importing coaching or puzzle, puzzle not
  importing coaching or audio, no module importing `components/` or `hooks/` — is
  a zone, and each carries a `message` naming the rule and the reason, as the
  existing five do. The shell's own rule (R3) is a structural test, not a zone,
  because it is about one file's imports resolving to `index.ts` and not to
  siblings.
- **R8** — Nothing from Epic 1 is left to collect. No file in the repo imports
  `src/features/daily-groove/lib/theory/`, the folder does not exist, and every
  `flavourOptions` call passes its pool. This is a check, not work.
- **R10** — Each new zone and each new structural test is demonstrated failing
  once, deliberately, against a violation written for the purpose. A rule that has
  never been seen to fire is a comment.
- **R11** — Nothing the player can observe changes.
- **R12** — The agent definitions under `.claude/agents/` are updated if the module
  map changes what a role needs to know.

## Behaviour details

**What "narrow" means, exactly.** The test compares each door's export list with
the union of what every file in the repo imports from that door. An export with
no importer fails; `export *` fails on sight. A test file counts as an importer,
which is a deliberate leniency: it lets a door export something whose only
consumer so far is the test that proves it, and it means the honest order of work
— export, then test, then consumer — never fails on the middle step. What it
still catches is the wide barrel, because a hand-written list of forty re-exports
has forty importers to find or forty lines to delete.

**Where the rule stops.** The shell is the only file held to the doors. The
guidelines currently say the opposite in general — *"inside its own folder a
feature's files import each other freely by relative path"* — and that sentence
stays true for every file but one. The shell is the exception because it is the
composer: it assembles every region, so its import list is the one place the
whole graph is visible, and the one place it has grown back twice.

**Theory's two audiences.** Eighteen modules, one door for the app, and a
generator that imports five of them directly. The door would cost the generator
nothing at runtime except loading thirteen modules it never calls — but it would
also put the door on the generator's crossing list, make the door a tier-trigger
path, and give `scripts/` a reason to import `licks` or `staff` by accident. The
boundary test closing the door to the generator is one assertion.

## Acceptance criteria

- **AC1** (R1, R1a, R1b) — Given `docs/architecture.md`, when read against the
  tree, then the six modules it names correspond to folders that exist, every
  folder under the slice and under `src/lib/theory/` is placed in one of them,
  and every arrow it lists has at least one import behind it and every missing
  arrow has none.
- **AC2** (R2, R2b) — Given the five concern folders, when their entry points are
  listed, then each exists and `GroovePuzzle.tsx` reaches each only through it;
  and given `scripts/grooves/`, when its imports are read, then none resolves to
  `src/lib/theory/index.ts`.
- **AC3** (R3, R3b) — Given `GroovePuzzle.tsx`, when the structural test reads its
  imports, then none names a module inside `lib/`; when a direct `lib/` import is
  added, then the test fails; and given any other file in the slice importing a
  `lib/` module directly, then no test or zone objects.
- **AC4** (R4, R4a) — Given each entry point, when its exports are compared with
  what the repo imports through it, then every export has an importer and no
  `export *` appears; and when an unused re-export or an `export *` is added, then
  the test fails with a message that names the export.
- **AC5** (R5, R6, R3b) — Given `docs/coding-guidelines.md`, when read, then the
  entry-point rule sits beside the no-barrel rule with its reason, the shell is
  named as the one exception to free intra-feature imports, and the `src/lib/` bar
  describes the directory as Epic 1 leaves it.
- **AC6** (R7, R10) — Given each new zone, when an import that violates it is
  written, then `npm run lint` rejects it with a message naming the rule and the
  reason.
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

**Needs to start:** Epics 1 and 2 both merged. This epic names what they create
and its guards fail against today's tree by design.

**Hands to:** every feature after this one. The map and the zones are what a
worker dispatched at a module reads instead of the whole rulebook.

## Assumptions

- The structural tests live beside the code they read, following
  `src/features/daily-groove/structure.test.ts` and `scripts/grooves/boundary.test.ts`
  — the two guards in this repo that already read source from disk. The theory
  door's narrowness is asserted from `src/lib/`, the four in-slice doors from the
  feature's structure test.
- The fan-in test names `GroovePuzzle.tsx` specifically rather than "any component
  at the `components/` root". There is one root composer and the guidelines say
  there is one; a generalised rule would be guarding a case that does not exist.
- Entry points are `index.ts` in each concern folder. The theory door imports
  only from `src/lib/theory/` and meets the leaf bars like any other file there.
- `lib/share/` belongs to the shell in the map. Its two modules build the routes'
  URLs and drive the browser share sheet, and only the header's share button and
  the feature's public `index.ts` import them. It gets no door: the shell does not
  import it and no module does.
- The map's `audio` module names the four hooks that drive playback, and the
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

**Epic 1's Q1 (no shims), applied here.** Epic 1 moves every theory consumer
itself, so this epic's R8 (delete the shims and move ~60 import sites) and R9
(unshim the `flavourOptions` call site) became checks rather than work. R8 is
rewritten as that check; R9 is withdrawn and its number left unused so the ACs
keep their references.
Applied to: Summary, Scope, Out of scope, R8, AC7, AC8, Behaviour details,
Dependencies.
