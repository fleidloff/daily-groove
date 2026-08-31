# PRD — Epic 6: More feels, more modes

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The catalogue stops being four feels. Two new feel templates join the four that
exist, and because each template carries its own disjoint pair of modes, the
vocabulary grows from eight modes to twelve. The chip row does not get longer —
it offers four options drawn from a pool — but the pool widens, so the day's
four are less predictable and the answer is genuinely harder to guess by
elimination. That difficulty increase is the point and is not compensated for.
The new modes stay inside the diatonic and common minor families, because every
mode must be gradeable as major or minor or simple mode throws on it — and they
are chosen two major and two minor, so simple mode's two answers stay evenly
matched.

## Problem

Four templates means every groove is one of four kits, and a player who has
played for two weeks has heard each of them a dozen times. It also caps the
answer vocabulary at eight modes, two per template, which is what the disjoint
pairing buys: hearing the feel honestly narrows the mode. More feels is the only
way to widen the vocabulary without breaking that.

## Scope

- Two new feel templates, each with its own disjoint pair of modes, taking the
  vocabulary to twelve.
- The new modes added everywhere the vocabulary is declared, in the generator
  and in the app.
- New grooves minted so the catalogue is spread across the enlarged set.

**Out of scope**
- **Any further change to the feel machinery.** A template written here is data.
  If it needs a knob that does not exist, that knob belongs to Epic 3 or 4 and
  this epic waits for it.
- **Redesigning the guess card.** The chip row's shape is unchanged. If a
  finding here says it needs to change, that is a finding to raise, not a
  redesign to slip in.
- **Retiring any groove or template.** Ids are stable and the existing four
  feels stay.
- **A third answer in simple mode.** Simple mode offers major and minor; see R6.
- **Changing how the day's four options are chosen.** `buildOptions` and its
  date seeding are untouched.

## Requirements

- **R1** — New feel templates are registered alongside the existing four and are
  drawn from by the minting process like any other.
- **R2** — Every template carries exactly two modes, and no mode is carried by
  more than one template. The union of all templates' modes is exactly the set
  of modes the game offers.
- **R2a** — Two templates are added, taking the set to six templates and twelve
  modes.
- **R3** — Each new mode is declared everywhere the vocabulary lives: its
  interval set and display name in the generator's scale table, its validity
  rule, and its presence in the distractor pool.
- **R4** — A new mode's distractor entries are spelled in the same modal
  vocabulary as the answers they sit beside.
- **R5** — Every new mode yields a nameable chord on its tonic that the scale
  entirely contains, so a groove in it can state its own harmony.
- **R6** — Every mode the catalogue can play is gradeable as major or minor, and
  has an entry in the app's family table. Simple mode never encounters a mode it
  cannot grade.
- **R6a** — New modes are drawn from the diatonic modes and the common minor
  scales. Locrian is excluded, as it already is, because its diminished fifth
  makes it neither family in any honest reading; symmetric scales are excluded
  by R5 as well.
- **R6b** — The twelve-mode set is evenly split between the families: **six
  graded Major and six graded Minor**. A mode that is musically more interesting
  is passed over when taking it would skew the split.
- **R6c** — Reaching that split takes **three new major-third modes and one
  minor-third**, not two of each. The existing eight are three major and five
  minor, because `blues` is graded by its minor third; an earlier draft of R6b
  said "two and two" on the false premise that they were four and four, which
  would have produced a 5/7 set and made *Minor* the better blind guess in simple
  mode — the exact failure R8 forbids. The split is arithmetic, not taste, and it
  is the reason the four modes are the four they are.
- **R7** — The mode row continues to offer four options: the day's answer plus
  three distractors, seeded by the date, drawn uniformly from the pool. The
  draw is not biased toward or away from the answer's family; the wider pool is
  the intended difficulty increase, and simple mode remains the escape hatch for
  anyone it is too hard for.
- **R8** — Simple mode continues to offer exactly two options in the mode row,
  and neither is the better blind guess: the mode set is split evenly between
  the families, so a player who cannot hear the answer gains nothing by always
  picking one.
- **R9** — The catalogue is spread across all templates, and each mode is
  carried by a comparable number of grooves so no mode dominates the answers.
- **R10** — No existing groove's `id`, audio, or answer changes as a result of
  this epic.
- **R11** — No groove id is ever re-issued. New grooves continue from the
  highest number ever used.
- **R12** — Every new groove passes peak, silence, seam, harmony, pitch and
  density.
- **R13** — A stored result naming a groove or a mode from before this epic
  still loads and still counts toward the streak.

## Behaviour details

**The chip row does not get longer, and this is worth being precise about.** The
mode row is built by `flavourOptions`, which calls `buildOptions(correct, pool,
date)` — four options, always. The pool is `flavourPool(GROOVES)`, derived from
the catalogue at runtime, so adding modes widens the *pool the three distractors
are drawn from*, not the row. The player still sees four chips.

What actually changes for the player is the quality of the guess. With eight
modes, the three distractors are drawn from seven candidates and repeat often
enough to be learnable. With twelve, they repeat less, and elimination becomes a
worse strategy than listening. That is the intended effect, and it is a
difficulty increase arriving through the pool rather than through the layout.

**Simple mode is the hard constraint on which modes are addable.** `familyOf`
throws `UnknownFamilyError` for any mode absent from its table, and the table is
documented as total over exactly the six modes the rotation plays. A new mode
with no family entry does not degrade gracefully — it throws on the day that
mode is the answer, for every player in simple mode. So R6 is not housekeeping;
it decides which modes are candidates at all:

- A mode graded by a clear major or minor third is addable.
- A mode whose fifth is diminished is not gradeable into either family in any
  honest reading. `families.ts` records that this is exactly why locrian was
  removed from the catalogue.
- A symmetric scale with no perfect fifth is doubly excluded — see R5.

**R5 is the generator's own filter.** `chordsForScale` walks the chord-quality
table and takes the first quality the scale entirely contains. A scale with no
perfect fifth matches only the augmented triad or nothing at all, so it cannot
state a tonic chord, and `buildHarmony` throws. The blues scale already needed a
stated idiom for a related reason: its I, IV and V are dominant sevenths whose
major third no strict reading of the six-note scale holds. Any candidate mode
should be run through `chordsForScale` before it is adopted, and given an idiom
entry if the derivation produces something in-scale but unidiomatic.

**Twelve modes, not more.** Two new templates is the largest step that stays
inside the vocabulary R5 and R6 allow — modes that both state a tonic chord the
scale contains and grade cleanly as major or minor. Reaching for four new
templates would mean eight new modes, and the candidates that far out start
failing one constraint or the other.

**Why the families are balanced deliberately.** Grading is by the third, and the
candidates R6a admits are lopsided: melodic minor and the minor-third modes of
the harmonic and melodic minor scales are a short list, while lydian dominant,
phrygian dominant, mixolydian ♭6 and harmonic major all grade major. Choosing
purely on musical interest would take the set from four-four to seven-five, and
"Major" would become the better guess on a day the player cannot hear the
answer — which is exactly the elimination strategy the wider pool is meant to
defeat. Two of each keeps simple mode a real discrimination rather than a
weighted coin.

**Why this epic is last.** A template is data written against a shape. Epics 2
through 5 each add to that shape — mix values for new voices, lean values, an
optional fill entry. A template authored before they settle has to be re-tuned
after each one, and re-tuning a feel is a listening pass, not an edit.

## Acceptance criteria

- **AC1** (R1) — Given the template registry, when it is read, then it contains
  the new templates, and a minted batch spreads across all of them.
- **AC2** (R2, R2a) — Given every registered template, when their mode pairs
  are collected, then there are six templates, no mode appears twice, and their
  union is exactly the game's twelve modes.
- **AC2a** (R6a) — Given the mode set, when it is inspected, then locrian is
  absent and every mode has a perfect fifth.
- **AC2b** (R6b, R8) — Given the twelve modes, when each is graded by its third,
  then six are major and six are minor.
- **AC3** (R3) — Given each new mode, when the generator's scale table, validity
  table and distractor pool are inspected, then each contains it.
- **AC4** (R4) — Given the distractor pool, when its entries are read, then
  every one is spelled in the same modal vocabulary as the catalogue's answers.
- **AC5** (R5) — Given each new mode and each of the twelve roots, when a
  harmony is built, then it produces a nameable tonic chord that the scale
  contains.
- **AC6** (R6) — Given every mode in the catalogue, when its family is
  requested, then a family is returned and nothing throws.
- **AC7** (R6, R8) — Given a day whose groove carries a new mode and a player in
  simple mode, when the puzzle renders, then the row offers two options, one of
  which is the correct family, and the day is winnable.
- **AC8** (R7) — Given any date, when the day's mode options are built, then
  there are four, they include the answer, the same date yields the same four in
  the same order, and the three distractors are drawn uniformly from the pool
  with no family weighting.
- **AC9** (R9) — Given the catalogue after minting, when its grooves are grouped
  by template and by mode, then both are spread with no mode carried by
  disproportionately more grooves than another.
- **AC10** (R10, R11) — Given the catalogue before and after, when they are
  compared, then every pre-existing entry is unchanged, every pre-existing mp3
  verifies against its lock entry, and the new ids continue from the previous
  highest.
- **AC11** (R12) — Given every newly minted groove, when the gate runs, then it
  passes every check.
- **AC12** (R13) — Given a stored result naming a groove from before this epic,
  when the app loads, then it does not throw and the streak still counts that
  day.
- **AC13** — Demo: mint a batch and listen. The new feels are distinguishable
  from the existing four, and hearing the feel still narrows the mode honestly.

## Dependencies

**Needs Epics 2, 3, 4 and 5** — not for their code, but for the shape they
settle. A template declares mix values per voice (Epic 2's re-tune, Epic 5's new
voices), timing bounds and lean (Epic 3), possibly a reverb amount (Epic 4's Q2),
and possibly a fill entry (Epic 5). Every one of those is a field a new template
must supply, and authoring templates before they exist means writing them twice.

This is the only epic in the feature that changes the app's answer vocabulary.
It touches the generator's scale, validity and pool tables, and the app's family
table and mode pool — but not the guess card's structure.

## Assumptions

- The number of new grooves minted follows the existing per-template balance
  rather than a fixed total.
- The minor-third candidates that satisfy R5 and R6 are a short but sufficient
  list — melodic minor, dorian ♭2 and dorian ♯4 all keep a perfect fifth and
  yield a nameable tonic chord (`mMaj7`, `m7`, `m7`). The major-third side has
  more candidates than it needs. Which four are chosen is an authoring decision
  taken while writing the templates.
- New templates get `PLACEMENTS` and `FILLS` entries only where they differ from
  the defaults, the way the existing four do.
- `Flavour` in `src/lib/groove.ts` stays a plain string. The pool is derived from
  the manifest at runtime, and widening the vocabulary is not a reason to make it
  a union.
- Minting uses the existing `grooves:add` path and gate. Nothing about the
  minting process changes here.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. How many new templates?**
Answer: **A) Two new templates, twelve modes total** — it doubles the feel
variety a regular player meets while staying inside the set of modes that both
state a tonic chord and grade as major or minor.
Applied to: Summary, Scope, R2a, AC2, Behaviour details

**Q2. Which modes can the new templates carry?**
Answer: **A) Stay inside the diatonic and common minor families** — locrian
excluded, melodic minor and its familiar modes admitted.
Applied to: Summary, R6a, AC2a, Assumptions

**Q3. Does the widening pool need a difficulty check?**
Answer: **A) No change** — the pool widening is the intended difficulty
increase, and simple mode is already the escape hatch feature-7 shipped for it.
Applied to: Summary, R7, AC8

### Cycle 2 — 2026-08-31

**Q4. How are the four new modes balanced between the families?**
Answer: **A) Two of each** — a set skewed toward major would make "Major" the
better blind guess in simple mode, which is the elimination strategy the wider
pool is meant to defeat.
Applied to: Summary, R6b, R8, AC2b, Behaviour details, Assumptions
