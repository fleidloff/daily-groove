# 0035. Every user-facing string lives in `src/lib/snippets/en`

- **Status:** ✅ Accepted
- **Date:** 2026-09-03
- **Source:** [feature-21](../../specs/features/feature-21/briefing.md)

## Context

Roughly a hundred user-facing strings were written inline wherever they
rendered, across thirty files. Nobody could read what the app actually says, and
rewording a line meant hunting for it.

## Decision

All of them move to `src/lib/snippets/en/`, one file per area behind an index,
with `src/lib/branding.ts` folded in. Each area file satisfies a declared type
in `snippets/types.ts`, so a missing translation becomes a compile error later.
Interpolated snippets are functions taking arguments; everything else is a
constant, so the compiler checks every call site. The selected language lives in
`src/lib/language.ts`, is stored in `localStorage`, and defaults to `en`.

The line for what becomes a snippet is "would a translator translate it":
aria-labels and the mode character lines are
language. Theory names, degree labels, numerals, storage keys, locale strings,
error names and invariant messages are not.

## Consequences

- No test asserts a literal user-facing string — it imports the snippet and
  asserts against that, with a named, audited exception list for the handful
  that could not. Rewording is free; the trade is that such a test no longer
  checks the wording.
- The design system still takes its text as props and never reads snippets, per
  [0005 — All layout lives in the design system](0005-all-layout-lives-in-the-design-system.md).
- A string that gets parsed after it is written is split into fields instead —
  `HowToPlay`'s steps became `{ words, mark }` and `splitMark` was deleted,
  because that parse was the one place a translator could break the layout
  without touching code.
- Translating into another language is still out of scope. The `en/` folder and
  the stored language are the preparation, and nothing more.
