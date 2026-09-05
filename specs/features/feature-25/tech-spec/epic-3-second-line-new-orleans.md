# Tech spec — Epic 3: Second line / New Orleans

PRD: [../prd/epic-3-second-line-new-orleans.md](../prd/epic-3-second-line-new-orleans.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One template file, and — since Epic 1's contract revision — almost nothing else.
Epic 1's `patterns` block carries an eighth key, `kit?: KitFigure[]`, which is
this spec's own `{ snare, tomHigh?, tomLow? }` shape adopted verbatim and moved
onto the template: drawn once per groove on its own `KIT_LABEL` stream,
replacing `placement.snare` in ordinary bars, mutually exclusive with a
`PLACEMENTS[id].snare` entry and enforced by Epic 1's `assertPatterns`. So the
snare figure, the tom accents, the clave-ish kick, the bass that follows it and
the one-stab comp are all *declarations* in `templates/second-line.ts`, and this
epic's whole diff in `events.ts` is two appended record keys — a `PLACEMENTS`
entry for the open hat and the rim, and a `FILLS` entry for the idiom's fill.

Two things still have to be earned rather than declared. The density band is
**measured** over 120 seeds before the first groove is minted and then pinned as
a literal, which is the only order in which R9 can be honest. And R5's toms
collide with a registry-wide assertion nobody wrote them against —
`events.test.ts`'s *"plays toms, which the figure never does"* lets a tom sound
in the fill bar and **nowhere else, for every template** — so the one existing
test this epic changes is that one, and it is changed by narrowing it to what it
was standing for rather than by exempting a style from it. See Q3.

## Architecture

**Where each change lands.**

| Change | File |
| :-- | :-- |
| tempo, swing, flavours, kit, mix, passes, density, and all five declared pools | `scripts/grooves/templates/second-line.ts` *(new)* |
| registration | `scripts/grooves/templates/index.ts` |
| what the template declares, pinned | `scripts/grooves/templates/index.test.ts` |
| the style's fixed hits (open hat, rim, rim bars) | `scripts/grooves/events.ts` → `PLACEMENTS['second-line']` |
| the fill and the variation | `scripts/grooves/events.ts` → `FILLS['second-line']` |
| the toms stop being the fill's alone | `scripts/grooves/events.test.ts` → one existing case |
| every second-line behaviour this epic asserts | `scripts/grooves/second-line.test.ts` *(new)* |
| six grooves, the manifest, the lock, the audio | `catalogue.json`, `grooves.lock.json`, `public/grooves/groove-NN.mp3`, `src/features/daily-groove/data/grooves.generated.ts` |
| the feel table row and the rim sentence | `docs/music.md`, `scripts/grooves/docs.test.ts` |
| the new grooves join the byte-identity fixture | `scripts/grooves/eventsFixture.ts`, `events.fixture.json` |

Nothing in that list is a mechanism. Epic 1 built the one this epic needs, and
Epic 1's Steps B4, E7 and E8 test it; the cases below test what *this template*
declares and how it sounds.

**The kit figure, as Epic 1 froze it.** One draw, one stream, one branch, all in
`events.ts` already:

```
kitFigure  = pools?.kit ? pick(rngFor(`<tpl>:<seed>:kit`), pools.kit) : null
snareSteps = grid(kitFigure ? kitFigure.snare : placement.snare)
kitToms    = { tomHigh: grid(kitFigure?.tomHigh ?? []), tomLow: grid(kitFigure?.tomLow ?? []) }
# emitted in the ordinary-bar branch beside the snare; fill and variation bars
# still come from FILLS
```

Three properties this epic depends on, all of them Epic 1's to hold:

- **The branch is exclusive**, and `assertPatterns` rejects a template that
  declares both `patterns.kit` and `PLACEMENTS[id].snare`. That is R3's
  "overrides rather than adds to" made structural, and enforced, rather than
  asserted about numbers.
- **The draw is on `KIT_LABEL`**, a stream of its own beside `BONGO_LABEL` and
  `RIDE_LABEL`, so nothing enters `MUSIC_LABEL` or `RHYTHM_LABEL`'s order and no
  committed answer or rhythm moves.
- **The toms travel with the snare.** One drawn figure carries both, because in
  this style they are one gesture.

**Why the toms are `patterns.kit`'s and not `FeelTemplate.figures`'.** Epic 1's
C7 offers a second route — a fixed per-bar figure, zero draws, emitted in every
bar. It is the wrong one here twice over. Musically, a tom accent that stays put
while the drawn snare figure changes underneath it would be arbitrary in five
grooves out of six; the accent answers the figure, so it belongs to the figure.
Mechanically it is not merely worse, it is impossible: C7 requires a tom figure
to leave `bars[BARS_PER_PASS - 1]` empty, and the registry case below forbids a
tom in every bar *except* the last of the loop. The intersection is empty, so a
`figures` tom line could not sound anywhere at all.

**The assertion R5 collides with.** `scripts/grooves/events.test.ts`,
`describe('the fill')`:

```ts
it('plays toms, which the figure never does — R10', () => {
  for (const feel of allTemplates()) {
    const bars = drumBars(feel)          // ghosts filtered out
    const last = bars.length - 1
    expect(toms(bars[last]).sort()).toEqual(['tomHigh', 'tomLow'])
    for (let bar = 0; bar < last; bar += 1)
      for (const voice of voicesIn(bars[bar])) expect(TOMS.has(voice)).toBe(false)
  }
})
```

It is registry-wide, and its second half says a tom may sound in the fill bar and
in no other bar of the loop. AC5 asks for both toms **once per pass**. Both
readings cannot be true, and Epic 1's C7 saw only half of the coupling — its rule
about the pass's last bar. What the assertion was standing in for is *"the toms
are what marks a fill"*, and a style whose ordinary figure includes toms is the
case it never had to consider. Step A4 narrows it accordingly: the fill still
plays both toms on every template, and a bar before the fill plays a tom only
where the template declares one, and then exactly the declared line. That keeps
the guard — a tom leaking into an ordinary bar of a template that declared none
still fails — and it is a change to a shared file, so Q3 asks whether it is
this epic's to make.

**Bass follows kick, as a property of two declared pools.** Nothing in
`events.ts` learns to derive one line from the other. The constraint is written
into the pools and asserted twice:

- *At pool level:* every step of every figure in `patterns.bass` appears in
  **every** figure of `patterns.kick`. The two are drawn independently on the
  same `rhythmRng`, so agreement has to hold for every pair, which makes "the
  kick figures share a common anchor set, and the bass only ever plays anchors"
  the only shape that works.
- *On rendered output (AC4):* in every ordinary bar, each `bass` event sits on a
  step the same bar's `kick` sounds, **or** on the bar's last step
  (`subdivision - 1`). That exception is `events.ts`'s chord-approach note, which
  it places itself when the next bar's root changes and which no pool declares.

Fill and variation bars are excluded from the per-bar form of AC4, and the
exclusion is named rather than silent: in those bars the kick line is the fill
phrase's, so including them would force the fill's kick to carry the bass anchors
and would flatten the fill vocabulary R7 exists to buy. Q2 asks whether that is
the right trade.

**The density band, measured then declared.** `straight-funk` runs 18–44. This
style is busier in the kit and sparser in the keys, so the band is derived, in
this order:

1. Write the template with a deliberately impossible band
   (`{ minPerBar: 0, maxPerBar: 999 }`), so nothing is gated while measuring.
2. Run the scratch measurement over seeds 1–120: per-bar event count, and the
   per-bar contribution of each voice.
3. Set `minPerBar = floor(measured min) - 1` and
   `maxPerBar = ceil(measured max) + 1`.
4. Pin both as literals in `second-line.test.ts`, and assert the floor is *tight*:
   `measured min - minPerBar` is **less than** the per-bar event count of the
   sparsest voice that sounds in every bar. That is the testable form of R9's
   "tight enough to still catch a voice left at the wrong gain" — losing any
   voice's line drops the groove through the floor.

The band's *span* is allowed to be wide, because the kick, bass and comp draws
genuinely vary; the band's *floor* is what does the catching. If the measured
minimum and the sparsest voice line cannot both be satisfied at a margin of 1,
**stop and report the numbers** — do not widen. The analytic budget, for a
16-subdivision feel, per ordinary bar:

| Voice | Events/bar | Source |
| :-- | :-- | :-- |
| snare figure | fixed by the drawn figure | `patterns.kit` |
| snare ghosts | 2–3, minus any that collide with the snare figure | shared `SNARE_GHOST_PATTERNS` |
| toms | fixed by the drawn figure, both drums | `patterns.kit` |
| kick | the drawn figure's length | `patterns.kick` |
| hatClosed | the drawn figure's length, minus the open-hat steps | `patterns.hatClosed` |
| hatOpen | the placement's step count | `PLACEMENTS` |
| rim | the placement's step count, in `rimBars` only | `PLACEMENTS` |
| bass | the drawn figure's length, less ~one rest per four bars | `patterns.bass` |
| comp | the drawn figure's length × voicing size (3 or 4) | `patterns.comp` |

**The comp is sparse by construction, not by measurement.** All three templates
R6 names draw from the shared `COMP_PATTERNS`, whose sparsest member holds two
steps, so their floor is `2 × voicing`. Every figure in second-line's own
`patterns.comp` holds **exactly one step**, so its count is `1 × voicing ≤ 4`,
strictly below `2 × 3 = 6` for any voicing the harmony can produce. AC6 is then
provable, and measured as well.

**What binds this template that it did not choose.** Three registry-wide
assertions, all of which the template has to satisfy rather than amend:

- `templates/index.test.ts` wants a closed hat on every template and an open hat
  on every template that does not ride. Second line does not ride, so it declares
  `hatOpen` and gives it an honest placement — a declared-and-silent voice would
  pass the letter of that test and fail its point.
- `events.test.ts`'s *"marks the last bar of the middle pass more lightly than
  the fill"* wants the variation bar to differ from an ordinary bar by *less*
  than the fill does. With toms in the ordinary bar and none in the variation
  (see the next point), the variation's distance is the toms it drops plus the
  snare line it changes, and the fill's must be larger. Step A9 measures both.
- *"takes the toms out of the variation"* wants no tom in the middle pass's last
  bar of any four-pass template. So `FILLS['second-line'].variation` **declares
  no toms** — it is the thinned bar, and thinning this style means the snare
  figure without its tom answers. This is the same coupling Epic 1's C7 names,
  arriving through `FILLS` instead of through `figures`.

**What this epic does not do.** No new voice, no change to `VOICE_NAMES`,
`VELOCITIES` or `FILL_DURATIONS`, no new mechanism in `events.ts`, no key added
to Epic 1's `patterns` block, no edit to any existing template, no edit to the
shared pools, no change to `src/` except the regenerated manifest, and no rota
change.

**Wave 2, honestly.** Three epics add a template at once. The PRD names four
shared files; there are three more groups:

| Shared file | With | How it behaves here |
| :-- | :-- | :-- |
| `templates/index.ts` | Epics 2, 4 | one import and one entry appended; a conflict is trivial |
| `templates/index.test.ts` | Epics 2, 4 | each epic adds its own `describe`; a conflict is trivial |
| `scripts/grooves/events.ts` | Epics 2, 4 | **not in the PRD's list**, but since Epic 1's D2 and D4 this epic's diff here is two appended record keys — `PLACEMENTS['second-line']` and `FILLS['second-line']` — the same shape Epics 2 and 4 append. Textual conflicts, not semantic |
| `scripts/grooves/events.test.ts` | Epic 1 (Steps E7, E8), Epics 2, 4 | **not in the PRD's list.** One existing case changed, in a 2281-line file. Epic 1 adds new cases elsewhere in it; Step A4 must be rebased onto whatever landed |
| `catalogue.json`, `grooves.lock.json`, `grooves.generated.ts`, `public/grooves/` | Epics 2, 4 | rewritten wholesale by a mint. **Rebase before minting, never after** |
| `docs/music.md`, `docs.test.ts` | Epics 1, 2, 4 (and feature-24) | one table row each; Epic 1's H2 asserts a row per registered template, so the assertions are registry-derived and no epic edits another's case |
| `eventsFixture.ts`, `events.fixture.json` | Epics 1, 2, 4 | regenerated by its own writer after a rebase |

**Why minting is strictly serial.** `selectSeeds` reads the catalogue on disk to
keep every `root|flavour` answer and every `scale|progression` pair unique, and
it numbers new ids from the highest id it finds. Two epics minting from the same
base produce colliding ids and possibly colliding answers, and
`catalogue.test.ts` asserts both are unique. So: **rebase, re-run
`npm run test:gen`, then mint.** If this epic is not first to mint, its six seeds
will differ from whatever it saw in a dry run — that is expected and costs
nothing, because no seed is promised to anyone until it is committed.

**One value must be settled before the mint, not after.** `templates/index.test.ts`
asserts swing values and tempo-range strings unique across the registry, and
three epics are choosing both in parallel. Epic 1's C9 now records the
reservations, and second line's lane is a **swing inside 0.20–0.26** and a
**tempo range inside 84–98** — the same lane this spec claimed, read back by Epic
1 and written down where all five epics can see it. Changing `swing` after
minting re-renders that template's six grooves, so a collision has to be resolved
before Track C runs, and the rule is: the epic that has not yet minted moves.

## Contracts

Frozen before any track starts.

### From Epic 1 — do not re-derive

Epic 1's Contracts C1, C2, C7, C8 and C9, restated as the surface Track A builds
against. `specs/features/feature-25/tech-spec/epic-1-a-feel-can-carry-more-than-two-modes.md`
is the authority; this is the subset this epic reads.

```ts
// scripts/grooves/types.ts
export type Subdivision = 4 | 8 | 16

// The snare line a style plays instead of a backbeat, and the tom accents that
// travel with it. Adopted from this epic's proposal, shape unchanged.
export type KitFigure = { snare: number[]; tomHigh?: number[]; tomLow?: number[] }

export type PatternPools = {
  kick?: number[][]
  hatClosed?: number[][]                              // whichever hat pool applies
  ride?: Partial<Record<Subdivision, number[][]>>
  bass?: number[][]
  comp?: number[][]
  bongos?: { high: number[]; low: number[] }[]
  snareGhosts?: number[][]
  kit?: KitFigure[]                                   // the eighth key
}

export type FixedFigure = { voice: VoiceName; bars: number[][] }   // C7

export type FeelTemplate = {
  // …every field it has today…
  patterns?: PatternPools
  figures?: FixedFigure[]
}
```

- **The keys are frozen and complete.** Four epics read this block in the same
  wave. `patterns` gains no ninth key and no key changes shape; `FeelTemplate`
  beside it is append-only under C8's four conditions.
- **A declared pool replaces, never extends** (R13 for the fallback, C1 for the
  replacement).
- **`kit` is the only key that adds a draw**, one `pick` on
  `rngFor(template:seed:KIT_LABEL)`, taken only when the key is declared. A
  template declaring no `kit` opens no stream and takes no draw.
- **`kit` owns the snare line where it is declared.** `snareSteps` becomes the
  drawn figure's `snare`; the ghost filter works against it unchanged; the fill
  and variation bars still come from `FILLS`. A template may declare
  `patterns.kit` **or** `PLACEMENTS[id].snare`, never both — `assertPatterns`
  rejects the pair.
- **`assertPatterns`' five `kit` rules** (Epic 1 Step B4, adopted from this spec):
  the pool is non-empty; every figure's `snare` line is non-empty; every step is
  an integer inside `0…15`; each line is duplicate-free; and a figure's tom lines
  share no step with its own `snare` line.
- **`FixedFigure` is available but not used here** — see the Architecture note on
  why, and Assumptions for what was rejected with it.
- `npm run grooves:add <n> --template <id>` mints only for that template (C4).
- C9's registry reservations: `second-line` holds swing 0.20–0.26 and tempo
  84–98.

`KIT_LABEL = 'kit'` stays an `events.ts` export beside the other stream labels.
No key spelling in this spec needs adapting: `kick`, `hatClosed`, `bass` and
`comp` are the four pools this template declares besides `kit`, and all four are
spelled here as C1 spells them.

### This epic's own

Everything below is a **declaration**, not a mechanism.

```ts
// scripts/grooves/templates/second-line.ts   (new)
export const secondLine: FeelTemplate = {
  id: 'second-line',
  tempoRange: [/* inside 84–98, string unique across the registry — C9 */],
  subdivision: 16,          // the snare figure lives on sixteenths
  swing: /* inside 0.20–0.26, unique across the registry — C9 */,
  flavours: [/* 2–4 of FLAVOURS; new-styles.md proposes blues, mixolydian */],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: { timingMs: …, velocity: …, lean: { snare: > 0, hatClosed: <= 0, hatOpen: <= 0, rim: … }, driftDepth: 0 < d <= 0.01 },
  gain: { /* every declared voice; |gain[tomHigh|tomLow|rim] - gain.snare| <= 6 */ },
  pan:  { /* every declared voice, inside -1…1 */ },
  passes: 4,
  density: { minPerBar: …, maxPerBar: … },   // Step A11 measures these
  patterns: {
    kit:  [/* 3–4 figures: a syncopated snare line with one or two tom accents each */],
    kick: [/* 3–4 clave-ish figures sharing a common anchor set */],
    bass: [/* 3–4 figures whose steps are inside every kick figure */],
    comp: [/* 3–4 figures, each exactly one step */],
    hatClosed: [/* 3–4 sparse figures */],
  },
  // no `figures` block
}
```

```ts
// scripts/grooves/events.ts — two appended record keys, no new exports
PLACEMENTS['second-line'] = { hatOpen: […], rim: […], rimBars: [0, 1, 2, 3] }
// no `snare` key: patterns.kit owns the snare line, and declaring both throws.

FILLS['second-line'] = { fill: { …, tomHigh: […], tomLow: […] }, variation: { /* no toms */ } }
```

**Definition used by every step below.** An **off-beat step** is a step whose
sixteenth-grid position is not a multiple of four —
`(step * 16 / template.subdivision) % 4 !== 0`. It is grid-relative, so it means
the same thing whichever subdivision the musician picks.

**Test command.** Every track owns generator-tier files — `docs/music.md` routes
there too, per `scripts/tiers.ts` — so every track runs `npm run test:gen`.
Track C additionally runs `npm test`, because minting rewrites the app's
manifest.

## Tracks

### Track A — the declarations, and everything asserted about them

- **Goal** — `second-line` is registered and renders: a syncopated snare over a
  clave-ish kick, toms and rim in every pass, a bass that plays only kick
  anchors, a one-stab comp, and a fill in the idiom — inside a band measured from
  what it plays.
- **Owns** — `scripts/grooves/templates/second-line.ts` *(new)*,
  `scripts/grooves/templates/index.ts`,
  `scripts/grooves/templates/index.test.ts`,
  `scripts/grooves/second-line.test.ts` *(new)*,
  `scripts/grooves/events.ts` (two appended record keys only),
  `scripts/grooves/events.test.ts` (one existing case)
- **Role** — `musician`. It decides three to four snare figures with their tom
  accents, a clave-ish kick pool, the bass pool that agrees with it, a comp
  reduced to one stab, a fill vocabulary, a swing value, a tempo range, nine
  gains and nine pans. Every one of those is a decision about what the grooves
  sound like. `/implement-feature` runs the musician turn first and the
  implementer turn second, as it does for any generator unit.
- **Depends on** — Epic 1 merged. Not just its contract on paper: Steps A1–A3
  assert behaviour that Epic 1's Steps E7 and B4 implement, so they are red for
  the wrong reason until Epic 1 lands.
- **Parallel with** — nothing inside the epic; concurrent with Epics 2 and 4's
  equivalent tracks, sharing `events.ts`, `events.test.ts` and the two
  `templates/index.*` files.
- **Done when** — every case in `second-line.test.ts` and
  `templates/index.test.ts` is green, `events.test.ts` and
  `eventsFixture.test.ts` are green, and `npm run test:gen`'s **only** failure is
  `catalogue.test.ts → draws grooves from every template`.

*Note on the expected red.* That case requires at least one groove per
registered template, so registering `second-line` turns it red and only Track
C's mint turns it green again. It must not be weakened, and registration must not
be deferred to hide it — landing the registration early is what makes a swing or
tempo collision with Epic 2 or 4 surface days before the mint, when it is still
free to fix.

*Note on ownership.* This is one track because the template, its two `events.ts`
record keys and its assertions are unobservable apart: a `FILLS` entry does
nothing until a template names it, and the template's fill assertions are red
until the entry exists. A track that cannot be given disjoint files is not a
track.

### Track B — the feel table says what the template declares

- **Goal** — `docs/music.md` carries a `second-line` row whose every cell matches
  the template's declared values, the rim sentence says what is now true, and the
  pool table names `patterns.kit`. All three pinned by assertions that read the
  document from disk and compare it against the registry.
- **Owns** — `docs/music.md`, `scripts/grooves/docs.test.ts`
- **Role** — `implementer`. Its product is prose and the test that pins it; the
  musical values it records were settled by Track A. It owns a file under
  `scripts/grooves/`, but it decides nothing about how a groove sounds.
- **Depends on** — Track A, for the registration and for the declared values the
  row states. Epic 1's Step H2 already asserts *a row per registered template*
  and Step H3 already routes `patterns`, `figures` and `KIT_LABEL`, so this track
  adds the cell-by-cell check and the two sentences those steps do not cover.
- **Parallel with** — Track C. They share no file.
- **Done when** — `npm run test:gen` is green for the `docs.test.ts` cases and
  the table and the registry agree cell by cell.

### Track C — six grooves

- **Goal** — six `second-line` grooves in the catalogue, every one through all
  seven gate checks, the manifest and the lock rebuilt, and hard evidence that no
  groove outside the template moved.
- **Owns** — `scripts/grooves/catalogue.json`,
  `scripts/grooves/grooves.lock.json`,
  `src/features/daily-groove/data/grooves.generated.ts`,
  `public/grooves/groove-NN.mp3` (the six new files),
  `scripts/grooves/eventsFixture.ts`, `scripts/grooves/events.fixture.json`
- **Role** — `musician`. Minting is where the gate's verdict and the listening
  verdict arrive, and a rejection is a musical problem in the template, not a
  budget to raise.
- **Depends on** — Track A landed, and — across epics — every earlier wave-2
  mint landed and rebased onto.
- **Parallel with** — Track B.
- **Done when** — `npm run test:gen`, `npm test`, `npm run grooves:verify` and
  `npm run build` are green, the catalogue holds six `second-line` entries, and
  `git status` after `npm run grooves` shows no existing mp3 modified.

## Execution waves

- **Wave 1:** Track A. Alone — every other track needs the template to exist.
- **Wave 2 (parallel):** Track B, Track C.
- **Wave 3:** Integration — the catalogue through the gate, the listening
  sign-off, the full pre-push set.

There is no track that can run beside Track A. That is a real dependency and not
a comfort: the doc row states values Track A settles, and the mint renders a
template Track A writes.

## Implementation

### Track A — the declarations, and everything asserted about them

Every case below goes in a new `scripts/grooves/second-line.test.ts` unless it
names another file — a topic-named sibling, the way `catalogue-gate.test.ts` and
`docs.test.ts` are, so this epic stays off `events.test.ts` (2281 lines) except
for the one case it must change, and out of Epics 2 and 4's way. Start with a
sanity case in the shape of the existing ones: `templateById('second-line')` does
not throw and its `patterns.kit` is defined — so a rename cannot make the rest of
the file pass vacuously.

#### Step A1 — the declared kit pool, and what a figure of this style may be

Covers: R3, R5, AC3

- **Test first** — `second-line.test.ts`, against the declaration with nothing
  rendered:
  - `patterns.kit` holds three or four figures
  - every figure's `snare` line holds four to eight steps, is ascending,
    duplicate-free, every step inside `0…15`
  - no figure's `snare` line equals `[4, 12]`, and none is a subset of it
  - every figure's `snare` line holds at least two off-beat steps
  - every figure declares both `tomHigh` and `tomLow`, one or two steps each,
    inside `0…15`, sharing no step with that figure's own `snare` line
  - `PLACEMENTS['second-line']` declares **no** `snare` key, and
    `assertPatterns(secondLine, PLACEMENTS)` does not throw — the enforcement
    point for C1's last rule, asserted here so a later `snare` override fails in
    this epic's own suite rather than at mint time
  - `templates/index.test.ts`-style totality: every voice named anywhere in
    `patterns.kit` is one `voices` declares

  Run it: fails with `expected undefined to have length 3`.
- **Implement** — `templates/second-line.ts`: the `kit` pool. Epic 1's Step B4
  already validates the five structural rules; these assertions are about what a
  *second line* may be, which is a different question.

  Candidate figures for the musician, all on the sixteenth grid — a second line's
  snare is the figure, so the shapes to try are the ones that state the
  three-against-two rather than a backbeat with decoration:
  - `{ snare: [2, 6, 10, 11, 14], tomHigh: [7], tomLow: [12] }` — the "and"s with
    a pair on 3, a tom answering
  - `{ snare: [3, 6, 10, 13, 14], tomHigh: [8], tomLow: [11] }` — later, more
    over the barline
  - `{ snare: [2, 3, 6, 10, 14, 15], tomHigh: [7, 11], tomLow: [12] }` — the busy
    one, and the one to measure first against the band

  Keep the tom hits to one or two a bar. `tomHigh` and `tomLow` have **two**
  alternates per velocity layer in `pack.json`, against the snare's three, so a
  tom sounding four times a bar over sixteen bars is the machine-gun risk Epic 5
  is budgeting for on the claves.
- **Green when** — the seven groups of assertions pass.
- **Refactor** — none. Do not move the tom lines into `figures`: see the
  Architecture note, and Assumptions.

#### Step A2 — the snare figure replaces the backbeat, and nobody else's snare moves

Covers: R3, AC3, AC12

- **Test first** — `second-line.test.ts`: build `second-line` at seeds 1–20, and
  at every catalogue seed it has once Track C has run; for every ordinary bar of
  the loop (any bar that is not the fill or variation bar — the file needs its own
  three-line `phraseBars` helper, `events.test.ts`'s being local to that file):
  - the bar's `snare` steps at or above `GHOST_VELOCITY_THRESHOLD` equal
    `grid(m.snare)` for exactly one member `m` of `patterns.kit`
  - it is the same `m` in every ordinary bar of the loop
  - the set is not `grid([4, 12])`
  - at least one of them is an off-beat step

  And, in the same case, that no other feel moved: for `straight-funk` and
  `half-time` at every catalogue seed, the `snare` steps still equal
  `grid(placementFor(id).snare)`.

  Run it: fails with `expected [ 4, 12 ] to equal [ 2, 6, 10, 11, 14 ]` — Epic 1's
  Step E7 is what makes it pass, so a failure here after Epic 1 merged means the
  declaration is wrong, not the mechanism.
- **Implement** — nothing in `events.ts`. The step's product is the assertion
  that this template inherited E7's behaviour.
- **Green when** — the figure assertion passes at every seed, the two other
  feels' snare lines are unchanged, and `eventsFixture.test.ts` is green — the
  first hard evidence for AC12.
- **Refactor** — none.

#### Step A3 — the drawn figure is this template's own, and re-keys nothing

Covers: R3, AC12

- **Test first** — `second-line.test.ts`: build a `second-line` spec, rotate
  `secondLine.patterns.kit` in place (`pool.push(pool.shift()!)`), rebuild the
  same spec, restore the pool in a `finally`. Assert the snare and tom lines
  **differ** between the two builds — a rotation that changed nothing would make
  the case vacuous — while `music.root`, `music.flavour`, `music.chord`,
  `music.progression`, `music.bpm` and the whole `kick`, `bass`, `comp` and
  `hatClosed` event lists are identical.
- **Implement** — nothing. Epic 1's Step E7 already proves the *mechanism* takes
  no draw from `rhythmRng`, and its Track A fixture proves the thirty do not
  move; this step proves that *this template's* pool is the thing that varies,
  which is what makes A1's figure choices meaningful rather than decorative.
- **Green when** — the kit lines move and nothing else does.
- **Refactor** — none. The rotation must be restored in a `finally`; a leaked
  mutation silently re-keys every later case in the file.

#### Step A4 — the toms stop being the fill's alone

Covers: R5, AC5

This is the one existing test this epic changes, and the reason Q3 is open.

- **Test first** — `scripts/grooves/events.test.ts`, the case
  `plays toms, which the figure never does — R10`. Rewrite it as the guarantee it
  was standing in for, keeping both halves testable:
  - **unchanged, every template:** the fill bar plays exactly `tomHigh` and
    `tomLow`
  - **for every template that declares no `patterns.kit` tom line:** no bar
    before the fill bar plays a tom — the original assertion, now scoped to the
    templates it was written for
  - **for every template that declares one:** every ordinary bar plays exactly
    the declared tom line, resolved by `gridSteps`, and the variation bar plays
    none — so a leaked tom still fails, and the exemption is a positive
    assertion rather than a hole
  - rename the case to say what it now guarantees, and keep the `— R10` tag with
    this epic's `R5` beside it so the next reader can find both requirements

  Run it: fails with `second-line bar 0 plays tomHigh` before the rewrite, and
  the rewrite is red until Epic 1's Step E7 emits the kit toms.
- **Implement** — the rewritten case. No source change: Epic 1's E7 emits the
  tom lines in the ordinary-bar branch already.
- **Green when** — the case passes for every registered template, and
  deleting one tom step from `secondLine.patterns.kit[0].tomLow` in a scratch
  edit makes it fail — the check that the new branch is not vacuous.
- **Refactor** — none. Do not add a `second-line` special case: a named
  exemption is what the next style would copy.

#### Step A5 — the toms and the rim are in the figure, not seasoning

Covers: R5, AC5

- **Test first** — `second-line.test.ts`, at seeds 1–20:
  - per pass (`music.loopBars / music.bars` passes of four bars), the pass
    contains at least one `tomHigh`, one `tomLow` and one `rim` event
  - every ordinary bar contains at least one `tomHigh` and one `tomLow` event
  - `templateById('second-line')`: `|gain.tomHigh - gain.snare| <= 6`, the same
    for `tomLow` and `rim`, and every one of the three is a declared voice with a
    declared pan
  - `placementFor('second-line').rimBars` is every bar of the pass, so the rim
    survives in the passes whose last bar is a fill

  Run it: fails with `expected 0 tomHigh events in pass 0` before A4 and A1 land.
- **Implement** — `PLACEMENTS['second-line']` gets its `rim` steps and
  `rimBars: [0, 1, 2, 3]`, and the template gets the three gains. Set them from
  `straight-funk`'s relationship as the starting point — its toms sit 4–5 dB
  under its snare — and bring them **up** relative to that, because here they
  carry the figure.
- **Green when** — every pass carries both toms and the rim, and the three gain
  assertions pass.
- **Refactor** — none.

#### Step A6 — the kick's clave, and the bass that only plays its anchors

Covers: R4

- **Test first** — `second-line.test.ts`, against the declared pools with nothing
  rendered:
  - `patterns.kick` holds three or four figures; each is ascending,
    duplicate-free, inside `0…15`, and holds three to six steps
  - every kick figure holds at least two off-beat steps — a clave-ish figure that
    only played quarters would not be one
  - the intersection of every kick figure (the anchor set) is non-empty and
    contains step `0`
  - `patterns.bass` holds three or four figures, each non-empty and inside
    `0…15`
  - **every step of every bass figure is inside every kick figure**
  - no bass figure declares the bar's last step, so the only bass event outside
    the kick's steps is ever the chord approach

  Run it: fails with `expected [ 0, 6, 10, 14 ] to contain 14`.
- **Implement** — `templates/second-line.ts`: the two pools. The shape that
  satisfies the constraint is a fixed anchor set every kick figure keeps, with
  each figure adding its own extra hits, and a bass pool drawn only from anchors.
  Starting proposals, the musician's to settle by ear:
  - anchors `[0, 6, 10]` — the clave-ish spine
  - kick `[[0, 6, 10], [0, 3, 6, 10], [0, 6, 10, 12], [0, 6, 8, 10, 14]]`
  - bass `[[0, 6, 10], [0, 10], [0, 6]]`
- **Green when** — the six pool assertions pass.
- **Refactor** — none. Do not derive the bass from the kick in `events.ts`; R4 is
  a constraint on two declared pools and the assumption behind it is explicit in
  the PRD.

#### Step A7 — the bass follows the kick in every ordinary bar

Covers: R4, AC4

- **Test first** — `second-line.test.ts`, at seeds 1–20 and every catalogue seed:
  for every ordinary bar of the loop, every `bass` event's step is either a step
  the same bar's `kick` sounds, or `template.subdivision - 1`. Assert
  additionally that the case is not vacuous — the loop inspects at least twelve
  bars, and at least one bar carries three or more bass events. Run it: fails on
  the shared `BASS_PATTERNS`' `[0, 8, 14]` before A6's pool lands, with the bar
  index and the offending step in the message.
- **Implement** — nothing beyond A6. The property follows from the pools; the
  step's product is the assertion that the rendered output has it, including
  after `events.ts`'s rest, repeat, octave-lift and approach passes have had
  their way with the line.
- **Green when** — every ordinary bar of every seed passes.
- **Refactor** — none.

#### Step A8 — the keys are sparser than any feel that has them

Covers: R6, AC6

- **Test first** — `second-line.test.ts`:
  - every figure in `patterns.comp` holds **exactly one** step, and the pool holds
    three or four figures
  - measured: for `second-line` at seeds 1–120, the maximum `comp` events per
    ordinary bar is strictly below the minimum `comp` events per ordinary bar of
    `straight-funk`, `swung-sixteenth` and `bright-straight` over the same seeds
  - the three named templates declare no `patterns.comp`, so the comparison is
    against the shared pool they actually draw — asserted, so the case cannot
    quietly start comparing a template against itself

  Run it: fails with `expected 8 to be less than 6` before the pool lands.
- **Implement** — `templates/second-line.ts`: `patterns.comp` as three or four
  one-step figures. The step choices are the musician's; a stab off the beat is
  the idiom, so candidates are `[[2], [6], [10], [11]]`.
- **Green when** — both the structural and the measured assertion pass.
- **Refactor** — none.

#### Step A9 — the fill is the style, and the variation is the thinning

Covers: R7, AC7

- **Test first** — `second-line.test.ts`:
  - `FILLS['second-line']` exists and declares both `fill` and `variation`
  - neither phrase deep-equals `DEFAULT_FILL`, nor `withoutToms(DEFAULT_FILL)`
  - the `fill` phrase names `tomHigh` and `tomLow` — the registry case
    *"plays toms, which the figure never does"* requires exactly both in the fill
    bar of every template
  - the `variation` phrase names **neither** tom, because
    *"takes the toms out of the variation"* is registry-wide over every four-pass
    template. It is declared explicitly rather than left to `withoutToms(fill)`
    so the thinning is readable, and Step A1's ordinary-bar toms are what it
    thins away
  - the `fill` phrase's `snare` line holds more steps than
    `DEFAULT_FILL.snare` — the roll is the point
  - neither phrase names a voice `second-line` does not declare, and every voice
    it names is in `BACKING_VOICES` — the registry case
    *"writes every declared phrase on the sixteenth grid"* checks exactly that,
    plus ascending, duplicate-free, non-empty, `< 16`
  - measured, mirroring `events.test.ts`'s `distance` helper:
    `distance(variation, ordinary) > 0` and `< distance(fill, ordinary)` at seeds
    1–4, so *"marks the last bar of the middle pass more lightly than the fill"*
    holds with toms in the ordinary bar
  - rendered: at seeds 1–20, the fill bar's events per voice equal the resolved
    `fill` phrase plus the bass and comp lines, and the variation bar's equal the
    resolved `variation` phrase plus the same; the fill bar carries no `snare`
    step from the kit figure that the phrase does not name

  Run it: fails with `expected undefined to be an object` on
  `FILLS['second-line']`.
- **Implement** — `scripts/grooves/events.ts`: the `FILLS` entry. Constraints the
  musician works inside: no crash exists in the kit, and `DEFAULT_FILL` resolves
  on the snare for the reason `docs/music.md` gives — the downbeat after the fill
  *is* position zero of the file, so anything that lands there is heard at the
  top of every playback. Keep the kick on step `0`. A second line's fill is a
  bar-long snare figure with the toms answering, not a tom run to a crash.
- **Green when** — the eight groups of assertions pass and the three registry
  cases named in them are green for `second-line`.
- **Refactor** — none.

#### Step A10 — the template declares itself, and no two feels collide

Covers: R1, R2, AC1, AC2

- **Test first** — `templates/index.test.ts`, in a new
  `describe('second-line')` block:
  - `swing` is unique across `allTemplates()`, and the failure message names both
    colliding ids
  - `tempoRange.join('-')` is unique across `allTemplates()`, likewise
  - `tempoRange` lies inside `[84, 98]` and `swing` inside `[0.20, 0.26]` — C9's
    reservation, so a collision resolved by moving *this* template still fails the
    case rather than drifting
  - `flavours` holds two, three or four entries, all distinct, every one a member
    of `FLAVOURS`
  - `subdivision` is `16`, `passes` is `4`
  - `voices` is exactly the nine named in the contract; it contains `hatClosed`
    and `hatOpen`; it contains none of `ride`, `rideBell`, `claves`, `cowbell`,
    `bongoHigh`, `bongoLow`
  - `patterns` declares exactly the five keys `kit`, `kick`, `bass`, `comp`,
    `hatClosed`, and `figures` is `undefined`
  - `gain` and `pan` name every declared voice and no other; `humanize.lean.snare`
    is positive and both hat leans are at or below zero
  - `[gain, pan]` and `humanize` are each unique across the registry — the two
    existing whole-registry cases already assert this by count; the new case
    names `second-line` in the failure so a collision is diagnosable

  Run it: fails with `templateById: unknown template "second-line"`.
- **Implement** — `templates/second-line.ts` and one import plus one entry in
  `templates/index.ts`.
- **Green when** — the block is green and the existing whole-registry cases
  (unique ids, unique swing, unique tempo range, unique mix, unique humanize)
  still pass with eight or more templates. Epic 1's Steps C6 and F10 replaced the
  `TEMPLATE_COUNT` arithmetic those cases used to carry; if one of them still
  reads a literal count, **stop and report** — do not edit that number here,
  because Epics 2 and 4 are editing the same file.
- **Refactor** — none.

#### Step A11 — the density band, measured before it is declared

Covers: R9, AC9

- **Test first** — `second-line.test.ts`, after the measurement below:
  - `templateById('second-line').density` equals the measured literals, written
    out in the test so widening the band is a deliberate edit to a test that
    names the numbers
  - `maxPerBar - minPerBar` is at most the span `straight-funk` declares (26), so
    "wider than any existing feel" is not how this band got wide
  - the floor is tight: `measuredMin - minPerBar` is **less than** the per-bar
    event count of the sparsest voice that sounds in every ordinary bar, measured
    in the same case and named in the failure message
  - the existing `events.test.ts` case *"every template's density band admits its
    own grooves"* iterates `allTemplates()`, so it covers `second-line` with no
    edit — run it and read what it says

  Run it: fails with `expected { minPerBar: 0, maxPerBar: 999 } to equal { … }`.
- **Implement** — in this order, and not another:
  1. `templates/second-line.ts` ships `density: { minPerBar: 0, maxPerBar: 999 }`
     while measuring, so nothing is gated by a guess.
  2. Measure with a scratch script — not committed, and no `package.json` entry,
     for the reason feature-24 gave: a standing target invites re-measuring a band
     after the thing it was measuring has already moved.

     ```ts
     import { buildEvents } from './scripts/grooves/events.ts'
     import { templateById } from './scripts/grooves/templates/index.ts'
     const feel = templateById('second-line')
     for (let seed = 1; seed <= 120; seed++) {
       const { events, music } = buildEvents({ id: 'g', uuid: 'x', template: feel.id, seed }, feel)
       // per-bar total, and per-voice totals, printed as TSV
     }
     ```
  3. Set `minPerBar = floor(min) - 1`, `maxPerBar = ceil(max) + 1`.
  4. Record the measured min, max, mean and the per-voice averages in the epic's
     report. AC9 asks the report to state the spread, and this is where the number
     comes from.

  If the tight-floor assertion cannot hold at a margin of 1 — because the
  sparsest every-bar voice contributes less than one event a bar — **stop and
  report**: name the voice, its measured contribution, and the measured extremes.
  Do not widen the band, and do not thin the style to fit a band that was never
  measured.
- **Green when** — the four assertions pass and the 120-seed case admits
  `second-line`.
- **Refactor** — none.

### Track B — the feel table says what the template declares

Every case below adds to `scripts/grooves/docs.test.ts`, reading `docs/music.md`
from disk with the file's existing `read()` helper, inside the
`the music reference` describe Epic 1's Step H1 creates.

**Read the file before writing the case.** feature-24 Epic 2 rewrites the Pulse
column and the voice count; Epic 1's Steps H1–H4 rename the heading to
`## The feels`, replace the two-flavour sentence, add a registry-derived
*row exists* assertion, route `patterns`, `figures` and `KIT_LABEL`, and drop the
stale catalogue count. Epics 2 and 4 are adding rows beside this one. Add only
what is not already there.

#### Step B1 — the row's cells are the template's own values

Covers: R11, AC11

- **Test first** — `docs.test.ts`: parse the feel table's rows into
  `{ feel, bpm, subdiv, swing, flavours, passes, density, pulse }`; for every row,
  assert the BPM, subdivision, swing, flavours, passes and density cells match
  that template's declared values, and that `pulse` reads `ride` exactly when the
  template declares `ride`. Epic 1's H2 already asserts that a row exists per
  registered id, so this case is the half it does not cover: that the row is
  *true*. Nothing is hard-coded but the parse. Run it: fails with the row absent,
  then with whichever cell was typed rather than read.
- **Implement** — `docs/music.md`: one row for `second-line`, with the values the
  template actually declares, including the band Step A11 measured.
- **Green when** — the table and the registry agree, cell by cell, for every
  registered template.
- **Refactor** — deriving from the registry rather than typing the row out twice
  is what lets Epics 2 and 4 add their rows without touching this case.

#### Step B2 — the rim sentence says what is true

Covers: R11, AC11

- **Test first** — `docs.test.ts`: the feel section does not contain the string
  "the only one besides `straight-funk` with a rim"; a sentence in that section
  names every template that declares `rim`, derived from `allTemplates()`; and
  the sentence about which feels carry toms, if it names any, names exactly the
  ones that declare them. Run it: fails on the stale string.
- **Implement** — `docs/music.md`: rewrite that sentence to what the registry
  says. Second line makes the rim a figure voice rather than a pickup, and Epic
  2's reggae puts it on beat three, so write the sentence as a list of the feels
  that carry it, not as an exception to two.
- **Green when** — the stale string is gone and the derived list matches.
- **Refactor** — none.

#### Step B3 — the pool table names the kit

Covers: R3, R11

- **Test first** — `docs.test.ts`: the *Drawn per seed* pool table has a row
  matching `/kit/` whose Notes cell says it is per template and that it replaces
  the backbeat, with the option count read from
  `templateById('second-line').patterns.kit.length` rather than typed. Epic 1's
  H3 covers the *Where to change what* rows and the `KIT_LABEL` bullet, so this
  case is only the pool table. Run it: fails with the row absent.
- **Implement** — `docs/music.md`: one row in the *Drawn per seed* table. Say
  the three facts a reader needs before touching it: the pool lives on the
  template, it replaces `DEFAULT_PLACEMENT`'s snare rather than adding to it, and
  it is drawn on its own labelled stream.
- **Green when** — the row is found and the count agrees.
- **Refactor** — none.

### Track C — six grooves

#### Step C1 — six minted, seven checks each

Covers: R8, R9, AC8, AC9

- **Test first** — the existing `catalogue-gate.test.ts` renders every catalogue
  groove through all seven checks, and `catalogue.test.ts`'s
  *"draws grooves from every template"* is the case Track A left red. Add to
  `second-line.test.ts` one case: the catalogue holds exactly six `second-line`
  entries, their seeds are distinct, and their `root|flavour` answers are
  distinct. Run it before minting: fails with `expected 0 to be 6`.
- **Implement** — in this order:
  1. **Rebase first.** If another wave-2 epic has minted, rebase onto it and
     re-run `npm run test:gen` before going further. Minting from a stale
     catalogue produces colliding ids and possibly colliding answers.
  2. `npm run grooves:add 6 --template second-line` — Epic 1's C4 flag. Do **not**
     try to filter by passing `opts.templates`: `add.ts`'s `writeBatch` resolves a
     template for every entry in the whole catalogue, so a filtered list throws on
     the first groove of another feel.
  3. Confirm the manifest still carries `HEARD_IN`. Epic 1's Step D6 fixes
     `add.ts`, which today calls `writeManifest(entries, path, buildPools(entries))`
     with no heard-in table and so leaves `grooves.generated.ts` without the export
     `GroovePuzzle.tsx` imports. If D6 landed, the mint is enough; if it did not,
     run `npm run grooves -- --manifest-only`, which re-emits the manifest with
     the table and rewrites the lock to match while encoding no audio. Either way
     `npm test` is the check — see Step I3.
  4. Read every rejection the mint logs. A `density` failure is Step A11's
     measurement being wrong, and it is fixed by re-measuring, not by widening. A
     `loudness` failure is a gain problem in Step A5 and is fixed in the template
     — never by moving `LOUDNESS_FLOOR_DB` or `LOUDNESS_CEILING_DB`. If six
     grooves are not reachable inside the attempt budget, that is a musical
     problem with the template: **stop and report** with the rejection counts per
     check. Shipping four is not an option the PRD leaves open.
  5. Record the six grooves' measured events per bar in the report — AC9's
     "measured spread across the six".
- **Green when** — six entries, `catalogue-gate.test.ts` green for all of them,
  and `catalogue.test.ts` fully green including its answer-uniqueness, dominance
  and mode-coverage cases. Six grooves over two-to-four flavours gives every
  declared flavour at least one, because `selectSeeds` splits the quota across
  the template's own list.
- **Refactor** — none.

#### Step C2 — nothing outside the template re-rendered

Covers: AC12

- **Test first** — `scripts/grooves/eventsFixture.test.ts` is the guard:
  `events.fixture.json` holds a per-event digest of the catalogue grooves of every
  feel but `shuffle`, and `buildFixture()` must deep-equal it. Run
  `npm run test:gen` and read the fixture cases specifically. Epic 1's Track A
  widened the fixture to every feel the catalogue names and made its feel list
  derived rather than typed out, so this epic's six grooves must be *in* it or
  the `holds every catalogue seed each of those feels is used at` case fails.
- **Implement** —
  1. Re-run the fixture writer after minting so `second-line`'s six grooves join
     the fixture, and commit the widened `events.fixture.json`. If Epic 1's Track
     A left `FIXTURE_FEELS` as a typed list, add `second-line` to it and replace
     the typed list in `names every feel but shuffle` with a typed **exclusion**
     list (`['shuffle']`) plus two non-vacuity assertions — at least five feels
     covered, and `straight-funk` among them. That turns a three-way conflict
     between the wave-2 epics into a regenerate-after-rebase step.
  2. `npm run grooves:verify` — no drift. Then `npm run grooves` and
     `git status`: the six new mp3s are added, and **no existing mp3 is
     modified**. If one is, revert it; do not rewrite the lock, which would sign
     audio nobody rendered.
- **Green when** — the fixture is green over its widened set, `grooves:verify`
  reports nothing, and `git status` shows only additions under `public/grooves/`.
- **Refactor** — none.

## Integration and verification

#### Step I1 — the whole catalogue through the gate

Covers: R8, AC8, AC12

- **Test** — `npm run test:gen`. Every case in the tier, read as failures rather
  than as a summary:
  - `catalogue-gate.test.ts` — all seven checks on every groove, now including six
    with a busy kit and a one-stab comp
  - `catalogue.test.ts` — every registered template has grooves; no repeated
    `root|flavour`; no repeated `scale|progression`; the dominance cap (Epic 1's
    Step C7 widened it to 5× and made it report both counts) holds with blues and
    mixolydian each carrying three or four more answers than before
  - `events.test.ts` — the rewritten tom case for every registered template, and
    the 120-seed density case for eight or more feels
  - `eventsFixture.test.ts` — nothing outside this template moved
  - `patterns.test.ts` — Epic 1's validation suite; `second-line`'s block is the
    first real `kit` declaration to pass through it
  - `boundary.test.ts` — `scripts/grooves/` still imports only the five permitted
    `src/lib/` modules. This epic adds no import, and the case is what keeps that
    true
- **Green when** — the tier is green with no carried-forward red.

#### Step I2 — the listening pass, per groove, recorded

Covers: R10, AC10

- **Test** — none a machine can run. Hand over the six file paths under
  `public/grooves/` and what to listen for, and do not report that it sounds
  good:
  - **does the snare read as a figure, or as clutter?** This is the sentence AC10
    asks for and the one the epic turns on. A second line's snare states the
    rhythm; if it sounds like a drummer filling in, the figure is wrong and Step
    A1's pool is where it is fixed
  - **is the fill part of the groove, or an interruption?** The second question
    AC10 names
  - the toms are heard as part of the figure, not as decoration at the back of the
    mix — and they do not machine-gun: two alternates per tom layer over a
    sixteen-bar loop is the risk
  - the variation bar reads as a thinning rather than as the toms dropping out by
    accident. This is the one thing the tom decision costs, and it is the one to
    listen for specifically
  - the kick reads as a clave-ish figure and the bass is on it, not near it
  - the keys stay out of the way — one stab a bar should feel like a horn section
    resting, not like a missing part
  - nothing rings across the loop seam
- **Green when** — a person has played all six in full and their verdict is
  recorded per groove, in their own words, in the epic's report. A gate pass is
  not a sign-off and does not substitute for one.

#### Step I3 — the full set

- `npm run test:gen`, `npm test`, `npm run lint`, `npm run build` — all four
  green.
- **`npm test` matters here in a way it does not in a template-only epic.**
  Minting rewrites `src/features/daily-groove/data/grooves.generated.ts`, and
  `grooves.generated.test.ts` checks the shipped manifest against
  `@/lib/theory/` and against `selectGroove`, and asserts `HEARD_IN` is
  non-empty. It is the guard that catches a mint that skipped Step C1.3.
- `npm run build` runs `prebuild` → `npm run grooves:verify`, and it must pass.
- Coverage: every R and AC below has at least one step.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A10 |
| R2 | A10 |
| R3 | A1, A2, A3, B3 |
| R4 | A6, A7 |
| R5 | A1, A4, A5 |
| R6 | A8 |
| R7 | A9 |
| R8 | C1, I1 |
| R9 | A11, C1 |
| R10 | I2 |
| R11 | B1, B2, B3 |
| AC1 | A10 |
| AC2 | A10 |
| AC3 | A1, A2 |
| AC4 | A7 |
| AC5 | A4, A5 |
| AC6 | A8 |
| AC7 | A9 |
| AC8 | C1, I1 |
| AC9 | A11, C1 |
| AC10 | I2 |
| AC11 | B1, B2 |
| AC12 | A2, A3, C2, I1 |

## Assumptions

- **The subdivision is 16.** R1 leaves it to the musician, and every step here is
  written grid-relative so an eighth-note choice would still pass — but a
  syncopated second-line snare needs sixteenths, and Step A10 pins 16 so the
  choice is visible rather than incidental.
- **`FeelTemplate.figures` is available and deliberately unused.** Epic 1's C7
  would carry a fixed tom line at zero RNG cost, and it was rejected twice over:
  a fixed accent under a drawn snare figure is arbitrary in five grooves out of
  six, and C7's "leave `bars[BARS_PER_PASS - 1]` empty" plus `events.test.ts`'s
  "no tom before the fill bar" leave a `figures` tom line with no bar it may
  sound in at all. If Q3 comes back saying the registry case may not be touched,
  `figures` does not become the answer — R5 does not survive either way, and the
  question goes back to the PRD.
- **"Same order of magnitude as the snare's" is read as within 6 dB.** Literally
  it would be 20 dB, which no gain in this repo is away from its snare. Six dB is
  one halving of amplitude, and `straight-funk` and `half-time` both keep their
  toms within 5 dB of their snare — so 6 dB is the house range, and it is what
  R5's "not at a gain nobody hears" is actually protecting.
- **`FILLS` carries one fill and one variation per template, so "a fill
  vocabulary" means both phrases declared in the idiom.** A drawn pool of fills
  is a mechanism nobody has built and this epic does not build it — and after
  Epic 1's C8 it could not be added inside `patterns` anyway. If the listening
  pass says one fill over a sixteen-bar loop is the thing that reads as an
  interruption, that is the finding to record, and a fill pool drawn on its own
  stream is a later epic's work.
- **The variation bar loses the toms, and that is a musical decision as well as a
  test constraint.** *"takes the toms out of the variation"* forces it, and the
  reading that makes it right is that thinning this style means the snare figure
  without its answers. Step I2 listens for it specifically, because it is the one
  place the tom design gives something up.
- **`second-line.test.ts` is a new file rather than more cases in
  `events.test.ts`.** That file is 2281 lines, Epic 1 adds cases to it and Epics
  2 and 4 have their own reasons to touch it; a topic-named sibling follows the
  pattern `catalogue-gate.test.ts` and `docs.test.ts` set. The one case this
  epic must change lives there and cannot move, which is exactly why nothing else
  of this epic's does.
- **Six grooves over two to four flavours covers every one of them**, because
  `selectSeeds` splits the mint quota across the template's own `flavours` list
  and hands the remainder to the scarcest. So R2's upper bound of four is safe at
  this mint size.
- **Blues and mixolydian leave room for six new answers.** The shipped catalogue
  answers blues three times and mixolydian three, out of twelve roots each, so
  eighteen `root|flavour` pairs are free before a third flavour is even
  considered.
- **`docs/music.md` will have moved under this epic's feet.** feature-24 Epic 2
  rewrites the Pulse column and the voice count; Epic 1's Track H renames the
  heading, replaces the flavour sentence, adds the registry-derived row
  assertion, routes `patterns` and `figures`, and drops the stale count. Track B
  is written to read the document as it finds it and to derive every expectation
  from the registry, which is what makes it survive all of that.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-09-05 — reconciling against Epic 1's frozen contract

**D1. The drawn snare figure lives in Epic 1's `patterns.kit`, not in a
`KIT_FIGURES` table in `events.ts`.** This spec's Q1 option C — "ask Epic 1 to
add a snare key before wave 2 starts" — was priced at "wave 2 waits". Epic 1
took it (its D2) while wave 2 had not started, so the price was zero. The shape
is unchanged: `KitFigure = { snare, tomHigh?, tomLow? }`, drawn once per groove
on `KIT_LABEL`, replacing `placement.snare` in ordinary bars, mutually exclusive
with a `PLACEMENTS[id].snare` entry and enforced by `assertPatterns`. Only its
home moved.
Changed: *Approach*; *Architecture*'s change table and kit-figure section;
Contracts, both subsections; Track A's `Owns` (`events.ts` shrinks from a
mechanism to two appended record keys) and `Depends on` (Epic 1 merged, not just
frozen on paper); Steps A1, A2, A3, A10, B3; the coverage table; Q1 removed.
Cost of reversal: after this epic mints, a re-render of its six grooves — the
audio, the lock and the manifest, though no committed answer, because
`KIT_LABEL` is its own stream. Before the mint, the declaration moves back into
`events.ts` for about fifteen lines. What it bought: this epic now adds **no
mechanism at all**, so its `events.ts` diff is the same two-record-key shape as
Epics 2's and 4's, and the three can be merged in any order.

**D2. The toms are `patterns.kit`'s tom lines, not a `FeelTemplate.figures`
entry.** The coordinator's second instruction was to choose one, and the choice
is forced harder than it looked. Musically, a fixed tom accent under a drawn
snare figure is arbitrary in five grooves out of six — the accent answers the
figure. Mechanically, a `figures` tom line has no legal bar: C7 requires it to
leave the last bar of the pass empty, and `events.test.ts`'s
*"plays toms, which the figure never does"* forbids a tom in every bar of the
loop except the last. The intersection is empty.
Changed: *Architecture* gains the two notes on why; Steps A1, A4, A5;
Assumptions records the rejected option.
Cost of reversal: `figures` is not reachable without also changing the registry
case, so reversing this decision means reversing D3 as well and then finding a
bar the toms may sound in. Before the mint it is a moved declaration; after it,
a re-render of six grooves.

**D3. The registry-wide tom assertion is narrowed rather than exempted, and it is
this epic's only edit to an existing test.** `events.test.ts`'s
*"plays toms, which the figure never does — R10"* lets a tom sound in the fill bar
and nowhere else, for **every** template, which contradicts AC5 outright. Epic
1's C7 saw only the pass's-last-bar half of the coupling. The rewrite keeps the
fill claim for every template, keeps the original "no tom before the fill" claim
for every template that declares no kit tom line, and adds a positive assertion
for one that does — its ordinary bars play exactly the declared line. So the
guard survives and no style is exempted by name.
Changed: *Approach*; a new *Architecture* section quoting the case; Step A4
(new); Step A9's variation constraint; Track A's `Owns` gains
`events.test.ts`; the wave-2 shared-file table; Q3 (new).
Cost of reversal: if the case may not be touched, R5 and AC5 are unreachable by
any mechanism the contract offers, and the requirement goes back to the PRD —
which is why this is asked as Q3 rather than assumed. Widening the case wrongly
would let a tom leak into an ordinary bar of any template unnoticed, which is
what the positive branch is there to prevent.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/writespec feature-25 epic-3`.

### Q2. Is AC4 asserted per bar, with the fill and variation bars excluded?

In a fill bar the kick line comes from the `FILLS` phrase, not from
`patterns.kick`, so "the bass follows the kick" can only hold there if the fill's
kick line also carries the bass anchors.

- [ ] **A) Per ordinary bar, fill and variation bars excluded, and the exclusion named in the spec.** *(recommended — it keeps the fill vocabulary free, which is the thing R7 exists to buy, and "bass follows kick" is a statement about the groove rather than about the punctuation. Reversal is cheap before the mint — the fill's kick line grows to include the anchor set — and costs a re-render of the six grooves after it.)*
- [ ] B) Per bar including the fill, so `FILLS['second-line'].fill.kick` must contain every bass-figure step. *(Musically defensible: a tuba player keeps the figure through a drum fill. It flattens the fill's kick to the anchor set and takes one degree of freedom away from Step A9.)*
- [ ] C) Over the whole groove rather than per bar — the union of bass steps inside the union of kick steps. *(Matches the AC's literal wording, is the weakest of the three, and would pass a groove whose bass and kick agree only when averaged over sixteen bars.)*

### Q3. May this epic narrow `events.test.ts`'s `plays toms, which the figure never does`?

The case is registry-wide and lets a tom sound in the fill bar and in no other
bar of the loop, for every template. AC5 asks for both toms once per pass. One of
the two has to move, and the case lives in a file Epic 1 and Epics 2 and 4 also
touch.

- [ ] **A) Narrow it, as Step A4 describes: the fill claim for every template, the "no tom before the fill" claim for every template declaring no kit tom line, and a positive "plays exactly its declared line" claim for one that does.** *(recommended — the case was standing in for "the toms are what marks a fill", and a style whose figure includes toms is a case it never had to consider. The guard survives as a positive assertion rather than an exemption, so a leaked tom still fails. Reversal costs the rewrite of one case; after the mint it also costs a re-render, because the toms would have to leave the figure.)*
- [ ] B) Leave the case alone and give up AC5's "once per pass" — the toms sound in the fill bar only, and R5's "toms earning their place" is satisfied by the fill and the rim. *(No test changes, no shared-file risk. It contradicts the PRD's R5 and AC5, so it is a requirement change and belongs in `/brainstorm` rather than here.)*
- [ ] C) Ask Epic 1 to make the change, since it already owns `events.test.ts` in Steps E7 and E8 and its C7 is where the coupling was half-noticed. *(Puts the edit in one place with the rest of the mechanism's tests. It also blocks this epic on another epic's rework of a case only this epic needs changed, and Epic 1 may already have merged.)*
- [ ] D) Keep the case and satisfy R5 with the rim and one tom only. *(The case forbids `tomHigh` and `tomLow` equally, so it does not help — recorded so the option is visibly closed rather than missed.)*
