# 0001. Progress lives in the browser only

- **Status:** ✅ Accepted
- **Date:** 2026-08-21
- **Source:** [feature-1](../../specs/features/feature-1/briefing.md)

## Context

The first feature needed somewhere to keep the streak and the day's result. A
login and a server would have been the general answer, and there was one player.

## Decision

All player state lives in `localStorage`. No accounts, no backend, no sync.

## Consequences

- The app deploys as one static Next.js build with nothing behind it, which is
  what later let the catalogue be a build-time artefact and the routes be
  static.
- A player's history is tied to one browser. Clearing site data is losing the
  streak, and there is no way to move it to a phone.
- Every feature that wants to remember something adds a key under
  `lib/persistence/`, so the settings row grew without ever needing a schema.
- Multiplayer, leaderboards and a cross-device archive are all blocked behind
  this, and unblocking them is a migration rather than a feature.

## Alternatives considered

- **An account with a server** — the briefing named it as a maybe for later
  ("Might be with login possible in the future"), and it stayed there.
