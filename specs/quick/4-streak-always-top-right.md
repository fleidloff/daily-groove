# 4 — Streak always top right

## What

* The daily streak sits at the top right of the screen — same on small and large
  screens.
* Same height as the title line.
* Small screens: transpose and share stay at the height they have today; the
  streak is above them.
* Large screens: streak on top; transpose and share on the right, below the
  header's subtitle.
* The streak is a fire emoji and a number, nothing else.
* No streak shows the fire emoji with a 0.

## Done when

* At a narrow viewport, the streak renders in the header's top row, level with
  the title, and transpose and share stay in their current row.
* At a wide viewport, the streak renders in the same top-right spot, and
  transpose and share sit right-aligned below the subtitle.
* A streak of 5 renders 🔥 5 and no other text.
* A first visit with no streak renders 🔥 0 rather than nothing.
* `StreakBadge.test.tsx` and `GrooveHeader.test.tsx` cover both.

## Open questions

### Q1. Where do transpose and share sit on a wide screen?

- [x] A) Their own right-aligned row **below the whole title block**, the same shape at every width — the header grows to three rows on desktop *(recommended — it is the literal reading of "below the subtitle", and it makes the small-screen half of the ticket a no-op: the controls already sit in exactly that place today. One shape, no breakpoint-specific placement.)*
- [ ] B) A right-hand column: streak on row 1 level with the title, controls on row 2 level with the subtitle, so the header stays two rows tall on desktop. Needs a CSS grid with per-breakpoint placement, because on a narrow screen the controls must leave that column and drop to a full-width row.

```
A (both widths)            B (wide only)
┌────────────────────┐     ┌────────────────────┐
│ Daily Groove   🔥 5│     │ Daily Groove   🔥 5│
│ tagline ?          │     │ tagline ?  [Tr][Sh]│
│         [Tr] [Sh]  │     └────────────────────┘
└────────────────────┘
```

### Q2. Does the count reach a screen reader?

- [x] A) The badge's accessible name carries it — a new `header.streakName({ days })`, "Current streak: 3 days", with 🔥 3 as the visible text *(recommended — engineering reason: the wrapper's `aria-label` overrides its content for the accessible name, so with the words gone from the visible text a reader that today hears "Current streak, 3 days streak" would hear only "Current streak". Cost: the ~20 `getByLabelText(header.currentStreakName)` handles across the page suites change to the new snippet.)*
- [ ] B) Leave `aria-label` as "Current streak" and let the digit be visible text only. No test handles change; the number is not part of the accessible name.

## Notes

* Size test: **passes.** One module (shell — `components/header/`), snippets sit in no module. Nothing in `docs/music.md` touched, one revert.
* Files:
  * `src/features/daily-groove/components/header/GrooveHeader.tsx` — the layout. Today it is one `Row collapseBelow="sm"` with two children: the title `Stack`, and one `div.self-end.sm:self-auto` holding transpose + streak + share. Both options split that second div: the streak becomes a sibling of the title `Stack` in a row that never collapses, and the controls become a third child.
  * `src/features/daily-groove/components/header/StreakBadge.tsx` — 🔥 in the `Pill`'s icon slot, the bare number as its content.
  * `src/lib/snippets/types.ts`, `en/header.ts` — `streakDays` and `noStreakYet` lose their consumer; `streakCount({ days })` returning the digit replaces them, plus `streakName` under Q2 A.
* Assumptions taken rather than asked:
  * The `Pill` chrome stays — border, surface, rounded. "A fire emoji and a number, nothing else" reads as the badge's *content*, and a lone unframed `0` in the corner does not read as a streak.
  * The emoji is passed as `<span aria-hidden="true">🔥</span>` so no reader announces "fire", and `src/components/display/Pill.tsx` needs no change.
  * `header.currentStreakName` keeps its wording under Q2 A ("Current streak: 3 days" extends it rather than replacing it).
* Tests this rewrites rather than adds. They assert the layout the ticket changes, so they are superseded, not weakened — worth reading the diff of these four:
  * `GrooveHeader.test.tsx` — "keeps the streak at the right even when the header stacks" (F8 E2 R10a), the two source assertions "aligns its two sides on their centres" (R8, R9) and "still stacks below the collapse breakpoint" (R10), and the three share/transpose tests that assert all three controls share one `.self-end` anchor with the streak between them (F12 E2 R1b, F23 E1 R1).
  * `StreakBadge.test.tsx` — all four: the zero case now renders `0`, and the singular/plural cases lose their words.
  * `GroovePuzzle.header.test.tsx`, `.page.test.tsx`, `.guessing.test.tsx`, `.copy.test.tsx`, `.written.test.tsx` — ~20 `toHaveTextContent(header.streakDays(…))` / `noStreakYet` assertions become the digit. Mechanical, but it is the bulk of the diff.
* Done-when 1 and 2 can only be settled halfway by a test: jsdom has no viewport, so a breakpoint is not observable. Same reading the existing header tests take — assert the responsive class names and the DOM order, and settle the rest by looking at the page. Say so rather than claiming a width was tested.
* Done-when 5 says `GrooveHeader.test.tsx` and `StreakBadge.test.tsx` cover "both"; taken as: the badge file covers the 🔥 + number rendering at 5 and at 0, the header file covers the placement.

## Prototype

* `4-streak-always-top-right.prototype.html` — states: today · Q1 A · Q1 B, each
  at narrow 390 and wide 1220, with the streak switchable between 0, 1, 5 and 128
  and the theme between system, light and dark.
* invented, not in the ticket:
  * the gap between the streak row and the controls row — 20px on both widths.
  * how the streak aligns when the title wraps to two lines: pinned level with
    the *first* line, not centred on the title block. Narrow always wraps.
  * that 🔥 takes the `Pill`'s icon slot, so it keeps the ● position and the
    8px gap rather than being part of the content string.
  * nothing reserves a width for the badge, so the pill grows from 🔥 0 to 🔥 128.
  * the controls row stays right-aligned on narrow under A. The ticket says the
    controls keep their height, not what they align to.
  * under A on wide, the tagline still runs the full width below the streak —
    nothing reserves the top-right column past row 1.
* to compare: **A vs B at wide 1220.** Q1 is ticked A, so this is a confirmation,
  not an open question — A gives the controls their own full row under the
  tagline, B keeps the header two rows tall and puts them level with it.

## Built
* Option A on both questions.
* `src/features/daily-groove/components/header/GrooveHeader.tsx` — one `Stack`: a `Row` that never collapses holds the title and the streak, the tagline sits under it, and transpose + share follow on their own `Row justify="end"`. The old `collapseBelow="sm"` row and the two `self-start` / `self-end` anchors are gone, so the streak keeps its corner at every width.
* `src/features/daily-groove/components/header/StreakBadge.tsx` — `Pill` with `<span aria-hidden="true">🔥</span>` as its icon and the bare count as its content. The wrapper's `aria-label` carries the words.
* `src/lib/snippets/types.ts`, `en/header.ts` — `streakName({ days })` ("Current streak: 3 days") and `streakCount({ days })` ("3") replace `noStreakYet` and `streakDays`. `currentStreakName` stays as the prefix `streakName` is built from, and as the handle tests match a streak-agnostic badge by.
* tests: `StreakBadge.test.tsx` rewritten (4: fire + count and nothing else at 5 and at 0, the emoji hidden from the accessible name, the count in it); `GrooveHeader.test.tsx` — the two stacking-anchor tests and the two `align`/`collapseBelow` source tests replaced by placement tests (streak in the title row and not with the tagline, controls row below the tagline, right-aligned, transpose before share, no `collapseBelow` in the source); `snippets.test.ts` (+1); the ~20 `streakDays` / `noStreakYet` assertions across `GroovePuzzle.header/page/guessing/copy/written.test.tsx` now query the badge by `streakName({ days })`, or by a `startsWith(currentStreakName)` matcher where the test does not know the streak.
* checks: lint — 0 problems / tsc — pass / test — 176 files, 3639 pass / build — pass.
* **Not verified by machine: done-when 1 and 2.** jsdom has no viewport and the repo has no browser driver, so the two widths were settled by the responsive-class and DOM-order assertions named above, not by looking at a narrow and a wide window. Worth a glance before commit.
