# Tech spec — Epic 1: A real kit, on one feel

PRD: [../prd/epic-1-a-real-kit-on-one-feel.md](../prd/epic-1-a-real-kit-on-one-feel.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four tracks, split so that the slow, judgement-heavy work — sourcing files and
setting levels by ear — does not block the code that can be written and tested
against synthetic input. `VoiceName` grows to ten first, because every other
track types against it. A new pure module, `scripts/grooves/level.ts`, measures
a rendered buffer's RMS in dBFS; it is testable on hand-built PCM with no
samples on disk at all, so it lands in wave 1 and Epic 2's gate check inherits
it. The audio preparation and the `pack.json` declaration meet at the filename
scheme, which is frozen as a contract up front. `straight-funk.ts` is rewritten
last, because a gain is a number you can only pick once you can hear the sample
it applies to.

The pack's own `startFromSilence` already names this epic's work: its doc
comment records that three committed samples start as high as 0.008, "all of
them the cajon standing in for a kick", and that trimming them properly "belongs
to whoever restocks the pack". That is this epic. The ramp stays as a
belt-and-braces guarantee for whatever arrives next.

## Step 0 — the generator suite needs a longer timeout

`vitest.config.ts` sets no `testTimeout`, so the generator project runs at
vitest's 5 000 ms default. Three render tests already fail under full-suite load
at 5 005–5 045 ms while passing in isolation, and this feature adds many more
render-based assertions. Raise it before writing any of them, or every new test
in this spec is a coin flip.

```ts
// vitest.config.ts — the generator project
test: {
  name: 'generator',
  environment: 'node',
  globals: true,
  include: ['scripts/**/*.{test,spec}.ts'],
  testTimeout: 30_000,
},
```

- **Green when** — `npm test` passes with no timeouts, including
  `scripts/grooves/cli.test.ts` and both `open-ballad` and `swung-sixteenth`
  cases in `scripts/grooves/events.test.ts`.

## Architecture

The kit stays inside VCSL. Three voice families are added — a bass drum
replacing the cajon, a bow-struck ride, and a high and low bongo — and two
existing voices, `hatOpen` and `rim`, gain a second velocity layer each so the
whole pack clears the declared floor. Nothing else about the pipeline changes:
`loadPack` still decodes FLAC into `Pcm`, `renderVoices` still picks a layer by
velocity and an alternate by round-robin, and `mixTracks` still applies the
template's `gain` and `pan`.

Levelling is split the way the PRD's behaviour section splits it. The **pack**
half is fixed by declaring each layer's `nominalVelocity` where its measured
level does not sit at its band midpoint, so `gainFor` scales from the truth. The
**mix** half is the template's `gain` in dBFS. `level.ts` serves both: it is how
"measured, and reproducible" stops being an aspiration.

```
samples/*.flac ──> loadPack ──> renderVoices ──> mixTracks ──> gateCandidate
   (Track A)      (unchanged)    gainFor uses      template       unchanged
                                 nominalVelocity   gain/pan
                                   (Track C)       (Track D)
```

## Contracts

Frozen before wave 1. Every track builds against these.

### The ten voices

```ts
// scripts/grooves/types.ts
export type VoiceName =
  | 'kick'
  | 'snare'
  | 'hatClosed'
  | 'hatOpen'
  | 'rim'
  | 'tomHigh'
  | 'tomLow'
  | 'ride'
  | 'bongoHigh'
  | 'bongoLow'
  | 'bass'
  | 'comp'
```

Ten percussive plus the two pitched voices, which are untouched. This union is
frozen for the whole feature — Epics 2 and 3 type against it.

### The filename scheme

New files land under `scripts/grooves/samples/<voice>/`, keeping VCSL's own
basename so `provenance.json` can point back at the source unambiguously:

```
kick/BassDrum_<dyn>_rr<N>.flac
ride/Ride_HitBow_<dyn>_rr<N>.flac
bongoHigh/Bongo_Hi_<dyn>_rr<N>.flac
bongoLow/Bongo_Lo_<dyn>_rr<N>.flac
hatOpen/HiHat_HitO_<dyn>_rr<N>.flac    (second layer added)
rim/Snare2_stick_<dyn>_rr<N>.flac      (second layer added)
```

Track B declares these paths in `pack.json` before Track A has finished
producing them; `samples/pack.test.ts` already asserts that every declared file
exists, so the two meet at a failing test that turns green when the files land.

### The loudness measure

```ts
// scripts/grooves/level.ts
/** RMS of a buffer, in dBFS. Silence returns -Infinity. */
export function rmsDbfs(pcm: Pcm): number

/** Peak-normalised level of one voice's track, for levelling by measurement. */
export function voiceLevels(tracks: Track[]): Map<VoiceName, number>
```

Pure, synchronous, importing only `types.ts`. Epic 2's gate check imports
`rmsDbfs` unchanged.

### The prepared-file invariants

Every added file: 44 100 Hz, one channel, FLAC, length at or under its voice's
documented cap, first frame below `1e-4`, and peaks that differ across a voice's
velocity layers.

## Tracks

### Track A — the samples exist

- **Goal** — every new file prepared, in place, and recorded in
  `provenance.json`.
- **Owns** — `scripts/grooves/samples/{kick,ride,bongoHigh,bongoLow}/*.flac`,
  the added files under `samples/{hatOpen,rim}/`, `samples/provenance.json`, and
  the deletion of `samples/kick/Cajon_*.flac`.
- **Depends on** — the filename scheme only.
- **Parallel with** — Tracks B, C, D.
- **Done when** — `samples/pack.test.ts`'s file-existence and provenance
  assertions pass, and the prepared-file invariants hold for every added file.

### Track B — the pack declares ten voices

- **Goal** — `pack.json` describes the new kit, and the structural test enforces
  the PRD's floors.
- **Owns** — `scripts/grooves/samples/pack.json`,
  `scripts/grooves/samples/pack.test.ts`.
- **Depends on** — the `VoiceName` union and the filename scheme.
- **Parallel with** — Tracks A, C, D. Its tests go red until Track A lands the
  files, which is the intended meeting point.
- **Done when** — every new assertion in `pack.test.ts` passes.

### Track C — levels are measured, not guessed

- **Goal** — `level.ts` exists and is tested; every layer's `nominalVelocity` is
  declared where measurement says it must be; the method is written down.
- **Owns** — `scripts/grooves/level.ts`, `scripts/grooves/level.test.ts`, the
  levelling section of `scripts/grooves/samples/README.md`.
- **Depends on** — `Pcm` and `Track` from `types.ts`. Nothing else; its tests
  build PCM by hand.
- **Parallel with** — Tracks A, B, D.
- **Done when** — `level.test.ts` passes on synthetic buffers.

### Track D — `straight-funk` plays the new kit

- **Goal** — the type union is ten wide, and `straight-funk` renders on the new
  pack through the gate.
- **Owns** — `scripts/grooves/types.ts`,
  `scripts/grooves/templates/straight-funk.ts`,
  `scripts/grooves/samples/README.md`'s source and voice-mapping tables.
- **Depends on** — the `VoiceName` contract for step D1; the loadable pack for
  D3 onward.
- **Parallel with** — A, B, C for D1. D3–D5 are wave 3.
- **Done when** — a `straight-funk` render passes `gateCandidate` at every seed
  the catalogue uses for it.

## Execution waves

- **Wave 1 (parallel):** D1 (the type union — everything else types against it),
  Track C, Track B's declaration and tests, Track A's acquisition and prep.
- **Wave 2:** Track A and Track B meet — the declared files exist and
  `pack.test.ts` goes green.
- **Wave 3:** Track C's `nominalVelocity` pass over the real files, then Track
  D's `straight-funk` rewrite, which needs to hear them.
- **Wave 4:** Integration and the listening sign-off.

## Implementation

### Track D (wave 1) — the contract

#### Step D1 — `VoiceName` names ten percussive voices

Covers: R4, R5, AC2

- **Test first** — `scripts/grooves/samples/pack.test.ts`: add a case asserting
  that the set of `VoiceName` values the pack may declare includes `ride`,
  `bongoHigh` and `bongoLow`. Since `VoiceName` is a type, assert it through a
  value: declare `const TEN: VoiceName[] = ['kick','snare','hatClosed','hatOpen','rim','tomHigh','tomLow','ride','bongoHigh','bongoLow']`
  and assert `TEN.length === 10`. Run it: fails to typecheck with
  `Type '"ride"' is not assignable to type 'VoiceName'`.
- **Implement** — `scripts/grooves/types.ts`: add `'ride'`, `'bongoHigh'` and
  `'bongoLow'` to the union, above `'bass'`. Extend the union's doc comment: the
  existing note explains why there are two toms and not three; add why there are
  two bongos and not one — a bongo is two drums, and one voice would be a hand
  drum.
- **Green when** — `npx tsc --noEmit` passes and the new case passes.
- **Refactor** — none.

### Track C (wave 1) — measurement

#### Step C1 — RMS of a buffer, in dBFS

Covers: R10, and Epic 2's R8

- **Test first** — `scripts/grooves/level.test.ts`: build a `Pcm` of 1 000
  frames at constant 0.5 in both channels; assert
  `rmsDbfs(pcm)` is within `0.01` of `-6.02`. Add a silent buffer and assert
  `-Infinity`. Run it: fails with
  `Cannot find module './level.ts'`.
- **Implement** — `scripts/grooves/level.ts`: `rmsDbfs(pcm)` — mean of
  `left[i]² + right[i]²` over `2 × frames`, square root, `20 * Math.log10(rms)`.
  Return `-Infinity` at zero rather than `NaN`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — RMS is reproducible and order-independent

Covers: R10

- **Test first** — `level.test.ts`: assert `rmsDbfs` called twice on the same
  buffer returns exactly equal numbers, and that a buffer and its reverse
  measure equal. Run it: passes if C1 summed in one pass; if it fails, the
  implementation is accumulating in a way that depends on order.
- **Implement** — nothing, if green. If red, sum in a single forward pass with
  one accumulator.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C3 — per-voice levels from a rendered set of tracks

Covers: R10, R10a, R11a

- **Test first** — `level.test.ts`: build two `Track`s, one at 0.5 and one at
  0.25; assert `voiceLevels` returns a map whose two entries differ by about
  6 dB, and that a silent track appears with `-Infinity` rather than being
  omitted — an absent voice and a silent one are different findings.
- **Implement** — `level.ts`: `voiceLevels(tracks)` mapping each `track.voice`
  to `rmsDbfs(track.pcm)`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C4 — the levelling method, written down

Covers: R10a, R16

- **Test first** — `scripts/grooves/docs.test.ts`: assert
  `samples/README.md` contains a `## Levelling` heading, names `level.ts`, and
  states both halves — the phrase `nominalVelocity` and the phrase `template's
  gain`. Run it: fails with the section absent.
- **Implement** — `samples/README.md`: add `## Levelling`. Record the reference
  voice, the measured offsets, the `npx tsx` one-liner that prints
  `voiceLevels`, and the rule that a pack error is fixed in the pack — because
  correcting it in a template's gain becomes five more corrections in the other
  five templates.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track A (wave 1–2) — the samples

#### Step A1 — the cajon leaves and a bass drum arrives

Covers: R0, R4a, R6, R6a, R6b, R6c, AC1a, AC4

- **Test first** — `samples/pack.test.ts`: assert no file under `samples/`
  matches `/Cajon/i`. Run it: fails, listing the six committed cajon files.
- **Implement** — prepare VCSL's bass drum with the pack's documented recipe, at
  three dynamic groups × two alternates, into `samples/kick/`:
  ```sh
  ffmpeg -i in.wav \
    -af "pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=0.92:d=0.08" \
    -t 1 -ar 44100 -sample_fmt s16 out.flac
  ```
  Delete `samples/kick/Cajon_*.flac`. Add a `provenance.json` row per new file
  naming VCSL, the source path, the URL and `CC0`.
- **Green when** — the assertion passes and every prepared file decodes at
  44 100 Hz, one channel.
- **Refactor** — none.

#### Step A2 — the prepared-file invariants are enforced, not trusted

Covers: R6, R6a, R6b, R6c, AC4, AC13

- **Test first** — `samples/pack.test.ts`: for every audio file under
  `samples/`, decode it and assert sample rate 44 100, one channel, length under
  a per-voice cap read from a table in the test, and `Math.abs(first frame) <
  1e-4`. Separately, for each percussive voice, assert the peak levels of its
  layers are not all equal — a normalised set. Run it: the front-of-file
  assertion fails on the three cajon files `pack.ts` already documents at 0.008,
  which A1 deletes.
- **Implement** — nothing new if A1's files are clean; otherwise re-prepare the
  offender. Leave `startFromSilence` in `pack.ts` untouched: it is the guarantee
  for whatever arrives next, and its doc comment is updated to say the cajon it
  named is gone.
- **Green when** — every file passes, `npm test` green.
- **Refactor** — none.

#### Step A3 — a bow-struck ride

Covers: R4c, R6d, AC3a

- **Test first** — `samples/pack.test.ts`: assert every `provenance.json` row
  whose `file` starts `ride/` has a `sourceFile` matching `/bow|tip/i` and none
  matching `/bell|crash/i`. Run it: fails, no ride rows.
- **Implement** — prepare VCSL's ride, bow articulation, at least two dynamic
  groups × two alternates, capped long enough to hold its decay —
  longer than the hats, and documented in the README's cap table.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A4 — two bongos

Covers: R4b, R6, AC1a

- **Test first** — `samples/pack.test.ts`: assert files exist under both
  `samples/bongoHigh/` and `samples/bongoLow/`, and that the two directories'
  provenance rows name different source instruments — a low bongo that is the
  high one pitched down is not a second drum.
- **Implement** — prepare VCSL's bongos into the two directories, at least two
  layers × two alternates each.
- **Green when** — the assertions pass.
- **Refactor** — none.

#### Step A5 — `hatOpen` and `rim` reach the layer floor

Covers: R7c, R7d

- **Test first** — `samples/pack.test.ts`: assert every percussive voice has at
  least two files across all its layers *and* at least two layers, except where
  a `KNOWN_SINGLE_LAYER` allowlist in the test names it. Run it: fails for
  `hatOpen` and `rim`, which declare one layer each.
- **Implement** — prepare a second dynamic group for each from VCSL's own groups
  for those instruments. Where VCSL holds only one, add the voice to the
  allowlist *and* to a named-limitation list in `samples/README.md` — the test
  asserts the two agree, so an allowlist entry cannot be added silently.
- **Green when** — the assertion passes with an empty or documented allowlist.
- **Refactor** — none.

### Track B (wave 1–2) — the declaration

#### Step B1 — the ten voices are declared with ordered, gapless bands

Covers: R4, R7, AC2, AC5

- **Test first** — `samples/pack.test.ts`: for each percussive voice, assert
  `maxVelocity` ascends strictly, the last is exactly `1.0`, and no band starts
  above the previous one's end. Assert the layer count is ≥ 3 for `kick` and
  `snare` and ≥ 2 for every other percussive voice. Assert the declared voice
  keys are exactly the ten. Run it: fails on the voice-key set and on
  `hatOpen`/`rim`'s layer counts.
- **Implement** — `samples/pack.json`: add `ride`, `bongoHigh`, `bongoLow`;
  rewrite `kick`'s layers onto the bass-drum files; add the second layer to
  `hatOpen` and `rim`.
- **Green when** — all four assertions pass once Track A's files exist.
- **Refactor** — none.

#### Step B2 — every declared file exists and every present file is declared

Covers: R2, AC1

- **Test first** — already present in `samples/pack.test.ts` as
  `audioFiles()`/`declaredFiles()`. Extend it to assert set equality in both
  directions, and that every audio file has a `provenance.json` row naming a CC0
  licence. Run it: fails while B1's declarations point at files A1–A5 have not
  produced.
- **Implement** — nothing; this is the meeting point. It goes green when Track A
  lands.
- **Green when** — the two sets are equal and every row is CC0.
- **Refactor** — none.

#### Step B3 — both licence texts stay committed

Covers: R0b, R2a, AC1

- **Test first** — `samples/pack.test.ts`: collect the distinct `source` values
  in `provenance.json`; assert VCSL and VSCO 2 CE are both present and that
  `LICENSE.txt` and `LICENSE-VSCO-2-CE.txt` both exist. Run it: passes already —
  which is the point. It is a guard against a later change removing a licence
  whose library is still in use.
- **Implement** — nothing.
- **Green when** — green, and stays green.
- **Refactor** — none.

#### Step B4 — the existing snare, hat, rim and tom files are untouched

Covers: R0c, AC1b

- **Test first** — `samples/pack.test.ts`: assert a committed list of the
  pre-epic basenames under `snare/`, `hatClosed/`, `tomHigh/`, `tomLow/` is
  still present. Run it: passes now; it fails if someone re-encodes them for
  tidiness, which would churn every artifact hash for nothing.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

### Track C (wave 3) — nominals against real files

#### Step C5 — declare `nominalVelocity` where measurement disagrees with the band

Covers: R9, R12, AC7

- **Test first** — `scripts/grooves/voices.test.ts`: render a single event per
  voice at a velocity just either side of each layer boundary; assert the
  applied level does not step by more than a declared tolerance across the
  boundary, and that no event's `gainFor` result reaches `MAX_LAYER_GAIN`. Run
  it: fails at whichever boundaries the new samples' recorded levels do not sit
  at their band midpoints.
- **Implement** — measure each layer with `voiceLevels`, and for every layer
  whose level does not sit at its band midpoint, add `nominalVelocity` to that
  layer in `pack.json`. Record the measured figures in the README's levelling
  section.
- **Green when** — both assertions pass for all ten voices.
- **Refactor** — none.

### Track D (wave 3) — the first feel

#### Step D2 — `straight-funk` lists the kit it plays

Covers: R4d, R13, AC3

- **Test first** — `scripts/grooves/templates/index.test.ts`: assert
  `straightFunk.voices` contains all ten percussive voices' worth of entries it
  intends, that `gain` and `pan` have a key for every listed voice and no
  others, and that a rendered `straight-funk` groove contains no `ride`,
  `bongoHigh` or `bongoLow` events. Run it: fails on the gain/pan/voices
  agreement once the voices list changes.
- **Implement** — `templates/straight-funk.ts`: leave `ride` and the bongos out
  of `voices` — Epic 2 decides per feel and this feel is not a ride feel —
  keeping the seven-voice drum set plus `bass` and `comp`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step D3 — `straight-funk`'s levels are re-derived

Covers: R11, R11a, R13, R13a, AC8, AC9, AC10

- **Test first** — `scripts/grooves/events.test.ts`: for every seed the
  catalogue uses for `straight-funk`, render and assert `gateCandidate` returns
  `null`; and assert every voice in `template.voices` has a non-silent track
  before mixing, via `voiceLevels(tracks)` being above a floor. Run it: fails on
  peak or on a silent voice with the cajon-era gains against bass-drum samples.
- **Implement** — `templates/straight-funk.ts`: re-derive `gain` per voice from
  Track C's measurements, re-derive `pan`, and revisit `humanize.lean` — a
  beater does not place its attack where a hand did. Add `ride` and bongo
  entries to `gain` and `pan` only if D2 listed them, which it does not.
- **Green when** — every seed gates clean and no listed voice is silent.
- **Refactor** — rewrite the template's doc comment: the paragraph describing
  the swing and humanize tuning knobs stands, the mix commentary is now about a
  kit rather than a cajon.

#### Step D4 — the identity fields did not move

Covers: R14, R15, AC10, AC11

- **Test first** — `templates/index.test.ts`: assert `straightFunk`'s
  `flavours`, `tempoRange`, `subdivision`, `swing`, `passes` and `density`
  against literal expected values copied from the pre-epic file; and re-assert
  the existing invariant that the six templates' flavour pairs are disjoint and
  their union is the twelve flavours. Run it: passes, and fails if D3 touched
  something it should not have.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step D5 — the README describes the pack as it is

Covers: R16, R17, AC12

- **Test first** — `scripts/grooves/docs.test.ts`: assert
  `samples/README.md`'s voice-mapping table has a row for each of the ten
  percussive voices; parse the layer × round-robin counts out of the table and
  assert they equal the counts computed from `pack.json`. Assert the
  measured-pitch warning section is still present. Run it: fails on the missing
  rows and stale counts.
- **Implement** — `samples/README.md`: rewrite the source table (VCSL now covers
  ten voices) and the voice-mapping table. Leave the ⚠ measured-pitch section
  untouched — it governs the pitched voices, which this epic does not change.
- **Green when** — every assertion passes.
- **Refactor** — none.

## Integration and verification

- **Step I1 — the whole pack loads.** `scripts/grooves/pack.test.ts`: assert
  `loadPack` resolves and `pack.get(voice, { velocity: 1, index: 0 })` returns a
  non-null sample for all ten percussive voices. Fails while any declared file
  is missing.
- **Step I2 — the other five feels still render.** They have not been rewritten
  yet, so their cajon-era gains now apply to a bass drum. Assert each still
  passes `gateCandidate` — if one does not, that is a finding handed to Epic 2,
  not a fix made here. Record it in the report either way.
- **Step I3 — the demo path.** `npm run grooves -- groove-01`, then play the
  written MP3. A bass drum, not a cajon; no voice jumping out; no ride and no
  bongo audible.
- **Step I4 — full suite.** `npm test`, `npx tsc --noEmit`, `npm run lint`.
  `npm run grooves:verify` is expected to fail on lock staleness until Epic 5 —
  state that explicitly rather than letting it look like a regression.
- **Listening sign-off.** The criterion no test replaces: does this sound like a
  kit in a room. R11a and AC9 only prove no voice is silent.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R0, R0a | A1, B3 |
| R0b | B3 |
| R0c | B4 |
| R1, R1a, R3 | A1, B2 (licence assertions) |
| R2, R2a | A1, B2, B3 |
| R4 | D1, B1 |
| R4a | A1 |
| R4b | A4 |
| R4c | A3 |
| R4d | D2 |
| R5 | D1 |
| R6, R6a, R6c | A1, A2 |
| R6b | A2 |
| R6d | A3 |
| R7 | B1 |
| R7a, R7b | B1 |
| R7c, R7d | A5, B1 |
| R8, R8a | A5, B1 |
| R9 | C5 |
| R10 | C1, C2, C3 |
| R10a | C4, C5 |
| R11 | D3 |
| R11a | D3, I2 |
| R12 | C5 |
| R13, R13a | D3 |
| R14 | D4 |
| R15 | D4 |
| R16 | D5, C4 |
| R17 | D5 |
| AC1 | B2, B3 |
| AC1a | A1, A3, A4 |
| AC1b | B4 |
| AC2 | D1, B1 |
| AC3 | D2 |
| AC3a | A3 |
| AC4 | A1, A2 |
| AC5 | B1 |
| AC6 | A5, B1 |
| AC7 | C5 |
| AC8 | D3 |
| AC9 | D3 |
| AC10 | D3, D4 |
| AC11 | D4 |
| AC12 | D5 |
| AC13 | A2 |

## Assumptions

- `level.ts` lives at `scripts/grooves/level.ts`, a sibling of `mix.ts`, rather
  than inside it. `mix.ts` is imported by the renderer; `level.ts` is imported by
  the gate and by tests, and Epic 2 needs it from the gate, which must stay
  cheap.
- The per-voice length caps live in a table in `samples/pack.test.ts` and are
  documented in the README, so the cap is enforced rather than merely described.
- `provenance.json` keeps its current row shape. Nothing in this epic needs a
  new field.
- The `pack.json` `sampleRate` stays 44 100 and the pack `id` stays
  `vcsl-funk`.
- Preparing the samples is a manual `ffmpeg` pass, as it has been for every
  voice in the pack. Scripting it would be a tool nobody runs twice.

## Decision log

### Cycle 1 — 2026-09-01

No architectural questions were open at drafting: the PRD settled the library,
the licence bar, the voice set, the layer floors and the ride's articulation
across two brainstorm cycles. The decisions this spec makes on its own — where
`level.ts` lives, where the cap table lives, manual `ffmpeg` — are recorded as
assumptions above, being cheap to reverse.
