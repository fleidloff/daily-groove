# PRD — Epic 2: The card's controls

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Two changes to the controls on the guess card, both true of the app as it stands
today. A second switch under *Simple mode* turns the chip sounds off, remembered
across reloads and days the way simple mode is. And *Check* becomes the same
size as *Play*, so the two moves the card asks for read as equals.

## Problem

Since feature-10 the root chips make a noise, and there is no way to stop them.
Sam plays on the bus and twenty minutes before dinner; an app that can only be
silenced by silencing the phone is an app that gets closed instead. The switch
belongs next to the one preference the card already has.

Separately, the card's call to action is the smaller of its two buttons.
Feature-4 made *Play* the larger one deliberately, and the effect now is that
the button which ends the puzzle looks like an afterthought beside the one that
starts it.

## Scope

- A second stored preference: whether tapping a chip makes a sound.
- A switch for it, directly under the simple-mode toggle.
- One gate, applied where the chip handlers are built, covering both rows.
- Hiding the audible-row affordances while the sounds are off.
- *Check* at the larger button size.

**Out of scope**
- **What a mode chip sounds** — Epic 1. This epic decides whether a chip sounds
  at all, and can be built and demoed against the root row alone.
- **How loud it is, and when it starts** — Epic 3.
- **Muting the groove.** The switch covers the sounds made by tapping a root or
  a mode. The play control is how the band is silenced, and it already is.
- **A volume slider, or a switch per row.** One binary preference.
- **A settings panel.** This does not start one; it is a second switch under the
  first.
- **Shrinking *Play*, or any other change to the page's hierarchy.** *Check*
  comes up to *Play*'s size; nothing comes down, and no third size is added.

## Requirements

### The preference

- **R1** — The player can turn the chip sounds off and on from a switch on the
  guess card, directly below the simple-mode toggle.
- **R2** — The sounds are on by default. A player who never touches the switch
  gets the app as it behaves today.
- **R3** — The setting survives a reload and a new day, stored the same way the
  simple-mode preference is.
- **R4** — Changing it takes effect immediately, mid-puzzle, in both directions.
- **R5** — Changing it is not an attempt. No dot is spent, nothing is scored,
  and no selection changes.
- **R5a** — The switch stays usable for the whole day, including after the
  puzzle is solved or given up. It is a durable preference rather than a record
  of how the day was played, and the guess card is the only place it can be
  changed — so unlike the simple-mode toggle it does not settle when the card
  does.
- **R6** — Turning the sounds off does not affect the groove. It keeps playing,
  at the same position, and the play control is unchanged.
- **R7** — Adding this preference does not disturb the simple-mode preference.
  A stored value written before this switch existed still loads, with the new
  preference at its default and simple mode exactly as it was.
- **R8** — A storage failure — quota, disabled storage, a private window — costs
  the player nothing for the session: the switch still moves and still takes
  effect, and no error is shown.

### What the switch controls

- **R9** — While the sounds are off, tapping a root chip makes no sound.
  Selection, feedback, attempts and the nudge are unaffected.
- **R10** — While the sounds are off, tapping a mode chip makes no sound.
  Selection, feedback, attempts and the nudge are unaffected.
- **R11** — While the sounds are off, nothing is fetched or decoded on a chip
  tap. The switch is a setting, not a mute over audio that still loads.
- **R12** — While the sounds are off, neither chip row carries the mark that
  says it is audible. The mark returns when the switch goes back on.
- **R12a** — While the sounds are off, the caption under the play control says
  that the chip sounds are off and how to turn them back on. It stays one line,
  and it returns to what it says with the sounds on as soon as the switch is
  flipped back.

### The switch itself

- **R13** — The switch reports its state to assistive technology as a switch,
  is reachable by keyboard, and responds to both space and enter.
- **R14** — It reads as one control with the simple-mode toggle: same shape,
  same alignment, same treatment.

### The call to action

- **R15** — The *Check* control is rendered at the same size as the play
  control: same height and same type size.
- **R16** — The longest label the control can show fits on one line at the
  narrowest supported width, without wrapping or truncation.
- **R17** — The control's waiting, live and solved appearances all remain
  legible and distinguishable at the larger size.
- **R18** — The play control is unchanged.

## Behaviour details

**Two preferences in a store shaped for one.** The stored preferences are read
and written as a whole object, so a writer that knows about one field would
erase the other. Both writers have to round-trip what they did not change, and
a stored blob written before the second field existed has to load with that
field at its default rather than resetting everything to defaults.

**One gate, not two.** The flag is applied where the chip handlers are built,
not inside the voices — an off switch that still fetches and decodes is a mute
pretending to be a setting, and two independently gated voices are two chances
to forget one.

**One switch, two callers.** The simple-mode toggle and this one are the same
control with different words. If building the second means copying the first,
the shared part is a design-system primitive that knows nothing about grooves or
sound, and both feature components become thin callers of it.

## Acceptance criteria

- **AC1** (R1) — Given the puzzle is open, when the card is inspected, then a
  sounds switch is rendered directly below the simple-mode toggle.
- **AC2** (R2) — Given a player with no stored preference, when the page loads,
  then the sounds are on.
- **AC3** (R3) — Given the sounds are turned off, when the page is reloaded,
  then they are still off.
- **AC4** (R4, R9) — Given the sounds are on, when the switch is turned off and
  a root chip is tapped, then nothing sounds; when it is turned back on and the
  chip is tapped again, then it sounds.
- **AC5** (R5) — Given attempts remain, when the switch is flipped either way,
  then the attempt dots, the feedback line and the check control are unchanged.
- **AC6** (R6) — Given the groove is playing, when the switch is flipped, then
  the groove continues at the same position.
- **AC7** (R7) — Given a stored preference written before this field existed,
  when the page loads, then simple mode holds its stored value and the sounds
  are on.
- **AC8** (R8) — Given a store that throws on write, when the switch is flipped,
  then it still moves, still takes effect, and no error is shown.
- **AC9** (R9, R10) — Given the sounds are off, when a root chip and then a mode
  chip are tapped, then neither sounds and both select as normal.
- **AC10** (R11) — Given the sounds are off and no audio has been fetched, when
  a chip is tapped, then no fetch is made.
- **AC11** (R12) — Given the sounds are off, when the chip rows are inspected,
  then no chip carries the mark; when the switch goes back on, the mark returns.
- **AC11a** (R12a) — Given the sounds are off, when the caption under the play
  control is read, then it says the sounds are off and how to restore them;
  when the switch goes back on, it says what it said before.
- **AC11b** (R5a) — Given the day is solved or revealed, when the sounds switch
  is used, then it still toggles and the preference is still stored.
- **AC12** (R13) — Given keyboard focus, when the switch is reached by tab and
  activated with space and with enter, then it toggles, and its state is exposed
  as a switch.
- **AC13** (R15) — Given the puzzle is open, when the check control and the play
  control are compared, then they render at the same size.
- **AC14** (R16) — Given the longest root-and-mode pair is selected at the
  narrowest supported width, when the check control is rendered, then its label
  occupies one line.
- **AC15** (R17) — Given the waiting, live and solved states in turn, when the
  check control is rendered at the larger size, then each remains
  distinguishable.

## Dependencies

**Needs nothing.** Everything this epic changes exists today: the root row
already sounds, the preference store already holds one field, and both buttons
already exist.

**Hands to Epic 1, as a contract:** *whether the tap sounds are enabled* — one
flag, applied where the handlers are built. Epic 1's mode handler passes through
it and its `♪` obeys the same condition; whichever epic lands second wires the
one line. The caption has two states across the two epics: Epic 1 owns what it
says while the sounds are on, this epic owns what it says while they are off.

## Assumptions

- **The switch is worded as a positive.** On means sounds, matching the
  simple-mode toggle, where on means the thing named is in effect.
- **Turning the sounds off does not cut a note already sounding.** It governs
  the next tap, not the current one; a note cut mid-ring reads as a glitch.
- **The off-state caption is short.** It names the state and points at the
  switch two rows above it; it does not explain what the sounds are for.
- **The preference is not part of the day's record.** It is a setting, not a
  fact about how a puzzle was played, so it never appears in a result or a
  share.
- **The larger size is the one the play control already asks for.** No new size
  is defined.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-02

**Q1. Does the sounds switch stay usable once the day is over?**
Answer: **A) It stays usable all day, including after the puzzle ends** — a
durable preference, not a record of the day, and the guess card is the only
place it can be changed.
Applied to: R5a, AC11b. This reverses the roadmap's assumption that the switch
would settle with the card the way the simple-mode toggle does; the roadmap has
been corrected.

**Q2. Where does the caption go while the sounds are off?**
Answer: **B) It says the sounds are off and how to turn them back on** — most
helpful to a player who flipped the switch by accident.
Applied to: R12 (split), R12a, AC11, AC11a, Dependencies, Assumptions
