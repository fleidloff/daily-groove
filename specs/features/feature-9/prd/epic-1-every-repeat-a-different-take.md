# PRD — Epic 1: Every repeat is a different take

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

A groove stops being one four-bar recording played on repeat. It becomes a loop
of several *passes* of the same four-bar figure — same notes, a different
performance each time — with the number of passes declared by the feel, so a
fast funk groove gets four and a slow half-time groove gets fewer. The transport
still presents it as a four-bar loop and says nothing about which pass is
sounding. The freeze rule in `scripts/grooves/README.md` is deleted so the
catalogue can be re-rendered at all, and the generator's random stream is split
so that re-rendering changes what a groove *sounds like* without changing what
it *is*.

## Problem

The app loops one `AudioBufferSourceNode` over a four-bar buffer, so the
seventh repeat is sample-for-sample identical to the first. The ear locks onto
that within about two cycles — not because the notes repeat, which is what a
loop is for, but because the noise floor and every transient are literally the
same bytes. No amount of timing or arrangement work in the later epics fixes
this, because it is a property of the file rather than of the music.

## Scope

- The freeze rule is removed, and `docs/coding-guidelines.md`'s `hash.ts` rule
  is rewritten to stand on its surviving justification.
- `FeelTemplate` declares how many passes its grooves are rendered as.
- The events stage renders that many passes of the four-bar figure, redrawing
  the performance per pass and keeping the rhythm.
- The generator's rng is split into a `:music` stream and a `:rhythm` stream,
  arranged so every existing seed reproduces the answer it has today.
- `Groove` and `MusicMeta` carry the file's loop length alongside the musical
  figure; the player and the transport read it.
- The whole catalogue is re-rendered and committed.

**Out of scope**
- **Any indication of which pass is sounding.** The transport shows a four-bar
  loop and nothing else. The bar highlight already moves, and once Epic 5 lands
  the fill marks the end of the loop audibly.
- Fills — Epic 5. Every pass ends identically here.
- Anything about *what* is played or *how*: instruments (Epic 2), timing and
  dynamics (Epic 3), voicings, note lengths and the room (Epic 4).
- Re-encoding at a different bitrate. 192 kbps stays; see Assumptions.
- Varying the rhythm between passes. The figure is the groove's identity; only
  the performance of it varies.
- Any change to `src/lib/hash.ts` itself, or to the date→groove mapping. The
  function stays frozen and its test table is untouched.

## Requirements

- **R1** — `scripts/grooves/README.md` contains no freeze rule, and no
  reference to one. Re-rendering the catalogue is a normal operation.
- **R1a** — `docs/coding-guidelines.md`'s rule that `src/lib/hash.ts` is frozen
  survives, restated on the date-mapping justification alone: changing the hash
  reassigns every past date a different puzzle. `src/lib/hash.test.ts` and its
  fixed input/output table are unchanged.
- **R2** — A feel template declares how many passes a groove rendered from it
  is made of. Templates may declare different counts, and a template's count is
  the same for every groove rendered from it.
- **R2a** — Every template declares at least two passes. One pass is the
  behaviour this epic exists to replace.
- **R3** — A rendered groove is its template's pass count times four bars long,
  and every pass plays the same rhythm — the same kick, hat, bass and comp step
  patterns, on the same grid.
- **R4** — No two passes of a groove are byte-identical. Each pass draws its own
  timing and velocity deviations, and its own round-robin sample alternates.
- **R5** — The harmony repeats every four bars, so bar 5 carries the same chord
  as bar 1. The progression the manifest names describes the figure, not the
  whole loop.
- **R6** — The generator draws a groove's tempo, root, flavour and harmony from
  a stream that is independent of every rhythm, timing and voicing choice.
  Changing how the rhythm side draws cannot change a groove's answer.
- **R6a** — Every groove already in `catalogue.json` renders with the same
  `bpm`, `root`, `flavour`, `scale`, `chord` and `progression` it has today.
- **R7** — A groove's manifest entry states both lengths: `bars` is the
  four-bar musical figure, and `loopBars` is the length of the file's loop. The
  two are separate fields, and `loopBars` varies across the catalogue because
  the pass count does.
- **R8** — Playback loops over the whole file loop. The loop window brackets the
  music, as it does today, and the encoder delay handling is unchanged.
- **R9** — The transport shows four bar segments, and highlights the bar
  sounding *within the current pass*. The fill of the track advances across one
  pass and resets, so the highlight and the fill always agree.
- **R9a** — The transport is told how many passes the groove has. It cannot
  derive the sounding bar from position alone once the loop is longer than the
  figure.
- **R10** — Nothing on the page indicates which pass is sounding. A player sees
  a four-bar loop and hears a longer one.
- **R11** — When nothing is playing, no bar is highlighted, exactly as today.
- **R12** — `ProgressTrack` is unchanged. It takes a value, a segment count and
  an active segment, and learns nothing about passes or grooves.
- **R13** — The quality gate measures note density against the number of bars
  actually rendered, so a longer groove is not judged as a four-bar one.
- **R14** — The loop seam is closed as it is today: audio rendered past the end
  of the last bar is folded back onto bar one, and the gate's seam check still
  applies.
- **R15** — `npm run grooves` remains deterministic: two consecutive runs on an
  unchanged tree produce byte-identical artifacts.

## Behaviour details

**Pass count is a property of the feel.** A four-bar figure at 128 bpm is 7.5
seconds and four passes of it is 30; the same four passes at 68 bpm is 56
seconds and roughly 1.3 MB. Rather than accept that spread or chase a uniform
duration, the count sits on the template beside the tempo range that causes the
problem — the slow feels declare fewer passes, the fast ones more. It is the
same kind of decision as `swing` or `subdivision`: something a human decides
about a feel, which the seed then works within.

**What varies between passes, and what does not.**

| | Drawn once per groove | Redrawn per pass |
| :-- | :-- | :-- |
| Tempo, root, flavour, harmony | ✅ | |
| Kick / hat / bass / comp step patterns | ✅ | |
| Swing amount | ✅ | |
| Timing and velocity deviations | | ✅ |
| Round-robin sample alternate | | ✅ |

The distinction is what keeps a groove one groove. A player hearing pass three
must recognise it as the same music they heard in pass one; they must not be
able to point at the moment it repeats.

**Why the rng split matters more than it looks.** Today a single stream labelled
`:events` draws, in order: tempo, root, flavour, harmony, then the four rhythm
patterns. Every later epic in this feature adds or removes draws on the rhythm
side. Because the stream is sequential, an added draw shifts everything after
it — so a change to how a hi-hat pattern is chosen silently re-keys the whole
catalogue, and a player's record of solving `groove-07` starts describing a
groove in a different key. Splitting the stream in this epic is what lets Epics
2–6 change the sound freely.

**Position arithmetic.** The player reports elapsed seconds; `loopPosition`
maps them onto 0..1 of the whole loop. With `passes` known, from that single
number:

- the sounding bar within the pass is `floor(position × passes × 4) % 4`
- the track's fill is `(position × passes) % 1`

Deriving both from the same value is what stops them disagreeing at a boundary.
Nothing counts bars forward, so a backgrounded tab costs no accuracy — the next
frame reads the truth, exactly as it does today.

## Acceptance criteria

- **AC1** (R1, R1a) — Given the repo, when `scripts/grooves/README.md` is read,
  then it describes no freeze rule; and when `docs/coding-guidelines.md` is
  read, then `src/lib/hash.ts` is still declared frozen on the date-mapping
  grounds.
- **AC2** (R2, R2a, R3) — Given any catalogue spec, when its events are built,
  then they span its template's declared pass count times four bars; and given
  every template, when its declaration is read, then it declares at least two
  passes.
- **AC3** (R3) — Given a rendered groove, when the step positions of each pass
  are compared modulo the figure, then all passes carry the same pattern for
  every voice.
- **AC4** (R4) — Given a rendered groove, when passes are compared, then no two
  are identical in onset times, velocities, or chosen sample alternates.
- **AC5** (R5) — Given a rendered groove, when the chord sounding in bar 5 is
  compared with bar 1, then they are the same chord.
- **AC6** (R6) — Given the generator, when a draw is added to or removed from
  the rhythm stream, then every groove's `bpm`, `root`, `flavour`, `chord` and
  `progression` is unchanged.
- **AC7** (R6a) — Given the committed manifest before and after this epic, when
  they are diffed, then the only differences are the added `loopBars` and each
  groove's `headDelaySeconds`. Every answer field is byte-identical, and a test
  pins the eighteen answers so a later epic cannot move them unnoticed.
- **AC8** (R7, R8) — Given a groove entry, when the player derives its loop
  window, then the window is `loopBars` bars of music at the groove's tempo,
  starting after the file's own measured head delay; and grooves from different
  templates carry different `loopBars`.
- **AC9** (R9, R9a) — Given a playing groove, when position advances through one
  pass, then the highlighted segment steps 1→2→3→4 and the track fills from
  empty to full, and both reset together at the pass boundary — for a groove of
  two passes as well as one of four.
- **AC10** (R10) — Given the rendered page, when it is inspected, then nothing
  names or counts the sounding pass.
- **AC11** (R11) — Given a stopped or paused transport, when it renders, then no
  segment is highlighted.
- **AC12** (R12) — Given `src/components/display/ProgressTrack.tsx`, when its
  props are inspected, then they are unchanged, and
  `src/components/structure.test.ts` passes without amendment.
- **AC13** (R13) — Given a groove of any pass count, when the density gate runs,
  then it measures events per bar over the bars actually rendered and the
  catalogue passes.
- **AC14** (R14) — Given every rendered groove, when the seam is measured, then
  it is within `SEAM_THRESHOLD`.
- **AC15** (R15) — Given a clean tree, when `npm run grooves` runs twice, then
  `git status` reports no change; and `npm run grooves:verify` passes.

## Dependencies

Needs nothing to start. It is the only epic in wave 1 that touches the app, and
it hands the other five two contracts:

- **`bars` and `loopBars` on `Groove` and `MusicMeta`.** Epic 5 places a fill
  relative to the last pass; Epics 2, 3 and 4 render against the length without
  needing to know it exists.
- **The rng labels.** `:music` is closed to further draws from the moment this
  epic merges. Epics 2–6 draw from `:rhythm` or from their own labelled streams,
  never from `:music`.

It owns the `passes` field on `FeelTemplate` — a third epic in wave 1 touching
the template files, alongside Epic 2's `pan` and Epic 3's `humanize`, `density`
and `gain`.

Inside `events.ts` it owns the pass loop and the rng labels; Epics 3 and 4 own
what is emitted inside that loop.

## Assumptions

- The pass counts land at four for `straight-funk`, `shuffle` and
  `bright-straight`, and two for `half-time`, whose 68–80 bpm range makes four
  passes a 56-second file. These are starting values to be judged by ear and by
  file size, not a contract.
- `loopBars` is stored rather than derived, because the app never sees a
  template. The manifest is the whole contract between the generator and the
  app.
- The transport receives the pass count as a prop from the feature, derived from
  the groove's `loopBars` and `bars`. It is not given the groove.
- 192 kbps stays. Only the day's groove is ever fetched, so a longer file is a
  per-visit cost rather than a bundle cost.
- Groove ids never change, freeze rule or not. Stored history refers to grooves
  by id, and renumbering would silently reassign it.
- `OVERHANG_BARS` stays at its current value. One bar of overhang folded onto
  bar one is as correct at sixteen bars as at four.
- The `:music` stream is arranged to reproduce today's answers by keeping its
  draw order and count exactly as the first four draws of the current `:events`
  stream. If that turns out not to reproduce them exactly, the fallback is a
  one-off table pinning the eighteen — not a re-roll.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. How many passes make up a loop?**
Answer: **B) Per template, declared on `FeelTemplate`** — a flat four passes is
30 seconds at 128 bpm and 56 at 68, so the count belongs beside the tempo range
that causes the spread.
Applied to: Summary, Scope, R2, R2a, R3, R7, R9a, AC2, AC8, AC9, Behaviour
details, Dependencies, Assumptions — and the epic's name, which said "four
passes"

**Q2. Which field means "the loop", and which means "the figure"?**
Answer: **A) `bars` stays 4 and `loopBars` is added** — every existing reader of
`bars` means "the four segments the transport draws" and keeps working
untouched.
Applied to: R7, AC7, AC8, Assumptions

**Q3. How is the sounding pass shown?**
Answer: **D) Nothing** — the bar highlight already moves, and Epic 5's fill
marks the end of the loop audibly without any chrome.
Applied to: Summary, Out of scope, R10, AC10 — removing the pass-indicator
requirement drafted in cycle 1
