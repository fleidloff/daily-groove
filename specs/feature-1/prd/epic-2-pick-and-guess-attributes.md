# PRD — Epic 2: Pick your attributes and guess them

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The daily puzzle grows from a single scale guess into the full set: scale, chord,
and chord progression. The player chooses which attribute(s) to take on, answers
only those, and sees a per-part breakdown that marks each attempted attribute
right or wrong and shows the rest as skipped.

## Problem

Epic 1 proves the loop with one attribute. The briefing's actual game is
guessing the "scale / chord / chord progression" of a groove — and the roadmap
settled that the player opts in per attribute rather than being forced through
all three. This epic delivers that choice and the two remaining guess
dimensions.

## Scope

- Attribute selection: the player picks any non-empty subset of {scale, chord,
  progression} to guess.
- Chord and chord-progression pickers, in the same constrained multiple-choice
  style Epic 1 established for scale.
- Scoring over the attempted attributes only, and a result/reveal view that
  breaks each attempted part into right/wrong with the correct value, showing
  un-attempted attributes as skipped.
- Extending `DailyResult.guesses` / `correctness` to record which attributes were
  attempted and each attempted part's outcome.

**Out of scope**
- Persistence, streaks, history, "already played today" — Epic 3. This epic
  still scores a single in-memory session.
- Forcing all three attributes — selection is per attribute and opt-in.

## Requirements

- **R1** — The puzzle presents all three attributes — scale, chord, progression
  — each with an explicit selection toggle; the player checks the attribute(s)
  they want to attempt, and only checked attributes reveal a picker.
- **R2** — The player must select at least one attribute; submitting with none
  selected is prevented with a clear prompt.
- **R3** — For each selected attribute, the player picks one option from that
  attribute's constrained picker; unselected attributes show no picker.
- **R4** — On submit, the app scores each attempted attribute independently and
  shows a per-part breakdown: correct/incorrect with the correct value for each
  attempted part, and "skipped" for each unselected part.
- **R5** — The result extends the `DailyResult` contract from Epic 1 to carry
  each attribute's attempted flag, guess, and correctness.
- **R6** — Scale guessing behaves exactly as in Epic 1 (same picker, same answer
  model); Epic 2 adds chord and progression alongside it without changing scale.

## Acceptance criteria

- **AC1** (R1, R3) — Given today's groove, when the player selects scale and
  chord (leaving progression unselected), then only scale and chord pickers are
  shown.
- **AC2** (R4) — Given scale + chord selected and answered, when the player
  submits, then the breakdown marks scale and chord each right/wrong with the
  correct values and shows progression as skipped.
- **AC3** (R2) — Given no attribute selected, when the player tries to submit,
  then submission is blocked with a prompt to select at least one.
- **AC4** (R4) — Given all three selected with a mix of right and wrong answers,
  when the player submits, then each part's result reflects its own correctness
  independently.

## Dependencies

- **Requires (from Epic 1):** the seed groove shape, the audio-playback utility,
  and the `DailyResult` `{ date, guesses, correctness }` contract — Epic 2
  extends the record's `guesses`/`correctness` to cover all three attributes.
- **Hands to Epic 3:** the finalized per-attribute `DailyResult` shape that Epic
  3 persists and reads for streak/history.

## Decisions

Carried from the roadmap's resolved questions:

- **Player picks which attributes to guess** — the puzzle offers all three; the
  player opts in per attribute. Scoring covers only the attempted attributes.
- **Explicit per-attribute toggle** — the player checks which attributes to
  attempt; only checked attributes show a picker. This keeps "skipped"
  unambiguous for scoring and the breakdown.
- **Absolute answers (root + quality)** — inherited from Epic 1: chord is an
  absolute value (e.g. "Dmaj7") and progression is an absolute chord sequence
  (e.g. "Dm–G–C"), each guessed via a constrained multiple-choice picker.

## Assumptions

- Each picker shows the correct absolute answer plus a fixed, small number of
  distractors from that attribute's value space, deterministic per day (same
  pattern as the scale picker in Epic 1).
- Selected attributes are answered and submitted together in one action, not one
  attribute at a time.
- Each groove's `chord` metadata is a single canonical chord for the groove
  (e.g. its home/tonic chord), distinct from the `progression` sequence.

## Question log

### Cycle 1

- **Q1. Expressing attribute selection → A) Explicit per-attribute toggle.**
  Confirmed the opt-in model in R1/R3; recorded as a decision. Also folded in
  Epic 1's answer-model result (absolute root+quality) as the chord/progression
  value space, replacing the earlier "follows from Epic 1" placeholder.
