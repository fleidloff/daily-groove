# Tech spec — Epic 1: The gate comes back in seconds

PRD: [../prd/epic-1-the-gate-comes-back-in-seconds.md](../prd/epic-1-the-gate-comes-back-in-seconds.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three pieces. The vitest projects already exist and already split app from
generator, so the tiers are a `package.json` change plus a narrowed include
glob — small, and the whole 64-second win lands there. The tier-selection rule
(R6) is the part with real logic, and it goes in a tested module rather than in
skill prose, so the `src/lib/` arm that nobody would predict is enforced by
something rather than remembered. The two skills then call that module and
report what it returned.

The reason to extract the rule is that R6's condition is not obvious and R6a
says why: a change under `src/lib/` can leave the app tier green and the
generator broken. A rule that lives only as a sentence in two markdown files
cannot be tested, and a wrong answer from it is silent by construction.

## Architecture

```
scripts/tiers.ts          tiersFor(paths) -> Tier[]      the rule, tested
scripts/tiers.test.ts     its tests                       runs in the tooling tier
vitest.config.ts          three projects: app, generator, tooling
package.json              test / test:gen / test:all
.claude/skills/…          call tiersFor, report what it returns
```

The generator project's include glob narrows from `scripts/**` to
`scripts/grooves/**`. Without that, `scripts/tiers.test.ts` would land in the
slow tier it exists to decide about — and the tooling that picks tiers should
never be the reason a gate runs the slow one. A third `tooling` project picks up
`scripts/*.test.ts` at the root and joins the default `npm test`.

That is a three-project config serving two *tiers*: `app` and `tooling` are both
fast and both default; `generator` is the one that is selected. Tier is a
property of cost, not a synonym for project.

## Contracts

Frozen before any track starts. Track B and Track C build against these while
Track A implements behind them.

```ts
// scripts/tiers.ts
export type Tier = 'app' | 'generator' | 'tooling'

/**
 * Which tiers an epic's file scope requires.
 *
 * `paths` are repo-relative, POSIX-separated, as a tech spec's file-ownership
 * lists write them. `null` means the scope could not be determined.
 */
export function tiersFor(paths: readonly string[] | null): Tier[]

/** Why a tier was or was not selected, for the report's Checks table. */
export function tierReason(paths: readonly string[] | null, tier: Tier): string
```

`package.json` scripts — named here because Epic 3's five agent definitions
reference them:

| Script | Runs | Default gate |
| :-- | :-- | :-- |
| `npm test` | `app` + `tooling` | yes |
| `npm run test:gen` | `generator` | no |
| `npm run test:all` | all three | no |

`tiersFor` always includes `'app'` and `'tooling'`. The only question it answers
is whether `'generator'` joins them.

## Tracks

### Track A — The rule and the tiers

- **Goal** — `tiersFor` exists and is tested; the three projects and three
  scripts exist; the `testTimeout` override is gone.
- **Role** — `implementer`
- **Owns** — `scripts/tiers.ts`, `scripts/tiers.test.ts`, `vitest.config.ts`,
  `package.json`
- **Depends on** — nothing
- **Parallel with** — Track B, Track C
- **Done when** — `npm test`, `npm run test:gen` and `npm run test:all` all pass
  and `scripts/tiers.test.ts` is green, without B or C existing.

### Track B — `/verify-epic` selects and reports

- **Goal** — `/verify-epic` establishes scope from the tech spec's
  file-ownership lists, calls `tiersFor`, runs what it returns, and reports a
  non-selected tier as **not run** with the reason.
- **Role** — `implementer`
- **Owns** — `.claude/skills/verify-epic/SKILL.md`,
  `.claude/skills/verify-epic/references/qa-report-template.md`
- **Depends on** — the `tiersFor` contract only
- **Parallel with** — Track A, Track C
- **Done when** — the skill names the module, the tier commands and the
  not-run reporting rule, and the template's Checks table carries a tier row per
  tier.

### Track C — `/implement-feature` gates and closes

- **Goal** — the wave gate applies the same selection over the wave's units, and
  the run ends with one combined pass after the last epic's QA gate.
- **Role** — `implementer`
- **Owns** — `.claude/skills/implement-feature/SKILL.md`,
  `.claude/skills/implement-feature/references/report-template.md`
- **Depends on** — the `tiersFor` contract and the script names only
- **Parallel with** — Track A, Track B
- **Done when** — §8 names the selection, a new §9a names the combined pass, and
  §10's Done rule requires it.

> **File-ownership note.** Track C owns `implement-feature/SKILL.md` and Track B
> owns `verify-epic/SKILL.md`. Epic 3 also edits both — which is why Epic 3 is in
> wave 2 of the feature, not because of anything inside this epic.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C — three disjoint file sets.
- **Wave 2:** Integration — the demo path and the three-run flake check.

## Implementation

### Track A — The rule and the tiers

#### Step A1 — The rule always runs the fast tiers

Covers: R6, AC5

- **Test first** — `scripts/tiers.test.ts`: `expect(tiersFor(['src/features/daily-groove/components/GroovePuzzle.tsx']))`
  `.toEqual(['app', 'tooling'])`. Run it: fails with
  `Failed to load url ./tiers.ts` — the module does not exist.
- **Implement** — `scripts/tiers.ts`: export `type Tier`, and `tiersFor`
  returning `['app', 'tooling']` unconditionally.
- **Green when** — that assertion passes.
- **Refactor** — none.

#### Step A2 — `scripts/` selects the generator tier

Covers: R6, AC2

- **Test first** — same file: `tiersFor(['scripts/grooves/events.ts'])` equals
  `['app', 'generator', 'tooling']`. Run it: fails, receives `['app','tooling']`.
- **Implement** — add the `scripts/` prefix test.
- **Green when** — both A1 and A2 assertions pass.
- **Refactor** — none.

#### Step A3 — `src/lib/` selects the generator tier

Covers: R6a, AC6

- **Test first** — same file, a `describe('src/lib is a shared leaf')` block:
  `tiersFor(['src/lib/hash.ts'])` and `tiersFor(['src/lib/groove.ts'])` each
  include `'generator'`; `tiersFor(['src/lib/branding.ts'])` **also** includes
  it. Run it: fails — `src/lib/*` currently matches only the `src/` arm.
- **Implement** — test `src/lib/` before the general `src/` case.
- **Green when** — all three pass.
- **Refactor** — none. The whole-folder rule is deliberate: `branding.ts` is not
  imported by the generator today, but `src/lib/` is *defined* as the code both
  halves may share, so the trigger follows the folder's contract rather than
  today's import graph. Narrowing it to the two files currently imported would
  make the next shared module silently unguarded.

#### Step A4 — A mixed scope selects the generator tier

Covers: R6

- **Test first** — `tiersFor(['src/features/daily-groove/index.ts', 'scripts/grooves/gate.ts'])`
  includes `'generator'`. Run it: passes already if A2 used `.some`; fails if it
  used `paths[0]`. Either way the assertion pins the behaviour.
- **Implement** — ensure the check is `paths.some(...)`, not first-path.
- **Green when** — green, and A1–A3 stay green.
- **Refactor** — none.

#### Step A5 — A non-code scope selects the generator tier

Covers: R6b, AC7a

- **Test first** — `tiersFor(['.claude/agents/musician.md', 'docs/music.md'])`
  includes `'generator'`. Run it: fails, receives `['app','tooling']`.
- **Implement** — a path under neither `src/` nor `scripts/` forces the full set.
  Express it as the PRD's positive rule: the fast set alone is returned **only
  when every path starts with `src/` and none starts with `src/lib/`**; every
  other input returns all three.
- **Green when** — A1–A5 all pass. A1's assertion still holds because every path
  in it is under `src/` and none under `src/lib/`.
- **Refactor** — rewrite `tiersFor`'s body as that single positive condition
  rather than four accumulated branches, so the code reads as R6 reads.

#### Step A6 — An unknown scope selects the generator tier

Covers: R7, AC8

- **Test first** — `tiersFor(null)` and `tiersFor([])` each equal
  `['app', 'generator', 'tooling']`. Run it: `null` throws on `.every`.
- **Implement** — guard both at the top of `tiersFor`. An empty list is not "a
  scope with nothing in it", it is a scope nobody established.
- **Green when** — green.
- **Refactor** — none.

#### Step A7 — Every selection can say why

Covers: R8, AC9

- **Test first** — `tierReason(['src/features/x.ts'], 'generator')` matches
  `/not run.*no path under `scripts\/` or `src\/lib\/`/`;
  `tierReason(null, 'generator')` matches `/scope could not be determined/`;
  `tierReason(['scripts/grooves/x.ts'], 'generator')` matches `/selected/`. Run
  it: fails, `tierReason` is not a function.
- **Implement** — `tierReason` returning one sentence per case.
- **Green when** — green.
- **Refactor** — none.

#### Step A8 — Three projects, and the generator glob narrows

Covers: R1, R2, R4, AC4

- **Test first** — `scripts/tiers.test.ts`, a `describe('the config matches the
  rule')` block: read `vitest.config.ts` from disk and assert its project names
  are exactly `app`, `generator`, `tooling`; that the generator project's
  include is `scripts/grooves/**/*.{test,spec}.ts`; and that the three globs
  partition every `*.test.*` file in the repo — each file matched by exactly one
  project. Run it: fails, there are two projects and the generator glob is
  `scripts/**`.
- **Implement** — `vitest.config.ts`: narrow the generator include, add a
  `tooling` project (`environment: 'node'`, `include: ['scripts/*.{test,spec}.ts']`).
- **Green when** — green, and `npx vitest run` still reports 2238 + the new
  tiers' own cases.
- **Refactor** — none.

> The partition assertion is the one that matters. It is what makes AC4 true by
> construction rather than by inspection, and it is the guard against a future
> directory landing in no tier at all and going quietly untested.

#### Step A9 — The three commands

Covers: R1, R2, R3, R12, AC1, AC3, AC13

- **Test first** — same describe: read `package.json` and assert `test` is
  `vitest run --project app --project tooling`, `test:gen` is
  `vitest run --project generator`, `test:all` is `vitest run`. Run it: fails,
  `test` is `vitest run`.
- **Implement** — set the three scripts.
- **Green when** — green; `npm test` finishes in seconds; `npm run test:gen`
  passes; `npm run test:all` case total equals the sum.
- **Refactor** — none. R12 needs no code: `vitest run --project X` on an empty
  match already exits zero, which A9's manual check confirms.

#### Step A10 — The timeout override goes

Covers: R10, AC11

- **Test first** — same describe: assert the config source contains no
  `testTimeout`. Run it: fails, the generator project sets `30_000`.
- **Implement** — delete the field and its comment.
- **Green when** — the assertion passes **and** `npm run test:gen` passes three
  times consecutively. If it does not, stop and report: that is the real finding
  the override was hiding, not a reason to restore it.
- **Refactor** — none.

### Track B — `/verify-epic` selects and reports

Skill files are prompts, not code, so these steps have no red-green turn of
their own. Their verification is Track A's tests plus the integration walk in
wave 2. Each step names exactly what text changes so the edit is reviewable.

#### Step B1 — Scope comes from the file-ownership lists

Covers: R5, AC8a

- **Change** — `verify-epic/SKILL.md` §2: state that the epic's scope is the
  union of the tech spec's per-track file-ownership lists, and that an epic with
  no tech spec has no determinable scope.
- **Done when** — §2 names the union rule and the no-spec case.

#### Step B2 — Tier selection calls the rule

Covers: R5, R6, AC5, AC6, AC7a

- **Change** — §4: before running tests, call
  `node --experimental-strip-types scripts/tiers.ts` — or import `tiersFor` —
  with the scope from B1, and run exactly the tiers it returns, using the A9
  commands. Do not restate R6's condition in prose: name the module as the
  authority, so the rule has one home.
- **Done when** — §4 names `tiersFor`, the three commands, and defers the
  condition to the module.

#### Step B3 — A tier not run says so, and why

Covers: R8, AC9

- **Change** — §4 and `references/qa-report-template.md`: the Checks table gets
  one row per tier — `Unit (app tier)`, `Unit (generator tier)`,
  `Unit (tooling tier)` — and a non-selected tier reads `not run` with
  `tierReason`'s sentence in Notes. Add to §5: no acceptance criterion may be
  graded **done** on evidence from a tier that did not run.
- **Done when** — the template shows all three rows and §5 carries the grading
  rule.

### Track C — `/implement-feature` gates and closes

#### Step C1 — The wave gate selects too

Covers: R9, AC10

- **Change** — `implement-feature/SKILL.md` §8: the gate's unit-test run uses
  `tiersFor` over the union of the files owned by the units in the wave that
  just ran, with the same commands. Type check is unchanged and still runs
  every wave.
- **Done when** — §8 names `tiersFor` and the wave's own file union.

#### Step C2 — One combined pass closes the feature

Covers: R7a, AC8b

- **Change** — `implement-feature/SKILL.md`: a new §9a, *The feature gate*, after
  §9's per-epic QA loop. Once the last epic in the run passes `/verify-epic`
  clean, run `npm run test:all` once. Per-epic selection means no moment in the
  run has executed every tier together; this is where that happens. A narrowed
  run (`/implement-feature feature-8 epic-2`) runs it only if it was the last
  outstanding epic.
- **Done when** — §9a exists and names `npm run test:all` and the narrowed-run
  exception.

#### Step C3 — A failed combined pass blocks Done

Covers: R7a, AC8c

- **Change** — §10's *When the run ends*: add that ✅ Done additionally requires
  §9a's combined pass to be green. A feature whose epics each passed but whose
  combined run fails is 🔨 In progress, and the report says so. Add the run's
  result to `references/report-template.md`'s Result paragraph.
- **Done when** — §10 carries the extra condition and the template names the
  combined pass.

## Integration and verification

#### Step I1 — The `src/lib/` arm, proved by breaking it

Covers: R6a, AC7

- **Test first** — edit `src/lib/hash.ts` so `hashString` returns a different
  value. Run `npm test`: it fails — `src/lib/hash.test.ts` pins the function
  against a fixed table, and it is in the app tier.
- **Then** — the assertion that matters: run the gate for an epic scoped to
  `src/lib/` and confirm `tiersFor` selected the generator tier and that tier
  fails too. Restore the file; both go green.
- **Green when** — the generator tier was *selected and failed*, not merely
  available. An arm that has never been seen to fire is not known to work.

#### Step I2 — The demo path

Covers: R1, R2, R3, R11, AC1, AC2, AC3, AC12

- Run `npm test` on a clean tree: seconds, app + tooling only.
- Run `npm run` and confirm the generator tier is listed as its own command.
- Run `npm run test:gen`: passes.
- Run `npm run test:all`: case total equals the sum of the parts.
- Run `npm run build`: `grooves:verify` runs first and the build fails if it
  fails.

#### Step I3 — Three consecutive runs

Covers: R10, AC11

- `npm run test:all` three times in a row, all green. A contention flake does
  not reproduce on one run, which is why the override existed.

#### Step I4 — Re-take the baseline

Covers: R1, AC1

- The PRD's numbers (78s, 2238 cases, 119 files) were measured on 2026-09-01
  against `d060792`, before feature-13 landed the new kit and the ride. Re-take
  them on the tree this epic starts from, and record before/after in the run
  report. The claim being verified is the delta, not the absolute.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A8, A9, I2, I4 |
| R2 | A8, A9, I2 |
| R3 | A9, I2 |
| R4 | A8 |
| R5 | B1, B2 |
| R6 | A1, A2, A4, A5, B2 |
| R6a | A3, I1 |
| R6b | A5 |
| R7 | A6 |
| R7a | C2, C3 |
| R8 | A7, B3 |
| R9 | C1 |
| R10 | A10, I3 |
| R11 | I2 |
| R12 | A9 |
| AC1 | A9, I2, I4 |
| AC2 | A2, I2 |
| AC3 | A9, I2 |
| AC4 | A8 |
| AC5 | A1, B2 |
| AC6 | A3, B2 |
| AC7 | I1 |
| AC7a | A5, B2 |
| AC8 | A6 |
| AC8a | B1 |
| AC8b | C2 |
| AC8c | C3 |
| AC9 | A7, B3 |
| AC10 | C1 |
| AC11 | A10, I3 |
| AC12 | I2 |
| AC13 | A9 |

## Assumptions

- `scripts/tiers.ts` sits at `scripts/` root, not inside `scripts/grooves/`. It
  is repo tooling, not generator code, and `boundary.test.ts` governs
  `scripts/grooves/` specifically.
- It imports nothing. A rule module that pulled in a dependency would need the
  dependency present to decide whether to run tests, which is backwards.
- The `tooling` project runs in `node` with no setup file. `tiers.test.ts` reads
  two files from disk and asserts on strings.
- `npm test` covers app **and** tooling. Two projects, one tier — "tier" here
  means cost, and tooling is milliseconds.
- Skill-file steps (Tracks B and C) have no automated test. That is inherent to
  editing prompts; the rule they call is what carries the test coverage, which is
  most of why it was extracted.

## Decision log

### Cycle 1 — 2026-09-01

**The tier rule is a tested module, not skill prose.**
Decided while writing, not asked: Epic 3's R18 already puts the citation check in
a repo script on the user's own answer, and the same argument applies harder
here — R6a's `src/lib/` arm is exactly the kind of rule that is wrong silently.
Changed: added `scripts/tiers.ts` and the `tooling` project to the architecture;
Track A gained steps A1–A7; Tracks B and C call the module rather than restating
the condition.

**The generator glob narrows to `scripts/grooves/**`.**
Consequence of the above: `scripts/**` would have swept `scripts/tiers.test.ts`
into the slow tier that the module exists to keep off the default gate.
Changed: Step A8, and the three-project architecture.
