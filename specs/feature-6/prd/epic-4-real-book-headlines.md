# PRD — Epic 4: Headlines in a Real Book hand

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The page's title — "Daily Groove" — is set in a hand-lettered jazz face in the
spirit of the Real Books, instead of Newsreader. It is the page's masthead and
the only text that takes the face. The face is vendored into the repo and self-hosted
through `next/font/local`, exposed as its own token so the design system swaps
it in one place. Every heading inside the page, and everything else on it, keeps
the face it has.

## Problem

The briefing asks: "Jazz font: Can you find a similar font to the one from the
real books? Then download it and use it for the headlines." The app's visual
identity is a jazz practice tool, and its headings currently sit in Newsreader —
a fine editorial serif with nothing musical about it. The Real Book's
hand-copied lead-sheet lettering is the single strongest visual signal the app
could borrow, and it costs one font file and one token.

## Scope

- Choose a face that reads as Real Book hand lettering and can be legally
  self-hosted.
- Vendor the font file and its licence into the repository.
- Load it with `next/font/local` and expose it as a CSS variable alongside the
  existing Google faces.
- Add a token for it and have `Heading` use it at its masthead size alone.

**Out of scope**
- **Body text.** `--font-sans` / DM Sans is untouched everywhere.
- **The revealed root note in `NudgeBox`**, and the chord and progression
  symbols in the solved panel. Both stay as they are — a hand-lettered `E♭` at
  15px is the one place on this page where legibility outweighs character.
- **Every heading inside the page**: the groove card's title, the solved panel's
  answer, the guess card's "What is it?" — any `Heading` below `xl`. The face
  marks the masthead, and a page where several things wear it stops having one.
- **Any new design-system component.** This is a token and a font file.
- **Music notation glyphs.** The face is used for text, not for rendering
  notation; `♭` and `♯` come from the same text run they do today.

## Requirements

- **R1** — `Heading` renders in the jazz face at its `xl` size alone, whose only
  caller is the page's h1, "Daily Groove".
- **R1a** — `Heading` renders in the serif at `lg`, `md` and `sm`. The groove
  card's title, the solved panel's answer and the guess card's "What is it?" are
  all unchanged.
- **R2** — No other text on the page changes face. `NudgeBox`'s revealed root
  stays on the serif it uses today; body text stays on DM Sans.
- **R3** — The font is self-hosted from the repository. The page makes no
  request to a third-party font host at runtime.
- **R4** — The font file's licence permits embedding and redistribution, and the
  licence text is committed beside the file.
- **R5** — The face is exposed as its own token in the design system's token
  layer, and `Heading` reads that token at the sizes that use it. No component
  names a font family directly.
- **R5a** — `Heading` keeps all four sizes in its scale, including the `sm` that
  loses its last caller when Epic 1 removes `ArchiveStrip`. The scale is a
  design-system contract tested on its own terms, not a list of what the app
  currently renders.
- **R6** — `--font-display` keeps its current value and its current caller, so
  the serif remains available.
- **R7** — Loading the font causes no layout shift, and text is readable while
  it loads.
- **R8** — The face renders correctly in both the light and dark palettes, at
  both ends of `xl` — 34px, and 44px above the `sm` breakpoint.
- **R9** — Where the font cannot load, headings fall back to a declared stack
  rather than the browser default.

## Behaviour details

**The candidate.** The original Real Book is hand-lettered rather than typeset,
so there is no "the" font to obtain. The commercial Hal Leonard editions use
**Finale Jazz / Jazz Text** (MakeMusic), which is proprietary and cannot be
self-hosted here. The closest freely licensable match is **Petaluma Script**
(Steinberg / MuseScore, SIL OFL 1.1) — drawn from hand-copied jazz lead sheets
and licensed for embedding. It is implemented first and judged in place: a face
is a visual-identity decision, and a specimen sheet is not the same as seeing it
set in the app's own headings at the app's own sizes. If it reads wrong, the
token indirection in R5 makes the swap a one-line change, and the next
candidates are Caveat, Just Another Hand and Nanum Pen Script — all on Google
Fonts under the OFL.

**Why a new token rather than repointing `--font-display`.** `--font-display`
has two callers: `Heading`, and `NudgeBox`'s revealed root note. Repointing it
would drag the nudge along, which R2 forbids. A `--font-jazz` token that
`Heading` reads leaves `NudgeBox` untouched and needs no edit to it — and keeps
`layout.test.ts`'s existing Newsreader assertions holding.

**Which sizes take it.** `Heading`'s size scale splits in two:

| Where | Size | Rendered | Face |
| :-- | :-- | :-- | :-- |
| Page h1 | `xl` | 34px, 44px above `sm` | Jazz |
| Groove card title | `lg` | 30px | Serif |
| Solved panel answer | `lg` | 30px, inverted panel | Serif |
| Guess card heading | `md` | 22px | Serif |
| — no current caller — | `sm` | 19px | Serif |

**What this costs the design system.** `Heading` has kept level, size and
treatment as three independent props: a section can be an h2 without being told
how big to be. Binding the family to the size is the first place that separation
bends — the size prop now carries a typeface decision as well as a visual
weight. It is a deliberate, contained exception, and a narrow one: exactly one
size is the masthead and every other is a heading within the page. It stays
inside `Heading`, where the whole mapping is visible in one table, rather than
leaking to callers as a `face` prop they would have to choose correctly.

Hand faces also tend to have smaller x-heights than a serif at the same nominal
size, so `xl` may need its values adjusting to keep the visual weight the design
set. Every other size keeps its own, since their face has not changed.

## Acceptance criteria

- **AC1** (R1, R5) — Given a `Heading` at `xl`, when it is inspected, then it
  carries the jazz font token and not `--font-display`.
- **AC1a** (R1a) — Given a `Heading` at `lg`, `md` or `sm`, when it is
  inspected, then it carries `--font-display` and not the jazz token.
- **AC1b** (R1a) — Given the composed page, when it renders, then the h1 is set
  in the jazz face and the groove card's title and the guess card's "What is
  it?" are both set in the serif.
- **AC2** (R2, R6) — Given the nudge is showing, when its revealed root is
  inspected, then it still resolves through `--font-display`, and
  `--font-display`'s value is unchanged.
- **AC3** (R3, R4) — Given the repository, when the font directory is inspected,
  then the font file and its licence text are both present and committed.
- **AC4** (R3) — Given the built page, when its network requests are inspected,
  then no font is fetched from a third-party host.
- **AC5** (R5) — Given `globals.css`, when its tokens are read, then the jazz
  token is defined alongside `--font-display` and `--font-sans`, and all three
  are still defined.
- **AC6** (R1) — Given `layout.tsx`, when it is inspected, then the local font's
  CSS variable is applied to the `html` element alongside the existing two.
- **AC7** (R7) — Given a cold load, when the page paints, then text is visible
  before the font resolves and does not shift when it arrives.
- **AC8** (R8) — Given each palette, when the h1 renders at both its sizes,
  then it is legible against its surface.
- **AC8a** (R5a) — Given `Heading`, when its size scale is inspected, then all
  four sizes are present and each renders at its documented size.
- **AC9** (R9) — Given the font fails to load, when a heading renders, then it
  falls back to the declared stack.

## Dependencies

None. `layout.tsx`, `globals.css` and `Heading.tsx` are touched by no other epic
in this feature, so this runs alongside Epics 1 and 3 with no shared files.

`next/font/local` is available in the pinned Next version — confirmed at
`node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`.

## Assumptions

- The font is loaded with `display: 'swap'`, matching the two existing faces.
- One weight is enough. `Heading` renders at `font-normal` throughout, and a
  hand face rarely ships a useful bold.
- The font file lives beside `layout.tsx` in `src/app/`, which is where
  `next/font/local` expects a relative `src`.
- `globals.test.ts` uses `.has()` on the token set rather than an exact match,
  so adding a token does not break it.
- Reviewing the face in place happens before the epic is called done, and a swap
  at that point is a token value change, not a rework.
- `Heading`'s `sm` size stays untested against the jazz face, since it does not
  use it. Its existing contract test is unchanged.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-30

**Q1. Does the jazz face apply at every `Heading` size, or only the large ones?**
Answer: **B) `lg` and `xl` only — the page title, the groove name and the
answer. `md` and `sm` stay on the serif** — at 22px a script face competes with
the chips beneath it and reads as small rather than characterful.
Applied to: Summary, Out of scope, R1, R1a, R8, AC1, AC1a, AC1b, AC8, Behaviour
details

**Q2. How is the pick confirmed before the epic commits to it?**
Answer: **A) Implement with Petaluma Script, then review it running and swap if
it reads wrong** — the token indirection exists precisely so the choice is cheap
to revise, and a face has to be judged in the layout.
Applied to: Behaviour details, Assumptions

**Q3. Does the design system keep a `Heading` size that nothing uses?**
Answer: **A) Keep all four sizes** — `docs/testing.md` says a primitive is
tested against its own contract independently of any feature, which is exactly a
size the app does not currently render.
Applied to: R5a, AC8a, Assumptions

### Cycle 2 — 2026-08-30

**Q1 (revisited). Does the jazz face apply at every `Heading` size, or only the
large ones?**
Answer: **C) `xl` only — the page title alone is the headline; everything else is
a section heading.** This supersedes Cycle 1's answer of B (`lg` and `xl`), at
the user's direction after seeing the implemented result. The face marks the
masthead, and a page where the title, the groove name and the solved answer all
wear it stops having one.
Applied to: Summary, Scope, Out of scope, R1, R1a, R8, AC1, AC1a, AC1b, AC8,
Behaviour details. Cycle 1's entry is left standing above — the log records how
requirements got here, including the step that was later reversed.
