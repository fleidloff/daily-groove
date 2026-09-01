# PRD — Epic 2: The puzzle's tests stop being one file

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`GroovePuzzle.test.tsx` is 3111 lines and 119 cases, and it has been edited by
13 of the last 14 feature commits. Because two agents cannot own one file, it is
what turns `/implement-feature`'s parallel waves into a queue. This epic splits
it into several files that can be owned separately, changing no behaviour and
losing no assertion.

## Problem

Feature-12's own run report names the cost plainly: *"The binding constraint was
file ownership, not dependency: `GroovePuzzle.tsx` was wanted by three separate
tracks and `route-boundary.test.ts` by two. Those were serialized rather than
merged into a lost edit."* Seven units went into four waves, two of them
single-worker, against a skill designed for 3–5 concurrent workers.

The file is also 10.2 seconds — 44% of the app tier's entire runtime — in a
single worker thread that nothing else can share.

**The seams are only half there.** Six top-level `describe` blocks exist, but
five of them are the feature-specific ones added since feature-8, covering 64
cases between them. The root block is 55 cases across lines 224–1580 with **no
nested `describe` at all** — a flat list that is 46% of the file and has no
grouping to split along. That block is the actual work of this epic.

| Block | Lines | Cases |
| :-- | :-- | :-- |
| `GroovePuzzle` (flat) | 224–1580 | 55 |
| `through the composed page` | 1580–1627 | 3 |
| `how to play (F8 E3)` | 1627–2313 | 30 |
| `a shared groove (F12 E1)` | 2313–2568 | 8 |
| `sharing the groove (F12 E2)` | 2568–2714 | 6 |
| `the framing on a shared groove (F12 E3)` | 2714–3111 | 17 |

## Scope

- split `GroovePuzzle.test.tsx` into several files, including a grouping for the
  55 flat cases
- give the shared setup one home the new files share
- update the structural tests that pin the current shape

**Out of scope**
- **splitting `GroovePuzzle.tsx` itself.** It stays at 488 lines. This is the one
  briefing bullet the feature does not deliver, and it leaves a known residual:
  the collision that serialized feature-12 was on the *component*, so two tracks
  both editing it will still queue
- any change to what the puzzle renders, does, or persists
- the other churn hotspots — `events.test.ts` (12 commits), `useProgress.ts` (8),
  `GuessCard.test.tsx` (8)
- any structural guard against the file growing back — no file-size test, no
  time budget
- tiering or timing changes, which are Epic 1's

## Requirements

- **R1** — `GroovePuzzle.test.tsx`'s 119 cases are distributed across **four**
  test files: one per screen region — header, intro, puzzle — plus one for the
  page itself. **`GroovePuzzle.test.tsx` does not survive**: every case moves.
- **R2** — No case is deleted, merged, weakened or skipped. The case count across
  the new files equals 119, and every assertion is the one it was before.
- **R3** — Every relocated case keeps its subject. Per `docs/testing.md`, moving
  a case to the file that owns it is a move; rewriting it as an isolated render
  with hand-made props is a different assertion wearing the old one's name.
- **R3a** — Setup may be moved to the shared helper or re-expressed to survive
  the move, but each case's arrange-act-assert stays recognisably the one it was.
  Splitting the shared `beforeEach` makes some re-expression unavoidable; what is
  not permitted is a rewrite that changes what the case proves.
- **R4** — Every new file tests behaviour through the feature's public surface,
  not its internals. No new `vi.mock` of an internal path beyond the persistence
  seam the file already mocks.
- **R5** — The shared setup — the hoisted `mockStore`, the `vi.mock` of
  `lib/persistence/storage`, and the fake audio context — has one definition that
  every new file uses, rather than a copy per file.
- **R6** — **The grouping rule is the screen region a case exercises**, mirroring
  the `components/` folders that already exist — `header/`, `intro/`, `puzzle/` —
  which `structure.test.ts` already asserts. The rule is written down where a
  future contributor adding a case will find it.
- **R6a** — **A case that is about the composition rather than a region goes in
  the page file.** Roughly 30 of the 119 are: hydration and storage-failure
  behaviour, the page title's typeface, column stacking, the landmark name, the
  fallback to today's groove, reading a pre-rename store, and the assertions that
  removed features stay removed. None is a `puzzle/` fact, and forcing them into
  a region would leave the next contributor with nowhere obvious to add the next
  one.
- **R6b** — All four files render the composed feature through its public
  surface. They are not tests of a region component in isolation — those already
  exist beside each component (`GrooveHeader.test.tsx`, `GuessCard.test.tsx` and
  the rest) and are untouched by this epic. The distinction has to be legible
  from the filenames, or the two kinds will be confused for each other.
- **R7** — `src/features/daily-groove/structure.test.ts` is updated to match.
  Because `GroovePuzzle.test.tsx` is gone, its
  `expect(existsSync(join(COMPONENTS, 'GroovePuzzle.test.tsx'))).toBe(true)`
  assertion is **rewritten** to require the four files instead — not deleted. The
  rule it stands for, that the root component is tested, still holds; only the
  files that satisfy it change. Its sibling assertion, that `components/` holds
  exactly `['GroovePuzzle.tsx']` as non-test files, already excludes test files
  and needs no change.
- **R8** — Whatever the split produces stays inside
  `src/features/daily-groove/`. The feature remains deletable in one step.
- **R9** — The app tier's total runtime does not increase. Splitting one 10.2s
  file into several that run in parallel should reduce wall clock, but the
  requirement is only that it does not get worse.
- **R10** — The design-system and route boundary tests are untouched and stay
  green: `src/components/structure.test.ts`, `src/app/route-boundary.test.ts`,
  `scripts/grooves/boundary.test.ts`.

## Behaviour details

Nothing in the application changes, so there is no behaviour to specify. The
observable output of this epic is the shape of the test tree and the fact that
the same 119 assertions still hold.

The one non-obvious constraint is `structure.test.ts`. Its
`holds only the root component at the components/ root` case excludes test files
from the file-list assertion, so *adding* test files beside `GroovePuzzle.tsx`
does not trip it. But it separately asserts `GroovePuzzle.test.tsx` exists at
that exact path, which pins the current name. A split that removes that file has
to change that line; a split that keeps it as one of the new files does not.

## Acceptance criteria

- **AC1** (R1) — Given the split, when the feature's component tests are listed,
  then `GroovePuzzle`'s cases sit in four files and no single file holds more
  than half of them.
- **AC2** (R2) — Given the split, when cases are counted across all files
  produced from `GroovePuzzle.test.tsx`, then the total is 119.
- **AC3** (R2) — Given the split, when the app tier runs, then every one of those
  119 passes, and none is marked skipped or todo.
- **AC4** (R3) — Given each relocated case, when its body is compared against the
  original, then the assertions are unchanged. A case whose setup had to change
  to move is called out by name with what changed and why.
- **AC5** (R4) — Given every new file, when its imports are read, then none
  reaches into another slice past `index.ts`, and no internal path is mocked
  beyond `lib/persistence/storage`.
- **AC6** (R5) — Given the shared setup, when it is changed in its one home, then
  every new file picks the change up without further edits.
- **AC7** (R6) — Given the 55 previously-flat cases, when the new files are read,
  then each sits in the file for the region it exercises, and the rule is written
  down where a future contributor will find it.
- **AC7a** (R1) — Given the split, when `components/` is listed, then
  `GroovePuzzle.test.tsx` does not exist and the four new files do.
- **AC7b** (R6a) — Given a case about the composition rather than a region — the
  page hydrating before it paints, say — when the files are read, then it is in
  the page file and not in a region file.
- **AC7c** (R6b) — Given the four files and the existing per-component tests,
  when both are listed, then which kind a file is can be told from its name.
- **AC8** (R7) — Given the split, when `structure.test.ts` runs, then it passes,
  and its rewritten assertion requires all four files rather than
  `GroovePuzzle.test.tsx`.
- **AC8a** (R3a) — Given a case whose setup was re-expressed, when it is compared
  against the original, then it proves the same thing, and the report names it.
- **AC9** (R8) — Given the split, when the feature folder is deleted, then the
  app still builds — the removability standard `docs/architecture.md` sets.
- **AC10** (R9) — Given the split, when the app tier is run before and after,
  then the wall clock after is no greater than before.
- **AC11** (R10) — Given the split, when `structure.test.ts`,
  `route-boundary.test.ts`, `boundary.test.ts` and
  `src/components/structure.test.ts` run, then all pass unchanged except for
  R7's edit.
- **AC12** (R2, R3) — Given the running app, when a full puzzle is played — first
  visit, a wrong guess, a solve, a give-up, and a shared link — then nothing is
  different from before the split. The tests are the proof, and this is the
  cross-check that they were the right tests.

## Dependencies

**Needs:** nothing. Runs in wave 1 alongside Epic 1, which owns
`vitest.config.ts`, `package.json` and the skill files — no overlap with this
epic's `src/features/daily-groove/**`.

**Hands to later features:** separately-ownable test files, which is the point.
Nothing in Epic 1 or Epic 3 depends on this epic.

## Assumptions

- **The four files sit at the `components/` root**, named for the composition
  and the region they cover — `GroovePuzzle.page.test.tsx`,
  `GroovePuzzle.header.test.tsx`, and so on. This is the one call in this PRD
  made without asking, and the reasoning is R6b: all four render the whole
  feature, so putting the header one inside `components/header/` would stand it
  beside `GrooveHeader.test.tsx`, which tests that component in isolation. Two
  files a folder apart doing visibly different things is how the distinction gets
  lost. Exact filenames are `/writespec`'s to settle.

- The new files stay colocated in `components/` and its region folders, as
  `docs/testing.md` requires, rather than moving to a separate test tree.
- `testing/renderFeature.tsx` and `testing/fakeAudioContext.ts` are where shared
  setup belongs — the slice already keeps that kind of helper there, and R5 does
  not require a new location.
- The five feature-specific blocks do **not** move intact under a region rule.
  `how to play (F8 E3)`'s 30 cases are all `intro/`, but
  `the framing on a shared groove (F12 E3)`'s 17 straddle puzzle, header and the
  page itself. Grouping by region cuts across the blocks rather than preserving
  them, which is the cost of choosing subject over history.
- Nothing guards the result. The split file can grow back, and only someone
  measuring again will notice.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth. Append-only.

### Cycle 1 — 2026-09-01

**Q1. What rule groups the 55 flat cases?**
Answer: **A) By screen region**, mirroring the `header/` `intro/` `puzzle/`
folders that already exist and that `structure.test.ts` already asserts — a track
owning a region owns its tests.
Applied to: R1, R6, AC7, Assumptions

**Q2. Does `GroovePuzzle.test.tsx` survive as a file?**
Answer: **B) No** — all cases move to named files, and `structure.test.ts`'s
existence assertion is rewritten to require the region files instead.
Applied to: R1, R7, AC7a, AC8. Opened Q4.

**Q3. How much may a case's setup change to make the move?**
Answer: **A) Setup may be re-expressed; the arrange-act-assert stays
recognisably the same** — splitting the shared `beforeEach` makes some
re-expression unavoidable.
Applied to: R3a, AC8a

### Cycle 2 — 2026-09-01

**Q4. Where do the page-level cases go, now that the root file is gone?**
Answer: **A) A fourth file at the `components/` root, named for the page** —
keeps the region rule clean rather than forcing ~30 composition cases into
regions they are not about, and a new name honours Q2's answer that
`GroovePuzzle.test.tsx` is gone.
Applied to: R1, R6a, R6b, R7, AC1, AC7a, AC7b, AC7c, AC8, Assumptions

Nothing high-impact remains open. The PRD is settled.
