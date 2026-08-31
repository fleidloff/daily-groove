# Tech spec — Epic 2: Real instruments

PRD: [../prd/epic-2-real-instruments.md](../prd/epic-2-real-instruments.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This epic is mostly asset work, so the TDD order is inverted from the usual: the
assertions are written first against a pack that does not yet contain the
samples, and sourcing the samples is what turns them green. That is the only way
to make "the pack is stocked correctly" a test rather than an inspection.

Three tracks. One prepares and declares the samples. One grows `pack.test.ts`
into a stocking contract that a wrong pack fails — register coverage, layer
spacing, un-normalised levels, sounding pitch. One re-tunes `pan` and rebases
`gain`, and it runs after Epic 3 has landed its corrected scaling.

No code in `pack.ts`, `voices.ts` or `mix.ts` changes. The pack's *data* is
replaced; its interface is Epic 3's business.

## Architecture

The pack declaration keeps its exact shape. What changes is what it names:

```
samples/
├── LICENSE.txt          VCSL, CC0 — the only licence file
├── README.md            voice-mapping table, note spacing, pitch procedure
├── provenance.json      one entry per file: { file, source }
├── pack.json            layers, round-robins, sounding midi
├── kick/  snare/  hatClosed/  hatOpen/  rim/     ← one kit where VCSL has one
├── bass/                                          ← electric bass, 22–50
└── comp/                                          ← electric piano, 46–86
```

**Kit coherence, and the fallback.** All five drum voices come from one VCSL kit
where the library holds one recorded together. Where it does not, the best
instrument per voice is taken and coherence comes from Epic 4's single shared
room instead. The choice is recorded in `provenance.json` and in the README, and
the coherence listening pass then waits until Epic 4's send is in the path.

**Pitched coverage is a hard geometric constraint.** `resample()` is a linear
interpolator, transparent only within about two semitones, so every note in a
voice's register must be within two semitones of a sampled note — a sample every
four semitones. `bass` covers sounding MIDI 22–50 (eight sampled notes),
`comp` 46–86 (eleven). A candidate instrument that VCSL samples more sparsely
than that is the wrong candidate.

**Sounding pitch is measured, not read.** VCSL's Clavisynth is labelled two
octaves below where it sounds. The replacement may have its own such trap, and
getting it wrong makes the game unplayable rather than merely wrong-sounding, so
the declared `midi` is established by measurement and the measurement is
recorded.

## Contracts

Nothing in TypeScript changes. The contracts here are the pack's data shape,
already frozen in `types.ts`, plus two provenance conventions this epic adds:

```jsonc
// scripts/grooves/samples/provenance.json — one entry per file, as today
{ "file": "kick/<name>.flac", "source": "<original VCSL path>" }
```

```jsonc
// scripts/grooves/samples/pack.json — unchanged shape; `midi` is the SOUNDING pitch
{ "notes": [{ "midi": 24, "layers": [{ "maxVelocity": 0.45, "files": [...] }] }] }
```

Register and spacing, asserted by `pack.test.ts`:

- `bass` — sounding MIDI 22–50, gap between sampled notes ≤ 4 semitones
- `comp` — sounding MIDI 46–86, gap ≤ 4 semitones
- every percussive voice — ≥ 2 velocity layers, ≥ 2 alternates per layer

## Tracks

### Track A — The stocking contract

- **Goal** — `pack.test.ts` fails against today's pack for every property the
  new pack must have, so Track B has a target rather than a description.
- **Owns** — `scripts/grooves/pack.test.ts`.
- **Depends on** — nothing.
- **Parallel with** — B (they meet when B turns A green).
- **Done when** — every new assertion is written and failing for the right
  reason.

### Track B — The samples

- **Goal** — the pack contains the new instruments and Track A's assertions pass.
- **Owns** — `scripts/grooves/samples/**` (files, `pack.json`,
  `provenance.json`, `README.md`, `LICENSE.txt`).
- **Depends on** — Track A's assertions as the definition of done.
- **Parallel with** — A.
- **Done when** — `npx vitest run --project generator` is green and a render
  produces audio.

### Track C — Levels and image

- **Goal** — every template's `pan` suits the new sources and its `gain` is
  rebased onto Epic 3's corrected scaling.
- **Owns** — `scripts/grooves/templates/*.ts` (`gain` and `pan` fields only).
- **Depends on** — Track B (the samples must exist to be balanced) **and Epic 3
  merged** (its `gain` values are the baseline).
- **Parallel with** — nothing.
- **Done when** — the catalogue renders, passes the gate, and sounds balanced.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C — needs the samples in place and Epic 3's levels merged.
- **Wave 3:** Integration — re-render, verify, listen.

## Implementation

### Track A — The stocking contract

#### Step A1 — Every declared file exists and is mono 44.1 kHz FLAC

Covers: R12, AC7

- **Test first** — `scripts/grooves/pack.test.ts`: walk every file named in
  `pack.json`, assert it exists on disk, and assert the decoded PCM's
  `sampleRate` is 44100 and that its left and right channels are identical
  (mono). Run it against today's pack: passes — this is the assertion that must
  keep passing, so write it first and leave it.
- **Implement** — nothing.
- **Green when** — it passes now and still passes after Track B.
- **Refactor** — none.

#### Step A2 — The pitched voices cover their register at four-semitone spacing

Covers: R6, R7, AC2

- **Test first** — `scripts/grooves/pack.test.ts`: for `bass` assert the sampled
  `midi` values span 22–50 with no adjacent gap greater than 4; same for `comp`
  over 46–86. Run it against today's pack: passes for the current 7 and 10 notes
  — keep it as the constraint Track B must not break.
- **Implement** — nothing.
- **Green when** — it passes before and after the swap.
- **Refactor** — none.

#### Step A3 — Velocity layers are not normalised

Covers: R9, AC4

- **Test first** — `scripts/grooves/pack.test.ts`: for every percussive voice
  with more than one layer, decode the first file of each layer and assert the
  peak amplitudes are strictly increasing across layers, with at least 1 dB
  between neighbours. Run it against today's pack: passes, and it is the
  assertion that catches a normalised replacement.
- **Implement** — nothing.
- **Green when** — passes before and after.
- **Refactor** — none.

#### Step A4 — Every percussive voice is layered and round-robined

Covers: R10, AC5

- **Test first** — `scripts/grooves/pack.test.ts`: assert every percussive voice
  declares ≥ 2 layers and every layer ≥ 2 files. Run it against today's pack:
  fails for `hatOpen`, which declares one layer of four alternates.
- **Implement** — `pack.json`: nothing yet; this is Track B's to satisfy. Mark
  the step as the first genuinely red one.
- **Green when** — Track B's new hat declaration supplies a second layer.
- **Refactor** — none.

#### Step A5 — Provenance is complete and single-licensed

Covers: R11, R5b, AC6, AC1b

- **Test first** — `scripts/grooves/pack.test.ts`: assert every file under
  `samples/` (excluding `*.json`, `*.md`, `LICENSE.txt`) has a
  `provenance.json` entry; assert `samples/` contains exactly one licence file;
  and assert every provenance `source` is a VCSL path. Run it: passes today, and
  it is what keeps Track B inside the library.
- **Implement** — nothing.
- **Green when** — passes before and after.
- **Refactor** — none.

#### Step A6 — The declared pitch is the sounding pitch

Covers: R8, AC3

- **Test first** — `scripts/grooves/pack.test.ts`: for one sampled note per
  octave of each pitched voice, decode it, estimate the fundamental, and assert
  it is within a semitone of the declared `midi`. Run it against today's pack:
  passes (the Clavisynth entries already carry the corrected +24 values), so it
  is the guard against the replacement's own labelling trap.
- **Implement** — a `fundamentalHz(pcm)` helper local to the test — autocorrelation
  over a windowed slice is sufficient at this tolerance and needs no dependency.
- **Green when** — passes for every probed note.
- **Refactor** — none.

### Track B — The samples

#### Step B1 — The drum kit

Covers: R1, R2, R5, R5b, AC1, AC1a

- **Test first** — Track A's Steps A1, A3, A4 and A5 are the test. A4 is red.
- **Implement** — audition VCSL for a kit whose kick, snare, hi-hats and
  cross-stick were recorded together. Prepare each voice — trim, fade, downmix,
  encode 44.1 kHz FLAC — and declare it in `pack.json` with layers and
  alternates, `hatOpen` included. Record every file in `provenance.json`. If no
  single kit exists, take the best per voice, note the choice in
  `samples/README.md`, and defer the coherence sign-off to Epic 4.
- **Green when** — A1, A3, A4 and A5 all pass.
- **Refactor** — none.

#### Step B2 — The electric bass

Covers: R3, R6, R7, R8, R9, AC1, AC2, AC3

- **Test first** — A2, A3 and A6 are the test; A2 goes red the moment the old
  `bass` entries are removed and before the new ones cover the register.
- **Implement** — prepare an electric bass sampled every four semitones across
  sounding MIDI 22–50, layered and round-robined, and declare it with measured
  sounding `midi` values.
- **Green when** — A2, A3 and A6 pass for `bass`.
- **Refactor** — none.

#### Step B3 — The electric piano

Covers: R4, R6, R7, R8, AC1, AC2, AC3

- **Test first** — as B2, for `comp` over sounding MIDI 46–86.
- **Implement** — prepare and declare the electric piano. Delete the Clavisynth
  files and the `+24` compensation with them; the new declaration states measured
  sounding pitches directly.
- **Green when** — A2, A3 and A6 pass for `comp`.
- **Refactor** — none.

#### Step B4 — The README describes the pack that ships

Covers: R16, R17, AC10, AC11

- **Test first** — `scripts/grooves/pack.test.ts`: assert every voice named in
  `pack.json` appears in `samples/README.md`'s voice-mapping table, and that the
  README no longer names Cajon, Woodblock, FM Piano or Clavisynth. Run it: fails
  with `expected README to not contain 'Clavisynth'`.
- **Implement** — `samples/README.md`: rewrite the voice-mapping table; replace
  the Clavisynth warning with the general procedure — establish a sample's
  sounding pitch by measurement, never from its filename, and record it; keep
  the note-spacing section with the new registers.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track C — Levels and image

#### Step C1 — The image is set for the new kit

Covers: R13, AC8

- **Test first** — no unit test. Pan is a look, checked by ear and by the gate's
  peak check, in line with `docs/testing.md`'s rule that a layout is asserted
  where it is a behaviour and checked by eye where it is a look.
- **Implement** — `scripts/grooves/templates/*.ts`: set `pan` per voice for the
  new sources, keeping the existing intent — kick, snare and bass centred, hats
  and comp opening the image, and the shuffle mirroring the funk so two grooves
  in a row do not sound like one room.
- **Green when** — the catalogue renders and the gate passes.
- **Refactor** — none.

#### Step C2 — The levels are rebased

Covers: R13, R15, AC8

- **Test first** — `scripts/grooves/gate.test.ts` needs no new case; the peak,
  silence and seam checks are the guard. Assert instead in
  `scripts/grooves/cli.test.ts` that a rendered master's true peak sits on
  `PEAK_CEILING` for every catalogue entry.
- **Implement** — `scripts/grooves/templates/*.ts`: starting from Epic 3's
  `gain` values, adjust each voice for the new samples. A bass drum at −3 dB is
  not a cajon at −3 dB.
- **Green when** — every groove passes the gate and no voice is inaudible or
  dominant by ear.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Re-render and lock

Covers: R14, R15, AC8, AC9

- Run `npm run grooves`. `git diff` on
  `src/features/daily-groove/data/grooves.generated.ts` must show only
  `headDelaySeconds` changing; Epic 1's answer-pinning test must stay green.
- Run it twice; `git status` clean. Then `npm run grooves:verify` and `npm test`.

#### Step I2 — The demo path

Covers: R1–R5, R13

- Play the same seeds before and after, back to back. The answer and tempo are
  identical; the band is different. If Track B took the per-voice fallback, take
  this listening pass again once Epic 4's room is merged, and sign the two off
  together.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1, R2 | B1 |
| R3 | B2 |
| R4 | B3 |
| R5, R5b | B1, I2 |
| R6, R7 | A2, B2, B3 |
| R8 | A6, B2, B3 |
| R9 | A3, B1–B3 |
| R10 | A4, B1 |
| R11 | A5, B1–B3 |
| R12 | A1, B1–B3 |
| R13 | C1, C2 |
| R14 | I1 |
| R15 | C2, I1 |
| R16 | B4 |
| R17 | B4 |
| AC1, AC1a, AC1b | A5, B1–B3 |
| AC2 | A2 |
| AC3 | A6 |
| AC4 | A3 |
| AC5 | A4 |
| AC6 | A5 |
| AC7 | A1 |
| AC8 | C1, C2, I1 |
| AC9 | I1 |
| AC10, AC11 | B4 |
| AC12 | I2 |

## Assumptions

- Old sample files are deleted in the same commit that adds their replacements,
  so `provenance.json` and the tree never disagree. Git history holds them.
- `pack.ts` is not touched. Epic 3 changes its return shape; this epic changes
  only what it reads.
- Sample preparation is done with the same ffmpeg invocations the existing pack
  was built with, so the new files are consistent with the old pipeline.
- Three velocity layers per drum voice is the target, two the floor. More
  alternates are taken only where the machine-gun effect is audible.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/writespec feature-9 epic-2` — the answer gets applied to the
design and steps, moved into the log, and replaced by whatever it opens up.

### Q1. How is "the declared pitch is the sounding pitch" verified?

Step A6 decodes FLACs and estimates a fundamental inside `npm test`. Decoding
goes through ffmpeg, which the render needs but the test suite has so far never
required — `scripts/grooves/boundary.test.ts` exists precisely to keep the
verify path free of it. Reversing this later means either ripping a test out of
CI or discovering that CI cannot run the suite at all.

- [ ] A) Measure at prepare time and commit the result; the test asserts the
      recorded measurement matches `pack.json` *(recommended — it keeps `npm
      test` free of ffmpeg, which is the property `boundary.test.ts` and the
      `grooves:verify` design already protect, and it still fails loudly when
      someone edits a `midi` value by hand)*
- [ ] B) Decode and measure inside the test, accepting that the generator
      project now needs ffmpeg on the machine running it
- [ ] C) Decode and measure, but skip the test when ffmpeg is absent — full
      coverage locally, silently reduced coverage in CI
- [ ] D) Verify by ear during preparation and assert nothing — the Clavisynth
      trap was caught by a person, not a test
