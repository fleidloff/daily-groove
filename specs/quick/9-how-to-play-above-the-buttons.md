# 9 — How to play above the buttons

## What

* The how-to-play box moves directly below the subtitle.
* It sits above the transpose and share buttons.
* The transpose and share buttons come directly before the groove box.
* They also come after the notice that the groove is shared.

## Done when

* With the how-to-play box open, it renders between the subtitle and the transpose/share row.
* The transpose and share buttons render immediately above the groove box.
* On a shared groove, the shared-groove notice renders above the transpose and share buttons.
* A test covers the order on both the daily and the shared route.

## Open questions

### Q1. Where does the transpose/share row live once it leaves `GrooveHeader`?

The row currently sits inside `<header>` in `GrooveHeader.tsx`. It has to leave, because `## What` puts it *after* `SharedGrooveNotice`, and the notice is composed in `GroovePuzzle.tsx` — no slot arrangement inside the header can reach past its own element.

- [ ] A) Inline in `GroovePuzzle.tsx`, between the notice and the groove-box `Row` *(recommended — engineering reason: the composer already lays out inline `Row`/`div` wrappers, the row is three lines of markup, and nothing new has to be registered)*
- [x] B) A new `components/header/GrooveControls.tsx` taking the two slots *(buys a unit test for a row with no logic in it, and costs an entry in the `REGIONS` map of `src/features/daily-groove/structure.test.ts`)*
- [ ] C) Keep the slots on `GrooveHeader` and pass the how-to-play box and the shared notice into it as slots too *(fails: `GrooveHeader` would have to learn about shared mode, and `GrooveHeader.test.tsx` asserts it knows nothing about sharing)*

### Q2. How is the row aligned once it spans the full width above the groove box?

Today it is `justify="end"` inside the header, so the two controls hug the right edge under the streak badge. Below the notice it sits above a full-width two-column layout instead.

- [x] A) Keep `justify="end"` *(recommended — engineering reason: unchanged look, and the smallest diff; `## Done when` asks only about order)*
- [ ] B) `justify="between"` — transpose left, share right, matching the width of the groove box
- [ ] C) `justify="start"` — both left-aligned with the heading

## Notes

* Size test — **passes.** Five bullets; one module (**shell** only: `components/GroovePuzzle.tsx`, `components/header/GrooveHeader.tsx` and their tests); nothing in `docs/music.md` touched; one `git revert` rolls it back.
* `src/features/daily-groove/components/GroovePuzzle.tsx` — move the `share`/`transpose` slots off `<GrooveHeader>` and render the row between `{shared && <SharedGrooveNotice />}` and the groove-box `<Row gap="lg" collapseBelow="md">`.
* `src/features/daily-groove/components/header/GrooveHeader.tsx` — drop the `share` and `transpose` props and the `justify="end"` `Row` that holds them. What is left is the title/streak line and the tagline, so the outer `Stack gap="sm"` collapses to the inner `Stack gap="xs"`.
* `src/features/daily-groove/components/header/GrooveHeader.test.tsx` — the two `describe` blocks *the share slot (F12 E2)* and *the transpose slot (F23 E1)* are entirely about slots that no longer exist, and the `controlsRow` helper with them. The props-shape test also asserts `props).toEqual(['streak', 'onShowHelp', 'share', 'transpose'])` and has to become `['streak', 'onShowHelp']`. The two *learns nothing about sharing / about pitch* source assertions still hold and are worth keeping — they are cheaper to satisfy after the move, but they are the reason the move is safe.
* `src/features/daily-groove/components/GroovePuzzle.header.test.tsx` — the natural home for the new order tests. It already renders shared mode at line 245 (`renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)`), so the shared-route assertion needs no new harness. The route files themselves (`src/app/page.tsx`, `src/app/groove/[uuid]/SharedGroove.tsx`) only mount `GroovePuzzle`, so testing both modes through the composer *is* testing both routes.
* Assumption — the audio-error alert stays where it is, after the how-to-play box and before the shared notice, so the controls row lands below it too. `## What` doesn't mention it, and it is a transient alert rather than part of the resting order.
* Assumption — the shared route keeps both controls. `ShareGroove` and `TransposeSelect` are rendered unconditionally today, and `GroovePuzzle.header.test.tsx:242` pins share on a shared groove.
* `src/features/daily-groove/components/GroovePuzzle.intro.test.tsx:119` (*follows the masthead and precedes the groove card*) still passes — it compares heading positions only, and the how-to-play box moves up, not past the `h1`.
* `src/features/daily-groove/components/GroovePuzzle.page.test.tsx:443` forbids `order-*`, `absolute`, `fixed` and `sticky` on the chain above the panels. The reorder has to be markup order, not CSS.
* `src/features/daily-groove/structure.test.ts` — only bites under option Q1-B, which adds a file to `components/header/` and so needs a `REGIONS` entry.
