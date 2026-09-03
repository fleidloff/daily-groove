# Tech spec — Epic 1: Nothing counts your tries

PRD: [../prd/epic-1-nothing-counts-your-tries.md](../prd/epic-1-nothing-counts-your-tries.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This epic is a deletion, a pin and a guard, and only the last of the three is
new code.

The deletion is a chain, not a set: `feedback.ts` exports `DotState` →
`AttemptDots` renders it → `GuessCard` takes it as a `dots` prop → `GroovePuzzle`
derives it → the test harness reads `[data-dot-state]` back out of the DOM →
four composed test files assert on that reading. Cutting any one link breaks the
type check for the next, so the whole chain is **one track with ordered steps**,
not four parallel ones. Fifty-one lines across five test files mention the dots;
each of those assertions has a subject other than the dots — "the miss was
recorded", "nothing was recorded", "three misses reached", "the day is solved",
"this action changed nothing" — and *Contracts* C6 gives the substitution for
each shape, because [docs/testing.md](../../../docs/testing.md) says a relocated
assertion keeps its subject and a deleted one keeps nothing.

The pin is `lib/persistence/streak.ts`. R4–R6 were expected to hold already, and
five of the six cases do. **AC6 does not**: `computeStreak` shifts its anchor to
yesterday whenever today does not qualify, so a solved run met by a given-up
today reads as the run's length rather than 0. That grace is right for a day
still in progress and wrong for a day the player has ended, so the anchor rule
gains one clause — a `revealed` today anchors on today — and two existing cases
in `streak.test.ts` invert. See *Architecture* and the Decision log; it is the
one behaviour change in the epic and the thing to review first.

The guard is a new composed-page test that walks the page through fresh,
mid-guess, solved and revealed, collects the visible text and every accessible
name out of the rendered tree, and fails on `attempt`, `par` or a number of
tries. It asserts on rendered output rather than scanning source, per the PRD's
Q2, so it catches a count however it arrives — and its own sensitivity is
asserted by feeding it the retired dot label.

## Architecture

### What leaves, in dependency order

```
lib/presentation/feedback.ts        DotState, DOT_COUNT, dotStates   ✂
        │                            (REVEAL_AFTER_MISSES stays, same name)
        ▼
components/puzzle/AttemptDots.tsx   the whole component + its test    ✂
        │
        ▼
components/puzzle/GuessCard.tsx     the dots prop, the import,        ✂
        │                           <div className="flex justify-end">
        ▼
components/GroovePuzzle.tsx         the dotStates import, the         ✂
        │                           useMemo, dots={dots}
        ▼
testing/puzzleHarness.tsx           the dotStates() query helper      ✂
        │
        ▼
GroovePuzzle.{page,guessing,header}.test.tsx    51 assertion lines    ↻
GuessCard.test.tsx                              5 whole cases         ✂
structure.test.ts                               'AttemptDots'         ✂
docs/coding-guidelines.md                       two mentions          ✂
```

Nothing takes the row's place. The `<div className="flex justify-end">` wrapper
goes with its child, so the `Stack gap="lg"` inside `Card` closes up and the
card is shorter by one row and one gap — that is R2, and it is why the wrapper
must go rather than being left empty.

### The streak rule, and the one clause that changes

`isQualifying` is `r.solved` and stays exactly that: R5's rule is "solved days
only", and the `revealed` flag is a UI and future-stats distinction that the
qualifying test must not read. What changes is the **anchor** — where the walk
back starts.

Today, the anchor is today when today qualifies, and yesterday otherwise. The
"otherwise" covers two very different days:

| Today's stored result | Is the day over? | Anchor today should | Code does |
| :-- | :-- | :-- | :-- |
| `solved: true` | yes, won | count today | counts today ✔ |
| absent | no, not opened yet | show yesterday's run | shows it ✔ |
| `solved: false`, no `revealed` | no, still playable | show yesterday's run | shows it ✔ |
| `solved: false`, `revealed: true` | **yes, ended by the player** | **read 0** | shows the run ✘ |

The fourth row is AC6. Giving up is the player pressing a button whose second
label is *"Yes — end the day and show the answer"*: the day is over, it ended
unsolved, and R5 says a day that ends unsolved ends the streak. So the anchor
clause becomes "today, when today's result exists and the day is over" — over
meaning `solved || revealed === true` — and the walk then breaks on today
because `isQualifying` is still `solved` alone.

Rows two and three keep the grace deliberately, and Step B6 pins them: a day
nobody has finished yet must not blank the badge, or every player's streak reads
0 each morning until they solve. R5's "never opened" and "left unfinished" are
about days that have *passed*, which is what the PRD's Behaviour details table
says with "day passed"; the walk already breaks on them the next day.

No component changes for this. `useProgress` already folds the new record into
`all` on every `recordAttempt` and recomputes `computeStreak` in a `useMemo`, and
`reveal()` persists through the same path — so the badge re-reads the new number
on the render that shows the answer, which is exactly R7's "the badge simply
reads the new number the next time it renders". Nothing announces it.

### Where the guard lives, and why it renders the page

R8's guard must see every player-facing string in the states it can reach, which
rules out both a unit test of one module and a source scan. It goes in a new
composed-page test file beside the five that already exist:

```
components/GroovePuzzle.copy.test.tsx     the four states, read and matched
```

Two halves, both in that file. `readablePage()` collects `document.body
.textContent` plus every labelling attribute off every element in the tree —
`aria-label`, `title`, `alt`, `aria-description`, `aria-roledescription`,
`aria-valuetext`, `aria-placeholder`, `placeholder` — which is what makes
"screen-reader label or tooltip" (R1) reachable by an assertion.
`offendingCopy(strings)` matches them against C5's pattern list and returns what
it hit, so a failure names the copy instead of just failing.

The reader stays local to that file rather than joining `puzzleHarness.tsx`: it
has one consumer, and putting it in the harness would make a third file
sequenced between two tracks for no gain.

### What must not move

- `REVEAL_AFTER_MISSES = 3` in `feedback.ts`, its name and its value. `missCount`
  and `shouldOfferReveal` are untouched: Give up still appears on the third miss
  (R9, AC11).
- `Attempt` and `DailyResult` in `types.ts`, field for field. The stored attempt
  list is the thing the briefing said to keep, and C4 freezes it.
- `selectCoaching` and the coaching ladder, which is keyed to miss count and
  states no number.
- `shouldShowNudge` and the narrowing nudge at two misses.
- The feature's `index.ts`. Nothing dot-shaped was ever exported from it, so the
  slice's public surface does not move and the removability check is unaffected.

## Contracts

Frozen before any track starts. C1, C2 and C3 are the three that two tracks
would otherwise disagree about.

### C1 — `lib/presentation/feedback.ts`, after

The module's runtime exports are exactly these four, in this order, and
`feedback.test.ts` asserts the list:

```ts
export function missCount(attempts: Attempt[]): number
export function selectFeedback(attempts: Attempt[], solved: boolean): Feedback
export function shouldShowNudge(
  eliminatedCount: number,
  solved: boolean,
  rootConfirmed: boolean,
): boolean
export function shouldOfferReveal(
  attempts: Attempt[],
  solved: boolean,
  revealed: boolean,
): boolean
```

Type exports `FeedbackTone` and `Feedback` stay (they are `export type`, so they
do not appear in the runtime key list). Module-private `REVEAL_AFTER_MISSES = 3`
stays under that name. **Gone:** `DotState`, `DOT_COUNT`, `dotStates`.

### C2 — `GuessCardProps`, after

Identical to today minus one line. `dots: DotState[]` is removed; every other
prop keeps its name, its type and its position, and the `DotState` import goes
with it:

```ts
import type { Feedback } from '../../lib/presentation/feedback'
// …
  showNudge: boolean
  ruledOutRoots: Root[]      // showNudge was followed by `dots`; it now runs
  ruledOutFlavours: Flavour[] // straight into ruledOutRoots
```

This is the contract change the PRD's *Dependencies* names, and any later work
on the card builds against it.

### C3 — `lib/persistence/streak.ts`, after

```ts
export function isQualifying(r: DailyResult): boolean  // r.solved — unchanged
export function computeStreak(results: DailyResult[], today: string): number
```

`computeStreak`'s rule, in full:

1. Index `results` by date.
2. The day is **over** when a result exists for it and `result.solved ||
   result.revealed === true`.
3. `anchor` = `today` when today is over, else the calendar day before today.
4. Walk back from the anchor one calendar day at a time, adding 1 per day whose
   result exists and satisfies `isQualifying`; stop at the first that does not.

`results` is not mutated. The new helper is module-private and named `isOver`.

### C4 — the stored shapes, frozen

Unchanged, and asserted field-for-field by Step C3:

```ts
// src/features/daily-groove/types.ts
export type Attempt = {
  root: Root
  flavour: Flavour
  correct: boolean
  rootMatched: boolean
  flavourMatched: boolean
}

export type DailyResult = {
  date: string
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  grooveId?: string
  revealed?: boolean
}
```

### C5 — the banned-copy patterns

Local to `GroovePuzzle.copy.test.tsx`:

```ts
const BANNED: readonly RegExp[] = [
  /attempts?\b/i,
  /\bpar\b/i,
  /\b\d+\s+(?:tries|guesses|goes)\b/i,
  /\b(?:one|two|three|four|five|six|seven)\s+(?:tries|guesses)\b/i,
]
```

The first three are the PRD's starting list. The fourth extends it to the
spelled-out form, which costs nothing and closes the obvious way back in
("three guesses left"). `\bpar\b` cannot fire on *apart*, *part* or *compare*;
`\d+\s+(?:tries|guesses)` cannot fire on the nudge's "N roots ruled out" or the
transport's pass counter, which is why "of" and bare digits are not banned.

### C6 — the substitution table for a deleted dot assertion

Every `dotStates()` call site in the four composed test files and
`GuessCard.test.tsx` falls into one of five shapes. This is the rule Track A
applies; it is a contract because it decides what coverage the epic keeps.

| The dots were standing in for | Replace with |
| :-- | :-- |
| a miss was recorded | `mockStore.save.mock.calls.at(-1)?.[0].attempts` — its length, or the attempt itself |
| nothing was recorded | `expect(mockStore.save).not.toHaveBeenCalled()` plus `control()`'s accessible name |
| a stored day was restored mid-game | the restored `nudgeLine()` / `coachingLine()` already asserted beside it, plus the next save's `attempts` length |
| the third miss was reached | `expect(giveUp()).toHaveAccessibleName('Give up and show the answer')` |
| the day is solved | `expect(control()).toHaveAccessibleName('Solved')` |
| this action changed nothing | drop the `dots:` key from the snapshot object; the other keys carry the subject |

Two assertions are *not* substitutions and simply go: `screen.getByRole('img',
{ name: 'Solved' })` at `GroovePuzzle.guessing.test.tsx:632` and
`GroovePuzzle.page.test.tsx:261` name the dot row's solved label, not the lead
sheet, and there is nothing left for them to find.

## Tracks

### Track A — The dots leave the card

- **Goal** — no `[data-dot-state]` element and no dot-derived value exists
  anywhere in the tree or the suite; `feedback.ts` matches C1, `GuessCardProps`
  matches C2; `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`
  are clean.
- **Owns** —
  `src/features/daily-groove/components/puzzle/AttemptDots.tsx` (deleted),
  `src/features/daily-groove/components/puzzle/AttemptDots.test.tsx` (deleted),
  `src/features/daily-groove/components/puzzle/GuessCard.tsx`,
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.page.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.header.test.tsx`,
  `src/features/daily-groove/lib/presentation/feedback.ts`,
  `src/features/daily-groove/lib/presentation/feedback.test.ts`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`,
  `src/features/daily-groove/structure.test.ts`,
  `docs/coding-guidelines.md`
- **Role** — `implementer`
- **Depends on** — C1, C2, C6. Nothing else in the epic.
- **Parallel with** — Track B, Track C
- **Done when** — its steps pass, the four checks are clean, and
  `grep -rn "data-dot-state\|dotStates\|DotState\|AttemptDots" src docs` returns
  nothing.

**Why this is one track and not four.** `GuessCard.tsx` and
`GuessCard.test.tsx` cannot be split — a `vi.mock` of `./AttemptDots` would be a
mock of an internal path, which `docs/testing.md` rules out. `GroovePuzzle.tsx`
and the three composed test files cannot be split from `GuessCard.tsx` either:
the moment C2 lands, the page fails to type-check and all four test files fail
together. Handing them to separate agents in one wave would give each a red
suite it cannot make green alone.

### Track B — The streak counts solves, and only solves

- **Goal** — R4–R6 are pinned case by case, AC6's missing case is fixed, and the
  grace for a day still in progress is pinned so the fix cannot swallow it.
- **Owns** —
  `src/features/daily-groove/lib/persistence/streak.ts`,
  `src/features/daily-groove/lib/persistence/streak.test.ts`
- **Role** — `implementer` — it is mostly pinning tests, but AC6 needs a source
  change, which is past `test-writer`'s remit.
- **Depends on** — C3, C4. No file it touches appears in another track.
- **Parallel with** — Track A, Track C
- **Done when** — its cases pass, the 24 pre-existing cases in the file pass
  with exactly the two rewrites Step B2 names, and `npm test` is green.

### Track C — The attempts keep round-tripping

- **Goal** — a five-attempt day survives a reload through real `localStorage`
  in order with its original flags, a solve on the seventh guess reads as solved
  and moves the streak, and the stored shapes are asserted field for field.
- **Owns** —
  `src/features/daily-groove/hooks/useProgress.integration.test.ts`
- **Role** — `test-writer` — R3 and C4 already hold; this track writes
  assertions and no source.
- **Depends on** — C3's anchor rule for Step C2's streak number, and C4.
  Runs against the real `createLocalStore`, as that file already does.
- **Parallel with** — Track A, Track B
- **Done when** — its three cases pass alongside the file's four existing ones.

### Track D — Nothing on the page counts your tries

- **Goal** — the copy sweep is done and recorded; a guard walks the rendered
  page through fresh, mid-guess, solved and revealed and fails on a count
  wherever it arrives; the guard's own sensitivity is asserted; the badge is
  shown recomputing after a give-up.
- **Owns** —
  `src/features/daily-groove/components/GroovePuzzle.copy.test.tsx` (new),
  and, **sequenced after Track A**,
  `src/features/daily-groove/structure.test.ts` (one line in `composedTests`),
  `src/features/daily-groove/components/GroovePuzzle.header.test.tsx` (one new
  case)
- **Role** — `implementer` — the sweep may turn up a string to rewrite, and
  rewriting player-facing copy is not `test-writer`'s job. If Step D1 finds
  nothing to rewrite, as expected, the track writes only tests.
- **Depends on** — Track A landed (the guard is red on the fresh state while the
  dot label exists) and Track B landed (Step D7's badge reads 0 only after C3).
- **Parallel with** — nothing.
- **Done when** — its cases pass, `structure.test.ts` names the new file, and
  `npm test` is green.

**The two files Track D shares with Track A** are shared across waves, not
within one: A finishes with them, then D adds to them. `structure.test.ts` gets
`'AttemptDots'` removed by A (Step A3) and the new test filename added by D
(Step D6); `GroovePuzzle.header.test.tsx` gets its two dot assertions removed by
A (Step A7) and one case added by D (Step D7). No two tracks in the same wave
write the same path.

### Track E — Verification

- **Goal** — every R and AC is traced to a passing case, and the demo path is
  walked by hand.
- **Owns** — nothing. It writes no source and no test.
- **Role** — `verifier`
- **Depends on** — Tracks A–D.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` are clean, the coverage table below is confirmed, and the
  demo has been walked.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C — three disjoint file sets.
  A is much the largest; B and C will finish long before it.
- **Wave 2:** Track D — needs A for the fresh state to be clean and B for the
  badge to read 0, and takes over the two files A finishes with.
- **Wave 3:** Track E — the checks, the trace and the demo.

**One scheduling note for the lead.** There is no honest way to make Wave 1
wider. The epic is a deletion down a five-link chain plus a copy sweep over the
same two files the deletion edits, which is exactly what the roadmap said when
it merged the two epics into one. Tracks B and C exist as separate tracks only
because their files genuinely do not collide — splitting Track A further would
hand two agents the same broken type check.

## Implementation

### Track A — The dots leave the card

Baseline before the first edit: `npm test` is green at **114 files, 2312 tests**.
Roughly 25 cases leave in this track (12 in `AttemptDots.test.tsx`, 8 in
`feedback.test.ts`'s `dotStates` describe, 5 in `GuessCard.test.tsx`) and 2
arrive. The exact final count is not the check — a green suite with no
`[data-dot-state]` left in the tree is.

#### Step A1 — The card renders no dot row

Covers: R1, R2, AC1

- **Test first** — `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`:
  delete the five dot-only cases at lines 246 (`renders the attempt dots it is
  given`), 255 (`renders exactly the dot states it is handed`), 748 (`puts the
  attempt dots directly above the check button…`), 771 and 781 (the two
  `REGRESSION GUARD` cases), and add one in their place:

  ```ts
  it('renders no count of the player’s guesses (F20 E1 R1, R2, AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(document.querySelectorAll('[data-dot-state]')).toHaveLength(0)
    expect(screen.queryByRole('img')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' })
        .previousElementSibling,
    ).toBe(chipList(flavourGroup()).closest('fieldset'))
  })
  ```

  Run it: fails with `AssertionError: expected NodeList [ span, span, span ] to
  have length +0`.
- **Implement** — `GuessCard.tsx`: delete the `AttemptDots` import, drop
  `DotState` from the type import on line 5, remove `dots: DotState[]` from
  `GuessCardProps` and `dots` from the destructured parameter list, and delete
  the whole `<div className="flex justify-end">…</div>` block at line 170 — the
  wrapper as well as the child, so the `Stack` closes up (R2).
- **Green when** — the new case passes and the check button's previous sibling
  is the mode chip group's container. The third assertion is what proves the row
  and its spacing are gone rather than emptied; adjust the expected element to
  whatever `ChipGroup` actually renders as its outermost node, read from the DOM
  rather than guessed.
- **Refactor** — strip what the deletions orphan in the same file: the
  `DotState` type import (line 11), the `UNSPENT` constant (line 34), the local
  `dotStates` helper (lines 103–106), every `dots:` key in `props()` overrides
  and in the `it.each` tables (lines 336, 349, 841, 950, 1606, 1856), and the
  `dots:` keys in the three before/after snapshots (1285/1296, 1586/1598,
  1981/1992). Rename the case at line 1574 to *"leaves the line and the control
  untouched by mode taps"* — it keeps its subject, it just no longer has dots to
  watch. `npm run lint` is the check that nothing orphaned survives.

#### Step A2 — The page stops deriving what nothing renders

Covers: R1, R2

- **Test first** — none of its own; the red is the type check. Run
  `npx tsc --noEmit`: fails at `GroovePuzzle.tsx:298` with
  `Object literal may only specify known properties, and 'dots' does not exist
  in type 'GuessCardProps'`.
- **Implement** — `GroovePuzzle.tsx`: drop `dotStates` from the import block at
  lines 13–18, delete `const dots = useMemo(() => dotStates(attempts, solved),
  [attempts, solved])` at line 193, and delete `dots={dots}` from the
  `<GuessCard>` call at line 298.
- **Green when** — `npx tsc --noEmit` reports nothing for either file.
- **Refactor** — none. `selectFeedback`, `shouldOfferReveal` and
  `shouldShowNudge` keep their place in the same import block.

#### Step A3 — The component and its name are both gone

Covers: R2, AC12

- **Test first** — `src/features/daily-groove/structure.test.ts`: remove
  `'AttemptDots'` from the `puzzle` array in `REGIONS` (line 113). Run
  `npm test src/features/daily-groove/structure.test.ts`: fails with
  `AssertionError: expected [ 'puzzle/AttemptDots' ] to deeply equal []` from
  *names every component that exists in a region directory*.
- **Implement** — delete
  `src/features/daily-groove/components/puzzle/AttemptDots.tsx` and
  `src/features/daily-groove/components/puzzle/AttemptDots.test.tsx`.
- **Green when** — all four cases in *feature components sit in screen regions*
  pass: the region set is still the four directories, `AttemptDots` is neither
  declared nor present, and every remaining name still has both its `.tsx` and
  its `.test.tsx`. That last one is AC12.
- **Refactor** — none.

#### Step A4 — `feedback.ts` exports nothing dot-shaped

Covers: R1

- **Test first** — `src/features/daily-groove/lib/presentation/feedback.test.ts`:
  add, at the top level of the file,

  ```ts
  it('exports no dot state, count or shape (F20 E1 R1)', async () => {
    const module = await import('./feedback')
    expect(Object.keys(module).sort()).toEqual([
      'missCount',
      'selectFeedback',
      'shouldOfferReveal',
      'shouldShowNudge',
    ])
  })
  ```

  Run it: fails with `AssertionError: expected [ 'dotStates', 'missCount', … ]
  to deeply equal [ 'missCount', 'selectFeedback', 'shouldOfferReveal',
  'shouldShowNudge' ]`.
- **Implement** — `feedback.ts`: delete `export type DotState`, `const
  DOT_COUNT = 3` and the whole `dotStates` function. Leave
  `REVEAL_AFTER_MISSES = 3` where it is, under that name — it is what
  `shouldOfferReveal` reads and the give-up threshold is out of scope.
- **Green when** — the export list matches C1 and the file's other 20-odd cases
  pass untouched.
- **Refactor** — delete the `describe('dotStates')` block (lines 154–201, 8
  cases) and any fixture in the file that block alone used; `npm run lint` names
  them. `misses()`, `NEITHER`, `ROOT_ONLY`, `FLAVOUR_ONLY` and `EXACT` are used
  by the surviving describes too — check before removing any of them.

#### Step A5 — The harness stops offering a dot reader

Covers: R1

- **Test first** — none of its own. Run `npm test`: the three composed files
  fail at import with
  `SyntaxError: The requested module '../testing/puzzleHarness' does not provide
  an export named 'dotStates'` once the helper is gone — which is the point of
  doing this before Step A6 rather than after.
- **Implement** — `src/features/daily-groove/testing/puzzleHarness.tsx`: delete
  the `dotStates` export at lines 162–165. Nothing else in the file changes.
- **Green when** — after Step A6. This step is deliberately red on its own.
- **Refactor** — none.

#### Step A6 — Every composed assertion keeps its subject

Covers: R1, R3, R9, AC2, AC11

- **Test first** — the failures Step A5 produced, file by file. Apply C6's table
  to each site, then run each file. The sites, so none is missed:
  - `GroovePuzzle.header.test.tsx` — the import, and lines 122 and 195. Both are
    "nothing was recorded" inside a share test: drop the line; the surrounding
    `mockStore.save` and `control()` assertions already carry it.
  - `GroovePuzzle.page.test.tsx` — the import, and lines 176, 197, 211, 261,
    296, 311, 485, 610, 637, 725, 730, 766, 904, 935, 947. Line 176 and 637 are
    "the loading branch renders no puzzle" — replace with the `radiogroup` query
    already beside them. 197/211 is *restores the attempts spent on a reload
    mid-game*: keep the case, keep its name minus "spent", and let the existing
    `mockStore.save.mock.calls[0][0].attempts` assertion carry the subject —
    that case is R3's page-level cover. 261 is the retired `img name: 'Solved'`;
    delete it. 904 and 935/947 are snapshot keys; drop the `dots:` key.
  - `GroovePuzzle.guessing.test.tsx` — the import, and lines 200, 211, 216, 399,
    416, 427, 473, 555, 598, 632, 754, 774, 787, 807, 843, 883, 923, 925, 983,
    1163, 1175, 1183, 1276, 1317, 1334, 1502, 1513. The three-miss sites (399,
    416, 427, 555, 598, 843, 883, 1334) become the `giveUp()` assertion; the
    solve sites (473, 807) become `control()`'s `'Solved'` name; 632 is the
    retired `img name: 'Solved'` and is deleted; 1163/1175 and 1502/1513 are
    snapshots, so drop the key.
  - Add one page-level positive, in `GroovePuzzle.guessing.test.tsx`:

    ```ts
    it('counts nothing on the card after two misses (F20 E1 R1, AC2)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())
      await guess(user, 'D', otherWrongFlavour())

      expect(document.querySelectorAll('[data-dot-state]')).toHaveLength(0)
      expect(nudgeLine()).toBeInTheDocument()
      expect(giveUp()).toBeNull()
    })
    ```

    Run it before Step A1 lands and it fails with `expected NodeList [ span,
    span, span ] to have length +0`; run it now and it passes, with the nudge
    and the still-absent give-up proving R9 in the same breath.
- **Implement** — no source. This step is the test sweep.
- **Green when** — all three files pass, and every case that was not about the
  dots still asserts what it asserted before. The two to check by name, because
  they are AC11: *offers the way out only from the third miss, and ends the day
  on the second press* (`guessing.test.tsx:507`) and the narrowing-nudge cases
  around lines 1265–1340.
- **Refactor** — none. Do not rename a case whose subject survived.

#### Step A7 — The guidelines stop naming a file that is gone

Covers: R2

- **Test first** — none; no test reads `docs/`. `scripts/agent-floor.test.ts`
  only checks that a rule cites *some* doc path, and `scripts/citations.test.ts`
  reads verification reports, not guidelines.
- **Implement** — `docs/coding-guidelines.md`: remove `` `AttemptDots`, `` from
  the puzzle-region component list (line 187), drop `attempt dots,` from the
  enumeration of relocated subjects (line ~399), and remove the
  `` `components/puzzle/AttemptDots.test.tsx`, `` entry from the list of files
  those assertions moved into (line ~404). Leave "Thirteen assertions" as it is:
  it counts what was in `src/app/page.test.tsx` at the time, and that is still
  true.
- **Green when** — `grep -rn "AttemptDots" docs` returns nothing.
- **Refactor** — none. Do not rewrite the surrounding rule; it is about
  colocation, not about the dots.

#### Step A8 — The track's own gate

Covers: R1, R2, R9

- **Test first** — `grep -rn "data-dot-state\|dotStates\|DotState\|DOT_COUNT\|AttemptDots\|attempts spent" src docs`.
  Expect no output.
- **Implement** — nothing. Fix what the greps and the checks name.
- **Green when** — `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` are all clean, and the suite's file count is 113 (one file
  deleted) with no failures.
- **Refactor** — none.

### Track B — The streak counts solves, and only solves

`streak.test.ts` already has `attempt()`, `result(date, solved, tries)` and the
`MON`–`FRI` constants; reuse them, and reuse the local `revealed(date)` helper
from the existing *a given-up day* describe rather than adding a second one.

**How a pinning step is red.** Steps B1, B3, B4 and B6 assert behaviour that
already holds, so they pass on their first run. Each one names the mutation that
makes it fail, and the builder is expected to apply that mutation, watch the red,
and revert it. A pin nobody has seen fail is a pin nobody has tested.

#### Step B1 — A solve is a solve on the seventh guess

Covers: R4, AC5

- **Test first** — `src/features/daily-groove/lib/persistence/streak.test.ts`,
  in the `isQualifying` describe and the anchor describe:

  ```ts
  it('qualifies a day solved on the seventh guess (F20 E1 R4, AC5)', () => {
    expect(isQualifying(result(FRI, true, 7))).toBe(true)
  })

  it('counts a seventh-guess solve as one more than yesterday (F20 E1 R4, AC5)', () => {
    expect(computeStreak([result(THU, true)], FRI)).toBe(1)
    expect(computeStreak([result(THU, true), result(FRI, true, 7)], FRI)).toBe(2)
  })
  ```

  Run it: passes. Its red: change `isQualifying` to
  `r.solved && r.attempts.length <= 3`, and it fails with `AssertionError:
  expected false to be true`. Revert.
- **Implement** — nothing. R4 holds.
- **Green when** — both cases pass and the two `isQualifying` cases already in
  the file still pass.
- **Refactor** — none.

#### Step B2 — A day given up on ends the streak the day it happens

Covers: R5, AC6

- **Test first** — same file, in the *a given-up day* describe:

  ```ts
  it('reads 0 when a run ending yesterday meets a day given up on (F20 E1 R5, AC6)', () => {
    const results = [result(WED, true), result(THU, true), revealed(FRI)]
    expect(computeStreak(results, FRI)).toBe(0)
  })
  ```

  Run it: fails with `AssertionError: expected 2 to be 0`.
- **Implement** — `streak.ts`: add the module-private predicate and use it for
  the anchor only.

  ```ts
  function isOver(r: DailyResult | undefined): boolean {
    return r !== undefined && (r.solved || r.revealed === true)
  }
  ```

  and replace the anchor line with
  `const anchor = isOver(byDate.get(today)) ? today : previousDay(today)`.
  `isQualifying` is not touched — the walk still breaks on today because a
  revealed day is not solved.
- **Green when** — the new case passes, and the two existing cases this inverts
  are rewritten rather than deleted:
  - *neither extends the run nor is skipped over* — rename to **ends the run on
    the day it happens** and change `toBe(2)` to `toBe(0)`.
  - *reads identically to the same day without the flag* — replace with **a
    given-up day ends the run now; the same day left unfinished waits until
    tomorrow**, asserting `computeStreak([result(THU, true), revealed(FRI)],
    FRI)` is `0` and `computeStreak([result(THU, true), result(FRI, false, 3)],
    FRI)` is `1`.

  *breaks the run when it is in the past* and *does not qualify* pass unchanged.
- **Refactor** — none. Do not fold `isOver` into `isQualifying`: C3 keeps them
  apart because R5 says qualifying is `solved` alone.

#### Step B3 — Yesterday with no result leaves today at 1

Covers: R5, AC7

- **Test first** —

  ```ts
  it('reads 1 when today is solved and yesterday has no result at all (F20 E1 R5, AC7)', () => {
    expect(computeStreak([result(FRI, true)], FRI)).toBe(1)
    expect(computeStreak([result(WED, true), result(FRI, true)], FRI)).toBe(1)
  })
  ```

  Run it: passes. Its red: drop the `!result` guard from the walk's break
  condition, and the second assertion fails with `expected 2 to be 1`. Revert.
- **Implement** — nothing.
- **Green when** — both assertions pass; the second is what makes it AC7 rather
  than a restatement of *is 1 when today alone is solved*.
- **Refactor** — none.

#### Step B4 — Yesterday guessed at but never finished leaves today at 1

Covers: R5, AC8

- **Test first** —

  ```ts
  it('reads 1 when yesterday was guessed at, never solved and never given up (F20 E1 R5, AC8)', () => {
    const yesterday = result(THU, false, 6)
    expect(yesterday.revealed).toBeUndefined()
    expect(computeStreak([yesterday, result(FRI, true, 2)], FRI)).toBe(1)
  })
  ```

  Run it: passes. Its red: make `isQualifying` return
  `r.solved || r.attempts.length > 0`, and it fails with `expected 2 to be 1` —
  which is the "showing up is not a qualifying day" half of R5. Revert.
- **Implement** — nothing.
- **Green when** — the case passes and *is 1 when yesterday was left unsolved
  and today is solved* still passes beside it.
- **Refactor** — none.

#### Step B5 — The streak is never restored retroactively

Covers: R6

- **Test first** —

  ```ts
  it('never restores a run an unsolved day broke (F20 E1 R6)', () => {
    const before = [result(MON, true), result(TUE, true), result(WED, true)]
    expect(computeStreak([...before, result(THU, false, 2)], THU)).toBe(3)
    expect(
      computeStreak([...before, result(THU, false, 2), result(FRI, true)], FRI),
    ).toBe(1)
  })
  ```

  Run it: passes. The first assertion is the grace on the day itself; the second
  is R6 — Friday's solve reads 1, not 4. Its red: make the walk skip a
  non-qualifying day instead of breaking, and the second assertion fails with
  `expected 4 to be 1`. Revert.
- **Implement** — nothing.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B6 — A day still in progress keeps yesterday's run on screen

Covers: R5

- **Test first** —

  ```ts
  it('keeps yesterday’s run while today is unopened or still playable (F20 E1 R5)', () => {
    const run = [result(WED, true), result(THU, true)]
    expect(computeStreak(run, FRI)).toBe(2)
    expect(computeStreak([...run, result(FRI, false, 2)], FRI)).toBe(2)
    expect(computeStreak([...run, revealed(FRI)], FRI)).toBe(0)
  })
  ```

  Run it: fails before Step B2 on the third assertion (`expected 2 to be 0`),
  passes after. This is the boundary Step B2's clause must not cross: the first
  two assertions are the reason `isOver` reads `revealed` rather than `!solved`.
- **Implement** — nothing beyond Step B2.
- **Green when** — all three pass, and *counts the run ending yesterday when
  today is untouched*, *counts the run ending yesterday when today is attempted
  but unsolved* and *moves the anchor onto today when today is solved* all still
  pass.
- **Refactor** — none.

### Track C — The attempts keep round-tripping

Steps go in `src/features/daily-groove/hooks/useProgress.integration.test.ts`,
following the shape its four existing cases use: a `renderHook` against a real
`createLocalStore()`, `waitFor(loaded)`, `act(recordAttempt)`, `unmount`, then a
second `renderHook` with a fresh store to stand for the reload.

#### Step C1 — Five attempts come back in order with their flags

Covers: R3, AC4

- **Test first** —

  ```ts
  it('brings five attempts back in order after a reload, flags intact (F20 E1 R3, AC4)', async () => {
    const today = isoDate(new Date())
    const spent: Attempt[] = [
      { root: 'D', flavour: 'Dorian', correct: false, rootMatched: false, flavourMatched: true },
      { root: 'C', flavour: 'Lydian', correct: false, rootMatched: true, flavourMatched: false },
      { root: 'A', flavour: 'Aeolian', correct: false, rootMatched: false, flavourMatched: false },
      { root: 'G', flavour: 'Dorian', correct: false, rootMatched: false, flavourMatched: false },
      { root: 'C', flavour: 'Minor', correct: true, rootMatched: true, flavourMatched: true },
    ]
    // record all five, unmount, remount against a fresh store
    expect(second.result.current.todayResult?.attempts).toEqual(spent)
  })
  ```

  Run it: passes. Its red: drop `attempts` from the record `useProgress` builds
  in `recordAttempt`, and it fails with `expected undefined to deeply equal [ … ]`.
  Revert.
- **Implement** — nothing. R3 holds, and this epic must keep it holding.
- **Green when** — `toEqual` passes on all five in order, `solved` is `true`,
  and `revealed` is absent from the loaded record.
- **Refactor** — none.

#### Step C2 — A late solve moves the streak by one

Covers: R4, AC5

- **Test first** — seed a solved yesterday through the real store, then record
  today solved on the seventh attempt and assert
  `expect(second.result.current.streak).toBe(2)` after the remount, with
  `expect(second.result.current.todayResult?.solved).toBe(true)` and
  `attempts` of length 7. Run it: passes. Its red is Step B1's mutation to
  `isQualifying`, which makes it fail with `expected 1 to be 2`.
- **Implement** — nothing.
- **Green when** — the streak reads 2 and the attempt list is 7 long, proving
  the count is stored and unused.
- **Refactor** — none.

#### Step C3 — The stored shapes are exactly what they were

Covers: R3

- **Test first** —

  ```ts
  it('stores an attempt with exactly its five fields (F20 E1 R3)', async () => {
    const loaded = second.result.current.todayResult
    expect(Object.keys(loaded!.attempts[0]).sort()).toEqual([
      'correct',
      'flavour',
      'flavourMatched',
      'root',
      'rootMatched',
    ])
    expect(Object.keys(loaded!).sort()).toEqual([
      'answer',
      'attempts',
      'date',
      'grooveId',
      'solved',
    ])
  })
  ```

  Run it: passes. Its red: add any field to the record in `recordAttempt` and it
  fails naming the extra key. Revert.
- **Implement** — nothing. This is C4, asserted.
- **Green when** — both key lists match. A day recorded without a give-up
  carries no `revealed` key at all, which is what the second assertion pins.
- **Refactor** — none.

### Track D — Nothing on the page counts your tries

#### Step D1 — The sweep, and what it found

Covers: R8

- **Test first** — none. This is a read, and it is the input to Step D2's
  pattern list.
- **Implement** — read every player-facing string in:
  `lib/presentation/feedback.ts`, `coaching.ts`, `coachingMoves.ts`,
  `coachingFamily.ts`, `moves.ts`, `nearMiss.ts`, `verdict.ts`, `ruledOut.ts`,
  `date.ts`, `staffLabel.ts`; `components/puzzle/GuessCard.tsx`,
  `NudgeBox.tsx`, `FeedbackLine.tsx`, `ModeToggle.tsx`, `TapSoundsToggle.tsx`,
  `GrooveCard.tsx`, `TransportPanel.tsx`, `SharedGrooveNotice.tsx`,
  `PlayTodayLink.tsx`; `components/intro/HowToPlay.tsx`;
  `components/header/StreakBadge.tsx`, `GrooveHeader.tsx`, `HelpToggle.tsx`,
  `ShareGroove.tsx`; `components/solved/SolvedPanel.tsx`, `LeadSheet.tsx`,
  `ScaleStaff.tsx`; and `GroovePuzzle.tsx`'s two captions.
  Expected finding, confirmed against the tree while this spec was written:
  **nothing to rewrite.** The dots' own label was the only budget copy and it
  left with the component in Track A. `nearMiss.ts` uses "apart", `NudgeBox`
  counts ruled-out roots and `SolvedPanel` says "given up · the day is over" —
  none of those names a try count, and none is in scope.
  If the sweep does find a string, rewrite it here and add whatever pattern
  would have caught it to C5.
- **Green when** — the finding is recorded in the epic's implementation notes,
  either as "nothing" or as the strings changed.
- **Refactor** — none.

#### Step D2 — A reader for everything the page says, and a matcher that fails on a count

Covers: R8, AC10

- **Test first** — new file
  `src/features/daily-groove/components/GroovePuzzle.copy.test.tsx`, with
  `readablePage()` and `offendingCopy()` as described in *Architecture* and C5,
  and its own sensitivity as the first case:

  ```ts
  it('catches copy that names a count, however it is worded (F20 E1 R8, AC10)', () => {
    expect(offendingCopy(['2 of 3 attempts spent · 3 is par, not a limit'])).toEqual(
      expect.arrayContaining(['attempts', 'par']),
    )
    expect(offendingCopy(['You have 2 guesses left'])).not.toEqual([])
    expect(offendingCopy(['three guesses in and still nothing'])).not.toEqual([])
    expect(offendingCopy(['4 roots ruled out', 'You said Lydian — a tone apart'])).toEqual([])
  })
  ```

  Run it before the helpers exist: fails to compile with
  `error TS2304: Cannot find name 'offendingCopy'`.
- **Implement** — the two helpers, local to the file, not exported and not moved
  into `puzzleHarness.tsx`.
- **Green when** — the case passes: the retired label is caught twice over, the
  two invented phrasings are caught, and the two real surviving strings are not.
  That last assertion is what keeps the guard from being a nuisance.
- **Refactor** — none.

#### Step D3 — Fresh, with the help panel open and closed

Covers: R1, R8, AC1, AC10

- **Test first** — same file:

  ```ts
  it('counts nothing before the first guess (F20 E1 R1, R8, AC1, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    expect(screen.getByRole('heading', { name: /how to play/i })).toBeInTheDocument()
    expect(offendingCopy(readablePage())).toEqual([])
    expect(document.querySelectorAll('[data-dot-state]')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Close how to play' }))
    expect(offendingCopy(readablePage())).toEqual([])
  })
  ```

  Run it against `main` before Track A: fails with `AssertionError: expected
  [ 'attempts', 'par' ] to deeply equal []`. Run it after Track A: passes.
- **Implement** — nothing, given Step D1 found nothing. Any hit here is copy to
  rewrite, in the file that owns it.
- **Green when** — both reads come back empty. The help panel is open on the
  first render because storage is empty and `newOrLapsed` is true, so
  `HowToPlay` is covered here for free.
- **Refactor** — none.

#### Step D4 — Mid-guess, at one miss and at three

Covers: R1, R8, R9, AC2, AC10, AC11

- **Test first** —

  ```ts
  it('counts nothing while the guessing is going on (F20 E1 R1, R8, AC2, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    expect(offendingCopy(readablePage())).toEqual([])

    await guess(user, 'D', otherWrongFlavour())
    expect(nudgeLine()).toBeInTheDocument()
    expect(offendingCopy(readablePage())).toEqual([])

    await guess(user, 'A', thirdWrongFlavour())
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')
    expect(offendingCopy(readablePage())).toEqual([])
  })
  ```

  Run it before Track A: fails on the first read with the two hits from the dot
  label. After: passes.
- **Implement** — nothing.
- **Green when** — all three reads are empty, and the nudge and the give-up
  offer are both asserted present at the misses they belong to — the hint ladder
  and the third-miss offer read through the guard, which is AC11 seen from the
  copy side.
- **Refactor** — none.

#### Step D5 — Solved, and given up on

Covers: R1, R7, R8, AC3, AC9, AC10

- **Test first** —

  ```ts
  it('counts nothing once the day is solved (F20 E1 R1, AC3, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'C', 'Aeolian')

    expect(control()).toHaveAccessibleName('Solved')
    expect(offendingCopy(readablePage())).toEqual([])
  })

  it('counts nothing, and says nothing about the streak, on a day given up on (F20 E1 R1, R7, AC3, AC9, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    await guess(user, 'A', thirdWrongFlavour())
    await user.click(giveUp() as HTMLElement)
    await user.click(giveUp() as HTMLElement)

    expect(screen.getByRole('heading', { name: 'C Aeolian' })).toBeInTheDocument()
    expect(offendingCopy(readablePage())).toEqual([])
    expect(document.body.textContent).not.toMatch(/streak (?:lost|broken|reset|over|ended)/i)
    expect(document.body.textContent).not.toMatch(/back to (?:zero|0)/i)
    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(/no streak yet/i)
  })
  ```

  Run the second before Track A: fails on `offendingCopy`. After: passes.
- **Implement** — nothing.
- **Green when** — both reads are empty, the solved panel and the revealed panel
  each report no count (AC3), and nothing on the revealed page announces the
  reset (R7, AC9's first half). The badge reads *No streak yet* here because the
  store is empty; Step D7 is the case where it had something to lose.
- **Refactor** — none.

#### Step D6 — The guard is named where the composed tests are named

Covers: R8

- **Test first** — `src/features/daily-groove/structure.test.ts`: add
  `'GroovePuzzle.copy.test.tsx'` to the `composedTests` array in *holds only the
  root component at the components/ root*. Run it with the file temporarily
  renamed: fails with `AssertionError: expected [ 'GroovePuzzle.copy.test.tsx' ]
  to deeply equal []`. Restore the name.
- **Implement** — nothing else. Do not touch `REGIONS`; Track A owns that edit
  and it has already landed.
- **Green when** — `structure.test.ts` is green, and deleting the guard file now
  breaks a structural test rather than passing silently. That is what makes R8's
  "a guard keeps it from coming back" true of the guard itself.
- **Refactor** — none.

#### Step D7 — The badge reads the recomputed number after a give-up

Covers: R7, AC9

- **Test first** — `src/features/daily-groove/components/GroovePuzzle.header.test.tsx`,
  in the describe that already reads the streak line:

  ```ts
  it('reads the recomputed streak, unannounced, once the day is given up on (F20 E1 R7, AC9)', async () => {
    mockStore.getAll.mockResolvedValue([solvedDaysAgo(1), solvedDaysAgo(2), solvedDaysAgo(3)])
    const user = userEvent.setup()
    await renderPuzzle()
    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent('3 days streak')

    await guess(user, 'G', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    await guess(user, 'A', thirdWrongFlavour())
    await user.click(giveUp() as HTMLElement)
    await user.click(giveUp() as HTMLElement)

    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(/no streak yet/i)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.body.textContent).not.toMatch(/streak (?:lost|broken|reset|over|ended)/i)
  })
  ```

  Run it before Track B: fails with `expected element to have text content /no
  streak yet/i, received "3 days streak"`. After Track B: passes.
- **Implement** — nothing. `useProgress` already refolds `all` on the reveal's
  `recordAttempt` and recomputes `computeStreak`; Track B's anchor clause is
  what makes the number 0.
- **Green when** — the badge goes from *3 days streak* to *No streak yet* on the
  render that shows the answer, with no alert and no announcement — R7 exactly.
  Reuse `solvedDaysAgo` from the file if it is in scope; otherwise lift the same
  helper the page test uses.
- **Refactor** — none.

## Integration and verification

### Step I1 — The order the two shared files are opened in

`structure.test.ts` and `GroovePuzzle.header.test.tsx` are written by Track A in
Wave 1 and added to by Track D in Wave 2. Track D re-reads both before editing;
if either shows Track A's edit missing, Wave 2 started early and should stop.

### Step I2 — The demo path, by hand

`npm run dev`, with `localStorage` cleared:

1. Open the puzzle. The card shows Root, Mode, Check, and **no row of dots**
   above the button — the button sits directly under the Mode chips.
2. Guess wrong twice. Nothing on the page counts the misses; the hint box and
   the "N roots ruled out" line behave as they did.
3. Guess wrong a third time. **Give up and show the answer** appears, as before.
4. Reload. The two-then-three misses are still reflected in the chips and the
   hint, and DevTools shows all three attempts in
   `daily-groove:v2:results` with their `rootMatched` / `flavourMatched` flags.
5. Solve on the fifth try. The badge goes up by one; the solved panel says
   nothing about how many guesses it took.
6. Seed a few solved days, then on a fresh day give up. The badge reads **No
   streak yet** the moment the answer appears, and nothing on the page says why.

### Step I3 — The suite and the checks

`npm test` (app + tooling), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
`npm run test:gen` is not this epic's tier — no track owns a file under
`scripts/grooves/` — but `npm run test:all` should be run once at the end to
confirm nothing in the generator tier was disturbed.

Expected shape of the result: 114 test files (one deleted, one added), no
failures, and `grep -rn "data-dot-state\|dotStates\|DotState\|DOT_COUNT\|AttemptDots" src docs`
silent.

### Step I4 — What to check before calling this done

- `REVEAL_AFTER_MISSES` still exists in `feedback.ts` under that name, with the
  value 3.
- `types.ts` is byte-identical to `main`.
- `src/features/daily-groove/index.ts` is byte-identical to `main` — the slice's
  public surface did not move, so removability is unchanged.
- The two `role="img"` assertions named in C6 are gone, and no test still expects
  an `img` inside `GuessCard`.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2, A4, A5, A6, A8, D3, D4, D5 |
| R2 | A1, A2, A3, A7, A8 |
| R3 | A6, C1, C3 |
| R4 | B1, C2 |
| R5 | B2, B3, B4, B6 |
| R6 | B5 |
| R7 | D5, D7 |
| R8 | D1, D2, D3, D4, D5, D6 |
| R9 | A6, A8, D4, I2 |
| AC1 | A1, D3 |
| AC2 | A6, D4 |
| AC3 | D5 |
| AC4 | C1 |
| AC5 | B1, C2 |
| AC6 | B2 |
| AC7 | B3 |
| AC8 | B4 |
| AC9 | D5, D7 |
| AC10 | D2, D3, D4, D5 |
| AC11 | A6, D4 |
| AC12 | A3 |

Every step traces back: no step in this spec covers nothing.

## Assumptions

- **AC6 needs a code change, and the PRD says it does not.** The PRD's
  *Behaviour details* states "this is what the code already does"; it is right
  about R4, R5's past days and R6, and wrong about a give-up today, which
  currently leaves the run on screen because the anchor shifts to yesterday.
  This spec fixes it (Step B2) on the strength of AC6's own wording, the
  roadmap's "a day given up on or never opened leaves the streak at zero", and
  R7's "the badge simply reads the new number". **It contradicts feature-7 epic
  3, which put "any change to `lib/persistence/streak.ts`" out of scope and
  pinned the opposite in two cases.** If AC6 was loosely worded and the grace
  should stay, delete Step B2 and Step D7, keep the two existing cases as they
  are, and AC6 becomes unsatisfiable as written — nothing else in the epic
  moves. This is the one thing here worth a second opinion before Wave 1 starts.
- **The banned-copy list gains the spelled-out form** (C5's fourth pattern)
  beyond the PRD's three. It is cheap and closes "three guesses left"; drop it if
  it ever fires on legitimate copy.
- **`readablePage()` reads eight labelling attributes** and the whole
  `body.textContent`, including `aria-hidden` subtrees. Over-inclusive on
  purpose: a guard that misses a tooltip is not a guard, and there is no
  surviving copy for the extra reach to trip on.
- **The reader stays local to the guard file** rather than joining
  `puzzleHarness.tsx`. One consumer, and moving it would put a third file under
  sequenced ownership between Tracks A and D.
- **`docs/coding-guidelines.md`'s "Thirteen assertions" stays.** It counts what
  sat in `src/app/page.test.tsx` historically, which is still true after the dot
  test is deleted.
- **Step A1's third assertion is written against the DOM, not guessed.** The
  spec says the check button's previous sibling must be the mode chip group's
  outermost node; the builder reads what `ChipGroup` actually renders and
  asserts that, rather than forcing the element this spec names.
- **`GroovePuzzle.sounding.test.tsx` and `GroovePuzzle.intro.test.tsx` need no
  edit.** Neither mentions the dots. If either turns red, it is a real
  regression, not cleanup.
- **The `revealed` flag stays out of `isQualifying`.** Only the anchor reads it,
  so "the streak counts solved days only" survives literally, and a future
  stats view still has the flag to distinguish given-up from unfinished.

## Decision log

### Cycle 1 — 2026-09-03

**Q1. AC6 says a given-up today reads 0; `computeStreak` reads the run ending yesterday. Fix the code or the criterion?**
Decision: **Fix the code, in the anchor and not in `isQualifying`** — AC6, the
roadmap's epic summary and R7's "the new number" all say the badge changes when
Sam gives up, and the roadmap's own assumption licences a fix ("if a case turns
out to be wrong, that is a bug fix inside the epic"). Anchoring on a day that is
*over* rather than a day that *qualifies* keeps the morning grace that stops
every player's badge reading 0 before they have played, which R5's "day passed"
wording supports and which Step B6 now pins.
Changed: Architecture (the anchor table), Contract C3, Track B, Steps B2 and B6,
Step D7, and two existing cases in `streak.test.ts`. Recorded as an Assumption
because it contradicts feature-7 epic 3's out-of-scope note.

**Q2. One track or several for the dot removal?**
Decision: **One track, ordered steps** — the five links are a type-check chain,
and `docs/testing.md` forbids the `vi.mock` that would be needed to break it.
Tracks B, C and D are separate because their files genuinely do not collide.
Changed: Tracks, Execution waves, and the scheduling note.

**Q3. Where does R8's guard live, and does the harness gain a reader?**
Decision: **A new composed-page test file, with the reader local to it** — the
PRD's Q2 already settled that the guard asserts on rendered output, which needs
the composed page; keeping the reader out of `puzzleHarness.tsx` avoids a third
file shared across waves. The file is registered in `structure.test.ts`'s
`composedTests` so deleting the guard breaks a test.
Changed: Architecture, Contract C5, Track D, Steps D2 and D6.
