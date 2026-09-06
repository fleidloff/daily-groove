# PRD — Epic 2: The credit line names where the bass came from

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

If the bass library Epic 1 picks is CC-BY rather than CC0, its attribution has to
be visible to someone using the app — a rendered groove is a derivative work of
the samples it is built from. This epic grows the credit under the groove box
from two libraries to three. It is one line of text and its links, and it does
not exist if the winning library is CC0.

## Problem

The credit today reads *"Drum samples from MuldjordKit and DRSKit, provided by
DrumGizmo.org · CC BY 4.0"*, and every part of it is drums: one link to
drumgizmo.org, one licence link, two library names in one string. Both current
pitched voices — bass and comp — are CC0 and appear nowhere, which is correct
today and wrong the moment a CC-BY bass enters the pack.

`samples/pack.test.ts` already refuses a non-CC0 sample without an attribution,
and `provenance.attributions` is the sorted set of distinct ones. That guard
stops the repo from being wrong. It does not put the words on the page.

## Scope

- `src/lib/snippets/en/puzzle.ts` — the credit strings
- `src/features/daily-groove/components/puzzle/GrooveCard.tsx` — the credit's
  markup, today built around one source URL and one licence link
- the tests that assert the exact two-library string: `snippets.test.ts`,
  `GrooveCard.test.tsx`
- `samples/README.md`, where the attribution obligation is written down

**Out of scope**
- moving the credit. Quick ticket 9 put it under the groove box on purpose
- the how-to-play box. `HowToPlay.test.tsx` asserts no credit leaked back into it
- a second language. The strings land in `en/` and the next language is a folder
  beside it, as feature-21 set up
- CC0 libraries. VCSL and VSCO 2 CE require no attribution and get none

## Requirements

- **R1** — This epic ships only if `provenance.attributions` has length 3 after
  Epic 1. At length 2 the bass library is CC0, nothing is owed, and the epic is
  dropped rather than shipped empty.
- **R2** — The credit under the groove box names the bass library, its publisher
  and its licence, alongside the two drum libraries already there.
- **R3** — Each named source links to where it came from, and each licence links
  to its text. The component no longer assumes one source URL and one licence.
- **R4** — The credit stays one visual block under the groove box, readable on a
  phone without pushing the play button off the first screen.
- **R5** — Every string is a snippet in `src/lib/snippets/en/puzzle.ts`. No
  user-facing text is written inline in the component.
- **R6** — The strings on the page match `provenance.attributions` — the library
  names in the credit are the ones the pack actually carries.

## Acceptance criteria

- **AC1** (R1) — Given `provenance.attributions` has length 2, when the epic is
  assessed, then it is dropped and the credit is unchanged.
- **AC2** (R2, R6) — Given a CC-BY bass in the pack, when the groove card renders,
  then the credit names the bass library and its publisher as well as MuldjordKit,
  DRSKit and DrumGizmo.org.
- **AC3** (R3) — Given the rendered credit, when each source and licence link is
  read, then each points at that source's own URL and its own licence text.
- **AC4** (R4) — Given a 375 px viewport, when the puzzle page renders, then the
  credit sits under the groove box and the play button is still above the fold.
- **AC5** (R5) — Given `snippets.test.ts`, when it runs, then the credit strings
  it asserts are the ones the component renders, and none is inline.
- **AC6** (R2) — Given `HowToPlay.test.tsx`, when it runs, then no credit text
  appears in the how-to-play box.

## Dependencies

Epic 1, for one value: the third entry of `provenance.attributions`, plus the
library's URL and licence. Both are known as soon as the library is chosen —
before the catalogue is re-rendered — so this epic can start against them while
Epic 1 is still balancing feels.

## Assumptions

- The bass library's licence is CC-BY 4.0, the same as both drum kits, so one
  licence link can still serve all three. If it is a different CC-BY version, R3
  already covers it.
- The exact attribution wording is CC-BY 4.0 § 3(a)(1)'s discretion, as DRSKit's
  string already is: name the creator, the licence and the fact of modification.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-27 epic-2`.

### Q1. What shape does a three-library credit take?

- [ ] A) One sentence, drums and bass in it: "Drum samples from MuldjordKit and
      DRSKit, bass from <library>, provided by DrumGizmo.org and <publisher>"
      *(recommended — Sam: "I have never read a credit line in this app and I
      won't start", so the cheapest correct line is the right one, and one
      sentence is what is there today)*
- [ ] B) Two lines, one per instrument family — drums on one, bass on the other —
      so each publisher and licence sits beside what it supplied
- [ ] C) A short line — "Samples from MuldjordKit, DRSKit and <library>" — with
      the publishers and licences behind a link or a details toggle
- [ ] D) The credit moves to a footer, and the groove box carries nothing

Option D is the **Footer** candidate idea in `specs/features.md`; picking it here
takes that idea rather than leaving it for later.
