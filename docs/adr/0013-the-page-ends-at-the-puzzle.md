# 0013. The page ends at the puzzle

- **Status:** ✅ Accepted
- **Date:** 2026-08-30
- **Source:** [feature-6](../../specs/features/feature-6/briefing.md)

## Context

feature-4 had added a row of already-played grooves with its own play buttons,
and the machinery to share one audio player between that row and the main box.
It was the biggest single source of state in the app.

## Decision

The page holds one groove — today's — and ends at the puzzle. The played-groove
row and the shared-player machinery are removed. The history keeps being
written to `localStorage`; nothing renders it.

## Consequences

- One audio path, one loop, one visualisation. The out-of-sync visualisation
  that prompted the feature was a symptom of the shared player.
- The stance held against later pressure and is now the app's shape: feature-15
  ruled an archive out of scope, feature-18 ruled out a style chooser ("a style
  chooser turns one thing a day into a library"), and quick-3 answered "what
  now" with a line of text rather than a second thing to do.
- An archive is still possible — [0023 — Every groove carries a uuid, and the share link is that uuid](0023-every-groove-carries-a-uuid.md) is what
  would make it cheap — but it would be a new screen, not a row.
