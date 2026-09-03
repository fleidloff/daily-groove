# PRD — Epic 2: The puzzle card feeds itself

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`GroovePuzzle.tsx` computes thirteen derived values and posts them down to
`GuessCard` as props, which is why every coaching feature ends up editing the one
file that everything else also edits. This epic puts the coaching modules behind
one door, has `GuessCard` read the puzzle session itself — through one context the
shell provides from the hooks it already calls — and open that door with what it
reads, leaving `GroovePuzzle` composing rather than calculating. The
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
- a session context: the shell provides what it already creates, and one hook
  reads it, so the card can call the entry point without being handed its state
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
  and the two settings with their setters. None of these arrive as props — it
  reads them from the session context.
- **R4b** — `GroovePuzzle` provides that context. It keeps calling
  `usePuzzleSession`, `useSimpleMode` and `useTapSounds` exactly once and puts
  their results on one context; every consumer below it sees the same instance.
  Store lifetime does not change: the zustand store is still created inside
  `usePuzzleSession` on first render and lives for that mount, hydration still
  runs once when the result store loads, and shared mode's read-only result store
  is still passed in the same way.
- **R4c** — One hook reads the context and it is the only way in. Called outside
  the provider it throws rather than returning a default, so a component mounted
  without a session fails loudly in a test instead of rendering an empty card.
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
  action, not by asserting on the view model it happens to call. They stand the
  session up by mounting the feature: `renderFeature()` with the result store
  seeded to the rung under test — the path `docs/testing.md` asks for, and the one
  `puzzleHarness.tsx` already takes for the five `GroovePuzzle.*` files.
- **R10a** — Nothing is added to the card to make that easier. No test-only
  `session` prop, no hand-made session object, no `vi.mock` of an internal path.
  Where a rung is awkward to reach, the harness gains a helper: the seam stays in
  `testing/` rather than in the component.
- **R10b** — `GuessCard.test.tsx` stays where it is, beside `GuessCard.tsx`,
  and keeps the card's rendered cases even though they now mount the feature. It
  is colocated with its subject, which is what tells the next reader where to
  look; the file is not merged into `GroovePuzzle.guessing.test.tsx` and is not
  split into topic files by this epic.
- **R10c** — The suite gets slower and the epic reports by how much. The app
  suite's wall clock and `GuessCard.test.tsx`'s own duration are measured before
  the change and after it, and both numbers go in the epic's report. There is no
  threshold: the cost is one-off and the epic is not judged against a ceiling
  invented in advance.
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
`usePuzzleSession` gets a second store, not the first one. So the hook the card
calls reads a context rather than creating anything — the shell provides the three
hooks' results once, and everything below it sees that instance. Lifetime is
unchanged, one store per mount of `GroovePuzzle` created exactly where it is
created today, which is what keeps hydration and shared mode's read-only store
working untouched. What stays a prop is what the card cannot own at all: the two
hear callbacks, which schedule against the transport clock.

**How a rendered case reaches a rung.** `hydrate()` restores attempts, `solved`,
`revealed` and the matched halves of the selection from the stored result, so a
seeded result store puts the mounted feature at any rung without a single
hand-made prop. That is already how `GroovePuzzle.guessing.test.tsx` reaches the
third miss. The cost is per-case mount time, and it is measurable rather than
theoretical: `GuessCard.test.tsx` runs 142 cases in 2.1s of test time today,
about 15ms each, because it renders one component with props it invents;
`GroovePuzzle.guessing.test.tsx` runs 82 feature-mounted cases in 7.7s, about
94ms each. Roughly 110 of `GuessCard.test.tsx`'s cases render, so the move costs
around +9s of test time against the app suite's 38.8s today (13.9s of wall clock
across 114 files) and makes the file the slowest in the repo at ~11s. That is
accepted, measured and reported rather than budgeted: the alternative — one mount
per `describe` reused across its cases — buys the time back by sharing state
between cases, which is the bug class every test framework warns about.

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
  imports the coaching entry point and the session context's hook, and no prop it
  receives carries the view model, the selection, the store actions or the
  settings.
- **AC4a** (R4b) — Given the feature mounted, when the store is counted, then
  `createDailyGrooveStore` runs once per mount of `GroovePuzzle` and the card
  reads that instance; and given a shared groove, when its read-only result store
  is passed, then hydration and the read-only behaviour are as they are today.
- **AC4b** (R4c) — Given `GuessCard` mounted outside the provider, when it
  renders, then the session hook throws.
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
- **AC9** (R10, R10a) — Given `GuessCard.test.tsx`, when its assertions are read,
  then they act on rendered output and user events, none asserts on the entry
  point's return value directly, and every case that renders stands the card up
  through `renderFeature()` with a seeded result store — no `session` prop, no
  hand-made session, no mocked internal path.
- **AC10** (R11) — Given the entry point's module, when its exports are listed,
  then it exports the view model function and its types and nothing else from
  behind the door.
- **AC10a** (R10b) — Given the tree after the epic,
  when `src/features/daily-groove/components/puzzle/` is listed, then
  `GuessCard.test.tsx` is still there, and
  `GroovePuzzle.guessing.test.tsx`'s case count is unchanged by this epic.
- **AC10b** (R10c) — Given the epic's report, when read, then it states the app
  suite's wall clock and `GuessCard.test.tsx`'s duration before and after, each
  measured the same way.
- **AC11** (R12) — Given the full gate, when `npm test`, the type check, lint and
  build run, then all pass, and `structure.test.ts`, `route-boundary.test.ts` and
  the design-system boundary tests are green.

## Dependencies

**Needs to start:** feature-18 merged, and Epic 1 landed. Feature-18's five
uncommitted `lib/presentation/` files are the ones this epic puts behind a door;
Epic 1 rewrites the theory imports in three files this epic also edits.

**Hands to Epic 3:** the coaching entry point — the first of the five, and the
pattern the other four follow. Epic 3's narrow-door test asserts against it too.
Also the session context, which Epic 3's map places inside the puzzle module and
behind that module's entry point.

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
  it needs splitting, and whether it wants feature-14's topic-file shape one
  level down, is answerable only once the coaching assertions have moved out and
  the runtime is known.
- `GroovePuzzle` still calls `useSimpleMode`, `useTapSounds` and
  `usePuzzleSession` itself — once each, now also providing their results. It
  needs `simple` to pick the flavour matcher and `tapSounds` for the hear
  callbacks anyway. The card reading the same values does not move where they are
  created.
- The context and its hook live in `src/features/daily-groove/state/`, beside
  `useDailyGrooveStore.ts`: it is the session's lifetime, and Epic 3's map puts
  `state/` in the puzzle module. The name is a detail; the location is what that
  map has to agree with.
- The context carries the two settings as well as the session. They are two hooks
  and one object, and a card reading its state from one place and its settings
  from another has two seams again.

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

### Cycle 2 — 2026-09-03

**Q4. How does the card's hook reach the session the shell created?**
Answer: **A) A session context** — `GroovePuzzle` keeps calling the three hooks
once and provides their results; it is the only form of "reads the session
through a hook" the current code permits without changing store lifetime, so
hydration and shared mode's read-only store stay untouched.
Applied to: Summary, Scope, R4a, R4b, R4c, AC4, AC4a, AC4b, Behaviour details,
Dependencies, Assumptions. Opened nothing new on its own.

**Q5. How do `GuessCard`'s rendered cases stand up the session?**
Answer: **A) Through the feature's public surface** — `renderFeature()` with the
result store seeded to the rung under test, because `hydrate()` already restores
every rung and `docs/testing.md` asks for the public surface. Accepted cost: each
remaining case pays a feature mount.
Applied to: R10, R10a, AC9, Behaviour details. Opened Q6 and Q7.

### Cycle 3 — 2026-09-03

**Q6. Does `GuessCard.test.tsx` survive as a file?**
Answer: **A) It stays where it is, mounting the feature** — a relocated
assertion keeps its subject, and the subject of these cases is the guess card;
colocation is what tells the next reader where to look.
Applied to: R10b, AC10a, Assumptions.

**Q7. What does the epic owe on suite time?**
Answer: **A) Accept it and measure it, no threshold** — the cost is one-off and
bounded, ~14s to ~17s of wall clock is still a suite you run on every save, and
a ceiling invented now is a number nobody could defend later.
Applied to: R10c, AC10b, Behaviour details.

The PRD is settled: no open questions remain.
