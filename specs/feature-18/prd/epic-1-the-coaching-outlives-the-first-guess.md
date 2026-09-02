# PRD — Epic 1: The coaching outlives the first guess

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

A how-to-listen line lives in the Hint box for every moment of an open day, and
moves on to a new suggestion each time a guess misses. It takes the slot the
verdict line holds today, because feature-17 taught the chip rows to carry the
record of the guess themselves — the verdict is left with the two moments the
rows carry badly: the first miss, and the miss that first confirms a half.
Moves may point at tapping a chip to hear it, and say something else when the
tap sounds are switched off.

## Problem

`selectFeedback` returns the app's only listening technique — *"Loop it a few
times. Sing the note that feels like rest — that's usually the root."* — on the
single condition that `attempts` is empty. Sam plays Wordle every morning and
guesses inside fifteen seconds, so the fastest player is the one who sees that
sentence once and never again. What replaces it is a verdict: *"Not it. Keep
playing and try again."* Keep playing *how* is the question the app stops
answering at exactly the moment it is asked. For a player who is here "to get
better at hearing, not at reading", that is the wrong sentence to have on screen
for the rest of the day.

## Scope

- A coaching line present in every open state of the day, derived from the
  day's attempts.
- A short ladder of moves that advances on each miss and holds on its last rung.
- The coaching taking the verdict line's slot in the Hint box.
- Moves that may name a chip tap, with a wording for when the taps are silent.

**Out of scope**
- **Choosing the move from which half of the guess was wrong** — Epic 2. This
  epic's ladder is the same one whatever the miss looked like.
- **Simple mode's own phrasing** — Epic 2. Simple mode shows this epic's ladder
  unchanged in the meantime, which is imperfect and not wrong.
- **The narrowing count.** `N roots ruled out. Narrowing as you go.` keeps its
  copy, its position and its condition.
- **The attempt dots, the give-up button and the solved panel.** The dots still
  mark par, give-up still appears from the third miss, and feature-15's solved
  panel is still what explains the answer.
- **New audio.** The coaching may point at the taps features 10 and 16 built; it
  makes no sound of its own.
- **Rewriting the verdict messages.** This epic decides *when* they show, not
  what they say.

## Requirements

### The coaching line

- **R1** — While the day is open there is always a listening move in the Hint
  box. There is no state — not the first load, not the fourth miss, not a reload
  halfway through — in which the box has a verdict and no technique.
- **R2** — The first rung is the line that is there now: *"Loop it a few times.
  Sing the note that feels like rest — that's usually the root."* It is the
  sentence this feature exists to stop losing, so it keeps its place at the
  front.
- **R3** — Each miss advances the ladder by one rung. A solve or a reveal ends
  the day and the box goes, so a miss is the only thing that moves it.
- **R4** — The ladder holds on its last rung once the misses outrun it.
  Attempts are unbounded, so it always runs out eventually; the last rung is the
  most concrete job on the ladder and repeating it is honest. By the time it is
  reached the give-up button has been on screen since the third miss.
- **R5** — No move names a note, a mode, a chord or a degree of the day's
  answer. The coaching says what to listen for and never what the answer is —
  the rule that keeps the feature from becoming the reveal by instalments.
- **R6** — Tapping a chip to hear it does not advance the ladder. Feature-16's
  rule that a tap is never a guess is unchanged, and the ladder follows misses,
  not presses.
- **R7** — The move is derived from the day's attempts and the existing
  `tapSounds` preference. Nothing new is stored, so a player who reloads
  mid-day, or comes back after dinner, sees the rung they were on.
- **R8** — Switching simple mode on or off mid-day does not reset the ladder.
  Attempts carry across the switch and so does the position.

### Pointing at the taps

- **R9** — A move may tell the player to tap a root or a mode chip to hear it.
  It is the most concrete listening job the app can offer, and features 10 and
  16 built the affordance for exactly this.
- **R10** — Every move that leans on a tap has a second wording for when the tap
  sounds are off, and the wording swaps the moment the switch is flipped. A move
  that names a control the player has silenced is worse than a general one.
- **R11** — A move may point at a *ruled-out* chip. An unavailable chip still
  sounds — `Chip` fires `onPress` regardless and only withholds `onSelect` — so
  the twelve roots stay a working keyboard all day even as the pickable set
  shrinks.

### The Hint box

- **R12** — The coaching takes the slot the verdict line holds today. Where both
  show, the verdict comes first and the coaching under it; where only the
  coaching shows, the box is the coaching and, when it applies, the narrowing
  count.
- **R12a** — The verdict line shows on the first miss of the day, and on a miss
  that confirms a half for the first time. On every other miss the box is the
  coaching alone. Dimming is a vocabulary feature-17 shipped without a legend,
  so one verdict teaches it; and a row collapsing to a single live chip is too
  quiet a way to deliver the day's one piece of good news.
- **R12b** — "For the first time" is the operative word. Once a half is
  confirmed its row locks to one live chip, so every later attempt matches on
  that half — those are not new confirmations and they carry no verdict.
- **R12c** — Confirming the second half is a solve, so at most two verdicts can
  appear in a day: one on the first miss, and one on the miss that confirms a
  half. Where those are the same miss, one.
- **R13** — The coaching reads in the box's muted treatment, not the verdict's
  warm one. `FeedbackLine` colours a verdict `text-warm`; a suggestion is not a
  verdict, and the narrowing count already establishes `text-text-muted` as the
  box's voice for something that is not a judgement.
- **R14** — The Hint box still disappears the moment the day is solved or given
  up. `GuessCard` renders it under `{!over && …}` today; the solved panel is
  what speaks from then on.
- **R15** — A day solved on the first guess never shows a verdict or a second
  rung. The box carries the opening move, and then it is gone.
- **R16** — The coaching does not read the transport. The move is the same
  whether the loop is running or stopped, and no move is replaced or suppressed
  by silence. The moves assume a player who will press play, which the first
  rung asks for in as many words and which the biggest control on the card
  invites.
- **R17** — The Hint box is a single polite live region. A miss changes the
  verdict, the coaching and the narrowing count at one stroke, so they are
  announced together in reading order rather than as separate utterances racing
  each other. `FeedbackLine` stops carrying its own `role="status"`, which it
  can do safely because `NudgeBox` is its only consumer.

## Behaviour details

### The ladder against the miss count

| Misses | Rung |
| :-- | :-- |
| 0 | R2's opening line |
| 1 | second move |
| 2 | third move |
| 3 | last move |
| 4+ | last move, held (R4) |

The ladder is three or four rungs. The moves the briefing names — hum the bass
note on beat one, compare the third against a major scale you already know,
listen for what changes in bar three — are the material; which of them lands on
which rung, and how each is worded, is a musical judgement rather than a copy
one, and `/writespec` should give it its own track.

### What the chip rows already say

The verdict line's three messages are each a reading of the last guess, and
after feature-17 the card mostly shows the same reading without words:

| Verdict | What the rows do | What the dots do |
| :-- | :-- | :-- |
| Right home note, wrong colour | root row collapses to one live chip; the tried mode dims | one more dot spent |
| The mode is right, the tonic is elsewhere | mode row collapses to one live chip; the tried root dims, and app-eliminated roots dim with it | one more dot spent |
| Not it, keep playing | both tried chips dim | one more dot spent |

This is why the coaching gets the slot: on most of these the verdict is a
caption for something already on screen. It is also why the verdict does not
vanish outright — a collapsing row is a quiet way to deliver the day's one piece
of good news, and dimming is a visual vocabulary nobody has taught the player
yet. Those are the two cases that keep their words (R12a).

### When the verdict shows

| Miss | Confirms a half for the first time | Verdict |
| :-- | :-- | :-- |
| 1st | either way | shown — it is what teaches the dimming |
| 2nd or later | yes | shown — the win keeps its words |
| 2nd or later | no | hidden; the box is the coaching and the count |

A half that was already confirmed matches again on every later attempt, because
its row is locked to one live chip. That is not a new confirmation and carries
no verdict (R12b).

## Acceptance criteria

- **AC1** (R1) — Given a day with no attempts, when the page loads, then the
  Hint box shows a listening move.
- **AC2** (R1, R3) — Given a day with no attempts, when a wrong pair is checked,
  then the Hint box shows a *different* listening move than it did before.
- **AC3** (R2) — Given a day with no attempts, when the page loads, then the
  move shown is the "sing the note that feels like rest" line.
- **AC4** (R3) — Given a day with one miss, when a second wrong pair is checked,
  then the move advances again.
- **AC5** (R4) — Given a day with misses beyond the last rung, when another
  wrong pair is checked, then the move is the last rung and does not change.
- **AC6** (R5) — Given every move in the ladder, when its text is inspected,
  then it contains no root name and no mode name from the game's option sets.
- **AC7** (R6) — Given a day with no attempts, when a chip is tapped to hear it,
  then the move does not change.
- **AC8** (R7) — Given a day with two misses, when the page is reloaded, then
  the move shown is the third rung.
- **AC9** (R8) — Given a day with two misses, when simple mode is switched on,
  then the move shown is still the third rung.
- **AC10** (R10) — Given a move that names a chip tap, when the tap sounds are
  switched off, then the move's sounds-off wording is shown instead, without a
  reload.
- **AC11** (R12, R13) — Given a miss whose verdict still shows, when the Hint box
  is read, then the verdict is above the coaching and the coaching carries the
  muted treatment rather than the warm one.
- **AC12** (R14) — Given an open day showing a move, when the pair is solved,
  then the Hint box is not rendered.
- **AC13** (R14) — Given an open day showing a move, when the day is given up
  on, then the Hint box is not rendered.
- **AC14** (R15) — Given a day with no attempts, when the correct pair is checked
  first time, then no verdict and no second rung is ever shown.
- **AC15** (R12a) — Given a day with no attempts, when a wrong pair confirming
  neither half is checked, then the verdict line is shown alongside the move.
- **AC16** (R12a) — Given a day with one miss confirming neither half, when a
  second wrong pair confirming neither half is checked, then the verdict line is
  not shown and the box carries the coaching alone.
- **AC17** (R12a) — Given a day with two misses confirming neither half, when a
  wrong pair that confirms the mode is checked, then the verdict line is shown
  again.
- **AC18** (R12b) — Given a day whose mode is already confirmed, when a further
  wrong pair is checked, then the verdict line is not shown.
- **AC19** (R16) — Given a day with one miss, when the loop is stopped and
  restarted, then the move does not change.
- **AC20** (R17) — Given the Hint box, when its markup is inspected, then it
  carries exactly one polite live region covering the verdict, the coaching and
  the narrowing count, and `FeedbackLine` declares none of its own.

## Dependencies

Nothing must exist first. What it hands Epic 2 is the contract Epic 2 builds on:

- **A coaching selector** that takes the day's attempts and the `tapSounds`
  preference and returns one move. Epic 2 widens its input, not its output.
- **A coaching slot in `NudgeBox`**, rendered under the verdict when both show.
- **The two rules every move obeys** — no answers in the copy (R5), and a
  sounds-off wording for anything that names a tap (R10). Epic 2's moves inherit
  both.

## Assumptions

- **The ladder is three or four rungs.** The briefing rules out a curriculum,
  and a long ladder is a curriculum arriving one miss at a time.
- **The box keeps its `Hint` eyebrow and its `aria-label="Hint"`.** The content
  is getting more useful, not becoming a different thing.
- **`Feedback`'s existing tone vocabulary is enough.** `neutral` already maps to
  the muted treatment R13 asks for.
- **No change to `DailyResult` or to any `localStorage` key.** R7 is satisfied by
  what `useProgress` already writes.
- **The narrowing count rides in the same live region.** R17 names the verdict
  and the coaching; the count changes on the same event and splitting it out
  would reintroduce the race the single region exists to remove.
- **Not every rung names a tap.** R10's second wording is written only for the
  moves that actually point at a chip, so the string count is the ladder plus a
  handful, not the ladder doubled.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-02

**Q1. Which misses keep their verdict line?**
Answer: **A) The first miss, and any miss that newly confirms a half** — the
rows carry the other cases, but they teach nothing on the first miss and
announce a win too quietly on the confirming one.
Applied to: R12a, R12b, R12c, Summary, Behaviour details ("When the verdict
shows"), AC15–AC18

**Q2. Does the coaching adapt to whether the loop is playing?**
Answer: **B) No — the moves assume the player will press play** — the first rung
already asks for the loop and the play button is the biggest control on the
card, so the transport stays out of the selector's inputs.
Applied to: R16, AC19, Dependencies (the selector's input is unchanged at
attempts + `tapSounds`)

**Q3. How is a new move announced to a screen reader?**
Answer: **A) One live region wrapping both lines** — one event produces all
three lines, so one announcement is the honest mapping and it cannot race.
Applied to: R17, AC20, Assumptions (the narrowing count rides along)
