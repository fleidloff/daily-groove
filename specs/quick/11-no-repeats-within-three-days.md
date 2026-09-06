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

### Q1. What does "within three days" mean?

- [ ] A) Any three consecutive days — each day's groove differs from the **two** before it *(recommended — measured on the shipped catalogue: a first-fit backtracking shuffle over all 48 grooves solved 20 of 20 seeds in ~100 steps, so the rota stays a cheap deterministic function with no relaxation rule)*
- [ ] B) Three clear days between repeats — each day's groove differs from the **three** before it. Measured the same way: 5 of 20 seeds blew a 200 000-step budget, because 48 grooves carry only 11 roots, 12 modes and 9 styles. Buildable, but it needs a documented relaxation rule for when no candidate fits, and the rota stops being a function you can read in one go

### Q2. How does the style reach `Groove`?

- [ ] A) Optional — `style?: string` on `Groove` in `src/lib/groove.ts`, written by the generator for every real groove *(recommended — every hand-made `Groove` fixture in the suite keeps compiling, so the change stays inside catalogue and puzzle)*
- [ ] B) Required — `style: string`. Cleaner contract, but 15+ test fixtures under `components/`, `hooks/` and `lib/audio/` have to gain the field, which pulls the shell and audio into the diff and fails size-test question 2

## Notes

* Size test: **passes**, on the recommended options.
  1. Five bullets: yes — one field through the manifest, one constrained shuffle, tests.
  2. Two modules: **catalogue** (`scripts/grooves/cli.ts`, `manifest.ts`, `data/grooves.generated.ts`) and **puzzle** (`lib/puzzle/selectGroove.ts`). `src/lib/groove.ts` is in no module — architecture.md puts it below all six. Q2-B would add shell and audio and fail this.
  3. Frozen things untouched: no audio is re-encoded, `hash.ts`, the `events` draw order, `FLAVOURS` and the uuids are all unread by this change. A date already played keeps its groove — `lib/puzzle/dailyGroove.ts` resolves it from the stored pin, not from the rota.
  4. One revert: yes.
* Files expected to change:
  * `src/lib/groove.ts` — the new field on the `Groove` type.
  * `scripts/grooves/cli.ts` — `toGroove` already receives the `GrooveSpec`, so the style is `spec.template`, one line.
  * `scripts/grooves/manifest.ts` — one entry in `FIELDS`; `renderEntry` already omits an undefined field.
  * `src/features/daily-groove/data/grooves.generated.ts` — re-rendered.
  * `src/features/daily-groove/lib/puzzle/selectGroove.ts` — `orderFor` becomes a constrained shuffle.
  * `scripts/grooves/grooves.lock.json` — new `manifestSha256`.
* Tests expected to change: `selectGroove.test.ts` (new rota assertions; its three-groove fixture is too small to exercise the constraint and needs a wider one), `manifest.test.ts` (the field list), `data/grooves.generated.test.ts` (every entry carries a style that is a template the catalogue names).
* Assumptions taken rather than asked:
  * The field is called `style` and its value is the template id as written in `catalogue.json` — `'straight-funk'`, not a display name. Nothing renders it today.
  * `ROTA_EPOCH` is **not** bumped. Changing `orderFor` remaps every unplayed date on its own, and music.md ties the bump to a release that mints grooves; this one mints none.
  * Re-render is `npm run grooves -- --manifest-only`, so every mp3 keeps its hash and only the manifest hash moves in the lock — the same shape quick ticket 1 used.
  * The lap seam counts: the first day of a lap is checked against the last days of the one before. `orderFor` already computes the previous lap's order for its existing seam fix, so no new state is needed.
  * If a future catalogue ever makes the constraint unsatisfiable, the lap falls back to the plain seeded shuffle rather than throwing — this runs in the browser on every load.
* The distribution measured today, for whoever re-checks the feasibility claim: 48 grooves, 11 roots (max 8 × `E`), 12 modes (max 6), 9 styles (max 6).
* `scripts/grooves/catalogue.json` carries `template` per groove but no root or mode — those are derived at render time, which is why the style has to travel through `toGroove` rather than being read from the catalogue by the app.
