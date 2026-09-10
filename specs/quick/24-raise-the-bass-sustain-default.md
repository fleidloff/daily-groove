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

_Q1 answered below. Q2 is open._

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

## Notes

**Size test: question 3 fails, and Fred waived it in `## What`.** 1, 2 and 4 pass.
Re-run against Q1-B, which changes none of the four: seven listening passes instead of
four is more of the same work, not different work, and it touches no extra file beyond
the seven scope fields in `gate.test.ts`.

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
