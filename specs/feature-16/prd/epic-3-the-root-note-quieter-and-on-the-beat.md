# PRD — Epic 3: The root note, quieter and on the beat

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The root chips already sound. This epic fixes how: the note comes down to a
level that sits inside the band rather than in front of it, and it lands on the
groove's next beat instead of wherever the thumb fell. Both changes are visible
in the app as it stands today, before a single lick exists — and the beat grid
built here is the one the mode licks will use.

## Problem

Two complaints about audio that already ships. The reference note plays at full
scale straight into the output while the groove is mixed to sit below its
ceiling, so tapping a root is louder than the band the note is meant to be heard
against — loud enough that Sam reaches for the volume instead of listening.
And it fires the instant the chip is tapped, which lands it anywhere in the bar:
a reference pitch arriving off the beat reads as a wrong note played over the
groove rather than as a reference for it.

## Scope

- A gain stage in the reference voice, and one declared level for both voices.
- A beat grid: when the next beat of the running groove falls.
- Scheduling the root note against it.
- Keeping the note immediate when the groove is not playing.

**Out of scope**
- **What a mode chip sounds** — Epic 1, which consumes this epic's beat grid and
  its level and owns everything above them.
- **Turning the sounds off** — Epic 2.
- **A volume control, a mute, or any preference of its own.** The device's
  volume is the control and the on/off switch is Epic 2's. This is a fix to a
  wrong default, not the start of a mixer.
- **The groove's own level.** Feature-13 settled the balance between the kit and
  the keys; this touches only what the browser plays over the top.
- **Quantising to anything but a beat.** Not the bar, not a subdivision.

## Requirements

### Level

- **R1** — A tapped root note plays below full scale, at one declared level.
- **R2** — The same declared level is what the lick voice uses. There is one
  number, in one place, not a copy per voice.
- **R3** — The level is chosen by ear against the loudest groove in the
  catalogue: the note stays clearly audible against the bass and is never the
  loudest thing in the mix.
- **R4** — One level serves the whole catalogue. It is not per-groove.
- **R5** — A note that replaces a ringing one is faded rather than cut, so
  retriggering does not click.

### Timing

- **R6** — While the groove is playing, a tapped root note sounds on the
  groove's next beat rather than at the instant of the tap.
- **R6a** — A tap landing within a short tolerance before a beat counts as that
  beat and sounds at once, rather than waiting a further beat. A player tapping
  along in time hears their note immediately; only a tap that is genuinely off
  the beat waits.
- **R6b** — A tap that lands after a beat is never pulled back to it. The grid
  only ever schedules forward.
- **R7** — While the groove is not playing, a tapped root note sounds
  immediately, as it does today.
- **R8** — The beat grid is derived from the groove's stated tempo and the
  transport's own clock, so it holds at every tempo in the catalogue.
- **R8a** — The grid is the quarter-note beat. It is not the bar and it is not a
  subdivision, and it does not change with tempo — the pulse is what the player
  is trying to feel, so a reference note that arrives on it is the one that
  sounds deliberate.
- **R9** — Reading the groove's clock is one-way. Nothing the reference voice
  does stops, restarts, ducks, reschedules or otherwise writes to the transport.
- **R10** — A tap while a note is pending replaces it. Both a sounding note and
  a scheduled-but-unsounded one are cancelled, so running a finger down the row
  leaves exactly one note to arrive.
- **R10a** — At most one reference sound plays at a time across both chip rows.
  A root tap silences a lick that is playing, and a mode tap silences a root note
  that is ringing. The two rows are one instrument to the ear.
- **R10b** — Which voice currently holds the output is owned in one place, and
  both voices take it and give it back. Neither reaches into the other.
- **R11** — Stopping the groove does not cut a note that is already sounding.
- **R12** — A note scheduled for a beat that the groove no longer reaches —
  because it was stopped in between — does not sound.

### Unchanged

- **R13** — A tap always selects, whether or not a note sounds. No audio
  failure, and no wait for the beat, blocks or delays selection.
- **R14** — A note that cannot sound still fails silently: no banner, no retry,
  no message.
- **R15** — The groove is unaffected by a tap: its playing state, position, loop
  and progress bar are untouched.
- **R16** — On a day that has ended the root chips are disabled and silent, as
  they are today.

## Behaviour details

**Where the beat grid comes from.** The transport already reports
latency-corrected elapsed seconds on the audio graph's own clock, and the
groove's tempo is in its manifest entry. The next beat is arithmetic over those
two — a plain function of numbers, testable with no context, no buffer and no
clock, in the same spirit as the loop-position maths that already exists.

**This narrows a rule feature-10 set deliberately.** That epic kept the
reference voice and the transport strictly ignorant of each other, and a note
that has to land on a beat cannot be. The separation is narrowed in one
direction and not dropped: the voice reads, and never writes.

**This is the shared groundwork, and it lives here.** Both voices need the beat
grid and both need the level, and this is the epic that ships first — so it
holds them rather than either being hoisted into a prerequisite of its own.

## Acceptance criteria

- **AC1** (R1) — Given a root chip is tapped, when the note plays, then it is
  routed through a gain below unity rather than straight to the output.
- **AC2** (R2) — Given both voices, when each plays, then both read the same
  declared level.
- **AC3** (R5) — Given a note is ringing, when another root is tapped, then the
  first is ramped down rather than stopped abruptly.
- **AC4** (R6) — Given the groove is playing, when a root chip is tapped between
  beats, then the note is scheduled for the next beat boundary rather than for
  the moment of the tap.
- **AC5** (R7) — Given the groove is not playing, when a root chip is tapped,
  then the note sounds without waiting.
- **AC6** (R8) — Given two grooves at different tempos, when a root is tapped at
  the same offset into the bar in each, then the wait differs in proportion to
  the tempo.
- **AC7** (R9) — Given the groove is playing, when a root chip is tapped, then
  the transport's playing state and position are unchanged.
- **AC8** (R10) — Given a note is scheduled but has not sounded, when another
  root is tapped, then only the second note sounds.
- **AC8a** (R6a) — Given the groove is playing, when a root chip is tapped just
  inside the tolerance before a beat, then the note sounds at once rather than
  waiting for the following beat.
- **AC8b** (R6b) — Given the groove is playing, when a root chip is tapped just
  after a beat, then the note is scheduled forward to the next one.
- **AC8c** (R10a, R10b) — Given a lick is playing, when a root chip is tapped,
  then the lick stops and only the root note is heard.
- **AC9** (R11) — Given a note is sounding, when the groove is stopped, then the
  note rings on to its own end.
- **AC10** (R12) — Given a note is scheduled for a future beat, when the groove
  is stopped before it arrives, then it does not sound.
- **AC11** (R13) — Given the groove is playing, when a root chip is tapped, then
  the chip selects immediately, without waiting for the beat.
- **AC12** (R14) — Given Web Audio is unavailable, when a root chip is tapped,
  then the chip selects, nothing sounds, and no error is shown.
- **AC13** (R16) — Given the day is solved or revealed, when a root chip is
  tapped, then nothing sounds.

## Dependencies

**Needs nothing.** The transport, the manifest's tempo and the reference voice
all exist.

**Hands to Epic 1, as three contracts:**
- *When is the next beat* — a function of the transport's elapsed seconds and
  the groove's tempo, returning the time to schedule against, or nothing when
  the groove is not playing.
- *How loud* — one declared reference level.
- *One reference sound at a time* — a single owner of the output that both
  voices take and release, so a tap on either row silences whatever the other
  is doing.

All three can be pinned on day one, so Epic 1 builds against them in parallel.

## Assumptions

- **Every groove in the catalogue is 4/4,** and the app already assumes four
  beats to the bar.
- **The tolerance before a beat is a few tens of milliseconds,** chosen by ear:
  wide enough that a deliberate tap on the beat is never held back, narrow
  enough that a note never arrives audibly early.
- **Feature-10's tests move rather than go.** Those that asserted an immediate
  start now assert a scheduled one; the subject of each assertion is kept.
- **The level is a plain declared value, not a computed loudness match.** The
  criterion is the listen; the number is what the listen produced.
- **The wait is not indicated on screen.** Up to nine tenths of a second at the
  catalogue's slowest groove is short enough to read as timing rather than as a
  dropped tap, and a spinner on a chip would be worse than the wait.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-02

**Q1. What happens to a tap that lands just barely before a beat?**
Answer: **A) A short tolerance before each beat counts as that beat, and the
note sounds at once** — a player tapping in time hears their note immediately,
which is the behaviour that teaches.
Applied to: R6a, R6b, AC8a, AC8b, Assumptions

**Q2. Should the note land on the beat, or on the nearest half-beat?**
Answer: **A) The beat** — the pulse is what the player is trying to feel, and
the wait is under a second everywhere in the catalogue.
Applied to: R8a, AC8b

**From Epic 1's cycle 1:** one reference sound at a time across both rows. The
single owner of the output lives here, alongside the beat grid and the level.
Applied to: R10a, R10b, AC8c, Dependencies
