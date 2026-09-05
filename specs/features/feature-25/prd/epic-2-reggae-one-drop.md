# PRD — Epic 2: Reggae one-drop

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

One template, `reggae-one-drop`, and six grooves from it: 70–80 bpm, straight,
kick and rim together on beat 3, nothing on beat 1, hat on the off-beats, bass
carrying the weight. `new-styles.md` calls it the style that "sounds like nothing
in the current six", which makes it the biggest audible jump in the feature and
the reason it goes first in wave 2.

## Problem

Nothing in the catalogue leaves beat one empty. Every figure in `KICK_PATTERNS`
hits step 0, and `DEFAULT_PLACEMENT` puts the snare on 4 and 12 — a backbeat, on
2 and 4. A one-drop is the inverse of both, and until Epic 1 lands there is no
way to declare it without re-rendering all thirty committed grooves.

The style also asks something of the kit nothing else does: with beat one silent
and the snare gone from 2, the groove has to keep time from the off-beat hat and
the bass alone. That is the risk this epic carries, and it is a listening
question, not a gate one.

## Scope

- `templates/reggae-one-drop.ts`, registered in `templates/index.ts`
- its kick figures and comp figures in the template's own `patterns` block
- its rim and snare placement in `PLACEMENTS`
- six grooves minted, gated and signed off by ear
- one row in `docs/music.md`'s feel table

**Out of scope**
- new voices. Everything it needs is in the fifteen already declared, and it
  reaches for none of the four feature-24 sourced unheard
- the flavour rule and the `patterns` block. Both are Epic 1's, frozen before
  this epic starts
- dub processing — spring reverb on the snare, tape delay throws. A voice-level
  effects chain the generator does not have, and its own feature if ever
- the rota. Its six grooves join the catalogue in issue order; the new mix is
  Epic 6

## Requirements

- **R1** — `templates/reggae-one-drop.ts` declares a tempo range inside 70–80
  bpm, straight (swing at or near zero), on a subdivision the `musician` sets.
  Its tempo range and its swing value are distinct from every other registered
  template, including `half-time` at 68–80 and `open-ballad` at 62–74.
- **R2** — Its flavours are two to four of the twelve already offered.
  `new-styles.md` proposes aeolian, mixolydian and ionian; the `musician` settles
  the list, which is frozen the moment its first groove is minted.
- **R3** — Beat one carries no kick. Every figure in the template's own kick pool
  omits step 0, and the kick's first event in a bar falls on beat 3.
- **R4** — The rim sounds with the kick on beat 3, declared in `PLACEMENTS`.
- **R5** — The backbeat does not survive. The template's placement overrides
  `DEFAULT_PLACEMENT`'s snare on 4 and 12 rather than adding to it, so no groove
  it renders sounds a snare on 2 and 4.
- **R6** — The hat sounds the off-beats, and it is the only voice doing so — the
  groove's timekeeping is the hat and the bass, not a kick on the downbeat.
- **R7** — The comp plays the skank: a short chord on the off-beats, from the
  template's own comp pool.
- **R8** — The bass is present and prominent enough to carry the pulse, set by
  the template's `gain` rather than by anything new in `events.ts`.
- **R9** — Six grooves are minted for the template, every one passing all seven
  gate checks.
- **R10** — Its density band is declared for what the style actually plays. A
  one-drop is sparse, and the band accommodates that rather than the template
  being busied up to clear a floor written for `straight-funk`.
- **R11** — Its `passes` declaration keeps the rendered file within the length
  the existing slow feels set: `half-time` and `open-ballad` declare two passes
  because four passes at 68 bpm is a 56-second file, and 70–80 bpm sits in the
  same territory.
- **R12** — The listening sign-off is a person's, recorded per groove in the
  epic's report, and it answers the one question the gate cannot: with beat one
  empty, does it still keep time?
- **R13** — `docs/music.md`'s feel table gains its row — bpm, subdivision, swing,
  flavours, passes, density band and which voice carries the pulse.

## Acceptance criteria

- **AC1** (R1) — Given the registered templates, when the template suite runs,
  then `reggae-one-drop`'s swing value and tempo-range string are unique across
  the registry and its range lies inside 70–80.
- **AC2** (R2) — Given the template, when the flavour suite runs, then it holds
  two to four distinct flavours, every one of them in `FLAVOURS`.
- **AC3** (R3) — Given every figure in the template's kick pool, when inspected,
  then none contains step 0, and for every rendered groove the earliest kick
  event in each bar falls on beat 3.
- **AC4** (R4) — Given every rendered groove, when its events are inspected, then
  a rim event coincides with the beat-3 kick in every bar the placement declares.
- **AC5** (R5) — Given every rendered groove, when its events are inspected, then
  no snare event falls on step 4 or step 12.
- **AC6** (R6, R7) — Given every rendered groove, when its events are inspected,
  then hat events fall on off-beat steps and comp events fall on off-beat steps.
- **AC7** (R9) — Given the catalogue after this epic, when `npm run test:gen`
  runs, then it holds six `reggae-one-drop` grooves and all seven gate checks
  pass for each.
- **AC8** (R10) — Given each rendered groove, when the density check runs, then
  its events per bar are inside the template's own declared band, and the band
  was not widened after a failure.
- **AC9** (R11) — Given the six rendered mp3s, when their durations are measured,
  then none is longer than the longest file the existing slow feels produce.
- **AC10** (R12) — Given the six mp3s, when a person listens to each in full,
  then the report records their verdict in their own words, including whether the
  pulse holds without a downbeat kick. A gate pass is not a sign-off.
- **AC11** (R13) — Given `docs/music.md`, when read after this epic, then the
  feel table lists `reggae-one-drop` with the values the template actually
  declares.
- **AC12** — Given `npm run grooves:verify` and `git status` after
  `npm run grooves`, when inspected, then no groove outside this template has
  re-rendered.

## Dependencies

**Needs:** Epic 1 — the two-to-four flavour rule, `FeelTemplate.patterns` with
its kick and comp pools, and `grooves:add <n> --template <id>`. Nothing else, and
not feature-24.

**Hands to Epic 6:** six grooves.

**Shares with Epics 3 and 4:** `templates/index.ts`, `templates/index.test.ts`,
`catalogue.json` and `grooves.lock.json`. The three epics can be built at once
and must be minted one after another.

## Assumptions

- **The `musician` decides the parameters.** Subdivision, exact tempo range,
  swing, gains, pans, humanize, density band, passes and the final mode list are
  theirs; R1–R11 bound them rather than choosing them.
- **Three slow feels is acceptable.** `open-ballad` at 62–74, `half-time` at
  68–80 and this at 70–80 means tempo alone stops separating them, which costs
  nothing the player has: the option pool the puzzle offers never depended on the
  feel.
- **A `FILLS` entry is optional here.** A one-drop's fill is usually the drop
  itself; if the default fill reads wrong under it, the template declares its own.
