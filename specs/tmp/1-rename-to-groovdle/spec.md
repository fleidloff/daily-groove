# V1. Rename Eardle to Groovdle

Started 2026-09-11 · `/vibe-with-docs`
**Phase:** ready to build — `/implement-vibe-with-docs 1`

## What

* Change the app's name from Eardle to Groovdle.
* Change the tagline's opening from "Wordle for your ears" to "Wordle for
  grooves".

## Done when

* The header, the browser tab and the page's region label all read the new
  name.
* The tagline reads "Wordle for grooves. Listen to today's groove, figure out
  the key, and test your musicianship daily."
* Nothing anywhere in `src/` or `docs/` still says Eardle, except the ADR
  record that names it.

## Decided

* **Where the name lives** — `src/lib/snippets/en/branding.ts`, one `appName`
  field, because [ADR 0035](../../../docs/adr/0035-every-string-lives-in-one-place.md)
  centralised it and every consumer imports it. No test asserts the literal
  string, so a rename is a one-field edit.
* **The tagline follows the name** — "Wordle for grooves", because the ear pun
  was what `Eardle` was named for and a name and a subtitle pulling in
  different directions read as two different apps.
* **The `- Daily Ear Training` suffix stays**, so `appName` becomes
  `'Groovdle - Daily Ear Training'`. It is the browser tab title as well as the
  header, and "ear training" is still what the app is.
* **A negative guard, not an assertion of the new strings** — a test that no
  file under `src/` contains "Eardle", rather than one expecting `appName` to
  equal the new value. It pins no wording, so it does not fight
  [ADR 0035](../../../docs/adr/0035-every-string-lives-in-one-place.md)'s rule
  against asserting literals, and it catches a stray copy of the old name
  arriving in a new file later.
* **The repo, the folder and the internal slugs stay `daily-groove`** —
  [ADR 0018](../../../docs/adr/0018-the-app-is-named-eardle.md) already settled
  that, and nothing about a second rename changes it.

## Open

*Nothing. Both documents are settled.*

## Notes for the build

* This supersedes [ADR 0018](../../../docs/adr/0018-the-app-is-named-eardle.md),
  so `/implement-vibe-with-docs` §8a writes the replacement record and marks
  0018 ⛔ Superseded.
