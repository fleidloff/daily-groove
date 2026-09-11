# 0012. The guidelines are lint zones and structural tests

- **Status:** ✅ Accepted
- **Date:** 2026-08-30
- **Source:** [feature-5](../../specs/features/feature-5/briefing.md)

## Context

Four features in, the architecture existed as prose and in whoever was reading
the diff. A god component and cross-boundary test imports had both grown
without anything objecting.

## Decision

Every rule derived from the codebase is written into
`docs/coding-guidelines.md`, named after the file that motivated it, and tagged
either *lint-enforced* or *human-checked*. The enforced ones become ESLint
`no-restricted-imports` zones; the ones no linter can express become tests that
read the tree from disk.

## Consequences

- `src/components/structure.test.ts`,
  `src/features/daily-groove/structure.test.ts`,
  `src/app/route-boundary.test.ts`, `scripts/grooves/boundary.test.ts` and
  `src/lib/hash.test.ts` run as part of `npm test`, and a convention breaking
  is a red test rather than a review comment.
- A rule that is neither linted nor tested has to say so. The module map in
  `docs/architecture.md` carries four rows reading "review only", and naming
  them is what keeps the map honest.
- Adding a boundary is cheap and removing one is visible, which is what let
  feature-20 draw the module graph on top of this.

## Alternatives considered

- **Guidelines as prose only** — what the first four features had.
