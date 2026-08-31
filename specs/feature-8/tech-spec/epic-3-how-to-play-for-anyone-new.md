# Tech spec — Epic 3: How to play, for anyone new

PRD: [../prd/epic-3-how-to-play-for-anyone-new.md](../prd/epic-3-how-to-play-for-anyone-new.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three pieces, none of which need each other to be built. A pure function decides
whether the saved record set belongs to someone new or long gone; two
presentational components draw the box and the question mark; and one wiring
pass joins them to the page.

The whole epic adds no storage. The rule reads dates that are already in
`daily-groove:v2:results`, which is why there is no "seen the intro" flag to get
stuck and nothing to migrate. The decision is taken once, in the same `.then()`
that loads the records, and held for the session — so the first attempt of the
day, which writes a record dated today, cannot pull the explanation off the
screen while it is being read.

Whether the box is on screen is then one nullable boolean in the page: `null`
means *follow the rule*, and the close control and the question mark set it
`false` and `true`. Nothing about it is persisted.

## Architecture

```
GroovePuzzleView
├── GrooveHeader { streak, onShowHelp: (() => void) | null }
│   └── … Heading · Text( TAGLINE + HelpToggle { onShow } )    ← the "?", inline
├── HowToPlay { onClose }                                       ← the box
└── Row → GrooveCard · GuessCard
```

**The rule.** `isNewOrLapsed(results, today)` in
`lib/persistence/lapsed.ts` — a plain function over the record set and the ISO
day, tested as a plain function. No results at all is `true`; otherwise it takes
the newest `date` and asks whether more than 31 days have passed. It needs the
same noon-anchored ISO parse that `computeStreak` uses to survive DST, which
lives privately inside `streak.ts` today: it moves to `lib/puzzle/selectGroove.ts`
beside `isoDate`, which is already the module both `streak.ts` and
`theory/music.ts` import their date helpers from.

**Where the decision is taken.** In `useProgress`, in the `.then()` that already
sets `all`, `todayResult` and `loaded`:

```ts
const [newOrLapsed, setNewOrLapsed] = useState(false)
// …inside the existing Promise.all().then():
setNewOrLapsed(isNewOrLapsed(allResults, today))
```

`recordAttempt` never touches it. That is the whole of R16: the boolean is
written once per load and is not derived from `all`, which does change on every
write. A `useMemo` over `all` would have been the obvious shape and the wrong
one.

**Where the visibility lives.**

```ts
// null = follow the rule; true/false = the player has said
const [helpOverride, setHelpOverride] = useState<boolean | null>(null)
const showHelp = helpOverride ?? newOrLapsed
```

`GroovePuzzleView` already refuses to paint anything but the loading state until
`hydrated`, so R11 needs no extra guard: the box cannot reach the first frame.
The override is session state in the page, not a preference — it says nothing
about who the player is, so it stays out of `preferences.ts`.

**What this changes in Epic 1's assertions.** Epic 1 leaves `GrooveHeader` with
`streak` as its only prop, and asserts that. This epic adds `onShowHelp`, so that
assertion becomes `['streak', 'onShowHelp']`. The live half of Epic 1's R12 —
no `date` prop, no clock read — is untouched and stays asserted.

**Structure.** The box is its own screen region, so `components/intro/` joins
`header/` and `puzzle/`, and `src/features/daily-groove/structure.test.ts` is
updated in one place: `REGIONS` gains `intro: ['HowToPlay']` and `HelpToggle`
joins `header`, and the "exactly the two region directories" assertion becomes
three. Both components are feature-owned domain UI — the words "How to play" and
"Guess the Root & Mode" are as domain-specific as it gets — so nothing is added
to the design system.

## Contracts

Frozen before the tracks start.

```ts
// src/features/daily-groove/lib/puzzle/selectGroove.ts
/** Parse `YYYY-MM-DD` to a local Date at noon, DST-safe. */
export function parseIsoDate(iso: string): Date

// src/features/daily-groove/lib/persistence/lapsed.ts
export const LAPSE_DAYS = 31
/** No results, or nothing played in the last `LAPSE_DAYS` days. */
export function isNewOrLapsed(results: DailyResult[], today: string): boolean

// src/features/daily-groove/hooks/useProgress.ts
export type UseProgress = {
  todayResult: DailyResult | null
  streak: number
  recordAttempt: (day: DayProgress) => Promise<void>
  loaded: boolean
  newOrLapsed: boolean      // new; latched at load
}

// src/features/daily-groove/hooks/usePuzzleSession.ts
// UsePuzzleSession gains: newOrLapsed: boolean

// src/features/daily-groove/components/intro/HowToPlay.tsx
type HowToPlayProps = { onClose: () => void }

// src/features/daily-groove/components/header/HelpToggle.tsx
type HelpToggleProps = { onShow: () => void }

// src/features/daily-groove/components/header/GrooveHeader.tsx
// `null` means the box is already on screen, so no question mark is rendered.
type GrooveHeaderProps = { streak: number; onShowHelp: (() => void) | null }
```

The four items, in order, exactly:

```ts
const STEPS = [
  'Listen to the groove 🎧',
  'Jam along 🎸',
  'Guess the Root & Mode 🎯',
  'Come back every day for a new challenge ⏭',
]
```

## Tracks

### Track A — The rule

- **Goal** — a tested pure function that says whether a record set belongs to
  someone new or long gone.
- **Owns** — `lib/puzzle/selectGroove.ts` and `selectGroove.test.ts`;
  `lib/persistence/streak.ts` and `streak.test.ts`; new
  `lib/persistence/lapsed.ts` and `lapsed.test.ts`.
- **Depends on** — nothing.
- **Parallel with** — Track B.
- **Done when** — its own tests pass, with no component rendered.

### Track B — The box and the question mark

- **Goal** — both components exist, are tested against their props, and the
  structural rules name them.
- **Owns** — new `components/intro/HowToPlay.tsx` and `HowToPlay.test.tsx`; new
  `components/header/HelpToggle.tsx` and `HelpToggle.test.tsx`;
  `src/features/daily-groove/structure.test.ts`.
- **Depends on** — the `STEPS` copy and the two prop contracts.
- **Parallel with** — Track A.
- **Done when** — its own tests pass, with nothing wired to the page.

### Track C — The wiring

- **Goal** — the right players see the box, closing hides it, the question mark
  brings it back.
- **Owns** — `hooks/useProgress.ts` and its two test files;
  `hooks/usePuzzleSession.ts` and `usePuzzleSession.test.ts`;
  `components/header/GrooveHeader.tsx` and `GrooveHeader.test.tsx`;
  `components/GroovePuzzle.tsx` and `GroovePuzzle.test.tsx`.
- **Depends on** — Track A's function and Track B's components, both as
  implementations.
- **Parallel with** — nothing.
- **Done when** — the feature tests pass through `renderFeature`.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B. Disjoint: one is `lib/`, the other is
  two new component folders plus the feature's structure test.
- **Wave 2:** Track C.
- **Wave 3:** Integration.

Epic 1 must have landed before Track C opens `GrooveHeader.tsx`, which is what
puts this epic in the roadmap's second wave.

## Implementation

### Track A — The rule

#### Step A1 — The noon-anchored parse is shared

Covers: R12 (support)

- **Test first** — `lib/puzzle/selectGroove.test.ts`: assert
  `parseIsoDate('2026-08-30')` returns a local `Date` whose `getFullYear`,
  `getMonth`, `getDate` are 2026, 7, 30 and whose `getHours()` is 12. Run it:
  fails with `parseIsoDate is not a function`.
- **Implement** — `lib/puzzle/selectGroove.ts`: export `parseIsoDate`, moved
  verbatim from `streak.ts`'s private copy, with its DST comment.
  `lib/persistence/streak.ts`: delete the private copy and import it.
- **Green when** — the new assertion passes and every existing `streak.test.ts`
  assertion stays green, unchanged — which is what proves the move was a move.
- **Refactor** — none. `previousDay` stays in `streak.ts`; only the shared half
  moved.

#### Step A2 — A player with nothing saved is new

Covers: R1, R13, R15

- **Test first** — new `lib/persistence/lapsed.test.ts`: assert
  `isNewOrLapsed([], '2026-08-31')` is `true`. Run it: fails with
  `Failed to resolve import "./lapsed"`.
- **Implement** — new `lib/persistence/lapsed.ts`: `LAPSE_DAYS = 31` and
  `isNewOrLapsed(results, today)` returning `true` for an empty array.
- **Green when** — it passes.
- **Refactor** — none.

#### Step A3 — Thirty-one days is the line

Covers: R2, R3, AC4

- **Test first** — `lapsed.test.ts`: with `today = '2026-08-31'`, assert
  `false` for a single record dated one day back; `false` at exactly 31 days
  back; `true` at 32 days back; `true` at 400 days back. Table-drive it, and
  include a record spanning a month boundary and one spanning a year boundary so
  the arithmetic is not silently calendar-month. Run it: fails with
  `expected true to be false` — the stub returns `true` for everything.
- **Implement** — `lapsed.ts`: take the maximum `date` string (ISO dates sort
  lexicographically, so `reduce` with `>` is correct and needs no parse), then
  `parseIsoDate` both ends, difference in milliseconds divided by 86 400 000,
  rounded, and return `diff > LAPSE_DAYS`.
- **Green when** — every row passes.
- **Refactor** — none.

#### Step A4 — A day you lost still counts as a visit

Covers: R12, AC12

- **Test first** — `lapsed.test.ts`: assert `false` for a single record dated
  yesterday with `solved: false`; `false` for one with `revealed: true`; and
  that a set whose *newest* record is unsolved but recent returns `false` even
  when an older solved record sits behind it. Run it: passes if A3 read `date`
  and nothing else; fails if it filtered on `solved`.
- **Implement** — none if A3 is correct. The step exists because "last attempted
  puzzle" reads as "last *solved*" to at least one implementer, and
  `isQualifying` is sitting right there in the next file.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step A5 — The rule touches no storage

Covers: R13

- **Test first** — `lapsed.test.ts`: assert `lapsed.ts`'s source names neither
  `localStorage` nor `daily-groove:`. Run it: passes. A pin — the function takes
  records as an argument and must never grow its own read.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

### Track B — The box and the question mark

#### Step B1 — The box lists the four steps

Covers: R4, R14, AC5

- **Test first** — new `components/intro/HowToPlay.test.tsx`: render
  `<HowToPlay onClose={() => {}} />`; assert the list items' `textContent`, in
  order, equal the four strings in `STEPS`; assert each emoji's element carries
  `aria-hidden="true"`, so the accessible name of each item is its words alone.
  Then pin the numbering and the prominence: the list is an `ol` and not a `ul`,
  carries `list-decimal`, no item's own text starts with a digit, every item is
  `text-[16px]` in `text-text` rather than `text-text-muted`, and the list
  carries `marker:text-accent`.
  Run it: fails with `Failed to resolve import "./HowToPlay"`.
- **Implement** — new `components/intro/HowToPlay.tsx`: a `Card tone="inset"`
  holding a `Heading level={2} size="sm"` reading `How to play`, an `<ol>` of the
  four items with each emoji in `<span aria-hidden="true">`, and a close button.
  The list carries `list-decimal … pl-6 marker:font-semibold marker:text-accent`
  and each item `text-[16px] font-medium leading-[1.5] text-text`: numbering
  from the marker keeps it out of the copy, and the items are the first thing a
  new player reads (R4a, R4b).
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B2 — It is an aside, not a third card

Covers: R5a, AC6a

- **Test first** — `HowToPlay.test.tsx`: assert the rendered root element's
  `className` contains `bg-surface-inset` and does not contain `bg-accent`. Note
  that `bg-surface` cannot be used as the negative — it is a substring of
  `bg-surface-inset`, so asserting its absence can never pass. Run it: passes if
  B1 used `tone="inset"`; fails with
  `expected "… bg-surface …" to contain "bg-surface-inset"` if it used the
  default raised card.
- **Implement** — none if B1 is correct.
- **Green when** — it passes.
- **Refactor** — none.

#### Step B3 — Closing and reopening are real buttons

Covers: R6, R8, R9, AC10

- **Test first** — `HowToPlay.test.tsx`: assert a button with the accessible
  name `Close how to play` exists, and that pressing it calls `onClose` once.
  New `components/header/HelpToggle.test.tsx`: assert a `button` with the
  accessible name `How to play` exists, that its visible text is `?`, that
  clicking calls `onShow` once, and that focusing it and pressing `Enter` calls
  it too — the keyboard path is the half a `<span onClick>` would fail. Run
  them: `HelpToggle` fails with `Failed to resolve import "./HelpToggle"`.
- **Implement** — the close button in `HowToPlay.tsx`; new
  `components/header/HelpToggle.tsx` rendering a native `<button type="button">`
  with `aria-label="How to play"` and `?` as its text.
- **Green when** — all assertions pass.
- **Refactor** — none. Neither control uses the design system's `Button`, which
  is the full-width call to action; both are small icon controls with their own
  geometry, as `ModeToggle` already is.

#### Step B4 — The tree names the new region

Covers: R5 (support)

- **Test first** — `src/features/daily-groove/structure.test.ts`: change the
  region-directory assertion from `['header', 'puzzle']` to
  `['header', 'intro', 'puzzle']`, add `intro: ['HowToPlay']` to `REGIONS`, and
  add `'HelpToggle'` to the `header` list. Run it: before B1/B3 it fails with
  `missing: intro/HowToPlay.tsx`; after them it is green — and it is what fails
  if either component is added without a colocated test.
- **Implement** — none beyond B1 and B3.
- **Green when** — all four structural assertions pass, including the reverse
  direction that forbids an undeclared component in a region.
- **Refactor** — none.

### Track C — The wiring

#### Step C1 — The hook reports who arrived

Covers: R1, R2, R3

- **Test first** — `hooks/useProgress.test.ts`: with an injected store returning
  no results, assert `newOrLapsed` is `true` once `loaded`; with one returning a
  record dated yesterday, assert it is `false`. Run it: fails with
  `expected undefined to be true`.
- **Implement** — `useProgress.ts`: add the `newOrLapsed` state and set it inside
  the existing `Promise.all().then()`, from `isNewOrLapsed(allResults, today)`;
  add it to `UseProgress` and to the returned object.
- **Green when** — both assertions pass and the existing streak and
  `recordAttempt` tests stay green.
- **Refactor** — none.

#### Step C2 — The answer is latched

Covers: R16

- **Test first** — `hooks/useProgress.test.ts`: with an empty store, assert
  `newOrLapsed` is `true`; then call `recordAttempt` with a day dated today and
  assert it is *still* `true` after the write settles, while `streak` has
  updated from the same write. Run it: fails with `expected false to be true` if
  the value was derived with `useMemo` over `all`; passes only for the latched
  form.
- **Implement** — none if C1 set it inside the load `.then()`. If it was written
  as a `useMemo` over `all`, this is the step that rewrites it.
- **Green when** — the boolean holds while the streak moves — one state, two
  behaviours, from the same write.
- **Refactor** — none.

#### Step C3 — Playing does not take the instructions away

Covers: R16, R17, AC15, AC16

- **Test first** — `usePuzzleSession.test.ts`: assert `newOrLapsed` is passed
  through from `useProgress` unchanged. Then in `GroovePuzzle.test.tsx`, via
  `renderFeature` with empty storage: assert the box is present, make a guess,
  and assert it is still present. Add the lapsed variant — seed a single record
  35 days back, render, assert present, guess, assert still present; then
  re-render fresh and assert absent, because the newest record is now today. Run
  it: fails with `expected element to be in the document` — the box disappears
  the moment the record lands — unless C2's latch is in place.
- **Implement** — `usePuzzleSession.ts`: destructure `newOrLapsed` from
  `useProgress` and return it in `UsePuzzleSession`.
- **Green when** — the box survives a guess in both variants and is gone on the
  next fresh render.
- **Refactor** — none.

#### Step C4 — The right players see it

Covers: R1, R2, R3, AC1, AC2, AC3

- **Test first** — `GroovePuzzle.test.tsx`, through `renderFeature`: empty
  storage → the box is present; a record dated yesterday → absent; a single
  record 35 days back → present. Assert on the box's heading, `How to play`. Run
  it: fails with `Unable to find … "How to play"` until C5 renders it.
- **Implement** — none yet; C5 is what makes it pass.
- **Green when** — after C5, all three cases hold.
- **Refactor** — none.

#### Step C5 — The box sits under the header

Covers: R5, R11, AC6, AC11

- **Test first** — `GroovePuzzle.test.tsx`: assert that in the DOM order the
  box's heading appears after the page's `<h1>` and before the groove card's
  level-2 heading — comparable with
  `Node.compareDocumentPosition` or by index in `container.querySelectorAll`.
  Then assert that on the first render, before the store promises settle, the
  box is absent — render without `settleFeature()` and assert
  `queryByText('How to play')` is null. Run it: the ordering assertion fails
  with `Unable to find … "How to play"`.
- **Implement** — `GroovePuzzle.tsx`: add
  `const [helpOverride, setHelpOverride] = useState<boolean | null>(null)`, take
  `newOrLapsed` from `usePuzzleSession`, compute
  `const showHelp = helpOverride ?? newOrLapsed`, and render
  `{showHelp && <HowToPlay onClose={() => setHelpOverride(false)} />}` directly
  after `<GrooveHeader />` and before the audio-error alert.
- **Green when** — C4 and C5 both pass. The pre-hydration case needs no new
  guard: `GroovePuzzleView` already returns `PuzzleLoading` until `hydrated`.
- **Refactor** — none.

#### Step C6 — Close it, and get it back

Covers: R6, R7, R8, R10, AC7, AC8, AC9, AC10

- **Test first** — `GrooveHeader.test.tsx`: assert the header renders a button
  named `How to play` and that pressing it calls the `onShowHelp` prop; update
  the props-list assertion from `['streak']` to `['streak', 'onShowHelp']`.
  `GroovePuzzle.test.tsx`, through `renderFeature`: with empty storage, press
  `Close how to play` and assert the box is gone; press `How to play` and assert
  it is back. With a record dated yesterday, assert the question mark is present
  while the box is not, press it, and assert the box appears. Reload — a second
  `renderFeature` against the same storage — and assert the box follows the rule
  again rather than remembering the close. Add the visibility pair: with the box
  up the question mark is absent; closing the box makes it appear; pressing it
  brings the box back and takes the question mark away again. And in
  `GrooveHeader.test.tsx`, assert the toggle is the tagline paragraph's last
  element child, and that `onShowHelp={null}` renders no toggle while leaving
  the tagline intact. Run them: the header test fails with
  `Unable to find … "How to play"`.
- **Implement** — `GrooveHeader.tsx`: add `onShowHelp: (() => void) | null` to
  its props and render `{onShowHelp && <HelpToggle onShow={onShowHelp} />}`
  *inside* the tagline's `Text`, immediately after `{TAGLINE}{' '}`. A `button`
  is phrasing content, so it is valid inside the paragraph, and being inside is
  what makes it follow the final full stop wherever the sentence wraps — beside
  the paragraph it reads as misplaced. `HelpToggle` carries `align-middle` to
  seat it against the text.
  `GroovePuzzle.tsx`: pass `onShowHelp={showHelp ? null : handleShowHelp}`, so
  the control is absent exactly while the box is up.
- **Green when** — every case passes, including the question mark being present
  for a returning player (R10).
- **Refactor** — none.

#### Step C7 — Nothing new is written

Covers: R7, R13, AC13

- **Test first** — `GroovePuzzle.test.tsx`: with empty storage, render, close
  the box, reopen it, close it again, then assert
  `Object.keys(localStorage)` contains no key beyond
  `daily-groove:v2:results` and `daily-groove:v1:prefs`. Run it: passes. The pin
  is against a later "remember the dismissal" that quietly adds a third key.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

#### Step C8 — A broken store still explains the game

Covers: R15, AC14

- **Test first** — `GroovePuzzle.test.tsx`: spy on `localStorage.getItem` to
  throw, render through `renderFeature`, and assert the box is shown and nothing
  threw. Run it: passes — `createLocalStore` already falls back to an empty
  envelope, and an empty record set is a new player by A2.
- **Implement** — none.
- **Green when** — it passes and no unhandled rejection appears.
- **Refactor** — none.

## Integration and verification

- **Step I1 — the suite.** `npm test`, `npm run lint`, `npx tsc --noEmit`,
  `npm run build`.
- **Step I2 — the new player.** Clear site data, `npm run dev`, reload: the box
  is under the header, above the cards, on the recessed surface, with the four
  items. Play and guess — it stays. Close it — it goes. Press the question mark —
  it returns.
- **Step I3 — the regular.** Solve a day, reload: no box, question mark present,
  press it and the box appears.
- **Step I4 — the returning player.** Hand-edit `daily-groove:v2:results` so its
  only record is 35 days old, reload: the box is back.
- **Step I5 — keyboard.** Tab from the top of the page: the question mark takes
  focus, `Enter` opens the box, the close button is reachable and closes it.
- **Step I6 — both themes.** The inset surface and its text read correctly in
  light and dark; the box does not overlap the header at 375px.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, C1, C4 |
| R2 | A3, C1, C4 |
| R3 | A3, C1, C4 |
| R4 | B1 |
| R4a | B1 |
| R4b | B1 |
| R5 | B4, C5 |
| R5a | B2 |
| R6 | B3, C6 |
| R7 | C6, C7 |
| R8 | B3, C6 |
| R9 | B3, C6 |
| R10 | C6 |
| AC9a | C6 |
| AC9b | C6 |
| R11 | C5 |
| R12 | A1, A4 |
| R13 | A2, A5, C7 |
| R14 | B1 |
| R15 | A2, C8 |
| R16 | C2, C3 |
| R17 | C3 |
| AC1 | C4 |
| AC2 | C4 |
| AC3 | C4 |
| AC4 | A3 |
| AC5 | B1 |
| AC5a | B1 |
| AC5b | B1 |
| AC6 | C5 |
| AC6a | B2 |
| AC7 | C6 |
| AC8 | C6 |
| AC9 | C6 |
| AC10 | B3, C6 |
| AC11 | C5 |
| AC12 | A4 |
| AC13 | C7 |
| AC14 | C8 |
| AC15 | C3 |
| AC16 | C3 |

## Assumptions

- `parseIsoDate` moves to `lib/puzzle/selectGroove.ts` rather than to a new
  module, because `isoDate` is already there and both `streak.ts` and
  `theory/music.ts` already import their date helpers from it.
- The day difference is computed from two noon-anchored dates, so a DST shift
  cannot round a 31-day gap to 32.
- ISO `YYYY-MM-DD` strings sort lexicographically, so the newest record is found
  with a string comparison and no parsing.
- The close control's accessible name is `Close how to play`; the question mark's
  is `How to play`, as the PRD requires.
- Neither new control uses the design system's `Button`, which is the page's
  full-width call to action. Both are small controls with their own geometry,
  following `ModeToggle`.
- `HowToPlay`'s heading is a level-2 at the small size, matching `GuessCard`'s
  own heading level rather than competing with the masthead.
- The numbers are the `ol`'s own markers, styled with the `marker:` variant, not
  spans in the copy — so `STEPS` stays the one source of each item's wording and
  a screen reader announces the position itself.
- The four strings live in `HowToPlay.tsx` as a module constant. They are the
  box's own copy and nothing else reads them. Each is split at its last space at
  render time so the emoji lands inside its own `aria-hidden` span without being
  re-typed — the item's `textContent` then matches the constant byte for byte.
- `Card` takes no ARIA props, so the box's root is a plain `div` rather than an
  `aside` landmark. Every query for it goes through its `How to play` heading,
  which is what Steps C4 and C5 already do.
