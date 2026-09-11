# 0051. The app is named Groovdle

- **Status:** ✅ Accepted — supersedes [0018 — The app is named Eardle](0018-the-app-is-named-eardle.md)
- **Date:** 2026-09-11
- **Source:** V1, through `/vibe-with-docs`

## Context

[0018 — The app is named Eardle](0018-the-app-is-named-eardle.md) named the app
for the ear — the organ the puzzle tests — and the tagline "Wordle for your
ears" carried the explanation. What the player actually hears is a groove, and
the catalogue, the generator, the repo and every internal slug have said
`groove` from the start.

## Decision

The app is **Groovdle**, and the tagline opens "Wordle for grooves". The
`- Daily Ear Training` suffix on the name stays, because the same field is the
browser tab title and ear training is still what the app is.

## Consequences

- The name and the subtitle point at the same thing again. Under 0018 a rename
  of one without the other would have read as two different apps, which is why
  the tagline moved in the same change.
- One field, `branding.appName`, and one edit — the property
  [0035 — Every user-facing string lives in `src/lib/snippets/en`](0035-every-string-lives-in-one-place.md)
  bought. Nine call sites import it and none of them changed.
- The Wordle comparison survives the rename, so what 0018 bought — one puzzle a
  day, the same for everyone, come back tomorrow — is unaffected.
- **The repo, the folder and the internal slugs stay `daily-groove`.** That was
  0018's last consequence and this does not disturb it.
- `snippets.test.ts` now scans every `.ts` and `.tsx` file under `src/` for the
  old name and fails on a match, so a second copy of a name is a red test rather
  than a place the next rename misses. It asserts no wording, so it does not
  fight 0035's rule against pinning literals.

## Alternatives considered

- **Rename and leave the tagline** — keeps "for your ears", which is what the
  player does. Rejected: a name about grooves over a subtitle about ears is the
  kind of mismatch a first-time visitor reads as a mistake.
- **Assert the new strings in a test** — would pin the wording, which 0035
  forbids, and make the next reword a test edit.
