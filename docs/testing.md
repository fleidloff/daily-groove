# Testing

This document holds the standard: what must be tested and how a test is judged.
Where a test file goes, and the shapes to avoid, are rules —
**[coding-guidelines.md](coding-guidelines.md)** owns those, with the file in
this repo that motivated each one. See also [architecture.md](architecture.md)
for the shape the tests are protecting.

## What must be tested

- **Every feature must be unit tested.** A feature is not done without tests.
- **Design-system components are tested against their own contract** — props,
  states, accessibility — independently of any feature. A primitive that can
  only be tested through a feature has stopped being a primitive.
- **Logic in `lib/` is tested directly.** It is plain functions; test them as
  plain functions.

## How a test is judged

- **Test behaviour through the feature's public surface, not its internals.** A
  test that reaches past `index.ts` couples the feature's internal layout to its
  test suite, and the feature stops being something you can refactor in one step.
  A `vi.mock` of an internal path is the same coupling wearing a different hat.
- **Test rendered behaviour, not implementation details.** What the user sees
  and does, not which hook fired or how state is held.
- **A relocated assertion keeps its subject.** Moving a test to the file that
  owns its subject is a move; rewriting it as an isolated render with hand-made
  props is a different assertion wearing the old one's name.

## Structural tests

Some conventions no linter can check are guarded by tests that read the tree or
the source from disk and fail when it drifts:
`src/components/structure.test.ts`,
`src/features/daily-groove/structure.test.ts`,
`src/app/route-boundary.test.ts`, `scripts/grooves/boundary.test.ts` and
`src/lib/hash.test.ts`. They run under `npm test`. The guidelines say which rule
each one stands behind, and which rules `npm run lint` enforces instead.
