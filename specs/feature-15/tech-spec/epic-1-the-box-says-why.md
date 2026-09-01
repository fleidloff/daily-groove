# Tech spec — Epic 1: The box says why it is that mode

PRD: [../prd/epic-1-the-box-says-why.md](../prd/epic-1-the-box-says-why.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four tracks behind two frozen signatures. `scaleDegrees` is arithmetic over
`FLAVOUR_INTERVALS` and `characterOf` is a lookup in a written table — different
modules, different files, different owners, and neither knows the panel exists.
`SolvedPanel` consumes both and loses its score line in the same edit, because
the score and the lesson are the same line of JSX. Ahead of all of it sits a
mechanical relocation: `SolvedPanel` and the two drawings it composes move into
their own component region, `components/solved/`, which every later epic in this
feature then writes against.

**Wave 0 is a prerequisite for the whole feature, not just this epic.** Epic 3
edits `LeadSheet.tsx`, and Epic 3 runs in the same wave as Epic 1. If the file
moves under it, the two collide. So Step A0 lands first, alone, and every other
spec in this feature quotes post-move paths.

## Architecture

`components/solved/` becomes the feature's fourth screen region, beside
`header/`, `intro/` and `puzzle/`:

```
src/features/daily-groove/components/
├── GroovePuzzle.tsx          imports './solved/SolvedPanel'
├── header/  intro/  puzzle/
└── solved/
    ├── SolvedPanel.tsx  + .test.tsx
    ├── LeadSheet.tsx    + .test.tsx
    └── ScaleStaff.tsx   + .test.tsx
```

The region is a folder, not a feature slice. `eslint.config.mjs` derives one
`import/no-restricted-paths` zone pair per directory in `src/features/`, and the
second of each pair says no feature may import another *even through its
index.ts* — so a real `src/features/solved-panel/` could not be rendered by
`GroovePuzzle` at all, and Epic 5's placement between the two cards would be
unreachable. Inside a slice, files import each other freely, which is what makes
a region legal and a sibling slice not.

Logic stays in `lib/theory/`. That folder already exists, so
`structure.test.ts`'s "contains exactly the six concern folders" is untouched;
the region move does trip two of its component assertions, and Step A0 updates
them deliberately.

The two new modules differ in how they fail, and the difference is the PRD's:

- `scaleDegrees` throws `UnknownFlavourError` on a flavour it cannot name, like
  its neighbour `scaleNotes` (R10c).
- `characterOf` returns `undefined`, and the panel renders without the line
  (R3a). `changes.ts` set that precedent — "four blank bars beat the day's
  payoff crashing" — and the manifest-derived test is what stops the gap
  shipping.

## Contracts

```ts
// src/features/daily-groove/lib/theory/degrees.ts
import type { Answer } from '../../types'

/**
 * The scale's degrees, ascending from the root, one per note:
 * Mixolydian → ['1','2','3','4','5','6','♭7']; blues → ['1','♭3','4','♭5','5','♭7'].
 * Same length and order as `scaleNotes(answer)`. Throws UnknownFlavourError.
 */
export function scaleDegrees(answer: Answer): string[]
```

```ts
// src/features/daily-groove/lib/theory/character.ts
import type { Flavour } from '../../types'

export type ModeCharacter = {
  /** The degrees that separate this mode from its family's plain scale. */
  degrees: string[]
  /** One clause, e.g. 'major with a ♭7 — that’s the note doing it'. */
  line: string
}

/** undefined for a mode with no entry: the panel then renders no line. */
export function characterOf(flavour: Flavour): ModeCharacter | undefined
```

```ts
// src/features/daily-groove/components/solved/SolvedPanel.tsx
type SolvedPanelProps = {
  answer: Answer
  progression: string
  revealed: boolean
  // `tries` and `streak` are gone (R5).
}
```

## Tracks

### Track A — The solved region

- **Goal** — `SolvedPanel`, `LeadSheet` and `ScaleStaff` live in
  `components/solved/` with their tests, `GroovePuzzle` imports the new path,
  and the structure test asserts four regions.
- **Owns** — `src/features/daily-groove/components/solved/**`,
  `components/puzzle/{SolvedPanel,LeadSheet,ScaleStaff}.{tsx,test.tsx}`
  (deletions), `components/GroovePuzzle.tsx` (one import line),
  `src/features/daily-groove/structure.test.ts`
- **Role** — `implementer`
- **Depends on** — nothing
- **Parallel with** — nothing. **It runs alone, before Tracks B–D and before
  Epic 3.**
- **Done when** — `npm test` and `npm run lint` are green with no file left in
  `puzzle/` that belongs to the box.

### Track B — Naming the degrees

- **Goal** — `scaleDegrees` returns the right labels for every flavour the
  catalogue can play.
- **Owns** — `lib/theory/degrees.ts`, `lib/theory/degrees.test.ts`
- **Role** — `implementer`
- **Depends on** — the `scaleDegrees` contract only
- **Parallel with** — Track C, Track D
- **Done when** — its own tests pass; nothing else needs to exist.

### Track C — What makes a mode itself

- **Goal** — a table covering every playable mode, a `characterOf` lookup, and
  the tests that keep both honest.
- **Owns** — `lib/theory/character.ts`, `lib/theory/character.test.ts`
- **Role** — `implementer`
- **Depends on** — the `ModeCharacter` contract only
- **Parallel with** — Track B, Track D
- **Done when** — the manifest-derived totality test passes.

### Track D — The box reads as a lesson

- **Goal** — the panel shows the character line and carries no score.
- **Owns** — `components/solved/SolvedPanel.tsx` and its test,
  `components/GroovePuzzle.tsx` (props at the call site),
  `components/GroovePuzzle.page.test.tsx`
- **Role** — `implementer`
- **Depends on** — both contracts; builds against them while B and C implement
- **Parallel with** — Track B, Track C
- **Done when** — the panel's tests pass with the two modules stubbed or real.

## Execution waves

- **Wave 0:** Track A — alone. Nothing else in the feature starts until it
  lands.
- **Wave 1 (parallel):** Track B, Track C, Track D
- **Wave 2:** Integration

## Implementation

### Track A — The solved region

#### Step A0 — The box and its drawings move to their own region

Covers: the folder-structure requirement carried into this epic (no PRD R —
it is a structural change requested for the feature as a whole)

- **Test first** — `src/features/daily-groove/structure.test.ts`: change
  `REGIONS` so `puzzle` no longer lists `SolvedPanel`, `LeadSheet` or
  `ScaleStaff`, add `solved: ['SolvedPanel', 'LeadSheet', 'ScaleStaff']`, and
  change the region-directory assertion to
  `expect(dirs).toEqual(['header', 'intro', 'puzzle', 'solved'])`. Run it: fails
  three ways — `contains exactly the three region directories` (got
  `['header','intro','puzzle']`, wanted four), `places every other component in
  its region beside its own test` (six missing `solved/…` paths), and
  `names every component that exists in a region directory` (three undeclared
  `puzzle/…`).
- **Implement** — `git mv` the six files into
  `src/features/daily-groove/components/solved/`. Fix exactly two import lines:
  `GroovePuzzle.tsx`'s `'./puzzle/SolvedPanel'` → `'./solved/SolvedPanel'`, and
  nothing else — `SolvedPanel` reaches `LeadSheet` and `ScaleStaff` by relative
  sibling path, which the move preserves. The comment in
  `components/puzzle/PlayTodayLink.tsx` that mentions `SolvedPanel` gains the new
  location; `src/app/groove/not-found.test.tsx` and
  `src/features/daily-groove/index.test.ts` reference it only by name and need no
  edit.
- **Green when** — all three structure assertions pass, `npm test` is green, and
  `npm run lint` reports no `import/no-restricted-paths` error.
- **Refactor** — none. This step changes no behaviour: no component gains or
  loses a prop, and no test assertion about rendering is touched.

### Track B — Naming the degrees

#### Step B1 — A seven-note mode names its degrees

Covers: R10, R10a, R10b, AC6

- **Test first** — `lib/theory/degrees.test.ts`: assert
  `scaleDegrees({ root: 'C', flavour: 'Mixolydian' })` equals
  `['1','2','3','4','5','6','♭7']`, and that Dorian gives
  `['1','2','♭3','4','5','6','♭7']`. Run it: fails with "scaleDegrees is not a
  function".
- **Implement** — `lib/theory/degrees.ts`: map `FLAVOUR_INTERVALS[flavour]` to a
  label per interval. The degree number is the index + 1 for a seven-note scale;
  the accidental is the signed difference between the interval and the major
  scale's interval for that degree (`[0,2,4,5,7,9,11]`), rendered `♭`, `♭♭`, `♯`
  or empty.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B2 — The blues scale names six degrees, not seven

Covers: R10a, R10b, AC6

- **Test first** — same file: assert `scaleDegrees({ root: 'C', flavour: 'Blues' })`
  equals `['1','♭3','4','♭5','5','♭7']`, and that its length matches
  `scaleNotes({ root: 'C', flavour: 'Blues' }).length`. Run it: fails — Step B1's
  index-based degree number gives `['1','♭2','♭3','♭4','4','♭6']` for a scale
  whose degrees are not consecutive.
- **Implement** — take the degree *number* from `FLAVOUR_LETTER_STEPS[flavour]`
  where the flavour declares one, and from the index otherwise:
  `number = (FLAVOUR_LETTER_STEPS[flavour]?.[i] ?? i) + 1`. Blues declares
  `[0,2,3,4,4,6]`, so its numbers are `1 3 4 5 5 7` and its fourth degree reads
  `♭5` rather than `♭4`. The accidental rule from Step B1 is unchanged: the signed
  distance from `[0,2,4,5,7,9,11]` at that same degree number.
  **Do not derive the number from the interval** — "the nearest major-scale degree
  at or below the interval" looks equivalent and is not: it turns Mixolydian's 10
  semitones into `♯6` instead of `♭7`, breaking Step B1 and the frozen contract
  Epics 2, 3 and 4 read.
- **Green when** — both assertions pass and Step B1's stay green.
- **Refactor** — none.

#### Step B3 — Every playable flavour is namable

Covers: R10a, AC6

- **Test first** — same file: iterate `Object.keys(FLAVOUR_INTERVALS)` and assert
  each one returns labels whose count equals `scaleNotes`' for the same answer,
  with `'1'` first. Run it: passes or fails per flavour; a failure names the
  flavour.
- **Implement** — fix whichever table entry the assertion names.
- **Green when** — all fourteen flavours pass.
- **Refactor** — none.

#### Step B4 — An unknown flavour throws

Covers: R10c, AC7

- **Test first** — same file: assert `scaleDegrees({ root: 'C', flavour: 'Klingon' })`
  throws `UnknownFlavourError`. Run it: fails — it returns `[]` or `undefined`.
- **Implement** — throw `UnknownFlavourError` when the lookup misses, importing
  the existing class from `notes.ts` rather than declaring a second one.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track C — What makes a mode itself

#### Step C1 — One mode has a line

Covers: R1, R2, R2a, AC1

- **Test first** — `lib/theory/character.test.ts`: assert
  `characterOf('Mixolydian')` returns `{ degrees: ['♭7'], line: <a string
  containing '♭7'> }`. Run it: fails with "characterOf is not a function".
- **Implement** — `lib/theory/character.ts`: a `Record<Flavour, ModeCharacter>`
  with the Mixolydian entry and a `characterOf` that looks up case-insensitively,
  the way `notes.ts`'s `lookup` already does.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C2 — Every mode the catalogue can play has one

Covers: R3, AC4

- **Test first** — same file: derive the mode list from the shipped manifest —
  `[...new Set(GROOVES.map((g) => g.flavour))]`, the way `families.test.ts`
  derives its own — and assert `characterOf` returns a defined entry for each.
  Run it: fails, naming every mode still missing from the table.
- **Implement** — write the remaining entries. Twelve lines of prose; each names
  its degrees and reads as one clause with no sentence break.
- **Green when** — no mode in the manifest is missing.
- **Refactor** — none. Do not replace the manifest-derived list with a hardcoded
  one; that is the failure mode this test exists to prevent.

#### Step C3 — A line names every degree that differs, not just one

Covers: R2b, R2c, AC12

- **Test first** — same file: for every entry, compute the differing degrees
  from first principles — `FLAVOUR_INTERVALS[flavour]` against
  `FLAVOUR_INTERVALS['Ionian']` or `['Aeolian']`, chosen by `familyOf(flavour)` —
  and assert the entry's `degrees` equals that set, and that every one of them
  appears in `line`. Run it: fails for any entry naming one of two differing
  degrees, e.g. lydian dominant with `['♭7']` where `['♯4','♭7']` is the truth.
- **Implement** — correct those entries' `degrees` and rewrite their `line` to
  name both, e.g. "major with a ♯4 and a ♭7".
- **Green when** — every entry agrees with the interval arithmetic.
- **Refactor** — the from-first-principles computation stays in the test. It is
  the oracle; moving it into the source would make the table assert itself.

#### Step C4 — The blues scale is not called a mode, and no line is a paragraph

Covers: R2a, R4, AC5, AC13

- **Test first** — same file: assert the `Blues` entry's `line` contains `'♭5'`
  and does not contain the word `'mode'`; assert no entry's `line` matches
  `/[.!?]\s/` or exceeds 72 characters. Run it: fails on whichever entry breaks
  either rule.
- **Implement** — rewrite those lines.
- **Green when** — both assertions pass for all entries.
- **Refactor** — none. 72 characters is the testable proxy for R9's two-line
  ceiling at 360px; the visual check is in the demo path, because jsdom cannot
  measure a wrap.

### Track D — The box reads as a lesson

#### Step D1 — The box says why

Covers: R1, R2, AC1

- **Test first** — `components/solved/SolvedPanel.test.tsx`: render with
  `answer: { root: 'C', flavour: 'Mixolydian' }` and assert the panel shows both
  `C Mixolydian` and text containing `♭7`. Run it: fails — no such text.
- **Implement** — `SolvedPanel.tsx`: call `characterOf(answer.flavour)` and
  render `line` in the `Text` beside the heading, keeping `tone="inverted-muted"`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step D2 — The score leaves the box

Covers: R5, R5a, R5b, AC2

- **Test first** — same file: render a solved day and assert the panel's text
  matches neither `/tr(y|ies)/i` nor `/streak/i`. Then delete the `tries` and
  `streak` props from every render in the file. Run it: fails on the surviving
  subline, and TypeScript fails on the removed props.
- **Implement** — drop `tries` and `streak` from `SolvedPanelProps`, delete
  `triesLabel`, and remove both arguments at the `GroovePuzzle.tsx` call site.
- **Green when** — the assertion passes, `tsc` is clean, and no dead helper
  remains.
- **Refactor** — the `Row` holding heading and subline stays; only its second
  child's content changed.

#### Step D3 — A day given up on gets the same line

Covers: R7, R7a, AC3

- **Test first** — same file: render with `revealed: true` and assert the same
  `♭7` text is present, and that `given up` still appears. Run it: passes if D1
  was written unconditionally — which is the point; the assertion pins it against
  a later branch.
- **Implement** — nothing, if the line is already unconditional. If a branch
  crept in, remove it.
- **Green when** — both `revealed` states show the line.
- **Refactor** — if `revealed` now drives only the one phrase, note that in the
  prop's doc comment. Do not remove the prop in this epic.

#### Step D4 — A mode with no line does not break the day

Covers: R3a, AC8

- **Test first** — same file: render with `flavour: 'Klingon'` and assert the
  panel renders the heading and does not throw. Run it: fails — `scaleNotes`
  throws first, from the existing `notes` call.
- **Implement** — guard the panel's own derivation: where `characterOf` returns
  `undefined`, render no line. The `scaleNotes` throw is out of scope here — it
  is the staff's data, not the character line's — so the test uses a flavour that
  `FLAVOUR_INTERVALS` knows and `character.ts` does not, which is the real
  shape of the risk.
- **Green when** — the panel renders without the line and without throwing.
- **Refactor** — none.

#### Step D5 — One status region, and the score still lives elsewhere

Covers: R6, R8, AC9, AC11

- **Test first** — `components/GroovePuzzle.page.test.tsx`: on a solved day
  assert exactly one `role="status"` inside the panel, that the streak pill still
  shows the streak, and that the dot row's accessible name still reads `Solved`.
  Run it: the status assertion passes; the other two fail only if D2 removed the
  wrong thing.
- **Implement** — nothing expected. If the streak assertion fails, the header's
  props were disturbed and must be restored.
- **Green when** — all three pass.
- **Refactor** — none.

## Integration and verification

- **Step I1** — run the whole suite plus `npm run lint`, `npx tsc --noEmit` and
  `npm run build`. Lint is the one that would catch a region move done wrong.
- **Demo path** — solve today's puzzle: the box names the answer and says what
  makes the mode, with no tries or streak anywhere in it; the streak pill and the
  dots still carry the score. Give up on a shared groove and read the same line.
  At 360px, confirm by eye that the line wraps to at most two lines — the part
  no test can assert.
- **Coverage** — the table below; every R and AC has a step.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, D1 |
| R2 | C1, D1 |
| R2a | C1, C4 |
| R2b, R2c | C3 |
| R3 | C2 |
| R3a | D4 |
| R4 | C4 |
| R5, R5a, R5b | D2 |
| R6 | D5 |
| R7, R7a | D3 |
| R8 | D5 |
| R9 | C4 (proxy), demo path (visual) |
| R10, R10a, R10b | B1, B2, B3 |
| R10c | B4 |
| AC1 | D1 |
| AC2 | D2 |
| AC3 | D3 |
| AC4 | C2 |
| AC5 | C4 |
| AC6 | B1, B2, B3 |
| AC7 | B4 |
| AC8 | D4 |
| AC9 | D5 |
| AC10 | C4, demo path |
| AC11 | D5 |
| AC12 | C3 |
| AC13 | C4 |

## Assumptions

- The region is named `solved`, matching the other three regions' single-word
  lowercase names.
- `degrees.ts` and `character.ts` are separate modules. Epic 4 needs the first
  and not the second, and one file exporting both would make the near-miss line
  depend on twelve lines of prose it never reads.
- The character line reuses `Text` with `tone="inverted-muted"`, the tone the
  score used. No new typography prop.
- 72 characters is the line-length ceiling. It is a proxy, chosen so the longest
  line fits two rows at 360px in the panel's current type size.
