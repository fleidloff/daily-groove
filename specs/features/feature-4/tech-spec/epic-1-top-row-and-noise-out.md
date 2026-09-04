# Tech spec — Epic 1: Date, title and streak in the top row; noise out of the cards

PRD: [../prd/epic-1-top-row-and-noise-out.md](../prd/epic-1-top-row-and-noise-out.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Five presentational components change and nothing else does. No logic moves, no
props change shape, no data is derived differently — every value on screen is
one the page already had, rendered somewhere else or not at all. That makes the
epic three fully independent tracks (header, groove card, guess card) plus one
integration step for the two test files that assert across the whole page.

The only genuinely new code is the date's single-line format. Everything else is
deletion or relocation, which is why most steps here are red-green on an
assertion that a string is *absent*.

## Architecture

`GrooveHeader` keeps its `{ date, streak }` props and its module-level `Intl`
formatters, but composes them into one string instead of rendering two elements.
The en-GB pin stays: the viewer's calendar day is still their own, only its
wording is fixed, and pinning is what makes the exact-string assertions in the
tests stable across CI locales.

Nothing in this epic reads the clock, the store or the catalogue. Every
component remains a pure function of its props, which is what lets all three
tracks be tested in isolation.

## Contracts

Frozen — no track may change these, and Epics 2 and 4 build against them
concurrently:

```ts
// unchanged, all of them
GrooveHeader:    { date: Date; streak: number }
StreakBadge:     { streak: number }
GrooveCard:      { groove: Groove; children?: ReactNode }
TransportPanel:  { position: number; isPlaying: boolean }
AttemptDots:     { states: DotState[] }
```

`Groove` keeps its `bpm` field. It stops being rendered; it is not removed from
the type, the generator, or the seed data.

The rendered date string, exactly: `"Saturday, 29 August"` — weekday, comma and
space, day, space, month. This is what AC1a asserts, so it is a contract, not a
formatting detail.

## Tracks

### Track A — Header

- **Goal** — the top row reads *date · Daily Groove · "N days streak"*.
- **Owns** — `src/features/daily-groove/components/GrooveHeader.tsx`,
  `GrooveHeader.test.tsx`, `StreakBadge.tsx`, `StreakBadge.test.tsx`
- **Depends on** — nothing
- **Parallel with** — Tracks B, C
- **Done when** — its own tests pass with B and C untouched.

### Track B — Groove card chrome

- **Goal** — no BPM readout, no bar labels; the inset card and the progress
  track stay.
- **Owns** — `src/features/daily-groove/components/GrooveCard.tsx`,
  `GrooveCard.test.tsx`, `TransportPanel.tsx`, `TransportPanel.test.tsx`
- **Depends on** — nothing
- **Parallel with** — Tracks A, C
- **Done when** — its own tests pass.

### Track C — Guess card dots

- **Goal** — the attempt dots sit above the check button, alone.
- **Owns** — `src/features/daily-groove/components/GuessCard.tsx`,
  `GuessCard.test.tsx`
- **Depends on** — nothing
- **Parallel with** — Tracks A, B
- **Done when** — its own tests pass.

### Track D — Integration

- **Goal** — the two page-level test files no longer assert what this epic
  removed.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.test.tsx`,
  `src/app/page.test.tsx`
- **Depends on** — A, B and C all landed
- **Done when** — the full suite is green.

**These two files are the epic's only serialization point, and they are shared
with Epics 2 and 4 in the same wave.** Both assert page-wide chrome that three
epics are changing at once. Track D must not run concurrently with the
equivalent integration track in Epic 2 or Epic 4.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Track D — integration

## Implementation

### Track A — Header

#### Step A1 — The page is titled "Daily Groove"

Covers: R2, AC2

- **Test first** — `GrooveHeader.test.tsx`: change the existing
  `sets the page title` case to assert
  `screen.getByRole('heading', { level: 1, name: 'Daily Groove' })`. Run it:
  fails with `Unable to find an accessible element with the role "heading" and
  name "Daily Groove"`.
- **Implement** — `GrooveHeader.tsx`: change the `<Heading level={1}>` child
  from `Today&apos;s groove` to `Daily Groove`.
- **Green when** — that assertion passes; no other header test regresses.
- **Refactor** — none.

#### Step A2 — The date reads as one line

Covers: R1a, AC1a

- **Test first** — `GrooveHeader.test.tsx`: replace the two assertions in
  `shows the weekday and the day and month it was given` with
  `expect(screen.getByText('Saturday, 29 August')).toBeInTheDocument()`, and add
  `expect(screen.queryByText('Saturday')).toBeNull()` to prove the weekday is no
  longer its own element. Run it: fails with `Unable to find an element with the
  text: Saturday, 29 August`.
- **Implement** — `GrooveHeader.tsx`: add
  `const DATE_LINE = (d: Date) => \`${WEEKDAY.format(d)}, ${DAY_MONTH.format(d)}\``
  and render a single `<span>` with `DATE_LINE(date)` in place of the
  `EyebrowLabel` + `<span>` stack.
- **Green when** — both assertions pass, and the second existing case
  (`formats a different date from the same props`) is updated to
  `'Thursday, 1 January'` and passes.
- **Refactor** — none. Two formatters composed beats one `Intl` call, because
  en-GB's combined weekday/day/month format omits the comma the contract
  requires.

#### Step A3 — The wordmark cluster is gone and the date leads the row

Covers: R1, AC1

- **Test first** — `GrooveHeader.test.tsx`: change the existing
  `carries the brand mark and the wordmark` case to
  `expect(screen.queryByText('daily-groove')).toBeNull()` and rename it to
  `drops the wordmark in favour of the date`. Run it: fails, because
  `daily-groove` is still rendered.
- **Implement** — `GrooveHeader.tsx`: delete the left-hand `Row` containing the
  accent dot `<span>` and the `EyebrowLabel`, and the `aria-hidden` divider
  `<span>` from the right cluster. The date line from A2 becomes the left child
  of the outer `Row`; the right child is `<StreakBadge>` alone.
- **Green when** — the assertion passes and the streak badge case still passes.
- **Refactor** — none.

> The divider's removal has no assertion. It is an `aria-hidden` presentational
> span, and asserting its absence would mean querying by class — the kind of
> implementation-detail test `docs/testing.md` rules out. It is covered by
> review and by the demo path.

#### Step A4 — The streak badge reads "N days streak"

Covers: R3, AC3

- **Test first** — `StreakBadge.test.tsx`: assert a streak of 3 renders text
  `'3 days streak'` and a streak of 1 renders `'1 day streak'`. Run it: fails —
  the current text is `'3 days'` / `'1 day'`.
- **Implement** — `StreakBadge.tsx`: change the non-zero branch of `label` to
  `` `${streak} day${streak === 1 ? '' : 's'} streak` ``.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A5 — A zero streak still reads "No streak yet"

Covers: R4, AC4

- **Regression guard, not a red-green step.** The zero branch already produces
  this string; A4 edits the line directly above it, and this pins the branch A4
  must not disturb.
- **Test** — `StreakBadge.test.tsx`: assert a streak of 0 renders
  `'No streak yet'`. It passes before and after A4.
- **Green when** — it passes alongside A4's assertions.

### Track B — Groove card chrome

#### Step B1 — The groove card shows no tempo

Covers: R5, AC5

- **Test first** — `GrooveCard.test.tsx`: render with a groove whose `bpm` is
  `96` and assert `expect(screen.queryByText('96')).toBeNull()` and
  `expect(screen.queryByText('BPM')).toBeNull()`, keeping the existing
  assertion that the groove's name renders. Run it: fails — both are found.
- **Implement** — `GrooveCard.tsx`: delete the right-hand `<div className="text-right">`
  block containing the bpm `<span>` and the `<EyebrowLabel>BPM</EyebrowLabel>`.
  The header `Row` collapses to the `<Heading>` alone.
- **Green when** — both `queryByText` assertions return null and the name still
  renders.
- **Refactor** — the surrounding `Row` now wraps a single child; replace it with
  the `<Heading>` directly.

#### Step B2 — The transport panel shows the track alone

Covers: R6, AC6

- **Test first** — `TransportPanel.test.tsx`: assert
  `expect(screen.queryByText(/^BAR /)).toBeNull()` and that
  `screen.getByRole('progressbar')` is still present. Run it: fails — four
  `BAR n` labels are found.
- **Implement** — `TransportPanel.tsx`: delete the `<Row>` of bar-label
  `<span>`s and the `BARS` constant. Keep `Card tone="inset"`, `ProgressTrack`,
  `BAR_COUNT` and `soundingBar` — the track still takes `segments` and
  `activeSegment`.
- **Green when** — no `BAR` text renders and the progress bar remains inside the
  inset card.
- **Refactor** — the `Stack` now wraps one child; replace it with
  `<ProgressTrack>` directly inside the `<Card>`. Keep `soundingBar`: the
  active-segment highlight on the track still uses it.

### Track C — Guess card dots

#### Step C1 — The dots sit above the check button, alone

Covers: R7, R7a, AC7

- **Test first** — `GuessCard.test.tsx`: assert the heading row no longer holds
  the dots —
  `expect(within(screen.getByRole('heading', { level: 3 }).parentElement!).queryByRole('img')).toBeNull()`
  — and that the dots container is the check button's immediately preceding
  sibling:
  `expect(screen.getByRole('button', { name: /Pick a root|Check /}).previousElementSibling!.querySelectorAll('[data-dot-state]')).toHaveLength(3)`.
  Run it: fails — the dots are still inside the heading row.
- **Implement** — `GuessCard.tsx`: remove `<AttemptDots>` from the heading
  `<Row>` (which collapses to the `<Heading>` alone) and insert
  `<div className="flex justify-end"><AttemptDots states={dots} /></div>`
  immediately before the `<Button>`.
- **Green when** — both assertions pass and the existing guess-flow cases stay
  green.
- **Refactor** — the heading `Row` now wraps one child; replace it with the
  `<Heading>` directly.

> `[data-dot-state]` is the established handle for these dots — `page.test.tsx`
> already queries by it — so this is a repo convention, not a new
> implementation-detail dependency.

#### Step C2 — The dots row carries no label

Covers: R7a, AC7

- **Test first** — `GuessCard.test.tsx`: assert the dots' wrapper has no text —
  `expect(dotsWrapper.textContent).toBe('')`. Run it: passes immediately if C1
  added no label.
- **Regression guard.** It exists to stop a later change adding "2 of 3" beside
  the dots, which R7a rules out. State it as a guard in the test name.

#### Step C3 — The dots keep their accessible name

Covers: R8, AC8

- **Regression guard, not a red-green step.** `AttemptDots` is unchanged, so
  this passes before the epic starts; it pins the property the move must not
  cost.
- **Test** — `GuessCard.test.tsx`: with two spent dots, assert
  `screen.getByRole('img', { name: '2 of 3 attempts spent' })`.
- **Green when** — it passes after C1.

### Track D — Integration

#### Step D1 — The page test stops asserting the removed chrome

Covers: R1, R5, AC1, AC5

- **Test first** — `src/app/page.test.tsx`: in
  `renders the designed shell…`, replace
  `expect(screen.getByText("daily-groove"))` with
  `expect(screen.queryByText("daily-groove")).toBeNull()`. In
  `shows today's groove card and its transport`, delete the
  `String(groove.bpm)` and `"BPM"` assertions, keeping the `progressbar` one.
  Run the file: the edited assertions fail against the pre-epic components and
  pass once A and B have landed.
- **Implement** — no source change. This step exists because these assertions
  encode the old requirements.
- **Green when** — `npm test src/app/page.test.tsx` is green.
- **Refactor** — none.

#### Step D2 — The puzzle test stops asserting the removed chrome

Covers: R1, R2, R5, R6

- **Test first** — `GroovePuzzle.test.tsx`: update
  `renders the groove card header and the transport (D1, D2)` to drop its bpm
  expectations; update `moves the bar highlight with the player's position
  (D5, AC8)` to assert the active segment through `ProgressTrack`'s
  `activeSegment` rendering rather than through `BAR n` label text; update
  `renders the header with the streak beside the puzzle (D3, D4)` for the new
  title, date line and badge wording.
- **Implement** — no source change.
- **Green when** — `npm test` is green across the whole suite.
- **Refactor** — none.

## Integration and verification

- Run `npm test`. Every suite green, including the three tracks' own files.
- Run `npm run lint` and `npm run build` — the removals leave unused imports
  (`EyebrowLabel` in `GrooveCard`, `Row` where a `Stack` collapsed), and lint is
  what catches them.
- Demo path, from the PRD: load the page. Top row shows "Saturday, 29 August" on
  the left and the streak on the right, with no wordmark and no divider between
  date and badge. The title reads "Daily Groove". The groove card shows the
  name and no tempo. The progress bar sits in its inset card with no labels
  beneath it. Make one wrong guess: the dots tick, sitting directly above the
  check button.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A3, D1 |
| R1a | A2 |
| R2 | A1, D2 |
| R3 | A4 |
| R4 | A5 |
| R5 | B1, D1, D2 |
| R6 | B2, D2 |
| R7 | C1 |
| R7a | C1, C2 |
| R8 | C3 |
| R9 | Contracts (no component gains a data source; enforced by the props staying frozen) |
| AC1 | A3, D1 |
| AC1a | A2 |
| AC2 | A1 |
| AC3 | A4 |
| AC4 | A5 |
| AC5 | B1, D1 |
| AC6 | B2 |
| AC7 | C1, C2 |
| AC8 | C3 |

## Assumptions

- The date is composed from the two existing `Intl` formatters joined with
  `", "`, rather than a single `Intl` call — en-GB's combined format omits the
  comma the contract specifies.
- The accent dot beside the wordmark goes with it; nothing replaces it.
- On a narrow viewport the top row keeps its existing `collapseBelow="sm"`
  stacking, date above badge.
- Tests that asserted the removed strings are edited in place rather than
  deleted, so the diff shows a requirement changing rather than coverage
  disappearing.
- No visual-regression tooling exists in this repo, so the divider's removal and
  the dots' new alignment are verified by the demo path, not by an assertion.
