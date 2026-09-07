* move the bass register's floor down to C♯1, sounding MIDI 25 — the lowest note the Bass VI library actually sampled
* a root in C♯, D or D♯ then sits on the low string instead of being lifted an octave to MIDI 37–39
* the lower end is the lowest *sampled* note, not the lowest the pack can interpolate — this is not a 5-string low B, which would be pitch-shifted from the C♯1 sample
* C stays at C2: C1 is below the library's floor, and C2 is the lowest C a four-string plays
* whether the octave pop is constrained is open — lowering the floor lets it fire on the bottom three notes, where the ceiling used to block it
* groove-02 bar 2 beat 1 (B2) is a different mechanism and the floor change does not reach it — resolve it either way, in writing
* re-render the whole catalogue, re-check `gain.bass` per feel, and re-pin the twelve `SIGN_OFFS` after a fresh listen
* puzzle answers stay provably untouched — no new draws, `MUSIC_LABEL`'s order and `src/lib/hash.ts` unchanged, no `ROTA_EPOCH` bump, no groove minted
* feature-27 is committed (`f282391`), so its epic-1 contract C2 — which froze `events.ts` and `BASS_PLAYED` — is discharged and this is clear to start; the twelve `SIGN_OFFS` it pinned on 2026-09-07 are what this voids
