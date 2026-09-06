# 7 — Dev groove preview page

## What

* A page that only exists in dev mode, never deployed.
* Every groove in the catalogue is listenable from it.
* The lick variations play in time to the running groove.
* Grooves are ordered by date, so upcoming ones are visible before their day.
* The point is to verify upcoming grooves and catch anything that needs changing.

## Done when

* The page is reachable under `next dev` and absent from a production build.
* The page lists every groove in the catalogue, ordered by date, with each date shown.
* Picking a groove and hitting play sounds that groove.
* Each lick variation for a mode can be triggered over the running groove and lands in time with it.

## Open questions

### Q1. How is the page kept out of production?

- [x] A) `src/app/dev/grooves/page.dev.tsx`, with `pageExtensions` in `next.config.ts` including `dev.tsx` only when `NODE_ENV === 'development'` *(recommended — engineering reason, no persona bearing: the only option under which the route is genuinely not built, which is what Done-when 1 says. Cost: a global config key, and the additive list keeps every existing `page.tsx` resolving exactly as now.)*
- [ ] B) `page.tsx` that calls `notFound()` unless `process.env.NODE_ENV === 'development'`. One file, no config change — but the route and its component are compiled and shipped, so Done-when 1 would hold for the URL and not for the build.
- [ ] C) No route at all — audition the grooves from a test or a script. Fails Done-when 1's other half: there is nothing to reach under `next dev`.

### Q2. What does the list enumerate?

- [ ] A) One row per groove — every entry in `GROOVES`, labelled with the next date it comes up, found by scanning forward from today with `selectGrooveForDate`, sorted by that date *(recommended — engineering reason: the only option where "every groove in the catalogue" is guaranteed. `orderFor` in `lib/puzzle/selectGroove.ts` reshuffles on every lap of 30 days, so a fixed 30-day window that crosses a lap boundary can show one groove twice and another not at all.)*
- [x] B) One row per day — today through today + 29, each with the groove that falls on it. Reads like a calendar and matches "ordered by date" most directly, but the lap boundary above means those 30 rows are not always the 30 grooves.
- [ ] C) Catalogue order, `groove-01` … `groove-30`, each row showing its next date. Every groove exactly once and the least code, but fails Done-when 2's "ordered by date".

## Notes

* Size test: **passes, at the edge on question 1.**
  * *Five bullets* — yes, though it lands as seven files, three of them guard-test updates.
  * *At most two modules* — **shell** (`src/app/`, `components/dev/`, `index.ts`) and **audio** (`hooks/useModeLick.ts`), counting files changed. The page *reads* catalogue and puzzle and changes neither, and `architecture.md` already draws **shell → every other module**. Under a "reaches" reading this would be four modules, and that reading would make any new screen impossible to build quickly.
  * *Nothing frozen in `docs/music.md`* — no generator file, no re-render, no puzzle reassigned. The page only reads the selection the app already computes.
  * *One revert* — two new folders, one export line, one optional hook input, one config key.
* Files, under Q1-A, Q2-B and Q3-A:
  * `src/app/dev/grooves/page.dev.tsx` — new, thin. The eslint zone in `eslint.config.mjs` binds `src/app` to the feature's `index.ts`, so the route holds no logic of its own.
  * `src/features/daily-groove/components/dev/GroovePreview.tsx` + `.test.tsx` — new: the dated list, the transport, the lick buttons.
  * `src/features/daily-groove/index.ts` — one export. The lint zone leaves the route no other way in.
  * `src/features/daily-groove/hooks/useModeLick.ts` + its test — an optional `variation?: number` that overrides `variationFor(seed)`. Today the hook derives the variation from a seed hash, so there is no way to ask for variation 2 by name, and Done-when 4 wants all three.
  * `next.config.ts` — the `pageExtensions` key.
  * `src/features/daily-groove/structure.test.ts` — it asserts `components/` holds **exactly** `header`, `intro`, `puzzle`, `solved` and names every component in a region. A `dev/` folder fails both until the test declares it.
  * `src/app/route-boundary.test.ts` — `ROUTE_FILES` is a hand-written list; the new route joins it or the guard silently stops covering the app's newest route.
* The day → groove loop lives in the preview component: `nextDayStart` from `@/lib/date` steps the date (DST-safe, which adding 86 400 000 ms is not) and `selectGrooveForDate` answers each one. `lib/puzzle/selectGroove.ts` is read, not changed.
* Assumption: the Q3-A loop stops on coverage and is also capped at `2 * GROOVES.length` days, so a catalogue change can never hang the page. Measured worst case is 58 days against 30 grooves, inside the cap.
* Assumption: one groove sounds at a time, and picking another remounts the player (`key={groove.uuid}`). `useTransport` builds its transport in a `useState` initialiser and never rebuilds it when `source` changes, so a shared player would keep playing the first groove picked.
* Assumption: the lick buttons are three — one per variation of **the groove's own flavour** (`LICK_VARIATIONS = 3` in `src/lib/theory/licks.ts`), not a twelve-mode grid. What needs verifying is whether the groove's own mode sounds right over it.
* Assumption: "in time" needs nothing new. `useTransport(...).clock` handed to `useModeLick` as `clock` is what `lib/audio/lick.ts` uses to start a phrase on the next beat — the same wiring `GroovePuzzle.tsx` already has.
* Assumption: the page shows the answer openly — name, date, scale, chord, progression, bpm. No puzzle state, no persistence, no streak, no `PuzzleSessionProvider`.
* Assumption: nothing links to it. The URL is typed by hand, so the production surface is unchanged even before Q1's mechanism.
* Under Q1-A, Done-when 1 is checked as "`npm run build` lists no `/dev/grooves` route" — the page file is not compiled as a route at all. The preview *component* still lives in the slice and reaches the production bundle only if the `index.ts` barrel is tree-shaken; `package.json` declares no `sideEffects`, so that is a bundler assumption, not a guarantee. The check is the route list, not bundle bytes.
* No `sam`: this is a page for whoever mints grooves, and `docs/persona.md` is about the player. No `musician` either — nothing under `scripts/grooves/` is touched.

## Answered — Q1-A, Q2-B

* **Q1-A.** `page.dev.tsx` plus a `pageExtensions` list in `next.config.ts` that includes `dev.tsx` only in development. The list stays additive, so every existing `page.tsx` resolves exactly as now, and in a production build `src/app/dev/grooves/` holds no file Next recognises as a page — the folder is not a route. Done-when 1 is checked against `npm run build`'s route list.
* **Q2-B.** One row per day, today through today + 29.
* Re-running §2 against both answers: **unchanged — still shell and audio, two modules.** Neither answer adds a file outside the list above, nothing frozen in `docs/music.md` moves, one revert.
* **Q2-B contradicts Done-when 2's "lists every groove in the catalogue", and the gap is bigger than it sounds.** `orderFor` in `lib/puzzle/selectGroove.ts` reshuffles the whole catalogue at every lap of 30 days, so a 30-day window that straddles a lap boundary is not a permutation. Measured over 365 start days against the shipped 30-groove manifest: the window shows **all 30 grooves on 12 days of the year**, and on the other 353 it repeats some and omits **5.1 on average, up to 11**. Today's window (2026-09-06) shows 28 of the 30 and omits 2. That is what Q3 is for.

## Open questions — round 2

### Q3. Under Q2-B the next 30 days are not the 30 grooves. Which half gives?

- [x] A) Keep one row per day and stop at coverage rather than at 30 — run from today until every groove has appeared *(recommended — engineering reason, no persona bearing: the only option that keeps both halves of Done-when 2 with one list and no second concept. Measured: 30 to 58 rows, 43 typical; a groove that comes up twice inside that span gets two rows, which is what "one row per day" means.)*
- [ ] B) Fix the window at 30 days and drop "every groove in the catalogue" from Done-when 2 — the page becomes a schedule of what is coming, not a catalogue audit. `## Done when` is yours, so this option is a request that you edit it.
- [ ] C) 30 dated rows, then a second block — "not in the next 30 days" — listing the omitted grooves with the next date each comes up. Every groove stays listenable and the window stays a month, at the cost of two lists and two row shapes in one component.

## Answered — Q3-A

* **Q3-A.** One row per day, starting today, running until every groove in `GROOVES` has appeared rather than stopping at 30. Both halves of Done-when 2 hold: every groove is listed, and the list is in date order with a date on every row. A groove that comes up twice inside the span gets two rows — that is what one-row-per-day means, and on a dev page it is a feature: it shows the repeat.
* Re-running §2 against all three answers: **passes, at the edge on question 1.** Two modules — shell (`src/app/dev/grooves/page.dev.tsx`, `components/dev/GroovePreview.tsx`, `index.ts`) and audio (`hooks/useModeLick.ts`). Nothing frozen in `docs/music.md` moves. One revert.
* Nothing is left open. The list length is data-dependent (30 to 58 rows, 43 typical), so the component's test asserts coverage — every uuid in `GROOVES` appears at least once and the dates ascend — rather than a row count.
