# PRD — Epic 1: One body of theory

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Music theory is written twice in this repo — once for the generator that mints
grooves, once for the app that asks about them — and the two copies already say
the same thing in two spellings. This epic moves all of it into `src/lib/theory/`
so both halves import one body, moves every consumer to the new paths in the same
change, and does it without re-rendering a single note of audio. Nobody playing
the game can tell it happened; the next person who adds a scale edits one file
instead of two.

## Problem

The duplication is literal, not thematic:

| What | App | Generator |
| :-- | :-- | :-- |
| The twelve roots | `lib/theory/music.ts:6` — `ROOTS` | `scripts/grooves/theory/notes.ts:3` — `ROOTS` |
| The twelve scales | `lib/theory/notes.ts:40` — `FLAVOUR_INTERVALS`, keyed `Ionian` | `scripts/grooves/theory/scales.ts:20` — `INTERVALS`, keyed `ionian` |
| Root → pitch class | `lib/theory/phrase.ts:22` — `rootMidiOf` | `theory/notes.ts:18` — `pitchClassOf`, `midiOf` |
| Degree → semitones | `lib/theory/phrase.ts:28` — `degreeSemitones` | `theory/validity.ts:14` — `scaleDegreePitchClasses` |

`ROOTS` is byte-identical in both. The interval sets are identical in value and
differ only in how the key is spelled. `src/lib/groove.ts` — 32 lines of types —
is the entire shared surface today, so every change that touches both sides pays
twice: feature-11's real notes and feature-16's licks both did.

`docs/music.md` calls the twelve scales one of the things that must never change,
and right now "the twelve scales" is two lists that nothing checks against each
other.

## Scope

- move all thirteen modules of `src/features/daily-groove/lib/theory/` to
  `src/lib/theory/`, and delete the old folder
- merge in the generator's `theory/notes.ts` and `theory/scales.ts`
- make the slug the canonical key; move the slug union and the slug↔display
  conversion with it
- move every consumer — app source and tests — to the new paths. No re-export
  shims at any point
- narrow the generator test tier's trigger to the modules the generator imports
- prove, once, that the refactored generator still renders the committed bytes

**Out of scope**
- **any change to the generated catalogue.** Not one MP3 re-renders into the
  tree, not one uuid moves, not one past date is reassigned
- `src/lib/hash.ts`. Frozen, pinned by a fixed table, untouched
- the generator's `harmony.ts`, `pitches.ts` and `validity.ts`. They take
  `MusicMeta`, `NoteEvent` and `VoiceName` from the generator's own `types.ts`,
  so they are the quality gate rather than theory; dragging generator event types
  into `src/lib/` would invert the dependency the leaf rule protects
- adding a thirteenth scale. This epic makes that a one-edit job; it does not do
  it
- the theory door, `src/lib/theory/index.ts` — Epic 3. Consumers moved here
  import module paths directly; Epic 3 routes the shell's through the door
- the coaching door and the `GuessCard` prop list — Epic 2
- a permanent re-render check in any gate. The proof in R15 runs once

## Requirements

- **R1** — All thirteen modules under `src/features/daily-groove/lib/theory/`
  live at `src/lib/theory/`: `changes`, `character`, `degrees`, `difference`,
  `families`, `licks`, `music`, `notes`, `numerals`, `options`, `phrase`,
  `simpleModes`, `staff`. Each module's test moves with it.
- **R2** — `src/features/daily-groove/lib/theory/` no longer exists.
  `structure.test.ts`'s concern-folder assertion lists five folders — `audio`,
  `persistence`, `presentation`, `puzzle`, `share` — not six.
- **R3** — The generator's `scripts/grooves/theory/notes.ts` and
  `theory/scales.ts` are gone; their contents live in `src/lib/theory/` and the
  generator imports them by relative, extension-bearing path. The crossing list
  `boundary.test.ts` pins — today `groove.ts` and `hash.ts` — is extended to
  exactly the shared theory modules the generator reaches, and nothing else.
- **R4** — `ROOTS` and the twelve interval sets are each declared exactly once
  in the repo. A test asserts this by reading the source of both trees, in the
  shape `src/lib/hash.test.ts` already uses for the FNV prime — and, like that
  test, it keeps itself out of its own search.
- **R5** — The scale slug (`harmonic-minor`) is the canonical key. The display
  name (`Harmonic minor`) is derived from it by a single conversion function in
  `src/lib/theory/`, moved from `scripts/grooves/cli.ts:31`.
- **R5a** — Both spellings survive. This is not a unification: the generator's
  `Flavour` is a twelve-member slug union, the app's is a display string, and
  `coding-guidelines.md` is explicit that merging them "would be a behaviour
  change wearing a de-duplication's clothes". What changes is that the two
  spellings and the map between them are stated in one module instead of being
  a fact about two files that never meet.
- **R5b** — The conversion is exact for all twelve, including the multi-word
  slugs. Naive capitalisation is what breaks here, so the map is data, not an
  algorithm.
- **R5c** — The twelve-slug union is declared once, in `src/lib/theory/names.ts`,
  beside the conversion. `scripts/grooves/types.ts` imports it from there and
  re-exports it under the name `Flavour` the generator already uses, so no
  generator module other than `types.ts` changes an import for it. A slug union
  that listed all twelve in a second file would be the duplication this epic
  removes, one type level away.
- **R6** — `boundary.test.ts:96` asserts `scripts/grooves/types.ts` declares
  `Flavour`. That assertion is **rewritten**, not deleted: it now asserts that
  `types.ts` does *not* declare the union itself, that it imports it from
  `src/lib/theory/names.ts`, and that it does not import `Flavour` from
  `src/lib/groove.ts`. The rule it stands for — the generator does not silently
  inherit the app's spelling — still holds, and now holds in `src/lib/theory/`.
  The `coding-guidelines.md` paragraph explaining why the two `Flavour` types are
  not duplicates is rewritten in the same change, or the test and the prose
  disagree.
- **R7** — `flavourOptions` takes its flavour pool as an argument. It is the only
  signature that changes, and it changes because it is the only impurity: it
  closes over `GROOVES` from `../../data/grooves.generated`, an app import
  `src/lib/` may not make. `flavourPool` already takes its grooves this way. The
  call sites — `GroovePuzzle.tsx`, `puzzleHarness.tsx`, `GuessCard.test.tsx` and
  any other — pass `GROOVES` explicitly.
- **R8** — `isoDate` and `parseIsoDate` move from
  `lib/puzzle/selectGroove.ts` to `src/lib/`. `music.ts` and `simpleModes.ts`
  both need `isoDate`, and leaving it behind would make `src/lib/theory/` import
  the feature. Their consumers in `lib/persistence/`, `lib/presentation/`,
  `hooks/` and the tests move with them.
- **R9** — `Answer` and `Attempt` move from the feature's `types.ts` into
  `src/lib/groove.ts`, which already holds `Root`, `Flavour` and `Groove`.
  `types.ts` re-exports them, as it already does for the other three.
  `src/lib/groove.test.ts`'s zero-import assertion still passes.
- **R10** — No module under `src/lib/` imports through the `@/` alias.
  `options.ts`'s `@/lib/hash` becomes a relative import. Node's type stripping
  resolves no alias, so an aliased import is what stops the generator running the
  module at all.
- **R11** — Every module moved to `src/lib/` meets the leaf bars that still
  apply: pure, dependency-free of app code, runtime-safe TypeScript. The fourth
  bar — *genuinely shared* — no longer holds for eleven of them, and
  `coding-guidelines.md` is rewritten to say what the bar is now.
- **R12** — Every consumer imports the new paths. The ten non-test files that
  import `lib/theory/*` today — `GroovePuzzle.tsx`, `GuessCard.tsx`'s siblings
  under `components/`, the hooks, `lib/presentation/`, `lib/puzzle/`,
  `lib/audio/lick.ts` — and every test, roughly sixty import lines in all, are
  rewritten in this epic. No file imports `lib/theory/` afterwards, and no file
  re-exports a theory module from the old location.
- **R13** — The generator test tier triggers on the `src/lib/` modules the
  generator imports — `groove.ts`, `hash.ts`, `theory/roots.ts`,
  `theory/scales.ts`, `theory/names.ts` — not on the `src/lib/` folder.
- **R14** — The committed audio, the two manifests, the catalogue and the lock
  file are byte-identical before and after.
- **R15** — The generator, re-run from the current catalogue, still produces
  those exact bytes. This is a separate claim from R14 and is not implied by it.
  It is proved once, as this epic's exit gate, by rendering the full catalogue
  to a scratch directory and checking every MP3's hash against the committed
  `grooves.lock.json`. A mismatch on any groove stops the epic: that is not a
  refactor.

## Behaviour details

**Why R15 is not R14.** `npm run grooves:verify` hashes the committed artifacts
against `grooves.lock.json`. It proves nobody edited an output. It does not
re-render, so it cannot prove the refactored generator would still *produce*
those outputs — and a subtle change in the theory module (an interval reordered,
a root index shifted, a conversion applied at a different point) would leave
`grooves:verify` perfectly green while silently changing what the next
`npm run grooves` emits. The failure would surface on the next catalogue change,
attributed to that change, months from the refactor that caused it.

**How R15 is run.** `generate()` in `scripts/grooves/cli.ts` already takes
`outDir`, `manifestPath` and `lockPath` options, so a full render can be pointed
at a scratch directory without touching the tree. The scratch lock's hash per
groove is compared with the committed lock's. It runs once, at the end of the
epic, and is not wired into any gate: the gate was just made faster and a slow
render does not belong in it.

**Why every consumer moves now.** Shims at the old paths would have let Epics 1
and 2 run in the same wave without both editing `GroovePuzzle.tsx`. They were
scaffolding to write and then delete, and they would have left the tree with two
paths to every theory module until Epic 3 removed them. This epic moves the
consumers itself and the epics run in sequence — theory, then coaching, then the
shell — which is the order the briefing gives anyway. The tree has one path to
every module at every commit.

**The one cycle to watch.** `lib/puzzle/selectGroove.ts` imports `seededShuffle`
from `theory/options`, and `theory/music.ts` imports `isoDate` back from
`selectGroove.ts`. R8 breaks that by moving `isoDate` down into `src/lib/`; doing
R1 without R8 would leave `src/lib/theory/` importing the feature, which lint
zone 4 rejects.

## Acceptance criteria

- **AC1** (R1, R2) — Given the tree after this epic, when
  `src/features/daily-groove/lib/` is listed, then `theory/` is absent and every
  one of the thirteen modules and its test **file** lives under
  `src/lib/theory/`. The criterion is graded on those twenty-six files, not on
  every assertion inside them: a moved test may not import the feature, so the
  cases whose subject is the shipped catalogue live with the catalogue, in
  `src/features/daily-groove/data/grooves.generated.test.ts`. Cases that needed
  only a mode pool or a `Groove` value move with their module and take a local
  one.
- **AC2** (R3) — Given `scripts/grooves/theory/`, when its files are listed, then
  `notes.ts` and `scales.ts` are absent and `harmony.ts`, `pitches.ts` and
  `validity.ts` remain, importing the shared module by relative path; and
  `boundary.test.ts`'s crossing list names exactly the `src/lib/` files the
  generator imports.
- **AC3** (R4) — Given the source of `src/` and `scripts/`, when scanned for the
  root list and the interval table, then each appears in exactly one file.
- **AC4** (R5, R5b) — Given each of the twelve slugs, when converted, then the
  display name matches the manifest's current spelling exactly; and given each
  display name, when converted back, then the original slug returns.
- **AC5** (R5c, R6) — Given `scripts/grooves/types.ts`, when `boundary.test.ts`
  runs, then the rewritten assertion passes; and when the import is redirected
  to `src/lib/groove.ts`'s `Flavour`, or the union is redeclared in `types.ts`,
  then it fails.
- **AC6** (R7, R12) — Given the whole repo, when scanned for import specifiers,
  then none resolves to `src/features/daily-groove/lib/theory/`, and every
  `flavourOptions` call passes its pool.
- **AC7** (R10) — Given every file under `src/lib/`, when scanned for import
  specifiers, then none begins with `@/`.
- **AC8** (R13) — Given an epic scope touching `src/lib/theory/scales.ts`, when
  the tier is selected, then the generator tier runs; given one touching
  `src/lib/theory/licks.ts`, then it does not.
- **AC9** (R14) — Given the tree after this epic, when `npm run grooves:verify`
  runs and `git status` is read, then verification passes and no file under
  `public/grooves/`, `public/notes/`, `data/*.generated.ts`, `catalogue.json` or
  `grooves.lock.json` is modified.
- **AC10** (R15) — Given the current catalogue, when the generator renders every
  groove to a scratch directory and each MP3 is hashed, then every hash matches
  the entry for that groove in the committed `grooves.lock.json`.
- **AC11** — Given the full gate, when `npm test`, `npm run test:gen`, the type
  check, lint and build all run, then all pass.

## Dependencies

**Needs to start:** nothing. This epic can begin immediately — it has no overlap
with feature-18, which owns files under `lib/presentation/`.

**Hands to Epic 2:** the new import paths. Epic 2 starts after this epic lands,
so `GroovePuzzle.tsx`, `GuessCard.test.tsx` and `puzzleHarness.tsx` already
import `src/lib/theory/` when Epic 2 edits them.

**Hands to Epic 3:**
- the path and public surface of `src/lib/theory/`, which Epic 3's door and lint
  zone name
- the rewritten `src/lib/` bar in `coding-guidelines.md`, which Epic 3 extends
- a tree with no shims to remove

## Assumptions

- `src/lib/theory/` is flat, matching `lib/theory/` as it stands. Eighteen files
  is within what a flat folder carries, and inventing sub-folders during a move
  makes the diff harder to read than the result is worth.
- The name collision on `notes.ts` — the app's holds `FLAVOUR_INTERVALS` and
  `scaleNotes`, the generator's holds `ROOTS` and the midi conversions — resolves
  into `scales.ts` (the twelve and their intervals), `roots.ts` (the root list and
  pitch-class/midi) and `names.ts` (the slug union and the slug↔display map). The
  other eleven keep their names.
- The slug union is named `FlavourSlug` in `names.ts`, because `src/lib/groove.ts`
  already exports a `Flavour` and two types of that name in one folder would be
  the confusion the `coding-guidelines.md` paragraph exists to prevent. The
  generator's `types.ts` re-exports it as `Flavour`, so the generator's six files
  that use the name are untouched.
- App consumers import by alias — `@/lib/theory/music` and so on — as the feature
  already does for `@/lib/hash` and `@/lib/branding`. `GroovePuzzle.tsx`'s four
  theory imports point at module paths in this epic and are rerouted through the
  door Epic 3 creates.
- MP3 encoding is deterministic for the same input on the same machine. The lock
  file and `grooves:verify` already rest on that. If a scratch hash differs, the
  two files are decoded and their PCM compared before the difference is called a
  regression — an encoder that is not bit-stable is a finding about the gate,
  not about the theory move.
- The scratch render is a one-off invocation of `generate()` with scratch paths,
  not a new npm script. If a small script is written to drive it, it lives under
  `scripts/grooves/` and is wired into nothing.
- Test files move with their modules and keep their assertions. Per
  `docs/testing.md`, logic in `lib/` is tested directly as plain functions, which
  is what these already are.
- `src/lib/` grows from three files to roughly twenty. This is the price of
  moving all thirteen and is recorded in the roadmap's assumptions as the call
  most likely to be regretted.
- Deleting `src/features/daily-groove/` after this epic leaves eleven theory
  modules in `src/lib/` that nothing imports. The app still builds, so
  `architecture.md`'s removability standard holds literally, but the cut is no
  longer clean.
- The roadmap's "Execution waves" and "Contract frozen here" sections have been
  corrected to match: no shims, and the sequence is Epic 1 → Epic 2 → Epic 3 →
  Epic 4.

## Question log

### Cycle 1 — 2026-09-02

**Q1. How much does the shim cover?**
Answer: **C) No shims.** Epic 1 updates every call site and the epics run in
sequence — the simplest tree at every commit, at the cost of the parallel wave.
Applied to: Summary, Scope, Out of scope, R2, R7, R8, R12, AC1, AC6,
Behaviour details, Dependencies, Assumptions. Epic 3's shim-removal
requirements were withdrawn in the same cycle.

**Q2. Where does the generator's twelve-slug `Flavour` union live afterwards?**
Answer: **A) In `src/lib/theory/names.ts`, beside the conversion**, imported by
`scripts/grooves/types.ts` — a union that lists the twelve in a second file is
the duplication being removed, one type level away.
Applied to: R5c, R6, AC5, Assumptions (`FlavourSlug`).

**Q3. How hard does this epic prove that the generator still renders the same audio?**
Answer: **A) Re-render the full catalogue to a scratch directory and hash every
MP3 against the lock, once, as the exit gate** — the only check that tests R15,
and `docs/music.md` treats a silent re-render as the worst failure this codebase
has.
Applied to: R15, AC10, Out of scope, Behaviour details, Assumptions.
