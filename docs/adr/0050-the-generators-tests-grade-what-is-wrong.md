# 0050. The generator's tests grade what is wrong, not what is different

- **Status:** 🤔 Proposed
- **Date:** 2026-09-08
- **Source:** [quick-16](../../specs/quick/16-hand-editable-templates.md)

## Context

`docs/music.md` says re-rendering every MP3 is always allowed
([0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md)), so changing a feel is meant to be a normal
thing to do. In practice it was not: editing a step list in a template failed
tests that asserted the literal steps, so a hand edit cost a test rewrite every
time.

## Decision

The generator suite catches a template that is *wrong*, not one that is
*different*. Editing any step list, pool length, `PLACEMENTS` or `FILLS` entry,
or a feel's `tempoRange`, `swing`, `density`, `gain`, `pan`, `humanize` or the
chord vocabulary in `theory/harmony.ts` leaves `npm run test:gen` green, as long
as the edit is musically legal. An edit that is genuinely wrong still fails, and
says which rule it broke rather than which literal moved. No test derives its
expectation by reading the same declaration it is checking.

## Consequences

- Musical judgement moves out of the assertions and into the legality rules, so
  the rules have to be written down — the tests stop being a second, implicit
  specification of the templates.
- A regression that is musically legal and still bad is caught by ear
  ([0008 — How a groove sounds is settled by ear](0008-how-a-groove-sounds-is-settled-by-ear.md)) alone. That is the trade.
- Nothing renders: no MP3, no manifest, no lock, no catalogue entry.
- Not settled. The ticket still has questions open.
