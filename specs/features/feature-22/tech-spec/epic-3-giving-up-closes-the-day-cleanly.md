# Tech spec — Epic 3: Giving up closes the day cleanly

PRD: [../prd/epic-3-giving-up-closes-the-day-cleanly.md](../prd/epic-3-giving-up-closes-the-day-cleanly.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two one-line behaviour changes and one snippet swap. The Check button's label
is decided in one place, `guessCardView` in `lib/presentation/index.ts`, whose
label chain today goes `solved → selection cases`; a `revealed` branch goes in
second, yielding a new `coaching.checkRevealed` snippet. Tone and enablement
already do the right thing on a revealed day (`enabled` is `false`, so the tone
falls to `'idle'`), so they are pinned by test, not changed. The answer panel
loses its `{revealed && <Text>{solved.givenUp}</Text>}` block, and the snippet
behind it is deleted from `en/solved.ts` and `SolvedSnippets` rather than left
orphaned.

The one ordering constraint is the snippet retirement. `solved.givenUp` is read
by `SolvedPanel.tsx` and by two page tests; deleting it before those consumers
are gone turns files nobody owns red. So the additive snippet (`checkRevealed`)
lands in wave 1 with the label chain, and the removal lands in wave 2, together
with the composed-page proofs that need both wave-1 tracks. Three tracks, two
waves, no new files, no door change, the composer untouched.

## Architecture

```
guessCardView(input).check
  label: solved   → coaching.checkSolved        (unchanged, still first)
         revealed → coaching.checkRevealed      (new, second)
         both     → coaching.checkPair(...)     (unchanged)
         root     → coaching.pickMode
         mode     → coaching.pickRoot
         none     → coaching.pickRootAndMode
  tone:  solved ? 'solved' : enabled ? 'ready' : 'idle'   (unchanged)
  enabled: canCheck && bothOffered && !revealed           (unchanged)

SolvedPanel header (revealed or not)
  <Heading>{root} {flavour}</Heading>
  {modeLine ?? nothing}
  {nearMiss ?? nothing}          ← the given-up <Text> between them is gone
```

- `GuessCard.tsx` renders `view.check.label` / `view.check.tone` as today; no
  edit. The shared-groove route renders the same card through the same view
  model, so R6 costs nothing.
- `SolvedPanel` keeps its `revealed` prop: `selectNearMiss(attempts, answer,
  revealed)` still needs it.
- `testing/puzzleHarness.tsx`'s `CONTROL_NAMES` set is how every page test
  finds the Check button by name; it gains `coaching.checkRevealed`, or
  `control()` throws the moment a test gives up.
- `specs/features.md` loses its `## Bugs` section; the briefing owns the two
  bullets.

## Contracts

Frozen before wave 1. Wave 2 removes one key, and no wave-1 track may read it.

```ts
// src/lib/snippets/types.ts
export type CoachingSnippets = {
  // …existing keys unchanged…
  checkSolved: string
  checkRevealed: string          // NEW — directly after checkSolved
  checkPair: (args: { root: string; flavour: string }) => string
  pickMode: string
  pickRoot: string
  pickRootAndMode: string
}

export type SolvedSnippets = {
  // givenUp: string             // REMOVED in wave 2 (Track C)
  changes: string
  notesToLiveIn: string
  modeLine: (args: { flavour: string }) => string | undefined
}
```

```ts
// src/lib/snippets/en/coaching.ts — the only wording this epic adds
checkSolved: 'Solved',
checkRevealed: 'Revealed',
```

```ts
// src/features/daily-groove/lib/presentation/index.ts — CheckView is unchanged
type CheckView = { label: string; tone: 'idle' | 'ready' | 'solved'; enabled: boolean }
// guessCardView({ revealed: true, solved: false, ...any selection })
//   → check: { label: coaching.checkRevealed, tone: 'idle', enabled: false }
// guessCardView({ solved: true, revealed: true }) → label: coaching.checkSolved
```

```ts
// src/features/daily-groove/testing/puzzleHarness.tsx
const CONTROL_NAMES = new Set<string>([
  coaching.checkSolved,
  coaching.checkRevealed,        // NEW
  coaching.pickRoot, coaching.pickMode, coaching.pickRootAndMode,
  ...checkPair for every root × flavour
])
```

## Tracks

### Track A — Revealed on the button

- **Goal** — a revealed day's Check button reads *Revealed*, idle-toned,
  disabled, whatever is selected; the harness and the card's tests know the
  label.
- **Owns** —
  `src/lib/snippets/types.ts` (the `CoachingSnippets` addition only),
  `src/lib/snippets/en/coaching.ts`,
  `src/features/daily-groove/lib/presentation/index.ts`,
  `src/features/daily-groove/lib/presentation/index.test.ts`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`,
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`
- **Role** — `implementer`
- **Depends on** — the `CoachingSnippets` contract only
- **Parallel with** — Track B
- **Done when** — `index.test.ts` and `GuessCard.test.tsx` pass with the new
  assertions, and `npm test` is green without B or C existing.

### Track B — The panel is the answer

- **Goal** — the answer panel on a revealed day is root + mode, the mode line
  and the near-miss line, nothing else; the Bugs section is out of the index.
- **Owns** —
  `src/features/daily-groove/components/solved/SolvedPanel.tsx`,
  `src/features/daily-groove/components/solved/SolvedPanel.test.tsx`,
  `specs/features.md`
- **Role** — `implementer`
- **Depends on** — nothing. It stops *reading* `solved.givenUp`; it does not
  delete it.
- **Parallel with** — Track A
- **Done when** — `SolvedPanel.test.tsx` passes with the flipped assertions,
  `grep -c '^## Bugs' specs/features.md` prints `0`, `npm test` green without
  A or C.

### Track C — Retire the snippet and prove the page

- **Goal** — `solved.givenUp` no longer exists anywhere; the composed page
  proves the give-up ending on the daily route, on reload, and on the
  shared-groove route.
- **Owns** —
  `src/lib/snippets/en/solved.ts`,
  `src/lib/snippets/types.ts` (the `SolvedSnippets` removal only),
  `src/lib/snippets/snippets.test.ts`,
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`
- **Role** — `implementer`
- **Depends on** — Track A (`checkRevealed` exists; `CONTROL_NAMES` knows it)
  and Track B (`SolvedPanel.tsx` no longer reads `solved.givenUp`).
- **Parallel with** — nothing; it is wave 2 alone.
- **Done when** — `snippets.test.ts` and `GroovePuzzle.guessing.test.tsx`
  pass, `npm test` green, and `grep -rn givenUp src` prints nothing.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C — needs A's snippet and harness entry, and B's
  `SolvedPanel.tsx` no longer importing the key it deletes
- **Wave 3:** Integration — full suite, the demo path, the Epic 2 merge check
  below

## Implementation

### Track A — Revealed on the button

#### Step A1 — `guessCardView` labels a revealed day "Revealed", below solved, above the selection cases

Covers: R1, R3, R5, R7, AC1, AC4

- **Test first** —
  `src/features/daily-groove/lib/presentation/index.test.ts`, in
  `describe('the check button’s label and tone')`. Add three rows to the label
  `it.each` (the one titled `asks for the half that is missing with %s`):
  - `['a revealed day, nothing chosen', { attempts: misses(3), revealed: true }, coaching.checkRevealed]`
  - `['a revealed day, a root chosen', { attempts: misses(3), revealed: true, selectedRoot: 'G' }, coaching.checkRevealed]`
  - `['a revealed day, both chosen', { attempts: misses(3), revealed: true, selectedRoot: 'G', selectedFlavour: WRONG_FLAVOURS[0], canCheck: true }, coaching.checkRevealed]`

  Add one row to the tone `it.each`:
  `['idle on a revealed day with nothing chosen', { attempts: misses(3), revealed: true }, 'idle']`.

  Add one `it('keeps Solved above Revealed in the chain (F22 E3 R5, AC4)')`:
  `expect(guessCardView(input({ solved: true, revealed: true })).check.label).toBe(coaching.checkSolved)`.

  Run `npm test`: the three label rows fail with
  `expected 'Pick a root and a mode' to be undefined`,
  `expected 'Pick a mode' to be undefined`,
  `expected 'Check G <flavour>' to be undefined` — `coaching.checkRevealed` is
  not yet a key. (The type checker rejects the same line: `Property
  'checkRevealed' does not exist on type …`.) The tone row and the precedence
  test are green already; they pin R3 and R5.
- **Implement** —
  - `src/lib/snippets/types.ts`: `checkRevealed: string` on
    `CoachingSnippets`, directly after `checkSolved`.
  - `src/lib/snippets/en/coaching.ts`: `checkRevealed: 'Revealed',` directly
    after `checkSolved: 'Solved',`.
  - `src/features/daily-groove/lib/presentation/index.ts`: the `label`
    conditional becomes
    `solved ? coaching.checkSolved : revealed ? coaching.checkRevealed : bothOffered ? … `
    — the rest of the chain unchanged. `tone` and `enabled` untouched.
- **Green when** — all rows pass; the `door` structure tests in the same file
  (runtime exports, no re-exports) stay green since nothing new is exported.
- **Refactor** — none.

#### Step A2 — the harness finds the button under its new name

Covers: AC1, AC2, AC5 (scaffolding every page-level proof stands on)

- **Test first** — no new test: after A1, `npm test` shows the red. In
  `GroovePuzzle.guessing.test.tsx`, `offers the way out only from the third
  miss…` and `reopens a revealed day on the terminal state…` fail at
  `control()` with `Unable to find an accessible element with the role
  "button"` — the button's name is now `Revealed` and `CONTROL_NAMES` does not
  hold it. `GuessCard.test.tsx` `goes inert once the day is revealed` fails
  the same way at its `control()` call.
- **Implement** — `src/features/daily-groove/testing/puzzleHarness.tsx`: add
  `coaching.checkRevealed,` to `CONTROL_NAMES` after `coaching.checkSolved`.
- **Green when** — those tests reach their next assertion (which A3 flips).
- **Refactor** — none.

#### Step A3 — the composed card reads Revealed, idle, disabled, with a root chosen before the give-up

Covers: R1, R3, AC1, AC4

- **Test first** —
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`:
  - `goes inert once the day is revealed (R7, AC8a)`: the assertion
    `expect(control()).toHaveAccessibleName(coaching.pickRootAndMode)` becomes
    `…(coaching.checkRevealed)`. Before A1: `Expected the element to have
    accessible name: Revealed · Received: Pick a root and a mode`. After A1,
    before this flip: the inverse message.
  - `leaves the check control disabled on a revealed day even if a check would
    be legal (R7, AC8a)`: `toHaveAccessibleName(coaching.checkPair({ root: 'C',
    flavour: 'Aeolian' }))` becomes `toHaveAccessibleName(coaching.checkRevealed)`.
    Red the same way, with `Check C Aeolian`.
  - New `it('closes a revealed day on the idle tone, not the solved one, with a
    root chosen first (F22 E3 R1, R3, AC1)')`: `await openDay({ attempts:
    threeMisses() })`; `await user.click(rootChip('G'))`; `await
    user.click(giveUp())`; `await user.click(confirm())`; then
    `expect(control()).toHaveAccessibleName(coaching.checkRevealed)`,
    `expect(control()).toBeDisabled()`,
    `expect(control().className).toContain('bg-surface-inset')`,
    `expect(control().className).not.toContain('bg-accent-soft')`.
    Red before A1: `Expected … Revealed · Received: Pick a mode`.
  - Leave `gives the control its solved treatment once the day is solved
    (R12)` and `keeps the waiting, live and solved states apart at the larger
    size (R17, AC15)` untouched — they are AC4's guard. Do not add a revealed
    state to the latter: its `Set` size assertion counts distinct classes, and
    revealed shares the idle class with waiting by design.
- **Implement** — none; A1 and A2 turn these green.
- **Green when** — the file passes; the two tone tests above still pass.
- **Refactor** — none.

### Track B — The panel is the answer

#### Step B1 — no "given up" and no "day is over" in the panel; the mode line stays

Covers: R4, R5, AC3, AC4

- **Test first** —
  `src/features/daily-groove/components/solved/SolvedPanel.test.tsx`:
  - `gives a day given up on the same line (F15 E1 R7, R7a, AC3)` → rename
    `keeps a given-up day’s header to the answer and its line (F22 E3 R4, AC3)`.
    Keep `expect(within(header()).getByText(/♭7/)).toBeInTheDocument()`;
    replace `expect(screen.getByText(solved.givenUp)).toBeInTheDocument()` with
    `expect(header().textContent).not.toMatch(/given up/i)` and
    `expect(header().textContent).not.toMatch(/day is over/i)`.
    Red: `expected 'C Mixolydianmajor with a ♭7given up · the day is over' not
    to match /given up/i`.
  - `names the day as given up instead (R10, AC10)` → rename `names nothing but
    the answer on a revealed day (F22 E3 R4, AC3)`; body:
    `renderPanel({ revealed: true })`;
    `expect(screen.getByRole('status').textContent).not.toMatch(/given up/i)`;
    `…not.toMatch(/day is over/i)`. Red as above, with `G Dorian…`.
  - `draws the given-up line in the existing muted inverted tone, adding no
    token (R10)`: delete. Its subject no longer exists (PRD Assumptions).
  - `carries neither the attempt count nor the streak (F15 E1 R5, R5a, R5b,
    AC2)`: `expect(screen.queryByText(solved.givenUp)).toBeNull()` becomes
    `expect(panel.textContent).not.toMatch(/given up/i)`. Stays green; keeps
    its subject and stops reading the key C deletes.
  - New `it('renders a revealed day with no mode line as the bare answer (F22
    E3 R4, AC3)')`: `renderPanel({ answer: { root: 'C', flavour: 'Locrian' },
    revealed: true })`; `expect(header().textContent).toBe('C Locrian')`.
    Red: `expected 'C Locriangiven up · the day is over' to be 'C Locrian'`.
  - Untouched: every solved-day test, and `never scolds the day given up on…
    (F17 E3 R13, R14, AC13)`, which already asserts the near-miss line carries
    no "given up".
- **Implement** —
  `src/features/daily-groove/components/solved/SolvedPanel.tsx`: delete the
  `{revealed && (<Text size="sm" tone="inverted-muted">{solved.givenUp}</Text>)}`
  block inside the header `Row`. Keep the `revealed` prop (fed to
  `selectNearMiss`) and the `solved` import (`modeLine`, `changes`,
  `notesToLiveIn`).
- **Green when** — the file passes; `solved.givenUp` is read by no production
  file (`grep -rn givenUp src --include=*.tsx` shows only test files, and after
  this step only `GroovePuzzle.guessing.test.tsx`).
- **Refactor** — none.

#### Step B2 — the Bugs section leaves `specs/features.md`

Covers: R8, AC7

- **Test first** — there is no test file for the specs index. The check:
  `grep -c '^## Bugs' specs/features.md` prints `1` today. This is the one step
  in the epic whose done-condition is a grep rather than a test; the verifier
  runs it.
- **Implement** — `specs/features.md`: delete the `## Bugs` heading, its two
  bullets and the blank line after them (lines 42–45 today), so the features
  table is followed by one blank line and `## Prepared candidates`. Nothing
  else in the file changes; `briefing.md` already carries both bullets.
- **Green when** — the grep prints `0`, and `grep -c 'Prepared candidates'
  specs/features.md` still prints `1`.
- **Refactor** — none.

### Track C — Retire the snippet and prove the page

#### Step C1 — `solved.givenUp` is gone and `coaching.checkRevealed` exists, by the snippets test

Covers: R7, AC6

- **Test first** — `src/lib/snippets/snippets.test.ts`, new
  `describe('the give-up ending (F22 E3)')`:
  - `it('labels the revealed button from coaching, beside the solved label')`:
    `expect(typeof snippets.coaching.checkRevealed).toBe('string')`;
    `expect(snippets.coaching.checkRevealed).not.toBe('')`. Green already
    (A1); it is AC6's positive half.
  - `it('no longer carries the given-up line')`:
    `expect(snippets.solved).not.toHaveProperty('givenUp')`. Red:
    `expected { givenUp: 'given up · the day is over', … } to not have
    property "givenUp"`.
- **Implement** —
  - `src/lib/snippets/en/solved.ts`: delete `givenUp: 'given up · the day is
    over',`.
  - `src/lib/snippets/types.ts`: delete `givenUp: string` from `SolvedSnippets`.
- **Green when** — the snippets test passes. `npm test` now shows exactly two
  new reds, both in `GroovePuzzle.guessing.test.tsx` at
  `within(panel).getByText(solved.givenUp)`: `Unable to find an element with
  the text: undefined`. That is C2's red.
- **Refactor** — none.

#### Step C2 — the composed page: give up → Revealed; reload → Revealed; shared → Revealed; panel clean

Covers: R1, R2, R4, R6, AC1, AC2, AC3, AC5

- **Test first** —
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`:
  - `offers the way out only from the third miss, and ends the day on the
    second press (F7 E3 R6, R7, R8, AC6, AC8a)`: replace
    `expect(within(panel).getByText(solved.givenUp)).toBeInTheDocument()` with
    `expect(panel.textContent).not.toMatch(/given up/i)` and
    `expect(panel.textContent).not.toMatch(/day is over/i)`; after
    `expect(control()).toBeDisabled()` add
    `expect(control()).toHaveAccessibleName(coaching.checkRevealed)` and
    `expect(control().className).not.toContain('bg-accent-soft')`. Append
    `F22 E3 R1, R4, AC1, AC3` to the title.
    Red before this edit (after C1): `Unable to find an element with the text:
    undefined`.
  - `reopens a revealed day on the terminal state, not a fresh puzzle (F7 E3
    R8, AC9)`: same replacement of the `solved.givenUp` line; after
    `expect(control()).toBeDisabled()` add
    `expect(control()).toHaveAccessibleName(coaching.checkRevealed)`. Append
    `F22 E3 R2, AC2`. This test seeds `mockStore.get` with a stored result,
    `revealed: true` — AC2's exact premise. Red as above.
  - `shows the same invitation, worded the same way, when it is given up on
    (R5b, AC14)` in `describe('the framing on a shared groove (F12 E3)')`:
    after `expect(solutionPanel()).toBeInTheDocument()` add
    `expect(control()).toHaveAccessibleName(coaching.checkRevealed)` and
    `expect(control()).toBeDisabled()`. Append `F22 E3 R6, AC5`.
  - The three `checkRevealed` assertions are green on first run at wave 2;
    their red lives in wave 1 (A2, A3). They are here because AC2 and AC5 are
    page-level claims — a stored result hydrating through the real session
    hook, and the `mode="shared"` composition — which `GuessCard.test.tsx`
    cannot make.
- **Implement** — none.
- **Green when** — the file passes; `grep -rn givenUp src` prints nothing.
- **Refactor** — none.

## Integration and verification

- **Wave 3, full suite** — `npm test` green. The structural tests that could
  notice this epic and must not: `lib/presentation/index.test.ts`'s door
  checks (no new export), `src/features/daily-groove/structure.test.ts` (no
  new import into `lib/presentation/` from the composer),
  `src/lib/snippets/snippets.test.ts`'s area list (no new area file).
- **Demo path** — open the page, guess wrong three times, press *Give up and
  show the answer*, press it again to confirm. The Check button reads
  *Revealed*, grey, disabled; the panel header is the root and mode, the mode
  line, and a *You said …* line. Reload: identical. Open a `/groove/<uuid>`
  link and repeat: identical button.
- **Solved day unchanged** — guess right: *Solved*, green, panel as today.
- **Epic 2 shares three files with Track A.** `src/lib/snippets/en/coaching.ts`
  (Epic 2 rewrites `opening`/ladder rung one; Track A adds one key after
  `checkSolved`), `src/lib/snippets/types.ts` (Epic 2 edits `PuzzleSnippets`
  and `IntroSnippets`; Track A adds one line in `CoachingSnippets`, Track C
  removes one in `SolvedSnippets`), and
  `src/features/daily-groove/testing/puzzleHarness.tsx` (Epic 2 removes the
  `CAPTION` / `CAPTION_SOUNDS_OFF` exports when `captionSoundsOn/Off` go;
  Track A adds one entry to `CONTROL_NAMES`). The edits are in disjoint
  regions, so a merge is mechanical — but `/implement-feature` should not run
  Epic 3 Track A concurrently with the Epic 2 unit that owns those files. Run
  Track A after that unit lands, or before it starts. Track B and C touch
  nothing Epic 2 names.
- **Epic 1** shares nothing with this epic.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A3, C2 |
| R2 | C2 |
| R3 | A1, A3 |
| R4 | B1, C2 |
| R5 | A1, A3 (existing solved tests kept), B1 (solved cases untouched) |
| R6 | C2 |
| R7 | A1, C1 |
| R8 | B2 |
| AC1 | A1, A3, C2 |
| AC2 | C2 |
| AC3 | B1, C2 |
| AC4 | A1, A3, B1 |
| AC5 | C2 |
| AC6 | C1 |
| AC7 | B2 |

## Assumptions

- `checkRevealed` lives in `coaching`, beside `checkSolved`, because that is
  where every other Check-button label lives (R7 says so too); a `puzzle` home
  would split the button's vocabulary across two areas.
- `SolvedPanel` keeps its `revealed` prop. The near-miss selector needs it, and
  the PRD rules the near-miss line out of scope.
- The `solved && revealed` precedence is pinned by a test even though
  `usePuzzleSession` never produces both flags at once — the PRD names the
  order, and a one-line test is cheaper than the argument.
- The deleted SolvedPanel tone test (`on-accent/75`) is not relocated: with the
  line gone there is no element to carry the token, and the PRD's Assumptions
  say the tone assertion goes with it.
- Absence checks in component tests use `/given up/i` and `/day is over/i`
  regexes, as AC3 words them. The copied-sentence lint block does not cover
  `components/`, and there is no snippet left to import for a sentence that no
  longer exists.
- `GuessCard.test.tsx`'s `keeps the waiting, live and solved states apart`
  test is not extended with a revealed state: it counts distinct class strings
  and revealed intentionally shares the idle class. The idle-tone claim is made
  by A3's new test instead.
- Test titles gain the `(F22 E3 R…, AC…)` tag the repo uses; renamed tests keep
  their old tag alongside so the history stays traceable.
- Step B2's done-condition is a grep, not a test. No structural test reads
  `specs/features.md`, and adding one for a one-off deletion would be scope the
  PRD did not ask for.

## Decision log

### Cycle 1 — 2026-09-03

**D1. When does `solved.givenUp` get deleted?**
Decision: **wave 2, in its own track (C)**. `SolvedPanel.tsx` and two page
tests read the key; deleting it in wave 1 would turn files owned by another
track red. `types.ts` is also edited by Track A in wave 1 (the `CoachingSnippets`
addition), so the `SolvedSnippets` removal could not share a wave with A
without two tracks owning one file. Cost: a second wave for a three-line
deletion.
Changed: Tracks (C exists), Execution waves, Contracts (the REMOVED annotation).

**D2. Where do the composed-page proofs live?**
Decision: **in Track C with the snippet removal, not in a wave-1 test-writer
track.** `GroovePuzzle.guessing.test.tsx` holds the two `solved.givenUp` reads
that C1's deletion turns red, so the file's real dependency is on C1; and a
wave-1 track whose done-condition is "red until A and B land" is not a track.
Cost: three `checkRevealed` assertions in C2 are green on first run, with their
red carried by A2 and A3 in wave 1 — noted in the step rather than hidden.
Changed: Track C's file list, Step C2.

**D3. Does the tone change?**
Decision: **no code.** The PRD's Q1 settled the idle tone; the existing chain
already produces it (`enabled` is `false` when revealed, so the tone falls to
`'idle'`). A1 and A3 pin it with tests instead of touching the expression.
Changed: nothing in the Contracts beyond the comment that tone is unchanged.

No open questions. Every decision here is a one-line reversal.
