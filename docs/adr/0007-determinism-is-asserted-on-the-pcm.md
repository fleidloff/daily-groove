# 0007. Determinism is asserted on the pre-encode PCM

- **Status:** ✅ Accepted
- **Date:** 2026-08-29
- **Source:** [feature-3, epic 1 Q3](../../specs/features/feature-3/prd/)

## Context

The generator has to be deterministic: one seed, one groove, forever. The
obvious assertion is that the MP3 bytes come out identical, and they do not —
`ffmpeg` versions differ between machines.

## Decision

Determinism is asserted on the PCM buffer before encoding. The MP3 is treated
as a rendering of that buffer, not as the artefact under test.

## Consequences

- The generator's tests pass on any machine with any `ffmpeg`.
- The committed MP3s still need their own guard, which is why
  `grooves.lock.json` holds checksums and `npm run grooves:verify` runs on
  `prebuild` — a byte comparison against what was committed, not against a
  re-render.
- A re-encode with a different `ffmpeg` shows up as a lock mismatch and has to
  be committed deliberately.

## Alternatives considered

- **Assert MP3 bytes** — the strongest-sounding claim, and unprovable across
  machines.
