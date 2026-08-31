# PRD — Epic 5: The last pass ends with a fill

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The last bar of the last pass stops being another bar. Toms join the kit, a
per-template fill vocabulary fills that bar, and a lighter variation marks the
middle of the loop where there is a middle to mark. Every template gets a fill —
the sparse feels get a sparse one — and the downbeat that follows is left clean,
with no crash. The passes stop being takes of the same bar and become a section
with a shape.

## Problem

Epic 1 makes the passes sound different from each other, which stops the ear
locking onto the loop. It does not give the loop a shape: every pass still
begins and ends the same way, so there is nothing to tell a listener where they
are in it. A fill is the standard answer, and the pack has no toms to play one
with.

## Scope

- Add toms to the sample pack, drawn from the kit Epic 2 chose.
- Grow the voice vocabulary and every template's per-voice mix entries.
- A `FILLS` table keyed by template, alongside the existing `PLACEMENTS`.
- A fill in the last bar of the last pass, and a lighter variation at the end of
  the middle pass where the pass count allows one.
- Density bands adjusted for the fill bar.

**Out of scope**
- **A crash.** The downbeat after the fill stays clean, so no crash sample is
  added and nothing is written into the loop's overhang.
- **Fills anywhere but the end of a pass.** No mid-figure turnarounds, no drum
  solo.
- **Varying the rhythm of the ordinary passes.** Epic 1 already varies their
  performance; the figure stays the figure.
- **Replacing any existing voice.** Epic 2 chose the kit; this epic adds one
  voice group to it.
- **A new `FeelTemplate` field.** The fill vocabulary is a table keyed by
  template id, the way the half-time backbeat override already is.
- **Any change to a groove's answer.** Fills are drums; the harmony is untouched.

## Requirements

- **R1** — The sample pack declares a tom voice group.
- **R2** — The toms come from the same kit as the other drum voices, so a fill
  sounds like it is played on the instrument the groove is played on.
- **R3** — The new voices follow every rule the existing pack follows:
  un-normalised velocity layers, round-robin alternates, mono 44.1 kHz FLAC, a
  provenance entry per file, and a VCSL source.
- **R4** — A template that does not want a voice simply does not list it, and
  renders without it.
- **R5** — The last bar of the last pass carries a fill.
- **R6** — Every template has a fill. A template whose feel lives on space gets
  a sparser fill, not an absent one.
- **R7** — Each template declares its own fill; a template that declares none
  gets a default.
- **R8** — The last bar of the middle pass carries a lighter variation — smaller
  than the fill, enough to mark the half-way point. A groove with fewer than
  three passes has no middle pass, and carries the fill alone with nothing added
  in its place.
- **R9** — Nothing sounds on the downbeat that follows the fill beyond what the
  figure already plays there. No crash is added, and no fill event is written
  past the end of the loop.
- **R10** — The fill is audibly a fill: it differs from the figure's last bar in
  the voices it uses, its density, or both. The variation is audibly smaller
  than the fill.
- **R11** — Every template's density band admits a groove containing a fill.
- **R12** — Every groove still passes peak, silence, seam, harmony, pitch and
  density.
- **R13** — The loop seam remains within its threshold.
- **R14** — No groove's `id`, `bpm`, `root`, `flavour`, `scale`, `chord` or
  `progression` changes.
- **R15** — Nothing in `samples/` is served to the browser or enters the client
  bundle.

## Behaviour details

**Where the fill and the variation go.** Epic 1 makes the pass count a property
of the template, so positions are defined by pass, never by bar number:

| Passes | Variation | Fill |
| :-- | :-- | :-- |
| 2 | none | end of pass 2 |
| 3 | end of pass 2 | end of pass 3 |
| 4 | end of pass 2 | end of pass 4 |
| 5+ | end of the middle pass | end of the last pass |

A two-pass template — which is where `half-time` is expected to land — gets the
fill and nothing else. There is no middle to mark when the loop is one pass and
then its ending, and nothing is substituted for it: one fill in eight bars is
proportionally the same marking a four-pass groove gets in sixteen. Putting a
variation at the end of pass one would also put two markers in consecutive bars,
which is the opposite of what a feel built on space wants.

**Why there is no crash.** A crash on the downbeat after a fill is the
conventional resolution, and in a loop that downbeat *is* the start of the file:
the crash would have to be written past the loop end and folded onto bar one by
the overhang mechanism. That works, and it has a consequence — the crash is then
present at position zero of every playback, so a groove *opens* on a crash
before any fill has been heard. Rather than accept that, or special-case the
first pass, the fill resolves on the snare and the downbeat is left clean. The
loop restarts on the figure, as it does today.

This also keeps the epic's pack work to one voice group, and keeps the seam
exactly as simple as it is now: no fill event is written into the overhang at
all.

**Where this epic sits relative to the others.** Epic 1 gives it somewhere to
go: without distinguishable passes there is no last pass to end. Epic 2 gives it
something to play: toms from a different kit than the snare put the fill in a
different room than the groove, which is the exact fault Epic 2 exists to
remove. Epic 3's dynamics make a fill sound played rather than triggered, but a
fill does not need them to be correct — hence a dependency on 1 and 2 and only a
preference for 3.

**Why the fill table is not a template field.** `FeelTemplate` is a declaration
of the knobs a feel turns: tempo, subdivision, swing, passes, voices, levels,
positions, bounds. A fill is a written phrase, not a knob. `events.ts` already
faces this exact problem with the half-time backbeat, and answers it with
`PLACEMENTS` — a table keyed by template id, living next to the rule it
overrides. `FILLS` is the same answer to the same question, which also keeps
`FeelTemplate` stable for Epic 6.

**Density.** A fill is the densest bar in the groove. `checkDensity` averages
over the whole loop, so one dense bar in eight or sixteen moves the average by
little — but the bands were tuned in Epic 3 against grooves with no fill, and
the check exists to catch mush. R11 makes adjusting them a deliberate act rather
than a surprise from `grooves:add`.

## Acceptance criteria

- **AC1** (R1, R3) — Given the pack declaration, when it is read, then a tom
  voice group is present with layered, round-robined samples; and
  `pack.test.ts` proves every declared file exists, is mono 44.1 kHz FLAC, and
  has a VCSL provenance entry.
- **AC2** (R2) — Given `provenance.json`, when the tom entries are read, then
  they name the same source kit as the other drum voices.
- **AC3** (R4) — Given a template that omits toms from its voice list, when a
  groove is rendered from it, then no tom events are produced and the render
  succeeds.
- **AC4** (R5, R7) — Given a rendered groove, when its events are grouped by
  bar, then the fill events fall in the last bar of the last pass and nowhere
  else; and a template with no fill declaration renders the default fill.
- **AC5** (R6) — Given every template, when a groove is rendered from it, then
  it contains a fill.
- **AC6** (R8) — Given a groove of four passes, when its bars are inspected,
  then the last bar of pass two carries a variation; and given a groove of two
  passes, then no bar carries one and nothing else has been added in its
  place.
- **AC7** (R9) — Given a rendered groove, when the events past the loop end are
  inspected, then none belongs to a fill; and when the mixed audio at position
  zero is compared with the figure's own downbeat, then nothing has been added
  to it.
- **AC8** (R10) — Given a rendered groove, when the last bar of the last pass,
  the last bar of the middle pass and the last bar of an ordinary pass are
  compared, then the fill differs most from the ordinary bar and the variation
  sits between them.
- **AC9** (R11, R12) — Given the whole catalogue, when the gate runs, then every
  groove passes every check, and any density band that moved did so in the
  template file.
- **AC10** (R13) — Given every rendered groove, when the seam is measured, then
  it is within `SEAM_THRESHOLD`.
- **AC11** (R14) — Given the manifest before and after, when they are diffed,
  then only `headDelaySeconds` differs, and Epic 1's answer-pinning test passes.
- **AC12** (R15) — Given the built client bundle and `public/`, when they are
  searched, then no file from `samples/` appears in either.
- **AC13** — Demo: play one full loop. The last bar is recognisably a fill, the
  middle pass is marked more lightly where there is one, and the loop restarts
  cleanly with no seam and no crash.

## Dependencies

**Needs Epic 1** for the pass structure — the fill is defined as "the last bar
of the last pass", and the variation as "the last bar of the middle pass",
neither of which exists until Epic 1 merges. It also reads Epic 1's `passes`
field to know whether a middle pass exists at all.

**Needs Epic 2** for the kit. This is the reason the epic is in wave 2 rather
than wave 1: toms sourced against the current cajon-based pack would have to be
re-chosen the moment Epic 2 lands.

**Benefits from Epic 3**, but does not wait on it.

It hands **Epic 6** two things a new template must supply: an optional `FILLS`
entry, and `gain`/`pan` values for the tom voices.

## Assumptions

- Two or three toms, enough for a descending fill. More is a drum kit; this is a
  short loop.
- The default fill is written for a sixteenth-note grid and resolved onto
  coarser grids by the same `gridSteps` mechanism every other pattern uses.
- The variation is drawn from the same vocabulary as the fill, thinned — most
  simply, the fill with its toms removed.
- Fill events are subject to Epic 3's deviations like any other event; nothing
  about a fill is quantised more tightly than the groove around it.
- `VELOCITIES` gains rows for the new voices in the same metric-position shape
  as the existing ones.
- Where a template has an even pass count, the middle pass is the earlier of the
  two candidates — pass two of four — so the variation sits at the half-way
  point rather than past it.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. How much variation between passes one to three?**
Answer: **B) A light variation in bar eight as well** — a half-way marker,
smaller than the fill.
Applied to: Summary, Scope, R8, R10, AC6, AC8, Behaviour details, Assumptions.
Restated by pass rather than by bar number, because Epic 1's per-template pass
count makes "bar eight" mean different things in different templates — and means
a two-pass groove has no middle pass to mark

**Q2. Does every groove get a fill?**
Answer: **A) Every template gets a fill; the sparse feels get a sparser one** —
the fill is what gives the loop its shape, and a template without one loses the
benefit of the epic.
Applied to: Summary, R6, AC5

**Q3. What about the crash sitting at position zero?**
Answer: **C) No crash — the fill ends on the snare and the downbeat is left
clean** — a groove that opens on a crash before any fill has been heard is worse
than a clean restart.
Applied to: Summary, Scope, Out of scope, R1, R9, AC1, AC7, Behaviour details,
Dependencies — removing the crash voice, the overhang placement and the
"crash lands in the overhang" behaviour drafted in cycle 1, and reducing the
epic's pack work to one voice group

### Cycle 2 — 2026-08-31

**Q4. What marks the loop for a two-pass template?**
Answer: **A) Nothing more** — one fill in eight bars is proportionally the same
marking a four-pass groove gets in sixteen, and a variation in the pass before
the fill would put two markers in consecutive bars.
Applied to: R8, AC6, Behaviour details
