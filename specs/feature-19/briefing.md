* modularise the architecture so features can be developed independently — every feature so far has landed in `daily-groove`, so the parallelism the slice shape promises never fires
* not microservices — there is nothing to split at runtime: one static Next.js deploy, a build-time catalogue, all state in `localStorage`. what is wanted is module boundaries with frozen contracts inside the one repo
* no behaviour change — the app does the same thing afterwards
* the modules that are already real, and should be named as such: catalogue (`scripts/grooves/` + the generated manifests), audio (`lib/audio/` + its hooks), theory, puzzle (`state/`, `lib/puzzle/`, `lib/persistence/`), coaching (`lib/presentation/`), shell (`GroovePuzzle` + the routes)
* move the music theory into `src/lib/theory/` so the generator and the app share one body — `scripts/grooves/theory/` (scales, pitches, harmony, validity) and `src/features/daily-groove/lib/theory/` (naming, degrees, staff, licks) are the same domain either side of a wall, sharing only the 32 lines of types in `src/lib/groove.ts`
* the boundary already permits it — `src/lib/` is a leaf the generator may import by relative path, it is just nearly empty
* anything needing both sides pays double today — feature-11's real notes and feature-16's licks both did
* give the coaching modules one entry point — attempts and settings in, view model out. `lib/presentation/` is nine modules and growing, and it is where features keep landing
* let `GuessCard` call that entry point directly instead of receiving the view model as props
* `GroovePuzzle.tsx` is the serialization point — 9 of the last 40 commits, 395 lines, 25 imports, 28 props drilled into `GuessCard`
* more extraction into `hooks/` is not the fix — feature-14 already split it that way and it grew back
* a module boundary only the parent may cross is not a boundary
* the three moves are independently useful and go in order: theory, then the coaching entry point, then `GroovePuzzle` stops being a prop bus
* no second `features/` slice yet — wait for a screen that isn't the puzzle. a slice for its own sake is just a folder
* feature-18 is in progress and owns the new files under `lib/presentation/` — the coaching move lands on top of it, so it goes after 18 is merged
