# Tech spec — Epic 6: More feels, more modes

PRD: [../prd/epic-6-more-feels-more-modes.md](../prd/epic-6-more-feels-more-modes.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four modes and two templates, added across four tracks that own different files.
The generator's vocabulary tables grow first — intervals, validity rules,
distractor pool — then the two templates that carry the new pairs, then the
app's family table, which is the one place a missing mode does not degrade but
throws. Minting the grooves is the integration step.

The ordering that matters is that the family table is written *before* any
groove carrying a new mode can be selected. `familyOf` raises
`UnknownFamilyError` rather than defaulting, deliberately, so an unfamilied mode
does not produce a wrong answer — it produces a crash on the day that mode comes
up, for every player in simple mode.

## Architecture

**Twelve modes, six major and six minor.** The four new modes are chosen two
with a major third and two with a minor third, so simple mode's two answers stay
evenly matched and "Major" never becomes the better blind guess.

```
today                        added
─────────────────────        ─────────────────────
ionian          major        two major-third modes
lydian          major
mixolydian      major
dorian          minor        two minor-third modes
phrygian        minor
aeolian         minor
harmonic-minor  minor
blues           minor
```

Every candidate has to clear three gates before it is a candidate at all:

1. **A perfect fifth**, or `familyOf` cannot grade it and `chordsForScale`
   cannot build a tonic chord on it. This is what excludes locrian, the altered
   scale and the whole-tone scale.
2. **A nameable in-scale tonic chord** — `chordsForScale` must find a quality in
   `QUALITIES` that the scale entirely contains, or `buildHarmony` throws.
3. **A third**, major or minor, so `FAMILY_OF` has an honest entry.

The minor-third side is the short one. Melodic minor (tonic `mMaj7`), dorian ♭2
(tonic `m7`) and dorian ♯4 (tonic `m7`) all clear all three; the major-third side
has more candidates than it needs.

**Where a mode is declared.** Five places in the generator and one in the app:

```
scripts/grooves/types.ts             Flavour union
scripts/grooves/theory/scales.ts     FLAVOURS, INTERVALS
scripts/grooves/theory/validity.ts   VALIDITY
scripts/grooves/pools.ts             SCALE_DISTRACTORS
scripts/grooves/templates/*.ts       the pair a template carries
src/features/daily-groove/lib/theory/families.ts   FAMILY_OF
```

**The chip row does not change.** `flavourOptions` builds four options via
`buildOptions` from `flavourPool(GROOVES)`. More modes widen the pool the three
distractors are drawn from; the row is still four chips and the draw stays
uniform.

## Contracts

```ts
// scripts/grooves/types.ts
export type Flavour =
  | 'ionian' | 'aeolian' | 'dorian' | 'mixolydian'
  | 'lydian' | 'phrygian' | 'harmonic-minor' | 'blues'
  | '<major-third mode A>' | '<major-third mode B>'
  | '<minor-third mode A>' | '<minor-third mode B>'
```

```ts
// src/features/daily-groove/lib/theory/families.ts
const FAMILY_OF: Record<string, Family>   // total over every mode the catalogue can play
```

```ts
// scripts/grooves/templates/index.ts
export const TEMPLATES: Record<string, FeelTemplate>   // six entries
```

Invariant, asserted by `templates/index.test.ts` and unchanged in shape: the
templates' `flavours` are pairwise disjoint and their union is exactly
`FLAVOURS`.

Each new template supplies every field the earlier epics added: `passes`
(Epic 1), `gain` and `pan` for every voice including the toms (Epics 2 and 5),
`humanize.lean` and `humanize.driftDepth` (Epic 3), and optionally a `FILLS`
entry (Epic 5).

## Tracks

### Track A — The four modes

- **Goal** — the generator can build, name and validate a groove in each new
  mode, on every root.
- **Owns** — `scripts/grooves/types.ts` (`Flavour`),
  `scripts/grooves/theory/scales.ts`, `scripts/grooves/theory/validity.ts` and
  their tests.
- **Depends on** — nothing.
- **Parallel with** — C, D.
- **Done when** — a harmony builds for each new mode on all twelve roots and
  validates.

### Track B — The two templates

- **Goal** — six templates, disjoint pairs, union exactly twelve.
- **Owns** — `scripts/grooves/templates/` (two new files, `index.ts`,
  `index.test.ts`), and `PLACEMENTS`/`FILLS` entries in
  `scripts/grooves/events.ts`.
- **Depends on** — Track A's `Flavour` values.
- **Parallel with** — C, D.
- **Done when** — the invariant test passes over six templates.

### Track C — The family table

- **Goal** — no mode the catalogue can play throws in simple mode.
- **Owns** — `src/features/daily-groove/lib/theory/families.ts` and its test.
- **Depends on** — Track A's `Flavour` values (as strings — it never imports
  from `scripts/`).
- **Parallel with** — A, B, D.
- **Done when** — its own tests pass.

### Track D — The distractor pool

- **Goal** — the pool is spelled modally and holds the new modes.
- **Owns** — `scripts/grooves/pools.ts` and its test.
- **Depends on** — Track A's display names.
- **Parallel with** — A, B, C.
- **Done when** — its own tests pass.

## Execution waves

- **Wave 1 (parallel):** Track A, Track C, Track D.
- **Wave 2:** Track B — needs A's `Flavour` values to name a pair.
- **Wave 3:** Integration — mint, render, verify, play.

## Implementation

### Track A — The four modes

#### Step A1 — Each new mode has intervals and a display name

Covers: R3, R6a, AC3, AC2a

- **Test first** — `scripts/grooves/theory/scales.test.ts`: for each of the four
  new modes assert `intervalsFor` returns an ascending set starting at 0 that
  contains 7 (the perfect fifth), and that `scaleName('C', mode)` renders the
  mode's display spelling. Then assert `FLAVOURS` has twelve entries and does not
  contain `'locrian'`. Run it: fails with `intervalsFor: unknown flavour`.
- **Implement** — `types.ts`: extend `Flavour`. `theory/scales.ts`: add the four
  to `FLAVOURS` and `INTERVALS`, each with a comment naming its third and its
  characteristic interval.
- **Green when** — every assertion passes and the existing eight are unchanged.
- **Refactor** — none.

#### Step A2 — Each new mode states a tonic chord

Covers: R5, AC5

- **Test first** — `scripts/grooves/theory/harmony.test.ts`: for each new mode
  and each of the twelve roots, call `buildHarmony` with a fixed rng and assert
  it returns a `chordName` whose `pitchClassesOf` are all members of
  `pitchesOf(root, mode)`. Run it: fails with `buildHarmony: no in-scale tonic
  chord` for any candidate that does not clear the gate — which is the check
  that keeps a bad candidate out.
- **Implement** — nothing in `harmony.ts` if the candidates were chosen well.
  If a mode produces an in-scale but unidiomatic tonic, give it an `IDIOMS`
  entry the way `blues` has one.
- **Green when** — all 48 combinations build and validate.
- **Refactor** — none.

#### Step A3 — Each new mode has a validity rule

Covers: R3, AC3

- **Test first** — `scripts/grooves/theory/validity.test.ts`: assert `VALIDITY`
  has an entry for every value in `FLAVOURS`, and that a chord built on a degree
  of each new mode passes while a chord borrowing a note from outside fails. Run
  it: fails with `expected undefined to be a function`.
- **Implement** — `theory/validity.ts`: add a row per new mode, `strictDiatonic`
  unless the mode needs its own reading. Never loosen an existing rule.
- **Green when** — the totality assertion and both per-mode assertions pass.
- **Refactor** — none.

### Track B — The two templates

#### Step B1 — Two new feels exist and are registered

Covers: R1, AC1

- **Test first** — `scripts/grooves/templates/index.test.ts`: assert
  `allTemplates()` has six entries with distinct ids. Run it: fails with
  `expected 4 to be 6`.
- **Implement** — two new files under `scripts/grooves/templates/`, each a
  complete `FeelTemplate` — `tempoRange`, `subdivision`, `swing`, `passes`,
  `flavours`, `voices` (toms included), `humanize` with `lean` and `driftDepth`,
  `gain`, `pan`, `density` — registered in `index.ts` and re-exported.
- **Green when** — the count assertion passes and the field-completeness
  assertions from Epics 3 and 5 pass for the new templates too.
- **Refactor** — none.

#### Step B2 — The pairs are disjoint and cover the twelve

Covers: R2, R2a, R6b, AC2, AC2b

- **Test first** — `scripts/grooves/templates/index.test.ts`: assert every
  template carries exactly two flavours, that no flavour appears on two
  templates, and that the union equals `FLAVOURS` — the existing invariant, now
  over six templates and twelve modes. Add: group the twelve by third and assert
  six are major and six are minor. Run it: fails with
  `expected Set(12) to equal Set(8)` until the new pairs are assigned.
- **Implement** — assign the four new modes across the two new templates, one
  major-third and one minor-third mode each, so the six/six split holds.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step B3 — The new feels have their placements and fills

Covers: R1, AC1

- **Test first** — `scripts/grooves/events.test.ts`: render a groove from each
  new template and assert it produces events, contains a fill in the last bar of
  its last pass, and gates clean. Run it: fails only if a new template's feel
  needs a `PLACEMENTS` or `FILLS` entry it does not have.
- **Implement** — `events.ts`: add `PLACEMENTS` and `FILLS` entries for the new
  ids where their feel differs from the defaults; otherwise rely on the
  fall-through, deliberately.
- **Green when** — both templates render and gate.
- **Refactor** — none.

### Track C — The family table

#### Step C1 — Every mode has a family

Covers: R6, R8, AC6, AC2b

- **Test first** — `src/features/daily-groove/lib/theory/families.test.ts`:
  assert `familyOf` returns a family and does not throw for each of the twelve
  mode display names; assert six return `'Major'` and six `'Minor'`. Run it:
  fails with `UnknownFamilyError: No family for mode "..."`.
- **Implement** — `families.ts`: add the four new modes to `FAMILY_OF` under the
  right family, with the existing "major third / minor third" comment structure.
  Update the doc comment: the table is total over the twelve modes the rotation
  can play, and locrian is still absent for the same stated reason.
- **Green when** — both assertions pass and the `UnknownFamilyError` test for a
  genuinely unknown string stays green.
- **Refactor** — none.

#### Step C2 — Simple mode is winnable on a new mode

Covers: R6, R8, AC7

- **Test first** — `src/features/daily-groove/index.test.ts` (through
  `testing/renderFeature.tsx`): render the feature in simple mode with a groove
  fixture carrying a new mode, and assert the mode row offers exactly two
  options, that they are `Major` and `Minor`, and that selecting the correct
  family solves the day. Run it: fails with `UnknownFamilyError` before C1.
- **Implement** — nothing beyond C1.
- **Green when** — the day is winnable.
- **Refactor** — none.

### Track D — The distractor pool

#### Step D1 — The pool holds the new modes, spelled modally

Covers: R3, R4, R7, AC3, AC4, AC8

- **Test first** — `scripts/grooves/pools.test.ts`: assert
  `SCALE_DISTRACTORS` contains at least two entries for each new mode across
  different roots, that no entry contains the words `major` or `minor` as a
  flavour (`harmonic minor` excepted), and that `buildPools` still yields at
  least four distinct values per pool. Run it: fails on the count for the new
  modes.
- **Implement** — `scripts/grooves/pools.ts`: add distractor entries for the new
  modes, spread across roots, in the same Unicode-accidental, lower-case-flavour
  spelling as the answers — the mistake the file already documents from
  feature-7.
- **Green when** — all three assertions pass.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Mint grooves for the new feels

Covers: R1, R9, R11, R12, AC1, AC9, AC10, AC11

- Run `npm run grooves:add <n>` until each new template carries a comparable
  number of grooves to the existing four and each new mode is represented.
  `selectSeeds` already spreads a batch across templates and continues ids from
  the highest ever used, so nothing is renumbered.
- **Test** — `src/features/daily-groove/data/grooves.generated.test.ts`: assert
  every entry's `flavour` has a family, and that no mode is carried by more than
  twice as many grooves as the least-carried one.
- Confirm Epic 1's answer-pinning test still passes over the original eighteen.

#### Step I2 — Verify and lock

Covers: R10, R12, R13, AC10, AC12

- `npm run grooves` twice; `git status` clean. `npm run grooves:verify` and
  `npm test`.
- Load the app with a stored result naming a pre-epic groove and confirm it
  loads and still counts toward the streak.

#### Step I3 — The demo path

Covers: R1, R7, AC13

- Play a groove from each new feel: the feel is distinguishable from the four
  that existed, and hearing it still narrows the mode honestly. Check a normal
  day still offers four mode chips and a simple-mode day two.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, B3, I1 |
| R2, R2a | B2 |
| R3 | A1, A3, D1 |
| R4 | D1 |
| R5 | A2 |
| R6, R6a | A1, C1, C2 |
| R6b | B2, C1 |
| R7 | D1, I3 |
| R8 | C1, C2 |
| R9 | I1 |
| R10 | I2 |
| R11 | I1 |
| R12 | I1, I2 |
| R13 | I2 |
| AC1 | B1, B3, I1 |
| AC2, AC2a | A1, B2 |
| AC2b | B2, C1 |
| AC3 | A1, A3, D1 |
| AC4 | D1 |
| AC5 | A2 |
| AC6 | C1 |
| AC7 | C2 |
| AC8 | D1 |
| AC9 | I1 |
| AC10 | I1, I2 |
| AC11 | I1 |
| AC12 | I2 |
| AC13 | I3 |

## Assumptions

- The four modes are chosen while doing the work, from the candidates that clear
  the three gates: melodic minor, dorian ♭2 and dorian ♯4 on the minor side, and
  lydian dominant, phrygian dominant, mixolydian ♭6 and harmonic major on the
  major side. Two from each side.
- Internal flavour ids stay hyphenated where the display is two words, as
  `harmonic-minor` already is, so `scaleName`'s existing hyphen replacement needs
  no change.
- `Flavour` in `src/lib/groove.ts` stays `string`. The app derives its pool from
  the manifest at runtime; widening the vocabulary is not a reason to make it a
  union.
- The two new templates are new *feels*, not variants of existing ones — a
  different tempo range and subdivision, so the pair of modes each carries is
  genuinely narrowed by hearing it.
- Minting uses the existing `grooves:add` path and gate unchanged.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/writespec feature-9 epic-6` — the answer gets applied to the
design and steps, moved into the log, and replaced by whatever it opens up.

### Q1. Where does a mode's family live?

`FAMILY_OF` in the app is a hand-maintained table, and `familyOf` throws on a
gap — which is exactly the failure this epic has to avoid. The third is
computable from the generator's interval table, so the table could be derived
instead of written. Reversing this later means moving the vocabulary's centre of
gravity across the `src/lib` boundary, which `docs/architecture.md` treats as
load-bearing.

- [ ] A) Keep the hand-written table, with a test asserting it is total over
      every mode the manifest carries *(recommended — `docs/architecture.md`
      makes `src/lib` a leaf and the generator's theory modules unreachable from
      the app, so deriving would mean moving `INTERVALS` into `src/lib`; a
      totality test catches the gap just as reliably and moves nothing)*
- [ ] B) Derive it: move `INTERVALS` into `src/lib/groove.ts` so both the
      generator and the app read one table, and compute the family from the
      third
- [ ] C) Have the generator write the family into each manifest entry, so
      `families.ts` reads data rather than a table and can never be incomplete
- [ ] D) Keep the table but make `familyOf` fall back to grading by the mode's
      own name, so an unfamilied mode degrades instead of throwing
