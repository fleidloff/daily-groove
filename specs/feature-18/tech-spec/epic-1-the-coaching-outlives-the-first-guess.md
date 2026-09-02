# Tech spec — Epic 1: The coaching outlives the first guess

PRD: [../prd/epic-1-the-coaching-outlives-the-first-guess.md](../prd/epic-1-the-coaching-outlives-the-first-guess.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three new modules in `lib/presentation/` and one reshaped box. `moves.ts` holds
the ladder as data — four `Move` records, each a wording and, where it names a
tap, a second wording for a silent row. `coaching.ts` picks the rung from the
miss count and the `tapSounds` preference and returns a `Feedback` with tone
`neutral`, so the coaching renders through the `FeedbackLine` the box already
has and no new component enters `components/puzzle/`. `verdict.ts` answers the
one question the PRD's R12a asks — is this miss the first miss, or the miss that
confirms a half for the first time — as a pure predicate over `attempts`.
`NudgeBox` then stacks verdict over coaching over count inside a single
`role="status" aria-live="polite"` wrapper, and `FeedbackLine` gives up the live
region it has carried since feature-17 so the three lines are announced once
rather than racing.

Nothing is stored, nothing new is read. The selector's inputs are `attempts`
and `tapSounds`, both of which already survive a reload, and the transport is
not among them — R16 is held by a source guard, not by a promise.

## Architecture

### The derivation chain

```
attempts ─┬─▶ lib/presentation/coaching.ts   selectCoaching({ attempts, tapSounds })
          │        │  rung = min(missCount(attempts), LADDER.length − 1)
          │        │  wording = tapSounds ? move.message : (move.soundsOff ?? move.message)
          │        ▼
          │   Feedback { message, tone: 'neutral' }  ◀── LADDER (lib/presentation/moves.ts)
          │
          ├─▶ lib/presentation/verdict.ts     shouldShowVerdict(attempts) → boolean
          │
          └─▶ lib/presentation/feedback.ts    selectFeedback(attempts, solved) → Feedback  (unchanged)

GroovePuzzle ──▶ coaching / showVerdict / feedback ──▶ GuessCard ──▶ NudgeBox
                                                                       │
                                        one polite live region ────────┘
                                        verdict? · coaching · count?
```

`tapSounds` already lives in `GroovePuzzle` (`useTapSounds`) and is already
handed to `GuessCard`; the coaching reads the value at the page, because the
card takes derived values as props and recomputes nothing. `isPlaying` is in
the same component and is deliberately not passed anywhere near this chain
(R16).

### When the verdict shows, exactly

`shouldShowVerdict` reads the misses in order and nothing else:

| The day so far | Verdict on the last miss |
| :-- | :-- |
| no misses | no — there is nothing to be a verdict about |
| one miss | **yes**, whatever it matched (R12a: it is what teaches the dimming) |
| a later miss, matching a half no earlier miss matched | **yes** (R12a: the win keeps its words) |
| a later miss, matching only a half an earlier miss already matched | no (R12b) |
| a later miss matching neither half | no |
| the last attempt is correct | no (R15 — and the box is gone anyway) |

"For the first time" is the whole of the difficulty, and it is why the predicate
reads *all* the misses rather than the last one. Once a half is confirmed,
feature-17's `optionStatesFor` locks that row to a single live chip, so every
subsequent attempt necessarily matches on that half — a run of five further
misses after a confirming one would produce five identical "the mode is right"
verdicts if the rule were `matchedHalf(last) !== 'neither'`. Step B6 is the
sweep that proves it does not, and Step B7 pins R12c: over any day, in any
order, the predicate can be true at most twice.

The predicate is deliberately *not* `confirmedHalves(earlier).roots.length > 0`,
though that would compute the same answer. `confirmedHalves` answers *which*
half was confirmed and allocates two arrays to say so; the verdict needs only
*whether*, and a boolean fold over the earlier misses is what the file should
read as. The relationship is asserted rather than shared: Step B5 checks the two
agree on a day where a half is confirmed.

### The Hint box, after this epic

```html
<aside aria-label="Hint">
  <Stack gap="xs">
    <EyebrowLabel>Hint</EyebrowLabel>
    <div role="status" aria-live="polite">
      <Stack gap="xs">
        <FeedbackLine feedback={verdict} />    <!-- data-tone="warm",    when shown -->
        <FeedbackLine feedback={coaching} />   <!-- data-tone="neutral", always on an open day -->
        <p>N roots ruled out. Narrowing as you go.</p>   <!-- when the count is not zero -->
      </Stack>
    </div>
  </Stack>
</aside>
```

Four things this shape settles:

1. **The landmark survives.** The region is an inner `div`, not the `aside`.
   Putting `role="status"` on the `aside` would override its `complementary`
   role and break every `queryByRole('complementary', { name: 'Hint' })` in the
   suite — the harness's `nudge()` included. The eyebrow stays outside the
   region, so "Hint" is not re-announced on every miss.
2. **`FeedbackLine` can appear twice.** It is used for both the verdict and the
   coaching, which is only safe once it stops declaring a live region of its
   own — two `role="status"` elements changing at one stroke is exactly the race
   R17 exists to remove. `NudgeBox` is its only consumer, verified by grep, so
   nothing else loses an announcement.
3. **Tone is the discriminator, and it means something.** Inside the box, warm
   is the verdict and neutral is the coaching (R13). All three `WRONG_GUESS`
   messages are `warm`; every move is `neutral`; `OPENING` — the only neutral
   `Feedback` the verdict slot could ever have carried — is now unreachable
   there, because a day with no attempts has no verdict to show. Step C3 pins
   the invariant, and the harness reads the two lines by `data-tone`.
4. **No new component.** `src/features/daily-groove/structure.test.ts` holds an
   exhaustive `REGIONS` map of every `.tsx` under `components/puzzle/`; a
   `CoachingLine.tsx` would fail it, and would be a second component doing
   `FeedbackLine`'s job. The coaching is a `Feedback`, and the box already knows
   how to render one.

### The two rules every move obeys, made mechanical

R5 and R10 are the rules Epic 2 inherits, so they are guards over `LADDER`
rather than review notes:

- **No root name.** Matched **case-sensitively** against `ROOTS`, bounded on
  both sides by `[A-Za-z♭♯]` — the pattern `NudgeBox.test.tsx` already uses.
  Case-sensitivity is load-bearing in both directions: it lets a move say "a few
  times" without tripping on the root `A`, and it means a move may not *open a
  sentence* with a bare "A" or "B". That is a real constraint on the copy and it
  is worth the false positive, because the alternative is a case-insensitive
  guard that rejects the English article.
- **No mode name and no family name.** Matched **case-insensitively**, whole
  word, against `flavourPool(GROOVES)` (the catalogue's twelve mode names, the
  superset of any day's four `flavourOptions`) unioned with `FAMILIES`
  (`Major`, `Minor` — simple mode's option set, which is why Epic 2 inherits the
  guard unchanged). The practical consequence: **"compare the third against a
  major scale you already know" cannot be written as-is.** `Major` is an option
  on the board in simple mode, and AC6 says no mode name from the game's option
  sets. The move survives with the word removed — the musician decides how.
- **No chord symbol.** `/[A-G](♯|♭)?(m|maj|min|dim|aug|sus|\d)/` — the root
  guard's lookahead deliberately lets `Cm7` through, and R5 bans chords too.
- **A tap named is a tap answered.** Every move whose `message` matches
  `/\btap\b/i` declares a `soundsOff`, and no `soundsOff` says "tap".

### What the catalogue supports, for the musician

Verified against all 30 grooves in `data/grooves.generated.ts` as of writing:

- **Tempo range is 67–130 bpm.** Whether a third or a sixth is reliably hearable
  at the fast end is the musical judgement this track exists for.
- **Every groove is 4 bars, one chord per bar**, from a 3- or 4-chord
  progression (`barChords` cycles a 3-chord one, so bar 4 repeats bar 1).
- **Bar 3's chord differs from bar 2's in 30 of 30**, and bar 2's from bar 1's
  in 30 of 30. "Listen for what changes in bar three" is a claim the catalogue
  currently supports everywhere.
- **The first chord's root is the day's answer root in 30 of 30.** "Hum the bass
  note on beat one" points at the tonic, not near it.

Step A8 turns whichever of those two claims the ladder actually makes into a
test over `GROOVES`, so the copy breaks loudly if a future groove stops
supporting it.

### What this epic leaves for Epic 2

Epic 2 is wave 2 of the feature and edits the same box. The seams, stated here
so it rebases onto a document rather than onto a diff:

- **`lib/presentation/coaching.ts`** — `CoachingInput` widens with the fields
  Epic 2 needs (`matchedHalf`, `simple`); `selectCoaching`'s return type does
  not move. It is an options object for exactly this reason: a second and third
  input is a field, not a positional argument, and no call site's arity changes.
  Step D7's source guard bans transport symbols and **does not** freeze the
  field list — feature-17's Q7 is the worked example of an over-tight guard
  routing the next epic around the design.
- **`lib/presentation/moves.ts`** — `LADDER` is the neither-matched family.
  Epic 2 adds sibling exports (a root-found family, a mode-found family, a
  simple-mode set) in this file or a sibling, and every guard in
  `moves.test.ts` is written over an array of `Move`s so it extends by adding
  one line per new family.
- **`components/puzzle/NudgeBox.tsx` and `FeedbackLine.tsx`** — done after this
  epic. Epic 2 changes what the coaching *says*, not where it sits.
- **`components/puzzle/GuessCard.tsx`** — gains `coaching` and `showVerdict`
  here and needs nothing further; Epic 2's inputs are consumed at the page.
- **`components/GroovePuzzle.tsx`** — two new memos, `coaching` and
  `showVerdict`, beside the existing `feedback` memo. Epic 2 adds fields to the
  first one's argument object.
- **`lib/presentation/feedback.ts`** — one word changes in this epic:
  `missCount` becomes exported. `OPENING`, `SOLVED`, the three `WRONG_GUESS`
  messages, `selectFeedback`, `shouldShowNudge`, `shouldOfferReveal` and
  `dotStates` are untouched, in name, signature and body. Neither epic rewrites
  a verdict message.

## Contracts

Frozen. Tracks build against these rather than against each other.

### C1 — the ladder

```ts
// src/features/daily-groove/lib/presentation/moves.ts

export type Move = {
  message: string
  soundsOff?: string
}

export const LADDER: readonly [Move, Move, Move, Move]
```

Four rungs, as the PRD's behaviour table lays them out — 0 misses, 1, 2, 3, then
held. A fixed-length tuple rather than `readonly Move[]`: the ladder cannot be
emptied by an edit, `LADDER[0]` is never `undefined`, and the length is a fact
the type carries rather than a number a test hopes for.

- `message` — the wording when the tap sounds are on. Rung 0's is **exactly**
  today's opening line, character for character, typographic apostrophe and em
  dash included (R2). Step A2 pins it by comparing against
  `selectFeedback([], false).message` rather than by retyping it.
- `soundsOff` — the wording for a silenced row, present only on the moves that
  name a tap (R10). Absent means the move reads the same either way.

The five invariants, each with the step that proves it:

1. `LADDER.length === 4`, `LADDER[0].message === selectFeedback([], false).message` (A2).
2. Every wording is non-empty, trimmed and distinct from every other (A3).
3. No wording names a root (A4), a mode or a family (A5), or spells a chord (A6).
4. At least one rung declares a `soundsOff`; every rung whose `message` says
   "tap" declares one; no `soundsOff` says "tap" (A7). The "at least one" is
   what lets Track F write AC10's composed test as
   `LADDER.findIndex((move) => move.soundsOff !== undefined)` without a
   fallback.
5. Whatever the copy claims about the music is true of every groove in
   `GROOVES` (A8).

**The four wordings are a musical decision and are not fixed here.** The
material is the briefing's three moves — hum the bass note on beat one, compare
the third against a scale you already know, listen for what changes in bar
three — and the questions that decide them are in Step A1.

### C2 — the coaching selector

```ts
// src/features/daily-groove/lib/presentation/coaching.ts
import type { Attempt } from '../../types'
import type { Feedback } from './feedback'

export type CoachingInput = {
  attempts: readonly Attempt[]
  tapSounds: boolean
}

export function selectCoaching(input: CoachingInput): Feedback
```

Total: it returns a move for every possible input, which is R1 made structural —
there is no argument for which the box has no technique to show. Body, exactly:

```
rung    = Math.min(missCount(attempts), LADDER.length - 1)
move    = LADDER[rung]
message = tapSounds ? move.message : (move.soundsOff ?? move.message)
return { message, tone: 'neutral' }
```

- **`tone` is always `neutral`** (R13). The box's muted treatment is
  `FeedbackLine`'s existing `neutral` class; no new tone, no new component.
- **A miss is `attempt.correct === false`**, counted by `missCount` from
  `./feedback` — the same function `dotStates` and `shouldOfferReveal` already
  count with. Three private copies of "what a miss is" is how a feature ends up
  with three answers; this epic exports the one that exists rather than adding a
  second.
- **A tap is not an input** (R6): presses reach `onPress` and change no
  attempt, so the derivation cannot see them.
- **The transport is not an input** (R16). Not `isPlaying`, not a clock, not a
  position. Step D7 reads the module from disk and says so.

### C3 — when the verdict shows

```ts
// src/features/daily-groove/lib/presentation/verdict.ts
import type { Attempt } from '../../types'

export function shouldShowVerdict(attempts: readonly Attempt[]): boolean
```

```ts
const misses = attempts.filter((attempt) => !attempt.correct)
const last = misses[misses.length - 1]
if (!last) return false
if (misses.length === 1) return true
const earlier = misses.slice(0, -1)
return (
  (last.rootMatched && !earlier.some((a) => a.rootMatched)) ||
  (last.flavourMatched && !earlier.some((a) => a.flavourMatched))
)
```

Matching is read truthily, not strictly — an attempt with an unreadable or
absent `rootMatched` counts as *not* a confirmation, so a legacy record can only
ever suppress a verdict, never invent one. That is the safe direction here, and
it is the mirror of feature-17's strict `=== false` on the same fields, where
the safe direction was the other way.

```ts
// src/features/daily-groove/lib/presentation/feedback.ts

export function missCount(attempts: Attempt[]): number   // was private
```

The **only** change to `feedback.ts` in this epic: the `export` keyword. Body
unchanged, position unchanged, every other export unchanged.

### C4 — the box

```tsx
// src/features/daily-groove/components/puzzle/NudgeBox.tsx

type NudgeBoxProps = {
  feedback: Feedback | null
  coaching: Feedback | null
  eliminated: number | null
}
```

`feedback` is the verdict, already gated by the caller — `null` means R12a said
no. `coaching` is the move; it is `Feedback | null` rather than required so the
box keeps its "renders nothing when it has nothing" contract, which four
existing cases assert and which a required prop would make untestable.

The content guards, exactly:

```ts
const message = feedback && feedback.message.trim() !== '' ? feedback : null
const move = coaching && coaching.message.trim() !== '' ? coaching : null
const count = eliminated !== null && eliminated > 0 ? eliminated : null
if (message === null && move === null && count === null) return null
```

`move` is guarded truthily rather than with `!== null` on purpose: between wave
1 and wave 2 the only consumer has not yet been given the prop, and
`undefined !== null` would throw inside every `GuessCard` render. The truthy
check keeps the interim red surface at the single assertion Track E owns rather
than at fifty crashed renders. It is also correct on its own terms — an absent
prop is an absent line.

Markup as in the Architecture section: the `aside` keeps `aria-label="Hint"`,
its classes and its landmark role; the eyebrow stays outside the region; one
`<div role="status" aria-live="polite">` wraps a `Stack gap="xs"` holding
verdict, coaching and count in that order (R12, R17). The narrowing sentence
keeps its copy, its position and its condition — `${count} roots ruled out.
Narrowing as you go.` — and rides inside the region (PRD assumption).

### C5 — the line

```tsx
// src/features/daily-groove/components/puzzle/FeedbackLine.tsx
```

`role="status"` and `aria-live="polite"` are **both** removed. Removing only the
role would leave the attribute making a live region, which is the mutation
feature-17's QA found in the other direction; removing only the attribute would
leave the implicit polite region the role carries. `data-tone`, the `TONE` class
map, the message and the props are unchanged, so the component keeps its own
contract tests for everything except the region it no longer owns.

### C6 — the card's props

```ts
// added to GuessCardProps
  coaching: Feedback
  showVerdict: boolean
```

Both required. `coaching` is non-null here because the card only renders the box
on an open day, and on an open day there is always a move (R1) —
`selectCoaching` is total, so the page has nothing to pass but a `Feedback`.
`showVerdict` is the gate, `feedback` stays the content: the same shape as the
existing `showNudge` / `eliminated` pair, which is the idiom this file already
states about itself. The one call site becomes

```tsx
<NudgeBox
  feedback={showVerdict ? feedback : null}
  coaching={coaching}
  eliminated={showNudge ? eliminated : null}
/>
```

still under `{!over && …}` (R14). Nothing else in `GuessCard` moves: not the
chip rows, not `optionStatesFor`, not the row-wide `adornment`, not the control
label, not the give-up button.

### C7 — the page, and the harness

```tsx
// src/features/daily-groove/components/GroovePuzzle.tsx, beside the existing `feedback` memo

const coaching = useMemo(
  () => selectCoaching({ attempts, tapSounds }),
  [attempts, tapSounds],
)
const showVerdict = useMemo(() => shouldShowVerdict(attempts), [attempts])
```

`tapSounds` in the dependency list is the whole of AC10: the switch is React
state (`useTapSounds`), so flipping it re-renders and re-derives, and the
wording swaps with no reload. Both values are passed to the single `GuessCard`
call.

```ts
// src/features/daily-groove/testing/puzzleHarness.tsx — added

export const hintRegion = () => nudge()?.querySelector('[role="status"]') ?? null
export const verdictLine = () => nudge()?.querySelector('[data-tone="warm"]') ?? null
export const coachingLine = () => nudge()?.querySelector('[data-tone="neutral"]') ?? null
export const move = () => coachingLine()?.textContent ?? null
```

`nudge()`, `nudgeLine()`, `control()`, `guess()`, `play()` and the rest are
unchanged. `nudge()` keeps working precisely because the region is an inner div.

## Tracks

### Track A — The ladder

- **Goal** — four listening moves exist as data, rung 0 is the sentence the
  feature exists to stop losing, and the two rules Epic 2 inherits are guards
  rather than notes.
- **Owns** — `src/features/daily-groove/lib/presentation/moves.ts`,
  `src/features/daily-groove/lib/presentation/moves.test.ts`
- **Role** — `musician`. **Two dispatches at implementation time:** the musician
  decides the four rungs and the sounds-off wordings and reports the reasoning
  (Step A1, which writes no file); an `implementer` then writes both files from
  that decision (Steps A2–A8). The musician writes no source file, as
  `.claude/agents/musician.md` has it.
- **Test command** — `npm test`. This track owns no file under
  `scripts/grooves/`, so `npm run test:gen` is not its suite.
- **Depends on** — nothing. Contract C1 is frozen, and rung 0 is pinned against
  an export `feedback.ts` already has.
- **Parallel with** — Track B, Track C
- **Done when** — every case in `moves.test.ts` passes and `npm test` is green.
  Nothing imports `moves.ts` yet, so no other file moves.

### Track B — When the verdict shows

- **Goal** — a pure predicate that says yes on the first miss and on the miss
  that confirms a half for the first time, and no on every other miss, at most
  twice a day.
- **Owns** — `src/features/daily-groove/lib/presentation/verdict.ts` and its
  test, `src/features/daily-groove/lib/presentation/feedback.ts` and its test
- **Role** — `implementer`
- **Depends on** — nothing. `Attempt` and `confirmedHalves` both already exist.
- **Parallel with** — Track A, Track C
- **Done when** — every case below passes, `npm test` is green, and
  `feedback.ts`'s diff is one word.

`feedback.ts` is in this track and not in Track D's because a file that two
wave-1 tracks both edit is the failure feature-16 shipped; here it is edited in
wave 1 and only *read* in wave 2.

### Track C — The Hint box is one live region

- **Goal** — the box carries verdict over coaching over count inside a single
  polite region, the coaching reads muted, and `FeedbackLine` declares no region
  of its own.
- **Owns** — `src/features/daily-groove/components/puzzle/NudgeBox.tsx` and its
  test, `src/features/daily-groove/components/puzzle/FeedbackLine.tsx` and its
  test
- **Role** — `implementer`
- **Depends on** — nothing. Contract C4 fixes the markup and contract C5 the
  removal; the coaching arrives as a prop, so no selector need exist.
- **Parallel with** — Track A, Track B
- **Done when** — every case in both test files passes, including the four
  pre-existing `NudgeBox` cases and the three pre-existing `FeedbackLine` cases
  this track rewrites (named in Steps C1 and C2).

**The two files are one track because R17 is one change across both.** Splitting
them would leave a wave in which the box has no region and the line still has
one, or both have one — either way, the epic's single-region requirement is
false in the interval, and no test would be pointing at it.

### Track D — The move for the day

- **Goal** — the selector that returns a move for every open state of the day,
  advancing on misses, holding on the last rung, swapping wording with the tap
  sounds, and never reading the transport.
- **Owns** — `src/features/daily-groove/lib/presentation/coaching.ts` and its
  test
- **Role** — `implementer`
- **Depends on** — Track A's `LADDER` **real** (the selector returns its rungs;
  the only way to run without it is to mock a sibling module, which
  `docs/testing.md` rules out) and Track B's exported `missCount`.
- **Parallel with** — Track E
- **Done when** — every case below passes and `npm test` is green. Nothing
  consumes `selectCoaching` yet.

### Track E — The card

- **Goal** — the card hands the box a gated verdict and an ungated move, and the
  box still disappears the moment the day ends.
- **Owns** — `src/features/daily-groove/components/puzzle/GuessCard.tsx` and its
  test
- **Role** — `implementer`
- **Depends on** — Track C's `NudgeBox` **real**, and contracts C4 and C6. It
  does **not** depend on Track D: its assertions pass `Feedback` literals, as
  the file already does for `feedback`.
- **Parallel with** — Track D
- **Done when** — every case below passes, every pre-existing case passes with
  only the `props()` factory extended, and `npm test` is green apart from the
  composed cases Track F owns.

### Track F — The page, and the composed behaviour

- **Goal** — the page derives the move and the verdict gate, hands both down,
  and every composed acceptance criterion is proven through a rendered puzzle.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Depends on** — Tracks B, D and E, all real.
- **Parallel with** — nothing in this epic.
- **Done when** — every case below passes, `npm test` is green,
  `npx tsc --noEmit` and `npm run lint` are clean.
- **Not owned, and expected to stay untouched** —
  `GroovePuzzle.page.test.tsx` (its two feedback assertions are both on a first
  miss, which still shows its verdict; its `[aria-live]` count at line 483 is
  scoped to a solved day's card, where no box renders),
  `GroovePuzzle.sounding.test.tsx` (its seven guesses assert chord symbols and
  captions, never the box), `GroovePuzzle.header.test.tsx`,
  `GroovePuzzle.intro.test.tsx`, `components/puzzle/AttemptDots.test.tsx`,
  `components/puzzle/TransportPanel.test.tsx`,
  `components/header/ShareGroove.test.tsx`. If any of them goes red, that is a
  finding for Track G, not a file to edit quietly.

### Track G — Integration and verification

- **Goal** — the epic is proven end to end and every R and AC is graded.
- **Owns** — no source file. It runs checks and reports.
- **Role** — `verifier`
- **Depends on** — Tracks A–F.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` are clean, the demo path below has been walked, and every
  criterion is marked done / partly / not done. It diagnoses; it does not fix.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C — three disjoint file sets,
  no shared path.
- **Wave 2 (parallel):** Track D — needs A's `LADDER` and B's `missCount`;
  Track E — needs C's box.
- **Wave 3:** Track F — needs B, D and E.
- **Wave 4:** Track G — integration and verification.

**Four scheduling facts for the lead.**

1. **Wave 1 ends with one known failing assertion and one known type error, and
   that is planned.** The assertion is `GuessCard.test.tsx`'s
   `expect(regions[0]).not.toHaveTextContent(/ruled out/)` (in *keeps the
   feedback the card's only live region*), which becomes false the moment the
   count joins the region — Track E owns that file and rewrites it in Step E3.
   The type error is `GuessCard.tsx` not passing `NudgeBox`'s new required
   `coaching` prop, fixed in Step E1. Nothing else in the suite moves: the box
   still renders, still has exactly one `[aria-live]` inside it, and still
   answers `within(box).getByRole('status')`, because the region is an inner div
   rather than the `aside`.
2. **Wave 2 ends with `GroovePuzzle.tsx` not typechecking**, missing
   `GuessCard`'s two new required props. Step F1 is what fixes it — by threading
   the real derivations through, never by passing a literal. A `showVerdict`
   hardcoded `true` would ship the app it has today with a green suite saying
   otherwise.
3. **Nothing here runs concurrently with feature-18 Epic 2.** Epic 2 is wave 2
   of the feature and edits `coaching.ts`, `moves.ts`, `GroovePuzzle.tsx` and
   the same composed test file. "What this epic leaves for Epic 2" above is what
   it rebases onto.
4. **Track A's first dispatch gates its second, not the wave.** Tracks B and C
   do not wait for the musician's decision; only Steps A2–A8 do.

## Implementation

### Track A — The ladder

#### Step A1 — The four rungs are decided

Covers: R2, R3, R4, R5, R9, R10

**The one step in this epic that is not red-green, because it is a judgement
rather than a behaviour.** It writes no file. Its output is the decision the
next seven steps encode, reported back with the reasoning.

What the musician decides, and must state:

1. **The four wordings**, rung by rung. Rung 0 is fixed by R2 and is not open:
   `Loop it a few times. Sing the note that feels like rest — that’s usually the
   root.` Rungs 1–3 come from the briefing's material — hum the bass note on
   beat one; compare the third against a scale you already know; listen for what
   changes in bar three — reordered, reworded or replaced as the music demands.
   Later rungs should get more concrete: rung 3 is what a player who has missed
   three times and has the give-up button on screen is being asked to do.
2. **Which rung names a chip tap, and what it says when the taps are silent**
   (R9, R10). At least one must, and the sounds-off wording must not name the
   silenced control. A move may point at a *ruled-out* chip (R11) — an
   unavailable chip still fires `onPress` — so "tap the roots you have already
   ruled out and hear why they are wrong" is available material, not a bug.
3. **Whether each claim survives the catalogue.** The facts, verified over all
   30 grooves: tempo 67–130 bpm; 4 bars, one chord per bar; bar 3's chord
   differs from bar 2's in 30 of 30; the first chord's root is the answer's root
   in 30 of 30. The open questions are musical: is a third or a sixth reliably
   hearable at 126–130 bpm with this instrumentation, and is "what changes in
   bar three" a change a beginner can *hear* rather than one a chart can show?
   Read [docs/music.md](../../../docs/music.md) — this is the change it is a
   reference for.
4. **How the third is compared without the word "major".** `Major` is on the
   board in simple mode and AC6 bans it. This is the one place the guards bite
   the briefing's own phrasing, and the substitute is a musical call.
5. **That no move names the answer.** R5 is the rule that keeps the feature from
   being the reveal by instalments; the guards in A4–A6 are mechanical, and this
   is the reading that catches what a regex cannot.

- **Test first** — none. This step produces a decision, not a file.
- **Implement** — nothing. Report the four `Move` records, verbatim, plus the
  reasoning for each and the answers to points 3 and 4.
- **Green when** — the decision names four rungs, at least one `soundsOff`, and
  a reason per rung.
- **Refactor** — none.

#### Step A2 — The ladder is four rungs, and the first is the line we have

Covers: R2, R4, AC3

- **Test first** — `src/features/daily-groove/lib/presentation/moves.test.ts`:
  `it('is four rungs, opening on the line the app already has (R2, R4, AC3)')`
  asserting `expect(LADDER).toHaveLength(4)` and
  `expect(LADDER[0].message).toBe(selectFeedback([], false).message)`, importing
  `selectFeedback` from `./feedback` so the sentence is never retyped. Run it:
  fails with `Failed to resolve import "./moves"`.
- **Implement** — `src/features/daily-groove/lib/presentation/moves.ts`: the
  `Move` type and the `LADDER` tuple from Step A1's decision, typed
  `readonly [Move, Move, Move, Move]`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A3 — Every rung is its own sentence

Covers: R3, AC2, AC4

The guard behind "a *different* move": a ladder with a repeated wording advances
without the player seeing it move.

- **Test first** — same file: assert every `message` and every `soundsOff` is
  non-empty and equal to its own `trim()`, and that
  `new Set(LADDER.map((m) => m.message)).size` is `LADDER.length`. Run it: fails
  only if the copy repeats itself.
- **Implement** — adjust the copy if it does; otherwise nothing.
- **Green when** — four distinct, trimmed, non-empty wordings.
- **Refactor** — none.

#### Step A4 — No move names a root

Covers: R5, AC6

- **Test first** — same file:
  `it('names no root from the game's option set (R5, AC6)')`. Build the wording
  list as `LADDER.flatMap((m) => [m.message, ...(m.soundsOff ? [m.soundsOff] : [])])`
  and, for every root in `ROOTS` (imported from `../theory/music`), assert no
  wording matches
  `new RegExp(`(?<![A-Za-z♭♯])${escaped}(?![A-Za-z♭♯])`)` — case-sensitive, the
  same pattern `NudgeBox.test.tsx` already uses, with the same escaping of `♯`
  and `♭`. Message the failure with the root and the wording. Run it: passes on
  copy that obeys R5; fails with `the move "A steady pulse…" names the root A`
  on copy that does not.
- **Implement** — nothing, or reword.
- **Green when** — twelve roots × four rungs × both wordings, all clean.
- **Refactor** — none.

#### Step A5 — No move names a mode or a family

Covers: R5, AC6

- **Test first** — same file: over
  `[...flavourPool(GROOVES), ...FAMILIES]` — `flavourPool` and `GROOVES` from
  `../theory/music` and `../../data/grooves.generated`, `FAMILIES` from
  `../theory/families` — assert no wording matches
  `new RegExp(`\\b${escaped}\\b`, 'i')`. Case-**in**sensitive, whole word, so
  "a major scale" fails alongside "Major". Also assert the option set the guard
  runs over is non-empty (`expect(names.length).toBeGreaterThan(12)`), so a
  future refactor that empties the pool cannot silently disarm the guard. Run
  it: fails with `the move "…against a major scale…" names the mode Major` if
  the briefing's phrasing survived Step A1.
- **Implement** — nothing, or reword.
- **Green when** — twelve mode names plus two families, all clean.
- **Refactor** — none.

#### Step A6 — No move spells a chord

Covers: R5

The root guard's lookahead lets `Cm7` through by design; R5 bans chords as well
as notes.

- **Test first** — same file: assert no wording matches
  `/[A-G](♯|♭)?(m|maj|min|dim|aug|sus|\d)/`. Run it: passes on clean copy.
- **Implement** — nothing, or reword.
- **Green when** — no wording spells a chord symbol.
- **Refactor** — none.

#### Step A7 — A move that names a tap answers for a silent row

Covers: R9, R10, AC10

- **Test first** — same file, three assertions in one case
  `it('gives every tap-naming move a sounds-off wording (R9, R10, AC10)')`:
  `expect(LADDER.filter((m) => m.soundsOff !== undefined).length).toBeGreaterThanOrEqual(1)`;
  every move whose `message` matches `/\btap\b/i` has a `soundsOff`; no
  `soundsOff` matches `/\btap\b/i`, and each differs from its own `message`. Run
  it: fails with `expected 0 to be greater than or equal to 1` on a ladder that
  names no tap.
- **Implement** — nothing, or add the wording.
- **Green when** — all three hold. The first is what lets Step F10 write
  `LADDER.findIndex((m) => m.soundsOff !== undefined)` and trust the answer.
- **Refactor** — none.

#### Step A8 — The moves' claims are true of the catalogue

Covers: R5

Include the assertion for each claim the decided ladder actually makes; at least
one applies, because rungs 1–3 come from material that makes both.

- **Test first** — same file, importing `GROOVES` and `barChords` from
  `../theory/changes`:
  - if a move names **bar three**:
    `it('changes chord in bar three on every groove in the catalogue')` —
    for every groove, `barChords(g.progression)[2] !== barChords(g.progression)[1]`.
  - if a move names **the bass note on beat one**:
    `it('starts every groove on the answer's root')` — for every groove, the
    leading `[A-G](♯|♭)?` of `barChords(g.progression)[0]` equals `g.root`.
  Run them: both pass today, 30 of 30.
- **Implement** — nothing. The test is the point: it fails when a new groove
  stops supporting a sentence the app is telling players, and the fix is then
  either the groove or the copy.
- **Green when** — every groove supports every claim the ladder makes.
- **Refactor** — none.

### Track B — When the verdict shows

#### Step B1 — The feature has one definition of a miss

Covers: R12a

- **Test first** — `src/features/daily-groove/lib/presentation/feedback.test.ts`:
  a new `describe('missCount')` with
  `expect(missCount([])).toBe(0)` and
  `expect(missCount([NEITHER, EXACT, ROOT_ONLY])).toBe(2)`, using the fixtures
  already at the top of the file. Run it: fails at import —
  `"missCount" is not exported by feedback.ts`.
- **Implement** — `src/features/daily-groove/lib/presentation/feedback.ts`: add
  `export` to the existing `missCount`. Nothing else in the file changes — not
  `OPENING`, not `SOLVED`, not the three `WRONG_GUESS` messages, not
  `selectFeedback`, `shouldShowNudge`, `shouldOfferReveal` or `dotStates`.
- **Green when** — the two assertions pass and every pre-existing case in the
  file passes unchanged.
- **Refactor** — none.

#### Step B2 — A day with no misses has no verdict

Covers: R12a, R15

- **Test first** — `src/features/daily-groove/lib/presentation/verdict.test.ts`:
  `expect(shouldShowVerdict([])).toBe(false)`. Run it: fails with
  `Failed to resolve import "./verdict"`.
- **Implement** — `verdict.ts` with the body from contract C3.
- **Green when** — it passes.
- **Refactor** — none.

#### Step B3 — The first miss keeps its words, whatever it matched

Covers: R12a, AC15

- **Test first** — same file,
  `it.each` over the three shapes: `[NEITHER]`, `[ROOT_ONLY]`, `[FLAVOUR_ONLY]`
  — each `shouldShowVerdict(...)` is `true`. Run it: fails on the first two if
  the predicate only reports confirmations.
- **Implement** — the `misses.length === 1` branch.
- **Green when** — all three pass. This is the case the PRD's table calls
  "shown — it is what teaches the dimming".
- **Refactor** — none.

#### Step B4 — A later miss that confirms nothing is silent

Covers: R12a, AC16

- **Test first** — same file:
  `expect(shouldShowVerdict([NEITHER, NEITHER])).toBe(false)`, and the same for
  a third and a fourth `NEITHER`. Run it: fails with
  `expected true to be false` against a predicate that reports every miss.
- **Implement** — the confirmation branch.
- **Green when** — the box is the coaching alone from the second miss on, unless
  something was confirmed.
- **Refactor** — none.

#### Step B5 — The miss that first confirms a half keeps its words

Covers: R12a, AC17

- **Test first** — same file: `[NEITHER, NEITHER, FLAVOUR_ONLY]` → `true`;
  `[NEITHER, ROOT_ONLY]` → `true`; and, in the same case, the agreement check —
  for the day `[NEITHER, NEITHER, FLAVOUR_ONLY]`,
  `confirmedHalves(attempts.slice(0, -1)).flavours` is empty while
  `confirmedHalves(attempts).flavours` is not, so the two modules describe the
  same event. Run it: fails with `expected false to be true` while only the
  first-miss branch exists.
- **Implement** — as C3.
- **Green when** — both directions pass.
- **Refactor** — none.

#### Step B6 — A confirmed half never confirms again

Covers: R12b, AC18

The requirement's load-bearing half, and the one a naive `matchedHalf(last)`
implementation gets wrong on every day that goes long.

- **Test first** — same file:
  `expect(shouldShowVerdict([NEITHER, FLAVOUR_ONLY, FLAVOUR_ONLY])).toBe(false)`;
  then the sweep — starting from `[NEITHER, FLAVOUR_ONLY]`, append five further
  `FLAVOUR_ONLY` misses one at a time and assert `false` at every length, which
  is what a mode row locked to one live chip actually produces. Same again for
  `ROOT_ONLY`. Run it: fails at the third attempt.
- **Implement** — the `earlier.some(...)` guards.
- **Green when** — every later attempt is silent.
- **Refactor** — none.

#### Step B7 — At most two verdicts a day

Covers: R12c

- **Test first** — same file: over a day of eight misses in each of several
  orders — `[NEITHER, NEITHER, ROOT_ONLY, ROOT_ONLY, NEITHER, ROOT_ONLY, …]`,
  `[ROOT_ONLY, FLAVOUR_ONLY, …]`, all-`NEITHER` — count
  `attempts.filter((_, i) => shouldShowVerdict(attempts.slice(0, i + 1))).length`
  and assert it is at most 2 in every order, and exactly 2 for a day whose first
  miss matches neither and whose later miss confirms one. Run it: fails with
  `expected 5 to be less than or equal to 2` against a per-miss predicate.
- **Implement** — nothing further; the property falls out of B3–B6.
- **Green when** — no ordering produces three.
- **Refactor** — none.

#### Step B8 — A solve carries no verdict, and the predicate mutates nothing

Covers: R15, AC14

- **Test first** — same file:
  `expect(shouldShowVerdict([EXACT])).toBe(false)` (a day solved first time),
  `expect(shouldShowVerdict([NEITHER, EXACT])).toBe(false)`, and a purity case —
  deep-clone the input, call twice, assert the same answer and an unchanged
  array. Run it: fails if `correct` attempts are counted as misses.
- **Implement** — the `!attempt.correct` filter.
- **Green when** — all four pass.
- **Refactor** — none.

### Track C — The Hint box is one live region

#### Step C1 — The line stops being a live region

Covers: R17, AC20

- **Test first** — `src/features/daily-groove/components/puzzle/FeedbackLine.test.tsx`:
  rewrite the three cases that reach for the role, keeping each one's subject:
  - *puts the message in a polite live region so it is announced* becomes
    `it('declares no live region of its own — the box owns the one (R17, AC20)')`:
    `const line = screen.getByText(WARM.message)`,
    `expect(line).not.toHaveAttribute('role')`,
    `expect(line).not.toHaveAttribute('aria-live')`, and
    `expect(screen.queryByRole('status')).toBeNull()`.
  - *announces a changed message from the same live region* keeps its rerender
    and asserts the new message is on screen and the old one is not.
  - *marks the tone it rendered*, *gives the three tones distinct classes* (its
    `classOf` helper) and *carries the whole message in text* switch from
    `getByRole('status')` to `getByText(feedback.message)`; their assertions do
    not change.
  Run them: the first fails with `expected element not to have attribute "role"`.
- **Implement** — `FeedbackLine.tsx`: delete `role="status"` and
  `aria-live="polite"`. `data-tone`, the class map and the props stay.
- **Green when** — all six cases in the file pass.
- **Refactor** — none.

#### Step C2 — The box announces its three lines once

Covers: R17, AC20

- **Test first** — `NudgeBox.test.tsx`, a new case
  `it('wraps the verdict, the coaching and the count in one polite region (R17, AC20)')`
  rendering `<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />`
  (with `const MOVE: Feedback = { message: 'Hum the bass note on beat one.', tone: 'neutral' }`
  as a test-local literal, so the file never depends on the real copy):
  `const regions = screen.getAllByRole('status')`,
  `expect(regions).toHaveLength(1)`,
  `expect(regions[0]).toHaveAttribute('aria-live', 'polite')`,
  `expect(regions[0]).toHaveTextContent(ROOT_MATCHED.message)`,
  `expect(regions[0]).toHaveTextContent(MOVE.message)`,
  `expect(regions[0]).toHaveTextContent(/2 roots ruled out/)`,
  `expect(box()).not.toHaveAttribute('aria-live')`, and
  `expect(box().querySelectorAll('[aria-live]')).toHaveLength(1)`. The `aside`
  carries `complementary` implicitly, so the landmark is asserted the way the
  file already does it — through `box()`'s own
  `getByRole('complementary', { name: 'Hint' })` — rather than by reading a
  `role` attribute that is not there.
  Run it: fails with `expected length 1 but got 0` — after Step C1 nothing on
  screen has the role.
  **Four pre-existing cases in this file change, and are named here so none is
  quietly deleted:**
  - *announces its changes from the one feedback status region* — its
    `expect(regions[0]).not.toHaveTextContent(/ruled out/)` is now false by
    design. Replaced by the case above.
  - *shows the nudge sentence alone when there is no feedback* — its
    `expect(screen.queryByRole('status')).not.toBeInTheDocument()` becomes
    `expect(screen.getByRole('status')).toHaveTextContent(/2 roots ruled out/)`
    and `expect(screen.queryByText(/wrong colour/)).toBeNull()`; it now passes
    `coaching={null}`.
  - *keeps the feedback tone on the feedback line* — reads the tone off
    `screen.getByText(ROOT_MATCHED.message)` instead of off the region.
  - *is a named landmark, but not a live region of its own* — passes unchanged,
    and is now guarding the inner div rather than `FeedbackLine`. Keep it.
  Every other case in the file gains `coaching={null}` or `coaching={MOVE}` and
  keeps its assertions.
- **Implement** — `NudgeBox.tsx`: the `coaching` prop, the `move` guard from
  contract C4, and the `<div role="status" aria-live="polite">` wrapping a
  `Stack gap="xs"` inside the outer `Stack`, below the eyebrow.
- **Green when** — the file is green, including the four rewritten cases.
- **Refactor** — none. The eyebrow stays outside the region.

#### Step C3 — The coaching sits under the verdict, and reads muted

Covers: R12, R13, AC11

- **Test first** — `NudgeBox.test.tsx`:
  `it('puts the coaching under the verdict, muted rather than warm (R12, R13, AC11)')`
  rendering both: assert
  `expect(screen.getByText(ROOT_MATCHED.message).compareDocumentPosition(screen.getByText(MOVE.message)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()`
  (the file's existing ordering idiom), that
  `screen.getByText(MOVE.message).dataset.tone` is `'neutral'`, that
  `screen.getByText(ROOT_MATCHED.message).dataset.tone` is `'warm'`, and that
  the two elements carry different `className`s. Also assert the invariant the
  harness will lean on: inside the box, `[data-tone="neutral"]` matches exactly
  one element and it is the coaching. Run it: fails with
  `Unable to find an element with the text: Hum the bass note on beat one.`
- **Implement** — render the coaching as a second `FeedbackLine` below the
  verdict, inside the region.
- **Green when** — order, tones and classes all hold.
- **Refactor** — none.

#### Step C4 — The box is the coaching alone when there is no verdict

Covers: R1, R12a, AC16

- **Test first** — `NudgeBox.test.tsx`:
  `<NudgeBox feedback={null} coaching={MOVE} eliminated={null} />` — the box
  renders, contains `MOVE.message`, contains no `[data-tone="warm"]`, and has
  exactly one `role="status"`. And with `eliminated={2}`: the coaching above the
  count, still one region. Run it: fails with `expected null not to be null` —
  today's box returns `null` when it has no feedback and no count.
- **Implement** — include `move` in the emptiness guard.
- **Green when** — both renders hold.
- **Refactor** — none.

#### Step C5 — The narrowing count is untouched

Covers: R17

The out-of-scope guard: feature-17's sentence keeps its copy, its position and
its condition; only its container changed.

- **Test first** — the file's pre-existing count cases (`names how many roots
  the app ruled out…`, `names the count it is given`, the `it.each([2,4,6,8])`
  one-number case, the floor case, the zero case) pass with `coaching={MOVE}`
  added and no other edit. Run them: they pass.
- **Implement** — nothing.
- **Green when** — all five pass.
- **Refactor** — none.

#### Step C6 — An empty box is still no box

Covers: R14

- **Test first** — the two pre-existing cases (*renders nothing at all when it
  has no content to carry*, *renders nothing when the feedback message is
  blank*) with `coaching={null}` and, in the blank case, a second render with
  `coaching={{ message: '  ', tone: 'neutral' }}` and everything else null,
  asserting `expect(container).toBeEmptyDOMElement()`. Run it: the blank-coaching
  render fails, showing an empty line.
- **Implement** — the `trim()` guard on `move`.
- **Green when** — both render nothing.
- **Refactor** — none.

### Track D — The move for the day

#### Step D1 — A day with no misses opens on rung 0

Covers: R1, R2, R7, R15, AC1, AC3

- **Test first** — `src/features/daily-groove/lib/presentation/coaching.test.ts`:
  `expect(selectCoaching({ attempts: [], tapSounds: true }).message).toBe(LADDER[0].message)`
  and `expect(selectCoaching({ attempts: [EXACT], tapSounds: true }).message).toBe(LADDER[0].message)`
  (a solve is not a miss). Run it: fails with
  `Failed to resolve import "./coaching"`.
- **Implement** — `coaching.ts` with the body from contract C2.
- **Green when** — both pass.
- **Refactor** — none.

#### Step D2 — Each miss advances the ladder by one

Covers: R3, AC2, AC4

- **Test first** — same file: for `n` in 0..3, a day of `n` misses returns
  `LADDER[n].message`; and, stated as the criterion words it, the move for `n`
  misses differs from the move for `n − 1` misses at every step. Run it: fails
  with `expected '…rest…' to be '…'` for `n = 1`.
- **Implement** — the `missCount` rung index.
- **Green when** — four rungs in order, each different from the last.
- **Refactor** — none.

#### Step D3 — The ladder holds on its last rung

Covers: R4, AC5

- **Test first** — same file: 4, 5, 8 and 20 misses all return
  `LADDER[LADDER.length - 1].message`, and the 8-miss and 20-miss answers are
  identical objects by value. Run it: fails with `Cannot read properties of
  undefined (reading 'message')` against an unclamped index.
- **Implement** — `Math.min(...)`.
- **Green when** — the tail is flat.
- **Refactor** — none.

#### Step D4 — The coaching is never a verdict

Covers: R13

- **Test first** — same file: for 0..6 misses, both tap-sound settings,
  `expect(selectCoaching(...).tone).toBe('neutral')`. Run it: passes once the
  literal is in place; fails against any attempt to reuse a warm tone.
- **Implement** — `tone: 'neutral'`.
- **Green when** — every rung is neutral, which is what makes R13's muted
  treatment automatic in `FeedbackLine`.
- **Refactor** — none.

#### Step D5 — A silenced row gets the other wording

Covers: R10, AC10

- **Test first** — same file: let `i = LADDER.findIndex((m) => m.soundsOff !== undefined)`
  (non-negative by Step A7). With `i` misses:
  `tapSounds: true` returns `LADDER[i].message`; `tapSounds: false` returns
  `LADDER[i].soundsOff`; the two differ. And for every rung *without* a
  `soundsOff`, both settings return the same string. Run it: fails with the
  sounds-on wording returned for `tapSounds: false`.
- **Implement** — `tapSounds ? move.message : (move.soundsOff ?? move.message)`.
- **Green when** — the swap happens exactly where a wording exists for it.
- **Refactor** — none.

#### Step D6 — Presses and solves are not misses

Covers: R6, AC7

- **Test first** — same file: `selectCoaching` is pure and reads only
  `correct === false` — a day of `[NEITHER, EXACT]` gives rung 1, not rung 2;
  calling twice with the same input gives the same message; the input array is
  not mutated (deep-clone comparison). Run it: fails if `EXACT` counts.
- **Implement** — nothing further; `missCount` already filters.
- **Green when** — all three hold. A tap changes no attempt, so a selector that
  reads only attempts cannot see one — Step F7 is the composed proof.
- **Refactor** — none.

#### Step D7 — The coaching cannot read the transport

Covers: R16, AC19

- **Test first** — same file, reading the module from disk with
  `readFileSync(resolve(__dirname, 'coaching.ts'), 'utf8')` (the idiom
  `GuessCard.test.tsx` already uses): assert the source matches none of
  `/isPlaying/`, `/\bplaying\b/`, `/useTransport/`, `/\bposition\b/`,
  `/\bclock\b/`, and that it imports from no `../audio/` path. Run it: passes
  today and fails the moment someone threads the transport in, which is the
  whole point.
  **It deliberately does not freeze `CoachingInput`'s field list.** Epic 2 adds
  fields, and a guard that failed on every addition would fail for a reason
  unrelated to R16 — feature-17's Q7 is what that mistake cost last time.
- **Implement** — nothing.
- **Green when** — the source names no transport symbol.
- **Refactor** — none.

### Track E — The card

#### Step E1 — The card hands the box a move

Covers: R1, R12, AC11

- **Test first** — `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`:
  extend the `props()` factory with `coaching: MOVE` — a new test-local literal
  `const MOVE: Feedback = { message: 'Hum the bass note on beat one.', tone: 'neutral' }`,
  deliberately distinct from `OPENING`, `ROOT_MATCHED` and `SOLVED` so the
  file's several `getByText(OPENING.message)` calls stay unambiguous — and
  `showVerdict: true`, which keeps every pre-existing case that asserts the
  verdict is on screen passing unchanged. Then a new case
  `it('shows the coaching under the verdict in the hint box (R12, AC11)')`:
  the box contains both messages, the verdict first, the coaching
  `data-tone="neutral"`. Run it: fails with `Unable to find an element with the
  text: Hum the bass note on beat one.`
- **Implement** — `GuessCard.tsx`: add `coaching: Feedback` and
  `showVerdict: boolean` to `GuessCardProps` and the destructuring, and pass
  `coaching={coaching}` and `feedback={showVerdict ? feedback : null}` to
  `NudgeBox`. The `{!over && …}` gate and everything else in the file stay put.
- **Green when** — the new case passes and every pre-existing case in the file
  passes with only the factory extended.
- **Refactor** — none.

#### Step E2 — A suppressed verdict leaves the coaching alone

Covers: R12a, AC16

- **Test first** — same file:
  `it('carries the coaching alone when the verdict is suppressed (R12a, AC16)')`
  rendering `props({ showVerdict: false, feedback: ROOT_MATCHED, coaching: MOVE })`:
  `expect(hintBox()).toHaveTextContent(MOVE.message)` and
  `expect(screen.queryByText(ROOT_MATCHED.message)).toBeNull()`. Run it: fails —
  the message is on screen, because today the card passes `feedback` ungated.
- **Implement** — the `showVerdict ? feedback : null` gate.
- **Green when** — the verdict is absent and the move is not.
- **Refactor** — none.

#### Step E3 — The card still has exactly one live region

Covers: R17, AC20

- **Test first** — same file, rewriting *keeps the feedback the card's only live
  region*: with `showNudge: true, eliminated: 2, feedback: ROOT_MATCHED,
  coaching: MOVE`, assert `expect(hintBox()).not.toHaveAttribute('aria-live')`,
  `expect(container.querySelectorAll('[aria-live]')).toHaveLength(1)`,
  `expect(screen.getAllByRole('status')).toHaveLength(1)`, and that the one
  region contains the verdict, the coaching **and** `/2 roots ruled out/` — the
  assertion that replaces the old `not.toHaveTextContent(/ruled out/)`, which
  wave 1 leaves failing. Also rewrite *shows the feedback it is given in a live
  region* (line ~256) to read the verdict off `getByText(OPENING.message)` and
  the region off `getByRole('status')`. Run it: the length assertions pass
  already; the `toHaveTextContent` line is what fails before the rewrite.
- **Implement** — nothing beyond Step E1; the region is `NudgeBox`'s.
- **Green when** — the whole file is green, and wave 1's one known failure is
  closed.
- **Refactor** — none.

#### Step E4 — The box still goes when the day does

Covers: R14, AC12, AC13

- **Test first** — same file: the two pre-existing `it.each(['solved',
  'revealed'])` cases keep `expect(hintQuery()).not.toBeInTheDocument()` and now
  also assert `expect(screen.queryByText(MOVE.message)).toBeNull()` — the
  coaching leaves with the box, not after it. Run them: they pass, and would
  fail against any attempt to render the coaching outside the `{!over && …}`
  gate.
- **Implement** — nothing.
- **Green when** — no box and no move on either ending.
- **Refactor** — none.

#### Step E5 — Nothing else on the card moved

Covers: R14

- **Test first** — the file's remaining ~90 cases pass with only the factory
  change from Step E1. Run the file: green.
- **Implement** — nothing. Named as a step because "the chip rows, the control
  label, the dots, the give-up button and the `♪` are untouched" is a claim this
  epic makes and a diff can break.
- **Green when** — `npx vitest run src/features/daily-groove/components/puzzle/GuessCard.test.tsx`
  is green.
- **Refactor** — none.

### Track F — The page, and the composed behaviour

Every case in this track is a rendered puzzle driven through the harness. The
first three harness facts the writer needs:

- **Pick each guess's root from the chips that are still live.** From the second
  miss, feature-17's narrowing dims two more roots a miss, and a dimmed chip
  declines selection — a hard-coded `'D'` will silently fail to select. The
  file's existing `liveIn(rootGroup())` helper is the way: take the first live
  root that is not `'C'` (the answer) when the case needs a root-wrong miss.
- **`nudge()` still finds the box**, because the live region is an inner div.
- **The page has a second `[aria-live]`** — `ShareGroove`'s empty confirmation
  span in the header. It carries no role, so `getAllByRole('status')` is 1
  document-wide on an open day, but a document-wide `[aria-live]` count is 2.
  Scope AC20's assertion to the box.

#### Step F1 — The page derives the move and the gate

Covers: R7, R16

- **Test first** — `GroovePuzzle.guessing.test.tsx`:
  `it('shows a listening move before anything is pressed (R1, R7, AC1, AC3)')` —
  render, then `expect(nudge()).toContainElement(coachingLine() as HTMLElement)`
  and `expect(move()).toBe(LADDER[0].message)`, importing `LADDER` from
  `../lib/presentation/moves`. Add `hintRegion`, `verdictLine`, `coachingLine`
  and `move` to `testing/puzzleHarness.tsx` per contract C7. Run it: fails to
  compile — `GuessCard` is missing `coaching` and `showVerdict`.
- **Implement** — `GroovePuzzle.tsx`: the two `useMemo`s from contract C7 beside
  the existing `feedback` memo, the two imports, and the two new props on the
  `GuessCard` call. `isPlaying` is not in either dependency list and is not
  passed (R16).
- **Green when** — the case passes and `npx tsc --noEmit` is clean.
- **Refactor** — none.

#### Step F2 — The opening move is the sentence we were losing

Covers: R1, R2, AC1, AC3

- **Test first** — same file: on a fresh render, `expect(nudge()).toHaveTextContent(/feels like rest/i)`,
  `expect(verdictLine()).toBeNull()`, and `expect(nudgeLine()).not.toBeInTheDocument()`.
  Note the existing case *opens with three unspent dots and the opening
  guidance* asserts the same sentence through the old path and keeps passing —
  the line moved slot without moving box. Run it: passes after F1.
- **Implement** — nothing.
- **Green when** — the box opens with the move and no verdict.
- **Refactor** — the existing opening-guidance case keeps its assertion; do not
  delete it.

#### Step F3 — The first miss shows a verdict and a new move

Covers: R3, R12a, AC2, AC15

- **Test first** — same file:
  `it('answers the first miss with a verdict and a different move (R3, R12a, AC2, AC15)')` —
  record `move()` before, `await guess(user, 'G', wrongFlavour())`, then assert
  `expect(screen.getByText(/not it\. keep playing/i)).toBeInTheDocument()`,
  `expect(verdictLine()).not.toBeNull()`,
  `expect(move()).not.toBe(before)` and `expect(move()).toBe(LADDER[1].message)`.
  Run it: fails before F1.
- **Implement** — nothing beyond F1.
- **Green when** — both lines are in the box, verdict above move.
- **Refactor** — none.

#### Step F4 — The second miss advances again

Covers: R3, AC4

- **Test first** — same file: a second miss on a still-live root with a
  different wrong mode; `expect(move()).toBe(LADDER[2].message)` and it differs
  from the rung-1 text. Run it: fails against a ladder that stops after one
  step.
- **Implement** — nothing.
- **Green when** — the third rung is on screen after two misses.
- **Refactor** — none.

#### Step F5 — Past the end, the last move holds

Covers: R4, AC5

- **Test first** — same file: five misses, each on a live root;
  `expect(move()).toBe(LADDER[3].message)` after the fourth and again after the
  fifth, and `expect(giveUp()).toHaveAccessibleName(/give up/i)` — the PRD's
  reasoning for holding is that the exit is already on screen by then. Run it:
  fails with an undefined rung against an unclamped index.
- **Implement** — nothing.
- **Green when** — the tail is flat and the exit is offered.
- **Refactor** — none.

#### Step F6 — The verdict's three composed cases

Covers: R12a, R12b, AC16, AC17, AC18

The epic's most delicate case, and the one that has to be driven through real
chips rather than through a seeded store, because "for the first time" is about
what the rows do.

- **Test first** — same file, one case per row of the PRD's table:
  1. *two neither-misses in a row* — guess a live root ≠ `'C'` with a wrong
     mode, twice. After the second: `expect(verdictLine()).toBeNull()`,
     `expect(screen.queryByText(/not it\. keep playing/i)).toBeNull()`,
     `expect(nudge()).toHaveTextContent(move() as string)` (AC16).
  2. *then a miss that confirms the mode* — guess a live root ≠ `'C'` with
     `'Aeolian'`. Assert
     `expect(screen.getByText(/the mode is right\. but the tonic is somewhere else/i)).toBeInTheDocument()`
     and `expect(verdictLine()).not.toBeNull()` (AC17).
  3. *then a further miss with the mode already confirmed* — the mode row is now
     locked to `'Aeolian'`, so guess another live root with it. Assert
     `expect(verdictLine()).toBeNull()` and that the move is still on screen
     (AC18, R12b).
  Run it: case 1 fails first, with the verdict still rendered.
- **Implement** — nothing beyond F1.
- **Green when** — all three hold in one continuous day.
- **Refactor** — none.

#### Step F7 — A tap is not a guess, and a dimmed chip still sounds

Covers: R6, R11, AC7

- **Test first** — same file: after one miss (so a root is dimmed), record
  `move()`, click a dimmed root chip and a mode chip, and assert `move()` is
  unchanged, `dotStates()` is unchanged, and no new verdict appeared. Run it:
  passes, and fails against any attempt to key the ladder on presses.
- **Implement** — nothing.
- **Green when** — presses move nothing. R11's freedom — that a move may point
  at a ruled-out chip — rests on feature-17's `onPress`-still-fires behaviour,
  which its own cases already assert; this one guards the coaching side.
- **Refactor** — none.

#### Step F8 — A reload finds the same rung

Covers: R7, AC8

- **Test first** — same file: seed `mockStore.get` with a `DailyResult` of two
  misses (`miss('D', wrongFlavour(), false)`, `miss('E', otherWrongFlavour(), false)`),
  render, and assert `expect(move()).toBe(LADDER[2].message)`. Run it: fails
  against any implementation that keeps the rung in component state.
- **Implement** — nothing; the derivation is a function of `attempts`.
- **Green when** — the third rung comes back without a new guess. No
  `localStorage` key was added, and `DailyResult` is unchanged.
- **Refactor** — none.

#### Step F9 — Simple mode does not reset the ladder

Covers: R8, AC9

- **Test first** — same file: two misses, record `move()`, click the simple-mode
  switch, assert `move()` is unchanged; switch back, still unchanged. (The
  narrowing count *does* leave and return across that switch — feature-17's
  behaviour, asserted by its own case in this file, and not this epic's
  business.) Run it: passes, and would fail against a rung derived from the
  visible row.
- **Implement** — nothing.
- **Green when** — attempts carry the position across the switch.
- **Refactor** — none.

#### Step F10 — Silencing the taps rewords the move, with no reload

Covers: R9, R10, AC10

- **Test first** — same file:
  `const i = LADDER.findIndex((m) => m.soundsOff !== undefined)` (non-negative
  by Step A7); miss `i` times on live roots; assert
  `expect(move()).toBe(LADDER[i].message)`; click
  `screen.getByRole('switch', { name: /tap sounds/i })`; assert
  `expect(move()).toBe(LADDER[i].soundsOff)` **in the same render**, with no
  re-render and no store round trip; click it back and assert the first wording
  returns. Run it: fails with the sounds-on wording still on screen.
- **Implement** — nothing beyond `tapSounds` being in the memo's dependency
  list, which Step F1 put there.
- **Green when** — the wording follows the switch.
- **Refactor** — none.

#### Step F11 — The move ignores the transport

Covers: R16, AC19

- **Test first** — same file: one miss, record `move()`, `await play(user)`,
  assert unchanged; click `screen.getByRole('button', { name: 'Stop the loop' })`,
  assert unchanged. The audio harness is already installed in this file's
  `beforeEach`. Run it: passes, and is the behavioural half of Step D7's source
  guard.
- **Implement** — nothing.
- **Green when** — playing and stopping move nothing.
- **Refactor** — none.

#### Step F12 — The box goes when the day ends

Covers: R14, R15, AC12, AC13, AC14

- **Test first** — same file, three cases:
  1. solve after two misses → `expect(nudge()).not.toBeInTheDocument()` (AC12).
  2. give up after three misses → same (AC13).
  3. **solved first guess** — `await guess(user, 'C', 'Aeolian')` on a fresh
     day: `expect(nudge()).not.toBeInTheDocument()`, and no verdict and no
     second rung were ever rendered — assert
     `expect(screen.queryByText(LADDER[1].message)).toBeNull()` and
     `expect(screen.queryByText(/not it\. keep playing/i)).toBeNull()` (R15,
     AC14).
  Run them: the existing solved case already passes; case 3's rung assertion is
  the new one.
- **Implement** — nothing; the `{!over && …}` gate is unchanged.
- **Green when** — all three hold.
- **Refactor** — none.

#### Step F13 — The box reads verdict, then coaching, then count

Covers: R12, R13, AC11

- **Test first** — same file: on the first miss with two eliminations already
  in play (three misses, so the count is present too), assert the three lines'
  document order — verdict, coaching, count — and that the verdict is
  `data-tone="warm"` while the coaching is `data-tone="neutral"`. Run it: fails
  if the coaching is rendered above the verdict.
- **Implement** — nothing.
- **Green when** — reading order matches the PRD's R12.
- **Refactor** — none.

#### Step F14 — One announcement, not three

Covers: R17, AC20

- **Test first** — same file, on a day with a verdict, a move and a count all
  showing:
  `const box = nudge() as HTMLElement`,
  `expect(within(box).getAllByRole('status')).toHaveLength(1)`,
  `expect(box.querySelectorAll('[aria-live]')).toHaveLength(1)`,
  `expect(within(box).getByRole('status')).toHaveTextContent(/not it/i)` and the
  move and `/roots ruled out/`, and
  `expect(box.querySelectorAll('[data-tone][role="status"]')).toHaveLength(0)` —
  the last one is the mutation guard: it fails if `FeedbackLine` ever gets its
  role back. Scope every count to the box; the header's `ShareGroove` span is a
  second `[aria-live]` on the page and is not this epic's. Run it: passes after
  Track C, fails against a restored `role="status"` on the line.
- **Implement** — nothing.
- **Green when** — one region, three lines, one announcement.
- **Refactor** — none.

## Integration and verification

### Track G — the gates

- `npm test` (the app and tooling tiers — no track here touches
  `scripts/grooves/`, so `npm run test:gen` is not this epic's suite),
  `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **The structural guards, named because they are the ones a slip here would
  trip:** `src/features/daily-groove/structure.test.ts` (its `REGIONS` map is
  exhaustive over `components/puzzle/*.tsx`, and this epic adds no component;
  its `lib/` check expects exactly six concern folders, and the three new
  modules all go in the existing `presentation/`),
  `src/components/structure.test.ts`, `src/app/globals.test.ts`,
  `src/app/route-boundary.test.ts`. All four must pass with no edit — this epic
  adds no component, no `lib/` folder, no feature export and no design-system
  change. Any of them going red is a finding.

### The demo path, walked by hand

From the PRD's and the roadmap's validation lists:

1. **The headline.** Load today's puzzle with empty `localStorage`. The Hint box
   is there before anything is pressed, carrying the "sing the note that feels
   like rest" line and no verdict.
2. **The first miss.** Check a wrong pair. The verdict is there — it is what
   teaches the dimming — and *under it* a new listening move, muted rather than
   warm.
3. **The second miss.** Check another wrong pair that confirms neither half. The
   verdict is gone; the box is the move and the narrowing count. Confirm that
   reads as help rather than as something broken.
4. **The confirming miss.** Guess the right mode with a wrong root. The verdict
   is back — "The mode is right. But the tonic is somewhere else." — and the
   mode row has collapsed to one live chip.
5. **And the one after it.** Miss again with the mode still right. No verdict;
   the row already said it.
6. **The ladder runs out.** Keep missing. The move stops changing, and the give
   up button has been there since the third miss.
7. **The taps.** At the rung that names a tap, switch the tap sounds off. The
   wording changes on the spot, with no reload, and no longer asks for a sound
   the player has silenced. Switch back: it returns.
8. **A ruled-out chip.** With the sounds on, tap a dimmed root. It sounds,
   nothing is selected, and the move does not change.
9. **A reload.** Refresh mid-day: the same rung. Come back after dinner: the
   same rung.
10. **Simple mode.** Flip it on mid-day: the same rung, phrased for the full
    board — imperfect, and Epic 2's job.
11. **The ending.** Solve, or give up. The box is gone and the solved panel is
    what speaks.
12. **The transport.** Press play, press stop. Nothing in the box moves.
13. **A screen reader.** With VoiceOver or NVDA, check a wrong pair: verdict,
    coaching and count are announced once, in reading order, not as three
    utterances racing.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C4, D1, F1, F2 |
| R2 | A1, A2, D1, F2 |
| R3 | A1, A3, D2, F3, F4 |
| R4 | A1, A2, D3, F5 |
| R5 | A1, A4, A5, A6, A8 |
| R6 | D6, F7 |
| R7 | D1, F1, F8 |
| R8 | F9 |
| R9 | A1, A7, F10 |
| R10 | A1, A7, D5, F10 |
| R11 | A1, F7 |
| R12 | C3, E1, F13 |
| R12a | B2, B3, B4, B5, E2, F3, F6 |
| R12b | B6, F6 |
| R12c | B7 |
| R13 | C3, D4, F13 |
| R14 | C6, E4, E5, F12 |
| R15 | B8, D1, F12 |
| R16 | D7, F1, F11 |
| R17 | C1, C2, C5, E3, F14 |
| AC1 | D1, F1, F2 |
| AC2 | A3, D2, F3 |
| AC3 | A2, D1, F2 |
| AC4 | A3, D2, F4 |
| AC5 | D3, F5 |
| AC6 | A4, A5 |
| AC7 | D6, F7 |
| AC8 | F8 |
| AC9 | F9 |
| AC10 | A7, D5, F10 |
| AC11 | C3, E1, F13 |
| AC12 | E4, F12 |
| AC13 | E4, F12 |
| AC14 | B8, F12 |
| AC15 | B3, F3 |
| AC16 | B4, C4, E2, F6 |
| AC17 | B5, F6 |
| AC18 | B6, F6 |
| AC19 | D7, F11 |
| AC20 | C1, C2, E3, F14 |

## Assumptions

Lower-stakes technical calls made without asking, so a reviewer can challenge
them.

- **The coaching renders through `FeedbackLine`, not a new component.** It is a
  `Feedback` with tone `neutral`, which is exactly the muted treatment R13 asks
  for and which the PRD's own assumption says is enough. A `CoachingLine.tsx`
  would be a second component doing the same job and would need a row in
  `structure.test.ts`'s `REGIONS` map. If the coaching later needs its own
  layout — an icon, a second sentence — that is when it earns a component.
- **`selectCoaching` takes an options object, not two positional arguments.**
  The PRD's dependency note says "takes the day's attempts and the `tapSounds`
  preference"; Epic 2 widens the input, and a field is a cheaper widening than
  an arity change at every call site and in every test.
- **`LADDER` is a fixed-length tuple of four.** The PRD's behaviour table has
  four rungs and its assumption allows three or four. Four makes rung 3 land on
  the miss the give-up button appears on, which is the PRD's own reasoning for
  holding there. Reversing to three is a one-line type change and Step A2's
  length assertion.
- **The verdict gate is a new module, not a branch in `feedback.ts`.**
  `feedback.ts` says what the verdict *is*; `verdict.ts` says whether this miss
  gets one, which is a reading of the whole attempt list rather than of the last
  attempt. It also keeps `feedback.ts`'s diff at one word, which matters because
  Epic 2 rebases on that file.
- **`missCount` is exported rather than reimplemented.** Three private
  definitions of "a miss" in one folder is how a feature ends up with three
  answers. The export costs one word and no behaviour.
- **The live region is an inner `div`, not the `aside`.** `role="status"` on the
  `aside` would override its `complementary` role and break the harness's
  `nudge()` and every `queryByRole('complementary', { name: 'Hint' })` in the
  suite. The eyebrow stays outside it so "Hint" is not re-announced on every
  miss.
- **`coaching` is nullable on `NudgeBox` and required on `GuessCard`.** The box
  keeps its "renders nothing when it has nothing" contract, which four existing
  cases assert; the card only renders the box on an open day, where
  `selectCoaching`'s totality means there is always a move.
- **The root guard is case-sensitive and the mode guard is not.** The asymmetry
  is deliberate: a case-insensitive root guard rejects the English article, and
  a case-sensitive mode guard lets "a major scale" through in a game whose
  simple mode offers `Major` as an answer. The cost is that no move may open a
  sentence with a bare "A" or "B", which Step A4 will say plainly when it fires.
- **Step A8's catalogue guards are regression tests on the copy's claims, and
  may fail when a groove is added.** That is the intent — a move that says
  "listen for what changes in bar three" is a promise about every groove the app
  can serve, and the failure names the groove that broke it.
- **`GroovePuzzle.sounding.test.tsx` and `.page.test.tsx` need no edit.**
  `sounding`'s seven guesses assert chord symbols and captions; `page`'s two
  feedback assertions are both on a first miss, which still carries its verdict,
  and its one `[aria-live]` count is scoped to a solved day's card, where no box
  renders. If either goes red it is a finding for Track G.
- **No step in this spec adds an explanatory comment.** `AGENTS.md` forbids
  prose in comments; every "why" that would have been one is in the Architecture
  and Contracts sections above, or in a test name.

## Decision log

### Cycle 1 — 2026-09-02

**Q1. Where does "for the first time" get computed?**
Decision: **a new `lib/presentation/verdict.ts`, folding over all the misses.**
The obvious implementation — `matchedHalf(last) !== 'neither'` — is wrong in a
way that only shows up on a long day: once a half is confirmed, feature-17 locks
that row to one live chip, so every later attempt matches on it and would carry
a verdict. The predicate therefore reads the earlier misses, and Step B6's sweep
is what proves it. Putting it in `feedback.ts` would have grown the file Epic 2
rebases onto; putting it in `confirmed.ts` would have mixed a *whether* into a
*which*.
Changed: contract C3, Track B in full, Steps E2, F6.

**Q2. How does the box become one live region without losing its landmark?**
Decision: **an inner `<div role="status" aria-live="polite">`, with
`FeedbackLine` losing both attributes.** `role="status"` on the `aside` would
override `complementary` and break `nudge()` and every landmark query in the
suite; `aria-live` alone on the `aside` would leave no `role="status"` for the
guard that feature-17's QA found to be load-bearing. Removing only one of
`FeedbackLine`'s two attributes leaves a live region either way.
Changed: contracts C4 and C5, Track C in full, Steps E3, F14.

**Q3. Who writes the moves, and against what guards?**
Decision: **a `musician` track, two dispatches, with R5 and R10 as mechanical
tests over `LADDER`.** The moves are claims about what is audible at 67–130 bpm
in four-bar loops, not copy choices. The guards are split — case-sensitive for
roots, case-insensitive for modes and families — and the second one bites the
briefing's own "compare the third against a major scale", which the musician has
to reword because `Major` is an option on the board in simple mode.
Changed: contract C1, Track A in full, the "two rules made mechanical" and "what
the catalogue supports" sections.

**Q4. How are the tracks split so no two edit one file?**
Decision: **six build tracks over disjoint paths in three waves, with the two
components R17 spans kept in one track.** `NudgeBox` and `FeedbackLine` are one
change and go together; `feedback.ts` is edited in wave 1 and only read in wave
2; `GuessCard.tsx` and `GroovePuzzle.tsx` each have exactly one owner and sit in
different waves. Feature-16's roadmap claimed three disjoint epics that all
ended up in `GroovePuzzle.tsx`; the two known-red points between waves are named
in the scheduling facts rather than discovered.
Changed: Tracks, Execution waves, Steps E1, E3, F1.

**Q5. Does the card gate the verdict, or does the page pass `null`?**
Decision: **the page derives `showVerdict`, the card gates on it, and `feedback`
stays a required `Feedback`.** It matches the `showNudge` / `eliminated` pair the
file already uses, and it keeps `GuessCard.test.tsx`'s ~90 pre-existing cases
passing with one factory line rather than a nullable prop threaded through every
override.
Changed: contracts C6 and C7, Steps E1, E2, F1.

## Readiness

No architectural decision is left open, so there is no Open questions section.
The PRD is settled and its Q1–Q3 are folded into contracts C1, C2 and C4; the
three inputs the epic touches — `attempts`, `tapSounds`, and nothing else — are
frozen in contract C2; and the one place a requirement is stronger than its
obvious implementation (R12b's "for the first time") is specified as a fold over
the whole attempt list with a sweep behind it.

**The two least certain parts, stated plainly.** First, the exact wordings do
not exist yet: Step A1 is a decision step, and if the musician cannot write a
third-comparison move without the word "major", the honest options are to reword
the move or to relax the guard to the mode pool only — the second is a change to
AC6 and belongs back in the PRD, not here. Second, Step A8's catalogue guards
are a judgement call: they will fail one day on a groove nobody has generated
yet, and a reviewer who thinks copy should not be coupled to the catalogue
should say so now rather than delete the test later.

The spec is ready to execute.
