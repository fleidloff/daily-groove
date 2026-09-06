# 6 — Six mode options

## What

* Six mode options in the guess card instead of four.
* Lay the chips out as two rows of three for big screens. 3 rows of 2 for smaller screens (should be normal behaviour)
* Simple mode (major / minor) stays untouched.

## Done when

* The guess card offers six mode chips, one of them the correct mode.
* The chips render as two rows of three on big screens and 3 rows of 2 on small screens, not one row of six.
* Simple mode still offers exactly major and minor.
* we are still only narrowing the root. Modes stay 6. Wrongly guessed ones are still removed from the card, and the correct one is still revealed when the puzzle is solved.

## Open questions

### Q1. Simple mode shares the mode row's column setting. Does it keep two rows of three's grid?

`GuessCard.tsx` passes one `columns` prop to the mode `ChipGroup`, and simple
mode's major/minor chips render through the same group. Moving it to 3 columns
on wide screens moves them too — two chips in a three-column grid sit on the
left two thirds instead of the left half.

- [ ] A) One setting for both — simple mode's two chips land in the 3-column grid *(recommended — "simple mode stays untouched" is about which chips are offered, and it already is; one column setting is one line and no branch in the shell)*
- [x] B) Branch on `simple` — `wide: simple ? 2 : 3`, so major/minor keep a half-width row and only the six-mode layout changes. One extra expression in `GuessCard.tsx`, one more test case.
- [ ] C) Branch to `wide: 4`, exactly today's value, so nothing about simple mode's rendering moves at all.

### Q2. Under Q1-B, what number does simple mode's `wide` actually take?

Q1-B's prose said "keep a half-width row" and its code said `simple ? 2 : 3`.
Those are two different pictures, and the option should not have carried both.
In a CSS grid each chip is `1 / columns` of the row, so with two chips:
`wide: 4` leaves them on the left half at today's width, and `wide: 2` makes
them fill the row at twice today's width.

- [x] A) `4` — today's exact rendering, reached through Q1-B's branch: `wide: simple ? 4 : 3` *(recommended — Q1-B was picked to keep simple mode where it is, and 4 is the value that does that; it also needs no new entry in `WIDE_CLASS`, since 4 is already there)*
- [ ] B) `2` — the literal `simple ? 2 : 3`: major and minor fill the whole row, each chip twice as wide as today. A deliberate change to simple mode's look, not a preservation of it.

## Notes

* **Size test: passes**, with one thing named rather than rounded away.
  * Bullets: four files plus their tests. ✓
  * Modules: **theory** (`src/lib/theory/music.ts`) and **shell** (`GuessCard.tsx`) — two of six. ✓ The third file, `src/components/controls/ChipGroup.tsx`, is the **design system**, which is not one of the six modules in `docs/architecture.md`; it is bound by zone 1 and imports nothing from a feature. The change to it is generic — one more allowed column count — so it stays a primitive.
  * `docs/music.md`: nothing frozen is touched. Options are built in the browser from the shipped manifest; `src/lib/hash.ts`, the `events` draw order and the catalogue are untouched, and `groove.flavour` — the answer — never moves. No past puzzle is reassigned. ✓
  * One `git revert`. ✓
* Files this is expected to touch:
  * `src/lib/theory/music.ts` — `flavourOptions` passes `6` to `buildOptions`, the way `simpleRootOptions` already passes `6`.
  * `src/components/controls/ChipGroup.tsx` — `ChipColumns['wide']` is `4 | 6 | 7` today and `WIDE_CLASS` has no 3. Both gain `3` / `md:grid-cols-3`, and nothing else (Q2-A keeps 4 in play, and 4 is already there).
  * `src/features/daily-groove/components/puzzle/GuessCard.tsx` — the mode group's `columns` becomes `{ base: 2, wide: simple ? 4 : 3 }` (Q1-B, Q2-A). The root group's `{ base: 4, wide: 6 }` is untouched.
  * tests: `src/lib/theory/music.test.ts` (line 74 asserts four options), `src/features/daily-groove/components/puzzle/GuessCard.test.tsx` (line 277 asserts four flavour chips, line 689 asserts `grid-cols-2` / `md:grid-cols-4`), `src/components/controls/ChipGroup.test.tsx` (line 180 pins the four-option layout; a three-column case joins it).
* **The pool is big enough.** `flavourPool(GROOVES)` returns all twelve rendered flavours — `grooves.generated.ts` uses every one — so five distractors plus the answer is never short. Locrian is app-only and stays out of the pool, as now.
* Assumption: the five distractors are still drawn at random from that pool by the date seed, not chosen for how close they sound. `buildOptions` gains no new argument; the only change is the count.
* Assumption: "wrongly guessed ones are still removed from the card" means removed from play, which is today's behaviour — `optionStates` marks them `'out'` and `chipStates` renders them dashed and dimmed in place. They are not taken out of the DOM, so the grid stays six chips and two rows of three holds all the way through a session. `GuessCard.test.tsx:758` is the test that pins it.
* Assumption: `wide` stays the `md:` breakpoint (768px), the same one the root row uses. "Big screens" means the same thing on both rows.
* Assumption: `buildOptions`'s `count = 4` default stays as it is and `flavourOptions` passes `6` explicitly. Changing the default would leave `options.test.ts:19` asserting a number nothing uses.
* No attempt limit exists — `canCheck` in `state/useDailyGrooveStore.ts` gates on a selection, not on a count — so six options make the row longer to scan but cannot cost the player the day. Nothing about scoring or the nudge thresholds needs to move.
* Consequence worth knowing: options are derived from the date, not stored, so a **past** groove reopened through a shared link will show six modes where it showed four. Nothing recorded in `lib/persistence/` references the offered options, so no past result changes.
* `lib/puzzle/narrowing.ts` is untouched. It eliminates roots only, and the ticket says the modes stay at six.

## Answered — Q1-B

* **Q1-B ticked: the mode row's `wide` branches on `simple`.** Only the six-mode
  layout moves to 3 columns; simple mode gets its own value.
* Re-running §2 against it: **still passes.** The branch is one expression in
  `GuessCard.tsx` — the same shell file the change already touches — so the
  module count stays at theory + shell, and the design system is still the only
  thing outside the six.
* **B's two halves disagree, and Q2 is what settles it.** The prose said "keep a
  half-width row"; the code said `simple ? 2 : 3`. In a grid of two chips,
  `wide: 4` is the half-width row and `wide: 2` fills the row at double the
  chip width. The option is left as it was ticked and the number is asked
  separately rather than picked for you.
* What Q2 costs, either way:
  * **Q2-A (`wide: 4`)** — `ChipColumns['wide']` gains only `3`, and `WIDE_CLASS`
    only `md:grid-cols-3`. Simple mode renders byte-for-byte as today, so
    `GuessCard.test.tsx`'s simple-mode layout assertions stand unchanged.
  * **Q2-B (`wide: 2`)** — the union gains `2` and `3`, `WIDE_CLASS` gains
    `md:grid-cols-2` and `md:grid-cols-3`, and simple mode's layout test has to
    be rewritten to the new width.
* Unchanged by Q1-B: `base` stays `2` on the mode row in both modes. Six chips
  at 2 columns is three rows of two on phones, which is what `## Done when`
  asks for; two chips at 2 columns is one row of two, which is what simple mode
  does today.

## Answered — Q2-A

* **Q2-A ticked: `wide: simple ? 4 : 3`.** Six modes lay out 3 across on wide
  screens and 2 across on phones; simple mode renders exactly as it does today,
  major and minor on the left half of the row.
* §2 re-run: **passes.** Same two modules — theory and shell — plus the one
  design-system primitive. The branch is an expression in a file already on the
  list, and `WIDE_CLASS` gains one entry rather than two.
* `GuessCard.test.tsx`'s existing simple-mode layout assertion (`grid-cols-2`,
  `md:grid-cols-4`) stays true and does not need rewriting. The full-mode
  assertion at line 689 is the one that moves, to `md:grid-cols-3`.
* Nothing further opened. The ticket is settled.

## Built

Q1-B and Q2-A: `columns={{ base: 2, wide: simple ? 4 : 3 }}`.

* `src/lib/theory/music.ts` — `flavourOptions` passes `6` to `buildOptions`, matching how `simpleRootOptions` already passes its count. One argument; the pool, the seed and the shuffle are untouched.
* `src/components/controls/ChipGroup.tsx` — `ChipColumns['wide']` gains `3`, `WIDE_CLASS` gains `md:grid-cols-3`. Nothing else in the primitive moved.
* `src/features/daily-groove/components/puzzle/GuessCard.tsx` — the mode group's `wide` branches on `simple`. The root group is untouched.
* **The fixture, not the app, was the one thing short of six.** `music.test.ts`'s local `CATALOGUE` held five flavours, and `buildOptions` returns what the pool allows rather than padding, so the first run came back with five options. The fixture grew to seven (Phrygian and Mixolydian). The shipped catalogue has all twelve, so production was never short — `grooves.generated.test.ts` asserts six against `GROOVES` over forty days and passes.
* tests:
  * `src/lib/theory/music.test.ts` — the thirty-day sweep asserts six unique options including the answer; `CATALOGUE` extended to seven flavours.
  * `src/components/controls/ChipGroup.test.tsx` — a six-option group at `{ base: 2, wide: 3 }` renders `grid-cols-2 md:grid-cols-3`, and the even-division case list gains `6 / 2 / 3`.
  * `src/features/daily-groove/components/puzzle/GuessCard.test.tsx` — six flavour chips; the layout test now pins `md:grid-cols-3`; a new test pins simple mode at `grid-cols-2 md:grid-cols-4`, which is what Q2-A bought.
  * `src/features/daily-groove/data/grooves.generated.test.ts` — the day's row asserts six against the real catalogue across forty days.
  * `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`, `GroovePuzzle.page.test.tsx` — four chip counts updated to six, including the one that re-checks the row after leaving simple mode.
* checks: lint — clean / tsc — pass / test — 140 files, 2849 pass / build — pass
* **Not looked at.** Nothing in this run opened the page. The three rows of two on a phone and the two rows of three above `md` are asserted through the grid classes, not seen.

## Changed after the build — one grid for both modes

Q1-B and Q2-A were reversed in chat: "let's use the same grid for simple mode
and full mode instead. for the mode buttons". That is Q1-A, and the branch is
gone.

* `src/features/daily-groove/components/puzzle/GuessCard.tsx` — `columns={{ base: 2, wide: 3 }}`, no `simple` branch. The mode row is one grid whatever is on it.
* `GuessCard.test.tsx` — the simple-mode layout test now pins `md:grid-cols-3`, the same value the six-mode test pins.
* Consequence, and it is the one Q2 was asked about: on wide screens major and minor now sit in two of three columns, so each chip is a third of the row rather than a quarter, and the row is two thirds full. `ChipGroup`'s `wide` entry for `4` stays — the primitive still offers it, nothing in the app asks for it on this row.
* checks re-run after the change: lint — clean / tsc — pass / test — 140 files, 2849 pass / build — pass
