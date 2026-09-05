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
- **R2** — `swung-sixteenth` keeps `hatClosed`, at punctuation duty, on the same
  terms `shuffle` has.
- **R3** — The ride pool holds figures for subdivision 16 alongside Epic 1's
  subdivision-8 figures, drawn on `RIDE_LABEL`. The sixteenth feel's ride is not
  the shuffle's figure at a higher tempo: at swing 0.44 over sixteenths the
  idiomatic pattern is a different one, and it is chosen by ear.
- **R4** — If the sixteenth feel's ride does not survive its listening pass, the
  feature narrows to one riding feel: `swung-sixteenth` keeps its hat and its
  kick, `shuffle` keeps the ride and the feather, and this epic delivers the docs
  correction and nothing else. That outcome is recorded in `docs/music.md` beside
  `half-time` and `open-ballad`, not left as a gap.

### Hat punctuation

- **R5** — `HAT_PUNCTUATION_PATTERNS` is a pool of three figures, two to three
  hits a bar, drawn on `rhythmRng` at the position the hat is already drawn at.
  Both riding feels draw from it; the four straight feels keep `HAT_PATTERNS`.
- **R6** — No feel that declares a ride has a hat on every off-beat. A hat
  playing every off-beat is still marking a subdivision, which is exactly what
  handing the pulse to the ride is meant to stop.

### The feathered kick

- **R7** — Both riding feels feather the kick: quarter notes, every bar, at a
  velocity below the `GHOST_VELOCITY_THRESHOLD` of `0.5`. No new sample, no new
  pattern pool, no new draw — the feather is fixed placement, not something a
  seed decides, so it costs no randomness and cannot re-key anything.
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

### The documentation

- **R12** — `docs/music.md` is corrected to what the code does: the feel table
  at 140–146 shows `ride` as the pulse for `shuffle` and `swung-sixteenth` and
  `hat` for the other four; the sentence "Four of the six ride" and the sentence
  that follows it are rewritten; the "Who keeps time" section at 174 matches R5
  and R6; and the pattern-pool table lists the ride pool and the hat punctuation
  pool with their real entry counts.
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
that lands on a quarter is a drummer's accent and stays one.

## Acceptance criteria

- **AC1** (R1, R2) — Given the `swung-sixteenth` template, `voices` includes
  `ride` and `hatClosed`, `gain` and `pan` have a `ride` entry, and
  `tempoRange`, `subdivision`, `swing`, `passes` and `flavours` are identical to
  their committed values.
- **AC2** (R1) — Given both riding templates, their `ride` `gain` values differ.
  A cymbal at 110 bpm over sixteenths does not sit where one at 85 over a shuffle
  sits.
- **AC3** (R3) — Given `swung-sixteenth` at every catalogue seed, its ride steps
  are a member of the subdivision-16 ride pool, and that pool is not the
  subdivision-8 pool.
- **AC4** (R5, R6) — Given every template that declares `ride`, at every seed,
  every `hatClosed` step comes from `HAT_PUNCTUATION_PATTERNS`, there are two or
  three a bar, and the hat is not on every off-beat of the bar.
- **AC5** (R7) — Given every template that declares `ride`, at every seed, every
  quarter-note position of every bar carries a kick event, and every kick event
  the drawn `KICK_PATTERNS` figure does not account for has velocity below `0.5`.
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
  ride" is absent; the feel table's Pulse column reads `ride` for exactly two
  rows; the voice list holds fifteen voices; `half-time` and `open-ballad` are
  named as declined with a reason; and the feathered kick appears in the
  document.
- **AC12** — Given a rendered groove from each riding feel, all seven gate checks
  pass, the density band included.
- **AC13** (R3) — A listening pass across both riding feels is recorded, saying
  in particular that the sixteenth feel's ride is not the shuffle's ride at a
  higher tempo.

## Dependencies

**Needs from Epic 1:** the pack with `ride` in it, `VoiceName` at fifteen,
`RIDE_LABEL` and the ride pattern pool's shape, `HAT_PUNCTUATION_PATTERNS`'s
resolution onto a feel's own subdivision, and the recorded levelling method.

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

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-24 epic-2`.

### Q1. A drawn kick and a feather land on the same quarter — what sounds?

`KICK_PATTERNS` all start at step 0, and three of the five carry step 10 —
positions the feather also wants. The collision is on every bar of every riding
groove, so it is not an edge case.

- [ ] A) The drawn hit wins; the feather only fills the quarters the figure left
      empty *(recommended — the briefing says feathering must be "quarter notes at
      low velocity" and the roadmap that it "must not make the kick louder or
      busier in the mix, only present". A feather that overwrote the drawn
      downbeat would make the groove quieter and flatter, which is the opposite of
      both. No persona bearing; the reason is that the drawn figure is the groove
      and the feather is the floor under it)*
- [ ] B) The feather wins on every quarter — a true feathered kick is even and
      unaccented, and letting the drawn figure poke through gives a lopsided
      four-on-the-floor
- [ ] C) They sum: the drawn hit is played at its own velocity plus the feather's,
      so the coinciding quarters come out slightly stronger
- [ ] D) The feather is skipped in any bar where the drawn figure already carries
      two or more quarters, so a busy kick bar is left alone

### Q2. A riding feel's render overflows its density band — what gives?

`shuffle`'s band is 16–38 events a bar and `swung-sixteenth`'s 16–42. A ride
figure is denser than the hat it replaced by construction (Epic 1 R16), and the
feather adds up to four kicks a bar on top. The gate's density check will fail on
some seeds.

- [ ] A) Thin the figure — the band is the feel's declared character and a groove
      that overflows it is too busy *(recommended — `docs/music.md` calls the
      density band part of what a feel *is*, alongside its tempo and its swing,
      and the roadmap takes the same line about the loudness window one epic
      later: "a groove that now fails is a levelling error rather than a gate to
      widen". Persona-adjacent: the groove is the reward, and Sam has to be able
      to play a sax line over it, which a cluttered bar refuses)*
- [ ] B) Widen the band for the two riding feels only — a ride feel genuinely has
      more events a bar than a hat feel, and holding it to a number derived
      before the cymbal existed is asserting a balance nobody listened to
- [ ] C) Stop counting the feathered kicks toward density — they are a floor, not
      events a listener picks out
- [ ] D) Decide per feel once both are rendered: thin whichever figure sounds
      busy, widen wherever the count moved but the groove did not
