# PRD — Epic 4: It sounds like a band in a room

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The parts stop being patterns. Notes end when they are supposed to, a closed
hi-hat cuts a ringing open one, the comp is voiced to move as little as possible
between chords and spread like a hand rather than stamped like a block, and the
bass gets octaves, repeats, rests and a single chromatic approach note into each
chord change. All of it is placed in one shared room. The approach note is the
first pitch the generator plays that its stated scale does not contain, so this
epic also makes the "the words describe the audio" guarantee an actual check
rather than a property of how the code happens to be written.

## Problem

Three things mark the arrangement as generated. The comp plays every chord tone
simultaneously, at identical velocity, in a voicing that re-inverts at random on
every chord change, because `inCompRegister()` folds each tone independently.
The bass walks the chord tones in fixed index order inside a single octave, with
no repeats, no rests and no approach — an arpeggiator, not a player. And
`durationSec` is decorative: `addAt` copies the whole sample regardless, so
nothing has an ending and a closed hat cannot choke an open one. On top of that,
seven dry voices glued only by panning do not sound like they are in the same
place.

## Scope

- Honour note durations, and let a closed hat choke an open one.
- Voice-lead, spread and shape the comp; drop the root when the bass has it.
- Write bass lines: octaves, repeated roots, rests, and one approach note per
  chord change.
- Add an event-level pitch check to the quality gate, with the approach note as
  its one named exception.
- Add one shared reverb send, applied before the loop's overhang is folded.

**Out of scope**
- **Which instruments are playing.** Epic 2 chooses them; this epic decides what
  they play and where they stand.
- **Per-voice EQ, compression or saturation.** The reverb send is the only
  addition to the bus.
- **Timing and dynamics.** Epic 3 owns lean, correlation and accents.
- **Toms and a crash** — Epic 5.
- **Any change to the chord *names* or the progression.** The comp may voice a
  chord differently and omit its root; the chord it names is unchanged.

## Requirements

- **R1** — An event stops sounding at the end of its declared duration, with a
  short release rather than an abrupt cut.
- **R2** — A closed hi-hat onset silences a still-ringing open hi-hat.
- **R3** — Successive comp voicings move by as few semitones as the chord change
  allows, rather than each chord being folded into the register independently.
- **R4** — The notes of a comp chord do not all start at exactly the same
  instant; they are spread by a few milliseconds.
- **R5** — Within a comp chord, the notes are not all at the same velocity.
- **R6** — When the bass sounds the root of a four-note chord, the comp omits
  it. Triads keep their root: a triad minus its root is two notes, which is
  thinner than the fault being fixed.
- **R7** — The bass line uses repeated roots, octave displacement and rests,
  rather than cycling the chord tones in a fixed order within one octave.
- **R8** — The bass may play one chromatic note that is not in the scale,
  positioned on the last off-beat before a chord change and resolving into the
  next chord's root.
- **R8a** — The end of the loop is a chord change like any other. The last
  off-beat of the last bar may carry an approach note into bar one's root, and
  the note sounds inside the loop rather than being written past its end.
- **R9** — No voice other than the bass plays a pitch outside the groove's
  stated scale, and the bass plays no out-of-scale pitch other than the one R8
  permits.
- **R10** — The quality gate checks the pitches of the rendered events, not only
  the harmony object they were derived from. A groove whose events contradict
  its stated scale is rejected with a named reason.
- **R10a** — Every groove in the catalogue passes the pitch check. It is a hard
  failure from the moment it lands, with no warning period and no grandfathered
  entries.
- **R11** — All voices are placed in one shared acoustic space, through a single
  send at a single amount for the whole mix. There is no per-voice send amount
  and no new `FeelTemplate` field.
- **R12** — The reverb is deterministic and adds no new runtime dependency and
  no new committed binary asset. The same spec renders byte-identical audio.
- **R13** — The reverb tail is folded into the loop the way every other tail is,
  so the loop seam remains within its threshold.
- **R14** — The build guard's dependency list is unchanged: verifying the
  committed artifacts still requires nothing but Node.
- **R15** — Every groove still passes peak, silence, seam, harmony, pitch and
  density.
- **R16** — No groove's `id`, `bpm`, `root`, `flavour`, `scale`, `chord` or
  `progression` changes.

## Behaviour details

**The guarantee is weaker than it looks, and this epic is where that matters.**
`gate.ts`'s `checkHarmony` calls `isValidHarmony(music, harmony)`, which
compares the *harmony object* — its chord names, its degrees, its pitch classes
— against the scale. It never looks at a single `NoteEvent`. Today that is
sufficient by construction: `events.ts` derives every bass and comp pitch from
`harmony.progressionMidi`, so the events cannot disagree with the harmony
without someone editing the code that produces them.

This epic is that edit. The moment the bass may play a pitch that is not a chord
tone, "the events are in scale" stops being true by construction and there is
nothing checking it. R10 closes that gap: a new gate check reads the rendered
events and asserts every pitched one is either a scale tone or the single
permitted approach note. The exception is written down next to the rule it
bends, where `IDIOMS` and the blues validity rule already live.

**The approach note, precisely.** One per chord change, at most. It sits on the
last off-beat subdivision before the bar whose chord differs from the current
one, and it is a semitone above or below that next chord's root. Anywhere else
in the bar, the same pitch is rejected. This is deliberately the narrowest hole
that buys the device: a named, single-position, single-interval exception is
testable in a way that "the bass may play passing tones" is not.

**Why one send and not a per-voice mix.** The fault is that the voices sound
like they are in different rooms; a single shared amount is the most direct
statement that they are not. Per-voice amounts would be a mixing decision
wearing a room's clothes, and they would add a `FeelTemplate` field that Epic 6
is waiting on. The send stays one number in the mix stage.

**The approach note at the loop boundary.** The harmony repeats every four bars,
so the last bar of the loop leads back into bar one's chord — a chord change,
and the one a listener hears most often. It gets an approach note like any
other. Nothing about it is special-cased: the note falls on the last off-beat,
inside the loop, and resolves onto a downbeat that is already there. Nothing is
written into the overhang, so the seam has no more to carry than it does today.

Epic 5's fill occupies the same bar, but a fill is drums and an approach note is
bass, so they do not compete for the position.

**Voice-leading, concretely.** `inCompRegister()` folds each chord tone into the
window independently by adding or subtracting octaves until it fits. Two chords
a fourth apart therefore come out in unrelated inversions, and the comp lurches.
Folding to minimise total motion from the previous voicing is the whole change,
and it is the single most audible thing in this epic after the note-offs.

**Why the reverb goes before the wrap.** `mix.ts` renders a bar past the loop
end and folds it back onto bar one, which is what makes the seam inaudible
without a crossfade. A reverb applied after that fold would generate a new tail
with nowhere to go, and the last sample of the loop would no longer sit next to
the first. Applied before the fold, the reverb's tail is folded like every other
tail — the room rings over bar one exactly as it would if the loop were really
repeating.

**Durations become load-bearing.** `fitToLoop` currently stretches whichever
event ends last so that the loop measures exactly its intended length. That was
harmless while durations did not affect the audio. Once R1 lands, that stretched
event is an audibly longer note, so the stretch has to move off the note and
into the buffer length.

## Acceptance criteria

- **AC1** (R1) — Given an event with a short duration, when the rendered voice
  is measured, then its energy has decayed by the end of that duration plus a
  short release, rather than continuing for the sample's full length.
- **AC2** (R1) — Given a rendered groove, when its total length is measured,
  then it is exactly the loop length the tempo and bar count imply, and no note
  has been lengthened to achieve that.
- **AC3** (R2) — Given an open hi-hat followed by a closed one, when the hi-hat
  voices are rendered, then the open hat's energy stops at the closed hat's
  onset.
- **AC4** (R3) — Given two successive chords, when their comp voicings are
  compared, then the total semitone motion between them is no greater than the
  independent fold would produce, and strictly less for at least one chord pair
  in the catalogue.
- **AC5** (R4) — Given a comp chord, when its notes' onsets are compared, then
  they are not identical and span no more than a few milliseconds.
- **AC6** (R5) — Given a comp chord, when its notes' velocities are compared,
  then they are not all equal.
- **AC7** (R6) — Given a bar whose chord has four notes and whose bass sounds
  its root, when the comp voicing is inspected, then the root is absent; given a
  bar whose chord is a triad, then the root is present; and in both cases the
  chord the manifest names for that bar is unchanged.
- **AC8** (R7) — Given a rendered groove's bass line, when its pitches are read,
  then it contains at least one repeated note, spans more than one octave across
  the loop, and does not sound on every available step.
- **AC9** (R8) — Given a bar preceding a chord change, when the bass's last
  off-beat event is inspected, then it may be a semitone from the next chord's
  root, and the following bass onset is that root.
- **AC9a** (R8a) — Given the last bar of the loop, when the bass's last off-beat
  event is inspected, then it may be a semitone from bar one's root; when the
  events past the loop end are inspected, then none is a bass approach note; and
  the seam remains within `SEAM_THRESHOLD`.
- **AC10** (R9, R10) — Given a rendered groove, when the gate's pitch check runs,
  then every pitched event is a scale tone or the permitted approach note; and
  given a groove with an out-of-scale pitch anywhere else, when the gate runs,
  then it is rejected naming the pitch check.
- **AC11** (R10) — Given a groove where the events and the stated scale
  disagree, when the gate runs, then it fails — proving the check reads events
  rather than only the harmony object.
- **AC11a** (R10a) — Given every groove in the catalogue, when the pitch check
  runs, then all pass, with no entry exempted and no warning-only mode in the
  code.
- **AC12** (R11, R12) — Given the same spec rendered twice, when the outputs are
  compared, then they are byte-identical; given the render path, when its
  imports are inspected, then no impulse-response file or audio library has been
  added; and given `FeelTemplate`, when its fields are inspected, then this epic
  has added none.
- **AC13** (R13, R15) — Given every rendered groove, when the gate runs, then
  the seam is within `SEAM_THRESHOLD` and every other check passes.
- **AC14** (R14) — Given `scripts/grooves/verify-cli.ts`, when the existing
  boundary test runs, then its dependency list is still `node:fs`,
  `node:crypto` and `node:path`.
- **AC15** (R16) — Given the manifest before and after, when they are diffed,
  then only `headDelaySeconds` differs, and Epic 1's answer-pinning test passes.
- **AC16** — Demo: the comp soloed, then the bass, then the full mix, against
  the same seeds before the epic. The comp moves smoothly between chords, the
  bass walks into each change, and the kit sits in one space.

## Dependencies

Needs nothing to start. It owns `mix.ts`'s bus addition and the voicing and
duration logic inside `events.ts` and `voices.ts`; Epic 1 owns the pass loop
around it and Epic 3 owns the deviations applied after it.

It hands the rest of the feature a stronger gate: after R10, any epic that
changes what pitches are emitted is checked rather than trusted.

It adds no `FeelTemplate` field, so it is not a constraint on when Epic 6 can
start authoring templates.

## Assumptions

- The release is a short linear fade, a handful of milliseconds, rather than a
  modelled envelope. It exists to stop a note, not to shape it.
- The hat choke is a property of the voices stage — closed hats truncate open
  hats — rather than a general choke-group mechanism on the template.
- Comp spread is a strum in one direction, seeded per groove, rather than
  alternating or randomised per chord.
- The reverb amount is a single constant in the mix stage, chosen by ear once
  and applied to every groove.
- The room is a short one, well under a second, chosen so it glues without
  smearing a sixteenth-note funk pattern.
- The approach note is at most one per chord change, the loop boundary
  included. Epic 5's fill is drums only, so it does not compete for the bass's
  last off-beat.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. What does the new pitch check do about the existing catalogue?**
Answer: **A) Add the check and require the whole catalogue to pass it** — the
generator's central claim is that the words shipped beside the audio describe
the audio, and a check with exemptions is not that claim.
Applied to: R10a, AC11a

**Q2. Is the reverb one shared send, or per-voice?**
Answer: **A) One send, one amount for the whole mix** — the fault is that the
voices sound like they are in different rooms, and it adds no template field to
hold Epic 6 up.
Applied to: R11, AC12, Behaviour details, Dependencies, Assumptions

**Q3. Which chords lose their root?**
Answer: **A) Four-note chords only; triads keep their root** — a triad minus its
root is an interval, which is thinner than the doubling being fixed.
Applied to: R6, AC7 — promoting the cycle-1 assumption into a requirement

### Cycle 2 — 2026-08-31

**Q4. Does the approach note apply at the loop boundary?**
Answer: **A) Yes — the loop boundary is a chord change and gets one like any
other** — it is the most audible approach note in the groove, and it sounds
inside the loop, so the seam carries nothing extra.
Applied to: R8a, AC9a, Behaviour details, Assumptions
