# Tech spec — Epic 2: The play button leads

PRD: [../prd/epic-2-the-play-button-leads.md](../prd/epic-2-the-play-button-leads.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

`Button` carries its geometry in one frozen `BASE` string today. Two of those
utilities — the vertical padding and the text size — move out into a `SIZE`
table keyed by a new `size` prop that defaults to today's values, so every
existing call site renders byte-identically and only the play control opts up.

`PlayControl` then asks for the large size internally. It gains no prop: its
public surface stays the four props feature-6 pinned it to, and the choice of
size is the control's own, the way its glyphs already are.

The header's half is one prop — `align="start"` becomes `align="center"` on the
`Row` — and is specified as a source-read assertion rather than a render,
because Epic 1 is concurrently changing the props that a render would have to
supply.

## Architecture

`Button` splits its geometry:

```ts
// before
const BASE = 'w-full cursor-pointer rounded-control px-4 py-[15px] text-center text-[15px] transition-colors …'

// after
const BASE = 'w-full cursor-pointer rounded-control px-4 text-center transition-colors …'
const SIZE: Record<ButtonSize, string> = {
  md: 'py-[15px] text-[15px]',   // today's geometry, and the default
  lg: 'py-[22px] text-[17px]',   // about half again as tall
}
```

Everything that is not size stays in `BASE`: the radius, the horizontal padding,
the full width, the focus ring, the disabled cursor, the transition. That is what
makes AC2 assertable — the two sizes differ in exactly two utilities and agree on
every other.

**What this changes in the existing suite.** Three assertions stand behind
decisions this epic reverses, and each is rewritten rather than deleted:

1. `PlayControl.test.tsx` — *"inherits the solve button's geometry rather than
   restating it"* asserts `py-[15px]` and `text-[15px]` on the play button. This
   is feature-4 Epic 2 AC1, the parity requirement this epic exists to undo. It
   becomes an assertion of the large geometry, and the test is renamed: the
   control no longer inherits the solve button's size, only its form.
2. `src/components/structure.test.ts` — the `PlayControl` props test ends with
   `expect(source).not.toMatch(/\bsize\b/)`. That blanket word ban was a proxy
   for feature-6 R9's actual rule, *a prop no caller can reach does not survive*,
   which the props-list assertion on the line above already enforces exactly. The
   ban is narrowed to the prop — the props list must still be
   `['isPlaying', 'onToggle', 'busy', 'text']`, and `PlayControlSize` and
   `IconButton` must still be absent — while the control may name a size when
   it renders `Button`. Feature-6's rule survives intact; only its proxy moves.
3. `PlayControl.tsx`'s doc comment argues for the parity: *"there is one page and
   one loop, so there is one form."* It is rewritten to say what is now true —
   one form, two sizes, and the play control takes the larger because it is the
   first move.

No design-system component is added or removed, so the `COMPONENTS` list in
`src/components/structure.test.ts` is unchanged, which is AC10.

## Contracts

Frozen before the tracks start.

```ts
// src/components/controls/Button.tsx
type ButtonSize = 'md' | 'lg'

type ButtonProps = {
  children: ReactNode
  onPress: () => void
  disabled: boolean
  tone: ButtonTone
  label?: string
  size?: ButtonSize      // new; defaults to 'md'
}
```

```ts
// src/components/controls/PlayControl.tsx
// props unchanged: { isPlaying, onToggle, busy?, text? }
// renders <Button … size="lg">
```

```
md → py-[15px] text-[15px]      lg → py-[22px] text-[17px]
```

`GrooveHeader`'s `Row` gains `align="center"`. Nothing inside its `Stack` is
touched — that is Epic 1's.

**The trap in that one prop.** `collapseBelow="sm"` makes the header a *column*
below 640px, and on a column axis `items-center` is the *horizontal* alignment —
so `align="center"` centres both sides on a phone, which is wrong for the badge
and wrong for the title. The named `align` describes the row layout; the stacked
layout needs each child to say which edge it takes. So the header wraps its two
children — `self-start sm:self-auto` on the title block, `self-end sm:self-auto`
on the badge — handing alignment back to the `Row` at the breakpoint. This is the
same feature-side pattern `GroovePuzzle` already uses on the children of its own
collapsing `Row` (`w-full flex-1 md:w-auto`). `Row` itself is not touched: which
edge a child takes when the axis turns vertical is the header's business, not the
primitive's, and the app's other two collapsing rows pass `align="start"` and
`align="baseline"` and want no change.

## Tracks

### Track A — The size

- **Goal** — `Button` renders two sizes, defaulting to the one it renders today.
- **Owns** — `src/components/controls/Button.tsx` and `Button.test.tsx`.
- **Depends on** — nothing.
- **Parallel with** — Track C.
- **Done when** — its own tests pass.

### Track B — The play control

- **Goal** — the play control is large; the check control is not; the structural
  rules say what they now mean.
- **Owns** — `src/components/controls/PlayControl.tsx` and `PlayControl.test.tsx`;
  `src/components/structure.test.ts`;
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`.
- **Depends on** — Track A's implementation, not just its contract: the class
  assertions here are on the classes `Button` actually emits.
- **Parallel with** — Track C.
- **Done when** — its own tests pass.

### Track C — The header's alignment

- **Goal** — the header row aligns its two sides on their centres once it is a
  row, and each side anchors itself when it is a column.
- **Owns** — an appended `describe` block in
  `src/features/daily-groove/components/header/GrooveHeader.test.tsx`, and in
  `GrooveHeader.tsx` the `Row`'s `align` prop plus the two anchor wrappers around
  its children.
- **Depends on** — nothing.
- **Parallel with** — Tracks A and B.
- **Done when** — its own assertion passes.

## Execution waves

- **Wave 1 (parallel):** Track A, Track C.
- **Wave 2:** Track B — needs Track A's classes on the wire.
- **Wave 3:** Integration.

**The one place this epic touches Epic 1's files.** Track C opens
`GrooveHeader.tsx` and `GrooveHeader.test.tsx`, which Epic 1's Track A is
rewriting in the same wave. The roadmap's contract holds — Epic 1 owns what the
title block says, this epic owns the row's alignment — but the two are five lines
apart in one file, so Track C is specified to touch neither the render calls nor
the props: it appends a source-read assertion at the end of the test file and
changes one attribute in the component. If both epics are being taken up by one
person, do Track C after Epic 1's Track A and the question does not arise.

## Implementation

### Track A — The size

#### Step A1 — The default size is today's button

Covers: R1, AC1

- **Test first** — `Button.test.tsx`: capture the `className` of a `Button`
  rendered with no `size`, and assert it contains `py-[15px]`, `text-[15px]`,
  `w-full`, `rounded-control` and `px-4`. Run it: passes against today's `BASE`.
  This is the pin that makes the refactor in A2 provably behaviour-preserving —
  written first, before anything moves.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

#### Step A2 — A large size exists

Covers: R2, AC2

- **Test first** — `Button.test.tsx`: render with `size="lg"` and assert the
  `className` contains `py-[22px]` and `text-[17px]` and does *not* contain
  `py-[15px]` or `text-[15px]`. Then assert that the large and default class
  strings, with the two size utilities removed from each, are equal — which is
  how "radius, tone classes and focus classes are identical" is checked without
  listing them. Run it: fails with
  `expected "… py-[15px] … text-[15px] …" to contain "py-[22px]"`, because the
  prop does not exist and is ignored.
- **Implement** — `Button.tsx`: add `type ButtonSize = 'md' | 'lg'` and the
  `SIZE` record above; remove `py-[15px]` and `text-[15px]` from `BASE`; add
  `size = 'md'` to the destructured props and `${SIZE[size]}` to the composed
  `className`.
- **Green when** — both assertions pass and A1 still passes unchanged, which is
  the whole point of having written it first.
- **Refactor** — none.

#### Step A3 — The large size disables like the small one

Covers: R2, AC3

- **Test first** — `Button.test.tsx`: render `size="lg"` with `disabled` and
  `tone="idle"`, assert `toBeDisabled()`, assert the class string contains
  `disabled:cursor-default`, and assert a click does not call `onPress`. Run it:
  passes if A2 left the disabled utilities in `BASE`; fails with
  `expected … to contain "disabled:cursor-default"` if they were swept into the
  size table.
- **Implement** — none if A2 is correct.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A4 — The size stays generic

Covers: R3, AC10

- **Test first** — none to write. `src/app/globals.test.ts` guard I5, *"the
  design system carries no domain vocabulary"*, already reads every
  design-system file against a domain-vocabulary pattern and already owns this
  rule. Run it after A2: it must stay green, which is the assertion.
- **Implement** — none.
- **Green when** — I5 and I4 both still pass over the changed `Button` files.
- **Refactor** — none.

**Do not add a local version of this check to `Button.test.tsx`.** I5 counts
test files deliberately — a fixture naming a domain concept is the same leak —
so a test that asserts "the source does not contain `groove`" must name
`groove` to do it, and thereby breaks the very guard it duplicates. Guard I4,
*"no primitive offers a styling escape hatch"*, is the other one to keep in
view: its pattern is `/\b(className|style)\s*[?:]/`, which a local test helper
declared as `(className: string) => …` also trips. Name such a parameter
`classes`.

### Track B — The play control

#### Step B1 — The play control is large

Covers: R4, R7, AC4

- **Test first** — `PlayControl.test.tsx`: rewrite
  *"inherits the solve button's geometry rather than restating it (A1, R1, AC1)"*
  — rename it to say the control takes the large form, and change its geometry
  list from `['w-full', 'rounded-control', 'px-4', 'py-[15px]', 'text-[15px]']`
  to `['w-full', 'rounded-control', 'px-4', 'py-[22px]', 'text-[17px]']`. Run it:
  fails with `expected "… py-[15px] …" to contain "py-[22px]"`.
- **Implement** — `PlayControl.tsx`: pass `size="lg"` to the `Button` it renders.
- **Green when** — the assertion passes and every other `PlayControl` test —
  the accessible names, the glyph/word pairs, the busy behaviour — stays green
  untouched.
- **Refactor** — rewrite the doc comment, which currently argues for the parity
  this step removes.

#### Step B2 — Three states, one size

Covers: R6, R11, AC5, AC6

- **Test first** — `PlayControl.test.tsx`: extend the existing state tests to
  assert the large geometry survives each — idle shows `▶ Play` with the
  accessible name `Play the loop`; playing shows `■ Stop` with `Stop the loop`;
  `busy` is disabled, shows the loading word, has the loading accessible name,
  and swallows a click. Assert in each that the class string still contains
  `py-[22px]`. Run it: passes after B1 — the step pins that the size does not
  vary with state.
- **Implement** — none.
- **Green when** — all three states carry the same geometry and their existing
  name assertions hold.
- **Refactor** — none.

#### Step B3 — The check control did not grow

Covers: R5, AC4

- **Test first** — `GuessCard.test.tsx`: render the card and assert the check
  button's `className` contains `py-[15px]` and not `py-[22px]`. Run it: passes,
  because `GuessCard` passes no `size`. This is the assertion that fails if
  someone later "makes the buttons match again" by changing the default.
- **Implement** — none. `GuessCard.tsx` is not opened by this epic.
- **Green when** — it passes.
- **Refactor** — none.

#### Step B4 — The structural rule says what it means

Covers: R3, R4, AC10

- **Test first** — `src/components/structure.test.ts`, in the
  `gives PlayControl only the four props its one caller can reach` test: keep
  the props-list assertion and the `PlayControlSize` / `IconButton` bans; replace
  `expect(source).not.toMatch(/\bsize\b/)` with
  `expect(source).not.toMatch(/^\s{2}size\??:/m)` — no `size` *prop* — and add
  `expect(source).toContain('size="lg"')`. Update the comment above it to record
  that the rule is about reachable props, and that the size is the control's own
  choice. Run it: before the edit, the suite is red from B1 with
  `expected "… size=\"lg\" …" not to match /\bsize\b/`; after it, green.
- **Implement** — none in production code.
- **Green when** — the whole design-system suite is green and feature-6's rule
  is still enforced: no unreachable prop, no `IconButton`.
- **Refactor** — none.

### Track C — The header's alignment

#### Step C1 — The row aligns on centres

Covers: R8, R9, AC7, AC8

- **Test first** — `GrooveHeader.test.tsx`: append a `describe` block that reads
  `GrooveHeader.tsx` from disk and asserts its source matches
  `/<Row[^>]*align="center"/` and does not match `/<Row[^>]*align="start"/`.
  Source-read on purpose: rendering would need the props Epic 1 is changing in
  the same wave, and the rule is about which alignment the row is given. Run it:
  fails with `expected … to match /<Row[^>]*align="center"/`.
- **Implement** — `GrooveHeader.tsx`: change the `Row`'s `align="start"` to
  `align="center"`. Nothing inside the `Stack` is touched.
- **Green when** — the assertion passes, and the header's existing streak-pill
  test still finds the badge (AC7).
- **Refactor** — none.

#### Step C1a — Each side anchors itself when stacked

Covers: R10a, AC9a

- **Test first** — `GrooveHeader.test.tsx`: render, then assert the streak
  badge's parent `className` contains `self-end` and `sm:self-auto`, and that the
  title block's anchor contains `self-start` and `sm:self-auto`. Run it: fails
  with `expected "" to contain "self-end"` — the badge is a bare child of the
  `Row` and simply inherits its centring.
- **Implement** — `GrooveHeader.tsx`: wrap the title `Stack` in
  `<div className="min-w-0 self-start sm:self-auto">` and `StreakBadge` in
  `<div className="self-end sm:self-auto">`.
- **Green when** — both assertions pass and the existing streak-pill test (AC7)
  still finds the badge by its label.
- **Refactor** — none. Rendered rather than source-read, unlike C1: which edge a
  child takes is behaviour a reader can see on a phone, not a look.

#### Step C2 — It still stacks on a phone

Covers: R10, AC9

- **Test first** — `GrooveHeader.test.tsx`, in the same block: assert the source
  still matches `/<Row[^>]*collapseBelow="sm"/`. Run it: passes. `Row`'s
  `COLLAPSE` table makes the stacked case the default and the split the override,
  so alignment cannot affect it — the pin is against someone removing the
  collapse while rearranging the row.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

## Integration and verification

- **Step I1 — the suite.** `npm test`, `npm run lint`, `npx tsc --noEmit`,
  `npm run build`.
- **Step I2 — the demo path.** `npm run dev` on a wide desktop: the play button
  is visibly the largest control on the page, the check button beside it is
  unchanged, and the streak sits at the top right level with the title block.
- **Step I3 — the phone.** At 375px: both buttons are legible, neither wraps its
  label, and the header has stacked with the badge under the title block — the
  badge hard against the right edge, the title hard against the left, neither
  centred.
- **Step I4 — both themes.** Light and dark: the large button's tones, focus ring
  and disabled state are the default's.
- **Step I5 — playback.** Press play, hear the groove, press stop. Nothing about
  the audio path changed (R11).

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2 |
| R2 | A2, A3 |
| R3 | A4 (via globals I5), B4 |
| R4 | B1, B4 |
| R5 | B3 |
| R6 | B2 |
| R7 | B1 |
| R8 | C1 |
| R9 | C1 |
| R10 | C2, I3 |
| R10a | C1a, I3 |
| R11 | B2, I5 |
| AC1 | A1 |
| AC2 | A2 |
| AC3 | A3 |
| AC4 | B1, B3 |
| AC5 | B2 |
| AC6 | B2 |
| AC7 | C1 |
| AC8 | C1 |
| AC9 | C2 |
| AC9a | C1a |
| AC10 | A4 (via globals I5), B4 |

## Assumptions

- The size values are literal Tailwind arbitrary values, matching how `BASE`
  already spells `py-[15px]`; no token is added to `src/components/tokens.ts` for
  two paddings.
- `ButtonSize` stays file-local and unexported, matching `ButtonTone`. Callers
  pass the literal `size="lg"`.
- The composed `className` is `${BASE} ${SIZE[size]} ${TONE[tone]}`, so the size
  utilities sit after the focus and disabled utilities rather than mid-string.
  Assert with `toContain` on individual utilities; never compare a whole class
  string literally.
- `md` and `lg` are the names, matching `Text`'s and `Heading`'s size scales.
- The glyphs scale with the label's font size rather than being sized
  separately — they are text inside the button.
- Anchoring is done with `self-*` on wrapper divs rather than by giving `Row` a
  responsive `align`, which would change a shared primitive for every caller in
  order to fix one caller's case.
- The vertical centring is verified by eye at I2, not asserted by class name:
  where the badge sits in the header is a test, how a flex row aligns it is a
  look.
- `GuessCard.tsx` is not opened. Step B3 adds an assertion to its test only.
- The two repo-wide guards in `src/app/globals.test.ts` — I4 (no styling escape
  hatch) and I5 (no domain vocabulary, test files included) — read every
  design-system file and are the standing enforcement of R3/AC10. Neither is
  modified; both are run as part of this epic's gate.
