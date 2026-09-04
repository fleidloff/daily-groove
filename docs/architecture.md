# Architecture

This document holds the model and the reasoning: how the tree is shaped and why.
The rules that follow from it — what you may import from where, where a file
goes, what a linter will reject — live in one place:

**[coding-guidelines.md](coding-guidelines.md)** — the concrete rulebook, every
rule tagged *lint-enforced* or *human-checked* and named after the file that
motivated it. Read that before writing code.

See also [testing.md](testing.md) for what must be tested.

## The model

The app is built as vertical feature slices. Two directories carry the weight:

- `src/components` — the design system: generic, reusable building blocks.
- `src/features/<feature>` — one self-contained feature per folder.

Everything else is glue: `src/app` for routing, `src/lib` for the small set of
code the app and the groove generator under `scripts/` must both run.

A feature owns everything it needs in one folder — its UI, its hooks, its state,
its generated data and its business logic — and exposes one public surface,
`index.ts`. Its tests live inside it. The point of the shape is that a slice is a
unit you can reason about, hand to someone else, or delete, without tracing it
through the rest of the app.

The design system is the other half of that bargain. Its components are reusable
*by construction*: driven by props, holding no app state, knowing no domain
concept. A primitive that has learned about grooves is no longer a primitive, and
the feature it learned about is no longer removable.

## Why the dependency direction is the load-bearing part

Almost every rule in the guidelines is one arrow in a graph the app is allowed to
draw. The direction is what makes the slices work:

- The design system may use shared utilities, but never a feature. That one-way
  dependency is what keeps it reusable.
- Features do not reach each other. There is no sideways arrow, so anything two
  slices need moves *up* into `src/lib` or `src/components` rather than making
  one slice a dependency of the other.
- `src/lib` is a leaf — it imports nothing from the app. That is not tidiness: it
  is exactly what lets the groove generator under `scripts/` import it by
  relative path with no bundler and no `@/` alias in play.

The guidelines draw the full graph and name the ESLint zone behind each arrow.

## The arrows inside a slice

The graph above is between directories. Inside `src/features/daily-groove/`
there is a second graph that the directories do not show, and until feature-20 it
existed only in the head of whoever was reading every diff. A worker dispatched
at one concern had nothing telling it what that concern may reach.

The slice separates six concerns, and they are not the same thing as its folders:

| Module | What is in it |
| :-- | :-- |
| **catalogue** | `scripts/grooves/`, and the two manifests it writes: `src/features/daily-groove/data/grooves.generated.ts` and `data/notes.generated.ts` |
| **theory** | `src/lib/theory/` — eighteen modules, of which the generator imports `names.ts`, `roots.ts` and `scales.ts` |
| **audio** | `lib/audio/`, plus the three hooks that drive playback: `hooks/useTransport.ts`, `hooks/useReferenceNote.ts`, `hooks/useModeLick.ts` |
| **puzzle** | `lib/puzzle/`, `lib/persistence/`, `state/`, plus the four hooks that carry the session and the settings: `hooks/usePuzzleSession.ts`, `hooks/useProgress.ts`, `hooks/useSimpleMode.ts`, `hooks/useTapSounds.ts` |
| **coaching** | `lib/presentation/` — eleven modules behind one `index.ts` |
| **shell** | `components/` — the composer `GroovePuzzle.tsx` and the four regions `header/`, `intro/`, `puzzle/`, `solved/` — plus the two routes under `src/app/`, and `lib/share/`, whose two modules exist only to build those routes' URLs and hand one to the browser |

Four things sit in no module, and say so rather than being filed somewhere they
do not belong. `src/lib/groove.ts`, `hash.ts`, `date.ts` and `branding.ts` sit
*below* all six: the shared type contract, the frozen hash, the date helpers and
the app's name. `groove.ts` and `hash.ts` are imported by both halves of the
app/generator boundary; `date.ts` and `branding.ts` are the app's alone, and
appear under `scripts/` only as tier-routing path strings. Either way an arrow
from one module would misdescribe them. Inside the slice, `types.ts` is the
vocabulary: it re-exports the five types in `src/lib/groove.ts` and adds
`DailyResult`, so every module imports it and an arrow to it would say nothing.
`index.ts` is the slice's public surface, which is the *outside* graph's
business. `testing/` is scaffolding —
`fakeAudioContext.ts` doubles audio, `puzzleHarness.tsx` and `renderFeature.tsx`
render the shell — so it reaches the shell, audio, puzzle, theory and catalogue
on purpose, and it is not part of the running app.

`lib/share/` is the one folder whose module membership is a judgement rather
than a reading of its imports. It is filed under the shell because that is what
it serves: `url.ts` builds the route's link and `share.ts` hands it to the share
sheet, and its only two consumers are `components/header/ShareGroove.tsx` and the
slice's `index.ts`. Between them its two production modules import one thing,
`../../types`, and no module imports them, so `share/` draws no arrow into or
out of the other five — which is also why zones 7 and 8 say nothing about it,
and a `lib/share/ → coaching` import would pass lint today. Zone 6 does bind it,
since that zone's target is the whole of `lib/`.

**The map is how a reader groups the code; a door is what an import rule can
check; and only one module has a door.** The two do not line up, and that is not
a defect waiting to be fixed. `coaching` happens to be exactly one folder, so
`lib/presentation/index.ts` is both its door and the whole module. `puzzle`
spans three folders and four hooks; `audio` reaches outside `lib/audio/` for
three more; `catalogue` straddles `scripts/` and `data/`. A door can only ever be
one folder's `index.ts`, so those modules could not have one even if they wanted
it. Theory, audio, puzzle and persistence have no `index.ts` at all today, and
the shell imports their modules directly —
[coding-guidelines.md](coding-guidelines.md#feature-slices) says on what terms a
folder earns a door.

### The arrows the tree draws

Each line has at least one import behind it, and names a file so the line can be
re-measured rather than believed.

- **catalogue → theory**, from both of its halves. From the generator: every
  import specifier under `scripts/grooves/` that names `src/lib/` names one of
  five files — `theory/names.ts`, `theory/roots.ts`, `theory/scales.ts`,
  `groove.ts` and `hash.ts` — by relative, extension-bearing path, because the
  generator resolves no `@/` alias. Two of those five are in no module, so the
  arrow's label is broader than the module it points at; the generator's whole
  crossing is those five files, not `theory/` as such. From the manifests:
  `data/grooves.generated.test.ts` reaches eight modules under `@/lib/theory/` —
  `changes`, `families`, `music`, `names`, `notes`, `numerals`, `roots`,
  `staff` — and
  `data/notes.generated.test.ts` reaches `roots`, checking the shipped data
  against the tables it was rendered from. (Path *strings* are a separate
  matter: `scripts/tiers.test.ts` names other `src/lib/` files as tier-routing
  data, and `scripts/grooves/boundary.test.ts` is what keeps a string from
  becoming a dependency.) Going the other way, catalogue writes the two manifests
  that the shell, audio, puzzle and coaching read.
- **catalogue → puzzle**, one edge, and it is worth naming rather than rounding
  away: `data/grooves.generated.test.ts` imports `../lib/puzzle/selectGroove` to
  assert the shipped manifest against the selector that reads it. It is the only
  arrow in this map drawn by a single import, and by a test rather than by
  production code.
- **theory → nothing in the app.** `src/lib/theory/` imports its own siblings and
  `../groove`, `../date`, `../hash`. That is the leaf property the generator
  depends on.
- **audio → theory** — `scheduleLick` in `hooks/useModeLick.ts` and the
  `ScheduledNote` type in `lib/audio/lick.ts`, both from `@/lib/theory/phrase`.
  **audio → catalogue** — the sampled pitches, in `lib/audio/lick.ts`,
  `lib/audio/reference.ts` and two of the hooks.
- **puzzle → theory** — `lib/puzzle/selectGroove.ts` and `narrowing.ts` reach
  `@/lib/theory/options`, `scoring.ts` reaches `families`,
  `hooks/usePuzzleSession.ts` reaches `music`, and
  `lib/persistence/preferences.ts` and `hooks/useWritten.ts` reach `transpose`.
  **puzzle → catalogue** —
  `lib/puzzle/grooveByUuid.ts` and `isTodaysGroove.ts` read `GROOVES`.
- **coaching → theory** — `lib/presentation/index.ts` reaches `roots`,
  `families`, `music` and `transpose`; `date.ts` reaches `transpose`;
  `nearMiss.ts` reaches `families`, `difference` and
  `scales`. **coaching → puzzle** — `lib/presentation/ruledOut.ts` reaches
  `../puzzle/narrowing`. **coaching → catalogue** — `index.ts` reads `GROOVES`.
- **shell → every other module.** Coaching through the door from
  `GroovePuzzle.tsx` and `components/puzzle/GuessCard.tsx`; the rest directly, as
  `GroovePuzzle.tsx`'s own imports show — three into `lib/audio/`, one each into
  `lib/puzzle/` and `lib/persistence/`, five into `@/lib/theory/`, and both
  manifests. The shell also imports the design system, which none of the other
  five does.

And what points *at* a module matters as much:

- **Nothing outside `components/` imports the shell** except the slice's
  `index.ts`, which re-exports `GroovePuzzle` as the public surface, and the two
  test helpers that render it — `testing/renderFeature.tsx` statically and
  `testing/puzzleHarness.tsx` through a dynamic `import`. Inside `components/`,
  where every import is intra-shell, the composer's own five `GroovePuzzle.*.test.tsx`
  files import it, and one region test reaches up to it:
  `components/puzzle/GuessCard.test.tsx`, which asserts the card through the
  composed page rather than in isolation.
- **Coaching is imported by the shell and by nothing else.** Five production
  files: `GroovePuzzle.tsx` and `components/puzzle/GuessCard.tsx` through the
  door, `components/puzzle/FeedbackLine.tsx` and `components/puzzle/NudgeBox.tsx`
  for the `Feedback` and `FeedbackTone` types, and
  `components/solved/SolvedPanel.tsx` for `selectNearMiss` and `staffLabel`. Six
  test files under `components/` import `lib/presentation/` modules directly as
  well, and they are consumers exactly as the source is — the boundaries bind
  them the same way. The region components a module feeds are consumers of it
  too, which is why the entry-point rule binds the composer and not the whole
  slice.
- **Audio is imported by the shell and by `testing/fakeAudioContext.ts`.** Its
  three hooks are inside it, not consumers of it.
- **The design system imports none of the six.** That is zone 1, and it is the
  arrow that keeps `src/components/` reusable.

### What is not drawn, and what holds it

| Not drawn | What stops it |
| :-- | :-- |
| a `lib/` module → the design system, the shell, `hooks/` or `state/` | zone 6 — business logic does not depend on what renders it |
| `lib/audio/` → coaching, `lib/audio/` → puzzle | zone 7 |
| `lib/puzzle/` or `lib/persistence/` → coaching or audio | zone 8 |
| the design system → any module | zone 1 |
| `src/lib/theory/` → anything in the app | zone 4 |
| catalogue → any module, **from `scripts/grooves/`** | zone 5, plus the string scan in `scripts/grooves/boundary.test.ts`. Stricter than zone 2: the generator may not reach a slice even through its `index.ts` |
| catalogue → any module, **from `data/`** | **nothing. Review only.** Zone 5's target is `scripts/`, and `data/` is in no zone at all: a coaching import added to `data/notes.generated.ts` produces zero lint errors. What limits the exposure is not a rule — the two manifests are generated and never hand-edited, so the only files here anyone writes are their tests, and one of those already draws `catalogue → puzzle` |
| a route → anything deeper than the slice's `index.ts` | `src/app/route-boundary.test.ts` |
| `GroovePuzzle.tsx` → a module inside `lib/presentation/` | `src/features/daily-groove/structure.test.ts` |
| a module's *hooks* → another module | **nothing. Review only.** Zones 7 and 8 have `lib/` on both sides; the seven hooks the map files under audio and puzzle are named by no zone |
| `lib/share/` → coaching, audio or puzzle | **nothing. Review only.** Zones 7 and 8 name the four concern folders they bind, and `share/` is not one of them |
| **`GroovePuzzle.tsx` → a module inside `lib/audio/`, `lib/puzzle/`, `lib/persistence/` or `src/lib/theory/`** | **nothing. Review only.** |

**Four of those rows say "review only", and the count is the point.** A guard
that follows measured growth leaves everything that has not grown unguarded, and
naming which four is the difference between a scope and an oversight. The last
row is the one that cost the most to accept. `lib/presentation/` earned its door
by growing from two modules to eleven while the composer's imports into it went
2 → 3 → 4 → 6 over the four releases since feature-12, never once down. The
other four folders' counts have been flat or come back down: audio spiked to
five once and settled at three, and puzzle and persistence have sat at one since
feature-12. So a regrowth in those four is caught by review alone — which is
what failed the two previous times `GroovePuzzle.tsx` was cut and grew back.
Adding a door later is one `index.ts` and one entry in the guard's ignore list.

The `data/` row is the one to re-read first if this map is ever extended,
because it is unguarded for a different reason: not a folder that has not grown,
but a module whose two halves the zones were never written to span.

**The map describes the tree, not the other way round.** If a module here does
not survive contact with a lint zone, a guard or a folder that moved, this
section is what changes. A map that has drifted from the import graph is worse
than no map, because it is believed.

## Every feature must be removable

This is the standard the shape exists to serve:

> Delete `src/features/<feature>/`, delete its route folder under `src/app`,
> remove its one registration entry — and the app still builds and runs.

Removability is a test of coupling, not a plan to delete anything. A feature
whose internals have leaked into the route, into the design system, or into a
sibling cannot be moved, rewritten or replaced in one step either — deletion is
just the cheapest way to notice.

What keeps it true: a feature's inbound references are countable on one hand —
its route(s) in `src/app`, and, where it must appear in shared UI, a single
registration point such as a nav entry. Its state, its types and its styles stay
inside the folder. Its consumers, tests included, know only its `index.ts`.

Before merging a feature, ask: could I `rm -rf` this folder and still get a clean
build? If not, something leaked, and the guidelines will name what.
