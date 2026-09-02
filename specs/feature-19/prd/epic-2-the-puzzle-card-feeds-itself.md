# PRD — Epic 2: The puzzle card feeds itself

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`GroovePuzzle.tsx` computes thirteen derived values and posts them down to
`GuessCard` as props, which is why every coaching feature ends up editing the one
file that everything else also edits. This epic puts the coaching modules behind
one door, has `GuessCard` read the puzzle session itself and open that door with
what it reads, and leaves `GroovePuzzle` composing rather than calculating. The
puzzle plays, scores, nudges, locks and solves exactly as it does today.

## Problem

`GroovePuzzle.tsx` is where features go to collide: 9 of the last 40 commits, 395
lines, 40 imports — 23 of them reaching sideways into its own `lib/`, `data/` and
`hooks/` — and a `GuessCard` call site passing **28 props**.

Thirteen of those 28 are derived — `feedback`, `coaching`, `showVerdict`,
`showNudge`, `dots`, `ruledOutRoots`, `ruledOutFlavours`, `confirmedRoots`,
`confirmedFlavours`, `eliminated`, `showReveal`, `roots`, `flavours`. Every one is
a pure function of attempts, answer, date and the two settings. Every one is
`useMemo`'d in the parent and handed down. Three more — the offered root, the
offered flavour and `canCheck` as offered — are derived in the parent without a
`useMemo` and passed under the names of the plain selection.

`GuessCard` then derives more of its own: the button's label and tone, whether
both halves are chosen, whether the day is over, and — in `optionStatesFor` — the
merge of ruled-out and confirmed into per-chip states. So the calculation is
split across two files, and the seam between them is a prop list.

Feature-14 lifted `usePuzzleSession` and `useTransport` out of this file and got
it to 274 lines. It is back at 395. More hooks is not the fix: the hooks moved
*lifetime* out and left *derivation* in.

`lib/presentation/` is eleven modules and five of them arrived with feature-18
alone. That is the growth rate the door has to absorb.

## Scope

- one entry point into the coaching modules, returning the guess card's whole
  view model
- `GuessCard` reads the puzzle session through a hook and calls the entry point
  itself, rather than receiving either as props
- `GroovePuzzle` stops computing what it does not render
- the assertions about *what the coaching says* move to the module that decides it

**Out of scope**
- **any change to what the coaching says.** Feature-18 is choosing those words
  right now. This epic moves where they are computed and nothing else
- the audio, puzzle, persistence and theory modules — Epic 3 gives them entry
  points
- removing `GroovePuzzle`'s remaining sideways imports — Epic 3
- splitting `GuessCard.tsx` itself. It sheds props and test lines here; if it is
  still too big afterwards that is a finding, not this epic's job
- `date` and `staffLabel`. They live in `lib/presentation/` but are not coaching
  and do not go behind this door
- the audio hooks. `onHearRoot` and `onHearMode` need the transport clock the
  shell owns, so the card keeps receiving them
- a second `features/` slice

## Requirements

- **R1** — `src/features/daily-groove/lib/presentation/` exposes one entry point
  that takes the puzzle's state and returns the guess card's complete view model.
- **R2** — It is a pure function, not a hook. Same inputs, same output, no React,
  no clock, no storage — so it is tested as a plain function per
  `docs/testing.md`.
- **R2a** — Its inputs are the session and the settings, and nothing the card
  cannot read: attempts, answer, date, the groove (the flavour pool is drawn from
  it), the two settings, the stored selection, `solved`, `revealed` and
  `canCheck`.
- **R3** — The view model covers every derived value the card renders: the two
  option lists and their per-option states, the offered selection (a stored
  selection absent from the current option list shows as none), whether check is
  enabled, the attempt dots, the nudge box's contents and whether it shows, the
  check button's label and tone, and whether the give-up path is offered.
- **R3a** — The merge of ruled-out and confirmed into per-option state moves out
  of `GuessCard.optionStatesFor` and into the view model. Four props —
  `ruledOutRoots`, `ruledOutFlavours`, `confirmedRoots`, `confirmedFlavours` —
  become the two option lists the card actually renders, each option carrying its
  state.
- **R3b** — The per-option state is domain-shaped and belongs to
  `lib/presentation/`. `GuessCard` maps it to the design system's
  `ChipOptionState` in one small function of its own. `lib/presentation/` imports
  nothing from `@/components/`, so a change to `ChipGroup`'s props is a
  component-level change and never reaches the coaching module.
- **R3c** — The check button's label and tone are part of the view model. They
  are derived from selection and solved state, which is the same derivation as
  everything else on the card, and leaving them behind would mean the seam runs
  through the middle of one concern.
- **R4** — `GuessCard` calls the entry point itself. It does not receive the view
  model as a prop. A boundary only the parent may cross is not a boundary.
- **R4a** — `GuessCard` reads the puzzle session through a hook it calls: the
  stored selection, attempts, `solved`, `revealed`, `canCheck`, the answer, the
  actions that mutate them (`selectRoot`, `selectFlavour`, `check`, `reveal`),
  and the two settings with their setters. None of these arrive as props. How a
  second component reaches the session that `usePuzzleSession` owns is the open
  question this cycle asks.
- **R5** — `GuessCard`'s remaining props are the ones it genuinely cannot own:
  `onHearRoot` and `onHearMode`, which play through the transport clock the
  shell holds. The thirteen derived props, the three offered values, the
  selection, the store actions and the settings toggles are all gone from the
  prop list.
- **R6** — `GroovePuzzle.tsx` no longer imports `feedback`, `coaching`,
  `verdict`, `confirmed` or `ruledOut`, no longer holds a `useMemo` for any value
  only `GuessCard` renders, and no longer computes the offered selection.
- **R7** — Nothing the player can observe changes. Every rendered string, every
  chip state, every dot, every enable and disable, in the same conditions as
  today.
- **R8** — No assertion is deleted, weakened or skipped. The case count across
  `GuessCard.test.tsx` and the entry point's test file together is the same or
  higher than `GuessCard.test.tsx`'s 115 today, and every assertion still proves
  what it proved.
- **R9** — A relocated assertion keeps its subject. Cases about what the coaching
  *says* — the nudge text, the feedback line, the verdict — move to the entry
  point's own test as pure-function assertions; that is a move, because the text
  has always been a fact about the module. Cases about rendering, interaction and
  chip state stay rendered: rewriting one of those as a pure-function call is a
  different assertion wearing the old one's name.
- **R10** — `GuessCard`'s own tests still drive it through rendering and user
  action, not by asserting on the view model it happens to call. How they stand
  up the session the card now reads is the second open question this cycle asks.
- **R11** — The door is narrow: the entry point exports the view model function
  and its types, not a re-export of the eleven modules behind it. Epic 3 asserts
  this for all five entry points; this one is built to the same rule from the
  start.
- **R12** — `structure.test.ts` is updated for whatever the change creates, and
  the design-system and route boundary tests stay green untouched.

## Behaviour details

**What the card reads and what it is handed.** The view model is a function of
the session and the settings. The session — selection, attempts, `solved`,
`revealed`, `canCheck`, the answer and the four actions — is owned by
`usePuzzleSession`, which creates the store inside itself on first render and
wraps `check` and `reveal` so that persistence happens after each. The two
settings are owned by `useSimpleMode` and `useTapSounds`, each holding local
state and a preference store. Nothing here is global: a component that calls
`usePuzzleSession` gets a second store, not the first one. So "the card reads the
session through a hook" needs a way for the hook to reach the instance the shell
created, and Q4 chooses it. What stays a prop is what the card cannot own at all:
the two hear callbacks, which schedule against the transport clock.

**Why the button belongs in the view model.** `GuessCard` currently computes
`label` from four nested conditionals over `solved`, `bothChosen`, `selectedRoot`
and `selectedFlavour`, and `tone` from `solved`, `canCheck` and `revealed`. That
is the same class of derivation as the nudge and the dots, from the same state.
Splitting it — coaching text behind the door, button text in the component — puts
the seam through the middle of one idea and guarantees the next feature has to
decide again which side its change goes on.

**Order of work.** Feature-18 owns `coaching.ts`, `coachingFamily.ts`,
`coachingMoves.ts`, `moves.ts` and `verdict.ts`, all currently uncommitted. This
epic puts exactly those files behind a door, so it cannot start until they are
merged. It also edits `GroovePuzzle.tsx`, `GuessCard.test.tsx` and
`puzzleHarness.tsx`, which Epic 1 rewrites the imports of, so it starts after
Epic 1 lands. The order is theory, then coaching, then the shell — the
briefing's order.

## Acceptance criteria

- **AC1** (R1, R2, R2a) — Given the inputs R2a names, when the entry point is
  called twice with the same inputs, then it returns equal output and touches no
  React, clock or storage.
- **AC2** (R3, R3a, R3c) — Given the view model's return value, when compared
  against what `GuessCard` renders, then every derived value the card shows comes
  from it — option lists and per-option states, offered selection, check
  enablement, dots, nudge, button label and tone, give-up offer.
- **AC3** (R3b) — Given `lib/presentation/`, when its import specifiers are read,
  then none begins with `@/components/`; and given `GuessCard.tsx`, when read,
  then it holds the one mapping from the domain per-option state to
  `ChipOptionState`.
- **AC4** (R4, R4a) — Given `GuessCard.tsx`, when its imports are read, then it
  imports the coaching entry point and a session hook, and no prop it receives
  carries the view model, the selection, the store actions or the settings.
- **AC5** (R5) — Given `GuessCard`'s prop type, when its members are listed, then
  they are `onHearRoot` and `onHearMode`.
- **AC6** (R6) — Given `GroovePuzzle.tsx`, when read, then `feedback`,
  `coaching`, `verdict`, `confirmed` and `ruledOut` are not among its imports and
  no `offeredRoot`, `offeredFlavour` or `canCheckOffered` is computed.
- **AC7** (R7) — Given a full session — first visit, a wrong guess at each rung
  of the ladder, the nudge appearing, a lock-in, a solve, a give-up, a shared
  link — when played before and after, then every rendered string and chip state
  matches.
- **AC8** (R8, R9) — Given `GuessCard.test.tsx` and the entry point's test file,
  when cases are counted, then the total is at least 115; and given each moved
  case, when read, then it asserts coaching text and nothing about rendering.
- **AC9** (R10) — Given `GuessCard.test.tsx`, when its assertions are read, then
  they act on rendered output and user events, and none asserts on the entry
  point's return value directly.
- **AC10** (R11) — Given the entry point's module, when its exports are listed,
  then it exports the view model function and its types and nothing else from
  behind the door.
- **AC11** (R12) — Given the full gate, when `npm test`, the type check, lint and
  build run, then all pass, and `structure.test.ts`, `route-boundary.test.ts` and
  the design-system boundary tests are green.

## Dependencies

**Needs to start:** feature-18 merged, and Epic 1 landed. Feature-18's five
uncommitted `lib/presentation/` files are the ones this epic puts behind a door;
Epic 1 rewrites the theory imports in three files this epic also edits.

**Hands to Epic 3:** the coaching entry point — the first of the five, and the
pattern the other four follow. Epic 3's narrow-door test asserts against it too.
Also whatever Q4 creates for the session, which Epic 3's map places inside the
puzzle module.

## Assumptions

- The entry point lives at `lib/presentation/index.ts`. It is the feature's
  internal module surface, not the feature's public `index.ts`, and the no-barrel
  rule is scoped to `src/components/`.
- The view model is one object, not several. A card with two doors is two seams to
  reason about.
- The domain per-option state is a small string union — open, ruled out,
  confirmed, or whatever the merge in `optionStatesFor` actually distinguishes
  today — declared in `lib/presentation/`. Its exact members follow from the
  existing merge, not from `ChipOptionState`.
- `nearMiss` and `staffLabel` are read by the solved panel rather than the guess
  card, so they stay outside this door. If the split turns out to cut a module in
  half, that is a finding for the next cycle.
- The 13-of-28 count is measured with feature-18's uncommitted work applied and
  should be re-counted when the epic starts.
- `GuessCard.test.tsx` shrinks but is not split into files by this epic. Whether
  it needs splitting is answerable only once the coaching assertions have moved
  out.
- `GroovePuzzle` still calls `useSimpleMode` and `usePuzzleSession` itself: it
  needs `simple` to pick the flavour matcher and `tapSounds` for the hear
  callbacks. The card reading the same values does not move where they are
  created.

## Question log

### Cycle 1 — 2026-09-02

**Q1. How does `GuessCard` get the state it feeds the entry point?**
Answer: **B) `GuessCard` reads the puzzle session directly through a hook and
takes almost no props** — the fullest version of "feeds itself", accepting that
the card is not testable without the session standing up behind it.
Applied to: Summary, Scope, Out of scope, R2a, R4a, R5, R6, AC4, AC5, AC6,
Behaviour details, Dependencies, Assumptions. Opened Q4 and Q5.

**Q2. Does the view model speak the design system's language or its own?**
Answer: **A) Domain-shaped options; `GuessCard` maps them to `ChipOptionState`**
— keeps `lib/presentation/` free of UI types, so a `ChipGroup` change stays a
component-level change.
Applied to: R3a, R3b, AC3, Assumptions.

**Q3. What happens to the 2,426-line `GuessCard.test.tsx`?**
Answer: **A) Coaching-text cases move to the entry point's own test as
pure-function assertions; rendering, interaction and chip-state cases stay** — a
case about what the coaching says has always been a fact about the module.
Applied to: R8, R9, AC8.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-19 epic-2`.

### Q4. How does the card's hook reach the session the shell created?

`usePuzzleSession` creates its zustand store inside `useState` on first render
and wraps `check` and `reveal` with persistence; `useSimpleMode` and
`useTapSounds` hold local state of their own. A second component calling any of
them gets a second copy, not the shell's. So the hook the card calls needs a way
to the shell's instance. Nothing the player sees changes under any option; the
reason is engineering, and it decides what the puzzle module's shape is
afterwards.

- [x] A) A session context. `GroovePuzzle` keeps calling `usePuzzleSession`,
      `useSimpleMode` and `useTapSounds` once and provides their results; the card
      reads them with one hook over that context *(recommended — it is the only
      form of "reads the session through a hook" the current code permits without
      changing store lifetime: the instance stays per mount, hydration and the
      shared-mode read-only store are untouched, and the provider is the whole
      cost. The roadmap's puzzle module gains one file)*
- [ ] B) A module-level singleton store, created at import, that any component
      subscribes to — no provider anywhere, and every mount now shares one store:
      shared mode's read-only result store, the hydrate-on-load and every test
      that mounts a fresh puzzle have to be rethought
- [ ] C) `GroovePuzzle` passes the session object as one prop — `session` — and the
      card destructures it. "Almost no props" holds literally and no context is
      introduced, but the card is handed its state rather than reading it, which
      is the shape Q1's answer set out to remove
- [ ] D) Return to raw-state props — `GroovePuzzle` passes attempts, answer, date
      and the two settings and the card calls the entry point with them. Q1's
      option A, chosen again with the store's lifetime now known

### Q5. How do `GuessCard`'s rendered cases stand up the session?

112 of the file's 115 cases render `<GuessCard {...props()} />` with hand-made
props. After R4a there are no such props. Whatever remains after the coaching
text moves out — rendering, interaction, chip state — needs a session behind the
card. No persona bearing; the reason is which coupling the test suite accepts.

- [x] A) Through the feature's public surface: `renderFeature()` with the result
      store seeded to the rung under test *(recommended — `docs/testing.md` asks
      for exactly this, and `puzzleHarness.tsx` already reaches every rung that
      way for `GroovePuzzle.test.tsx`, because `hydrate()` restores attempts,
      `solved`, `revealed` and the matched halves of the selection from the stored
      result. The cost is that each remaining case pays the feature's mount, and
      the file stops being a component test in all but name)*
- [ ] B) A seeded-session helper in `testing/` that mounts the card inside the
      real mechanism Q4 chooses, with hand-made state — the cases keep their
      current shape and speed, and the helper knows the session's internal shape,
      which is the coupling `docs/testing.md` warns about
- [ ] C) Split by kind: state transitions and interaction through the public
      surface, static renders of a given rung through the seeded helper — the
      most precise, and two ways to set up one component
- [ ] D) An optional `session` prop the card accepts only so tests can pass one —
      the cases barely change, and the card grows a test-only prop, which is the
      pattern the repo has avoided so far
