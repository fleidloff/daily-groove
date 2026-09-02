# PRD — Epic 1: One body of theory

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Music theory is written twice in this repo — once for the generator that mints
grooves, once for the app that asks about them — and the two copies already say
the same thing in two spellings. This epic moves all of it into `src/lib/theory/`
so both halves import one body, and does it without re-rendering a single note of
audio. Nobody playing the game can tell it happened; the next person who adds a
scale edits one file instead of two.

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
  `src/lib/theory/`
- merge in the generator's `theory/notes.ts` and `theory/scales.ts`
- make the slug the canonical key and move the slug↔display conversion with it
- leave re-export shims at the old paths so no consumer changes in this epic
- narrow the generator test tier's trigger to the modules the generator imports

**Out of scope**
- **any change to the generated catalogue.** Not one MP3 re-renders, not one uuid
  moves, not one past date is reassigned
- `src/lib/hash.ts`. Frozen, pinned by a fixed table, untouched
- the generator's `harmony.ts`, `pitches.ts` and `validity.ts`. They take
  `MusicMeta`, `NoteEvent` and `VoiceName` from the generator's own `types.ts`,
  so they are the quality gate rather than theory; dragging generator event types
  into `src/lib/` would invert the dependency the leaf rule protects
- adding a thirteenth scale. This epic makes that a one-edit job; it does not do
  it
- removing the shims and updating call sites — Epic 3
- the coaching door and the `GuessCard` prop list — Epic 2

## Requirements

- **R1** — All thirteen modules under `src/features/daily-groove/lib/theory/`
  live at `src/lib/theory/`: `changes`, `character`, `degrees`, `difference`,
  `families`, `licks`, `music`, `notes`, `numerals`, `options`, `phrase`,
  `simpleModes`, `staff`. Each module's test moves with it.
- **R2** — `src/features/daily-groove/lib/theory/` holds only re-export shims
  after this epic. `structure.test.ts`'s six-concern-folder assertion is updated
  to describe what the folder now is.
- **R3** — The generator's `scripts/grooves/theory/notes.ts` and
  `theory/scales.ts` are gone; their contents live in `src/lib/theory/` and the
  generator imports them by relative, extension-bearing path.
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
- **R6** — `boundary.test.ts:96` asserts `scripts/grooves/types.ts` still
  declares `Flavour`. That assertion is **rewritten**, not deleted: the rule it
  stands for — the generator does not silently inherit the app's spelling — still
  holds, and now holds in `src/lib/theory/`. The `coding-guidelines.md` paragraph
  explaining why the two `Flavour` types are not duplicates is rewritten in the
  same change, or the test and the prose disagree.
- **R7** — `flavourOptions` takes its flavour pool as an argument. It is the only
  signature that changes, and it changes because it is the only impurity: it
  closes over `GROOVES` from `../../data/grooves.generated`, an app import
  `src/lib/` may not make. `flavourPool` already takes its grooves this way.
- **R8** — `isoDate` and `parseIsoDate` move from
  `lib/puzzle/selectGroove.ts` to `src/lib/`. `music.ts` and `simpleModes.ts`
  both need `isoDate`, and leaving it behind would make `src/lib/theory/` import
  the feature.
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
- **R12** — The old paths keep working unchanged. Every current import of
  `lib/theory/*` — 21 non-test sites across 11 files, plus roughly 41 in tests —
  resolves to the same names with the same signatures, `flavourOptions` included.
  The shim supplies `GROOVES` so the two-argument call site is unaffected.
- **R13** — The generator test tier triggers on the `src/lib/` modules the
  generator imports — `groove.ts`, `hash.ts`, `theory/roots.ts`,
  `theory/scales.ts`, `theory/names.ts` — not on the `src/lib/` folder.
- **R14** — The committed audio, the two manifests, the catalogue and the lock
  file are byte-identical before and after.
- **R15** — The generator, re-run from the current catalogue, still produces
  those exact bytes. This is a separate claim from R14 and is not implied by it.

## Behaviour details

**Why R15 is not R14.** `npm run grooves:verify` hashes the committed artifacts
against `grooves.lock.json`. It proves nobody edited an output. It does not
re-render, so it cannot prove the refactored generator would still *produce*
those outputs — and a subtle change in the theory module (an interval reordered,
a root index shifted, a conversion applied at a different point) would leave
`grooves:verify` perfectly green while silently changing what the next
`npm run grooves` emits. The failure would surface on the next catalogue change,
attributed to that change, months from the refactor that caused it. Q3 decides
how hard this epic proves R15.

**The shim's shape.** Thirteen files at the old paths, each re-exporting from
`src/lib/theory/`, plus one that also closes over `GROOVES` for `flavourOptions`.
They are written to be deleted: Epic 3 removes them and rewrites the 21 call
sites. Anything that makes them comfortable to keep — adding a name that only
exists in the shim, letting a new consumer import one — defeats the point.

**The one cycle to watch.** `lib/puzzle/selectGroove.ts` imports `seededShuffle`
from `theory/options`, and `theory/music.ts` imports `isoDate` back from
`selectGroove.ts`. R8 breaks that by moving `isoDate` down into `src/lib/`; doing
R1 without R8 would leave `src/lib/theory/` importing the feature, which lint
zone 4 rejects.

## Acceptance criteria

- **AC1** (R1, R2) — Given the tree after this epic, when
  `src/features/daily-groove/lib/theory/` is read from disk, then every file in
  it is a re-export and every implementation lives under `src/lib/theory/`.
- **AC2** (R3) — Given `scripts/grooves/theory/`, when its files are listed, then
  `notes.ts` and `scales.ts` are absent and `harmony.ts`, `pitches.ts` and
  `validity.ts` remain, importing the shared module by relative path.
- **AC3** (R4) — Given the source of `src/` and `scripts/`, when scanned for the
  root list and the interval table, then each appears in exactly one file.
- **AC4** (R5, R5b) — Given each of the twelve slugs, when converted, then the
  display name matches the manifest's current spelling exactly; and given each
  display name, when converted back, then the original slug returns.
- **AC5** (R6) — Given `scripts/grooves/types.ts`, when `boundary.test.ts` runs,
  then the rewritten assertion passes and fails when the generator's `Flavour`
  is replaced by an import of the app's.
- **AC6** (R7, R12) — Given `GroovePuzzle.tsx` unmodified, when the app builds and
  its tests run, then everything passes — the two-argument `flavourOptions` call
  included.
- **AC7** (R10) — Given every file under `src/lib/`, when scanned for import
  specifiers, then none begins with `@/`.
- **AC8** (R13) — Given an epic scope touching `src/lib/theory/scales.ts`, when
  the tier is selected, then the generator tier runs; given one touching
  `src/lib/theory/licks.ts`, then it does not.
- **AC9** (R14) — Given the tree after this epic, when `npm run grooves:verify`
  runs and `git status` is read, then verification passes and no file under
  `public/grooves/`, `public/notes/`, `data/*.generated.ts`, `catalogue.json` or
  `grooves.lock.json` is modified.
- **AC10** (R15) — Given the current catalogue, when the generator is re-run to a
  scratch location and its output hashed, then every hash matches
  `grooves.lock.json`. The depth at which this is run is Q3.
- **AC11** — Given the full gate, when `npm test`, `npm run test:gen`, the type
  check, lint and build all run, then all pass.

## Dependencies

**Needs to start:** nothing. This epic can begin immediately — it has no overlap
with feature-18, which owns files under `lib/presentation/`.

**Hands to Epic 3:**
- the path and public surface of `src/lib/theory/`, which Epic 3's lint zone names
- the shim surface at `lib/theory/*` — same exports, same signatures — which is
  what lets Epic 2 run in the same wave, and which Epic 3 deletes
- the rewritten `src/lib/` bar in `coding-guidelines.md`, which Epic 3 extends

**Hands to Epic 2:** nothing. The two are disjoint by construction.

## Assumptions

- `src/lib/theory/` is flat, matching `lib/theory/` as it stands. Eighteen files
  is within what a flat folder carries, and inventing sub-folders during a move
  makes the diff harder to read than the result is worth.
- The name collision on `notes.ts` — the app's holds `FLAVOUR_INTERVALS` and
  `scaleNotes`, the generator's holds `ROOTS` and the midi conversions — resolves
  into `scales.ts` (the twelve and their intervals), `roots.ts` (the root list and
  pitch-class/midi) and `names.ts` (the slug↔display map). The other eleven keep
  their names.
- Test files move with their modules and keep their assertions. Per
  `docs/testing.md`, logic in `lib/` is tested directly as plain functions, which
  is what these already are.
- `src/lib/` grows from three files to roughly twenty. This is the price of Q2's
  answer and is recorded in the roadmap's assumptions as the call most likely to
  be regretted.
- Deleting `src/features/daily-groove/` after this epic leaves eleven theory
  modules in `src/lib/` that nothing imports. The app still builds, so
  `architecture.md`'s removability standard holds literally, but the cut is no
  longer clean.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-19 epic-1`.

### Q1. How much does the shim cover?

Thirteen shim modules is a lot of scaffolding to write and then delete. The
alternative is to update most call sites now and shim only what Epic 2 would
collide with. No persona bearing; the reason is scheduling.

- [ ] A) Shim all thirteen; no consumer changes in this epic *(recommended — the
      collision is not only `GroovePuzzle.tsx`: `puzzleHarness.tsx` is shared test
      infrastructure Epic 2 rewrites, and 41 test import sites are spread across
      files Epic 2 owns. A partial shim means guessing now which files Epic 2 will
      touch, and guessing wrong is the merge conflict this feature exists to
      avoid)*
- [ ] B) Shim only the four modules `GroovePuzzle.tsx` imports; update the other
      seventeen call sites now — a smaller Epic 3, and Epic 1 edits files in
      `components/solved/` and `hooks/` that Epic 2 may also want
- [ ] C) No shims. Epic 1 updates all 21 call sites and both epics run
      sequentially — simplest tree at every moment, and it costs the parallel wave
- [ ] D) Shim all thirteen and mark each with a deletion ticket, so Epic 3's
      removal list is mechanical rather than rediscovered

### Q2. Where does the generator's twelve-slug `Flavour` union live afterwards?

`boundary.test.ts:96` asserts `scripts/grooves/types.ts` declares it, and
`coding-guidelines.md` explains at length why it is not a duplicate of the app's
display-string `Flavour`. R5 moves the conversion into `src/lib/theory/`; the
union itself could go either way. No persona bearing; the reason is engineering.

- [ ] A) The union moves to `src/lib/theory/names.ts` beside the conversion, and
      `scripts/grooves/types.ts` imports it *(recommended — R4 asks that the
      twelve be declared once, and a slug union that lists all twelve in a second
      file is the same duplication the epic is removing, one type-level away)*
- [ ] B) The union stays in `scripts/grooves/types.ts` and the shared module
      imports it — no generator type moves, and `src/lib/` then depends on
      `scripts/`, which inverts the leaf rule
- [ ] C) The union stays where it is and the shared module declares its own,
      with a test asserting the two lists match — least disruption, most copies
- [ ] D) Derive the union from the interval table's keys, so it cannot drift from
      the twelve by construction — no second list anywhere, and a less readable
      type in editor tooltips

### Q3. How hard does this epic prove that the generator still renders the same audio?

`grooves:verify` hashes committed outputs against the lock; it never re-renders,
so it cannot catch a refactor that changes what the *next* render produces. That
failure would surface months later, attributed to whatever catalogue change
happened to trigger it. Sam's stake is real but indirect: a re-render reassigns
every past date's puzzle and breaks every share link already sent, which
`docs/music.md` names as the reason these four things must never change.

- [ ] A) Re-render the full catalogue to a scratch directory and hash every MP3
      against the lock, once, as the epic's exit gate *(recommended — it is the
      only check that actually tests R15, it runs once rather than per commit, and
      `docs/music.md` treats a silent re-render as the worst failure this codebase
      has; the cost is one slow run at the end)*
- [ ] B) Re-render a sample — three grooves, one per feel — and hash those. Most
      of the confidence for a fraction of the time, and it cannot catch a scale
      that only one uncovered groove uses
- [ ] C) Trust the generator tier's existing tests plus `grooves:verify`. Cheapest,
      and it is exactly the combination that would stay green through the failure
      described above
- [ ] D) Re-render the full catalogue and wire it in as a permanent check that
      runs whenever the shared theory modules change — strongest, and it puts a
      slow render into a gate that was just made faster
