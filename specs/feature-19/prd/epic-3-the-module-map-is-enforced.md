# PRD — Epic 3: The module map is written down and enforced

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Epics 1 and 2 create boundaries. This one writes them down, puts lint behind
them, and makes the hub file's regrowth a test failure rather than something
noticed a year later. It also collects the debt Epic 1 deliberately left: the
re-export shims come out and the call sites move to the real paths.

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

- name the six modules and their arrows in `docs/architecture.md`
- entry points for the four modules Epic 2 did not cover
- a structural test: the shell imports no `lib/` module directly
- a structural test: every entry point is narrow
- new ESLint zones for the boundaries lint can see
- delete Epic 1's shims and move the call sites

**Out of scope**
- restructuring `docs/coding-guidelines.md`. It stays the source of truth and
  keeps its shape; this epic adds the entry-point rule, rewrites the `src/lib/`
  "genuinely shared" bar that Epic 1 invalidated, and touches the `Flavour`
  paragraph Epic 1 moved — nothing else
- `docs/music.md`. Epic 1 does not change the generator's musical model
- enforcing anything about `scripts/grooves/` beyond the boundary test that
  already exists
- a second `features/` slice, and any zone written speculatively for one. Zones 2
  and 3 are already generated per feature and a new slice inherits them
- splitting `GroovePuzzle.tsx` further. This epic guards its shape; it does not
  set a line count

## Requirements

- **R1** — `docs/architecture.md` names six modules and the arrows between them:
  **catalogue** (`scripts/grooves/` + the generated manifests), **theory**
  (`src/lib/theory/`), **audio** (`lib/audio/` and its four hooks), **puzzle**
  (`state/`, `lib/puzzle/`, `lib/persistence/`), **coaching**
  (`lib/presentation/`), **shell** (`GroovePuzzle` and the routes).
- **R1a** — The map describes the tree as it is. If a module does not survive
  contact with a lint zone, the map is what changes.
- **R2** — Four entry points are added — audio, puzzle, persistence and theory —
  joining coaching's from Epic 2. `GroovePuzzle.tsx`'s fifteen direct `lib/`
  imports resolve to five concern folders: audio (3), presentation (6), theory
  (4, under `src/lib/` after Epic 1), puzzle (1), persistence (1).
- **R2a** — The door is per concern folder, while the map's `puzzle` module spans
  two of them. The map is how a reader groups the code; the doors are what an
  import rule can check. Both are stated, and the difference is stated with them.
- **R3** — `GroovePuzzle.tsx` imports no `lib/` module directly. Only entry
  points. A structural test reads the file from disk and fails otherwise.
- **R3a** — `../types`, `../data/` and `../hooks/` are not `lib/` and are
  unaffected. Types and generated data are not modules with seams, and the hooks
  are the shell's own.
- **R4** — Every entry point is narrow: it exports what its consumers import
  through it and nothing more. A structural test reads both sides from disk and
  fails on an export nobody imports.
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
  `daily-groove/import-boundaries` block. No second mechanism. Each carries a
  `message` naming the rule and the reason, as the existing five do.
- **R8** — Every re-export shim Epic 1 left under `lib/theory/` is deleted, and
  the 21 non-test and roughly 41 test import sites move to the real paths.
- **R9** — The one signature Epic 1 shimmed is unshimmed: `flavourOptions`'s call
  site passes its flavour pool.
- **R10** — Each new zone and each new structural test is demonstrated failing
  once, deliberately, against a violation written for the purpose. A rule that has
  never been seen to fire is a comment.
- **R11** — Nothing the player can observe changes.
- **R12** — The agent definitions under `.claude/agents/` are updated if the module
  map changes what a role needs to know.

## Behaviour details

**What "narrow" has to mean to be testable.** "Exports only what is needed" is not
checkable on its own — the test has to compare the entry point's export list
against what consumers actually import through it. An export nobody imports is
either dead or a door left open for convenience, and both are the failure R4
exists to catch. Q2 settles how strictly this is enforced, since the honest
version fails the moment someone adds an export before its consumer.

**The rule this epic is in tension with.** `coding-guidelines.md` currently says:
*"The rule binds consumers, not the feature itself: inside its own folder a
feature's files import each other freely by relative path, which is why
`components/puzzle/GuessCard.tsx` importing `../../lib/presentation/feedback` is
fine."* R3 contradicts that for the shell, and Epic 2 contradicts it for
`GuessCard`. Whether it is contradicted for *everything* inside the slice is Q1,
and it is the largest question in this epic — the answer decides whether this is
a rule about one file or about the whole feature.

**Why the shims come out here and not in Epic 1.** Epic 1 leaves them so Epics 1
and 2 can run in the same wave without both editing `GroovePuzzle.tsx`. That makes
them a scheduling device with an expiry date. If this epic slips, the tree is left
with two paths to every theory module, which is worse than before Epic 1 started.

## Acceptance criteria

- **AC1** (R1, R1a) — Given `docs/architecture.md`, when read against the tree,
  then the six modules it names correspond to folders that exist and the arrows it
  draws are the ones the lint zones enforce.
- **AC2** (R2) — Given the five concern folders, when their entry points are
  listed, then each exists and `GroovePuzzle.tsx` reaches each only through it.
- **AC3** (R3) — Given `GroovePuzzle.tsx`, when the structural test reads its
  imports, then none names a module inside `lib/`; and when a direct `lib/` import
  is added, then the test fails.
- **AC4** (R4, R4a) — Given each entry point, when its exports are compared with
  what consumers import through it, then every export is used; and when an unused
  re-export is added, then the test fails.
- **AC5** (R5, R6) — Given `docs/coding-guidelines.md`, when read, then the
  entry-point rule sits beside the no-barrel rule with its reason, and the
  `src/lib/` bar describes the directory as Epic 1 leaves it.
- **AC6** (R7, R10) — Given each new zone, when an import that violates it is
  written, then `npm run lint` rejects it with a message naming the rule and the
  reason.
- **AC7** (R8) — Given `src/features/daily-groove/lib/theory/`, when the tree is
  read, then the folder is gone or empty of shims, and no file in the repo imports
  the old paths.
- **AC8** (R9) — Given the `flavourOptions` call site, when read, then it passes
  its pool explicitly and no shim supplies it.
- **AC9** (R11) — Given a full session — first visit, a wrong guess at each rung,
  the nudge, a lock-in, a solve, a give-up, a shared link — when played before and
  after, then nothing rendered differs.
- **AC10** — Given the full gate, when `npm test`, `npm run test:gen`, the type
  check, lint and build run, then all pass.

## Dependencies

**Needs to start:** Epics 1 and 2 both merged. This epic names what they create,
deletes Epic 1's shims, and its guards fail against today's tree by design.

**Hands to:** every feature after this one. The map and the zones are what a
worker dispatched at a module reads instead of the whole rulebook.

## Assumptions

- The structural tests live beside the code they read, following
  `src/features/daily-groove/structure.test.ts` and `scripts/grooves/boundary.test.ts`
  — the two guards in this repo that already read source from disk.
- The fan-in test names `GroovePuzzle.tsx` specifically rather than "any component
  at the `components/` root". There is one root composer and the guidelines say
  there is one; a generalised rule would be guarding a case that does not exist.
- Entry points are `index.ts` in each concern folder.
- Zone additions are static, not generated. Zones 2 and 3 are generated per
  feature because the feature list varies; the concern folders inside a slice do
  not.
- Deleting the shims is mechanical enough to be one unit of work, since the
  exports and signatures are unchanged by construction.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-19 epic-3`.

### Q1. Does the entry-point rule bind the whole slice, or only the shell?

`coding-guidelines.md` today: *"inside its own folder a feature's files import
each other freely by relative path, which is why `components/puzzle/GuessCard.tsx`
importing `../../lib/presentation/feedback` is fine."* R3 contradicts that for
`GroovePuzzle.tsx` and Epic 2 contradicts it for `GuessCard`. The general case is
undecided. No persona bearing; the reason is that this decides whether the feature
is a set of modules or one folder with a tidy front door.

- [ ] A) Only the shell — `GroovePuzzle.tsx` and the routes. Everything else keeps
      importing freely *(recommended — the briefing's target is the hub file, and
      that is where the measured pain is: 9 of the last 40 commits. A rule binding
      every file in the slice would touch roughly 60 import sites for a collision
      that has never happened between two region components)*
- [ ] B) The whole slice. Every file reaches another module only through its door
      — the real module boundary, and a large mechanical change plus a rule that
      will feel like bureaucracy the first time someone wants one helper
- [ ] C) Cross-module imports need a door; within a module, free. So
      `lib/presentation/nearMiss.ts` reaching `lib/theory/families` needs one,
      `presentation` reaching its own sibling does not — the principled line, and
      the one that needs the most explaining
- [ ] D) Only the shell now, with the rule written so it can be widened later
      without being rewritten

### Q2. How strict is the narrow-door test?

R4's honest form — every export is imported by someone — fails the moment a
developer adds an export before its consumer, which is a normal order of work. No
persona bearing; the reason is whether the guard is one people work with or one
they route around.

- [ ] A) Every export must be imported by at least one consumer in the repo, tests
      included *(recommended — it is the only form that actually catches the wide
      barrel, and the failure mode it creates is a five-second fix with a message
      that says what to do; a guard that permits unused exports permits exactly the
      thing R4a describes)*
- [ ] B) The entry point may not use `export *`, and that is the whole rule —
      trivial to satisfy, and a hand-written list of forty re-exports passes it
- [ ] C) An export budget per door — no more than N — cheap to check, and N is the
      arbitrary number Q6 already rejected once
- [ ] D) No test; a review convention written into the guidelines. Honest about
      what is enforceable, and it is what feature-5 and feature-14 both did

### Q3. Does `src/lib/theory/` get a door, given the generator imports it too?

The other four modules are inside the slice. Theory is not: after Epic 1 it is in
`src/lib/`, and `scripts/` imports it by relative, extension-bearing path with no
bundler. A barrel changes what the generator has to load. No persona bearing; the
reason is Node's type stripping and the leaf rule.

- [ ] A) A door for the app, and the generator keeps importing the specific
      modules it needs *(recommended — the generator imports five modules out of
      eighteen and a barrel would make it load all of them at startup for no gain;
      the leaf rule exists so `scripts/` can reach these files directly, and R13 in
      Epic 1 keys the test tier on exactly those five paths)*
- [ ] B) One door both sides use — one rule with no exception to remember, and the
      generator pulls in eighteen modules including `licks` and `staff`
- [ ] C) No door for theory; the shell imports its modules directly, and R3 covers
      only the four inside the slice — simplest, and it leaves the largest module
      as the one exception
- [ ] D) Two doors — one app-facing, one generator-facing — explicit about the two
      audiences, and two surfaces to keep in step
