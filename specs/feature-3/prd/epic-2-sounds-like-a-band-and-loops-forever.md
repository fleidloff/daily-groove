# PRD — Epic 2: Grooves that sound like a band, and loop forever

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Turn Epic 1's mechanically correct loop into something a musician would play along
with. Velocity layers and round-robins replace one-sample-per-voice, swing and
micro-timing replace the straight grid, and a real mix replaces summed tracks. The
loop is then made seamless and the app repeats it until you stop it, which is the
whole of "jam with the groove" on the app side.

## Problem

The briefing asks for grooves that are "funky / fresh sounding", that "sound natural",
and that you can "jam with … with every instrument". Epic 1 deliberately delivers none
of that: flat dynamics, straight timing, one sample per voice, and playback that stops
after ten seconds. A four-bar loop that stops is not something anyone jams over.

## Scope

- Sampled voices with velocity layers and round-robins.
- Feel: swing, micro-timing humanization, velocity dynamics, ghost notes, note lengths.
- Arrangement rules that keep a groove playable-over by any instrument.
- Mix and master, including peak normalization to a fixed ceiling.
- A seamless loop point, and looping playback in the app.
- A musician's sign-off as the acceptance bar for how it sounds.

**Out of scope**
- Catalogue variety — one groove sounding right is this epic; many grooves sounding
  different is Epic 3.
- Any jam UI beyond looping: no count-in, no click track, no chord chart, no download.
- `grooves:add`, the build guard and the quality gate — Epic 4.
- The feel templates themselves — Epic 3 authors them; this epic defines what the
  `feel` fields *do* to the sound.

## Requirements

**Voices**

- **R1** — Each drum voice plays from multiple velocity layers, chosen by the event's
  velocity. A soft hit is a different recording, not the same recording turned down.
- **R2** — Repeated hits on the same voice rotate through round-robin samples, so no
  two consecutive hits are sample-identical.
- **R3** — Pitched voices are rendered by pitch-shifting the nearest sampled note,
  within a range narrow enough that shifting stays natural.

**Feel**

- **R4** — A template's swing amount displaces off-beat subdivisions toward a shuffle,
  leaving on-beat subdivisions where they are.
- **R5** — Every note is humanized in timing and velocity, within bounds the template
  declares. The deviation is drawn from the groove's seed, so a groove's feel is
  reproducible.
- **R6** — Grooves include ghost notes and dynamic accents; a backbeat is louder than
  the 16ths around it.
- **R7** — Humanization never moves a note far enough to change which subdivision it
  reads as.

**Arrangement**

- **R8** — A groove is a backing track: drums, bass and comp only. No lead melody
  occupies the register a soloist would play in.
- **R9** — Tempo is constant across the 4 bars — no drift, no ritardando.
- **R10** — The harmony is voiced clearly enough to be identified by ear, which is what
  the game asks the player to do.

**Mix**

- **R11** — Tracks are individually levelled and panned, and summed through a mix stage
  that applies light bus processing.
- **R12** — The rendered master never clips.
- **R13** — Every rendered master is normalized so its true peak sits at a fixed
  ceiling. Two grooves of similar density therefore arrive at a similar level; a dense
  groove and a sparse one still will not, and closing that gap is left to the mix
  levels chosen per template rather than to a loudness measurement.
- **R18** — The epic is accepted when the briefing's author plays along with the
  rendered grooves and confirms they work. That sign-off is the bar for "funky /
  fresh" and "must sound natural", and no automated check substitutes for it. A
  rejection returns the epic to tuning feel and mix, and it is re-presented until it
  passes.

**Loop**

- **R14** — Audio that rings past the end of bar 4 wraps around to the start rather
  than being cut off.
- **R15** — Playing the file end-to-start produces no audible click, gap or level jump.
- **R16** — The encoder introduces no leading or trailing silence beyond what the
  music contains.
- **R17** — Pressing play in the app loops the groove until the player stops it.
  Stopping still stops immediately, and replaying still restarts from the top.

## Behaviour details

**What "natural" means here, concretely.** Naturalness in a sampled renderer is mostly
the absence of machine artefacts, and the three that matter are: the same sample fired
repeatedly at the same level (R1, R2), every note landing exactly on the grid (R4, R5),
and every note being the same loudness (R6). Those three are testable, and R1–R7 exist
to remove them. But passing them is not the bar — a groove can satisfy every one and
still not groove. The bar is the briefing's author playing along and saying it works
(R18) — the person who wrote "funky / fresh" and "must sound natural" is the one who
knows what those words were asking for. The automated checks are there to stop obvious
regressions reaching that listening session, not to stand in for its judgement.

**On loudness.** True-peak normalization is a peak measure, not a perceived-loudness
one: a busy 16th-note groove and a sparse half-time groove can share a peak ceiling and
still sit noticeably far apart in the ear. R13 claims only what peak normalization can
deliver. Where the gap is audible, it is closed by tuning per-template mix levels, and
the musician's sign-off is what catches it.

**The seam.** A loop is seamless when the last sample flows into the first without a
discontinuity. Two things break it: instrument tails cut off at the loop boundary
(fixed by R14, rendering past the end and summing the overhang back onto the start),
and encoder padding (fixed by R16). Both are checkable on the rendered buffer.

## Acceptance criteria

- **AC1** (R1) — Given events at two different velocities on one drum voice, when they
  are rendered, then two different source samples are used.
- **AC2** (R2) — Given four consecutive hits on one voice at equal velocity, when they
  are rendered, then not all four use the same source sample.
- **AC3** (R4) — Given a template with swing, when events are generated, then off-beat
  subdivisions are displaced later and on-beat subdivisions are not.
- **AC4** (R5) — Given a fixed seed, when the humanized events are generated twice,
  then both runs are identical.
- **AC5** (R5, R7) — Given any humanized event, when its offset is measured, then it
  falls within the template's declared bounds and stays inside its own subdivision.
- **AC6** (R6) — Given a rendered groove, when its event velocities are inspected, then
  they span a range rather than a single value.
- **AC7** (R12) — Given any rendered master, when its peak is measured, then it is
  below full scale.
- **AC8** (R13) — Given any rendered master, when its true peak is measured, then it
  sits at the fixed ceiling.
- **AC9** (R14, R15) — Given a rendered groove, when the discontinuity between its last
  and first samples is measured, then it is below the seam threshold.
- **AC10** (R16) — Given a rendered mp3, when it is decoded, then it carries no
  silent padding at either end beyond the music itself.
- **AC11** (R17) — Given the app playing a groove, when the loop reaches its end, then
  playback continues from the start without the player acting.
- **AC12** (R17) — Given a looping groove, when the player presses stop, then playback
  ends immediately and does not resume.
- **AC13** (R9) — Given a rendered groove, when onset positions are compared against
  the tempo grid, then the grid holds across all 4 bars.
- **AC14** (R18) — Given the finished grooves, when the briefing's author plays along
  with them, then they confirm the grooves are natural and funky enough to jam with.
  Without that confirmation the epic is not done, and the response to a rejection is
  another tuning pass rather than a waiver.

## Dependencies

**Needs before starting:** Epic 1's pipeline stages (`events`, `voices`, `mix`) and its
sample-pack interface. This epic replaces the innards of those three stages and touches
no others.

**Needs the real CC0 pack — and Epic 1 already sourced it.** Velocity layers and
round-robins (R1, R2) cannot be demonstrated against the placeholder pack, but Epic 1
sources a pack that is complete for this epic and declares its layers and alternates
through the sample-pack interface. This epic turns them on; it sources nothing.

**Hands to later epics:** the finished sound. Every groove Epic 3 mints and every
groove Epic 4 adds is rendered through this epic's voices, feel and mix.

**Blocks Epic 3.** Epic 2 and Epic 3 both rewrite the committed audio, so they are
serialized rather than run in parallel: Epic 2 completes and merges, and only then does
Epic 3 mint the catalogue — through a renderer that is already finished, so nothing it
mints needs re-rendering. This changes the roadmap's execution waves, which had assumed
the two were independent.

Epic 2 therefore develops against Epic 1's single groove, which is all the catalogue
there is at this point.

## Assumptions

- The seam threshold and the peak ceiling are tuning constants chosen during
  implementation and asserted in tests; they are not product decisions.
- Looping is achieved by the audio element's own loop, not by re-triggering on `ended`.
- Feature-2 is restyling `PlayControl` in parallel. This epic changes what
  `createAudioPlayer` does, not what the control looks like, so the two do not collide.
- Humanization bounds live in the feel template, so Epic 3 can give different feels
  different amounts of looseness without touching this epic's code.

## Question log

### Cycle 1 — 2026-08-29

**Q1. "Sounds natural" is the briefing's hardest requirement and the one tests can't assert. What is the acceptance bar?**
Answer: **D) A musician's sign-off with no checklist** — they play along and say
whether it works. The automated proxies stay as requirements, but they are a
regression net, not the bar.
Applied to: R18, AC14, Scope, Behaviour details ("What natural means here")

**Q2. R13 needs a definition of "same loudness". How is it measured?**
Answer: **B) True-peak normalization to a fixed ceiling** — trivial to implement,
accepting that a dense groove still sounds louder than a sparse one.
Applied to: R13 (rewritten — it no longer claims perceived loudness), AC8 (rewritten),
Behaviour details ("On loudness"), Assumptions

**Q3. Epics 2 and 3 run in parallel and both change the committed mp3s. Who owns the audio files during wave 2?**
Answer: **C) Serialize them** — Epic 2 finishes and merges before Epic 3 starts
minting. Supersedes the roadmap's parallel wave 2.
Applied to: Dependencies, and roadmap.md's dependency map and execution waves

### Cycle 2 — 2026-08-29

**Q4. The sign-off is now the only gate on how the grooves sound. Whose sign-off is it?**
Answer: **A) The briefing's author signs off**, and a rejection returns the epic to
tuning feel and mix until it passes.
Applied to: R18, AC14, Behaviour details

---

**This PRD is settled.** No high-impact questions remain.
