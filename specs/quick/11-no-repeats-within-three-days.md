# 11 — No repeats within three days

## What

* Change the order upcoming grooves are played in.
* Within three days, no mode repeats.
* Within three days, no root repeats.
* Within three days, no style repeats.
* Add the style / template to `grooves.generated.ts`, so the style constraint has data to read.

## Done when

* Over any three consecutive days in the rota, no two grooves share a mode.
* Over any three consecutive days, no two grooves share a root.
* Over any three consecutive days, no two grooves share a style.
* Every entry in `GROOVES` carries its style.
* A test walks a long run of consecutive days and finds no violation.

## Open questions

_None._

## Answered — Q1-A, Q2-A, Q3-D (re-opened as Q5), Q4-A, Q5-A

### Q1. What does "within three days" mean?

- [x] A) Any three consecutive days — each day's groove differs from the **two** before it
- [ ] B) Three clear days between repeats — each day's groove differs from the **three** before it

Follows: a two-day lookback. The original "~100 steps" note was a first-fit
search with no seam prefix; with the prefix that same search needs 4.17 M steps
over 440 laps and leaves 15 laps unsolvable. A most-abundant-attribute-first
greedy solves all 440 with **no backtracking at all** — exactly 48 steps a lap.
The cheapness is the heuristic, not a loose constraint.

### Q2. How does the style reach `Groove`?

- [x] A) Optional — `style?: string` on `Groove` in `src/lib/groove.ts`, written by the generator for every real groove
- [ ] B) Required — `style: string`

Follows: every hand-made `Groove` fixture keeps compiling, so the diff stays in
catalogue and puzzle. It also decides what a missing style means — see the
assumptions.

### Q3. How far back does the lap chain reach?

- [ ] A) Chain from lap 0, memoised per (groove set, epoch)
- [ ] B) Fixed depth 8
- [ ] C) Each lap independent
- [x] D) Move the whole rota to build time — a generated order table instead of a runtime function

Ticked, then re-opened as Q5 because two figures in the option texts were wrong,
and both of them argued for D.

### Q4. Does `ROTA_EPOCH` bump to 3?

- [x] A) Bump 2 → 3
- [ ] B) Leave it at 2, and rewrite the goldens' comment

Follows, and it settles something the earlier round left ambiguous: **the two
golden sweeps move for certain.** The epoch is part of the shuffle seed, so
`SWEEP_OVER_THREE` and `SWEEP_OVER_SIXTEEN` are regenerated whatever the rota
does — exactly the contract their comment states. Also
`expect(ROTA_EPOCH).toBe(2)` in two places becomes 3, and the AC1 test that
compares epoch 1 against 2 wants 2 against 3.

### Q5. Two numbers in Q3 were wrong, and both argued for D. Does D still stand?

- [x] A) Revert to Q3-A — the runtime chain from lap 0, memoised
- [ ] B) Keep D, as a seam table
- [ ] C) Keep D, as a full order table
- [ ] D) Keep D as ticked and waive the corrections

Follows: no new generated artefact, `scripts/grooves/boundary.test.ts` keeps its
`toHaveLength(2)`, no horizon, no lock entry, and one code path rather than two.
The rota stays a function of the lap number.

The two corrections, kept on the record because the ticket was steered by them:
D never failed size-test question 2 — catalogue was already in the diff for the
style field, so D was catalogue + puzzle, the same two modules as A. And the
runtime chain costs **8.7 ms**, not the 67 ms first reported; that figure came
from a prototype using object maps and a per-position array spread.

## Notes

* Size test: **passes**.
  1. Five bullets: yes — one field through the manifest, one constrained order, tests.
  2. Two modules: **catalogue** (`scripts/grooves/cli.ts`, `manifest.ts`, `data/grooves.generated.ts`) and **puzzle** (`lib/puzzle/selectGroove.ts`). `src/lib/groove.ts` is in no module — architecture.md puts it below all six.
  3. Frozen things untouched: no audio is re-encoded, `hash.ts`, the `events` draw order, `FLAVOURS` and the uuids are all unread. `ROTA_EPOCH` is explicitly *not* one of the frozen four — music.md lists it under "what deliberately may", and bumping it "re-renders nothing and reassigns no answer". A date already played keeps its groove: `lib/puzzle/dailyGroove.ts` resolves it from the stored pin.
  4. One revert: yes.
* **The seam is the whole of the difficulty.** The constraint looks two days back, so a lap's first two days must clear the previous lap's last two — that lap's *result*, not its seed. Today's `orderFor` needs only the previous seed, which is why this is not the one-line swap the first pass called it. The greedy pass itself is the easy part.
* Measured on the shipped catalogue (48 grooves, 11 roots, 12 modes, 9 styles), tight implementation, seeds under epoch 3: the chain from lap 0 gives **0 violations over 21 120 days (~57 years)** and **0 unsolved laps**, costing 8.7 ms to resolve today's lap 431 and 15.4 ms at lap 1000 (~year 2100). The two rejected shapes, for the record: fixed depth 8 gave 2 violations per 9 600 days, independent laps gave 144.
* Files expected to change:
  * `src/lib/groove.ts` — `style?: string` on `Groove`.
  * `scripts/grooves/cli.ts` — `toGroove` already receives the `GrooveSpec`, so the style is `spec.template`, one line.
  * `scripts/grooves/manifest.ts` — one entry in `FIELDS`; `renderEntry` already omits an undefined field.
  * `src/features/daily-groove/data/grooves.generated.ts` — re-rendered.
  * `src/features/daily-groove/lib/puzzle/selectGroove.ts` — `ROTA_EPOCH` to 3, and `orderFor` becomes the chained constrained order plus the memo.
  * `scripts/grooves/grooves.lock.json` — new `manifestSha256`.
* Tests expected to change: `selectGroove.test.ts` (epoch, both goldens, new rota assertions, a fixture with a spread of attributes), `manifest.test.ts` (the field list), `data/grooves.generated.test.ts` (every entry carries a style the catalogue names as a template).
* **The sweep fixtures exercise none of this.** `sweepGroove` gives every groove `root: 'C'` and `flavour: 'Minor'`, so no candidate is ever legal and the fallback fires on every lap of both goldens. The constraint needs its own fixture with a spread of roots, modes and styles, or it ships untested.
* **The memo has to be incremental**, extending from the highest lap already computed rather than chaining from 0 on each call. `selectGroove.test.ts` walks 5 000 consecutive days at `SEAM_SPAN` and resolves `2099-01-01`, which is lap ~15 700 for a 3-groove set; recomputing from 0 each time turns those loops quadratic in the lap count.
* Assumptions taken rather than asked:
  * A missing `style` is **no constraint**, not a shared one — otherwise two style-less fixtures would read as a repeat. Every real groove has one, so this only shapes fixtures.
  * When no candidate is legal, the lap falls back to today's `orderFor` body — plain seeded shuffle plus its one-groove seam swap — rather than throwing. This runs in the browser on every load. Never fires on the shipped catalogue. The existing early returns for `lap === 0`, `size < 2` and `size === 2` stay: `selectGroove.test.ts` asserts a one-groove set returns that groove every day.
  * The candidate order within a lap is the seeded shuffle, and the pick among legal candidates is the one whose root, mode and style are most abundant among those not yet placed. That heuristic is what removes backtracking; a plain first-fit does not solve the shipped catalogue.
  * The field is called `style` and its value is the template id as written in `catalogue.json` — `'straight-funk'`, not a display name. Nothing renders it today.
  * Re-render is `npm run grooves -- --manifest-only`, so every mp3 keeps its hash and only the manifest hash moves in the lock — the same shape quick ticket 1 used.
  * The memo keys on the groove set and the epoch, because `orderFor` is called with 60-, 16- and 3-groove fixtures under epochs 1, 2 and 3.
* Distribution, for whoever re-checks the numbers: 48 grooves, 11 roots (max 8 × `E`), 12 modes (max 6), 9 styles (max 6 — `open-ballad` has only 2).
* `scripts/grooves/catalogue.json` carries `template` per groove but no root or mode — those are derived at render time, which is why the style travels through `toGroove` rather than being read from the catalogue by the app.

## Built

* `src/lib/groove.ts` — `style?: string` on `Groove`.
* `scripts/grooves/cli.ts` — `toGroove` carries `spec.template` onto the entry.
* `scripts/grooves/manifest.ts` — `'style'` in `FIELDS`, rendered between `flavour` and `bars`.
* `src/features/daily-groove/data/grooves.generated.ts` — re-rendered with `npm run grooves -- --manifest-only`; all 48 entries carry a style.
* `scripts/grooves/grooves.lock.json` — only `manifestSha256` moved. `catalogueSha256` and every mp3 hash unchanged.
* `src/features/daily-groove/lib/puzzle/selectGroove.ts` — `ROTA_EPOCH` 2 → 3. `orderFor` builds each lap by placing the most abundant legal candidate, chained from lap 0 through each lap's last two grooves, memoised per (groove set, epoch) and extended in place. Roots, modes and styles are encoded to integers once per catalogue and counted in `Int32Array`s. Falls back to the old unconstrained order for any lap where no candidate is legal.
* tests: `selectGroove.test.ts` — epoch expectations, both golden sweeps regenerated, and a `no repeats within three days (quick 11)` block on a new `variedGrooves` fixture (6 roots × 6 modes × 4 styles over 24 grooves), covering the constraint over 2 000 consecutive days, every lap seam across 5 000 days, once-per-lap, the missing-style case and the revisit branch of `orderFor`. `data/grooves.generated.test.ts` — style typed and matched against each groove's `template` in `catalogue.json`, plus a 2 000-day sweep over the real `GROOVES`. `scripts/grooves/manifest.test.ts` and `cli.test.ts` — the generator's two producers of the field.
* checks: lint 0 · `npm test` 145 files / 3035 tests · `npm run test:gen` 51 files / 1456 tests · build 0, `prebuild` groove verify clean.
* verifier: **pass** — every `## Done when` bullet **done**.
  * D1/D2/D3 — no root, mode or style repeat within three days: `data/grooves.generated.test.ts` › `never repeats a root, mode or style within three days of the rota (quick 11)`, over 2 000 real days. Independently swept to lap 1200 (57 648 days, ~year 2127): 0 clashes, 0 incomplete laps, no lap ever fell back.
  * D4 — every entry carries its style: `data/grooves.generated.test.ts` › `gives every entry the style of the template it was rendered from (quick 11)`, all 48 checked against `catalogue.json`.
  * D5 — a long run finds no violation: the same sweep, plus `selectGroove.test.ts` › `repeats no root, mode or style over a long run of consecutive days (D1, D2, D3)`. Shown non-vacuous: with `conflicts()` short-circuited, 10 tests go red.
* The goldens were regenerated because the epoch moved, which is the contract their own comment states. They pin the *fallback*, not the constraint: both sweep fixtures are uniform, so no candidate is ever legal on them. The verifier reproduced both literals character for character by running the pre-change `orderFor` at epoch 3.
* Cost of the chain, measured cold on the shipped catalogue: 5.8 ms at today's lap 431, 13.5 ms at lap 1000, then 0.013 ms per further lap. The ticket's estimate was 8.7 ms — the first implementation missed it by 7.5×, and the integer encoding is what closed the gap.

### Follow-ups, not built

* **`bright-straight` and `bossa-nova` can sit on consecutive days and still sound alike.** They overlap at 122–132 bpm, both straight eighths with a hat pulse and a rim, and their flavour sets overlap on both of bright-straight's modes — so neither the mode nor the style rule can separate them. The `musician`'s reading is that the arrangement still parts them (bossa's fixed clave, its −16 dB snare, its surdo kick, no toms or open hat) but that the adjacency is real. The fix would be rota-level — never those two on consecutive days — not a change to either template.
* **`open-ballad` is 2 grooves in 48**, so the 62–80 bpm band rests on `half-time` alone and a player sees a ballad about every 24 days. Minting three or four more would even the styles out. That re-renders nothing already committed but is a mint, so it belongs in a feature.
* **`orderFor` returns the memoised array by reference.** No live bug — only `selectGrooveForDate` and the tests call it — but a caller that sorted the result in place would corrupt the chain.
