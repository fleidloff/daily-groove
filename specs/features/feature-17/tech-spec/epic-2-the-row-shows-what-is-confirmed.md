# Tech spec — Epic 2: The row shows what is confirmed

PRD: [../prd/epic-2-the-row-shows-what-is-confirmed.md](../prd/epic-2-the-row-shows-what-is-confirmed.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Superseded in part — the check mark is gone

**Read this before anything below.** After this spec was executed and its epic
verified, the check-mark glyph was removed. A confirmed half now **locks its
row**: every other option in it becomes unavailable, in the dim-and-unpickable
state Epic 1 already ships. The row collapsing to one live chip is the
confirmation; there is no glyph.

What that retires in the pages below — treat every mention of these as history,
not instruction:

- `mark` on `ChipProps` and `ChipOptionState`, the `MARK` class, the `data-mark`
  span, `ChipGroup`'s pass-through, and `CHECK_GLYPH`.
- The out-of-flow positioning decision and its 360px arithmetic (C3, C4, D8, and
  Steps B2, B3, B4, B7).
- The harness's `chipAdornment` narrowing to `:not([data-mark])`, which existed
  only because a mark span shared that selector.
- Contracts C3 and C4 in full.

What still stands, unchanged:

- `confirmedHalves` in `lib/presentation/confirmed.ts` — the fold over the whole
  attempt list is still what knows which half is settled, and stickiness is
  still the epic's load-bearing requirement.
- `optionStatesFor` as the single per-option map, now computing the lock rather
  than merging a mark into it.
- Track C's feedback-line change and Track E's caption change, including that
  R10 moves feature-16's AC11a.
- Every requirement about *when* a lock happens: only after *Check*, permanent
  for the day, derived from the attempts, and the same in simple mode.

The rewritten requirements and acceptance criteria are in the PRD, whose
question log carries the reasoning as Cycle 3. The implementation is recorded in
`specs/feature-17/.implement/lock-in-place-of-mark.md`.

## Approach

Four pieces, and the order they go in is the order of the dependency. First a
new `lib/presentation/confirmed.ts`: one function, `confirmedHalves(attempts)`,
which folds the *whole* attempt list into the roots and the modes a check has
established. That is where stickiness lives, and it is a plain function over a
list precisely so R3 is provable without a render — the natural implementation
(read `attempts[attempts.length - 1]`, the way `selectFeedback` legitimately
does) fails a two-line unit test rather than a player's fourth guess.

Second, the primitive gains a second decorative slot. `Chip` takes
`trailingAdornment`, drawn *after* the label and **absolutely positioned in the
`px-[15px]` the chip already reserves**, so the inline flow keeps only the `♪`
and the label — which is what makes it fit a 63px root chip at 360px. It is the
pattern `components/solved/LeadSheet.tsx` already uses for the same problem, for
the same stated reason: a mark in reserved air changes no geometry and cannot
make one chip taller than its neighbour. The mark travels in the per-option
channel Epic 1 shipped in wave 1: `ChipOptionState` gains `mark?: string`, so
one record keyed by option label carries both what a chip is and what it wears.

Third the card, which is the only place a domain meaning is attached: `GuessCard`
takes `confirmedRoots` and `confirmedFlavours` and merges them, with `'✓'`, into
the same `optionStates` record Epic 1 already builds from the ruled-out lists —
exactly as feature-16 turned `tapSounds` into `adornment={'♪'}`. The primitive
stays ignorant of what either mark means.

Fourth the page: one `useMemo` beside the four derivations already there, two
props, and the two lines of copy — `CAPTION_SOUNDS_OFF` becomes the task
sentence minus its tap clause (R10), and `ROOT_MATCHED` in `feedback.ts` loses
its instruction sentence (R13).

Two things are deliberately **not** built. There is no second mechanism for
per-option data and no second per-option prop: `optionStates` is the one channel,
so a chip's state and a chip's mark are addressed identically and cannot drift
out of step. And nothing is added to the feature's `index.ts` — the derivation is
internal to the slice, and the slice stays as removable as it was.

## Architecture

### The dependency shape

```
GroovePuzzle ──▶ lib/presentation/confirmed.ts   (confirmedHalves)
     │  confirmedRoots / confirmedFlavours
     ▼
  GuessCard ──▶ @/components/controls/ChipGroup ──▶ Chip
     │        (optionStates[label].mark = '✓')     (trailingAdornment)
     └──▶ lib/presentation/feedback.ts   (ROOT_MATCHED, shorter)
```

The arrow that is missing is the point: `Chip` and `ChipGroup` learn that a
mark can vary per option and learn nothing else. No root, no mode, no reason a
chip is marked, no `'✓'` — the glyph is a string the card passes down, as `'♪'`
already is.

### Where the check mark sits, and the arithmetic behind it

The PRD's *Behaviour details* does the sum: at 360px, `PageShell`'s `px-5` and
`Card`'s `p-6` leave 272px; the root row is `grid-cols-4` with `gap-[7px]`, so a
chip is ~63px, and `Chip`'s `px-[15px]` leaves ~33px of content. Two inline
glyphs plus `C♯` wants ~47px of it. So one of the two marks has to leave the
flow, and it is the new one:

```
┌─ chip, ~63px ─────────────────────────────┐
│ 15px  │  ♪ 5px C♯          │  15px       │
│ pad   │  the inline flow    │  pad        │
│       │  ~30px of ~33px     │   ✓ here    │
└───────────────────────────────────────────┘
        absolute right-[4px] top-1/2 -translate-y-1/2, text-[10px]
```

`✓` (U+2713, text presentation — not U+2714, which several platforms render as
an emoji) at `text-[10px]` is ~9px wide. At `right-[4px]` it spans 4–13px in
from the border, inside the 15px the chip already reserves, with ~2px clearance
before the content box begins. `top-1/2 -translate-y-1/2` centres it on the
chip's own box, which is where an inline trailing mark's optical centre would
have been.

Three consequences, and each is a test rather than a comment:

- **The button's class list is identical with and without the mark.** `relative`
  goes on `BASE` unconditionally, so no chip changes class when it becomes
  confirmed — which is how "no other chip moves and every chip keeps the same
  height" (AC10b) is true by construction rather than by measurement, in a
  test runner that measures nothing.
- **A font size on the mark cannot reach the line box**, because the mark is out
  of the flow. That is the one licence the trailing mark has that the leading
  one does not: `Chip.test.tsx` currently refuses anything but horizontal margin
  on the `♪`, and the trailing mark gets its own allowlist — positioning, a
  transform, an arbitrary size — for exactly this reason.
- **The mark takes `currentColor`**, so a selected chip's accent ink, an idle
  chip's text ink and a locked chip's `disabled:opacity-60` all carry it without
  naming a palette token. Same bargain the `♪` struck.

### Both marks, and why neither replaces the other

R9a: the `♪` stays before the label, the check goes after it. They are two
different claims — one about what a tap does, one about what a check
established — so a confirmed chip wears both. With the tap sounds off the chip
wears the check alone, and `Chip` renders each span only for a truthy string, so
the absent one removes nothing else.

This is what forces one change in the test harness. `chipAdornment` in
`testing/puzzleHarness.tsx` reads the *first* `[aria-hidden="true"]` child, and
with two hidden spans on one chip that stops meaning "the `♪`". The trailing
span therefore carries `data-mark` — the convention `LeadSheet`'s
`data-numeral`, `AttemptDots`' `data-dot-state` and `ChipGroup`'s own
`data-testid="chip-list"` already set — and `chipAdornment` selects
`[aria-hidden="true"]:not([data-mark])`. Without that narrowing, a chip that is
confirmed while the sounds are off reports `'✓'` as its adornment, and
feature-16's `marked().every((glyph) => glyph === null)` assertions become
quietly wrong.

### Stickiness, stated as the shape of a function

```
attempts: [ C+wrong ]  [ C+wrong, G+wrong ]  [ C+wrong, G+wrong, A+wrong ]
                  ↓                   ↓                          ↓
roots:        ['C']               ['C']                      ['C']
```

`confirmedHalves` folds the list; it never indexes into it. The unit test that
matters is the one where the confirming attempt is *not* last, because that is
the single assertion the "read the most recent attempt" implementation cannot
pass. It is written first, in Step A4.

### Why no chip is ever both marked and ruled out (R7, AC8)

Not a rule anyone enforces — a consequence, proven twice from two directions,
neither of which needs Epic 1's module names:

1. **An invariant, in the unit tier.** `scoreAttempt` sets
   `rootMatched = answer.root === guess.root`, so every root
   `confirmedHalves` can return *is* the day's root; every flavour it can
   return is the day's flavour under `exactMatch`, or the day's family under
   `familyMatch`. Epic 1's R7 says a ruled-out chip is never the day's answer.
   The intersection is therefore empty by arithmetic. Step A7 asserts the
   invariant over generated attempt lists in both matchers.
2. **Selectability, in the composed tier.** A ruled-out chip cannot be selected,
   whatever Epic 1 used to make that true. So "the marked chip selects normally"
   (AC5) is also the assertion that it is not ruled out, and it is written
   against rendered behaviour rather than against Epic 1's mechanism.

### None of this epic's reasoning goes in a comment

`AGENTS.md` now says code should explain itself, and that a comment is for
something genuinely non-obvious — a workaround, a platform quirk, a reference —
never for prose. The surrounding code is heavily prose-commented; that is the
old style and this epic does not match it.

So the three places an implementer would reach for a comment are handled here
instead:

| Would have been a comment | Goes here instead |
| :-- | :-- |
| why the check mark is positioned rather than inline | the arithmetic above, plus Steps B3, B4 and D8 — AC10b *is* the guarantee, asserted as a class-and-flow invariant |
| why `relative` is unconditional on `BASE` | the arithmetic above, and Step B3's assertion that a marked chip's class list equals an unmarked one's |
| which epic owns which caption wording | the two wordings mirrored in `testing/puzzleHarness.tsx`, where every assertion reads them from |

Two consequences for the steps below. **No step instructs a comment**, and where
one previously would have, the reasoning is in this spec and the guarantee is a
named test. And the prose comments this epic's files carry *today* are deleted
where the epic edits the line they annotate — named, one by one, in Steps B7,
E1 and E8 — rather than rewritten to match the change.

### What this epic expects to find in the three shared files, and what it must not touch

Epic 1 owns all three in wave 1. This epic opens them in wave 2, after Epic 1
has landed. Before a track opens one, check it against this table; if the left
column is not true yet, Epic 1 has not landed and the track waits.

| File | Expected on arrival | This epic changes | This epic must not touch |
| :-- | :-- | :-- | :-- |
| `lib/presentation/feedback.ts` | `NUDGE_AFTER_MISSES` **gone** (its 2 now `ELIMINATE_AFTER_MISSES` in `lib/puzzle/narrowing.ts`); `shouldShowNudge(eliminatedCount, solved)` reshaped; `DOT_COUNT`, `REVEAL_AFTER_MISSES`, `selectFeedback`, `dotStates`, `shouldOfferReveal`, `missCount`, `matchedHalf`, `WRONG_GUESS` unchanged | `ROOT_MATCHED.message` only | the narrowing/nudge selectors, `FLAVOUR_MATCHED` (Epic 1's AC3 asserts it), `NEITHER_MATCHED`, `OPENING`, `SOLVED`, `dotStates`, every tone |
| `components/puzzle/GuessCard.tsx` | per-option ruled-out state on both `ChipGroup`s; the nudge slot rewired to Epic 1's narrowing line; `adornment={tapSounds ? '♪' : undefined}` still on both rows | two props, and `optionStates` on both rows becoming a merge (Epic 1's `unavailableStates` → `optionStatesFor`) | the narrowing box slot and `eliminated`, `ruledOutRoots`/`ruledOutFlavours` themselves, the split `onSelect`/`onPress` handlers, the give-up block, the two toggles, the `over` lock, `disarming` |
| `components/GroovePuzzle.tsx` | Epic 1's ruled-out memo(s) beside `feedback`/`showNudge`/`dots`/`showReveal`; its narrowing props on `GuessCard` | one `useMemo`, two props, `CAPTION_SOUNDS_OFF`'s value, and the deletion of both captions' prose comments | `CAPTION_SOUNDS_ON`, the ternary between the two, Epic 1's memos, the roots/flavours memos, both hear handlers and the tap-sounds gate |
| `testing/puzzleHarness.tsx` | whatever helper Epic 1 added for a ruled-out chip | `CAPTION_SOUNDS_OFF`, `chipAdornment`'s selector, plus `CHECK_GLYPH` and `chipMark` | Epic 1's helper, `CAPTION`, `NOTE_GLYPH`, `chipLabel`, `guess`, `miss` |

## Contracts

Frozen before any track starts. C1 is **Epic 1's** to ship and is restated here
as what this epic builds against; C2–C7 are this epic's own.

### C1 — the per-option channel on `ChipGroup` (Epic 1's, extended here)

Epic 1 has landed. This is what it froze, verbatim from its own C1, with the one
field this epic fills:

```ts
// src/components/controls/ChipGroup.tsx — shipped by Epic 1, wave 1
export type ChipOptionState = {
  unavailable?: boolean
  mark?: string        // declared by Epic 1's A7; wired and rendered in B7/B2
}

type ChipGroupProps = {
  label: string
  options: string[]
  value: string | null
  onSelect: (option: string) => void
  onPress?: (option: string) => void
  disabled: boolean
  name: string
  columns: ChipColumns
  adornment?: string
  optionStates?: Record<string, ChipOptionState>
}
```

```ts
// src/components/controls/Chip.tsx — shipped by Epic 1
type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  unavailable?: boolean
  onSelect: () => void
  onPress?: () => void
  tone?: ChipTone
  adornment?: string
}
```

**One record, not two props.** `optionStates` is keyed by the option's own label
string and says what one option's chip is beyond what the row is. The check mark
is a field on it, so a chip's state and a chip's mark are addressed identically
and there is no second map to keep in step. Epic 1's own handoff note says this
in as many words: the mark goes into *the same record*, `unavailableStates`
becomes a merge, and no other prop is added for per-option anything.

**The press ladder, which this epic depends on and does not touch:** native
`disabled` → nothing runs; else `unavailable` → `onPress?.()` only; else
`onSelect()` then `onPress?.()`. That ladder is why a *ruled-out* chip cannot be
picked while a *confirmed* one selects normally — the whole of this epic's R4,
and half of its R7 proof (Step E5).

**Epic 1 declares `mark` and leaves it unwired.** Its Step A7 puts both fields
on the type because the type is the seam this epic extends, and passes only
`unavailable` down — a pass-through with nothing behind it would read as a
working feature. So this epic adds no field: Step B7 supplies the one line that
feeds `mark` to the chip, and Step B2 renders it.

**What `ChipOptionState` still may not express** is the row's own `disabled`.
Epic 1's Step A9 reads the type block from disk and asserts both slots are
present plus that no field matches a `ROW_LOCK` regex, so it is green on arrival
and **this epic neither edits nor tightens it.** An exact field list there is
what pushed an earlier draft of this spec into a second parallel per-option prop;
A9's Refactor bullet now forbids re-tightening it.

### C2 — the derivation

```ts
// src/features/daily-groove/lib/presentation/confirmed.ts
import type { Attempt, Flavour, Root } from '../../types'

export type Confirmed = {
  roots: Root[]
  flavours: Flavour[]
}

export function confirmedHalves(attempts: Attempt[]): Confirmed
```

`roots` holds every root a checked guess got right, first-established first and
deduped; `flavours` holds every mode — or, in simple mode, every family — a
check got right, in the same order. The function is a fold over the whole list
and never a read of its last entry, which is R3; what says so in the repo is the
name of the test in Step A4, not a docstring above the function.

Total and unfailing: `confirmedHalves([])` is `{ roots: [], flavours: [] }`, and
nothing in it can throw on any `Attempt[]`. It stores nothing and reads no clock,
so R5 is free — the marks survive a reload exactly as the attempts do.

### C3 — the mark, as a field on Epic 1's per-option state

```ts
// src/components/controls/ChipGroup.tsx
export type ChipOptionState = {
  unavailable?: boolean
  mark?: string
}
```

The field is already there: Epic 1's Step A7 declared it on the exported type
and wired nothing to it. What this epic adds is the pass-through — `ChipGroup`
passes `trailingAdornment={optionStates?.[option]?.mark}` to each `Chip`, exactly
as Epic 1 passes `unavailable={optionStates?.[option]?.unavailable}` beside it —
and `Chip`'s matching prop (C4), which is this epic's only new prop anywhere in
the design system.

An option with no entry, or an entry with no `mark`, carries none; an entry
naming an option the row does not offer is ignored — Step B8's second case is
what states that, and it is a case rather than a sentence in the file. What a
mark means stays the caller's business, as `adornment`'s already does. The two
fields are independent: a chip can be marked, unavailable, both or neither as
far as the primitive is concerned, and that no chip is ever both is the
*feature's* guarantee (R7), not the type's.

### C4 — the second slot on `Chip`

```ts
// src/components/controls/Chip.tsx
type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  unavailable?: boolean          // Epic 1's
  onSelect: () => void
  onPress?: () => void           // Epic 1's
  tone?: ChipTone
  adornment?: string
  trailingAdornment?: string     // this epic's only addition here
}
```

`adornment` is unchanged: a decorative glyph in the flow, before the label.
`trailingAdornment` is a decorative glyph after the label, drawn in the chip's
own trailing padding rather than in its content flow, so it costs no layout
width and can change no geometry. Both are hidden from assistive tech. The
prop's *name* is the whole of the documentation it gets in the file; the
geometry reasoning is the Architecture section above, and the guarantee is
Steps B3, B4 and D8.

Rendered as, and nothing else:

```tsx
{trailingAdornment && (
  <span data-mark="" aria-hidden="true" className={TRAILING_ADORNMENT}>
    {trailingAdornment}
  </span>
)}
```

```ts
const BASE = 'relative inline-flex cursor-pointer items-center …'
const TRAILING_ADORNMENT =
  'pointer-events-none absolute right-[4px] top-1/2 -translate-y-1/2 text-[10px] leading-none'
```

`relative` is prepended to the existing `BASE` string; every other class in it
stays exactly as it is.

`data-mark` is the test seam and the harness's selector; it names no domain.

### C5 — `GuessCard`'s two new props

```ts
type GuessCardProps = {
  // …
  confirmedRoots: Root[]
  confirmedFlavours: Flavour[]
}
```

Roots, and modes — families, in simple mode — a checked guess has confirmed.
Purely presentational: the card marks those chips and nothing else follows from
it, so a confirmed chip is selected, locked and sounded exactly as any other
(R4, and Step D5 is the case that holds it).

Required, not optional: every caller is in this repo, and an omitted array is a
silently unmarked row. `GuessCard.test.tsx`'s `props()` helper gains
`confirmedRoots: []` and `confirmedFlavours: []`.

Inside the card, one module constant, and Epic 1's `unavailableStates` widened
into the merge its handoff note promised — renamed, because a builder that also
carries marks is no longer named for what it does:

```ts
const CHECK_GLYPH = '✓'

const optionStatesFor = (
  ruledOut: readonly string[],
  confirmed: readonly string[],
): Record<string, ChipOptionState> => {
  const states: Record<string, ChipOptionState> = {}
  for (const option of ruledOut) states[option] = { unavailable: true }
  for (const option of confirmed) {
    states[option] = { ...states[option], mark: CHECK_GLYPH }
  }
  return states
}
```

The spread is what makes the merge lossless rather than last-write-wins: a mark
never clears an `unavailable`, and an `unavailable` never clears a mark. R7 says
the two lists cannot intersect, so the branch should be unreachable — writing it
so that an intersection would be *visible* (a chip wearing both) rather than
silently resolved is the safer failure, and Step D5's and A7's assertions are
what keep it unreached.

### C6 — the two captions

```ts
// src/features/daily-groove/components/GroovePuzzle.tsx — module constants, unchanged shape
const CAPTION_SOUNDS_ON =
  'Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.'

const CAPTION_SOUNDS_OFF =
  'Find the note that feels like home — Play along with your instrument.'
```

Two constants with a ternary between them, exactly as feature-16 left them: one
element, one ternary, so the swap cannot move the caption. **Both constants lose
the long prose comments they carry today** — the ones recording which epic owned
which wording. Nothing replaces them: the two wordings stay mirrored in
`testing/puzzleHarness.tsx`, which is where every assertion about them reads
them from, and that mirroring is what a reader follows instead. The relationship R10
states — "the sounds-on sentence without its tap clause" — is asserted in the
test rather than expressed in the source:

```ts
expect(CAPTION_SOUNDS_ON.replace(', or tap a root or a mode to hear it', '')).toBe(
  CAPTION_SOUNDS_OFF,
)
```

The constant keeps its name. It still names the state it renders in, and
renaming it would touch `GroovePuzzle.tsx`, the harness and three test files for
no behaviour.

### C7 — the feedback line

```ts
// src/features/daily-groove/lib/presentation/feedback.ts
const ROOT_MATCHED: Feedback = {
  message: 'Right home note, wrong colour.',
  tone: 'warm',
}
```

The diagnosis to the full stop, and nothing after it. `tone`, the other four
messages and every selector in the file are untouched.

## Tracks

### Track A — What a check established

- **Goal** — `confirmedHalves` exists, folds the whole list, dedupes, keeps
  first-established order, is total over any `Attempt[]`, and returns only halves
  that are the day's own answer in both flavour matchers.
- **Owns** —
  `src/features/daily-groove/lib/presentation/confirmed.ts`,
  `src/features/daily-groove/lib/presentation/confirmed.test.ts`
  (both new; no other track writes here)
- **Role** — `implementer`
- **Depends on** — nothing. `Attempt` already carries `rootMatched` and
  `flavourMatched`, and `scoreAttempt` is already exported for the invariant
  case.
- **Parallel with** — Track B, Track C
- **Done when** — its seven cases pass and `npm test` is green, with no other
  file in the repo importing the module yet.

### Track B — The primitive learns a second slot

- **Goal** — `Chip` draws a trailing mark out of its content flow, hidden from
  assistive tech, in every tone and state, changing no class on its own box;
  and the mark reaches the chip through `optionStates[label].mark`, so
  `ChipGroup` gives one to the options named and to no others.
- **Owns** —
  `src/components/controls/Chip.tsx`,
  `src/components/controls/Chip.test.tsx`,
  `src/components/controls/ChipGroup.tsx`,
  `src/components/controls/ChipGroup.test.tsx`
- **Role** — `implementer`
- **Depends on** — Epic 1's `ChipOptionState`, `optionStates` and the press
  ladder, **landed** (Step B0 checks all four). It renders real `Chip`s from
  `ChipGroup`, so
  the two files are one track: a `vi.mock` of `./Chip` would be a mock of an
  internal path, which `docs/testing.md` rules out.
- **Parallel with** — Track A, Track C
- **Done when** — `Chip.test.tsx` and `ChipGroup.test.tsx` pass, including every
  pre-existing case unchanged, and `src/components/structure.test.ts` is green
  (no new component, so no edit to it).

### Track C — The feedback line stops instructing

- **Goal** — a right-root-wrong-mode guess is diagnosed and not instructed, and
  nothing else in the module moves.
- **Owns** —
  `src/features/daily-groove/lib/presentation/feedback.ts`,
  `src/features/daily-groove/lib/presentation/feedback.test.ts`
- **Role** — `implementer`
- **Depends on** — Epic 1's `feedback.ts` work, **landed**. Its own edit is one
  string.
- **Parallel with** — Track A, Track B
- **Done when** — `feedback.test.ts` passes, including the untouched cases for
  the other four messages, and the composed suites still find
  `/right home note/i` where they did.

### Track D — The card marks a chip

- **Goal** — `GuessCard` takes the two arrays and merges them into the same
  `optionStates` record Epic 1 builds from the ruled-out lists, keeps the `♪`
  where it is, keeps a marked chip selectable and its accessible name bare, and
  holds the 360px budget for the longest label each row can offer.
- **Owns** —
  `src/features/daily-groove/components/puzzle/GuessCard.tsx`,
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`
- **Role** — `implementer`
- **Depends on** — Track B's `ChipOptionState.mark`, **real**: its assertions are
  rendered chips, and the only way to render one without the primitive is to mock
  a design-system path. Also Epic 1's `GuessCard.tsx`, landed — its
  `unavailableStates`, its `ruledOutRoots`/`ruledOutFlavours` props and its split
  `onSelect`/`onPress` handlers are what this track widens (see the shared-file
  table).
- **Parallel with** — nothing in this epic.
- **Done when** — its eight cases pass, every pre-existing `GuessCard` case
  passes with the two array props added to `props()`, and
  `src/features/daily-groove/structure.test.ts` is green.

### Track E — The page derives it, and the two lines of copy

- **Goal** — the page derives the confirmed halves from the day's attempts and
  hands them to the card; every composed criterion is proven through `index.ts`;
  the sounds-off caption sets the task again.
- **Owns** —
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Depends on** — Track A's `confirmedHalves` **real** (a mocked
  `lib/presentation/` path is a mocked internal), Track D's props, and Track C
  for the composed feedback assertion in Step E9.
- **Parallel with** — nothing in this epic.
- **Done when** — every step below passes, `npm test` is green, and
  `npm run lint` and `npx tsc --noEmit` are clean.

### Track F — Verification

- **Goal** — the epic's acceptance criteria are graded against the suite and the
  demo, and the one criterion this epic moves in feature-16 is confirmed moved
  rather than broken.
- **Owns** — nothing. It writes no source and no test.
- **Role** — `verifier`
- **Depends on** — Tracks A–E.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npm run lint`, `npx tsc --noEmit` and
  `npm run build` are clean, every AC traces to a passing case, and the demo path
  in *Integration and verification* has been walked.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C — three disjoint file sets,
  and all three start the moment Epic 1 has landed.
- **Wave 2:** Track D — needs `ChipOptionState.mark` for real, and
  `GuessCard.tsx` after Epic 1.
- **Wave 3:** Track E — needs `confirmedHalves` for real and the card's props.
- **Wave 4:** Track F — integration, the demo, and verification.

**Three scheduling facts for the lead.**

1. **This whole epic is the feature's wave 2.** Nothing here may start while
   Epic 1 is still open: three of its files are Epic 1's in wave 1, and the
   per-option channel Track B extends is Epic 1's to ship. The roadmap put the
   two epics in different waves for exactly this reason — feature-16 discovered
   the same collision mid-run and had to serialise by hand.
2. **Epic 3 shares nothing with this epic.** `components/solved/LeadSheet.tsx`
   and `lib/theory/character.ts` appear nowhere above. It may run alongside any
   wave here.
3. **Track C is one string and could be folded into Track E** if the lead would
   rather run four tracks than five. It is separate because it is a different
   file with a different test tier, and because Epic 1 also edits `feedback.ts`
   — keeping it its own track makes the "one constant only" boundary visible in
   the diff.

## Implementation

### Track A — What a check established

Fixtures for the whole file, written once at the top of
`lib/presentation/confirmed.test.ts`, mirroring `feedback.test.ts`'s shape so
the two read alike:

```ts
/** The day's answer throughout: C Aeolian, as the harness fixture plays it. */
const attempt = (
  root: Attempt['root'],
  flavour: string,
  rootMatched: boolean,
  flavourMatched: boolean,
): Attempt => ({ root, flavour, correct: rootMatched && flavourMatched, rootMatched, flavourMatched })

const ROOT_ONLY = attempt('C', 'Dorian', true, false)      // right root, wrong mode
const FLAVOUR_ONLY = attempt('G', 'Aeolian', false, true)  // right mode, wrong root
const NEITHER = attempt('G', 'Dorian', false, false)
const OTHER_NEITHER = attempt('A', 'Lydian', false, false)
const EXACT = attempt('C', 'Aeolian', true, true)
```

#### Step A1 — A right root with a wrong mode confirms the root

Covers: R1, AC1

- **Test first** — `src/features/daily-groove/lib/presentation/confirmed.test.ts`:
  `expect(confirmedHalves([ROOT_ONLY])).toEqual({ roots: ['C'], flavours: [] })`.
  Run it: fails with
  `Error: Failed to resolve import "./confirmed" from "src/features/daily-groove/lib/presentation/confirmed.test.ts"`.
- **Implement** — `lib/presentation/confirmed.ts`: the `Confirmed` type and
  `confirmedHalves` as one pass, `for (const attempt of attempts)`, pushing
  `attempt.root` when `attempt.rootMatched` and `attempt.flavour` when
  `attempt.flavourMatched`, each into a `Set`-guarded array so order is
  first-established and entries are unique. No comment above it: the module's
  name, the function's name and Step A4's test name are what say it is a fold
  rather than a read of the last attempt.
- **Green when** — the assertion passes and `npm test` is green.
- **Refactor** — none.

#### Step A2 — A right mode with a wrong root confirms the mode

Covers: R1, AC2

- **Test first** — same file:
  `expect(confirmedHalves([FLAVOUR_ONLY])).toEqual({ roots: [], flavours: ['Aeolian'] })`.
  Run it: fails with
  `AssertionError: expected { roots: [], flavours: [] } to deeply equal { roots: [], flavours: [ 'Aeolian' ] }`
  if A1 landed the root half only.
- **Implement** — the `flavourMatched` half of the same loop.
- **Green when** — both halves pass, independently of each other: a list of only
  root-confirming attempts returns an empty `flavours`, and the reverse.
- **Refactor** — none.

#### Step A3 — Nothing is confirmed before anything is checked

Covers: R2, R5, AC3

- **Test first** — `expect(confirmedHalves([])).toEqual({ roots: [], flavours: [] })`,
  and a list of three attempts with both flags false returns the same. Run it:
  passes if A1/A2 are correct — this is the **totality guard**, written to pin
  that an empty day claims nothing, and that a mark can only come from a scored
  attempt.
- **Implement** — nothing; the loop already does it. If it does not, the
  implementation has a default somewhere it should not.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step A4 — The confirming attempt is not the last one

Covers: R3, AC4

**The step the epic turns on.** Written before A5 so the naive implementation
cannot survive one commit.

- **Test first** — same file:
  ```ts
  it('reads the whole list, not the last attempt (R3, AC4)', () => {
    expect(confirmedHalves([ROOT_ONLY, NEITHER, OTHER_NEITHER]).roots).toEqual(['C'])
    expect(confirmedHalves([FLAVOUR_ONLY, NEITHER]).flavours).toEqual(['Aeolian'])
    // The contrast with `selectFeedback`, which legitimately reads only the last:
    // a mark accumulates, a feedback line replaces.
    expect(confirmedHalves([NEITHER, ROOT_ONLY]).roots).toEqual(
      confirmedHalves([ROOT_ONLY, NEITHER]).roots,
    )
  })
  ```
  Run it against a `attempts[attempts.length - 1]` implementation: fails with
  `AssertionError: expected [] to deeply equal [ 'C' ]`.
- **Implement** — already a fold if A1 was built as specified. If the assertion
  fails, the fix is the loop, not a latch and not a stored field.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A5 — Marks accumulate, and each is recorded once

Covers: R3, AC4

- **Test first** — a twelve-attempt list built from the fixtures, asserting
  `roots` is exactly the distinct roots of the root-matching attempts in
  first-established order, and `flavours` likewise; and
  `expect(confirmedHalves([ROOT_ONLY, ROOT_ONLY, ROOT_ONLY]).roots).toEqual(['C'])`.
  Run it: fails with
  `AssertionError: expected [ 'C', 'C', 'C' ] to deeply equal [ 'C' ]` before the
  dedupe exists.
- **Implement** — the `Set` guard from A1, if it was not already there.
- **Green when** — both assertions pass.
- **Refactor** — if the two halves have become two near-identical blocks, lift
  one local `collect(flag, value)` helper. Nothing is exported but
  `confirmedHalves` and `Confirmed`.

#### Step A6 — A solve confirms both halves

Covers: R8, AC9

- **Test first** — `expect(confirmedHalves([NEITHER, EXACT])).toEqual({ roots: ['C'], flavours: ['Aeolian'] })`,
  and the same list with `EXACT` first. Run it: passes with a per-half rule,
  fails with anything that special-cases `correct`.
- **Implement** — nothing. The rule is per half, not per outcome: a solving
  attempt got both halves right, so it confirms both. This case exists to pin
  that no `if (!attempt.correct)` guard is ever added — a solved day's marks are
  the working, and the PRD's assumptions say the winning pair keeps them.
- **Green when** — both orderings pass.
- **Refactor** — none.

#### Step A7 — A confirmed half is always the day's own half

Covers: R7, AC8

- **Test first** — same file, importing `scoreAttempt`, `exactMatch` and
  `familyMatch` from `../puzzle/scoring` and `familyOf` from `../theory/families`:
  ```ts
  it('can only ever confirm the day’s own half (R7, AC8)', () => {
    const answer = { root: 'C', flavour: 'Aeolian' } as Answer
    const guesses = ROOTS.flatMap((root) =>
      ['Dorian', 'Aeolian', 'Lydian', 'Mixolydian'].map((flavour) => ({ root, flavour })),
    ) as Answer[]

    const full = confirmedHalves(guesses.map((g) => scoreAttempt(answer, g, exactMatch)))
    expect(full.roots).toEqual([answer.root])
    expect(full.flavours).toEqual([answer.flavour])

    const simple = confirmedHalves(
      ROOTS.flatMap((root) =>
        FAMILIES.map((family) =>
          scoreAttempt(answer, { root, flavour: family }, familyMatch),
        ),
      ),
    )
    expect(simple.roots).toEqual([answer.root])
    expect(simple.flavours).toEqual([familyOf(answer.flavour)])
  })
  ```
  Run it: fails with
  `AssertionError: expected [ 'C', 'C♯', 'D', … ] to deeply equal [ 'C' ]` against
  any implementation that marks a guessed half rather than a matched one.
- **Implement** — nothing. This is the assertion that carries R7 in the unit
  tier: every half this function can return is the answer's, and Epic 1's R7
  keeps the answer out of the ruled-out set, so the two sets cannot intersect.
  The test's own name carries that; the composed half of the proof is Step E5,
  and the reasoning is the Architecture section above.
- **Green when** — both matchers pass.
- **Refactor** — none.

### Track B — The primitive learns a second slot

#### Step B0 — Check what Epic 1 shipped against C1

Not a code step, and it takes minutes. The shape is frozen, so this is a check,
not a reconciliation.

Open `src/components/controls/ChipGroup.tsx` and `Chip.tsx` and confirm all four:

1. `export type ChipOptionState` is exported from `ChipGroup.tsx` and declares
   **both** `unavailable?: boolean` and `mark?: string`. Epic 1's Step A7
   declares `mark` and deliberately leaves it unwired: nothing passes it down
   yet, which is the gap Step B7 fills.
2. `optionStates?: Record<string, ChipOptionState>` is on `ChipGroupProps`,
   keyed by option label, and `unavailable={optionStates?.[option]?.unavailable}`
   already reaches each `Chip`.
3. `Chip` has `unavailable?: boolean` and `onPress?: () => void`, and its click
   runs the C1 ladder.
4. `ChipGroup.test.tsx` holds Epic 1's Step A9 case reading the type block from
   disk. It asserts `toContain('unavailable')`, `toContain('mark')` and that no
   field matches its `ROW_LOCK` regex — and it is **green on arrival**. This
   epic asserts nothing about that block and does not edit that case.

If any of the four is missing, **stop and report.** Do not declare the field
yourself, do not re-shape the type, do not add `optionStates` and do not invent a
second per-option prop. This epic's whole addition to the design system's
surface is `Chip`'s `trailingAdornment` and the one line that feeds it.

#### Step B1 — A chip with no trailing mark is exactly what it was

Covers: R9b, AC10b

The track's regression guard. It passes today, and it is what proves the new prop
acquired no default.

- **Test first** — `src/components/controls/Chip.test.tsx`, extending the
  existing `it.each(['default', 'inverted'])` case: assert
  `chip.querySelector('[data-mark]')` is `null`, `chip.children` has length 0 with
  neither adornment, `chip.textContent` is `'C'` and the accessible name is
  `'C'`. Run it: passes.
- **Implement** — nothing yet.
- **Green when** — it passes before and after every step below.
- **Refactor** — none.

#### Step B2 — The mark renders after the label

Covers: R1, R9a, AC10a

- **Test first** — `Chip.test.tsx`, a new `CHECK = '✓'` constant beside `NOTE`
  (an arbitrary glyph, as `NOTE` is): render with `adornment={NOTE}` and
  `trailingAdornment={CHECK}` and assert that the button's `textContent` is
  `NOTE + 'C' + CHECK`, i.e. `'♪C✓'`.
  Then a second render with `trailingAdornment` alone and assert
  `textContent` is `'C✓'`. Run it: fails with
  `AssertionError: expected '♪C' to be '♪C✓' // Object.is equality`.
- **Implement** — `Chip.tsx`: `trailingAdornment` on `ChipProps` as C4 declares
  it — the bare prop, no docstring — and the `data-mark` span rendered after
  `{label}`.
- **Green when** — both assertions pass, and B1 still passes.
- **Refactor** — none.

#### Step B3 — It is out of the content flow, and changes no class on the box

Covers: R9b, AC10b

- **Test first** — `Chip.test.tsx`:
  ```ts
  const plain = render(<Chip label="C" selected={false} disabled={false} onSelect={() => {}} />)
    .container.firstElementChild as HTMLElement
  const marked = render(
    <Chip label="C" selected={false} disabled={false} onSelect={() => {}} trailingAdornment={CHECK} />,
  ).container.firstElementChild as HTMLElement

  expect(marked.className).toBe(plain.className)
  expect(plain.className).toContain('relative')
  const mark = marked.querySelector('[data-mark]') as HTMLElement
  expect(mark.className).toContain('absolute')
  ```
  Run it against a `Chip` that adds `relative` only when the mark is present:
  fails with
  `AssertionError: expected 'relative inline-flex …' to be 'inline-flex …'`.
  Against B2's markup with no `relative` at all: fails with
  `AssertionError: expected 'inline-flex …' to contain 'relative'`.
- **Implement** — `relative` at the head of `BASE`, unconditionally, and
  `TRAILING_ADORNMENT` as C4 spells it. Nothing explains it in the file: the
  reason `relative` is unconditional — a chip that changed class on becoming
  confirmed is a chip whose neighbours could move — is the Architecture section
  above, and this step's own `expect(marked.className).toBe(plain.className)` is
  what holds it.
- **Green when** — the three assertions pass; every pre-existing class assertion
  in the file (`border-border-strong`, `bg-accent`, the width case) still passes.
- **Refactor** — none.

#### Step B4 — Nothing on the mark can reach the line box

Covers: R9b, R9c, AC10b, AC10c

The allowlist case, mirroring the one the `♪` already has — with a different
allowlist, because an out-of-flow mark may carry a size and an in-flow one may
not.

- **Test first** — `Chip.test.tsx`:
  ```ts
  const mark = screen.getByRole('button').querySelector('[data-mark]') as HTMLElement
  const classes = mark.className.split(/\s+/).filter(Boolean)
  expect(classes).toContain('absolute')
  const offenders = classes.filter(
    (name) => !/^(absolute|pointer-events-none|-?(right|left|top|bottom|inset|translate-y|translate-x)-|text-\[|leading-)/.test(name),
  )
  expect(
    offenders,
    'the trailing mark must stay out of the flow: positioning, a transform and an arbitrary size only',
  ).toEqual([])
  // and it names no ink of its own, so it inherits the chip's (R9b assumption)
  expect(mark.className).not.toMatch(/\btext-(?!\[)/)
  expect(mark.className).not.toMatch(/\b(bg|border|fill|stroke)-/)
  expect(mark.className).not.toMatch(/\bopacity-/)
  expect(mark).not.toHaveAttribute('style')
  ```
  Run it against a mark carrying `ml-[5px]`: fails with
  `AssertionError: the trailing mark must stay out of the flow: positioning, a transform and an arbitrary size only: expected [ 'ml-[5px]' ] to deeply equal []`.
- **Implement** — nothing beyond B3's `TRAILING_ADORNMENT`, which satisfies it.
- **Green when** — every assertion passes.
- **Refactor** — none.

#### Step B5 — The mark is decoration, and the name stays the label

Covers: R9, AC10

- **Test first** — `Chip.test.tsx`: with both adornments, assert
  `expect(mark).toHaveAttribute('aria-hidden', 'true')`,
  `expect(chip).toHaveAccessibleName('C')` and
  `expect(screen.getByRole('button', { name: 'C' })).toBe(chip)`. Run it against
  a span with no `aria-hidden`: fails with
  `AssertionError: expected element to have attribute "aria-hidden=true"`, and the
  name assertion fails with
  `Unable to find an accessible element with the role "button" and name "C"`.
- **Implement** — `aria-hidden="true"` on the span (already in C4's markup).
- **Green when** — all three pass.
- **Refactor** — none.

#### Step B6 — It survives every state a chip can be in

Covers: R4, R8, AC5, AC9

- **Test first** — `Chip.test.tsx`, extending the existing
  `it.each([{ state: 'idle' }, { selected }, { disabled }, { inverted }])` table:
  render each with `trailingAdornment={CHECK}` and assert `textContent` ends with
  `CHECK`, that the mark is still `aria-hidden`, and that it names no colour
  (the B4 ink assertions, once per state). Run it: fails with
  `AssertionError: expected 'C' to be 'C✓'` for whichever state a conditional
  render dropped.
- **Implement** — nothing: the span is outside every state branch, which is what
  this case pins. A locked chip's `disabled:opacity-60` fades the mark with the
  chip because the mark takes `currentColor`; a selected chip's accent ink
  carries it for the same reason.
- **Green when** — all four rows pass.
- **Refactor** — none.

#### Step B7 — The per-option state carries a mark, for the options named and no others

Covers: R1, R9b, AC1, AC2, AC10b

- **Test first** — `src/components/controls/ChipGroup.test.tsx`, a `CHECK = '✓'`
  constant beside `NOTE`, and two edits:
  ```ts
  it('marks the options its state names, and no others (F17 E2 R1)', () => {
    renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      optionStates: { Beta: { mark: CHECK } },
    })
    const chips = [...chipList().querySelectorAll('button')]

    expect(chips.map((chip) => chip.querySelector('[data-mark]')?.textContent ?? null))
      .toEqual([null, CHECK, null, null])
    for (const option of FOUR) {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    }
    // The two fields are independent, and neither implies the other.
    expect(chips[1]).not.toHaveAttribute('aria-disabled')
  })
  ```
  and a second case for the pair on one option —
  `optionStates: { Beta: { unavailable: true, mark: CHECK } }` → that chip carries
  `aria-disabled="true"` **and** the mark, and is not `toBeDisabled()`. The red
  here is the missing **rendering**, not a missing field: `mark` is already
  declared, so both cases compile and fail with
  `AssertionError: expected [ null, null, null, null ] to deeply equal [ null, '✓', null, null ]`.

  **Nothing is asserted about the type block, and Epic 1's Step A9 is not
  edited.** Its guard already covers this field — `toContain('unavailable')`,
  `toContain('mark')`, and a `ROW_LOCK` regex refusing any field that means the
  row's own lock — and it passes as shipped, because Epic 1's Step A7 declares
  `mark` on `ChipOptionState` itself. Do not tighten it to an exact field list;
  A9's own Refactor bullet says why, and an exact list is what pushed an earlier
  draft of this spec into a second parallel per-option prop.
- **Implement** — `ChipGroup.tsx`, one line: pass
  `trailingAdornment={optionStates?.[option]?.mark}` to each `Chip`, beside the
  `unavailable={…}` Epic 1 already passes. **The field is not added here** —
  Epic 1's Step A7 declared it and deliberately left it unwired, so this step
  supplies the pass-through and Step B2's `Chip` renders it. Nothing else about
  either prop list changes: no second per-option prop, and no edit to the
  docstring, which A7 already trimmed.
- **Green when** — the two new cases pass, and every pre-existing `ChipGroup`
  case passes unedited — Epic 1's per-option state, press, ordering and A9
  type-block cases included.
- **Refactor** — none.

#### Step B8 — Marking one chip moves no other, and an unknown option is ignored

Covers: R9b, AC10b, and the mode-switch safety C2 leaves open

- **Test first** — `ChipGroup.test.tsx`, two cases:
  ```ts
  it('keeps a marked row’s own layout and its other chips identical (R9b, AC10b)', () => {
    const plain = renderGroup({ options: FOUR, columns: { base: 2, wide: 4 } })
    const before = [...plain.container.querySelectorAll('button')].map((c) => c.className)
    const listBefore = (plain.container.querySelector('[data-testid="chip-list"]') as HTMLElement).className
    cleanup()

    const marked = renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      optionStates: { Beta: { mark: CHECK } },
    })
    const after = [...marked.container.querySelectorAll('button')].map((c) => c.className)
    const listAfter = (marked.container.querySelector('[data-testid="chip-list"]') as HTMLElement).className

    expect(after).toEqual(before)
    expect(listAfter).toBe(listBefore)
  })

  it('ignores a mark for an option it does not offer (R9b)', () => {
    renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      optionStates: { Zeta: { mark: CHECK } },
    })
    const chips = [...chipList().querySelectorAll('button')]
    expect(chips.every((chip) => chip.querySelector('[data-mark]') === null)).toBe(true)
    expect(chips.map((chip) => chip.textContent)).toEqual(FOUR)
  })
  ```
  Run the first against a `Chip` that adds `relative` conditionally: fails with
  `AssertionError: expected [ 'relative inline-flex …', … ] to deeply equal [ 'inline-flex …', … ]`.
  The second passes with C3's lookup and would fail with anything that iterates
  `optionStates` instead of `options` — which is also why Epic 1's ruled-out
  lookup is safe against a stale label.
- **Implement** — nothing beyond B3 and B7. The second case is what makes a mode
  switch safe: a mark whose label the row no longer offers renders nothing rather
  than throwing or appearing somewhere it does not belong.
- **Green when** — both cases pass.
- **Refactor** — none.

### Track C — The feedback line stops instructing

#### Step C1 — The diagnosis stays, the instruction goes

Covers: R13, AC13

- **Test first** — `src/features/daily-groove/lib/presentation/feedback.test.ts`,
  replacing the body of `it('names the root as right when only the root matched')`
  and keeping its name and its subject:
  ```ts
  const feedback = selectFeedback([ROOT_ONLY], false)
  expect(feedback.tone).toBe('warm')
  expect(feedback.message).toMatch(/home note/i)
  expect(feedback.message).toMatch(/right/i)
  // The instruction the check mark now gives (F17 E2 R13, AC13).
  expect(feedback.message).not.toMatch(/keep the root/i)
  expect(feedback.message).not.toMatch(/another flavour/i)
  expect(feedback.message).toBe('Right home note, wrong colour.')
  ```
  Run it: fails with
  `AssertionError: expected 'Right home note, wrong colour. Keep the root and try another flavour.' not to match /keep the root/i`.
- **Implement** — `feedback.ts`: `ROOT_MATCHED.message` becomes
  `'Right home note, wrong colour.'` — the value only, with no comment added
  and no existing comment rewritten. That the instruction moved to the chip is
  recorded by Step E9, which asserts the shorter line and the mark in the same
  frame. Nothing else in the file changes.
- **Green when** — the case passes; `it('gives every case its own wording, not just its own tone')`
  and `it('carries no raw colour value in any message or tone')` still pass; the
  other four messages are byte-identical.
- **Refactor** — none.

#### Step C2 — The other three diagnoses are untouched

Covers: R13 (its boundary), Epic 1's R3

- **Test first** — same file: assert `selectFeedback([FLAVOUR_ONLY], false).message`
  is exactly `'The mode is right. But the tonic is somewhere else.'`, and that
  the `NEITHER` and `OPENING` messages are unchanged verbatim. Run it: passes.
- **Implement** — nothing. This is the guard that "the line loses an
  instruction, not its reading of the guess" survives the next edit, and that
  Epic 1's AC3 still holds after this epic touched the file.
- **Green when** — it passes.
- **Refactor** — none.

### Track D — The card marks a chip

Track-wide: `props()` in `GuessCard.test.tsx` gains `confirmedRoots: []` and
`confirmedFlavours: []` beside the `ruledOutRoots: []`, `ruledOutFlavours: []`
and `eliminated: 0` Epic 1 added, and the file gains `const CHECK_GLYPH = '✓'`
and a
`chipMark = (chip: Element) => chip.querySelector('[data-mark]')?.textContent ?? null`
helper beside its existing `chipLabel` and `chipAdornment` copies. `chipAdornment`
there is narrowed to `[aria-hidden="true"]:not([data-mark])` for the same reason
the harness's is (Step E1).

#### Step D1 — A confirmed root wears a check, after its label and after its `♪`

Covers: R1, R9a, AC1, AC10a

- **Test first** — `components/puzzle/GuessCard.test.tsx`:
  ```ts
  render(<GuessCard {...props({ confirmedRoots: ['G'] })} />)
  const g = within(rootGroup()).getByRole('button', { name: 'G' })

  expect(chipMark(g)).toBe(CHECK_GLYPH)
  expect(chipAdornment(g)).toBe(NOTE_GLYPH)
  expect(g.textContent).toBe(`${NOTE_GLYPH}G${CHECK_GLYPH}`)
  expect(g).toHaveAccessibleName('G')
  // and nothing else on the card claims one
  const others = within(rootGroup()).getAllByRole('button').filter((c) => c !== g)
  expect(others.every((c) => chipMark(c) === null)).toBe(true)
  expect(within(flavourGroup()).getAllByRole('button').every((c) => chipMark(c) === null)).toBe(true)
  ```
  Run it: fails with `AssertionError: expected null to be '✓' // Object.is equality`.
- **Implement** — `GuessCard.tsx`: `confirmedRoots` on the props type as C5
  declares it, `CHECK_GLYPH` as a module-level constant, Epic 1's
  `unavailableStates` widened and renamed to C5's `optionStatesFor`, and the root
  row's `optionStates={unavailableStates(ruledOutRoots)}` becoming
  `optionStates={optionStatesFor(ruledOutRoots, confirmedRoots)}` — the same
  prop, the same position, outside the `over` lock exactly as Epic 1 left it and
  as the `♪`'s `adornment` is. **No second per-option prop.** No comment is added
  beside it: `CHECK_GLYPH`'s name is what says the glyph's meaning is chosen here
  rather than in the primitive, and Step D6 is what holds it outside the lock.
- **Green when** — every assertion passes and every pre-existing `GuessCard` case
  passes with the two new props in `props()`.
- **Refactor** — none.

#### Step D2 — A confirmed mode wears one too, in both modes' rows

Covers: R1, R6, AC2, AC7

- **Test first** — same file: `props({ confirmedFlavours: ['Dorian'] })` → the
  `Dorian` chip's `chipMark` is `'✓'`, no root chip has one; then
  `props({ simple: true, flavours: ['Major', 'Minor'], confirmedFlavours: ['Minor'] })`
  → the `Minor` chip has one and `Major` does not, and both accessible names are
  bare. Run it: fails with `AssertionError: expected null to be '✓'`.
- **Implement** — `confirmedFlavours` on the props type and the mode row's
  `optionStates={optionStatesFor(ruledOutFlavours, confirmedFlavours)}`. One
  expression per row, the same expression: simple mode's two-chip row is marked
  by the same code path as the four-mode row, which is what R6 asks for.
- **Green when** — both cases pass.
- **Refactor** — `unavailableStates` has no remaining callers once both rows
  pass `optionStatesFor`; delete it rather than leaving two builders. Do not
  collapse the two `ChipGroup` calls into one: the rows differ in six other
  props, and merging them would bury the seam Epic 1 works in.

#### Step D3 — Nothing is marked until something is confirmed

Covers: R2, AC3

- **Test first** — same file: render the default `props()` and assert no
  `[data-mark]` exists anywhere in the card
  (`expect(document.querySelectorAll('[data-mark]')).toHaveLength(0)`), then the
  same with `selectedRoot: 'G'` and `selectedFlavour: 'Dorian'` — a selection is
  not a guess. Run it: passes, and is the guard that no default glyph crept in.
- **Implement** — nothing.
- **Green when** — both renders are unmarked.
- **Refactor** — none.

#### Step D4 — The check does not replace the `♪`, and does not need it

Covers: R9a, AC10a

- **Test first** — same file, two renders:
  `props({ confirmedRoots: ['G'], tapSounds: true })` → the `G` chip has both
  marks, `textContent` is `'♪G✓'`; `props({ confirmedRoots: ['G'], tapSounds: false })`
  → `chipMark` is `'✓'`, `chipAdornment` is `null`, `textContent` is `'G✓'`, and
  no chip in either row carries a `♪`. Run it against an implementation that
  routes the check through the `adornment` prop: fails with
  `AssertionError: expected '♪G' to be '♪G✓'`.
- **Implement** — nothing beyond D1/D2: the two props are independent, which is
  the whole of R9a. The briefing's reason for insisting on it — a chip whose `♪`
  had been replaced would be the one chip on an audible row that does not look
  audible — is why this case exists, and it lives in the case's name and in this
  spec, not in the file.
- **Green when** — both renders pass.
- **Refactor** — none.

#### Step D5 — A marked chip is still selectable

Covers: R4, R7, AC5, AC8

- **Test first** — same file, and it is written against Epic 1's press ladder:
  with `confirmedRoots: ['G']`, click the `G` chip and assert `onSelectRoot` was
  called once with `'G'` **and** `onHearRoot` once with `'G'` — the full
  live-chip ladder, `onSelect` then `onPress` — and that the chip carries no
  `aria-disabled`. Then assert it renders `aria-pressed="true"` when it is also
  `selectedRoot`. Add the contrast in one case, so the two states are asserted
  apart rather than separately: with `ruledOutRoots: ['B♭']` alongside, clicking
  `B♭` calls `onHearRoot` and **not** `onSelectRoot`. Run it: passes with D1's
  markup, and fails loudly against any edit that lets a mark reach `unavailable`.
- **Implement** — nothing. `mark` reaches `trailingAdornment` and nothing else,
  and `optionStatesFor` writes `unavailable` only from the ruled-out list; the
  card derives no state from being confirmed.
- **Green when** — the spies fire in that order for the marked chip, only
  `onHearRoot` fires for the ruled-out one, and the marked chip reports pressed.
- **Refactor** — none.

#### Step D6 — The marks survive the card's two locks

Covers: R8, AC9

- **Test first** — same file, `it.each([{ solved: true }, { revealed: true }])`:
  render with `confirmedRoots: ['G']` and the terminal flag, and assert the `G`
  chip still has `chipMark === '✓'`, is `toBeDisabled()`, and keeps its bare
  accessible name. Run it against a card that gates `optionStates` on `!over`:
  fails with `AssertionError: expected null to be '✓'`.
- **Implement** — nothing: `optionStates` is passed outside the `over` branch,
  as the `♪` is and as Epic 1's Step E5 already requires for the dim treatment.
- **Green when** — both rows pass.
- **Refactor** — none.

#### Step D7 — Both marks and the longest label each row can offer, on one line

Covers: R9c, AC10c

The root row is the tight case, and the sum is the PRD's: ~63px a chip at 360px,
~33px of content inside `px-[15px]`, and an inline flow of the `♪` (~8px), its
5px margin and a two-character label (~17px) — ~30px. The check mark is not in
that sum, because it is not in the flow. That arithmetic stays here; what the
test carries is the assertion, and the two `expect`s on the label and the
`absolute` class are what say the flow holds only two things.

- **Test first** — same file, two cases:
  ```ts
  it('holds the root row’s 360px budget with both marks (R9c, AC10c)', () => {
    expect(Math.max(...ROOTS.map((root) => root.length))).toBe(2)
    render(<GuessCard {...props({ confirmedRoots: ['C♯'], tapSounds: true })} />)
    const chip = within(rootGroup()).getByRole('button', { name: 'C♯' })

    expect(chipLabel(chip)).toBe('C♯')
    expect((chip.querySelector('[data-mark]') as HTMLElement).className).toContain('absolute')
    expect(chip).toHaveAccessibleName('C♯')
    for (const cut of [/\btruncate\b/, /\btext-ellipsis\b/, /\boverflow-hidden\b/]) {
      expect(chip.className).not.toMatch(cut)
    }
  })
  ```
  and the same for the mode row against the longest flavour the catalogue holds,
  derived rather than written out:
  `const LONGEST_FLAVOUR = [...new Set(GROOVES.map((g) => g.flavour))].sort((a, b) => b.length - a.length)[0]`
  — `'Phrygian dominant'` today, asserted to be 17 characters so a longer future
  mode trips this case rather than a phone. Run the first: fails with
  `AssertionError: expected null to be an instance of HTMLElement` before the
  mark exists.
- **Implement** — nothing. The point of the case is that the check mark adds
  **zero** to either row's inline flow, so the mode row's budget is exactly what
  feature-16 shipped and the root row's grows by nothing.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step D8 — Marking a chip moves nothing else on the card

Covers: R9b, AC10b

- **Test first** — same file: render `props()` — no ruled-out options either, so
  the only variable is the mark — and collect every chip's `className` in both
  rows plus both `[data-testid="chip-list"]` class strings; `cleanup()`; render
  `props({ confirmedRoots: ['G'], confirmedFlavours: ['Dorian'] })`
  and collect the same. Assert the two collections are deeply equal. Run it
  against a conditional `relative`: fails with
  `AssertionError: expected [ 'relative inline-flex …', … ] to deeply equal [ 'inline-flex …', … ]`.
- **Implement** — nothing beyond B3.
- **Green when** — the collections match. jsdom measures no pixels; what is
  pinned is that nothing in the row's or the chips' layout differs, which is the
  strongest available form of "no chip moves and every chip keeps its height".
  The pixel claim itself is the demo's job (Step I2).
- **Refactor** — none.

### Track E — The page derives it, and the two lines of copy

#### Step E1 — The harness tells the two marks apart

Covers: R9a, and it unblocks every step below

- **Test first** — no new case; this is the change that keeps feature-16's
  existing ones honest. In `src/features/daily-groove/testing/puzzleHarness.tsx`:
  ```ts
  export const CHECK_GLYPH = '✓'

  export const chipAdornment = (chip: Element) =>
    chip.querySelector('[aria-hidden="true"]:not([data-mark])')?.textContent ?? null

  export const chipMark = (chip: Element) =>
    chip.querySelector('[data-mark]')?.textContent ?? null
  ```

  Three bare exports. `chipAdornment` currently carries a prose docstring
  explaining the accessible-name bargain; the selector change makes it
  inaccurate, so **the docstring goes with the change** and nothing replaces
  it — the `:not([data-mark])` is the explanation.
  Run `npm test` before the narrowing, with Step E2's first case in place: the
  sounds-off cases fail with
  `AssertionError: expected [ '✓', null, null, … ] to satisfy every(glyph => glyph === null)`,
  because a confirmed chip with the sounds off has exactly one hidden span and it
  is the check.
- **Implement** — the three declarations above. `chipLabel` needs no change: it
  filters *every* `aria-hidden` node, so both marks were already out of it.
- **Green when** — `npm test` is green with feature-16's `marked()` assertions
  unchanged.
- **Refactor** — none.

#### Step E2 — The page marks what a check confirmed

Covers: R1, R5, AC1, AC2

- **Test first** — `components/GroovePuzzle.guessing.test.tsx`: the fixture
  groove is `C Aeolian`, so
  ```ts
  await renderPuzzle()
  await guess(user, 'C', wrongFlavour())          // right root, wrong mode

  const c = within(rootGroup()).getByRole('button', { name: 'C' })
  expect(chipMark(c)).toBe(CHECK_GLYPH)
  expect(chipAdornment(c)).toBe(NOTE_GLYPH)
  expect(c).toHaveAccessibleName('C')
  expect(within(flavourGroup()).getAllByRole('button').every((chip) => chipMark(chip) === null)).toBe(true)
  ```
  and a second case for the other half: `guess(user, 'G', 'Aeolian')` → the
  `Aeolian` mode chip carries the mark and no root chip does. Run it: fails with
  `AssertionError: expected null to be '✓' // Object.is equality`.
- **Implement** — `components/GroovePuzzle.tsx`: import `confirmedHalves` from
  `../lib/presentation/confirmed`, and add one memo directly below the four
  derivations already there —
  `const confirmed = useMemo(() => confirmedHalves(attempts), [attempts])`, and
  no comment: it reads as the fifth pure function of the attempt list because it
  sits with the other four and is spelled like them. Pass
  `confirmedRoots={confirmed.roots}` and `confirmedFlavours={confirmed.flavours}`
  on the hoisted `guessCard` element, so both of its render positions get them
  by construction.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step E3 — Selecting is not checking, and tapping is not checking

Covers: R2, AC3

- **Test first** — same file: render, click the `C` root chip (which sounds it,
  through the real voice against the fake context), click a mode chip, and assert
  `document.querySelectorAll('[data-mark]')` is empty. Then re-tap the same root
  chip and assert it is still empty. Run it: passes if E2 read `attempts`, fails
  against any implementation that read the *selection*, with
  `AssertionError: expected 1 to be 0`.
- **Implement** — nothing. The memo's only input is `attempts`, which is what
  makes R2 structural rather than a rule someone has to remember.
- **Green when** — both assertions hold.
- **Refactor** — none.

#### Step E4 — The mark is still there three guesses later, and after a reload

Covers: R3, R5, AC4, AC6

Written with a **seeded record** rather than three clicks, deliberately: by the
third miss Epic 1 has eliminated roots the test cannot predict, and a click on a
ruled-out chip is a no-op. Seeding the day's history is also exactly what AC6
asks for, so one setup carries both criteria.

- **Test first** — same file:
  ```ts
  const stored: DailyResult = {
    date: TODAY(),
    answer: { root: 'C', flavour: 'Aeolian' },
    attempts: [
      miss('C', wrongFlavour(), true),        // the confirming guess…
      miss('G', wrongFlavour(), false),       // …then two more, both wrong
      miss('A', otherWrongFlavour(), false),
    ],
    solved: false,
    grooveId: GROOVE.id,
  }
  mockStore.get.mockResolvedValue(stored)
  mockStore.getAll.mockResolvedValue([stored])

  await renderPuzzle()

  const c = within(rootGroup()).getByRole('button', { name: 'C' })
  expect(chipMark(c)).toBe(CHECK_GLYPH)
  expect(within(rootGroup()).getAllByRole('button').filter((chip) => chipMark(chip)))
    .toHaveLength(1)
  ```
  A fresh render from the stored record *is* the reload: nothing about the mark
  is written, so what proves R5 is that it appears without ever having been
  saved. Run it against a last-attempt implementation: fails with
  `AssertionError: expected null to be '✓' // Object.is equality`.
- **Implement** — nothing beyond E2.
- **Green when** — the case passes, and `mockStore.save` is never called with a
  field naming a mark.
- **Refactor** — none.

#### Step E5 — A marked chip still selects, so it is not ruled out

Covers: R4, R7, AC5, AC8

- **Test first** — same file, continuing from E4's seeded three-miss day (where
  Epic 1 has dimmed several roots): click the marked `C` chip and assert it
  reports `aria-pressed="true"`; then pick any mode still selectable, press the
  control, and assert the guess was scored — the dots advanced — and that `C`
  still carries its mark. Run it against a card that locks a confirmed chip:
  fails with
  `AssertionError: expected element to have attribute "aria-pressed=true", received "false"`.
- **Implement** — nothing. This is the composed half of the R7/AC8 proof: a
  ruled-out chip cannot be selected, whatever Epic 1 used to make that true, so a
  chip that selects normally is a chip that is not ruled out — and Step A7 is why
  no marked chip can ever be in the ruled-out set in the first place.
- **Green when** — the chip selects, the guess scores, the mark stays.
- **Refactor** — none.

#### Step E6 — Simple mode's family row is marked the same way

Covers: R6, AC7

- **Test first** — same file, using the existing `enableSimpleMode()` helper:
  enable simple mode, render with the `C Aeolian` fixture, and guess a wrong root
  from `simpleRoots()` paired with `'Minor'` — the answer's family. Assert the
  `Minor` chip carries the mark, `Major` does not, both accessible names are
  bare, and no root chip is marked. Run it: fails with
  `AssertionError: expected null to be '✓'` if the derivation special-cased the
  full mode row.
- **Implement** — nothing. `attempt.flavour` holds `'Minor'` in simple mode
  because `scoreAttempt` records the guess as made, and `optionStates` is keyed
  by the label the row renders — so the family row is marked by the same code path as
  the mode row.
- **Green when** — the case passes.
- **Refactor** — none. Note for the reviewer, and it is why Step B8's second case
  exists: a mark earned in one mode whose label the other mode does not offer
  simply does not render. `Dorian` confirmed in the full row shows nothing on
  `Major`/`Minor`, and the reverse. Nothing is claimed falsely in either
  direction, and a confirmed *root* always appears in both rows because
  `simpleRootOptions` always includes the answer.

#### Step E7 — A finished day keeps the marks its play earned

Covers: R8, AC9

- **Test first** — same file: seed a record with `revealed: true` and
  `attempts: [miss('C', wrongFlavour(), true), …]`, render, and assert the `C`
  root chip carries the mark and is `toBeDisabled()`; then the same for a
  `solved: true` record whose attempts include a half-right miss, asserting the
  mark is still there under the lock. Run it against a page that stops deriving
  once the day ends: fails with `AssertionError: expected null to be '✓'`.
- **Implement** — nothing: the memo does not read `solved` or `revealed`, and the
  card passes `optionStates` outside its `over` branch.
- **Green when** — both records render their marks.
- **Refactor** — none.

#### Step E8 — The caption sets the task again with the sounds off

Covers: R10, R11, R12, AC11, AC12

**This is the step that moves feature-16's AC11a.** Feature-16's record stands
as what was built; the criterion changes here.

- **Test first** — two edits, in this order:
  1. `testing/puzzleHarness.tsx`: `CAPTION_SOUNDS_OFF` becomes
     `'Find the note that feels like home — Play along with your instrument.'`,
     and **its five-line prose docstring is deleted rather than rewritten**. The
     constant's name and its value are the whole of it. Why the wording changed
     — the card's one caption line goes back to setting the task instead of
     describing a switch the player just flipped themselves — is R10, this spec
     and Step I4's checklist; the criterion that moved is recorded in the
     renamed test case below, which is where a reader looking for it will be.
  2. `components/GroovePuzzle.sounding.test.tsx`: rewrite the body of
     `it('swaps the caption for one that says how to switch them back (E5, R12a, AC11a)')`,
     renaming it to
     `it('swaps the caption for the task sentence without the tap clause (F17 E2 R10, R12, AC11, AC12)')`
     and keeping every positional assertion it already makes — that the caption
     is the play control's `nextElementSibling`, shares its parent, and carries
     `text-text-muted` and `text-[13px]` — so a swap cannot quietly move it while
     chasing the words. Its wording assertions become:
     ```ts
     expect(CAPTION_SOUNDS_ON_MINUS_TAP()).toBe(CAPTION_SOUNDS_OFF)  // see below
     expect(CAPTION_SOUNDS_OFF).not.toMatch(/switch/i)
     expect(CAPTION_SOUNDS_OFF).not.toMatch(/tap/i)
     expect(CAPTION_SOUNDS_OFF).toMatch(/feels like home/i)
     expect(CAPTION_SOUNDS_OFF).not.toContain('\n')
     ```
     where the first is C6's relation, written inline as
     `CAPTION.replace(', or tap a root or a mode to hear it', '')` against the
     harness's `CAPTION` (the sounds-on wording). Then flip the switch back and
     assert `CAPTION` returns and `CAPTION_SOUNDS_OFF` is gone — R12, in both
     directions, with no reload.
  Run it: fails with
  `Unable to find an element with the text: Find the note that feels like home — Play along with your instrument.`
- **Implement** — `GroovePuzzle.tsx`, three deletions and one value:
  `CAPTION_SOUNDS_OFF`'s value changes; the prose comments above **both** module
  constants are deleted; and the JSX comment above the caption's `<Text>` — which
  says the line "says so, and says how to put them back" — is deleted, because
  this step makes it untrue. Nothing replaces any of the three. The two wordings
  stay mirrored in the harness, which is where every assertion reads them from.
  `CAPTION_SOUNDS_ON`'s value, the ternary and the `<Text>` element itself are
  untouched.
- **Green when** — the rewritten case passes and the two other cases that read
  `CAPTION_SOUNDS_OFF` pass **unedited**:
  `it('is still off after a reload (E8, R3, AC3)')` at
  `GroovePuzzle.sounding.test.tsx:1650` and
  `it('still silences the taps, and says nothing, when the write fails (R8, AC8)')`
  at `:1708`. Both reference the constant rather than a literal, so the new
  wording carries into them for free. That is what makes this a criterion moving
  rather than a string swap.
- **Refactor** — none. The two constants stay two, one per state of the switch.

#### Step E9 — The line diagnoses and stops instructing, on the page

Covers: R13, AC13

- **Test first** — `components/GroovePuzzle.guessing.test.tsx`: after
  `guess(user, 'C', wrongFlavour())`, assert
  `screen.getByText(/right home note/i)` is present, that
  `screen.queryByText(/keep the root/i)` is `null`, and — the point of the epic —
  that the `C` chip carries the mark in the same frame, so the instruction is
  gone *because* the mark is there. Run it before Track C lands: fails with
  `AssertionError: expected null not to be null` on the `queryByText`.
- **Implement** — nothing here; Track C owns the string.
- **Green when** — the case passes and the four other composed cases matching
  `/right home note/i` still pass.
- **Refactor** — none.

#### Step E10 — The slice's surface is unchanged

Covers: the removability standard

- **Test first** — `src/features/daily-groove/index.test.ts` and
  `src/app/route-boundary.test.ts` run unchanged. Nothing in this epic is
  exported from the feature.
- **Implement** — nothing. `confirmedHalves` is internal; the route composes
  `GroovePuzzle` and knows nothing about a mark.
- **Green when** — both structural suites pass with no edit.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The order the shared files are opened in

Not a code step. Three files here are Epic 1's in wave 1, and one is opened by
two tracks of this epic.

| # | Track | What it leaves behind |
| :-- | :-- | :-- |
| 1 | **Epic 1** (all of it) | per-option state on `ChipGroup`; the nudge narrowing in `feedback.ts`, `GuessCard.tsx` and `GroovePuzzle.tsx` |
| 2 | **This epic, Track B** | `trailingAdornment` on `Chip` and its rendering; `optionStates[label].mark` passed through (the field itself is Epic 1's) |
| 3 | **This epic, Track D** | the two props, and `unavailableStates` widened into `optionStatesFor` on both rows |
| 4 | **This epic, Track E** | the memo, the two props at the call site, the caption, the harness helpers |

Before Track D opens `GuessCard.tsx`, check it: if both `ChipGroup`s still take
a row-wide `disabled` and no per-option state, Epic 1 has not landed and Track D
waits. It does not add per-option state itself — that is Epic 1's line, and
adding it twice is a conflict, not a head start.

#### Step I2 — The demo path, run by hand

The PRD's and the roadmap's own walk-through:

1. Load cold on a 360px viewport. No chip carries a check. The caption sets the
   task.
2. Select `C` and a wrong mode. Nothing is marked — a selection is not a guess.
   Tap `C` again to hear it. Still nothing.
3. Press *Check*. The `C` chip gains a check to the right of its label, inside
   its own padding, and **nothing else on the row moves**: no chip shifts, no row
   grows, the twelve stay where they were. The feedback line says
   "Right home note, wrong colour." and does not tell you to keep the root.
4. Miss twice more with other roots. Roots dim around it; `C` keeps its check and
   still selects when you tap it. That is the two halves of what you know, on one
   row.
5. Reload. Same check, same dimming, nothing was stored for either.
6. Switch the tap sounds off. The `♪` goes from both rows, the check stays, and
   the caption reads "Find the note that feels like home — Play along with your
   instrument." Switch them back on: the full sentence returns and the confirmed
   chip wears both marks.
7. Switch to simple mode. Guess a wrong root with the right family: `Minor` takes
   a check on a two-chip row.
8. Give up. The row locks with its checks and its dimming intact — the record of
   how the day was played — and the solved box names the root.
9. **Both themes, and at 320px as well as 360px.** A confirmed chip beside a
   dimmed neighbour has to be tellable apart at a glance, and the check has to
   stay inside the chip's padding rather than crowding a two-character label.
10. Screen reader: every chip's name is its label alone, marked or not.

#### Step I3 — The suite

- `npm test` green — the app and tooling tiers, which is every test this epic
  writes or touches. Nothing here reaches `scripts/`, so `npm run test:gen` has
  nothing to say and `npm run test:all` is the lead's call.
- Specifically green: `src/components/structure.test.ts` (no new component),
  `src/features/daily-groove/structure.test.ts` (no new `lib/` folder —
  `presentation/` already exists, and `confirmed.ts` has its test beside it),
  `src/app/route-boundary.test.ts`, `src/features/daily-groove/index.test.ts`.
- `npm run lint` clean — the five import zones bind these new test files exactly
  as they bind source, and nothing under `src/components/` names the feature.
- `npx tsc --noEmit` clean — including the two now-required `GuessCard` props at
  every call site.
- `npm run build` green.

#### Step I4 — What to check about feature-16 before calling this done

Feature-16's AC11a asserted the old sounds-off wording. Confirm, by name, that
its assertions moved rather than broke:

- `GroovePuzzle.sounding.test.tsx`'s caption case is **rewritten**, not deleted,
  and still asserts position, tone and size as well as the new words.
- The other two cases that read `CAPTION_SOUNDS_OFF` — the reload case
  (`GroovePuzzle.sounding.test.tsx:1650`) and the write-failure case (`:1708`) —
  are **unedited** and green.
- `GroovePuzzle.page.test.tsx`'s caption assertion reads `CAPTION` (the sounds-on
  wording) and is untouched.
- Feature-16's PRD and tech spec are **not** edited. They are the record of what
  was built; this feature is where the criterion changed.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2, B2, B7, D1, D2, E2 |
| R2 | A3, D3, E3 |
| R3 | A4, A5, E4 |
| R4 | B6, D5, E5 |
| R5 | A3, E2, E4 |
| R6 | A7, D2, E6 |
| R7 | A7, D5, E5 |
| R8 | A6, B6, D6, E7 |
| R9 | B5, D1, E2 |
| R9a | B2, D1, D4, E1, E2 |
| R9b | B1, B3, B4, B7, B8, D8 |
| R9c | B4, D7 |
| R10 | E8 |
| R11 | E8 |
| R12 | E8 |
| R13 | C1, C2, E9 |
| AC1 | A1, B7, D1, E2, I2 |
| AC2 | A2, B7, D2, E2 |
| AC3 | A3, D3, E3, I2 |
| AC4 | A4, A5, E4, I2 |
| AC5 | B6, D5, E5, I2 |
| AC6 | E4, I2 |
| AC7 | A7, D2, E6, I2 |
| AC8 | A7, D5, E5 |
| AC9 | A6, D6, E7, I2 |
| AC10 | B5, D1, I2 |
| AC10a | B2, D1, D4, E2 |
| AC10b | B1, B3, B4, B8, D8, I2 |
| AC10c | B4, D7, I2 |
| AC11 | E8, I2 |
| AC12 | E8, I2 |
| AC13 | C1, E9, I2 |

Every R and AC in the PRD appears above. Nothing above covers a requirement the
PRD does not have.

## Assumptions

- **The codebase's comments were stripped after this spec was drafted, and
  before it runs.** `AGENTS.md` gained a Comments section — code should explain
  itself, a comment is for something genuinely non-obvious, and prose in a
  comment is not allowed — and 274 files were stripped to match, 12,522
  deletions in `git diff --stat`. Both tiers are green after it: 106 files /
  2038 tests, and 39 / 834. So every step below that deletes or rewrites a
  now-false comment is **already satisfied, and is a no-op rather than a
  mistake** — what it would have removed is gone. Do not re-add any of it, and
  do not rewrite a doc comment a step describes rewriting: where reasoning needs
  a home it is this document or a named test. The four prose comments this spec named as deletions are already gone,
  including `GroovePuzzle.tsx`'s two caption blocks — so the caption change is
  now only the two strings and their mirrors in `testing/puzzleHarness.tsx`,
  which is where the assertions read them from.

Lower-stakes technical calls made here, so a reviewer can challenge them.

- **One per-option record, and the mark is a field on it.**
  `ChipOptionState.mark` rather than a second `optionStates`-shaped prop, which
  is what Epic 1's landed C1 froze and what its handoff note asks for. It costs
  this epic nothing in that file beyond one pass-through line: Epic 1 declares
  the field and its Step A9 guard already accepts it, so no type is reshaped and
  no guard is edited here.
- **Epic 1's `unavailableStates` is renamed, not duplicated.** A builder that
  also carries marks is no longer named for what it does, so it becomes
  `optionStatesFor(ruledOut, confirmed)` and the old name is deleted once both
  rows call it. One builder, one record, one prop.
- **AC5 and half of AC8 rest on Epic 1's press ladder.** "A marked chip selects
  normally" is only proof that it is not ruled out because `unavailable` is the
  one thing that stops `onSelect` running. If Epic 1's ladder is ever collapsed
  into the native `disabled`, Step D5 and Step E5 stop meaning what they say —
  which is what Epic 1's own Step A4 source guard exists to prevent.
- **The glyph is `'✓'` (U+2713), chosen in `GuessCard`.** Not U+2714, which
  renders as an emoji on several platforms and would not take `currentColor`. The
  primitive never sees the choice.
- **`data-mark` on the trailing span.** A test seam, following
  `data-numeral`, `data-dot-state` and `data-testid="chip-list"`. It names no
  domain, and without it the harness cannot tell one hidden span from the other.
- **`relative` goes on `BASE` unconditionally.** A chip that changed class on
  becoming confirmed is a chip whose neighbours could move; AC10b is the
  requirement that they do not. The cost is one class on every chip in the app.
- **A solving attempt confirms both halves.** The rule is per half, not per
  outcome, which makes the derivation one fold and cannot contradict R1. Step A6
  pins it.
- **`CAPTION_SOUNDS_OFF` keeps its name.** It still names the state it renders
  in; renaming it would touch four files for no behaviour.
- **The composed cases go in `GroovePuzzle.guessing.test.tsx`** — the marks are
  the guessing surface, and every case here makes or judges a guess. That takes
  the file from 37 cases to about 45, past feature-14's 40-case guideline. The
  guideline has no test behind it and `sounding` already holds 60; splitting
  `guessing` is a refactor of its own, not this epic's work. Flagged rather than
  done.
- **Epic 2 adds nothing to the feature's `index.ts`.** The derivation is internal;
  the slice stays as removable as it was.
- **AC10b and AC10c are asserted as class and flow invariants, not pixels.**
  jsdom measures no text. What the suite pins is that no geometry-bearing class
  differs and that the mark is out of the flow; the pixel claim is Step I2's
  demo at 360px and 320px, which is the same division of labour feature-16 used
  for its own 360px budget.
- **Existing prose comments are deleted only where this epic edits the line
  they annotate.** Four sites, all named in the steps: `ChipGroup`'s class
  docstring sentence about per-option marks (B7), `chipAdornment`'s docstring in
  the harness (E1), both caption constants' comments and the caption's JSX
  comment (E8). This epic is not a comment cleanup of files it otherwise leaves
  alone — that would bury the diff the epic is actually judged on.
- **Nothing here is memoised beyond the one `useMemo`.** `optionStatesFor` builds
  a small object per render inside `GuessCard`, as Epic 1's `unavailableStates`
  already does and as the `♪` ternary does. Twelve entries is not a performance
  question.

## Decision log

Settled decisions. The sections above are the source of truth — this records how
they got there, and what each one cost. These were architect's calls made while
writing the spec, not questions put to the user: the PRD's own Q1 and Q2 already
settled the two decisions that were expensive (both marks, and the mark out of
the flow), and none of the below is expensive to reverse.

### Cycle 1 — 2026-09-02

**D1. Where the derivation lives, and what it returns.**
Decision: **one new module, `lib/presentation/confirmed.ts`, exporting
`confirmedHalves(attempts): Confirmed`** — `presentation/` because it turns state
into what the UI says and renders nothing; a new module rather than a function in
`feedback.ts` because Epic 1 owns that file in wave 1 and a shared file is a
collision this epic can simply not have. One function returning both halves
rather than two functions, so the page holds one memo beside its existing four.
Cost of reversing: two call sites.

**D2. `trailingAdornment` on `Chip`, positioned rather than inline.**
Decision: **a second optional string prop, drawn in the chip's own padding**, per
the PRD's Q2. Named as the pair to `adornment` so the primitive's two decorative
slots read as one idea; that it is out of the flow is the primitive's own
business, exactly as `ADORNMENT = 'mr-[5px]'` is today. Cost of reversing: a
rename across `Chip`, `ChipGroup`, `GuessCard` and four tests.

**D3. A solving attempt marks both halves.**
Decision: **the rule is per half, not per outcome.** `rootMatched` confirms the
root of that attempt, `flavourMatched` its flavour, whatever `correct` says. It
makes the derivation one fold, satisfies the PRD's "the winning pair keeps
whatever marks it earned", and cannot contradict R1, which speaks only about the
half-right case. Step A6 is the pin.

**D4. R7/AC8 is proven by invariant and by selectability, not by intersecting
Epic 1's module.**
Decision: **Step A7 asserts that every half `confirmedHalves` can return is the
day's own, and Step E5 asserts that a marked chip still selects.** Together they
carry "no chip is ever both marked and ruled out" without this epic's tests
importing or mocking anything Epic 1 named — which is what keeps Track A
dependency-free and keeps the composed assertion true whatever mechanism Epic 1
used for the lock. Cost of reversing: none; a direct set-intersection test can be
added later against Epic 1's exported derivation.

**D5. The stickiness cases are seeded, not clicked.**
Decision: **Step E4 seeds a three-attempt day rather than clicking three
guesses**, because by the third miss Epic 1 has eliminated roots the test cannot
predict, and a click on a ruled-out chip is a no-op. The seeded record is also
exactly what AC6 asks for, so one setup carries R3 and R5. The interactive path
is still walked, twice: Step E2 clicks a real guess, and Step I2's demo does the
whole thing by hand.

**D6. The caption's relation to the sounds-on sentence is asserted, not
derived.**
Decision: **two module constants with a ternary between them, unchanged in
shape**, with `CAPTION_SOUNDS_ON.replace(', or tap a root or a mode to hear it', '')`
asserted equal to `CAPTION_SOUNDS_OFF` in the test. Deriving one from the other
in source would make the two epics that own one wording each share an expression;
asserting it keeps them independent and still catches a drift. Cost of
reversing: one line.

**D8. Epic 1's spec landed mid-write, and the mark moved into its record.**
Decision: **per-option marks travel in `ChipOptionState.mark`, one map, not a
second `marks` prop.** The first draft of this spec routed around Epic 1's Step
A9 — a source read pinning `ChipOptionState`'s field list to exactly
`['unavailable']`, which a `mark` field would have failed — by adding a separate
flat `Record<string, string>` beside `optionStates`. Epic 1 then loosened A9 to
the rule it actually protects (the type declares no field meaning the row's own
lock) and added `mark?: string` as the slot to fill, which is the better shape:
one channel for per-option data, nothing to keep in step, and `GuessCard`'s
`unavailableStates` widening into one `optionStatesFor` merge rather than two
builders. Epic 1 went further than loosening the guard: its Step A7 now
*declares* `mark` on the type and deliberately leaves it unwired, and A9 asserts
both slots plus a `ROW_LOCK` regex, so this epic adds no field, edits no guard
and supplies only the pass-through. Everything about the mark itself survived the
change unaltered — the `data-mark` span, its geometry, the unconditional
`relative`, `aria-hidden`, `currentColor` — because Epic 1 froze the shape and
never sets a mark. Changed: C1, C3, C5, Steps B0, B7, B8, D1, D2, D5, D6, D8,
plus the two tracks' goals and the wave notes. Cost of reversing: a prop split,
and a field deleted from a type two epics read.

**D7. `AGENTS.md` gained a comments rule while this spec was being written.**
Decision: **the reasoning moves into the spec and into test names, and no step
instructs a comment.** The rule — code explains itself, a comment is for a
workaround or a quirk, never prose — makes the surrounding heavily-commented
style the old one, so this epic does not match it. It cost the spec three things
it would otherwise have leaned on a file to say: the positioned-mark geometry
(now the Architecture arithmetic plus Steps B3, B4, D8), why `relative` is
unconditional (now B3's own assertion), and which epic owns which caption wording
(now the mirroring in `testing/puzzleHarness.tsx`). It also turned four existing
prose comments into deletions rather than rewrites. Cost of reversing: nothing in
the code; the spec would grow comments back.

The spec is ready to implement. No architectural question is left open: the two
that were expensive — whether the check replaces the `♪`, and where the second
mark goes — were answered in the PRD's Q1 and Q2, and everything else above is a
decision one rename would undo.
