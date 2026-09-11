# 0002. The answer is an absolute root and mode

- **Status:** ✅ Accepted
- **Date:** 2026-08-21
- **Source:** [feature-1, epic 1 Q1](../../specs/features/feature-1/prd/)

## Context

A groove can be guessed at several strengths: name the quality only ("minor
seventh"), name it relative to something, or name the actual pitch it sits on.

## Decision

The player answers with an absolute root and an absolute mode — C Dorian, not
"a dorian groove".

## Consequences

- Naming a pitch by ear alone is the hard half of the puzzle, and every ear aid
  since — the root taps of [0021 — The ear aids play one sound, and there is no instrument on screen](0021-the-ear-aids-play-one-sound.md), the narrowing
  hint of [0028 — The hint narrows; only solving or giving up reveals](0028-the-hint-narrows-only-the-reveal-reveals.md) — exists because of
  this line.
- The manifest has to carry absolute answers, which is what makes
  transposition ([0037 — Transposition changes what is written, never what is heard](0037-transposition-changes-what-is-written.md)) a re-spelling
  of the whole puzzle rather than a display option.
- It rules out a relative-pitch game, which would have been a different app.

## Alternatives considered

- **Quality only, no root** — easier, and would have removed the one thing the
  player has to hear rather than recognise.
