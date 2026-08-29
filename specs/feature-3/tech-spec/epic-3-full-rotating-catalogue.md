# Tech spec — Epic 3: A full rotating catalogue whose answers come from the audio

PRD: [../prd/epic-3-full-rotating-catalogue.md](../prd/epic-3-full-rotating-catalogue.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four things happen here, and only one of them is new code. Three more feel templates
join Epic 1's, each declaring the two flavours that suit it. A validity rule table makes
"the chord belongs to the scale" mean something different per flavour, so blues passes
and a wrong modal chord still fails. A seed-selection pass fills `catalogue.json` with
sixteen entries — four per template — chosen so every flavour lands twice. And the
hand-written `seed.ts` is deleted, with its distractor pools regenerated from the
catalogue.

Everything runs through the renderer Epic 2 finished, so nothing minted here needs
re-rendering afterwards.

## Architecture

- **A template declares its two flavours.** `FeelTemplate.flavours` was frozen in Epic 1
  as `Flavour[]`; this epic gives every template exactly two, and a test asserts the four
  pairs are disjoint and cover all eight. That single assertion is what makes the game's
  chip row honest.
- **Validity is a table, not a rule.** `theory/validity.ts` maps each flavour to a
  predicate over `(scaleIntervals, chordIntervals, degree)`. The modal flavours share
  one strict predicate; blues and harmonic minor get their own. Adding a flavour later
  means adding a row, not loosening a global check.
- **Seed selection is a search, not a hand-pick.** `selectSeeds` walks seeds in order for
  a template, builds the events, and keeps a seed when its groove satisfies the
  constraints the catalogue still needs — an uncovered flavour, an unused scale-and-
  progression pair. Sixteen entries fall out deterministically, and Epic 4's minting is
  the same search continued from a higher seed.
- **Pools are derived, not written.** The generator emits the three distractor pools
  from the catalogue's own values plus a fixed distractor vocabulary, so the pools can
  never drift from the answers.
- **`root` and `flavour` are the answer; `scale` is a display string.** The generator
  emits all three, but nothing ever parses `scale` back into its parts. A parsed string
  is a second source of truth waiting to disagree with the first, and it breaks on the
  two-word flavours (`harmonic minor`) that this epic introduces. feature-2 scores
  against the fields.
- **Feel and flavour are correlated on purpose.** Each template carries the two flavours
  that suit it, so a shuffle sounds bluesy. A player who learns to hear that has learned
  the thing the game teaches.

## Contracts

No changes to Epic 1's frozen types. Three additions, all inside the generator:

```ts
// scripts/grooves/theory/validity.ts
export type ValidityRule = (args: {
  scalePitchClasses: number[]
  chordPitchClasses: number[]
  degree: number            // 0-based scale degree the chord is built on
}) => boolean

export const VALIDITY: Record<Flavour, ValidityRule>
export function isValidHarmony(music: MusicMeta, harmony: Harmony): boolean

// scripts/grooves/select.ts
export function selectSeeds(
  templates: FeelTemplate[],
  opts: { perTemplate: number; startSeed?: number; existing?: GrooveSpec[] },
): GrooveSpec[]
```

```ts
// the manifest module grows a second export
// src/features/daily-groove/lib/grooves.generated.ts
export const GROOVES: Groove[]
export const SCALE_POOL: string[]
export const CHORD_POOL: string[]
export const PROGRESSION_POOL: string[]
```

## Tracks

### Track A — Templates and flavour coverage

- **Goal** — four templates whose flavour pairs are disjoint and cover the eight.
- **Owns** — `scripts/grooves/templates/**`
- **Depends on** — the `FeelTemplate` contract only.
- **Parallel with** — Tracks B, C
- **Done when** — the coverage assertion passes and each template renders a groove.

### Track B — Validity rules

- **Goal** — a rule table that accepts idiomatic harmony and rejects wrong harmony, per
  flavour.
- **Owns** — `scripts/grooves/theory/validity.ts`, and the blues and harmonic-minor
  additions to `theory/harmony.ts`
- **Depends on** — the `MusicMeta` contract and Epic 1's `theory/scales.ts`.
- **Parallel with** — Tracks A, C
- **Done when** — every flavour has a rule, and a deliberately wrong harmony per flavour
  is rejected.

### Track C — Manifest pools and retiring `seed.ts`

- **Goal** — the generated module carries the pools, and the hand-written seed file is
  gone.
- **Owns** — `scripts/grooves/manifest.ts`, `scripts/grooves/pools.ts`,
  `src/features/daily-groove/lib/seed.ts`
- **Depends on** — the `Groove` contract only.
- **Parallel with** — Tracks A, B
- **Done when** — the app builds with no reference to `seed.ts`.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Seed selection and the catalogue — needs A's templates and B's rules.
- **Wave 3:** Render, commit, verify.

## Implementation

### Track A — Templates and flavour coverage

#### Step A1 — Four templates, each with its own feel

Covers: R1, AC1

- **Test first** — `scripts/grooves/templates/index.test.ts`: `allTemplates()` returns
  four; their `subdivision`, `swing` and `tempoRange` values are not all equal; every id
  is unique. Run it: fails, only `straight-funk` exists.
- **Implement** — add `half-time.ts`, `shuffle.ts` and `bright-straight.ts` beside
  Epic 1's `straight-funk.ts`, each with its own subdivision, swing, tempo range, voice
  set, gain and pan maps.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A2 — The four flavour pairs cover the game exactly

Covers: R2, R5, AC15

- **Test first** — same file: each template's `flavours` has exactly two members; the
  four pairs are pairwise disjoint; their union equals the eight `Flavour` values. Run
  it: fails while templates carry the wrong flavour sets.
- **Implement** — assign pairs on musical grounds — shuffle takes `blues` and `minor`,
  bright-straight takes `lydian` and `major`, straight-funk takes `dorian` and
  `mixolydian`, half-time takes `phrygian` and `harmonic-minor`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A3 — Every template renders

Covers: R1

- **Test first** — `scripts/grooves/events.test.ts`: for each of the four templates,
  `buildEvents` returns a non-empty event list whose `music.flavour` is one of that
  template's two, and whose `music.bpm` is inside its `tempoRange`. Run it: fails for
  any template whose voice set or vocabulary the event builder cannot handle.
- **Implement** — extend `events.ts` where a template's subdivision or voice set needs
  a placement rule it lacks.
- **Green when** — all four pass.
- **Refactor** — extract per-subdivision placement into a small lookup if the branching
  grows.

### Track B — Validity rules

#### Step B1 — The modal flavours require strict membership

Covers: R9, AC10

- **Test first** — `scripts/grooves/theory/validity.test.ts`: for `dorian`, a chord
  whose pitch classes are all in the scale passes; one containing a non-scale tone
  fails. Same for `major`, `minor`, `mixolydian`, `lydian`, `phrygian`. Run it: fails,
  module missing.
- **Implement** — `theory/validity.ts`: `strictDiatonic` predicate, wired for the six
  modal flavours.
- **Green when** — both assertions pass for all six.
- **Refactor** — none.

#### Step B2 — Blues permits dominant sevenths on I, IV and V

Covers: R9, AC10, AC13

- **Test first** — same file: for `blues`, a dominant seventh built on degree 0, 3 or 4
  passes even though its major third is outside the blues scale; a dominant seventh on
  degree 1 fails; a chord with a tone outside both the scale and the permitted
  alterations fails. Run it: fails while blues uses the strict predicate.
- **Implement** — a `blues` rule permitting the major third and flat seventh over I, IV
  and V.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step B3 — Harmonic minor admits its raised seventh

Covers: R9, AC10

- **Test first** — same file: for `harmonic-minor`, the V dominant seventh containing
  the raised seventh passes; a natural-minor v7 fails; a chord with an unrelated tone
  fails. Run it: fails while the raised seventh is treated as foreign.
- **Implement** — a `harmonic-minor` rule.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step B4 — Every flavour has a rule, and wrong harmony is rejected

Covers: R9, AC13

- **Test first** — same file: `Object.keys(VALIDITY)` equals the eight `Flavour` values;
  and for each flavour a deliberately constructed wrong harmony returns `false` from
  `isValidHarmony`. Run it: fails if any flavour is missing or any rule is vacuous.
- **Implement** — fill the gaps.
- **Green when** — both assertions pass. The second is what stops a rule that returns
  `true` unconditionally from looking like coverage.
- **Refactor** — none.

#### Step B5 — The harmony builder produces valid harmony for all eight

Covers: R8, R9, AC9

- **Test first** — `scripts/grooves/theory/harmony.test.ts`: for each flavour and each
  of the twelve roots, `buildHarmony` returns harmony that `isValidHarmony` accepts, and
  the chord's pitch classes equal those named by its `chordName`. Run it: fails for
  blues and harmonic minor until the builder knows their idioms.
- **Implement** — extend `harmony.ts` with blues and harmonic-minor progressions.
- **Green when** — all 96 combinations pass.
- **Refactor** — none.

### Track C — Manifest pools and retiring `seed.ts`

#### Step C1 — Pools are derived from the catalogue

Covers: R11, AC14

- **Test first** — `scripts/grooves/pools.test.ts`: `buildPools(entries)` returns three
  arrays; each contains every corresponding value used by `entries`; each has at least
  four distinct members more than the catalogue uses; no duplicates. Run it: fails,
  module missing.
- **Implement** — `pools.ts`: union the catalogue's values with a fixed distractor
  vocabulary, dedupe, sort for stable output.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C2 — The manifest exports the pools

Covers: R11, AC14

- **Test first** — `scripts/grooves/manifest.test.ts`: `renderManifest(entries, pools)`
  contains `export const SCALE_POOL`, `CHORD_POOL` and `PROGRESSION_POOL` and their
  values. Run it: fails, `renderManifest` takes one argument.
- **Implement** — widen `renderManifest`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C2b — Nothing parses the scale string

Covers: R8

- **Test first** — `src/features/daily-groove/lib/grooves.generated.test.ts`: read every
  file under `src/features/daily-groove/**` and assert none of them splits, slices or
  regex-matches a `scale` value to obtain a root or a flavour — match on
  `\.scale` followed by `.split(`, `.match(`, `.slice(` or `.replace(`. Run it: fails
  if feature-2's derivation is still parsing the string.
- **Implement** — repoint any such derivation at `groove.root` and `groove.flavour`.
- **Green when** — the assertion passes. This is what keeps `harmonic minor` from
  quietly becoming root `harmonic`.
- **Refactor** — none.

#### Step C3 — `seed.ts` is gone

Covers: R7, AC8

- **Test first** — `src/features/daily-groove/lib/grooves.generated.test.ts`: no file
  under `src/` imports from `./seed` or `../lib/seed`, and `seed.ts` does not exist on
  disk. Run it: fails, the pools still live there.
- **Implement** — repoint the pool imports at `./grooves.generated` and delete
  `seed.ts` and `seed.test.ts`.
- **Green when** — both assertions pass and every remaining feature test is green.
- **Refactor** — none.

### Wave 2 — Seed selection and the catalogue

#### Step S1 — Seeds are chosen to satisfy the catalogue's constraints

Covers: R3, R4, R5

- **Test first** — `scripts/grooves/select.test.ts`: `selectSeeds(allTemplates(), { perTemplate: 4 })`
  returns sixteen specs, four per template; no two grooves built from them share a
  scale-and-progression pair; each of the eight flavours appears exactly twice. Run it:
  fails, "selectSeeds is not a function".
- **Implement** — `select.ts`: walk seeds from `startSeed`, build events, accept a seed
  when it adds an uncovered flavour or an unused scale-and-progression pair, and stop at
  `perTemplate` for each template.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step S2 — Selection is deterministic and resumable

Covers: R3, R6

- **Test first** — same file: two calls with the same arguments return identical specs;
  a call with `existing` set to the first eight returns eight more that collide with
  none of them by `id` or `seed`. Run it: fails if selection depends on iteration order
  of a set or on anything unseeded.
- **Implement** — make the walk strictly ordered and honour `existing`.
- **Green when** — both assertions pass. This is the behaviour Epic 4's `grooves:add`
  reuses rather than reimplements.
- **Refactor** — none.

#### Step S3 — The committed catalogue has sixteen entries

Covers: R3, R6, AC2, AC3, AC6

- **Test first** — `scripts/grooves/catalogue.test.ts`: `readCatalogue()` has sixteen
  entries; every `id` is unique and matches `/^groove-\d{2}$/`; every `template`
  resolves; four entries per template. Run it: fails, the catalogue has one entry.
- **Implement** — run `selectSeeds` once and commit its output as `catalogue.json`.
- **Green when** — all four assertions pass.
- **Refactor** — none.

### Wave 3 — Render, commit, verify

#### Step I1 — Every catalogue entry's harmony is valid

Covers: R8, R9, AC9, AC10

- **Test first** — `scripts/grooves/catalogue.test.ts`: for every entry, build its
  events and assert `isValidHarmony` accepts the result, and that every pitched event's
  pitch class is in the stated scale or permitted by the flavour's rule. Run it: fails
  if any selected seed slipped through.
- **Implement** — make `selectSeeds` reject a seed whose harmony fails validity.
- **Green when** — all sixteen pass.
- **Refactor** — none.

#### Step I2 — Render the catalogue and commit it

Covers: R6, R7, R10, AC7, AC11, AC12

- **Test first** — `src/features/daily-groove/lib/grooves.generated.test.ts`: `GROOVES`
  has sixteen entries; each `audioSrc` resolves to a file that exists and is non-empty;
  every one of 366 consecutive dates resolves through `selectGrooveForDate` to a valid
  entry. Run it: fails until the render lands.
- **Implement** — `npm run grooves`, commit the sixteen mp3s and the regenerated
  manifest, and delete the leftover `groove-02`…`groove-07.mp3` placeholders.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step I3 — Every flavour the game offers has grooves behind it

Covers: R5, AC4, AC5

- **Test first** — same file: each of the eight flavours appears on exactly two entries,
  and every entry's `flavour` is a member of the eight. Run it: fails if selection
  drifted.
- **Implement** — nothing if S1 held; otherwise re-select.
- **Green when** — both assertions pass. This is the assertion feature-2's chip row
  depends on.
- **Refactor** — none.

#### Step I4 — The demo path, by hand

Covers: R10, AC11, AC12

- Step the system clock across seven consecutive days, reloading each time. Seven
  different grooves play, each scoring against the harmony you heard.
- `npm test`, `npm run lint`, `npx tsc --noEmit` all green.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A3 |
| R2 | A2 |
| R3 | S1, S2, S3 |
| R4 | S1 |
| R5 | A2, S1, I3 |
| R6 | S2, S3, I2 |
| R7 | C3 |
| R8 | B5, C2b, I1 |
| R9 | B1, B2, B3, B4, B5, I1 |
| R10 | I2, I4 |
| R11 | C1, C2 |
| AC1 | A1 |
| AC2 | S3 |
| AC3 | S3 |
| AC4 | I3 |
| AC5 | I3 |
| AC6 | S3 |
| AC7 | I2 |
| AC8 | C3 |
| AC9 | B5, I1 |
| AC10 | B1, B2, B3, I1 |
| AC11 | I2, I4 |
| AC12 | I2, I4 |
| AC13 | B2, B4 |
| AC14 | C1, C2 |
| AC15 | A2 |

## Assumptions

- Template ids are `straight-funk`, `half-time`, `shuffle`, `bright-straight`. The names
  describe the feel, not the flavours they carry.
- The fixed distractor vocabulary in `pools.ts` is a hand-written list of plausible
  scales, chords and progressions that the catalogue does not use.
- Ids stay `groove-NN`, numbered in selection order, so `audioSrc` paths stay
  predictable.
- The sixteen grooves replace the seven existing ones outright. Stored history from
  before this epic is invalidated, which feature-2's storage version bump already covers.
- Blues grooves state their scale as `"<root> blues"`; harmonic minor as
  `"<root> harmonic minor"`. These strings are for display only — the `root` and
  `flavour` fields carry the answer, so the two-word flavour name is never a parsing
  hazard.
- Selection walks seeds from 1 upward. Epic 4 continues from the highest seed used.

## Decision log

### Cycle 1 — 2026-08-29

**Q2. How is a scale string parsed back into a root and a flavour?**
Decision: **A) The generator emits `root` and `flavour` as their own fields and nothing
ever parses `scale`** — a parsed string is a second source of truth, and it breaks on
`harmonic minor`.
Changed: Architecture states the rule; new Step C2b asserts no derivation parses
`scale`; the blues/harmonic-minor assumption is now about display only.

### Cycle 2 — 2026-08-29

**Q1. What does a seed rejected by seed-selection cost, and where is that logic owned?**
Decision: **A) `select.ts` owns the search**, and Epic 4's `grooves:add` calls it with
`existing` and a higher `startSeed` — so the initial sixteen and every later groove pass
the same acceptability test, and the two can never drift.
Changed: nothing — Steps S1 and S2 and Epic 4's Track C were already written this way,
and are now settled rather than provisional.

---

**This spec is ready to execute.** Every architectural decision is settled.
