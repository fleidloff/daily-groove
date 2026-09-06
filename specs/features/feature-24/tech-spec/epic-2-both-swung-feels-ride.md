# Tech spec — Epic 2: Both swung feels ride

PRD: [../prd/epic-2-both-swung-feels-ride.md](../prd/epic-2-both-swung-feels-ride.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Epic 1 built the machinery on one feel; this epic points it at the second and
adds the half of the jazz gesture the cymbal cannot supply on its own. Three
things happen in three places that do not touch each other: `events.ts` grows a
sixteenth half of the ride pool and a feathered kick, `templates/swung-sixteenth.ts`
declares the ride and drops the open hat, and `docs/music.md` is corrected down
to what the code does. The fourth piece is the evidence that nothing else moved
— a digest fixture captured from the commit before this feature started, so
"byte-identical" is a measurement rather than a claim. The feather is fixed
placement computed from the bar's own kick steps, which is what lets it cost no
randomness and re-key nothing; every riding-feel behaviour this epic adds lands
in a new `riding.test.ts` rather than in the 1978-line `events.test.ts`, so the
epic's assertions stay greppable and out of Epic 1's way.

## Architecture

**Where each change lands.**

| Change | File |
| :-- | :-- |
| ride figures for subdivision 16 | `scripts/grooves/events.ts` → `RIDE_PATTERNS[16]` |
| the feathered kick | `scripts/grooves/events.ts` → `featherSteps`, `FEATHER_VELOCITY`, one emission block in the bar loop |
| `swung-sixteenth` takes the ride | `scripts/grooves/templates/swung-sixteenth.ts` |
| exactly two feels ride | `scripts/grooves/templates/index.test.ts` |
| riding-feel behaviour | `scripts/grooves/riding.test.ts` *(new)* |
| the four unmoved feels | `scripts/grooves/events-fixture.ts`, `events.fixture.json`, `events-fixture.test.ts` *(all new)* |
| the docs correction | `docs/music.md`, `scripts/grooves/docs.test.ts` |

**The feather, precisely.** Per bar, the kick positions that already sound are
either the drawn `KICK_PATTERNS` figure (an ordinary bar) or the kick line of the
fill phrase (a fill or variation bar). The feather fills the quarter-note
positions that set leaves empty, at a velocity under `GHOST_VELOCITY_THRESHOLD`.
It is computed, never drawn, so it consumes no RNG and cannot shift any other
voice's draws.

```
for each bar:
    sounding = fillPhrase.kick ?? kickSteps          # already-loud kicks
    feathers = grid([0,4,8,12]) \ sounding           # fixed, no rng
    emit sounding at velocityFor('kick', …)          # unchanged
    emit feathers at FEATHER_VELOCITY                # < 0.5
```

Every quarter of every bar then carries exactly one kick event, and the split
between "drawn" and "feathered" is readable off the velocity — which is what
makes AC5 and AC7 testable without reaching into the generator's internals.

**Why the ride pool is keyed by subdivision rather than split into two pools.**
Every pattern pool in `events.ts` is written on the sixteenth grid
(`PATTERN_RESOLUTION = 16`) and resolved by `gridSteps` onto the feel's own
subdivision. Keying one pool by `template.subdivision` keeps that rule intact
and keeps the draw a single `pick` on `RIDE_LABEL`, which is what R15 froze in
Epic 1. Two separately named pools would need a selection rule anyway, and would
put the same figure in two places the day a third riding feel arrives.

**Why the baseline is captured from a git worktree.** AC9 asks for events
identical to those built *before this feature*, and by the time this epic runs,
Epic 1 has already landed. Capturing the digest from the current tree would be
asserting Epic 1's own claim against itself. So Track B copies its capture
module into a worktree at the feature's base commit, runs it there, and commits
the result — the same shape `harmony.fixture.json` already uses, and the same
reason it exists.

**What this epic deliberately does not do.** No re-render, no lock rebuild, no
manifest change, no pack change, no `src/` change. The committed MP3s still play
the pre-feature audio until Epic 3 — and because none of the files this epic
owns is an input `verifyLock` hashes, the green `npm run build` Epic 1 hands
over (its R5b and AC14b) is still green when this epic ends.

## Contracts

Frozen before any track starts. The first three come from Epic 1 and are
restated here as what Track A builds against; the rest are this epic's.

### From Epic 1 — do not re-derive

```ts
// scripts/grooves/types.ts
export type VoiceName = /* fifteen members, including 'ride' */

// scripts/grooves/events.ts
export const RIDE_LABEL = 'ride'
export const BACKING_VOICES: VoiceName[]            // contains 'ride'
export const GHOST_VELOCITY_THRESHOLD = 0.5         // unchanged
export const HAT_PUNCTUATION_PATTERNS: number[][]   // three figures, every one holding 16-grid steps 4 and 12
export const RIDE_PATTERNS: Record<8 | 16, number[][]>
```

- A riding feel declares `ride`, keeps `hatClosed`, and declares **no**
  `hatOpen` — in `voices`, `gain`, `pan` and `humanize.lean` alike.
- On a riding feel the closed hat's single `pick` on `rhythmRng` reads
  `HAT_PUNCTUATION_PATTERNS` instead of `HAT_PATTERNS`. The number and order of
  `rhythmRng` draws is the same for every feel.
- The ride is silent in the fill bar and reduces to quarter notes in the thinned
  variation bar. The hat plays its figure in both.
- Levelling method, recorded in `samples/README.md`: the sample's own loudness is
  fixed in `pack.json` per layer as `nominalVelocity` **first**, the mix position
  in the template's `gain` (dBFS) **second**. Apply it; do not re-derive it.

### This epic's own

```ts
// scripts/grooves/events.ts

// Members written on the sixteenth grid, resolved by gridSteps onto the feel's
// subdivision, exactly like every other pool. Epic 2 adds key 16 and does not
// touch key 8 — not its members, not their order.
export const RIDE_PATTERNS: Record<8 | 16, number[][]>

// Drawn as one pick on RIDE_LABEL, sub-pool chosen by the feel:
//   pick(rngFor(`${spec.template}:${spec.seed}:${RIDE_LABEL}`),
//        RIDE_PATTERNS[template.subdivision])

export const QUARTER_STEPS_16: number[]     // [0, 4, 8, 12], the sixteenth grid's quarters

export const FEATHER_VELOCITY = 0.21
// Two bounds, and the tighter one is not the ghost threshold. Asserted:
// FEATHER_VELOCITY + max(humanize.velocity over riding feels) <
// GHOST_VELOCITY_THRESHOLD, i.e. v + 0.13 < 0.5, so v < 0.37. Governing:
// the kick pack's softest velocity layer tops out at maxVelocity 0.3465, and
// a humanized feather above that crosses into kick_v80 — a harder strike with
// audible beater click. Measured over 1086 feathers: 0.21 → 0 escapes,
// 0.26 → 15, 0.30 → 168. 0.21 is the shipped value.

export function featherSteps(sounding: number[], subdivision: 4 | 8 | 16): number[]
// gridSteps(QUARTER_STEPS_16, subdivision) minus every step in `sounding`.
// Pure. No rng. `sounding` is the bar's already-loud kick line: the drawn
// KICK_PATTERNS figure in an ordinary bar, the fill phrase's kick line in a
// fill or variation bar.
```

```ts
// scripts/grooves/events-fixture.ts   (new)
export type EventsDigest = { events: number; digest: string }
export function digestOf(spec: GrooveSpec, template: FeelTemplate): EventsDigest
// sha256 over a field-by-field canonical serialisation of
// [events…, music] — never JSON.stringify of the objects, so a reordered
// object literal cannot fail the fixture and a renamed field cannot pass it.
```

```jsonc
// scripts/grooves/events.fixture.json   (new)
{
  "note": "Captured at <base sha>, the commit before feature-24. …",
  "grooves": { "groove-01": { "events": 428, "digest": "…" } }
}
```

**`swung-sixteenth`'s final shape.** `tempoRange`, `subdivision`, `swing`,
`passes`, `flavours`, `density` and every `gain`/`pan`/`lean` entry not named
here are byte-identical to their committed values.

```ts
voices: [… 'ride' in the array position 'hatOpen' held …]   // 'hatOpen' removed
gain:   { …, ride: <derived>,  /* hatOpen entry deleted */ }
pan:    { …, ride: <derived>,  /* hatOpen entry deleted */ }
humanize.lean: { snare: 11, hatClosed: -5, ride: <derived> }  // hatOpen entry deleted
```

`gain.kick` stays `-8` and `density` stays `{ minPerBar: 16, maxPerBar: 42 }`.

**Test command.** Every track in this epic owns generator-tier files
(`docs/music.md` routes there too, per `scripts/tiers.test.ts`), so every track
runs `npm run test:gen`.

## Tracks

### Track A — the sixteenth ride and the feathered kick

- **Goal** — `swung-sixteenth` renders with a ride keeping time, a foot hat on
  beats 2 and 4, and quarter-note feathers under the drawn kick; `shuffle` gains
  the feather; both stay inside their committed density bands.
- **Owns** — `scripts/grooves/events.ts`, `scripts/grooves/riding.test.ts` (new),
  `scripts/grooves/templates/swung-sixteenth.ts`,
  `scripts/grooves/templates/index.test.ts`
- **Role** — `musician`. It decides three ride figures, a feather velocity and
  three mix values, and every one of those is a decision about what the grooves
  sound like. `/implement-feature` runs the musician turn first and the
  implementer turn second, as it does for any generator unit.
- **Depends on** — the Epic 1 contracts above, and nothing in this epic.
- **Parallel with** — Track B, Track C. It shares no file with either.
- **Done when** — `npm run test:gen` is green with `riding.test.ts` asserting
  every riding-feel behaviour in the PRD, and the 120-seed density test passes
  for both riding feels.

*Note on ownership:* `events.ts` cannot be split. The ride pool and the feather
are separate ideas but they live in one file, and the template edit is red until
the pool has sixteenth members. A track that cannot be given disjoint files is
not a track, so these are one.

### Track B — the baseline the four unmoved feels are measured against

- **Goal** — a committed digest of every event and every `MusicMeta` field of
  the nineteen catalogue grooves belonging to `straight-funk`,
  `bright-straight`, `half-time` and `open-ballad`, captured from before this
  feature, and a test that fails the moment one of them moves.
- **Owns** — `scripts/grooves/events-fixture.ts` (new),
  `scripts/grooves/events.fixture.json` (new),
  `scripts/grooves/events-fixture.test.ts` (new)
- **Role** — `musician`. It owns generator files, and its one real decision is
  musical rather than mechanical: which fields make two renders *the same
  groove*. Get that wrong in either direction and the fixture either passes
  through a changed groove or fails on a rounding difference.
- **Depends on** — nothing. The capture reads a git worktree at the feature's
  base commit, so Track A's work in progress cannot contaminate it.
- **Parallel with** — Track A, Track C.
- **Done when** — the fixture is committed, `events-fixture.test.ts` is green
  against the current tree, and mutating one event in a scratch copy makes it
  fail with the groove's id in the message.

### Track C — the document says what the code does

- **Goal** — `docs/music.md` corrected: two riding feels, not four; the
  punctuation row and "Who keeps time" rewritten with the odd-steps reason
  retracted rather than narrowed; fifteen voices; the feathered kick; the
  declined feels; the claves/rim rule. Guarded by assertions that read the
  document from disk.
- **Owns** — `docs/music.md`, `scripts/grooves/docs.test.ts`
- **Role** — `implementer`. Its product is prose and the test that pins it. The
  musical judgements it records were settled in the PRD (R12–R14) and by Track A;
  this track transcribes them and makes them un-driftable.
- **Depends on** — the PRD only. It reads the *count* of riding templates from
  the code at test time rather than hard-coding two, so it does not wait on
  Track A and it survives the R4 branch unchanged.
- **Parallel with** — Track A, Track B.
- **Done when** — `npm run test:gen` green with the new `docs/music.md`
  assertions, and every string AC11 names absent is absent.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C. No two of them write the
  same file, and none needs a file another creates.
- **Wave 2:** Integration and verification — the catalogue through the gate, the
  listening pass, and the R4 branch if the listening pass goes the other way.

There is no Wave 3. Track C is written for the two-riding-feel outcome and, if
R4 fires, gains one paragraph in Wave 2 rather than being rewritten — which is
why its assertions read the riding count from `allTemplates()` instead of
hard-coding it.

## Implementation

### Track A — the sixteenth ride and the feathered kick

#### Step A1 — the ride pool grows a sixteenth half

Covers: R3, AC3

- **Test first** — `scripts/grooves/riding.test.ts`: `RIDE_PATTERNS` has keys
  `8` and `16`; `RIDE_PATTERNS[16]` holds three figures; every figure is
  ascending, duplicate-free, and every step is `>= 0` and `< 16`; every figure
  has more steps than the busiest member of `HAT_PUNCTUATION_PATTERNS`; and no
  member of `RIDE_PATTERNS[16]` deep-equals a member of `RIDE_PATTERNS[8]`. Run
  it: fails with `expected undefined to have length 3` (or, if Epic 1 shipped a
  flat array, `expected [...] to have property '16'`).
- **Implement** — `scripts/grooves/events.ts`: three figures under key `16`. If
  Epic 1 shipped `RIDE_PATTERNS` as a flat `number[][]`, key it first — move
  Epic 1's three figures under `8` unchanged, in their committed order, and make
  `buildEvents` read `RIDE_PATTERNS[template.subdivision]`. Reordering key `8`
  would re-key `shuffle`'s six grooves, so it is the one thing this step may not
  do.
  Candidate figures for the musician, all on the sixteenth grid, none of them
  the shuffle's ping at a higher tempo — at swing `0.44` the engine delays every
  odd sixteenth, so a step on `7` or `15` *is* the "a":
  - `[0, 4, 7, 8, 12, 15]` — spang-a-lang: quarters with the "a" of 2 and 4. Six
    hits, the sparse idiomatic reading.
  - `[0, 3, 4, 7, 8, 11, 12, 15]` — every quarter plus its own "a". Eight hits.
  - `[0, 4, 6, 7, 8, 12, 14, 15]` — spang-a-lang with an eighth pickup into 3
    and into the next bar.

  The choice is the musician's and is heard, not argued. The budget is Step A9's:
  averaged over the loop a figure of `N` steps costs about `0.875N + 0.25`
  events a bar, and `swung-sixteenth` has about `13.1` events a bar of room once
  the hat line is gone, so `N ≤ 14`.
- **Green when** — the three shape assertions pass; `npm run test:gen` stays
  green, `shuffle`'s renders unchanged.
- **Refactor** — none. Do not rename `RIDE_PATTERNS`.

#### Step A2 — `swung-sixteenth` takes the ride and loses the open hat

Covers: R1, R2, R11, AC1, AC2, AC10

- **Test first** — `scripts/grooves/templates/index.test.ts`:
  - a new case: exactly two templates declare `ride`, and their ids sorted are
    `['shuffle', 'swung-sixteenth']`.
  - a new case: their `gain.ride` values differ.
  - rewrite `it('gives every template both hats')` to *"gives every template a
    closed hat, and an open hat unless it rides"*: `hatClosed` on all six;
    `hatOpen` present on every template without `ride` and absent from every
    template with it, in `voices`, `gain`, `pan` and `humanize.lean` alike.
  - a new case pinning `swung-sixteenth`'s untouched fields: `tempoRange`
    `[106, 116]`, `subdivision` `16`, `swing` `0.44`, `passes` `4`, `flavours`
    `['phrygian-dominant', 'harmonic-major']`, `density` `{16, 42}`,
    `gain.kick` `-8`.

  Run it: fails with `expected [ 'shuffle' ] to equal [ 'shuffle', 'swung-sixteenth' ]`.
- **Implement** — `scripts/grooves/templates/swung-sixteenth.ts`: `ride` takes
  `hatOpen`'s position in `voices`; `gain.hatOpen`, `pan.hatOpen` and
  `humanize.lean.hatOpen` are deleted and `ride` entries added in their place.
  Derive the three values by Epic 1's recorded method — read the *Levelling*
  section of `samples/README.md` and `shuffle`'s committed `gain.ride` first,
  then place this feel's ride in this feel's mix. Starting proposals, all tuning
  knobs under the listening sign-off:
  - `gain.ride: -10` — under the snare (`-7`) and above the closed hat it is
    replacing as timekeeper (`-12`). It must not equal `shuffle`'s: a cymbal at
    110 bpm over sixteenths sits differently from one at 85 over a shuffle, and
    AC2 asserts the difference.
  - `pan.ride: -0.28` — opposite this feel's closed hat (`+0.33`), because
    this feel's kit image is mirrored relative to `shuffle`'s: `hatClosed`
    `+0.33`/`-0.32`, `tomHigh` `+0.18`/`-0.22`, `tomLow` `-0.20`/`+0.26`,
    `comp` `-0.31`/`+0.28`. Copying `shuffle`'s `+0.30` sign would stack both
    cymbals in the right ear and leave a rack tom and the comp alone on the
    left.
  - `humanize.lean.ride: -4` — a hair ahead, one notch less than the hat's `-5`.

  Record the derivation in the step's report so Epic 3 can re-read it.
- **Green when** — the four new template cases pass and the rewritten hat case
  passes for all six feels.
- **Refactor** — none.

#### Step A3 — the sixteenth feel rides its own figure

Covers: R3, AC3

- **Test first** — `riding.test.ts`: for `swung-sixteenth` at every seed in
  `catalogue.json` and at seeds 1–8, collect the `ride` steps of an ordinary bar
  (any bar not in the fill/variation bars — `riding.test.ts` needs its own copy
  of `events.test.ts`'s three-line `phraseBars` helper, which is local to that
  file); assert they equal
  `gridSteps(m, 16)` for exactly one member `m` of `RIDE_PATTERNS[16]`, and that
  every ordinary bar of the loop carries the same steps. Run it: fails with
  `expected [] to have length 6` — the template rides but the pool selection
  still reads key 8 if A1's keying was skipped, otherwise it passes and the case
  guards the wiring.
- **Implement** — `scripts/grooves/events.ts`: confirm the ride draw reads
  `RIDE_PATTERNS[template.subdivision]`. No new draw, no new stream.
- **Green when** — the membership assertion passes at all thirty-five seeds.
- **Refactor** — none.

#### Step A4 — the foot hat, on both riding feels

Covers: R5, R6, AC4

- **Test first** — `riding.test.ts`: for every template declaring `ride`, at
  every catalogue seed and seeds 1–8, for **every** bar of the loop — fill and
  variation bars included: the bar's `hatClosed` steps equal
  `gridSteps(m, feel.subdivision)` for one member `m` of
  `HAT_PUNCTUATION_PATTERNS`, the same `m` in every bar; that resolution contains
  `gridSteps([4, 12], feel.subdivision)`; the bar has two to four `hatClosed`
  hits; and the groove contains no `hatOpen` event at all. Run it: fails on
  `swung-sixteenth` with an eight- or sixteen-step hat line before A2 lands, and
  guards it afterwards.
- **Implement** — nothing new. Epic 1's pool swap already covers any template
  that declares `ride`; this step's product is the assertion that
  `swung-sixteenth` inherited it unchanged.
- **Green when** — both riding feels pass at every seed.
- **Refactor** — none.

#### Step A5 — `featherSteps`, the quarters the figure left empty

Covers: R7, R7b

- **Test first** — `riding.test.ts`, against the exported function with no
  groove built:
  - `featherSteps([0, 6, 10], 16)` → `[4, 8, 12]`
  - `featherSteps([0, 6, 8, 14], 16)` → `[4, 12]` — the drawn `8` keeps its quarter
  - `featherSteps([0, 3, 5], 8)` → `[2, 4, 6]` — the eighth grid's quarters
  - `featherSteps([0, 2, 4, 6], 8)` → `[]` — a figure on all four quarters takes
    no feather at all
  - `FEATHER_VELOCITY` is `> 0`, and `FEATHER_VELOCITY + humanize.velocity` is
    below `GHOST_VELOCITY_THRESHOLD` for every template declaring `ride`

  Run it: fails with `featherSteps is not a function`.
- **Implement** — `scripts/grooves/events.ts`: `QUARTER_STEPS_16 = [0, 4, 8, 12]`,
  `FEATHER_VELOCITY`, and `featherSteps(sounding, subdivision)` returning
  `gridSteps(QUARTER_STEPS_16, subdivision).filter((s) => !sounding.includes(s))`.
  Export all three.
- **Green when** — the five cases pass.
- **Refactor** — none.

#### Step A6 — the feather sounds under the figure, in every bar

Covers: R7, R7b, R8, AC5, AC8

- **Test first** — `riding.test.ts`: for every template declaring `ride`, at
  every catalogue seed and seeds 1–8, per bar of the loop:
  - every quarter-note step of the bar carries exactly one `kick` event
  - every `kick` event with velocity `< GHOST_VELOCITY_THRESHOLD` sits on a
    quarter-note step
  - every `kick` event with velocity `>= GHOST_VELOCITY_THRESHOLD` is one the
    bar's own figure accounts for — the drawn figure in an ordinary bar, the fill
    phrase's kick in a fill or variation bar
  - on a **humanize-free clone** of the template
    (`{...feel, humanize: {timingMs: 0, velocity: 0, lean: {}, driftDepth: 0}}`),
    every non-feather kick's velocity equals `velocityFor('kick', …)` — the
    drawn hit stands at its own velocity and is neither overwritten nor summed.
    AC5 asks for the velocity `VELOCITIES` authors for the metric position and
    says the comparison is on **authored** velocity, before `humanize`; the dry
    clone is what makes that exact. A post-`humanize` comparison would be
    unsatisfiable anyway — adding any event to a riding feel changes what the
    `humanize:<pass>` stream hands every later one
  - `templates/index.test.ts` already pins `gain.kick`; add the same for
    `shuffle` (`-10`) so AC8 covers both riding feels

  Run it: fails with `expected 3 kick events on quarter steps, got 1`.
- **Implement** — `scripts/grooves/events.ts`, inside the bar loop, *after* the
  fill/ordinary branch and beside the `bass` and `comp` blocks, so it runs in
  every bar:

  ```ts
  if (plays('ride') && plays('kick')) {
    const sounding = phrase
      ? (phrase.find(([voice]) => voice === 'kick')?.[1] ?? [])
      : kickSteps
    for (const step of featherSteps(sounding, template.subdivision)) {
      add('kick', bar, step, 2, undefined, FEATHER_VELOCITY)
    }
  }
  ```

  Guarding on `plays('ride')` is what keeps R9 true by construction and keeps
  the four straight feels out of the diff.
- **Green when** — every quarter of every bar of both riding feels carries
  exactly one kick, and the existing case *"never stacks two hits of one voice
  on the same step of a coarser grid"* still passes.
- **Refactor** — none. Resist hoisting the feather into `kickSteps`: a bar whose
  fill phrase moves the kick would then get the wrong floor.

#### Step A7 — the feather is fixed, not drawn

Covers: R7, AC6

- **Test first** — `riding.test.ts`: build `swung-sixteenth` at a catalogue seed;
  rotate `RIDE_PATTERNS[16]` in place (`pool.push(pool.shift()!)`), rebuild the
  same spec, restore the pool in a `finally`. Assert the ride steps **differ**
  between the two builds — a rotation that changed nothing would make the rest
  of the case vacuous — and that every `kick` event is identical in step,
  velocity and time, as are the `bass`, `comp`, `snare` and `hatClosed` lines.
  Run it before A6: passes vacuously because no feather exists, which is why
  this step follows A6 rather than preceding it.
- **Implement** — nothing. The step's product is the evidence that the feather
  consumes no randomness; if it fails, the implementation drew something it
  should have computed.
- **Green when** — the ride line moves and the kick line does not.
- **Refactor** — none. The rotation must be restored in a `finally`; a leaked
  mutation would silently re-key every later case in the file.

#### Step A8 — nothing that does not ride feathers

Covers: R9, AC7

- **Test first** — `riding.test.ts`: for `half-time` and `open-ballad` — and for
  `straight-funk` and `bright-straight` while we are here — at every catalogue
  seed, no `kick` event has velocity below `GHOST_VELOCITY_THRESHOLD`. Run it: it
  passes if A6 guarded correctly; it is the guard against the guard being
  dropped later.
- **Implement** — nothing.
- **Green when** — all four non-riding feels pass at all nineteen catalogue seeds.
- **Refactor** — none.

#### Step A9 — both riding feels stay inside their committed bands

Covers: R11b, R11c, R11d, AC12

- **Test first** — the existing case in `events.test.ts`, *"every template's
  density band admits its own grooves"*, already runs 120 seeds per feel against
  the committed band. Run `npm run test:gen` and read what it says. Add to
  `riding.test.ts` a case pinning the two bands as literals — `shuffle`
  `16–38`, `swung-sixteenth` `16–42` — so widening one is a deliberate edit to a
  test that names the numbers, not a quiet change to a template.
- **Implement** — measured headroom before this epic, over seeds 1–120:

  | Feel | Band | Renders today | Room once the whole hat line is gone |
  | :-- | :-- | :-- | :-- |
  | `shuffle` | 16–38 | 22.81–28.25 | 16.75 events/bar at the tightest seed (50) |
  | `swung-sixteenth` | 16–42 | 23.06–35.81 | 20.13 events/bar at the tightest seed (11) |

  Out of that room the foot hat takes 2–4 a bar (and now plays in the fill and
  variation bars too), the feather takes 2–3, and the rest is the ride's. If a
  seed overflows, **thin the ride figure** — drop steps from the densest member
  of `RIDE_PATTERNS[16]`, or replace it with a sparser figure. Do not widen the
  band. Do not exempt the feather from the count: it is four fixed hits carrying
  half the gesture and it is not the thing that varies.
  If thinning cannot bring every seed inside the band, **stop and report** —
  name the feel, the seed, the measured events per bar and the figures tried.
  The catalogue is fixed at thirty and no groove can be dropped, so the only
  alternative to reporting is a silent change to what the feel means.
- **Green when** — the 120-seed density case passes for both riding feels and
  the four straight feels are untouched.
- **Refactor** — none.

### Track B — the baseline the four unmoved feels are measured against

#### Step B1 — a digest that says two builds are the same groove

Covers: R10

- **Test first** — `scripts/grooves/events-fixture.test.ts`: `digestOf` returns
  the same digest for two builds of the same `{template, seed}`; a different
  digest when one event's `velocity` moves by `1e-9`, when one event's `voice`
  changes, when an event is added, and when one `MusicMeta` field changes; and
  `events` counts the events. Feed those cases synthetic event arrays through the
  exported canonicaliser rather than by re-rendering. Run it: fails with
  `Cannot find module './events-fixture.ts'`.
- **Implement** — `scripts/grooves/events-fixture.ts`: `digestOf(spec, template)`
  calls `buildEvents`, then serialises **field by field** — for each event, in
  array order, `voice`, `timeSec`, `durationSec`, `velocity`, `midi ?? null`;
  then the nine `MusicMeta` fields in a fixed listed order — and hashes the
  result with `node:crypto`'s sha256. Never `JSON.stringify` the objects: a
  reordered object literal would fail a fixture it should pass, and a renamed
  field would pass one it should fail.
- **Green when** — the six cases pass.
- **Refactor** — none.

#### Step B2 — capture the pre-feature baseline

Covers: R10, AC9

- **Test first** — `events-fixture.test.ts`: the fixture exists, its `note`
  names the base commit, and its `grooves` keys are exactly the ids of the
  catalogue grooves whose template is one of `straight-funk`, `bright-straight`,
  `half-time`, `open-ballad` — nineteen of them today, and the case derives the
  list from `readCatalogue()` rather than hard-coding it. Run it: fails with
  `ENOENT: events.fixture.json`.
- **Implement** — add a `main` to `events-fixture.ts` that writes
  `events.fixture.json` for those four templates' catalogue entries, then
  capture from the commit before this feature:

  ```
  git worktree add /tmp/dg-base <the commit before Epic 1>
  cp scripts/grooves/events-fixture.ts /tmp/dg-base/scripts/grooves/
  node /tmp/dg-base/scripts/grooves/events-fixture.ts --out <repo>/scripts/grooves/events.fixture.json
  git worktree remove /tmp/dg-base
  ```

  The copied module imports its siblings by relative path, so it builds the base
  tree's events with the base tree's generator. Put the base sha in `note`, the
  way `harmony.fixture.json` records the manifest it was written from.
- **Green when** — the fixture is committed and covers all nineteen ids.
- **Refactor** — none. Do not add a script entry to `package.json`; this runs
  once, and a standing `npm run` target invites re-capturing a baseline after the
  thing it was measuring has already moved.

#### Step B3 — the four feels have not moved

Covers: R10, AC9

- **Test first** — `events-fixture.test.ts`: for every id in the fixture,
  `digestOf` against the current tree equals the recorded digest and the recorded
  event count; a mismatch reports the groove id, the template, both counts and
  both digests. Plus one meta-case: tamper with a copy of the fixture and assert
  the failure message names the groove. Run it: if it fails at this point,
  something in Track A leaked past `plays('ride')` — or Epic 1's AC10 did not
  hold, which this fixture is also the first hard evidence of.
- **Implement** — nothing, if the guards held. If it fails, the diagnosis is the
  deliverable: name the feel, the seed and the first differing event.
- **Green when** — all nineteen match.
- **Refactor** — none.

### Track C — the document says what the code does

Every step below adds cases to a new `describe('the music document')` block in
`scripts/grooves/docs.test.ts`, beside the two blocks already there, reading
`docs/music.md` from disk with the file's existing `read()` helper. Start with a
sanity case in the shape of the existing ones — the file is over 8000 characters
and contains `## The six feels` — so a rename cannot make the rest pass
vacuously.

#### Step C1 — the feel table says two ride, and the code agrees

Covers: R12, AC11

- **Test first** — `docs.test.ts`: parse the feel table's rows; the `Pulse` cell
  reads `ride` for exactly the templates that declare `ride` in
  `allTemplates()`, and `hat` for the rest; the string `Four of the six ride` is
  absent. Run it: fails with `expected [ 'swung-sixteenth', 'shuffle', 'half-time', 'open-ballad' ] to equal [ 'shuffle', 'swung-sixteenth' ]`.
- **Implement** — `docs/music.md`: `half-time` and `open-ballad` take `hat` in
  the Pulse column. Replace "Four of the six ride. The two that do not are the
  two straight feels…" with what is true: two of the six ride, and they are the
  two that genuinely swing.
- **Green when** — the table and `allTemplates()` agree.
- **Refactor** — reading the count from the code rather than hard-coding two is
  what makes this case survive the R4 branch untouched.

#### Step C2 — the punctuation row and "Who keeps time", with the reason retracted

Covers: R12, AC11

- **Test first** — `docs.test.ts`: the `HAT_PUNCTUATION_PATTERNS` table row
  contains `beats 2 and 4` and `2–4 a bar` and does **not** match `/odd/`; the
  `SNARE_GHOST_PATTERNS` row still says `every step odd`, so the edit was
  surgical; the document does not contain `so the hat cannot mark a position the
  ride is using`; and the "Who keeps time" paragraph contains both `2` and `4`
  and does not contain `off-sixteenths only`.
- **Implement** — `docs/music.md`: rewrite the row and the paragraph. The pool
  survives as three figures; what changes is what they hold and why. Say that
  the old reason was **wrong**, not narrower: a ride playing eighths lands on
  beats 2 and 4 with the foot hat, and a ping and a foot hat on the backbeat is
  the sound rather than a collision. Keep the true half — ride figures are
  denser than hat punctuation by construction.
- **Green when** — the four assertions pass.
- **Refactor** — none.

#### Step C3 — the pattern-pool table, the kit, and the fill rule

Covers: R12

- **Test first** — `docs.test.ts`: the pool table has a `RIDE_PATTERNS` row whose
  Options cell names the real per-subdivision counts; the document says a riding
  feel drops `hatOpen`; and it says the ride is out for the fill bar and on
  quarters for the variation bar.
- **Implement** — `docs/music.md`: update the `RIDE_PATTERNS` row to the real
  counts (`3 per subdivision, 8 and 16`), and add the two sentences under "Who
  keeps time". While there, correct the "three libraries" sentence in the voice
  section if Epic 1 added a fourth, and the CC-BY credit sentence if the ride
  library carries an obligation — the document is being corrected to what the
  code does, and those two sentences are part of what it says.
- **Green when** — the three assertions pass.
- **Refactor** — none.

#### Step C4 — `half-time` and `open-ballad`, considered and declined

Covers: R13, AC11

- **Test first** — `docs.test.ts`: a passage names both `half-time` and
  `open-ballad`, says they were considered and declined, and gives the reason by
  naming their swing values `0.28` and `0.02`.
- **Implement** — `docs/music.md`: a short paragraph under the feel table.
  Swing `0.28` and `0.02` are straight in all but name, so handing them a ride
  would be a cymbal over a straight groove. Recorded so the next reader does not
  re-add them as an oversight.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step C5 — fifteen voices, the feather, and the claves/rim rule

Covers: R14, AC11

- **Test first** — `docs.test.ts`: the voice-list heading says `fifteen`; the
  section lists fifteen backticked voices and the set equals the members of
  `VoiceName` (read from `scripts/grooves/types.ts`, so the doc and the type are
  checked against each other); the document matches `/feather/i` and attributes
  the feathered kick to the riding feels; and a sentence names both `claves` and
  `rim` and says they never sound in the same groove.
- **Implement** — `docs/music.md`: rename the section to "The fifteen voices",
  add `rideBell`, `claves` and `cowbell` to the list, add the feathered kick as a
  property of the riding feels (quarter notes below the ghost threshold, fixed
  placement, no new sample), and record the claves/rim rule against the styles
  that will reach for the claves.
- **Green when** — the four assertions pass.
- **Refactor** — none.

## Integration and verification

#### Step I1 — the whole catalogue through the gate

Covers: R11b, AC12

- **Test** — `npm run test:gen`. `catalogue-gate.test.ts` already renders every
  catalogue groove and runs all seven checks; it now covers eleven grooves with a
  cymbal and a feathered kick. Read the failures rather than the summary: a
  `density` failure is Step A9's thinning problem, a `loudness` failure is a
  levelling problem in Step A2 and is fixed in the pack first and the template
  second — never by moving `LOUDNESS_FLOOR_DB` or `LOUDNESS_CEILING_DB`.
- **Green when** — all thirty grooves pass all seven checks.

#### Step I2 — the listening pass, recorded

Covers: R4, AC13

- **Test** — none a machine can run. Render one groove per riding feel to a
  scratch directory, leaving `public/grooves/` and `grooves.lock.json`
  untouched. Epic 1's R3 adds an `--out` option to the CLI for exactly this; if
  it landed, use it. If it did not, `generate` already takes both without a CLI
  flag, and a five-line scratch script is cheaper than adding one here:

  ```ts
  await generate({
    catalogue: readCatalogue().filter((g) => ['<shuffle id>', '<sixteenth id>'].includes(g.id)),
    outDir: '/tmp/dg-listen',
    manifestPath: '/tmp/dg-listen/manifest.ts',
    lockPath: '/tmp/dg-listen/lock.json',
  })
  ```

  Hand over the two file paths and what to listen for, and do not report that it
  sounds good:
  - a cymbal keeps the time on both, and the hat marks two to four points a bar
  - the kick is *present* under the ride rather than louder or busier — the
    feather should be felt and not counted
  - **the sixteenth feel's ride is not the shuffle's ride at a higher tempo.**
    This is the sentence AC13 asks to be recorded, and it is the one the whole
    epic turns on
  - nothing rings across the loop seam, and the ride re-entering marks it
- **Green when** — a person has played both and said so, either way.

#### Step I3 — the R4 branch, if the sixteenth ride does not survive

Covers: R4

Only if I2 comes back negative for `swung-sixteenth`:

- Revert Step A2 (`templates/swung-sixteenth.ts` back to its committed shape,
  and the `templates/index.test.ts` cases back to one riding template) and Step
  A1's key-`16` members. Keep the keyed shape, keep `shuffle`'s ride, and keep
  the feather — R4 says `shuffle` keeps both, and Steps A5–A8 already reach
  exactly the feels that ride.
- Track B's fixture widens: `swung-sixteenth`'s five grooves join the unmoved
  set, and the capture is re-run for twenty-four ids.
- Track C gains one sentence in Step C4's paragraph naming `swung-sixteenth`
  beside `half-time` and `open-ballad`, with the reason it was heard and
  declined — recorded, not left as a gap. Steps C1–C3 and C5 need no edit;
  C1 reads the riding count from the code.
- The epic then delivers the docs correction, the feather on `shuffle`, and the
  fixture. Epic 3 re-renders six grooves rather than eleven.

#### Step I4 — the full set

- `npm run test:gen`, `npm test`, `npm run lint`, `npm run build` — all four
  green, no carried-forward red.
- **`npm run build` runs `prebuild` → `npm run grooves:verify`, and it must
  pass.** Epic 2 inherits a green build: Epic 1's R5b and AC14b close the
  `pack-stale` hole in-epic, its Track G re-runs `npm run notes` and asserts that
  only `packSha256` moves while all twenty-four note MP3s come back
  byte-identical. So `lock.packSha256` already matches the committed
  `scripts/grooves/samples/pack.json` when this epic starts.
- **Epic 2 touches no file `verifyLock` hashes.** It writes
  `scripts/grooves/samples/pack.json` never, `catalogue.json` never,
  `src/features/daily-groove/data/*.generated.ts` never, `public/grooves/` and
  `public/notes/` never, `grooves.lock.json` never. Every file this epic owns is
  listed in the Architecture table, and not one of them is a lock input — which
  is exactly what makes the inherited green survive the epic untouched.
- If `grooves:verify` fails anyway, the cause is a file this epic was not
  supposed to write. Find it and revert it; do not rewrite the lock, which would
  sign audio nobody rendered.
- Coverage: every R and AC below has at least one step.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2 |
| R2 | A2 |
| R3 | A1, A3 |
| R4 | I2, I3 |
| R5 | A4 |
| R6 | A4 |
| R7 | A5, A6, A7 |
| R7b | A5, A6 |
| R8 | A6 |
| R9 | A6, A8 |
| R10 | B1, B2, B3 |
| R11 | A2 |
| R11b | A9, I1 |
| R11c | A9 |
| R11d | A9 |
| R12 | C1, C2, C3 |
| R13 | C4 |
| R14 | C5 |
| AC1 | A2 |
| AC2 | A2 |
| AC3 | A1, A3 |
| AC4 | A4 |
| AC5 | A6 |
| AC6 | A7 |
| AC7 | A8 |
| AC8 | A6 |
| AC9 | B2, B3 |
| AC10 | A2 |
| AC11 | C1, C2, C4, C5 |
| AC12 | A9, I1 |
| AC13 | I2 |

## Assumptions

- **AC6 is tested by rotating the ride pool rather than by changing
  `RIDE_LABEL`.** The label is a frozen module constant with no injection point;
  rotating the pool produces a different ride figure from the same stream, which
  is the same evidence that the feather is not drawn — and it mirrors how Epic
  1's AC8 must already be tested.
- **`RIDE_PATTERNS` is keyed `Record<8 | 16, number[][]>`.** Epic 1 froze "the
  pool's shape" without this spec being able to read it. If Epic 1 shipped a flat
  array, Step A1 keys it and moves the committed figures under `8` unchanged;
  that is the one contract deviation this epic can absorb without re-planning.
- **Epic 1 did not commit an events-level regression fixture.** It is not in the
  handover list. If it did, Track B adopts and widens it instead of adding a
  second one, and Steps B1–B2 collapse into extending its coverage to the four
  feels.
- **`FEATHER_VELOCITY` is one constant, not per feel.** Both riding feels want a
  kick that is felt and not heard, and the bound that matters — staying inside
  the kick pack's softest layer, `v + humanize.velocity <= 0.3465` — holds for
  both at the shipped `0.21`. If the
  listening pass wants them different, it becomes
  `Partial<Record<string, number>>` keyed by template id — a small change, and a
  later one.
- **The feather plays in the fill and variation bars too.** R7 says "every bar",
  and the fill phrases of both riding feels put a kick on step `0`, so the
  quarter floor is complete in every bar of the loop. A drummer's foot does not
  stop for a fill, which is the same reasoning Epic 1 applied to the hat.
- **`ride` takes `hatOpen`'s position in the `voices` array.** Position only
  affects the tie-break in the final event sort, and only for the two feels that
  are being re-rendered anyway.
- **The docs assertions read the riding count from `allTemplates()`.** That makes
  `docs.test.ts` import from `templates/index.ts`, which is a sibling in the same
  folder and inside the generator's own boundary. It is what turns AC11 from a
  string check into a check that the document and the code agree.
- **`scripts/grooves/riding.test.ts` is a new file rather than more cases in
  `events.test.ts`.** `events.test.ts` is 1978 lines and Epic 1 edits it; a
  topic-named sibling keeps the two epics off the same file and follows the
  pattern `catalogue-gate.test.ts` and `docs.test.ts` already set.
