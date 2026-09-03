# PRD — Epic 3: A reworded line stops breaking fifty tests

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md) ·
prior art: [every-word-in-one-place.md](../every-word-in-one-place.md)

## Summary

Every assertion on rendered language imports the snippet it expects instead of
writing the sentence out, and an ESLint block keeps it that way. Afterwards
rewording a line is one edit in `src/lib/snippets/en/` and the suite stays green
— which is the payoff Epic 1 sets up and does not itself deliver.

## Problem

The tests nail every sentence in place. `getByText`, `getByRole`'s `name`,
`toHaveTextContent` and `toHaveAccessibleName` carry roughly 900 string literals
across the suite, and `toBe` carries eleven more sentences inside
`lib/presentation/`'s own tests. Rewording one line means finding every test that
quoted it.

Feature-19 paid this bill in full. Its briefing ended *"check every hint and
other wording for snippets that need changing now that the three attempts are
gone"*, and with the sentences copied into fifty test files that was a grep hunt
rather than an edit. Epic 1 puts the words in one place; without this epic the
tests still hold a second copy of every one of them, and the edit is still not
one edit.

**And the words are what teach Sam.** The hint lines are how the player finds out
what they got wrong — *"To be told the answer eventually. Failing without
learning is worse than losing."* Making them expensive to improve is the failure
mode worth avoiding here, and it is the one the current test shape guarantees.

## Scope

- every assertion on rendered language imports its snippet, `testing/` included
- one ESLint block, in `eslint.config.mjs` beside `daily-groove/import-boundaries`,
  scoped to the test files of the modules that *select* sentences, named, with a
  `message` giving the rule and the reason
- proof that the rule fires on each shape it claims inside that scope, and stays
  quiet everywhere else
- every exception is an `eslint-disable-next-line` with a reason on the line

**Out of scope**
- **a rule scoped by matcher.** `*ByText` and `*ByRole`'s `name` were the
  roadmap's assumption and are declined: roughly a hundred of their arguments are
  roots, modes, chord symbols, formatted dates and fixture titles, so the rule
  would need a heuristic or an allowlist of the twelve flavour names — and an
  allowlist is a second place the twelve are written down, which is exactly what
  feature-20's Epic 1 existed to stop. Component tests are covered by a
  *human-checked* rule instead
- **any change to what the app renders.** No snippet's value changes; the app is
  byte-identical to the end of Epic 1
- **any test that stops asserting what it asserted.** An assertion keeps its
  subject: `expect(screen.getByText(coaching.rootMatched)).toBeVisible()` is the
  same test as before, importing rather than quoting
- **a snapshot of the English bundle, or any other test that pins the exact
  wording.** Considered and declined at the roadmap: the words live in one
  readable file now, and a snapshot approved on every reword is the grep hunt
  again in a smaller costume. Nothing checks the wording after this epic, and a
  reviewer reading the `src/lib/snippets/en/` diff is what replaces it
- **the design system's own test literals.** A primitive is tested against props
  it passes itself, so `Button.test.tsx` keeps writing `'Play'`
- **`date.test.ts` and `staffLabel.test.ts`.** A formatted date is produced by
  `Intl` and a degree string is theory; neither is a snippet
- **any mechanical guard on inline strings in components.** That stays the
  *human-checked* rule Epic 1 writes into `docs/coding-guidelines.md`
- **the generator's tests.** `scripts/grooves/` prints to a terminal

## Requirements

- **R1** — No test asserts a prose literal. Every assertion on rendered language
  imports the snippet it expects, including the queries that find an element by
  matching its text.
- **R2** — An assertion keeps its subject. Importing the snippet is the only
  change; a test is not rewritten into a different assertion, relocated, or
  weakened to a substring match to make the import fit.
- **R3** — A snippet that takes arguments is called with them in the test, so the
  test asserts the same rendered string the component produces:
  `expect(hint()).toHaveTextContent(coaching.nearMiss({ notes: 2 }))`.
- **R3a** — A rendered string that mixes language and data is composed in the test
  from the same parts the component composes it from — the snippet, the formatter
  and the fixture. `'105 bpm · Sunday, 30 August'` becomes the `bpm` snippet, the
  date formatter and the groove's tempo, joined the way the card joins them. The
  whole rendered string stays the subject, and the test fails if the composition
  changes, which is what it was asserting all along.
- **R4** — `src/features/daily-groove/testing/` is inside the rule. A harness that
  writes the app's words is the same duplication as a test that does.
- **R5** — One ESLint block enforces R1 where an asserted literal is language by
  construction. It restricts whitespace-bearing string literals passed to `toBe`,
  `toEqual`, `toContain` and `toMatch`, and it is scoped by file to the test files
  of the modules whose job is *selecting* a sentence — `lib/presentation/`'s coaching
  modules and the entry point feature-20 built. It lives in its own named block in
  `eslint.config.mjs` beside `daily-groove/import-boundaries` and carries a
  `message` naming the rule and the reason, as the existing zones do.
- **R5a** — There is no block scoped by matcher, and no rule fires in component
  tests. The file an assertion sits in is what makes the rule safe; it is not on
  its own sufficient, which R5b states.
- **R5b** — The scope alone would fire on data. Inside `lib/presentation/`, after
  the two named exclusions, 43 string literals reach those four matchers and only
  11 are sentences: the rest are `'warm'`, `'open'`, `'out'`, `'neutral'`,
  `'tonic'`, `'C'`, `'Dorian'` and `''`. The block therefore carries one further
  clause — the literal contains whitespace — measured against the real tree with
  the real config at exactly 11 fires on exactly the 11 sentences, no false
  positive and no miss.
- **R5c** — That clause is a heuristic, and the spec and the guidelines say so
  rather than claiming the scope did the work. It is safe *here* and would not be
  suite-wide: `'C Aeolian'`, `'Cm–Fm–G7'` and `'105 bpm · Sunday, 30 August'` are
  whitespace-bearing data, and none of them exists in the files this block covers
  — the two that hold that shape, `date.test.ts` and `staffLabel.test.ts`, are
  excluded by name for an independent reason. The cost is that a one-word sentence
  is invisible to the rule; there are none.
- **R6** — The rule never fires on an assertion about data. Theory names, roots,
  degree strings, chord symbols, groove titles, formatted dates and `data-`
  attribute values stay legal as literals wherever they appear, and no allowlist
  of the twelve flavour names exists anywhere in the config — the whitespace clause
  names nothing, which is what an allowlist would.
- **R7** — Every exclusion is written into the config with its reason beside it,
  not inferred from a path convention. Three are named:
  - `lib/presentation/date.test.ts` — an `Intl`-formatted date is produced by the
    platform, not written by us
  - `lib/presentation/staffLabel.test.ts` — a degree string is theory
  - `src/lib/snippets/**` — a module that *defines* sentences is the one place the
    sentence must be written out. A test asserting `nearMiss({ notes: 2 })` against
    the snippet it imports asserts nothing; asserting it against `'two notes'` is
    the only version that checks anything.
- **R7a** — The distinction the scope rests on is that a module in
  `lib/presentation/` *selects* a sentence and `src/lib/snippets/` *defines* one.
  The scope decides where the rule may look; the whitespace clause of R5b decides
  what it looks at.
  In the first, a literal is a copy of language that lives elsewhere and the
  import is a real assertion — this input picks that snippet. In the second, the
  literal is the subject.
- **R8** — The rule is proven to fire, once per matcher it restricts, inside its
  scope; and proven to stay quiet on the same literal written in a component test,
  in the two excluded files, and in the snippets module's own tests. A rule that
  has only been seen to pass is a comment; one that has never been seen to stay
  quiet is a nuisance waiting to happen.
- **R9** — The escape hatch is an `eslint-disable-next-line` with a reason on the
  same line, so every exception is greppable. The epic's report lists every one
  it left behind.
- **R10** — Rewording proves out end to end: changing one snippet's value leaves
  the whole suite green and changes what the app renders.
- **R11** — `docs/coding-guidelines.md` carries the rule in both its halves, says
  which is which, and states plainly that the lint-enforced half turns on a
  whitespace heuristic that is exact only inside its scope. The coaching modules' tests are *lint-enforced*, with the
  block described under Enforcement like the existing zones. Every other test is
  *human-checked*: a prose literal in a component test is a rule a reviewer
  applies, and the document says so plainly rather than implying a linter will
  catch it. Both halves are named after the file that motivated them.

## Behaviour details

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

**Why a linter and not a structural test.** It fires on the line being typed
rather than at the end of a suite run, which is the difference between a rule
that teaches and a rule that scolds.

**Why the scope is the file and not the matcher.** A matcher's argument is not
reliably language. Counting the literals in `{ name: … }` across the suite:

| Literal | Count | What it is |
| :-- | --: | :-- |
| `'C'`, `'A'`, `'G'`, `'E♭'` … | ~60 | roots — theory data |
| `'Stop the loop'`, `'Play the loop'` | 31 | accessible names — language |
| `'C Aeolian'` | 18 | a root and a mode, composed |
| `'How to play'`, `'Close how to play'` | 22 | language |
| `'Aeolian'`, `'Dorian'` … | ~20 | modes — theory data |
| `'Test Groove'`, `'Velvet Pocket'` … | ~20 | fixture titles — data |

`getByText` is no cleaner: `'Link copied'`, `'Hint'` and `'Play along.'` sit
beside `'Saturday, 29 August'`, `'Cm–Fm–G7'` and `'105 bpm · Sunday, 30 August'`.
So neither matcher family separates language from data on its own. Two things can
tell them apart without a heuristic — the file an assertion sits in, and a person
reading the diff — and this epic uses one of each:

| Half | Scope | Guarded by | Why it is safe there |
| :-- | :-- | :-- | :-- |
| the coaching modules' tests | `lib/presentation/`, minus two named files, whitespace-bearing literals only | lint | those modules select sentences, and inside that scope a literal with a space in it is one — measured, 11 for 11 |
| every other test | component tests, `testing/`, route tests | a reviewer | the same literal may be a root, a mode or a chord, and no rule can tell without a list of the twelve |

The unenforced half is not the epic failing to finish. R1 rewrites those
assertions either way; what is left open is only whether the next one regrows,
and that is the same bet Epic 1 already takes on inline strings in components.

**What a composed line looks like.** The card's most-asserted string is four
things joined:

```
// before
expect(card()).toHaveTextContent('105 bpm · Sunday, 30 August')

// after — the same parts the component joins
expect(card()).toHaveTextContent(
  `${GROOVE.tempo} ${puzzle.bpm} · ${formatPuzzleDate(DATE)}`,
)
```

## Acceptance criteria

- **AC1** (R1, R2) — Given the suite after this epic, when its assertions on
  rendered language are read, then each names a snippet and none writes the
  sentence, and every one asserts on the same element and the same subject as
  before.
- **AC2** (R3) — Given an interpolated snippet, when a test asserts the rendered
  string, then it calls the snippet with the same arguments the component did.
- **AC3** (R4) — Given `src/features/daily-groove/testing/`, when read, then it
  writes none of the app's words.
- **AC3a** (R3a) — Given the card's tempo-and-date line, when the test asserts it,
  then it composes the whole rendered string from the snippet, the formatter and
  the fixture, and asserts the same element as before.
- **AC4** (R5, R5b, R7) — Given `eslint.config.mjs`, when read, then the block is
  named, scoped by file, restricts whitespace-bearing string literals passed to
  `toBe`, `toEqual`, `toContain` and `toMatch`, carries a `message` naming the rule
  and the reason, and lists `date.test.ts`, `staffLabel.test.ts` and
  `src/lib/snippets/**` as exclusions with the reason beside each.
- **AC5** (R8) — Given each matcher the rule restricts, when a string literal is
  passed to it in a coaching module's test file, then `npm run lint` fails; and
  when it is replaced by an imported snippet, lint passes.
- **AC6** (R5a, R5b, R6, R8) — Given `expect(answer.flavour).toBe('Aeolian')`,
  `expect(el).toHaveAttribute('data-tone', 'warm')`, a query that finds a root
  chip by its name, and a prose literal written in a component test, when lint
  runs, then all pass. The rule's silence outside its scope is asserted, not
  assumed.
- **AC6b** (R5b) — Given the block run against `lib/presentation/`'s test files as
  they stand before the rewrite, when the fires are counted, then there are exactly
  11 and each is one of the 11 sentences; and given `toBe('warm')`, `toBe('open')`
  and `toBe('')` in those same files, then none fires.
- **AC6a** (R7) — Given `src/lib/snippets/`'s own test asserting
  `nearMiss({ notes: 2 })` returns `'two notes'`, when lint runs, then it passes.
- **AC7** (R9) — Given the tree, when `eslint-disable` comments for this rule are
  counted, then each carries a reason and the epic's report lists all of them.
- **AC8** (R10) — Given one snippet changed to a different word, when the suite
  runs, then it stays green and the app renders the new word; and when the change
  is reverted, the tree is byte-identical.
- **AC9** (R11) — Given `docs/coding-guidelines.md`, when read, then it carries
  the lint-enforced half with its zone described under Enforcement, carries the
  human-checked half covering every other test, says which is which, and names the
  file that motivated each.
- **AC10** — Given the full gate, when `npm test`, `npm run test:gen`, the type
  check, lint and build run, then all pass.

## Dependencies

**Needs to start:** Epic 1 landed. An assertion cannot import a snippet that does
not exist, and the areas the by-file scope names are Epic 1's files.

**Independent of Epic 2.** It touches no test Epic 2 writes and no file Epic 2
owns.

**Hands to the translation feature:** a suite that does not have to be rewritten
when a string changes, which is what translation is.

## Assumptions

- The rewrite is mechanical and large — roughly 900 matcher literals, of which the
  prose share is the part that moves. Most of it is unenforced by lint and
  verified by review, which is why it is split by file and read as a diff. It is split by test file across parallel
  tracks; no two tracks share a file.
- `GroovePuzzle.*.test.tsx`'s five files and `GuessCard.test.tsx` carry most of
  the prose and are the long pole.
- A test that imports a snippet imports it from `@/lib/snippets`, the same path a
  component uses. Tests do not reach into `snippets/en/`.
- The `message` on the block follows the house voice of the existing zones: what
  the rule is, why it exists, and what to do instead.
- `npm run lint` staying under its current runtime is not a requirement; one more
  block on a dozen test files is not a measurable cost.
- `toMatch` is restricted alongside the other three inside the scope. It carries
  the same sentences and excluding it would leave an obvious way around the rule.
- The block uses `no-restricted-syntax` with an AST selector per matcher, in the
  house style of the existing zones: one named block, one `message`, no plugin
  added.
- The component-test half being unenforced is accepted for now, not forbidden. If
  a prose literal lands in a component test three weeks later, that is the
  argument for a heuristic rule, and it is one config block away.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-03

**Q1. What does the ESLint block actually restrict?**
Answer: **A) By file only.** One block over the test files of the modules that
select sentences; the by-matcher block is dropped. Scoping by file is the only
way to tell language from data with no heuristic and no allowlist, and a rule
with a hundred false positives is a rule that gets switched off.
Applied to: Scope, Out of scope, R5, R5a, R6, R7, R7a, R8, R11, AC4, AC5, AC6,
AC9, Behaviour details, Assumptions.

**Q2. What does a test import when the rendered string mixes language and data?**
Answer: **A) The test composes it from the same parts the component does** — the
snippet, the formatter and the fixture. The whole rendered string stays the
subject, and the test still fails if the composition changes.
Applied to: R3a, AC3a, Behaviour details.

**Adjusted while applying Q1.** The option's wording put the snippets module's
own tests inside the scope. They cannot be: a test asserting a snippet function
against the snippet it imports asserts nothing, so `src/lib/snippets/**` is a
named exclusion with that reason, and R7a states the distinction the scope
rests on — `lib/presentation/` *selects* a sentence, `src/lib/snippets/`
*defines* one.

### Cycle 2 — 2026-09-03 (from the tech spec)

**Q1 (re-asked). The by-file scope alone does not work. Measured. What replaces
it?**
Answer: **A) Scope by file *and* require whitespace.** Writing the spec turned up
what the PRD had assumed away: inside `lib/presentation/`, after the two
exclusions, 43 literals reach those matchers and only 11 are sentences. A by-file
block with no further clause fires 32 times on `'warm'`, `'open'`, `'neutral'`,
`'C'` and `''`, which contradicts R6 outright. The whitespace clause fires 11 for
11 against the real config.
Applied to: R5, R5a, R5b, R5c, R6, R7a, R11, AC4, AC6, AC6b, Behaviour details.

The heuristic was declined at suite scale in Cycle 1 and taken here, and the two
are not the same bet: the strings that make it wrong suite-wide — `'C Aeolian'`,
`'Cm–Fm–G7'`, `'105 bpm · Sunday, 30 August'` — do not occur in the files this
block covers, and the two files that hold that shape were already excluded by
name. R5c records that it is a heuristic rather than letting R6 imply otherwise.
