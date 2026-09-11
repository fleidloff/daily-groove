# 0024. Swapping the recording behind a voice is a normal change

- **Status:** ✅ Accepted
- **Date:** 2026-09-01
- **Source:** [feature-13](../../specs/features/feature-13/briefing.md) · [feature-24](../../specs/features/feature-24/briefing.md) · [feature-27](../../specs/features/feature-27/briefing.md)

## Context

The first pack was what the CC0 libraries offered: a cajon as the kick, an FM
piano as the bass, a clavisynth as the comp. Every one of them was eventually
the wrong instrument, and each swap re-renders the whole catalogue.

## Decision

Replacing the recording behind a voice is ordinary work, not a re-release. The
edit is `samples/pack.json` and `samples/provenance.json`; the playing code does
not change. Every affected groove is re-rendered and every voided `SIGN_OFFS`
pin is re-pinned after a fresh listen.

## Consequences

- Rests entirely on [0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md): the answers are safe
  because the draw order is, so a swap touches sound alone.
- Done three times — the drum kit in feature-13, the ride in feature-24, the
  bass in feature-27 — each time with an audition before the catalogue was
  re-rendered.
- Levels are turned in two independent places and both have to be redone: the
  pack's `nominalVelocity` first, the template's `gain` after. quick-8 is what
  happens when only one of them is calibrated.
- `npm run notes` rewrites the lock's `packSha256`, and `npm run grooves`
  re-renders — two commands, and confusing them leaves the lock lying.
- A swap voids up to twenty sign-offs, so the cost of the change is measured in
  listening passes rather than in code.
