# 15 — Multi-bar comp patterns

## What

* A comp figure may span more than one bar, written as one flat list of sixteenth-grid steps: `[0, 6, 12, 18, 24, 28]` is two bars — `bar = step >> 4`, `within = step & 15`.
* The field stays `patterns.comp` and the type stays `number[][]` — a pool of figures, one drawn per groove, exactly as today. Only the step range widens past 15.
* `assertSteps` in `scripts/grooves/patterns.ts:30` caps every step at `0…15` today, which is the one thing blocking it.
* Backward compatible by construction: every figure in `boom-bap`, `second-line` and the `COMP_PATTERNS` fallback sits under 16 and decodes to one bar, so nothing but bossa changes.
* Every bar of a figure must sound. A bar with no steps is rejected at load, naming the bar — the puzzle asks the player to name the chord, and the comp is what states its quality, so a resting bar is a bar with no answer in it. That rule is also what makes the derived length `(max >> 4) + 1` unambiguous.
* `bossa-nova` gets a two-bar comp, so the piano stops repeating one bar against a clave that alternates. `figures[0]` already alternates the rim over two bars; `patterns.comp[0]` is byte-for-byte the clave's 3-side and today plays it over both sides.
* `events.ts:500` draws one figure with `pick(rhythmRng, …)`. Keeping bossa's pool at four entries keeps that draw index identical, so the rhythm stream does not shift.
* `compIndex` at `events.ts:562` is built once from the whole figure and feeds `COMP_ACCENTS`; it has to be read per bar once a figure spans bars.
* Comp is emitted outside the fill/variation branch (`events.ts:866`), so a multi-bar figure only has to survive `barInPass % bars`. No interaction with `barRole`.
* Bass has the same one-bar limit and is not in scope.
* Six grooves re-render — groove-53 … groove-58 — and `SIGN_OFFS` for groove-57 and groove-58 go void.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* A template can declare a comp figure whose steps run past 15, and the notes land in the bar the step names.
* A figure with an empty bar inside it fails at load, naming the template and the bar.
* `boom-bap`, `second-line` and the `COMP_PATTERNS` fallback render byte-identical audio — only the six bossa mp3s change.
* `bossa-nova` plays a different comp bar against each side of the clave, audibly, over two bars.
* `COMP_ACCENTS` still cycles across the whole figure rather than restarting each bar.
* All six bossa grooves pass the seven gate checks with RMS inside −29…−20 dBFS.
* groove-57's and groove-58's `SIGN_OFFS` entries are re-pinned on a fresh listening verdict.

## Open questions

### Q1. Do the six bossa grooves share one comp rhythm, or draw one each? — **answered A**

The whole ticket turns on this, because it picks the container, the notation and the file.

- [x] A) **Keep the pool** — `patterns.comp` stays `number[][]`, entries may span bars, written flat `[0, 6, 12, 18, 24, 28]` *(recommended — engineering and catalogue reasons, both named below; the musical half is Q1's real content and is not mine to settle)*
- [ ] B) **Fix it** — the phrase moves to `figures` beside the clave it answers, nested `bars: [[…], […]]`, and all six bossa grooves play it

What each costs, measured rather than argued:

| | A) pool | B) figures |
| :-- | :-- | :-- |
| comp rhythm across groove-53…58 | one of N per groove | identical |
| `docs/music.md` "Where to change what" | needs a new row; the `figures` row already claims "a two-bar ostinato" and would become wrong | already routes here — the doc is on B's side |
| `templates/index.test.ts:443` | passes unchanged | fails twice: `patterns` keys lose `comp`, `figures` goes to length 2 |
| `patterns.ts` | `assertSteps`' `0…15` widens for comp only | untouched |
| `events.ts` | bucket the flat list by bar | figures loop skips pitched voices; comp block reads the figure |
| notation | flat, as asked for | nested, as the rim already is |

Neither fails the size test. B is the doc's own answer and puts the phrase four lines from the clave it answers; A keeps six grooves from sharing one comp line at −8.1 dB, the loudest pitched voice, in a feel that comes up about one day in nine.

## Answered — Q1-A

* **The pool stays.** `patterns.comp` keeps its type, `number[][]`, and its meaning — a pool of figures, one drawn per groove. Only the step range widens past 15, so a figure may span bars: `bar = step >> 4`, `within = step & 15`.
* **Flat notation**, as the question offered: `[0, 6, 12, 18, 24, 28]` is two bars.
* **`figures` is untouched** and keeps meaning *fixed*. It stays the home of the clave, and a comp entry in it stays wrong — which is worth a validator either way, because nothing rejects one today: `assertFigure` (`patterns.ts:128`) forbids only `snare`, so `figures: [{ voice: 'comp', … }]` type-checks, renders, and emits `midi: undefined` chords that `voices.ts:163` plays at the sample's root note. Wrong music, no error.
* **The `docs/music.md` row that routed "a two-bar ostinato" to `figures` is now wrong** and has to say which of the two a multi-bar figure goes to: `figures` when the feel always plays it, `patterns` when it is drawn.
* **Every entry in bossa's pool becomes two bars**, not some of them. `## Done when` asks for a different comp bar against each side of the clave, and a pool that still held one-bar entries would fail that on whichever grooves drew them.
* Nothing in A pulls in a second module, so the size test holds — see the verdict below, re-run against this answer.

## Notes

**Size test — passes, on all four.**

1. Five bullets: widen the comp step range past 15 · reject an empty bar · bucket per bar in the comp block · give bossa a pool of two-bar comps · re-render six and re-pin two. Five.
2. One module of the six — **catalogue** (`scripts/grooves/`, and `data/grooves.generated.ts` only if `headDelaySeconds` moves). No app source is touched.
3. `docs/music.md`'s four frozen things are all clear. `src/lib/hash.ts` untouched. `MUSIC_LABEL`'s draw order untouched — the change is on `RHYTHM_LABEL`, and `pick` (`rng.ts:20`) consumes exactly one `rng()` whatever the pool holds, so neither widening a figure nor changing the pool's length shifts the stream. `FLAVOURS` and the template's `flavours` untouched. No `uuid` moves. The doc's own line covers the rest: *"The audio itself is not on this list. Re-rendering every MP3 is always allowed."*
4. One `git revert` — the generator change, six mp3s, the manifest, the lock and the two re-pins are one commit.

**Files this is expected to touch.**

* `scripts/grooves/patterns.ts` — `assertSteps` (`:30`) caps every step at `0…15`; that cap is the only thing blocking the change. Widen it for comp alone, not for `assertFlatPool` generally (see the assumptions).
* `scripts/grooves/events.ts` — the comp block (`:866`) reads `compSteps` drawn once at `:500`; it needs the per-bar list. `compIndex` (`:562`) is built once from the whole figure and feeds `COMP_ACCENTS`, so it has to be read per bar.
* `scripts/grooves/templates/bossa-nova.ts` — `patterns.comp`, every entry rewritten as a flat two-bar phrase. The pool's length may change freely: `pick` (`rng.ts:20`) consumes one `rng()` whatever it holds, so only the selected index moves, never the stream.
* `scripts/grooves/patterns.test.ts` — `:140` and `:225` both assert that step 16 is rejected, quoting it. The comp case has to be carved out of `:140` without loosening bass, kick, hat or ghosts.
* `scripts/grooves/templates/index.test.ts:443` — asserts bossa's `patterns` keys and that `figures` has length 1. **Unchanged under Q1-A**, and worth keeping green as the evidence that `figures` stayed the clave's.
* `scripts/grooves/gate.test.ts` — `SIGN_OFFS` for groove-57 and groove-58. Both entries' `upstream` already names the target in as many words: *"its patterns pools for kick, hatClosed, bass, comp and snareGhosts"*.
* `docs/music.md` — the "Where to change what" table. Its `figures` row routes "a two-bar ostinato" there and is now wrong; it has to distinguish a multi-bar figure the feel always plays (`figures`) from one drawn per groove (`patterns`). `scripts/grooves/docs.test.ts:719` guards that row and asserts it still reads *fixed / never varies / clave*, so the edit has to keep those words while adding the fork.
* Six mp3s, `src/features/daily-groove/data/grooves.generated.ts` and `scripts/grooves/grooves.lock.json`, from `npm run grooves`.

**Assumptions taken rather than asked.**

* **The cycle length must divide `BARS_PER_PASS` (4)** — so 1, 2 or 4 bars, never 3. Two registry-wide tests are pass-aligned and would fail otherwise: `events.test.ts:749` (`expectFigureRepeats`, bar-for-bar across passes) and `events.test.ts:866` (`compIn(pass * 4)` equals bar one). Validated at load rather than discovered in a render.
* **Comp only.** `assertFlatPool` (`patterns.ts:42`) serves kick, hatClosed, bass, snareGhosts and the ride sub-pools, and none of their emission sites buckets by bar — a kick at step 18 would land two bars late with nothing to catch it. Making the capability generic means bucketing five more sites and fails size-test question 1.
* **Bass is out of scope**, as the ticket says, though it has the same one-bar limit.
* **No interaction with `barRole`.** Comp is emitted outside the fill/variation branch, which closes at `events.ts:836`, so a multi-bar figure only has to survive `barInPass % bars`.
* **The phrases are the `musician`'s, recorded below** rather than left to the build, because they came back measured. Four entries, and bar A of each is its **existing** figure unchanged — only bar B is new, so the odd bars sound exactly as they do today and the change is one thing an ear can isolate.
* `headDelaySeconds` is probed from the encoded file (`probe.ts:3`, ffprobe `start_time`) and may move by a frame for the six. That is a manifest diff `rerender-check` classifies as expected, not a changed answer.
* **`scripts/grooves/rerender-check.ts` is not the gate here.** Its stage 4 hardcodes `ridingIds` — grooves whose feel plays a ride — and bossa plays none, so it exits 3 on an audio-set mismatch. It was written for feature-24.
* **A comp figure in `figures` is now a mistake with a name.** Q1-A leaves `figures` meaning *fixed*, so `assertFigure` should reject a pitched voice outright rather than let it render at the sample's root pitch. One line, and it closes the trap this ticket walked into.

**Verdict: settled. No question is open.**

**The phrases — `musician`, dispatched under §7 for Q1's musical half.**

It reached Q1-A independently: *"The clave is a reference that must not move; the batida is not. João Gilberto's contribution was a varying right hand over a constant thumb and a constant underlying clave — varying it is the style, not a deviation from it."* On the doc's routing row: `figures`' qualifier is *a figure that never varies*, and this one should.

```ts
patterns.comp: [
  [0, 6, 12, 18, 22, 26],   // 1  2& 4   | 1& 2& 3&
  [2, 6, 12, 16, 28],       // 1& 2& 4   | 1     4
  [0, 6, 18, 26],           // 1  2&     | 1&    3&
  [2, 8, 12, 16, 22, 26],   // 1& 3  4   | 1  2& 3&
]
```

Against the clave's bar A = 1 · 2& · 4 and bar B = 2 · 3&: entry 0 locks to the 3-side then floats over the 2-side; entry 1 interlocks, taking 1 and 4 where the rim has 2 and 3&; entry 2 goes on-beat then off-beat; entry 3 mirrors itself, pushed-then-planted against planted-then-pushed.

Which groove draws which, measured: **53, 54, 57 → entry 3** · **55, 56 → entry 0** · **58 → entry 1**. Entry 2 is unheard until new seeds are minted — it still has to be written well, but it is not part of this listening pass.

**Three findings from that pass, and one of them corrects this ticket's framing.**

* **The clave-doubling is not the common fault.** Only grooves 55 and 56 draw entry 0 and double the 3-side; the other four already play something else. What all six share is the second thing `## What` names — one comp bar against a two-bar rim. The `## What` bullet stands as written; this is what it turns out to weigh.
* **No comp figure may hit step 14, and that is the engine, not taste.** A comp note is 4 sixteenths long and the voicing is the *current* bar's (`events.ts:866`), so a hit on 4& is not the bossa anticipation — it is the old chord ringing an eighth into the new one. No comp figure in the repo hits past 12. Real anticipation would need the comp block to reach `chordFor(barInPass + 1)`, which is a feature, not this ticket.
* **`COMP_ACCENTS` gets livelier, and the first version of this bullet said by how much and was wrong.** It claimed six hits against the five-entry cycle "shifts the shape each repetition". It does not: `compPhraseOffsets` indexes the hit's position in the phrase and resets at every phrase, so bar 3 carries bar 1's shape exactly and `pass` stays the only thing that walks it. What the change actually buys is **two accent shapes per phrase instead of one** — real, and smaller than claimed. Measured by the verifier on groove-53: bar 1 `2:0.6721 8:0.7145 12:0.6297` against bar 3 `2:0.6833 8:0.7042 12:0.6242`, the difference being humanize and not the cycle.

**Density — the gate cannot newly fail.** Comp is always three notes per hit, because the bass downbeat always states the root and `playedVoicing` (`events.ts:420`) drops it. Entries 0, 2 and 3 are hit-for-hit neutral, so grooves 53–57 do not move. Only entry 1 thins its even bars: −3 events × 8 bars = −1.5 a bar, taking groove-58 to ≈28.9 against a 20–36 band that `gate.ts:137` checks as an average. Per-bar range 25–32 today, 24–32 after. Every bar B's last hit is at or before step 10, so nothing new reaches the loop seam.

## Built

* `scripts/grooves/patterns.ts` — `assertSteps` takes a bar count (default 1, so every other pool keeps its `0…15`); new `assertPhrasePool` routes `patterns.comp` and adds the two rules that make the flat notation safe: the length must divide the four-bar pass, and no bar may be silent. `assertFigure` now rejects `bass` and `comp`, closing the trap that a pitched figure renders at the sample's root pitch with no error.
* `scripts/grooves/events.ts` — `figureBars` splits a flat figure into its bars; the comp block reads `compPhrase[barInPass % compPhrase.length]`; `compPhraseOffsets` indexes the accent by position in the phrase, so the two bars get different shapes. `COMP_ACCENTS` exported for the test.
* `scripts/grooves/templates/bossa-nova.ts` — `patterns.comp` is four two-bar phrases, bar one of each unchanged from what it was, so only the answering bar is new.
* `docs/music.md` — the routing table now forks: a multi-bar phrase drawn per groove goes to `patterns`, one the feel always plays goes to `figures`, and `figures` may not name a pitched voice.
* `scripts/grooves/bassFloor.test.ts` — catalogue event total 20123 → 20099, exactly the −3 × 8 the density note predicted for entry 1.
* `scripts/grooves/events.fixture.json` — regenerated (`node scripts/grooves/eventsFixture.ts --write`).
* six mp3s + `grooves.lock.json` re-rendered. `grooves.generated.ts` **unmodified** — no answer moved.

**Also in this diff, and not this ticket.** `bossa-nova`'s `gain.bass` −22.2 → −21.2, asked for mid-build. It had ticket 17 for an hour; that was deleted on request, so this bullet is the only durable record of it. Two `SIGN_OFFS` `upstream` strings at `gate.test.ts:1530` and `:1565` quote the gain and now say −21.2; `second-line` also sits at −22.2 and was left alone. Measured after: 53 −21.88 · 54 −23.38 · 55 −22.66 · 56 −22.32 · 57 −22.45 · 58 −22.34 dBFS.

**tests:**
* `patterns.test.ts` — comp takes a step past bar one where every other pool still refuses one; the pass-division rule; the silent-bar rule; `figures` rejects a pitched voice.
* `events.test.ts` — `figureBars` decode, single-bar equivalence with `gridSteps`, order-independence, and per-bar dedupe; `COMP_ACCENTS` running across the phrase, and a one-bar figure still repeating bar to bar.
* `bossa-nova.test.ts` — the pool is two-bar with both bars sounding; a different comp bar against each side of the clave in all six; the phrase repeating across the loop; the chord stated in the first two eighths; never on the "and" of 4; and the phrase's first bar sounding first.
* Three of those exist because the verifier said the first round's tests would pass against a broken implementation. It then killed ten mutants against the new ones. The eleventh — a reversed emission order — is the reason for the last bossa test; I confirmed it fails a `(barInPass + 1)` swap and restored the tree.

**checks:** lint clean · `npm test` 3057 · `npm run test:gen` 1562 · `npm run build` clean · `npm run grooves:verify` clean.

**verifier: pass** (`specs/quick/.verify/15.md`).

* D1 *a template can declare a comp figure whose steps run past 15* — `events.test.ts` `figureBars` group, four cases.
* D2 *a figure with an empty bar fails at load, naming the template and the bar* — `patterns.test.ts` "rejects a bar that sounds nothing". Wording note: it fails at first render, not at import — `assertPatterns` runs inside `buildEvents`.
* D3 *boom-bap, second-line and the shared fallback render byte-identical* — `eventsFixture.test.ts`; 6 of 54 keys differ, all bossa, `music` identical on all 54.
* D4 *bossa plays a different comp bar against each side of the clave* — `bossa-nova.test.ts`.
* D5 *`COMP_ACCENTS` still cycles across the whole figure* — `events.test.ts`, two tests.
* D6 *all six inside −29…−20 dBFS and passing the seven gate checks* — `catalogue-gate.test.ts`; −21.88…−23.38, density 28.81–30.69 against 20–36.
* D7 *groove-57 and groove-58 re-pinned on a fresh listening verdict* — Fred played them and said, verbatim, "the grooves sound good". `QUICK_15_APPROVAL` and `QUICK_15_SCOPE` carry the words and their limit: he did not say which of the six he put on.

**One thing the commit has to answer.** The quick door's fourth size question — one `git revert` — no longer holds for the tree as it stands. This ticket and the unticketed gain raise share `bossa-nova.ts` and the same six renders, and one listening verdict covers both, so they cannot be separated after the fact. Committing them as one is the honest option; splitting them would need the gain backed out, re-rendered, committed, and re-applied, which would also void a sign-off that has already been given.

