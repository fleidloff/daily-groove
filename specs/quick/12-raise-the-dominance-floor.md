# 12 — Raise the dominance floor

## What

* Raise the dominance guard's floor by minting more `open-ballad` grooves, instead of widening `DOMINANCE_RATIO` again.
* The floor is `lydian-dominant` at 1 groove, offered by `open-ballad` alone, which ships 2 — so every new style pushes the commonest mode up while the floor stays put. The ratio went 5 → 6 during feature-25.
* How many `open-ballad` grooves to mint is open; the count is what sets the new floor.
* Whether `DOMINANCE_RATIO` tightens again afterwards is open — a higher floor could either buy headroom at 6 or let the guard come back down.
* `DOMINANCE_RATIO` lives in three files and they must stay in step: `scripts/grooves/catalogue.test.ts`, `scripts/grooves/manifest.test.ts`, `src/features/daily-groove/data/grooves.generated.test.ts`.
* Minting changes the catalogue length, which reshuffles the rota, so this bumps `ROTA_EPOCH` per the rule in `docs/music.md`.
* The guard is a guard against one mode swallowing the catalogue, not a coverage target — asked directly, Sam's answer was "I can't feel a ratio. I can feel a repeat."

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* `catalogue.json` holds more `open-ballad` grooves than the two it ships today, and every new one passes all seven gate checks.
* The measured dominance spread is recorded, and all three `DOMINANCE_RATIO` copies agree with each other.
* `ROTA_EPOCH` is bumped, and `src/lib/hash.ts` and its fixed table are untouched.
* No existing groove re-renders: `node scripts/grooves/rerender-check.ts` stage 4 reports 0 changed, and `npm run grooves:verify` is clean.
* The uuid freeze tables in `scripts/grooves/uuidFreeze.test.ts` and `src/features/daily-groove/data/uuidFreeze.test.ts` carry the new grooves.
* The new grooves are heard and signed off before the ticket is called done.
