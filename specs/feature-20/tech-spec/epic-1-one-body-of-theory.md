# Tech spec — Epic 1: One body of theory

PRD: [../prd/epic-1-one-body-of-theory.md](../prd/epic-1-one-body-of-theory.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This is a move, not a rewrite: every value that reaches the encoder is carried
across byte for byte, and the epic's whole risk sits in three tables — `ROOTS`,
the interval sets, and the slug↔display map. So the primitives the generator
imports go first and alone, as a `musician` track with the two deleted originals
open beside the new file, and everything else is downstream of them.

The move has one shape the PRD did not draw. The app's interval table is
**thirteen** entries, not twelve: it carries `Locrian`, which the generator
deliberately refuses (`docs/music.md` §Scales — no perfect fifth, so
`buildHarmony` throws). One table has to hold both, so `INTERVALS` is keyed by
slug over thirteen scales while `FLAVOURS` stays the twelve renderable ones in
their frozen order. Two type names fall out of that — `FlavourSlug` (twelve,
what the generator re-exports as `Flavour`) and `ScaleSlug` (thirteen, what the
interval table is keyed by) — and the app's display-keyed `FLAVOUR_INTERVALS`
becomes *derived* from the slug table, which is what makes R4 true rather than
nearly true.

R4 also turns up two copies nobody counted: `degrees.ts:8` and `numerals.ts:5`
each hold `[0, 2, 4, 5, 7, 9, 11]` under the names `MAJOR_INTERVALS` and
`MAJOR`, as the ruler they spell accidentals against. That is the ionian set,
declared twice more. Both import it from `scales.ts` here, or the uniqueness
test in Step A4 fails on ionian with three holders and the honest fix is
disabling the test.

Then the two big mechanical passes run in parallel behind the frozen contracts —
the generator re-points eleven import sites and drops two files (Track D,
`musician`), the app's eleven theory modules move down and their consumers are
rewritten (Tracks C, E1–E3) — and the epic ends with the one check that actually
tests R15: a full 30-groove render into a scratch directory, every MP3 hashed
against the committed lock, and the scratch manifest's own sha256 compared too,
which is what proves the new `displayFlavour` writes the same bytes the old one
did.

**Between Wave 2 and Wave 3 the repository does not type-check.** That is
stated plainly under *Execution waves*, because it is the price the PRD's own Q1
("no shims") bought and there is no way to schedule it away.

## Architecture

### The tree afterwards

```
src/lib/
├── branding.ts            unchanged
├── date.ts                isoDate, parseIsoDate            ← from lib/puzzle/selectGroove.ts
├── date.test.ts
├── groove.ts              Root, Flavour, Groove, Answer, Attempt
├── groove.test.ts
├── hash.ts                frozen, untouched
├── hash.test.ts           its @/ import goes relative (AC7)
└── theory/                sixteen modules, sixteen tests, flat
    ├── names.ts     ★     FLAVOURS, FlavourSlug, ScaleSlug, DISPLAY_NAMES,
    │                      displayFlavour, slugOf
    ├── roots.ts     ★     ROOTS, pitchClassOf, midiOf, noteName
    ├── scales.ts    ★     INTERVALS, FLAVOUR_INTERVALS, MAJOR_INTERVALS,
    │                      intervalsFor, scaleName, pitchesOf
    ├── notes.ts           FLAVOUR_LETTER_STEPS, scaleNotes, UnknownFlavourError,
    │                      UnknownRootError
    ├── changes.ts   character.ts   degrees.ts   difference.ts   families.ts
    ├── licks.ts     music.ts       numerals.ts  options.ts      phrase.ts
    └── simpleModes.ts   staff.ts

★ = the three the generator imports (R13's trigger list, with groove.ts and hash.ts)
```

`src/features/daily-groove/lib/` holds five folders afterwards: `audio`,
`persistence`, `presentation`, `puzzle`, `share`.

`scripts/grooves/theory/` holds three modules afterwards: `harmony.ts`,
`pitches.ts`, `validity.ts`, plus their tests. `notes.ts`, `notes.test.ts`,
`scales.ts` and `scales.test.ts` are gone.

### How `notes.ts` splits, on both sides

The name exists on both sides of the boundary with different contents. Every
symbol's destination, and there is no third copy of any of them:

| Symbol | Today | Afterwards |
| :-- | :-- | :-- |
| `ROOTS` | app `theory/music.ts:6` **and** generator `theory/notes.ts:3` | `src/lib/theory/roots.ts` |
| `pitchClassOf`, `midiOf`, `noteName` | generator `theory/notes.ts:18–33` | `src/lib/theory/roots.ts` |
| `FLAVOURS` | generator `theory/scales.ts:5` | `src/lib/theory/names.ts` |
| `INTERVALS` (slug-keyed) | generator `theory/scales.ts:20` | `src/lib/theory/scales.ts` |
| `FLAVOUR_INTERVALS` (display-keyed) | app `theory/notes.ts:40` | `src/lib/theory/scales.ts`, **derived** from `INTERVALS` |
| `intervalsFor`, `scaleName`, `pitchesOf` | generator `theory/scales.ts:35–52` | `src/lib/theory/scales.ts` |
| `MAJOR_INTERVALS` / `MAJOR` | app `theory/degrees.ts:8`, `theory/numerals.ts:5` | `src/lib/theory/scales.ts`, one export, `= INTERVALS.ionian` |
| `displayFlavour` | generator `cli.ts:31` | `src/lib/theory/names.ts` |
| `Flavour` (twelve-slug union) | generator `types.ts:3–15` | `src/lib/theory/names.ts` as `FlavourSlug`; `types.ts` re-exports it |
| `FLAVOUR_LETTER_STEPS`, `scaleNotes`, `UnknownFlavourError`, `UnknownRootError`, `splitNote` | app `theory/notes.ts` | `src/lib/theory/notes.ts` |
| `isoDate`, `parseIsoDate` | app `lib/puzzle/selectGroove.ts:4–14` | `src/lib/date.ts` |
| `Answer`, `Attempt` | app `types.ts:5–13` | `src/lib/groove.ts`; `types.ts` re-exports them |

### Thirteen scales, twelve flavours

`FLAVOUR_INTERVALS` has thirteen keys and the generator's `INTERVALS` has
twelve. The extra one is `Locrian`, and it is load-bearing on the app side —
`notes.test.ts:73` spells B Locrian, `families.test.ts:62` throws on it,
`phrase.test.ts:100` returns no lick for it, `SolvedPanel.test.tsx:126` renders
it. It must not enter `FLAVOURS`, which `scales.test.ts:137` asserts and
`docs/music.md` §Scales explains.

So the two lists are different lists, and `names.ts` says so:

```
FLAVOURS          the twelve the generator renders, order frozen  →  FlavourSlug
DISPLAY_NAMES     thirteen slugs → thirteen display names         →  ScaleSlug
INTERVALS         thirteen slugs → thirteen interval sets          (scales.ts)
FLAVOUR_INTERVALS derived: displayFlavour(slug) → the same arrays  (scales.ts)
```

`Record<ScaleSlug, …>` accepts a `FlavourSlug` key, so
`intervalsFor(flavour: ScaleSlug)` serves the generator unchanged and the
generator's own `Flavour` never widens to thirteen.

**The derived table's key order changes** — from the app's modal order (Ionian,
Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian, …) to the generator's
frozen order plus Locrian last. Nothing reads it in order: every consumer either
indexes by key (`lookup`, `Object.keys(...).find`) or iterates for a per-entry
assertion, and the player-facing option row comes from `flavourPool(GROOVES)`,
which sorts. Step A3 pins the values; the order is not a contract.

### The two spellings, and the one map

R5a is explicit that this is not a unification. What changes is that the map
between the spellings is now a thirteen-entry data literal in one module instead
of a regex in `cli.ts` and a set of key spellings in the app's table that nothing
compares.

`displayFlavour`'s current implementation — `replace(/-/g, ' ')` then
capitalise — happens to be *exact* for all twelve. It is still replaced by the
map, per R5b, for two reasons: a data map makes the reverse direction (AC4)
trivial and exact, and the naive form is one hyphenated addition away from being
wrong. Step A2's first assertion is that the map's twelve values equal what the
old algorithm produced, so the swap cannot change a manifest byte.

### The cycle R8 breaks

```
lib/puzzle/selectGroove.ts  ──seededShuffle──▶  theory/options.ts
        ▲                                              │
        └──────────isoDate───────  theory/music.ts  ◀──┘
                                   theory/simpleModes.ts
```

Move the theory folder without moving `isoDate` and `src/lib/theory/music.ts`
imports `src/features/` — lint zone 4, with the message *"src/lib is a leaf:
shared logic may not import the app."* So `isoDate` and `parseIsoDate` go to
`src/lib/date.ts` in the same wave as the move.

`dayIndexOf` stays in `selectGroove.ts` (R8 names only the two), and is rewritten
to call `parseIsoDate` rather than re-parse the string itself — the same
construction, `new Date(y, m - 1, d, 12, 0, 0, 0)`, so the day index and
therefore the day's groove are unchanged. `selectGroove.test.ts`'s existing
40-day sweep is the guard.

### Where the catalogue-corpus assertions go

Nine of the thirteen moved test files import `GROOVES` from
`../../data/grooves.generated`, and `music.test.ts` also imports
`selectGrooveForDate` from `../puzzle/selectGroove`. Under lint zone 4 — which
carries **no `files` key on purpose**, so it binds tests exactly as it binds
source — a test at `src/lib/theory/` may not do either.

**The assertions are split by subject.** A case whose subject is the *catalogue*
moves to the file that owns the catalogue,
`src/features/daily-groove/data/grooves.generated.test.ts`, which already
imports five theory modules dynamically to check the manifest against them. A
case that merely needed a mode pool asks the names module for one:
`FLAVOURS.map(displayFlavour).sort()`, pinned against the real manifest by one
new case so the substitution cannot drift. A case that merely needed a `Groove`
to feed a pure function gets a local literal. The source scans, which name
`GROOVES` only inside a regex, stay with their module because they import
nothing. Contract C9 is the rule, case by case; Steps C6, C7 and C9 carry it out.

Fourteen case declarations move, one of them a duplicate that is dropped rather
than moved (C6's *Refactor*), so thirteen arrive. `music.test.ts` is the file
this splits: eleven of its case declarations become fixture-driven, seven of its
describes' contents move out, and the five source scans stay.

**This is what AC1 has to be graded on.** "Every one of the thirteen modules and
its test lives under `src/lib/theory/`" is true of the thirteen module files and
their thirteen test files; it is not true of every assertion inside them, because
fourteen of those assertions have the catalogue as their subject and the
catalogue is not in `src/lib/`. The PRD's AC1 has been amended to say so — the
only change made to the PRD — and Step C5's done-condition is written against the
amended wording.

### What must not move, on pain of a re-render

R14 and R15 rest on this list. Nothing in the epic touches any of it:

- `src/lib/hash.ts` — one character re-renders everything and reassigns every
  past date. Out of scope by the PRD; only its test's `@/` import changes.
- `MUSIC_LABEL = 'events'` and its draw order in `events.ts`.
- Each template's own `flavours` array in `templates/*.ts`. The flavour draw is
  `pick(musicRng, template.flavours)` at `events.ts:323` — it indexes the
  template's list, not `FLAVOURS`, so `FLAVOURS`' order is a vocabulary contract
  rather than a render input. It is still moved verbatim, in order.
- The thirteen interval arrays, element for element.
- `ROOTS`' order — `pitchClassOf` is its index, so a swap transposes grooves.
- `scaleName(root, flavour)`'s output, which is the manifest's `scale` field.
- `displayFlavour`'s output for the twelve, which is the manifest's `flavour`
  field and every key in the app's derived table.
- `catalogue.json`, every `uuid`, `grooves.lock.json`, `public/grooves/*.mp3`,
  `public/notes/*.mp3`, `src/features/daily-groove/data/*.generated.ts`.

## Contracts

Frozen before Wave 1. C1–C3 are what Track D and Track C both build against and
must not drift.

### C1 — `src/lib/theory/names.ts`

```ts
const RENDERED = {
  ionian: 'Ionian',
  aeolian: 'Aeolian',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
  lydian: 'Lydian',
  phrygian: 'Phrygian',
  'harmonic-minor': 'Harmonic minor',
  blues: 'Blues',
  'melodic-minor': 'Melodic minor',
  'lydian-dominant': 'Lydian dominant',
  'phrygian-dominant': 'Phrygian dominant',
  'harmonic-major': 'Harmonic major',
} as const

const APP_ONLY = { locrian: 'Locrian' } as const

export type FlavourSlug = keyof typeof RENDERED
export type ScaleSlug = FlavourSlug | keyof typeof APP_ONLY

export const FLAVOURS: FlavourSlug[] = Object.keys(RENDERED) as FlavourSlug[]
export const DISPLAY_NAMES: Record<ScaleSlug, string> = { ...RENDERED, ...APP_ONLY }

export function displayFlavour(slug: ScaleSlug): string
export function slugOf(display: string): ScaleSlug
```

- `RENDERED`'s key order **is** `FLAVOURS`' order and is frozen: the twelve in
  exactly the order `scripts/grooves/theory/scales.ts:5–18` has them today.
- `FLAVOURS` is a mutable `FlavourSlug[]`, not a readonly tuple, so
  `templates/index.test.ts:101`'s `[...(FLAVOURS as Flavour[])]` still compiles.
- `displayFlavour` throws `Error("displayFlavour: unknown flavour \"…\"")` on a
  slug the map does not hold, matching `intervalsFor`'s existing style.
- `slugOf` matches on the exact display string, throws
  `Error("slugOf: unknown flavour \"…\"")` otherwise. It has no production
  caller yet; it exists because AC4 asks for the round trip.
- The module imports nothing.

### C2 — `src/lib/theory/roots.ts`

```ts
import type { Root } from '../groove'

export const ROOTS: Root[]                                  // the twelve, order frozen
export function pitchClassOf(root: Root): number             // ROOTS.indexOf, throws below 0
export function midiOf(root: Root, octave: number): number   // (octave + 1) * 12 + pitchClassOf
export function noteName(midi: number): Root
```

Bodies are `scripts/grooves/theory/notes.ts:3–33` verbatim, with the type import
re-pointed from `'../../../src/lib/groove.ts'` to `'../groove'`.

### C3 — `src/lib/theory/scales.ts`

```ts
import type { Flavour, Root } from '../groove'
import { DISPLAY_NAMES, displayFlavour, type ScaleSlug } from './names'
import { pitchClassOf } from './roots'

export const INTERVALS: Record<ScaleSlug, number[]>          // thirteen, values frozen
export const MAJOR_INTERVALS: number[]                       // = INTERVALS.ionian
export const FLAVOUR_INTERVALS: Record<Flavour, number[]>    // derived, thirteen keys
export function intervalsFor(flavour: ScaleSlug): number[]   // throws on unknown
export function scaleName(root: Root, flavour: ScaleSlug): string
export function pitchesOf(root: Root, flavour: ScaleSlug): number[]
```

`INTERVALS` is the generator's twelve in their current key order, then
`locrian: [0, 1, 3, 5, 6, 8, 10]` last. `FLAVOUR_INTERVALS` is built once at
module load:

```ts
export const FLAVOUR_INTERVALS: Record<Flavour, number[]> = Object.fromEntries(
  Object.entries(INTERVALS).map(([slug, intervals]) => [
    displayFlavour(slug as ScaleSlug),
    intervals,
  ]),
)
```

`intervalsFor`, `scaleName` and `pitchesOf` are
`scripts/grooves/theory/scales.ts:35–52` verbatim. **`scaleName` keeps its own
`flavour.replace(/-/g, ' ')`** — it lower-cases nothing and capitalises nothing,
so it is not the same conversion as `displayFlavour` and must not be routed
through `DISPLAY_NAMES`.

### C4 — `src/lib/theory/notes.ts`, after

```ts
import type { Answer, Flavour } from '../groove'
import { FLAVOUR_INTERVALS } from './scales'

export const FLAVOUR_LETTER_STEPS: Record<string, number[]>   // { Blues: [...] }
export class UnknownFlavourError extends Error
export class UnknownRootError extends Error
export function scaleNotes(answer: Answer): string[]
```

`LETTERS`, `NATURAL`, `ACCIDENTAL_OFFSET`, `OFFSET_ACCIDENTAL`, `splitNote` and
`lookup` stay module-private and unchanged. `FLAVOUR_INTERVALS` is **gone from
this module's exports** — it is imported from `./scales`. That breaks
`numerals.test.ts:155`, which pins the import line; C8 gives the replacement.

### C5 — `src/lib/groove.ts` and `src/lib/date.ts`

```ts
// src/lib/groove.ts — gains two types, still imports nothing
export type Answer = { root: Root; flavour: Flavour }
export type Attempt = {
  root: Root
  flavour: Flavour
  correct: boolean
  rootMatched: boolean
  flavourMatched: boolean
}
```

```ts
// src/lib/date.ts — imports nothing
export function isoDate(date: Date): string        // local calendar day, YYYY-MM-DD
export function parseIsoDate(iso: string): Date    // that day at 12:00 local
```

Bodies are `selectGroove.ts:4–14` verbatim. `src/features/daily-groove/types.ts`
becomes:

```ts
export type { Answer, Attempt, Flavour, Groove, Root } from '@/lib/groove'
export type DailyResult = { … }        // unchanged, field for field
```

`groove.test.ts`'s zero-import assertion must still pass, so `Answer` and
`Attempt` may only use types declared in the same file.

### C6 — `flavourOptions`, the one signature that changes

```ts
// src/lib/theory/music.ts
export function flavourOptions(date: Date, groove: Groove, grooves: Groove[]): Flavour[]
// = buildOptions(groove.flavour, flavourPool(grooves), isoDate(date))
```

Every one of the six call sites passes **`GROOVES` from the generated
manifest**, importing it if it does not already:

| Call site | Today | Afterwards |
| :-- | :-- | :-- |
| `components/GroovePuzzle.tsx:203` | `flavourOptions(today, groove)` | `flavourOptions(today, groove, GROOVES)` |
| `testing/puzzleHarness.tsx:30` | `flavourOptions(new Date(), GROOVE)` | `flavourOptions(new Date(), GROOVE, GROOVES)` |
| `components/GroovePuzzle.guessing.test.tsx:113, 735` | `flavourOptions(d, GROOVE)` / `(new Date(), DORIAN)` | `…, GROOVES)` |
| `components/puzzle/GuessCard.test.tsx:2305` | `flavourOptions(today, groove)` | `flavourOptions(today, groove, GROOVES)` |
| `hooks/usePuzzleSession.test.ts:44` | `flavourOptions(DAY, GROOVE)` | `flavourOptions(DAY, GROOVE, GROOVES)` |

**Passing a local fixture instead of `GROOVES` changes the rendered option row.**
`puzzleHarness.tsx` and `usePuzzleSession.test.ts` hold a single-groove `GROOVE`
and today draw their distractors from the real 30-groove pool; `flavourOptions(…,
[GROOVE])` would return one chip, not four. This is the one place in the epic
where a mechanical rewrite can silently change behaviour.

### C7 — the generator's `types.ts` and every re-pointed import

```ts
// scripts/grooves/types.ts, lines 1–15 become
import type { Root } from '../../src/lib/groove.ts'
export type { FlavourSlug as Flavour } from '../../src/lib/theory/names.ts'
```

The other twenty types in the file are untouched. Every generator import of the
two deleted modules, by file and line:

| File | Line | Afterwards |
| :-- | :-- | :-- |
| `events.ts` | 4 | `import { ROOTS } from '../../src/lib/theory/roots.ts'` |
| `events.ts` | 7 | `import { scaleName } from '../../src/lib/theory/scales.ts'` |
| `events.test.ts` | 20, 23 | same two paths |
| `notes.ts` | 3 | `import { ROOTS, midiOf } from '../../src/lib/theory/roots.ts'` |
| `notes.test.ts` | 11 | `import { ROOTS } from '../../src/lib/theory/roots.ts'` |
| `cli.test.ts` | 15 | `import { FLAVOURS } from '../../src/lib/theory/names.ts'` |
| `gate.test.ts` | 13 | `import { pitchesOf } from '../../src/lib/theory/scales.ts'` |
| `templates/index.test.ts` | 3 | `FLAVOURS` from `'../../../src/lib/theory/names.ts'`, `INTERVALS` from `'../../../src/lib/theory/scales.ts'` |
| `theory/harmony.ts` | 3, 4 | `ROOTS, pitchClassOf` from `'../../../src/lib/theory/roots.ts'`; `intervalsFor, pitchesOf` from `'../../../src/lib/theory/scales.ts'` |
| `theory/harmony.test.ts` | 6, 7 | `FLAVOURS` from `names.ts`; `intervalsFor, pitchesOf, scaleName` from `scales.ts`; `ROOTS, pitchClassOf` from `roots.ts` (all `'../../../src/lib/theory/…'`) |
| `theory/pitches.ts` | 3 | `pitchesOf` from `'../../../src/lib/theory/scales.ts'` |
| `theory/pitches.test.ts` | 5, 6 | `FLAVOURS` from `names.ts`; `pitchesOf, scaleName` from `scales.ts`; `ROOTS` from `roots.ts` |
| `theory/validity.ts` | 3, 4 | `pitchClassOf` from `roots.ts`; `intervalsFor` from `scales.ts` |
| `theory/validity.test.ts` | 5, 6 | `ROOTS, pitchClassOf` from `roots.ts`; `FLAVOURS` from `names.ts`; `intervalsFor, scaleName` from `scales.ts` |
| `cli.ts` | 31–34 | `displayFlavour` deleted; `import { displayFlavour } from '../../src/lib/theory/names.ts'` added |

`scripts/grooves/notes.ts`, `notes-cli.ts`, `notes-manifest.ts` and their tests
import `'./notes.ts'` — the reference-note renderer, a different file. **Do not
re-point those.**

`cli.ts:52`'s `flavour: displayFlavour(music.flavour)` is unchanged, and
`displayFlavour` stops being exported from `cli.ts`. Any test importing it from
`cli.ts` imports it from `names.ts` instead.

### C8 — the app import map

Every consumer path, old → new. App files outside `src/lib/` use the `@/` alias,
as they already do for `@/lib/hash`; files inside `src/lib/` use relative paths
(R10, AC7).

| Old specifier | New specifier |
| :-- | :-- |
| `../lib/theory/music` · `../../lib/theory/music` · `../theory/music` | `@/lib/theory/music` |
| …`/theory/{changes,character,degrees,difference,families,licks,numerals,options,phrase,simpleModes,staff}` | `@/lib/theory/<same>` |
| `…/theory/notes` for `scaleNotes`, `FLAVOUR_LETTER_STEPS`, `UnknownFlavourError`, `UnknownRootError` | `@/lib/theory/notes` |
| `…/theory/notes` for `FLAVOUR_INTERVALS` | `@/lib/theory/scales` |
| `…/theory/music` for `ROOTS` | `@/lib/theory/roots` |
| `../lib/puzzle/selectGroove` for `isoDate` / `parseIsoDate` | `@/lib/date` |
| `@/lib/hash` inside `src/lib/theory/options.ts` | `../hash` |
| `@/lib/groove` inside `src/lib/groove.test.ts`, `src/lib/hash.test.ts` | `./groove`, `./hash` |
| `'../../types'` inside a moved theory module | `'../groove'` |

Thirty-seven import lines outside the theory folder, plus the folder's own
intra-module lines, plus ten files importing `isoDate`. Two source-reading
assertions have to move with them:

- `numerals.test.ts:155–156` — replace the pinned line with
  `expect(CODE).toContain("import { FLAVOUR_INTERVALS, MAJOR_INTERVALS } from './scales'")`
  and `expect(CODE).toContain("import { FLAVOUR_LETTER_STEPS } from './notes'")`,
  keeping the `./changes` line as it is.
- `components/solved/ScaleStaff.test.tsx:876` — `expect(specifiers).toEqual(['../../lib/theory/staff'])`
  becomes `expect(specifiers).toEqual(['@/lib/theory/staff'])`.

### C9 — what happens to a moved test's `GROOVES`

The rule Track C applies, file by file. It is a contract because it decides what
coverage the epic keeps, and `docs/testing.md` says a relocated assertion keeps
its subject.

Four dispositions, and every `GROOVES` reference in the thirteen moved tests is
one of them:

| `GROOVES` is used as | Disposition |
| :-- | :-- |
| **a corpus** — "every groove", "the shipped manifest", "all 30 catalogued grooves" | the case declaration moves verbatim into `src/features/daily-groove/data/grooves.generated.test.ts`, keeping its title, its failure messages and its `it.each` table, and importing the theory module as `@/lib/theory/…` |
| **the mode pool** — `flavourPool(GROOVES)`, `new Set(GROOVES.map(g => g.flavour))` | `const MODES = FLAVOURS.map(displayFlavour).sort()`, imported from `./names` at the top of the moved test; the case stays where it is |
| **a `Groove` to feed a pure function** — `{ ...GROOVES[0], bpm: 96 }` | a local literal in the moved test, spread the same way; the case stays where it is |
| **a string inside a regex** — the four source scans in `music.test.ts` | untouched; the case stays with its module, because it imports nothing and reads `src/` from disk |

The pool substitution is exact today — the manifest's 30 grooves carry exactly
twelve distinct flavours, and they are exactly `FLAVOURS.map(displayFlavour)`
sorted — and Step C8 adds the case that keeps it that way.

**The fourteen case declarations that move**, by file and title, measured with
feature-19 applied:

| From | Case declaration |
| :-- | :-- |
| `changes.test.ts` L66 | the whole `describe('over the shipped catalogue')` — *covers all 30 catalogued grooves* and the `it.each` *maps %s to four non-empty bars headed by its tonic chord* |
| `notes.test.ts` L133 | *covers every flavour the catalogue uses* — **this is the one that is dropped, not moved**; see C6's *Refactor* |
| `staff.test.ts` L157 | *holds for every groove the shipped manifest can play* |
| `music.test.ts` L48 | the whole `describe('every groove in the catalogue')` — the `it.each` *%s answers to a known root and a non-empty flavour* |
| `music.test.ts` L59 | four cases out of `describe('flavourPool')` — *is exactly the set of flavours the catalogue actually uses*, *omits a flavour no groove uses*, *has no duplicates*, *widens automatically when a groove uses a new flavour* |
| `music.test.ts` L185 | the whole `describe("today's options, as the page resolves them")` — *offers today's deterministic flavour options, including the answer* |
| `music.test.ts` L205 | *is positive and finite for every groove in the catalogue* |
| `music.test.ts` L283, L289, L301 | *drops nothing the real catalogue carries (R7)*, *keeps the day's row at four options including the answer (R9, AC2)*, *is stable across repeated calls for the same date (R9, AC2)* |

**The pool substitutions**, and the two describes whose titles stop being true:

| File | Binding | Note |
| :-- | :-- | :-- |
| `character.test.ts` | `modes` inside *is total over every mode the shipped manifest carries* (L52) and *covers every mode the manifest carries and nothing the intervals do not* (L64) | titles keep the word *manifest*; C8's pin is what keeps them honest |
| `difference.test.ts` | module-level `MODES` (L66) | `describe('degreeDifferences over the whole catalogue')` (L72) becomes `describe('degreeDifferences over the twelve modes')` |
| `families.test.ts` | `modes` (L45, L54) and `pool` (L78) | `describe('the families partition the catalogue')` (L77) becomes `describe('the families partition the twelve modes')` |
| `licks.test.ts` | `POOL` (L9) | — |
| `phrase.test.ts` | `POOL` (L14) | — |
| `simpleModes.test.ts` | `pool` (L8) | — |

**The eleven fixture rewrites**, all in `music.test.ts`: the three `answerOf`
cases (L17, L22, L35), the three `flavourOptions` cases (L87's `it.each`, L98,
L104) and the five `loopSecondsOf` cases (L196, L213, L218, L224, L231). Step C9
gives the two literals they share. The two `flavourPool` cases at L263 and L274
already build their own catalogue with the file's `fake()` helper and need no
change.

**The five cases that stay untouched** in `describe('the rotation is the
generated catalogue (Epic 4)')`: *carries no retirement flag anywhere in the
source (R7, AC8)*, *carries no allowlist or denylist of grooves or flavours (R7,
AC8)*, *filters the rotation nowhere (R7, AC8)*, *hands the whole catalogue to
the day's pick and to the pool (R7, AC8)* and *leaves `Flavour` in
src/lib/groove.ts a plain string (R8, AC9)*. They read `src/` and `src/lib/
groove.ts` from disk.

**One trap in that last group.** *hands the whole catalogue to the day's pick and
to the pool* asserts that some non-test source file matches
`/flavourPool\(\s*GROOVES\s*\)/`. After R7, `music.ts` no longer contains
that call — the only remaining one is `GroovePuzzle.tsx:78`'s
`const FLAVOUR_POOL = flavourPool(GROOVES)`. That line must survive Track E1, or
this case fails for a reason that has nothing to do with what it is checking.

### C10 — the tier rule

```ts
// scripts/tiers.ts
export const GENERATOR_IMPORTS: readonly string[] = [
  'src/lib/groove.ts',
  'src/lib/hash.ts',
  'src/lib/theory/names.ts',
  'src/lib/theory/roots.ts',
  'src/lib/theory/scales.ts',
]
```

`tiersFor` selects the generator tier when any path is outside `src/`, or is
under `scripts/`, or is one of `GENERATOR_IMPORTS` — and not merely because it
is under `src/lib/`. `tierReason`'s generator strings name the module that
selected it, or say every path was app-only.

### C11 — `boundary.test.ts`'s crossing list

The literal list at lines 86–90 becomes depth-normalised, because the same
module is now reached from two directory depths:

```ts
const shared = [...crossings]
  .map((specifier) => specifier.slice(specifier.indexOf('src/lib/')))
  .sort()
expect([...new Set(shared)]).toEqual([
  'src/lib/groove.ts',
  'src/lib/hash.ts',
  'src/lib/theory/names.ts',
  'src/lib/theory/roots.ts',
  'src/lib/theory/scales.ts',
])
```

The per-specifier `expect(specifier.includes('src/lib/'))` assertion above it
stays exactly as it is. The `Root`/`Flavour` assertion at lines 93–97 becomes:

```ts
it('declares neither Root nor the Flavour union, it imports both', () => {
  const source = readFileSync(join(SCRIPTS_DIR, 'grooves/types.ts'), 'utf8')
  expect(source).not.toMatch(/\bexport\s+type\s+Root\b/)
  expect(source).not.toMatch(/\bexport\s+type\s+Flavour\s*=/)
  expect(source).toMatch(
    /export\s+type\s*\{\s*FlavourSlug\s+as\s+Flavour\s*\}\s*from\s*'[^']*src\/lib\/theory\/names\.ts'/,
  )
  expect(source).not.toMatch(/\bFlavour\b[^\n]*src\/lib\/groove\.ts/)
})
```

## Tracks

### Track A — The shared primitives merge

- **Goal** — `src/lib/theory/names.ts`, `roots.ts` and `scales.ts` exist and
  match C1–C3, with the thirteen interval sets, the twelve roots and the
  thirteen display names asserted once; the uniqueness scans (R4) exist and are
  red until Wave 2 ends, by design.
- **Owns** — `src/lib/theory/names.ts`, `src/lib/theory/names.test.ts`,
  `src/lib/theory/roots.ts`, `src/lib/theory/roots.test.ts`,
  `src/lib/theory/scales.ts`, `src/lib/theory/scales.test.ts`
- **Role** — `musician`. It owns no file under `scripts/grooves/`, but it is the
  one track whose content is the generator's musical primitives: getting a
  value, an order or a spelling wrong here re-renders the catalogue, which
  `docs/music.md` calls the worst failure this codebase has.
- **Depends on** — nothing. C1–C3 are its output and are frozen above.
- **Parallel with** — Track B
- **Done when** — `npx vitest run --project app src/lib/theory` passes except the
  two uniqueness cases named in A4, and the values in the three new modules are
  diff-identical to `scripts/grooves/theory/{notes,scales}.ts` and
  `src/features/daily-groove/lib/theory/notes.ts` as they stand on `main`.

### Track B — The generator tier follows the import graph

- **Goal** — the tier trigger names the five modules the generator imports;
  editing `src/lib/theory/scales.ts` selects the generator tier, editing
  `src/lib/theory/licks.ts` or `src/lib/branding.ts` does not.
- **Owns** — `scripts/tiers.ts`, `scripts/tiers.test.ts`
- **Role** — `implementer`. It owns nothing under `scripts/grooves/`.
- **Depends on** — C10 only. It needs the five *paths*, not the files.
- **Parallel with** — Track A
- **Done when** — `npx vitest run --project tooling` is green, including the
  rewritten case at `tiers.test.ts:55`.

### Track C — The eleven move down, and the leaf plumbing with them

- **Goal** — `src/features/daily-groove/lib/theory/` does not exist; the other
  eleven modules and `notes.ts` live under `src/lib/theory/` with their tests;
  `src/lib/date.ts` and the two new types in `src/lib/groove.ts` exist; every
  corpus assertion has landed in the catalogue's own test; no file under
  `src/lib/` imports through `@/`.
- **Owns** —
  `src/lib/theory/{changes,character,degrees,difference,families,licks,music,notes,numerals,options,phrase,simpleModes,staff}.ts` and each `.test.ts` (new),
  `src/lib/date.ts`, `src/lib/date.test.ts` (new),
  `src/lib/groove.ts`, `src/lib/groove.test.ts`, `src/lib/hash.test.ts`,
  `src/features/daily-groove/lib/theory/**` (deleted),
  `src/features/daily-groove/lib/puzzle/selectGroove.ts`,
  `src/features/daily-groove/lib/puzzle/selectGroove.test.ts`,
  `src/features/daily-groove/types.ts`,
  `src/features/daily-groove/structure.test.ts`,
  `src/features/daily-groove/data/grooves.generated.test.ts`
- **Role** — `implementer`
- **Depends on** — Track A landed (its modules import `./scales`, `./roots`,
  `./names` at runtime), and C1–C9.
- **Parallel with** — Track D
- **Done when** — `npx vitest run --project app src/lib` is green **including**
  A4's uniqueness cases once Track D has also landed;
  `npx vitest run --project app src/features/daily-groove/data src/features/daily-groove/lib/puzzle src/features/daily-groove/structure.test.ts`
  is green; `grep -rn "lib/theory" src/features` returns nothing.

**Why this is one track and not four.** The eleven modules are a single import
graph — `phrase` → `licks`, `numerals` → `changes`, `difference` → `degrees`,
`music` → `options` → `hash`, `simpleModes` → `families` — and the folder can
only be deleted once. Splitting it would hand two agents the same half-moved
folder. It is the largest track in the epic and the one to schedule first in
Wave 2.

### Track D — The generator imports the shared module

- **Goal** — `scripts/grooves/theory/notes.ts` and `scales.ts` and their tests
  are gone; every generator import points at `src/lib/theory/`; `types.ts`
  re-exports `FlavourSlug` as `Flavour`; `boundary.test.ts` pins exactly the
  five crossings and the rewritten `Flavour` rule; `docs/music.md`'s paths are
  correct; the scratch-render script exists.
- **Owns** — `scripts/grooves/theory/{notes,notes.test,scales,scales.test}.ts`
  (deleted), `scripts/grooves/theory/{harmony,pitches,validity}.ts` and their
  tests, `scripts/grooves/{events,notes,cli,types}.ts`,
  `scripts/grooves/{events.test,notes.test,cli.test,gate.test,boundary.test}.ts`,
  `scripts/grooves/templates/index.test.ts`,
  `scripts/grooves/rerender-check.ts` (new), `docs/music.md`
- **Role** — `musician` — it owns files under `scripts/grooves/`.
- **Depends on** — Track A landed, and C1–C3, C7, C11.
- **Parallel with** — Track C. No path appears in both.
- **Done when** — `npm run test:gen` is green, `npx tsc --noEmit` reports
  nothing under `scripts/`, and `git status --short public scripts/grooves/grooves.lock.json scripts/grooves/catalogue.json src/features/daily-groove/data`
  is empty.

### Track E1 — The shell and the cards

- **Goal** — every component imports `@/lib/theory/…` and `@/lib/date`, and
  `flavourOptions` is called with `GROOVES` everywhere.
- **Owns** — `src/features/daily-groove/components/**` (13 files: `GroovePuzzle.tsx`,
  the six `GroovePuzzle.*.test.tsx`, `puzzle/GuessCard.test.tsx`,
  `puzzle/NudgeBox.test.tsx`, `solved/ScaleStaff.tsx`, `solved/ScaleStaff.test.tsx`,
  `solved/SolvedPanel.tsx`, `solved/SolvedPanel.test.tsx`, `solved/LeadSheet.test.tsx`)
- **Role** — `implementer`
- **Depends on** — Tracks C and D landed; C6, C8.
- **Parallel with** — E2, E3, F
- **Done when** — `npx vitest run --project app src/features/daily-groove/components`
  is green.

### Track E2 — Hooks and the harness

- **Owns** — `src/features/daily-groove/hooks/**` (`useModeLick.ts`,
  `useModeLick.test.ts`, `usePuzzleSession.ts`, `usePuzzleSession.test.ts`,
  `useProgress.integration.test.ts`), `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Depends on** — Tracks C and D landed; C6, C8.
- **Parallel with** — E1, E3, F
- **Done when** — `npx vitest run --project app src/features/daily-groove/hooks`
  is green and the harness compiles under `npx tsc --noEmit`.

### Track E3 — The feature's other lib folders

- **Owns** — `src/features/daily-groove/lib/audio/**`,
  `src/features/daily-groove/lib/presentation/**`,
  `src/features/daily-groove/lib/puzzle/{narrowing,scoring}.ts` and their tests,
  `src/features/daily-groove/lib/persistence/**`,
  `src/features/daily-groove/data/notes.generated.test.ts`
- **Role** — `implementer`
- **Depends on** — Tracks C and D landed; C8.
- **Parallel with** — E1, E2, F. `lib/puzzle/selectGroove.ts` belongs to Track C
  and is **not** E3's to touch.
- **Done when** — `npx vitest run --project app src/features/daily-groove/lib src/features/daily-groove/data`
  is green.

### Track F — The guidelines say what the bar is now

- **Goal** — `coding-guidelines.md`'s `src/lib/` bar is rewritten so the tree it
  describes is the tree that exists, the `Flavour` paragraph names
  `src/lib/theory/names.ts` and the rewritten assertion, and the two agent
  definitions stop quoting the retired bar.
- **Owns** — `docs/coding-guidelines.md`, `.claude/agents/architect.md`,
  `.claude/agents/implementer.md`
- **Role** — `architect`
- **Depends on** — Tracks C and D landed, so the prose describes a real tree.
- **Parallel with** — E1, E2, E3
- **Done when** — `npm run test:gen` (`docs.test.ts`) and
  `npx vitest run --project tooling` (`agent-floor.test.ts`) are green, and the
  document names no file that no longer exists.

### Track G — Verification, and the one check that tests R15

- **Goal** — the full gate is green, the scratch render proves the generator
  still emits the committed bytes, and every R and AC is traced.
- **Owns** — nothing. It writes no source and no test.
- **Role** — `verifier`
- **Depends on** — every other track.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npm run test:gen`, `npx tsc --noEmit`,
  `npm run lint`, `npm run build` and `npm run grooves:verify` are clean;
  `node scripts/grooves/rerender-check.ts` reports 30 of 30 matching;
  `git status --short` shows no generated file modified.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B. A is the epic's risk; B is
  independent of every file A touches.
- **Wave 2 (parallel):** Track C, Track D. Both need A's three modules; neither
  needs the other. C is much the larger.
- **Wave 3 (parallel):** Track E1, E2, E3, F. Four disjoint file sets, all
  mechanical, all unblocked by C and D together.
- **Wave 4:** Track G.

**The tree does not build between Wave 2 and Wave 3.** The moment Track C
deletes `src/features/daily-groove/lib/theory/`, roughly forty files across
`components/`, `hooks/`, `lib/` and `data/` fail to resolve their imports, and
they stay red until Wave 3 finishes. This is what the PRD's own Q1 bought: no
shims, so no intermediate state where two paths reach the same module. Wave 3's
tracks therefore cannot use a repo-wide check as their done-condition — each
runs `vitest` scoped to the paths it owns, and `npx tsc --noEmit` first passes
in Wave 4.

**One scheduling note for the lead.** Waves 1 and 2 are as wide as they honestly
get. Track C cannot be subdivided (the folder is deleted once, and the eleven
modules import each other), and no app consumer can be touched before it lands.
The parallelism in Wave 3 is real but shallow — three agents doing the same
mechanical rewrite in three disjoint folders — and if agent budget is tight,
merging E1–E3 into one track costs nothing but wall time.

## Implementation

### Track A — The shared primitives merge

Baseline: `npm test` green, `npm run test:gen` green.

#### Step A1 — The twelve slugs and the thirteen names live in one module

Covers: R5, R5a, R5c, AC4

- **Test first** — `src/lib/theory/names.test.ts` (new): assert
  `FLAVOURS` equals the twelve in the frozen order, element for element;
  `FLAVOURS` has length 12 and does not contain `'locrian'`;
  `Object.keys(DISPLAY_NAMES)` has length 13 and contains `'locrian'`. Run
  `npx vitest run --project app src/lib/theory/names.test.ts`: fails with
  `Error: Failed to load url ./names (resolved id: …/src/lib/theory/names.ts)`.
- **Implement** — `src/lib/theory/names.ts` exactly as C1, with `RENDERED`'s
  keys copied in order from `scripts/grooves/theory/scales.ts:5–18`.
- **Green when** — the three cases pass and
  `expect(FLAVOURS).toEqual(FLAVOURS_FROM_THE_OLD_FILE)` — written out as a
  literal in the test, which is the change-detector `hash.test.ts`'s `PIN` table
  is — holds.
- **Refactor** — none.

#### Step A2 — Both spellings convert, exactly, in both directions

Covers: R5, R5b, AC4

- **Test first** — `src/lib/theory/names.test.ts`: add
  1. `it.each` over the twelve: `displayFlavour(slug)` equals the display string
     the old algorithm produced — written into the table literally
     (`['harmonic-minor', 'Harmonic minor']`, `['lydian-dominant', 'Lydian dominant']`, …).
  2. `displayFlavour('locrian')` is `'Locrian'`.
  3. `it.each` over the thirteen: `slugOf(displayFlavour(slug))` is `slug`.
  4. `displayFlavour('bebop' as ScaleSlug)` throws `/bebop/`; `slugOf('Bebop')`
     throws `/Bebop/`.
  5. Every value of `DISPLAY_NAMES` is a key of `FLAVOUR_INTERVALS` — deferred to
     A3, which is where that table appears.

  Run it: fails with `TypeError: displayFlavour is not a function`.
- **Implement** — `displayFlavour` and `slugOf` in `names.ts`, both reading
  `DISPLAY_NAMES`. `slugOf` builds the inverse map once at module load.
- **Green when** — all four groups pass. **The twelve values are the check that
  R14 survives**: they are what `cli.ts:52` writes into the manifest's `flavour`
  field, and Step G2 re-derives them from a real render.
- **Refactor** — none. The map is data on purpose (R5b); do not reintroduce the
  `replace`/`charAt` form as a fallback.

#### Step A3 — One interval table, thirteen scales, twelve flavours

Covers: R3, R4, AC2, AC3

- **Test first** — `src/lib/theory/scales.test.ts` (new): move every case from
  `scripts/grooves/theory/scales.test.ts` verbatim — `intervalsFor` for all
  twelve, ascending/distinct/in-octave, `FLAVOURS` has no `locrian`, `scaleName`
  for the hyphenated modes, `pitchesOf` for every root × flavour — with `Flavour`
  replaced by `ScaleSlug` and `FLAVOURS` imported from `./names`. Then add:
  - `INTERVALS.locrian` is `[0, 1, 3, 5, 6, 8, 10]`.
  - `Object.keys(INTERVALS)` has length 13.
  - `Object.keys(FLAVOUR_INTERVALS)` has length 13 and contains `'Locrian'` and
    `'Harmonic minor'`.
  - `it.each` over the thirteen: `FLAVOUR_INTERVALS[displayFlavour(slug)]`
    is the same array reference as `INTERVALS[slug]`.
  - The thirteen display-keyed entries equal, value for value, the literal table
    from `src/features/daily-groove/lib/theory/notes.ts:40–54` — written out in
    full, as the change-detector for the derivation.
  - `MAJOR_INTERVALS` equals `INTERVALS.ionian`.

  Run it: fails with `Error: Failed to load url ./scales`.
- **Implement** — `src/lib/theory/scales.ts` exactly as C3.
- **Green when** — every moved case passes unchanged and the six new ones pass.
  `scaleName('A', 'harmonic-minor')` is still `'A harmonic minor'` — lower case,
  not `displayFlavour`'s output.
- **Refactor** — none.

#### Step A4 — `ROOTS` and the interval sets exist once in the repo

Covers: R4, AC3

- **Test first** — `src/lib/theory/roots.test.ts` (new): move
  `scripts/grooves/theory/notes.test.ts`'s four describes verbatim (`ROOTS` is
  the twelve, `midiOf` places middle C at 60, `noteName` round-trips,
  `pitchClassOf` maps to 0..11), then add the scan, modelled on
  `src/lib/hash.test.ts:39–66`:

  ```ts
  const NEEDLE = ROOTS.map((r) => `'${r}'`).join(',')   // built, never written

  it('is the only file in the repo that lists the twelve roots', () => {
    const holders = sourceFilesUnder(['src', 'scripts'])
      .filter((file) => !/\.(test|spec)\.tsx?$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').replace(/\s+/g, '').includes(NEEDLE))
      .map((file) => relative(REPO_ROOT, file))
      .sort()
    expect(holders).toEqual(['src/lib/theory/roots.ts'])
  })
  ```

  and the matching one in `scales.test.ts`, needling each of the thirteen
  interval arrays as `[0,2,3,5,7,8,11]` and so on, built from `INTERVALS` rather
  than written out.

  Run both now: they fail with
  `expected [ 'scripts/grooves/theory/notes.ts', 'src/features/daily-groove/lib/theory/music.ts', 'src/lib/theory/roots.ts' ] to deeply equal [ 'src/lib/theory/roots.ts' ]`
  and, for ionian,
  `[ 'src/features/daily-groove/lib/theory/degrees.ts', 'src/features/daily-groove/lib/theory/notes.ts', 'src/features/daily-groove/lib/theory/numerals.ts', 'scripts/grooves/theory/scales.ts', 'src/lib/theory/scales.ts' ]`.
- **Implement** — nothing in this track. **These two cases are red on purpose
  until the end of Wave 2**: Track C removes the app's copies (including
  `degrees.ts`'s and `numerals.ts`'s ionian rulers, Step C4) and Track D removes
  the generator's. Track A's done-condition names them as expected failures.
- **Green when** — after Wave 2, both holder lists are the single canonical file.
- **Refactor** — the scan excludes `*.test.ts` deliberately: `roots.test.ts`'s
  own pin, `groove.test.ts:103–116`'s `Root[]` pin and
  `lib/audio/reference.test.ts`'s pitch table all legitimately write the twelve,
  and each has a different subject. Recorded in *Assumptions*.

#### Step A5 — The twelve roots and their conversions live in one module

Covers: R1, R3

- **Test first** — covered by A4's moved describes; they are red before the
  module exists with `Error: Failed to load url ./roots`.
- **Implement** — `src/lib/theory/roots.ts` exactly as C2, bodies copied from
  `scripts/grooves/theory/notes.ts`.
- **Green when** — `npx vitest run --project app src/lib/theory/roots.test.ts`
  passes except the scan.
- **Refactor** — none.

### Track B — The generator tier follows the import graph

#### Step B1 — A theory module the generator does not import is app-only

Covers: R13, AC8

- **Test first** — `scripts/tiers.test.ts`: **rewrite** the case at line 55
  (`selects the generator tier for a src/lib file the generator does not import
  today`) into

  ```ts
  it('does not select the generator tier for a src/lib file the generator never imports', () => {
    expect(tiersFor(['src/lib/branding.ts'])).toEqual(['app', 'tooling'])
    expect(tiersFor(['src/lib/theory/licks.ts'])).toEqual(['app', 'tooling'])
    expect(tiersFor(['src/lib/date.ts'])).toEqual(['app', 'tooling'])
  })
  ```

  and add, beside the two existing `src/lib` cases:

  ```ts
  it.each(GENERATOR_IMPORTS)('selects the generator tier for %s', (path) => {
    expect(tiersFor([path])).toContain('generator')
  })
  ```

  Run `npx vitest run --project tooling`: fails with
  `AssertionError: expected [ 'app', 'generator', 'tooling' ] to deeply equal [ 'app', 'tooling' ]`.
- **Implement** — `scripts/tiers.ts`: add `GENERATOR_IMPORTS` (C10) and replace
  the `appOnly` predicate with
  `paths.every((p) => p.startsWith('src/') && !GENERATOR_IMPORTS.includes(p))`.
- **Green when** — the rewritten case, the five new ones and the four existing
  `tiersFor` cases all pass.
- **Refactor** — none.

#### Step B2 — The reason names the module, not the folder

Covers: R13

- **Test first** — `scripts/tiers.test.ts`: `tierReason(['src/lib/theory/scales.ts'], 'generator')`
  matches `/selected.*src\/lib\/theory\/scales\.ts/`;
  `tierReason(['src/lib/theory/licks.ts'], 'generator')` matches
  `/not run.*no path under `scripts\/` and no module the generator imports/`.
  Run it: fails with `expected 'selected — the scope includes a path under `scripts/` or `src/lib/`.' to match …`.
- **Implement** — `tierReason`'s generator branch: name the offending path when
  one is under `scripts/` or in `GENERATOR_IMPORTS`, and reword the final string.
- **Green when** — both new cases and the four existing `tierReason` cases pass.
- **Refactor** — the existing case at line 71 pins the old wording; update its
  regex to the new sentence in the same step.

#### Step B3 — The rule is documented where the tiers are

Covers: R13

- **Test first** — none. `tiers.test.ts`'s *the config matches the rule* block
  already pins `vitest.config.ts` and `package.json`, and none of that changes.
  Run `npx vitest run --project tooling` to confirm all nine of those cases stay
  green.
- **Implement** — nothing beyond B1 and B2. **`vitest.config.ts` is not
  touched**: the generator *project* still collects `scripts/grooves/**` only,
  and the moved theory tests run under the app project. The tier trigger and the
  vitest project are different mechanisms and only the first one changes.
- **Green when** — `npx vitest run --project tooling` is fully green.
- **Refactor** — none.

### Track C — The eleven move down, and the leaf plumbing with them

Baseline before the first edit: `npm test` green. Roughly 30 files move; the
suite's file count is unchanged apart from `src/lib/date.test.ts` arriving.

#### Step C1 — The date formatter is a leaf

Covers: R8, R10, R11

- **Test first** — `src/lib/date.test.ts` (new): move `selectGroove.test.ts:11–25`'s
  two describes (`isoDate` renders the local calendar day for a late-evening UTC
  instant; `parseIsoDate` returns that day at noon local) verbatim, importing
  from `'./date'`. Run it: fails with `Error: Failed to load url ./date`.
- **Implement** — `src/lib/date.ts` as C5, bodies copied from
  `selectGroove.ts:4–14`. Then `selectGroove.ts`: delete both functions, add
  `import { isoDate, parseIsoDate } from '@/lib/date'`, and rewrite `dayIndexOf`
  to `Math.floor(parseIsoDate(iso).getTime() / 86_400_000)`.
- **Green when** — `src/lib/date.test.ts` passes and
  `npx vitest run --project app src/features/daily-groove/lib/puzzle/selectGroove.test.ts`
  is green — in particular the 40-day sweep at lines 112–148, which is what
  proves the day's groove did not move.
- **Refactor** — `selectGroove.test.ts` keeps its `isoDate`/`dayIndexOf`
  assertions at lines 112, 121 and 147: their subject is the selection, and they
  import `isoDate` from `@/lib/date` now.

#### Step C2 — `Answer` and `Attempt` sit with the types the generator shares

Covers: R9

- **Test first** — `src/lib/groove.test.ts`: add a case that builds an `Answer`
  and an `Attempt` literal `satisfies` their types and asserts the sorted key
  lists (`['flavour', 'root']` and
  `['correct', 'flavour', 'flavourMatched', 'root', 'rootMatched']`). Rewrite the
  file's own import from `'@/lib/groove'` to `'./groove'` (AC7), and
  `hash.test.ts:4` from `'@/lib/hash'` to `'./hash'`. Run it: fails with
  `error TS2305: Module '"./groove"' has no exported member 'Answer'`.
- **Implement** — `src/lib/groove.ts`: append the two types exactly as C5.
  `src/features/daily-groove/types.ts`: delete the local declarations and the
  value import, and widen the re-export to five names.
- **Green when** — `npx vitest run --project app src/lib` passes, **including
  the zero-import assertion at `groove.test.ts:125`** — the two new types name
  only `Root` and `Flavour`, declared in the same file.
- **Refactor** — none. `DailyResult` stays in the feature: the generator has
  never heard of it.

#### Step C3 — The eleven modules and `notes.ts` live under `src/lib/theory/`

Covers: R1, R10, R11, AC1, AC6, AC7

- **Test first** — the red is the resolver. `git mv` each of the twelve modules
  and its test from `src/features/daily-groove/lib/theory/` to
  `src/lib/theory/`, then run
  `npx vitest run --project app src/lib/theory`: fails with
  `Error: Failed to resolve import "../../types" from "src/lib/theory/music.ts"`.
- **Implement** — rewrite each moved file's imports per C8:
  - `'../../types'` → `'../groove'` in `character`, `degrees`, `difference`,
    `families`, `licks`, `music`, `notes`, `numerals`, `phrase`, `simpleModes`,
    `staff` and their tests.
  - `'@/lib/hash'` → `'../hash'` in `options.ts`.
  - `'../puzzle/selectGroove'` → `'../date'` in `music.ts` and `simpleModes.ts`.
  - `FLAVOUR_INTERVALS` from `'./notes'` → `'./scales'` in `degrees.ts`,
    `difference.ts`, `numerals.ts`, `phrase.ts` and the tests that import it.
  - `ROOTS` from `'./music'` → `'./roots'` in `phrase.ts`, `notes.test.ts`,
    `staff.test.ts`.
  - `notes.ts`: delete the `FLAVOUR_INTERVALS` declaration and import it from
    `'./scales'`; keep `FLAVOUR_LETTER_STEPS` and both error classes (C4).
  - `music.ts`: delete the `ROOTS` declaration, import it from `'./roots'`,
    delete the `GROOVES` import, and apply C6's signature.
  - `changes.ts` and `staff.ts` import nothing and move unchanged.
- **Green when** — `npx vitest run --project app src/lib/theory` is green except
  A4's two scans and the cases C9 relocates (Steps C6, C7 and C9), and
  `grep -rn "@/" src/lib` returns nothing.
- **Refactor** — the folder is flat, sixteen modules and sixteen tests. Do not
  invent sub-folders; the PRD's assumption is explicit.

#### Step C4 — The major scale is ionian, imported not retyped

Covers: R4, AC3

- **Test first** — A4's ionian scan, which lists `degrees.ts` and `numerals.ts`
  as holders. Also `src/lib/theory/degrees.test.ts` and `numerals.test.ts` stay
  green throughout: the value does not change.
- **Implement** — `src/lib/theory/scales.ts` exports
  `export const MAJOR_INTERVALS = INTERVALS.ionian`. `degrees.ts`: delete line 8
  and import `MAJOR_INTERVALS` from `'./scales'`. `numerals.ts`: delete line 5,
  import `MAJOR_INTERVALS` from `'./scales'`, and rename the two uses of `MAJOR`.
- **Green when** — every existing case in `degrees.test.ts` (spelling degrees for
  all thirteen) and `numerals.test.ts` (numerals for all thirteen) passes
  unchanged, and the ionian scan drops both files.
- **Refactor** — `numerals.test.ts:155–156`'s pinned import lines are rewritten
  per C8 in this step, not later.

#### Step C5 — The old folder is gone and the structure test says five

Covers: R2, AC1

- **Test first** — `src/features/daily-groove/structure.test.ts`: rename the case
  at line 49 to *contains exactly the five concern folders* and remove
  `'theory'` from the expected array. Run
  `npx vitest run --project app src/features/daily-groove/structure.test.ts`:
  fails with
  `AssertionError: expected [ 'audio', 'persistence', 'presentation', 'puzzle', 'share', 'theory' ] to deeply equal [ 'audio', 'persistence', 'presentation', 'puzzle', 'share' ]`.
- **Implement** — delete `src/features/daily-groove/lib/theory/` entirely. It
  must be empty of files by now; if anything remains, C3 missed it.
- **Green when** — the case passes and
  `ls src/features/daily-groove/lib` lists five directories.

  **This step is where AC1 is graded**, on the amended wording: `theory/` is
  absent, and the thirteen module files and their thirteen test files are under
  `src/lib/theory/`. It is not graded on assertion-by-assertion location —
  fourteen assertions have the catalogue as their subject and live with the
  catalogue (Step C6). The check is therefore two lists, both read from disk:

  ```
  ls src/lib/theory/*.ts | grep -v test   → 16 (the thirteen, plus names, roots, scales)
  ls src/lib/theory/*.test.ts             → 16
  test ! -d src/features/daily-groove/lib/theory
  ```
- **Refactor** — none.

#### Step C6 — The catalogue's own test owns the catalogue assertions

Covers: R12, AC1, AC6

- **Test first** — `src/features/daily-groove/data/grooves.generated.test.ts`
  receives the fourteen case declarations C9's first table names, in this order,
  each keeping its title, its `it.each` table and its failure messages:

  1. `describe('over the shipped catalogue')` from `changes.test.ts` — both
     cases, importing `barChords` and `BAR_COUNT` from `@/lib/theory/changes`.
  2. *holds for every groove the shipped manifest can play* from
     `staff.test.ts`, importing `staffNotes` and `STAFF_FLOOR_STEP` from
     `@/lib/theory/staff`.
  3. `describe('every groove in the catalogue')` from `music.test.ts`,
     importing `answerOf` from `@/lib/theory/music` and `ROOTS` from
     `@/lib/theory/roots`.
  4. The four `flavourPool` cases from `music.test.ts` — into a new
     `describe('the flavour pool over the shipped catalogue')` so the arrivals
     read as a group rather than dangling.
  5. `describe("today's options, as the page resolves them")` from
     `music.test.ts`, which is why the file's existing `selectGrooveForDate`
     import earns its keep.
  6. *is positive and finite for every groove in the catalogue* from
     `music.test.ts`, importing `loopSecondsOf`.
  7. The three `(R7)` / `(R9, AC2)` cases from
     `describe('the rotation is the generated catalogue (Epic 4)')` — into a
     `describe('the rotation is the generated catalogue')` block of the same
     name here, since the four source scans keep the original block alive in
     `music.test.ts`.

  Each import goes in the style the surrounding block already uses: statically at
  the top where the file imports statically, and `await import('@/lib/theory/…')`
  inside the case where the neighbouring describe already does that. Rewrite the
  file's six existing `await import('../lib/theory/…')` calls to
  `@/lib/theory/…` and line 5's `isoDate` import to `@/lib/date`.

  Run `npx vitest run --project app src/features/daily-groove/data/grooves.generated.test.ts`:
  green before the moves and green after them — the observable change is the
  count, so record it. The file goes from 328 lines to roughly 500, and its case
  declarations rise by thirteen (fourteen arrive, one is dropped below).
- **Implement** — nothing. These are assertions, not behaviour.
- **Green when** — every moved case passes in its new home with its original
  title and message, the `it.each` cases still enumerate all 30 grooves by id,
  and `npx vitest run --project app src/lib/theory` no longer reports an
  unresolved `../../data/grooves.generated`.
- **Refactor** — `notes.test.ts:133`'s *covers every flavour the catalogue uses*
  duplicates this file's existing *has an interval entry for every flavour the
  catalogue uses* at line 178, assertion for assertion. Keep the existing one,
  drop the arrival, and name it in the run report. **That is the only assertion
  in the epic that may be dropped rather than moved**, and the reason is that its
  subject already has a test in the file it was moving to.

#### Step C7 — A moved test that needed a pool asks the names module

Covers: R12, AC6

- **Test first** — in `character.test.ts`, `difference.test.ts`,
  `families.test.ts`, `licks.test.ts`, `phrase.test.ts` and `simpleModes.test.ts`,
  replace the pool derivation — `flavourPool(GROOVES)` or
  `[...new Set(GROOVES.map((g) => g.flavour))]` — with

  ```ts
  import { FLAVOURS, displayFlavour } from './names'

  const MODES = FLAVOURS.map(displayFlavour).sort()
  ```

  bound under whatever name the file already used (`MODES` in
  `difference.test.ts`, `POOL` in `licks.test.ts` and `phrase.test.ts`, `pool`
  in `families.test.ts` and `simpleModes.test.ts`, `modes` inside the two
  `character.test.ts` cases). Every case keeps its title and its assertion, with
  two exceptions where the title asserted something no longer true of the
  binding:

  - `difference.test.ts:72` — `describe('degreeDifferences over the whole
    catalogue')` becomes `describe('degreeDifferences over the twelve modes')`.
    Its four cases — *sweeps far more than a couple of pairs, so it cannot pass
    vacuously*, *compares every ordered pair of catalogue modes without
    throwing*, *puts the blues scale three or more degrees from every seven-note
    mode*, *spells both sides of every degree, wherever only one or two differ* —
    keep their titles except the second, which becomes *compares every ordered
    pair of modes without throwing*.
  - `families.test.ts:77` — `describe('the families partition the catalogue')`
    becomes `describe('the families partition the twelve modes')`. Its two
    cases, *sorts every mode in the pool into exactly one of the two families*
    and *gives each family exactly six members of the pool*, keep their titles:
    "the pool" is still what they read.

  Run `npx vitest run --project app src/lib/theory`: before the substitution it
  fails with `Error: Failed to resolve import "../../data/grooves.generated" from "src/lib/theory/families.test.ts"`,
  once per file.
- **Implement** — nothing. Every one of these assertions holds against the twelve
  display names exactly as it held against the pool derived from the manifest,
  because C8 pins the two as the same list.
- **Green when** — `npx vitest run --project app src/lib/theory` is green except
  A4's two scans, and `grep -rn "grooves.generated\|src/features" src/lib`
  returns nothing.
- **Refactor** — do not add a shared fixture module under `src/lib/`. One file
  (`music.test.ts`, Step C9) needs a `Groove` literal, and a fixture folder would
  be a second thing to keep in step with the manifest — which is the coupling
  this step is removing.

#### Step C8 — The pool substitution cannot drift

Covers: R4, R12, AC3

- **Test first** — `src/features/daily-groove/data/grooves.generated.test.ts`:
  add

  ```ts
  it('carries exactly the twelve flavours the theory module names (F20 E1 R4)', async () => {
    const { flavourPool } = await import('@/lib/theory/music')
    const { FLAVOURS, displayFlavour } = await import('@/lib/theory/names')
    expect(flavourPool(GROOVES)).toEqual(FLAVOURS.map(displayFlavour).sort())
  })
  ```

  Run it: passes immediately — it is a pin, not a fix. Break it deliberately once
  by dropping a flavour from the expected list and confirm the failure names the
  missing mode.
- **Implement** — nothing.
- **Green when** — it passes, and every `MODES` substitution in Step C7 is
  justified by it.
- **Refactor** — none.

#### Step C9 — `music.test.ts` keeps its own subject, and passes its pool in

Covers: R7, R12, AC6

This is the file the split falls hardest on. What is left in
`src/lib/theory/music.test.ts` afterwards: `answerOf`, `flavourOptions`,
`simpleRootOptions`, `loopSecondsOf`, the two hand-built `flavourPool` cases and
the five source scans — every one of them a test of a pure function, with no
import of the feature.

- **Test first** — `src/lib/theory/music.test.ts`: declare the two literals the
  eleven fixture cases share, at the top of the file, replacing the
  `GROOVES` import:

  ```ts
  import type { Groove } from '../groove'

  const GROOVE: Groove = {
    id: 'groove-01',
    uuid: '61607a6c-3f9e-4fd7-9724-99ea22d32e4a',
    audioSrc: '/grooves/groove-01.mp3',
    name: 'Test Groove',
    bpm: 90,
    scale: 'C aeolian',
    chord: 'Cm7',
    progression: 'Cm7–Fm7–G7',
    progressionDegrees: [0, 3, 4, 0],
    root: 'C',
    flavour: 'Aeolian',
    bars: 4,
    loopBars: 4,
    headDelaySeconds: 0,
  }

  const CATALOGUE: Groove[] = ['Aeolian', 'Dorian', 'Lydian', 'Blues', 'Ionian'].map(
    (flavour, i) => ({ ...GROOVE, id: `groove-0${i + 1}`, flavour }),
  )
  ```

  `CATALOGUE` carries five distinct flavours because `flavourOptions` returns
  four options and needs at least four to draw from; five keeps the "not every
  flavour is offered" assertion in *draws only from the seeded flavour pool*
  meaningful. Then rewrite the eleven cases:

  - `answerOf` (L17, L22, L35) — `{ ...GROOVE, root: 'A', flavour: 'Dorian' }`
    and so on, in place of `{ ...GROOVES[0], … }`. Titles unchanged, including
    *keeps a two-word flavour intact, which a parse of `scale` would not*.
  - `flavourOptions` — the `it.each` over 30 dates becomes
    `flavourOptions(date, CATALOGUE[1], CATALOGUE)`, and *is stable for the same
    date* and *draws only from the seeded flavour pool* take `CATALOGUE` the
    same way. All three keep their titles; *draws only from the seeded flavour
    pool* derives its pool as `flavourPool(CATALOGUE)`.
  - `loopSecondsOf` (L196, L213, L218, L224, L231) — `{ ...GROOVE, bpm: 96,
    bars: 4, loopBars: 4 }` and so on. *measures the file* keeps its name; it
    was never about the catalogue.

  Run `npx vitest run --project app src/lib/theory/music.test.ts`: fails first
  with `error TS2554: Expected 3 arguments, but got 2` at each `flavourOptions`
  call, and before that with
  `Error: Failed to resolve import "../../data/grooves.generated"`.
- **Implement** — C6's signature in `src/lib/theory/music.ts`:
  `flavourOptions(date, groove, grooves)`, body
  `buildOptions(groove.flavour, flavourPool(grooves), isoDate(date))`, and the
  `GROOVES` import deleted.
- **Green when** — the file is green, `music.ts` has no `GROOVES` import — which
  is what lets it live under `src/lib/` at all — and the four source scans still
  pass. In particular *hands the whole catalogue to the day's pick and to the
  pool (R7, AC8)* still finds `flavourPool(GROOVES)` in a non-test source file:
  after this step the only one is `GroovePuzzle.tsx:78`, so if Track E1 removes
  that line the case fails here, not there.
- **Refactor** — none. `flavourPool` already took its grooves as an argument;
  the two functions now read the same way, which is the whole of R7.

#### Step C10 — Nothing in the app still names the old folder

Covers: R12, AC6

- **Test first** — run `grep -rn "lib/theory" src scripts docs .claude`. Every
  remaining hit must be a `src/lib/theory` path. Track C's own files are clean at
  this point; the hits under `components/`, `hooks/` and `lib/` are Wave 3's, and
  the ones under `scripts/` are Track D's.
- **Implement** — nothing.
- **Green when** — the grep's output, filtered to the paths Track C owns, is
  empty.
- **Refactor** — none.

### Track D — The generator imports the shared module

#### Step D1 — The generator's two theory primitives are gone

Covers: R3, AC2

- **Test first** — `scripts/grooves/boundary.test.ts`: apply C11's crossing-list
  rewrite. Run `npm run test:gen`: fails with
  `AssertionError: expected [ 'src/lib/groove.ts', 'src/lib/hash.ts' ] to deeply equal [ 'src/lib/groove.ts', 'src/lib/hash.ts', 'src/lib/theory/names.ts', 'src/lib/theory/roots.ts', 'src/lib/theory/scales.ts' ]`.
- **Implement** — delete `scripts/grooves/theory/notes.ts`,
  `theory/notes.test.ts`, `theory/scales.ts` and `theory/scales.test.ts`, then
  re-point every import in C7's table.
- **Green when** — the crossing list matches exactly the five, `npm run test:gen`
  is green, and `ls scripts/grooves/theory` shows six files:
  `harmony.ts`, `harmony.test.ts`, `pitches.ts`, `pitches.test.ts`,
  `validity.ts`, `validity.test.ts` (plus `harmony.fixture.json` beside them in
  `scripts/grooves/`).
- **Refactor** — none. `harmony.ts`, `pitches.ts` and `validity.ts` keep taking
  `MusicMeta`, `NoteEvent` and `VoiceName` from `../types.ts`; nothing about
  their contents changes.

#### Step D2 — The generator does not declare the flavour union, it imports it

Covers: R5c, R6, AC5

- **Test first** — `scripts/grooves/boundary.test.ts`: replace the assertion at
  lines 93–97 with C11's four-part version. Run `npm run test:gen`: fails with
  `AssertionError: expected 'import type { Root } …export type Flavour =…' not to match /\bexport\s+type\s+Flavour\s*=/`.
- **Implement** — `scripts/grooves/types.ts` as C7: delete the twelve-member
  union, add the `export type { FlavourSlug as Flavour }` line.
- **Green when** — all four assertions pass, and the six generator modules that
  name `Flavour` (`events.ts`, `pools.ts`, `theory/harmony.ts`,
  `theory/pitches.ts`, `theory/validity.ts`, `templates/*.ts`) are **unedited** —
  that is the point of the re-export.
- **Refactor** — **break it deliberately, once**: redeclare the union in
  `types.ts` and confirm the second assertion fails; then point the import at
  `src/lib/groove.ts`'s `Flavour` and confirm the fourth fails. Revert both. A
  guard nobody has seen fail is not known to work.

#### Step D3 — `displayFlavour` is imported, not declared, by the CLI

Covers: R5, R14

- **Test first** — `scripts/grooves/cli.test.ts`: point any import of
  `displayFlavour` at `'../../src/lib/theory/names.ts'` and keep every existing
  assertion about `toGroove`'s output. Run `npm run test:gen`: fails with
  `error TS2305: Module './cli.ts' has no exported member 'displayFlavour'`
  once the export is removed.
- **Implement** — `cli.ts`: delete lines 31–34, add
  `import { displayFlavour } from '../../src/lib/theory/names.ts'`. Line 52 is
  unchanged.
- **Green when** — `npm run test:gen` is green, and in particular every
  `manifest.test.ts` and `cli.test.ts` case that asserts a `flavour` string
  passes with the same expected value as before.
- **Refactor** — none.

#### Step D4 — The generator still renders the same twelve scales

Covers: R14

- **Test first** — no new test. Run `npm run test:gen` in full: `events.test.ts`,
  `gate.test.ts`, `harmony.test.ts`, `validity.test.ts`, `lock.test.ts`,
  `manifest.test.ts` and `pack.test.ts` are the ones that would catch a changed
  interval, root order or scale name.
- **Implement** — nothing.
- **Green when** — the whole generator tier is green with no snapshot or fixture
  updated. **If `harmony.fixture.json` needs regenerating, stop the epic** —
  that file is derived from the interval table and the root order, and a diff in
  it means a value moved.
- **Refactor** — none.

#### Step D5 — The docs name files that exist

Covers: R3

- **Test first** — `npm run test:gen` (`docs.test.ts`) stays green throughout; it
  checks the README's freeze wording and the guidelines' hash sentences, neither
  of which changes here. The check for this step is a `grep -n "theory/scales\|theory/notes" docs/ scripts/grooves/README.md`.
- **Implement** — `docs/music.md`: line 58 becomes
  *"`FLAVOURS` in `src/lib/theory/names.ts` and `INTERVALS` in
  `src/lib/theory/scales.ts`."*; the *Where to change what* row for
  *add a mode* becomes
  *"`src/lib/theory/names.ts` (append only), `src/lib/theory/scales.ts`,
  `theory/validity.ts`"*; line 84's claim that the flavour draw indexes into
  `FLAVOURS` is corrected to name the template's own `flavours` list, which is
  what `events.ts:323` actually picks from. Lines 93, 114, 316 and 317 name
  `theory/harmony.ts` and `theory/validity.ts`, which still exist — leave them.
- **Green when** — the grep returns nothing outside `src/lib/`, and
  `npm run test:gen` is green.
- **Refactor** — do not restructure `docs/music.md`. Four path corrections and
  one sentence; the musical model is unchanged.

#### Step D6 — Whatever the generator renders, it renders into a scratch directory

Covers: R15, AC10

- **Test first** — no test of its own; this file *is* a check, run by hand. It is
  the one file in the epic without a colocated test, and Step G2 is what runs it.
- **Implement** — `scripts/grooves/rerender-check.ts`:

  ```ts
  import { mkdtempSync } from 'node:fs'
  import { tmpdir } from 'node:os'
  import { join } from 'node:path'
  import { DEFAULT_LOCK_PATH, generate } from './cli.ts'
  import { readLock } from './lock.ts'

  const scratch = mkdtempSync(join(tmpdir(), 'groove-rerender-'))
  await generate({
    outDir: join(scratch, 'grooves'),
    manifestPath: join(scratch, 'grooves.generated.ts'),
    lockPath: join(scratch, 'grooves.lock.json'),
  })

  const committed = readLock(DEFAULT_LOCK_PATH)
  const fresh = readLock(join(scratch, 'grooves.lock.json'))
  // compare fresh.grooves against committed.grooves by id: sha256 and bytes;
  // compare manifestSha256 and catalogueSha256;
  // print one line per groove, then exit 1 on any mismatch.
  ```

  It is wired into nothing: no npm script, no gate, no import from another
  module.
- **Green when** — the file type-checks and `boundary.test.ts` still passes (it
  imports only `./cli.ts` and `./lock.ts`, so it opens no new crossing).
- **Refactor** — none. Do not add it to `package.json`: the PRD is explicit that
  the proof runs once and a slow render does not belong in a gate.

#### Step D7 — Nothing under `scripts/` reaches past `src/lib/`

Covers: R3, AC2

- **Test first** — `boundary.test.ts`'s three existing cases (*imports nothing
  from src/features*, *names src/features only as the manifests it writes*,
  *reaches the app only through src/lib*) run unchanged. Run `npm run test:gen`.
- **Implement** — nothing.
- **Green when** — all three pass. The second one is the important one: the two
  manifest output paths are still the only mention of `src/features` under
  `scripts/`, and `rerender-check.ts` names neither.
- **Refactor** — none.

#### Step D8 — The committed outputs are untouched

Covers: R14, AC9

- **Test first** — `npm run grooves:verify`, then
  `git status --short public src/features/daily-groove/data scripts/grooves/catalogue.json scripts/grooves/grooves.lock.json`.
- **Implement** — nothing. If anything is modified, a test or a script wrote into
  the tree and the offending run has to be found before Wave 3 starts.
- **Green when** — verification passes and the git output is empty.
- **Refactor** — none.

### Track E1 — The shell and the cards

#### Step E1.1 — The page imports the shared theory

Covers: R7, R12, AC6

- **Test first** — the red is the type check. Run `npx tsc --noEmit`: fails with
  `error TS2307: Cannot find module '../lib/theory/music' or its corresponding type declarations.`
  at `GroovePuzzle.tsx:24`.
- **Implement** — `GroovePuzzle.tsx`: rewrite the four theory imports at lines
  19–27 to `@/lib/theory/music` (without `ROOTS`), `@/lib/theory/roots`,
  `@/lib/theory/families`, `@/lib/theory/simpleModes`, `@/lib/theory/changes`,
  and pass `GROOVES` at line 203 per C6.
- **Green when** — `npx vitest run --project app src/features/daily-groove/components/GroovePuzzle.page.test.tsx`
  is green and the flavour chips are the same four strings as before — the
  `guessing` test's `flavourOptions(...)` comparison at line 113 is what proves
  it.
- **Refactor** — the theory imports stay as module paths. Epic 3 routes them
  through the door it creates; introducing one here would be that epic's work
  done early and in the wrong file.

#### Step E1.2 — The composed tests and the cards follow

Covers: R7, R12, AC6

- **Test first** — run
  `npx vitest run --project app src/features/daily-groove/components`: fails per
  file with `Failed to resolve import "../lib/theory/music"`.
- **Implement** — rewrite per C8 in the six `GroovePuzzle.*.test.tsx` files,
  `puzzle/GuessCard.test.tsx`, `puzzle/NudgeBox.test.tsx`,
  `solved/SolvedPanel.tsx`, `solved/SolvedPanel.test.tsx`,
  `solved/LeadSheet.test.tsx`, `solved/ScaleStaff.tsx` and
  `solved/ScaleStaff.test.tsx`. `SolvedPanel.tsx:15`'s `scaleNotes` stays on
  `@/lib/theory/notes`; anything importing `FLAVOUR_INTERVALS` moves to
  `@/lib/theory/scales`. Add the third argument at the three `flavourOptions`
  call sites, and the `GROOVES` import where the file lacks one.
- **Green when** — the whole `components/` directory is green with no assertion
  changed except `ScaleStaff.test.tsx:876`'s specifier list (C8). The three
  `flavourOptions` call sites pass `GROOVES`, not the file's local `GROOVE` or
  `DORIAN` — C6's trap. A row of one chip instead of four is the tell.
  `GroovePuzzle.tsx:78`'s `const FLAVOUR_POOL = flavourPool(GROOVES)` is left
  alone: Step C9's source scan asserts a non-test file still holds that call.
- **Refactor** — none.

### Track E2 — Hooks and the harness

#### Step E2.1 — The harness draws from the real pool

Covers: R7, R12, AC6

- **Test first** — run
  `npx vitest run --project app src/features/daily-groove/hooks`: fails with
  `Failed to resolve import "../lib/theory/phrase"` and, once resolved,
  `error TS2554: Expected 3 arguments, but got 2` at `puzzleHarness.tsx:30`.
- **Implement** — `puzzleHarness.tsx`: `@/lib/theory/music`, `@/lib/date`, and
  `flavourOptions(new Date(), GROOVE, GROOVES)` with `GROOVES` imported from
  `'../data/grooves.generated'`. `useModeLick.ts`, `useModeLick.test.ts`,
  `usePuzzleSession.ts`, `usePuzzleSession.test.ts` and
  `useProgress.integration.test.ts` follow C8.
- **Green when** — the `hooks/` directory is green and
  `puzzleHarness.tsx`'s `flavours()` still returns four chips. **If it returns
  one, the local `GROOVE` was passed as the pool** — the trap C6 names.
- **Refactor** — none.

### Track E3 — The feature's other lib folders

#### Step E3.1 — Coaching and presentation import the shared theory

Covers: R12, AC6

- **Test first** — run
  `npx vitest run --project app src/features/daily-groove/lib/presentation`:
  fails with `Failed to resolve import "../theory/families"`.
- **Implement** — `nearMiss.ts` (`FAMILIES` → `@/lib/theory/families`,
  `degreeDifferences` → `@/lib/theory/difference`, `FLAVOUR_INTERVALS` →
  `@/lib/theory/scales`), `ruledOut.ts` (`isoDate` → `@/lib/date`), and the five
  test files per C8.
- **Green when** — the directory is green with no assertion changed.
- **Refactor** — none.

#### Step E3.2 — Puzzle, persistence and audio follow

Covers: R8, R12, AC6

- **Test first** — run
  `npx vitest run --project app src/features/daily-groove/lib`: fails per file.
- **Implement** — `lib/puzzle/narrowing.ts` and `scoring.ts` and their tests;
  `lib/persistence/streak.ts` and `lapsed.ts` (`isoDate`, `parseIsoDate` →
  `@/lib/date`); `lib/audio/lick.ts`, `lick.test.ts`, `beat.test.ts`,
  `loop.test.ts`. `lib/puzzle/selectGroove.ts` is Track C's and must already be
  correct — if it is not, Wave 3 started early.
- **Green when** — `src/features/daily-groove/lib` is green, including
  `streak.test.ts`'s feature-19 cases.
- **Refactor** — none.

#### Step E3.3 — The reference notes name the roots module

Covers: R12, AC6

- **Test first** — run
  `npx vitest run --project app src/features/daily-groove/data/notes.generated.test.ts`:
  fails with `Failed to resolve import "../lib/theory/music"`.
- **Implement** — `notes.generated.test.ts:6` imports `ROOTS` from
  `@/lib/theory/roots`.
- **Green when** — green.
- **Refactor** — none.

### Track F — The guidelines say what the bar is now

#### Step F1 — The `src/lib/` bar says what it now is

Covers: R11

- **Test first** — `npm run test:gen` (`docs.test.ts`) and
  `npx vitest run --project tooling` (`agent-floor.test.ts`) both stay green:
  the four cases that read `coding-guidelines.md` check the hash sentences and
  the absence of the README freeze rule, none of which this step touches. The
  check for the rewrite itself is a read-back against the tree.
- **Implement** — `docs/coding-guidelines.md` §*Shared code (`src/lib/`)*:
  - Replace *"`src/lib/hash.ts` and `src/lib/groove.ts` are the whole of it
    today"* with what the folder now holds: `hash.ts`, `groove.ts`, `date.ts`,
    `branding.ts` and the sixteen modules of `theory/`.
  - Rewrite the fourth bar. **Genuinely shared** no longer holds for eleven of
    the theory modules, and the honest replacement is the property that actually
    matters: *a module earns a place in `src/lib/` if it is pure,
    dependency-free of app code, runtime-safe TypeScript, and either shared
    across the app/generator boundary or a body of domain logic that has to stay
    in one piece for the shared half to be coherent.* Say plainly what that
    costs: after feature-20 Epic 1, deleting `src/features/daily-groove/` leaves
    eleven theory modules nothing imports. The app still builds, so
    `architecture.md`'s removability standard holds literally, but the cut is no
    longer clean — and if `src/lib/` becomes where things go when nobody wants
    to decide, this is the paragraph that let it happen.
  - Keep the leaf paragraph and zone 4 exactly as they are; both got stronger,
    not weaker.
- **Green when** — both test commands are green and no sentence in the section
  names a file that does not exist.
- **Refactor** — do not restructure the document. Epic 3 extends this bar; it
  should find prose it can add a clause to.

#### Step F2 — The `Flavour` paragraph moves with the type

Covers: R6

- **Test first** — read `boundary.test.ts`'s rewritten assertion (Step D2) and
  the paragraph side by side. They must describe the same rule. `npm run test:gen`
  is the mechanical check.
- **Implement** — `docs/coding-guidelines.md` lines 301–310: the generator's
  `Flavour` is now `FlavourSlug`, declared once in `src/lib/theory/names.ts` and
  re-exported by `scripts/grooves/types.ts` under the name the generator's six
  modules already use. `displayFlavour()` is in `names.ts`, beside the
  thirteen-entry map, and is still the single conversion point. Unifying the two
  spellings would still be *a behaviour change wearing a de-duplication's
  clothes* — the sentence keeps its job, it just no longer claims the
  distinction lives in `types.ts`. Name the rewritten assertion.
- **Green when** — the paragraph and the test agree, and `npm run test:gen` is
  green.
- **Refactor** — none.

#### Step F3 — The agent definitions stop quoting the retired bar

Covers: R11

- **Test first** — `npx vitest run --project tooling scripts/agent-floor.test.ts`:
  green before and after. Its `lib-is-a-leaf` rule matches the leaf sentence,
  which both files keep, so the floor stays satisfied.
- **Implement** — `.claude/agents/architect.md:74` and
  `.claude/agents/implementer.md:36`: replace *"and genuinely shared across the
  app/generator boundary. All four bars"* with F1's rewritten bar, in one
  sentence each.
- **Green when** — the tooling tier is green and neither file states a rule
  `coding-guidelines.md` no longer carries.
- **Refactor** — none. The roadmap assigns agent-definition updates to Epic 3;
  this is the one sentence Epic 1 itself invalidates, so it is fixed here and
  the rest is left alone.

## Integration and verification

### Step G1 — The full gate

Covers: AC11

`npm test`, `npm run test:gen`, `npx tsc --noEmit`, `npm run lint`,
`npm run build`. Run in that order; `tsc` is the first thing that has been able
to pass since Wave 2 began, so a failure there is a Wave 3 track that did not
finish rather than a new defect.

Expected shape: two test files more than the baseline (`src/lib/date.test.ts`
arrives; the thirteen app theory tests move rather than multiply; the
generator's `theory/notes.test.ts` and `theory/scales.test.ts` are replaced by
three — `roots.test.ts`, `scales.test.ts`, `names.test.ts`). Case count
rises by roughly twenty-five — A1–A4's new pins, C2's key lists, C8's pool pin,
B1's and B2's tier cases — and falls by one, the duplicate C6 names.

### Step G2 — The re-render proof

Covers: R15, AC10

```
node scripts/grooves/rerender-check.ts
```

Requires `ffmpeg` and `ffprobe` on the path, as `npm run grooves` does. It
renders all 30 grooves into `$TMPDIR/groove-rerender-*/` and prints one line per
groove. Three things must hold:

1. Every groove's `sha256` matches the committed `grooves.lock.json` entry, and
   so does its `bytes`.
2. `manifestSha256` matches. This is the direct proof that `displayFlavour`'s
   move from an algorithm to a data map changed no byte of
   `src/features/daily-groove/data/grooves.generated.ts` — the manifest carries
   the display spelling, and the scratch manifest is written from the same
   `toGroove` call.
3. `catalogueSha256` matches, which it must: the same file was read.

**A mismatch on any groove stops the epic.** Before calling it a regression,
decode the scratch MP3 and the committed one and compare their PCM — per the
PRD's assumption, an encoder that is not bit-stable is a finding about the gate,
not about the theory move. If the PCM matches and only the bytes differ, say so
in the run report and do not touch the theory.

Nothing about this is wired into a gate.

### Step G3 — The committed catalogue is untouched

Covers: R14, AC9

```
npm run grooves:verify
git status --short
```

Verification passes, and `git status` shows no change under `public/grooves/`,
`public/notes/`, `src/features/daily-groove/data/*.generated.ts`,
`scripts/grooves/catalogue.json` or `scripts/grooves/grooves.lock.json`. The
scratch render writes only into `$TMPDIR`; if any of those files is dirty, find
the write before doing anything else.

### Step G4 — The guards fire when broken

Covers: R4, R6, R13, AC3, AC5, AC8

Four deliberate breakages, each reverted:

1. Copy the twelve-root literal into a second non-test module → `roots.test.ts`'s
   scan fails, naming both holders.
2. Copy `[0, 2, 3, 5, 7, 8, 11]` into a second non-test module →
   `scales.test.ts`'s scan fails, naming harmonic minor.
3. Redeclare the twelve-slug union in `scripts/grooves/types.ts` →
   `boundary.test.ts` fails; then point it at `src/lib/groove.ts`'s `Flavour` →
   it fails differently.
4. `tiersFor(['src/lib/theory/scales.ts'])` includes `generator`;
   `tiersFor(['src/lib/theory/licks.ts'])` does not — both directions, per the
   roadmap's *a trigger that fires on everything is the old rule with extra
   steps*.

### Step G5 — The demo path, by hand

`npm run dev`, `localStorage` cleared:

1. Open the puzzle. Four mode chips and six root chips, the same ones as before
   the epic — compare against a screenshot taken on `main` for the same date.
2. Guess wrong twice: the hint, the ruled-out line and the nudge behave
   identically.
3. Solve. The solved panel's scale spelling, degrees, roman numerals, lead sheet
   and staff all render — those are `notes`, `degrees`, `numerals`, `changes` and
   `staff`, the five modules whose only consumer is the panel.
4. Tap a mode chip in simple mode and hear the lick: `simpleModes`, `licks` and
   `phrase` through `@/lib/theory`.
5. Reload. The day restores.
6. Open a shared link. The shared-groove notice and the answer are unchanged.

### Step G6 — What to check before calling this done

- `ls src/features/daily-groove/lib` lists exactly five directories.
- `ls scripts/grooves/theory` lists exactly six files.
- `grep -rn "lib/theory" src scripts docs .claude` returns only `src/lib/theory`
  paths.
- `grep -rn "@/" src/lib` returns nothing.
- `src/lib/hash.ts` is byte-identical to `main`.
- `src/features/daily-groove/index.ts` is byte-identical to `main` — the slice's
  public surface did not move, so nothing about removability changed except what
  F1 now says out loud.
- `harmony.fixture.json` is byte-identical to `main`.
- `grooves.generated.test.ts`'s case declarations rose by thirteen, and no moved
  case lost its title. The one dropped duplicate — `notes.test.ts:133`'s *covers
  every flavour the catalogue uses* — is named in the run report.
- `src/lib/theory/` holds sixteen `*.ts` modules and sixteen `*.test.ts` files,
  and `src/features/daily-groove/lib/theory` does not exist. That pair of checks
  is AC1.
- `GroovePuzzle.tsx:78`'s `const FLAVOUR_POOL = flavourPool(GROOVES)` still
  exists, or `music.test.ts`'s *hands the whole catalogue to the day's pick and
  to the pool* is failing for the wrong reason.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A5, C3, C5 |
| R2 | C5 |
| R3 | A3, A5, D1, D5, D7 |
| R4 | A3, A4, C4, C8, G4 |
| R5 | A1, A2, D3 |
| R5a | A1, F2 |
| R5b | A2 |
| R5c | A1, D2 |
| R6 | D2, F2, G4 |
| R7 | C9, E1.1, E1.2, E2.1 |
| R8 | C1, E3.2 |
| R9 | C2 |
| R10 | C2, C3 |
| R11 | C1, C3, F1, F3 |
| R12 | C6, C7, C9, C10, E1.1, E1.2, E2.1, E3.1, E3.2, E3.3 |
| R13 | B1, B2, B3, G4 |
| R14 | A2, D3, D4, D8, G3 |
| R15 | D6, G2 |
| AC1 | C5 (graded there), C3, C6 |
| AC2 | A3, D1, D7 |
| AC3 | A3, A4, C4, C8, G4 |
| AC4 | A1, A2 |
| AC5 | D2, G4 |
| AC6 | C3, C6, C7, C9, C10, E1.1, E1.2, E2.1, E3.1, E3.2, E3.3 |
| AC7 | C2, C3 |
| AC8 | B1, G4 |
| AC9 | D8, G3 |
| AC10 | D6, G2 |
| AC11 | G1 |

**Totals after the Cycle 2 rewrite:** 18 requirement clauses (R1–R15 with
R5a–R5c) and 11 acceptance criteria, every one traced to at least one of the
41 steps — 35 track steps (A1–A5, B1–B3, C1–C10, D1–D8, E1.1–E3.3, F1–F3) and
six integration steps (G1–G6). Thirty-nine carry a `Covers:` line and none
covers nothing; G5 (the demo path) and G6 (the pre-flight checklist) carry none
by design, because they re-check what the other steps already claim. The
Cycle 2 rewrite added coverage rather than moving it: R7 gained E1.1 and E1.2
(the call sites), R12 and AC6 gained C9 (`music.test.ts`'s split), and AC1 now
names Step C5 as the place it is graded.

## Assumptions

- **The app's interval table is thirteen entries, not twelve, and the PRD's
  problem table says twelve.** `Locrian` is in `FLAVOUR_INTERVALS` and not in
  `FLAVOURS`, deliberately and for a documented musical reason. The design keeps
  both lists and separates `FlavourSlug` (twelve) from `ScaleSlug` (thirteen). If
  a reviewer would rather widen the generator's union to thirteen, that is a
  one-line change here and a change to what a catalogue may declare there —
  which is why it is not the default.
- **`FLAVOURS` lives in `names.ts`, not `scales.ts`.** R5c requires the union in
  `names.ts`, the union is derived from the ordered list, and a second list in
  `scales.ts` would be the duplication the epic removes one type level away.
  The cost is that `docs/music.md` §Scales now names two files, and four
  generator import lines point at `names.ts` rather than `scales.ts`.
- **`isoDate` and `parseIsoDate` go to `src/lib/date.ts`.** The PRD says
  "`src/lib/`" without naming a file. `date.ts` beside `hash.ts` and `groove.ts`,
  rather than folded into `theory/`, because they are not theory.
- **`dayIndexOf` stays in `selectGroove.ts` and is rewritten to call
  `parseIsoDate`.** R8 moves two functions; leaving a third copy of the same
  `new Date(y, m - 1, d, 12, …)` construction one line away from the moved one
  is how the duplication starts again. The construction is identical, so the day
  index cannot move, and the existing 40-day sweep proves it.
- **The uniqueness scans exclude test files.** `roots.test.ts` pins the twelve
  as a change-detector, `groove.test.ts` pins the `Root` union's twelve members,
  and `lib/audio/reference.test.ts` pins the reference-note pitches — three
  legitimate, differently-subjected literals. R4 says the test "keeps itself out
  of its own search"; excluding every test is the generalisation that makes the
  scan buildable. The trade is that a duplicate hiding in a test file would not
  be caught, and both historical boundary violations were in test files.
- **`music.test.ts`'s local `CATALOGUE` carries five flavours, not four.**
  `flavourOptions` returns four options, so a four-flavour catalogue would make
  *draws only from the seeded flavour pool* vacuous — every flavour would be
  offered every time. Five is the smallest list that keeps the assertion doing
  work. It is not the twelve: these cases test the function, not the vocabulary.
- **Two describes are retitled, and no case is.** `degreeDifferences over the
  whole catalogue` and `the families partition the catalogue` both name a corpus
  their binding no longer reads. Renaming them to *the twelve modes* is the
  honest description of what they now sweep; leaving the old titles would be a
  test claiming a subject it does not have. Every `it` keeps its title except
  `compares every ordered pair of catalogue modes without throwing`, which drops
  the word *catalogue* for the same reason.
- **`slugOf` has no production caller.** It exists because AC4 asks for the
  round trip in both directions. Delete it and AC4's second half has to be
  asserted through the map instead.
- **`MAJOR_INTERVALS` and `MAJOR` are the ionian set and are folded into
  `scales.ts`.** Two extra copies of an interval array the PRD did not count.
  The alternative is exempting ionian from the scan, which makes the scan a
  statement about twelve of thirteen sets.
- **`docs/music.md` gets four path corrections and one factual one.** The
  roadmap puts `music.md` out of scope for Epic 3 on the grounds that the
  musical model is unchanged — true, but two of its paths name files this epic
  deletes, and its claim that the flavour draw indexes into `FLAVOURS` is not
  what `events.ts:323` does (it picks from the template's own list). Corrected
  because a doc pointing at a deleted file is worse than a doc nobody edited.
- **The two agent definitions are edited here** rather than in Epic 3. The
  roadmap assigns `.claude/agents/` to Epic 3, but the "all four bars" sentence
  is invalidated by *this* epic, and an agent applying a retired rule during
  Epic 2 is a real cost. Nothing else in those files is touched.
- **`vitest.config.ts` is not touched.** The generator *project* still collects
  `scripts/grooves/**` only, so the four generator theory tests that move to
  `src/lib/theory/` now run under `npm test` rather than `npm run test:gen`.
  They are pure functions with no ffmpeg and no render, so they belong in the
  fast tier — and `tiers.test.ts`'s partition assertion stays satisfied.
- **`scales.ts` exports both the slug-keyed and the display-keyed table.** The
  display-keyed one is derived, so R4 holds, but it is still an export the app
  reaches for by name. A `theory/index.ts` door would hide that; Epic 3 owns the
  door, and this epic's consumers import module paths (PRD, Scope).
- **Line numbers and import lists in this spec were measured with feature-19's
  uncommitted work applied** — 18 files including `GroovePuzzle.tsx`,
  `GuessCard.tsx`/`.test.tsx`, `puzzleHarness.tsx`, `feedback.ts`, `streak.ts`,
  with `AttemptDots.*` deleted. `GroovePuzzle.tsx` is 406 lines; its theory
  imports are lines 19–27. If feature-19 lands differently, re-read those files
  before quoting a line.
- **Three modules keep a triplicated `OFFSET_ACCIDENTAL` map** — `notes.ts`,
  `degrees.ts` and `numerals.ts` each hold the same five-entry
  semitone-to-accidental table, and so does a fourth copy's worth of logic in
  `staff.ts`. R4 covers `ROOTS` and the interval sets only, so they are left
  alone. Recorded as a finding for whoever writes the next theory epic.
- **`src/lib/` ends the epic at twenty modules and nineteen tests.** The PRD's
  "roughly twenty" is right, counting modules.

## Decision log

### Cycle 1 — 2026-09-03

**Q1. The app's interval table has thirteen entries and the generator's has twelve. One table or two?**
Decision: **One table of thirteen, keyed by slug, with two type names** —
`FlavourSlug` for the twelve the generator renders and `ScaleSlug` for the
thirteen the app can spell. R4 says each interval set is declared once, and
`docs/music.md` says locrian must stay out of `FLAVOURS`; both hold only if the
table and the vocabulary list are different things. The app's display-keyed
`FLAVOUR_INTERVALS` becomes derived, which is what turns R4 from nearly true into
true.
Changed: Architecture (*Thirteen scales, twelve flavours*), Contracts C1 and C3,
Steps A1, A3, and the Assumption that opens the list.

**Q2. `FLAVOURS` in `names.ts` or in `scales.ts`?**
Decision: **`names.ts`** — R5c puts the union there, the union is derived from
the ordered array, and putting the array in `scales.ts` would list the twelve in
two files. Four generator import lines and one `docs/music.md` sentence move as a
result.
Changed: Contracts C1 and C7, Steps A1 and D5.

**Q3. How do the nine moved theory tests keep their catalogue assertions when lint zone 4 forbids `src/lib/` importing `src/features/`?**
Decision: **Split by subject** — a case about the catalogue moves to the
catalogue's own test, a case that merely needed a `Groove` or a mode pool gets a
local one, and the pool substitution is pinned so it cannot drift. This is the
one point where the PRD's assumption ("test files move with their modules and
keep their assertions") cannot hold as written, and it is raised as Q1 below
rather than closed, because it decides where roughly 700 lines of assertions
live.
Changed: Architecture (*Where the catalogue-corpus assertions go*), Contract C9,
Steps C6, C7, C8, and Open question Q1.

**Q4. One track for the whole move, or several?**
Decision: **Seven tracks in four waves, with the two big mechanical passes in
parallel** — the primitives merge is separable and is what everything depends on
(the roadmap says so), the generator's re-point and the app's move touch disjoint
trees, and Wave 3 is three folders of the same rewrite. Track C is not
subdivided: the folder is deleted once and its eleven modules import each other.
Changed: Tracks, Execution waves, and the note that the tree does not build
between Waves 2 and 3.

### Cycle 2 — 2026-09-03

**Q1. Nine moved theory tests import `GROOVES` from the feature, which lint zone 4 forbids under `src/lib/`. Where do those assertions live?** *(the question Cycle 1's Q3 referred forward to)*
Decision: **A) Split by subject** — corpus cases move to
`src/features/daily-groove/data/grooves.generated.test.ts`, pool uses become
`FLAVOURS.map(displayFlavour)` pinned by a new case, fixture uses get a local
`Groove` literal, and `music.test.ts` splits. The reason is that the file the
corpus cases move to already imports five theory modules to check the manifest
against them, so each arrival joins assertions with the same subject —
`docs/testing.md`'s test for a relocated assertion.
Changed: Architecture (*Where the catalogue-corpus assertions go*, rewritten as
settled design with the AC1 consequence stated), Contract C9 (now a case-by-case
disposition with the fourteen moving declarations, the six pool substitutions,
the two retitled describes, the eleven fixture rewrites and the five source
scans that stay), Step C5 (gains the AC1 grading procedure), Step C6 (the
fourteen arrivals in order, with their target describes), Step C7 (the six pool
substitutions by binding name, and the two describe retitles), Step C9
(rewritten and renamed — `music.test.ts`'s split, the two shared literals, the
eleven fixture cases). Invalidated: nothing; no step was removed, and the
options B, C and D reasoning is retired with the question.
Also changed: **the PRD's AC1**, which no longer holds literally. It now grades
on the thirteen module files and their thirteen test files rather than on every
assertion inside them, and names where the catalogue-corpus cases went. That is
the only edit made to the PRD.
