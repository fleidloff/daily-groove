# 0018. The app is named Eardle

- **Status:** ✅ Accepted
- **Date:** 2026-08-31
- **Source:** [feature-8](../../specs/features/feature-8/briefing.md)

## Context

The app had been "Daily Groove" — a description of the content, saying nothing
about what the visitor is meant to do. A first-time player could not tell it was
a game.

## Decision

The app is **Eardle**, subtitled "Wordle for your ears", and the name is stated
once in code.

## Consequences

- The comparison does the explaining: one puzzle a day, the same for everyone,
  come back tomorrow — all of which the app already was.
- It commits the app to the daily-puzzle shape it borrows, which
  [0013 — The page ends at the puzzle](0013-the-page-ends-at-the-puzzle.md) then defended twice.
- The name lived in `src/lib/branding.ts` until feature-21 folded that file into
  the snippets ([0035 — Every user-facing string lives in `src/lib/snippets/en`](0035-every-string-lives-in-one-place.md)), so it is now one
  entry among the strings.
- The repo, the folder and the internal slugs are still `daily-groove`.
