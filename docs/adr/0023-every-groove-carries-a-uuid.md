# 0023. Every groove carries a uuid, and the share link is that uuid

- **Status:** ✅ Accepted
- **Date:** 2026-08-31
- **Source:** [feature-12](../../specs/features/feature-12/prd/)

## Context

A groove could only be referred to as "the groove on date X", which ties it to
the rota. Sharing one, or building an archive, needs a name that survives a
reshuffle.

## Decision

Each groove is minted with a canonical v4 uuid, written once into
`catalogue.json` and never changed. A share link carries the full uuid and
resolves to that groove on any day. The share sheet carries the URL alone.

## Consequences

- The uuid joins the frozen list in [0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md): links
  point at it, so it outranks everything about the groove that may change.
- The rota may reshuffle freely without breaking a link, which is half of why
  `ROTA_EPOCH` is safe to bump
  ([0041 — A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest](0041-a-played-date-keeps-its-groove.md)).
- A shared page is a second route with its own framing — "shared groove" where
  the date would be, no "next groove" line, the same header and the same
  how-to-play box.
- Removing a groove from the catalogue kills its links, and the not-found page
  is the whole answer. No groove has ever been removed.
- An archive becomes a screen away rather than a data problem, though
  [0013 — The page ends at the puzzle](0013-the-page-ends-at-the-puzzle.md) is why there isn't one.

## Alternatives considered

- **A short code beside the uuid** — prettier links, and a second identifier to
  keep unique.
