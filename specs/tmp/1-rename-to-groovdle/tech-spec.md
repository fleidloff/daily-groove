# V1. Rename Eardle to Groovdle — tech spec

**Phase:** ready to build — `/implement-vibe-with-docs 1`

## Contracts

* No new type, signature or storage key. `BrandingSnippets` in
  `src/lib/snippets/types.ts` already declares `appName: string` and
  `tagline: string`; only the values change.

## Epics

One epic, one track. Two string fields and one test in one folder, and §6's
rule against inventing a split applies: there are no disjoint files to hand to
a second track.

### Epic 1 — The app is called Groovdle

#### Track A — Rename, and guard the old name

* **Role:** `implementer`
* **Owns:** `src/lib/snippets/en/branding.ts`,
  `src/lib/snippets/snippets.test.ts`
* **Needs to start:** nothing
* **Module:** none of the six — `src/lib/snippets/` sits below them, the way
  `src/lib/branding.ts` did before feature-21 folded it in

1. **red** — in `src/lib/snippets/snippets.test.ts`, a test that no `.ts` or
   `.tsx` file under `src/` contains "eardle", matched case-insensitively.
   Reuse the file's own `filesUnder(SRC_ROOT)` helper, which the private-folder
   scan already uses. It fails on `en/branding.ts`.
2. **green** — `appName`: `'Eardle - Daily Ear Training'` →
   `'Groovdle - Daily Ear Training'`.
3. **green** — `tagline`: `"Wordle for your ears."` → `"Wordle for grooves."`,
   the rest of the sentence unchanged.

**The guard scans `src/` and not `docs/`, deliberately.**
`docs/adr/0018-the-app-is-named-eardle.md` has to keep the name — it is the
record of what was true, and §8a marks it superseded rather than editing it.

## Waves

* **Wave 1:** Track A. One track, so `/implement-vibe-with-docs` §4 builds it
  in the lead rather than dispatching.

## What the tree already gives us

Read before building, so this is not re-derived:

* **The name lives in exactly one place.** `appName` and `tagline` in
  `src/lib/snippets/en/branding.ts` — [ADR 0035](../../../docs/adr/0035-every-string-lives-in-one-place.md)
  put them there and `snippets.test.ts` keeps `en/` private to the index.
* **Nine call sites, all of them importers.** `src/app/layout.tsx` (tab title
  and metadata), `components/header/GrooveHeader.tsx` (header and tagline),
  `components/GroovePuzzle.tsx` (`REGION_LABEL`), and six test files that
  import the constant rather than the string. None of them changes.
* **No test asserts either literal**, which is why step 1 exists: without it
  every `## Done when` bullet is settled by reading a file rather than by a
  test.
* **`package.json` is `daily-groove`** and stays so, per
  [ADR 0018](../../../docs/adr/0018-the-app-is-named-eardle.md).

## Open

*Nothing.*

## Checks

`npm run lint && npm test && npm run build`. No `npm run test:gen` — nothing
under `scripts/grooves/` moves.

## Risks

* **None to the catalogue.** No audio re-renders, no RNG draw changes, no
  puzzle answer moves. `src/lib/hash.ts`, `MUSIC_LABEL` and every `uuid` are
  untouched.
* **The size test passes on all four questions**: two bullets, two files, no
  module at all, nothing frozen in `docs/music.md`, one `git revert`.
* **This supersedes [ADR 0018](../../../docs/adr/0018-the-app-is-named-eardle.md)**,
  so §8a writes the replacement record and marks 0018 ⛔ Superseded. That is
  the one piece of §8 work this change definitely owes; §8b has nothing, since
  no document under `docs/` states the app's name outside that record.
