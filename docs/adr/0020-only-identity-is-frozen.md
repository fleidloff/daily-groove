# 0020. Only a groove's identity is frozen; its audio may always re-render

- **Status:** ✅ Accepted — supersedes [0011 — A minted groove's audio is frozen forever](0011-a-minted-grooves-audio-is-frozen.md)
- **Date:** 2026-08-31
- **Source:** [feature-9](../../specs/features/feature-9/briefing.md) · [docs/music.md](../music.md#what-must-never-change)

## Context

[0011 — A minted groove's audio is frozen forever](0011-a-minted-grooves-audio-is-frozen.md) made every generator improvement apply
only to grooves minted after it. feature-9's whole premise — real samples,
per-voice timing, voice-led comping, sixteen-bar loops — was a re-render of the
catalogue, so the freeze rule had to go. But something has to stay fixed, or a
past date silently gets a different puzzle.

## Decision

The line moves from content to identity. Re-rendering every MP3 is always
allowed, and so is changing what a groove *is* — its chords, its feel, its
style — when the new one is better. A groove is a slot, not a record. What never
changes:

- `src/lib/hash.ts`, pinned by a fixed table in `hash.test.ts`. It seeds the
  generator *and* picks the player's groove of the day.
- `MUSIC_LABEL = 'events'` and its draw order. Every committed answer derives
  from that stream, so nothing may be added to it — new randomness gets its own
  labelled stream.
- The order of `FLAVOURS`, and each template's own `flavours` list.
- A groove's `uuid`, minted once ([0023 — Every groove carries a uuid, and the share link is that uuid](0023-every-groove-carries-a-uuid.md)).

## Consequences

- Sound improvements are never weighed against the catalogue they invalidate —
  ship the better sound. This is what makes
  [0024 — Swapping the recording behind a voice is a normal change](0024-swapping-a-voice-is-a-normal-change.md) and the whole run of bass and
  comp tickets ordinary work.
- Adding a voice means adding an RNG stream, not a draw. The bongos, the ride
  and the drawn snare line each got one for that reason.
- `grooves.lock.json` and `npm run grooves:verify` on `prebuild` catch a
  violation.
- Past puzzles' audio changes while their answers do not, and players holding a
  memory of how a day sounded are not protected. That is accepted.
