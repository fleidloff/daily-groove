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
  groove box grows to name both sources on **one line**, reading `Drum samples
  from MuldjordKit and DRSKit, provided by DrumGizmo.org`. Only `Drum samples
  from MuldjordKit and DRSKit,` is the text of the `drumgizmo.org` link; the
  trailing ` provided by DrumGizmo.org` renders after the anchor closes, so a link
  never has inside it the name of something it does not point at. It keeps the
  shape and roughly the length of the sentence Sam already skims past — a credit
  should stay something you can not-read in one glance, because legal text growing
  on the page is the same friction as being asked for an account before the first
  sound plays. `puzzle.drumCredit` in `src/lib/snippets/en/puzzle.ts` and its
  assertion in `snippets.test.ts` change together.

  **Amended after Track D built the original wording, 2026-09-05.** R6 first asked
  for `Drum samples provided by DrumGizmo.org and <Ride>`, `<Ride>` being the
  attribution string the library's licence names. Track D built exactly that and
  reported that it cannot satisfy the length clause: **both kits come from the
  same publisher**, so DRSKit's attribution ends `provided by DrumGizmo.org` and
  the rendered line said `DrumGizmo.org` twice, growing 38 → 111 characters.

  Naming both kits once and the publisher once is 74 characters, and it fixes
  something the original never noticed: **the committed line names neither kit.**
  It credits MuldjordKit for the first time. This costs the constraint that
  `drumCredit` keeps its exact words — see the amendment to R7c and AC5 — and that
  trade was the user's call, not the implementer's.
- **R7** — The credit stays where it is and keeps the shape it already has:
  `GrooveCard.tsx` renders `puzzle.drumCredit` as the text of a link to
  `drumgizmo.org`, followed by a second link reading `CC BY 4.0`. It does not
  become a stacked pair, does not move to a footer, and does not become a generic
  "and others" — an attribution that names nobody satisfies nothing. A footer is a
  separate candidate idea and stays one.
- **R7b** — The ride library gets no link of its own. One line, two anchors, the
  two that are there today — a third would be the growth of legal text on the page
  that R6 exists to avoid. The ride's name is plain text between them.
- **R7c** — The line is assembled from two snippet keys, not from splitting one.
  `puzzle.drumCredit` is the anchor's text; a second key carries the remainder and
  renders outside the anchor. Splitting a sentence in the component on `' and '`
  would make the rendering depend on the punctuation of a translatable string, and
  hard-coding a library's name in `GrooveCard.tsx` would put user-facing text
  outside `src/lib/snippets/`.

  **Amended 2026-09-05, with R6.** R7c originally required `drumCredit` to keep
  the words it has. The chosen wording names both kits inside the anchor, so
  `drumCredit` becomes `Drum samples from MuldjordKit and DRSKit,` and the second
  key becomes ` provided by DrumGizmo.org`. The two-key structure, and the reason
  for it, are unchanged — only which words fall on which side of the anchor.
- **R8** — If the ride library is CC0, nothing in `src/` changes and this epic
  does not touch the app's source at all.

### The player

- **R9** — The app says nothing about the change, anywhere, ever. A groove Sam
  played three weeks ago sounds different when they open its share link, and the
  puzzle, the answer, the streak and the stored result are all exactly what they
  were. No notice on the daily page, no line on the solved box, no snippet added
  and no component written for one. A note about audio Sam cannot A/B against
  what they remember is a thing to read that helps nobody play, and reading
  things is what loses them.
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
- **AC5** (R6, R7c, R8) — Given a CC-BY ride library, the credit line renders as
  `Drum samples from MuldjordKit and DRSKit, provided by DrumGizmo.org · CC BY
  4.0`, with `snippets.puzzle.drumCredit` at `Drum samples from MuldjordKit and
  DRSKit,` supplying the anchor's text, and the second key supplying
  ` provided by DrumGizmo.org` outside it; `snippets.test.ts` asserts both
  strings. Given a CC0 ride library, `git diff` shows no change under `src/`.

  **Amended 2026-09-05.** AC5 previously pinned `drumCredit` as *unchanged*. That
  is what the amendment to R6 gives up, and it is given up deliberately: holding
  `drumCredit` fixed forces the publisher's name to appear twice. The clause it
  keeps is the one that matters — both strings asserted, so the line cannot drift
  without a test saying so.
- **AC6** (R7, R7b) — Given the groove box, exactly one credit line renders, in
  the position it renders in today, carrying exactly two anchors — the
  `drumgizmo.org` link whose text is `puzzle.drumCredit`, and the `CC BY 4.0`
  licence link.
- **AC7** (R9) — Given a stored result from before this feature, when the player
  opens the app or a share link to that groove, then the puzzle, the answer, the
  attempts and the streak are what they were, and no word on the page tells the
  player anything about the re-render.

  **Corrected 2026-09-05, after verification found it self-contradictory.** AC7
  read "every word on the page are what they were", which AC5 deliberately
  breaks: the sample credit line's words change in this very epic. Both could not
  hold. The intent R9 carries is the player's *game state* surviving untouched,
  plus AC7b's no-notice rule — not a freeze on every string in the app.
- **AC7b** (R9) — Given the diff for this epic, no snippet is added under
  `src/lib/snippets/` that says anything to the player about the re-render, and
  the only keys touched there are the two that carry the sample attribution, and
  only if the ride library is CC-BY. No notice, no "re-recorded" line, no
  changelog string.
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
here reads with that number. Epic 2 also owns the density band: a seed it could
not bring inside its feel's band stops Epic 2, so this epic begins only when all
thirty grooves render inside their bands.

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

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-09-05

**Q1. What does the credit line say, if the ride is CC-BY?**
Answer: **A) `Drum samples provided by DrumGizmo.org and <Ride>`** — the smallest
edit that names both sources, keeping the sentence the shape and length Sam
already skims past.
Applied to: R6, R7, AC5, AC6. R7 gained the explicit refusal of links, which was
option D.

**Q2. Does anything tell the player their old groove now sounds different?**
Answer: **A) Nothing at all** — a note about audio Sam cannot A/B is a thing to
read that helps nobody play.
Applied to: R9, AC7b. Stronger than option D, so no changelog line either: the
change is findable in this feature's own spec documents and nowhere else is
written for it.

### Cycle 2 — 2026-09-05

**Correction, not a question.** R7 and AC6 as written in Cycle 1 required the
credit to render as "plain text containing no anchor". It does not and never
did: `GrooveCard.tsx:45–62` renders `puzzle.drumCredit` as the text of a link to
`drumgizmo.org`, followed by a second link reading `CC BY 4.0`. Cycle 1's Q1
ruled out option D — *giving the ride library its own link* — and that was
written down as though it ruled out the links already there.
Applied to: R7, R7b, AC6. The decision is unchanged; the description of what it
applies to is now accurate.

### Cycle 3 — 2026-09-05

**Q1 (tech spec). The grown credit sits inside the DrumGizmo link — is that the
attribution you want to ship?**
Answer: **B) Split the anchor so each name links to its own source.** Only the
DrumGizmo half is the link's text; the ride's name renders after it as plain
text.
Applied to: R6, R7b, R7c, AC5, AC7b, and Epic 3's tech spec (Track D gains
`GrooveCard.tsx`).

**Amendment AC7b, forced by that answer.** B's rendering has no clean
implementation while AC7b forbids adding a snippet key: the alternatives are
splitting a translatable sentence on `' and '` in the component, or hard-coding
the ride's name outside `src/lib/snippets/`. AC7b was written to enforce R9 —
the app says nothing to the player about the re-render — and an attribution key
is not a notice, so the rule was broader than its reason. It is now narrowed to
its intent, and R7c names the two-key assembly as the way B is built. Option C's
rendering and B's are the same line; C was rejected as "needs a PRD amendment",
and the amendment turns out to be a one-clause correction of an over-broad AC of
our own making rather than a loosening of R9.
