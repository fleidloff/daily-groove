# PRD — Epic 3: A full rotating catalogue whose answers come from the audio

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Turn one groove into a rotation. Hand-authored feel templates give the catalogue its
variety of rhythm and instrumentation, seeds give it variety of key and harmony, and
the generator writes the answers next to the audio so a groove's stated scale is
always the one that was actually played. The hand-written seed data retires.

## Problem

A daily game whose groove is the same every day is not a daily game. Today's catalogue
is also hand-written, which is how it drifted: seven grooves whose answers nobody can
verify against audio that does not exist, using a set of modes that does not match the
eight flavours the game is about to offer.

## Scope

- Feel templates — the hand-authored half of a groove.
- A catalogue of template × seed combinations spanning keys, modes, chord qualities,
  progressions, tempos and feels.
- Coverage of every flavour the game offers.
- Metadata and answer-option data emitted by the generator, replacing `seed.ts`.
- Musical validity guard rails.

**Out of scope**
- How good it sounds — Epic 2 owns voices, feel and mix for every groove minted here.
- Growing the catalogue after this first pass, and the quality gate — Epic 4.
- Changing the date → groove mapping; feature-1's hash-by-date selection is untouched.
- The guessing UI. Which chips the player sees is feature-2's business; this epic only
  guarantees there is a groove behind each of them.

## Requirements

**Templates**

- **R1** — The catalogue is built from four distinct feel templates, differing in
  subdivision, swing, tempo range and instrumentation, so the rotation does not sound
  like one groove transposed.
- **R2** — Each template declares the two flavours its grooves may carry, paired with
  the feel on musical grounds — a shuffle carries blues and minor, a bright straight
  feel carries lydian and major — along with the harmonic vocabulary those flavours
  draw on. A seed can only produce harmony the template permits.

**The catalogue**

- **R3** — The catalogue holds sixteen grooves, four from each template.
- **R4** — Grooves vary in key, mode, chord quality, progression, tempo and feel. No
  two grooves in the catalogue share the same combination of scale and progression.
- **R5** — The four templates' flavour pairs are disjoint and their union is exactly
  the eight flavours the game offers, so every flavour has two grooves behind it. No
  flavour is offered that no groove can answer to, and no groove answers to a flavour
  the game does not offer.
- **R6** — Every groove has a unique `id`, and its `audioSrc` names a file that exists
  and is non-empty.

**Generated answers**

- **R7** — `GROOVES` is emitted by the generator, not hand-written.
  `src/features/daily-groove/lib/seed.ts` is deleted.
- **R8** — A groove's `scale`, `chord`, `progression`, `root` and `flavour` describe the
  audio that was rendered from the same events. They cannot be edited independently of
  the audio, because nothing edits them.
- **R9** — A groove's `chord` and `progression` are validated against its scale by a
  rule table keyed on flavour. The modal flavours require strict diatonic membership;
  blues permits dominant sevenths on I, IV and V; harmonic minor admits the raised
  seventh and the chords built on it. Every flavour the game offers has an entry in the
  table, and a groove whose harmony fails its flavour's rule is invalid.
- **R10** — `selectGrooveForDate` and the app's existing consumers keep working against
  the generated module without changes to their signatures.
- **R11** — The generator also emits the scale, chord and progression distractor pools
  that `seed.ts` exported, covering every value the catalogue uses plus enough
  plausible-but-wrong alternatives for `buildOptions`. They are emitted even though
  feature-2's rewrite may leave them without a consumer: removing a public export while
  that rewrite is mid-flight is the riskier order.

## Behaviour details

**Feel and flavour are deliberately correlated.** Pairing each template with the two
flavours that suit it means an attentive player can narrow the answer from the rhythm
alone — hearing a shuffle rules out lydian. That is accepted: grooves that are
idiomatic for their flavour are worth more than grooves that are hard to read, and a
player who learns to hear that a shuffle sounds bluesy has learned the thing the game
is teaching. Decorrelating feel from flavour would have meant writing lydian over a
shuffle, which serves the puzzle at the expense of the music.

**Where variety actually comes from.** Templates and seeds do different jobs, and
conflating them is how a catalogue ends up monotonous. The template carries everything
a listener would call the *style* — how fast, how swung, what plays. The seed carries
everything they would call the *tune* — which key, which chords, which of the
template's permitted rhythmic placements. Twelve seeds against one template gives
twelve keys of the same groove; twelve seeds spread across four templates gives a
rotation.

**Validity is per-convention, not universal.** "The chord belongs to the scale" is the
right rule for the modal flavours and the wrong rule for blues, where the I, IV and V
chords are dominant sevenths that no strict reading of the scale contains. A single
universal rule would therefore either reject correct blues or be loosened until it
stopped catching anything. The rule table in R9 keeps the guard rail strict where
strictness is right and idiomatic where it is not.

## Acceptance criteria

- **AC1** (R1) — Given the template set, when templates are compared, then there are
  four and they differ in subdivision, swing and tempo range, not only in name.
- **AC2** (R3) — Given the catalogue, when its size is checked, then it holds sixteen
  grooves, four per template.
- **AC3** (R4) — Given the catalogue, when scale-and-progression pairs are compared,
  then no two grooves share one.
- **AC4** (R5) — Given the set of flavours the game offers, when each is looked up in
  the catalogue, then exactly two grooves carry it.
- **AC15** (R2, R5) — Given the four templates, when their declared flavour pairs are
  combined, then the pairs are disjoint and their union is the game's eight flavours.
- **AC5** (R5) — Given every groove in the catalogue, when its flavour is checked
  against the game's flavour set, then it is a member.
- **AC6** (R6) — Given every entry, when `id` values are collected, then they are
  unique.
- **AC7** (R6) — Given every entry, when its `audioSrc` is resolved on disk, then the
  file exists and its size is greater than zero.
- **AC8** (R7) — Given the repository, when `seed.ts` is looked for, then it does not
  exist and nothing imports it.
- **AC9** (R8) — Given a groove's rendered note events, when they are compared to its
  manifest entry, then the pitches played match the stated chord and progression.
- **AC10** (R9) — Given every entry, when its chord and progression are validated
  against its scale under its flavour's rule, then all pass.
- **AC13** (R9) — Given the rule table, when it is checked against the game's flavour
  set, then every flavour has a rule, and a deliberately wrong harmony for each flavour
  is rejected.
- **AC14** (R11) — Given the generated pools, when they are checked, then each contains
  every value the catalogue uses plus enough distinct distractors for `buildOptions` to
  fill an option set for any groove.
- **AC11** (R10) — Given a full year of dates, when the day's groove is resolved for
  each, then every result is a valid catalogue entry with playable audio.
- **AC12** (R10) — Given the app, when it is built and its existing tests run, then
  they pass against the generated module.

## Dependencies

**Needs before starting:** Epic 1's feel-template contract and manifest field set. The
template *shape* is fixed there; this epic authors instances of it.

**Hands to later epics:** the template set and the catalogue that Epic 4's
`grooves:add` extends, and the flavour coverage feature-2's chip row depends on.

**Waits for Epic 2.** Both epics rewrite the committed audio, so they are serialized:
Epic 2 completes and merges first, and this epic then mints the catalogue through a
finished renderer. Nothing minted here needs re-rendering afterwards. This supersedes
the roadmap's parallel wave 2.

**Consumed by feature-2**, whose root/flavour chip sets are only honest if R5 holds.

## Assumptions

- Ids stay in the existing `groove-NN` form so `audioSrc` paths remain predictable.
- The existing seven `groove-01`…`groove-07` files and their answers are replaced
  outright. Stored history from before this epic is invalidated; the app is
  pre-release and feature-2 is already version-bumping storage, so nobody loses a
  streak.
- Distinct keys are spread across the twelve roots rather than clustering in the
  guitar-friendly ones, since the briefing asks for grooves any instrument can jam
  with.
- Template authoring is a musical judgement made during implementation; the PRD fixes
  how many and how varied, not which ones.
- Sixteen grooves at roughly ten seconds each is a few megabytes of committed audio —
  well inside what the repository should carry.
- The harmonic-minor and blues rules encode the common practice reading of each, not
  every historical variant; the table is extensible if a template later needs more.

## Question log

### Cycle 1 — 2026-08-29

**Q1. How big is the initial catalogue, and across how many templates?**
Answer: **A) 16 grooves across 4 templates** — four keys per feel; the roadmap's
target was 12–16, and four feels is where the rotation stops sounding like one groove.
Applied to: R1, R3, AC1, AC2

**Q2. feature-2 replaces the multiple-choice pickers with fixed chip rows. Does the generator still emit distractor pools?**
Answer: **A) Emit the pools anyway** — dropping a public export while feature-2 is
mid-flight is the riskier order.
Applied to: R11, AC14

**Q3. Blues and harmonic minor break "the chord is diatonic to the scale". How is R9 actually checked?**
Answer: **A) Validity is defined per flavour** — a rule table, strict diatonic for the
modal flavours, dominant sevenths on I/IV/V for blues.
Applied to: R9 (rewritten), AC10, AC13, Behaviour details, Assumptions

### Cycle 2 — 2026-08-29

**Q4. Sixteen grooves, four templates, eight flavours. How do flavours map onto feels?**
Answer: **A) Each template carries two flavours, chosen for musical fit** — accepting
that feel and flavour become correlated, because idiomatic grooves are worth more than
decorrelated ones.
Applied to: R2, R5, AC4, AC15, Behaviour details ("Feel and flavour are deliberately
correlated")

---

**This PRD is settled.** No high-impact questions remain.
