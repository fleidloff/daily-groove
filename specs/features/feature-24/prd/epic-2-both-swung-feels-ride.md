# PRD — Epic 2: Both swung feels ride

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`swung-sixteenth` takes the ride alongside `shuffle`, both riding feels get a
kick feathering quarter notes underneath, and `docs/music.md` is corrected down
from four riding feels to two. The four feels that do not ride —
`straight-funk`, `bright-straight`, `half-time` and `open-ballad` — come out
byte-identical to what they render today, and that is asserted rather than
assumed.

## Problem

Epic 1 proves a cymbal on one feel. Two things are still missing before a render
is worth committing.

The first is the other swung feel. `swung-sixteenth` at swing 0.44 is the second
of the two feels that genuinely swing, and a ride at 106–116 bpm over swung
sixteenths is not the shuffle's cymbal at a higher tempo — different figure,
different mix position.

The second is the kick. The briefing calls feathering "half of what makes a
swung feel sound like jazz": quarter notes at low velocity under the ride, no new
sample. A ride over a funk kick is a rock groove with a cymbal on it.

And `docs/music.md` still claims four of the six feels ride. `half-time` at swing
0.28 and `open-ballad` at 0.02 are straight in all but name; the document is
corrected down to what the code does rather than the code being built up to the
document.

## Scope

- `swung-sixteenth` takes the ride: `voices`, `gain`, `pan`
- ride figures for subdivision 16
- `HAT_PUNCTUATION_PATTERNS` as a real three-entry pool
- feathered kick on the two riding feels and nowhere else
- a test that pins the riding-feel count at two
- `docs/music.md` corrected: the feel table, "who keeps time", the pattern-pool
  table, the voice list and the four new percussion voices

**Out of scope**
- re-rendering the catalogue, `grooves.lock.json`, the manifest, the credit line
  — Epic 3
- `half-time` and `open-ballad` riding, or being feathered. Settled: they take
  nothing from this feature and their renders must not move
- playing the claves, the cowbell or the ride bell. Sourced in Epic 1, played by
  no template
- brushes on the snare. `open-ballad` at 62–74 with sticks is the wrong sound and
  the briefing says so, but a brush set is a new articulation family from a new
  library — its own feature
- adding a voice, a pack row or an RNG stream. Epic 1 froze all three

## Requirements

### `swung-sixteenth` takes the ride

- **R1** — `swung-sixteenth`'s `voices` gains `ride`, and its `gain` and `pan`
  gain an entry for it, derived by Epic 1's recorded levelling method rather than
  copied from `shuffle`. Its `flavours`, `tempoRange`, `subdivision`, `swing` and
  `passes` are untouched.
- **R2** — `swung-sixteenth` keeps `hatClosed` and drops `hatOpen`, on the same
  terms `shuffle` has: the closed hat plays beats 2 and 4, and the open hat leaves
  the kit along with its `gain`, `pan` and `humanize.lean` entries.
- **R3** — The ride pool holds figures for subdivision 16 alongside Epic 1's
  subdivision-8 figures, drawn on `RIDE_LABEL`. The sixteenth feel's ride is not
  the shuffle's figure at a higher tempo: at swing 0.44 over sixteenths the
  idiomatic pattern is a different one, and it is chosen by ear.
- **R4** — If the sixteenth feel's ride does not survive its listening pass, the
  feature narrows to one riding feel: `swung-sixteenth` keeps its hat and its
  kick, `shuffle` keeps the ride and the feather, and this epic delivers the docs
  correction and nothing else. That outcome is recorded in `docs/music.md` beside
  `half-time` and `open-ballad`, not left as a gap.

### The foot hat

- **R5** — `swung-sixteenth` inherits Epic 1's foot hat unchanged: the closed hat
  draws one figure from `HAT_PUNCTUATION_PATTERNS`, every member of which contains
  beats 2 and 4, and plays it in every bar of the groove including the fill and
  variation bars. The four straight feels keep `HAT_PATTERNS`.
- **R6** — No feel that declares a ride has a hat marking a subdivision. Two to
  four hits a bar, always including the backbeat, is the left foot; anything that
  states the pulse is the job the ride was handed.

### The feathered kick

- **R7** — Both riding feels feather the kick: quarter notes, every bar, at a
  velocity below the `GHOST_VELOCITY_THRESHOLD` of `0.5`. No new sample, no new
  pattern pool, no new draw — the feather is fixed placement, not something a
  seed decides, so it costs no randomness and cannot re-key anything.
- **R7b** — Where the drawn `KICK_PATTERNS` figure already carries a quarter, the
  drawn hit stands at its own velocity and no feather is added there. The feather
  fills only the quarters the figure left empty. The drawn figure is the groove;
  the feather is the floor under it, and a feather that overwrote the downbeat
  would make the groove quieter and flatter rather than more present.
- **R8** — Feathering makes the kick *present*, not louder or busier. The
  feathered hits sit under the drawn `KICK_PATTERNS` figure, and the mix position
  of the kick — the template's `gain` — is not raised to accommodate them.
- **R9** — Feathering reaches exactly the feels the ride does. `half-time` and
  `open-ballad` keep the kick they have. Feathering and the ride are one jazz
  gesture, not two improvements that can be taken separately.

### The four that do not ride

- **R10** — `straight-funk`, `bright-straight`, `half-time` and `open-ballad`
  keep their `voices`, their `gain`, their `pan`, their kick and their hat, and
  their built events are identical to those built before this feature.
- **R11** — Exactly two templates declare `ride`, and a test says so. The
  document's old claim of four cannot creep back in as code.

### Density

- **R11b** — Both riding feels keep their committed density bands: `shuffle`
  `16–38` events a bar, `swung-sixteenth` `16–42`. A band is part of what a feel
  *is*, alongside its tempo and its swing, and the groove is what Sam plays a sax
  line over — a bar too cluttered to play over is the reward failing, not a gate
  set too tight.
- **R11c** — A seed that overflows its band is fixed by **thinning the ride
  figure**, not by widening the band and not by exempting the feathered kicks from
  the count. The feather is four fixed hits carrying half the jazz gesture and is
  not the thing that varies; the ride pool is.
- **R11d** — If thinning cannot bring a seed inside its band, the epic stops and
  reports it rather than widening the band quietly. The catalogue is fixed at
  thirty and no groove can be dropped, so the alternative to reporting is a
  silent change to what a feel means.

### The documentation

- **R12** — `docs/music.md` is corrected to what the code does, and the
  correction is larger than a count. The feel table at 140–146 shows `ride` as the
  pulse for `shuffle` and `swung-sixteenth` and `hat` for the other four; the
  sentence "Four of the six ride" and the sentence that follows it are rewritten.
  The `HAT_PUNCTUATION_PATTERNS` row at 167 and the "Who keeps time" section at
  174 are rewritten: the pool survives as three figures, but "every step odd, 2–3
  a bar" becomes "every figure holds beats 2 and 4, 2–4 a bar", and the stated
  reason ("so the hat cannot mark a position the ride is using") is **wrong**, not
  merely narrower — a ride playing eighths lands on 2 and 4 with the hat, and that
  is the sound. The pattern-pool table lists the ride pool with its real entry
  counts, and the document records that a riding feel drops `hatOpen` and that its
  ride is out for the fill bar and on quarters for the variation bar.
- **R13** — `docs/music.md` records `half-time` and `open-ballad` as
  **considered and declined**, with the reason — 0.28 and 0.02 are straight in
  all but name — so the next reader does not re-add them as an oversight.
- **R14** — `docs/music.md`'s voice list is updated to fifteen, the feathered
  kick is documented as a property of the riding feels, and the rule that the
  claves and the rim never sound in the same groove is recorded there against the
  styles that will reach for the claves.

## Behaviour details

What a riding feel's kick carries, per bar:

```
kickSteps  = grid(pick(rhythmRng, KICK_PATTERNS))     # unchanged, drawn
feathers   = quarter notes of the feel's subdivision   # fixed, not drawn
for step in feathers:
    if step in kickSteps: leave the drawn hit alone
    else: add a kick at feather velocity (< 0.5)
```

The drawn figure is the groove; the feather is the floor under it. A drawn kick
that lands on a quarter is a drummer's accent and stays one — it is not
overwritten, not summed with a feather, and not skipped because the bar is busy.

## Acceptance criteria

- **AC1** (R1, R2) — Given the `swung-sixteenth` template, `voices` includes
  `ride` and `hatClosed` and excludes `hatOpen`, `gain` and `pan` have a `ride`
  entry and no `hatOpen` entry, and `tempoRange`, `subdivision`, `swing`,
  `passes` and `flavours` are identical to their committed values.
- **AC2** (R1) — Given both riding templates, their `ride` `gain` values differ.
  A cymbal at 110 bpm over sixteenths does not sit where one at 85 over a shuffle
  sits.
- **AC3** (R3) — Given `swung-sixteenth` at every catalogue seed, its ride steps
  are a member of the subdivision-16 ride pool, and that pool is not the
  subdivision-8 pool.
- **AC4** (R5, R6) — Given every template that declares `ride`, at every seed,
  every bar's `hatClosed` steps are the same member of `HAT_PUNCTUATION_PATTERNS`
  resolved onto the feel's subdivision, that member contains beats 2 and 4, there
  are two to four hits a bar, and no `hatOpen` event exists.
- **AC5** (R7, R7b) — Given every template that declares `ride`, at every seed,
  every quarter-note position of every bar carries exactly one kick event; every
  kick event the drawn `KICK_PATTERNS` figure does not account for has velocity
  below `0.5`; and every kick event it does account for has the velocity it has
  today.
- **AC6** (R7) — Given the same riding groove built twice with a different
  `RIDE_LABEL`, the feathered kick steps are identical. The feather is not drawn.
- **AC7** (R9) — Given `half-time` and `open-ballad` at every seed, no kick event
  exists that the drawn `KICK_PATTERNS` figure does not account for.
- **AC8** (R8) — Given both riding templates, the `kick` entry in `gain` is
  identical to its committed value.
- **AC9** (R10) — Given `straight-funk`, `bright-straight`, `half-time` and
  `open-ballad` at every catalogue seed, the built events and `MusicMeta` are
  identical to those built before this feature.
- **AC10** (R11) — Given all six templates, exactly two declare `ride`, and they
  are `shuffle` and `swung-sixteenth`.
- **AC11** (R12, R13, R14) — Given `docs/music.md`, the string "Four of the six
  ride" is absent, and so is "Every step odd" from the punctuation row; the feel
  table's Pulse column
  reads `ride` for exactly two rows; the voice list holds fifteen voices;
  `half-time` and `open-ballad` are named as declined with a reason; and the
  feathered kick appears in the document.
- **AC12** (R11b, R11c) — Given a rendered groove from each riding feel at every
  catalogue seed, all seven gate checks pass; and given both riding templates,
  their `density` bands equal their committed values.
- **AC13** (R3) — A listening pass across both riding feels is recorded, saying
  in particular that the sixteenth feel's ride is not the shuffle's ride at a
  higher tempo.

## Dependencies

**Needs from Epic 1:** the pack with `ride` in it, `VoiceName` at fifteen,
`RIDE_LABEL` and the ride pattern pool's shape, `HAT_PUNCTUATION_PATTERNS` at its
final shape, the rule that a riding feel drops `hatOpen`, the fill rule (ride out
for the fill bar, quarters for the variation bar), and the recorded levelling
method.

**Hands to Epic 3:** both templates final, so a render is worth committing, and
whether one riding feel or two survived.

## Assumptions

- **The feather velocity is the musician's call**, somewhere well under `0.5` —
  present rather than audible as a note. Proposed and heard, not asserted beyond
  the threshold.
- **The ride's `lean` per feel is a tuning knob** under the listening sign-off,
  as every humanize value is.
- **`bright-straight` keeps its bongos and gains nothing.** It is the one feel
  carrying the bongo and this feature does not touch it.
- **`RIDE_ACCENTS` is shared across both subdivisions** — one shallow cycle of
  three, not one per feel.
- **The docs correction is a `docs/music.md` edit alone.** `scripts/grooves/README.md`
  and `docs/architecture.md` say nothing about which feels ride.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-09-05

**Q1. A drawn kick and a feather land on the same quarter — what sounds?**
Answer: **A) The drawn hit wins; the feather only fills the quarters the figure
left empty.** The drawn figure is the groove and the feather is the floor under
it; overwriting the downbeat would make the groove quieter and flatter.
Applied to: R7b, AC5, Behaviour details.

**Q2. A riding feel's render overflows its density band — what gives?**
Answer: **A) Thin the figure.** The band is part of what a feel is, and the
roadmap takes the same line about the loudness window one epic later.
Applied to: R11b, R11c, R11d, AC12. R11c names the ride pool as the thing that
gets thinned — the feather is four fixed hits carrying half the jazz gesture and
is not what varies. R11d adds the escalation the answer implies but does not
state: a seed that will not come inside its band even thinned is reported, not
quietly accommodated.

*Note.* Epic 1's Cycle 2 settled `HAT_PUNCTUATION_PATTERNS` as a real drawn pool
of three, every member holding beats 2 and 4. R5, R6, R12, AC4 and AC11 above
were written against an earlier reading in which the foot hat was fixed
placement, and now match Epic 1.
