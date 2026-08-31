# Tech spec — Epic 5: The last pass ends with a fill

PRD: [../prd/epic-5-the-last-pass-ends-with-a-fill.md](../prd/epic-5-the-last-pass-ends-with-a-fill.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three tracks. One adds three tom voices to the vocabulary — `VoiceName`,
`BACKING_VOICES`, `VELOCITIES` and a `gain`/`pan` entry per template. One sources
and declares the tom samples from the kit Epic 2 chose. One writes the `FILLS`
table and the placement rule in `events.ts`.

The placement rule is defined entirely in passes, never in bar numbers, because
Epic 1 made the pass count a template property: a four-pass funk groove fills in
bar 16 and varies in bar 8, while a two-pass half-time groove fills in bar 8 and
varies nowhere. Nothing is written past the loop end, so `mix.ts` and the seam
are untouched by this epic.

## Architecture

**The vocabulary.** Three named tom voices rather than one indexed voice, so
each gets its own pan and level the way every other voice does — toms spread
across the image is what makes a fill read as a kit rather than a sample.

```ts
type VoiceName = ... | 'tomHigh' | 'tomMid' | 'tomLow'
```

**Placement**, computed from `template.passes`:

| passes | variation | fill |
| :-- | :-- | :-- |
| 2 | — | last bar of pass 2 |
| 3 | last bar of pass 2 | last bar of pass 3 |
| 4 | last bar of pass 2 | last bar of pass 4 |
| n ≥ 5 | last bar of pass `floor(n/2)` | last bar of pass n |

`middlePassOf(passes)` returns `null` for `passes < 3` and `floor(passes / 2)`
otherwise — the earlier candidate on an even count, so the mark sits at the
half-way point rather than past it.

**The fill replaces the bar.** In the fill bar, the figure's kick, snare, hat and
rim events are not emitted; the fill's are emitted instead. The bass and comp
play on, so the harmony is unbroken and the bar is still the chord it claims.
A fill that layered on top of the figure would double the density of the densest
bar in the groove and read as a mistake rather than a phrase.

**The variation** is the same mechanism with a thinner phrase — by default the
template's fill with its tom events removed.

```
FILLS: Record<string, { fill: FillPhrase; variation?: FillPhrase }>
FillPhrase = Partial<Record<VoiceName, number[]>>   // sixteenth-grid steps
```

Keyed by template id, beside `PLACEMENTS`, resolved onto the template's grid by
the same `gridSteps` the other patterns use. `DEFAULT_FILL` covers a template
with no entry.

## Contracts

```ts
// scripts/grooves/types.ts
export type VoiceName =
  | 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'rim'
  | 'tomHigh' | 'tomMid' | 'tomLow'
  | 'bass' | 'comp'
```

```ts
// scripts/grooves/events.ts
export type FillPhrase = Partial<Record<VoiceName, number[]>>
export const FILLS: Record<string, { fill: FillPhrase; variation?: FillPhrase }>
export const DEFAULT_FILL: FillPhrase
export function middlePassOf(passes: number): number | null
```

Pack declaration gains `tomHigh`, `tomMid` and `tomLow`, each with velocity
layers and round-robins, under the same rules as every other percussive voice.

`FeelTemplate` gains **no** field. Its `voices`, `gain` and `pan` grow entries
for the three toms, which is data in an existing shape.

## Tracks

### Track A — The vocabulary

- **Goal** — the generator knows three tom voices, and every template places and
  levels them.
- **Owns** — `scripts/grooves/types.ts` (`VoiceName`),
  `scripts/grooves/events.ts` (`BACKING_VOICES`, `VELOCITIES`),
  `scripts/grooves/templates/*.ts` (`voices`, `gain`, `pan`).
- **Depends on** — the `VoiceName` contract.
- **Parallel with** — B.
- **Done when** — the generator type-checks and its suite passes with the toms
  declared but unused.

### Track B — The tom samples

- **Goal** — the pack holds toms from the kit Epic 2 chose.
- **Owns** — `scripts/grooves/samples/**`, `pack.json`, `provenance.json`,
  `samples/README.md`, `scripts/grooves/pack.test.ts`.
- **Depends on** — **Epic 2 merged** — the kit must exist to take toms from it.
- **Parallel with** — A.
- **Done when** — `pack.test.ts`'s stocking assertions pass for the toms.

### Track C — The phrase and its placement

- **Goal** — the last bar of the last pass fills; the middle pass varies.
- **Owns** — the fill emission in `scripts/grooves/events.ts`, the `FILLS` table,
  and `scripts/grooves/events.test.ts`.
- **Depends on** — Track A's `VoiceName` and Epic 1's `template.passes`.
- **Parallel with** — nothing; it needs A's vocabulary to name a tom.
- **Done when** — its own tests pass, whether or not the samples exist.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C — needs A's vocabulary.
- **Wave 3:** Integration — density bands, re-render, verify, listen.

## Implementation

### Track A — The vocabulary

#### Step A1 — The generator knows what a tom is

Covers: R4, AC3

- **Test first** — `scripts/grooves/events.test.ts`: assert `BACKING_VOICES`
  contains `tomHigh`, `tomMid` and `tomLow`, and that rendering a template whose
  `voices` omits them produces no tom events and does not throw. Run it: fails
  with `expected [...] to contain 'tomHigh'`.
- **Implement** — `types.ts`: extend `VoiceName`. `events.ts`: add the three to
  `BACKING_VOICES` and give each a row in `VELOCITIES` in the same
  strong/medium/weak shape as the other drums.
- **Green when** — both assertions pass and every existing events test stays
  green.
- **Refactor** — none.

#### Step A2 — Every template places and levels the toms

Covers: R4, AC3

- **Test first** — `scripts/grooves/templates/index.test.ts`: for every template,
  assert that each voice named in `voices` has a `gain` and a `pan` entry. Run
  it: fails once the toms are added to `voices` without levels.
- **Implement** — the four template files: add the three toms to `voices`, with
  `gain` values sitting below the snare and `pan` values spreading them across
  the image — high toward the hats, low toward the opposite side, matching each
  template's existing kit orientation.
- **Green when** — the assertion passes for all four templates.
- **Refactor** — none.

### Track B — The tom samples

#### Step B1 — The pack holds toms from the kit

Covers: R1, R2, R3, AC1, AC2

- **Test first** — `scripts/grooves/pack.test.ts`: assert `tomHigh`, `tomMid` and
  `tomLow` are declared, each with ≥ 2 velocity layers of ≥ 2 alternates; and
  assert their `provenance.json` entries name the same source kit as `snare`.
  Run it: fails with `expected undefined to be defined`.
- **Implement** — prepare three toms from Epic 2's kit — trim, fade, downmix,
  44.1 kHz FLAC — declare them in `pack.json`, record every file in
  `provenance.json`, and add them to `samples/README.md`'s voice-mapping table.
- **Green when** — both assertions pass, along with Epic 2's un-normalised-layers
  and mono/rate assertions, which apply to the new files unchanged.
- **Refactor** — none.

### Track C — The phrase and its placement

#### Step C1 — The middle pass is computed, not guessed

Covers: R8, AC6

- **Test first** — `scripts/grooves/events.test.ts`: assert `middlePassOf(2)` is
  `null`, `middlePassOf(3)` is `1`, `middlePassOf(4)` is `2` and
  `middlePassOf(5)` is `2` (0-based pass indices, so `1` is pass two). Run it:
  fails with `middlePassOf is not a function`.
- **Implement** — `events.ts`: `middlePassOf(passes)` returns `null` when
  `passes < 3` and `Math.floor(passes / 2)` otherwise, with a comment naming the
  even-count tie-break.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C2 — The last bar of the last pass is a fill

Covers: R5, R7, R10, AC4, AC8

- **Test first** — `scripts/grooves/events.test.ts`: render a four-pass groove
  and assert that the drum events of bar 15 (0-based) differ from those of bar 3
  and bar 7 in their step set, and that no bar other than 15 and 7 differs from
  bar 3. Run it: fails — every bar is identical.
- **Implement** — `events.ts`: add `FILLS` and `DEFAULT_FILL`. In the bar loop,
  when the bar is the last of the last pass, emit the resolved fill phrase's
  steps for each voice it names **instead of** the figure's kick, snare, hat and
  rim; leave bass and comp untouched.
- **Green when** — the assertions pass and the bass and comp of bar 15 still
  carry the bar's chord.
- **Refactor** — none.

#### Step C3 — Every template fills

Covers: R6, AC5

- **Test first** — `scripts/grooves/events.test.ts`: for every template in
  `allTemplates()`, render a groove and assert its last bar differs from an
  ordinary bar. Run it: fails for any template with no `FILLS` entry if
  `DEFAULT_FILL` is missing.
- **Implement** — `events.ts`: `FILLS` entries for the templates whose feel wants
  its own phrase — half-time's sparser than the funk's — and `DEFAULT_FILL` for
  the rest.
- **Green when** — every template produces a fill.
- **Refactor** — none.

#### Step C4 — The middle pass varies, and a short loop does not

Covers: R8, R10, AC6, AC8

- **Test first** — `scripts/grooves/events.test.ts`: for a four-pass groove
  assert bar 7's drum steps differ from bar 3's and are closer to bar 3's than
  bar 15's are (fewer differing steps); for a two-pass groove assert every bar
  but the last matches bar 3. Run it: fails — bar 7 is currently ordinary.
- **Implement** — `events.ts`: when `middlePassOf(template.passes)` is not null
  and the bar is the last of that pass, emit the variation phrase — the
  template's `variation` if declared, otherwise its fill with the tom voices
  removed.
- **Green when** — both assertions pass.
- **Refactor** — extract `phraseForBar(pass, bar, template)` returning the fill,
  the variation or `null`, once C2 and C4 both need the decision.

#### Step C5 — Nothing is written past the loop

Covers: R9, R13, AC7, AC10

- **Test first** — `scripts/grooves/events.test.ts`: render every catalogue
  template and assert no event's `timeSec` is at or beyond the loop length, and
  that no event names a crash voice — `VoiceName` has none. Run it: passes, and
  it is the guard that keeps the fill out of the overhang.
- **Implement** — nothing.
- **Green when** — it passes, and `mix.ts` and `gate.ts`'s seam check are
  untouched by this epic.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The bands admit a fill

Covers: R11, R12, AC9

- **Test first** — `scripts/grooves/cli.test.ts`: render the whole catalogue with
  `encode: false` and assert `gateCandidate` returns `null` for every entry.
- **Implement** — the template files: adjust `density.maxPerBar` if the fill bar
  pushes any template's average past its band, with a comment saying so.
- **Green when** — every entry gates clean.

#### Step I2 — Re-render and lock

Covers: R14, AC11, AC12

- Run `npm run grooves`. Epic 1's answer-pinning test must stay green and the
  manifest must differ only by `headDelaySeconds`.
- Run twice; `git status` clean. `npm run grooves:verify` and `npm test`. Confirm
  `samples/` appears in neither `public/` nor the built bundle.

#### Step I3 — The demo path

Covers: R5, R8, R10, AC13

- Play one full loop of a four-pass groove: bar 8 is marked lightly, bar 16
  fills, and bar 1 arrives cleanly with no crash and no seam. Then a two-pass
  half-time groove: one sparse fill at the end, nothing at the half-way point.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1 |
| R2 | B1 |
| R3 | B1 |
| R4 | A1, A2 |
| R5 | C2 |
| R6 | C3 |
| R7 | C2, C3 |
| R8 | C1, C4 |
| R9 | C5 |
| R10 | C2, C4 |
| R11 | I1 |
| R12 | I1, I2 |
| R13 | C5, I2 |
| R14 | I2 |
| R15 | I2 |
| AC1, AC2 | B1 |
| AC3 | A1, A2 |
| AC4 | C2 |
| AC5 | C3 |
| AC6 | C1, C4 |
| AC7 | C5 |
| AC8 | C2, C4 |
| AC9 | I1 |
| AC10 | C5, I2 |
| AC11 | I2 |
| AC12 | I2 |
| AC13 | I3 |

## Assumptions

- Three tom voices rather than one indexed voice, so each carries its own pan
  and level like every other voice in the pack.
- Fill phrases are written on the sixteenth grid and resolved by `gridSteps`,
  so an eighth-note template plays the same phrase at its own resolution.
- Fill events pass through Epic 3's deviations like every other event; nothing
  about a fill is quantised more tightly than the groove around it.
- The variation defaults to the fill minus its toms. A template that wants
  something else declares `variation` explicitly.
- `PLACEMENTS`'s rim rule still applies in ordinary bars; the fill bar replaces
  the rim along with the rest of the figure's drums.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/writespec feature-9 epic-5` — the answer gets applied to the
design and steps, moved into the log, and replaced by whatever it opens up.

### Q1. Does the fill replace the figure's drums or play on top of them?

The architecture above replaces them. The alternative layers the fill over the
bar the figure would have played. This decides the shape of `FILLS` — a phrase
that stands alone versus one that only makes sense as an addition — and every
acceptance criterion that compares the fill bar with an ordinary one, so
reversing it rewrites Track C.

- [ ] A) Replace the figure's drums; bass and comp play on *(recommended — a
      fill is a phrase a drummer plays *instead of* the groove, and the PRD's
      R10 asks the fill bar to differ from an ordinary bar in voices or density,
      which layering would satisfy only by doubling it into the mush
      `checkDensity` exists to catch)*
- [ ] B) Layer over the figure — the groove never stops and the fill is an
      addition, at the cost of the densest bar being twice as dense
- [ ] C) Replace the snare and toms only, leaving the kick and hats running, so
      the pulse is unbroken through the fill
- [ ] D) Per template: the busy feels layer, the sparse ones replace
