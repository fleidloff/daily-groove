# 0042. Three licks per mode, one picked for the day

- **Status:** ✅ Accepted
- **Date:** 2026-09-05
- **Source:** [quick-5](../../specs/quick/5-lick-variations.md)

## Context

`LICKS` held one hand-written phrase per mode. Played every day, it gets
memorised — and then the mode row tests recall of the lick rather than the ear.

## Decision

Three hand-written licks per mode, each still fitting that mode's scale. Which
one sounds is picked at random and holds for the day: tapping a mode twice on the
same day plays the same lick, and the pick changes tomorrow.

## Consequences

- Holding the pick for the day keeps the comparison stable — two taps of the same
  mode have to sound the same, or the aid is useless as a test.
- Three per mode across twelve modes is thirty-six phrases to write by hand, and
  every new mode costs three.
- The pick is derived from the date, so it needs no storage and stays consistent
  across a reload.
