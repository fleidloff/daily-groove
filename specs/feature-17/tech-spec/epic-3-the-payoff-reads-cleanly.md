# Tech spec — Epic 3: The payoff reads cleanly

PRD: [../prd/epic-3-the-payoff-reads-cleanly.md](../prd/epic-3-the-payoff-reads-cleanly.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two unrelated fixes to the payoff, in two tracks that share no file with each
other or with Epics 1 and 2. Track A makes the lead sheet four columns at every
width and buys the fit with a smaller symbol and tighter bar padding below `sm`.
Track B trims the self-referential tail off ten of the twelve mode lines. Both
run in Wave 1; neither hands anything on.

**Track A cannot be done inside the feature alone, and that is the one decision
in this spec with reach beyond the epic.** The chord symbol's font size lives in
`src/components/typography/Lettering.tsx`, a design-system primitive whose size
tokens are flat. A feature cannot override a primitive's own class from outside
— a parent `text-[…]` loses to the child's own utility — so the responsive step
has to be added where the type scale is, exactly as `Heading` already carries
`xl: '… text-[34px] … sm:text-[44px]'`. `Lettering` therefore gains one scale
step (`xs`) and one prop (`sizeAbove`), and Track A owns those two files as well
as the two in the slice. Neither collides with Epic 1, which owns
`src/components/controls/{Chip,ChipGroup}.tsx`, so Wave 1 stays parallel.

Two things are deliberately *not* built. **No horizontal scroll**: the briefing
listed it, the PRD's R1 asks for one row at every supported width, and
`LeadSheet.test.tsx` already asserts `not.toMatch(/overflow-x/)` — that
assertion keeps its subject. And **no vertical change**: R2 asks for type size
and *horizontal* padding, so `pt-1 pb-9` is untouched, which is what keeps the
numeral's geometry claim (R6) provable by the same assertion feature-15 wrote.

## Architecture

```
Lettering (design system)          LeadSheet (feature slice)
  xs  13px                            sheet   grid-cols-4                (R1)
  sm  15px  ← symbol, below sm        bar     pl-1 pr-1 sm:pl-3 sm:pr-4  (R2, R5)
  md  20px  ← symbol, from sm up      bar     whitespace-nowrap          (R3)
  lg  26px                            bar     pt-1 pb-9   — unchanged    (R6)
  sizeAbove="…"  → sm:text-[…]        numeral absolute bottom-2
                                              left-1 sm:left-3           (R4)
```

**The grid stays a grid, and the reason feature-11 chose one is unchanged.** A
wrapping flex row decides per item, so one wide symbol pushes its neighbour down
and four bars fall 3 + 1, which reads as a mistake rather than a line break. A
grid can only produce the column count it is told. What changes is the count:
`grid-cols-2 sm:grid-cols-4` becomes a flat `grid-cols-4`, so the only break the
grid could ever produce is retired rather than the guarantee that produced it.
The anti-`flex-wrap` and anti-`basis-` assertions in `LeadSheet.test.tsx` are
what keep that guarantee honest, and they survive this epic verbatim.

**The closing double bar stays on the sheet's right edge, not on the last bar.**
Its rationale shrinks — with one row there is no broken sheet for a
last-cell rule to stop half way up — but the edge is still where a rule that
must be as tall as the sheet belongs, and moving it would rewrite three passing
assertions to buy nothing.

**A chord symbol is one indivisible token, so the bar takes
`whitespace-nowrap`.** `C♯m7♭5` broken after the `m` is not a chord symbol, and
R3 forbids wrapping outright. It has a second effect worth having: with nowrap
and no clipping class, a bar that is too narrow overflows *visibly* over its
neighbour's bar line instead of silently growing a second line that still
satisfies "one row of bars". A mis-chosen number then fails the demo rather than
passing it.

**The widest symbol is derived from the manifest, never written out.**
`barChords(groove.progression)` over every entry in
`src/features/daily-groove/data/grooves.generated.ts` is the exact path
`SolvedPanel` takes, so the symbols it yields are exactly the symbols the sheet
can receive. Today the longest are seven code points — `Gmaj7♯5`, `Bmaj7♯5`,
`Amaj7♯5`, `F♯mMaj7` — and the briefing's assumed widest, `C♯m7♭5`, is only six.
That is precisely why the test derives it: a catalogue re-render that mints a
longer symbol trips a case rather than a phone. `character.test.ts` and
feature-16's `GuessCard.test.tsx` both derive their oracle from `GROOVES` the
same way.

**The mode-line trim removes a clause about the line, not a clause about the
mode.** Ten of the twelve tails are self-referential — eight `— that's the note
doing it` / `— those are the notes doing it`, two `, that's the sound of it`.
`Melodic minor` has no tail. `Blues`'s tail, `— that ♭5 between the 4 and the
5`, is the only place its line names its degree, so trimming it would break R9.
So the trim is ten lines, not twelve, and the test that enforces it bans the two
phrases rather than banning a tail.

## Contracts

```ts
// src/components/typography/Lettering.tsx
type LetteringSize = 'xs' | 'sm' | 'md' | 'lg'

type LetteringProps = {
  children: ReactNode
  /**
   * The size below `sm`, and at every width when `sizeAbove` is absent — so an
   * existing call site's rendered class string is unchanged.
   */
  size?: LetteringSize
  /** The size from `sm` up. Absent means `size` everywhere. */
  sizeAbove?: LetteringSize
}

const SIZE: Record<LetteringSize, string> = {
  xs: 'text-[13px] leading-[1.35]',
  sm: 'text-[15px] leading-[1.3]',
  md: 'text-[20px] leading-[1.2]',
  lg: 'text-[26px] leading-[1.15]',
}

const SIZE_FROM_SM: Record<LetteringSize, string> = {
  xs: 'sm:text-[13px] sm:leading-[1.35]',
  sm: 'sm:text-[15px] sm:leading-[1.3]',
  md: 'sm:text-[20px] sm:leading-[1.2]',
  lg: 'sm:text-[26px] sm:leading-[1.15]',
}

export function Lettering({ children, size = 'md', sizeAbove }: LetteringProps)
```

- `sm`, `md` and `lg` keep their exact current values. `xs` is a new step; the
  breakpoint is fixed at `sm`, the only breakpoint the design system's type,
  padding and columns already bend at (`Heading.xl`, `Card`, `Panel`,
  `PageShell`, `Row.collapseBelow`).
- With `sizeAbove` absent the className is byte-for-byte what it is today, so
  `TransportPanel.tsx`'s `<Lettering size="sm">` is untouched.

```ts
// src/features/daily-groove/components/solved/LeadSheet.tsx
// The frozen class strings. Track A writes exactly these.
const SHEET =
  'relative grid grid-cols-4 items-stretch border-r-[3px] border-current/60'

const BAR =
  'relative whitespace-nowrap border-l border-current/60 ' +
  'pl-1 pr-1 pt-1 pb-9 sm:pl-3 sm:pr-4'

const NUMERAL = 'absolute bottom-2 left-1 sm:left-3'

// symbol : <Lettering size="sm" sizeAbove="md">{chord}</Lettering>
// numeral: <Lettering size="xs" sizeAbove="sm">{numerals[bar]}</Lettering>
```

- `LeadSheetProps` is unchanged: `chords: string[]`, `numerals?: string[]`.
  Nothing in the prop surface, the `role="img"`, the `aria-label` or the
  `data-bar` / `data-numeral` / `data-double-bar` hooks moves, so every
  consumer and every screen-reader assertion is untouched.
- The width budget at 360px, for the record: `360 − 40` (`PageShell` `px-5`)
  `− 48` (`Panel` `px-6`) `= 272px`, `− 3px` for the closing bar, `/ 4` =
  **67.25px a bar**; less `1px` `border-l` and `8px` of `pl-1 pr-1` = **58.25px
  of content**. `Container` adds nothing and `LabelledColumn` adds nothing.

```ts
// src/features/daily-groove/lib/theory/character.ts
// The twelve lines after the trim. Ten change; two do not.
Ionian:              'the plain major scale — nothing bent'
Lydian:              'major with a ♯4'
Mixolydian:          'major with a ♭7'
'Lydian dominant':   'major with a ♯4 and a ♭7'
'Phrygian dominant': 'major with a ♭2, a ♭6 and a ♭7'
'Harmonic major':    'major with a ♭6'
Aeolian:             'the plain minor scale — nothing bent'
Dorian:              'minor with a 6 where the ♭6 would be'
Phrygian:            'minor with a ♭2'
'Harmonic minor':    'minor with a 7 where the ♭7 would be'
'Melodic minor':     'minor with a 6 and a 7 where the ♭6 and ♭7 would be'  // unchanged
Blues:               'the blues scale, not the 12-bar form — that ♭5 between the 4 and the 5'  // unchanged
```

- `ModeCharacter` is unchanged, `degrees` is unchanged for all twelve, and
  `characterOf` is unchanged. Only the prose moves.
- Measured against the three authored-copy rules: the ten trimmed lines go from
  42–63 characters to 15–36, none gains a sentence break, and none loses a
  degree it named. The table's longest line is `Blues` at 70 and stays 70, so
  the *ceiling* does not move — every line that moves, moves inward (R10).

## Tracks

### Track A — The sheet fits four bars on a phone

- **Goal** — the lead sheet is four columns at every width, the widest symbol
  the catalogue can produce renders in full in bar one and bar four, the
  numerals still render, and above `sm` every value is the one feature-11
  shipped.
- **Owns** — `src/components/typography/Lettering.tsx`,
  `src/components/typography/Lettering.test.tsx`,
  `src/features/daily-groove/components/solved/LeadSheet.tsx`,
  `src/features/daily-groove/components/solved/LeadSheet.test.tsx`
- **Role** — `implementer`. It writes source and tests together, and the
  judgement it needs is a layout one, not a musical one — nothing under
  `scripts/grooves/` is touched, so no musician.
- **Depends on** — nothing. The `Lettering` contract above is frozen here, so
  the two halves of the track can be written in either order.
- **Parallel with** — Track B, and every track in Epic 1
- **Done when** — `npm test` is green, including
  `src/components/structure.test.ts` (no file is added or moved under
  `src/components/`, so it should not move) and
  `src/features/daily-groove/components/solved/SolvedPanel.test.tsx`.
- **Command** — `npm test`

### Track B — The mode lines stop padding themselves

- **Goal** — no mode line says what its own degree is doing; all twelve still
  name every degree they claim, in one clause, inside 72 characters.
- **Owns** — `src/features/daily-groove/lib/theory/character.ts`,
  `src/features/daily-groove/lib/theory/character.test.ts`
- **Role** — `implementer`
- **Depends on** — nothing
- **Parallel with** — Track A, and every track in Epic 1
- **Done when** — `npm test` is green, including the three
  `/the plain minor scale/i` assertions in `GroovePuzzle.guessing.test.tsx` and
  `GroovePuzzle.page.test.tsx`, which it must not need to edit.
- **Command** — `npm test`

**Cross-epic seams: none.** Epic 1 owns `lib/presentation/feedback.ts`,
`lib/theory/music.ts`, `src/components/controls/{Chip,ChipGroup}.tsx`,
`components/puzzle/NudgeBox.tsx` and `GuessCard`; Epic 2 owns those plus
`GroovePuzzle.tsx`. This epic's four-plus-two files appear in neither. The one
file all three epics *read through* is `GroovePuzzle`'s test suite, and this
epic changes no assertion in it.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B. Disjoint file sets, and both
  disjoint from Epic 1's.
- **Wave 2:** Integration — the whole suite, the types, the lint, the build,
  and the demo at 360px, which is where the pixels this spec cannot assert get
  looked at.

## Implementation

### Track A — The sheet fits four bars on a phone

#### Step A1 — The hand-lettered scale gains a step below `sm`, and a size from `sm` up

Covers: R2, R4, AC2, AC4

- **Test first** — `src/components/typography/Lettering.test.tsx`: three new
  cases against the primitive's own contract, plus two edits.
  New: `it('keeps all four sizes in the scale at their documented sizes')` —
  a `DOCUMENTED: Record<LetteringSize, string>` of
  `{ xs: 'text-[13px]', sm: 'text-[15px]', md: 'text-[20px]', lg: 'text-[26px]' }`,
  each asserted with `toContain`, mirroring `Heading.test.tsx`'s case of the
  same name. New: `it('renders the size from sm up as a breakpoint variant')` —
  `render(<Lettering size="sm" sizeAbove="md">Cm7</Lettering>)` and assert the
  className contains `'text-[15px]'` **and** `'sm:text-[20px]'`, mirroring
  `Heading.test.tsx`'s `'renders the xl size larger above the small breakpoint'`.
  New: `it('renders no breakpoint variant when sizeAbove is absent')` — assert
  `renderLettering(<Lettering size="md">Cm7</Lettering>).className` matches
  `/^font-jazz font-normal text-\[20px\] leading-\[1\.2\]$/`, which is what
  keeps `TransportPanel.tsx` byte-for-byte unchanged.
  Edited: `'keeps the jazz face at every size'` and
  `'resolves each size to a distinct class string'` extend their loop to
  `['xs', 'sm', 'md', 'lg']` and the latter expects `Set` size `4` — same
  subject, one more member. Run it: fails with
  `Type '"xs"' is not assignable to type 'LetteringSize'` at compile, and
  `expected 'font-jazz font-normal text-[15px] leading-[1.3]' to contain 'sm:text-[20px]'`.
- **Implement** — `src/components/typography/Lettering.tsx`: exactly the
  contract above — `LetteringSize` gains `'xs'`, `SIZE` gains
  `xs: 'text-[13px] leading-[1.35]'`, a `SIZE_FROM_SM` map is added, and the
  component joins `SIZE[size]` with `SIZE_FROM_SM[sizeAbove]` only when
  `sizeAbove` is given. The doc comment gains one sentence: the scale bends at
  `sm` when asked to, the way `Heading`'s `xl` already does, and `sm` is the
  only breakpoint it bends at.
- **Green when** — the five cases pass, `src/components/structure.test.ts`
  stays green (no file added, `Lettering` stays in `typography`), and
  `TransportPanel.test.tsx` stays green untouched.
- **Refactor** — none. No call site is changed in this step; A3 and A5 are what
  spend the new API.

#### Step A2 — Four bars are four columns at every width

Covers: R1, R5, AC1, AC5

- **Test first** —
  `src/features/daily-groove/components/solved/LeadSheet.test.tsx`: rewrite the
  existing case `'breaks two-by-two, never three-and-one, on a phone (R10)'` as
  `'keeps four bars in one row at every width (F17 E3 R1, AC1)'`. Its subject —
  "the grid is what forbids 3 + 1" — is unchanged and its assertions are kept:
  `toMatch(/\bgrid\b/)`, `not.toMatch(/\bflex-wrap\b/)`,
  `not.toMatch(/overflow-x/)` and the per-bar `not.toContain('basis-')`. What
  changes is the column claim: `toMatch(/\bgrid-cols-4\b/)`,
  `not.toMatch(/\bgrid-cols-2\b/)` and `not.toMatch(/\bsm:grid-cols-/)` — there
  is no second column count left to name. Rewrite
  `'keeps the two-by-two break the grid guarantees (R7, AC9)'` the same way, as
  `'keeps the one-row grid with the numerals drawn (F17 E3 R1, R4, AC1, AC4)'`.
  Run it: fails with
  `expected 'relative grid grid-cols-2 sm:grid-cols-4 items-stretch border-r-[3px] border-current/60' to match /\bgrid-cols-4\b/`
  — note it fails on the *absence* of a flat `grid-cols-4`, not on
  `sm:grid-cols-4`, which is why the negative assertion is needed too.
- **Implement** — `LeadSheet.tsx`: the sheet's className becomes the frozen
  `SHEET` string above. Nothing else in the element changes — `role="img"`, the
  `aria-label` expression, `items-stretch` and both halves of the double bar
  stay.
- **Green when** — both rewritten cases pass and every other case in the file
  is still green.
- **Refactor** — the two doc comments that describe a two-row sheet. The
  double-bar paragraph loses "two rows deep when they break 2 × 2" and keeps
  the edge rationale. The grid paragraph keeps its whole argument — a grid can
  only produce the column count it is told, flex wrapping decides per item and
  gives 3 + 1, "which reads as a mistake rather than a line break" — and
  changes only the count it produces, from "2 × 2 on a phone and 1 × 4 above
  `sm`" to "four, at every width". **Do not delete the argument with the
  behaviour**: it is why the next person must not reach for `flex-wrap` when a
  fifth bar appears.

#### Step A3 — The symbol is smaller below `sm` and feature-11's size above it

Covers: R2, R5, AC2, AC5

- **Test first** — same file: a new case
  `it('sets the symbol one step smaller below sm and feature-11's size above it (F17 E3 R2, R5, AC2, AC5)')`.
  Render `<LeadSheet chords={CHANGES} />`, take
  `within(container).getByText('C7').className`, and assert it contains
  `'text-[15px]'` and `'sm:text-[20px]'` and does **not** match
  `/(?<!sm:)text-\[20px\]/` — the 20px must arrive only through the breakpoint.
  Keep the existing `'sets every symbol in the hand-lettered jazz face'` case
  untouched: `font-jazz` is still on every symbol at every size, which is the
  half of feature-11's contract this step must not disturb. Run it: fails with
  `expected 'font-jazz font-normal text-[20px] leading-[1.2]' to contain 'text-[15px]'`.
- **Implement** — `LeadSheet.tsx`: the symbol becomes
  `<Lettering size="sm" sizeAbove="md">{chord}</Lettering>`.
- **Green when** — the new case passes and the four existing symbol cases
  (`font-jazz`, bar order, the repeated bar, the blank bars) are green
  unchanged.
- **Refactor** — none.

#### Step A4 — The bar's horizontal padding tightens below `sm`

Covers: R2, R3, R5, AC2, AC5

- **Test first** — same file: edit the existing case
  `'sits in the air the bar already reserves, changing no geometry (R7, AC9)'`
  — its subject is unchanged, so the className-equality claim between a bar
  drawn with a numeral and one drawn without stays exactly as written, and so
  do `toMatch(/\bpb-9\b/)`, `/\bpt-1\b/`, `/\brelative\b/` and
  `/\bborder-l\b/`. The one assertion that moves is `toMatch(/\bpl-3\b/)`,
  which becomes `toMatch(/\bpl-1\b/)`, `toMatch(/\bsm:pl-3\b/)`,
  `toMatch(/\bpr-1\b/)` and `toMatch(/\bsm:pr-4\b/)`. Add a new case
  `it('never breaks a chord symbol across two lines (F17 E3 R3)')` asserting
  every bar's className matches `/\bwhitespace-nowrap\b/`. Run it: fails with
  `expected 'relative border-l border-current/60 pl-3 pr-4 pt-1 pb-9' to match /\bpl-1\b/`.
- **Implement** — `LeadSheet.tsx`: `BAR` becomes the frozen string above.
  `pt-1 pb-9` is deliberately untouched — R2 asks for horizontal padding, and
  leaving the vertical alone is what keeps A5's geometry claim provable by
  feature-15's own assertion.
- **Green when** — the edited case and the new case pass; no other case in the
  file changes.
- **Refactor** — none. `pl-1 pr-1` is written as two utilities rather than
  `px-1` so that `sm:pl-3 sm:pr-4` overrides one side each and the asymmetry
  feature-11 chose above `sm` stays visible in the source.

#### Step A5 — The numeral renders at both widths, one step under the symbol, and still changes no geometry

Covers: R4, R5, R6, R7, AC4, AC5, AC6, AC7

- **Test first** — same file, three existing cases edited and none deleted.
  `'letters the numerals in the same hand, one size under the symbol (R5)'`
  keeps `font-jazz` and swaps its `text-\[15px\]` assertion for
  `'text-[13px]'` plus `'sm:text-[15px]'`; its subject — the numeral is one
  step under the symbol — now holds at both widths, and the stale comment
  ``// `Lettering size="sm"` — smaller than the symbol's `md` above it.``
  becomes a two-width statement. `'holds each numeral inside its own bar,
  whatever the layout (R7, AC9)'` keeps its containment matrix and its
  `absolute` and `bottom-` assertions verbatim, swaps `/\bleft-3\b/` for
  `/\bleft-1\b/` and `/\bsm:left-3\b/`, and its jsdom note now reads that jsdom
  resolves no media query, so the one-row layout itself is checked by eye on the
  demo path. `'draws one numeral under each bar, in bar order'`,
  `'draws no numeral where a bar has none, and keeps the bar'`, `'draws four
  bars and no numerals when the prop is absent'`, `'draws numerals over blank
  bars rather than throwing'` and both `aria-label` cases are asserted
  **unchanged** — they are AC4, AC6 and AC7, and this step's job is that they
  keep passing. Run it: fails with
  `expected 'font-jazz font-normal text-[15px] leading-[1.3]' to contain 'text-[13px]'`.
- **Implement** — `LeadSheet.tsx`: the numeral becomes
  `<Lettering size="xs" sizeAbove="sm">{numerals[bar]}</Lettering>` inside a
  span with the frozen `NUMERAL` className.
- **Green when** — the three edited cases pass and the six untouched numeral
  cases are green. R6's "a long numeral cannot make its bar taller" is proven
  by the untouched className-equality assertion in A4's case plus the numeral
  still being `absolute` inside the bar's own `pb-9`.
- **Refactor** — none. The doc paragraph about the numeral sitting in reserved
  air is still exactly true and is not touched.

#### Step A6 — The widest chord symbol the catalogue can produce renders in full, in bar one and in bar four

Covers: R3, AC3

- **Test first** — same file: derive the symbol from the manifest rather than
  writing it out. Import `GROOVES` from `'../../data/grooves.generated'` and
  `barChords` from `'../../lib/theory/changes'` — both relative, both inside the
  slice, the way `character.test.ts` already reads `GROOVES`. Build
  `const SYMBOLS = [...new Set(GROOVES.flatMap((g) => barChords(g.progression)))].filter(Boolean)`,
  take `const widest = Math.max(...SYMBOLS.map((s) => [...s].length))` — spread
  rather than `.length`, so the count stays a glyph count if the catalogue ever
  mints a symbol outside the BMP — and
  `const WIDEST = SYMBOLS.filter((s) => [...s].length === widest)`. Assert
  `WIDEST.length` is greater than `0` and, as the tripwire,
  `expect(widest, WIDEST.join(' ')).toBe(7)` so a catalogue re-render that
  mints a longer symbol fails here with the offending symbols in the message
  rather than on someone's phone. Then `it.each(WIDEST)` render it twice —
  `<LeadSheet chords={[s, 'C7', 'C7', 'C7']} />` and
  `<LeadSheet chords={['C7', 'C7', 'C7', s]} />` — and in each assert the
  bar's `textContent` is `s` exactly, that the symbol is a single text node
  (`within(bar).getByText(s).childNodes` has length `1`), and that no element
  in the container has a className matching `/\btruncate\b/`,
  `/\btext-ellipsis\b/`, `/\boverflow-hidden\b/` or `/\bline-clamp/`. Run it:
  write the tripwire as `toBe(6)` first, on the briefing's assumption that
  `C♯m7♭5` is the widest symbol, and it fails with
  `expected 7 to be 6 // Object.is equality` and
  `Gmaj7♯5 Bmaj7♯5 Amaj7♯5 F♯mMaj7` in the message — which is the discovery
  this step exists to force, and the reason the budget is derived rather than
  assumed. Then set it to `7`.
- **Implement** — nothing in the component. This step pins the *input* to the
  layout question and forbids anything that would hide an overflow; the
  layout itself is checked in the demo, because jsdom measures no text.
  **Note the deliberate asymmetry**: `whitespace-nowrap` is required (A4) and
  every clipping utility is forbidden (here), so a bar that is too narrow
  overflows where a human can see it instead of quietly wrapping or being cut.
- **Green when** — the derivation assertions and both renders pass for all four
  of today's widest symbols.
- **Refactor** — none. The derivation stays in the test: it is the oracle, and
  moving it into the component would make the sheet assert its own fit.

### Track B — The mode lines stop padding themselves

#### Step B1 — No mode line says what its own degree is doing

Covers: R8, AC8

- **Test first** — `src/features/daily-groove/lib/theory/character.test.ts`: in
  the existing `describe('MODE_CHARACTERS')`, a new case
  `it.each(ENTRIES)('%s states what the mode is and stops', (_flavour, entry) => …)`
  asserting `entry.line` does not contain `'doing it'` and does not contain
  `'the sound of it'`. **Ban the two phrases, not a tail** — a rule shaped like
  "nothing after the last `—`" or "no clause after a comma" would take
  `Blues`'s `— that ♭5 between the 4 and the 5` with it, and that clause is the
  only place `Blues` names its degree, so R9 would fail in the same commit.
  Run it: fails twelve times over, first with
  `expected 'the plain major scale — nothing bent, that’s the sound of it' not to contain 'the sound of it'`.
- **Implement** — `character.ts`: the ten changed lines from the contract above,
  written out. Eight lose `' — that’s the note doing it'` or
  `' — those are the notes doing it'`; `Ionian` and `Aeolian` lose
  `', that’s the sound of it'`. `Melodic minor` and `Blues` are not edited.
- **Green when** — the new case passes for all twelve entries and every other
  case in the file is green with no edit.
- **Refactor** — three doc sites that now quote copy the table no longer holds.
  `ModeCharacter.line`'s JSDoc example becomes
  ``/** One clause, e.g. 'major with a ♭7'. */``. The module doc's rule 3 keeps
  its 72-character ceiling and its reasoning and drops the implication that a
  tail is normal. The inline comment on `Melodic minor` — "so this one drops the
  pointing tail rather than the second degree" — is now false of the table as a
  whole and becomes a note that this line is the longest of the ten that name a
  degree and a position, which is why it is the one to watch against the
  ceiling. **Do not touch the `Blues` comment**: it explains a clause that
  stays.

#### Step B2 — The three authored-copy rules still bind, and every trimmed line moves inward

Covers: R9, R10, AC9, AC10

- **Test first** — same file: **no new case, and that is the point.** The four
  `it.each(ENTRIES)` cases that already stand for the three rules —
  `'%s claims exactly the degrees its intervals differ by'` (recomputed by
  `differingDegrees` from `FLAVOUR_INTERVALS` and `familyOf`, never read from
  the prose), `'%s names every one of those degrees in its line'`,
  `'%s says it in one clause with no sentence break'` and `'%s fits in one line
  of prose'` (`length <= 72`) — are run against the trimmed table
  **unchanged**, and so is `'%s uses no word the player would have to look up'`.
  Run them after B1: green. Run B1's edit with `Lydian` mistakenly trimmed to
  `'major'` and the second one fails with
  `"major" never names ♯4`, which is the case that actually guards R9 through
  the trim.
  **Do not add a numeric "shorter than before" assertion.** It cannot be
  written without a second copy of the old strings, and a table asserting a
  table is exactly what rule 1 exists to prevent. R10's "moves further inside
  the budget" needs no assertion: the trim only deletes characters, so a trimmed
  line is shorter by construction, and the ≤72 case is what catches a rewrite
  that adds any back.
- **Implement** — nothing. B1's edit is what these five cases are run against.
  If any of them fails, the trim took a degree, a baseline or a clause boundary
  with it, and the fix is to restore that clause — never to relax the case.
- **Green when** — all five cases pass for all twelve entries. Measured at spec
  time: the ten trimmed lines run 15–36 characters against 42–63 before;
  `Melodic minor` stays 51 and `Blues` stays 70, so the table's ceiling is
  unmoved and every line that moves, moves inward (R10).
- **Refactor** — none. `differingDegrees` and `degreeLabels` stay in the test.
  They are the oracle; moving them into `character.ts` would make the table
  assert itself, which is rule 1's whole point.

#### Step B3 — All twelve modes still have a line, and `Blues` still names its degree

Covers: R9, R11, AC9, AC11

- **Test first** — same file: the three manifest-driven cases stand unchanged —
  `'is total over every mode the shipped manifest carries'` and
  `'covers every mode the manifest carries and nothing the intervals do not'`,
  both deriving their mode list from `[...new Set(GROOVES.map((g) => g.flavour))]`
  rather than from a list written here, and `'names Mixolydian by its ♭7'`,
  whose `toContain('♭7')` is exactly the clause the trim keeps. So is
  `describe('the blues scale')`'s `'names its ♭5 and does not call itself a
  mode'`, which asserts `♭5`, `4`, `5` and no `mode` — the four things
  `Blues`'s untrimmed tail carries. Add nothing; assert that all four run green
  after B1. Run it before B1: green, which is the correct red-green shape for a
  step whose job is that a change breaks nothing.
- **Implement** — nothing expected. If `'names its ♭5…'` fails, `Blues` was
  trimmed and must be restored verbatim.
- **Green when** — the four cases pass, and `characterOf`'s
  `it.each(['Klingon', 'Locrian', '', 'toString'])` totality-tolerance case is
  green too: the trim changes no key, so the `undefined` path is untouched.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Nothing that reads the line or the sheet through the app needs editing

Covers: R5, R8, R9

- **Test first** — no new test. Run the four suites that read this copy and
  this component through their own subjects and assert they are green **with no
  edit**:
  `src/features/daily-groove/components/solved/SolvedPanel.test.tsx` (the
  `/♭7/` lesson cases, the Locrian no-line case, and `'passes no fixed width to
  what its columns draw'`), `GroovePuzzle.guessing.test.tsx` (two
  `/the plain minor scale/i` assertions, lines 509 and 794) and
  `GroovePuzzle.page.test.tsx` (one, line 367). All three regexes match the
  trimmed `Aeolian` line — `'the plain minor scale — nothing bent'` — because
  the trim removes a tail and never the opening clause.
- **Implement** — nothing. If any of the three needs its regex widened, the
  trim went further than R8 asks and B1 is wrong.
- **Green when** — `npm test` is green across the app and tooling tiers.
  `npm run test:gen` is not needed: no file under `scripts/grooves/` is touched
  and the manifest is only read.
- **Refactor** — none.

#### Step I2 — The full gate, and the part only a phone can answer

- **Full suite** — `npm test`, `npm run lint`, `npx tsc --noEmit`,
  `npm run build`. The two structural suites most likely to be forgotten are
  `src/components/structure.test.ts` (Track A adds no file to the design
  system, so the group listing is unchanged) and
  `src/features/daily-groove/structure.test.ts`.
- **Removability, by inspection** — unchanged. `Lettering` gains a generic
  scale step and a generic prop and names no domain concept, so the design
  system still knows nothing about grooves; `LeadSheet` and `character.ts`
  gained no inbound reference. Deleting `src/features/daily-groove/` still
  leaves a building app.

### The demo path, run by hand

The acceptance criteria this suite can only half-prove are all here. jsdom
resolves no media query and measures no text, so every class in Track A is
provable and no rendered width is.

- **At 360px, four bars in one row (AC1).** `npm run dev`, solve today's puzzle
  or give up, and read the payoff panel at a 360px viewport. Four bar lines
  running left to right, the closing double bar on the right edge, one row.
- **The widest symbol, in bar one and bar four (AC3).** Today those are
  `Gmaj7♯5`, `Bmaj7♯5`, `Amaj7♯5` and `F♯mMaj7` — seven code points. `groove-01`
  is not one of them, so force them: temporarily pass one as `chords` in a
  scratch render, or pick the day whose progression carries it. Confirm no
  symbol touches or crosses its neighbour's bar line. **This is the number this
  spec is least sure of**: the arithmetic gives 58.25px of content a bar against
  roughly 50–55px for seven glyphs of the hand-lettered face at 15px, so the
  margin is a few pixels, not a comfortable one. If it overlaps, the ladder is
  `pl-1 pr-1` → `pl-0.5 pr-0.5` (+4px a bar), then the symbol from `sm` to `xs`
  (13px) with the numeral following it down a step. All three are one token
  each, which is why they are a demo finding and not an open question.
- **Both type sizes read correctly (AC2, AC5).** At 360px the symbol should
  read as a chord symbol and not as body text; drag past `sm` (640px) and
  confirm the sheet is indistinguishable from what feature-11 shipped —
  20px symbols, 15px numerals, `pl-3 pr-4`.
- **The numerals, at both widths (AC4).** One numeral under each bar at 360px,
  flush with its symbol's left edge, none taller than its bar.
- **At 320px, on purpose.** Confirm what breaks and that it breaks visibly
  rather than silently. 320px is out of scope per the PRD, as it was for
  feature-16's check control; this is a look, not a gate.
- **The twelve lines, read aloud (AC8, AC9).** Solve or give up on a day in each
  family and confirm each line still says what the mode is. `Blues` still ends
  in its ♭5 clause, and that is correct.
- **Both palettes.** The sheet sets no colour and the trim changes no tone, so
  this is a regression look, not a new check.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2 |
| R2 | A1, A3, A4 |
| R3 | A4 (nowrap), A6, demo path (the fit, by eye) |
| R4 | A1, A5 |
| R5 | A2, A3, A4, A5, I1 |
| R6 | A5 (via A4's className-equality assertion) |
| R7 | A5 |
| R8 | B1 |
| R9 | B2, B3, I1 |
| R10 | B2 |
| R11 | B3 |
| AC1 | A2 (the class), demo path (the row, by eye) |
| AC2 | A3, A4 (the classes), demo path (the sizes, by eye) |
| AC3 | A6 (the symbol and the absence of clipping), demo path (the fit, by eye) |
| AC4 | A5 |
| AC5 | A2, A3, A4, A5 (the `sm:` values), demo path (by eye) |
| AC6 | A5 |
| AC7 | A5 |
| AC8 | B1 |
| AC9 | B2, B3 |
| AC10 | B2 |
| AC11 | B3 |

**Provable in the suite, end to end:** AC4, AC6, AC7, AC8, AC9, AC10, AC11.
**Provable only as far as the class string, with the pixels awaiting a human on
a phone:** AC1, AC2, AC3, AC5. jsdom applies no media query, so `grid-cols-4`,
`sm:text-[20px]`, `sm:pl-3` and `sm:left-3` are assertable as *declared* and
never as *rendered*; and jsdom measures no text, so "renders in full without
clipping" is assertable as "nothing is truncating it and the text node is
whole", never as "it fits". Those four are marked as awaiting the demo above
rather than given an assertion that only appears to cover them. R10's
72-character rule keeps feature-15's status: a testable proxy for a two-line
ceiling at 360px that jsdom cannot measure.

## Assumptions

- **The codebase's comments were stripped after this spec was drafted, and
  before it runs.** `AGENTS.md` gained a Comments section — code should explain
  itself, a comment is for something genuinely non-obvious, and prose in a
  comment is not allowed — and 274 files were stripped to match, 12,522
  deletions in `git diff --stat`. Both tiers are green after it: 106 files /
  2038 tests, and 39 / 834. So every step below that deletes or rewrites a
  now-false comment is **already satisfied, and is a no-op rather than a
  mistake** — what it would have removed is gone. Do not re-add any of it, and
  do not rewrite a doc comment a step describes rewriting: where reasoning needs
  a home it is this document or a named test. The three doc sites Step B1's refactor names — `ModeCharacter.line`'s JSDoc
  example, the module doc's rule 3, and the `Melodic minor` note — are already
  gone, as is the `Blues` comment the step told you to preserve. **The rules
  themselves are untouched, because they live in `character.test.ts`, not in the
  doc:** all three authored-copy cases still run, and so does `names its ♭5 and
  does not call itself a mode`, which is the case that guards the trap B1 exists
  to avoid.

- **The responsive step belongs in `Lettering`, not in `LeadSheet`.** A parent
  `text-[15px]` loses to the child's own `text-[20px]` utility, so the only
  ways to do this inside the feature are an arbitrary descendant variant
  (`[&>span]:text-[15px]`, which has no precedent in this repo and reaches into
  a primitive's rendered markup from outside) or dropping `Lettering` and
  spelling `font-jazz` at the call site (which the design system exists to
  prevent). `Heading.xl` already bends at `sm`, so a responsive type step is a
  thing this scale does. **This is the one place this epic exceeds the two-file
  scope the roadmap gave it** — four files, two of them in the design system —
  and it is called out here rather than buried because a reviewer may prefer the
  arbitrary-variant version. Reversing it costs two files and one call site.
- **`sizeAbove` rather than a responsive token.** Making `md` itself
  `15px / sm:20px` would be a smaller diff and `md`'s only call site is this
  sheet — but the numeral needs the same treatment one step down, and `sm` has a
  second call site in `TransportPanel.tsx` that must not shrink. An explicit
  prop keeps the responsive decision visible in `LeadSheet.tsx`, where R2 lives,
  and leaves every existing call site's class string identical.
- **`xs` is 13px because `Text.sm` is.** The number is already in the system's
  vocabulary, and the sheet is read rather than tapped, so it can take a size a
  control could not (the PRD says so).
- **AC5 is satisfied at the value level, not at the string level.** Above `sm`
  the sheet renders feature-11's 20px symbol, 15px numeral, `pl-3 pr-4` and four
  columns — but carried on `sm:` variants, so the class *string* differs from
  what feature-11 shipped. There is no way to hold two breakpoints without
  variants, so the assertions read the `sm:` values rather than the literal
  string. Anyone reading AC5 literally should read it as "resolves to".
- **The numbers below `sm` are chosen, not derived**, exactly as the PRD's
  Assumptions say. 15px and `pl-1 pr-1` come out of the 58.25px budget with a
  few pixels to spare; the fallback ladder is on the demo path with the cost of
  each rung, and the demo is what decides. Recorded here rather than as an open
  question because each rung is one token, found in a two-minute look at a
  phone.
- **`whitespace-nowrap` is a new decision this spec makes.** The PRD forbids
  wrapping (R3) without saying how; nowrap is how, and its side effect — a bad
  fit overflows visibly rather than growing a silent second line — is the reason
  to prefer it over trusting the arithmetic.
- **The trim is ten lines, not twelve.** The roadmap and the PRD's Scope both
  say twelve; the table has eight `doing it` tails and two `the sound of it`
  tails, `Melodic minor` has no tail at all, and `Blues`'s tail is where it
  names its ♭5. Trimming all twelve would fail R9 and AC9 in the same commit, so
  R8's phrase ban is implemented as written (AC8: no line contains "doing it")
  and extended to the two `the sound of it` lines, which are the same
  self-referential clause in different words. Reversing either half is one
  string.
- **`degrees` is untouched for all twelve**, so `differingDegrees` keeps
  recomputing the oracle from `FLAVOUR_INTERVALS` and `familyOf`, and rule 1
  keeps holding for the reason it was written.
- **`npm test` is the command for both tracks.** Nothing under
  `scripts/grooves/` is touched; the manifest is read as data by two tests and
  written by nobody, so `npm run test:gen` and `npm run grooves:verify` have
  nothing to say about this epic.

**No open questions.** Both decisions with any reach — where the responsive type
step lives, and that the trim is ten lines — are settled above with their
reversal cost stated, and each is one token or one string to undo. The spec is
ready to implement.
