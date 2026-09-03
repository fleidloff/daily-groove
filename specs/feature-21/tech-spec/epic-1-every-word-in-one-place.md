# Tech spec — Epic 1: Every word in one place

PRD: [../prd/epic-1-every-word-in-one-place.md](../prd/epic-1-every-word-in-one-place.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This is a move, and its whole risk is that a string arrives at the screen one
byte different from how it left. So the epic is built the only way that makes
the risk visible: **the 209 existing assertions are the test suite for this
epic**, and every step is graded by them rather than by anything new. Nothing is
reworded, nothing is renamed, nothing is added that a person can read.

The shape is one wave of writing followed by one wave of repointing. **Track A
writes the entire `src/lib/snippets/` folder and touches nothing else** — seven
area files, one index, one `types.ts`, ninety-two string values lifted from the
places they sit today. That change is purely additive: it deletes no literal, so
the tree keeps building and the suite keeps passing while it lands. Then nine
tracks, each owning one area's files and no other track's, delete the literals
and read the snippets instead. The frozen contract in this document — every key,
every signature, every area→file assignment — is what lets those nine start at
the same moment without asking each other anything.

The per-step red is the same everywhere and it is written once, under **The move
protocol**: break the snippet on purpose, watch the named existing case fail,
restore it, watch it pass. That is a real red-green on a move, and it is also
AC13 run thirty times instead of once.

Three things in the PRD do not survive contact with the tree, and the spec says
so rather than working around them: **R12 cannot hold literally** — R7 and R8
each force a test file to change — so it becomes an allow-list of five files,
audited from the diff in Step K1; **`character.ts` has twelve prose lines, not
seventeen**; and **`CHANGES_READ` is not language**, so it becomes a derivation
rather than a snippet import.

## Architecture

### The tree afterwards

```
src/lib/
├── snippets/
│   ├── index.ts            seven re-export lines, the only path a consumer names
│   ├── types.ts            seven area types + IntroStep + CoachingMove
│   └── en/
│       ├── branding.ts     appName, tagline
│       ├── header.ts       GrooveHeader, StreakBadge, HelpToggle, ShareGroove
│       ├── intro.ts        HowToPlay
│       ├── puzzle.ts       GroovePuzzle and everything under components/puzzle/
│       ├── coaching.ts     lib/presentation/
│       ├── solved.ts       SolvedPanel + the twelve mode lines
│       └── routes.ts       not-found, SharedGroove, the shared "today" link
├── modeCharacter.test.ts   ← new: the degrees/line cross-check, above both leaves
├── branding.ts             ← deleted (Step K0)
└── theory/character.ts     keeps its name, loses `line`
```

`src/lib/branding.ts` is gone. `src/lib/leaf.test.ts` and `src/lib/hash.test.ts`
need no edit: both already walk `src/lib/` recursively, so the new folder is
covered the moment it exists — `leaf.test.ts` will now fail any `@/` specifier
written inside a snippet file, which is exactly the guard R1c wants.

### Why `src/lib/` and not the feature

The placement floor admits a module to `src/lib/` when it is pure, imports no app
code, and is either shared across the app/generator boundary or a body of domain
logic that must stay whole. Snippets are neither. They are here because the
briefing, the roadmap and the PRD all fix the path, and the reason is the seam:
`en/` has to be a sibling-able folder above every consumer, and `src/lib/branding.ts`
already set that precedent at a scale of two. The cost is one arrow the generator
will never draw. It is recorded here so nobody has to re-derive why the rule bent.

### The move protocol

Every repointing step in Tracks B–G and I follows the same three beats. The step
names its guard; this names the beats.

1. **Red.** Wire the component to the snippet, then change that snippet's value
   in `src/lib/snippets/en/<area>.ts` to `ZZZ`. Run the named guard case. It must
   fail, and the failure must name the string — `Unable to find an element with
   the text: …` for a `getByText`, `Unable to find an accessible element with the
   role "button" and name "…"` for a `getByRole`, `expected "ZZZ" to be "…"` for a
   coaching-module `toBe`. A guard that stays green is a guard that was not
   guarding, and the step stops until a real one is found.
2. **Green.** Restore the snippet value. The guard passes with no edit to it.
3. **Refactor.** Delete the now-dead literal, the constant that held it, and any
   import that only served it.

A step whose red beat produces no failure has found a string nothing tests. Write
that down in the step's notes for Epic 3; do not add an assertion here — a new
assertion quoting the sentence is a second copy of it, which is what R2 forbids.

### R12 has five named exceptions, and here is why each one is forced

R12 says the only permitted test-file edits are import specifiers and the three
harness constants. Two other requirements in the same PRD make that impossible,
so the constraint becomes an allow-list. Everything outside it is still absolute.

| File | Change | Forced by |
| :-- | :-- | :-- |
| `src/components/controls/PlayControl.test.tsx` | rewritten: every case passes `text` and `name`, and the app's words leave the file | **R8.** The defaults `TEXT` and `NAME` are what ten of its cases render against. You cannot delete a default and keep the tests that rely on it. |
| `src/components/structure.test.ts` | the props list goes from four names to five; one new case for R10 | **R8 + R10.** `name` is a fifth prop; the existing case asserts the exact list. |
| `src/lib/theory/character.test.ts` | the seven `entry.line` describes leave the file | **R7.** `line` no longer exists on `ModeCharacter`; the assertions cannot compile, let alone run. |
| `src/lib/modeCharacter.test.ts` | new file | Destination for the above. See below. |
| `src/features/daily-groove/structure.test.ts` | new cases only, nothing edited | **R10.** |

Every other test file in the repo may change **import specifiers only**, plus
`puzzleHarness.tsx`'s three constants. Step K1 audits that from the diff.

**The relocated prose assertions keep their subject.** `character.test.ts`'s seven
describes over `entry.line` do not get rewritten as anything else: they move,
whole, to `src/lib/modeCharacter.test.ts`, iterating the same twelve modes and
asserting the same seven properties of the same twelve sentences. They cannot
live under `src/lib/snippets/` (they read theory) and they cannot stay under
`src/lib/theory/` (they would read snippets) — either would break the R7a arrow
that R10 asserts. A file at the `src/lib/` root imports both and breaks neither.
`src/lib/leaf.test.ts` is the precedent for a test at that root with no subject
module beside it.

### `scripts/tiers.test.ts` is left alone on purpose

Line 56 reads `expect(tiersFor(['src/lib/branding.ts'])).toEqual(['app', 'tooling'])`.
`tiersFor` is a pure function over path strings and never touches the disk, so
the case stays green after the file is deleted. It is stale, not broken, and R12
forbids the edit. Note it in the epic report as one line for a later sweep to
repoint at `src/lib/snippets/en/puzzle.ts`.

### The corrections this spec makes to the PRD

None of these change what gets built; they change what the epic is graded
against, so they are stated rather than absorbed.

- **`character.ts` holds twelve prose lines, not seventeen.** `MODE_CHARACTERS` is
  `Record<Flavour, ModeCharacter>` over the twelve renderable flavours; Locrian is
  absent by construction. AC8's "twelve degree arrays" is right and the PRD's
  "seventeen `line` values" is not.
- **`CHANGES_READ` is not a snippet.** `'Cm · Fm · G7 · Cm'` is four chord names
  joined by a format separator — data plus punctuation, on the PRD's own
  language/data table. It becomes `barChords(GROOVE.progression).join(' · ')`,
  which is "an import, not a copy" in the sense R2 means, but it does not come
  from the snippets module. AC4 is graded against that.
- **AC3 names three test files; there are four.** `src/app/page.test.tsx`,
  `GrooveHeader.test.tsx`, `GroovePuzzle.page.test.tsx` and
  `GroovePuzzle.header.test.tsx` all import `APP_NAME`.
- **AC7's JSX-text list is incomplete.** `SharedGrooveNotice.tsx`,
  `PlayTodayLink.tsx` and `SharedGroove.tsx` also write prose between tags. All
  three are covered.
- **`LeadSheet.tsx` and `ScaleStaff.tsx` contribute no snippet.** Both are fed
  entirely by data through props. The PRD's area table lists them under
  `solved.ts`; the inventory finds nothing in them to move.
- **`puzzleHarness.tsx` keeps `'Play the loop'` and `'Stop the loop'` in `play()`.**
  R2 names three constants and R12 forbids a fourth edit. Byte-identical, so it
  passes. Epic 3 clears it.

### Four strings exist twice today, and collapse to one snippet each

R13's reconciliation does not come out even without them:

| String | Second home | Collapses to |
| :-- | :-- | :-- |
| `Loop it a few times. Sing the note…` | `feedback.ts` `OPENING` **and** `moves.ts` `LADDER[0]` | `coaching.opening`, which `coaching.ladder[0].message` reuses |
| `Play today's groove` | `not-found.tsx` **and** `PlayTodayLink.tsx` | `routes.playTodayLink` |
| `Hint` | `NudgeBox`'s `aria-label` **and** its `EyebrowLabel` | `puzzle.hint` |
| `Share` | `ShareGroove`'s `label` prop **and** its own child text | `header.share` |

Plus the two the harness copies (`CAPTION`, `CAPTION_SOUNDS_OFF`). So R13 reads:

> snippet values added = user-facing literals removed − 6

## Contracts

Frozen. A track that wants a key this section does not name has found something
the inventory missed: say so, do not invent one.

### C1 — `src/lib/snippets/index.ts`, in full

```ts
export { branding } from './en/branding'
export { coaching } from './en/coaching'
export { header } from './en/header'
export { intro } from './en/intro'
export { puzzle } from './en/puzzle'
export { routes } from './en/routes'
export { solved } from './en/solved'
```

Seven lines, alphabetical, no `export *`, no type re-exports. A consumer writes
`import { puzzle } from '@/lib/snippets'` and never anything else. No file
outside `src/lib/snippets/` may contain the substring `snippets/en` (AC2).

### C2 — `src/lib/snippets/types.ts`, in full

No import of any kind. `modeLine` takes `string`, not `Flavour`, because
importing `@/lib/theory` from here would break R7a.

```ts
export type BrandingSnippets = {
  appName: string
  tagline: string
}

export type HeaderSnippets = {
  helpToggleName: string
  currentStreakName: string
  noStreakYet: string
  streakDays: (args: { days: number }) => string
  share: string
  linkCopied: string
}

export type IntroStep = { words: string; mark: string }

export type IntroSnippets = {
  title: string
  closeName: string
  steps: readonly [IntroStep, IntroStep, IntroStep, IntroStep]
  drumCredit: string
}

export type PuzzleSnippets = {
  loading: string
  captionSoundsOn: string
  captionSoundsOff: string
  audioError: string
  audioRetry: string
  playText: { play: string; stop: string; loading: string }
  playName: { play: string; stop: string }
  guessTitle: string
  rootGroup: string
  modeGroup: string
  giveUp: string
  giveUpArmed: string
  hint: string
  ruledOut: (args: { roots: number }) => string
  simpleMode: string
  tapSounds: string
  sharedNotice: string
  backToToday: string
  playTodayIntro: string
  playTodayOutro: string
  bpm: (args: { bpm: number }) => string
  sharedGroove: string
}

export type CoachingMove = { message: string; soundsOff?: string }

export type CoachingSnippets = {
  opening: string
  solved: string
  rootMatched: string
  flavourMatched: string
  neitherMatched: string
  ladder: readonly [CoachingMove, CoachingMove, CoachingMove, CoachingMove]
  colour: readonly [CoachingMove, CoachingMove]
  tonic: readonly [CoachingMove, CoachingMove]
  simpleColour: readonly [CoachingMove, CoachingMove]
  nearMissColourRight: (args: { flavour: string }) => string
  nearMissFar: (args: { flavour: string }) => string
  nearMissApart: (args: {
    flavour: string
    notes: 1 | 2
    guessed: string
    answered: string
  }) => string
  checkSolved: string
  checkPair: (args: { root: string; flavour: string }) => string
  pickMode: string
  pickRoot: string
  pickRootAndMode: string
}

export type SolvedSnippets = {
  givenUp: string
  changes: string
  notesToLiveIn: string
  modeLine: (args: { flavour: string }) => string | undefined
}

export type RoutesSnippets = {
  notFoundTitle: string
  notFoundBody: string
  playTodayLink: string
  redirecting: string
}
```

Each area file ends `} satisfies <Area>Snippets` (R1e, and `satisfies` rather
than an annotation so a caller still sees the literal string in the editor).

### C3 — the naming convention for keys

- The exported object is named for its file: `en/puzzle.ts` exports `puzzle`.
- A key is a lowerCamelCase English identifier naming the string's **job**. Not
  its text (`pickRoot`, never `pickARoot`), not its component (`hint`, never
  `nudgeBoxHint`), not the area again (`header.share`, never `header.headerShare`).
- **Every interpolating snippet takes exactly one object argument with named
  fields** — `streakDays({ days })`, `bpm({ bpm })`, `checkPair({ root, flavour })`.
  Uniform, so a call site reads without looking the signature up, and a language
  folder cannot silently reorder positional arguments (R1f).
- An accessible name with no visible twin takes the suffix `Name`:
  `helpToggleName`, `currentStreakName`, `playName`.
- No key holds markup, a glyph (`▶`, `♪`, `●`, `✕`, `?`), a bare separator
  (`' · '`, `' and '`), a URL, a licence identifier, a storage key, a locale, or a
  theory name.

### C4 — the area→file map

Frozen ownership. The left column is the only snippet object the right column's
files may import.

| Area | Read by |
| :-- | :-- |
| `branding` | `src/app/layout.tsx`, `header/GrooveHeader.tsx`, `components/GroovePuzzle.tsx` |
| `header` | `header/GrooveHeader.tsx`, `header/HelpToggle.tsx`, `header/ShareGroove.tsx`, `header/StreakBadge.tsx` |
| `intro` | `intro/HowToPlay.tsx` |
| `puzzle` | `components/GroovePuzzle.tsx`, `puzzle/GuessCard.tsx`, `puzzle/NudgeBox.tsx`, `puzzle/ModeToggle.tsx`, `puzzle/TapSoundsToggle.tsx`, `puzzle/SharedGrooveNotice.tsx`, `puzzle/PlayTodayLink.tsx`, `lib/presentation/date.ts`, `testing/puzzleHarness.tsx` |
| `coaching` | `lib/presentation/feedback.ts`, `moves.ts`, `coachingMoves.ts`, `nearMiss.ts`, `index.ts` |
| `solved` | `solved/SolvedPanel.tsx` |
| `routes` | `src/app/groove/not-found.tsx`, `src/app/groove/[uuid]/SharedGroove.tsx`, `puzzle/PlayTodayLink.tsx` |

Two entries are deliberate crossings and neither is a mistake: `date.ts` reads
`puzzle` because the meta line it builds renders on the groove card, and an area
is a place in the UI rather than a folder (R1); `PlayTodayLink.tsx` reads
`routes.playTodayLink` because that sentence is the same one the not-found route
renders, and R2 says a string lives once.

### C5 — `PlayControl`'s props after R8

```ts
type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
  busy?: boolean
  text: { play: string; stop: string; loading: string }
  name: { play: string; stop: string }
}
```

`text` loses its `= TEXT` default and becomes required; `name` is new and
required. `GLYPH` stays — glyphs are not words. The render logic is unchanged
byte for byte: `label={busy ? text.loading : name[action]}`, children
`` {`${GLYPH[state]} ${text[state]}`} ``. Five props, so
`src/components/structure.test.ts`'s expected list becomes
`['isPlaying', 'onToggle', 'busy', 'text', 'name']`.

`GroovePuzzle.tsx` is the one caller and passes `text={puzzle.playText}`
`name={puzzle.playName}`. The snippet's object types are declared structurally in
`types.ts` rather than imported from the component, because `src/lib/` may not
import `src/components/`.

### C6 — `ModeCharacter` after the split

```ts
// src/lib/theory/character.ts
export type ModeCharacter = { degrees: string[] }
export const MODE_CHARACTERS: Record<Flavour, ModeCharacter>   // twelve entries
export function characterOf(flavour: Flavour): ModeCharacter | undefined
```

`characterOf` keeps its trim/lowercase lookup exactly as written. `solved.modeLine`
implements the same tolerant lookup over its own twelve-key record — three lines
duplicated, no string duplicated — because neither leaf may import the other
(R7a). `src/lib/modeCharacter.test.ts` pins that the two agree: total over
`FLAVOURS.map(displayFlavour)`, and undefined together for `'Klingon'`,
`'Locrian'`, `''` and `'toString'`.

### C7 — the harness constants

```ts
import { puzzle } from '@/lib/snippets'
import { barChords } from '@/lib/theory/changes'

export const CAPTION = puzzle.captionSoundsOn
export const CAPTION_SOUNDS_OFF = puzzle.captionSoundsOff
export const CHANGES_READ = barChords(GROOVE.progression).join(' · ')
```

The three names do not change, so no test file that imports them changes either.

### C8 — the R12 allow-list

The diff may touch a test file only as follows. Step K1 enforces it.

- The five files in the exceptions table, as described there.
- `src/features/daily-groove/testing/puzzleHarness.tsx`: the three constants of
  C7, plus imports. `play()`'s `'Play the loop'` / `'Stop the loop'` stay.
- Every other `*.test.ts` / `*.test.tsx`: changed lines must all be import
  statements or the binding line below.

**The four tests that import `APP_NAME`/`TAGLINE` keep those identifiers.**
Rewriting the use sites to `branding.appName` would be an assertion edit, so the
names are rebound at the top of the file instead:

```ts
import { branding } from '@/lib/snippets'
const { appName: APP_NAME, tagline: TAGLINE } = branding
```

Two changed lines, both above the first `describe`, no assertion touched.

## Tracks

### Track A — the snippets folder

- **Goal** — `src/lib/snippets/` exists, complete, type-checked, imported by
  nothing. The tree builds and the whole suite passes exactly as before.
- **Owns** — `src/lib/snippets/**` (no other track writes here, in any wave)
- **Role** — `implementer`
- **Depends on** — nothing
- **Parallel with** — nothing; it is Wave 1 alone
- **Done when** — `npx tsc --noEmit`, `npm test`, `npm run lint` and
  `npm run build` all pass, and `git diff --stat` shows changes under
  `src/lib/snippets/` and nowhere else.

### Track B — the header area

- **Goal** — the four header components hold no word; `branding` and `header` are
  their only source of language.
- **Owns** — `src/features/daily-groove/components/header/**` (four components and
  their four tests)
- **Role** — `implementer`
- **Depends on** — Track A landed; contracts C1–C4
- **Parallel with** — C, D, E, F, G, H, I, J
- **Done when** — `npm test -- src/features/daily-groove/components/header` passes
  with no assertion in those four test files edited.

### Track C — the intro box

- **Goal** — `HowToPlay` renders from `intro`, `splitMark` is gone, and the box is
  byte-identical.
- **Owns** — `src/features/daily-groove/components/intro/HowToPlay.tsx`
- **Role** — `implementer`
- **Depends on** — Track A landed; contract C2's `IntroStep`
- **Parallel with** — B, D, E, F, G, H, I, J
- **Done when** — `HowToPlay.test.tsx` and `GroovePuzzle.intro.test.tsx` pass
  untouched, and the file contains no `splitMark`.

### Track D — the puzzle area

- **Goal** — the puzzle shell and its nine components hold no word.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`, all six
  `GroovePuzzle.*.test.tsx`, and `src/features/daily-groove/components/puzzle/**`
- **Role** — `implementer`
- **Depends on** — Track A landed; contracts C4 and **C5** (it codes against
  `PlayControl`'s new props while Track H implements them)
- **Parallel with** — B, C, E, F, G, H, I, J
- **Done when** — every `GroovePuzzle.*.test.tsx` and every test under
  `components/puzzle/` passes, with only the two import lines of C8 changed in
  `GroovePuzzle.page.test.tsx` and `GroovePuzzle.header.test.tsx`.

### Track E — the coaching modules

- **Goal** — `lib/presentation/` holds the rules and none of the sentences.
- **Owns** — `src/features/daily-groove/lib/presentation/**`
- **Role** — `implementer`
- **Depends on** — Track A landed; contract C2's `CoachingSnippets`
- **Parallel with** — B, C, D, F, G, H, I, J
- **Done when** — all twelve presentation test files pass, none of them edited.
  This is the track with the most assertions quoting sentences and therefore the
  strongest witness in the epic.

### Track F — the solved panel and the theory split

- **Goal** — `MODE_CHARACTERS` holds twelve degree arrays and no prose; the panel
  composes theory and snippets.
- **Owns** — `src/features/daily-groove/components/solved/**`,
  `src/lib/theory/character.ts`, `src/lib/theory/character.test.ts`, and the new
  `src/lib/modeCharacter.test.ts`
- **Role** — `implementer`
- **Depends on** — Track A landed; contracts C2 and C6
- **Parallel with** — B, C, D, E, G, H, I, J
- **Done when** — `SolvedPanel.test.tsx` passes untouched, `character.test.ts`
  passes with only the seven prose describes removed, and
  `modeCharacter.test.ts` passes with those seven describes intact.

### Track G — the routes

- **Goal** — no prose in `src/app/`.
- **Owns** — `src/app/**`
- **Role** — `implementer`
- **Depends on** — Track A landed; contract C4
- **Parallel with** — B, C, D, E, F, H, I, J
- **Done when** — `not-found.test.tsx`, `SharedGroove.test.tsx`, `page.test.tsx`,
  `layout.test.ts` and `route-boundary.test.ts` pass, with only the two import
  lines of C8 changed in `page.test.tsx`.

### Track H — `PlayControl` gives up the app's words

- **Goal** — no file under `src/components/` holds an app word, and none imports
  `@/lib/snippets`.
- **Owns** — `src/components/controls/PlayControl.tsx`,
  `src/components/controls/PlayControl.test.tsx`,
  `src/components/structure.test.ts`
- **Role** — `implementer`
- **Depends on** — contract C5 only. It does **not** need Track A: the design
  system never imports a snippet.
- **Parallel with** — B, C, D, E, F, G, I, J
- **Done when** — `npm test -- src/components` passes and no file under
  `src/components/` contains an English sentence, a domain noun, or the
  substring `@/lib/snippets`.

**The type-check breaks between H and D and that is expected.** The moment H makes
`name` required, `GroovePuzzle.tsx` is missing a prop until D lands its step. Both
are in the same wave and the wave's done-condition is the full gate; the contract
in C5 is what lets them run at once anyway.

### Track I — the test harness

- **Goal** — the harness copies nothing.
- **Owns** — `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Depends on** — Track A landed; contract C7
- **Parallel with** — B, C, D, E, F, G, H, J
- **Done when** — every test file that imports the harness passes, unedited.

### Track J — the guardrails and the rule

- **Goal** — the arrows that must not exist are asserted, and the rule no linter
  covers is written down.
- **Owns** — `src/features/daily-groove/structure.test.ts`,
  `docs/coding-guidelines.md`
- **Role** — `test-writer`
- **Depends on** — Track A landed (for the paths to scan)
- **Parallel with** — B, C, D, E, F, G, H, I
- **Done when** — the new structural cases fail on a synthetic violation in each
  direction and pass on the real tree, and the guidelines carry the rule.

### Track K — integration, reconciliation and the gate

- **Goal** — `src/lib/branding.ts` is gone, R12 is proven from the diff, R13
  reconciles, and every AC is graded.
- **Owns** — `src/lib/branding.ts` (deletion only), the epic report
- **Role** — `verifier`
- **Depends on** — every other track landed
- **Parallel with** — nothing
- **Done when** — `npm test`, `npm run test:gen`, `npx tsc --noEmit`,
  `npm run lint` and `npm run build` all pass, and Steps K1–K5 report clean.

## Execution waves

- **Wave 1:** Track A alone. Additive, so the repo is green throughout.
- **Wave 2 (parallel):** Tracks B, C, D, E, F, G, H, I, J. Nine tracks, nine
  disjoint file sets, all coding against the frozen contracts. The tree does not
  type-check between H landing and D landing; the wave is graded at its end, not
  in the middle.
- **Wave 3:** Track K.

## Implementation

### Track A — the snippets folder

Every step in this track lifts values **byte for byte** from the source named in
its inventory row. Two hazards, both of which have bitten this kind of sweep
before:

- **JSX entities.** `&apos;` renders as `'` (U+0027, apostrophe). Write `'` in the
  snippet, not `’`.
- **The typographic apostrophe is real where it appears.** `feedback.ts` and
  `moves.ts` genuinely contain `’` (U+2019) in `that’s`. Copy the character; do
  not normalise it.
- **JSX collapses whitespace.** `PlayTodayLink`'s trailing fragment renders as
  `" — your own streak is waiting."` with one leading space and single internal
  spaces, not the newline-and-indent the source shows.

#### Step A1 — the declared shape exists and one area satisfies it

Covers: R1, R1a, R1b, R1e, AC1, AC4a

- **Test first** — no runtime test. Write `src/lib/snippets/types.ts` with
  `BrandingSnippets` per C2, then `src/lib/snippets/en/branding.ts` exporting
  `{ appName: 'Eardle' } satisfies BrandingSnippets`. Run `npx tsc --noEmit`: fails
  with `error TS2345: Argument of type '{ appName: string; }' is not assignable to
  parameter of type 'BrandingSnippets'. Property 'tagline' is missing`.
- **Implement** — add `tagline`, lifted from `src/lib/branding.ts:3-4`. Write
  `src/lib/snippets/index.ts` with the single line
  `export { branding } from './en/branding'`.
- **Green when** — `npx tsc --noEmit` passes and `npm test` is unchanged.
- **Refactor** — none. `src/lib/branding.ts` stays until Step K0.

#### Step A2 — `header.ts`

Covers: R1, R1a, R3, R4, R5

- **Test first** — declare `HeaderSnippets` per C2, write `en/header.ts` with
  `helpToggleName` only. `npx tsc --noEmit` fails naming the five missing
  properties.
- **Implement** — six values: `helpToggleName` ← `HelpToggle.tsx`'s `aria-label`;
  `currentStreakName` ← `StreakBadge.tsx`'s wrapper `aria-label`; `noStreakYet`,
  `streakDays({ days })` ← `StreakBadge.tsx`'s ternary, the function reproducing
  `` `${days} day${days === 1 ? '' : 's'} streak` `` exactly; `share` ←
  `ShareGroove.tsx` (one key for both the `label` prop and the child text);
  `linkCopied` ← `ShareGroove.tsx`'s `aria-live` span. Add the index line.
- **Green when** — `npx tsc --noEmit` and `npm test` pass.
- **Refactor** — none.

#### Step A3 — `intro.ts`, with the steps already split

Covers: R1, R6a, AC7a

- **Test first** — declare `IntroStep` and `IntroSnippets`; write `steps` as four
  bare strings. `npx tsc --noEmit` fails with `Type 'string' is not assignable to
  type 'IntroStep'`.
- **Implement** — split each of `HowToPlay.tsx`'s four `STEPS` at its last space,
  exactly as `splitMark` does today: `words` keeps the trailing space, `mark` is
  the emoji alone. `{ words: 'Listen to the groove ', mark: '🎧' }`,
  `{ words: 'Jam along ', mark: '🎸' }`,
  `{ words: 'Guess the Root & Mode ', mark: '🎯' }`,
  `{ words: 'Come back every day for a new challenge ', mark: '⏭' }`. Add `title`
  (`How to play`, today a JSX text child), `closeName` and `drumCredit`.
- **Green when** — `npx tsc --noEmit` and `npm test` pass.
- **Refactor** — none. The URLs and `CC BY 4.0` stay in `HowToPlay.tsx` as data.

#### Step A4 — `puzzle.ts`

Covers: R1, R3, R4, R5, R6

- **Test first** — declare `PuzzleSnippets` per C2; write half the keys.
  `npx tsc --noEmit` names the rest.
- **Implement** — twenty-two keys, twenty-six values, sourced as:
  `loading`, `captionSoundsOn`, `captionSoundsOff`, `audioError`, `audioRetry`,
  `playText`, `playName` ← `GroovePuzzle.tsx` (`playName` from
  `PlayControl.tsx`'s `NAME`, which is what that button actually announces
  today); `guessTitle`, `rootGroup`, `modeGroup`, `giveUp`, `giveUpArmed` ←
  `GuessCard.tsx`; `hint`, `ruledOut({ roots })` ← `NudgeBox.tsx`, the function
  reproducing `` `${roots} roots ruled out. Narrowing as you go.` ``;
  `simpleMode` ← `ModeToggle.tsx`; `tapSounds` ← `TapSoundsToggle.tsx`;
  `sharedNotice`, `backToToday` ← `SharedGrooveNotice.tsx`; `playTodayIntro`,
  `playTodayOutro` ← `PlayTodayLink.tsx`; `bpm({ bpm })`, `sharedGroove` ←
  `lib/presentation/date.ts`'s `metaLine`.
- **Green when** — `npx tsc --noEmit` and `npm test` pass.
- **Refactor** — none.

#### Step A5 — `coaching.ts`

Covers: R1, R3, R4, R1f

- **Test first** — declare `CoachingMove` and `CoachingSnippets`; write
  `nearMissApart` as a constant string. `npx tsc --noEmit` fails with
  `Type 'string' is not assignable to type '(args: { flavour: string; notes: 1 | 2;
  guessed: string; answered: string; }) => string'` — which is AC4a's third case,
  demonstrated in passing.
- **Implement** — twenty-eight values. `opening`, `solved`, `rootMatched`,
  `flavourMatched`, `neitherMatched` ← `feedback.ts`'s five `Feedback` messages;
  `ladder` ← `moves.ts`'s `LADDER`, with `ladder[0].message` **referencing the
  local `opening` binding** rather than repeating it; `colour`, `tonic`,
  `simpleColour` ← `coachingMoves.ts`'s three tables, `soundsOff` carried where it
  exists and omitted where it does not; the three `nearMiss` templates ←
  `nearMiss.ts`, with `nearMissApart` doing the one-note/two-notes pluralisation
  internally from `notes`; `checkSolved`, `checkPair`, `pickMode`, `pickRoot`,
  `pickRootAndMode` ← `lib/presentation/index.ts`'s `label` ternary.
- **Green when** — `npx tsc --noEmit` and `npm test` pass.
- **Refactor** — none.

#### Step A6 — `solved.ts`

Covers: R1, R7

- **Test first** — declare `SolvedSnippets`; write `modeLine` returning `string`.
  `npx tsc --noEmit` passes — a narrower return is assignable — so the red here is
  the missing-key one: write the object without `notesToLiveIn` and let tsc name it.
- **Implement** — `givenUp`, `changes`, `notesToLiveIn` ← `SolvedPanel.tsx`;
  `modeLine({ flavour })` over a private twelve-key record lifted from
  `MODE_CHARACTERS`'s `line` values, with the same trim/lowercase lookup
  `characterOf` uses and `undefined` for anything else.
- **Green when** — `npx tsc --noEmit` and `npm test` pass.
- **Refactor** — none.

#### Step A7 — `routes.ts` and the finished index

Covers: R1, R1a, R6, AC1

- **Test first** — declare `RoutesSnippets`; leave `redirecting` out; tsc names it.
- **Implement** — `notFoundTitle`, `notFoundBody`, `playTodayLink` ←
  `src/app/groove/not-found.tsx`'s three JSX text children, with `&apos;`
  rendered as `'`; `redirecting` ← `SharedGroove.tsx`. Complete `index.ts` to the
  seven lines of C1.
- **Green when** — `npx tsc --noEmit`, `npm test`, `npm run lint`,
  `npm run build` all pass; `src/lib/leaf.test.ts` passes, proving no snippet file
  wrote an `@/` specifier.
- **Refactor** — none.

#### Step A8 — the folder holds ninety-two values and nothing else

Covers: R1b, R1c, R13, AC1

- **Test first** — no test. Run
  `grep -rn "@/" src/lib/snippets` — expect nothing. Run
  `grep -rn "snippets/en" src --include='*.ts*' | grep -v '^src/lib/snippets/'` —
  expect nothing.
- **Implement** — count the string values per area file and record them in the
  track's hand-off note: branding 2, header 6, intro 11, puzzle 26, coaching 28,
  solved 15, routes 4 = **92**. A different number is not a failure; an
  unexplained one is.
- **Green when** — both greps are empty and the count is written down.
- **Refactor** — none.

### Track B — the header area

#### Step B1 — the streak badge

Covers: R2, R5, R11, AC6

- **Test first** — wire `StreakBadge.tsx` to `header`, then set
  `header.noStreakYet` to `'ZZZ'`. Run `npm test -- StreakBadge`: fails with
  `Unable to find an element with the text: No streak yet`. Restore, then do the
  same for `currentStreakName` — fails with `Unable to find a label with the text
  of: Current streak` or the `getByLabelText` equivalent the file uses.
- **Implement** — `import { header } from '@/lib/snippets'`; the ternary becomes
  `streak === 0 ? header.noStreakYet : header.streakDays({ days: streak })`, the
  wrapper `aria-label={header.currentStreakName}`.
- **Green when** — `StreakBadge.test.tsx` passes, unedited.
- **Refactor** — delete the inline template literal. `Pill`'s `icon="●"` stays.

#### Step B2 — the help toggle and the share button

Covers: R2, R5, R11, AC6

- **Test first** — the move protocol against `HelpToggle.test.tsx` (fails with
  `Unable to find an accessible element with the role "button" and name "How to
  play"`) and `ShareGroove.test.tsx` (fails on `Share` and on `Link copied`).
- **Implement** — `HelpToggle`: `aria-label={header.helpToggleName}`; the `?`
  child stays. `ShareGroove`: `label={header.share}` and `{header.share}` as the
  child, `{outcome === 'copied' ? header.linkCopied : ''}`.
- **Green when** — both test files pass, unedited.
- **Refactor** — none.

#### Step B3 — the header reads branding from the new path

Covers: R1d, AC3

- **Test first** — change the import in `GrooveHeader.tsx` and watch
  `npx tsc --noEmit` fail on `GrooveHeader.test.tsx`, which still imports
  `@/lib/branding` — no, it does not fail, both paths exist until K0. Use the move
  protocol instead: set `branding.tagline` to `'ZZZ'`; `GrooveHeader.test.tsx`
  fails with `Unable to find an element with the text: Wordle for your ears…`.
- **Implement** — `import { branding } from '@/lib/snippets'` and render
  `{branding.appName}` / `{branding.tagline}`. In `GrooveHeader.test.tsx`, replace
  the `@/lib/branding` import with the two-line destructure of C8 so the file's
  `APP_NAME` and `TAGLINE` identifiers, and therefore every assertion, are
  untouched.
- **Green when** — `GrooveHeader.test.tsx` passes with exactly two changed lines.
- **Refactor** — none.

### Track C — the intro box

#### Step C1 — the four steps arrive already split

Covers: R6, R6a, AC7, AC7a

- **Test first** — the guard is `HowToPlay.test.tsx:31`,
  `expect(items).toEqual(STEPS)`, where `STEPS` is the test's own copy of the four
  joined strings, and `:38-43`, which asserts exactly one `aria-hidden` span per
  item. Wire the component, then set `intro.steps[1].mark` to `'ZZZ'`: the first
  case fails with
  `expected [ 'Listen to the groove 🎧', 'Jam along ZZZ', … ] to deeply equal [ … 'Jam along 🎸' … ]`.
- **Implement** — `import { intro } from '@/lib/snippets'`; delete `STEPS` and
  `splitMark`; map `intro.steps` directly, keying the `<li>` on
  `` `${step.words}${step.mark}` `` so the key is what `step` was. The `<li>`
  renders `{step.words}` then `<span aria-hidden="true">{step.mark}</span>`,
  unchanged markup.
- **Green when** — `HowToPlay.test.tsx` and `GroovePuzzle.intro.test.tsx` pass,
  unedited, and `grep -c splitMark HowToPlay.tsx` returns 0.
- **Refactor** — none.

#### Step C2 — the heading, the close button and the credit

Covers: R5, R6, AC6, AC7

- **Test first** — move protocol against `HowToPlay.test.tsx`'s heading case
  (fails with `Unable to find an accessible element with the role "heading" and
  name "How to play"`) and its close-button case.
- **Implement** — `{intro.title}` in the `Heading`,
  `aria-label={intro.closeName}` on the button, `{intro.drumCredit}` in the first
  link. `DRUM_CREDIT_URL`, `DRUM_CREDIT_LICENCE`, `DRUM_CREDIT_LICENCE_URL`,
  `CREDIT_LINK` and the `{' · '}` separator all stay in the component — a URL, a
  licence identifier, a class list and punctuation are not language.
- **Green when** — the file's tests pass, unedited, and the only quoted strings
  left in `HowToPlay.tsx` are the two URLs, `CC BY 4.0`, the class lists and `✕`.
- **Refactor** — delete `DRUM_CREDIT`.

### Track D — the puzzle area

#### Step D1 — the guess card

Covers: R2, R5, R11, AC6

- **Test first** — move protocol against `GuessCard.test.tsx`. Setting
  `puzzle.rootGroup` to `'ZZZ'` fails with `Unable to find an accessible element
  with the role "radiogroup" and name "Root"`; `giveUpArmed` fails the give-up
  case by name.
- **Implement** — `{puzzle.guessTitle}`, `label={puzzle.rootGroup}`,
  `label={puzzle.modeGroup}`, and the give-up ternary reading
  `puzzle.giveUpArmed` / `puzzle.giveUp`. `adornment={tapSounds ? '♪' : undefined}`
  stays — a glyph.
- **Green when** — `GuessCard.test.tsx` and the harness's `rootGroup()` /
  `flavourGroup()` helpers still resolve; `npm test -- GuessCard` passes.
- **Refactor** — none.

#### Step D2 — the nudge box

Covers: R2, R4, R5, AC6

- **Test first** — move protocol against `NudgeBox.test.tsx`. Setting
  `puzzle.hint` to `'ZZZ'` must fail **two** cases: the `aria-label` one and the
  eyebrow-label one. If only one fails, the other string was not the same string
  and C-level analysis was wrong.
- **Implement** — `aria-label={puzzle.hint}`, `<EyebrowLabel>{puzzle.hint}</EyebrowLabel>`,
  and `{puzzle.ruledOut({ roots: count })}` in the `<p>`.
- **Green when** — `NudgeBox.test.tsx` passes unedited, and
  `GroovePuzzle.guessing.test.tsx`'s `/roots ruled out/i` matcher still hits.
- **Refactor** — none.

#### Step D3 — the two switches and the two shared-groove blocks

Covers: R6, R11, AC7

- **Test first** — move protocol against `ModeToggle.test.tsx`,
  `TapSoundsToggle.test.tsx`, `SharedGrooveNotice.test.tsx` and
  `PlayTodayLink.test.tsx`.
- **Implement** — `label={puzzle.simpleMode}`, `label={puzzle.tapSounds}`;
  `SharedGrooveNotice` renders `{puzzle.sharedNotice}` and `{puzzle.backToToday}`;
  `PlayTodayLink` renders `{puzzle.playTodayIntro}{' '}<Link>{routes.playTodayLink}</Link>{puzzle.playTodayOutro}`.
- **Green when** — the four test files pass unedited. Watch
  `PlayTodayLink.test.tsx` in particular: if its assertion is a whole-sentence
  `getByText`, the leading space in `playTodayOutro` is load-bearing and its
  absence is exactly the failure this step is looking for.
- **Refactor** — none.

#### Step D4 — the shell

Covers: R1d, R6, R8, R11, AC3, AC7

- **Test first** — move protocol against `GroovePuzzle.sounding.test.tsx` (the
  `Couldn't play the groove.` / `Retry` alert), `GroovePuzzle.page.test.tsx` (the
  loading line and the region label) and the caption cases.
- **Implement** — `import { branding, puzzle } from '@/lib/snippets'`;
  `REGION_LABEL = branding.appName`; delete `CAPTION_SOUNDS_ON` and
  `CAPTION_SOUNDS_OFF` in favour of `puzzle.captionSoundsOn` /
  `puzzle.captionSoundsOff`; `{puzzle.loading}` in `PuzzleLoading`;
  `{puzzle.audioError}` and `{puzzle.audioRetry}` in the alert; and per **C5**
  `<PlayControl … text={puzzle.playText} name={puzzle.playName} />`.
- **Green when** — all six `GroovePuzzle.*.test.tsx` pass; the two that import
  `APP_NAME` change only the two lines of C8.
- **Refactor** — remove the `@/lib/branding` import.

### Track E — the coaching modules

#### Step E1 — the five verdicts

Covers: R2, R11

- **Test first** — move protocol against `feedback.test.ts`. Setting
  `coaching.rootMatched` to `'ZZZ'` fails with
  `expected { message: 'ZZZ', tone: 'warm' } to deeply equal { message: 'Right home note, wrong colour.', tone: 'warm' }`.
- **Implement** — `import { coaching } from '@/lib/snippets'`; each of the five
  `Feedback` constants keeps its `tone` and takes its `message` from the snippet.
- **Green when** — `feedback.test.ts` passes unedited.
- **Refactor** — none. `REVEAL_AFTER_MISSES` and the tone map are logic.

#### Step E2 — the three move tables

Covers: R2, R11

- **Test first** — move protocol against `moves.test.ts` and
  `coachingMoves.test.ts`. Setting `coaching.ladder[3].soundsOff` to `'ZZZ'` must
  fail a `coaching.test.ts` case too — that is the sounds-off path.
- **Implement** — `moves.ts` keeps `export type Move` and becomes
  `export const LADDER: readonly [Move, Move, Move, Move] = coaching.ladder`.
  `coachingMoves.ts` likewise for `COLOUR_MOVES`, `TONIC_MOVES` and
  `SIMPLE_COLOUR_MOVES`. Both modules keep their names, their exports and their
  tests; only the literals leave.
- **Green when** — `moves.test.ts`, `coachingMoves.test.ts` and `coaching.test.ts`
  pass unedited.
- **Refactor** — none. Do **not** delete either module: their tests are two of the
  epic's witnesses, and a deleted module is a deleted witness.

#### Step E3 — the near miss, with the pluralisation moved inside the snippet

Covers: R4, R1f, R11

- **Test first** — move protocol against `nearMiss.test.ts`, whose cases quote all
  three sentence shapes. Setting `coaching.nearMissFar` to a stub fails the
  long-way-from-this-one case by exact string.
- **Implement** — the three returns become
  `coaching.nearMissColourRight({ flavour: attempt.flavour })`,
  `coaching.nearMissFar({ flavour: attempt.flavour })` and
  `coaching.nearMissApart({ flavour: attempt.flavour, notes, guessed, answered })`.
  Delete `NOTE_COUNT` and the `spoken` binding; the guard that used to read
  `spoken === undefined` becomes `differences.length > 2`, which is the same
  condition written out — `NOTE_COUNT` only ever had keys 1 and 2, and
  `differences.length === 0` already returned earlier. `notes` is then
  `differences.length as 1 | 2`.
- **Green when** — `nearMiss.test.ts` passes unedited, including any case that
  feeds three or more differing degrees.
- **Refactor** — none.

#### Step E4 — the check button and the meta line

Covers: R4, R11

- **Test first** — move protocol against `lib/presentation/index.test.ts` (the
  five check labels) and `date.test.ts` (`90 bpm`, `shared groove`).
- **Implement** — in `index.ts` the `label` ternary reads `coaching.checkSolved`,
  `coaching.checkPair({ root: selectedRoot, flavour: selectedFlavour })`,
  `coaching.pickMode`, `coaching.pickRoot`, `coaching.pickRootAndMode`. In
  `date.ts`, `` `${groove.bpm} bpm` `` becomes `puzzle.bpm({ bpm: groove.bpm })`
  and `'shared groove'` becomes `puzzle.sharedGroove`. The `' · '` join and both
  `Intl.DateTimeFormat('en-GB', …)` stay — separator and locale, not language.
- **Green when** — `index.test.ts`, `date.test.ts` and every
  `GroovePuzzle.guessing.test.tsx` case matching `/^(Pick a |Check |Solved$)/`
  pass, unedited.
- **Refactor** — none.

### Track F — the solved panel and the theory split

#### Step F1 — the prose assertions move before the prose does

Covers: R7, R10, AC8, AC9

- **Test first** — create `src/lib/modeCharacter.test.ts`. Move the seven
  describes and cases that read `entry.line` or `character?.line` out of
  `src/lib/theory/character.test.ts` — `names Mixolydian by its ♭7`'s line
  assertion, `names every one of those degrees in its line`, `states what the mode
  is and stops`, `says it in one clause with no sentence break`, `fits in one line
  of prose`, `uses no word the player would have to look up`, and `the blues scale`
  — with their assertion bodies unchanged. The new file imports `characterOf` and
  `MODE_CHARACTERS` from `./theory/character`, `solved` from `./snippets`, and
  iterates `Object.keys(MODE_CHARACTERS)`, reading each line as
  `solved.modeLine({ flavour })`. Add one case: `characterOf` and `modeLine` are
  defined for exactly the same flavours, and both are `undefined` for `'Klingon'`,
  `'Locrian'`, `''` and `'toString'`. Run it against today's tree: fails with
  `TypeError: Cannot read properties of undefined` or `expected undefined to
  contain '♭7'`, because `solved.modeLine` does not exist yet — run it after Track
  A and it fails only on the tolerant-lookup case.
- **Implement** — nothing yet.
- **Green when** — it is red for the right reason.
- **Refactor** — none.

#### Step F2 — `character.ts` loses its prose half

Covers: R7, R7a, AC8

- **Test first** — Step F1's file is the test. Also `character.test.ts` must still
  pass with its remaining cases: the degree assertions, the case-insensitive
  lookup, the undefined-for-Locrian case and the totality case.
- **Implement** — `ModeCharacter` becomes `{ degrees: string[] }`; delete all
  twelve `line` values. `characterOf` is untouched.
- **Green when** — `character.test.ts` and `modeCharacter.test.ts` both pass, and
  `grep -c "line:" src/lib/theory/character.ts` returns 0.
- **Refactor** — none. The file keeps its name and its path (PRD assumption).

#### Step F3 — the panel composes theory and snippets

Covers: R7, R7a, R11, AC8

- **Test first** — move protocol against `SolvedPanel.test.tsx`: setting
  `solved.givenUp` to `'ZZZ'` fails the give-up case; setting a `modeLine` value
  fails the mode-description case; setting `solved.changes` fails the
  `LabelledColumn` case.
- **Implement** — `import { solved } from '@/lib/snippets'`. The description
  renders `character !== undefined && <Text …>{solved.modeLine({ flavour: answer.flavour })}</Text>`,
  keeping today's guard so the element appears under exactly the same condition.
  `{solved.givenUp}`, `label={solved.changes}`, `label={solved.notesToLiveIn}`.
- **Green when** — `SolvedPanel.test.tsx` passes unedited.
- **Refactor** — none. `LeadSheet.tsx` and `ScaleStaff.tsx` are not touched: every
  word they render arrives as a prop.

### Track G — the routes

#### Step G1 — the not-found page

Covers: R6, R11, AC7

- **Test first** — move protocol against `src/app/groove/not-found.test.tsx`.
  Setting `routes.notFoundBody` to `'ZZZ'` fails with `Unable to find an element
  with the text: We couldn't find the groove that link points at…`.
- **Implement** — `import { routes } from '@/lib/snippets'`;
  `{routes.notFoundTitle}`, `{routes.notFoundBody}`, `{routes.playTodayLink}`.
  Every `&apos;` disappears with the JSX text it lived in.
- **Green when** — `not-found.test.tsx` passes unedited.
- **Refactor** — none.

#### Step G2 — the shared-groove redirect and the document metadata

Covers: R1d, R6, R11, AC3, AC7

- **Test first** — move protocol against `SharedGroove.test.tsx` (the
  `Taking you to today's groove…` line) and `layout.test.ts` / `page.test.tsx` for
  the title and description.
- **Implement** — `SharedGroove.tsx` renders `{routes.redirecting}`;
  `layout.tsx`'s `metadata` reads `branding.appName` and `branding.tagline`. In
  `src/app/page.test.tsx`, apply C8's two-line destructure.
- **Green when** — `layout.test.ts`, `page.test.tsx`, `SharedGroove.test.tsx` and
  `route-boundary.test.ts` all pass, with two changed lines in `page.test.tsx`.
- **Refactor** — none.

### Track H — `PlayControl` gives up the app's words

#### Step H1 — the contract test stops knowing the app

Covers: R8, AC10

- **Test first** — rewrite `src/components/controls/PlayControl.test.tsx`: every
  case passes `text={{ play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }}`
  and `name={{ play: 'Begin', stop: 'End' }}` — words the file already uses in six
  of its cases — and asserts against those. Keep every behavioural case: both
  states, the glyph, the accessible name swapping with the action, busy
  disabling the button and announcing the loading word, busy clearing, the
  geometry cases, and the two-states-differ-only-in-glyph-and-text case. Delete
  the two cases that exist only to test the defaults (`is the default when busy is
  omitted` keeps its busy assertion, loses its `▶ Play` one; `keeps its own name
  whatever words the caller supplies` becomes `keeps the caller's name whatever
  words the caller supplies`). Run it: fails with
  `error TS2322: Object literal may only specify known properties, and 'name' does
  not exist in type 'IntrinsicAttributes & PlayControlProps'`.
- **Implement** — nothing yet.
- **Green when** — red for the right reason.
- **Refactor** — none.

#### Step H2 — the component takes both as required props

Covers: R8, AC10

- **Test first** — Step H1's file.
- **Implement** — `PlayControlProps` per **C5**: `text` loses `= TEXT` and becomes
  required, `name` is added and required. Delete the `TEXT` and `NAME` constants.
  `label={busy ? text.loading : name[action]}`; children unchanged.
- **Green when** — `npm test -- PlayControl` passes, and
  `grep -nE "'(Play|Stop|Loading…|Play the loop|Stop the loop)'" src/components/controls/PlayControl.tsx`
  returns nothing.
- **Refactor** — none. `GLYPH` stays.

#### Step H3 — the design system is checked for the same thing, and fenced

Covers: R8, R10, AC10

- **Test first** — in `src/components/structure.test.ts`, add a case
  `holds no snippet import (F21 E1 R10, AC10)`: walk `src/components/`, collect
  import specifiers with the file's existing `importSpecifiers` helper, and assert
  none contains `lib/snippets`. Seed it against a synthetic source string first so
  it is proven to fire. Run it: passes immediately on the real tree, which is
  correct — it is a fence, not a fix.
- **Implement** — update the existing `gives PlayControl only the four props its
  one caller can reach` case: rename it to `…only the five props…` and change the
  expected array to `['isPlaying', 'onToggle', 'busy', 'text', 'name']`. This is
  allow-list entry 2 of C8.
- **Green when** — `npm test -- src/components` passes, and a manual sweep of the
  remaining twenty components turns up no English sentence and no domain noun.
  Record the sweep's result in the track note; `Button.test.tsx`'s `'Play'` is out
  of scope and stays.
- **Refactor** — none.

### Track I — the test harness

#### Step I1 — the harness stops copying

Covers: R2, AC4

- **Test first** — set `puzzle.captionSoundsOn` to `'ZZZ'` after wiring. Every
  test that asserts the caption — `GroovePuzzle.sounding.test.tsx` among them —
  must fail. If none does, the harness constant was not the string the app
  renders and the copy had already drifted, which is the bug R2 exists to prevent.
- **Implement** — per **C7**: `CAPTION` and `CAPTION_SOUNDS_OFF` become
  `puzzle.captionSoundsOn` and `puzzle.captionSoundsOff`; `CHANGES_READ` becomes
  `barChords(GROOVE.progression).join(' · ')`. The three exported names do not
  change. `play()`'s two literals stay.
- **Green when** — `npm test` passes with no test file that imports the harness
  edited, and `grep -n "Find the note that feels like home" src/features/daily-groove/testing/puzzleHarness.tsx`
  returns nothing.
- **Refactor** — none.

### Track J — the guardrails and the rule

#### Step J1 — the two leaves are proven not to name each other

Covers: R7a, R10, AC9

- **Test first** — in `src/features/daily-groove/structure.test.ts`, add
  `describe('snippets and theory are siblings')` with two cases. First, a
  fire-check on synthetic sources: `import { FLAVOURS } from '../theory/names'`
  attributed to a file under `src/lib/snippets/`, and
  `import { solved } from '../snippets'` attributed to one under
  `src/lib/theory/`, both reported as offenders. Second, the real scan over
  `repoSources('src')`, using the file's existing `importSpecifiers`,
  `mockSpecifiers` and `resolveSpecifier` helpers so a `vi.mock` counts exactly as
  an import does. Run before Track F lands: green. Introduce the arrow by hand:
  fails with the offender listed.
- **Implement** — nothing else; this is a fence.
- **Green when** — both cases pass and the fire-check demonstrates each direction.
- **Refactor** — none.

#### Step J2 — the rule no linter covers

Covers: R9, AC15

- **Test first** — none; this is prose. The check is a reading.
- **Implement** — add to `docs/coding-guidelines.md`, in the *Shared code
  (`src/lib/`)* section and after the `src/lib` bar that feature-20's Epic 3
  rewrote, a rule in the document's own house form:
  **"No user-facing string is written inside a component."** It must (a) cover
  both quoted literals and JSX text children, and say that a `aria-label`,
  `title` or `alt` written inline is the same violation; (b) name the file that
  motivated it — `src/features/daily-groove/components/intro/HowToPlay.tsx`, which
  held four steps, a heading, an aria-label and a credit sentence, and
  `src/app/groove/not-found.tsx`, whose whole paragraph was JSX text; (c) carry
  the tag *human-checked*, with the sentence saying why: a linter cannot tell
  `'Aeolian'` from `'No streak yet'`; (d) say precisely which half Epic 3's lint
  rule does enforce — assertions on rendered language in test files
  (`*ByText`, `*ByRole`'s `name`, `toHaveTextContent`, `toHaveAccessibleName`) —
  and therefore that nothing mechanical will stop the next inline label in a
  component; (e) point at `src/lib/snippets/index.ts` as the destination and
  repeat R1c's ban on `snippets/en` specifiers. Add the new folder to the
  document's `src/lib/` tree listing if it draws one.
- **Green when** — `npm run lint` still passes and a reader can answer "where does
  this string go and what will catch me" from the rule alone.
- **Refactor** — none.

## Integration and verification

### Track K

#### Step K0 — `src/lib/branding.ts` is deleted

Covers: R1d, AC3

- **Test first** — `grep -rn "lib/branding" src scripts` — expect nothing but
  `scripts/tiers.test.ts:56`, which is the stale-but-passing case documented in
  Architecture. Anything else means a track missed a repoint.
- **Implement** — `git rm src/lib/branding.ts`.
- **Green when** — `npx tsc --noEmit`, `npm test` and `npm run build` pass.
- **Refactor** — none. Do not edit `scripts/tiers.test.ts`.

#### Step K1 — the diff proves R12

Covers: R12, AC12

- **Test first** — `git diff --name-only <base> -- '*.test.ts' '*.test.tsx'`.
  Subtract the five allow-listed paths of C8. For every file that remains, run
  `git diff -U0 <base> -- <file>` and assert every added and removed line is an
  `import` statement or part of one. Any other changed line fails the epic.
- **Implement** — nothing. If a file fails, the fix is to revert that line and
  make the snippet byte-identical instead.
- **Green when** — the audit lists exactly the five allow-listed files plus
  `puzzleHarness.tsx`, and the report names, per allow-listed file, which forcing
  requirement caused it.
- **Refactor** — none.

#### Step K2 — the count reconciles

Covers: R13, AC14

- **Test first** — none. Count.
- **Implement** — report three numbers: the string values now under
  `src/lib/snippets/en/` (expected 92); the user-facing literals and JSX text
  nodes removed from components, routes and coaching modules; and the six
  collapses of the Architecture table. Assert
  `added = removed − 6`. Then run `git diff <base> -- src/lib/snippets` and read
  every value against its source line to confirm no wording changed.
- **Green when** — the arithmetic closes and the reading finds no reword.
- **Refactor** — none.

#### Step K3 — the declared types are proven to bite

Covers: R1e, R1f, AC4a, AC5

- **Test first** — three temporary edits, each reverted immediately, each with its
  expected `tsc` error recorded in the report:
  1. delete `noStreakYet` from `en/header.ts` → `error TS2345 … Property
     'noStreakYet' is missing in type … but required in type 'HeaderSnippets'`
  2. add `extra: 'x'` to `en/routes.ts` → `error TS2353: Object literal may only
     specify known properties, and 'extra' does not exist in type
     'RoutesSnippets'`
  3. replace `coaching.checkPair` with a plain string → `error TS2322: Type
     'string' is not assignable to type '(args: { root: string; flavour: string; })
     => string'`
  4. call `puzzle.bpm({ bpm: '90' })` → `error TS2322: Type 'string' is not
     assignable to type 'number'` (AC5's wrong-argument half)
- **Implement** — nothing. `npx tsc --noEmit` is the tool; there is no
  type-level test runner configured, so this is a recorded manual probe and the
  report says so.
- **Green when** — all four errors appear with the quoted codes, and
  `git status` is clean afterwards.
- **Refactor** — none.

#### Step K4 — one reword goes red in exactly the right places, and reverts clean

Covers: R11, AC13

- **Test first** — change `coaching.rootMatched` to
  `'Right home note, wrong flavour.'`. Run `npm test`.
- **Implement** — nothing.
- **Green when** — the failures are confined to the cases that quote that
  sentence — `feedback.test.ts`, `lib/presentation/index.test.ts` and the
  `GroovePuzzle.guessing.test.tsx` case that reads the verdict line — and no
  other. Then `git checkout src/lib/snippets/en/coaching.ts` and confirm
  `git status` reports a clean tree and `npm test` is green. Both halves are
  reported.
- **Refactor** — none.

#### Step K5 — the session, played twice

Covers: R11, AC6, AC11, AC16

- **Test first** — `npm run dev`, then walk the PRD's path on the pre-epic commit
  and on the post-epic tree, capturing the rendered text and the accessible names
  at each stop: first visit with empty `localStorage`; the how-to-play box open
  and closed; a wrong guess with the root right; a wrong guess with the mode
  right; a wrong guess with neither; the nudge line; a lock-in; a solve; a give-up
  from a fresh day; a shared link; `/groove/<garbage>`. Collect accessible names
  with the same `readablePage()` shape `GroovePuzzle.copy.test.tsx` already uses.
- **Implement** — nothing.
- **Green when** — the two captures are identical, every accessible name traces to
  a key in `src/lib/snippets/en/`, and
  `grep -rnE "(aria-label|title|alt)=\"[A-Za-z]" src/app src/features` returns
  nothing. Then the full gate: `npm test`, `npm run test:gen`,
  `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **Refactor** — none.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1–A7 |
| R1a | A1, A7 |
| R1b | A1, A8 |
| R1c | A8, J2, K5 |
| R1d | B3, D4, G2, K0 |
| R1e | A1, K3 |
| R1f | A5, K3 |
| R2 | B1, B2, D1, D2, E1, E2, I1 |
| R3 | A2, A4, A5 |
| R4 | A2, A4, A5, D2, E3, E4 |
| R5 | A2, A4, B1, B2, C2, D1, D2 |
| R6 | A3, A4, A7, C1, C2, D3, D4, G1, G2 |
| R6a | A3, C1 |
| R7 | A6, F1, F2, F3 |
| R7a | C2 (types import nothing), F2, F3, J1 |
| R8 | H1, H2, H3, D4 |
| R9 | J2 |
| R10 | H3, J1 |
| R11 | B1–B3, C1, D1–D4, E1–E4, F3, G1, G2, K4, K5 |
| R12 | K1 |
| R13 | A8, K2 |
| AC1 | A1, A7, A8 |
| AC2 | A8, K5 |
| AC3 | B3, D4, G2, K0 |
| AC4 | I1 |
| AC4a | A1, A5, K3 |
| AC5 | K3 |
| AC6 | B1, B2, C2, D1, D2, K5 |
| AC7 | C1, C2, D3, D4, G1, G2 |
| AC7a | A3, C1 |
| AC8 | F1, F2, F3 |
| AC9 | F1, J1 |
| AC10 | H1, H2, H3 |
| AC11 | K5 |
| AC12 | K1 |
| AC13 | K4 |
| AC14 | K2 |
| AC15 | J2 |
| AC16 | K5 |

## Assumptions

- **Ninety-two string values is the inventory's number, counted by hand from the
  sources named in Track A.** It is a target for R13, not a contract. Step K2
  reports the actual and explains any gap; a difference of one or two is a
  miscount, a difference of ten is a missed file.
- **`coaching.ladder[0].message` reuses the local `opening` binding.** The two are
  the same sentence today and R2 says a string lives once. If a future epic wants
  them to diverge, it splits them there — one line.
- **The three tables stay in `moves.ts` and `coachingMoves.ts` as aliases of
  snippet members.** Both modules become thin, and both keep their tests, which
  are among the strongest witnesses this epic has. Deleting them would be tidier
  and would cost the epic its proof.
- **`nearMiss.ts`'s `differences.length > 2` guard replaces the `NOTE_COUNT`
  lookup.** Provably the same condition; the module's own tests are the check.
- **`PlayControl` takes `name` as a fifth prop rather than folding the accessible
  names into `text`.** Folding them in would have kept
  `src/components/structure.test.ts` untouched, but a prop called `text` that also
  carries accessible names is a lie the next reader pays for.
- **The relocated prose assertions land in `src/lib/modeCharacter.test.ts`.** A
  test at the `src/lib/` root with no subject module beside it, following
  `src/lib/leaf.test.ts`. The alternative — leaving them in either leaf — breaks
  the very arrow R10 asserts.
- **The area files are read as objects, never spread or destructured at module
  scope in a component.** `puzzle.hint`, not `const { hint } = puzzle`, so a
  reader of any line can see which area a word came from. The one exception is
  C8's two-line destructure in the four branding tests, which exists precisely to
  keep those files' assertions untouched.
- **No `snippets.test.ts` is written.** Any test asserting a snippet's value is a
  second copy of that string, which R2 forbids and which would make Epic 3's
  reword-freely promise false on day one. The types are the only check the folder
  gets, and the app's own suite is the rest.
- **`docs/architecture.md` is not touched.** The PRD scopes the documentation
  change to `docs/coding-guidelines.md`.

## A note on placement, settled with Epic 2

`src/lib/snippets/` strains the fourth bar in `docs/coding-guidelines.md`
§Shared code — *domain, not product* — which names *"the ladder, the nudge, the
streak"* and `lib/presentation/coaching.ts` as product that never belongs in
`src/lib/`. Snippets are wording this product chose, so the bar as written points
the other way.

The question was put with Epic 2, whose half was sharper — a `localStorage` read
breaks the *first* bar, the one §Shared code calls absolute, with no precedent in
the folder at all. **The answer was to keep the bar absolute and split Epic 2's
module**, not to widen `src/lib/` and not to move both halves out to a new
top-level. So snippets stay here, and this is why that is consistent rather than
an exception granted twice:

- the three absolute bars all hold. Snippets are pure constants and pure
  functions, import nothing outside `src/lib/`, and are runtime-safe TypeScript.
  Epic 2's module was the one that broke a bar, and it no longer does
- `src/lib/branding.ts` is already in the folder, already product wording, and
  already listed in that section's own inventory. This epic generalises a file
  that is there rather than opening a door
- the routes force it. `src/app/groove/not-found.tsx` renders words and may not
  import a feature's internals, so app-wide wording has to live above the slices

R9's entry in `docs/coding-guidelines.md` is written on that footing: the fourth
bar is the one snippets test, the first three are untouched, and the document says
so rather than leaving a reader to notice the tension themselves.

## Decision log

### Cycle 1 — 2026-09-03

**D1. One track owns the whole snippets folder, rather than a track per area.**
Decision: **Wave 1 is Track A alone.** A track per area was the obvious split and
it does not work: seven tracks would all write `types.ts` and `index.ts`, which is
one file two tracks cannot own. Giving those two files to a shared early step and
letting area tracks append to them is the same collision with more ceremony. One
author for the whole folder also removes every chance of two tracks disagreeing
about a key name, and the folder is additive, so it costs one short wave and buys
nine genuinely independent tracks after it.
Changed: Tracks, Execution waves, Contracts C1–C3.

**D2. R12 becomes an allow-list of five files.**
Decision: **Amend, and audit from the diff.** R7 removes a field that seven
`character.test.ts` describes read, and R8 removes a default that ten
`PlayControl.test.tsx` cases render against; neither has a formulation that leaves
those files untouched. The rationale behind R12 — an edited assertion hides a
changed string — is untouched by either, because neither is about a rendered
sentence. Every other test file stays absolutely frozen, and Step K1 checks it
line by line rather than on trust.
Changed: Architecture (exceptions table), Contracts C8, Step K1, Tracks F and H.

**D3. `solved.modeLine` reimplements the tolerant lookup rather than sharing one.**
Decision: **Duplicate three lines of lookup, duplicate no string.** R7a forbids an
arrow in either direction between the two leaves, and the only way to share the
normaliser is to draw one. `src/lib/modeCharacter.test.ts` pins that the two
lookups agree on every input the old single lookup was tested against.
Changed: Contracts C6, Steps A6, F1, F3.

**D4. `routes.playTodayLink` serves both the not-found route and `PlayTodayLink`.**
Decision: **One snippet, read from two areas.** The sentence is byte-identical in
both places and R2 is explicit. R1's "one file serves several components" already
allows the crossing.
Changed: Contracts C2, C4, Steps A7, D3, G1.
