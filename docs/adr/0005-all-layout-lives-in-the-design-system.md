# 0005. All layout lives in the design system

- **Status:** ✅ Accepted
- **Date:** 2026-08-29
- **Source:** [feature-2](../../specs/features/feature-2/briefing.md)

## Context

The design arrived as a Claude Design canvas — one page of finished HTML.
Copying it into a route would have produced a working screen and no components.

## Decision

The canvas is rebuilt as generic components under `src/components/`, and no
layout is written outside that folder. Features compose components; routes
compose features. A primitive takes props, holds no app state and knows no
domain concept.

## Consequences

- The one-way dependency `features → components` is the arrow every later
  boundary rests on, and it is zone 1 of the lint config
  ([0012 — The guidelines are lint zones and structural tests](0012-the-guidelines-are-lint-zones-and-structural-tests.md)).
- Design-system components are testable without a feature, which is what
  `docs/testing.md` now demands of them.
- It costs a component per piece of the design, including ones used once.
- The rule is why the snippet work ([0035 — Every user-facing string lives in `src/lib/snippets/en`](0035-every-string-lives-in-one-place.md))
  had to hand text to primitives as props instead of letting them read it.

## Alternatives considered

- **Port the design page as-is and extract later** — the briefing pre-empted it
  ("Don't blindly copy anything from the design webapp").
