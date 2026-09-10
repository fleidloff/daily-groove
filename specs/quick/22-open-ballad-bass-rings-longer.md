# 22 — Open ballad bass rings longer

## What

* Every `open-ballad` bass note rings longer than it does today.
* Bass sustain is 2 sixteenths for every feel right now — `events.ts:1030` passes
  `note.sustain ?? 2`, and only the walking-bass path overrides it. At
  open-ballad's 62–74 bpm that is roughly 440 ms.
* `FeelTemplate` has no bass-sustain field, so one has to be added for
  open-ballad to declare.
* How much longer is a musical decision, not a number Fred named.
* The five `open-ballad` grooves are re-rendered.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* An `open-ballad` bass event's `durationSec` is longer than the two-sixteenth default.
* The other eight feels' bass durations are unchanged.
* The five open-ballad mp3s are re-rendered and their `SIGN_OFFS` entries re-pinned
  after Fred has listened.
* A test covers the longer sustain reaching open-ballad's bass events and not another
  feel's.

## Open questions

_Nothing open. Q1 is answered below._

### Q1. "Every bass note rings longer" is not reachable. Which reading do you want?

The bass pool `[[0,8],[0,8,14],[0,6,10],[0,8,10]]` plus the chromatic approach note
at step 15 puts some notes 1–2 sixteenths apart. A longer ring for *those* either
overlaps the next note or has to be clipped, so one of the three has to give.

- [x] A) **Ring to the next bass onset, floored at today's 2 sixteenths, capped at 6.**
  No note rings shorter than today; 57–75% ring 2–3× longer; the 6–13 notes a groove
  that have a neighbour within 2 sixteenths stay exactly as they ship now. Long notes
  land on beats 1 and 3, short ones on the pickups. *(recommended — the `musician`
  measured this as the only option where the step-15 approach note cannot ring an
  off-scale semitone into the next bar under the new chord, which in a game about
  naming the scale by ear is the difference between untidy and misleading)*
- [ ] B) Ring to the next bass onset with no floor. Every note rings exactly up to its
  neighbour, which **shortens** the step-14/15 pickup pairs from 0.44 s to 0.22 s.
- [ ] C) A flat longer sustain, no clamp — literally every note longer, which is what
  `## What` asks for. Costs: 16–26 of a groove's 22–30 bass notes overlap, 4–13 of
  them within a whole tone, which at MIDI 25–26 beats at 2–8 Hz; and the approach note
  rings ~1.1 s past the bar line under the new chord. `theory/pitches.ts` exempts the
  approach note by its **onset** only, so the quality gate cannot see this.

## Answered — Q1-A

**Q1-A. Ring to the next bass onset, floored at today's 2 sixteenths, capped at 6.**

What follows from it:

* The sustain of a drawn bass note is
  `max(2, min(template.bassSustain ?? 2, gap to the next bass onset in sixteenths))`.
  With `bassSustain` absent the expression collapses to 2, so the other eight feels
  render byte-identical and only open-ballad's five mp3s move.
* ~~No bass note overlaps the next one, so the line still reads as one instrument.~~
  **Also wrong, and the load-bearing half of the correction below.** Six to eight notes
  a groove overlap the next by exactly one sixteenth — mostly the step-15 approach over
  the following downbeat, plus groove-51 bar 2's `[0, 8, 14, 15]` where step 14 overruns
  the approach beside it. It is the floor of 2 beating a gap of 1, so it is what the feel
  already does with no `bassSustain` at all: groove-79's approved audio is no worse than
  it was. What the clamp gives is a **bound** — one sixteenth rather than the five a flat
  cap of 6 would overhang by.
* ~~The step-15 chromatic approach note stops at the next bar's downbeat, because the
  first note of a bar never rests.~~ **Wrong, and corrected after the build by the
  verifier.** The gap from step 15 to the next bar's step 0 is one sixteenth, which
  loses to the floor of 2, so the approach note rings about 0.22 s past the bar line on
  all five grooves. That is what it already does with no `bassSustain` declared, so
  nothing regressed — but A does not *fix* the off-scale overrun the way this bullet
  claimed, and the reason A beat C was overstated. What A does deliver against C is a
  **bounded** overrun: one sixteenth where a flat cap of 6 would have given five.
* **`## What`'s first bullet is not met literally, and that is now a decision rather
  than an oversight.** Per groove, 6–13 of the 22–30 bass notes have a neighbour
  within 2 sixteenths and keep exactly the length they ship with today. No note rings
  shorter than today; 57–75% ring 2–3× longer; mean effective length is 2.0–2.3×.
* Note length varies by position — long on beats 1 and 3, short on the pickups —
  rather than being one number per feel.

## Notes

**Size test: all four pass.** Re-run against Q1-A, which changes none of the four:
the clamp lives in the same three files the flat version would have, adds no module,
adds no draw, and reverts in the same commit.

1. Nameable in five bullets. ✅
2. One module of six — catalogue. `scripts/grooves/` plus the lock; no answer in
   `data/grooves.generated.ts` moves, because bpm, root, flavour, chord and
   progression are untouched. ✅
3. Nothing frozen. `docs/music.md` §What must never change is explicit: "The audio
   itself is not on this list. Re-rendering every MP3 is always allowed." The change
   adds **no RNG draw** — it is a duration pass over `bassFigure` after the figure is
   drawn — so `MUSIC_LABEL` and `RHYTHM_LABEL` draw order, `hash.ts`, the flavour
   order and every `uuid` stay put. ✅
4. One `git revert` — one commit carrying the generator change, the five mp3s, the
   lock and the re-pinned sign-offs. ✅

**Files this is expected to touch**

* `scripts/grooves/types.ts` — `FeelTemplate` gains `bassSustain?: number`. Precedent
  for a per-feel bass declaration is `bassType?: BassType`, already on both
  `FeelTemplate` and `GrooveSpec`.
* `scripts/grooves/templates/open-ballad.ts` — declares `bassSustain`.
* `scripts/grooves/events.ts` — the `note.sustain ?? 2` at the `add('bass', …)` site
  becomes floor/cap/gap. `note.sustain` keeps precedence, so the walking path's
  `BASS_WALK_SUSTAIN` (3.5) and `BASS_WALK_APPROACH_SUSTAIN` (2.5) are untouched.
* `public/grooves/groove-{49,51,77,78,79}.mp3` — the feel's five, re-rendered.
* `scripts/grooves/grooves.lock.json` — mp3 hashes and byte counts.
* `scripts/grooves/gate.test.ts` — the two open-ballad `SIGN_OFFS` entries,
  groove-78 and groove-79, are voided by the re-render and re-pinned after Fred
  listens.
* `scripts/grooves/events.test.ts` (or a new test) — the `Done when` bullet about the
  sustain reaching open-ballad and not another feel.
* `docs/music.md` — the bass section gains the rule and the cap, and *Where to change
  what* gains a `bassSustain` row.

**Assumptions taken rather than asked**

* **The cap is 6 sixteenths**, on the `musician`'s measurement: the pool's gap
  histogram is 1, 2, 4, 5, 6, 7, 8, 9, 10, 15, so 6 lets every note reach its gap
  except the `[0,8]` pairs; `BASS_REST_CHANCE = 0.18` opens 9–15-sixteenth gaps and
  the cap is what keeps a rest audible as space; and the bass samples are 2.000 s, so
  8 sixteenths at 62 bpm runs into the file's own fade and is the hard ceiling. Mean
  effective note length comes out 2.0–2.3× today's flat 2. If it sounds tied together
  rather than open, 5 is the next value down; if still clipped, 7.
* **`gain.bass` stays at −22.0.** Measured over the five renders, master RMS moves
  −0.12 to +0.47 dB and one groove gets *quieter* — the master pins true peak onto
  the ceiling, so the trim eats the added energy. What moves is bass-over-kick, mean
  +1.24 dB, which reproduces music.md's recorded 1.21 dB for `BASS_WALK_SUSTAIN` from
  the same cause. That takes open-ballad from the catalogue's third-least-forward bass
  (−6.74 dB) to about −5.5, level with second-line, boom-bap and straight-funk.
  Precedent: `shuffle` took +1.40 dB from this same cause at unchanged gain and was
  approved.
* **The gap is measured in grid steps on `bassFigure`, not from humanized `timeSec`.**
  Kick and bass share a ±11 ms timing walk, and feeding that into duration would
  jitter note length per note for no musical reason.
* No gate check is at risk: seam measures 0.0000–0.0009 against a 0.02 limit, all five
  stay mid-window against the −29…−20 dBFS bounds, and density counts events, not
  durations.

**Things in the tree worth knowing before this is built**

* **`gate.test.ts`'s anchor rule re-picks.** The test *"pins the groove that moved most
  in every registered feel"* asserts that a feel's anchor is the argmax of
  `lowRegisterShare`, and that function weighs bass note-**time**, not note count
  (`scripts/grooves/lowRegister.ts:23`). A longer sustain moves the shares, so
  open-ballad's argmax may stop being groove-79 — in which case the test names a
  different groove and that one has to be played and pinned.
* **Quick-20 tried a longer bass on this feel and it was rejected**: the walking bass
  ran on groove-49, groove-51 and groove-77 as a trial, and the verdict was "for
  open-ballad, I don't like it… remove it from open-ballad" (`gate.test.ts:826`). That
  was the walking *line* — quarters with a chromatic approach — not a longer ring on
  the drawn figure, and this ticket keeps the figure. Named because it is the closest
  thing on the record to a no.
* **The final bass note of the loop is clipped whatever the cap is.** `fitToLoop` in
  `humanize.ts:84` truncates `durationSec` to `loopSec - timeSec`, and the bass has no
  overhang bar to ring into the way the cymbals do. A longer ring makes that cut more
  audible at the seam, not less.
* **Quick-16 is open** and asks for generator tests that stop pinning a feel's
  declarations to today's literals. The new test should assert the floor/cap/gap
  behaviour, not the number 6.
* One thing the `musician` found and left out of scope: in `[0,8,14]` the step-14 note
  survives beside the step-15 approach only because the approach filter drops step 15
  and not 14. Suppressing 14 when an approach is drawn would give the pickup one note
  instead of a gap-1 pair — but that changes pitches, not durations, and is its own
  ticket.

## Built

* `scripts/grooves/types.ts` — `FeelTemplate` gains `bassSustain?: number`, beside
  `bassType`.
* `scripts/grooves/events.ts` — exports `BASS_SUSTAIN_DEFAULT = 2`; a `bassRing`
  closure reads the gap to the next bass onset off the grid and returns
  `max(default, min(cap, gap))`; the `add('bass', …)` site passes
  `note.sustain ?? bassRing(barInPass, note.step)`, so the walking path's own lengths
  still win.
* `scripts/grooves/templates/open-ballad.ts` — `bassSustain: 6`.
* `scripts/grooves/events.fixture.json` — re-baselined. Five of 54 entries moved, all
  `open-ballad`; inside them only `bass` events differ and only in their duration
  field. Every `music` block is identical, so no puzzle answer changed.
* `public/grooves/groove-{49,51,77,78,79}.mp3` and `scripts/grooves/grooves.lock.json`
  — re-rendered. `src/features/daily-groove/data/` has an empty diff.
* `docs/music.md` — a **Note length** block in §Voicing, a `bassSustain` row in
  §Where to change what, and the stale 0.462 s figure in §Mix marked as the
  measurement it was.
* tests: `scripts/grooves/events.test.ts`, a `quick-22` describe block of eight —
  the cap, the floor, the gap, the bounded overrun, the ceiling on any declared cap,
  the other eight feels on the default, and `note.sustain` keeping precedence over a
  ring (asserted as: declaring `bassSustain` on a walking feel changes nothing).
* checks: lint clean · `npm test` 3060 passed · `npm run build` passes, including
  `grooves:verify` · `npm run test:gen` 1615 passed, **2 failed**.
* verifier: **fail — the only failure is the planned one.** Report at
  `specs/quick/.verify/22.md`, citations checked and all three resolving.
  * D1 — `durationSec` longer than the default: **done**. 82 of 130 bass notes longer,
    48 unchanged, 0 shorter.
  * D2 — other eight feels unchanged: **done**, and independently confirmed against
    the fixture's 49 untouched entries.
  * D3 — five mp3s re-rendered and `SIGN_OFFS` re-pinned: **partly**. Re-rendered;
    **not** re-pinned. groove-78 and groove-79's pins are void by design and only an
    ear can re-give them.
  * D4 — a test covers the ring reaching open-ballad and not another feel: **done**.

**What is left, and it is not code.** `npm run test:gen` will fail on those two pins
until Fred plays the five grooves and the hashes are re-pinned in his words. The test's
own message is the instruction: "render it, play it, get it approved, and only then
re-pin this hash. Do not re-pin it to make the suite green." Three things to listen
for, from the `musician`'s handover: whether 6 is the right amount (5 down, 7 up, 8 the
ceiling), whether the unequal note lengths read as one player, and whether holding
`gain.bass` at −22.0 has left the bass level with the band or forward of it (−23.2
restores the old balance exactly).

**Two claims this ticket made and the verifier struck.** Both are marked in
`## Answered — Q1-A` above rather than quietly removed: the clamp does not stop the
step-15 approach note at the bar line, and it does not end overlap. Six to eight notes
a groove still overrun by one sixteenth, which is what the feel already did. The clamp
bounds the overrun; it never removed it.

## Heard, and the cap came down — 2026-09-10

Fred played the five renders at `bassSustain: 6` and the verdict was that the bass rings
"a little bit too long", with 4 or 5 offered as the replacement.

* **`bassSustain` is 5.** Five over four because it is the single step down from what was
  heard, and because the `musician`'s handover had already named it for this exact
  verdict — "if the feel now sounds *tied together* rather than *open*, 5 is the next
  value down". Four is the next step if five is still long.
* Re-measured at 5: mean effective note 3.57–4.17 sixteenths against the default's 2, so
  1.8–2.1× rather than 2.0–2.3×. Still 82 of 130 bass notes longer than the default and
  **none shorter**, so `## Done when`'s first two bullets are unaffected.
* The length comes off the `[0, 8]` pairs, whose gap of 8 was already capped at 6 and is
  now capped at 5. A note whose gap is 4 or 5 still reaches its own onset.
* The five mp3s and the lock were re-rendered again; the fixture was re-baselined and
  again only the five `open-ballad` keys moved.
* The two `SIGN_OFFS` pins stay void — this is a second unheard render, not a fix for the
  first.

## Heard and signed off — 2026-09-10

> "cap at 5 is perfect for open-ballad. checked all newly generated grooves"

* All four `## Done when` bullets now hold. **D3 closes**: the five mp3s were
  re-rendered and both `SIGN_OFFS` pins re-pinned in those words as
  `QUICK_22_APPROVAL` / `QUICK_22_SCOPE`.
* `scripts/grooves/gate.test.ts` — groove-78 → `1dc4d61d…35b4`, groove-79 →
  `5f08ed1c…0764`. Both keep `mp3: null` for the reason given on groove-40; the files
  played hash to `ed17b038…c7cd` (710 364 bytes) and `d2501e28…6302` (679 017 bytes).
* groove-79 stays open-ballad's anchor. The ring weighs on note-time and
  `lowRegisterShare` is measured in note-time, so the argmax could have moved — it did
  not, and the anchor test still names it.
* The now-orphaned `QUICK_18_APPROVAL` / `QUICK_18_SCOPE` were removed rather than left
  unused, with their words kept in the comment above `QUICK_22_APPROVAL`. The render
  they were given about no longer exists.
* `npm run test:gen` **1617 passed, 0 failed** · lint clean · `npm test` 3060 passed ·
  `npm run build` passes including `grooves:verify`.

**What this verdict does not reach.** The 2-sixteenth default the other eight feels keep
was raised in the same session and moved to its own ticket. Nothing here is a verdict on
it, and `QUICK_22_SCOPE` says so.
