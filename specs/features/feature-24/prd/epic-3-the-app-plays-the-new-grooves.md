# PRD — Epic 3: The app plays the new grooves

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Re-render the catalogue and commit it. Eleven of the thirty grooves — six
`shuffle` and five `swung-sixteenth` — get new audio; the other nineteen come out
byte-identical. Every groove keeps its id, uuid, bpm, root, flavour, chord and
progression, so a share link opens the same puzzle with the same answer behind
it and simply plays a better take. This is the first and only point in the
feature where anything reaches Sam.

## Problem

Epics 1 and 2 change the generator. Until the catalogue is re-rendered and
committed, the browser plays exactly the MP3s it plays today: the generator
renders offline and the app never makes audio. Nothing has shipped.

This is also the epic that can quietly break history. Re-rendering touches
`public/grooves/*.mp3`, `catalogue.json`, the manifest and `grooves.lock.json`
at once, and a groove whose harmony moved is a past puzzle whose answer moved.
`npm run grooves:verify` runs on `prebuild` for precisely this.

## Scope

- `npm run grooves` across all thirty
- the harmonic fields asserted unmoved before the audio is committed
- `grooves.lock.json` regenerated and `npm run grooves:verify` clean
- the quality gate green on all thirty, loudness window included
- the sample credit line, if a CC-BY library entered the pack in Epic 1
- a listening sign-off on all eleven changed grooves, one at a time

**Out of scope**
- any change to the puzzle, the guessing flow, the reveal or the coaching. The
  answers are identical; only what they sound like moved
- minting new grooves. The catalogue stays at thirty
- any change to the generator. Epic 2 left both templates final; if this epic
  wants a template changed, it is Epic 2 reopening, not this epic editing
- telling the player anything about the change — see R9

## Requirements

### The render

- **R1** — `npm run grooves` renders all thirty grooves. Exactly **eleven**
  audio files change: the six belonging to `shuffle` and the five belonging to
  `swung-sixteenth`. The other nineteen are byte-identical to the committed ones.
- **R2** — Every groove keeps its `id`, `uuid`, `bpm`, `root`, `flavour`,
  `scale`, `chord`, `progression` and `progressionDegrees`. The manifest's
  harmonic fields are compared field by field against the committed ones
  **before** any audio is committed, and a single difference stops the epic.
- **R3** — `grooves.lock.json` is regenerated in the same commit as the audio it
  describes, and `npm run grooves:verify` passes.
- **R4** — All thirty grooves pass all seven gate checks, the loudness window of
  −29 to −20 dBFS RMS included. A groove that now falls outside it is a levelling
  error to fix in Epic 1's method — the pack first, then the template `gain` —
  not a band to widen.
- **R5** — `headDelaySeconds` moving on the eleven re-rendered grooves is
  expected and is not a harmonic change. It is measured from the rendered audio,
  and the audio moved.

### The credit

- **R6** — If a CC-BY library supplied the ride, the sample credit already on the
  groove box grows to name both sources on **one line**. `puzzle.drumCredit` in
  `src/lib/snippets/en/puzzle.ts` and its assertion in `snippets.test.ts` change
  together.
- **R7** — The credit stays where it is, on the groove box, as one line. It does
  not become a stacked pair, does not move to a footer, and does not become a
  generic "and others" — an attribution that names nobody satisfies nothing. A
  footer is a separate candidate idea and stays one.
- **R8** — If the ride library is CC0, nothing in `src/` changes and this epic
  does not touch the app's source at all.

### The player

- **R9** — The app says nothing about the change. A groove Sam played three weeks
  ago sounds different when they open its share link, and the puzzle, the answer,
  the streak and the stored result are all exactly what they were.
- **R10** — A returning player gets the new audio rather than a cached old file
  on the same path. The MP3 paths are stable (`/grooves/groove-01.mp3`), so this
  is verified against the deployed app rather than assumed from the build.

### The sign-off

- **R11** — All eleven changed grooves are played and signed off, one at a time,
  before the feature is reported done. This is the check feature-13's ride
  failed, and it failed it late — a cymbal that works on one shuffle at 82 bpm
  can be wrong on another at 91 in a different key.
- **R12** — Two of the nineteen unchanged grooves are played as well, one of them
  from `half-time`, and heard to be indistinguishable from what they were.

## Behaviour details

The order matters, because the expensive mistake is committing audio whose words
moved:

```
render all 30 to a scratch dir
  → diff the manifest's harmonic fields against the committed ones
      → any difference: stop, report, commit nothing
  → gate all 30
  → confirm exactly 11 audio hashes changed
  → listen to all 11, plus 2 unchanged
      → commit audio + catalogue + manifest + lock together
```

## Acceptance criteria

- **AC1** (R1) — Given a full re-render, the manifest's audio hashes differ from
  the committed ones for exactly eleven grooves, and those eleven are exactly the
  `shuffle` and `swung-sixteenth` grooves.
- **AC2** (R2) — Given a full re-render, every groove's `id`, `uuid`, `bpm`,
  `root`, `flavour`, `scale`, `chord`, `progression` and `progressionDegrees`
  equal their committed values.
- **AC3** (R3) — Given the committed tree, `npm run grooves:verify` exits clean,
  and `npm run build` — which runs it on `prebuild` — succeeds.
- **AC4** (R4) — Given all thirty rendered grooves, the gate returns no failure,
  and each groove's RMS sits within −29…−20 dBFS.
- **AC5** (R6, R8) — Given a CC-BY ride library, `snippets.puzzle.drumCredit` is
  one string naming DrumGizmo.org and the ride library, and `snippets.test.ts`
  asserts that exact string. Given a CC0 ride library, `git diff` shows no change
  under `src/`.
- **AC6** (R7) — Given the solved groove box, exactly one credit line renders, in
  the position it renders in today.
- **AC7** (R9) — Given a stored result from before this feature, when the player
  opens the app or a share link to that groove, then the puzzle, the answer, the
  attempts, the streak and every word on the page are what they were.
- **AC8** (R10) — Given a browser that played a `shuffle` groove before the
  deploy, when it opens the app after the deploy, then the audio it plays is the
  new render.
- **AC9** (R11, R12) — A listening sign-off covering all eleven changed grooves
  individually, plus two unchanged ones, is recorded before the feature is
  reported done.
- **AC10** — `npm test`, `npm run test:gen`, `npm run lint` and `npm run build`
  are green.

## Dependencies

**Needs from Epic 2:** both templates final, and the count of riding feels — two,
or one if `swung-sixteenth`'s ride did not survive its listening pass. If it is
one, the changed-groove count is six rather than eleven and every requirement
here reads with that number.

**Needs from Epic 1:** whether the ride library is CC0 or CC-BY, which is what
decides whether R6 applies at all.

Hands nothing forward. This is the last epic.

## Assumptions

- **The eleven MP3s keep their existing paths.** `groove-01.mp3` stays
  `groove-01.mp3` with new bytes; the manifest's `audioSrc` values do not move.
- **Static assets under `public/` are revalidated rather than served from a
  long-lived cache.** R10 verifies it rather than trusting it, because the paths
  carry no content hash.
- **The catalogue's `shuffle` and `swung-sixteenth` counts are 6 and 5**, as
  `catalogue.json` holds today. If a groove has moved between feels since, the
  eleven becomes whatever the catalogue says.
- **`heard-in.json` needs no change.** It is keyed by `Groove.scale`, and no
  groove's scale moves.
- **The listening sign-off is delivered the way Epic 1 established it** — file
  paths and what to listen for, played by a person.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-24 epic-3`.

### Q1. What does the credit line say, if the ride is CC-BY?

`puzzle.drumCredit` reads `Drum samples provided by DrumGizmo.org` today, sits on
the groove box, and is asserted verbatim in `snippets.test.ts:133`. One line has
to carry both obligations. `<Ride>` below stands for whatever Epic 1 picked.

- [ ] A) `Drum samples provided by DrumGizmo.org and <Ride>` *(recommended — the
      smallest edit that names both sources, and it keeps the sentence Sam already
      skims the same shape and roughly the same length. Persona: "an account, a
      paywall, or a permission prompt before the first sound plays" is what loses
      them, and legal text growing on the page is the same species of friction —
      the credit should stay something you can not-read in one glance)*
- [ ] B) `Drums: DrumGizmo.org · Ride: <Ride>` — names which library gave which
      sound, which is what a person chasing the attribution actually wants
- [ ] C) `Samples: DrumGizmo.org, <Ride>` — drops the sentence for a label, the
      shortest thing that still names both
- [ ] D) `Drum samples provided by DrumGizmo.org and <Ride>`, with the two library
      names as links to their sources

### Q2. Does anything tell the player their old groove now sounds different?

Eleven puzzles Sam may already have played and shared will play a different take
from tomorrow. Same answer, same streak, different cymbal.

- [ ] A) Nothing at all *(recommended — persona: "one thing per day, not a
      curriculum" and "homework" is what loses them, and a notice about a change
      to audio they cannot A/B is a thing to read that helps nobody play. The
      roadmap already puts every player-facing change out of scope for this epic
      except the credit line)*
- [ ] B) One line on the solved box of a re-rendered groove — "this groove was
      re-recorded" — so a player who noticed is not left wondering
- [ ] C) A one-off notice on the daily page for a week after the deploy
- [ ] D) Nothing in the app, but a line in the repo's own changelog or
      `features.md`, so the change is findable by whoever looks for it
