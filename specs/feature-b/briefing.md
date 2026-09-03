* internationalization
* actually use snippets instead of hardcoded text
* translate all snippets
* come up with a way to automatically translate on build?
* centralising the strings comes first and is the bigger half — roughly a hundred user-facing strings across thirty files, written wherever they render today
* they land in `src/lib/snippets/`, one file per area behind an index, with `src/lib/branding.ts` folded in
* interpolated snippets are functions taking arguments, everything else a constant, so the compiler checks every call site
* the line for what becomes a snippet is "would a translator translate it" — aria-labels and the mode descriptions in `character.ts` are language; theory names, degree labels and numerals stay data with one owner
* storage keys, locale strings, error names and invariant messages are not snippets
* the design system takes its text as props, never snippets — a primitive that knows app words is no longer a primitive
* whether tests must import snippets instead of asserting literals is open: it makes rewording free, but a test that asserts the constant it imports stops checking the wording
* see [every-word-in-one-place.md](every-word-in-one-place.md) — the settled PRD for the centralisation half, written as feature-20's Epic 4 before it moved here
