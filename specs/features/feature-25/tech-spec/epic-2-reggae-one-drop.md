# Tech spec — Epic 2: Reggae one-drop

PRD: [../prd/epic-2-reggae-one-drop.md](../prd/epic-2-reggae-one-drop.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One template file, two entries in `events.ts`, one registry line and six minted
grooves — but the style is defined by three *absences*, and each one is a
different mechanism. Beat one is empty because the template declares its own kick
pool (every member of `KICK_PATTERNS` hits step 0). The backbeat is gone because
`placementFor` spreads `PLACEMENTS[id]` over `DEFAULT_PLACEMENT`, so a `snare`
key *replaces* `[4, 12]` rather than adding to it. And the default fill is gone
because `DEFAULT_FILL` puts a kick on step 0 and a snare on step 4 — so a
`FILLS` entry is not optional here, contrary to the PRD's last assumption: AC3
and AC5 say "every rendered groove" and "every bar", and the fill bar is a bar.
The work splits into the musician's template (wave 1, testable without touching
the registry), the document row (wave 2), and registration-plus-mint (wave 2),
which is the only part that has to queue behind Epics 3 and 4.

## Architecture

**Where each change lands.**

| Change | File |
| :-- | :-- |
| the template: tempo, swing, flavours, voices, mix, humanize, passes, density, and its own kick / comp / hat pools | `scripts/grooves/templates/reggae-one-drop.ts` *(new)* |
| the rim on beat 3, and the backbeat replaced rather than added to | `scripts/grooves/events.ts` → one `PLACEMENTS` entry |
| a fill that keeps beat one empty and the snare off 4 and 12 | `scripts/grooves/events.ts` → one `FILLS` entry |
| every one-drop behaviour this epic asserts | `scripts/grooves/reggae.test.ts` *(new)* |
| registration | `scripts/grooves/templates/index.ts` |
| the registry's flavour and uniqueness cases | `scripts/grooves/templates/index.test.ts` |
| the six grooves | `scripts/grooves/catalogue.json`, `grooves.lock.json`, `public/grooves/groove-NN.mp3` ×6, `src/features/daily-groove/data/grooves.generated.ts` |
| the app-tier literals a mint moves | `src/features/daily-groove/data/grooves.generated.test.ts` |
| the feel table row | `docs/music.md`, `scripts/grooves/docs.test.ts` |

**The three absences, precisely.**

```
beat one empty     →  template.patterns.kick    every member's min step is 8
                      (KICK_PATTERNS members all start at 0 — unusable)

no backbeat        →  PLACEMENTS['reggae-one-drop'].snare
                      placementFor = { ...DEFAULT, ...PLACEMENTS[id] }
                      so the key REPLACES [4, 12]; it does not merge

fill bar included  →  FILLS['reggae-one-drop']
                      FILLS[id] ?? { fill: DEFAULT_FILL } — also a replacement.
                      DEFAULT_FILL = kick [0], snare [0,2,4,6,14] would break
                      AC3 (kick on 0) and AC5 (snare on 4) in the fill bar alone
```

**What each acceptance criterion is measured on.** Every step assertion runs on a
**dry clone** of the template — `{ ...feel, humanize: { timingMs: 0, velocity: 0,
lean: {}, driftDepth: 0 } }` — and converts `timeSec` back to a step index with
`Math.round(timeSec / stepSec)`, exactly as `events.test.ts`'s local `barsOf`
does. `reggae.test.ts` carries its own copies of `barsOf`, `gridded` and
`phraseBars`; all three are file-local to `events.test.ts` and not exported.
Swing at 0.04 displaces an off-beat by 0.04 × half a subdivision — 8.6 ms at
70 bpm on the eighth grid, against a 428 ms step — so the rounding survives the
real template too, but the dry clone is what makes the assertions exact rather
than merely true today.

**Why registration and minting are one unit.** Registering the template with no
grooves behind it makes `catalogue.test.ts`'s *"draws grooves from every
template"* red, and puts the new feel inside thirty-four `allTemplates()` call
sites in `events.test.ts` and three in `catalogue.test.ts` at once. There is no
committable state between "registered" and "minted", so Track C owns both and
its steps are one sequence. That is the
"a step whose real dependency is output rather than a file" case: it is modelled
inside one track rather than as two.

**Wave 2 runs three epics at once, and four files are shared.** The roadmap names
`templates/index.ts`, `templates/index.test.ts`, `catalogue.json` and
`grooves.lock.json`. Two more belong on that list and this spec adds them:
`scripts/grooves/events.ts` (each of the three epics adds `PLACEMENTS` and
`FILLS` entries) and
`src/features/daily-groove/data/grooves.generated.test.ts` (each mint moves the
same literals). The protocol:

| File | Shape of the edit | Protocol |
| :-- | :-- | :-- |
| `events.ts` | one line each in two object literals | additive, on its own line; a git merge resolves it. Never reformat a neighbouring entry |
| `templates/index.ts` | one import, one registry line, one re-export | additive; three lines |
| `templates/index.test.ts` | one flavour block, one count | keep the count in the single `TEMPLATE_COUNT` constant so a merge is a one-line conflict with an obvious resolution |
| `catalogue.json`, `grooves.lock.json`, `public/grooves/`, `grooves.generated.ts` | rewritten wholesale by the mint | **serial.** Whoever mints second re-runs the mint after pulling, not a merge |
| `grooves.generated.test.ts` | two literals this epic moves — the groove count and the double-accidental set. The dominance cap in the same file is Epic 1's (its G4) and this epic does not touch it | serial with the mint that produced them |
| `docs/music.md`, `docs.test.ts` | one table row, one assertion | additive; the assertion is written over `allTemplates()` so it needs no edit when Epic 3 or 4 lands |

**When this epic is not the first of the three to mint**, Track C's Step C2
starts by pulling and re-reading `catalogue.json` and
`grooves.generated.test.ts`, and the six ids it issues continue from whatever
`highestNumber` then returns — ids are never re-issued
(`catalogue.test.ts` asserts it), so nothing needs reserving up front. Step
C3's literals are read off the tree at that moment, not predicted here.
Track A is unaffected by mint order: it touches none of those files.

## Contracts

Frozen before any track starts.

### From Epic 1 — do not re-derive

**Epic 1's tech spec exists and its Contracts section is frozen.** This epic
builds against C1 (the `patterns` block), C4 (`grooves:add --template`), C7 (the
fixed figure) and C9 (the registry reservation) as written there, not against
Epic 1's PRD. The three keys this epic declares:

```ts
// scripts/grooves/types.ts — Epic 1 C1, quoted
export type PatternPools = {
  kick?: number[][]                              // declared — R3
  hatClosed?: number[][]                         // declared — R6
  comp?: number[][]                              // declared — R7
  ride?: Partial<Record<Subdivision, number[][]>> // not declared
  bass?: number[][]                              // not declared
  bongos?: BongoFigure[]                         // not declared
  snareGhosts?: number[][]                       // not declared
  kit?: KitFigure[]                              // not declared — see Step A6
}

export type FeelTemplate = {
  // …every field it has today, with `subdivision: Subdivision`…
  patterns?: PatternPools
  figures?: FixedFigure[]     // C7 — see Step A5
}
```

The five rules of C1 that bear on this epic:

- **The hat key is spelled `hatClosed`, and it replaces whichever pool applies** —
  `HAT_PATTERNS` for a non-riding feel, `HAT_PUNCTUATION_PATTERNS` for a riding
  one. Epic 1's D1 settled this on the evidence that Epics 2, 3 and 4 all read
  the key under that name and all three read it as the non-riding pool. The
  `events.ts` hat fallback this spec carried in its Step A7 is **deleted**: there
  is no `events.ts` edit left for the hat.
- **A declared pool replaces, never extends.** That is what lets a one-drop rule
  out every figure that hits step 0.
- **A pool must be non-empty, its steps integers inside `0…15`.** `assertPatterns`
  runs before the first draw and throws naming the template id and the voice.
- **The order, count and stream of the seven existing draws are exactly today's**,
  and `MUSIC_LABEL` is untouched. C2's draw sites are
  `pick(rhythmRng, pools?.kick ?? KICK_PATTERNS)` and its siblings — one `pick`
  each, as today. This is why AC12 can hold at all.
- **`patterns.kit` is the only key that adds a draw**, on its own `KIT_LABEL`
  stream, and **a template may declare `PLACEMENTS[id].snare` or `patterns.kit`,
  never both** — `assertPatterns` rejects the pair. Reggae's snare is fixed, not
  drawn, so it takes the `PLACEMENTS` road and declares no `kit`.

And two contracts this epic reads but does not use as its primary road:

- **C7's `FixedFigure`** — `{ voice, bars: number[][] }`, emitted in **every**
  bar including the fill and variation bars, zero RNG draws, and **a figure
  naming `rim` or `hatOpen` suppresses that voice's placement line**. That gives
  Step A5 a second home for the beat-3 rim; the trade-off is recorded there.
- **C8** — `patterns`' keys are frozen and complete, and `FeelTemplate` beside
  them is append-only under four conditions. This epic adds no field, so C8 does
  not bind it.
- **C4** — `npm run grooves:add 6 -- --template <id>` is the documented
  invocation; an unknown id throws before the pack loads and writes nothing. And
  `addGrooves` now passes its own `heardIn` table into `writeManifest`, so a mint
  no longer empties `HEARD_IN`. Step C2 depends on that fix.
- **Two to four distinct flavours per template, overlap allowed**, checked by
  C3's `flavourFailures` predicate rather than by an inline assertion.

### This epic's own

```ts
// scripts/grooves/templates/reggae-one-drop.ts   (new)
export const reggaeOneDrop: FeelTemplate = {
  id: 'reggae-one-drop',
  tempoRange: [70, 80],   // reserved, see below
  swing: 0.04,            // reserved, see below
  subdivision: 8 | 16,    // the musician's
  passes: 2,              // forced by R11, see below
  flavours: [/* 2–4, the musician's — Step A2 */],
  voices: [/* includes kick, snare, hatClosed, hatOpen, bass, comp — see below */],
  patterns: {
    kick: /* every member's minimum step is exactly 8 */,
    comp: /* every step off-beat */,
    hatClosed: /* every step off-beat */,
  },
  /* humanize, gain, pan, density — the musician's, bounded by R8 and R10 */
}
```

```ts
// scripts/grooves/events.ts
PLACEMENTS['reggae-one-drop'] = {
  snare: /* [] or [8] — Q2. Never containing 4 or 12 */,
  rim:   [8],
  rimBars: /* [0,1,2,3] or a subset — AC4 reads "every bar the placement declares" */,
  // hatOpen: omitted keeps DEFAULT_PLACEMENT's [14], which is an off-beat
}

FILLS['reggae-one-drop'] = {
  fill: {
    kick: [8],   // mandatory: every bar's earliest kick is beat 3 (AC3)
    /* snare / rim / tom lines, none of them on 4 or 12 (AC5) */
  },
}
```

**`off-beat`, defined once so AC6 is testable.** A step is off-beat when its
position on the sixteenth grid is not a quarter:

```ts
const isOffBeat = (step: number, subdivision: number) =>
  ![0, 4, 8, 12].includes((step * 16) / subdivision)
```

At subdivision 8 the skank steps `[2, 6, 10, 14]` resolve to `[1, 3, 5, 7]`, and
each of those maps back to 2, 6, 10, 14 — off-beat. Odd sixteenths are off-beat
too, so a figure may carry one; a quarter may not.

**Settled in Epic 1's C9 — the registry reservation.** `templates/index.test.ts`
asserts swing values and `lo-hi` tempo strings unique across the registry, and
also that every swing is `> 0`, so R1's "at or near zero" is a small positive
number rather than zero. Epic 2's claim was read by Epic 1, which found its own
bossa band `(0, 0.05]` overlapping it and narrowed bossa to `(0, 0.02)` — its
D6. **C9 is now where the reservation lives**, and it grants Epic 2:

| Field | Reggae's claim | C9 |
| :-- | :-- | :-- |
| `swing` | **0.04**, band 0.03–0.05 | granted; `bossa-nova` narrowed to `< 0.02`, `second-line` takes 0.20–0.26, `boom-bap` 0.30–0.40 |
| `tempoRange` | **`[70, 80]`** | granted; distinct as a pair from `half-time`'s `[68, 80]` and `open-ballad`'s `[62, 74]` |

Taken today: 0.02, 0.06, 0.18, 0.28, 0.44, 0.64. `passes` needs no reservation —
nothing asserts it unique.

**Loop length, measured.** The longest slow-feel file committed today is
`groove-51` — `open-ballad`, 67 bpm, **28.71 s**. Reggae at `passes: 2` renders
eight bars: 27.43 s at 70 bpm, 24.00 s at 80. At `passes: 4` it would be 54.86 s,
which is R11's argument in numbers. AC9's ceiling is 28.71 s, and Step I3
re-measures it rather than trusting this line.

**Test commands.** Tracks A and B own only generator-tier files
(`docs/music.md` routes to the generator tier — `scripts/tiers.test.ts`), so both
run `npm run test:gen`. Track C's mint rewrites
`src/features/daily-groove/data/grooves.generated.ts`, so Track C and every
integration step run `npm run test:all`.

## Tracks

### Track A — the template, and the three absences

- **Goal** — `reggae-one-drop.ts` exists and renders, from `buildEvents`
  directly: no kick on beat one and the first kick of every bar on beat 3, a rim
  with it, no snare on 2 or 4, the hat and the comp on the off-beats, a bass
  loud enough to carry it, inside a density band measured over 120 seeds, at two
  passes.
- **Owns** — `scripts/grooves/templates/reggae-one-drop.ts` *(new)*,
  `scripts/grooves/reggae.test.ts` *(new)*, `scripts/grooves/events.ts`.
  **Re-checked against Epic 1's frozen C1:** the hat no longer needs an
  `events.ts` change, so what is left there is two additive entries — one in
  `PLACEMENTS` (Steps A5, A6) and one in `FILLS` (Step A4). Track A still owns
  the file, for two lines rather than three.
- **Role** — `musician`. Every decision in it is a decision about what the groove
  sounds like: the kick figures, the skank, the subdivision, the mix, the
  humanize, the density band, the mode list. `/implement-feature` runs the
  musician turn first and the implementer turn second, as for any generator unit.
- **Depends on** — Epic 1's `patterns` contract above, and nothing else. Its
  tests import `reggaeOneDrop` from the template module **directly**, never
  through `templateById`, so it does not wait on Track C.
- **Parallel with** — Track B's assertion-writing, and Epics 3 and 4's
  equivalents. It shares `events.ts` with those two epics as two additive lines.
- **Done when** — `npm run test:gen` is green with `reggae.test.ts` asserting
  R3–R8, R10 and R11, and the 120-seed density measurement recorded in the step's
  report.

*Note on ownership:* `events.ts`, the template file and `reggae.test.ts` cannot be
split. The `PLACEMENTS` entry is what makes the template's snare and rim
assertions pass, the `FILLS` entry is what makes them pass *in the fill bar*, and
the template is red until both exist. A track that cannot be given disjoint files
is not a track, so these are one. If Q2 sends the rim to `template.figures`
instead of `PLACEMENTS`, the `events.ts` share shrinks to the `FILLS` entry
alone; the track's boundary does not move.

### Track B — the document says what the template declares

- **Goal** — `docs/music.md`'s feel table carries a `reggae-one-drop` row whose
  every cell matches the template's own declaration, a sentence naming the hat
  and the bass as what keeps time, and the `PLACEMENTS` paragraph extended to
  the first template that empties a placement rather than moving it. Guarded by
  assertions that read the document from disk and compare it against
  `allTemplates()`.
- **Owns** — `docs/music.md`, `scripts/grooves/docs.test.ts`
- **Role** — `implementer`. Its product is prose and the test that pins it; the
  musical judgements it records were settled in the PRD and by Track A.
- **Depends on** — Track A's landed template, for the values in the row. Its
  *assertions* depend on nothing: they are written over `allTemplates()`, so they
  cover Epic 1's bossa row and Epics 3 and 4's rows without an edit.
- **Parallel with** — Track C. They share no file.
- **Done when** — `npm run test:gen` green, and every cell of the new row is
  checked against the code rather than against a literal.

### Track C — registered, and six grooves behind it

- **Goal** — `reggae-one-drop` in the registry with six grooves in the
  catalogue, all seven gate checks passing for each, the manifest and lock
  rebuilt, and `npm run test:all` green.
- **Owns** — `scripts/grooves/templates/index.ts`,
  `scripts/grooves/templates/index.test.ts`,
  `scripts/grooves/catalogue.json`, `scripts/grooves/grooves.lock.json`,
  `public/grooves/groove-NN.mp3` (the six it mints),
  `src/features/daily-groove/data/grooves.generated.ts`,
  `src/features/daily-groove/data/grooves.generated.test.ts`
- **Role** — `musician`. It owns generator files, and its judgement calls are
  musical: whether a gate rejection is a bad seed or a bad template, and whether
  a flavour list that clears the dominance cap is still the right list.
- **Depends on** — Track A, complete and green. And, across epics, on the mint
  slot: it is the serial part of wave 2.
- **Parallel with** — Track B.
- **Done when** — `npm run test:all`, `npm run lint` and `npm run build` are
  green with thirty-six-plus-six grooves in the catalogue and six of them
  `reggae-one-drop`.

## Execution waves

- **Wave 1:** Track A. Parallel with Epic 3's and Epic 4's template tracks.
- **Wave 2 (parallel):** Track B, Track C. Track C queues behind whichever of
  Epics 2, 3 and 4 is minting; Track B does not queue at all.
- **Wave 3:** Integration and verification — the whole catalogue through the
  gate, the no-re-render proof, the file durations, the listening sign-off, the
  full set.

There is no wave that both writes a template and mints. That is deliberate: the
mint is minutes and the template is the work, and a mint against a template
still being tuned would have to be thrown away.

## Implementation

### Track A — the template, and the three absences

Every step's assertions live in a new `scripts/grooves/reggae.test.ts`, importing
`reggaeOneDrop` from `./templates/reggae-one-drop.ts` directly. Start with a
sanity case in the shape of the existing structural tests — the module exports
`reggaeOneDrop`, its `id` is `'reggae-one-drop'`, and `buildEvents` returns
events for seed 1 — so a later rename cannot make the rest of the file pass
vacuously.

#### Step A1 — a slow straight feel of its own

Covers: R1, AC1

- **Test first** — `reggae.test.ts`: `reggaeOneDrop.tempoRange[0] >= 70` and
  `[1] <= 80`; `lo < hi`; `swing > 0` and `swing <= 0.05`; `subdivision` is 8 or
  16; `voices` contains `kick`, `snare`, `hatClosed`, `hatOpen`, `bass`, `comp`
  and no duplicates; `voices` contains none of `claves`, `cowbell`, `rideBell`,
  `ride`; `gain[v]` and `pan[v]` are numbers for every `v` in `voices` with
  `pan` inside `[-1, 1]`; `humanize.lean.snare > 0`, `lean.hatClosed <= 0`,
  `lean.hatOpen <= 0`, every leaned voice is played; `0 < driftDepth <= 0.01`;
  `0 < humanize.velocity < 0.5`; `0 < timingMs < ((60 / 80) * 4 / subdivision) * 500`.
  Run it: fails with `Cannot find module './templates/reggae-one-drop.ts'`.
- **Implement** — `scripts/grooves/templates/reggae-one-drop.ts`. `tempoRange`
  `[70, 80]` and `swing` `0.04` are reserved in Contracts and are not the
  musician's to move without re-reading the reservation. Everything else is
  theirs. Starting proposals, all tuning knobs under Step I4's sign-off:
  - `subdivision: 8`. A one-drop's whole vocabulary — the skank, the drop, the
    off-beat hat — is eighths; the sixteenth grid buys a finer humanize
    resolution nothing in the style asks for. Off-beat sixteenths remain
    reachable through `gridded` if a kick figure wants a push.
  - `voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'bass', 'comp']`.
    No toms: the fill is the drop, not a tom run. `rim` is required by R4.
    `snare` and `hatClosed` are required by `index.test.ts`'s *"plays drums, a
    bass and a comp"*, so neither can be dropped even where it is silent.
  - `humanize: { timingMs: 15, velocity: 0.1, lean: { snare: 14, hatClosed: -3, hatOpen: -3, rim: 6 }, driftDepth: 0.007 }`.
    A one-drop lays back; the snare's lean is the largest in the set after
    `half-time`'s 15.
  - the mix goes in Step A9.
- **Green when** — the sixteen shape assertions pass; nothing else in
  `npm run test:gen` moves, because the template is not yet registered.
- **Refactor** — none.

#### Step A2 — two to four flavours, every one already offered

Covers: R2, AC2

- **Test first** — `reggae.test.ts`: `flavours.length` is between 2 and 4;
  `new Set(flavours).size === flavours.length`; every entry is in `FLAVOURS`
  from `src/lib/theory/names.ts`; `flavours` does not contain `locrian`.
  Run it: fails with `expected 0 to be greater than or equal to 2` if the list
  is still a placeholder.
- **Implement** — the `flavours` list. `new-styles.md` proposes aeolian,
  mixolydian and ionian; the list is the musician's, and how much room it has
  depends on Epic 1's Q1 — see the conditional below. The
  measured counts to work from, over the thirty committed grooves:
  mixolydian 3, dorian 3, aeolian 3, lydian 3, ionian 3, phrygian 3,
  phrygian-dominant 3, blues 3, harmonic-major 2, harmonic-minor 2,
  melodic-minor 1, lydian-dominant 1 — plus whatever Epic 1's bossa added.
  **Once the first groove is minted this list is frozen** (`docs/music.md`,
  *What must never change*): the draw is `pick(musicRng, template.flavours)`, so
  reordering or editing it re-rolls the mode of every seed on the template.
  **The dominance guard is Epic 1's, not this epic's** — it owns both copies and
  its own Q1 asks whether to replace the guard's shape rather than its number.
  This step is conditional on that answer, and the condition is the only thing
  left of this spec's superseded Q3:
  - **Epic 1's Q1 answered B, C or D** — the guard stops being sensitive to a
    floor of one, and reggae's list is chosen musically with no arithmetic
    constraint at all. `new-styles.md`'s aeolian / mixolydian / ionian stands.
  - **Epic 1's Q1 answered A** — a literal 5× over a floor of 1 allows a maximum
    of 5, and `ionian` would be offered by `bright-straight`, bossa **and**
    reggae, landing near 7. Then the list has to clear the cap: swap `ionian` for
    a mode with fewer grooves behind it, or declare two flavours instead of
    three. Measure the counts after Epic 1's mint rather than from the table
    above, and say in the report that the list was constrained by a test.
  Either way, **do not widen either copy of the cap from this epic.** They are
  Epic 1's files in this feature, and a second widening from here would read as
  the guard being in the way.
- **Green when** — the four assertions pass.
- **Refactor** — none.

#### Step A3 — the kick pool leaves beat one empty

Covers: R3, AC3

- **Test first** — `reggae.test.ts`, against the declared pool with no groove
  built: the pool exists and is non-empty; no member contains `0`; every member
  is ascending and duplicate-free with every step in `0…15`; and
  `Math.min(...member) === 8` for **every** member — the requirement is not
  merely "no step 0" but "the first kick is beat 3", and a member starting at 6
  would satisfy the first and break the second. Also: no member of the pool
  deep-equals a member of the shared `KICK_PATTERNS`, so the pool is doing work.
  Run it: fails with `expected undefined to be truthy` — `patterns.kick` is not
  declared yet.
- **Implement** — the `patterns.kick` pool. Candidates for the musician, all on
  the sixteenth grid, all with minimum 8:
  - `[8]` — the bare drop. One kick a bar, which is the style at its most
    literal.
  - `[8, 14]` — the drop plus a pickup into the next bar's silent one.
  - `[8, 11]` — the drop with a sixteenth push off beat 3.
  - `[8, 10, 14]` — the busiest reading still worth calling a one-drop.

  Three members is the shape of every other kick-ish pool in the file; the choice
  is heard, not argued. The density budget is Step A10's.
- **Green when** — the five pool assertions pass.
- **Refactor** — none. Do not touch the shared `KICK_PATTERNS`: appending to it
  re-renders all thirty committed grooves, which is the wall Epic 1 was built to
  get around.

#### Step A4 — every bar's first kick is beat 3, the fill bar included

Covers: R3, AC3

- **Test first** — `reggae.test.ts`, using the local `barsOf` on a dry clone, at
  seeds 1–24: for every bar of the loop, the bar has at least one `kick` event,
  and the earliest of them sits at `gridded([8], subdivision)[0]`; and the bar's
  full kick step list equals `gridded(m, subdivision)` for exactly one member
  `m` of the declared pool, or the fill phrase's kick line in the fill bar
  (`phraseBars(feel)` names it). Assert the fill bar explicitly rather than
  excluding it — the fill bar is the whole reason this step exists. Run it:
  fails with `expected 0 to be 4` on bar 7 (`DEFAULT_FILL` puts the kick on step
  0, which at subdivision 8 is step 0, not 4).
- **Implement** — `scripts/grooves/events.ts`: the `FILLS['reggae-one-drop']`
  entry, with `kick: [8]`. `FILLS[template.id] ?? { fill: DEFAULT_FILL }` is a
  replacement, not a spread, so declaring the entry removes `DEFAULT_FILL`
  entirely. `passes: 2` means `middlePassOf(2)` is `null` and no variation bar
  ever plays, so only `fill` matters; `withoutToms(fill)` still computes a
  variation phrase and it is never reached.
  A one-drop's fill is the drop with the kit answering it — proposals:
  `{ kick: [8], snare: [8, 11, 14], rim: [8] }`, or, sparser,
  `{ kick: [8], rim: [8], snare: [14] }`.
- **Green when** — all eight bars at all twenty-four seeds carry a kick whose
  earliest event is beat 3.
- **Refactor** — none. Resist declaring the fill as `{ ...DEFAULT_FILL, kick: [8] }`:
  its snare line still holds step 4 and would break Step A6.

#### Step A5 — the rim sounds with the kick on beat 3

Covers: R4, AC4

- **Test first** — `reggae.test.ts`, on a dry clone at seeds 1–24: in every bar
  the placement declares a rim, there is a `rim` event whose step equals the
  bar's earliest `kick` step; and there is no `rim` event in any bar the
  placement does not declare. Derive the declared bars from the mechanism the
  template actually uses — every bar if the rim is a `figures` entry, otherwise
  `PLACEMENTS['reggae-one-drop'].rimBars ?? DEFAULT_PLACEMENT.rimBars` — never
  from a literal, so AC4's "every bar the placement declares" is read off the
  declaration. Run it: fails with `expected [ 7 ] to equal [ 4 ]` — the inherited
  `rim: [15]` pickup.
- **Implement** — the rim has two homes now that Epic 1's C7 is frozen, and the
  choice is the musician's, folded into Q2 because it is the same decision about
  what sounds on beat 3:
  - **`PLACEMENTS['reggae-one-drop']` gains `rim: [8]` and `rimBars`.** The
    rim emission sits inside `buildEvents`'s ordinary-bar branch, so a
    placement rim is **absent from the fill bar**. `rimBars: [0, 1, 2, 3]` is
    recommended over inheriting `[1, 3]`: R4 reads as a fixed part of the groove
    rather than a pickup, and the rim is the only voice besides the kick marking
    beat 3.
  - **`template.figures = [{ voice: 'rim', bars: [[8]] }]`.** C7 emits a fixed
    figure in **every** bar, fill bar included, at zero RNG cost, and a figure
    naming `rim` suppresses the voice's placement line — so the two cannot be
    declared together and there is nothing to reconcile. This is the road that
    puts the rim on the drop in the fill bar too, which is what "the fill is the
    drop" argues for.

  Whichever is chosen, AC4's "every bar the placement declares" is satisfied,
  because the test derives the declared bars from the mechanism rather than from
  a literal.
- **Green when** — the coincidence holds in every declared bar at every seed.
- **Refactor** — none.

#### Step A6 — the backbeat does not survive

Covers: R5, AC5

- **Test first** — `reggae.test.ts`:
  - a unit case with no groove built: `placementFor` is not exported, so assert
    the semantics through `PLACEMENTS` and `DEFAULT_PLACEMENT` — the entry
    declares a `snare` key, and `{ ...DEFAULT_PLACEMENT, ...PLACEMENTS['reggae-one-drop'] }.snare`
    contains neither 4 nor 12. This is the assertion that says *replaces*, not
    *adds*, and it fails if someone later "fixes" the spread into a merge.
  - a rendered case, on a dry clone at seeds 1–24, over **every** bar including
    the fill bar and including ghost-velocity events: no `snare` event's
    sixteenth-grid position is 4 or 12.

  Run it: the rendered case fails with `expected [4, 12] not to contain 4`
  before the entry exists.
- **Implement** — `scripts/grooves/events.ts`: the `snare` key of the
  `PLACEMENTS` entry, and the fill phrase's snare line from Step A4 kept off 4
  and 12. Q2 settles whether the key is `[]` (no snare in an ordinary bar; the
  snare survives as ghost notes only) or `[8]` (snare with the kick and rim on
  beat 3, which is what a rimshot one-drop actually is). Either clears R5.
  `ghostSteps` forces every ghost onto an odd step, so ghosts can never land on
  4 or 12 and need no guard.
  **Reggae declares no `patterns.kit`.** Epic 1's C1 gives a drawn snare figure
  that home and rejects a template declaring `PLACEMENTS[id].snare` and
  `patterns.kit` together. A one-drop's snare is fixed, not drawn — the whole
  point is that it does not vary — so `PLACEMENTS` is the right road and `kit`
  is Epic 3's. Assert `reggaeOneDrop.patterns.kit` is `undefined`, so the
  exclusivity can never be tripped by a later edit.
- **Green when** — both cases pass, at every seed, in every bar.
- **Refactor** — none.

#### Step A7 — the hat plays the off-beats, and nothing else keeps time

Covers: R6, AC6

- **Test first** — `reggae.test.ts`:
  - the declared hat pool is non-empty; every member is ascending,
    duplicate-free, inside `0…15`, and **every step of every member is
    off-beat** by the `isOffBeat` definition in Contracts.
  - on a dry clone at seeds 1–24: every `hatClosed` and `hatOpen` event in the
    loop sits on an off-beat step; the `hatClosed` line of an ordinary bar
    equals `gridded(m, subdivision)` minus the open-hat steps for exactly one
    member `m`, the same `m` in every ordinary bar.
  - the kick sounds on no quarter but beat 3 — the half of R6 that says the
    groove does not keep time from a downbeat kick. This follows from A4 but is
    asserted here because it is what "the hat and the bass, not a kick on the
    downbeat" means.

  Run it: fails with `expected 0 to be off-beat` — with no `hatClosed` key the
  draw falls back to `HAT_PATTERNS`, whose first member is every eighth and so
  includes all four quarters.
- **Implement** — `patterns.hatClosed` on the template, and **nothing in
  `events.ts`**. Epic 1's C1 spells the key `hatClosed` and states that it
  replaces whichever hat pool the template would otherwise draw, riding or not,
  and C2's draw site is already
  `grid(pick(rhythmRng, pools?.hatClosed ?? (rides ? HAT_PUNCTUATION_PATTERNS : HAT_PATTERNS)))`.
  Reggae does not ride, so its declared pool replaces `HAT_PATTERNS`.
  Pool candidates: `[2, 6, 10, 14]` — the skank, all four off-beats;
  `[2, 6, 10, 13, 14]` — with a sixteenth flick into the bar line;
  `[2, 6, 10]` — leaving the "and" of 4 to the open hat alone.
  Note that leaving `hatOpen` out of the `PLACEMENTS` entry inherits
  `DEFAULT_PLACEMENT.hatOpen = [14]`, which is off-beat and takes step 14 off the
  closed hat — a closed hat on 2, 6, 10 and an open hat on 14. That is a real
  reggae hat and costs nothing; declaring `hatOpen: []` instead is the
  alternative, and leaves the voice declared but silent.
- **Green when** — every hat event at every seed is off-beat.
- **Refactor** — none.

#### Step A8 — the comp plays the skank

Covers: R7, AC6

- **Test first** — `reggae.test.ts`: the declared comp pool is non-empty, every
  member ascending, duplicate-free, inside `0…15`, and every step off-beat; no
  member deep-equals a member of the shared `COMP_PATTERNS` (whose `[0, 10]`
  hits a quarter). On a dry clone at seeds 1–24: every `comp` event sits on an
  off-beat step, and the distinct comp steps of a bar equal
  `gridded(m, subdivision)` for exactly one member `m`. Run it: fails with
  `expected 0 to be off-beat` on the seed that draws `[0, 10]`.
- **Note on "short"** — R7 asks for "a short chord", and the comp's note length
  is not a knob this epic has. `buildEvents` emits every comp event as
  `add('comp', bar, step, 4, …)` — four sixteenths, one beat — for every feel,
  and shortening it would shorten the comp on all six existing feels and
  re-render them. So the skank's shortness comes from where it lands and from
  the sample's own envelope, not from `durationSec`. Assert the duration equals
  four sixteenths, i.e. that this epic did **not** change it, and say so in the
  report rather than leaving R7 looking half-met.
- **Implement** — the `patterns.comp` pool. Candidates:
  `[2, 6, 10, 14]` — the four-square skank; `[6, 14]` — the half skank, chords
  on the ands of 2 and 4 only; `[2, 6, 10]`. The comp is the densest voice in the
  groove — each step fires once per voicing tone, three or four notes — so the
  pool is also the density budget's biggest lever; see Step A10.
- **Green when** — every comp event at every seed is off-beat.
- **Refactor** — none.

#### Step A9 — the bass carries the pulse

Covers: R8

- **Test first** — `reggae.test.ts`: `gain.bass` is the highest gain the template
  declares — strictly greater than `gain.kick`, `gain.comp`, `gain.snare` and
  every hat — and greater than every other template's `gain.bass`
  (`allTemplates()` is not importable here without pulling in the registry, so
  compare against the five committed literals read from their own modules, or
  defer this half of the case to Step C1, which already imports the registry).
  Nothing new is exported from `events.ts`: assert the module's export list is
  unchanged — this epic exports nothing new from that file. Run it: fails with
  `expected -1 to be greater than -8`.
- **Implement** — the `gain` and `pan` blocks. R8 says the prominence comes from
  `gain`, not from anything new in `events.ts`, so this is a mix decision and
  nothing else. Starting proposals — `shuffle` sits its bass at `+1` and is the
  loudest today:
  - `gain: { kick: -9, snare: -8, hatClosed: -10, hatOpen: -17, rim: -9, bass: 2, comp: -6 }`
    — the bass above everything, the comp pushed back because a skank is a
    percussion part rather than a pad, the rim up with the kick because together
    they are the only thing on beat 3.
  - `pan: { kick: 0, snare: -0.05, hatClosed: 0.3, hatOpen: 0.32, rim: -0.28, bass: 0, comp: 0.24 }`
    — the rim opposite the hats, so the two halves of the off-beat are not
    stacked in one ear.
  A `bass` gain of `2` is the highest in the set and the peak normaliser will
  pull the master back accordingly; watch the loudness check in Step I1 rather
  than the numbers here.
- **Green when** — the gain-ordering assertions pass and
  `templates/index.test.ts`'s existing *"gives each template its own mix"* case
  still holds once Track C registers.
- **Refactor** — none.

#### Step A10 — a density band declared for what a one-drop plays

Covers: R10, AC8

- **Test first** — `reggae.test.ts`: over seeds 1–120 on the real template, the
  minimum events per bar is at or above `density.minPerBar` and the maximum at
  or below `density.maxPerBar`; and a case pinning the band as literals, so
  widening it later is a deliberate edit to a test that names the numbers rather
  than a quiet change to a template. Report the measured `lowest` and `highest`
  in the step's output. Run it: fails with `expected Infinity to be greater than
  or equal to 0` before the band is declared.
- **Implement** — measure first, declare second. A rough budget per ordinary bar
  at subdivision 8 with a three-note voicing: kick 1–3, rim 0–1, snare 0–1 plus
  2–3 ghosts, hat 3–4, bass ~3, comp 3×(2–4 steps) = 6–12. That is roughly
  13–27 events a bar, against `open-ballad`'s 8–30 and `half-time`'s 14–48.
  Proposed starting band `{ minPerBar: 9, maxPerBar: 32 }` — but the number that
  goes in the template is the measured one with headroom, taken **before** any
  mint. **If a seed falls outside the band, thin or thicken the figures, not the
  band**: the comp pool is the biggest lever, the kick pool the second. R10 and
  AC8 both say the band accommodates the style rather than the style being
  busied up to clear a floor written for `straight-funk` — and AC8 says in as
  many words that the band was not widened after a failure, so a widening after
  Step C2 is a visible violation.
  If figures cannot bring every seed inside a band that is honest about the
  style, **stop and report**: name the seed, the measured events per bar and the
  pools tried.
- **Green when** — the 120-seed measurement is inside the declared band and the
  band is pinned as literals.
- **Refactor** — none.

#### Step A11 — two passes, because four at 70 bpm is a minute of file

Covers: R11, AC9

- **Test first** — `reggae.test.ts`: `passes === 2`;
  `middlePassOf(reggaeOneDrop.passes)` is `null`, so no variation bar is
  reachable and the fill phrase is the only phrase; and the computed loop
  length at the slow end of the range,
  `4 * passes * 4 * 60 / tempoRange[0]`, is at or below the longest loop the
  existing two-pass feels can produce, computed the same way from
  `half-time` and `open-ballad` rather than from a literal. Run it: fails with
  `expected 4 to be 2` if the template started at four passes.
- **Implement** — `passes: 2`. The arithmetic, for the record: eight bars at
  70 bpm is 27.43 s and at 80 bpm 24.00 s; `open-ballad` at 67 bpm renders
  28.66 s, which is the longest committed slow-feel loop. Four passes would be
  54.86 s.
- **Green when** — the three assertions pass.
- **Refactor** — none. Step I3 measures the rendered mp3s; this step measures the
  declaration, and both are needed because a duration is a property of the file
  and a pass count is a property of the template.

### Track B — the document says what the template declares

Every step adds cases to a `describe('the music document')` block in
`scripts/grooves/docs.test.ts`, reading `docs/music.md` from disk with the file's
existing `read()` helper. Feature-24 Epic 2's Track C may already have created
that block; if it has, add to it, and if it has not, create it. Start with a
sanity case in the shape of the two blocks already there — the file is over
8000 characters and matches `/^## The .+ feels$/m` (Epic 1 renames the heading, so
do not match `six`) — so a rename cannot make the rest pass vacuously.

#### Step B1 — the feel table row, checked against the code

Covers: R13, AC11

- **Test first** — `docs.test.ts`: parse the feel table's rows into a map keyed
  by the backticked id in the first cell. Then, **for every template in
  `allTemplates()`**: a row exists; its BPM cell reads
  `${tempoRange[0]}–${tempoRange[1]}`; its Subdiv cell is `String(subdivision)`;
  its Swing cell is `String(swing)`; its Flavours cell, split on `', '`, equals
  the template's `flavours` mapped through the display form the other rows
  already use; its Passes cell is `String(passes)`; its Density cell reads
  `${density.minPerBar}–${density.maxPerBar}`; and its Pulse cell reads `ride`
  if the template declares `ride` and `hat` otherwise. Plus: the table has
  exactly `allTemplates().length` rows, so a template can never be registered
  without a row. Run it: fails with
  `expected undefined to be defined — no row for reggae-one-drop`.
- **Implement** — `docs/music.md`: one row in the feel table. Written over
  `allTemplates()`, this case covers Epic 1's bossa row and Epics 3 and 4's rows
  too, and needs no edit when they land — which is what keeps `docs.test.ts` off
  the shared-file list in any meaningful sense.
- **Green when** — every registered template's row agrees with its declaration
  cell by cell.
- **Refactor** — none. Do not hard-code seven, eight or eleven anywhere in the
  block.

#### Step B2 — what keeps time when nothing is on beat one

Covers: R13, AC11

- **Test first** — `docs.test.ts`:
  - the paragraph under the feel table names `reggae-one-drop`, says its pulse
    is the hat and the bass, and says beat one carries no kick.
  - the `DEFAULT_PLACEMENT` / `PLACEMENTS` paragraph — which today names
    `half-time`'s snare on `[8]` as "the wide backbeat that is the whole reason
    the table exists" — gains a sentence saying that a `PLACEMENTS` key
    *replaces* the default rather than merging with it, and that
    `reggae-one-drop` is the first template to spend that on emptying a
    placement rather than moving one. Assert the document contains both
    `replaces` and `reggae-one-drop` inside that paragraph, and that the
    `half-time` sentence is still there — so the edit was additive.
  - the `Where to change what` table gains no new row: the existing
    "kick / hat / bass / ghost / bongo / comp figures" row already points at the
    pools, and Epic 1's R26 adds the per-template `patterns` row beside it.
    Assert the `patterns` row exists, so this epic notices if Epic 1 did not add
    it.
- **Implement** — `docs/music.md`: two sentences and one paragraph extension.
  The `patterns` row is Epic 1's; if the assertion fails, the fix is one row
  here and a note in the epic's report, not a re-plan.
- **Green when** — the four assertions pass and no existing `docs.test.ts` case
  moves.
- **Refactor** — none.

### Track C — registered, and six grooves behind it

#### Step C1 — in the registry, and the registry says what it means

Covers: R1, R2, AC1, AC2

- **Test first** — `scripts/grooves/templates/index.test.ts`:
  - `templateById('reggae-one-drop')` returns the template and does not throw.
  - a new case in `describe('flavour coverage')`, beside the existing per-template
    blocks in *"pairs each flavour with a feel that suits it"*:
    `[...templateById('reggae-one-drop').flavours].sort()` equals the settled
    list.
  - the existing *"does not give every template the same subdivision, swing or
    tempo range"* case: `new Set(map(swing)).size` and
    `new Set(map(tempoRange.join('-'))).size` both equal `allTemplates().length`.
    If Epic 1 left them reading `TEMPLATE_COUNT` as a literal, this step's edit
    is to make them read `allTemplates().length` — which is what Epic 1's R9 asks
    for and what stops Epics 3 and 4 conflicting on the same line.
  - the single `TEMPLATE_COUNT` literal, bumped by one from whatever it says when
    this track starts.
  - the deferred half of Step A9: `gain.bass` for `reggae-one-drop` is the
    highest `gain.bass` in the registry.

  Run it: fails with `templateById: unknown template "reggae-one-drop"`.
- **Implement** — `scripts/grooves/templates/index.ts`: one import, one entry in
  `TEMPLATES`, one name in the re-export list. Three additive lines.
- **Green when** — `templates/index.test.ts` is green. **`npm run test:gen` as a
  whole is expected to be red at this point** — `catalogue.test.ts`'s *"draws
  grooves from every template"* has no reggae groove to find. That is why Step C2
  follows immediately and why the two are one unit.
- **Refactor** — none.

#### Step C2 — six grooves, gated

Covers: R9, AC7

- **Test first** — the gate is the test, and it runs inside the mint:
  `addGrooves` renders each candidate and rejects it on any of the seven checks
  before it is written, and `catalogue-gate.test.ts` then re-renders the whole
  committed catalogue through `gateCandidate`. Before minting, add to
  `catalogue.test.ts` — or assert in `reggae.test.ts`, whichever the track
  prefers — that the catalogue holds exactly six `reggae-one-drop` entries.
  Run it: fails with `expected 0 to be 6`.
- **Implement** — in this order, and pull first if another wave-2 epic has minted
  since Track A finished:

  ```
  npm run grooves:add 6 -- --template reggae-one-drop   # Epic 1's C4
  npm run grooves                                       # re-render, and the check below
  npm run grooves:verify
  ```

  `--` is C4's documented invocation, because npm's own argument handling is not
  part of that contract.
  **`npm run grooves` is now a check, not a repair.** This spec's first draft
  made it mandatory because `addGrooves` called `writeManifest` with no
  `heardIn` argument and `renderManifest` then omits the whole `HEARD_IN` export,
  which fails the app tier. Epic 1's C4 fixes that at the source: `AddOptions`
  gains `heardIn?: HeardInTable` defaulting to `readHeardIn()` and passes it
  through, and its Step D6 asserts a mint no longer empties the table. So run
  `npm run grooves` to re-render and to give Step I2 its measurement — and if
  `HEARD_IN` is empty after the mint, Epic 1's D6 did not land and that is the
  finding, not something to patch here.
  Without the `--template` flag `addGrooves` mints by scarcity and would fill
  `open-ballad`, which holds two grooves against everyone else's six.
  A gate rejection is logged per candidate with the check and the measured value.
  Read them: `density` is Step A10's problem and is fixed in the figures;
  `loudness` is Step A9's and is fixed in the gains — **never** by moving
  `LOUDNESS_FLOOR_DB`. `harmony` and `pitch` rejections are ordinary — the seed
  is simply skipped. If six are not reachable inside the attempt budget, that is
  a musical problem with the template, fixed in the template rather than by
  shipping four; the PRD's fourth assumption says so.
- **Green when** — six `reggae-one-drop` entries in `catalogue.json`, six mp3s in
  `public/grooves/`, `grooves:verify` reporting no problems, and
  `catalogue-gate.test.ts` accepting all thirty-six-plus.
- **Refactor** — none. Commit the audio, catalogue, manifest and lock together;
  a partial commit signs audio nobody has.

#### Step C3 — the app tier admits the new catalogue

Covers: R9, AC7

- **Test first** — run `npm run test:all` and read the failures. Three literals
  in `src/features/daily-groove/data/grooves.generated.test.ts` move on every
  mint. Epic 1 reaches all three first, in its Steps G3, G4 and G5, so this step
  re-runs behind it rather than discovering them:
  - `it('covers all 30 catalogued grooves')` → `expect(GROOVES).toHaveLength(30)`,
    which Epic 1's G3 has already bumped once. Bump it to the real count. One
    literal; keep it one.
  - the double-accidental case (Epic 1's G5), whose `PAIRS` derive from
    `GROOVES` — six new root × flavour pairs can add spellings the pinned set
    does not hold. Add each new line **only after checking it is the spelling
    concert already shows for that root**, which is what the case's own name
    asserts. A new line that is not is a bug in the answer, not in the test.
  - `it('lets no mode dominate the answers')` — the app-tier copy of the
    dominance guard. **This one is not this epic's to move.** Epic 1 owns both
    copies (its Steps C7 and G4) and its own Q1 decides the guard's shape for
    the whole feature. Run it; if it fails after this epic's mint, the finding is
    that Epic 1's answer did not survive sixty grooves — report it with both
    counts and the mode that broke it, and take it back to Epic 1's Q1. Do not
    widen it from here, and do not let the two copies drift apart.
- **Implement** — the two literal edits this epic's mint genuinely moves, and
  nothing else in that file.
- **Green when** — `npm run test:all` is green, or the only failure is the
  dominance guard and it has been reported to Epic 1 rather than edited.
- **Refactor** — none. Do not rewrite the count assertion to read the catalogue:
  the app must not import from `scripts/`, and `boundary.test.ts` and zone 5 both
  say so from the other side.

#### Step C4 — the existing suite meets a seventh feel

Covers: R9

- **Test first** — `npm run test:gen`. Registering the template puts it inside
  thirty-four `allTemplates()` call sites in `events.test.ts` — the 120-seed
  density case among them — and three in `catalogue.test.ts`. Run them and read
  what they say about a feel with an empty beat one.
- **Implement** — for each failure, decide which kind it is and say so in the
  report:
  - **a genuine problem with the template** — fix the template. Candidates worth
    expecting: *"reaches every flavour a template offers, across enough seeds"*
    (a three-flavour list needs the seed count to reach all three), and
    *"never stacks two hits of one voice on the same step of a coarser grid"* (a
    kick figure and a fill line landing on the same step at subdivision 8).
  - **an assertion that hard-codes the six-feel world** — name it, and re-express
    it as the guarantee it stands for, the way Epic 1's R7 did. Do not delete
    one.

  The two cases most likely to look like the second kind and be the first:
  `events.test.ts`'s *"keeps the straight feels on two and four"* names three
  template ids explicitly and does **not** loop the registry, so reggae is
  outside it by construction — leave it alone. And *"keeps every backbeat snare
  louder than every ghost"* runs on `straight-funk` and a dry clone of it, not on
  `allTemplates()`, so an empty snare placement does not reach it. Verify both
  claims by reading the files rather than by trusting this paragraph.
- **Green when** — `npm run test:gen` and `npm run test:all` are green with no
  assertion deleted.
- **Refactor** — none.

## Integration and verification

#### Step I1 — the whole catalogue through the gate

Covers: R9, AC7

- **Test** — `npm run test:gen`. `catalogue-gate.test.ts` renders every catalogue
  groove and runs all seven checks; it now covers six grooves with nothing on
  beat one. Read the failures, not the summary. The likeliest for this style is
  **loudness**: masters are peak-pinned onto `PEAK_CEILING = 0.891`, so RMS is a
  function of crest factor, and a sparse groove whose loudest transient is a
  kick-and-rim on beat 3 can measure below the `-29 dBFS` floor even though it
  is well balanced. The fix is the mix — Step A9's gains, the bass and the comp
  first — and never `LOUDNESS_FLOOR_DB`. A `density` failure is Step A10's, and
  the same rule applies: the figures move, not the band.
- **Green when** — every catalogue groove passes all seven checks.

#### Step I2 — no groove outside this template re-rendered

Covers: AC12

- **Test** — two instruments, in this order:
  1. `node scripts/grooves/rerender-check.ts` — renders the whole catalogue into
     a scratch directory and compares each mp3's sha256 and byte count against
     the committed lock, then the manifest and catalogue hashes. Every groove
     must report `match`. Run it **before** Step C2 as well, to establish that
     the tree was clean going in; a mismatch found only afterwards cannot be
     attributed.
  2. `npm run grooves` followed by `git status` and `npm run grooves:verify`, as
     AC12 words it. `git status` must show the six new mp3s as additions and
     **no existing mp3 as modified**.
- **What makes it hold, by construction** — the template declares its own pools
  rather than appending to the shared ones, so no pool length changed and every
  existing draw returns what it returned before; and nothing was added to or
  removed from `MUSIC_LABEL` or `RHYTHM_LABEL`, so every committed answer is
  untouched. The two entries this epic adds to `events.ts` are keyed by template
  id, so no other template reads them, and Epic 1's Step E3 is the standing
  evidence that a `patterns` block adds no draw.
- **Green when** — every pre-existing groove matches its committed hash, and
  `grooves:verify` reports no problems.
- **If it fails** — find the file this epic was not supposed to write and revert
  it. Do not rewrite the lock: that signs audio nobody rendered.

#### Step I3 — the six files are no longer than the slow feels' longest

Covers: R11, AC9

- **Test** — measure the durations rather than computing them:

  ```
  ffprobe -v error -show_entries format=duration -of csv=p=0 public/grooves/<id>.mp3
  ```

  for the six new ids and for every `half-time` and `open-ballad` groove. The
  measured baseline today is 24.35–28.71 s across those two feels, the longest
  being `groove-51` (`open-ballad`, 67 bpm). Every reggae file must be at or
  under the measured maximum.
- **Green when** — the largest of the six is at or below the largest of the
  existing slow-feel files, and both numbers are recorded in the report.

#### Step I4 — the listening pass, per groove, in a person's words

Covers: R12, AC10

- **Test** — none a machine can run. Hand over the six file paths and what to
  listen for. Do not report that it sounds good.
  - **the one question the gate cannot answer: with beat one empty, does it still
    keep time?** This is the sentence AC10 asks to be recorded and the risk the
    PRD names, and it is per groove, not per template — a figure that works at
    72 bpm may fall apart at 80.
  - the kick and rim on beat 3 read as one event, not as two things that happen
    near each other.
  - the skank is a chord and a hat, not a chord under a hat — the comp and the
    closed hat are on the same steps and can mask each other.
  - the bass is carrying it rather than merely being loud.
  - nothing rings across the loop seam, and the drop re-entering marks it.
  - and the sentence `new-styles.md` bought this epic for: back to back with
    `half-time` and `open-ballad`, does it sound like nothing in the current six?
- **Green when** — a person has played all six in full and their verdict is
  recorded per groove in their own words, either way. A gate pass is not a
  sign-off and does not substitute for one.

#### Step I5 — the full set

- `npm run test:gen`, `npm test`, `npm run test:all`, `npm run lint`,
  `npm run build` — all green, no carried-forward red.
- **`npm run build` runs `prebuild` → `npm run grooves:verify`**, so the lock,
  both manifests, the catalogue and the pack declaration all have to agree with
  what is on disk. This epic writes four lock inputs — `catalogue.json`,
  `public/grooves/`, `grooves.generated.ts` and the lock itself — and Step C2's
  `npm run grooves` is what makes them agree.
- Every R and AC below has at least one step.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, C1 |
| R2 | A2, C1 |
| R3 | A3, A4 |
| R4 | A5 |
| R5 | A6 |
| R6 | A7 |
| R7 | A8 |
| R8 | A9 |
| R9 | C2, C3, C4, I1 |
| R10 | A10 |
| R11 | A11, I3 |
| R12 | I4 |
| R13 | B1, B2 |
| AC1 | A1, C1 |
| AC2 | A2, C1 |
| AC3 | A3, A4 |
| AC4 | A5 |
| AC5 | A6 |
| AC6 | A7, A8 |
| AC7 | C2, C3, I1 |
| AC8 | A10 |
| AC9 | A11, I3 |
| AC10 | I4 |
| AC11 | B1, B2 |
| AC12 | I2 |

## Assumptions

- **A `FILLS` entry is mandatory, not optional.** The PRD's third assumption
  says the template declares one only "if the default fill reads wrong under it".
  `DEFAULT_FILL` puts a kick on step 0 and a snare on step 4, so under AC3
  ("every rendered groove", per bar) and AC5 ("every rendered groove") it does
  not merely read wrong, it fails. Step A4 declares the entry unconditionally.
- **R6's "it is the only voice doing so" means the only voice keeping time.**
  AC6 asserts hat events *and* comp events on off-beat steps, so the sentence
  cannot mean the hat is the only voice on the off-beats. Read as written it
  would forbid the skank R7 requires. Step A7 asserts the hat is off-beat and the
  kick is on no quarter but beat 3, which is what the em-dash clause says.
- **`swing` cannot be zero.** `templates/index.test.ts` asserts
  `swing > 0` for every template, so R1's "swing at or near zero" resolves to a
  small positive value. `0.04` is no longer a proposal — Epic 1's C9 grants it
  (D2).
- **`passes: 2` also means no variation bar.** `middlePassOf(2)` is `null`, so
  the fill phrase is the only phrase and `withoutToms(fill)` is computed and
  never reached. That halves the fill vocabulary this epic has to get right.
- **New scales need no `heard-in.json` entry.** `heardInFailures` fails on table
  entries that *no* groove renders; it does not require a rendered scale to be in
  the table. Nothing is added to `heard-in.json`, and the app's reveal shows
  no "heard in" line for the six new scales — which is the existing behaviour for
  most of the catalogue.
- **Epic 1's `patterns` keys are complete for this epic.** C8 freezes the key
  list, and reggae needs `kick`, `hatClosed` and `comp` — all three present.
  Nothing in the frozen contract blocks a requirement of this epic: R3 through
  R8 each have a declared mechanism, and the one gap the first draft found (the
  hat) is closed by C1's `hatClosed` rule. This epic adds no field to
  `FeelTemplate`, so C8's four conditions do not bind it.
- **`reggae.test.ts` is a new file rather than more cases in `events.test.ts`.**
  `events.test.ts` is 2281 lines and Epics 1, 3 and 4 all touch it; a
  topic-named sibling keeps four epics off one file and follows the pattern
  `catalogue-gate.test.ts`, `docs.test.ts` and feature-24's `riding.test.ts` set.
- **`reggae.test.ts` carries its own copies of `barsOf`, `gridded` and
  `phraseBars`.** All three are file-local to `events.test.ts` and not exported;
  copying three short helpers is cheaper than exporting test scaffolding from a
  file three other epics are editing.
- **Track A's tests import the template module directly, not `templateById`.**
  That is what lets wave 1 finish before the registry moves, and it is why Track
  A shares no file with Track C.
- **`subdivision: 8` is proposed, not required.** R1 leaves it to the musician.
  Everything in this spec is written in sixteenth-grid figures resolved by
  `gridded`, so a switch to 16 changes no assertion — only the resolved step
  numbers, which every case derives rather than hard-codes.
- **The catalogue's ids continue from `highestNumber`, so no id is reserved.**
  `catalogue.test.ts` asserts no id is ever re-issued, and the highest today is
  `groove-52` against thirty entries. Whichever wave-2 epic mints second simply
  continues.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-09-05 — reconciled against Epic 1's frozen Contracts

Four decisions. None was asked as a question of the user: three were settled by
Epic 1's Contracts and Decision log, and the fourth is the consequence of the
third.

**D1. The hat pool is `patterns.hatClosed`, and there is no `events.ts` fallback.**
This spec's first draft carried a one-line change in Step A7 to cover an
ambiguity in Epic 1's PRD R12, which listed the seventh key as "foot hat" — the
name of `HAT_PUNCTUATION_PATTERNS`, the riding pool, which a non-riding feel
never draws. Epic 1's C1 spells the key `hatClosed` and states that it replaces
whichever hat pool the template would otherwise draw; its D1 records that all
three wave-2 epics read it that way and names the deletion of this fallback as
the reason.
Changed: Contracts *From Epic 1* (the risk subsection deleted, C1 quoted
instead), the Architecture table (one row gone), Step A7's *Implement* and
*Green when*, Track A's *Owns*.
Cost of reversal: none — the fallback was contingency, and the contingency did
not fire. Track A still owns `events.ts` for two additive entries, one in
`PLACEMENTS` and one in `FILLS`, so the deletion changes what the track edits
and not what it owns.

**D2. `swing: 0.04` and `tempoRange: [70, 80]` are granted, and the reservation
lives in Epic 1's C9.** Raised here as Q1. Epic 1 read this spec's claim,
found its own bossa band `(0, 0.05]` overlapping the reserved 0.03–0.05 on a
value `templates/index.test.ts` asserts unique across the registry, and narrowed
bossa to `(0, 0.02)` — its D6. C9 is now the registry-wide table and this epic
cites it rather than restating a claim.
Changed: Contracts — *Reserved across wave 2* became *Settled in Epic 1's C9*;
Q1 removed.
Cost of reversal: one line before the mint. After the mint, a re-render of the
six mp3s and a repeat of Step I4's listening pass on all six, because swing is
part of what the sign-off is judging. The answers survive either way: `bpm` comes
from `intBetween` and `root`/`flavour` from draws that swing does not touch.

**D3. The dominance guard is Epic 1's, in both copies, and this spec's Q3 is
superseded.** Q3 asked how reggae's flavour list clears a cap that passes with
zero margin today. Epic 1 owns the generator copy in `catalogue.test.ts` (its
Step C7) and the app-tier duplicate in `grooves.generated.test.ts` (its Step G4),
and its own **Q1** asks whether to replace the guard's shape rather than its
number — quoting this spec's own conclusion that option B was "arguably Epic 1's
to make, not Epic 2's", and computing reggae's arithmetic explicitly: three modes
at +2 each, with `ionian` offered by `bright-straight`, bossa and reggae, landing
near 7 against a floor that stays at 1.
Nothing reggae-local survives as a question. What survives is a **conditional**,
now recorded in Step A2: if Epic 1's Q1 is answered B, C or D the guard stops
being sensitive to a floor of one and reggae's list is a purely musical choice;
if it is answered A — a literal 5× — the list has to clear the cap and Step A2
says how. Step C3 no longer edits the cap and reports a failure back to Epic 1's
Q1 instead.
Changed: Step A2 (the conditional), Step C3 (the cap bullet), the shared-file
protocol table, Q3 removed.
Cost of reversal: none from here — the decision moved to the epic that owns the
files. Had this epic kept it, four epics would each have edited two test files
they do not otherwise own, and the last to mint would have discovered the number.

**D4. `npm run grooves` after the mint is a check, not a repair.** This spec's
first draft made it mandatory, having verified in the working tree that
`addGrooves` calls `writeManifest` with no `heardIn` argument and that
`renderManifest` then omits the whole `HEARD_IN` export. Epic 1's C4 fixes it at
the source — `AddOptions` gains `heardIn?: HeardInTable` defaulting to
`readHeardIn()` — and its Step D6 asserts a mint no longer empties the table.
Changed: Step C2's *Implement*, and the invocation now matches C4's documented
`npm run grooves:add 6 -- --template <id>`.
Cost of reversal: none. If D6 did not land, an empty `HEARD_IN` after the mint is
the finding and it goes back to Epic 1, not patched here.

## Open questions

One question, and it is the one this epic actually owns. Tick an option
(`- [x]`), or write your own, then re-run `/writespec feature-25 epic-2`.
Q1 became D2 and Q3 became D3; the numbering is left as it was so the log's
references still resolve.

### Q2. What sounds on beat 3 — and does it survive the fill bar?

R4 puts the *rim* on beat 3 and R5 forbids a snare on 4 and 12, but nothing says
whether the snare sounds at all. `templates/index.test.ts` requires `snare` in
`voices` for every template, so the voice is declared either way; the question is
what `PLACEMENTS['reggae-one-drop'].snare` holds. Reggae declares no
`patterns.kit` — its snare is fixed, not drawn, and Epic 1's C1 rejects a
template declaring both.

**The rim's home rides along with the answer.** Epic 1's C7 froze
`FeelTemplate.figures`, which emits a fixed figure in *every* bar including the
fill bar and suppresses the voice's placement line. A placement rim is absent
from the fill bar; a `figures` rim is not. If beat 3 is a composite event — kick,
rim and snare together — then it should sound in the fill bar too, and the rim
belongs in `figures`. If the rim is the ordinary-bar signature and the fill is
where the kit answers, `PLACEMENTS` is right. Step A5 carries both roads.

- [ ] A) **`snare: [8]` — the snare sounds with the kick and the rim on beat 3, and the rim goes in `template.figures` so all three sound in the fill bar too** *(recommended — a rimshot one-drop is a rim and a snare struck together, and the rim alone is thinner than the PRD's "kick and rim together on beat 3" is reaching for. `figures` costs no RNG and suppresses the placement line by itself, so there is nothing to reconcile. Reversing after the mint re-renders the six mp3s and voids Step I4's sign-off; reversing before costs one declaration.)*
- [ ] B) `snare: []` — no snare in an ordinary bar; the snare survives as ghost notes only, and beat 3 is kick and rim *(the most literal reading of R4, and the sparsest. `ghostSteps` forces every ghost odd, so AC5 holds trivially. Same reversal cost.)*
- [ ] C) `snare: []` in ordinary bars and a snare in the fill phrase only, with the rim in `PLACEMENTS` *(the drop is the fill and the snare is what answers it; the one option that makes the fill bar audibly different from the seven before it)*
- [ ] D) Mint with A, and if Step I4's listening pass prefers B or C, re-render the six *(honest, and pays the reversal cost on purpose rather than by accident)*
