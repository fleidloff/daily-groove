# 23 — Second line comp earlier in the bar

## What

* `second-line`'s comp stab lands earlier in the bar than it does today.
* Fred's reason: the comp is late, and that makes the root harder to guess.
* The pool is `comp: [[2], [6], [10], [11]]` — one stab a bar, and three of the four
  figures put it at beat 2.5 or later.
* Off the beat stays. The template says one stab a bar, always off the beat, and that
  is the style.
* Which steps replace them is a musical decision, not a number Fred named.
* The six `second-line` grooves are re-rendered.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Every figure in `second-line`'s `patterns.comp` places its stab in the first half of
  the bar.
* No figure places a stab on a quarter.
* question: does having 2 stabs per bar make sense stylistically?
* The other eight feels' comp pools are unchanged.
* The six second-line mp3s are re-rendered and their `SIGN_OFFS` entries re-pinned
  after Fred has listened.
* A test covers the placement bound rather than the literal steps.

## Open questions

_None._ The two musical calls were put to the `musician` and its recommendation was
taken directly, on Fred's instruction. Both are recorded as decisions under `## Notes`.

## Notes

### Size test — passes all four

1. **Yes.** One pool line in one template, one added assertion, six re-renders, two sign-offs re-pinned, fixture and lock.
2. **Yes.** One module — catalogue. Nothing outside `scripts/grooves/` and `public/grooves/`.
3. **Yes.** Nothing on *What must never change*. `patterns.comp` is drawn on `RHYTHM_LABEL`, not `MUSIC_LABEL`, so no committed answer moves; no `uuid`, no `flavours`, and `src/lib/hash.ts` untouched. Re-rendering audio is explicitly always allowed.
4. **Yes.** One `git revert` takes the pool, the test, the fixture, the lock and the audio together.

Cheaper than quick-20 by its whole design: no new constant, no new code path, no type change.

### The decision — `comp: [[3], [5], [2], [1]]`

**The order is load-bearing, not cosmetic.** `pick(rhythmRng, pool)` indexes a 4-member
array, so a same-length pool has every committed groove draw the *same index* it draws
today. The `musician` measured which index each shipped groove takes and assigned the
steps accordingly:

| groove | index | today | new | why |
| :-- | :-- | :-- | :-- | :-- |
| groove-70 | 0 | 2 | **3** | its own kick plays 3, so the piano doubles the tresillo stroke |
| groove-69 | 1 | 6 | **5** | its kit figure is the sparse "skeleton"; keeps one genuine mid-bar syncopation in the feel |
| groove-65, -66, -68 | 2 | 10 | **2** | the "and of 1" — canonical, and the only medium-velocity step left in the pool, so the three grooves that share this index get the safest option |
| groove-67 | 3 | 11 | **1** | the tightest push, and the one step empty of drums in all six grooves |

So the pool must keep exactly four members in exactly this order. Shortening it or
reordering it re-rolls which groove gets which stab.

### Step 6 is dropped, and this is the call worth reading

His `## What` names "beat 2.5 or later" as the problem; his `## Done when` says "first
half of the bar", which would *permit* step 6. The recommendation drops it, and the
reasoning is measurable rather than a taste:

* At 92 bpm a sixteenth is 163 ms. The bass sounds the bar's root on steps 0–1 and stops — **100% of bars, measured**. Step 6 puts the chord **652 ms after the root's onset and 490 ms after it stopped**. Steps 1/2/3 put it at −163, 0 and +163 ms, where two onsets fuse into one harmonic event instead of two the listener has to bridge from memory.
* Step 6 is the **busiest step of the bar in all six grooves** — kick at 0.84–0.88 *plus* a snare accent at 0.67–0.72, plus a closed hat in four of six. A chord onset there groups with the drum rather than reading as its own event.
* The counter-argument for keeping it is real and was weighed: 6 is the "and of 2", the 3-side of the son clave the template's own comments call the anchor, every kick figure plays it, and it is one of only two medium-velocity steps available. The reading is that **6 is early enough to be better, not early enough to be the fix.**

### The price, on the record before the listening

**Three of six grooves lose 1.53 dB on the voice that carries the chord.** Comp velocity
is positional — `strong 0.72 / medium 0.62 / weak 0.52` — and the only even (medium)
off-beat steps in the whole first half are 2 and 6. Dropping 6 means at most one pool
member can be medium. The shipped six go from **5 medium / 1 weak** to **3 medium / 3
weak**. That is the unavoidable cost of *off the beat + first half + one stab*, and it
works against the stated reason for the change.

If it matters on the listening, the fix is about **+0.8 dB on `gain.comp`** (−4.2 →
−3.4), which stays well inside `second-line.test.ts`'s 1.5 dB tolerance against
`straight-funk`. Not applied up front, because the level is not what was diagnosed.

**An unasked-for consequence.** Swing 0.22 delays an odd sixteenth by 18 ms, so a chord
on 1, 3 or 5 lands *swung with the roll*. Today five of six grooves stab on an even step
and the chord is unswung; with this pool three of six swing. `boom-bap` deliberately went
the other way — its comment says the chord lands unswung while the kit swings around it.
The `musician`'s view is that a street band's piano should swing with the sixteenths, but
calls that a prediction rather than a finding.

### Fred's embedded question — two stabs a bar: no, and not in this ticket

Answered rather than left hanging. **Stylistically it is fine** — New Orleans piano
comping is not sparse, and the rumba-boogie left hand plays the tresillo. The template's
"sparsest voice in this feel *by construction*" describes how the pool was written, not a
claim about the tradition, so there is no style objection.

It is rejected on three measured costs, none of which is style:

* **It does not help the root.** Two stabs state the *same* chord twice — one chord per bar is fixed by the progression. It adds rhythm, not answer. And the gain comes entirely from the early stab: a `[2, 10]` pool adds back the late chord being complained about.
* **Density.** A second stab is exactly **+3.00 events a bar** (the voicing is three notes in all 96 committed bars). One stab measures 21.94–29.06 over 2000 seeds; two measures 24.94–32.06 against a declared band of **21–30**. The gate rejects everything above 30, so the band would have to move to roughly 24–33.
* **Two tests, not one.** `toHaveLength(1)` is the easy one. The blocker is `second-line.test.ts` › *comps under every one of them*, whose premise is that this feel's comp events per bar stay strictly below `straight-funk`'s, `swung-sixteenth`'s and `bright-straight`'s minimum. Six a bar breaks the premise, not a literal.
* Level would have to move too: about −4.2 → −7.2 to hold the comp-over-kick relationship, so the chord ends up no louder, just more frequent.

If it is ever wanted, the second stab is `[3, 6]` — the tresillo minus its illegal
downbeat, both strokes in the first half — and it is its own ticket: density band plus
`gain.comp` plus two tests.

**A cheaper way to get variety, offered and not bundled:** a two-bar figure such as
`[2, 17]` — one stab per bar, position shifting bar to bar. `assertPhrasePool` allows it
(two bars divides the four-bar pass, both bars sound), density is unchanged, and the comp
stays the sparsest voice.

### The diagnosis is right, and it is the smallest of three fixes

Measured over the six grooves, 96 bars: **the comp emits three notes in every single
bar and never states the root** — `playedVoicing` drops it whenever the bass sounds that
pitch class, and the bass sounds the bar's root on step 0 in 100% of bars. The chord
sounds for 4 sixteenths, **25% of the bar**. So the player hears a low root for ~330 ms,
then ~1.3 s of drums, then a rootless three-note upper structure. A rootless C7 is
E–G–B♭, which implies nothing until it is tied to a C underneath it.

The worst case is **groove-67**: its stab on 11 sustains to 14, one sixteenth before the
bar line, so the last harmonic event of bar N is a rootless chord immediately followed by
a chromatic approach at 15 and bar N+1's root — the chord and the root the ear pairs it
with belong to different chords.

Two larger levers were identified and are **not** this ticket:

* **Sustain.** `add('comp', bar, step, 4, …)` is a 25% duty cycle. Six to eight sixteenths would ring the chord into the next bar's root, which is the fusion that is missing, and costs zero events. It is a shared constant, so it moves all nine feels.
* **Rootlessness.** Right in principle, but in a feel where the root sounds for 330 ms of a 2.6 s bar, the comp is the only voice that could hold it. A per-feel exception is the most direct answer to "the root is hard to guess".

Two things ruled out: the comp is **not too quiet** (−2.61 dB against its own kick, 0.08 dB
off `straight-funk`'s, the second loudest voice in the mix) and **not masked** (it runs
about 9 dB above the drums it collides with).

### Files this is expected to touch

* `scripts/grooves/templates/second-line.ts` — `patterns.comp`, four members, order fixed.
* `scripts/grooves/second-line.test.ts` — the placement bound the ticket asks for: `expect(figure[0]).toBeLessThan(8)` in the existing *declares one stab a figure, always off the beat* block. Its `toHaveLength(1)` and `step % 4 !== 0` assertions already pass and stay.
* `scripts/grooves/events.fixture.json` and `scripts/grooves/grooves.lock.json` — re-pinned.
* `public/grooves/groove-{65,66,67,68,69,70}.mp3` — `npm run grooves` then `npm run grooves:verify`.
* `scripts/grooves/gate.test.ts` — **groove-65 and groove-67 are pinned sign-offs** and both name `patterns.comp` in their own `upstream` lists, so the table already anticipates this. They are voided by the re-render and re-pinned only after Fred has listened, which is what his own `## Done when` bullet asks for.

### Assumptions taken rather than asked

* **No `gain.comp` change up front.** The level was measured and is not the defect; the +0.8 dB is held for the listening.
* **No density band change.** Measured identical before and after at 21.81–29.06 over 3000 seeds, so the 21–30 band is untouched.
* **Pool length stays four.** It is what keeps each groove on the index the table above assigns.
* **The two-bar-phrase option is offered, not taken.** It would change what varies rather than what the ticket asks for.

### One `## Done when` bullet is not a criterion

The third bullet reads *"question: does having 2 stabs per bar make sense stylistically?"*
That is a question rather than something a test or a look at the page can settle, so the
`verifier` would have nothing to grade it against. It is **answered above** — no, and
why. That section is yours, so replacing the line with the answer, or striking it, is
yours to do.

## Built

Built in the lead. The `musician` was dispatched during the analyze run and its
recommendation is recorded above as decisions, so nothing musical was re-derived here.

* `scripts/grooves/templates/second-line.ts` — `patterns.comp` from `[[2], [6], [10], [11]]` to **`[[3], [5], [2], [1]]`**, with the index→groove→step mapping and the reason step 6 was dropped written into the file. Nothing else on the template moved: `gain.comp` is still −4.2 and the density band is still 21–30.
* `scripts/grooves/second-line.test.ts` — two new tests, named for the ticket.
* `scripts/grooves/events.fixture.json`, `scripts/grooves/grooves.lock.json` — re-pinned.
* `public/grooves/groove-{65,66,67,68,69,70}.mp3` — re-rendered.
* `docs/music.md` — the kit-against-band balance paragraph, below.

**Rendered stab positions, confirming the mapping the decision rests on:**

| groove | before | after |
| :-- | :-- | :-- |
| groove-65 | 10 | **2** |
| groove-66 | 10 | **2** |
| groove-67 | 11 | **1** |
| groove-68 | 10 | **2** |
| groove-69 | 6 | **5** |
| groove-70 | 2 | **3** |

Four of six moved out of the back half of the bar. Every groove kept the pool index it
drew before, which is what the order was chosen to guarantee.

* tests: `puts every stab in the first half of the bar — quick-23` asserts every pool figure against `PATTERN_GRID / 2`, and `leaves the chord no later than the bar's midpoint, in every committed groove — quick-23` renders all six and asserts the emitted step. Both assert the **bound**, not the four literals — quick-16 asks that a feel's declarations stop being pinned to today's numbers, so the positions stay free to be re-turned by ear.
* checks: `npm run lint` clean · `npx vitest run --project app --project tooling` 3060 passed · `npm run test:gen` 1617 passed, **2 failed — the two voided sign-offs and nothing else** · `npm run grooves:verify` 54 grooves, 24 notes, all matching the lock.
* gate: all six pass the seven checks. Density unchanged at 24.1–26.8 against 21–30.

### The 1.53 dB landed, and it moved a figure in `docs/music.md`

Predicted in `## Notes` and now measured: `second-line`'s comp median fell **0.71 dB**,
from −2.61 to **−3.32 dB** over its own kick.

**The predicted count was wrong and the verifier caught it: two grooves lost 1.53 dB,
not three.** Only groove-69 (6 → 5) and groove-70 (2 → 3) crossed from an even step to
an odd one, where `VELOCITIES` drops 0.62 to 0.52. groove-65, -66 and -68 went 10 → 2,
even to even, and lost nothing; groove-67 went 11 → 1, odd to odd, and lost nothing
either. The "three" came from the adjacent and correct claim that the feel goes from 5
medium / 1 weak to 3 medium / 3 weak — which is a change of two grooves. The median
still fell 0.71 dB, further than either groove moved, because the two that changed
crossed the middle of the distribution. Nothing tests that sentence: `docs.test.ts`
scans only signed two-decimal figures and "1.53" carries no minus, so it was unguarded
prose.

That put it **0.63 dB** from `straight-funk`'s −2.69, past the **0.3 dB** the balance
paragraph in `docs/music.md` used to claim for all four figures. `docs.test.ts` reads its
threshold out of that prose, so the number chosen there is a real guard and not a
description.

It was first restated as **1.5 dB** — the tolerance the two template test files assert —
and the verifier's judgement was that this is honest but too wide: at 1.5 the sentence
only repeats what those files already check, and a drift of `boom-bap`'s comp from 0.27
to 1.4 dB would pass everything in the tree. It now reads **1.0 dB**, which covers the
measured 0.63 with headroom and leaves the sentence able to fail. The 0.3 dB detail
survives as prose about the three figures still that tight, and the guard that actually
catches drift — all six figures re-measured at a 0.01 dB tolerance — was never touched.

**`gain.comp` was deliberately not touched.** The ticket's own assumption held it back:
the level was measured and is not the defect. About +0.8 dB would restore the old median
if the listening asks for it, and that stays inside the 1.5 dB tolerance.

### Heard and approved

groove-65 and groove-67 are pinned sign-offs, voided by the re-render and **not
re-pinned** — nobody has heard this audio. Their `gate.test.ts` entries already name
`patterns.comp` in their own `upstream` lists, so the table anticipated this change.

Three things to listen for, in the order they are likely to matter:

1. Whether the chord is easier to tie to the root at all — the whole point.
2. Whether **step 1** reads as a syncopation or as a late downbeat. It lands 181 ms after the beat with swing, and it is the pool member the `musician` was least sure of. It is groove-67's.
3. Whether the 1.53 dB loss matters on the two grooves that took it — **groove-69 and groove-70**.

One unasked-for consequence to listen for as well: swing 0.22 delays an odd sixteenth by
18 ms, so **three of six chords now swing with the roll** where five of six used to land
unswung. `boom-bap` deliberately went the other way.

## Verified

`specs/quick/.verify/23.md` — **pass with gaps**, all five citations resolving.

| bullet | grade | what settles it |
| :-- | :-- | :-- |
| D1 first half of the bar | **done** | `second-line.test.ts` › *puts every stab in the first half of the bar — quick-23* |
| D2 no stab on a quarter | **done** | the existing *declares one stab a figure, always off the beat* block |
| D3 *"does 2 stabs make sense"* | **not gradeable** | a question, not a criterion — answered in `## Notes`, and the line is yours to replace or strike |
| D4 other eight pools unchanged | **done** | `eventsFixture.test.ts` › *deep-equals what the generator builds today* |
| D5 re-rendered, re-pinned after listening | **partly** | re-render done; re-pinning correctly withheld until you have heard it |
| D6 a test covers the bound | **done** | both new tests, **16 of 16 mutations caught** independently by each, moving one figure to 9/10/11/13 at each of the four indices |

Checked rather than taken on trust: the index→groove→step mapping probed with a marker
pool (70→0, 69→1, 65/66/68→2, 67→3, and the old pool reproduces 2/6/10/11 at those same
indices); all six dB figures to the digit; the fixture showing 54 keys with six entries
moved, `music` unchanged in all six and **every non-comp event byte-identical**; and all
six passing the gate — density 24.13–26.75, loudness −21.12…−22.85 with 1.12 dB the
tightest margin, worst seam 0.00194 against 0.02.

Two things it found wrong, both fixed above and in `docs/music.md`: the 1.53 dB **count**
(two grooves, not three) and a stale comment in `second-line.test.ts` still quoting
comp −2.61 and 1.42 dB of room — the first thing a reader consults when that assertion
goes red. The bound in the balance paragraph was narrowed from 1.5 to 1.0 on its
recommendation.

Two residuals it named and neither is fixed:

* **A reorder of the pool is caught but not diagnosed.** Four reorderings all pass both new tests and the whole comp block; only `eventsFixture.test.ts` catches them, and it reads as a six-groove fixture mismatch rather than "you re-rolled which groove gets which stab". The file comment is what carries that warning.
* **A two-bar figure such as `[2, 17]` passes the bound test**, because `17 % 16 = 1`. Out of scope here, and worth knowing if the two-bar option in `## Notes` is ever taken.

The quick door still fits on all four questions: one module, nothing frozen, one revert.

## Heard and approved — row ✅ Done

2026-09-10, over all six:

> listened to all grooves. all sound good

So groove-65 and groove-67 are re-pinned to this render, on `QUICK_23_APPROVAL`.
`QUICK_23_SCOPE` records what the words reach and what they do not: they cover **where
the chord sits**, which is the whole change, and the two consequences of that placement
that were predicted before he heard them and are not mix decisions —

* **level**, the 1.53 dB on groove-69 and groove-70 and the 0.71 dB median fall, with `gain.comp` untouched at −4.2 and +0.8 dB named as the lever if it is ever judged too soft;
* **swing**, three of six chords now landing with the roll where five of six were unswung, which nobody asked for.

What the scope does not claim: the words name the set of six rather than a render, so
neither pinned groove is known to have been played on its own; groove-66, -68, -69 and
-70 draw the new pool unpinned; and the `musician`'s specific doubt about **step 1** on
groove-67 was put to him only as part of the whole set.

**D5 is now done.** D1, D2, D4 and D6 were already done; D3 is not a criterion, so every
gradeable bullet holds.

* checks after the re-pin: `npm run lint` clean · `npx vitest run` all green · `npm run grooves:verify` — 54 grooves, 24 notes, all matching the lock.

**One line in `## Done when` is still a question**, not something a test can settle:
*"question: does having 2 stabs per bar make sense stylistically?"*. It is answered under
`## Notes` — no, on three measured costs — and replacing the line with that answer, or
striking it, is yours to do. The row is ✅ on the five bullets that are criteria.
