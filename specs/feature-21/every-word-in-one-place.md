> Moved here from feature-20, where it was Epic 4. It is kept as reference, not
> as a PRD: feature-b is a lettered candidate and has no roadmap yet. Centralising
> every string is the first half of internationalisation, so it is cheaper here —
> the same sweep that gathers the strings is the one translation needs. When
> feature-b is promoted, `/roadmap` turns this into epics and `/brainstorm`
> rewrites it as a PRD.

# PRD — Epic 4: Every word in one place

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Every user-facing string the app renders moves into `src/lib/snippets/`, one file
per area behind an index, and every test stops writing the sentence and starts
importing it. Afterwards the app's whole voice can be read in one sitting,
changing a line is one edit, and changing it breaks nothing. Nothing Sam sees
changes: every string moves byte-identical, and the existing assertions passing
is what proves it.

The roadmap's decisions 8–11 are settled and this PRD builds on them: the module
lives in `src/lib/snippets/`, the line between language and data is "would a
translator translate it", lint guards the test half, and interpolated snippets
are functions.

## Problem

Roughly a hundred user-facing strings sit across about thirty files, written
wherever they happen to render. Nobody can read what the app says without reading
the app, so there is no way to notice that the voice has drifted — and eighteen
features have each added a line or two.

The tests then nail every sentence in place. There are ~540 literal string
assertions across 57 test files; `GroovePuzzle.guessing.test.tsx` has 79 and
`GuessCard.test.tsx` 65. Rewording one line means finding every test that quoted
it, which makes a two-word improvement a half-hour of grep.

The duplication is already visible: `testing/puzzleHarness.tsx` keeps its own
copies of the app's words — `CAPTION`, `CAPTION_SOUNDS_OFF`, `CHANGES_READ` —
because there was nowhere else to put them. And `src/lib/branding.ts` shows the
shape working at a scale of two: `APP_NAME` and `TAGLINE` live in one file, and
`GrooveHeader.test.tsx`, `page.test.tsx` and `GroovePuzzle.header.test.tsx`
import `APP_NAME` rather than asserting `'Eardle'`.

Two other features run into the same wall from opposite sides. Feature-19 ships
before this one and pays the cost in full: its briefing ends "check every hint
and other wording for snippets that need changing now that the three attempts
are gone", and with the strings scattered that is exactly the grep hunt this
epic exists to end. Feature-B — "actually use snippets instead of hardcoded
text" — is the one that inherits the benefit.

## Scope

- `src/lib/snippets/`, one file per area behind an index, with `branding.ts`
  folded in
- every string a person can read moves there — rendered text, aria-labels, and
  the mode-description lines
- interpolated strings become functions taking typed arguments; the rest are
  constants
- every test, `testing/` included, imports the snippet instead of writing the
  sentence
- an ESLint rule rejects a prose literal in the assertions that quote rendered
  language, and a second block covers the modules whose whole job is returning
  sentences
- the design system stops holding app words: `PlayControl`'s defaults move out to
  its caller

**Out of scope**
- **translation, locales, a second language, and any build-time translation
  step** — feature-B keeps all of it
- **rewording anything.** Every string moves byte-identical. Feature-20 does the
  rewording the attempt dots' removal calls for, and it is cheap precisely
  because this landed first
- theory names, degree labels and numerals — `Harmonic minor`, `Major`/`Minor`,
  `III`, `VII`. They are keys in `catalogue.json` and `grooves.lock.json` with one
  owner in `src/lib/theory/names.ts` after Epic 1
- non-UI strings: the storage keys (`daily-groove:v2:results`,
  `daily-groove:v1:prefs`), the `Intl` locale, thrown `Error` messages, and
  `selectGroove`'s invariant message
- the design system's own test literals. A primitive is tested against props it
  passes itself, so `Button.test.tsx` keeps writing `'Play'`
- the generator. `scripts/grooves/` prints to a terminal, not to Sam
- a keyed catalogue format — JSON files, locale namespaces, a `t()` call. Snippets
  stay TypeScript so the compiler keeps checking every call site
- **any mechanical guard on the components.** No lint rule and no structural test
  stops the next inline label; the rule is written into
  `docs/coding-guidelines.md` and checked by whoever reads the diff
- **any lint rule on `toBe`, `toEqual`, `toContain` or `toMatch` outside the
  coaching modules' own test files.** Everywhere else those carry data as often as
  language, and a rule that fires on `toBe('Aeolian')` would be turned off within
  a week

## Requirements

- **R1** — `src/lib/snippets/` holds every user-facing string, one file per area
  of the app: `branding.ts`, `header.ts`, `intro.ts`, `puzzle.ts`, `coaching.ts`,
  `solved.ts` and `routes.ts`. An area is a place in the UI, not a component, so
  one file serves several components and no component has a file of its own.
- **R1a** — Each area file exports one object. `src/lib/snippets/index.ts`
  re-exports the areas under their own names, so the whole voice of the app is
  readable from one entry point without every string being reachable under one
  flat name.
- **R1b** — `src/lib/branding.ts` is gone. `APP_NAME` and `TAGLINE` are snippets
  like the rest, and their existing importers — `src/app/layout.tsx`,
  `GrooveHeader.tsx`, `GroovePuzzle.tsx` and three test files — read them from
  the new path.
- **R2** — No user-facing string exists in two places. `puzzleHarness.tsx`'s
  `CAPTION`, `CAPTION_SOUNDS_OFF` and `CHANGES_READ` are imports, not copies.
- **R3** — A snippet that needs a value is a function taking typed arguments; a
  snippet that does not is a constant. `nearMiss`'s one-note/two-notes
  pluralisation, the coaching moves that name the root or the mode, and the mode
  description lookup are functions, so the compiler checks every call site and no
  placeholder syntax is invented.
- **R4** — Anything a screen reader speaks is a snippet. The aria-labels
  currently written inline — `Hint`, `How to play`, `Close how to play`,
  `Current streak`, and the group names `Root` and `Mode` — move with the visible
  text.
- **R5** — `MODE_CHARACTERS` splits along the language/data line. The `degrees`
  arrays (`['♯4']`, `['♭2', '♭6', '♭7']`) are theory and stay in
  `src/lib/theory/`; the seventeen `line` values ("major with a ♯4", "the plain
  major scale — nothing bent") are the app putting theory into Sam's language and
  become a snippet function keyed by flavour.
- **R5a** — `src/lib/snippets/` and `src/lib/theory/` are siblings and neither
  imports the other. The solved panel takes the degrees from theory and the line
  from snippets and composes them, which costs one import in the component that
  renders both and leaves two leaf modules with no arrow to get backwards.
- **R6** — No design-system component holds an app word. `PlayControl`'s default
  `TEXT` (`Play`, `Stop`, `Loading…`) and its hardcoded accessible names (`Play
  the loop`, `Stop the loop`) move out to the caller, and the component takes
  both as props with no domain-flavoured default. Every other component under
  `src/components/` is checked for the same thing.
- **R7** — No test asserts a prose literal. Every assertion on rendered language
  imports the snippet it expects, including the queries that assert by matching.
- **R8** — An ESLint rule enforces R7 for the call shapes whose argument is
  rendered language by definition: `*ByText` and `*ByRole`'s `name` option in all
  their `get`/`query`/`find`/`All` spellings, `toHaveTextContent` and
  `toHaveAccessibleName`. It lives in its own named block in `eslint.config.mjs`
  beside `daily-groove/import-boundaries`, is scoped to test files and
  `src/features/*/testing/`, and carries a `message` naming the rule and the
  reason, as the existing zones do.
- **R8a** — `toBe`, `toEqual`, `toContain` and `toMatch` are left alone.
  `toBe('Aeolian')`, `toBe('warm')` and `toHaveAttribute('data-tone', 'warm')` are
  assertions on data and stay legal — a rule that fires on them needs a heuristic
  or an allowlist of the twelve flavour names, and the allowlist is a second place
  the twelve are written down, which is what Epic 1 exists to stop.
- **R8b** — A second block closes the hole where the prose actually lives.
  `toBe`, `toEqual` and `toContain` are restricted too inside the test files of
  the modules whose job is to return sentences — `lib/presentation/`'s coaching
  modules and the entry point Epic 2 builds — because there an asserted string
  literal is language by construction, so the scope does the work a heuristic
  would otherwise have to.
- **R8c** — The two blocks are scoped by file and the boundary is written down,
  not inferred. `date.test.ts` and `staffLabel.test.ts` sit in the same folder
  while asserting formatted dates and degree strings, so they are named as
  exclusions in the config with the reason beside them: a formatted date is
  produced by `Intl`, not written by us, and a degree string is theory.
- **R9** — The rule is proven to fire, once per call shape it claims to match, and
  proven not to fire on a data assertion. A rule that has only been seen to pass
  is a comment; one that has never been seen to stay quiet is a nuisance waiting
  to happen.
- **R10** — The escape hatch is an `eslint-disable-next-line` with a reason on
  the same line, so every exception is greppable. The epic's report lists every
  one it left behind.
- **R11** — Nothing the player can observe changes. Every rendered string, every
  accessible name, byte-identical, in the same conditions as today.
- **R12** — The move reconciles. The epic reports the number of strings in
  `src/lib/snippets/` against the number removed from components and coaching
  modules, and the two agree.
- **R13** — `structure.test.ts` knows where snippets live and asserts that
  neither `src/lib/snippets/` nor `src/lib/theory/` imports the other; the
  design-system, route-boundary and generator boundary tests stay green.
- **R14** — `docs/coding-guidelines.md` carries the rule for the one gap lint is
  left with: no user-facing string written inline in a component. It is tagged
  *human-checked* and named after the file that motivated it, as every rule in
  that document is, and it states which half of the rule lint enforces so a
  reader knows what will and will not stop them.

## Behaviour details

**The line between language and data.** The test is *would a translator
translate it*, and it cuts through the middle of some modules rather than around
them:

| String | Verdict | Why |
| :-- | :-- | :-- |
| `Pick a root`, `Hint`, `No streak yet` | language | rendered words |
| `Current streak` (aria-label) | language | a screen reader says it |
| `major with a ♯4` | language | the app explaining theory in Sam's words |
| `Harmonic minor` | data | the key in `catalogue.json` and the lock file |
| `['♯4', '♭7']` | data | degrees, consumed by the staff and the lead sheet |
| `bpm` | language | a word on the card |
| `' · '`, `en-GB` | format | punctuation and a locale, not a sentence |
| `daily-groove:v2:results` | data | a storage key |
| `Audio playback is unavailable in this browser` | neither | thrown to a developer; Sam sees `Couldn't play the groove.` |

**What a test looks like afterwards.** The assertion keeps its subject and loses
its copy of the sentence:

```
// before
expect(screen.getByText('Right home note, wrong colour.')).toBeVisible()
expect(nudge()).toHaveTextContent('Loop it a few times. Sing the note…')

// after
expect(screen.getByText(coaching.rootMatched)).toBeVisible()
expect(nudge()).toHaveTextContent(coaching.opening)

// and where the snippet takes an argument
expect(hint()).toHaveTextContent(coaching.nearMiss({ notes: 2 }))
```

**Why the rule is lint rather than a structural test.** It fires on the line
being typed rather than at the end of a suite run, which is the difference
between a rule that teaches and a rule that scolds.

**What each block covers.** Two things can tell language from data without a
heuristic — the matcher's name, and the file the assertion is in — and the rule
uses one of each:

| Block | Scope | Restricts | Why it is safe there |
| :-- | :-- | :-- | :-- |
| by matcher | every test file and `testing/` | `*ByText`, `*ByRole`'s `name`, `toHaveTextContent`, `toHaveAccessibleName` | those arguments are rendered language by definition |
| by file | the coaching modules' tests and the entry point's | also `toBe`, `toEqual`, `toContain` | those modules return sentences and nothing else |

The second block is not a corner case. `lib/presentation/`'s tests assert 26
prose literals through `toBe` today, and Epic 2 moves `GuessCard.test.tsx`'s
coaching-text cases — 65 literal assertions in that file — into exactly that
shape, so after Epic 2 this is where most of the app's prose is asserted. It is
also where the scope has to be drawn carefully: `date.test.ts` and
`staffLabel.test.ts` live in the same folder and assert an `Intl`-formatted date
and a degree string, neither of which is a snippet.

**What is left to a reader.** One gap: an inline label written straight into a
component. Rejecting JSX text needs its own rule and that rule was not taken, so
`docs/coding-guidelines.md` carries it as a *human-checked* rule. If the first
inline label lands three weeks later, that is the argument for the rule, and it
is one config block away.

## Acceptance criteria

- **AC1** (R1, R1a) — Given `src/lib/snippets/`, when its files are listed, then
  each names an area of the app and exports one object, and the index re-exports
  every area.
- **AC2** (R1b) — Given the tree, when `src/lib/branding.ts` is looked for, then
  it does not exist, and every former importer resolves `APP_NAME` and `TAGLINE`
  from `src/lib/snippets/`.
- **AC3** (R2) — Given `puzzleHarness.tsx`, when read, then `CAPTION`,
  `CAPTION_SOUNDS_OFF` and `CHANGES_READ` are imported from the snippets module
  and declared nowhere else.
- **AC4** (R3) — Given a snippet that renders a value — the near-miss note count,
  a coaching move naming the root, a mode description — when called with the wrong
  argument type, then the type check fails; and given the same arguments twice,
  then it returns the same string.
- **AC5** (R4) — Given the rendered app, when every accessible name is collected,
  then each one traces to a snippet, and none is written inline in a component.
- **AC6** (R5) — Given `src/lib/theory/`, when the mode data is read, then it
  holds the degree arrays and no prose line; and given the solved panel, when it
  renders a mode's description, then the text comes from the snippets module.
- **AC6a** (R5a, R13) — Given `src/lib/snippets/` and `src/lib/theory/`, when
  their import specifiers are read, then neither names the other, and
  `structure.test.ts` fails when either does.
- **AC7** (R6) — Given every file under `src/components/`, when its string
  literals are read, then none is an app word: `PlayControl` takes its labels and
  its accessible names as props with no domain default.
- **AC8** (R7, R8) — Given a test file, when a string literal is written as a
  `*ByText` argument, a `*ByRole` `name` option, or an argument to
  `toHaveTextContent` or `toHaveAccessibleName`, then `npm run lint` rejects it
  with a message naming the rule and the reason.
- **AC8a** (R8a) — Given `expect(answer.flavour).toBe('Aeolian')` and
  `expect(el).toHaveAttribute('data-tone', 'warm')` in a component test, when
  lint runs, then both pass. The rule's silence on data assertions is asserted,
  not assumed.
- **AC8b** (R8b) — Given a coaching module's test file, when a sentence is
  written as a `toBe`, `toEqual` or `toContain` argument, then lint rejects it;
  and given the same literal in a component test, then lint passes.
- **AC8c** (R8c) — Given `date.test.ts` and `staffLabel.test.ts`, when they
  assert a formatted date and a degree string as literals, then lint passes, and
  the config names them as exclusions with the reason beside them.
- **AC9** (R9) — Given each call shape the rule claims to match, when a violation
  is introduced in that shape, then lint fails; and when it is removed, lint
  passes.
- **AC10** (R10) — Given the tree, when `eslint-disable` comments for the rule are
  counted, then each carries a reason and the epic's report lists all of them.
- **AC11** (R11) — Given a full session — first visit, the how-to-play box, a
  wrong guess at each rung, the nudge, a lock-in, a solve, a give-up, a shared
  link, the not-found route — when played before and after, then every rendered
  string and accessible name matches.
- **AC12** (R11, R12) — Given one snippet changed to a different word, when the
  suite runs, then it stays green and the app renders the new word; and when the
  change is reverted, the tree is byte-identical.
- **AC13** (R12) — Given the epic's report, when read, then the count of snippets
  added equals the count of strings removed, and the diff contains no wording
  change.
- **AC14** (R14) — Given `docs/coding-guidelines.md`, when read, then it carries
  the snippets rule tagged *human-checked*, covering inline component strings,
  says which half lint enforces instead, and names the file that motivated it.
- **AC15** (R13) — Given the full gate, when `npm test`, `npm run test:gen`, the
  type check, lint and build run, then all pass.

## Dependencies

**Needs to start:** Epics 1, 2 and 3 landed.

- Epic 1 moves the theory modules to `src/lib/theory/`, and R5 splits one of them.
  Doing that before the move means doing it twice
- Epic 2 puts the coaching prose behind one door and moves the coaching-text
  assertions into that door's own test file. Those assertions are the largest
  block R7 rewrites, and rewriting them in their old home first is wasted work
- Epic 3 rewrites the `src/lib/` bar in `coding-guidelines.md` and edits
  `eslint.config.mjs`. R8 adds a block to the same file and a rule to the same
  document

**Hands to feature-B:** the whole surface it needs to translate, in one place,
with the interpolated ones already isolated as functions.

**Hands feature-19 nothing.** It ships first and rewords the hints the hard way.
Its last briefing bullet is the case for this epic, not a beneficiary of it — and
the strings it touches are the ones this epic then moves, so the two must not
run at the same time.

## Assumptions

- The seven area files are a starting split, not a contract. If `routes.ts` turns
  out to hold two strings it folds into `puzzle.ts`; the rule that survives is
  one file per area, not this exact list.
- Snippet names are English identifiers describing the string's job
  (`coaching.rootMatched`), not i18n-style dotted keys. Feature-B can add a key
  scheme if it needs one.
- Join separators (`' · '`, `' and '`) and the `Intl` locale stay as format in the
  module that composes the line. `bpm` moves, because it is a word.
- Thrown `Error` messages stay where they are. They are read by whoever is
  debugging, and the player-facing failure text (`Couldn't play the groove.`,
  `Retry`) is separate and does move.
- The mode-description lookup becomes a snippet function returning the line and
  nothing else, so `src/lib/theory/character.ts` keeps only its degree data and
  loses `characterOf`'s prose half. Epic 1's thirteen theory modules become twelve
  plus a data module, and Epic 3's module map should read that way after this epic.
- `docs/coding-guidelines.md`'s rules are tagged *lint-enforced* or
  *human-checked* and named after the file that motivated them. The snippets rule
  follows both conventions; R14 does not restructure the document.
- The component guard this epic declines is declined for now, not forbidden.
- The by-matcher block's scope is `**/*.test.ts(x)` plus
  `src/features/*/testing/`; the by-file block's is the coaching modules' tests
  and the entry point's. `src/components/**` tests are excluded from both by R6's
  reasoning, and every exclusion is written into the config rather than left to an
  allowlist.
- No new strings are invented. A string that does not exist today does not get a
  snippet today.

## Question log

### Cycle 1 — 2026-09-03

**Q1. How does the lint rule tell a sentence from a data value?**
Answer: **A) Scope it to the call shapes whose argument is rendered language by
definition** — `*ByText`, `*ByRole`'s `name`, `toHaveTextContent`,
`toHaveAccessibleName` — and leave `toBe`, `toEqual` and `toContain` alone. The
only line that needs no heuristic and produces no false positive.
Applied to: Scope, Out of scope, R7, R8, R8a, R8b, R9, AC8, AC8a, Behaviour
details. Opened Q4.

**Q2. Does anything stop the next inline label in a component?**
Answer: **C) Nothing mechanical** — the rule goes into
`docs/coding-guidelines.md` and is checked by whoever reads the diff.
Applied to: Out of scope, R14, AC14, Assumptions, Behaviour details.

**Q3. Where do `src/lib/snippets/` and `src/lib/theory/` sit relative to each other?**
Answer: **A) Siblings that never import each other** — the solved panel composes
the degrees and the line itself; two leaf modules with no arrow between them is
the shape with the fewest ways to go wrong.
Applied to: R5a, R13, AC6a, Assumptions.

### Cycle 2 — 2026-09-03

**Q4. Are the coaching modules' own tests inside the rule or outside it?**
Answer: **A) A second block scoped to the coaching modules' test files**, where
`toBe`, `toEqual` and `toContain` are restricted too — in a module that returns
sentences an asserted literal is language by construction, so scoping by file
closes Q1's hole with no heuristic. `date.test.ts` and `staffLabel.test.ts` are
named exclusions.
Applied to: Scope, Out of scope, R8b, R8c, R14, AC8a, AC8b, AC8c, AC14,
Behaviour details, Assumptions.

The PRD is settled: no open questions remain.
