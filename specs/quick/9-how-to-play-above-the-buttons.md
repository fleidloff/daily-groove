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

### Q1. Where does the transpose/share row live once it leaves `GrooveHeader`? — **answered: B**

The row currently sits inside `<header>` in `GrooveHeader.tsx`. It has to leave, because `## What` puts it *after* `SharedGrooveNotice`, and the notice is composed in `GroovePuzzle.tsx` — no slot arrangement inside the header can reach past its own element.

- [ ] A) Inline in `GroovePuzzle.tsx`, between the notice and the groove-box `Row` *(recommended — engineering reason: the composer already lays out inline `Row`/`div` wrappers, the row is three lines of markup, and nothing new has to be registered)*
- [x] B) A new `components/header/GrooveControls.tsx` taking the two slots *(buys a unit test for a row with no logic in it, and costs an entry in the `REGIONS` map of `src/features/daily-groove/structure.test.ts`)*
- [ ] C) Keep the slots on `GrooveHeader` and pass the how-to-play box and the shared notice into it as slots too *(fails: `GrooveHeader` would have to learn about shared mode, and `GrooveHeader.test.tsx` asserts it knows nothing about sharing)*

### Q2. How is the row aligned once it spans the full width above the groove box? — **answered: A**

Today it is `justify="end"` inside the header, so the two controls hug the right edge under the streak badge. Below the notice it sits above a full-width two-column layout instead.

- [x] A) Keep `justify="end"` *(recommended — engineering reason: unchanged look, and the smallest diff; `## Done when` asks only about order)*
- [ ] B) `justify="between"` — transpose left, share right, matching the width of the groove box
- [ ] C) `justify="start"` — both left-aligned with the heading

### Q3. Does `GrooveControls` take the two controls as slots, or build them itself? — **answered: A**

Opened by Q1-B. `GrooveHeader` takes `share` and `transpose` as `ReactNode` slots and is guarded by two source assertions in `GrooveHeader.test.tsx` — *learns nothing about sharing* and *learns nothing about pitch*. The new component can inherit that discipline or drop it.

- [x] A) The same two `ReactNode` slots, `share` and `transpose`, and the same two source assertions carried over to `GrooveControls.test.tsx` *(recommended — engineering reason: the guarantee that made the row liftable out of `GrooveHeader` today is what keeps it liftable next time; the composer already builds both nodes, so nothing moves)*
- [ ] B) `GrooveControls` imports `ShareGroove` and `TransposeSelect` itself, taking `groove`, `instrumentKey` and `onInstrumentKeyChange` *(three props threaded instead of two nodes, and the row can no longer be unit-tested without the share and transpose machinery — `ShareGroove` pulls in `lib/share/` and the browser share sheet)*

## Answered — Q1-B, Q2-A, Q3-A

* **Q1-B** — the row becomes its own component, `src/features/daily-groove/components/header/GrooveControls.tsx`, rendered by `GroovePuzzle.tsx` between the shared notice and the groove-box `Row`. It stays in the `header/` region directory even though it no longer renders inside `<header>`; the region names the screen area it belongs to, and both controls are already filed there.
* **Q1-B costs two things option A did not** — an entry in the `REGIONS` map of `src/features/daily-groove/structure.test.ts`, and a `GrooveControls.test.tsx` beside it. The map is checked both ways: *names every component that exists in a region directory* fails on an unlisted file, and *places every other component in its region beside its own test* fails on a listed name with no test file.
* **Q2-A** — the row keeps `justify="end"`, so the controls stay right-aligned. Nothing about the alignment changes; only where the row sits in the document.
* **Q3-A** — `GrooveControls` takes `share` and `transpose` as `ReactNode` slots, exactly the props `GrooveHeader` gives up. `GroovePuzzle.tsx` already builds both nodes, so the two `<ShareGroove>` / `<TransposeSelect>` elements move from one attribute to another and nothing else about them changes. The two source assertions — *learns nothing about sharing*, *learns nothing about pitch* — move to `GrooveControls.test.tsx` and stay in `GrooveHeader.test.tsx` too, since after the move the header has to keep knowing nothing about either.
* Still one module (**shell**), still one `git revert`. Size test passes unchanged. Nothing left open.

## Notes

* Size test — **passes.** Five bullets; one module (**shell** only: `components/GroovePuzzle.tsx`, `components/header/GrooveHeader.tsx`, the new `components/header/GrooveControls.tsx`, `structure.test.ts` and the tests); nothing in `docs/music.md` touched; one `git revert` rolls it back.
* `src/features/daily-groove/components/header/GrooveControls.tsx` — **new.** Props `share?: ReactNode` and `transpose?: ReactNode` (Q3-A), rendering a `Row gap="sm" align="center" justify="end"` holding `{transpose}{share}` — exactly the row lifted out of `GrooveHeader`, transpose first. No `<header>` element: the page already has one, and a second landmark would be wrong. Assumption — it keeps the header's `share || transpose ? … : null` guard, so a `GrooveControls` with neither slot renders nothing.
* `src/features/daily-groove/components/header/GrooveControls.test.tsx` — **new**, and required by `structure.test.ts`, not optional. Covers the order of the two slots (transpose before share), the `justify-end` class, the empty case, and the two source assertions carried over under Q3-A.
* `src/features/daily-groove/components/GroovePuzzle.tsx` — move the `share`/`transpose` props off `<GrooveHeader>` onto a `<GrooveControls>` rendered between `{shared && <SharedGrooveNotice />}` and the groove-box `<Row gap="lg" collapseBelow="md">`.
* `src/features/daily-groove/components/header/GrooveHeader.tsx` — drop the `share` and `transpose` props and the `justify="end"` `Row` that holds them. What is left is the title/streak line and the tagline, so the outer `Stack gap="sm"` collapses to the inner `Stack gap="xs"`.
* `src/features/daily-groove/components/header/GrooveHeader.test.tsx` — the two `describe` blocks *the share slot (F12 E2)* and *the transpose slot (F23 E1)* are about slots that no longer exist there, and the `controlsRow` helper with them. Their subject moves to `GrooveControls.test.tsx` rather than being deleted — [docs/testing.md](../../docs/testing.md) calls a relocated assertion a move only if it keeps its subject. The props-shape test asserts `props).toEqual(['streak', 'onShowHelp', 'share', 'transpose'])` and becomes `['streak', 'onShowHelp']`.
* `src/features/daily-groove/structure.test.ts` — add `GrooveControls` to `REGIONS.header`, which currently reads `['GrooveHeader', 'HelpToggle', 'ShareGroove', 'StreakBadge', 'TransposeSelect']`.
* `src/features/daily-groove/components/GroovePuzzle.header.test.tsx` — the home for the new order tests. It already renders shared mode at line 245 (`renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)`), so the shared-route assertion needs no new harness. The route files themselves (`src/app/page.tsx`, `src/app/groove/[uuid]/SharedGroove.tsx`) only mount `GroovePuzzle`, so testing both modes through the composer *is* testing both routes.
* Assumption — the audio-error alert stays where it is, after the how-to-play box and before the shared notice, so the controls row lands below it too. `## What` doesn't mention it, and it is a transient alert rather than part of the resting order.
* Assumption — the shared route keeps both controls. `ShareGroove` and `TransposeSelect` are rendered unconditionally today, and `GroovePuzzle.header.test.tsx:242` pins share on a shared groove.
* `src/features/daily-groove/components/GroovePuzzle.intro.test.tsx:119` (*follows the masthead and precedes the groove card*) still passes — it compares heading positions only, and the how-to-play box moves up, not past the `h1`.
* `src/features/daily-groove/components/GroovePuzzle.page.test.tsx:443` forbids `order-*`, `absolute`, `fixed` and `sticky` on the chain above the panels. The reorder has to be markup order, not CSS.

## Built

* `src/features/daily-groove/components/header/GrooveControls.tsx` — new. Takes `share` and `transpose` as `ReactNode` slots (Q3-A) and renders them, transpose first, in the `Row gap="sm" align="center" justify="end"` lifted out of `GrooveHeader` (Q2-A). Renders nothing when it has neither slot.
* `src/features/daily-groove/components/header/GrooveHeader.tsx` — dropped both slots and the row that held them. The outer `Stack gap="sm"` collapsed into the inner `Stack gap="xs"`, leaving the title/streak line and the tagline.
* `src/features/daily-groove/components/GroovePuzzle.tsx` — renders `<GrooveControls>` between `{shared && <SharedGrooveNotice />}` and the groove-box `<Row gap="lg" collapseBelow="md">`.
* `src/features/daily-groove/structure.test.ts` — `GrooveControls` added to `REGIONS.header`, which the region guard checks in both directions.
* tests:
  * `components/header/GrooveControls.test.tsx` — new. Slot order, `justify-end`, either slot alone, the empty case, no second banner landmark, and the two source assertions carried over from the header (Q3-A).
  * `components/header/GrooveHeader.test.tsx` — the *share slot (F12 E2)* and *transpose slot (F23 E1)* blocks and the `controlsRow` helper removed; props narrowed to `['streak', 'onShowHelp']`; the two *learns nothing about sharing / about pitch* source assertions kept on their own subject, plus one that the header now holds no controls row.
  * `components/GroovePuzzle.header.test.tsx` — four order tests: subtitle → how-to-play → controls, the controls row adjacent to the groove box, the same order on a shared groove under the notice, and that the order is markup rather than `order-*` / `absolute` / `fixed` / `sticky`.
  * `components/GroovePuzzle.written.test.tsx` — feature-23's *sits in the header beside share* assertion narrowed, not deleted: `closest('header')` now asserts the control **left** the header, and a `compareDocumentPosition` check pins the row above the groove card. Every other clause of that AC survives. The ticket's `## Notes` did not list this file, and the verifier is what found it.
* checks: lint pass · type check pass · app tier pass (2875 tests) · tooling pass · build pass. Generator tier not run — `tiersFor` returns `['app','tooling']` for this scope and no bullet is graded on it.
* verifier: **pass** — 4 done, 0 partly, 0 not done. All four citations resolve under `scripts/citations.ts`.
  * D1 — how-to-play between the subtitle and the controls: `GroovePuzzle.header.test.tsx` *puts the how-to-play box between the subtitle and the controls*.
  * D2 — controls immediately above the groove box: same file, *puts the controls immediately above the groove box*, asserting `row.nextElementSibling` contains the groove-box heading.
  * D3 — the shared notice above the controls: same file, *keeps the same order on a shared groove, under the shared notice*.
  * D4 — both routes covered: the two order tests, one per mode. The routes mount nothing but the composer.
* known gaps, none leaving a bullet uncovered: nothing asserts the routes mount the composer (read from source); the audio-error alert's position is an untested assumption and the only conditional sibling near the adjacency check; adjacency is pinned on the daily route only.
