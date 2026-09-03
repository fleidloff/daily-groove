# PRD — Epic 1: Every word in one place

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md) ·
prior art: [every-word-in-one-place.md](../every-word-in-one-place.md)

## Summary

Every user-facing string the app renders moves into `src/lib/snippets/en/`, one
file per area behind one index. Afterwards the app's whole voice can be read in
one sitting, changing a line is one edit, and the language folder is the seam a
second language slots into. Nothing Sam sees changes: every string moves
byte-identical, and the existing suite passing untouched is what proves it.

## Problem

The words are scattered. An inventory of `src/`, excluding generated data and
theory names, finds prose in 40 files — quoted literals in components and
coaching modules, and JSX text written straight between tags in `HowToPlay`,
`GroovePuzzle` and the not-found route. Nobody can read what the app says
without reading the app, so nobody notices when the voice drifts, and nineteen
features have each added a line or two.

It also blocks translation outright. There is no list of what would have to be
translated, and no way to produce one except the sweep this epic is.

The pattern already works at a scale of two: `src/lib/branding.ts` holds
`APP_NAME` and `TAGLINE`, and four files import them rather than writing
`'Eardle'`. This epic is that file, finished.

## Scope

- `src/lib/snippets/en/` — one file per area of the UI, each exporting one
  object; `src/lib/snippets/index.ts` the only path a consumer imports
- `src/lib/snippets/types.ts` — a declared type per area that `en/` satisfies, so
  the second language is checked against the first by the compiler
- every string a person can read moves: quoted literals, JSX text children,
  aria-labels, the player-facing failure text, the twelve mode-description lines
- `src/lib/branding.ts` folds in and is deleted
- `src/lib/theory/character.ts` splits along the language/data line
- `HowToPlay`'s four steps stop being strings that get parsed after they are
  written
- `PlayControl` stops holding app words; the rest of `src/components/` is checked
- `puzzleHarness.tsx`'s copies of the app's words become imports; its copy of the
  fixture's chord symbols is derived from the fixture
- `docs/coding-guidelines.md` gains the rule for the gap no linter covers
- `src/lib/hash.test.ts`'s leaf check and the structure tests learn about the new
  folder

**Out of scope**
- **translating anything** — no second language, no translation step, no
  resolver. The index re-exports `en/` directly
- **storing or reading a chosen language** — Epic 2
- **rewording anything.** Every string moves byte-identical; a diff containing a
  wording change is a failed epic
- **the test half and the ESLint rule** — Epic 3. The 209 assertions that quote
  sentences today keep quoting them through this epic, and that is the point:
  they are the witnesses that nothing moved
- theory names, degree labels, numerals and family names — `Harmonic minor`,
  `Aeolian`, `III`, `♭7`, `Major`/`Minor`. Data with one owner in
  `src/lib/theory/`
- storage keys, the `Intl` locale (`en-GB`), thrown `Error` messages,
  `selectGroove`'s invariant message, `AbortError`, `'use client'`
- URLs and licence identifiers. `https://drumgizmo.org` and `CC BY 4.0` are not
  translated; the sentence around them is
- the design system's own test literals. `Button.test.tsx` keeps writing `'Play'`
- the generator. `scripts/grooves/` prints to a terminal, not to Sam
- a keyed catalogue format, JSON files, a `t()` call. Snippets stay TypeScript so
  the compiler checks every call site
- **any mechanical guard on inline strings in components.** No lint rule and no
  structural test stops the next inline label; the rule is written into
  `docs/coding-guidelines.md` and checked by whoever reads the diff

## Requirements

### Where the words live

- **R1** — `src/lib/snippets/en/` holds every user-facing string, one file per
  area of the app: `branding.ts`, `header.ts`, `intro.ts`, `puzzle.ts`,
  `coaching.ts`, `solved.ts` and `routes.ts`. An area is a place in the UI, not a
  component, so one file serves several components and no component has a file of
  its own.
- **R1a** — Each area file exports one object. `src/lib/snippets/index.ts`
  re-exports the areas under their own names, so a consumer writes
  `import { coaching } from '@/lib/snippets'` and the whole voice of the app is
  readable from one entry point without every string being reachable under one
  flat name.
- **R1b** — The language level is a folder, not a suffix: `snippets/en/puzzle.ts`,
  with `index.ts` above it. A second language is a sibling folder, and the day it
  arrives `index.ts` is the only file that changes.
- **R1c** — Consumers import from `@/lib/snippets` and never from
  `@/lib/snippets/en/...`. The language folder is an implementation detail of the
  index, which is what keeps the later switch to a resolver a one-file change.
- **R1d** — `src/lib/branding.ts` is gone. `APP_NAME` and `TAGLINE` are snippets
  like the rest, and their seven importers read them from the new path: three
  source files — `src/app/layout.tsx`, `GrooveHeader.tsx`, `GroovePuzzle.tsx` —
  and four test files — `src/app/page.test.tsx`, `GroovePuzzle.page.test.tsx`,
  `GroovePuzzle.header.test.tsx` and `GrooveHeader.test.tsx`.
- **R1e** — `src/lib/snippets/types.ts` declares one type per area, and each area
  file under `en/` satisfies its type. A language folder missing a snippet, or
  carrying one the app does not render, fails the type check rather than
  producing an English word in the middle of a translated sentence. The types sit
  above the language level, beside `index.ts`, because they describe every
  language and belong to none.
- **R1f** — An interpolated snippet's type is a function signature, so a language
  folder cannot turn a function into a constant and lose its argument.
- **R2** — No user-facing string exists in two places. `puzzleHarness.tsx`'s
  `CAPTION` and `CAPTION_SOUNDS_OFF` are imports, not copies.
- **R2a** — `CHANGES_READ` is not a snippet. `'Cm · Fm · G7 · Cm'` is four chord
  symbols and a separator — data and format, with no word in it — so it is derived
  from the fixture it describes rather than imported from the snippets module.

### What is a snippet

- **R3** — The test is *would a translator translate it*. Rendered words,
  aria-labels and the app's own explanations are snippets. Theory names, degree
  labels, numerals, family names, storage keys, locales, URLs, licence
  identifiers, thrown `Error` messages and invariant messages are not.
- **R4** — A snippet that needs a value is a function taking typed arguments; a
  snippet that does not is a constant. `nearMiss`'s one-note/two-notes
  pluralisation, the coaching moves that name the root or the mode, the check
  button's `Check C Aeolian` label and the mode-description lookup are functions,
  so the compiler checks every call site and no placeholder syntax is invented.
- **R5** — Anything a screen reader speaks is a snippet. The aria-labels written
  inline today — `Hint`, `How to play`, `Close how to play`, `Current streak`,
  and the group names `Root` and `Mode` — move with the visible text.
- **R6** — JSX text written between tags is a string like any other. The
  not-found route's heading and paragraph, `HowToPlay`'s heading and the
  player-facing failure text are `{routes.notFoundTitle}`, not prose in the
  markup.
- **R6a** — No snippet is parsed after it is written. `HowToPlay`'s four steps
  become `{ words, mark }` pairs — `{ words: 'Jam along ', mark: '🎸' }` — and
  `splitMark` is deleted. The two halves were glued into one literal only because
  there was nowhere to keep them apart; a snippet is that place, and a translator
  who puts the mark somewhere other than last no longer breaks the layout. The
  box renders byte-identically.
- **R7** — `MODE_CHARACTERS` splits along the language/data line. The `degrees`
  arrays (`['♯4']`, `['♭2', '♭6', '♭7']`) are theory and stay in
  `src/lib/theory/character.ts`; the twelve `line` values ("major with a ♯4",
  "the plain major scale — nothing bent") become a snippet function keyed by
  flavour.
- **R7a** — `src/lib/snippets/` and `src/lib/theory/` are siblings and neither
  imports the other. The solved panel takes the degrees from theory and the line
  from snippets and composes them, which costs one import in the component that
  renders both and leaves two leaf modules with no arrow to get backwards.

### What the design system may hold

- **R8** — No design-system component holds an app word. `PlayControl`'s default
  `TEXT` (`Play`, `Stop`, `Loading…`) and its hardcoded `NAME` accessible names
  (`Play the loop`, `Stop the loop`) move out to the caller, and the component
  takes both as required props with no domain-flavoured default. Every other
  component under `src/components/` is checked for the same thing.

### What holds it in place

- **R9** — `docs/coding-guidelines.md` carries the rule for the one gap lint is
  left with: no user-facing string written inline in a component, whether as a
  quoted literal or as JSX text. It is tagged *human-checked* and named after the
  file that motivated it, as every rule in that document is, and it says which
  half Epic 3's lint rule enforces so a reader knows what will and will not stop
  them.
- **R10** — `src/components/structure.test.ts` asserts that no file under
  `src/components/` imports `@/lib/snippets`, and
  `src/features/daily-groove/structure.test.ts` asserts that neither
  `src/lib/snippets/` nor `src/lib/theory/` names the other. The route-boundary
  and generator boundary tests stay green.

### What must not change

- **R11** — Nothing the player can observe changes. Every rendered string, every
  accessible name, byte-identical, in the same conditions as today.
- **R12** — The existing test suite passes with no assertion on rendered language
  edited. A test that had to be changed to keep passing is a string that did not
  move byte-identical, and those 209 assertions are the epic's proof.
- **R12a** — The freeze has named exceptions, and only these. Two test files
  assert against a module surface this epic deliberately removes, and neither has
  a formulation that leaves it untouched: `src/lib/theory/character.test.ts`,
  whose cases read the `line` field R7 deletes, and
  `src/components/controls/PlayControl.test.tsx`, whose cases render the defaults
  R8 removes. The two structure tests change because R10 adds cases to them. Every
  other test file may change only its import specifiers.
- **R12b** — The exceptions are audited from the diff line by line, not asserted
  by policy. Any edit outside the named files, or any edit inside them that is not
  the consequence R12a names, is a failure.
- **R13** — The move reconciles. The epic reports the count of snippets in
  `src/lib/snippets/en/` against the count of strings removed from components,
  routes and coaching modules, and the two agree once the strings that exist twice
  today are accounted for. Four sentences are currently written in two places —
  the largest being `feedback.ts`'s `OPENING` and `moves.ts`'s first ladder rung,
  which are the same sentence — and collapsing each into one snippet is R2 working,
  not a string going missing. The report states the collapses individually so the
  arithmetic can be checked rather than trusted.

## Behaviour details

**Where the strings are today.** The inventory that R13 reconciles against, by
area:

| Area file | Fed by |
| :-- | :-- |
| `branding.ts` | `src/lib/branding.ts` |
| `header.ts` | `GrooveHeader`, `StreakBadge`, `HelpToggle`, `ShareGroove` |
| `intro.ts` | `HowToPlay` — the four steps and the DrumGizmo credit |
| `puzzle.ts` | `GroovePuzzle`, `GuessCard`, `NudgeBox`, `TransportPanel`, `ModeToggle`, `TapSoundsToggle`, `GrooveCard`, `SharedGrooveNotice`, `PlayTodayLink`, and the labels `PlayControl` gives up |
| `coaching.ts` | `lib/presentation/` — `feedback`, `moves`, `coachingMoves`, `nearMiss`, `index`'s check-button labels |
| `solved.ts` | `SolvedPanel`, `LeadSheet`, `ScaleStaff`, and `character.ts`'s twelve lines |
| `routes.ts` | `src/app/groove/not-found.tsx`, `SharedGroove` |

Two sources feed it, and the second is the one a grep for quoted strings misses:
`HowToPlay`'s `How to play` and the whole not-found paragraph are JSX text
children, not literals.

**The line between language and data.** The test is *would a translator translate
it*, and it cuts through the middle of some modules rather than around them:

| String | Verdict | Why |
| :-- | :-- | :-- |
| `Pick a root`, `Hint`, `No streak yet` | language | rendered words |
| `Current streak` (aria-label) | language | a screen reader says it |
| `major with a ♯4` | language | the app explaining theory in Sam's words |
| `Drum samples provided by DrumGizmo.org` | language | a sentence |
| `CC BY 4.0`, `https://drumgizmo.org` | neither | a licence identifier and a URL |
| `Harmonic minor`, `Aeolian` | data | keys in `catalogue.json` and the lock file |
| `Major`, `Minor` | data | family names in `src/lib/theory/families.ts` |
| `['♯4', '♭7']` | data | degrees, consumed by the staff and the lead sheet |
| `bpm` | language | a word on the card |
| `' · '`, `' and '`, `en-GB` | format | punctuation and a locale, not a sentence |
| `daily-groove:v2:results` | data | a storage key |
| `Audio playback is unavailable in this browser` | neither | thrown to a developer; Sam sees `Couldn't play the groove.` |

**What the declared types buy.** Nothing today — `en` is the only folder, and it
trivially satisfies types derived from itself. They pay out once, on the day a
second folder appears, by turning the normal failure mode of every translation
project into a compile error:

```
// src/lib/snippets/types.ts
export type CoachingSnippets = {
  opening: string
  rootMatched: string
  nearMiss: (args: { notes: number }) => string
}

// src/lib/snippets/en/coaching.ts
export const coaching = { … } satisfies CoachingSnippets
```

**How the index reads.** No resolver, no hook, no runtime lookup:

```
// src/lib/snippets/index.ts
export { branding } from './en/branding'
export { coaching } from './en/coaching'
…

// a component
import { coaching } from '@/lib/snippets'
```

The day a second language lands, the right-hand side becomes a resolved bundle
and the call sites do not move, because the call shape is an imported object
either way.

**Why the suite is not touched.** Epic 3 rewrites the assertions. Until it runs,
209 assertions quoting the exact sentences are the cheapest possible proof that
this epic changed no wording — and they only work as proof if nobody edits them.

## Acceptance criteria

- **AC1** (R1, R1a, R1b) — Given `src/lib/snippets/`, when its tree is listed,
  then it holds `index.ts` and an `en/` folder whose files each name an area and
  export one object, and the index re-exports every area under its own name.
- **AC2** (R1c) — Given every file outside `src/lib/snippets/`, when its import
  specifiers are read, then none contains `snippets/en`.
- **AC3** (R1d) — Given the tree, when `src/lib/branding.ts` is looked for, then
  it does not exist, and all seven former importers — three source files and four
  test files — resolve `APP_NAME` and `TAGLINE` from `@/lib/snippets`.
- **AC4** (R2, R2a) — Given `puzzleHarness.tsx`, when read, then `CAPTION` and
  `CAPTION_SOUNDS_OFF` are imported from the snippets module and declared nowhere
  else, and `CHANGES_READ` is derived from the fixture's own progression rather
  than written out or imported as a snippet.
- **AC4a** (R1e, R1f) — Given `src/lib/snippets/types.ts`, when a key is removed
  from an area file under `en/`, when a key it does not declare is added, or when
  an interpolated snippet is replaced by a constant, then the type check fails.
- **AC5** (R4) — Given a snippet that renders a value, when called with the wrong
  argument type, then the type check fails; and given the same arguments twice,
  then it returns the same string.
- **AC6** (R5) — Given the rendered app, when every accessible name is collected,
  then each one traces to a snippet and none is written inline in a component.
- **AC7** (R6) — Given `src/app/groove/not-found.tsx`, `HowToPlay.tsx` and
  `GroovePuzzle.tsx`, when their JSX is read, then no text node contains a word a
  translator would translate.
- **AC7a** (R6a) — Given `HowToPlay.tsx`, when read, then `splitMark` does not
  exist and each step arrives as two fields; and given the rendered box, when
  compared with today's, then the four steps and their marks are styled and
  placed identically.
- **AC8** (R7) — Given `src/lib/theory/character.ts`, when read, then it holds
  the twelve degree arrays and no prose line; and given the solved panel, when it
  renders a mode's description, then the text comes from the snippets module and
  the degrees from theory.
- **AC9** (R7a, R10) — Given `src/lib/snippets/` and `src/lib/theory/`, when their
  import specifiers are read, then neither names the other, and
  `structure.test.ts` fails when either does.
- **AC10** (R8) — Given every file under `src/components/`, when its string
  literals and JSX text are read, then none is an app word; `PlayControl` takes
  its labels and its accessible names as required props; and
  `structure.test.ts` fails if any file under `src/components/` imports
  `@/lib/snippets`.
- **AC11** (R11) — Given a full session — first visit, the how-to-play box, a
  wrong guess at each rung, the nudge, a lock-in, a solve, a give-up, a shared
  link, the not-found route — when played before and after, then every rendered
  string and every accessible name matches.
- **AC12** (R12, R12a, R12b) — Given the diff, when the test files are examined,
  then every change outside the files R12a names is an import specifier or the two
  harness constants of R2; each change inside them is the consequence R12a names;
  and `npm test` passes.
- **AC13** (R11) — Given one snippet changed to a different word, when the suite
  runs, then it goes red in exactly the tests that quote that word and the app
  renders the new word; and when the change is reverted, the tree is
  byte-identical.
- **AC14** (R13) — Given the epic's report, when read, then the count of snippets
  added equals the count of strings removed minus the collapses, every collapse is
  listed with the two places it came from, and the diff contains no wording change.
- **AC15** (R9) — Given `docs/coding-guidelines.md`, when read, then it carries
  the snippets rule tagged *human-checked*, covering both inline literals and JSX
  text in components, says which half Epic 3's lint rule enforces instead, and
  names the file that motivated it.
- **AC16** (R10) — Given the full gate, when `npm test`, `npm run test:gen`, the
  type check, lint and build run, then all pass.

## Dependencies

**Needs to start:** feature-20's Epics 1–3 landed and committed.

- Epic 1 moved the theory modules to `src/lib/theory/`, and R7 splits one of them
- Epic 2 put the coaching prose behind one door, which is the module `coaching.ts`
  is drawn from
- Epic 3 rewrote the `src/lib/` bar in `coding-guidelines.md`; R9 adds a rule to
  the same document

**Hands to Epic 3:** the snippets an assertion imports, and the areas the by-file
lint block is scoped against.

**Hands to Epic 2:** nothing. The two are independent — this epic's index resolves
`en/` statically and never asks which language is stored.

**Hands to the translation feature:** the whole surface it needs to translate, in
one folder, with the interpolated strings already isolated as functions.

## Assumptions

- The seven area files are a starting split, not a contract. If `routes.ts` turns
  out to hold four strings it folds into `puzzle.ts`; the rule that survives is
  one file per area, not this exact list.
- Snippet names are English identifiers describing the string's job
  (`coaching.rootMatched`), not i18n-style dotted keys. The translation feature can
  add a key scheme if it needs one.
- Join separators (`' · '`, `' and '`) and the `Intl` locale stay as format in the
  module that composes the line. `bpm` moves, because it is a word.
- Thrown `Error` messages stay where they are. They are read by whoever is
  debugging, and the player-facing failure text (`Couldn't play the groove.`,
  `Retry`) is separate and does move.
- The DrumGizmo credit sentence is a snippet; the two URLs and `CC BY 4.0` are
  passed to it or held beside it as data.
- `src/lib/theory/character.ts` keeps its name and its file after losing the prose
  half, so feature-20's module map still reads true.
- No new strings are invented. A string that does not exist today does not get a
  snippet today. Splitting a step into `words` and `mark` is not a new string; it
  is the same string stored as its two rendered halves.
- The area types are named after their areas (`CoachingSnippets`,
  `HeaderSnippets`) and live in one `types.ts` rather than one file each. Seven
  small types in one file is readable; seven files is a folder to navigate.
- `satisfies` rather than a type annotation, so each snippet keeps its literal
  type and a caller sees the actual string in the editor.
- The component guard this epic declines is declined for now, not forbidden. If
  the first inline label lands three weeks later, that is the argument for the
  rule, and it is one config block away.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-03

**Q1. Does the English folder have a declared shape, or is it the shape?**
Answer: **B) A declared type per area, in `src/lib/snippets/types.ts`**, which
every area file satisfies — it costs one `satisfies` clause per file now and
turns a missing translation into a compile error later, which is the whole reason
the briefing asked for an `en/` folder.
Applied to: Scope, R1e, R1f, AC4a, Behaviour details, Assumptions.

**Q2. What happens to a string that gets parsed after it is written?**
Answer: **A) Split the fields.** `HowToPlay`'s steps become `{ words, mark }` and
`splitMark` is deleted — the parse existed only because the two halves were glued
into one literal, and it is the one place in the app where a translator could
break the layout without touching any code.
Applied to: Scope, R6a, AC7a, Assumptions.

### Cycle 2 — 2026-09-03 (corrections from the tech spec)

Not questions — four factual errors the architect found while writing the steps,
verified against the tree and folded back so the two documents agree.

- **`character.ts` holds twelve prose lines, not seventeen.** The figure was
  carried over from the pre-feature-20 draft, before the theory modules were
  consolidated. Applied to: Scope, R7, Behaviour details.
- **`src/lib/branding.ts` has seven importers, not four** — three source files
  and four test files. Applied to: R1d, AC3.
- **`CHANGES_READ` is not language.** `'Cm · Fm · G7 · Cm'` is chord symbols and a
  separator, so it is derived from the fixture rather than imported. Applied to:
  Scope, R2, R2a, AC4.
- **R12 could not hold as written.** `character.test.ts` reads the `line` field R7
  deletes and `PlayControl.test.tsx` renders the defaults R8 removes; neither has
  a version that leaves the file alone. The freeze keeps its intent — no assertion
  on rendered language is edited — and gains a named, audited exception list.
  Applied to: R12, R12a, R12b, AC12.
- **Four sentences already exist in two places**, so the reconciliation is
  `added = removed − collapses` and every collapse is itemised. Applied to: R13,
  AC14.
