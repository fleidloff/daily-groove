# Tech spec — Epic 2: Every feel on the new kit

PRD: [../prd/epic-2-every-feel-on-the-new-kit.md](../prd/epic-2-every-feel-on-the-new-kit.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

> **Reconciled against what was built — 2026-09-01.** The ride is dropped from
> the feature, so **Track B's ride declarations, R5, R6, R6a, AC4 and AC9 are
> withdrawn**. All five templates were still re-levelled; the bongo went to
> `bright-straight` alone.
>
> Two things landed differently:
>
> - **The templates were corrected by one shared per-voice delta**, not
>   re-derived independently. The pack's recorded levels changed identically for
>   every template, so the correction is identical — and re-deriving each would
>   have rewritten five balances that were already right relative to each other.
> - **The loudness band ships at -29..-20 dBFS**, far wider than Step I2's
>   intent. Every feel renders to *exactly* `PEAK_CEILING`, so with peak pinned
>   RMS is a function of crest factor: closing the 4.8 dB spread means
>   rebalancing voices by ear. The band is a gross-error guard and says so.
>
> A later listening pass took 2 dB off every drum voice. See `.implement/epic-2.md`
> for the per-feel drum-versus-comp figures, which are the open question left.

## Approach

Two kinds of work that barely touch: five template files whose numbers are set
by ear, and one new gate check that decides whether the set is balanced. The
gate check goes first and in its own track, because it is the instrument the
levelling is measured with — writing it after the templates would mean tuning by
ear and then discovering the band disagrees.

The five templates then split two ways rather than five, by whether the feel
takes the ride. `half-time`, `open-ballad`, `shuffle` and `swung-sixteenth` do;
`bright-straight` does not, and is the bongo's candidate alongside
`straight-funk`. Each template file is owned by exactly one step, so five
developers could take one each; in practice the levelling is one person with
headphones and the split matters mainly because it keeps the diffs separable.

`straight-funk.ts` is not touched. Epic 1 owns it, and re-levelling it here
would put two epics in one file.

## Architecture

The loudness check joins `gateCandidate`'s existing chain as a seventh check,
after `checkDensity`. It imports `rmsDbfs` from Epic 1's `scripts/grooves/level.ts` —
that module exists precisely so this check does not have to reach into `mix.ts`,
which the gate must stay independent of.

```
gateCandidate(args)
  checkPeak ?? checkSilence ?? checkSeam ?? checkHarmony
    ?? checkPitch ?? checkDensity ?? checkLoudness   ← new
```

Ordering it last is deliberate. The earlier checks catch grooves that are broken;
loudness catches a groove that is fine but mixed wrong, and reporting "too quiet"
about a groove that is also clipping would bury the real fault.

The four ride feels list `hatClosed` as well as `ride`. Nothing in this epic
arranges for them not to collide — that is Epic 3's derived rule, and this epic
declares voices and levels only.

## Contracts

### The loudness band

```ts
// scripts/grooves/gate.ts
/** Integrated RMS band every groove must fall inside, in dBFS. */
export const LOUDNESS_FLOOR_DB = -20
export const LOUDNESS_CEILING_DB = -14
```

Two exported constants with the reason for the width beside them, in the manner
of `PEAK_CEILING` and `SEAM_THRESHOLD`. The opening figures are a starting point
to be narrowed once all six feels are measured; the *shape* — an exported band,
checked per groove — is what is frozen.

### The failure shape

```ts
{ check: 'loudness', detail: 'groove-14 measured -22.6 dBFS, outside -20..-14' }
```

The existing `GateFailure` type, unchanged. Every other check already reports
the measured figure and the bound it missed.

### Voice lists, frozen for Epic 3

- Ride feels: `half-time`, `open-ballad`, `shuffle`, `swung-sixteenth`.
- Non-ride feels: `straight-funk`, `bright-straight`.
- Bongo candidates: `bright-straight`, and `straight-funk` if Epic 1 has not
  claimed it — one or both, never a ride feel.

Epic 3 builds against this split without needing the files.

## Tracks

### Track A — the loudness check

- **Goal** — a groove outside the band fails to mint and fails `grooves:verify`.
- **Owns** — `scripts/grooves/gate.ts`, `scripts/grooves/gate.test.ts`.
- **Depends on** — `rmsDbfs` from Epic 1's `level.ts`.
- **Parallel with** — Tracks B and C.
- **Done when** — `gate.test.ts` proves the check fires in both directions.

### Track B — the four ride feels

- **Goal** — `half-time`, `open-ballad`, `shuffle` and `swung-sixteenth` play
  the new kit and list the ride.
- **Owns** — `templates/half-time.ts`, `templates/open-ballad.ts`,
  `templates/shuffle.ts`, `templates/swung-sixteenth.ts`.
- **Depends on** — Epic 1's pack and levelling method.
- **Parallel with** — Tracks A and C.
- **Done when** — each renders through the gate at every seed the catalogue uses
  for it.

### Track C — the bongo feel

- **Goal** — `bright-straight` plays the new kit and carries the bongo.
- **Owns** — `templates/bright-straight.ts`.
- **Depends on** — Epic 1's pack.
- **Parallel with** — Tracks A and B.
- **Done when** — it renders through the gate at every seed.

### Track D — the shared pools

- **Goal** — no pattern, placement or fill in `events.ts` still assumes the
  cajon's envelope.
- **Owns** — the existing pools in `scripts/grooves/events.ts`
  (`KICK_PATTERNS`, `PLACEMENTS`, `FILLS`, `DEFAULT_FILL`).
- **Depends on** — Tracks B and C having surfaced whatever they surface.
- **Parallel with** — nothing. Wave 2, because a change here is a change to all
  six feels and must land after they are individually clean.
- **Done when** — all six still gate clean.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C.
- **Wave 2:** Track D, then the cross-template levelling pass that narrows the
  band to what the six feels actually achieve.
- **Wave 3:** Integration.

## Implementation

### Track A — the loudness check

#### Step A1 — a groove that is too quiet fails the gate

Covers: R8, R9, R10, AC7a, AC8

- **Test first** — `scripts/grooves/gate.test.ts`: build a `Pcm` of white noise
  scaled to about −30 dBFS, pass it to `gateCandidate` with a valid `events`,
  `music`, `harmony` and `template`; assert the returned failure has
  `check === 'loudness'` and a `detail` containing both the measured figure and
  the band. Run it: fails — `gateCandidate` returns `null`, because no loudness
  check exists.
- **Implement** — `scripts/grooves/gate.ts`: export `LOUDNESS_FLOOR_DB` and
  `LOUDNESS_CEILING_DB`; add `checkLoudness(pcm)` calling `rmsDbfs` from
  `./level.ts`; append `?? checkLoudness(args.pcm)` to `gateCandidate`'s chain,
  after `checkDensity`.
- **Green when** — the assertion passes and the existing gate cases stay green.
- **Refactor** — none.

#### Step A2 — a groove that is too loud fails the same way

Covers: R8a, R10, AC8

- **Test first** — `gate.test.ts`: a buffer at about −8 dBFS but under
  `PEAK_CEILING`; assert `check === 'loudness'`. Run it: fails, returning
  `null` — this is the case a peak check cannot catch, and asserting it is what
  proves the two checks are measuring different things.
- **Implement** — the ceiling half of `checkLoudness`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A3 — loudness is reported after the faults that matter more

Covers: R9

- **Test first** — `gate.test.ts`: a buffer that both clips and sits outside the
  band; assert the failure is `check === 'peak'`, not `'loudness'`. Run it:
  passes if `checkLoudness` was appended last, fails if it was inserted earlier.
- **Implement** — nothing if green; otherwise move the call to the end of the
  chain.
- **Green when** — green.
- **Refactor** — none.

#### Step A4 — every groove in the catalogue is inside the band

Covers: R7, R9a, AC6, AC7

- **Test first** — `scripts/grooves/events.test.ts`: for all thirty catalogue
  entries, render and assert `gateCandidate` returns `null`. Run it: fails for
  whichever grooves the wave-1 templates leave outside the provisional band.
- **Implement** — nothing here; this is the test the wave-2 levelling pass
  drives to green, by adjusting template gains and then narrowing the band's
  constants to what the six feels actually achieve.
- **Green when** — all thirty pass.
- **Refactor** — once green, tighten `LOUDNESS_FLOOR_DB` and
  `LOUDNESS_CEILING_DB` around the measured spread and write the reason for the
  final width into the constants' doc comment.

### Track B — the four ride feels

Steps B1–B4 are the same shape, one per template. B1 is written out; B2–B4
substitute the template and its own identity values.

#### Step B1 — `half-time` plays the new kit and lists the ride

Covers: R1, R1a, R2, R4, R5, R6, R6a, AC1, AC3, AC4, AC9

- **Test first** — `scripts/grooves/templates/index.test.ts`: assert
  `halfTime.voices` contains `ride` and still contains `hatClosed`; assert
  `gain` and `pan` have exactly the keys in `voices`; assert `flavours`,
  `tempoRange`, `subdivision`, `swing`, `passes` and `density` equal literals
  copied from the pre-epic file. In `events.test.ts`, assert every catalogue
  seed for `half-time` renders and gates clean, and that
  `voiceLevels(tracks)` shows no listed voice silent. Run it: fails on the
  missing `ride` key in `gain`/`pan`.
- **Implement** — `templates/half-time.ts`: add `ride` to `voices`; re-derive
  every `gain` and `pan` entry against the new kit using Epic 1's method, adding
  entries for `ride`; revisit `humanize.lean`. Leave the identity fields alone.
- **Green when** — all assertions pass.
- **Refactor** — update the template's doc comment where it describes the mix.

#### Step B2 — `open-ballad`

Covers: the same, plus R3, AC2

- **Test first** — as B1, and additionally: assert `openBallad.gain.comp` is
  greater than `openBallad.gain.snare`, and that its `hatClosed` gain is the
  lowest `hatClosed` across all six templates. Run it: the comp/snare assertion
  passes today and must survive re-levelling — it is the feel's whole design,
  and the easiest thing to flatten while balancing a kit.
- **Implement** — as B1, for `templates/open-ballad.ts`.
- **Green when** — all assertions pass, the inversion included.
- **Refactor** — the doc comment's paragraph about the mix being the point stays
  true and should say so about a kit rather than a cajon.

#### Step B3 — `shuffle`

Covers: R1, R1a, R2, R4, R5, R6, R6a, AC1, AC3, AC4, AC9

As B1, for `templates/shuffle.ts`.

#### Step B4 — `swung-sixteenth`

Covers: as B3, for `templates/swung-sixteenth.ts`.

### Track C — the bongo feel

#### Step C1 — `bright-straight` plays the new kit and carries the bongo

Covers: R1, R1a, R2, R4, R5a, R5c, R5d, AC1, AC3, AC4a, AC5

- **Test first** — `templates/index.test.ts`: assert
  `brightStraight.voices` contains both `bongoHigh` and `bongoLow` and does not
  contain `ride`; assert `gain`/`pan` key agreement; assert the identity fields
  against literals. In `events.test.ts`, assert every `bright-straight` seed
  gates clean. Run it: fails on the missing bongo keys.
- **Implement** — `templates/bright-straight.ts`: add the bongo pair to
  `voices`, `gain` and `pan`; re-derive the rest.
- **Green when** — all assertions pass. The bongo renders no events yet — Epic 3
  supplies the pool — so this proves the declaration, not the part.
- **Refactor** — none.

#### Step C2 — the ride and the bongo never share a feel

Covers: R5, R5a, R5b, R5d, AC4, AC4a

- **Test first** — `templates/index.test.ts`: over `allTemplates()`, assert
  `ride` appears in exactly `half-time`, `open-ballad`, `shuffle`,
  `swung-sixteenth`; assert the bongo pair appears in at least one template and
  only in `bright-straight` or `straight-funk`; assert no template lists both a
  ride and a bongo; assert both voices are listed together or not at all; assert
  neither is in all six. Run it: fails until B1–B4 and C1 have landed.
- **Implement** — nothing; this is the invariant the five preceding steps
  satisfy.
- **Green when** — green.
- **Refactor** — none.

### Track D (wave 2) — the shared pools

#### Step D1 — no pool assumes a voice with no sustain

Covers: R11, R12, AC10

- **Test first** — `scripts/grooves/events.test.ts`: render one groove per
  template and assert each passes `gateCandidate`, `density` band included; and
  assert the fill bar of a multi-pass groove is inside the density band too — a
  fill written for toms that were the only decaying drums is where a bass drum
  with real sustain first turns to mush.
- **Implement** — `scripts/grooves/events.ts`: adjust `KICK_PATTERNS`,
  `DEFAULT_FILL` or a `FILLS` entry only where a test shows the assumption
  biting. A pool changed without a failing test to justify it is a change to all
  six feels for a reason nobody recorded.
- **Green when** — all six render clean.
- **Refactor** — none. Resist tidying the pools; every edit here is six edits.

## Integration and verification

- **Step I1 — the six feels are levelled against each other.** Render one groove
  per template, print `rmsDbfs` for each, and assert the spread across the six is
  under a stated tolerance. This is the assertion the epic exists for, and it is
  separate from A4's per-groove band: thirty grooves can each be inside a wide
  band while the six feels still step.
- **Step I2 — narrow the band.** With I1 green, tighten the two constants around
  the measured spread and re-run A4.
- **Step I3 — the demo path.** `npm run grooves`, then play one groove from each
  of the six feels back to back. A change of groove, not of volume.
- **Step I4 — full suite.** `npm test`, `npx tsc --noEmit`, `npm run lint`.
  `grooves:verify` still fails on lock staleness until Epic 5.
- **Listening sign-off**, across all six.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1, R1a | B1–B4, C1 |
| R2 | B1–B4, C1 |
| R3 | B2 |
| R4 | B1–B4, C1 |
| R5 | C2 |
| R5a | C1, C2 |
| R5b | C2 |
| R5c | C1, C2 |
| R5d | C1, C2 |
| R6, R6a | B1–B4 |
| R7 | A4, I1 |
| R8 | A1 |
| R8a | A2, A4 |
| R9 | A1, A3 |
| R9a | A4 |
| R10 | A1, A2 |
| R11, R12 | D1 |
| AC1 | B1–B4, C1 |
| AC2 | B2 |
| AC3 | B1–B4, C1 |
| AC4 | C2 |
| AC4a | C1, C2 |
| AC5 | C1, C2 |
| AC6 | A4, I1 |
| AC7, AC7a | A4, A1 |
| AC8 | A1, A2 |
| AC9 | B1–B4 |
| AC10 | D1 |

## Assumptions

- The band's opening values (−20 to −14 dBFS) are provisional and narrowed in
  I2 once the six feels are measured. The exported shape is what other code
  depends on; the numbers are tuning.
- `checkLoudness` measures the mixed stereo buffer, after `mixTracks` has applied
  gain, pan, room and the bus knee — the thing a listener hears, not the sum of
  the tracks.
- The four ride feels keep every voice they have today plus the ride. No voice
  is removed from any template in this epic; Epic 3 demotes the hat by changing
  what it plays, not by deleting it.
- B1–B4 and C1 may be done by one person in sequence. The track split exists so
  the files do not collide, not to insist on five people.

## Decision log

### Cycle 1 — 2026-09-01

No architectural questions open at drafting. The PRD settled the measure (RMS),
the enforcement point (the gate), and which feels carry which voice. The calls
this spec makes alone — `checkLoudness` last in the chain, the band as two
exported constants, measuring post-mix — are recorded as assumptions and are
cheap to reverse.
