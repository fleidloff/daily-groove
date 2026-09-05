# PRD — Epic 3: Second line / New Orleans

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

One template, `second-line`, and six grooves from it: a syncopated snare over a
clave-ish kick, bass following the kick, toms and rim earning their place, keys
sparse. It is the kit-led style of the five, and the only one where the fill is
part of the idiom rather than a bar-four punctuation.

## Problem

Every existing feel treats the snare as a backbeat and the fill as an event at
the end of the phrase. A second line is the opposite on both counts: the snare
*is* the figure, and the rolls are the style rather than a decoration on it.
`DEFAULT_PLACEMENT`'s snare on 4 and 12 and `DEFAULT_FILL`'s one-bar phrase both
describe a groove this is not.

The risk is density. `straight-funk` already runs 18–44 events a bar and this is
busier in the kit while sparser in the keys, so the declared band has to fit a
shape no existing feel has — and the gate's density check is the one that will
fail during minting if it does not.

## Scope

- `templates/second-line.ts`, registered in `templates/index.ts`
- its snare, kick and bass figures in the template's own `patterns` block
- a `FILLS` entry, because the fill vocabulary is part of the style
- six grooves minted, gated and signed off by ear
- one row in `docs/music.md`'s feel table

**Out of scope**
- new voices. Toms, rim, kick, snare, hats, bass and comp are all declared
- a brass line. The lead register stays empty — Sam brings the melody instrument
- the parade-band second snare, or any two-drummer texture. One kit, one snare
- the flavour rule and the `patterns` block — Epic 1's, frozen before this starts
- the rota — Epic 6

## Requirements

- **R1** — `templates/second-line.ts` declares tempo, subdivision and swing set
  by the `musician`, with a tempo range and a swing value distinct from every
  other registered template.
- **R2** — Its flavours are two to four of the twelve already offered.
  `new-styles.md` proposes blues and mixolydian; the `musician` settles the list,
  which is frozen the moment its first groove is minted.
- **R3** — The snare carries the figure. Its steps come from the template's own
  snare pool, syncopated rather than on 2 and 4, and the template's placement
  overrides `DEFAULT_PLACEMENT`'s backbeat rather than adding to it.
- **R4** — The kick sounds a clave-ish figure from the template's own kick pool,
  and the bass follows it: the bass figure and the kick figure agree on their
  accented steps rather than being drawn independently.
- **R5** — Toms and rim are declared voices and are audible in the rendered
  grooves — they are part of the figure, not seasoning left at a gain nobody
  hears.
- **R6** — The comp is sparse: fewer events per bar than any of `straight-funk`,
  `swung-sixteenth` or `bright-straight` declare.
- **R7** — The template declares its own `FILLS` entry, a fill vocabulary in the
  idiom rather than the default tom-run.
- **R8** — Six grooves are minted for the template, every one passing all seven
  gate checks.
- **R9** — Its density band is declared for a busy kit over a sparse comp, wide
  enough that a legitimate second-line figure clears it and tight enough to still
  catch a voice left at the wrong gain. The band is set from what the style plays,
  not by widening it after a rejection.
- **R10** — The listening sign-off is a person's, recorded per groove in the
  epic's report, and it answers what the gate cannot: does the snare read as a
  figure or as clutter, and is the fill part of the groove or an interruption?
- **R11** — `docs/music.md`'s feel table gains its row, and the sentence about
  which feels carry toms is corrected if this template changes it.

## Acceptance criteria

- **AC1** (R1) — Given the registered templates, when the template suite runs,
  then `second-line`'s swing value and tempo-range string are unique across the
  registry.
- **AC2** (R2) — Given the template, when the flavour suite runs, then it holds
  two to four distinct flavours, every one of them in `FLAVOURS`.
- **AC3** (R3) — Given every rendered groove, when its events are inspected, then
  its snare events are not the pair (4, 12), and at least one snare event per bar
  falls on an off-beat step.
- **AC4** (R4) — Given every rendered groove, when its kick and bass events are
  compared, then the bass's accented steps are a subset of, or coincide with, the
  kick's, rather than being independent of them.
- **AC5** (R5) — Given every rendered groove, when its events are inspected, then
  both tom voices and the rim sound at least once per pass, at gains inside the
  same order of magnitude as the snare's.
- **AC6** (R6) — Given every rendered groove, when its comp events per bar are
  counted, then the count is below the lowest of the three named templates'.
- **AC7** (R7) — Given `FILLS`, when read, then `second-line` has an entry, and
  every rendered groove's fill bar sounds it rather than `DEFAULT_FILL`.
- **AC8** (R8) — Given the catalogue after this epic, when `npm run test:gen`
  runs, then it holds six `second-line` grooves and all seven gate checks pass
  for each.
- **AC9** (R9) — Given each rendered groove, when the density check runs, then
  its events per bar are inside the template's declared band, and the epic's
  report states the measured spread across the six.
- **AC10** (R10) — Given the six mp3s, when a person listens to each in full,
  then the report records their verdict in their own words, including whether the
  snare reads as a figure. A gate pass is not a sign-off.
- **AC11** (R11) — Given `docs/music.md`, when read after this epic, then the
  feel table lists `second-line` with the values the template actually declares.
- **AC12** — Given `npm run grooves:verify` and `git status` after
  `npm run grooves`, when inspected, then no groove outside this template has
  re-rendered.

## Dependencies

**Needs:** Epic 1 — the flavour rule, `FeelTemplate.patterns` with its snare,
kick and bass pools, and `grooves:add <n> --template <id>`. Not feature-24.

**Hands to Epic 6:** six grooves.

**Shares with Epics 2 and 4:** `templates/index.ts`, `templates/index.test.ts`,
`catalogue.json` and `grooves.lock.json` — built in parallel, minted in series.

## Assumptions

- **The `musician` decides the parameters**, including whether the style wants a
  swung or straight grid. R1–R9 bound the decisions rather than making them.
- **The snare's ghost notes come from the shared ghost pool unless the style
  needs otherwise.** `SNARE_GHOST_PATTERNS` is drawn on `GHOST_LABEL`, so a
  template-level ghost pool is available from Epic 1 and used only if the shared
  one reads wrong.
- **"Bass follows the kick" is a constraint on the declared pools, not a new
  mechanism.** The two pools are written to agree; nothing in `events.ts` learns
  to derive one from the other.
