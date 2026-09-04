# 3 — When is the next groove

## What

* After solving or giving up, say when the next groove arrives.
* One line, under the answer. The page still ends at the puzzle.
* Not on a shared groove — that one has its own "back to today" link.
* The moment that prompted it: Sam has solved it, read the lesson, and nothing on
  the page says "come back tomorrow".

## Done when

* Solving today's puzzle shows a line naming when the next groove lands.
* Giving up shows the same line.
* Opening a shared groove and solving it shows no such line.
* A test covers the line's presence in both states and its absence on the shared
  route.

## Open questions

### Q1. Is the line a fixed time or a running countdown?

- [ ] A) Fixed: "Next groove at midnight." *(recommended — engineering reason: the day rolls at the player's local midnight, `isoDate` in `src/lib/date.ts`, and the page does not re-select the groove when midnight passes, so a countdown that reaches zero would sit at "0 min" on a stale puzzle until the tab is reloaded. A fixed phrase is true whenever it is read, and needs no timer.)*
- [x] B) Countdown: "Next groove in 7 h 12 min", ticking once a minute. Closer to the Wordle screen Sam knows, but it pulls in a timer hook and a midnight rollover of the page to stay honest — that second part is the size test's first question starting to wobble.

## Notes

* Size test: **passes.** One module (shell: `SolvedPanel` and the composer that feeds it). The words go in `src/lib/snippets/`, which sits in no module. Nothing frozen touched, one revert.
* Files, option A:
  * `src/lib/snippets/types.ts`, `en/solved.ts` — `solved.nextGroove: string`; one line in `snippets.test.ts`.
  * `src/features/daily-groove/components/solved/SolvedPanel.tsx` — a boolean prop; when set, a fourth muted `Text` in the heading stack, under the mode line, the near-miss line and the heard-in line. `SolvedPanel.test.tsx`: present when the prop is set, absent when it is not, in both the solved and the revealed rendering.
  * `src/features/daily-groove/components/GroovePuzzle.tsx` — passes the prop as `!shared`. `GroovePuzzle.page.test.tsx`: daily solve shows the line, daily give-up shows the line, shared solve shows no line (Done-when 1–4).
* Option B adds `src/lib/date.ts` (time to next local midnight) and a small hook in the shell that re-renders once a minute; and the honest version also re-selects the groove at midnight, which today nothing does.
* Placement reading: the ticket says "under the answer", so the line joins the heading stack of the solved box rather than sitting below the staff. Same muted style as the heard-in line, so the stack reads as one paragraph about today's groove: what it was, where you've heard it, when the next one comes.
* Wording, option A, in `en/solved.ts`: `Next groove at midnight — come back tomorrow.` Change it there if it reads wrong. "Midnight" is the player's own, matching how the day is selected.
* Shared route: `SolvedPanel` already receives nothing route-specific, so the composer decides with the `shared` flag it uses for the notice and the "back to today" link. The panel stays ignorant of routes.
* The "come back every day" step in the how-to-play box stays as it is; this line is the same promise, made at the moment it matters.

## Built
* Option B, the countdown. Size test re-run with the files open: still one module (shell), the timer hook lives beside the other hooks, the date helper in `src/lib/date.ts` sits in no module.
* `src/lib/date.ts` — `nextDayStart(date)`: the local midnight that ends the given day
* `src/lib/snippets/types.ts`, `en/solved.ts` — `solved.nextGrooveIn({ hours, minutes })` ("Next groove in 7 h 12 min", hours dropped when zero) and `solved.nextGrooveReady` ("Today’s groove is ready — reload the page to play it.")
* `src/features/daily-groove/types.ts` — `NextGroove`: `{ ready: true } | { ready: false; hours; minutes }`
* `src/features/daily-groove/hooks/useNextGroove.ts` — counts from the day the puzzle was mounted to its midnight, re-renders on each minute boundary, stops ticking once ready; the hook takes the composer's `today`, so a tab left open past midnight says "ready" rather than counting towards a day it never selected
* `src/features/daily-groove/components/solved/SolvedPanel.tsx` — optional `nextGroove` prop, a fourth muted `Text` under the heard-in line; the ready state swaps the wording
* `src/features/daily-groove/components/GroovePuzzle.tsx` — calls the hook, passes `nextGroove` on the daily route and `undefined` on the shared one
* Honesty at midnight: the page does not re-select the groove on its own, so the line turns into the reload prompt instead of reaching "0 min" and lying. Groove selection is client-side, so a reload is the whole rollover.
* tests: `src/lib/date.test.ts` (+3); `snippets.test.ts` (+4); `hooks/useNextGroove.test.ts` (new, 5: initial count, minute ticks, ready after midnight, ready at once for a past day, timer cleared on unmount); `SolvedPanel.test.tsx` (+4: placement and style under the heard-in line, ready wording, given-up day, none without the prop); `GroovePuzzle.page.test.tsx` (+3: daily solve, daily give-up, shared groove shows none — matched against the snippet for the current minute or the one before, so the test cannot flake on a minute boundary)
* checks: lint — 0 problems / tsc — pass / test — 131 files, 2685 pass / build — pass, `grooves:verify` 30 grooves, 24 notes

## Moved after the first build, from chat
* The line now sits in the groove card, above the tempo line, in the same muted style — not under the answer. `GrooveCard` takes the optional `nextGroove` prop; `SolvedPanel` no longer knows about it; the composer passes it only once the day is solved or given up, and never on a shared groove.
* tests: the four panel tests moved to `GrooveCard.test.tsx` (order against the heading and the tempo line, ready wording, none without the prop); the page suite gained one test that the line is in the card and not in the answer box.
* Wording changed from chat: the countdown reads as a clock, `Next groove in 13:05` — hours unpadded, minutes always two digits.
