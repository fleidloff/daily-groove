# 24 — Raise the bass sustain default

## What

* Every feel's drawn bass notes ring longer, not just `open-ballad`'s.
* `BASS_SUSTAIN_DEFAULT` in `events.ts` is the **cap** that goes 2 → 3. The floor stays
  at 2.
* So a note whose gap to the next bass onset is 3 or more goes from 2 to 3; a note with
  a gap of 1 or 2 does not move at all. No feel gains an overlap it does not already
  have.
* Not a flat 3. The shared `BASS_PATTERNS` are `[0,6,10]`, `[0,3,10]`, `[0,6,10,14]` and
  `[0,8,14]`, and an approach note is inserted on the last sixteenth, so steps 14 and 15
  sit one sixteenth apart — a flat 3 would overrun both by two and ring an off-scale
  approach note ~300 ms under the next chord in every feel.
* `open-ballad` keeps its own `bassSustain: 5` and is unaffected.
* The nine walking-bass grooves are unaffected: their notes set `note.sustain`
  explicitly, which takes precedence.
* **Fred's waiver, in his words: "please make a quick-feature out of it. It affects many
  songs but the implementation is minimal."** Said after being told this fails the size
  test's third question — 45 of 54 grooves re-render and most of the 20 `SIGN_OFFS` pins
  void, each needing an ear.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* A drawn bass note with room rings 3 sixteenths where it rang 2, in every feel that
  declares no `bassSustain`.
* A note whose gap to the next bass onset is 1 or 2 sixteenths is unchanged.
* `open-ballad`'s five grooves and the nine walking-bass grooves render byte-identical.
* Every re-rendered mp3 and the lock are committed, and each feel's `gain.bass` is
  re-measured or explicitly left alone with the measurement that says why.
* Every voided `SIGN_OFFS` pin is re-pinned in the words of a listening pass, or the
  ticket says which are still owed.
* A test covers the raised cap and the unchanged floor.

## Open questions

_Nothing open. Q1 and Q2 are answered below._

### Q1. How many listening passes does the sign-off table get?

13 `SIGN_OFFS` pins void across seven feels. The table's convention is that a person's
words are the record and the scope field says how far they reach, so the number of
listens is a choice with precedent on all three settings — quick-18 covered five grooves
in one sentence, feature-25 covered eighteen.

- [ ] A) **Three targeted listens plus one blanket verdict over the rest.** The
  `musician` ranked what is actually at risk: `half-time` (605 ms, the longest absolute
  note and the most exposed bass in the catalogue at 1.92 voices per quarter),
  `bright-straight` (75% slot fill, the most connected of the movers), and `shuffle`'s
  three drawn grooves (whether the bass has gone forward, and whether closing the gap to
  its walking three reads as one feel). The other four feels' anchors go under one
  sentence. *(recommended — it spends the ear where the measurements say the doubt is,
  and the three named feels are the ones whose verdict could send the ticket to a
  per-feel `bassSustain: 2` instead)*
- [x] B) One verdict per feel — seven listens, one anchor each, each pin scoped to its
  own feel. Tidiest table; most of it spent on feels the measurements put at no risk.
- [ ] C) All 13 pins individually. Strongest record, and the only option where no pin
  rests on a verdict about a different groove — at 13 listens for a change that moved no
  onset, no velocity and no answer.

## Answered — Q1-B

**Q1-B. One verdict per feel — seven listens, one anchor each, each pin scoped to its own
feel.**

The 13 voided pins fall across exactly seven feels, so B is seven listens:

| feel | voided pins | play this one |
| :-- | :-- | :-- |
| boom-bap | groove-71, groove-72 | **groove-72** |
| bossa-nova | groove-57, groove-58 | **groove-57** |
| bright-straight | groove-17 | **groove-17** |
| half-time | groove-14, groove-38 | **groove-14** |
| second-line | groove-65, groove-67 | **groove-67** |
| shuffle | groove-07, groove-08 | **groove-08** |
| straight-funk | groove-01, groove-03 | **groove-03** |

* The one to play is the feel's anchor — the `lowRegisterShare` argmax — and the
  `musician` confirmed no argmax moves, so every anchor is the groove it already is.
* **shuffle is the exception, and it is picked on the risk instead.** Its anchor is
  groove-44, one of the three walking grooves whose render does not change and whose pin
  survives. So the listen goes to groove-08: it is the drawn groove that becomes the
  catalogue's second-most-forward bass, which is this feel's named doubt.
* The second pin in each two-pin feel is covered by that feel's verdict rather than by
  its own hash — the same reach `QUICK_18_SCOPE` had over five grooves, and each scope
  field says which feel and which grooves it speaks for.
* Seven verdicts, not one, means **no pin rests on a verdict about a different feel.**
  What it does not buy is a per-groove verdict: groove-38, -58, -65, -71, -07 and -01 are
  re-pinned on the words said about their feel's anchor.

### Q2. `second-line` is re-rendered by two tickets. Which order?

Q1-B gives `second-line` exactly one verdict, and quick-23 (🛠 Ready to build) re-renders
the same six grooves and voids the same two pins. One verdict per feel cannot survive two
separate re-renders of that feel — whichever lands second re-voids what the first pinned.

- [x] A) **Build quick-23 first, then this ticket.** groove-67 is played once, with both
  the earlier comp stab and the longer bass in it. *(recommended — 23 is already ready to
  build and is the smaller change, and one listen then covers both; the alternative is
  hearing this feel twice for one pin)*
- [ ] B) Build this ticket first and let quick-23 re-void second-line's two pins when it
  lands. Costs a second listen of the same feel, and quick-23's own sign-off then has to
  say it covers a bass length nobody had asked about.
- [ ] C) Build both in one commit. One render, one listen, one revert — but two tickets'
  changes in a diff neither ticket describes, and `git revert` stops being per-ticket,
  which is size-test question 4 for both of them.

## Answered — Q2-A

**Q2-A. Build quick-23 first, then this ticket.**

**Correction first: A's stated cost was wrong, and it does not change the answer.** The
option claimed A means groove-67 "is played once". It does not. Quick-23's own
`## Done when` requires its `SIGN_OFFS` re-pinned after a listen, so second-line gets a
verdict for the comp stab either way, and this ticket needs its own for the bass length.
Both orders cost two second-line listens, and neither listen is wasted — they are
verdicts on two different changes.

What A actually buys, and it holds:

* **This ticket's render is the last one, so its pins are stable.** Under B, quick-24
  would pin second-line and quick-23 would re-void those pins days later; a pin that is
  void before the ink dries is the one thing the table exists to prevent. Under A the
  order ends here.
* **This ticket's second-line verdict is given on the audio that ships** — the earlier
  comp stab and the longer bass in the same render. Quick-23's verdict is the one that
  covers less than the final audio, and that is the correct way round: it is the earlier
  change and its scope can say so.
* `groove-65` and `groove-67`'s scope fields under this ticket must name both changes,
  since by then the render carries both and a reader cannot tell from the hash which
  ticket moved what.

**Precondition this puts on the build.** `/implement-quick-feature 24` should not run
until quick-23 is built, signed off and committed. Its §3 re-runs the size test against
the real files, and second-line's template will be mid-flight until then — two tickets
editing `templates/second-line.ts` in one working tree is exactly the diff neither of
them describes.

## Notes

**Size test: question 3 fails, and Fred waived it in `## What`.** 1, 2 and 4 pass.
Re-run against Q1-B and Q2-A, which change none of the four. Seven listening passes
instead of four is more of the same work, not different work, and touches no extra file
beyond the seven scope fields in `gate.test.ts`. Q2-A adds an ordering precondition
rather than scope: it makes the rollback *cleaner*, since quick-23 lands and reverts on
its own before this ticket touches the same feel.

1. Nameable in five bullets — the change is two constants and one deleted short circuit. ✅
2. One module of six — catalogue. No answer moves: every groove keeps its bpm, root,
   mode and progression. ✅
3. **Fails.** 40 of 54 grooves re-render and 13 of 20 `SIGN_OFFS` pins void. Nothing
   *frozen* is touched — `docs/music.md` §What must never change is explicit that
   re-rendering audio is always allowed, and the change adds no RNG draw — but "anything
   that re-renders the catalogue is never quick" is the question's own wording and this
   is 74% of it. Waived: *"please make a quick-feature out of it. It affects many songs
   but the implementation is minimal."* ❌ waived
4. One `git revert` — one commit, 40 mp3s, the lock, the fixture and the pins. ✅

**The headline: changing `2` to `3` does not do what the ticket asks.**
`BASS_SUSTAIN_DEFAULT` plays three roles in `bassRing` (`events.ts:923-936`) — the
default cap, the floor, *and* the short-circuit boundary:

```
const cap = template.bassSustain ?? BASS_SUSTAIN_DEFAULT
if (cap <= BASS_SUSTAIN_DEFAULT) return BASS_SUSTAIN_DEFAULT   // every undeclaring feel
return Math.max(BASS_SUSTAIN_DEFAULT, Math.min(cap, sixteenths))
```

Raise the one constant and every undeclaring feel takes that short circuit and gets a
**flat 3 with no gap clamp** — precisely the outcome `## What`'s fourth bullet rules out,
approach note included. So the constant splits into `BASS_SUSTAIN_FLOOR = 2` (floor and
short-circuit boundary) and `BASS_SUSTAIN_DEFAULT = 3` (the cap). That is not a refactor
alongside the change; it **is** the change. Today no undeclaring feel rings at all.

A side effect worth keeping: after the split, `bassSustain: 2` on a template becomes a
meaningful per-feel **opt-out** — `cap <= floor` returns the flat floor. That is the lever
the shuffle risk below is answered with.

**Files this is expected to touch**

* `scripts/grooves/events.ts` — the split, and the short circuit re-keyed to the floor.
* `scripts/grooves/events.test.ts` — two tests go red on the split and want the floor
  rather than the default: `never rings a note shorter than the default…` and `leaves
  every feel that declares no bassSustain on the default`. A third, `caps every declared
  ring at the length the samples hold`, stays green but should compare against the floor.
* `public/grooves/` — 40 mp3s, plus `scripts/grooves/grooves.lock.json` and
  `scripts/grooves/events.fixture.json`.
* `scripts/grooves/gate.test.ts` — 13 pins re-pinned in the words Q1 settles.
* `docs/music.md` — the **Note length** block goes stale: open-ballad stops being "the
  one feel that declares it" and becomes the one feel that declares something *other
  than* the default. Same for the `events.ts:59-63` comment, whose "the drawn figure's
  two sixteenths leave as much silence as note" is what this ticket falsifies.

**Assumptions taken rather than asked**

* **One global 3, not a per-feel value.** The `musician` measured all eight and no feel
  wants to stay at 2. Four readings carry it: overlap counts and worst-case overlap are
  **byte-for-byte identical** before and after in all nine feels, because the overlapping
  notes are the gap-1 pickup pairs and they keep the floor; the approach note cannot
  lengthen in any feel (grid gap 1 at subdivision 16, gap 2 at subdivision 8, both lose
  to the floor); median slot fill goes 33% → 50%, so no feel becomes legato; and every
  moving feel lands at 50–64% duty cycle, between today's 37–48% and the two anchors
  already approved at 78% (open-ballad) and 88% (swung-sixteenth).
* **"2 sixteenths is the funk articulation" does not survive measurement.** What
  straight-funk has today is a *fixed gate* — all 332 of its bass notes are exactly 2.00
  sixteenths. Funk articulation is the long/short contrast, and the clamp produces it:
  106 notes stay at 296 ms while 224 go to 443 ms. The bass sample sits only 4.3–7.9 dB
  under its own attack at 440 ms, so this moves the hand-damp one sixteenth later inside
  the same articulation family rather than letting a note ring out.
* **`gain.bass` holds on all eight.** Bass-over-kick rises +0.50…+0.90 dB per groove,
  median +0.61…+0.76 — about half of two changes already signed off at unchanged gain
  (open-ballad's +1.24, shuffle's walking three at +1.40). Nothing got louder: velocity
  and attack are untouched and every onset peaks where it did, so the metric is reading
  note-time alone. Trimming 0.7 dB to hold it flat would quieten every bass *attack*
  below the one the player passed, to correct a level that did not move.
* **No gate risk.** All 54 grooves pass all seven checks at cap 3. RMS window
  −26.24…−21.01 against −29…−20, so 1.01 dB of ceiling headroom — held by groove-48,
  which does not move — and 2.76 dB of floor. True peak 0.8910 on all 54. Seam max 0.0024
  against a 0.02 limit. Cross-feel balance holds to 0.05 dB, so
  `templates/boom-bap.test.ts:243`'s 1.5 dB assertion against straight-funk stays green.
* **`shuffle` is the one at risk, and gain is the wrong lever.** Its drawn three reach
  −2.31 / −0.41 / −1.99 dB over the kick, making groove-08 the catalogue's
  second-most-forward bass. But −19.0 was chosen for its *walking* three, whose renders
  do not change and whose balance was signed off on its own pass, so a trim would quieten
  those three for nothing. If the drawn bass reads forward, the answer is
  `bassSustain: 2` on that template. In the other direction, `bossa-nova` may want its
  own `bassSustain: 4` — it stays the least sustained feel in the catalogue even after
  this — and neither is a change to make before an ear says so.

**Things in the tree worth knowing before this is built**

* **This ticket and quick-23 collide on `second-line`**, and Q1-B sharpened it from a
  nuisance into Q2: one verdict per feel cannot survive two separate re-renders of that
  feel. Ticket 23 is 🛠 Ready to build and re-renders the same six grooves, voiding the
  same two pins.
* **My own blast-radius figures were slightly wrong and the `musician`'s rendered
  numbers replace them.** 40 grooves re-render, not 42; 13 pins void, not 14 —
  `groove-44` is one of shuffle's walking three, so its render does not move. Per-feel
  notes-lengthened counts are 4–5 lower than the fixture suggested, because `fitToLoop`
  (`humanize.ts:84`) has already truncated each loop's closing note to 0.77–1.99
  sixteenths: those notes have the gap but cannot take the length. Note-time percentages
  agreed to a rounding, and no `lowRegisterShare` argmax moves in any feel — so every
  sign-off anchor stays the groove it already is.
* **`shuffle` gains an argument the other feels do not have.** `docs/music.md` records
  its drawn/walking split as something gain cannot fix. At cap 3 its drawn half goes from
  a flat 2.0 to a mean 3.17 against the walking half's 3.5, so the two halves stop
  sounding like different instruments.

## Built

* `scripts/grooves/events.ts` — the split. New exported `BASS_SUSTAIN_FLOOR = 2`;
  `BASS_SUSTAIN_DEFAULT` raised 2 → 3 and now only the default cap; `bassRing`'s short
  circuit and its `Math.max` re-keyed from the default to the floor. So every feel rings
  now, where before only a feel that declared `bassSustain` did.
* `scripts/grooves/templates/` — untouched. No `gain.bass` moved and no feel declares a
  new `bassSustain`; `open-ballad` keeps its 5.
* `public/grooves/` — 40 mp3s, plus `grooves.lock.json` and `events.fixture.json`.
  **14 grooves are byte-identical**: open-ballad's five, swung-sixteenth's six and
  shuffle's walking three. 1226 fixture lines differ and every one is a bass duration —
  no onset, velocity, midi or `music` block moved, and `src/features/daily-groove/data/`
  has an empty diff.
* `docs/music.md` — the **Note length** block rewritten around the two constants; a new
  paragraph under *Bass* recording the per-feel bass-over-kick measurement and why no
  gain moved; three quoted bass medians corrected to −4.91 / −4.85 / −4.86; the
  *Where to change what* row re-pointed at the floor.
* tests: `scripts/grooves/events.test.ts`, the block now 10. Five re-keyed to the floor,
  `leaves every feel…on the default` replaced by `rings every feel…up to the shared
  default`, and two new — the two constants' literals, and the long/short split measured
  per feel from the emitted stream.
* checks: lint clean · `npm test` 3060 passed · `npm run build` passes including
  `grooves:verify` · `npm run test:gen` **1607 passed, 14 failed**.
* verifier: **fail — one bullet, and it needs ears.** Report at
  `specs/quick/.verify/24.md`, citations checked, 4 parsed and 0 unresolved.
  * D1 — a note with room rings 3 where it rang 2, in every undeclaring feel: **done**.
    All 2522 notes checked: gap ≥ 3 → exactly 2.000 → 3.000, no intermediate value
    anywhere.
  * D2 — a note with a gap of 1 or 2 unchanged: **done**. 581 overlapping bass pairs
    before, 581 after, worst case 1.264 sixteenths either side. No feel gained an overlap.
  * D3 — open-ballad's five and the nine walking grooves byte-identical: **done**, and
    the seven surviving pins are all on those 14 grooves.
  * D4 — every `gain.bass` re-measured or left alone with the measurement: **partly**.
    The numbers are in `docs/music.md`, but nothing asserts them — `docs.test.ts` does
    not read that file — and nothing is committed.
  * D5 — every voided pin re-pinned in the words of a listening pass: **not done**.
  * D6 — a test covers the raised cap and the unchanged floor: **done**.

**What is left, and it is the seven listens Q1-B chose.** `npm run test:gen` fails 14
assertions across 13 `SIGN_OFFS` entries — groove-07 carries both a pcm and an mp3 hash,
which is why 13 entries give 14 failures. The seven to play, one per feel, from
`## Answered — Q1-B`: **groove-72, groove-57, groove-17, groove-14, groove-67,
groove-08, groove-03**. Then 13 pins and 7 scope fields, with groove-65 and groove-67's
naming both quick-23's comp stab and this ticket's bass length, per Q2-A.

Three things to listen for, in the `musician`'s order of doubt: **half-time** at 605 ms,
the longest absolute note and the most exposed bass in the catalogue; **bright-straight**
at 75% slot fill, the most connected of the movers; and **shuffle's groove-08**, whether
the bass has gone forward. If a feel is too long the lever is its own `bassSustain: 2`,
never a move back here — and if bossa-nova is heard as still short, its own
`bassSustain: 4`.

**Two things the notes did not predict, both found by tests rather than by reading.**
`docs.test.ts` asserts that `docs/music.md` quotes the bass medians three feels actually
render, so this ticket moved three figures out of date and they had to be corrected. And
`BASS_WALK_SUSTAIN`'s comment claimed the drawn figure holds two sixteenths and "leaves
as much silence as note", which is exactly what this ticket falsified.

## Re-graded after the verifier's findings

Four fixes went in and the verifier re-ran the full set: no grade moved, and the 14
failures are still the same 13 entries. `gate.test.ts` is the only failing file of 55,
and its other 67 tests pass — so all seven gate thresholds still hold on all 54 grooves.

* **The cap literal is now pinned.** No test held `BASS_SUSTAIN_DEFAULT` to 3, so 4, 5 or
  8 would have left the whole block green with only the fixture noticing. D6 now stands
  on its own test rather than on the fixture.
* `docs/music.md`'s *Where to change what* row still named the old constant and value;
  the block 370 lines above it had been rewritten and the row was missed.
* Two figures sharpened: 349 ms and 605 ms are a 3-sixteenth note **at each feel's mean
  tempo**, not a feel's mean note length, and neither is the catalogue's longest bass
  note — groove-20's 643 ms is. The "median slot fill 33% → 50%" claim was **removed**
  rather than defined: it did not reproduce as duration-over-gap and a number nobody can
  re-measure is worse in that document than no number. What replaced it is re-measurable
  — 1226 notes lengthened, 1270 held, 581 overlapping pairs either side.
* **The verifier withdrew its own D4 finding.** It had said `docs.test.ts` does not read
  `docs/music.md`; it does, in fourteen describe blocks, and `the kit-against-band
  balance figures` *renders the committed catalogue* and fails unless the document's
  quoted median sits within 0.01 dB of what the audio measures. So the three bass medians
  this ticket corrected are machine-verified, and the correction was forced by that test
  rather than volunteered. The narrower true statement: the two sustain constants appear
  nowhere in `docs.test.ts`, so the *Note length* block and the seven-feel *Bass*
  paragraph are the unguarded half of that document.
* **One finding not acted on.** `caps every declared ring…` bounds `bassSustain` at
  `>= BASS_SUSTAIN_FLOOR` and so admits a fractional declaration like `2.5`.
  `Number.isInteger` would close it, and it is deliberately left open: `BASS_WALK_SUSTAIN`
  is 3.5, so a fractional sustain is already something this system renders correctly, and
  a cap of 2.5 would clamp to a legal length. Rejecting it would be a rule invented by a
  test rather than by the music.
* D4 stays **partly** on the half that was always going to hold it there: nothing is
  committed, and nothing can be until D5 closes.

## Heard and signed off — 2026-09-10

> "it's nice. The bass sounds much fuller. That was definitely a good decision. All
> signed off"

All six `## Done when` bullets now hold. **D5 closes, and D4 with it.**

* Seven grooves played, one per feel per Q1-B: groove-72, groove-57, groove-17,
  groove-14, groove-67, groove-08, groove-03.
* 13 `SIGN_OFFS` entries re-pinned under `QUICK_24_APPROVAL` and seven per-feel scopes
  in `QUICK_24_SCOPES`. groove-07 took a new mp3 hash as well as a pcm one — it is the
  table's one entry that pins both.
* `second-line`'s scope names **both** changes, per Q2-A: the render played there carries
  quick-23's comp stab and this ticket's longer bass, and the hash cannot say which
  ticket moved what. That is the whole reason this ticket was built second.
* `shuffle`'s scope records that groove-08 was played rather than the feel's anchor
  groove-44 — groove-44 walks, so its render never moved and its pin stands — and that
  the verdict is read as covering the forward bass the analysis flagged rather than
  merely tolerating it.
* **14 approval constants went orphaned and are parked, not deleted.**
  `SUPERSEDED_APPROVALS` in `gate.test.ts` holds them verbatim, with a new test asserting
  none is back in the live table: an approval covers the render it was given about, and
  re-pinning an entry to a retired one would say a person approved audio they never
  heard. Fourteen at once is what a change re-rendering 40 of 54 grooves costs.
* `npm run test:gen` **1622 passed, 0 failed** · lint clean · `npm test` 3060 passed ·
  `npm run build` passes including `grooves:verify`.

**The comments this ticket added to `events.ts` were cut back afterwards.** They were
prose, which both `CLAUDE.md` files forbid, and the file's existing density is not a
licence. What is left is four lines: why the two constants are separate rather than one,
and why the gap is read off the grid. The reasoning lives in `docs/music.md` § Voicing,
which is the right home for it. `BASS_WALK_SUSTAIN`'s pre-existing comment was restored
to its own wording with only the clause this ticket falsified removed — it claimed the
drawn figure holds two sixteenths and leaves as much silence as note.
