# Tech spec — Epic 1: The page says what it is

PRD: [../prd/epic-1-the-page-says-what-it-is.md](../prd/epic-1-the-page-says-what-it-is.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two words change and one line arrives, but they land in two layers that must not
drift: the document's metadata and the feature's header. So the app name and the
tagline become two exported constants, and both layers import them — the tab
title and the masthead are then provably the same word, and the meta description
and the subtitle provably the same sentence.

Everything else is subtraction. The header's date line goes, and with it
`GrooveHeader`'s `date` prop, because the groove card has carried the day beside
the tempo since feature-7. That makes the header a pure function of the streak,
and leaves three existing assertions to invert rather than delete.

The work splits cleanly in two: the feature's header and its caller, and the
route's metadata. They share only the constants, which is why those are frozen
first.

## Architecture

The header's left column loses its top line and gains its bottom one:

```
header
└── Row gap="lg" justify="between" collapseBelow="sm"
    ├── Stack gap="xs"
    │   ├── <span> dateLine(date)          ← REMOVED
    │   ├── Heading level={1} size="xl"    ← APP_NAME  (was "Daily Groove")
    │   └── Text tone="muted"              ← TAGLINE   (new)
    └── StreakBadge                        (unchanged)
```

`Heading`'s `FAMILY` table already makes `size="xl"` the only size set in the
Petaluma face, so the masthead keeps its hand-lettered look with no change at
the call site. The tagline is `Text`, not a smaller `Heading`: a 110-character
sentence in a jazz hand is a smear, and a second heading would add a level to
the document outline that the page does not have.

**Where the words live.** `src/lib/branding.ts` — a leaf module importing
nothing, which both `src/app/layout.tsx` and the feature's header may import.
`docs/architecture.md` says anything two slices need moves *up* into `src/lib`,
and this is the smallest possible instance of that: two strings needed by the
document and by the feature. It also keeps the feature removable — deleting
`src/features/daily-groove/` leaves `layout.tsx` importing a module that is
still there, which would not be true if the feature exported the strings.

**What this supersedes.** Feature-4 Epic 1 R1 put the date on the left of the
header's top row, and feature-7 Epic 2 AC7 asserted the day appears *twice* —
header and card — spelled identically by one formatter. The second is what makes
removing the first safe: `lib/presentation/date.ts` is untouched and keeps its
single-formatter guarantee with one caller instead of two.

## Contracts

Frozen before the tracks start. Track A imports them for the header; Track B
imports them for the metadata.

```ts
// src/lib/branding.ts
export const APP_NAME = 'Eardle'
export const TAGLINE =
  "Wordle for your ears. Listen to today's groove, figure out the key, and test your musicianship daily."
```

```ts
// src/features/daily-groove/components/header/GrooveHeader.tsx
type GrooveHeaderProps = {
  streak: number      // `date` is removed
}
```

The feature's landmark name is `APP_NAME` in both branches of `GroovePuzzle`,
held in one module-level constant so the loading state and the loaded state
cannot disagree.

## Tracks

### Step 0 — Freeze the words

Before either track starts, `src/lib/branding.ts` exists with the two exports
above. It has no test of its own: a test asserting a constant equals its own
literal proves nothing. The assertions that matter are Track A's (the masthead
renders it) and Track B's (the metadata declares it), and both compare against
the imported constant, so a change to either string moves both call sites at
once.

### Track A — The masthead

- **Goal** — the header reads `Eardle` over the tagline, with no date, and its
  only prop is the streak; the landmark is named `Eardle` in both branches.
- **Owns** — `src/features/daily-groove/components/header/GrooveHeader.tsx` and
  `GrooveHeader.test.tsx`; `src/features/daily-groove/components/GroovePuzzle.tsx`
  and `GroovePuzzle.test.tsx`; `src/app/page.test.tsx`.
- **Depends on** — Step 0's constants.
- **Parallel with** — Track B.
- **Done when** — its own tests pass without Track B existing.

`page.test.tsx` belongs here rather than to Track B because the assertion it
carries is about the `<h1>`, which is Track A's subject. Track B never opens it.

### Track B — The document

- **Goal** — the tab title and the meta description name the app and state its
  pitch.
- **Owns** — `src/app/layout.tsx` and `src/app/layout.test.ts`.
- **Depends on** — Step 0's constants.
- **Parallel with** — Track A.
- **Done when** — its own tests pass without Track A existing.

## Execution waves

- **Step 0:** `src/lib/branding.ts`. Minutes, and both tracks import it.
- **Wave 1 (parallel):** Track A, Track B. Disjoint file sets, no shared test
  file, no ordering between them.
- **Wave 2:** Integration — full suite, then the demo path.

## Implementation

### Track A — The masthead

#### Step A1 — The masthead reads Eardle

Covers: R1, R2, AC1, AC2

- **Test first** — `GrooveHeader.test.tsx`: change the two existing assertions
  naming `'Daily Groove'` to `APP_NAME`, imported from `@/lib/branding`. Run it:
  fails with `Unable to find an accessible element with the role "heading" and
  name "Eardle"`.
- **Implement** — `GrooveHeader.tsx`: import `APP_NAME` and render it as the
  `Heading level={1} size="xl"` child in place of the literal.
- **Green when** — the header's own tests pass. `page.test.tsx` and
  `GroovePuzzle.test.tsx` are now red on the same word — Step A2 is what makes
  them green, and they are red for exactly one reason.
- **Refactor** — none.

#### Step A2 — Its callers agree

Covers: R1, R2, AC1, AC2

- **Test first** — `src/app/page.test.tsx`: change
  `getByRole("heading", { level: 1, name: "Daily Groove" })` to use `APP_NAME`.
  `GroovePuzzle.test.tsx`: the same at both of its level-1 heading assertions
  (the display-face assertion, which reads `.className` off the heading, and the
  composed-header assertion). Run them: they were already failing from A1 and now
  fail only if the constant was mistyped.
- **Implement** — none. The production change landed in A1.
- **Green when** — the whole suite is green on the name, including the assertion
  that the masthead still carries the `font-jazz` class (AC2), which must keep
  passing on the new word.
- **Refactor** — none.

#### Step A3 — The tagline sits under the name

Covers: R3, R4, AC3, AC4

- **Test first** — `GrooveHeader.test.tsx`: assert `screen.getByText(TAGLINE)`
  is in the document; assert
  `screen.getByRole('heading', { level: 1 })` has the accessible name `APP_NAME`
  and nothing more; assert
  `screen.queryByRole('heading', { name: TAGLINE })` is null. Run it: fails with
  `Unable to find an element with the text: Wordle for your ears. …`.
- **Implement** — `GrooveHeader.tsx`: below the `Heading`, inside the same
  `Stack`, add `<Text tone="muted">{TAGLINE}</Text>`, importing `Text` from
  `@/components/typography/Text`.
- **Green when** — all three assertions pass.
- **Refactor** — none. The apostrophe in "today's" needs no JSX escaping,
  because the sentence arrives as an imported string rather than as JSX text.

#### Step A4 — The tagline is body copy

Covers: R5, AC8

- **Test first** — `GrooveHeader.test.tsx`: assert the tagline's element has
  `tagName` `'P'` and a `className` containing `text-text-muted`. Run it: passes
  if A3 used `Text tone="muted"`; fails with `expected "SPAN" to be "P"` if the
  tagline was hand-rolled as a styled span.
- **Implement** — none if A3 is correct. The step exists to pin the primitive,
  because "a line under the title" is the kind of instruction that gets
  implemented as another `<span>` with a size class.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A5 — The date leaves the header

Covers: R11, AC9

- **Test first** — `GrooveHeader.test.tsx`: invert the date assertions. The
  wordmark test keeps its `queryByText('daily-groove')` half and its date half
  becomes `expect(screen.queryByText('Saturday, 29 August')).toBeNull()`; the
  one-line date test becomes an assertion that neither `'Saturday, 29 August'`
  nor `'Saturday'` is present; the "formats a different date from the same
  props" test is deleted outright, because its subject — the header formatting a
  day — no longer exists, and `lib/presentation/date.test.ts` and
  `GrooveCard.test.tsx` already own the assertion that the day is formatted and
  shown. Run it: fails with `expected element to be null`.
- **Implement** — `GrooveHeader.tsx`: delete the `<span>` carrying
  `dateLine(date)` and the `dateLine` import.
- **Green when** — the header renders no date. `lib/presentation/date.ts` is
  untouched and its own tests stay green.
- **Refactor** — none.

#### Step A6 — The header's only prop is the streak

Covers: R12, AC10

- **Test first** — `GrooveHeader.test.tsx`: read the component's source and
  assert its props, in the manner `src/components/structure.test.ts` already
  uses for `PlayControl` — match `type GrooveHeaderProps = \{([\s\S]*?)\n\}` and
  assert the captured prop names equal `['streak']`. Then drop `date={DATE}`
  from every `render(<GrooveHeader … />)` in the file. Run it: fails with
  `expected [ 'date', 'streak' ] to deeply equal [ 'streak' ]`.
- **Implement** — `GrooveHeader.tsx`: remove `date` from `GrooveHeaderProps` and
  from the signature, along with its doc comment.
  `GroovePuzzle.tsx`: the call site becomes `<GrooveHeader streak={streak} />`.
  `today` stays where it is — `GrooveCard` still receives it.
- **Green when** — the props assertion passes and the type-check is clean.
- **Refactor** — none.

#### Step A7 — The page shows the day exactly once

Covers: R13, AC11

- **Test first** — `GroovePuzzle.test.tsx`: change
  `expect(screen.getAllByText(new RegExp(dateLine(new Date())))).toHaveLength(2)`
  to `toHaveLength(1)`, and update its comment, which currently explains why the
  day appears twice. Then fix the two assertions that matched the header's exact
  string: the composed-header test's `getByText('Saturday, 29 August')` becomes
  `expect(screen.queryByText('Saturday, 29 August')).toBeNull()` plus
  `expect(screen.getByText(/· Saturday, 29 August$/)).toBeInTheDocument()`, and
  the day-agreement test's `getByText('Saturday, 29 August')` — commented "the
  header renders the day" — becomes the same regex against the card's caption,
  with the comment corrected. Run them: before A5 they fail with
  `expected length 2`; after A5 the exact-string ones fail with
  `Unable to find an element with the text: Saturday, 29 August`, because the
  card's node reads `98 bpm · Saturday, 29 August` in full.
- **Implement** — none. This step is the regression pin: it is what fails if
  someone puts the header's date back.
- **Green when** — the day is found once, on the card.
- **Refactor** — none.

#### Step A8 — The landmark is named for the app

Covers: R8, AC6

- **Test first** — `GroovePuzzle.test.tsx`: change
  `screen.getByRole('region', { name: 'Daily Groove' })` to `APP_NAME`, and add
  an assertion that the loading branch — rendered before the store settles —
  exposes a region with the same name. Run it: fails with
  `Unable to find an accessible element with the role "region" and name
  "Eardle"`.
- **Implement** — `GroovePuzzle.tsx`: add a module-level
  `const REGION_LABEL = APP_NAME` and use it in both `<section aria-label=…>`
  occurrences, so the two branches cannot drift.
- **Green when** — both branches expose the region under the new name.
- **Refactor** — none.

#### Step A9 — Nothing stored moves

Covers: R9, AC7

- **Test first** — `GroovePuzzle.test.tsx`: seed `localStorage` under
  `daily-groove:v2:results` with a run of solved days, render, and assert the
  streak badge reports that run. Run it: passes — no key changed. The step is a
  regression pin against a future "rename everything" sweep.
- **Implement** — none.
- **Green when** — the streak is unchanged and the key is still
  `daily-groove:v2:results`.
- **Refactor** — none.

### Track B — The document

#### Step B1 — The tab says Eardle

Covers: R6, AC5

- **Test first** — `src/app/layout.test.ts`: assert the source matches
  `/title:\s*APP_NAME/` and that it no longer contains the string
  `'Daily Groove'`. Run it: fails with the current `title: "Daily Groove"`.
- **Implement** — `src/app/layout.tsx`: import `APP_NAME` from `@/lib/branding`
  and set `title: APP_NAME` in the exported `metadata`.
- **Green when** — the assertion passes and the existing
  `still exports metadata and takes LayoutProps<"/">` test stays green.
- **Refactor** — none.

#### Step B2 — The description is the tagline

Covers: R7, AC5

- **Test first** — `src/app/layout.test.ts`: assert the source matches
  `/description:\s*TAGLINE/`, and that it no longer contains the old
  `"Guess today's groove"` sentence. Run it: fails.
- **Implement** — `layout.tsx`: import `TAGLINE` and set `description: TAGLINE`.
- **Green when** — both assertions pass.
- **Refactor** — none. The file's other rules — no layout utilities, no
  third-party font host, three `display: 'swap'` declarations — are untouched
  and their tests stay green.

## Integration and verification

- **Step I1 — the suite.** `npm test`, `npm run lint`, `npx tsc --noEmit`, and
  `npm run build`. The type-check is what catches a missed `date={today}` at the
  header's call site; lint is what catches an unused `dateLine` import.
- **Step I2 — the demo path.** `npm run dev`. The masthead reads *Eardle* in the
  hand-lettered face, the tagline sits under it in muted body type, no date
  appears above or beside them, the streak is still at the right, and the groove
  card still reads `98 bpm · <today>`. The browser tab reads *Eardle*.
- **Step I3 — the returning player.** With a `daily-groove:v2:results` blob from
  before the rename in `localStorage`, reload: the streak is unchanged.
- **Step I4 — narrow viewport.** Below `sm` the header stacks; the tagline wraps
  to three lines and nothing is clipped or scrolls sideways (R10).

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2 |
| R2 | A1, A2 |
| R3 | A3 |
| R4 | A3 |
| R5 | A4 |
| R6 | B1 |
| R7 | B2 |
| R8 | A8 |
| R9 | A9 |
| R10 | I4 |
| R11 | A5 |
| R12 | A6 |
| R13 | A7 |
| AC1 | A1, A2 |
| AC2 | A1, A2 |
| AC3 | A3 |
| AC4 | A3 |
| AC5 | B1, B2 |
| AC6 | A8 |
| AC7 | A9 |
| AC8 | A4 |
| AC9 | A5 |
| AC10 | A6 |
| AC11 | A7 |

R10 is verified by eye at I4 rather than by an assertion: it is a statement
about wrapping at a viewport width, which jsdom does not lay out.

## Assumptions

- `layout.test.ts` reads `layout.tsx` as source text rather than importing the
  module, following the file's existing precedent — importing it would pull
  `next/font/google` into the test environment.
- The tab title is `APP_NAME` alone, with no tagline appended.
- No `og:` or Twitter-card metadata is added; the route has none today.
- `GroovePuzzle.test.tsx`'s existing groove fixture supplies the tempo used in
  the `· Saturday, 29 August` assertions; the exact number is whatever the
  fixture already carries.
- The `Stack gap="xs"` between the heading and the tagline is kept as-is. The
  gap that suited a date over a title suits a title over a line of copy.
- Adding a module to `src/lib/` trips no structural test. `src/lib/hash.test.ts`
  only pins where the FNV constant lives, and `scripts/grooves/boundary.test.ts`
  pins which `src/lib/` modules the *generator* imports — `groove.ts` and
  `hash.ts`, an exact list that `branding.ts` does not join, because nothing
  under `scripts/` imports it.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-31

**Q1. Where do the app name and the tagline live?**
Decision: **A) `src/lib/branding.ts`, exporting `APP_NAME` and `TAGLINE`,
imported by both layers** — `docs/architecture.md` says anything two slices need
moves up into `src/lib`, and a leaf module keeps the feature removable, which
exporting the strings from the feature's `index.ts` would not: the root layout
would then break when `src/features/daily-groove/` is deleted. Reversing this
costs both call sites and both test files, and nothing structural.
Changed: nothing — the spec was drafted against this option. It fixes Step 0,
the `Contracts` block, and the imports named in Steps A1, A3, B1 and B2 as
written.
