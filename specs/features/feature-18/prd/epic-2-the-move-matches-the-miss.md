# PRD — Epic 2: The move matches the miss

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The coaching stops being one ladder for everybody and becomes three, chosen by
what the player has already established: a colour job for someone who has the
root and is hunting the mode, a tonic job for someone who has the mode and is
hunting the root, and Epic 1's general ladder for someone who has neither. Each
family is two moves deep and is entered at its first, so nobody arrives midway
through advice for a job they have just started. Simple mode gets its own
wording for the one family where its job is genuinely different.

## Problem

Epic 1 makes the coaching survive; it does not make it relevant. A player told
*"The mode is right. But the tonic is somewhere else."* and then handed "listen
for what changes in bar three" has been given advice for a question they have
already answered. The card knows which half is settled — feature-17 locks the
row to prove it — and coaching that ignores what the card knows is the same
failure as coaching that disappears, arriving politely.

## Scope

- Three families of move, selected by which half is confirmed.
- A rule that a move never asks for the half already in hand.
- Simple mode's own wording where its listening job differs from the full row's.

**Out of scope**
- **The ladder mechanics** — Epic 1 owns the rung-per-miss advance, the hold on
  the last rung, and the derivation from attempts.
- **The Hint box layout, the verdict's survival and the live-region behaviour** —
  all settled in Epic 1.
- **New audio.** The moves may point at the taps features 10 and 16 built.
- **Rewriting the verdict messages.** They already name which half was right;
  this epic adds what to do about it.
- **Any change to what confirms a half.** Feature-17 decides that; this epic
  reads the result.

## Requirements

### Choosing the family

- **R1** — The move is chosen from which half is confirmed, read from the same
  `confirmedHalves` the chip rows are drawn from. The roadmap named
  `matchedHalf` on the last attempt; the two agree in practice, because a locked
  row leaves only the confirmed option selectable and so every later attempt
  matches on that half. Reading the same source as the rows is what keeps the
  coaching and the card in step by construction rather than by coincidence.
- **R2** — Three families, one per situation: root confirmed, mode confirmed,
  neither confirmed.
- **R3** — Root confirmed, mode still open → the moves are about colour: what
  the third is doing, whether the sixth is bright or dark, where the seventh
  sits. The home note is settled and the question is what is built on it.
- **R4** — Mode confirmed, root still open → the moves are about the tonic:
  the bass note on beat one, the note the loop keeps resolving to, singing a
  note and holding it against the groove until one stops fighting.
- **R5** — Neither confirmed → Epic 1's general ladder, unchanged.
- **R6** — A move never asks the player to find the half they have already
  confirmed. Sending someone hunting a root their row has locked to one chip is
  the specific failure this epic exists to remove.
- **R7** — A confirmed half stays confirmed for the rest of the day, so the
  family never moves backwards. Feature-17 makes the lock permanent; the
  coaching inherits that and a player is never returned to the general ladder
  once they have left it.

### Position within a family

- **R7a** — Each family is entered at its own first move. The miss that confirms
  a half shows the new family's first move, not the rung the general ladder had
  reached. Confirming a half is a new listening job, and arriving three rungs
  into advice for a job just started is the same irrelevance this epic removes.
- **R7b** — Position inside a family is counted from the miss that entered it,
  not from the day's first miss.
- **R7c** — The colour and tonic families are two moves deep. A player who has
  confirmed a half is close, and needs one or two good jobs rather than a
  syllabus; Epic 1's general ladder keeps its three or four rungs for the player
  who has neither half.
- **R7d** — A family holds on its second move once the misses outrun it, exactly
  as Epic 1's ladder holds on its last rung.

### Simple mode

- **R8** — Simple mode has its own wording for the colour family and no other.
  With the root confirmed there, the question collapses from "which of four
  modes" to a single question about one note, which is a different listening job
  and not a smaller one.
- **R9** — Simple mode shares the tonic family and the general ladder. With the
  family confirmed, one live chip is left in the mode row and the only job
  remaining is the root — the same job R4 describes, over six roots instead of
  twelve, so the same words are true.
- **R9a** — The wording follows the row the player is currently looking at, not
  the row they guessed on. Switching simple mode mid-day swaps the colour
  family's wording immediately, because the confirmed root locks its row either
  way and the mode row is what changed.

### Inherited rules

- **R10** — Every move in every family obeys Epic 1's rules: it names no root,
  mode, chord or degree of the day's answer; it has a sounds-off wording if it
  names a chip tap; it reads in the muted treatment; and its family's ladder
  holds on its last rung.

## Behaviour details

### The three families

| Situation | What the card already shows | What the move is about |
| :-- | :-- | :-- |
| Neither confirmed | the tried chips dim; app-eliminated roots dim from the second miss | Epic 1's general ladder — find the home note |
| Root confirmed | root row is one live chip; tried modes dim | the colour built on that note (R3) |
| Mode confirmed | mode row is one live chip; tried and eliminated roots dim | the home note under that colour (R4) |

Both halves confirmed is not a state — it is a solve, and the box is gone.

### Position within a family

A player who misses twice on the general ladder and then confirms the mode on
the third guess sees the tonic family's *first* move, not its second:

| Misses | Family | Move |
| :-- | :-- | :-- |
| 1 (neither) | general | general rung 2 |
| 2 (neither) | general | general rung 3 |
| 3 — confirms the mode | tonic | tonic move 1 |
| 4 | tonic | tonic move 2 |
| 5+ | tonic | tonic move 2, held (R7d) |

### Simple mode's two jobs are not both narrower

Simple mode changes the root row to six and the mode row to `Major` / `Minor`.
The two families are not affected equally, which is what R8 and R9 turn on:

- **Mode confirmed** — the job is still "find the home note", over six chips
  rather than twelve. Same job, smaller row, shared wording.
- **Root confirmed** — the job collapses from "which of four modes" to a single
  question about one note, the third. That is a different listening job, not a
  smaller one, and full-row wording about the sixth and the seventh is wrong
  there. This is the one family that gets simple mode's own words.

### The copy this epic adds

Two moves for the colour family, two for the tonic family, two for simple mode's
colour family — six, plus a sounds-off wording for each one that names a chip
tap. Epic 1's general ladder is unchanged.

## Acceptance criteria

- **AC1** (R1, R2, R4) — Given a day where a checked guess confirmed the mode
  and missed the root, when the Hint box is read, then the move is from the
  tonic family.
- **AC2** (R1, R2, R3) — Given a day where a checked guess confirmed the root
  and missed the mode, when the Hint box is read, then the move is from the
  colour family.
- **AC3** (R5) — Given a day whose misses have confirmed neither half, when the
  Hint box is read, then the move is from Epic 1's general ladder.
- **AC4** (R1) — Given a day with a confirmed half, when the coaching is
  selected, then it is selected from the same confirmed-halves result the chip
  rows render from.
- **AC5** (R6) — Given a day with the root confirmed, when every move in the
  colour family is inspected, then none of them asks the player to find the
  root.
- **AC6** (R6) — Given a day with the mode confirmed, when every move in the
  tonic family is inspected, then none of them asks the player to identify the
  mode.
- **AC7** (R7) — Given a day with the mode confirmed and two further misses,
  when the Hint box is read, then the move is still from the tonic family.
- **AC8** (R9) — Given simple mode with the family confirmed, when the Hint box
  is read, then the move is the shared tonic-family wording.
- **AC9** (R8) — Given simple mode with the root confirmed, when the Hint box is
  read, then the move is simple mode's own colour wording and not the full row's.
- **AC9a** (R9a) — Given simple mode with the root confirmed, when simple mode is
  switched off, then the colour move becomes the full row's wording without a
  reload.
- **AC10** (R10) — Given every move added by this epic, when its text is
  inspected, then it contains no root name and no mode name from the game's
  option sets.
- **AC11** (R10) — Given a move in any family that names a chip tap, when the tap
  sounds are switched off, then its sounds-off wording is shown instead.
- **AC12** (R7a) — Given a day with two misses confirming neither half, when a
  third guess confirms the mode, then the move shown is the tonic family's first
  move.
- **AC13** (R7b, R7c) — Given a day whose mode was confirmed on the third miss,
  when a fourth wrong pair is checked, then the move shown is the tonic family's
  second move.
- **AC14** (R7d) — Given a day whose mode was confirmed and which has missed
  three times since, when another wrong pair is checked, then the move is still
  the tonic family's second move.

## Dependencies

Needs Epic 1 finished, not merely contracted — it shares three files with it:

- **The coaching selector**, whose input widens from (attempts, tapSounds) to
  include which halves are confirmed.
- **The coaching slot in `NudgeBox`** and its treatment.
- **Epic 1's two copy rules** (no answers named, sounds-off wording), which every
  move here inherits.

Hands nothing to a later epic; it is the last of the feature.

## Assumptions

- **`confirmedHalves` needs no change.** It already returns roots and flavours
  accumulated across the day's attempts, and `GuessCard` already receives both.
- **The families are copy, not new state.** Nothing is stored; the family is
  derived per render exactly as the ladder position is.
- **The family entry point is derivable from the attempts alone.** The miss that
  first confirmed a half is findable by walking `attempts` in order, so R7b needs
  nothing persisted.
- **Writing the moves is a musical judgement.** What is actually audible in
  these grooves — whether a sixth is reliably hearable at these tempos, whether
  bar three is where the change lands — is a claim about the catalogue, and
  `/writespec` should give the copy its own track under the `musician` role.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-02

**Q1. When the family changes, does the ladder position carry across?**
Answer: **A) Each family starts at its own first rung** — confirming a half is a
new listening job, and every family's first move is the one a player is most
likely to act on.
Applied to: R7a, R7b, Behaviour details ("Position within a family"), AC12, AC13

**Q2. How many moves does each family need?**
Answer: **A) Two per family, plus Epic 1's general ladder** — a player who has
confirmed a half is close and needs one or two good jobs, not a syllabus; it
also keeps the musician's deliverable to six moves.
Applied to: R7c, R7d, Behaviour details ("The copy this epic adds"), AC14

**Q3. How much of its own copy does simple mode need?**
Answer: **A) Only the colour family** — tonic-hunting there is the same job over
six chips, while Major-versus-Minor is a single-note question rather than a
smaller version of choosing among four modes.
Applied to: R8, R9, R9a, Behaviour details ("Simple mode's two jobs are not both
narrower"), AC8, AC9, AC9a
