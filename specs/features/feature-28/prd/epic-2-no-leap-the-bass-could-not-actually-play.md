# PRD — Epic 2: No leap the bass could not actually play

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Epic 1 drops the bass floor three semitones and leaves the ceiling where it is,
so the window the bass line moves inside widens from 20 semitones to 23 and both
octave-pop sites spend the extra room. This epic narrows it back — if Epic 1's
listening pass says the widened line reads as holes rather than as one
instrument. **It does not exist otherwise, and dropping it then is the right
outcome rather than a gap.**

## Problem

Measured across both floors:

| | floor 28 | floor 25 |
| :-- | --: | --: |
| span, median / max | 19 / 20 st | **22 / 23 st** |
| leaps ≥ 12 st | 365 (15.1%) | 472 (19.5%) |
| leaps **> 12 st** — what the bound actually re-voices | 278 | **385** |
| exactly 12 st — the leap the bound allows | 87 | 87 |
| leaps ≥ 18 st | 74 | **140** |
| largest leap | 20 st | **23 st** |

Nearly every new wide leap is a popped note at 46–48 followed by a fresh low fold
at 25–27 in the same bar — groove-20 and groove-79 both drop 23 semitones inside
one bar, groove-17 drops 22. Of the 385 leaps that exceed an octave, **374 have a
popped note on one side** and only 11 do not.

**And the octave lift is not an octave.** `events.ts:611-613` lifts
`chord[i % chord.length]` — the *next chord tone* — not the note before it, so
what is heard is 12 semitones plus the step between adjacent chord tones. That is
why the distribution peaks where it does: 15 semitones is an octave plus a minor
third (124 of them), 16 an octave plus a major third (57), 19 an octave plus a
fifth (42), 20 an octave plus a minor sixth (38). Exactly 12 happens only 87
times. `docs/music.md:332` presents the lift as one of "three things a bass player
does that an arpeggiator does not" — and as built it *is* the arpeggiator move.
This epic's repair is what makes the documentation true.

The argument against it is physical, not a matter of taste, and it can be made
without hearing anything: `docs/music.md` commits the bass to one instrument
played with a pick, and a −23-semitone leap three sixteenths apart is the 12th
fret of a Bass VI's top string to a detuned open low string in about 200 ms.

Two measurements say don't overreact, which is why this epic is conditional
rather than planned. The population of leaps that fall inside 160 ms does not
change at all, and the tightest case in the catalogue — groove-48 jumping 48 → 29
in 159 ms — predates this feature. The character is already leapy; Epic 1 makes it
about 50% more so and raises the maximum.

## Scope

- a leap bound in `scripts/grooves/events.ts` as a post-hoc repair pass — a rule
  on the interval between consecutive bass notes, not a narrowing of the register
- re-render, re-balance and re-pin, exactly as Epic 1 does
- the span, the interval distribution and the pop count measured over the
  committed catalogue and recorded

**Out of scope**
- **constraining the octave pop instead.** Measured as the wrong lever: it
  strands low notes beside unchanged high ones and raises leaps ≥18 semitones
  from 140 to 152, which is the opposite of this epic's purpose
- any change to the floor. Epic 1's verdict on that stands, and re-opening it
  here would mean Epic 1 was never done
- minting, `ROTA_EPOCH`, `src/lib/hash.ts`, the draw order — as Epic 1

## Requirements

- **R1** — **No two consecutive bass notes are more than an octave apart: the
  bound is 12 semitones, inclusive.** A figure that exceeds it is re-voiced rather
  than left to stand, and the result is measured over the committed catalogue
  rather than read off a constant.
- **R2** — The bound is inclusive because that is what a bass player would play:
  an octave between consecutive notes is a hand shape a pick player owns, and an
  octave plus a third is a string skip plus a position shift. Inclusiveness alone
  does not save the pop, though — the pop produces an exact octave only 87 times
  in 472, so under this bound the pop is **re-voiced to survive** rather than
  merely tolerated. R5 is what keeps it.
- **R3** — **Both ends of the register are kept.** `BASS_FLOOR_MIDI` stays 25 and
  `BASS_CEILING_MIDI` stays 48. The defect is the interval, so the interval is
  what the rule addresses — narrowing the window at the ceiling would fix a leap
  problem by spending three of the semitones Epic 1 bought and would block 20
  octave pops where Epic 1 blocks 9.
- **R4** — **When a leap exceeds the bound, the popped note's pitch class gives
  way and its register does not.** The note is re-voiced to exactly one octave
  above the note it leaves, so the leap becomes an octave rather than an octave
  plus an interval. Dropping the pop instead collapses the catalogue's span to 11
  semitones and leaves 22 pops in 54 grooves; folding the low note up instead
  nearly doubles the notes above MIDI 40, from 105 to 194, which is Epic 1 in
  reverse; re-voicing to the nearest chord tone instead leaves 5 pops in the whole
  catalogue. All three were measured and all three fail R5.
- **R5** — The octave pop survives as an idiom, and every feel keeps it.
  `docs/music.md:332` counts it among "three things a bass player does that an
  arpeggiator does not", so a rule that makes the pop rare has failed even if the
  leap numbers improve. Measured under R4's repair the catalogue's pops go 229 →
  170, with every one of the nine feels retaining some.
- **R6** — **A pop-only rule is incomplete and the repair says so.** Eleven of the
  385 wide leaps have no popped note on either side — ten are a repeated note into
  an approach note, one is a chord tone into a bar root — so the pass must handle
  a violation it cannot fix by un-popping.
- **R7** — **The repair differs by pop site, and the difference is load-bearing.**
  At the 32% roll (`events.ts:611-615`, 63 surviving notes) the previous note is
  always a tone of the same chord in the same bar, so an octave above it is a
  chord tone and in scale. At the always-lift (`:670-679`, 54 notes) **31 lifts
  land on a downbeat root**, where the previous note is the prior bar's chromatic
  approach; an octave above that would be off-scale and outside the approach
  window. For a lift on a downbeat root **the lift itself gives way** — which is
  also what `docs/music.md:332-336` already says should happen, since it declares
  the downbeat exempt from all three of rest, repeat and lift.
- **R8** — **An approach note is never re-octaved.** Forty-five of 192 approach
  notes would otherwise end up more than a semitone from the root they resolve to,
  and `theory/pitches.ts:89-92` compares pitch classes so the existing gate cannot
  catch it. The approach note is already excluded from `movable()`
  (`events.ts:640-646`) and is excluded here on the same terms.
- **R9** — **The twelve grooves rooted C♯, D or E♭ keep the low string; the rest
  may lose it.** Those twelve are where the root itself is the low note, so a root
  that comes back up an octave is the puzzle answering from the register this
  feature exists to move it out of. Elsewhere a passing note returning to the
  upper octave costs character, not the answer.

  Measured, the constraint binds on **four grooves**: of the fifteen whose lowest
  note the repair raises — groove-01, 03, 11, 17, 20, 38, 40, 56, 57, 72, 73, 74,
  75, 77, 79 — the low-rooted ones are **groove-03 (E♭), groove-17 (D), groove-40
  (E♭) and groove-73 (C♯)**. Each must still reach below MIDI 28 after the repair.
- **R10** — **groove-74 losing the low string is accepted, not overlooked.** It is
  rooted E and not one of the twelve, and the repair takes it from [27..47] to
  [30..44]. That is recorded with the epic's measurements so a later reader finds
  a decision rather than a regression. The same goes for the other ten grooves
  whose lowest note rises by 1–3 semitones.
- **R11** — **The rule is a post-hoc repair pass, and it runs last.** It cannot
  live inside the note-choosing loop: the always-lift at `:670-679` runs after the
  loop and is the single biggest producer of the violation, and at the moment a
  pop is drawn the next note does not exist, so a loop-internal rule could bound
  the leap *into* a pop but never the fall *out* of it — which is most of the
  population. A post-hoc pass also draws no randomness, so it adds nothing to
  `rhythmRng` and re-keys no committed groove; any in-loop alternative that
  re-drew would be a frozen-order violation dressed as a fix.
- **R12** — The pass runs after `restsSomewhere` (`:648-667`), after the always-lift
  (`:670-679`) and after `repeatsSomewhere` (`:682-696`), and it does not undo
  them. `:693` reads `if (repeatsSomewhere() && Math.max(...line) - Math.min(...line) > 12) break`,
  so running before it changes what that span condition sees, and running after it
  risks re-voicing the very note the repeat pass just set equal to its predecessor.
  The bound skips any note the repeat pass moved.
- **R13** — The change re-renders and is re-heard. It is larger than Epic 1 — 852
  bass notes across 53 grooves against Epic 1's 508 across 48 — so no groove's
  approval survives it. That figure depends on R4's repair; it is re-measured
  against what is built rather than carried from here.
- **R14** — All seven gate checks pass over all 54 grooves, the −29…−20 dBFS
  loudness band included, and the bass-over-kick medians in `boom-bap.test.ts` and
  `second-line.test.ts` are re-measured.
- **R15** — **This epic carries the feature's only `SIGN_OFFS` pin.** Epic 1
  defers it, because its renders are not what ships, so every entry here is
  pinned for the first time against audio a player will actually hear. The anchor
  rule is Epic 1's — one fixed metric, the share of a groove's bass note-time
  below MIDI 28 — recomputed on these streams, so a feel's anchor may differ from
  the one Epic 1's measurement would have chosen.
- **R16** — The ten entries Epic 1 left pending are all resolved here. None is
  still awaiting a render when this epic ends.
- **R17** — `docs/music.md`'s *Voicing* paragraph is updated again — Epic 1
  rewrote the floor sentence, this rewrites the span and the lift. The sentence
  the measurement hands it: Epic 1's three extra semitones are spent on the low
  end rather than on leaps, taking the span median from 22 back to 19, which is
  exactly what the catalogue measured before the feature began.
- **R18** — **A listening gate of its own, on the four grooves the bound makes
  smallest.** groove-67 (second-line) goes from an 18-semitone span to 6 and from
  74% stepwise motion to 91%; groove-49 (open-ballad) 21 → 8; groove-69
  (second-line) 23 → 10; groove-73 (boom-bap) 20 → 12. Nothing in `gate.ts` can
  tell "settled" from "stuck", so these four are heard before the anchors are, and
  a verdict that the line has stopped walking is a reason to revisit the bound
  rather than to ship it.

## Acceptance criteria

- **AC1** (R1, R2, R3) — Given the re-rendered catalogue, when every consecutive
  bass interval is measured, then none exceeds 12 semitones, the lowest note is
  still 25 and the highest is still 48.
- **AC2** (R4, R7) — Given a figure whose leap exceeded the bound, when the repair
  has run, then the popped note sits exactly an octave above the note it leaves —
  except where the lift landed on a downbeat root, where the lift is gone instead
  and the root is back in the base octave.
- **AC3** (R5) — Given both event streams, when the octave pops are counted per
  feel, then every one of the nine feels still plays some, and the before and
  after counts are recorded.
- **AC4** (R6) — Given the eleven wide leaps with no popped note on either side,
  when the repair has run, then each is resolved and none was left standing
  because the pass had no pop to undo.
- **AC5** (R8) — Given every approach note in the catalogue, when the repair has
  run, then none has been moved to a different octave.
- **AC6** (R9, R10) — Given groove-03, groove-17, groove-40 and groove-73, when
  each re-rendered stream is measured, then each still reaches below MIDI 28 —
  asserted per groove, not over the catalogue's range. Given every other groove
  whose lowest note rose, then the new range is recorded rather than asserted.
- **AC7** (R11, R12) — Given the same seed, when a groove is built with and
  without the repair pass, then every non-bass event is byte-identical and
  `rhythmRng` has been drawn from the same number of times, proving the pass adds
  no randomness; and no note the repeat pass moved has been re-voiced.
- **AC8** (R13) — Given both renders, when the changed set is counted, then the
  measured figure is recorded and no `SIGN_OFFS` entry is still pinned to
  pre-Epic-2 audio.
- **AC9** (R14) — Given the re-render, when all 54 are gated, then all seven
  checks pass and every feel's bass-over-kick median sits within 1.5 dB of
  `straight-funk`'s.
- **AC10** (R15, R16) — Given `gate.test.ts`, when the sign-off suite runs, then
  every entry matches its render, carries the verdict it rests on, and none is
  left awaiting a render.
- **AC11** (R18) — Given groove-67, 49, 69 and 73, when they are played before the
  anchors are, then a verdict on whether the line still walks is recorded, and a
  verdict that it does not is reported rather than absorbed.

## Dependencies

- **Epic 1's gate A verdict.** This epic starts on "the line reads as holes" and
  on nothing else — not on a measurement, because the measurement is already in
  hand and does not settle it.
- **Epic 1, built but not committed, and not pinned.** Its Q2 answered that floor
  25 does not reach `main` without this epic, so this is built on Epic 1's working
  tree and the two land as one commit — which is what makes one `git revert` the
  whole rollback. Its Q3 then deferred the sign-off pin here, so this epic
  inherits ten entries with no valid hash and closing them is part of its
  definition of done.
- **The pending shape is decided:** Epic 1's Q4 made `SignOff.pcm` nullable, so
  this epic inherits ten entries carrying `pcm: null` and an `upstream` naming
  this epic as what they await. Resolving them means giving each a real hash, not
  removing the null.

## Assumptions

- **Epic 1's listening anchors are this epic's too.** The six span anchors —
  groove-20, 79, 17, 42, 57, 72 — are where the verdict was formed, so they are
  where it is checked.
- **One bound, not per-feel** — and the measurement supports it rather than only
  permitting it. But `second-line` pays most: its pops go 18 → 8 and both of the
  two grooves whose line collapses hardest are its. It is the feel that would ask
  for an exemption if one is ever needed, and a per-feel bound would be a new
  template field.
- **The repair's priority order is build work, not spec work** — but it is a
  smaller problem than it was. Two variants that anchored the downbeat root to
  protect all fifteen grooves were measured and both were worse elsewhere: 8 and
  24 violations left standing, pops down to 108 and 130, 9 and 13 approach notes
  broken. R9 asks for four grooves rather than fifteen, so neither of those
  variants is what the build has to reach for.
- **Every "would expect to hear" in this PRD is a prediction.** The spans, the
  stepwise shares and the pop counts are measured; whether groove-67's six-semitone
  line reads as settled or as stuck is not measurable by anything in `gate.ts`,
  which is why R17 exists.

## Question log

### Cycle 1 — 2026-09-07

**Q1. What actually bounds the span?**
Answer: **A) A leap bound — reject or re-voice a figure whose consecutive interval
exceeds N semitones, leaving both ends of the register intact.** It targets the
defect rather than the register: narrowing at the ceiling would spend three of the
semitones Epic 1 bought and make the octave pop rare.
Applied to: R1, R2, R3, AC1, AC2, Scope

### Cycle 2 — 2026-09-07

**Q2. What is the bound, and which note gives way?**
Answer: **C) 12 semitones — no bass leap wider than an octave**, read as
inclusive, confirmed in Fred's words: "≤12 definitely makes sense from a bass
player's perspective."
Applied to: R1, R2, AC1

The option named the bound and not the re-voicing rule, so the second half was
measured rather than assumed, and two of the numbers this PRD had been carrying
turned out to be wrong:

- **"472 leaps would have to be re-voiced" was too high.** The bound allows an
  exact octave, and only 87 of the 472 are one, so the population the repair
  touches is **385**. The warning that C was "a different feature wearing this
  one's number" was overstated by that much and no more — 385 against option A's
  140 is still nearly three times the work.
- **The lift is not an octave**, which is why exactly-12 is so rare. That finding
  is now in Problem, and it changes what this epic *is*: not only a bound on
  leaps but the change that makes `docs/music.md:332` true about the lift.
- **852 notes across 53 grooves, not 890.** R12 carries the figure and says to
  re-measure it against what is built.

**R4's repair was chosen on measurement, not preference.** Four candidates were
built and compared; the three rejected each fail R5 outright — un-popping leaves
22 pops in the catalogue, folding the low note up nearly doubles the notes above
MIDI 40, and re-voicing to the nearest chord tone leaves 5.

### Cycle 3 — 2026-09-07

**Q3. How hard is R9 — the promise that no groove loses the low string?**
Answer: **B) Hard on the twelve grooves rooted C♯, D or E♭, soft on the rest** —
those twelve are where the root is the low note and carries half the answer.
Applied to: R9, R10, AC6, Assumptions

**A correction to the option the answer was picked from.** It said "groove-73 is
boom-bap in E♭". groove-73 is boom-bap in **C♯**. The conclusion the option drew
from it was right — groove-73 is one of the twelve and is protected — but the root
was wrong, and the same sentence's claim about groove-74 has now been checked
rather than asserted: groove-74 is rooted E, is not one of the twelve, and does
lose the low string under this answer. R10 records that as a decision.

**The answer is a much smaller constraint than it reads.** The twelve low-rooted
grooves are groove-03, 09, 14, 17, 18, 19, 40, 42, 50, 51, 53 and 73; the fifteen
whose lowest note the repair raises are groove-01, 03, 11, 17, 20, 38, 40, 56, 57,
72, 73, 74, 75, 77 and 79. The intersection — what the build actually has to
protect — is **four grooves: 03, 17, 40 and 73.** Option A would have asked for
fifteen.

**This PRD is settled.** Nothing high-impact is open.
