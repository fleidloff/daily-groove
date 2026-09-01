# PRD — Epic 3: The ride and the bongo get parts

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Epic 1 stocks the ride and the bongo pair; this epic gives them something to
play. The ride gets patterns and takes over the timekeeping on the feels that
list it, with the closed hat standing down rather than doubling it. The bongo
gets its own pool, its own accent shape and its two drums played against each
other. When this is done, a feel that has a ride keeps time on a ride, and a
feel that has a bongo has a bongo part rather than a tom in a different costume.

## Problem

A voice declared in the pack and absent from every pattern pool renders nothing.
After Epic 1 the ride and the bongo exist and are silent, and after Epic 2 some
templates list them and still hear nothing.

Two traps are waiting. The first is that a ride added *alongside* a closed hat
marking the same subdivision is a busier bar, not a new feel — the ear hears
clutter and the groove loses the pulse it had. The second is that reading a hand
drum's dynamics off `velocityFor`'s metric shape alone gives it exactly the flat,
mechanical part that `HAT_ACCENTS` exists to keep the hats out of: every hit at a
given step class the same velocity, forever.

## Scope

- The ride's pattern pool, its accent shape, and its `VELOCITIES` row.
- The rule that a ride and a closed hat do not both hold the time.
- The bongo's pattern pool, its accent shape, its `VELOCITIES` rows, and the
  interplay between its high and low drums.
- How each behaves when the fill arrives.
- Validated on `straight-funk`, which Epic 1 already rewrote.

**Out of scope**
- **Which templates list these voices** — Epic 2 makes that call by writing the
  `voices` array. This epic supplies what happens when they do.
- **The five template files** — Epic 2 owns them. This epic writes `events.ts`
  and, where a default needs a home, `straight-funk.ts`.
- **Sourcing or declaring the samples** — Epic 1.
- **A crash, congas, shaker, tambourine** or any other voice. The kit is the ten
  Epic 1 froze.
- **Re-rendering anything** — Epic 5.

## Requirements

### The ride

- **R1** — A template that lists `ride` renders ride events, drawn from a ride
  pattern pool in the same way the hat, kick and bass patterns are drawn: the
  seed picks the figure once for the groove, and each pass is a different
  reading of it.
- **R2** — On a feel that lists `ride`, the ride holds the timekeeping and
  `hatClosed` does not. The two never mark the same subdivision in the same bar.
- **R2a** — On a ride feel the closed hat plays punctuation and nothing else:
  off-beat accents and pedal notes, drawn from a reduced pattern pool of its own
  rather than from the timekeeping pool it uses on a hat feel.
- **R2c** — The hat is not merely made quieter. Doubling a ride with a hat at
  −6 dB is still two voices playing the same figure, and the demotion is a
  change of part, not of level.
- **R2d** — The punctuation pool is sparse enough that the ride is unambiguously
  the timekeeper. A hat playing every off-beat is still marking a subdivision,
  which is what R2 forbids.
- **R2b** — The timekeeper is derived in `events.ts` from the template's
  `voices` list: `ride` present means the ride keeps time and the hat draws from
  the punctuation pool; `ride` absent means the hat keeps time as it does today.
  There is no `timekeeper` field and no per-template flag.
- **R2e** — Because it is derived, the rule holds by construction. A template
  cannot be authored into breaking it, which is the only version of R2 that
  survives five more templates being written by someone who has not read this
  document.
- **R3** — `hatOpen` is unaffected. An open hat is an accent, not timekeeping,
  and it keeps working on a ride feel — including its choke by a closed hat,
  which `chokeOpenHats` owns and this epic does not change.
- **R4** — The ride has its own `VELOCITIES` row. It is struck lighter than a
  snare and harder than a closed hat, and its accent range is narrower than
  either because a cymbal that varies as much as a snare reads as unsteady.
- **R5** — The ride does not sound as a flat repetition of one velocity. It
  carries an accent shape over its own hits, in the manner of `HAT_ACCENTS`,
  indexed by its position in the bar's ride sequence rather than by grid step —
  indexing by step partitions the bar exactly as `velocityFor` already does and
  changes nothing.
- **R6** — The ride rides through a fill. A fill is a phrase on the drums and the
  cymbal is what holds the time under it; a ride that stops for the fill removes
  the pulse at the moment the listener most needs it.

### The bongo

- **R7** — A template that lists `bongoHigh` and `bongoLow` renders bongo
  events, drawn from a bongo pattern pool, seeded the same way.
- **R8** — The two drums are played against each other: a bongo figure
  distributes its hits across high and low rather than striking one drum
  repeatedly. A pattern that uses only one of the two is not a bongo part.
- **R9** — The bongo has its own `VELOCITIES` rows, one per drum. A hand drum is
  not struck like a tom, and the tom rows — which sit near a snare's level
  because a tom is struck with a stick in a fill — are the wrong shape for it.
- **R10** — The bongo does not sound as a flat repetition of one velocity. Like
  the ride and the hats, it carries an accent shape over its own hits.
- **R11** — The bongo gets out of the fill's way. A fill is the kit's phrase, and
  hand percussion continuing through it competes with the one moment in the loop
  that is meant to be a statement.
- **R12** — The bongo does not carry the pulse. It is a sparse colour over a
  groove whose time is kept elsewhere: a handful of hits per bar, sitting off
  the strong beats and leaving the downbeats to the kit.
- **R12a** — No figure in the bongo pool marks every subdivision of its
  template's grid, and none is a continuous ostinato. The briefing asks for
  "some bongo where it makes sense", which is a colour rather than a second
  drummer.
- **R12b** — The bongo's hits fall predominantly off the metric strong
  positions. A hand drum doubling the kick and the backbeat adds density without
  adding anything to hear.

### Both

- **R13** — Neither voice changes the harmony. Both are unpitched percussion and
  emit no `midi`, so nothing they do can alter a groove's root, flavour, chord or
  progression.
- **R14** — Adding either voice keeps every feel inside its declared `density`
  band. Up to three new voices is the easiest way to push a groove into mush, and
  the band is the check that exists for it.
- **R15** — A template that lists neither voice renders exactly as it does
  without this epic. Every other voice's events are unchanged — same count, same
  times, same velocities — so a feel that opts out pays nothing.
- **R16** — Both voices are validated on `straight-funk`, so this epic neither
  waits on Epic 2 nor writes to the five template files Epic 2 owns.

## Behaviour details

**How the hat stands down.** The timekeeping voice on a feel is one voice, and
which one it is follows from the template's `voices` list: if `ride` is present
it is the ride, otherwise it is `hatClosed`. The hat that is not keeping time
draws from the punctuation pool instead of the timekeeping pool — the choice is
made once, where the hat's pattern is drawn, and every template gets it for
free. A `timekeeper` field would be a configuration point with one correct
setting per feel and no way to be wrong safely.

This is deliberately narrower than a general choke- or exclusion-group
mechanism. A kit of ten voices has exactly one pair that competes for the
time-keeping role, in the same way it has exactly one choke pair, and
`chokeOpenHats` is already the precedent for solving that as a property of the
two voices rather than as configuration.

## Acceptance criteria

- **AC1** (R1) — Given `straight-funk` with `ride` in its `voices`, when a
  groove is rendered, then it contains ride events, and the same seed renders the
  same ride figure every time.
- **AC2** (R2, R2a, R2c, R2d) — Given a template listing both `ride` and
  `hatClosed`, when a groove is rendered, then no bar has ride and closed-hat
  events marking the same subdivision, the closed hat's events come from the
  punctuation pool, and its event count is a small fraction of the ride's.
- **AC2a** (R2b, R2e) — Given a template with `ride` removed from its `voices`
  and nothing else changed, when a groove is rendered, then the closed hat keeps
  time from the timekeeping pool — proving the choice is derived from the voice
  list rather than declared.
- **AC2b** (R2d) — Given a rendered ride feel, when the closed hat's events are
  grouped by metric position, then none falls on a position the ride is using to
  mark the pulse.
- **AC3** (R3) — Given a ride feel that also lists `hatOpen`, when a groove is
  rendered, then open-hat events are present and each is silenced by the next
  closed hat as before.
- **AC4** (R5) — Given a rendered ride part, when the velocities of consecutive
  ride hits at the same step class are compared, then they are not all equal.
- **AC5** (R4) — Given the `VELOCITIES` table, when the ride's row is compared
  with the snare's and the closed hat's, then the ride sits between them, and the
  spread between its strong and weak levels is narrower than the snare's.
- **AC6** (R6) — Given a groove whose last pass ends in a fill, when the events
  in the fill's bar are inspected, then ride events are present through it.
- **AC7** (R8) — Given a rendered bongo part, when its events are grouped by
  voice, then both `bongoHigh` and `bongoLow` are present and neither accounts
  for the whole figure.
- **AC8** (R10) — Given a rendered bongo part, when the velocities of its hits
  at the same step class are compared, then they are not all equal.
- **AC9** (R11) — Given a groove whose last pass ends in a fill, when the events
  in the fill's bar are inspected, then bongo events are absent or markedly
  fewer than in the preceding bar.
- **AC10** (R12, R12a) — Given every figure in the bongo pool, when its hits per
  bar are counted, then none marks every subdivision of the template's grid and
  each sits within the sparse band the pool declares.
- **AC10a** (R12b) — Given a rendered bongo part, when its hits are grouped by
  metric position, then more fall off the strong positions than on them.
- **AC11** (R13) — Given any groove rendered with the ride and the bongo, when
  its events are inspected, then no ride or bongo event carries a `midi`, and the
  manifest's `root`, `flavour`, `scale`, `chord` and `progression` are what they
  were without them.
- **AC12** (R14) — Given each of the six feels rendered with whatever new voices
  it lists, when passed to `gateCandidate`, then all pass, `density` included.
- **AC13** (R15) — Given a template listing neither new voice, when a groove is
  rendered before and after this epic, then the two event lists are identical.
- **AC14** (R16) — Given `straight-funk` alone, when the epic's tests run, then
  they pass without any of the five templates Epic 2 owns having been modified.

## Dependencies

**Needs to start:** Epic 1's frozen `VoiceName` set and `pack.json` voice keys,
so `pack.get('ride', …)` and `pack.get('bongoHigh', …)` answer; and Epic 1's
rewritten `straight-funk.ts` as the feel to validate on.

**Hands to Epic 2:** the guarantee behind Epic 2's R6 — that listing `ride`
alongside `hatClosed` is safe, because the exclusivity is enforced here.

**Hands to Epic 5:** the final event generation, so the re-cut renders what
ships.

**Parallel with Epic 2.** The two are separated by file: Epic 2 writes the five
template files, this epic writes `events.ts`. The shared surface is the pattern
pools — Epic 2 revisits cajon-era assumptions in the existing pools, this epic
adds two new pools — so the two must not restructure the pool machinery at once.

## Assumptions

- The ride and the bongo draw their figures from the same seeded generator the
  other voices use, so a groove's percussion is as deterministic as the rest of
  it and the lock keeps working.
- The bongo's two drums share one pattern that distributes across them, rather
  than each drum drawing an independent figure. Two independent draws would
  produce collisions no player's two hands could make.
- The ride's pattern pool is authored per subdivision, like the existing pools,
  so an eighth-note feel and a sixteenth-note feel do not share a figure.
- Neither voice needs a `lean` entry by default; a template may declare one, as
  templates already do per voice.
- The hat's punctuation pool is authored per subdivision like every other pool,
  so an eighth-note ride feel and a sixteenth-note one do not share a figure.
  Two of the four ride feels are slow — `half-time` at 68–80 and `open-ballad` on
  an eighth grid — so this is not hypothetical.
- The four ride feels are `half-time`, `open-ballad`, `shuffle` and
  `swung-sixteenth`, which Epic 2 declares. This epic does not depend on which
  four they are, only that a feel either lists the ride or does not.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-01

**Q3. How much bongo?**
Answer: **A) A sparse colour — a handful of hits per bar, off the strong beats,
leaving the downbeats to the kit** — the pulse is kept elsewhere, and the
briefing asks for "some bongo where it makes sense", which is a colour rather
than a second drummer.
Applied to: R12, R12a, R12b, AC10, AC10a

### Cycle 2 — 2026-09-01

**Q1. What does the closed hat do on a ride feel?**
Answer: **B) Punctuation only — off-beat accents and pedal notes, from a reduced
pattern pool of its own.** Held through cycle 1 pending the ride's role, which
Epic 1's Q4 settled as timekeeping; the hat is demoted rather than removed.
Applied to: R2a, R2c, R2d, AC2, AC2b, Assumptions

**Q2. Where does the timekeeping choice live?**
Answer: **A) Derived in `events.ts` from the template's `voices` list.** No
`timekeeper` field: derivation is the only option under which a template cannot
be authored into breaking the exclusivity rule.
Applied to: R2b, R2e, AC2a, Behaviour details
