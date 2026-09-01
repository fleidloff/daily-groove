# PRD — Epic 1: A real kit, on one feel

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The sample pack stops being a cajon with a drum kit arranged around it. The kit
stays in VCSL, where it already is: the cajon is replaced by VCSL's own bass
drum, and VCSL's ride and bongos join it. Every voice is then re-levelled, all
ten are declared in `pack.json`, and `straight-funk` is rewritten onto them.
When it is done, one feel renders on the new kit and anyone can say whether it
was the right call — which is the earliest that question can be asked.

## Problem

`pack.json` declares a voice called `kick` and plays `Cajon_hit1_*.flac` into
it. Everything around it — snare, hats, rim, two toms — is VCSL's drum kit, so
every groove in the catalogue is a kit with a hand drum where the bass drum
should be. A cajon has no beater and very little below 80 Hz: it cannot state a
downbeat underneath a pizzicato contrabass, and the whole mix has been levelled
around hiding that. Feature-9's claim to have put "a real kit" in place of the
cajon was three-quarters true.

The kit is also short of two voices. It has one way of keeping time — a closed
hi-hat — so every feel marks its pulse the same way, and it has no hand
percussion at all.

None of this was a limitation of the library. VCSL has a bass drum, a ride and
bongos; the cajon was a choice, and the two missing voices were never sourced.

## Scope

- Replacing the cajon with VCSL's bass drum, and adding VCSL's ride and bongos.
- Preparing the samples with the pack's existing recipe.
- Declaring ten voices in `pack.json`, with velocity layers and round-robins.
- The levelling method — measured, written down, reusable by Epic 2.
- Rewriting `straight-funk.ts` onto the new kit.
- Freezing `VoiceName` and the `pack.json` voice keys for the whole feature.
- `provenance.json`, `samples/README.md`, and the licence texts.

**Out of scope**
- **The other five templates** — Epic 2. This epic rewrites `straight-funk` and
  nothing else.
- **What the ride and the bongo play** — Epic 3. They are stocked and declared
  here and appear in no pattern pool.
- **The `bass` and `comp` voices.** Both stay exactly as they are: VSCO 2 CE's
  pizzicato contrabass and upright piano, same files, same note declarations,
  same measured pitches. The briefing changes the drums, not the band.
- **The comp's velocity curve** — Epic 4.
- **Re-rendering the catalogue, the reference notes or the lock** — Epic 5.
  Nothing the browser serves changes in this epic.

## Requirements

### Where the kit comes from

- **R0** — The drum kit is **MuldjordKit (FreePats edition)** — kick, snare,
  both hi-hats, two toms and the rim. *(Superseded R0: the kit was to stay in
  VCSL. VCSL turned out to be an orchestral library with no kick, no ride and a
  3.3-second concert bass drum; see the roadmap's implementation findings.)* The
  bongos come from VCSL, which does have purpose-recorded ones.
- **R0a** — One library for the whole kit is the point, not a convenience. A kit
  assembled from two sources is a kit recorded in two rooms, and the levelling
  pass would be spending its effort reconciling ambiences instead of setting a
  balance.
- **R0b** — Three libraries, three licence texts committed: MuldjordKit for the
  drums, VCSL for the bongos, VSCO 2 CE for the bass and the comp.
- **R0c** — *Superseded.* Every drum voice is re-sourced, so nothing is carried
  over. What the rule was protecting — not churning files that are already
  correct — now applies to the bongos, the bass and the comp, which are
  untouched.

### The licence bar

- **R1** — Every sample in the pack carries a licence that permits
  redistribution: CC0 for the bongos, the bass and the comp; **CC-BY 4.0** for
  the drums. *(Superseded R1: CC0 only. No CC0 acoustic kit of the needed quality
  exists — DrumGizmo's four kits and Freepats' "Acoustic Drum Kit" are all
  CC-BY 4.0 — which is the finding the roadmap asked for rather than a quiet
  widening.)*
- **R1a** — Every non-CC0 sample records the attribution its licence obliges:
  *"Drum samples provided by DrumGizmo.org"*. This is asserted per row in
  `samples/pack.test.ts`, so a sample cannot enter the pack without it.
- **R1b** — The obligation follows the *output*, not only the source. A rendered
  groove is a derivative work of the samples it is built from, so the credit has
  to be visible to someone using the app. The generator side is done;
  **the app-visible credit is outstanding** and belongs to no epic's scope, since
  this epic puts `src/` out of scope and Epic 5 asserts `src/` changes in exactly
  one file.
- **R2** — `provenance.json` records every file added: its path in the pack, the
  source library, the file's path inside that library, the library's URL, its
  licence, and what was done to it. The existing rows keep their shape.
- **R2a** — The licence text of every library the pack draws on is committed
  alongside the samples. A library that stops being drawn on has its licence
  text removed in the same change.
- **R3** — If no CC0 library clears the listening bar, that is reported as a
  finding and the epic stops. It is not grounds for widening the bar.

### The voices

- **R4** — The pack declares **nine** percussive voices: `kick`, `snare`,
  `hatClosed`, `hatOpen`, `rim`, `tomHigh`, `tomLow`, `bongoHigh`, `bongoLow`.
  *(Superseded: ten, including `ride`. The ride is dropped from the feature.)*
- **R4a** — `kick` is a bass drum struck with a beater. Not a cajon, not a hand
  drum, not a low tom standing in for one.
- **R4b** — `bongoHigh` and `bongoLow` are two drums, declared as two voices. A
  bongo played as a single voice is a hand drum; the interplay between the high
  and the low is what makes it a bongo.
- **R4c** — *Withdrawn.* The ride is not part of the feature. MuldjordKit ships
  two of them, so restoring it is a small, separate decision.
- **R4d** — `bongoHigh`/`bongoLow` are stocked and declared here and belong to no
  pattern pool in this epic. A groove rendered in Epic 1 contains no bongo
  events; Epic 3 gives them a part.
- **R5** — `VoiceName` in `scripts/grooves/types.ts` and the `voices` keys of
  `pack.json` reach their final shape in this epic and do not change again
  within the feature. Epics 2 and 3 build against them in parallel.

### Preparing the samples

- **R6** — Every added file is prepared with the recipe already documented in
  `samples/README.md`: downmixed to mono, capped at a length chosen per voice,
  faded over the last 80 ms of that cap, and encoded as 44.1 kHz 16-bit FLAC.
- **R6a** — Nothing is trimmed at the front. Every file keeps its source lead-in
  so a drum lands with the bass note it is written beside rather than ahead of
  it.
- **R6b** — Samples are **not** normalised. The level difference between
  velocity layers is the data the pack is built on, and normalising erases it.
- **R6c** — The length cap is per voice, long enough to hold that voice's decay
  and no longer. A source shorter than the fade's start comes through untouched.
- **R6d** — The ride is capped long enough to hold its ring. It is the longest
  unpitched voice in the kit and a cap borrowed from the hats would cut it
  mid-decay. A bow-struck ride rings shorter than a bell strike, which is one
  fewer reason to source the bell.

### Velocity layers and alternates

- **R7** — Every percussive voice declares velocity layers whose `maxVelocity`
  bands ascend, cover 0..1 without a gap, and end at 1.0.
- **R7a** — `kick` and `snare` declare at least three velocity layers. They
  carry the metric accent — `VELOCITIES` gives each a strong, medium and weak
  level — and fewer than three layers means those three levels are one recording
  played at three volumes.
- **R7b** — Every other percussive voice declares at least two velocity layers.
- **R7c** — `hatOpen` and `rim` each declared a single velocity layer under VCSL
  and now clear the floor: MuldjordKit records the open hat across fourteen
  dynamic groups and this stroke of the snare across eleven, so both carry real
  layers rather than one recording played at several volumes.
- **R7d** — No layer is invented by copying or scaling another. A layer that
  claims a dynamic the library never recorded is the erasure the un-normalised
  pack exists to avoid. *(No voice needed the limitation clause: MuldjordKit had
  the groups.)*
- **R8** — Every voice declares at least two round-robin alternates in total, so
  consecutive hits are not the same recording.
- **R8a** — Where the source library provides fewer alternates than that for a
  voice, it is recorded as a known limitation in `samples/README.md` rather than
  padded with a duplicate file. A duplicated alternate is a round-robin that
  does nothing while claiming to.
- **R9** — A layer declares `nominalVelocity` explicitly wherever its measured
  level does not sit at the midpoint of its band. `gainFor` in `voices.ts`
  divides by that figure, so a layer left to default when it should not be is
  heard as a step at the band boundary.

### Levelling

- **R10** — The voices are levelled against each other by measurement, not by
  ear alone, and the measurement is reproducible: same inputs, same numbers.
- **R10a** — The method is written into `samples/README.md` in enough detail
  that Epic 2 applies it to five more templates without re-deriving it. It
  states which of the two halves absorbs what: the sample's own recorded
  loudness, which lives in the pack per layer, and the mix position, which lives
  in the template's `gain` in dBFS.
- **R11** — No voice clips: a groove rendered from the new pack passes
  `checkPeak` against `PEAK_CEILING`.
- **R11a** — No voice is inaudible. Every voice a template lists is present in
  the rendered mix at a level a listener can identify.
- **R12** — No layer is scaled into distortion. A layer whose declared or
  defaulted nominal forces `gainFor` to clamp at `MAX_LAYER_GAIN` is
  mis-declared, and is fixed by declaring its nominal rather than by leaving the
  clamp to absorb it.

### The first feel

- **R13** — `straight-funk.ts` has its `voices`, `gain` and `pan` re-derived for
  the new kit. Carrying the cajon-era numbers over is not a rewrite.
- **R13a** — Its `humanize.lean` is revisited, because a beater and a hand do
  not put their attack in the same place relative to the grid.
- **R14** — `straight-funk`'s `flavours`, `tempoRange`, `subdivision`, `swing`,
  `passes` and `density` are unchanged. This feature changes what the groove is
  played on, not what it is.
- **R15** — The pair invariant survives: the six templates' flavour pairs stay
  disjoint and their union stays exactly the twelve flavours the game offers.

### Documentation

- **R16** — `samples/README.md`'s source table and voice-mapping table are
  rewritten to describe the pack as it now is, including the two new voice
  families and the layer × round-robin counts per voice.
- **R17** — The measured-pitch rule stays in the README, unweakened. It governs
  the pitched voices, which this epic does not touch, and it is the pack's
  oldest rule for a reason.

## Behaviour details

**The two halves of a level.** A voice's loudness in the finished mix is the
product of two independent things, and confusing them is the failure mode this
epic exists to avoid:

1. **What the layer was recorded at.** The layers are deliberately not
   normalised, so the layer chosen for a velocity already carries the loudness
   of a hit at that velocity. `gainFor(velocity, nominalVelocity)` scales
   *relative* to that, which is why a mis-declared nominal is heard as a step at
   the boundary rather than as a voice being slightly wrong.
2. **Where the voice sits in the mix.** The template's `gain`, in dBFS, applied
   once per voice by `mixTracks`.

Levelling the pack means fixing (1) so that a hit at a given velocity is the
loudness that velocity implies. Levelling a template means setting (2) so the
voices sit against each other. A pack error corrected in the template's gain
propagates to all six templates as five more corrections.

## Acceptance criteria

- **AC1** (R1, R2, R2a, R0b) — Given the finished pack, when `provenance.json`
  is read, then every audio file present under `samples/` has a row, every row
  names a CC0 licence, both `LICENSE.txt` and `LICENSE-VSCO-2-CE.txt` are still
  committed, and no row names a library whose licence text is absent.
- **AC1a** (R0) — Given `provenance.json`, when the rows for the ten percussive
  voices are read, then every one names VCSL as its source.
- **AC1b** (R0c) — Given the snare, hat, rim and tom audio files, when compared
  byte for byte against the versions before this epic, then the files that were
  already present are unchanged.
- **AC2** (R4, R5) — Given `pack.json`, when its voice keys are read, then they
  are exactly the ten named in R4, and `VoiceName` in `types.ts` declares the
  same ten and no others.
- **AC3** (R4d) — Given `straight-funk` rendered at any seed in this epic, when
  the events are inspected, then none has voice `ride`, `bongoHigh` or
  `bongoLow`.
- **AC3a** (R4c) — Given the ride's rows in `provenance.json`, when their source
  files are read, then each names a bow or tip articulation of VCSL's ride, and
  none is a bell or crash-ride sample.
- **AC4** (R6, R6c) — Given every file added to the pack, when it is decoded,
  then its sample rate is 44 100 Hz, it is single-channel, and its length is at
  or under the cap documented for its voice.
- **AC5** (R7, R7a, R7b, R7c) — Given each percussive voice, when its layers are
  read, then the bands ascend, the last is 1.0, no gap is left between them, and
  the count is at least three for `kick` and `snare` and at least two for every
  other voice — `hatOpen` and `rim` included, which today declare one each.
- **AC6** (R8) — Given each percussive voice, when its files are counted across
  all layers, then there are at least two distinct files.
- **AC7** (R9, R12) — Given a groove rendered from the pack, when the gain
  applied to each event is inspected, then no event's layer gain reaches
  `MAX_LAYER_GAIN`.
- **AC8** (R11) — Given `straight-funk` rendered at every seed the catalogue
  uses for it, when each is passed to `gateCandidate`, then all pass — peak,
  silence, seam, harmony, pitch and density.
- **AC9** (R11a) — Given a `straight-funk` render, when each voice's track is
  measured before mixing, then every voice the template lists is non-silent.
- **AC10** (R13, R14) — Given `straight-funk.ts`, when its fields are compared
  against the version before this epic, then `gain`, `pan` and `voices` differ
  and `flavours`, `tempoRange`, `subdivision`, `swing`, `passes` and `density`
  are identical.
- **AC11** (R15) — Given the six templates, when their `flavours` are collected,
  then the six pairs are disjoint and their union is the twelve flavours.
- **AC12** (R16) — Given `samples/README.md`, when its voice-mapping table is
  read, then it has a row for each of the ten voices with that voice's layer and
  round-robin counts, and those counts match `pack.json`.
- **AC13** (R6b) — Given the prepared files for any one voice, when their peak
  levels are compared across velocity layers, then they differ — a set of layers
  at the same peak is a normalised set.

## Dependencies

**Needs to start:** nothing. This is the first epic in the feature.

**Hands to Epics 2 and 3, as frozen contracts:**

- `VoiceName` — the ten names, final.
- `pack.json`'s voice keys and layer shape, so `pack.get(voice, …)` answers for
  every one of the ten.
- The levelling method in `samples/README.md`, which Epic 2 applies.
- `straight-funk.ts` as the worked example, which Epic 3 validates against
  without needing Epic 2's five files.

## Assumptions

- The samples stay committed to the repo, as they are today. The pack is 3.5 MB
  across 99 files; a kit of this shape is not a size problem.
- The pack stays at 44 100 Hz and stays mono per file, with stereo position
  supplied by the template's `pan`. A stereo pack would make `pan` a second,
  competing image.
- VCSL's bass drum, ride and bongos sit in the same room as the snare, hats and
  toms already in the pack. They come from the same library, recorded the same
  way, which is the whole reason for staying inside it — but it is an assumption
  until the three are heard against the existing voices, and the levelling pass
  is where it gets tested.
- The pack's `id` stays `vcsl-funk`. It still describes what the pack is, and
  nothing keys off it but the round-robin fallback label.
- The cajon is removed rather than kept as a percussion voice. The briefing asks
  for a drum kit and a bongo; a cajon retained alongside both would be a third
  hand-percussion decision nobody made.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-01

**Q1. Where does the kit come from?**
Answer: **A) Stay with VCSL** — one library, one room, guaranteed CC0, and it
fixes the defect the briefing names; VCSL already holds a bass drum, a ride and
bongos, so the cajon was a choice rather than a limitation.
Applied to: R0, R0a, R0b, R0c, AC1, AC1a, AC1b, Summary, Problem, Scope,
Assumptions

**Q2. How deep should the kit sample?**
Answer: **A) At least 3 layers for kick and snare, 2 elsewhere, at least 2
alternates per voice** — it is what makes the strong/medium/weak metric accents
mean something, and it is roughly what the pack already achieves.
Applied to: R7a, R7b, R7c, R7d, AC5

### Cycle 2 — 2026-09-01

**Q3 (cycle 1). What is the ride for?**
Answer: **C) A colour only — withdrawn.** Ticked in cycle 1, then reversed by Q4
below once it turned out to contradict Epic 3's two answers and the roadmap's
settled assumption. Recorded here because it was answered, not because it holds.
Applied to: nothing — superseded by Q4

**Q4. The ride's role — three answers came back in conflict**
Answer: **A) The ride keeps time.** A bow-struck ride, and on a ride feel the hat
drops to punctuation. It is what the roadmap settled, what Epic 3's answers
assume, and it closes the gap the kit actually has: one way of stating a pulse.
Applied to: R4c, R6d, AC3a; and it releases Epic 2's R6 and Epic 3's R1–R6
