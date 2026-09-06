# PRD — Epic 4: Boom-bap

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

One template, `boom-bap`, and six grooves from it: 85–95 bpm, swung sixteenths, a
hard kick and snare with ghost notes underneath, keys sparse. It is the cheapest
of the five to build and the least new to hear, which is why it goes last in wave
2 — and why this epic carries one judgement the others do not have to make.

## Problem

`new-styles.md` flags it plainly: boom-bap "sits close to `straight-funk` and
`half-time`, so the feel-as-clue gets weaker still". `straight-funk` is 94–106 at
swing 0.18 on sixteenths; `shuffle` is 78–92 at 0.64; `swung-sixteenth` is
106–116 at 0.44. A swung-sixteenth feel at 85–95 lands in the gap between three
templates that already exist, and the risk is not that it fails a gate — it will
pass — but that it renders six grooves nobody can tell from the ones already in
the catalogue.

That makes the deliverable here partly a decision: build it, hear it against its
neighbours, and say out loud whether it earned its place.

## Scope

- `templates/boom-bap.ts`, registered in `templates/index.ts`
- whatever figures it needs in the template's own `patterns` block
- six grooves minted, gated and signed off by ear
- an explicit back-to-back comparison against `straight-funk` and `half-time`,
  and its verdict in the epic's report
- one row in `docs/music.md`'s feel table

**Out of scope**
- new voices. Everything it needs is declared
- sampled-record texture — vinyl noise, filtered breaks, a sampler's pitch
  artefacts. The generator renders clean voices, and dirtying them is a
  processing feature, not a template
- the flavour rule and the `patterns` block — Epic 1's, frozen before this starts
- the rota — Epic 6

## Requirements

- **R1** — `templates/boom-bap.ts` declares a tempo range inside 85–95 bpm and
  swung sixteenths, with a tempo range and a swing value distinct from every
  other registered template — in particular from `shuffle` at 78–92 and from
  `straight-funk`'s and `swung-sixteenth`'s swing values.
- **R2** — Its flavours are two to four of the twelve already offered.
  `new-styles.md` proposes dorian, aeolian and phrygian; the `musician` settles
  the list, which is frozen the moment its first groove is minted.
- **R3** — The kick and snare lead the **kit** — above every other drum the
  template declares — and land hard: their velocity floor is above the ghost
  notes' by a margin the `musician` states. They do **not** lead the mix. The
  comp and the bass sit above them, and no lower against the kick than any other
  registered feel puts them, because those two voices carry the answer the
  player is asked to hear. *Amended after a hearing — see
  [Amendments](#amendments).*
- **R4** — Ghost notes sound underneath the snare, quiet enough to be texture
  rather than a second backbeat.
- **R5** — The comp is sparse: fewer events per bar than `straight-funk`,
  `swung-sixteenth` or `bright-straight` declare.
- **R6** — Six grooves are minted for the template, every one passing all seven
  gate checks.
- **R7** — Its density band is declared for the style as built, not inherited
  from a neighbouring template.
- **R8** — The epic reports a **distinctness verdict**: each of the six grooves
  heard immediately after a `straight-funk` groove and a `half-time` groove, and
  a stated answer to whether it reads as its own feel. The verdict is a person's
  and it is recorded whichever way it goes.
- **R9** — A verdict that it does not read as its own feel sends the template
  back to the `musician` once, to be pulled away from its neighbours: the swing
  value, the tempo range and the ghost-note balance are the parameters retuned,
  and the retune states what it expects to change about the sound before it is
  rendered.
- **R9a** — The retuned template is heard the same way R8 describes, and that
  second hearing is final. Positive, and the six grooves ship. Negative, and the
  epic stops: the template file and both verdicts are what ships, no groove is
  minted, and boom-bap is recorded in `specs/new-styles.md` as a candidate that
  was tried twice — the way feature-13's ride was recorded as a failed one.
- **R9b** — There is no third hearing, and the retune does not become a loop. Two
  verdicts is the budget, because the four other styles do not depend on this one
  and the feature is not waiting on it.
- **R10** — The listening sign-off is a person's, recorded per groove in the
  epic's report, and separate from R8's comparison: one asks whether the groove
  is good, the other whether the feel is new.
- **R11** — `docs/music.md`'s feel table gains its row if the grooves ship. If
  R9a stops the epic, `specs/new-styles.md`'s boom-bap row records both hearings
  instead, including what the retune changed and whether it moved the verdict at
  all.

## Acceptance criteria

- **AC1** (R1) — Given the registered templates, when the template suite runs,
  then `boom-bap`'s swing value and tempo-range string are unique across the
  registry and its range lies inside 85–95.
- **AC2** (R2) — Given the template, when the flavour suite runs, then it holds
  two to four distinct flavours, every one of them in `FLAVOURS`.
- **AC3** (R3, R4) — Given every rendered groove, when its events are inspected,
  then every ghost event's velocity is below every backbeat snare event's, by
  the margin the `musician` states. And given the template's `gain`, the kick
  and snare sit above every other **drum** it declares, while its comp and bass
  sit no lower against its kick than any other registered feel's do, and measure
  on `straight-funk`'s balance over the six committed grooves. *Amended after a
  hearing — see [Amendments](#amendments).*
- **AC4** (R5) — Given every rendered groove, when its comp events per bar are
  counted, then the count is below the lowest of the three named templates'.
- **AC5** (R6) — Given the catalogue after this epic, when `npm run test:gen`
  runs, then it holds six `boom-bap` grooves and all seven gate checks pass for
  each — or, under R9a's negative second verdict, no `boom-bap` grooves and a
  registry the suite still passes.
- **AC6** (R7) — Given each rendered groove, when the density check runs, then
  its events per bar are inside the template's own declared band.
- **AC7** (R8) — Given the six mp3s and one groove each from `straight-funk` and
  `half-time`, when a person hears them back to back, then the report states
  whether boom-bap reads as its own feel, in their words, before any decision to
  ship.
- **AC8** (R9) — Given a negative first verdict, when the epic continues, then
  the template's swing, tempo range and ghost-note balance have changed, the
  report states what the `musician` expected each change to do, and the six
  grooves are re-rendered from the retuned template before they are heard again.
- **AC8a** (R9a) — Given a negative second verdict, when the epic closes, then no
  `boom-bap` groove is in the catalogue, `grooves.lock.json` and the manifest are
  unchanged by this epic, and both verdicts are written into
  `specs/new-styles.md`.
- **AC8b** (R9a, R9b) — Given a positive verdict at either hearing, when the epic
  closes, then the six grooves are in the catalogue and no third hearing was
  required to get them there.
- **AC9** (R10) — Given the six mp3s, when a person listens to each in full, then
  the report records their verdict per groove. A gate pass is not a sign-off.
- **AC10** (R11) — Given `docs/music.md` and `specs/new-styles.md`, when read
  after this epic, then exactly one of them records boom-bap's outcome and it
  matches what actually shipped.
- **AC11** — Given `npm run grooves:verify` and `git status` after
  `npm run grooves`, when inspected, then no groove outside this template has
  re-rendered.

## Dependencies

**Needs:** Epic 1 — the flavour rule, `FeelTemplate.patterns`, and
`grooves:add <n> --template <id>`. Not feature-24.

**Hands to Epic 6:** six grooves, or none if R9 stops the epic. Epic 6 reads the
catalogue as it finds it, so a stopped boom-bap costs it nothing.

**Shares with Epics 2 and 3:** `templates/index.ts`, `templates/index.test.ts`,
`catalogue.json` and `grooves.lock.json` — built in parallel, minted in series.

## Assumptions

- **The `musician` decides the parameters**, including the exact swing value that
  separates this from `swung-sixteenth` and `shuffle` by ear rather than only by
  number.
- **A negative verdict is a real outcome, not a failure of the epic.** The
  feature ships four new styles instead of five, and the roadmap's other epics
  are untouched — this is the one epic in the feature whose value was flagged as
  uncertain before it was planned.
- **The retune is a musical change, not a rewrite.** R9 names three parameters
  because the style's problem is that it sits between three existing feels, and
  those three are what move it. A retune that changes the mode list or the
  figures is a different template wearing the same id, and its grooves would need
  their own first hearing.
- **"Reads as its own feel" is judged on the groove, not on the label.** The
  comparison is done by listening without knowing which template is playing where
  that is practical.

## Amendments

Changes made to the requirements after they were written, and why. R3 and AC3
above are amended text; this is what they said before and what overturned them.

### R3 and AC3 — the drum-forward mix, reversed by a hearing · 2026-09-06

**What they said.** R3: *"The kick and snare are the loudest voices in the mix,
set by the template's `gain`, and land hard."* AC3's second clause: *"the kick
and snare gains are the highest the template declares."* That inversion — drums
over the bass, alone in the registry — was the style's declared identity, taken
from the genre reference: a struck sampled break with the rest of the band
behind it.

**It was built that way, and the player heard it.** The six grooves were minted
under the inversion, which put the comp about 15 dB and the bass about 16 dB
under the kick — roughly 12 dB below the quietest of the six feels that predate
this feature. The verdict on `groove-71` … `groove-76`:

> "groove 71-76: the comp (piano) is too quiet. Remember: this app is about
> finding the harmony"

**Why the code is right and the criterion was wrong.** The second sentence is a
product principle, not a note about one feel. This app is a puzzle in which the
player identifies the mode by ear; the comp states the chord and the bass states
the root, so they are the two voices carrying the answer the player is asked
for. A mix that buries them is not affordable however good the genre reference
is — and the inversion cannot be kept in any partial form, because it *is* the
buried harmony described from the other side. The drum-forward mix was tried,
shipped as far as a hearing, and rejected by the player. That is a decision made
on the thing itself, which is worth more than the criterion it overturns.

**What shipped instead.** `scripts/grooves/templates/boom-bap.ts` declares
`kick −11, snare −10, hatClosed −18, hatOpen −24, bass −3.1, comp −4.7`. The
bass now sits 6.9 dB above the snare and the comp 5.3 dB above it. Every kit
voice moved by one uniform 7 dB offset, so the kit's own internal balance is
exactly the one the feel was minted with — its closed hat still measures 18.7 dB
under its own kick, where `straight-funk`'s sits 12.1 dB under its own. What
moved is the kit against the band:
measured post-gain track RMS relative to the kick, over the six committed
grooves, is now comp −2.6 dB and bass −5.1 dB, which are `straight-funk`'s own
figures. No answer moved — `gain` is read in exactly one place in the generator,
`mix.ts`, so a re-gain cannot touch a seed, a root, a mode, a chord or a name.

**What survives of R3.** The kick and snare still lead the *kit*: they sit above
`hatClosed` and `hatOpen`, which is the whole of boom-bap's remaining kit since
it plays no toms and no rim. And the ghost half of R3 and AC3 is untouched — the
`musician`'s stated margin is 0.2 of velocity, asserted at
`scripts/grooves/templates/boom-bap.test.ts › sounds every ghost under every
backbeat, with 0.2 of velocity to spare` and again over the six committed
grooves.

**Where the working is.** `specs/features/feature-25/.implement/harmony-regain.md`
— the measurements, the seed sweep through the gate, the proof that no answer
moved, and what the change costs the feel's character.

**What this does not settle.** R8's distinctness verdict and R10's per-groove
sign-off are still outstanding, and the comp-too-quiet hearing is not either of
them. Whether it consumes one of R9b's two verdicts is an open question for the
feature-wide listening pass; nothing in the tree records an answer.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-05

**Q1. What does a negative distinctness verdict actually stop?**
Answer: **C) A negative verdict sends it back to the `musician` once — retune the
swing, the tempo and the ghost-note balance — and it ships or stops on the second
hearing.** The style's problem is that it sits between three feels that already
exist, and that is a tuning problem before it is a verdict, so one retune is
cheaper than either shipping six indistinct grooves or abandoning a style over a
swing value.
Applied to: R9, R9a, R9b, R11, AC5, AC8, AC8a, AC8b, Assumptions
