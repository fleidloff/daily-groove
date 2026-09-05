# PRD — Epic 1: A cymbal keeps the time

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Source a jazz ride from a library chosen for it, prepare it and three other new
percussion voices into the sample pack, and render one `shuffle` groove where
the cymbal carries the pulse and the hi-hat has dropped to the foot pattern,
always on beats 2 and 4. Nothing reaches the app: this epic ends in a listening decision — the cymbal is right and
Epics 2 and 3 follow, or it is not and the feature stops here with the percussion
kept and the ride recorded as another failed candidate.

## Problem

`docs/music.md` documents a ride the code does not have. The voice list at line
37 names it, line 45 states the rule ("the bow, struck with the stick tip — not
the bell, not a crash-ride wash"), the feel table at 140–146 has four feels
riding, `HAT_PUNCTUATION_PATTERNS` is specified at 167 and `RIDE_LABEL` at 314.
In the code, `VoiceName` in `scripts/grooves/types.ts` lists eleven voices with
no ride, there is no `samples/ride/`, and `events.test.ts:1510` actively asserts
that no backing voice matches `/crash|cymbal|ride/`.

Feature-13 built a ride on MuldjordKit, heard that a rock kit reads as one, and
removed it — and the removal reached the code but not the docs. This epic is the
part of closing that gap that can fail, so it goes first and it goes alone.

## Scope

- audition candidate ride libraries against a rendered `shuffle` groove, before
  anything else is built
- prepare and declare all four new voices in one pass: the ride bow, the ride
  bell, the claves and the cowbell
- freeze the fifteen-voice contract — `VoiceName`, `VELOCITIES`,
  `BACKING_VOICES`, the `voices` keys of `samples/pack.json`
- `RIDE_LABEL` as a new labelled RNG stream, and a subdivision-8 ride pattern
  pool drawn on it
- `shuffle` takes the ride: its `voices`, `gain` and `pan`
- `shuffle`'s closed hat drops to a foot pattern always containing beats 2 and
  4, and its open hat leaves the kit
- lift the ride half of the `events.test.ts:1510` ban, keep the crash half
- record the levelling method so Epic 2 applies it rather than re-deriving it
- licence, provenance and `samples/README.md`

**Out of scope**
- `swung-sixteenth` — Epic 2
- the feathered kick — Epic 2, where it reaches both riding feels at once
- re-rendering the catalogue, `grooves.lock.json`, the manifest, the credit line
  in the app — Epic 3. Until then the browser plays the committed MP3s
  unchanged
- **playing** the claves, the cowbell or the ride bell. All three are sourced
  here and played by no template; the styles in
  [new-styles.md](../../new-styles.md) are what will reach for them
- `half-time` and `open-ballad`. They do not ride in this feature at all
- a crash cymbal. Its tail crosses the loop point, and the downbeat after a fill
  is position zero of the file
- brushes on the snare. A new articulation family from a new library, its own
  feature

## Requirements

### Sourcing and the stopping decision

- **R1** — Candidate ride libraries are shortlisted **CC0 first, CC-BY
  accepted**, and nothing else. A candidate under any other licence is not
  auditioned, whatever it sounds like.
- **R2** — Every candidate is prepared with the pack's existing recipe and heard
  **under a rendered `shuffle` groove**, not in isolation. A cymbal auditioned
  solo is the mistake feature-13 made: MuldjordKit's ride is a fine ride and a
  wrong one for this kit at this tempo, and only the mix says so.
- **R3** — Audition renders are written to a scratch directory via the CLI's
  `--out` option. `public/grooves/` is not touched by this epic.
- **R4** — A candidate that no round-robin alternates can be built from is
  rejected without an audition. A ride ping is the most-repeated event in the
  file — eight or more a bar over four bars — and one identical sample at one
  level is the machine-gun artefact feature-9 spent a whole feature undoing.
- **R5** — **Three** candidate libraries are prepared and heard. An unbounded
  audition has no failure state and so can never report one; three is enough to
  tell a systematic problem from an unlucky pick. If none of the three passes the
  listening decision, this epic ends in a report naming every library auditioned
  and why each failed. The ride stays out of `VoiceName` and out of the pack; the claves, the cowbell and the ride bell
  are still prepared, declared and committed; Epics 2 and 3 do not run. A wrong
  ride recorded as a rejected candidate is worth more than a wrong ride shipped,
  so the least-wrong of the three is not shipped quietly at a low gain.

### The pack

- **R6** — Four voices are prepared in one pass: `ride` (the bow), `rideBell`,
  `claves` and `cowbell`. Preparation follows the pack's committed recipe — mono
  downmix, capped at that voice's own decay, 80 ms fade at the cap, 44.1 kHz
  16-bit FLAC, **no front trim, not normalised**. The `ffmpeg` invocation used
  for each is written into `samples/README.md`.
- **R7** — VCSL is checked for the claves and the cowbell before any other
  library is considered. It is already a CC0 source in this pack and is a broad
  percussion library; a second source for a voice VCSL already holds is a
  licence obligation bought for nothing.
- **R8** — Every new voice ships real round-robin alternates across its velocity
  layers, declared in `samples/pack.json`, and every layer declares an explicit
  `nominalVelocity` derived by the method already recorded under *Levelling* in
  `samples/README.md` — the top layer's midpoint scaled by the ratio of this
  layer's measured peak to the top layer's. No layer defaults to its band
  midpoint.
- **R9** — `samples/provenance.json` gains one row per committed file, carrying
  its source library, its path inside that library, its licence and what was
  done to it. Any licence text a new library requires is committed beside the
  three already there.
- **R10** — `samples/README.md`'s source table and voice-mapping table are
  rewritten to include the new libraries and the four new voices, and the
  paragraph headed "**The pack has no ride, and that is a decision rather than an
  oversight**" is replaced by what the pack now has and why that library was
  chosen over the ones rejected.

### The voice contract

- **R11** — `VoiceName` in `scripts/grooves/types.ts` reaches its final shape in
  this epic: fifteen voices, the eleven that exist plus `ride`, `rideBell`,
  `claves` and `cowbell`. Epic 2 builds against it and does not re-derive it.
- **R12** — Every total `Record<VoiceName, …>` in the generator is completed for
  all four new voices in this epic, `VELOCITIES` in `events.ts` included, so
  adding a voice to a template later is a template edit and not a type error.
- **R13** — `ride` is added to `BACKING_VOICES`. It is part of the backing track
  and occupies no register a soloist would — the rule the list exists to hold is
  about the lead register, not about cymbals.
- **R14** — `events.test.ts`'s "has no crash to write there" assertion is
  rewritten to ban `crash` and `cymbal` while permitting `ride`. The crash half
  of the ban is not weakened: no voice, no event and no fill phrase may name a
  crash.

### The figure and its randomness

- **R15** — Ride figures are drawn from a pattern pool on a new labelled stream,
  `RIDE_LABEL`, never on `rhythmRng`. A draw inserted into `rhythmRng` would
  re-roll the rhythm of all thirty grooves, including the four feels that will
  never ride.
- **R16** — The pool holds three figures for subdivision 8, every one of them
  denser than the busiest foot-hat figure, because on a riding feel the ride *is*
  the pulse and the hat is not.
- **R17** — Ride accents run on their own shallow cycle of three, coprime with
  the bar. A ride whose accent pattern locks to the bar is a machine; one that
  wavers hard is a drummer losing time. Shallower than `HAT_ACCENTS` because a
  wavering pulse is worse than a flat one.
- **R18** — On a feel that declares `ride`, the closed hat draws from
  `HAT_PUNCTUATION_PATTERNS` instead of `HAT_PATTERNS` — one `pick`, at the
  position `rhythmRng` already draws the hat at. The pool holds three figures and
  **every one of them contains beats 2 and 4**, the jazz drummer's left foot under
  the snare. What varies is what else the foot adds: the bare pair, the pair plus
  a pickup on the "and" of beat 4, and all four beats. Two to four hits a bar, and
  the same figure in every bar of the groove.
- **R18b** — The pickup figure puts the closed hat on the step the open hat
  vacated. Losing `hatOpen` (R21) leaves the "and" of beat 4 empty on a riding
  feel, and one of the three foot-hat figures fills it with a closed hit — the
  pickup into the next bar survives, played by the voice that stayed.
- **R19** — The hat and the ride are allowed to sound together. A ride playing
  eighths lands on beats 2 and 4 as well, and a ping and a foot hat on the
  backbeat is the sound, not a collision. The rule at `docs/music.md:167` — that
  punctuation steps must be odd "so the hat cannot mark a position the ride is
  using" — does not survive this and is corrected in Epic 2 along with the rest
  of that section.
- **R19b** — The number of draws on `rhythmRng` and their order do not change for
  any feel — a riding feel swaps which pool the hat's single `pick` reads from and
  nothing else. A straight feel draws exactly what it draws today, so all four
  render byte-identically.

### `shuffle` takes the ride

- **R20** — `shuffle` is the only feel this epic changes. Its `voices` gains
  `ride` and loses `hatOpen`; its `gain`, `pan` and `humanize.lean` gain an entry
  for `ride` and lose their `hatOpen` entries. Its `flavours`, `tempoRange`,
  `subdivision`, `swing` and `passes` are untouched — every one of those is a
  re-key of the feel's answers, and this feature moves no answers.
- **R21** — `shuffle` keeps `hatClosed` and drops `hatOpen`. A jazz kit's open
  hat is the foot opening under the ride, not a stick hit on the "and" of 4, and
  one hat sound is enough beside a cymbal. `DEFAULT_PLACEMENT`'s open hat on
  16-grid step `[14]` is untouched — the four straight feels still play it; a
  riding feel simply does not declare the voice.
- **R21b** — The hat accent cycle runs over the hat hits the feel actually plays.
  With `hatOpen` gone from a riding feel, its step no longer enters that feel's
  hat line and no longer shifts the closed hat's accent indices. The four
  straight feels all play `hatOpen`, so their accent cycles are unchanged.
- **R21c** — The ride is silent in the bar that plays a **fill**, and returns on
  the downbeat of the bar after it. The fill is the snare's bar, and the cymbal
  coming back in is what marks the loop point.
- **R21d** — In the bar that plays the thinned **variation**, the ride reduces to
  quarter notes rather than dropping out. The variation is a mid-loop event and
  the fill is the loop's seam, so the two bars are as different on the cymbal as
  they already are on the snare — and the loop point keeps a marker that fires
  once.
- **R21e** — The hat keeps its drawn foot figure through both the fill bar and the
  variation bar. A drummer's left foot does not stop for a fill.
- **R22** — The ride sits under the snare and above the hat it replaced. Which
  half of the level carries what is decided and recorded: the sample's own
  recorded loudness lives in `pack.json` per layer as `nominalVelocity`, the mix
  position lives in the template's `gain` in dBFS. A pack error corrected in a
  template's gain becomes five more corrections in the other five templates, so
  the pack is fixed first and only then the template.
- **R23** — A rendered `shuffle` groove passes all seven checks of the quality
  gate, the density band `16–38` events per bar included.

### The listening decision

- **R24** — Epic 1 is not done until a person has played a rendered `shuffle`
  groove and said the cymbal is right. Nothing in the repo can hear: the gate
  measures loudness, peak, silence, seams, harmony, off-scale pitches and
  density, and a rock ride passes all seven. This is the check feature-13
  failed, and it failed it late.
- **R25** — The listening hand-off names the file paths to play and what to
  listen for — that a cymbal keeps the time, that the hat marks two or three
  points a bar, that nothing rings across the loop seam, and that it reads as a
  jazz drummer rather than a rock one. It does not report that the result sounds
  good.

## Behaviour details

Who keeps time, per feel, after this epic:

```mermaid
flowchart TD
  T{template declares ride?} -->|no| H[hat draws HAT_PATTERNS<br/>hat keeps the pulse<br/>open hat on the and of 4]
  T -->|yes| R[ride draws RIDE_PATTERNS on RIDE_LABEL<br/>ride keeps the pulse<br/>out for the fill bar, quarters for the variation]
  R --> P[closed hat draws HAT_PUNCTUATION_PATTERNS<br/>every figure holds beats 2 and 4<br/>no open hat in the kit]
```

Neither branch changes what any feel draws from `rhythmRng`, or in what order.
That is what keeps the nineteen grooves this feature does not touch
byte-identical.

## Acceptance criteria

- **AC1** (R11, R12) — Given the generator's types, `VoiceName` holds fifteen
  members including `ride`, `rideBell`, `claves` and `cowbell`, and
  `npm run test:gen` type-checks with no `Record<VoiceName, …>` left incomplete.
- **AC2** (R13, R14) — Given `BACKING_VOICES`, `ride` is a member; given every
  template rendered at every seed, no event's voice matches `/crash|cymbal/`,
  and no fill phrase names one.
- **AC3** (R6, R8) — Given `samples/pack.json`, each of the four new voices
  declares at least one velocity layer, every layer declares an explicit
  `nominalVelocity`, and every layer lists more than one file.
- **AC4** (R9) — Given `samples/provenance.json`, every committed file under the
  four new voice directories has a row naming its source, source path, licence
  and modifications; `samples/pack.test.ts`'s attribution assertion passes for
  every non-CC0 row.
- **AC5** (R1) — Given `provenance.json`, every row's `licence` is `CC0` or
  `CC-BY-4.0`.
- **AC6** (R10) — Given `samples/README.md`, the sentence "The pack has no ride"
  is absent, the source table names every library the pack draws on, and the
  voice-mapping table has a row for each of the fifteen voices.
- **AC7** (R20, R21) — Given the `shuffle` template, `voices` includes both
  `ride` and `hatClosed`, `gain` and `pan` have a `ride` entry, and
  `tempoRange`, `subdivision`, `swing`, `passes` and `flavours` are identical to
  their committed values.
- **AC8** (R15) — Given a `shuffle` groove built at any seed, its ride steps are
  a member of the subdivision-8 ride pool, and rebuilding it with the ride pool
  reordered changes the ride figure and changes no kick, bass, comp, ghost or
  bongo step of any feel.
- **AC9** (R18, R21e) — Given a `shuffle` groove at any seed, every bar's
  `hatClosed` steps are the same member of `HAT_PUNCTUATION_PATTERNS` resolved
  onto the feel's subdivision, that member contains beats 2 and 4, there are two
  to four hits a bar, and the figure is played in the fill bar and the variation
  bar as well.
- **AC9d** (R18) — Given `HAT_PUNCTUATION_PATTERNS`, it holds three figures and
  every one of them contains 16-grid steps 4 and 12.
- **AC9b** (R21, R21b) — Given the `shuffle` template, `voices` excludes
  `hatOpen` and `gain`, `pan` and `humanize.lean` have no `hatOpen` entry; given a
  `shuffle` groove at any seed, no `hatOpen` event exists. Given each of the four
  straight feels, `hatOpen` still plays on the "and" of beat 4.
- **AC9c** (R21c, R21d) — Given a `shuffle` groove at any seed, no `ride` event
  falls in the bar that plays the fill, a `ride` event falls on the downbeat of
  the bar after it, and the bar that plays the thinned variation carries `ride`
  events on its quarter-note positions and nowhere else.
- **AC10** (R19b) — Given each of `straight-funk`, `bright-straight`,
  `half-time`, `open-ballad` and `swung-sixteenth` at every catalogue seed, the
  built events are identical to those built before this epic — same voices, same
  steps, same velocities, same `MusicMeta`.
- **AC11** (R16) — Given a riding feel at any seed, its ride step count per bar
  exceeds its hat step count per bar.
- **AC12** (R23) — Given a rendered `shuffle` groove, all seven gate checks pass
  and its events-per-bar sits inside `16–38`.
- **AC13** (R8) — Given the same `shuffle` groove rendered twice, the two files
  are byte-identical; given one render, the ride alternates chosen differ between
  passes.
- **AC13b** (R5) — Given a run in which the first candidate fails, at least two
  further libraries are prepared and heard before the epic reports the stopping
  outcome.
- **AC14** (R3) — Given an audition render, `public/grooves/` is unmodified and
  `grooves.lock.json` still verifies.
- **AC15** (R5) — Given a run in which none of the three candidates passes,
  `VoiceName` holds fourteen members and no `ride`, the pack declares `claves`,
  `cowbell` and `rideBell` and no `ride`, `events.test.ts` still bans `ride`, and
  the report names all three libraries auditioned with each one's reason for
  rejection.
- **AC16** (R24) — The epic reports done only after a listening sign-off on a
  rendered `shuffle` groove has been recorded.

## Dependencies

Nothing precedes this epic. What it hands forward:

- `VoiceName`, fifteen members, final — Epics 2 and 3 add none.
- `samples/pack.json`'s `voices` keys, final.
- `RIDE_LABEL` and the ride pattern pool's shape, for Epic 2 to add its
  subdivision-16 figures to.
- `HAT_PUNCTUATION_PATTERNS` at its final shape — three figures, every one
  holding beats 2 and 4 — and the absence of `hatOpen` on a riding feel, both of
  which `swung-sixteenth` inherits in Epic 2 unchanged.
- The fill rule: ride out for the fill bar, quarter notes for the variation bar.
- A larger `docs/music.md` correction than Epic 2 was scoped for: line 167's
  odd-steps rule and the reasoning under "Who keeps time" are overturned, not
  just the count of riding feels.
- The levelling method, recorded in `samples/README.md`, for Epic 2 to apply to
  `swung-sixteenth` without re-deriving it.
- A flag on whether a CC-BY library entered the pack, which is what decides
  whether Epic 3 touches `src/`.

## Assumptions

- **The ride is the bow, not the bell.** `rideBell` is sourced and played by no
  template in this feature.
- **The bell, the claves and the cowbell need no pattern pool, no RNG stream and
  no template entry** in this epic. They are pack rows and type members only.
- **The claves and the rim never sound in the same groove.** A briefing rule with
  nothing to bind yet, since no template plays claves. It is recorded in
  `docs/music.md` in Epic 2 so the styles that reach for the claves inherit it.
- **The ride's `lean` is a tuning knob under the listening sign-off**, like
  every other humanize value. Proposed and heard, not asserted.
- **The exact ride figures are the musician's call.** Three for subdivision 8 —
  eighths, eighths over a quarter skeleton, and a swung-eighth figure is the
  shape `docs/music.md` already sketches, and the musician may replace it.
- **Which of the three foot-hat figures reads best at which tempo is the
  musician's call**, as is whether the "all four beats" figure earns its place at
  all once heard. The pool's shape — three figures, every one holding beats 2 and
  4 — is fixed; its exact members are a tuning knob under the listening sign-off.
- **A candidate's velocity-layer count follows what the library recorded.** Two
  layers with alternates is acceptable where that is all the recording supports,
  as `rim` and `hatOpen` already are; inventing a layer split the recording does
  not carry is the same erasure normalising would be.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-09-05

**Q1. Where does a riding feel's hi-hat go?**
Answer: **A) Beats 2 and 4 — the foot hat.** It is what a jazz drummer's left
foot does, and `docs/music.md:167`'s odd-steps rule was written before any ride
existed.
Applied to: R18, R19, R19b, AC9, AC10, Behaviour details, Scope, Summary,
Dependencies. Overturned the previous R19, which routed hat punctuation through
`ghostSteps` to force odd steps, and the previous AC9 clause requiring the hat
never to coincide with a ride step — on beats 2 and 4 it does coincide, and that
is the sound.

**Q2. What happens to the open hat on a riding feel?**
Answer: **B) Drop it on riding feels.** A jazz kit's open hat is the foot opening
under the ride, and one hat sound is enough beside a cymbal.
Applied to: R20, R21, R21b, AC9b, Scope. `DEFAULT_PLACEMENT` is unchanged — the
voice leaves the template rather than the placement leaving the code.

**Q3. Does the ride play through the fill bar?**
Answer: **B) The ride drops out for the fill bar and returns on the downbeat.**
The fill is the snare's bar, and the cymbal re-entering is what marks the loop
point.
Applied to: R21c, AC9c, Behaviour details, Assumptions.

**Q4. When does the audition stop and the feature stop with it?**
Answer: **A) Three candidate libraries prepared and heard; if none passes, stop
and report.** An unbounded audition has no failure state and so cannot report
one.
Applied to: R5, AC13b, AC15.

### Cycle 2 — 2026-09-05

**Q5. Is the foot hat drawn, or is it placement?**
Answer: **B) A pool of three, every entry containing 2 and 4** — the bare pair,
the pair plus a pickup, and all four beats, so the seed still varies the kit's
density.
Applied to: R18, R18b, R19b, AC9, AC9d, Assumptions, Dependencies.
`HAT_PUNCTUATION_PATTERNS` therefore exists as real code and stays in
`docs/music.md`; Epic 2's docs correction rewrites that row rather than deleting
it. The pickup figure lands on the "and" of beat 4, the step `hatOpen` vacated in
Cycle 1's Q2.

**Q6. Does the ride drop out of the thinned variation bar too?**
Answer: **C) The ride thins to quarter notes in the variation bar and drops out
entirely in the fill bar**, so the two bars are as different on the cymbal as the
snare phrases already are.
Applied to: R21c, R21d, R21e, AC9c, diagram, Dependencies. Replaced the Cycle 1
assumption that one rule covered both bars, and preserves Q3's reasoning — the
loop point keeps a marker that fires once.
