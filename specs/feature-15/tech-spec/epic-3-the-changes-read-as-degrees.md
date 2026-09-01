# Tech spec — Epic 3: The changes read as degrees of the key

PRD: [../prd/epic-3-the-changes-read-as-degrees.md](../prd/epic-3-the-changes-read-as-degrees.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

The degree is data, so it travels the same road every other word about a groove
travels: `harmony.ts` already computes `progressionDegrees`, `MusicMeta` gains
it beside `progression`, `toGroove` copies it, `manifest.ts` writes it, and
`Groove` carries it into the app as an optional field the way `loopBars` does.
On the app side one new module turns a degree *index* into a numeral —
`romanNumeral('Blues', 3) === '♭V'` — and `barChords`'s bar arithmetic is
extracted into a `perBar` helper so symbol and numeral are mapped onto the four
bars by the same function rather than by two that agree today. `LeadSheet` gains
an optional `numerals` prop and draws each one in the `pb-9` air its bar already
reserves; `SolvedPanel` is the only place the two halves meet. The regeneration
is run as `npm run grooves -- --manifest-only`, which is the flag that exists
for exactly this case: it writes no mp3 at all, so R4b's "no audio changes" is
proved by there being no encode rather than by comparing bytes afterwards.

**This epic edits `components/solved/LeadSheet.tsx`, which means it cannot start
until Epic 1's Step A0 has landed.** Step A0 moves `SolvedPanel.tsx`,
`LeadSheet.tsx` and `ScaleStaff.tsx` out of `components/puzzle/` and into a new
`components/solved/` region; if it ran under this epic the two would collide on
the same three files. Every path in this spec is a post-move path. The roadmap's
Wave 1 pairing of Epic 1 and Epic 3 still holds — but only after Step A0, and
with one further ordering inside it: this epic's Track D touches
`SolvedPanel.tsx` and `GroovePuzzle.tsx`, which Epic 1's Track D also owns, so
Track D here runs *after* Epic 1's Track D. Tracks A, B and C share no file with
any track in Epic 1 and are parallel with all of it.

## Architecture

### The degree crosses the boundary as a number, never as a symbol

`scripts/grooves/theory/harmony.ts` already returns
`progressionDegrees: number[]` — "Scale-degree indices, always starting at 0
(the tonic)" — and those indices are indices into `intervalsFor(flavour)`, not
diatonic degree numbers. That distinction is the whole design: the app looks the
index up in `FLAVOUR_INTERVALS` and gets a semitone, and the semitone is what
decides the accidental. Nothing anywhere parses `A♭m7♭5` back into a degree, so
the enharmonic spelling the generator chose for a chord root never has to be
re-interpreted (R4).

**`MusicMeta` carries it, not a fourth argument to `toGroove`.** `buildEvents`
returns `{ events, music, harmony }` and two callers — `cli.ts`'s `generate` and
`add.ts`'s minting loop — already destructure only what they need. Threading
`harmony.progressionDegrees` alongside `music.progression` would mean two values
describing one progression arriving at `toGroove` by two different routes, and
would force an edit to `add.ts` as well; `add.ts` calls
`toGroove(spec, buildEvents(spec, template).music, delays[i])`, so putting the
field on `MusicMeta` means `grooves:add` writes it with no change at all, which
is what the PRD's last assumption asks for. The cost is that `MusicMeta` gains a
*required* field, so `tsc` names the seven hand-built `MusicMeta` literals in
the generator's own tests — that is the point of a required field, and every one
of them is inside Track A's ownership.

### `Groove.progressionDegrees` is optional, and sits beside `progression`

`FIELDS` in `manifest.ts` is "the thirteen fields of a Groove, in the order the
type declares them", and `renderEntry` skips a field whose value is `undefined`.
So the new field goes into `Groove` directly after `progression` and into
`FIELDS` in the same position: a diff of the generated manifest then reads as
one added line per groove, directly under the string it describes — the shape
feature-12 chose when it put `uuid` under `id`. `literal()` today renders
`string | number`; it gains a `readonly number[]` branch that writes
`[0, 2, 6, 3]`, because a field the renderer cannot spell is a field silently
dropped.

### The regeneration writes no audio

`cli.ts` already documents the flag this epic needs:

> `--manifest-only` re-renders the manifest and the lock from the committed
> audio. It is how a change to what a Groove carries ships without rewriting
> sixteen mp3s that no one asked to change.

So R4b/AC6 are satisfied a fortiori: with `encode: false` no mp3 is written, and
`headDelaySeconds` is re-probed with `ffprobe` from the *same committed files*,
so it re-measures to the same number. What changes in `grooves.lock.json` is
`manifestSha256` alone — every `grooves[]` entry's `sha256` and `bytes` stay put,
because the files they hash were never touched. That is the evidence AC6 asks
for, and it is a `git diff`, not a claim. A full `npm run grooves` is not needed
and is not asked for: PCM determinism is asserted in `cli.test.ts`, but mp3
*bytes* are a function of the local encoder, and re-encoding thirty files to
prove they did not change is the one thing `--manifest-only` exists to avoid.
`docs/music.md`'s four never-change items are all untouched: `src/lib/hash.ts`,
`MUSIC_LABEL` and its draw order, the order of `FLAVOURS`, and every `uuid`. No
new randomness is drawn — `progressionDegrees` is a value `buildHarmony` already
returned and threw away.

### One bar mapping, not two

`barChords` maps `chords[bar % chords.length]` because that is what the
generator comps (`progressionMidi[bar % length]`). The degrees are the same kind
of list and must land on the same bars, so the arithmetic is extracted into
`perBar<T>` in `changes.ts` and both callers go through it. R2 is then true by
construction rather than by two functions currently agreeing.

### How a numeral is written

For a seven-note flavour the degree *number* is the index + 1, and the
accidental is the signed difference between `FLAVOUR_INTERVALS[flavour][i]` and
the major scale's `[0, 2, 4, 5, 7, 9, 11][i]`. That gives Lydian's index 3 a
`♯IV` (6 against 5) and Mixolydian's index 6 a `♭VII` (10 against 11), which is
right in both directions.

For a flavour whose length is not seven the indices are not consecutive degrees,
so the number comes from **`FLAVOUR_LETTER_STEPS[flavour]`**, which already
declares them: blues is `[0, 2, 3, 4, 4, 6]`, so `+ 1` gives the numbers
`1 3 4 5 5 7` and `[0, 3, 5, 6, 7, 10]` reads `I ♭III IV ♭V V ♭VII`. The whole
rule is therefore one line —
`number = (FLAVOUR_LETTER_STEPS[flavour]?.[i] ?? i) + 1` — with the accidental
unchanged from the paragraph above.

Use that table rather than deriving the number from the semitone. "The nearest
major-scale degree at or above the interval" agrees with it for the blues scale
and disagrees for Lydian, where 6 semitones is a `♯IV` and not a `♭V` — so a
semitone-derived number has to be special-cased back to the index for
seven-note scales, which is two rules where the shipped table is one. It is also
the same rule Epic 1's `scaleDegrees` follows for its arabic labels, so the sheet
and the staff cannot disagree about which degree a note is.

Worth knowing before writing the blues test: `harmony.ts`'s `IDIOMS.blues` states
its chords at offsets 0, 5 and 7, which are indices 0, 2 and 4, so a *shipped*
blues groove only ever reads `I · IV · V`. The `♭V` degree exists in the scale
and carries no chord today. AC4 is therefore a unit assertion on the numeral
function, not something to hunt for in the manifest — and it is worth having
precisely because a future idiom on that degree would otherwise print `♯IV`.

### It takes the flavour, not the answer

`romanNumeral` and `barNumerals` take a `Flavour`, never an `Answer`. R2b — the
numerals are counted from the day's root, never from a parent major scale — is
then structural: the function has no root to count from and no way to reach one,
so `I` for index 0 is the only answer it can give. That also keeps this epic off
Epic 1's `scaleDegrees(answer)` contract, which the roadmap wants: the two run
in the same wave, and a dependency on an unwritten signature is a wave-2 track
wearing a wave-1 badge. The two cannot disagree about *which* degrees a scale
has, because both read `FLAVOUR_INTERVALS`.

### It is total

`changes.ts` set the rule — "four blank bars beat the day's payoff crashing" — so
this half of the panel keeps it. A missing `progressionDegrees`, an empty array,
an index out of range, or a flavour with no interval entry all produce an empty
numeral, never a throw (R4a, R8, AC7). This is deliberately the opposite of Epic
1's `scaleDegrees`, which throws `UnknownFlavourError`: that one names the
scale's own notes and a gap there is a broken drawing, while a numeral is, in the
PRD's words, "less load-bearing than a bar".

## Contracts

Frozen before any track starts. Track B builds against the `Groove` field while
Track A is still writing it; Track C builds against `LeadSheetProps` while
Track B is still deriving the strings.

```ts
// src/lib/groove.ts — optional, as loopBars is, and directly after `progression`
export type Groove = {
  // …
  progression: string // absolute, e.g. "Dm–G–C"
  /**
   * One scale-degree index per progression chord, in the same order — an index
   * into the flavour's interval table, always starting at 0 (the tonic). What
   * `scripts/grooves/theory/harmony.ts` computed when it chose the chords, so
   * the app never parses a chord symbol back into a degree.
   *
   * Optional, as `loopBars` is: a manifest written before the field existed
   * still describes a groove, and where the degrees are missing the numerals
   * are missing and the bars are not.
   */
  progressionDegrees?: number[]
  // …unchanged
}
```

```ts
// scripts/grooves/types.ts — required: the generator always knows it
export type MusicMeta = {
  // …
  /** Display string, e.g. "Cm–Fm–G7". */
  progression: string
  /** One scale-degree index per progression chord — `Harmony.progressionDegrees`. */
  progressionDegrees: number[]
}
```

```ts
// src/features/daily-groove/lib/theory/changes.ts
/**
 * The value sounding in each of the four bars: the generator's own
 * `[bar % length]`. `undefined` in every bar when there is nothing to map.
 * `barChords` and `barNumerals` both go through this, so a symbol and a numeral
 * in one bar always describe the same chord.
 */
export function perBar<T>(values: readonly T[]): (T | undefined)[]
```

```ts
// src/features/daily-groove/lib/theory/numerals.ts
import type { Flavour } from '../../types'

/**
 * The Roman numeral for one scale-degree index of a flavour: plain UPPERCASE,
 * carrying the degree's own accidental and nothing about the chord's quality.
 * Blues + 3 → '♭V'; Mixolydian + 6 → '♭VII'; Lydian + 3 → '♯IV'.
 *
 * Takes a flavour and not an answer: the numerals are counted from the day's
 * root, so index 0 is always 'I' and there is no root here to count from
 * anything else (R2b).
 *
 * Total: '' for an unknown flavour or an index the scale does not have. Never
 * throws — a numeral is less load-bearing than a bar (R8).
 */
export function romanNumeral(flavour: Flavour, degree: number): string

/**
 * One numeral per bar of the four-bar figure, mapped by `perBar` so bar four of
 * a three-chord progression is bar one's numeral. '' where a bar has no
 * numeral; four empty strings when there are no degrees at all (R4a).
 */
export function barNumerals(
  flavour: Flavour,
  degrees: readonly number[] | undefined,
): string[]
```

```ts
// src/features/daily-groove/components/solved/LeadSheet.tsx
type LeadSheetProps = {
  /** One symbol per bar, in order. Four for the four-bar figure. */
  chords: string[]
  /**
   * One numeral per bar, same length and order as `chords`. '' draws no
   * numeral; the prop absent draws none at all and leaves the accessible name
   * as the symbols alone.
   */
  numerals?: string[]
}
```

```ts
// src/features/daily-groove/components/solved/SolvedPanel.tsx
type SolvedPanelProps = {
  answer: Answer
  progression: string
  progressionDegrees?: number[]   // new
  revealed: boolean
  // `tries` and `streak` are gone — Epic 1, Step D2.
}
```

## Tracks

### Track A — The degree ships in the manifest

- **Goal** — `Groove` carries `progressionDegrees`, the generator writes it, and
  the committed manifest has it for all thirty grooves with no mp3 changed.
- **Owns** — `scripts/grooves/**` (`types.ts`, `events.ts`, `cli.ts`,
  `manifest.ts` and their tests, `theory/harmony.test.ts`,
  `theory/pitches.test.ts`, `theory/validity.test.ts`, `gate.test.ts`,
  `grooves.lock.json`), `src/lib/groove.ts`, `src/lib/groove.test.ts`, and the
  generated output `src/features/daily-groove/data/grooves.generated.ts` (a
  write destination, not a hand-edited file)
- **Role** — `musician`. A track owning files under `scripts/grooves/` takes it.
  The change is data plumbing, and the musical judgement it needs is exactly
  one: confirming that `harmony.ts`'s scale-degree *indices* are the right thing
  to print — that an index into the flavour's interval table, and not a diatonic
  degree number or a re-reading of the chord symbol, is what names the degree
  the groove actually plays.
- **Depends on** — nothing. Not even Epic 1's Step A0: it touches no component.
- **Parallel with** — Track B, Track C, and every track in Epic 1
- **Done when** — `npm run test:gen` and `npm run grooves:verify` are green, and
  `git status` shows no file changed under `public/grooves/`.
- **Command** — `npm run test:gen` for its own suite; `npm test` for
  `src/lib/groove.test.ts`.

### Track B — A degree reads as a numeral

- **Goal** — `romanNumeral` and `barNumerals` name every degree of every flavour
  the catalogue can play, through one bar mapping shared with `barChords`.
- **Owns** — `src/features/daily-groove/lib/theory/numerals.ts` and
  `numerals.test.ts`, `lib/theory/changes.ts` and `changes.test.ts`
- **Role** — `implementer`
- **Depends on** — the `perBar` and `romanNumeral` contracts only. It reads
  `FLAVOUR_INTERVALS` from `lib/theory/notes.ts` and edits nothing there, so it
  collides with no track in Epic 1, Epic 2 or Epic 4.
- **Parallel with** — Track A, Track C
- **Done when** — its own tests pass with no shipped manifest involved.
- **Command** — `npm test`

### Track C — The sheet has room for a numeral

- **Goal** — `LeadSheet` draws a numeral in each bar's reserved air, changes no
  geometry, and reads correctly to a screen reader.
- **Owns** — `src/features/daily-groove/components/solved/LeadSheet.tsx` and
  `LeadSheet.test.tsx`
- **Role** — `implementer`
- **Depends on** — Epic 1's Step A0 (the file's location) and the
  `LeadSheetProps` contract. Nothing of Track B's: it is handed strings.
- **Parallel with** — Track A, Track B
- **Done when** — its component tests pass with hand-written numerals.
- **Command** — `npm test`

### Track D — The box reads the day's changes as degrees

- **Goal** — a solved day shows four numerals under four symbols, a groove
  without degrees shows four symbols and no numerals, and every groove in the
  shipped manifest is proved to fill all four bars.
- **Owns** — `src/features/daily-groove/components/solved/SolvedPanel.tsx` and
  `SolvedPanel.test.tsx`, `components/GroovePuzzle.tsx` (one prop at the call
  site), `components/GroovePuzzle.page.test.tsx`,
  `src/features/daily-groove/data/grooves.generated.test.ts`
- **Role** — `implementer`
- **Depends on** — Track A's regenerated manifest, Track B's `barNumerals`,
  Track C's `numerals` prop, **and Epic 1's Track D**, which owns
  `SolvedPanel.tsx` and `GroovePuzzle.tsx` and rewrites the panel's props in the
  same wave. This track is a two-line addition on top of that edit and must not
  run beside it.
- **Parallel with** — nothing in this epic
- **Done when** — the panel, the page and the shipped-manifest tests pass.
- **Command** — `npm test`

## Execution waves

- **Wave 0 (prerequisite, owned by Epic 1):** Epic 1's Step A0 — the box and its
  two drawings move to `components/solved/`. Nothing in Track C or Track D
  starts before it lands.
- **Wave 1 (parallel):** Track A, Track B, Track C. Also parallel with Epic 1's
  Tracks B, C and D.
- **Wave 2:** Track D — needs A's data, B's function, C's prop and Epic 1's
  Track D.
- **Wave 3:** Integration.

## Implementation

### Track A — The degree ships in the manifest

#### Step A1 — A groove may carry its degrees

Covers: R4, R4a

- **Test first** — `src/lib/groove.test.ts`: add one `it` asserting that a
  literal carrying `progressionDegrees: [0, 2, 6, 3]` alongside every required
  field `satisfies Groove`, that `groove.progressionDegrees` equals
  `[0, 2, 6, 3]`, and that a second literal omitting the field also
  `satisfies Groove` — the `loopBars` precedent, asserted rather than assumed.
  Leave the existing "accepts a fully-populated Groove literal" key-list
  assertion alone; its fixture omits the optional fields on purpose. Run it:
  `npx tsc --noEmit` fails with "Object literal may only specify known
  properties, and 'progressionDegrees' does not exist in type 'Groove'".
- **Implement** — `src/lib/groove.ts`: add `progressionDegrees?: number[]`
  directly after `progression`, with the doc comment from Contracts. The module
  stays a leaf — no import is added, so `src/lib/groove.test.ts`'s
  zero-specifier assertion is untouched.
- **Green when** — `tsc` is clean and both literals type-check.
- **Refactor** — none.

#### Step A2 — The words that describe the events include the degrees

Covers: R4, AC5

- **Test first** — `scripts/grooves/events.test.ts`: for every template and a
  fixed seed, assert `music.progressionDegrees` equals
  `harmony.progressionDegrees`, that its length equals
  `music.progression.split('–').length`, and that its first entry is `0`. Run
  it: fails with "Cannot read properties of undefined (reading 'length')" —
  `music` has no such field.
- **Implement** — `scripts/grooves/types.ts`: add
  `progressionDegrees: number[]` to `MusicMeta` after `progression`.
  `scripts/grooves/events.ts` (~line 1283): add
  `progressionDegrees: harmony.progressionDegrees` to the `const music:
  MusicMeta` literal, beside `progression: harmony.progressionName`, so both
  come off the same `Harmony` in the same statement.
- **Green when** — the three assertions pass for every template, and
  `npx tsc --noEmit` is clean after the seven hand-built `MusicMeta` literals
  gain the field: four in `cli.test.ts` (the `as const` fixtures in the
  `toGroove` and `displayFlavour` blocks, ~lines 262, 286, 302, 338), one in
  `gate.test.ts` (~line 195), `MUSIC` in `theory/pitches.test.ts` (~line 32),
  and `musicFor` in `theory/validity.test.ts` (~line 67) — which takes a
  `harmony` argument and so passes `harmony.progressionDegrees` through rather
  than restating it.
- **Refactor** — none. Do not make the field optional to spare those fixtures;
  the type error naming each of them is the guard that a future render path
  cannot forget it.

#### Step A3 — The entry carries the degrees it was built from

Covers: R4, AC5

- **Test first** — `scripts/grooves/cli.test.ts`, in the `toGroove` describe:
  assert `toGroove(SPECS[0], music, 0).progressionDegrees` equals the
  fixture's `progressionDegrees`, and that a `music` with a different array
  produces a different entry — nothing here is shared or derived. Run it: fails
  with "expected undefined to equal [ 0, 2, 6, 3 ]".
- **Implement** — `scripts/grooves/cli.ts`: one line in `toGroove`,
  `progressionDegrees: music.progressionDegrees`, directly after
  `progression: music.progression`.
- **Green when** — both assertions pass, and the determinism test ("renders
  identical PCM when run twice") stays green — `a.entries` deep-equals
  `b.entries`, which now includes the new array.
- **Refactor** — none. `add.ts` needs no edit: it calls
  `toGroove(spec, buildEvents(spec, template).music, delays[i])`, so
  `grooves:add` writes the field for free.

#### Step A4 — The manifest writes an array field

Covers: R4, R4a, AC5

- **Test first** — `scripts/grooves/manifest.test.ts`: add
  `progressionDegrees: [0, 2, 6, 3]` to the `ENTRY` fixture and
  `[0, 4, 5]` to `SECOND`, then assert (a) the rendered source matches
  `/^ {4}progressionDegrees: \[0, 2, 6, 3\],$/m`, (b)
  `source.indexOf("progression: '")` is less than
  `source.indexOf('progressionDegrees:')` which is less than
  `source.indexOf("root: '")`, (c) the round trip through `evaluate()` returns
  the array itself, and (d) an entry with the field deleted renders no
  `progressionDegrees` and no `undefined` — the `loopBars` omission test, for
  the second optional field. Run it: fails twice — the line is absent because
  `FIELDS` does not list it, and the existing "writes every field of every
  entry" test now fails because `evaluate()`'s output no longer matches `ENTRY`.
- **Implement** — `scripts/grooves/manifest.ts`: add `'progressionDegrees'` to
  `FIELDS` between `'progression'` and `'root'`; widen `literal` to
  `string | number | readonly number[]`, returning `` `[${value.join(', ')}]` ``
  for an array; update the `FIELDS` doc comment from "thirteen" to "fourteen".
- **Green when** — all four assertions pass and the whole `renderManifest`
  describe is green.
- **Refactor** — none. Keep the array branch in `literal` rather than in
  `renderEntry`: one function decides how every value is spelled.

#### Step A5 — Every degree the generator can draw is a degree the scale has

Covers: R4, AC8

- **Test first** — `scripts/grooves/theory/harmony.test.ts` already sweeps every
  flavour × root and asserts `progressionDegrees` has 3–4 entries, starts at
  `0`, and matches `progressionMidi` in length. Add the one claim it does not
  make: that **every** entry is an integer in
  `[0, intervalsFor(flavour).length)` — an index the flavour's interval table
  actually has. Run it: passes on arrival if `chordsForScale` is honest, which
  is the point. The app looks each index up in `FLAVOUR_INTERVALS`, so an
  out-of-range index would silently blank a numeral rather than fail anything,
  and this is the only place that can say so loudly.
- **Implement** — nothing expected. If an index is out of range, the fault is in
  `chordsForScale`'s idiom branch (`degrees.indexOf(offset)` returning `-1` is
  already skipped) and is fixed there.
- **Green when** — every root × flavour pair passes.
- **Refactor** — none.

#### Step A6 — The shipped manifest carries the degrees, and no audio moves

Covers: R4b, AC5, AC6

- **Test first** — `scripts/grooves/manifest.test.ts`, in the existing
  `describe('the committed manifest')`: assert that every entry of the committed
  file carries a `progressionDegrees` array whose first entry is `0`, whose
  length equals `groove.progression.split('–').length`, and none of whose
  entries is negative. Run it: fails naming `groove-01`, "expected undefined to
  be an array" — the committed manifest predates the field.
- **Implement** — run `npm run grooves -- --manifest-only`. It renders PCM,
  writes no mp3, re-probes `headDelaySeconds` with `ffprobe` from the committed
  files, rewrites `grooves.generated.ts` and merges the lock. Requires ffmpeg
  and the committed sample pack; requires no encode.
- **Green when** — the assertion passes **and** all four pieces of evidence hold:
  1. `git status --porcelain public/grooves` is empty — no mp3 was written, so
     no mp3's bytes could have changed.
  2. `git diff --stat src/features/daily-groove/data/grooves.generated.ts`
     shows exactly 30 insertions and 0 deletions, and
     `git diff -U0 …grooves.generated.ts | grep '^[+-]' | grep -v '^+++\|^---'`
     shows only `+    progressionDegrees: [...],` lines — in particular no
     `headDelaySeconds` line among them.
  3. `git diff scripts/grooves/grooves.lock.json` changes `manifestSha256` and
     nothing else: every `grooves[]` entry's `sha256` and `bytes` are untouched,
     and the `notes`/`notesManifestSha256`/`packSha256` family survives the
     merge.
  4. `npm run grooves:verify` exits 0 (this is what `prebuild` runs), and
     `npm run test:gen` is green — `lock.test.ts`, `boundary.test.ts` and
     `catalogue-gate.test.ts` included.
- **Refactor** — none, and nothing to undo. `catalogue.json` is not touched:
  it holds `{ id, uuid, template, seed }` and everything else is derived, which
  is why the same seeds re-derive the same audio. None of `docs/music.md`'s four
  never-change items is edited, and no new RNG draw is added — the degrees were
  already computed and thrown away.

### Track B — A degree reads as a numeral

#### Step B1 — One bar mapping, used twice

Covers: R2

- **Test first** — `lib/theory/changes.test.ts`: assert
  `perBar(['a', 'b', 'c'])` equals `['a', 'b', 'c', 'a']`, `perBar([])` equals
  `[undefined, undefined, undefined, undefined]`, `perBar([1, 2, 3, 4, 5])`
  equals `[1, 2, 3, 4]`, and `perBar(['x'])` equals `['x', 'x', 'x', 'x']`. Run
  it: fails with "perBar is not a function".
- **Implement** — `lib/theory/changes.ts`: export
  `perBar<T>(values: readonly T[]): (T | undefined)[]` holding the
  `Array.from({ length: BAR_COUNT }, (_, bar) => values[bar % values.length])`
  arithmetic and the comment that names `progressionMidi[bar % length]` as its
  source; an empty list yields `BAR_COUNT` `undefined`s. Rewrite `barChords` as
  `perBar(chords).map((chord) => chord ?? '')`.
- **Green when** — the four new assertions pass **and** every existing
  `barChords` test is untouched and green, the shipped-catalogue block included.
  That the old tests need no edit is the evidence the refactor changed nothing.
- **Refactor** — move `barChords`'s "the generator comps
  `progressionMidi[bar % length]`" paragraph onto `perBar`, where the arithmetic
  now lives, leaving `barChords` the paragraph about splitting the string.

#### Step B2 — A seven-note mode's degree reads as a numeral

Covers: R1, R2b, R3a, AC10

- **Test first** — `lib/theory/numerals.test.ts`: assert
  `romanNumeral('Mixolydian', 0) === 'I'`,
  `romanNumeral('Mixolydian', 3) === 'IV'`,
  `romanNumeral('Mixolydian', 6) === '♭VII'`,
  `romanNumeral('Dorian', 2) === '♭III'`,
  `romanNumeral('Dorian', 5) === 'VI'`,
  `romanNumeral('Lydian', 3) === '♯IV'`, and
  `romanNumeral('Aeolian', 1) === 'II'`. Run it: fails with "romanNumeral is
  not a function".
- **Implement** — `lib/theory/numerals.ts`: import `FLAVOUR_INTERVALS` from
  `./notes` (a read; the file is not edited). Declare
  `const MAJOR = [0, 2, 4, 5, 7, 9, 11]`, `const NUMERALS = ['I', 'II', 'III',
  'IV', 'V', 'VI', 'VII']` and a small offset→accidental table
  (`-2: '♭♭', -1: '♭', 0: '', 1: '♯', 2: '♯♯'`). Look the flavour up
  case-insensitively, the way `notes.ts`'s `lookup` does. For a seven-interval
  flavour: number = index + 1, accidental = `intervals[i] - MAJOR[i]`.
- **Green when** — all seven assertions pass.
- **Refactor** — none.

#### Step B3 — The blues scale's fourth degree reads ♭V

Covers: R3a, AC4

- **Test first** — same file: assert `romanNumeral('Blues', 1) === '♭III'`,
  `romanNumeral('Blues', 2) === 'IV'`, `romanNumeral('Blues', 3) === '♭V'`,
  `romanNumeral('Blues', 4) === 'V'`, `romanNumeral('Blues', 5) === '♭VII'`, and
  that `romanNumeral('Blues', 0) === 'I'`. Add the comment that the shipped
  blues grooves only ever comp indices 0, 2 and 4 — `harmony.ts`'s
  `IDIOMS.blues` states offsets 0, 5 and 7 — so `♭V` is asserted here and
  nowhere else in the suite. Run it: fails with "expected '♯II' to be '♭III'" —
  index-based numbering reads a six-note scale as if its degrees were
  consecutive.
- **Implement** — for a flavour whose interval count is not seven, derive the
  degree number from the semitone: the position of the nearest `MAJOR` entry at
  or *above* the interval, with the accidental as the signed difference from
  it — so 6 semitones takes the fifth and reads `♭V`, never the fourth as
  `♯IV`.
- **Green when** — the six blues assertions pass and Step B2's stay green:
  seven-note flavours keep the index rule, which is what preserves Lydian's
  `♯IV`.
- **Refactor** — none. Keep the two rules explicitly separate and say in a
  comment that length ≠ 7 is the trigger, the way `FLAVOUR_LETTER_STEPS` does.

#### Step B4 — The numeral says nothing about the chord's quality

Covers: R3, AC3

- **Test first** — same file: for every flavour in `FLAVOUR_INTERVALS` and every
  valid index, assert the numeral matches
  `/^[♭♯]{0,2}(I|II|III|IV|V|VI|VII)$/` — so no lower case anywhere, no `ø`, no
  `°`, no `+`, no `7`, no `♭5` suffix — and that the set of numerals a flavour
  produces has no duplicates. Then the two cases the PRD names: on E Dorian the
  `C♯m7♭5` chord is index 5 and reads `VI`, and on F♯ Aeolian the `A♭m7♭5` chord
  is index 1 and reads `II`. Run it: passes on arrival if B2 and B3 were written
  plainly, which is the point — the assertion is what stops a later "helpful"
  lower-casing, and the two named cases document that the half-diminished
  quality lives on the symbol above.
- **Implement** — nothing expected; fix any flavour the sweep names.
- **Green when** — all fourteen flavours pass.
- **Refactor** — none.

#### Step B5 — A gap is a blank numeral, never a throw

Covers: R4a, R8, AC7

- **Test first** — same file: assert `romanNumeral('Klingon', 0) === ''` and
  does not throw; `romanNumeral('Blues', 6) === ''` (one past the six-note
  scale); `romanNumeral('Dorian', -1) === ''`;
  `romanNumeral('Dorian', 1.5) === ''`;
  `barNumerals('Dorian', undefined)` equals `['', '', '', '']`;
  `barNumerals('Dorian', [])` equals `['', '', '', '']`; and
  `barNumerals('Klingon', [0, 1])` equals `['', '', '', '']`. Run it: fails —
  the lookup miss returns `undefined` and the label is built from it.
- **Implement** — return `''` on a missed flavour lookup or an index that is not
  an integer in range. Do not import or throw `UnknownFlavourError`: this module
  is deliberately the total one (R8), and the difference from
  `scaleDegrees`, which throws, is a decision, not an oversight — say so in the
  doc comment.
- **Green when** — all seven assertions pass and nothing throws.
- **Refactor** — none.

#### Step B6 — Four bars, and bar four is a return

Covers: R1, R2, R2a, R2b, AC2, AC10

- **Test first** — same file: assert `barNumerals('Dorian', [0, 4, 5])` equals
  `['I', 'V', 'VI', 'I']` — the PRD's E Dorian example, whose fourth bar is bar
  one's numeral; `barNumerals('Mixolydian', [0, 2, 6, 3])` equals
  `['I', 'III', '♭VII', 'IV']` — `groove-01`'s real progression;
  `barNumerals('Blues', [0, 2, 4])` equals `['I', 'IV', 'V', 'I']`; that every
  result has `BAR_COUNT` entries; and that the first entry is `'I'` for every
  flavour in `FLAVOUR_INTERVALS` given `[0]`. Run it: fails with "barNumerals is
  not a function".
- **Implement** — `barNumerals` = `perBar(degrees ?? [])` mapped through
  `romanNumeral`, `undefined` → `''`. It calls `perBar`; it does not restate the
  modulo.
- **Green when** — all five assertions pass.
- **Refactor** — none.

#### Step B7 — There is no chord-symbol parser to disagree with the generator

Covers: R4, AC5

- **Test first** — same file: read `lib/theory/numerals.ts` from disk — the
  `grooves.generated.test.ts` pattern, and `docs.test.ts`'s — and assert its
  source contains none of `split(`, `match(`, `slice(`, `replace(`, `indexOf(`
  over a symbol, and names neither `chord` nor `progression` outside a comment.
  Assert it imports only `FLAVOUR_INTERVALS` from `./notes`, `perBar` from
  `./changes`, and types. Run it: passes on arrival — the assertion exists
  because "the generator knows the answer, and a parser would be a second source
  of truth waiting to disagree with it" is the one claim in this epic that a
  later convenience edit would quietly break.
- **Implement** — nothing expected.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track C — The sheet has room for a numeral

#### Step C1 — Each bar carries a numeral under its symbol

Covers: R1, AC1

- **Test first** — `components/solved/LeadSheet.test.tsx`: render
  `<LeadSheet chords={CHANGES} numerals={['I', 'III', '♭VII', 'IV']} />` and
  assert each `[data-bar]` contains exactly one `[data-numeral]`, and that
  those elements' text, in document order, equals
  `['I', 'III', '♭VII', 'IV']`. Then update the existing "shows the chords and
  nothing else" test: with no `numerals` prop it still asserts
  `container.textContent === CHANGES.join('')`; a second case with numerals
  asserts the text is the four symbols and the four numerals interleaved bar by
  bar and nothing more — still no title, key or tempo. Run it: fails with
  "expected 0 to be 1"; the `numerals` prop does not exist.
- **Implement** — `LeadSheet.tsx`: add `numerals?: string[]` to
  `LeadSheetProps`, and inside each bar render, when `numerals?.[bar]` is
  non-empty, `<span data-numeral="" className="absolute bottom-2 left-3">
  <Lettering size="sm">{numerals[bar]}</Lettering></span>`.
- **Green when** — both assertions pass and every existing `LeadSheet` test is
  green.
- **Refactor** — none.

#### Step C2 — The numeral sits in the air the bar already reserves

Covers: R7, AC9

- **Test first** — same file: assert every bar's `className` still contains
  `pb-9`, `pl-3`, `pt-1`, `relative` and `border-l` and gains nothing — compare
  it against the same string the no-numerals render produces, so the assertion
  is "identical with and without numerals" rather than a list to maintain.
  Assert the sheet's own `className` still matches `/\bgrid-cols-2\b/` and
  `/\bsm:grid-cols-4\b/` and still not `/\bflex-wrap\b/`. Assert each numeral's
  `className` contains `absolute`, `left-3` and a `bottom-` utility, and — the
  claim AC9 actually needs — that `bar.contains(numeral)` is true for its own
  bar and false for every other, which is the layout-independent form of "each
  numeral stays in its own bar" (jsdom resolves no media query, so the 2 × 2
  break itself is checked by eye in the demo path). Run it: passes if C1 used
  absolute positioning; fails on the bar-className comparison the moment the
  numeral is put in flow and the bar's padding is changed to make room.
- **Implement** — nothing expected. The `pb-9` air and the `relative` bar are
  already there; that is why the numeral is positioned rather than flowed.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C3 — Same hand, same ink

Covers: R5

- **Test first** — same file: assert each numeral's text sits inside an element
  whose `className` matches `/font-jazz/` and `/text-\[15px\]/` — the `sm`
  lettering size, smaller than the symbol's `md` above it. Confirm the existing
  "takes its ink from the surface" sweep, which walks every element in the
  container, now walks the numerals too and stays green: no `text-*` colour, no
  hex, no `fill`, no `stroke`. Run it: passes if C1 used `Lettering`; fails if
  the numeral was written as a bare `<span>` with a font utility of its own.
- **Implement** — nothing expected. `Lettering` names no tone, so the ink is the
  panel's `currentColor` and flips with the palette in both directions.
- **Green when** — both assertions pass, and the "carries no stave" test stays
  green — the numeral adds no `border-t`/`border-b` and no `svg`.
- **Refactor** — none.

#### Step C4 — A bar without a numeral is still a bar

Covers: R4a, R8, AC7

- **Test first** — same file: render `numerals={['I', '', '', 'IV']}` and assert
  bars 2 and 3 contain no `[data-numeral]` while their symbols are unchanged;
  render with no `numerals` prop and assert `[data-numeral]` count is 0, four
  bars are still drawn, and
  `screen.getByRole('img', { name: 'C7 · Em7♭5 · B♭maj7 · Fmaj7' })` still
  resolves — the accessible name is unchanged when there is nothing to add.
  Render `chords={['', '', '', '']}` with `numerals={['I', 'V', 'I', 'V']}` and
  assert it does not throw. Run it: the empty-string case fails if C1 rendered a
  numeral for `''`.
- **Implement** — guard on truthiness, not on `!== undefined`, so `''` draws
  nothing.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C5 — The numerals are not a sighted-only layer

Covers: R1, AC1

- **Test first** — same file: with numerals, assert
  `screen.getByRole('img', { name: 'C7 I · Em7♭5 III · B♭maj7 ♭VII · Fmaj7 IV' })`
  resolves; with `numerals={['I', '', '', 'IV']}` assert the name is
  `'C7 I · Em7♭5 · B♭maj7 · Fmaj7 IV'`. Run it: fails — the name is still the
  symbols alone.
- **Implement** — build the label per bar:
  `numeral ? \`${chord} ${numeral}\` : chord`, joined with `' · '` as now. The
  `role="img"` with an `aria-label` hides the subtree from assistive
  technology, so a numeral not in the label is a numeral no screen-reader user
  ever hears.
- **Green when** — both names resolve and Step C4's unchanged-name assertion
  stays green.
- **Refactor** — none.

### Track D — The box reads the day's changes as degrees

#### Step D1 — The box shows the day's numerals

Covers: R1, R2b, AC1, AC3, AC10

- **Test first** — `components/solved/SolvedPanel.test.tsx`: render with
  `answer={{ root: 'C', flavour: 'Mixolydian' }}`,
  `progression="C7–Em7♭5–B♭maj7–Fmaj7"`,
  `progressionDegrees={[0, 2, 6, 3]}` and assert the four `[data-numeral]`
  elements read `I`, `III`, `♭VII`, `IV` in order — bar one is `I`, the
  half-diminished bar is a plain `III`, and nothing anywhere reads as a degree
  of a parent major scale. Run it: TypeScript rejects the unknown prop and no
  numeral renders.
- **Implement** — `SolvedPanel.tsx`: add `progressionDegrees?: number[]` to
  `SolvedPanelProps` with the Contracts doc comment, and pass
  `numerals={barNumerals(answer.flavour, progressionDegrees)}` to `LeadSheet`
  beside the existing `chords={barChords(progression)}`.
- **Green when** — the assertion passes.
- **Refactor** — none. The panel always passes the array — `barNumerals` is
  total, so there is no conditional prop here; `LeadSheet`'s optional prop is
  for its own tests and its own totality.

#### Step D2 — A three-chord day returns to bar one

Covers: R2, R2a, AC2

- **Test first** — same file: render with
  `answer={{ root: 'E', flavour: 'Dorian' }}`,
  `progression="Em7–Bm7–C♯m7♭5"`, `progressionDegrees={[0, 4, 5]}` and assert
  the symbols read `Em7 Bm7 C♯m7♭5 Em7` and the numerals read `I V VI I` — bar
  four's numeral equals bar one's, and no bar is blank. Run it: passes if D1
  went through `barNumerals`; fails the moment a second mapping is introduced
  that pads instead of cycling, which is what it is here to prevent.
- **Implement** — nothing expected.
- **Green when** — both rows match.
- **Refactor** — none.

#### Step D3 — A groove with no degrees still shows its changes

Covers: R4a, R8, AC7

- **Test first** — same file: render a solved day with no
  `progressionDegrees` prop at all and assert the four bars show their symbols,
  no `[data-numeral]` exists, and the render does not throw; assert the same for
  `progressionDegrees={[]}`. Run it: passes if `barNumerals` is total — the
  assertion pins the panel against a later `progressionDegrees!` or a
  non-null assertion at the call site.
- **Implement** — nothing expected.
- **Green when** — both cases render four bars and no numerals.
- **Refactor** — none.

#### Step D4 — The numerals appear in the box and nowhere else

Covers: R6, AC1, AC6

- **Test first** — `components/GroovePuzzle.page.test.tsx`: on a solved day
  assert exactly four `[data-numeral]` elements exist and all four are inside
  the `role="status"` region; mid-puzzle, with the same groove, assert zero
  `[data-numeral]` anywhere on the page — the progress track's chord symbols
  stay symbols. Run it: fails on the solved case with "expected 0 to be 4" —
  `GroovePuzzle` does not pass the field down.
- **Implement** — `components/GroovePuzzle.tsx`: add
  `progressionDegrees={groove.progressionDegrees}` to the `SolvedPanel` call
  site, beside `progression={groove.progression}`.
- **Green when** — both assertions pass, and Epic 1's Step D5 assertion — one
  `role="status"` region — stays green.
- **Refactor** — none.

#### Step D5 — Every groove that ships fills all four bars

Covers: R2a, R4, AC5, AC8, AC11

- **Test first** — `src/features/daily-groove/data/grooves.generated.test.ts`:
  extend the "gives every entry all thirteen fields, correctly typed" test to
  fourteen — `Array.isArray(g.progressionDegrees)` — and add a new
  `describe('the changes of every groove read as degrees')`, reaching
  `barNumerals` and `barChords` through `await import('../lib/theory/numerals')`
  and `'../lib/theory/changes'` the way the neighbouring "can be spelled" block
  reaches `scaleNotes`. For every entry:
  asserts `progressionDegrees` is a non-empty array of integers ≥ 0 whose first
  entry is `0` and whose length equals `g.progression.split('–').length`
  (AC5); computes `barNumerals(g.flavour, g.progressionDegrees)` and asserts it
  has `BAR_COUNT` entries, none of them `''` (AC8, AC11), the first `'I'`
  (AC10), and every one matching `/^[♭♯]{0,2}(I|II|III|IV|V|VI|VII)$/` (AC3);
  and asserts `barChords(g.progression)` and the numerals have the same length,
  so no bar can carry a symbol and no numeral. Derive the flavour list from
  `GROOVES`, never from a hardcoded list — the `families.test.ts` lesson. Run
  it: before Track A's Step A6 it fails on every groove ("expected undefined to
  be an array"); after A6 it fails only if a flavour or an index is unnamable.
- **Implement** — nothing expected in this file. A failure names a flavour or an
  index and is fixed in `numerals.ts` (Track B's module) or in the generator's
  `chordsForScale` (Track A's) — never by narrowing this test.
- **Green when** — all thirty grooves pass every assertion.
- **Refactor** — none. Do not replace the manifest-derived sweep with a sample;
  the PRD asks for every progression in the shipped manifest, not a sample, and
  a sample passes on precisely the day a thirteenth mode is minted.

## Integration and verification

#### Step I1 — The whole gate

- `npm test` (app + tooling), `npm run test:gen` (the generator tier),
  `npx tsc --noEmit`, `npm run lint`, `npm run build`. `build` runs `prebuild`,
  which runs `grooves:verify`, so it is the end-to-end proof that the
  regenerated manifest and the untouched audio still agree with the lock. Lint
  is what would catch a numerals module reaching across a boundary.

#### Step I2 — The demo path, by hand

- Solve today's puzzle. The box's lead sheet reads a numeral under every bar.
- Open `groove-01` by its link (`C Mixolydian`, `C7–Em7♭5–B♭maj7–Fmaj7`) and
  read `I · III · ♭VII · IV`: the `♭VII` is the flat this epic exists to keep,
  and the `Em7♭5` bar reads a plain `III` with its quality on the symbol above.
- Open `groove-02` (`E Dorian`, `Em7–Bm7–C♯m7♭5`) and read
  `I · V · VI · I` — a three-chord progression whose fourth bar is a return, and
  a sheet that opens on `I` rather than on `ii` of D major.
- Open a `Blues` groove and read `I · IV · V · I`.
- At 360px, confirm by eye that the sheet still breaks 2 × 2, that each numeral
  sits under its own bar's symbol in the bar's own air, and that no bar grew
  taller. This is the part no jsdom test can assert.
- In both palettes, confirm the numerals are legible on the inverted surface —
  they take `currentColor` like the rest of the drawing.
- Give up on a day and read the same numerals: the panel shows the same solution
  either way.

#### Step I3 — The irreversible step, re-checked

- `git status --porcelain public/grooves` is empty, and
  `git diff --stat public/grooves` reports nothing: no mp3 changed, so no
  `headDelaySeconds`, no seam and no rendered audio changed.
- `scripts/grooves/grooves.lock.json` differs only in `manifestSha256`.
- `npm run grooves:verify` exits 0.
- No edit was made to `src/lib/hash.ts`, to `MUSIC_LABEL` or its draw order, to
  the order of `FLAVOURS`, or to any `uuid` in `catalogue.json` — the four things
  `docs/music.md` says must never change.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B2, B6, C1, C5, D1 |
| R2 | B1, B6, D2 |
| R2a | B6, D2, D5 |
| R2b | B2, B6, D1 |
| R3 | B4 |
| R3a | B2, B3 |
| R4 | A1, A2, A3, A4, A5, B7, D5 |
| R4a | A1, A4, B5, C4, D3 |
| R4b | A6, I3 |
| R5 | C3 |
| R6 | D4 |
| R7 | C2 |
| R8 | B5, C4, D3 |
| AC1 | C1, C5, D1, D4 |
| AC2 | B6, D2 |
| AC3 | B4, D1, D5 |
| AC4 | B3 |
| AC5 | A2, A3, A4, A6, B7, D5 |
| AC6 | A6, I3 |
| AC7 | B5, C4, D3 |
| AC8 | A5, D5 |
| AC9 | C2, I2 (the 2 × 2 break, by eye) |
| AC10 | B2, B6, D1, D5 |
| AC11 | D5 |

## Assumptions

- **`progressionDegrees` sits directly after `progression`** in `Groove`,
  `MusicMeta` and `FIELDS`, so the manifest diff reads as one added line under
  the string it describes — feature-12's placement of `uuid` under `id`.
- **The regeneration is `npm run grooves -- --manifest-only`.** The PRD names
  `npm run grooves`; the flag is the same command with the encode skipped, and
  it is stronger evidence for AC6 than a byte comparison, because no mp3 is
  written at all. It still needs ffmpeg (for `ffprobe`) and the committed sample
  pack.
- **`romanNumeral` takes a `Flavour`, not an `Answer`.** R2b then cannot be
  violated by accident, and this epic stays off Epic 1's `scaleDegrees`
  signature while both run in Wave 1. If Epic 1's labels and these numerals ever
  disagree, the cause is `FLAVOUR_INTERVALS`, which both read.
- **The numerals join the accessible name** as `<symbol> <numeral>` per bar. The
  PRD makes no requirement either way, and this is a decision rather than a
  finding: `role="img"` with an `aria-label` hides the subtree, so numerals left
  out of the label are numerals no screen-reader user hears — the same trap
  Epic 2's roadmap names for the staff. A Roman numeral read aloud is imperfect
  ("I" as a pronoun); the PRD chose numerals, and no reading of them is better
  than not reading them.
- **The numeral is absolutely positioned in the bar's `pb-9` air**, so the sheet's
  geometry is provably unchanged and a long numeral cannot make one bar taller
  than its neighbour.
- **`Lettering size="sm"` is the numeral's size** — one step under the symbol's
  `md`, in the same hand, with no new typography prop and no new component.
- **`MusicMeta.progressionDegrees` is required**, so `tsc` names every
  hand-built fixture. All seven are inside Track A's ownership, and each is a
  one-line addition.
- **No structure test needs editing.** `lib/theory/` already exists as a concern
  folder, so a new module and its colocated test satisfy
  `src/features/daily-groove/structure.test.ts` as they are; the feature's
  `index.ts` is untouched, because nothing new is public.

**No open questions — the spec is ready to implement.** Every architectural fork
this epic contains is settled above: the field
travels on `MusicMeta` (because `add.ts` then needs no edit), the numeral is
derived from `FLAVOUR_INTERVALS` rather than from Epic 1's labels (because the
two share a wave), and the regeneration runs `--manifest-only` (because it
proves R4b by writing no audio at all). The spec is ready to implement, subject
to the one ordering constraint stated in Approach: Epic 1's Step A0 first, and
Epic 1's Track D before this epic's Track D.
