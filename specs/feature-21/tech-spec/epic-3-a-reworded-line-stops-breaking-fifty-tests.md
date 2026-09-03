# Tech spec — Epic 3: A reworded line stops breaking fifty tests

PRD: [../prd/epic-3-a-reworded-line-stops-breaking-fifty-tests.md](../prd/epic-3-a-reworded-line-stops-breaking-fifty-tests.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two halves, sized about eighty to one. The large half is a mechanical rewrite of
roughly 835 matcher call sites across 28 test files: an assertion on rendered
language stops writing the sentence and imports it from `@/lib/snippets`
instead, while an assertion on data — a root, a mode, a chord symbol, a degree
string, an `Intl` date, a fixture title — keeps its literal untouched. The small
half is one `no-restricted-syntax` block in `eslint.config.mjs`, scoped by file
to `lib/presentation/`'s test files, that stops the large half regrowing in the
one folder where a literal is language by construction.

**The rewrite splits by test file and by nothing else.** No two tracks share a
file, no track edits `src/lib/snippets/`, and the tracks are sized to flatten
the critical path: `GroovePuzzle.guessing.test.tsx` alone carries 183 call
sites and is its own track. Five rewrite tracks, one lint track, one document
track, all in wave 1.

**The ordering trap is real and is solved by merging, not by sequencing.**
Turning the block on before `lib/presentation/`'s eleven sentences are rewritten
makes `npm run lint` fail for every other track in the wave. So the block and
those eleven assertions are *one* track (Track F): the rewrite and the rule that
depends on it never exist in different states. Sequencing them as two tracks
would leave the second one red at its own done-condition, which is the rule a
track has to satisfy to be a track.

**The by-file scope alone does not work, and the measurement says so.** Scoped
purely by file, the block fires 43 times inside `lib/presentation/`: 11 real
sentences and **32 false positives** — `toBe('warm')`, `toBe('open')`,
`toContain('Dorian')`, `toBe('')`. Thirty-two `eslint-disable` lines is the
nuisance rule R8's second half warns about, and it contradicts R6 outright. The
fix is one clause in the selector: **a string literal with whitespace in it is a
sentence; a one-word literal is data.** Measured against the real tree with the
real config, that clause plus the by-file scope fires exactly 11 times, on
exactly the 11 sentences, with zero false positives and zero misses. It is not
an allowlist and it names no flavour — see Contract C2 and the Decision log.

**Both halves of the proof are permanent, not a one-time break.** Feature-20's
Epic 3 could not fixture its ESLint zones, because a file that violates a zone
fails `npm run lint` for everyone. This block can be, because the failure is a
*string in a test file's argument*, not a file on disk: `scripts/lintRules.test.ts`
runs ESLint's Node API over the repo's own config on synthetic source text and
asserts the fire matrix and the quiet matrix. Verified runnable in this repo
before this spec was written.

## Architecture

### The two halves and what holds each

```
half                          scope                                   guarded by
────────────────────────────────────────────────────────────────────────────────
the coaching modules' tests   src/features/daily-groove/lib/           the block
  (11 sentences)                presentation/**/*.test.ts              (Track F)
                                minus date.test.ts, staffLabel.test.ts

every other test              5 shell tests, 9 puzzle-region tests,    a reviewer
  (~824 call sites)             7 header/intro/solved tests, 4 route   + docs
                                tests, the harness, index, state       (Track G)
```

The second row is not the epic failing to finish. R1 rewrites those assertions
either way; what is left unenforced is only whether the next one regrows, and
that is the same bet Epic 1 already takes on inline strings in components.

### What moves and what stays, in one table

Measured on today's tree. This is the line every rewrite track applies, call
site by call site.

| Literal | Verdict | After |
| :-- | :-- | :-- |
| `'Right home note, wrong colour.'` | language | `coaching.rootMatched` |
| `'Stop the loop'`, `'Play the loop'` | language (31×) | `puzzle.stopLoop`, `puzzle.playLoop` |
| `'How to play'`, `'Close how to play'` | language (22×) | `intro.howToPlay`, `intro.closeHowToPlay` |
| `'Give up and show the answer'` | language | `puzzle.giveUp` |
| `'Pick a root and a mode'`, `'Pick a mode'` | language | the check-label snippet, called |
| `'Check C Aeolian'` | language + data | the check-label snippet, called with root and flavour |
| `'2 roots ruled out. Narrowing as you go.'` | language + data | `coaching.ruledOut({ count: 2 })` |
| `'12 days streak'` | language + data | the streak snippet, called with `12` |
| `'C'`, `'A'`, `'E♭'` | data (~60×) | unchanged |
| `'Aeolian'`, `'Dorian'` | data (~20×) | unchanged |
| `'C Aeolian'`, `'C Mixolydian'` | data, composed | unchanged |
| `'Test Groove'`, `'Velvet Pocket'` | fixture titles (~20×) | unchanged |
| `'Saturday, 29 August'` | `Intl` output | unchanged |
| `'1 C, ♭3 E♭, 4 F, ♭5 G♭, 5 G, ♭7 B♭'` | degree string — theory | unchanged |
| `'Cm–Fm–G7'`, `'Cm · Fm · G7 · Cm'` | chord symbols | unchanged |
| `'warm'`, `'neutral'`, `'open'`, `'out'` | tone and state values | unchanged |
| `'105 bpm · Sunday, 30 August'` | mixed | composed — see C6 |

### Where the work sits

```
28 test files + 1 harness, across five rewrite tracks     A B C D E   (test-writer)
eslint.config.mjs + lib/presentation/*.test.ts
  + scripts/lintRules.test.ts                             F           (implementer)
docs/coding-guidelines.md                                 G           (architect)
nothing — it reverts everything it touches                H           (verifier)
```

### What does not change

- **`src/lib/snippets/`.** No track edits it, not even temporarily (see
  *Execution waves*). A rendered string with no snippet is Epic 1 unfinished —
  stop and report.
- **`src/components/**` and their tests.** Out of scope by the PRD, and Epic 1's
  `structure.test.ts` forbids anything under `src/components/` importing
  `@/lib/snippets` — tests included. A primitive is tested against props it
  passes itself, so `Button.test.tsx` keeps writing `'Play'`.
- **`scripts/grooves/`.** The generator prints to a terminal. Track F's one file
  under `scripts/` is a tooling-tier test of the repo's own lint config and
  imports nothing from `src/`.
- **What the app renders.** No snippet's value changes. The tree is
  byte-identical to the end of Epic 1 outside test files, `eslint.config.mjs`,
  `docs/coding-guidelines.md` and one new file under `scripts/`.
- **Every test's subject, name and count.** C5 is the gate that says so.

## Contracts

Frozen before any track starts.

### C1 — How a rewritten test imports a snippet

One path, one shape, in every track:

```ts
import { coaching, puzzle } from '@/lib/snippets'
```

- **From `@/lib/snippets`, never `@/lib/snippets/en/…`** (Epic 1 R1c). The
  language folder is the index's business.
- **One import statement per test file**, area objects destructured, sorted with
  the file's other `@/` imports.
- **A constant snippet is passed whole**:
  `expect(screen.getByText(coaching.rootMatched)).toBeVisible()`.
- **A function snippet is always called** (R3):
  `expect(hint()).toHaveTextContent(coaching.nearMiss({ notes: 2 }))`. Never
  passed uncalled — `getByText` accepts a *function* as a custom matcher, so
  `getByText(coaching.nearMiss)` is a silent behaviour change rather than an
  obvious error. `tsc` rejects it because the argument shapes differ; do not
  reach for a cast to make it compile.
- **`{ name: … }` takes the same treatment as `getByText`**:
  `getByRole('button', { name: puzzle.stopLoop })`.
- **Test files may import `@/lib/snippets`**, because feature → `src/lib` is a
  drawn arrow. `src/app/*.test.tsx` may too. Nothing under `src/components/`
  may, and no track touches those files.

### C2 — The ESLint block, exactly

Added to `eslint.config.mjs`. The two consts sit beside `moduleMapZones`, above
`const eslintConfig`; the block object sits in the `defineConfig([…])` array
directly after `daily-groove/import-boundaries`. `F` is the existing
`const F = "src/features/daily-groove"`.

```js
// A test in the coaching modules' folder asserts *which* sentence was
// selected, never what the sentence says — the sentence itself lives in
// src/lib/snippets/. A string literal with whitespace in it is a sentence; a
// one-word literal is a root, a mode, a tone or an option state, and stays
// legal. Measured on the tree this landed against: 11 hits, all sentences,
// no false positives.
const SENTENCE_MATCHERS = ["toBe", "toEqual", "toContain", "toMatch"];

const SENTENCE_MESSAGE =
  "A sentence the app renders must be imported from @/lib/snippets, not " +
  "written out here. lib/presentation/ selects a sentence; " +
  "src/lib/snippets/en/ defines it — so a sentence copied into this test is a " +
  "second place the wording lives, and a second place a reword has to be " +
  "found. Feature-19 paid that bill across 209 assertions. Assert the snippet " +
  "instead: expect(selectFeedback(attempts, false).message)" +
  ".toBe(coaching.rootMatched), calling it with the same arguments the module " +
  "passes if it takes any. A one-word literal is data, not language " +
  "('Aeolian', 'warm', 'open'), and is not restricted.";

const copiedSentenceRules = SENTENCE_MATCHERS.flatMap((matcher) => [
  {
    selector:
      `CallExpression[callee.property.name='${matcher}'] > ` +
      `Literal[value=type(string)][value=/\\s/]`,
    message: SENTENCE_MESSAGE,
  },
  {
    selector:
      `CallExpression[callee.property.name='${matcher}'] > ` +
      `TemplateLiteral[expressions.length=0][quasis.0.value.raw=/\\s/]`,
    message: SENTENCE_MESSAGE,
  },
]);
```

```js
  {
    name: "daily-groove/no-copied-sentences",
    files: [`${F}/lib/presentation/**/*.test.ts`],
    ignores: [
      // An Intl-formatted date is produced by the platform, not written by
      // us: dateLine() returning 'Sunday, 30 August' is an assertion about
      // en-GB, and there is no snippet to import.
      `${F}/lib/presentation/date.test.ts`,
      // A degree string is theory, not language: '1 G, 2 A, ♭3 B♭' is data
      // that happens to contain spaces. A translator translates neither half.
      `${F}/lib/presentation/staffLabel.test.ts`,
      // A module that *defines* sentences is the one place a sentence must be
      // written out. A test asserting nearMiss({ notes: 2 }) against the
      // snippet it imports asserts nothing; asserting it against 'two notes'
      // is the only version that checks anything. Redundant against today's
      // `files` glob, and kept so that widening that glob later cannot
      // silently swallow the definer.
      "src/lib/snippets/**",
    ],
    rules: { "no-restricted-syntax": ["error", ...copiedSentenceRules] },
  },
```

Four notes on the shape, each measured rather than assumed:

1. **`> Literal` is a direct child**, so `toEqual(['guessCardView', 'metaLine'])`
   stays legal — the strings are elements of an `ArrayExpression`, not arguments
   of the call. `index.test.ts`'s door assertion needs that.
2. **`[value=type(string)]`** keeps a regex literal out. `toMatch(/export \*/)`
   in `index.test.ts` stringifies to `/export \*/`, which contains a space; the
   type guard is what stops the block firing on it. Measured: it stays quiet
   with the guard, and (on esquery 1.7.0) also without it — the guard is kept
   because relying on that is relying on a coercion nobody documented.
3. **The `TemplateLiteral` selector closes the obvious hole**: a whole sentence
   written as `` `Right home note, wrong colour.` `` is not a `Literal`.
   `expressions.length=0` is what keeps R3a's composed line —
   `` `${GROOVE.bpm} ${puzzle.bpm} · ${dateLine(DATE)}` `` — legal, because that
   one has substitutions.
4. **Eight selectors, one message, four matchers.** AC5 asks for proof per
   matcher, so the matchers are enumerated rather than folded into one
   `callee.property.name=/^(toBe|…)$/` regex. `.not.toBe(…)` matches too: the
   callee is still a `MemberExpression` whose property is `toBe`.

**The escape hatch** (R9) is:

```ts
// eslint-disable-next-line no-restricted-syntax -- <reason on this line>
```

Greppable with `grep -rn "eslint-disable.*no-restricted-syntax" src scripts`.
Expected count after this epic: **zero**. Track H reports the actual count and
each reason.

### C3 — The permanent proof harness

`scripts/lintRules.test.ts`, tooling tier (`scripts/*.{test,spec}.ts`, run by
`npm test`, partitioned automatically by `scripts/tiers.test.ts`). It imports
`eslint` and `node` builtins and nothing from `src/`, so it crosses no boundary.

```ts
import { ESLint } from 'eslint'

const eslint = new ESLint({ cwd: process.cwd() })

const hits = async (filePath: string, code: string): Promise<number> => {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length
}
```

`filePath` is virtual — the file need not exist, which is what lets the quiet
matrix test `src/lib/snippets/en/coaching.test.ts` before Epic 1's folder has a
test in it. Verified runnable against this repo's config and this block, with
this exact result:

| Case | `filePath` | Source | Expect |
| :-- | :-- | :-- | --: |
| `toBe` prose | `…/lib/presentation/coaching.test.ts` | `expect(a).toBe('Right home note, wrong colour.')` | 1 |
| `toEqual` prose | same | `expect(a).toEqual('You said Dorian — one note apart.')` | 1 |
| `toContain` prose | same | `expect(a).toContain('a long way from this one')` | 1 |
| `toMatch` prose | same | `expect(a).toMatch('not a near miss')` | 1 |
| a mode | same | `expect(answer.flavour).toBe('Aeolian')` | 0 |
| a `data-` value | same | `expect(el).toHaveAttribute('data-tone', 'warm')` | 0 |
| a component test | `…/components/puzzle/GuessCard.test.tsx` | `expect(a).toBe('Right home note, wrong colour.')` | 0 |
| the date file | `…/lib/presentation/date.test.ts` | `expect(a).toBe('Sunday, 30 August')` | 0 |
| the staff file | `…/lib/presentation/staffLabel.test.ts` | `expect(a).toBe('1 G')` | 0 |
| the definer | `src/lib/snippets/en/coaching.test.ts` | `expect(nearMiss({ notes: 2 })).toBe('two notes')` | 0 |

If `new ESLint()` misbehaves under vitest's node environment, the fallback is
`execFileSync('npx', ['eslint', '--stdin', '--stdin-filename', filePath, '--format', 'json'])`
in the same test, same cases, same assertions. Do not fall back to a fixture
file on disk: a fixture that violates the block fails `npm run lint` for
everyone, which is exactly why feature-20's zones could only be demonstrated by
hand.

### C4 — What a rewrite track owns, and what it must not touch

- A track owns whole files. No file appears in two tracks.
- **No track edits `src/lib/snippets/`**, not even to add a missing key, and not
  even temporarily. A rendered string with no snippet, or a snippet whose value
  differs from what the component renders, is Epic 1 unfinished: **stop and
  report**, the way feature-20's Step A6 does.
- No track edits a component, a hook, the store, or anything under
  `src/components/`.
- No track renames a `describe`, renames an `it`, adds a case, removes a case,
  moves a case between files, or changes an `expect(…)` subject.

### C5 — The rewrite gate

This is what "green" means for a rewrite track, given the suite is already green
and must stay green. Four checks, all mechanical, all cheap.

**1. The assertion inventory is byte-identical.** `vitest list` prints
`[app] <file> > <describe> > <it>` for all 2,446 app-tier cases.

```
npx vitest list --project app > .verify/inventory.before   # before the track
npx vitest list --project app > .verify/inventory.after    # after
diff .verify/inventory.before .verify/inventory.after      # must be empty
```

An empty diff is R2's *relocated* and *deleted* halves, proven: no case moved
file, no case was renamed, no case vanished, none was added.

**2. Three per-file counts are unchanged.** For every file the track owns:

| Count | Command | Rule |
| :-- | :-- | :-- |
| assertions | `grep -c 'expect(' <file>` | unchanged |
| cases | `grep -cE '\b(it\|test)\(' <file>` | unchanged |
| patterns | `grep -cE 'new RegExp\|stringContaining\|toMatch\(/' <file>` | **must not increase** |

The third is R2's *weakened to a substring* half. A rewrite that could not find
the right snippet and reached for `getByText(/Right home note/)` shows up here.

**3. `npm test` is green**, and `npx tsc --noEmit` is clean. A wrong snippet key
is not a silent pass: `getByText(coaching.rootConfirmed)` when the component
renders `coaching.rootMatched` fails with
`TestingLibraryElementError: Unable to find an element with the text: …`,
printing the string it looked for. **That failure is this epic's red** — see
*Implementation*.

**4. The diff is arguments and imports only.** `git diff --word-diff` over the
track's files: every hunk is either the added `@/lib/snippets` import line or
the argument of a matcher. A hunk that touches an `expect(` subject, a
`describe`/`it` title, a `render(...)`, a fixture, or a `vi.mock` is a rewrite
that went past its brief.

**The mutation proof is *not* part of a track's gate.** It belongs to Track H —
see *Execution waves* for why running it inside a wave-1 track would give a
neighbouring track a false red.

### C6 — How a mixed line is composed (R3a)

A rendered string that mixes language and data is composed in the test from the
same parts the component composes it from, joined with the same separator, and
the whole rendered string stays the subject.

```ts
// before
expect(card()).toHaveTextContent('105 bpm · Sunday, 30 August')
expect(meta()).toHaveTextContent(
  `${todays.bpm} bpm · ${answer.root} ${answer.flavour} · shared groove`,
)

// after — the snippet, the formatter, the fixture; the separator stays format
expect(card()).toHaveTextContent(
  `${GROOVE.bpm} ${puzzle.bpm} · ${dateLine(DATE)}`,
)
expect(meta()).toHaveTextContent(
  `${todays.bpm} ${puzzle.bpm} · ${answer.root} ${answer.flavour} · ${puzzle.sharedGroove}`,
)
```

- The separator (`' · '`) and the locale stay as format in the test, matching
  Epic 1's assumption that they live in the module that composes the line.
- The date comes from the formatter the component uses, not from a literal —
  which is what keeps the assertion honest when the locale changes.
- The tempo comes from the fixture, not from `105`.
- A regex form already in the suite — ``new RegExp(`^${GROOVE.bpm} bpm · `)`` —
  becomes ``new RegExp(`^${GROOVE.bpm} ${puzzle.bpm} · `)``. Escaping is not
  needed for the words in play today; if a snippet ever contains a regex
  metacharacter, that is the moment the assertion should stop being a regex.

### C7 — The area names, frozen; the keys, read from the tree

Epic 1 R1 freezes seven area files: `branding`, `header`, `intro`, `puzzle`,
`coaching`, `solved`, `routes`. Those names are the contract. **The individual
snippet keys are not frozen here** — Epic 1 chooses them, and this spec cites
`coaching.rootMatched`, `puzzle.stopLoop` and the rest as illustrations of the
shape. Every track's first action is to read
`src/lib/snippets/index.ts` and the `en/` files it re-exports, and to work from
what is actually there.

Expected draw per track, to re-measure rather than to trust:

| Track | Areas its files draw from |
| :-- | :-- |
| A | `coaching`, `puzzle` |
| B | `puzzle`, `header`, `intro`, `routes`, `branding` |
| C | `puzzle` |
| D | `puzzle`, `coaching` |
| E | `solved`, `header`, `intro`, `routes`, `branding` |
| F | `coaching`, `puzzle` |

## Tracks

### Track A — The guessing test

- **Goal** — `GroovePuzzle.guessing.test.tsx`'s 183 language call sites import
  their snippets; its roots, modes, chord symbols and fixture titles still don't.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`
- **Role** — `test-writer`. Its whole product is rewritten tests.
- **Depends on** — Epic 1 merged. C1, C5, C6, C7.
- **Parallel with** — B, C, D, E, F, G
- **Command** — `npm test`
- **Done when** — C5's four checks pass on its one file. It is the longest single
  file in the epic and sets the critical path.

### Track B — The shell's page, header, intro and copy tests

- **Goal** — the four remaining `GroovePuzzle.*.test.tsx` files import their
  snippets: 128 call sites.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.page.test.tsx`,
  `GroovePuzzle.header.test.tsx`, `GroovePuzzle.intro.test.tsx`,
  `GroovePuzzle.copy.test.tsx`
- **Role** — `test-writer`
- **Depends on** — Epic 1 merged. C1, C5, C6, C7.
- **Parallel with** — A, C, D, E, F, G
- **Command** — `npm test`
- **Done when** — C5 passes on its four files.

### Track C — The sounding test and the harness

- **Goal** — `GroovePuzzle.sounding.test.tsx`'s 116 call sites and the harness's
  nine import their snippets, and `testing/` writes none of the app's words
  (R4, AC3).
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `test-writer`
- **Depends on** — Epic 1 merged, which already turns the harness's `CAPTION`,
  `CAPTION_SOUNDS_OFF` and `CHANGES_READ` into imports (Epic 1 R2). What is left
  for this track is the words written *inside* the harness's query helpers.
  C1, C5, C6, C7.
- **Parallel with** — A, B, D, E, F, G
- **Command** — `npm test`
- **Done when** — C5 passes on its two files, and no other track's file changed.
  The harness's exported helper *signatures* do not change, which is why every
  other track can use it while this one rewrites its insides.
- **`renderFeature.tsx` is deliberately not owned**: it holds no app word.

### Track D — The puzzle region

- **Goal** — the nine `components/puzzle/*.test.tsx` files import their
  snippets: 215 call sites, the largest track by count.
- **Owns** — `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`,
  `NudgeBox.test.tsx`, `GrooveCard.test.tsx`, `ModeToggle.test.tsx`,
  `TapSoundsToggle.test.tsx`, `TransportPanel.test.tsx`, `FeedbackLine.test.tsx`,
  `SharedGrooveNotice.test.tsx`, `PlayTodayLink.test.tsx`
- **Role** — `test-writer`
- **Depends on** — Epic 1 merged. C1, C5, C6, C7.
- **Parallel with** — A, B, C, E, F, G
- **Command** — `npm test`
- **Done when** — C5 passes on its nine files.

### Track E — The solved and header regions, the intro box, the routes and the slice's surface

- **Goal** — 173 call sites across eleven files import their snippets, and the
  degree strings and `Intl` dates among them stay literals.
- **Owns** — `src/features/daily-groove/components/solved/SolvedPanel.test.tsx`,
  `solved/LeadSheet.test.tsx`, `solved/ScaleStaff.test.tsx`,
  `components/header/GrooveHeader.test.tsx`, `header/ShareGroove.test.tsx`,
  `header/HelpToggle.test.tsx`, `header/StreakBadge.test.tsx`,
  `components/intro/HowToPlay.test.tsx`,
  `src/features/daily-groove/index.test.ts`,
  `src/features/daily-groove/state/PuzzleSessionContext.test.tsx`,
  `src/app/groove/not-found.test.tsx`, `src/app/groove/[uuid]/SharedGroove.test.tsx`,
  `src/app/groove/[uuid]/page.test.tsx`, `src/app/page.test.tsx`
- **Role** — `test-writer`
- **Depends on** — Epic 1 merged. C1, C5, C6, C7.
- **Parallel with** — A, B, C, D, F, G
- **Command** — `npm test`
- **Done when** — C5 passes on its fourteen files.
- **The route tests are here on purpose.** R1 says *every* assertion on rendered
  language, and `not-found.test.tsx` asserts the heading and paragraph Epic 1
  moves into `routes.ts`. `src/app/` → `src/lib/` is a drawn arrow, so the
  import is legal. They are grouped with the solved and header regions because
  they are four small files and no other track wants them.

### Track F — The coaching modules' tests, the block, and its permanent proof

- **Goal** — the eleven sentences inside `lib/presentation/`'s tests import their
  snippets; one named block in `eslint.config.mjs` stops the twelfth; and a
  tooling-tier test proves the block fires four ways and stays quiet six ways,
  permanently.
- **Owns** — `src/features/daily-groove/lib/presentation/*.test.ts` (all twelve
  files), `eslint.config.mjs`, `scripts/lintRules.test.ts`
- **Role** — `implementer`. Its dominant product is a production config block and
  a new test file, not a test rewrite; eleven assertions is a rounding error
  against the other tracks' 824.
- **Depends on** — Epic 1 merged. C2, C3, C5.
- **Parallel with** — A, B, C, D, E, G — none of them owns a file the block's
  `files` glob reaches, so turning it on cannot redden a neighbour.
- **Command** — `npm test` plus `npm run lint`
- **Done when** — `npm run lint` is clean, `scripts/lintRules.test.ts`'s ten
  cases pass, and C5 passes on its twelve test files.
- **Why the rewrite and the block are one track.** The block fires on eleven
  lines that exist until this track rewrites them. Split into two tracks, the
  config track is red at its own done-condition until the rewrite track lands —
  which is the definition of a track that should have been merged. Merged, the
  two never exist in different states, and the parallelism is bought in A–E
  instead.

### Track G — The rulebook's two halves

- **Goal** — `docs/coding-guidelines.md` carries the lint-enforced half with its
  block described under Enforcement, the human-checked half covering every other
  test, says plainly which is which, and names the file that motivated each.
- **Owns** — `docs/coding-guidelines.md`
- **Role** — `architect`
- **Depends on** — C2 only. It writes against the frozen block — its name, its
  glob, its three exclusions, its message — rather than waiting for Track F.
- **Parallel with** — A, B, C, D, E, F
- **Command** — `npm test` (nothing it owns is compiled, but
  `scripts/citations.test.ts` and the structure tests read documents and source
  from disk, so the suite must stay green)
- **Done when** — a reader can tell, from the page alone, which test files a
  linter will stop them in and which ones only a reviewer will.
- **Epic 1 writes the neighbouring rule** (no user-facing string inline in a
  component, *human-checked*). This track cross-links to it; it does not
  rewrite it.

### Track H — The reword proof, the disable inventory and the gate

- **Goal** — rewording proves out end to end, `testing/` is read back, every
  escape hatch is listed, and the full gate is green.
- **Owns** — no committed file. Every mutation it makes it reverts.
- **Role** — `verifier`
- **Depends on** — A, B, C, D, E, F, G
- **Parallel with** — nothing
- **Command** — `npm test`, `npm run test:gen`, `npx tsc --noEmit`,
  `npm run lint`, `npm run build`
- **Done when** — every AC is traced to a passing check and the tables in
  *Integration and verification* are filled in.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D, Track E, Track F,
  Track G
- **Wave 2:** Track H

Wave 1's seven tracks own disjoint files: 28 test files plus one harness split
five ways, `eslint.config.mjs` and `scripts/lintRules.test.ts` and the twelve
presentation tests in Track F, one document in Track G. Nothing in wave 1 waits
on anything else in wave 1.

**Sizing.** Call sites per track: A 183, B 128, C 125, D 215, E 173, F 11 plus
the block. Five rewrite tracks is the number that flattens the path without
splitting a folder that reads as one unit: a sixth would have to cut
`components/puzzle/` in half, which buys ~80 sites of parallelism at the cost of
two workers making the same judgement calls about the same component's words.

**The one thing wave 1 must not do: mutate `src/lib/snippets/`.** The obvious
per-track self-check — flip a snippet's value, watch the rewritten file stay
green — is correct and is exactly R10's proof. It is still forbidden inside wave
1, because Tracks A and D both draw on `puzzle.ts`: one track's mutation is
another track's spurious red, and the two would spend the wave debugging each
other. The mutation proof moves whole to Track H, which runs it once per area
file with nobody else in the tree. Each wave-1 track's self-check is C5 instead,
which needs no shared file.

**The whole epic waits on Epic 1.** Named where it bites:

| Waits on | What would break without it |
| :-- | :-- |
| Epic 1 → A–F | there is no `@/lib/snippets` to import from |
| Epic 1 → C | `puzzleHarness.tsx`'s three constants are still copies, so the track would rewrite them twice |
| Epic 1 → F | the block's `files` glob and its `src/lib/snippets/**` exclusion name a folder that does not exist |
| Epic 1 → G | the human-checked half cross-links a rule Epic 1 has not written |

**Independent of Epic 2.** It touches no test Epic 2 writes and no file Epic 2
owns.

## Implementation

Steps grouped by track. **For a rewrite track the red-green shape is
inverted from the usual one, and it is worth saying exactly how**: the suite is
already green and must stay green, so "red first" cannot mean "write a failing
test". It means this instead —

> **Red** — swap the literal for a snippet reference. If the reference names the
> wrong snippet, the test fails *loudly and by name*:
> `Unable to find an element with the text: <the snippet's actual value>`, or
> `expected '<rendered>' to be '<snippet>'`, printing both strings. That failure
> is the whole point of the step: it is the only thing that proves the rewrite
> picked the snippet the component actually renders, rather than one that reads
> plausibly.
>
> **Green** — the same case passes again, and C5's four checks hold: the
> `vitest list` inventory is byte-identical, the three per-file counts are
> unchanged, `npm test` and `tsc` are clean, and the word-diff shows only
> arguments and one import line.

A step below that says "run it: fails with X" for a rewrite track means *if the
reference is wrong*. A step that goes green on the first run has not skipped its
red; it has been given a correct reference, and C5 is what confirms it.

### Track A — The guessing test

#### Step A1 — The ladder's feedback and coaching lines

Covers: R1, R2, R3, AC1, AC2

- **Test first** — `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`:
  take `npx vitest list --project app > .verify/inventory.before` first, then add
  `import { coaching, puzzle } from '@/lib/snippets'` and replace every
  sentence-bearing `getByText` / `queryByText` / `toHaveTextContent` argument
  with its snippet. `'Right home note, wrong colour.'` becomes
  `coaching.rootMatched`; the near-miss and ruled-out lines become the snippet
  *called with the same arguments the component passes* —
  `coaching.nearMiss({ notes: 2 })`, not a hand-copied result.
- **Run it** — a wrong key fails with
  `TestingLibraryElementError: Unable to find an element with the text: <value>`.
  A function passed uncalled fails at `npx tsc --noEmit` with a signature
  mismatch on `TextMatch`.
- **Green when** — the file's cases pass unchanged, no case name or count moved.
- **Refactor** — none. Do not extract a local `const LINES = {…}` of snippets:
  that is a third place the wording lives, one indirection further from the
  source.

#### Step A2 — The accessible names, including the labels `PlayControl` gave up

Covers: R1, R2, R3, AC1, AC2

- **Test first** — the same file: every `{ name: … }` and every
  `toHaveAccessibleName(…)` whose argument is language. `'Stop the loop'` and
  `'Play the loop'` are the ones Epic 1's R8 moved out of `PlayControl` into the
  caller, so they are snippets now and the assertion says so.
  `'Give up and show the answer'` and `'Hint'` likewise.
  `toHaveAccessibleName('Check C Aeolian')` becomes the check-label snippet
  called with the root and the flavour, per R3.
- **Run it** — a wrong key fails with
  `Unable to find an accessible element with the role "button" and name "<value>"`.
- **Green when** — as A1.
- **Refactor** — none.

#### Step A3 — The composed lines, and the literals that stay literals

Covers: R1, R2, R3a, R6, AC1, AC3a

- **Test first** — the same file: apply C6 to every mixed line, including the
  regex form ``new RegExp(`^${GROOVE.bpm} bpm · `)``. Then **read every remaining
  literal in the file against the *What moves and what stays* table and leave the
  data ones alone**: `toHaveAccessibleName('Aeolian')`,
  `getByRole('heading', { name: 'C Mixolydian' })`, the root chips, the fixture
  titles. This step's product is as much what it did *not* change as what it did.
- **Run it** — a composed line built from the wrong parts fails with the two
  strings printed side by side.
- **Green when** — as A1, and the pattern count from C5 check 2 has not gone up.
- **Refactor** — none.

#### Step A4 — The track gate

Covers: R2, AC1

- **Check first** — run C5's four checks over the one file.
- **Implement** — nothing. A failing check is a rewrite to correct, not a check
  to relax. If the inventory diff is non-empty, a case was renamed or moved:
  put it back.
- **Green when** — `diff .verify/inventory.before .verify/inventory.after` is
  empty, the three counts hold, `npm test` and `npx tsc --noEmit` are clean, and
  `git diff --word-diff` on the file shows only matcher arguments and one import
  line.
- **Refactor** — none.

### Track B — The shell's page, header, intro and copy tests

#### Step B1 — `GroovePuzzle.page.test.tsx`

Covers: R1, R2, R3, R3a, R6, AC1, AC2, AC3a

- **Test first** — the same three passes as A1–A3, on 86 call sites: the
  headings and status text, the accessible names
  (`'Pick a root and a mode'`, `'Solved'`, `'Play the loop'`), the composed
  meta line, and the data literals left alone.
- **Run it** — as A1.
- **Green when** — the file's cases pass unchanged.
- **Refactor** — none.

#### Step B2 — The header, intro and copy shell tests

Covers: R1, R2, R3, R6, AC1, AC2

- **Test first** — `GroovePuzzle.header.test.tsx` (26), `GroovePuzzle.intro.test.tsx`
  (9), `GroovePuzzle.copy.test.tsx` (7). `APP_NAME` and `TAGLINE` come from
  `branding` now (Epic 1 R1d), `'How to play'` and `'Close how to play'` from
  `intro`, the share and streak strings from `header`. The formatted date and
  the groove title stay literals.
- **Run it** — as A1.
- **Green when** — the three files' cases pass unchanged.
- **Refactor** — none.

#### Step B3 — The track gate

Covers: R2, AC1

Same as A4, over Track B's four files.

### Track C — The sounding test and the harness

#### Step C1 — The harness stops writing the app's words

Covers: R1, R2, R4, AC1, AC3

- **Test first** — `src/features/daily-groove/testing/puzzleHarness.tsx`: the
  nine query helpers write app words inside their arguments —
  `getByRole('radiogroup', { name: 'Root' })`,
  `getByRole('radiogroup', { name: 'Mode' })`,
  `queryByRole('complementary', { name: 'Hint' })`. Those three names are the
  aria-labels Epic 1's R5 moved into `puzzle`, so the helpers import them.
  **Do not change a helper's name, its signature or its return type** — five
  test files in three other tracks call them concurrently.
  `NOTE_GLYPH = '♪'` stays: a glyph is not a sentence. `CHANGES_READ`,
  `CAPTION` and `CAPTION_SOUNDS_OFF` are already imports after Epic 1 R2 — if
  they are still literals here, that is Epic 1 unfinished: stop and report.
- **Run it** — a wrong key fails every test that uses the helper, naming the
  role and the name it looked for.
- **Green when** — all five shell test files and the puzzle-region tests still
  pass, unchanged, in other workers' trees.
- **Refactor** — none. Resist adding new helpers: this track's brief is the
  words, not the harness's shape.

#### Step C2 — `GroovePuzzle.sounding.test.tsx`

Covers: R1, R2, R3, R3a, R6, AC1, AC2, AC3a

- **Test first** — 116 call sites: the transport's accessible names, the caption
  and sounds-off caption assertions, the failure text
  (`"Couldn't play the groove."`, `'Retry'` — player-facing, so snippets per
  Epic 1's scope), and the composed lines at lines 272 and 1589, which are
  ``new RegExp(`^${GROOVE.bpm} bpm · `)`` forms and take C6's treatment. The
  thrown `Error` message `'Audio playback is unavailable in this browser'` is
  **not** a snippet (Epic 1 out of scope) and stays a literal wherever a test
  asserts it.
- **Run it** — as A1.
- **Green when** — the file's cases pass unchanged.
- **Refactor** — none.

#### Step C3 — The track gate

Covers: R2, R4, AC1, AC3

Same as A4, over `GroovePuzzle.sounding.test.tsx` and `puzzleHarness.tsx`. Add
one read-back: `grep -nE "'[A-Za-z][a-z]+ [a-z]" src/features/daily-groove/testing/*.tsx`
returns nothing that a translator would translate (AC3).

### Track D — The puzzle region

#### Step D1 — `GuessCard.test.tsx`

Covers: R1, R2, R3, R6, AC1, AC2

- **Test first** — 94 call sites, the largest single file in the track. The check
  button's three states — `'Pick a root and a mode'`, `'Pick a mode'`,
  `'Check C Aeolian'` — are Epic 1's R4 function snippet, so each assertion calls
  it with the selection the test set up, which is what makes the assertion say
  *this selection produces that label* rather than *the label is this string*.
  The root and flavour chip names stay literals: they are theory data.
- **Run it** — as A1.
- **Green when** — the file's cases pass unchanged.
- **Refactor** — none.

#### Step D2 — `NudgeBox.test.tsx` and `FeedbackLine.test.tsx`

Covers: R1, R2, R3, AC1, AC2

- **Test first** — 39 call sites. `toHaveTextContent('2 roots ruled out. Narrowing
  as you go.')` and its `4 roots` sibling become the ruled-out snippet called
  with the count — one snippet, two assertions, which is the pluralisation R3
  exists for. `toHaveAttribute('data-tone', 'warm')` stays: a `data-` value is
  not language (R6).
- **Run it** — as A1.
- **Green when** — both files' cases pass unchanged.
- **Refactor** — none.

#### Step D3 — The six smaller puzzle components

Covers: R1, R2, R3, R3a, R6, AC1, AC3a

- **Test first** — `GrooveCard.test.tsx` (24), `ModeToggle.test.tsx` (22),
  `TapSoundsToggle.test.tsx` (12), `TransportPanel.test.tsx` (11),
  `SharedGrooveNotice.test.tsx` (7), `PlayTodayLink.test.tsx` (6).
  `GrooveCard`'s tempo-and-date line is C6's worked example. `TransportPanel`'s
  play/stop names are the labels `PlayControl` gave up. The groove titles and the
  `Intl` dates stay literals.
- **Run it** — as A1.
- **Green when** — the six files' cases pass unchanged.
- **Refactor** — none.

#### Step D4 — The track gate

Covers: R2, AC1

Same as A4, over Track D's nine files.

### Track E — The solved and header regions, the intro box, the routes and the slice's surface

#### Step E1 — The solved region, and the degree strings that stay

Covers: R1, R2, R6, AC1

- **Test first** — `SolvedPanel.test.tsx` (57), `LeadSheet.test.tsx` (14),
  `ScaleStaff.test.tsx` (5). The mode-description lines are Epic 1's R7 snippet
  function keyed by flavour, and the solved panel composes them with the degree
  arrays from `src/lib/theory/character.ts` — so an assertion on the description
  calls the snippet, and an assertion on the degrees keeps its literal.
  `toHaveAccessibleName('1 C, ♭3 E♭, 4 F, ♭5 G♭, 5 G, ♭7 B♭')` and
  `'Cm–Fm–G7'` stay literals: theory and chord symbols.
  **This is the file where the language/data line runs through the middle of one
  component**, so read every literal against the table rather than sweeping.
- **Run it** — as A1.
- **Green when** — the three files' cases pass unchanged.
- **Refactor** — none.

#### Step E2 — The header region and the intro box

Covers: R1, R2, R3, R3a, AC1, AC2, AC3a

- **Test first** — `GrooveHeader.test.tsx` (24), `ShareGroove.test.tsx` (21),
  `HelpToggle.test.tsx` (6), `StreakBadge.test.tsx` (4),
  `HowToPlay.test.tsx` (16). `toHaveTextContent('12 days streak')` is a mixed
  line: C6 composes it from the count and the streak snippet.
  `queryByText('Saturday, 29 August')` stays. `'Current streak'`,
  `'Link copied'`, `'How to play'`, `'Close how to play'` are snippets. The
  DrumGizmo credit sentence is a snippet; `'CC BY 4.0'` and the URL are not.
  `HowToPlay`'s four steps arrive as `{ words, mark }` pairs after Epic 1's R6a,
  so an assertion on a step reads the field it renders, and `splitMark` is gone.
- **Run it** — as A1.
- **Green when** — the five files' cases pass unchanged.
- **Refactor** — none.

#### Step E3 — The routes and the slice's surface

Covers: R1, R2, AC1

- **Test first** — `src/app/groove/not-found.test.tsx` (6),
  `src/app/groove/[uuid]/SharedGroove.test.tsx` (5),
  `src/app/groove/[uuid]/page.test.tsx` (3), `src/app/page.test.tsx` (3),
  `src/features/daily-groove/index.test.ts` (6),
  `src/features/daily-groove/state/PuzzleSessionContext.test.tsx` (3). The
  not-found heading and paragraph are `routes` snippets after Epic 1's R6; the
  page title and tagline come from `branding`.
- **Run it** — as A1.
- **Green when** — the six files' cases pass unchanged, and `npm run lint` still
  passes — `src/app/` → `src/lib/` is a drawn arrow, so the new import breaks
  no zone.
- **Refactor** — none.

#### Step E4 — The track gate

Covers: R2, AC1

Same as A4, over Track E's fourteen files.

### Track F — The coaching modules' tests, the block, and its permanent proof

#### Step F1 — The eleven sentences

Covers: R1, R2, R3, R7a, AC1, AC2

- **Test first** — `src/features/daily-groove/lib/presentation/feedback.test.ts`
  (4 sentences, lines 56/61/64/67) and `nearMiss.test.ts` (7 sentences, lines
  95/115/121/128/135/140/164). Each `toBe('<sentence>')` becomes
  `toBe(<the snippet the module selects>)`, called with its arguments where it
  takes them — `coaching.nearMissOneNote({ degrees: … })` and its siblings, whose
  exact names Epic 1 sets. **This is R7a made concrete**: the assertion stops
  saying *the message is this string* and starts saying *this input selects that
  snippet*, which is the only thing `feedback.ts` and `nearMiss.ts` actually
  decide.
- **Run it** — a wrong key fails with
  `AssertionError: expected 'Right home note, wrong colour.' to be '<other snippet>'`,
  printing both.
- **Green when** — `npm test` green, `npx tsc --noEmit` clean.
- **Refactor** — none.

#### Step F2 — The composed meta line, and the two files that keep their literals

Covers: R1, R3a, R6, R7, AC1, AC3a

- **Test first** — `date.test.ts`: `metaLine`'s eight assertions mix language and
  data — `'96 bpm · shared groove'`, `'96 bpm · C Mixolydian · Sunday, 30 August'`
  — and take C6's treatment, composed from the `bpm` and shared-groove snippets,
  the fixture's tempo and `dateLine(day)`. `dateLine`'s own two assertions —
  `'Sunday, 30 August'`, `'Friday, 4 September'` — **stay literals**: that is
  `Intl` output, and it is the reason the file is a named exclusion.
  `staffLabel.test.ts` changes nothing at all: five assertions, all degree
  strings, all theory.
- **Run it** — a mis-composed meta line fails with both strings printed.
- **Green when** — `npm test` green. The file now demonstrates its own exclusion:
  two literal assertions the block must not touch sit beside eight composed ones.
- **Refactor** — none. Do not "finish the job" by inventing a snippet for the
  formatted date.

#### Step F3 — The block

Covers: R5, R5a, R6, R7, R7a, R9, AC4

- **Test first** — before adding anything, run
  `npx eslint src/features/daily-groove/lib/presentation`. It passes. **That is
  the red**: nothing today stops a twelfth sentence being typed into a coaching
  module's test.
- **Implement** — `eslint.config.mjs`, exactly per C2: `SENTENCE_MATCHERS`,
  `SENTENCE_MESSAGE` and `copiedSentenceRules` beside `moduleMapZones`; the
  `daily-groove/no-copied-sentences` block directly after
  `daily-groove/import-boundaries`, with its `files` glob, its three `ignores`
  and a comment giving the reason beside each.
  **No by-matcher block anywhere, and no rule that reaches a component test**
  (R5a). **No allowlist of flavour names anywhere in the file** (R6).
- **Green when** — `npm run lint` is clean, because F1 and F2 landed first. To
  see it fire before believing it: re-add one sentence from F1 to
  `feedback.test.ts`, run `npx eslint src/features/daily-groove/lib/presentation`,
  read the message, delete it again. Then F4 makes that permanent.
- **Refactor** — none. If any real assertion needs an exception, it is
  `// eslint-disable-next-line no-restricted-syntax -- <reason>` on the line, and
  Track H lists it. Expected count: zero.

#### Step F4 — The block fires, once per matcher, permanently

Covers: R8, AC5

- **Test first** — `scripts/lintRules.test.ts`, new file, per C3. A
  `describe('the no-copied-sentences block fires')` with four cases — one per
  matcher — each asserting
  `await hits('src/features/daily-groove/lib/presentation/coaching.test.ts', src)`
  is `1` for the C3 fire-matrix source. Run it before F3's block exists: all four
  fail with `expected 0 to be 1`. **That is the permanent red, and it is a case
  in the suite rather than a break recorded in a report.**
- **Implement** — nothing beyond F3.
- **Green when** — all four pass under `npm test`'s tooling project.
- **Refactor** — factor the four cases through one `it.each` over
  `SENTENCE_MATCHERS`' four names only if the source strings stay distinct
  sentences; a shared source string would test one matcher four times.

#### Step F5 — The block stays quiet, six ways

Covers: R5a, R6, R8, AC6, AC6a

- **Test first** — the same file, a
  `describe('the no-copied-sentences block stays quiet outside its scope')` with
  C3's six quiet cases: a mode (`toBe('Aeolian')`), a `data-` value, the same
  prose literal written in `components/puzzle/GuessCard.test.tsx`,
  `date.test.ts`, `staffLabel.test.ts`, and
  `src/lib/snippets/en/coaching.test.ts` asserting
  `nearMiss({ notes: 2 })` returns `'two notes'` (AC6a). Each asserts `0`.
  Run them against the block: all pass. To see them able to fail, delete one
  `ignores` entry and watch the matching case go to `1`; restore it.
- **Implement** — nothing.
- **Green when** — all six pass. **The rule's silence outside its scope is now
  asserted rather than assumed**, which is the half R8 says a rule is a nuisance
  without.
- **Refactor** — none. Do not merge F4's and F5's describes: one is "it fires",
  the other is "it does not", and reading them as two lists is the point.

### Track G — The rulebook's two halves

Documents are not compiled, so each step names the **check** that makes it fail.

#### Step G1 — The lint-enforced half

Covers: R11, R7a, AC9

- **Check first** — search `docs/coding-guidelines.md` for a rule about test
  literals: the nearest is *"A test lives beside the code it covers, and asserts
  that code's subject"* under Anti-patterns, which says nothing about wording.
- **Write** — a rule directly after that one, since it is the same subject seen
  from the other side. It says: a test in
  `src/features/daily-groove/lib/presentation/` asserts *which* sentence a module
  selected, never what the sentence says — because those modules select
  sentences and `src/lib/snippets/` defines them (R7a). It names the three
  exclusions and the reason for each. It gives the before/after pair from the
  PRD's Behaviour details. Tag it
  *lint-enforced* (`daily-groove/no-copied-sentences`) — motivated by
  `src/features/daily-groove/lib/presentation/nearMiss.test.ts` and
  `feedback.test.ts`, the eleven sentences that were copies; asserted by
  `scripts/lintRules.test.ts`.
- **Check green when** — a reader can tell from the page which four matchers are
  restricted, in which folder, and what to write instead.
- **Refactor** — none.

#### Step G2 — The human-checked half, and the line between them

Covers: R11, AC9

- **Check first** — after G1 the page implies a linter guards test wording. For
  824 of the 835 call sites it does not, and the document must not let a reader
  believe otherwise.
- **Write** — beside G1's rule: every *other* test — the five shell tests, the
  region components' tests, `testing/`, the route tests — is *human-checked*. A
  prose literal in `GuessCard.test.tsx` is a rule a reviewer applies, and the
  reason is measured, not stylistic: in `{ name: … }` alone, roughly 60 literals
  are roots, ~20 are modes and ~20 are fixture titles, so a rule scoped by
  matcher would need an allowlist of the twelve flavour names — a second place
  the twelve are written down, which is what feature-20's Epic 1 existed to stop.
  Two things separate language from data without a heuristic — **the file an
  assertion sits in, and a person reading the diff** — and this repo uses one of
  each. Say plainly that the unenforced half is accepted for now, not forbidden:
  if a prose literal lands in a component test three weeks later, that is the
  argument for a heuristic rule and it is one config block away. Cross-link
  Epic 1's *human-checked* inline-string rule in both directions; the two are the
  same bet on the two sides of the render.
  Tag it *human-checked* — motivated by
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`'s 183
  matcher call sites; no test asserts it.
- **Check green when** — a reader who types a sentence into a `getByText` learns
  from the page that nothing will stop them, and why that was chosen.
- **Refactor** — none.

#### Step G3 — Enforcement gains a second rule and a second block

Covers: R11, AC9

- **Check first** — the *Enforcement* section opens *"The lint-enforced rules
  above are all one ESLint rule: `import/no-restricted-paths`, configured as an
  error in the `daily-groove/import-boundaries` block … There is no second
  mechanism."* After Track F both halves of that sentence are false.
- **Write** — rewrite the opening to name two rules and two blocks: eight
  `import/no-restricted-paths` zones in `daily-groove/import-boundaries`, which
  carries no `files` key because boundaries bind tests exactly as they bind
  source; and eight `no-restricted-syntax` selectors in
  `daily-groove/no-copied-sentences`, which *is* scoped by `files`, and say why
  the difference is the whole design — a boundary is a fact about a path, a
  copied sentence is only knowable from the folder the assertion sits in. Add a
  short subsection after *The eight zones* describing the block the way the zone
  table describes a zone: name, `files`, the three `ignores` with the reason
  beside each, the four matchers, the whitespace clause, and the measurement
  (11 hits, all sentences, no false positives). Note under *What lint
  structurally cannot see* that a sentence in a component test is the case this
  block deliberately does not reach.
- **Check green when** — the section's rule count and block count match
  `eslint.config.mjs`, and no sentence claims a single mechanism.
- **Refactor** — none. Restructuring the document is out of scope.

## Integration and verification

Track H. Every mutation below is reverted; nothing in this section is committed
except the record.

### H1 — The reword proof, per area file

Covers: R3a, R10, AC8

The proof wave 1 was not allowed to run. For each area file under
`src/lib/snippets/en/`, one at a time, with nobody else in the tree:

1. Append a marker that appears nowhere else — ` ⟡` — to every string value in
   that one file. Values only; no key, no type, no signature.
2. `npm test`. **Every test must stay green**, because every assertion on
   language now reads the same mutated value the component renders.
3. `git checkout -- src/lib/snippets/en/<area>.ts`.

| Area file | Suite after mutation | Assertions that would have failed before this epic |
| :-- | :-- | --: |
| `branding.ts` | green | |
| `header.ts` | green | |
| `intro.ts` | green | |
| `puzzle.ts` | green | |
| `coaching.ts` | green | |
| `solved.ts` | green | |
| `routes.ts` | green | |

Fill the right-hand column by running the same mutation against the tree as it
stood at the end of Epic 1 (`git stash` this epic's diff, or a worktree at the
merge-base) and counting the failures. That number is what this epic bought, and
it is the number the roadmap's "209 witnesses" line becomes.

A failure in step 2 is a real finding, not a flaky proof: it names an assertion
that is still holding its own copy of a word. Report the file and the line.

Then, once, in the browser: with `coaching.ts` mutated, load the app and confirm
the marker appears in the rendered hint (AC8's *"the app renders the new word"*).
Revert and confirm `git status` is clean — the tree must be byte-identical.

### H2 — The assertion inventory, whole-suite

Covers: R1, R2, AC1

- `diff` the `vitest list --project app` output taken at the merge-base against
  the one taken now: **empty**. 2,446 cases, same files, same names, same order.
- `grep -rc 'expect(' ` over all 42 owned test files (the harness included) against the same at
  the merge-base: every count identical.
- `grep -rcE 'new RegExp|stringContaining|toMatch\(/'` over the same files: no
  count higher than at the merge-base.
- Read `git diff --word-diff` over all 42 files. Every hunk is a matcher
  argument or an import line. Record any hunk that is not, with the file and the
  reason it was allowed — the expectation is none.
- Then the R1 sweep in the other direction: for each of the ~835 call sites, is
  the argument now either a snippet reference, a composition containing one, or
  a literal the *What moves and what stays* table calls data? Sample rather than
  read all 835 — `grep -nE "(ByText|ByRole|toHaveTextContent|toHaveAccessibleName)\([^)]*'[^']{15,}'"`
  over `src/features/daily-groove` and `src/app` returns the long literals that
  survived, and every one of them must be a date, a chord symbol, a degree
  string, a fixture title or a thrown `Error` message. List them.

### H3 — `testing/` writes none of the app's words

Covers: R4, AC3

Read `src/features/daily-groove/testing/puzzleHarness.tsx` and `renderFeature.tsx`
end to end. Every string a translator would translate is an import from
`@/lib/snippets`. `NOTE_GLYPH = '♪'`, the role names (`'radiogroup'`,
`'complementary'`) and the selectors (`'[data-tone="warm"]'`) are not words.
Record the result as a list of every remaining literal in the two files, with its
verdict.

### H4 — The disable inventory

Covers: R9, AC7

```
grep -rn "eslint-disable.*no-restricted-syntax" src scripts
```

Expected: nothing. For each hit, record the file, the line, and the reason
written after the `--`. A hit with no reason is a defect to fix, not a finding to
record. A hit in `lib/presentation/` that turns out to be a data literal is the
whitespace clause being wrong about something and is worth reporting to the next
revision.

### H5 — The full gate

Covers: AC10

`npm test` · `npm run test:gen` · `npx tsc --noEmit` · `npm run lint` ·
`npm run build`. All five green, in that order.

There is no `typecheck` script in `package.json`; `npx tsc --noEmit` is the
type check this repo runs, matching feature-20's Epic 3.

`npm run test:gen` is run despite this epic touching nothing under
`scripts/grooves/`: Track F adds a file under `scripts/`, which is a
generator-tier trigger by `scripts/tiers.ts`, and the tooling tier's partition
assertion in `scripts/tiers.test.ts` must still hold with a fourth
`scripts/*.test.ts` in the tree.

Also confirm `git status` shows `grooves.lock.json`, `catalogue.json` and
`public/grooves/*.mp3` unchanged. This epic renders nothing.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2, A3, B1, B2, C1, C2, D1, D2, D3, E1, E2, E3, F1, F2, H2 |
| R2 | A1–A4, B1–B3, C1–C3, D1–D4, E1–E4, F1, H2 |
| R3 | A1, A2, B1, B2, C2, D1, D2, E2, F1 |
| R3a | A3, B1, C2, D3, E2, F2, H1 |
| R4 | C1, C3, H3 |
| R5 | F3 |
| R5a | F3, F5 |
| R6 | A3, B1, D2, D3, E1, F2, F3, F5 |
| R7 | F2, F3 |
| R7a | F1, F3, G1 |
| R8 | F4, F5 |
| R9 | F3, H4 |
| R10 | H1 |
| R11 | G1, G2, G3 |
| AC1 | A1–A4, B1–B3, C1–C3, D1–D4, E1–E4, F1, F2, H2 |
| AC2 | A1, A2, B1, B2, D1, D2, E2, F1 |
| AC3 | C1, C3, H3 |
| AC3a | A3, B1, C2, D3, E2, F2 |
| AC4 | F3 |
| AC5 | F4 |
| AC6 | F5 |
| AC6a | F5 |
| AC7 | H4 |
| AC8 | H1 |
| AC9 | G1, G2, G3 |
| AC10 | H5 |

**Totals:** 31 steps across 8 tracks in 2 waves — A 4, B 3, C 3, D 4, E 4, F 5,
G 3, H 5. 14 requirements and 12 acceptance criteria, all covered. 45 files
owned: 41 test files (A 1, B 4, C 1, D 9, E 14, F 12) plus
`testing/puzzleHarness.tsx`, `eslint.config.mjs`, `scripts/lintRules.test.ts`
(new) and `docs/coding-guidelines.md`.

## Assumptions

- **A whitespace-bearing string literal is a sentence.** Inside the block's
  scope this is exact, not a heuristic with a tolerance: measured against the
  real tree it separates 11 sentences from 32 data literals with no error in
  either direction. It is not exact *outside* that scope — `'C Aeolian'`,
  `'Test Groove'` and `'Saturday, 29 August'` all contain spaces — which is
  precisely why the block is scoped by file as well. Neither clause works alone;
  the pair is the design.
- **The tooling tier is the right home for a test of the repo's lint config.**
  `scripts/agent-floor.test.ts` and `scripts/citations.test.ts` are the
  precedent, `scripts/*.{test,spec}.ts` is the tier's glob, and
  `scripts/lintRules.test.ts` imports `eslint` and nothing from `src/`, so it
  crosses no boundary. Loading ESLint's config in-process costs a second or two
  on `npm test`; that is the price of a permanent proof over a one-time break.
- **`vitest list` is a stable inventory.** It is the cheapest complete statement
  of "the same 2,446 tests, with the same names, in the same files" this repo can
  produce, and R2's *relocated* and *deleted* clauses are exactly what it checks.
  It does not check that an assertion kept its *subject* — H2's word-diff read
  and C5's pattern count do that, and both are review-shaped.
- **The mutation proof lives in wave 2, not per track.** Two wave-1 tracks
  drawing on `puzzle.ts` would each see the other's mutation as a failure. Moving
  it whole to Track H costs one serial pass over seven small files and removes a
  class of false red that would be very expensive to diagnose in parallel.
- **Route tests are in scope and go to Track E.** R1 says every assertion on
  rendered language; `not-found.test.tsx` asserts strings Epic 1 moves into
  `routes.ts`. They are four files and 17 call sites, too small for a track of
  their own.
- **`renderFeature.tsx` and `fakeAudioContext.ts` are untouched.** Neither holds
  an app word. `testing/` being in scope (R4) is about `puzzleHarness.tsx`.
- **Five rewrite tracks, not four and not eight.** Four leaves a 311-site track
  on the critical path; eight would cut `components/puzzle/` across two workers
  making the same judgement calls about the same component's words. Five puts
  the longest track at 215 and keeps every folder whole.
- **The block goes after `daily-groove/import-boundaries`, not inside it.** They
  are different rules with different scoping needs: the boundaries block
  deliberately carries no `files` key, and this one is nothing but a `files` key.
  Merging them would force one of the two to lie.
- **`toMatch` is restricted alongside the other three**, per the PRD's own
  assumption. Today it appears in the scope only as
  `not.toMatch(/export \*/)` and `not.toMatch(new RegExp(…))`, neither of which
  the selector touches — so restricting it costs nothing now and closes an
  obvious way around the rule later.
- **The `src/lib/snippets/**` exclusion is redundant today** against a `files`
  glob that only reaches `lib/presentation/`. It is written anyway because R7
  asks for it by name with its reason, and because it is the entry that stops a
  future widening of `files` from silently swallowing the module that *defines*
  the sentences.

## Decision log

Settled while writing this spec. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-09-03

**Q1. Scoped purely by file, the block fires 43 times in `lib/presentation/` —
11 sentences and 32 data literals. What gives?**
Decision: **add a whitespace clause to the selector, not 32 `eslint-disable`
lines and not a narrower file list.** Measured on the real tree with the real
config: `Literal[value=type(string)][value=/\s/]` plus the by-file scope fires
exactly 11 times, on exactly the 11 sentences, with no false positive and no
miss. Thirty-two disables would be the nuisance rule R8's second half warns
about and would contradict R6 outright; a narrower file list would have to name
`feedback.test.ts` — which holds four sentences *and* five tone literals — so it
cannot be drawn. The clause is not an allowlist and names no flavour, which is
what R6 actually forbids. Cost: the rule cannot see a one-word sentence, and
there are none. Reversing it is one selector.
Changed: Approach, Contract C2, Steps F3–F5, Assumptions.

**Q2. Do the block and `lib/presentation/`'s rewrite go in one track or two?**
Decision: **one track (F).** The block fires on eleven lines that exist until the
rewrite lands, so as two tracks the config track is red at its own done-condition
until its neighbour finishes — the same rule that merged feature-20's door and
its guards. The parallelism is bought in A–E, where it is free.
Changed: Tracks, Execution waves.

**Q3. How does an ESLint block get "seen to fire" permanently, when a fixture
that violates it fails `npm run lint` for everyone?**
Decision: **run ESLint's Node API over synthetic source text in a tooling-tier
test.** `lintText` takes a *virtual* `filePath`, so the fire matrix and the quiet
matrix can both be asserted against the repo's own config with no file on disk —
which is what feature-20's Epic 3 could not do for `import/no-restricted-paths`
and had to demonstrate by hand into a table. Verified runnable in this repo
before this spec was written, with all ten cases giving the expected counts. Cost:
one new file under `scripts/`, a second or two on `npm test`, and a fallback to
`eslint --stdin` if vitest's node environment ever objects.
Changed: Contract C3, Steps F4, F5; Track F's file list.

**Q4. What is "red" for a track whose suite is already green and must stay
green?**
Decision: **the wrong-snippet failure is the red, and C5 is the green.** Swapping
a literal for a reference that names the wrong snippet fails loudly and prints
both strings, which is the only thing that proves the rewrite picked the snippet
the component actually renders. "Green" is then four mechanical checks — a
byte-identical `vitest list` inventory, three per-file counts, a clean
`npm test` and `tsc`, and a word-diff showing only arguments and imports —
because that quartet is what R2 means by *an assertion keeps its subject*, and
it needs no shared file. The alternative, a per-track mutation of
`src/lib/snippets/`, was cut for the parallel-collision reason in Q5.
Changed: Contract C5, the preamble to Implementation, every track's *Done when*.

**Q5. Where does the reword proof run?**
Decision: **Track H only, one area file at a time.** Tracks A and D both draw on
`puzzle.ts`, so a per-track mutation makes one track's proof another track's
false red — a failure mode that is cheap to cause and expensive to diagnose
across parallel workers. Cost: the payoff is proven once at the end rather than
five times during, so a track that quietly kept a copy of a word is caught in
wave 2 rather than in wave 1. C5's inventory and count checks are what cover the
gap in the meantime.
Changed: Execution waves, Contract C5, Step H1, Assumptions.

**Q6. Are `date.test.ts`'s `metaLine` assertions rewritten, given the file is a
named lint exclusion?**
Decision: **yes — the exclusion is from the *rule*, not from the *rewrite*.**
`metaLine` produces `'96 bpm · shared groove'`, which mixes a word, a separator
and data, and R3a says a mixed line is composed from the parts the component
composes it from. `dateLine`'s own two assertions stay literals, because they are
`Intl` output and there is no snippet to import — which is the file's stated
reason for exclusion, and after F2 the file demonstrates it: two literal
assertions sitting beside eight composed ones. `staffLabel.test.ts` changes
nothing at all.
Changed: Step F2, Contract C2's `ignores` comments, Requirement coverage.

### Cycle 2 — 2026-09-03 (ratified)

**Q1 (re-asked to the user). The by-file scope alone does not work. Measured.
What replaces it?**
Answer: **A) Scope by file *and* require whitespace.** The clause Cycle 1 arrived
at while writing this spec was put to the user as a decision rather than left as
an author's call, because the PRD's R6 claims the scope alone separates language
from data and the measurement says it does not. Confirmed with the reasoning
stated plainly: it is a heuristic, it is exact inside this scope, and the two
files where it would be wrong — `date.test.ts` and `staffLabel.test.ts` — are
already excluded by name for an independent reason.
Changed: nothing in this spec, which was already built this way. It changes the
PRD: R5, R5a, R6, R7a, AC4, AC5, AC6 and AC6a claimed the scope alone did the
work.

Independent re-measurement before the question was asked put the in-scope
literals at 44 with 11 whitespace-bearing, against Cycle 1's 43 and 11 from the
real config. The one-literal gap is a regex artefact on the checking side; the
number from running the actual rule is the one this spec uses.

## Open questions

None. Q1 was put to the user and answered; every other architectural call is in
the Decision log above. **The spec is ready to implement.**
