# 2 — Always four chords

## What

* Every groove's progression names four chords, one per bar. No more wrapping a
  3-chord cycle over 4 bars.
* The generator appends the home chord as the 4th when its roll gives 3. The
  3-or-4 draw itself stays, so the `events` stream and every mp3 are unchanged.
* The 17 existing 3-chord grooves get their home chord written out as bar 4 in
  the manifest. Same chords the audio already plays.
* The 13 four-chord grooves are untouched.

## Done when

* Every entry in `grooves.generated.ts` has 4 chords in `progression` and 4 in
  `progressionDegrees`; a manifest test asserts it.
* Rendering with `--manifest-only` leaves every mp3 hash in `grooves.lock.json`
  as it is; `npm run grooves:verify` is green.
* A generator test covers a 3-roll ending on the tonic.
* `docs/music.md` says four chords, not "3–4".

## Open questions

_None._

## Notes

* Size test: **passes.** One module (catalogue: `scripts/grooves/` and the manifest it writes), none of the four frozen things touched, one revert. `docs/music.md` sits in no module.
* **The premise needs one more edit than the ticket names.** `events.ts`'s `nextRootAt` decides whether the bass walks into the next bar by comparing chord *indices*: for a 3-chord cycle, bar 4 → bar 1 is index 0 → 0, so no approach note. With a 4th entry it becomes 3 → 0 and bar 4 gains a chromatic approach into the tonic — 17 mp3s change. Fix: compare the two roots (`chords[next][0]` vs `chords[here][0]`) instead of indices. Equivalent for every existing progression, since consecutive degrees never repeat, and a no-op for the padded bar. The `direction` draw on `rhythmRng` happens before the null check, so the draw count is untouched either way.
* `buildHarmony`: keep the `3 + floor(rng() * 2)` draw and the `while` loop exactly as they are, then pad `chosen` with the tonic until it has four. The `others.length === 0` case (length 1) pads to four tonics too; no shipped flavour hits it.
* Files:
  * `scripts/grooves/theory/harmony.ts` — the padding. `theory/harmony.test.ts`: the "three or four" test becomes exactly four; a new test drives `buildHarmony` with an rng that rolls 3 and asserts the 4th degree is 0 and its midi equals `chordMidi` (Done-when bullet 3).
  * `scripts/grooves/events.ts` — `nextRootAt` compares roots. `events.test.ts`: the `isApproach` helper and the "walks into every chord change" test do the same, so they stop expecting an approach into bar 1.
  * `scripts/grooves/harmony.test.ts` (the fixture test) — `harmony.fixture.json` pins the pre-feature-13 progression *strings* for all 30 grooves; 17 of them would now differ. The comparison maps both sides to four bars (wrap) before comparing, so the fixture stays untouched and keeps proving "the same chords in the same bars". Rewriting the fixture would work too, but would replace the evidence with the thing under test.
  * `src/features/daily-groove/data/grooves.generated.ts` + `scripts/grooves/grooves.lock.json` — `npm run grooves -- --manifest-only`, which rewrites `manifestSha256` and no mp3 hash. `data/grooves.generated.test.ts`: every entry has 4 chords and 4 degrees (Done-when bullet 1).
  * `docs/music.md` line 125 — "run 3–4 chords" → four chords, one per bar, with the roll completed by the tonic. `docs.test.ts` does not check this line.
* **Done-when bullet 2 does not prove the audio is unchanged.** `--manifest-only` skips encoding, so the mp3 hashes cannot move and `grooves:verify` is green regardless. The proof is `node scripts/grooves/rerender-check.ts`: a full render into a scratch dir compared against the committed lock. It will report `manifest MISMATCH` (expected — the manifest changes) and must report `30 of 30 grooves match`. The build run does this and puts the line in `## Built`.
* The app's `src/lib/theory/changes.ts` (`perBar`, `barChords`) and `numerals.ts` still wrap shorter lists over four bars. Left alone: for the shipped data the wrap is now the identity, and app tests build 3-chord grooves by hand on purpose. Removing it is a second module and a separate ticket if wanted.
* `validity.ts`, `gate.ts`, `select.ts` and `pools.ts` check nothing about length; a padded progression cannot create a new scale-and-progression collision, since two entries with the same first three chords were already equal.
* `musician`, per §7: dispatched at build with one narrow brief — confirm that naming the tonic again in bar 4 is the right lead-sheet reading of what already plays, and whether any of the 17 should show a different symbol. It decides wording, not code.

## Built
* `scripts/grooves/theory/harmony.ts` — after the roll and the draw loop, `chosen` is padded with the tonic to four chords; no rng draw added
* `scripts/grooves/events.ts` — `nextRootAt` compares the roots of this bar's and the next bar's chord instead of their indices, so the written-out bar 4 walks nowhere, exactly as the wrapped one did
* `src/features/daily-groove/data/grooves.generated.ts` — re-rendered `--manifest-only`: 17 progressions and degree arrays gain the tonic in bar 4, `PROGRESSION_POOL` follows; the 13 four-chord entries unchanged
* `scripts/grooves/grooves.lock.json` — `manifestSha256` only; every mp3 hash as before
* `docs/music.md` — "Progressions" paragraph says four chords, one per bar, a draw of three completed by the tonic (wording from the `musician`)
* `musician`: confirmed the tonic symbol again in bar 4 is the honest reading for all 17 — bar 4 already plays the identical midi set as bar 1 — and that tonic across the pass seam is a held chord, not a repeat
* tests: `theory/harmony.test.ts` (+3: exactly four; a 3-roll ends on the tonic with `chordMidi`/`chordName` in bar 4; a 4-roll untouched; draw count 3 / 4 unchanged); `events.test.ts` (approach-note helper, R7, R8 and R8a compare roots, not indices); `scripts/grooves/harmony.test.ts` (fixture compared bar for bar, `harmony.fixture.json` untouched, +1 test that a 3-chord cycle and its four bars read the same and a different bar 4 is still reported); `data/grooves.generated.test.ts` (+1: four chords and four degrees per entry; the feature-9 pins compare via `barChords`)
* audio proof: `node scripts/grooves/rerender-check.ts` — full render into scratch against the committed lock: **30 of 30 grooves match**, manifest match, catalogue match, exit 0
* checks: lint — 0 errors, 1 pre-existing warning (`gate.test.ts` unused import) / tsc — pass / test — 130 files, 2666 pass / test:gen — 38 files, 827 pass / build — pass, `grooves:verify` 30 grooves, 24 notes
