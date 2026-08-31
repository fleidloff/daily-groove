# PRD — Epic 1: The page says what it is

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The app gets a name and a one-line pitch. The masthead reads **Eardle**, and
under it, in body type: *"Wordle for your ears. Listen to today's groove, figure
out the key, and test your musicianship daily."* The date leaves the header,
which the groove card has been carrying beside the tempo since feature-7, so the
header is name-then-pitch and nothing else. The browser tab, the page description
and the feature's landmark follow the same name.

## Problem

A first-time visitor lands on a page headed "Daily Groove" and is told nothing
else. The heading names a thing, not an activity: it does not say that there is
one puzzle a day, that the puzzle is about listening, or what you are expected to
do with the controls below. The briefing's first bullet — "make it clearer for
first time users" — starts here, because every later explanation is cheaper once
the page has stated its own premise in one line.

## Scope

- The `<h1>` in `components/header/GrooveHeader.tsx` reads `Eardle`.
- A subtitle joins the header beneath it, in body type.
- The date line leaves the header, and with it `GrooveHeader`'s `date` prop.
- `app/layout.tsx` metadata: `title` becomes `Eardle`, `description` becomes the
  subtitle.
- The feature's landmark label — `<section aria-label="Daily Groove">` in
  `GroovePuzzle.tsx`, in both the loading branch and the loaded one — becomes
  `Eardle`.
- The existing assertions naming the old title move with it, and those asserting
  a date in the header invert.

**Out of scope**
- **Every internal use of `daily-groove`.** The package name, the
  `src/features/daily-groove/` folder, and both localStorage keys —
  `daily-groove:v2:results` and `daily-groove:v1:prefs` — keep the old word.
  Renaming a storage key is not a rename; it is a silent deletion of every
  streak anyone has.
- **The how-to-play box and the question mark that reopens it** — Epic 3. This
  epic only guarantees the subtitle the question mark will sit beside.
- **The streak's position and the play button's size** — Epic 2.
- **The README**, which is still `create-next-app` boilerplate and is not made
  better or worse by this feature.
- **Any new design-system component.** A `Heading` and a `Text` inside the
  `Stack` that is already there.
- **A logo, wordmark or favicon.** The name is set in type, not drawn.
- **`lib/presentation/date.ts`.** The formatter stays exactly as it is: the
  groove card still calls it. Only the header stops calling it.
- **The day itself.** Nothing about which calendar day the page is showing, or
  how that day is worded, changes. It is shown in one place instead of two.

## Requirements

- **R1** — The page's level-1 heading reads `Eardle`.
- **R2** — The heading is set in the hand-lettered display face, as the page's
  masthead is today. `Heading level={1} size="xl"` continues to supply it; the
  face is not restated at the call site.
- **R3** — A subtitle appears in the header, beneath the heading, reading
  exactly: `Wordle for your ears. Listen to today's groove, figure out the key,
  and test your musicianship daily.`
- **R4** — The subtitle is body copy, not a heading. It is not part of the
  heading's accessible name, and it introduces no additional heading level to
  the document outline.
- **R5** — The subtitle is set in the sans body face at the muted tone,
  subordinate to the masthead above it.
- **R6** — The browser tab and the document title read `Eardle`.
- **R7** — The document's meta description is the subtitle, verbatim.
- **R8** — The feature's landmark region is named `Eardle`, in the loading state
  as well as the loaded one, so the two never disagree about what the page is.
- **R9** — No stored data is read, written, migrated or invalidated by this
  epic. A player with a hundred-day streak sees the new name and the same
  streak.
- **R10** — The header remains legible at its collapsed width. Below `sm` the
  header already stacks; the subtitle wraps rather than truncating or scrolling
  horizontally.
- **R11** — The header does not show the date. Its left-hand column is the
  level-1 heading and the subtitle beneath it, and nothing else.
- **R12** — `GrooveHeader` no longer receives the day. Its only prop is the
  streak, and it reads the clock nowhere — as before, it is testable without
  fake timers.
- **R13** — The day is still shown on the page, exactly once: on the groove card
  beside the tempo, where the same shared formatter writes it. A player can
  still see which day they are playing.

## Behaviour details

The subtitle is one sentence of ~110 characters, which is three lines on a
narrow phone. It wraps. Nothing is clamped, ellipsised or hidden at any width —
a pitch a first-time visitor cannot finish reading is not a pitch.

**What this supersedes.** Feature-4 Epic 1 R1 put the date on the left of the
top row, and feature-7 Epic 2 AC7 asserted that the day appears *twice* — once in
the header, once on the card — spelled identically by one formatter. Both were
right at the time; the second is what makes dropping the header's copy safe now.
Those two requirements are superseded here: the day appears once, on the card,
and the one-formatter rule survives with one caller instead of two. Three test
assertions change with them — three in `GrooveHeader.test.tsx` that look for the
date line, and the one in `GroovePuzzle.test.tsx` that counts two occurrences of
it. They are not deleted: the header's become assertions that the date is
*absent*, and the count becomes one. `GrooveCard`'s own test already owns the
assertion that the day is shown.

`Heading`'s `FAMILY` table makes `size="xl"` the only size set in the Petaluma
face, deliberately: it is the page's masthead. This is why the subtitle is
`Text` and not a smaller `Heading` — a sentence that long in a hand-lettered
jazz face is a decorative smear, not a sentence.

## Acceptance criteria

- **AC1** (R1) — Given the page, when it renders, then there is exactly one
  level-1 heading and its accessible name is `Eardle`.
- **AC2** (R2) — Given the page, when the level-1 heading is inspected, then it
  carries the display-face class the masthead carries today.
- **AC3** (R3, R4) — Given the header, when it renders, then the subtitle text
  is present as a separate node from the heading, and the heading's accessible
  name is `Eardle` alone.
- **AC4** (R4) — Given the page, when its heading structure is inspected, then
  the subtitle is not a heading at any level.
- **AC5** (R6, R7) — Given the route's exported metadata, when it is inspected,
  then `title` is `Eardle` and `description` is the subtitle string.
- **AC6** (R8) — Given the puzzle before its groove has resolved, when the
  loading state renders, then the landmark region is named `Eardle`; and the
  same holds once loaded.
- **AC7** (R9) — Given a store holding results under `daily-groove:v2:results`,
  when the page renders after this epic, then the same streak is shown and the
  key is untouched.
- **AC8** (R5) — Given the header, when the subtitle is inspected, then it is
  rendered by `Text` at the muted tone.
- **AC9** (R11) — Given the header, when it renders, then no date text appears
  anywhere within it.
- **AC10** (R12) — Given `GrooveHeader`'s props, when they are inspected, then
  `streak` is the only one.
- **AC11** (R13) — Given the whole page on a known day, when it renders, then
  the day's line appears exactly once, on the groove card.

## Dependencies

None to start. It hands two things forward:

- **To Epic 3** — a subtitle node in the header for the question mark to sit
  beside, and the string itself.
- **To Epic 2** — the shape of the header's left column: a `Stack` whose
  contents are the `<h1>` and the subtitle. Epic 2 changes the
  enclosing `Row`'s alignment and nothing inside this `Stack`; this epic changes
  the `Stack`'s contents and not the `Row`. That split is what lets both run in
  wave 1.

Per `docs/testing.md`, `GrooveHeader` is part of the feature slice and is tested
inside it, driven by props. The page-level assertions in `app/page.test.tsx`
stay where they are and change only the word they look for.

## Assumptions

- The tab title is `Eardle` alone, with no tagline appended.
- The subtitle's wording is taken from the briefing verbatim, including the
  reference to Wordle. It is the user's own framing of what the app is.
- `Eardle` is a coined name and is written as one word, capital E, no styling
  beyond the display face.
- The `aria-label` on the loading branch and the loaded branch are the same
  string, held in one place rather than typed twice.
- No `og:` or Twitter card metadata is added; the route has none today.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. The header's left column now holds three lines — where does the date go?**
Answer: **B) Drop the date from the header entirely and let the groove card
carry the day** — the card has shown `105 bpm · Sunday, 30 August` since
feature-7, so the header's copy was the duplicate, and removing it leaves the
top of the page as name-then-pitch with nothing competing.
Applied to: R11, R12, R13, AC9, AC10, AC11, Summary, Scope, Out of scope,
Behaviour details ("What this supersedes"), Dependencies
