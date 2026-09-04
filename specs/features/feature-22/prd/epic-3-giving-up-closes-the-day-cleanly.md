# PRD — Epic 3: Giving up closes the day cleanly

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

After a give-up the Check button reads *Revealed*, the way it reads *Solved*
after a solve, and the answer panel shows the mode and its line without "given
up · the day is over" beside it. The give-up flow, the reveal and the streak
rule are unchanged. The two bugs come out of `specs/features.md`.

## Problem

Giving up today leaves the Check button saying "Pick a root and a mode" — an
instruction for a puzzle that is over — while the answer panel adds "given up ·
the day is over" next to the mode line, which repeats what the disabled card
already says and reads as a scolding. Sam gave up to be told the answer;
"failing without learning is worse than losing" is the persona's line, and the
panel is the lesson. The header should be the answer, nothing else.

## Scope

- the Check button's label after a give-up
- the given-up text removed from the answer panel
- the **Bugs** section removed from `specs/features.md`

**Out of scope**
- **when Give up is offered, or how it arms** — three misses, one confirming
  tap, unchanged
- **the near-miss line** on a revealed day — `selectNearMiss` already handles
  `revealed`, unchanged
- **the streak** — a revealed day still ends it, as feature-19 settled
- **the switch and the chips after a give-up** — still disabled, as today

## Requirements

- **R1** — Once the day is revealed, the Check button reads *Revealed*,
  whatever is or was selected, and stays disabled.
- **R2** — The *Revealed* label survives a reload of the same day: a stored
  result with `revealed: true` hydrates to the same button.
- **R3** — The button keeps the idle tone after a give-up. The solved green is
  what a solve earns; a revealed day closes with the answer, not with a win.
- **R4** — The answer panel's header after a give-up is the root and mode, the
  mode line where the table has one, and the near-miss line where there is
  one. The words "given up" and "the day is over" appear nowhere in it.
- **R5** — A solved day's panel and button are untouched: *Solved*, solved tone.
- **R6** — On the shared-groove route the same labels apply.
- **R7** — The new label is a snippet in `src/lib/snippets/en/coaching.ts`
  beside `checkSolved`; the given-up snippet and its type are removed rather
  than left orphaned.
- **R8** — `specs/features.md` no longer has a **Bugs** section; the two
  bullets are owned by this feature's briefing.

## Acceptance criteria

- **AC1** (R1, R3) — Given three misses and Give up confirmed, then the Check
  button reads "Revealed", is disabled and carries the idle tone, not the
  solved one; given a root was selected before the give-up, then it still reads
  "Revealed".
- **AC2** (R2) — Given a stored result for today with `revealed: true`, when the
  page renders, then the button reads "Revealed".
- **AC3** (R4) — Given the panel rendered with `revealed: true`, then no text
  matches /given up/i or /day is over/i, and the mode line is still present.
- **AC4** (R5) — Given a solve, then the button reads "Solved" with the solved
  tone and the panel is as today.
- **AC5** (R6) — Given a shared groove given up on, then the button reads
  "Revealed".
- **AC6** (R7) — Given the snippets test, then `solved.givenUp` no longer
  exists and `coaching.checkRevealed` does.
- **AC7** (R8) — Given `specs/features.md`, then it has no `## Bugs` heading.

## Dependencies

- Independent of Epics 1 and 2. Shares `src/lib/snippets/en/coaching.ts` and
  `snippets/types.ts` with Epic 2; `/writespec` sequences the edits.
- `lib/presentation/index.ts` owns the label chain; `revealed` takes precedence
  over the selection cases, below `solved`.

## Assumptions

- "Revealed" is the whole label — no answer in it. The panel beside it names
  the answer.
- The existing SolvedPanel tests that assert the given-up line flip to assert
  its absence; the ones asserting the muted tone token go with it.

## Question log

### Cycle 1 — 2026-09-03

**Q1. What tone does the *Revealed* button take?**
Answer: **A) The idle tone** — "similarly to showing solved" is the label
pattern; the green stays with the solve.
Applied to: R3, AC1
