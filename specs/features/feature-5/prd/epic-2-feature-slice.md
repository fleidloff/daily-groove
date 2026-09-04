# PRD — Epic 2: A feature slice with named seams

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`src/features/daily-groove/lib/` holds thirteen unrelated modules as siblings —
music theory, persistence, audio, puzzle selection, presentation and 329 lines
of generated data. This epic splits them by concern, groups the eleven
feature components by the screen region they render, moves the generated
manifest out of `lib/` into `data/`, and moves the zustand store out of `hooks/`
into `state/` where it belongs. The feature's public surface does not change.

## Problem

`lib/` is the feature's junk drawer: `notes.ts` (music theory) sits beside
`storage.ts` (localStorage) beside `grooves.generated.ts` (generated data),
with nothing to tell a reader which is which — and it grows, having taken
`resolveGroove.ts` and `transport.ts` during feature-4. `hooks/useDailyGrooveStore.ts` is
not a hook — it exports `createDailyGrooveStore`, a vanilla zustand store
factory. The briefing asks for feature sub-folders so the overview is clearer.

## Scope

- Split `lib/` into concern folders, tests moving with their subjects.
- Group `components/` by screen region.
- Move the generated manifest to `data/` and update the two places that name its
  path.
- Move the store factory to `state/`.
- Fill the feature-slice section of `docs/coding-guidelines.md`.

**Out of scope**
- `GroovePuzzle.tsx`, `createTransport`, and `src/app/page.test.tsx` — Epic 3.
- Any change to what a module does, to `index.ts`'s exports, or to the
  store/`useProgress` division of responsibility. That split is already sound —
  the store holds session state (selection, attempts, solved) and `useProgress`
  holds persisted progress — and both files document it.
- Splitting `daily-groove` into several features. The briefing asks for
  sub-folders, not a re-slicing.
- Re-rendering any groove audio.

## Requirements

- **R1** — `lib/` is split by concern, each module keeping its name and its
  colocated test:
  - `lib/theory/` — `notes.ts`, `music.ts`, `options.ts`
  - `lib/puzzle/` — `selectGroove.ts`, `scoring.ts`, `resolveGroove.ts`
  - `lib/persistence/` — `storage.ts`, `streak.ts`
  - `lib/presentation/` — `feedback.ts`, `archive.ts`
  - `lib/audio/` — `audio.ts`, `transport.ts`
- **R2** — `grooves.generated.ts` and its test move to `data/`, out of `lib/`.
  It is the generator's output, not business logic.
- **R3** — `hooks/useDailyGrooveStore.ts` moves to `state/`. `hooks/` is left
  holding `useProgress.ts`, which is a hook.
- **R4** — The eleven feature components are grouped by the screen region they
  render, each with its colocated test:
  - `components/header/` — `GrooveHeader`, `StreakBadge`
  - `components/puzzle/` — `GrooveCard`, `TransportPanel`, `GuessCard`,
    `AttemptDots`, `FeedbackLine`, `NudgeBox`, `SolvedPanel`
  - `components/archive/` — `ArchiveStrip`
  The grouping follows the composition tree: each region is a subtree of
  `GroovePuzzle`, and no component is rendered from more than one region.
  `GroovePuzzle.tsx` itself stays at the `components/` root, above the three
  region folders — it composes all three and belongs to none, so a reader
  opening `components/` meets the entry point first and the regions beneath it.
- **R5** — `types.ts` stays at the feature root and this epic moves nothing out
  of it. Epic 4 later lifts the three types the generator shares — `Root`,
  `Flavour` and `Groove` — into `src/lib/groove.ts`, leaving `Answer`, `Attempt`
  and `DailyResult` here.
- **R6** — `index.ts` exports exactly what it exports today: `GroovePuzzle` and
  the `Answer`, `Attempt`, `DailyResult`, `Flavour`, `Groove`, `Root` types. Its
  internal import paths change; its public surface does not.
- **R7** — `scripts/grooves/manifest.ts` writes the manifest to the new `data/`
  path, and `scripts/grooves/verify-cli.ts` reads it from there.
- **R8** — The move does not require re-rendering audio. The manifest's *content*
  is unchanged, so its hash in `grooves.lock.json` still matches and the freeze
  rule in `scripts/grooves/README.md` is not engaged. `npm run grooves:verify`
  passes without `npm run grooves` having been run.
- **R9** — The manifest's bytes do not change at all, header included.
  `scripts/grooves/lock.ts` computes `manifestSha256` over the whole file, so
  editing the banner would change the hash and break R8. The banner names
  `scripts/grooves/manifest.ts` and `catalogue.json` — neither of which moves —
  so it needs no edit to stay accurate.
- **R10** — No module's logic changes, and no test's assertions change. Files may
  differ only in their import statements and their location on disk.
- **R11** — The feature-slice section of `docs/coding-guidelines.md` states what
  each `lib/` sub-folder is for, that feature components are grouped by screen
  region, that generated data lives in `data/` and never in `lib/`, that
  `hooks/` holds only hooks, and that a feature is reached only through its
  `index.ts`. Each rule is written concretely, with the file that motivated it.

## Behaviour details

The one non-mechanical part is R7/R8. The manifest is written by the generator
and read by the app, and its path is named in three places: `manifest.ts` (the
write target), `verify-cli.ts` (the integrity check) and every app import. Because
the file's bytes do not change, the lock file's manifest hash stays valid across
the move — the path is not part of what is hashed. If `grooves:verify` fails
after the move, the cause is a missed path constant, not a stale render, and
running `npm run grooves` to "fix" it would re-render all 16 grooves and violate
the freeze rule.

## Acceptance criteria

- **AC1** (R1) — Given the repo after this epic, when `lib/` is listed, then it
  contains exactly the five directories in R1 and no loose `.ts` files.
- **AC2** (R2) — Given the repo after this epic, when `lib/` is searched for
  `grooves.generated.ts`, then there is no match, and the file is present under
  `data/` with its test beside it.
- **AC3** (R3) — Given the repo after this epic, when `hooks/` is listed, then it
  contains only `useProgress.ts` and its tests, and `state/` contains the store
  factory and its test.
- **AC4** (R4) — Given the repo after this epic, when `components/` is listed,
  then it contains the three region directories in R4 plus `GroovePuzzle.tsx`
  and its test, each of the other ten components sits in the region that renders
  it, and each has its test beside it.
- **AC5** (R6) — Given `index.ts` before and after, when their exported names are
  compared, then the two sets are identical.
- **AC6** (R7, R8) — Given a clean checkout after this epic, when
  `npm run grooves:verify` is run without first running `npm run grooves`, then
  it passes and reports no stale manifest.
- **AC7** (R8) — Given the diff for this epic, when `public/grooves/` is
  inspected, then no `.mp3` has changed and `grooves.lock.json`'s audio hashes
  are untouched.
- **AC8** (R7) — Given the repo after this epic, when `npm run grooves` is run in
  a scratch branch, then it writes to the `data/` path and produces a manifest
  byte-identical to the committed one.
- **AC9** (R10) — Given the diff for this epic, when every changed line in `src/`
  is inspected, then each is either an import statement, a file move, or the
  manifest's path header; no assertion or logic differs.
- **AC10** (R10) — Given the app after this epic, when `npm test`, `npm run lint`
  and `npm run build` are run, then all three pass with the same test count as
  before the epic.
- **AC11** (R11) — Given `docs/coding-guidelines.md`, when it is read, then its
  feature-slice section covers the `lib/` taxonomy, the component-region rule,
  the `data/` rule, the `hooks/` rule and the `index.ts` rule.

## Dependencies

**Needs:** the `docs/coding-guidelines.md` section skeleton pinned in the Epic 1
PRD. If Epic 2 lands first it creates the file with all five headings present and
empty, and fills only `## Feature slices`.

**Hands to Epic 3:** the final folder layout. Epic 3 edits the same files and
cannot usefully start until the paths are settled.

**Hands to Epic 4:** the concrete paths its `import/no-restricted-paths` rules
name.

## Assumptions

- `data/` sits at the feature root rather than inside `lib/`, so the "generated
  output, not logic" distinction is visible in the tree rather than buried.
- `components/archive/` holds a single component. The region survives as a named
  place for the archive UI to grow into rather than being folded into `puzzle/`,
  which would make the regions stop matching the screen.
- Sub-folder names are lowercase and match the vocabulary already used in the
  code's own comments (theory, puzzle, persistence, presentation, audio).

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-08-30

**Q1. Does `components/` get sub-folders too?**
Answer: **B) Yes, by screen region — `header/`, `puzzle/`, `archive/`** — the
briefing asks for feature sub-folders, and the regions map exactly onto the
composition tree, since each is a distinct subtree of `GroovePuzzle`.
Applied to: R4, R11, AC4, AC11, Summary, Scope, Out of scope, Assumptions

**Q2. Does `lib/` survive as a wrapper, or do the concern folders sit at the
feature root?**
Answer: **A) Keep `lib/`** — `architecture.md` prescribes it, this epic is a
reorganisation rather than a rewrite of the conventions, and it still separates
logic from `components/`, `hooks/`, `state/` and `data/`.
Applied to: R1 (unchanged, now confirmed), Assumptions

### Cycle 2 — 2026-08-30

**Q3. Where does `GroovePuzzle.tsx` sit once the regions exist?**
Answer: **A) At `components/` root, above the three region folders** — it
composes the regions rather than belonging to one, so a reader opening
`components/` meets the entry point first with the regions beneath it.
Applied to: R4, AC4

**Tree refresh — 2026-08-30.** Feature-4 landed between cycle 1 and cycle 2,
adding `lib/resolveGroove.ts` and `lib/transport.ts`. R1 now covers thirteen
modules rather than eleven: `resolveGroove.ts` joins `lib/puzzle/` beside
`selectGroove.ts`, and `transport.ts` joins `lib/audio/` beside `audio.ts`. The
component regions in R4 are unaffected — the feature still has eleven components
and the composition tree is unchanged.

**Cross-reference — 2026-08-30.** Epic 4's cycle 1 settled the generator's
boundary crossings by moving `Root`, `Flavour` and `Groove` to `src/lib/`. R5 is
amended to name that as later work rather than to claim `types.ts` is untouched
for good; nothing in this epic's scope changes.

**Correction — 2026-08-30, during implementation.** R9 previously read "the
manifest keeps its header, updated to name its new path". That was impossible:
`lock.ts` hashes the whole file including the banner, so editing it changes
`manifestSha256` and fails `grooves:verify` — contradicting R8 and AC6, which
exist to prove this epic re-renders nothing. The banner also never named the
manifest's own path, so the edit had no target. R9 now requires the opposite,
and the implementation satisfied it by leaving the file untouched: its sha256 is
still `46888e8c…`, matching the committed lock.
