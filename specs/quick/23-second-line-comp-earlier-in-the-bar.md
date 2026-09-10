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
