# Tech spec — Epic 4: Headlines in a Real Book hand

PRD: [../prd/epic-4-real-book-headlines.md](../prd/epic-4-real-book-headlines.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

A font file is committed to the repo, loaded with `next/font/local` beside the
two existing Google faces, and exposed as a CSS variable on `<html>`. A new
`--font-jazz` token in the `@theme` block resolves that variable with a serif
fallback, and `Heading` picks between `font-jazz` and `font-display` by size — `xl` alone
takes the hand.

`--font-display` keeps its value and its caller. That is what makes the split
possible without editing `NudgeBox`: the serif is still there, still named the
same, still resolving to Newsreader — the jazz face is an addition to the token
layer rather than a replacement inside it.

Two tracks: getting the font into the build, and teaching the design system
which sizes use it. They share nothing but the variable name, which is frozen
below.

## Architecture

```
src/app/fonts/PetalumaScript.woff2   ← committed binary
src/app/fonts/OFL.txt                ← committed licence
        │
        ▼  next/font/local → CSS variable
   --font-jazz-hand         (layout.tsx, on <html>)
        │
        ▼  @theme
   --font-jazz: var(--font-jazz-hand), var(--font-newsreader), Georgia, serif
        │
        ▼  Tailwind utility
   font-jazz  ──►  Heading size xl            (the page masthead, its only caller)
   font-display ─►  Heading size lg, md, sm   (unchanged, Newsreader)
```

`Heading` gains a second lookup beside `SIZE`:

```ts
const FAMILY: Record<HeadingSize, string> = {
  sm: 'font-display',
  md: 'font-display',
  lg: 'font-display',
  xl: 'font-jazz',
}
```

This is the one place the component's level/size/treatment separation bends: the
size prop now carries a typeface decision as well as a visual weight. It is
contained — the whole mapping is four lines in one file, and no caller has to
choose a face — but it is real, and a reviewer should see it here rather than
discover it.

## Contracts

Frozen before the tracks start. Track B builds against the variable name while
Track A is still sourcing the file.

```ts
// src/app/layout.tsx
const jazzHand = localFont({
  src: './fonts/PetalumaScript.woff2',   // Caveat.woff2 if Petaluma is unusable
  variable: '--font-jazz-hand',
  display: 'swap',                        // same as the two Google faces
  weight: '400',
  style: 'normal',
})
// applied to <html> alongside newsreader.variable and dmSans.variable
```

```css
/* src/app/globals.css — inside @theme */
--font-jazz: var(--font-jazz-hand), var(--font-newsreader), Georgia, serif;
/* --font-display and --font-sans are unchanged */
```

```ts
// src/components/typography/Heading.tsx
// Public props are unchanged: { children, level, size, tone? }
// xl renders font-jazz; lg, md and sm render font-display.
```

## Tracks

### Track A — The font is in the build

- **Goal** — the face is committed, licensed, self-hosted and exposed as
  `--font-jazz-hand` on `<html>`.
- **Owns** — `src/app/fonts/**`, `src/app/layout.tsx`,
  `src/app/layout.test.ts`
- **Depends on** — nothing.
- **Parallel with** — Track B.
- **Done when** — `layout.test.ts` passes and the build succeeds with no
  third-party font request.

### Track B — The design system picks the face by size

- **Goal** — `--font-jazz` is a token, and `Heading` maps `xl` to it and every
  other size to the serif.
- **Owns** — `src/app/globals.css`, `src/app/globals.test.ts`,
  `src/components/typography/Heading.{tsx,test.tsx}`
- **Depends on** — the `--font-jazz-hand` variable name only. Until Track A
  lands, the token resolves through its fallback, which is the behaviour R9
  requires anyway.
- **Parallel with** — Track A.
- **Done when** — its own tests pass.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B — disjoint files, joined only by the
  frozen variable name.
- **Wave 2:** Integration, including the visual review the face is chosen on.

## Implementation

### Track A — The font is in the build

> Steps A1 and A2 depend on the answers to Q1 and Q2.

#### Step A1 — The font file and its licence are in the repo

Covers: R3, R4, AC3

- **Test first** — `src/app/layout.test.ts`: assert
  `existsSync('src/app/fonts/PetalumaScript.woff2')` and
  `existsSync('src/app/fonts/OFL.txt')`, and that the licence text contains
  `SIL OPEN FONT LICENSE`. Run it: fails, the directory does not exist.
- **Implement** — download Petaluma Script from the MuseScore/Steinberg SMuFL
  distribution, convert the `.otf` to `.woff2`, and commit both it and the
  upstream `OFL.txt` under `src/app/fonts/`. Only the `.woff2` is committed: it
  is roughly a third of the `.otf` and is the artefact that ships.
- **Green when** — all three assertions pass.
- **Refactor** — none.
- **If the face cannot be obtained or its licence is not OFL as assumed** —
  substitute Caveat from Google Fonts, downloaded as `.woff2` and self-hosted
  the same way, and rename the file to `Caveat.woff2`. Nothing else in this spec
  changes: the variable name, the token, the `Heading` mapping and every other
  step are face-agnostic by design. Do not switch to a CDN or to
  `next/font/google` — R3 requires self-hosting.

#### Step A2 — The face loads locally and reaches `<html>`

Covers: R1, R3, AC4, AC6

- **Test first** — `layout.test.ts`: assert the source imports `localFont` from
  `next/font/local`, that it contains `--font-jazz-hand`, and that the `html`
  className template includes the new variable alongside `newsreader.variable`
  and `dmSans.variable`. Keep the two existing Google-font cases unchanged. Run
  it: fails on the `next/font/local` import.
- **Implement** — `src/app/layout.tsx`: add the `localFont` call from the
  contract and append `${jazzHand.variable}` to the `html` className.
- **Green when** — the three new assertions and both existing ones pass.
- **Refactor** — none.

### Track B — The design system picks the face by size

#### Step B1 — `--font-jazz` is a token, and the serif is untouched

Covers: R5, R6, R9, AC5, AC9

- **Test first** — `src/app/globals.test.ts`: extend
  `maps the display and body font tokens` to also assert
  `defined.has('--font-jazz')`, and add a case asserting the `--font-jazz`
  declaration contains both `--font-jazz-hand` and a serif fallback, and that
  `--font-display` still contains `--font-newsreader`. Run it: fails,
  `--font-jazz` is undefined.
- **Implement** — `src/app/globals.css`: add the `--font-jazz` line from the
  contract to the `@theme` block, leaving `--font-display` and `--font-sans`
  exactly as they are.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step B2 — `xl` renders the jazz face

Covers: R1, R5, AC1

- **Test first** — `src/components/typography/Heading.test.tsx`: assert a
  `size="xl"` heading's class list contains `font-jazz` and not `font-display`.
  Run it: fails, it emits `font-display`.
- **Implement** — `Heading.tsx`: add the `FAMILY` record and use
  `FAMILY[size]` in place of the hard-coded `font-display`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B3 — `lg`, `md` and `sm` keep the serif

Covers: R1a, R5a, AC1a, AC8a

- **Test first** — `Heading.test.tsx`: assert `size="lg"`, `size="md"` and
  `size="sm"` headings each contain `font-display` and not `font-jazz`, and that
  all four sizes still render their documented pixel classes. Run them: they
  fail if B2 applied the face to more than `xl`.
- **Implement** — none beyond B2's record.
- **Green when** — all six assertions pass.
- **Refactor** — none.

#### Step B4 — The tone treatments are unchanged

Covers: R8

- **Test first** — `Heading.test.tsx`: keep the existing `default` and
  `inverted` tone cases unchanged and re-run them. Run them: they fail if the
  family change disturbed the class composition order.
- **Implement** — none.
- **Green when** — both pass.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The page's four headings render the intended faces

Covers: R1, R1a, R2, AC1b, AC2

- **Test first** — `src/features/daily-groove/components/GroovePuzzle.test.tsx`:
  assert the h1 carries `font-jazz`, and that the groove card's title, the guess
  card's "What is it?" and the nudge's revealed root all carry `font-display`.
  Run them: they fail if the mapping was applied by component rather than by
  size, or if more than `xl` took the face.
- **Implement** — none.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step I2 — Clean suite, lint and build

Covers: R3, R7, AC4

- **Green when** — `npm test`, `npm run lint` and `npm run build` are clean, and
  the built output requests no font from a third-party host.

#### Step I3 — The visual review the pick is judged on

Covers: R7, R8, AC7, AC8

Run `npm run dev` and look at the real page, which is the only place this
decision can actually be made:

- The h1 at both `xl` sizes — narrow (34px) and above `sm` (44px). That is the
  only text wearing the face, so it is the whole of the judgement.
- That the groove card title and the solved answer beneath it still read as the
  serif they were, and the page has one masthead rather than several.
- Both palettes, light and dark.
- A hard reload with the cache cleared: the fallback serif paints first and the
  face swaps in. `display: 'swap'` is what the two existing Google faces already
  use, so a small first-paint reflow on the headings is expected and consistent
  with the rest of the page — check it is confined to the headings and does not
  move the cards beneath them.

If Petaluma Script reads wrong at these sizes, the swap is one value in
`--font-jazz` plus a new file in `src/app/fonts/`. Candidates in order: Caveat,
Just Another Hand, Nanum Pen Script.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, B2, I1 |
| R1a | B3, I1 |
| R2 | I1 |
| R3 | A1, A2, I2 |
| R4 | A1 |
| R5 | B1, B2 |
| R5a | B3 |
| R6 | B1 |
| R7 | I2, I3 |
| R8 | B4, I3 |
| R9 | B1 |
| AC1 | B2 |
| AC1a | B3 |
| AC1b | I1 |
| AC2 | I1 |
| AC3 | A1 |
| AC4 | A2, I2 |
| AC5 | B1 |
| AC6 | A2 |
| AC7 | I3 |
| AC8 | I3 |
| AC8a | B3 |
| AC9 | B1 |

## Assumptions

- The font lives in `src/app/fonts/`, which is where `next/font/local`'s
  relative `src` expects it and where it stays out of `public/`.
- `next/font/local`'s `adjustFontFallback` is left at its default, so Next
  synthesises a metric-adjusted fallback where it can. No hand-tuned
  `size-adjust` is shipped; a script face has no metric-compatible fallback and
  chasing one is not worth a first-paint reflow confined to four headings.
- One weight, `400`, `normal`. `Heading` renders `font-normal` throughout and a
  hand face rarely ships a useful bold.
- `globals.test.ts` reads token names with `.has()` rather than an exact set, so
  adding `--font-jazz` breaks nothing that exists.
- `Heading`'s public props do not change. Callers keep passing `level` and
  `size`; the face follows from the size inside the component.
- Tests assert on class names rather than computed font families, since jsdom
  resolves no web fonts. The rendered result is checked in Step I3 instead.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-30

**Q1. What format is the font committed in?**
Decision: **A) Convert to `.woff2` and commit only that** — R7 wants the
smallest download and no layout shift, and `.woff2` is roughly a third of the
`.otf`; the conversion is a one-off and the committed artefact is what ships.
Changed: Step A1's implement line now says only the `.woff2` is committed. The
`localFont` contract already named `.woff2`.

**Q2. How is the layout shift in R7 actually prevented?**
Decision: **A) `display: 'swap'` with `adjustFontFallback` left on** — it is
what the two existing Google faces already do in this app, so the page behaves
consistently, and headings are the only affected text.
Changed: Step I3's reload check now states what to expect and what would be a
real defect; an assumption records that no hand-tuned `size-adjust` ships.

**Q3. What happens if Petaluma Script cannot be obtained or licensed as assumed?**
Decision: **A) Fall back to Caveat from Google Fonts, self-hosted the same way**
— it is OFL, unambiguously redistributable, ships `.woff2` directly, and the PRD
already names it as the first alternative; the token indirection means the rest
of the spec is unchanged.
Changed: Step A1 gains an explicit contingency branch, and the `localFont`
contract notes the alternative filename. No other step is face-dependent.

### Cycle 2 — 2026-08-30

**Q1 (revisited). Which `Heading` sizes take the jazz face?**
Decision: **`xl` only**, superseding Cycle 1's `lg` and `xl`, at the user's
direction after seeing the implemented result.
Changed: the `FAMILY` record's `lg` entry, the Architecture diagram and its
size table, Steps B2, B3 and I1, and Step I3's review checklist. Three test
files moved with it — `Heading.test.tsx` (two cases regrouped),
`GroovePuzzle.test.tsx` (the groove name asserted as serif, both page-level
cases renamed) and `SolvedPanel.test.tsx` (the answer returned to the serif it
had before this feature). No implementation beyond the one `FAMILY` line.
