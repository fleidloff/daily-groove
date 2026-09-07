# 13 — The bass register's lower end

## What

* Move the bass register's floor down to the lowest note the library actually
  sampled — **C♯1, sounding MIDI 25** — so a root in C♯, D or D♯ stops being
  lifted an octave to MIDI 37–39 and sits on the low string instead.
* The lower end is the lowest **sampled** note, not the lowest one the pack can
  interpolate. `scripts/grooves/samples/pack.json` bottoms out at MIDI 25 and
  covers down to 23 within the repo's 2-semitone bound, but MIDI 23 is not a
  note this instrument has: feature-27 shipped a Squier Bass VI whose lowest
  string is E1 (MIDI 28), and C♯1 comes from a detuned low string the library
  recorded — Track A's word for it was "a slacker string than the rest".
* So this is **not** a 5-string low B. A low B would be pitch-shifted from the
  C♯1 sample, and the register would then claim a note the recording does not
  hold.
* The constant is `BASS_FLOOR_MIDI = 28` in `scripts/grooves/events.ts:45`, and
  `inRegister` (`:359-362`) is what lifts anything below it by an octave.
* **C stays at C2 (MIDI 36), and that is correct rather than a leftover.** C1 is
  24, below the library's floor, and C2 is where a bass plays C anyway — it is
  the lowest C a four-string has.
* **The high note that started this ticket is a different mechanism, and the
  floor change does not touch it.** groove-02 bar 2 beat 1 is MIDI 47 (B2) under
  the Bm7: B folds to B1 (35) legitimately, above any floor at or below 35, and
  then `BASS_OCTAVE_LIFT` takes it to 47 under `BASS_CEILING_MIDI = 48`.
  Lowering the floor cannot reach B0 (23), so B keeps folding to 35.
* Whether the octave pop is constrained too is **open**. It fires from two sites
  in `events.ts`: a 32% per-note roll (`BASS_OCTAVE_CHANCE`, `:612`) and one that
  **always** lifts the highest liftable note of every figure (`:675-679`), both
  capped by `BASS_CEILING_MIDI = 48`. The pop is a funk idiom worth keeping; the
  question is whether it should be allowed to fire on a note already at the top
  of the fold window.
* Rewriting the fold is the real work if the window is ever to start anywhere
  but a C: `inRegister` computes `base + pitchClass`, which only lands on the
  right pitch class because `BASS_BASE_MIDI` is 24. A floor at C♯1 works within
  that arithmetic; an anchor at B0 would not.
* This re-renders the whole catalogue, so feature-27's twelve `SIGN_OFFS` pins go
  void and need a fresh listening pass.
* No new random draws are involved, so `MUSIC_LABEL`'s draw order is untouched
  and every committed puzzle answer, name and tempo stays put. `ROTA_EPOCH` does
  not move and no groove is minted.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* `BASS_FLOOR_MIDI` is 25, and no bass note the catalogue asks for sounds below
  the lowest sampled note.
* A groove whose root is C♯, D or D♯ places that root at MIDI 25–27 rather than
  37–39, shown by a measurement over the committed catalogue rather than by
  reading the constant.
* `BASS_PLAYED` in `scripts/grooves/pack.test.ts` states the range the catalogue
  actually asks for, re-measured — it reads `{ lowest: 24, highest: 47 }` today
  and the tree asks 28–48.
* `scripts/grooves/samples/pack.test.ts`'s note-spacing assertion still holds: no
  note the generator asks for is more than 2 semitones from a sample.
* The B2 that started this ticket is resolved either way, in writing: groove-02
  bar 2 beat 1 is either lower, or deliberately kept at 47 with the reason
  recorded.
* The catalogue is re-rendered, `npm run grooves:verify` is clean, and all seven
  gate checks pass over every groove with RMS inside −29…−20 dBFS.
* `gain.bass` is re-checked per feel — a register that reaches four semitones
  lower changes each feel's energy, and feature-27 measured the nine gains
  against the old floor.
* The twelve `SIGN_OFFS` entries are re-pinned after a fresh listen, and the
  verdict's words and scope are recorded with them.
* Puzzle answers are provably untouched: every uuid in
  `src/features/daily-groove/data/grooves.generated.ts` keeps its scale, chord,
  root and bpm, `src/lib/hash.ts` and its fixed table are unchanged, and
  `ROTA_EPOCH` is not bumped.

## Open questions

_None to tick._ The size test fails, so the ticket does not continue here — see
`## Notes`. The octave-pop question `## What` leaves open is a design decision
for the feature, not a two-option pick, and this change forces it rather than
deferring it (below).

## Notes

* Size test: **fails**, on questions 1, 3 and 4. This goes to `/create-feature`.
  1. **Five bullets: no.** The work is one constant, plus a decision on the
     octave pop, plus re-rendering 50 of 54 grooves, plus re-measuring
     `BASS_PLAYED`, plus re-checking `gain.bass` in nine templates by ear, plus
     re-pinning twelve `SIGN_OFFS` after a fresh listen, plus the lock, both
     manifests, `events.fixture.json` and the one hard-coded floor assertion.
     Quick-12's `## Built` is the precedent for how many pin files a catalogue
     change moves, and that one re-rendered nothing.
  2. **Two modules: passes.** **catalogue** alone — `scripts/grooves/`,
     `public/grooves/`, `src/features/daily-groove/data/grooves.generated.ts`.
     No `src/` production file is opened.
  3. **Frozen things / re-render: fails on the re-render clause.** The four
     frozen things are genuinely untouched, and that is checked below rather than
     assumed. But 50 of 54 grooves re-render, measured, and the skill's own test
     is that a change which re-renders the catalogue is never quick.
  4. **One revert: fails today.** Not because of this change's shape — because
     feature-27's entire bass swap is uncommitted in the working tree, so a
     commit made now carries both and one `git revert` takes feature-27 with it.

* **The arithmetic in `## What` is right on every count.** `inRegister`
  (`events.ts:359-362`) returns `24 + pitchClass`, lifted by 12 when it lands
  under the floor. At 25: C is 24, still under, still folds to 36 — so C stays at
  C2 by the same rule that used to lift it, not by an exception. C♯/D/D♯ land on
  25/26/27 and stay. B is 23, unreachable from a floor at 25, so it keeps folding
  to 35 and groove-02's B2 is untouched by the floor.

* **No draw moves, so no committed answer moves.** `rest`, `repeat` and `drop`
  are all drawn unconditionally at `events.ts:596-598`, before the floor is
  consulted, and `direction` at `:619`. `inRegister` is pure arithmetic on
  already-drawn values. `MUSIC_LABEL`'s order, `src/lib/hash.ts`, the `FLAVOURS`
  order and every `uuid` are unread by this change, and the catalogue length
  holds, so `ROTA_EPOCH` does not move either. `## What`'s last bullet stands.

* **It re-renders 50 of 54 grooves, not the 12 rooted C♯/D/E♭.** Measured over
  `scripts/grooves/events.fixture.json`: 502 of 2474 bass notes (20.3%) sit at
  MIDI 37–39 today, spread across 50 grooves. `inRegister` is called per chord
  tone at `events.ts:611`, not only on the bar's root at `:600`, so any
  progression containing a C♯, D or D♯ chord tone moves — which is nearly all of
  them. The 12 grooves whose *root* drops are C♯ ×5, D ×3, E♭ ×4.

* **The floor change makes the octave pop reachable on the three notes it could
  never fire on, so `## What`'s open bullet is answered by this change rather
  than after it.** Today pc 1/2/3 fold to 37/38/39 and `37 + 12 = 49` exceeds
  `BASS_CEILING_MIDI = 48`, so both pop sites fail their guard on every C♯/D/D♯
  note in the catalogue — the 32% roll at `:612` and the always-lift at
  `:675-679`. At 25/26/27 both guards pass. Lowering the floor therefore adds a
  pop site as a side effect, and "leave the pop alone" is not the null option.

* **Two more behaviours move off the same constant.** `bottom` (`:673`) drops
  from 28 to 25 in the affected grooves, widening the `note.midi > bottom` filter
  the always-lift reads — marginal, since the lift picks the maximum. And the
  approach note at `:626-629` reads the floor directly: for pc 1 the target goes
  37 → 25, `24 >= 25` is false, so a C♯ chord change is approached from 26
  whatever `direction` rolls. On that one pitch class the chromatic approach flips
  from below to above.

* **Feature-27 is 🔨 In progress and uncommitted** — `specs/features.md:45`, and
  `git status` carries 184 paths: 54 mp3s, `samples/pack.json`, all nine
  templates' `gain.bass`, `grooves.lock.json`, `gate.test.ts`'s twelve fresh
  pins, `docs/music.md`. Two consequences beyond question 4:
  * Its epic-1 contract **C2 freezes exactly what this ticket edits**.
    `specs/features/feature-27/tech-spec/epic-1-every-groove-is-carried-by-an-electric-bass.md:197`:
    "`events.ts` is untouched, so the register the generator asks for is exactly
    today's: `BASS_BASE_MIDI = 24`, floor `28`, ceiling `48`, and `BASS_PLAYED`
    … stays as written." `scripts/grooves/samples/pack.test.ts:349` repeats it as
    a comment on the constant itself.
  * The pack's 2-semitone bound is the one thing this change *helps*, and it
    helps because feature-27 already shipped the samples for it. Nothing here is
    blocked on the pack.

* **The twelve `SIGN_OFFS` were pinned this morning, 2026-09-07, by feature-27
  epic 1** — `gate.test.ts:700`, ids groove-01, 07, 08, 17, 28, 38, 40, 48, 58,
  65, 71, 78, covering nine feels and five ride figures. This change voids all
  twelve, since every pinned groove is one of the 50, and owes a fresh
  full-catalogue listen — the second in a day. The table's own preamble states
  that rule.

* **`gain.bass` cannot be dropped from the scope.** feature-27 re-measured all
  nine templates from −4.0 … +1.0 to −19.0 … −23.4 against a floor of 28
  (`gate.test.ts:656`). A fifth of bass notes moving twelve semitones down
  changes each feel's low-end energy, and `docs/music.md` § *What the gate cannot
  do* puts the per-voice gains behind a listening sign-off rather than a
  measurement. `## Done when` bullet 7 is correct to ask for it, and it is most
  of why this is not a quick change.

* Files the change is expected to touch, once it is a feature:
  * `scripts/grooves/events.ts:45` — `BASS_FLOOR_MIDI` 28 → 25, plus whatever
    the pop decision costs at `:612` and `:675-679`.
  * `scripts/grooves/events.test.ts:231` — `expect(event.midi).toBeGreaterThanOrEqual(28)`,
    the only hard-coded floor assertion in the tree. The red step.
  * `scripts/grooves/pack.test.ts:344-350` — `BASS_PLAYED` and the comment
    paragraph above it, which names the floor and cites feature-27's C2. The
    lowest value `inRegister` can return becomes 25, exactly the lowest sampled
    note, so `:456`'s shortfall goes 1 → 0 and `samples/pack.test.ts:255`'s
    spacing assertion gets easier. `## Done when` bullets 3 and 4 pass for free.
  * `public/grooves/groove-*.mp3` — 50 of 54 rewritten.
  * `scripts/grooves/grooves.lock.json` and
    `src/features/daily-groove/data/grooves.generated.ts` — regenerated.
  * `scripts/grooves/events.fixture.json` — regenerated. Unlike quick-12's pure
    append this rewrites ~500 bass lines in place.
  * `scripts/grooves/gate.test.ts:700` — twelve entries re-pinned.
  * `scripts/grooves/templates/*.ts` × 9 — `gain.bass`, if the listen says so.
  * `docs/music.md:325-329` — the *Voicing* paragraph names the floor as 28, calls
    it "the open low E of a four-string", and says "only C, C♯, D and D♯ come up
    an octave". All three sentences change, and `## What`'s own reasoning is the
    replacement for the second one.

* **What does not change, checked rather than assumed:**
  `scripts/grooves/harmony.fixture.json` (no chord moves), the groove names
  (`name.ts` reads no pitch), the tempi, `ROTA_EPOCH`, `src/lib/hash.ts` and its
  fixed table, `LeadSheet.test.tsx`'s widest-symbol pin, and
  `src/features/daily-groove/data/notes.generated.ts` — the 24 reference notes
  are not bass renders. `events.test.ts:463`'s bass-below-comp bound holds with
  room, since the comp floor is 55.

* **Why this is a feature and not a ticket trimmed until it fits.** Three
  decisions, not one: the floor value, whether the pop is constrained now that it
  can fire on the bottom three notes, and nine gain values. Each needs its own
  listen, and the sign-offs feature-27 pinned this morning go void the moment the
  first render lands. That shape is a roadmap of at least two epics — the register
  change with its measurement, then the balance pass — which is what
  `/create-feature` is for. Nothing in `## What` or `## Done when` was trimmed,
  and neither section was edited.
