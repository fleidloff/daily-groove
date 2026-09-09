# 14 — Bossa turnaround does not read

## What

* bossa-nova's turnaround does not read — the fill exists but is inaudible against an ordinary bar.
* It lands twice in the 16-bar loop, not four times: `barRole` fires only on the last bar of a pass, and only the last pass gets `fill` and the middle pass `variation`, so bars 3 and 11 get nothing at all.
* The fill's only content is 4 snare hits at `gain -16`, the quietest voice in the feel. `hatClosed` is identical to an ordinary bar, the rim clave is untouched, and the fill's kick `[0,8]` is the sparsest of the four figures in the pool — so a fill bar can be thinner than the bar before it.
* The variation is the same minus one snare hit: `[4,12,14]` against `[4,10,12,14]`.
* `events.ts:251` states the intent — "A bossa has no drum fill: the hat and the clave never stop, and the turnaround is a snare push rather than a roll." The design is deliberate; what's open is whether a snare push should be audible at all.
* What changes is open: the snare's gain, the fill's snare figure, the kick figure, or the 8-bar spacing.
* Six grooves re-render (groove-53 … groove-58) and two sign-offs go void, groove-57 and groove-58.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Played back to back, bar 15 of groove-56 and groove-57 reads as a turnaround rather than as another ordinary bar.
* A fill bar is never thinner than the bar before it — its kick figure is at least as dense.
* All six bossa grooves pass the seven gate checks with RMS inside −29…−20 dBFS.
* groove-57's and groove-58's `SIGN_OFFS` entries are re-pinned on a fresh listening verdict.
* Whether the 8-bar spacing changed is recorded either way.

## Open questions

### Q1. What does the turnaround play? — **answered A**

The vocabulary is **kick and snare, and nothing else**. `hatClosed` cannot stop and has no denser figure at subdivision 8; `bass` and `comp` are emitted outside the role branch and a key for either in a `FillPhrase` would *add* `midi: undefined` events that `voices.ts:163` plays at the sample's root pitch; `rim` is a live lever the engine would allow and three assertions forbid (below). So the choice is what the kick and the snare do.

All three options share the same kick: **`[0, 4, 8, 12]` — the surdo opens to quarters.** That is the authentic bossa gesture (the surdo carries the phrase and marks its end by opening, never by rolling), and it is the part that does the work. It ties the densest surdo figure `[0,6,8,12]` on count but beats it on shape: **every figure in the pool leaves beat 2 empty**, so `[0,4,8,12]` states a position no ordinary bar in this feel has ever stated. It keeps clear of the "and" of 4, which `bossa-nova.test.ts:180` polices in fill bars too.

- [x] A) **Open surdo + a snare run** — `fill.snare [4, 8, 10, 12, 14]`, `variation.snare [4, 10, 12, 14]` *(recommended — the `musician`'s call: unbroken eighths from beat 3 to the top of the next bar is the left-hand answer into a phrase end, and beat 3 at velocity 1.0 is a stroke no bar in this feel has ever played)*
- [ ] B) **Open surdo + a marching snare** — `fill.snare [4, 8, 12, 14]`, `variation.snare [4, 10, 12, 14]`. Beats 2, 3, 4 plus the push instead of a run. The named fallback if A comes back cluttered at 122–138 bpm
- [ ] C) **A + the hat opens on the "and" of 4** — the one thing that would make it unmistakable, and a bigger call than a fill edit: it gives the feel a seventh voice

What each costs:

| | A) run | B) marching | C) + hatOpen |
| :-- | :-- | :-- | :-- |
| files | `events.ts` → `FILLS['bossa-nova']` | same | + `templates/bossa-nova.ts`, + `PLACEMENTS` |
| new gain to pick by ear | none | none | `gain.hatOpen` — the accent map lands it at velocity 0.449, so the number cannot be copied from another feel |
| registry tests broken | none | none | two: `events.test.ts:2476` (a feel that declares `hatOpen` and does not ride must open it on the "and" of 4 — bossa's would be `[]`) and `templates/index.test.ts:110` (`neither` is exactly `['bossa-nova']`) |
| gate risk | +0.375 events/bar against a 20–36 average, currently ~29 | lower | same as A |

**Why the rim is closed**, since it is the most idiomatic answer of all and worth saying out loud: a cross-stick push on the "and" of 4 is *the* bossa turnaround, `rimSteps` is empty for this feel so `resolvePhrase` would happily add one, and three assertions in `bossa-nova.test.ts` stop it — `:87` (the rim equals the clave in every bar, fills included), `:100` (40 rim strokes over the loop) and `:160` (the shared rim placement, which grids to exactly step 14, never sounds). Feature-25 R21/AC14 gave that up deliberately. The clave's value is that it never moves, and that argument is already banked.

### Q2. Does the turnaround stay every 8 bars, or land every 4? — **answered A**

`## Done when` asks for this recorded either way.

- [x] A) **Stays at 8 bars — bars 7 and 15, as today** *(recommended — musical and engineering reasons, both below)*
- [ ] B) Every 4 bars — bars 3, 7, 11 and 15 are all marked

The `musician`'s case for A, in terms a listener can check:

* **A bossa turns every 8 bars.** The clave is a two-bar cycle that groups into four, and the form is 8-bar sections — *Corcovado*, *Wave*, *Desafinado*, *Girl from Ipanema*, all AABA in eights. Bars 7 and 15 are the two phrase ends in a 16-bar loop.
* **Four marks collapse the period.** A gesture that recurs every four bars stops being a phrase marker and joins the ostinato — a 30-second file would announce itself as a 4-bar loop. `passes: 4` exists to stop exactly that.
* **All four candidates sit on the same side of the clave.** Bars 3, 7, 11, 15 are all `barInPass === 3` → `figures[0].bars[1]` → the 2-side. Marking all four puts the turnaround on bar B every time and on bar A never, reinforcing the two-bar cycle instead of the eight-bar one.

B's engineering cost, measured rather than argued — three registry-wide tests in `events.test.ts` use `bars[3]` as *the* ordinary bar a fill is measured against, and all three fail for bossa once bar 3 is marked:

| test | what breaks |
| :-- | :-- |
| `:1449` "puts the fill in the last bar of the last pass and nowhere else" | `distance(bars[15], bars[3])` goes to 0 when both are the same fill |
| `:1574` "`${feel.id} ends on a phrase of its own`" | same comparison, over six seeds |
| `:1600` "marks the last bar of the middle pass more lightly than the fill" | `ordinary = bars[middleBar % 4]` is `bars[3]`, no longer ordinary |

Doing it in `barRole` rather than per feel is worse again: `:1642` fails for the two-pass feels, and all 54 grooves re-render, voiding every one of the twenty `SIGN_OFFS`. If B is chosen, it has to be a per-feel opt-in and those three tests have to be rewritten around it.

## Answered — Q1-A, Q2-A

**Q1-A. The surdo opens and the snare runs.** `FILLS['bossa-nova']` becomes exactly:

```ts
fill:      { kick: [0, 4, 8, 12], snare: [4, 8, 10, 12, 14], hatClosed: [0,2,4,6,8,10,12,14] },
variation: { kick: [0, 4, 8, 12], snare: [4, 10, 12, 14],    hatClosed: [0,2,4,6,8,10,12,14] },
```

**Q2-A. The spacing does not move.** `barRole` and `middlePassOf` are untouched, bars 7 and 15 stay the two marked bars, and every cost the B column priced disappears with it: `events.test.ts:1449`, `:1574`, `:1600` and `:1642` are not opened, and no feel but bossa re-renders. That is the record `## Done when`'s last bullet asks for.

**Rendered, against the committed catalogue, before any code was written.** Struck drum events per bar, ghosts excluded the way `drumBars` excludes them, and `distance` from the ordinary bar 3 — the metric all three registry tests use:

| | ordinary (b3) | fill (b15) | variation (b7) |
| :-- | :-- | :-- | :-- |
| events | 15–16 | **19** | **18** |
| distance from ordinary | — | 4–6 | 3–5 |

In all six grooves `0 < distance(variation) < distance(fill)`, so `:1600` holds; both marked bars are denser than the bar before them, so `## Done when`'s second bullet holds on total events as well as on the kick. The sounded fill bar is `kick 0,2,4,6 · snare 2,4,5,6,7 · rim 2,5 · hat 0–7`.

**What the answer settles that the options did not spell out.**

* **Both marked bars open the surdo**, so the variation bar also becomes denser than an ordinary bar — 18 against 15–16, where today it is 15 against 17. "Thinned" was never a claim about absolute density: `docs/music.md:313` thins the variation *from the fill*, and `:1600` only asks that it mark less. Under this answer it marks less by exactly one stroke, in every groove.
* **That one stroke is `snare@4`, beat 3** — and it lands on top of the surdo's own beat-3 kick, because all four figures in the pool grid to a set containing 4. So it is 7.3 dB under a kick at the same instant, and the fill/variation separation is spectral rather than temporal. No snare has ever sounded on beat 3 in this feel, which is what makes it new; whether it reads *over the kick* is the one thing in this answer that only the listening pass can settle. If it does not, Q1-B's `[4, 8, 12, 14]` is the named fallback and is a two-character edit.
* **`rim` and `gain.snare` are closed for good**, not deferred — the first by feature-25 R21/AC14, the second by the measurement below.

## Notes

**Size test — re-run against Q1-A and Q2-A. Passes, on all four.**

1. Rewrite `FILLS['bossa-nova']`'s two phrases · comment the even-step rule where they are declared · guard `bass`/`comp` in `assertFill` · re-render six · re-pin two sign-offs. Five.
2. One module of the six — **catalogue**. No app source, no `data/`.
3. `docs/music.md`'s four frozen things are clear. A fill phrase is *fixed*, not drawn: it consumes no `rng()` on any stream, so `MUSIC_LABEL`'s and `RHYTHM_LABEL`'s draw orders are untouched. `src/lib/hash.ts`, `FLAVOURS`, the template's `flavours` and every `uuid` untouched. The doc's own line covers the rest: *"The audio itself is not on this list. Re-rendering every MP3 is always allowed."*
4. One `git revert` — the phrase edit, six mp3s, the manifest, the lock and the two re-pins are one commit.

**Measured: the fill bar is thinner than the bar before it in all six grooves, not sometimes.** Events per bar, bar 14 → bar 15 → bar 7 — **ghosts counted here**, unlike the tables under `## Answered` and `## Built`. Two things separate this row's 18–19 from `## Built`'s 15–17, not one: the ghosts are worth 2 (bar 14 reads 16–17 without them), and this table measures bar 14 alone where `## Built` measures every unmarked bar, the odd ones of which carry one rim stroke fewer:

| | ordinary (b14) | fill (b15) | variation (b7) |
| :-- | :-- | :-- | :-- |
| events | 18–19 | **16** | **15** |
| kick | 3–4 | 2 (grid `0, 4`) | 2 (grid `0, 4`) |
| snare | 2 struck + 2 ghosts | 4 struck | 3 struck |
| hat | 8 eighths | identical | identical |

**And a finding the ticket does not have: bars 7 and 15 are the same bar.** After `gridSteps` at subdivision 8, `fill.snare` sounds `[2, 5, 6, 7]` and `variation.snare` sounds `[2, 6, 7]`. Grid 2 and 6 are the ordinary backbeat. **Grid 5 is the clave's own bar-B stroke** — the fill's one extra snare doubles a rim stroke sounding at the same instant, 4.6 dB under it — and it is the *only* difference of any kind between the fill bar and the variation bar. Grid 7 is the fill's entire audible novelty, and for two of the four `snareGhosts` draws a snare is already there at ghost velocity, so even that is a velocity lift rather than a new note. So `## Done when`'s first bullet is not sufficient on its own: bar 7 has to read as *less* than bar 15, which today it does not.

**The snare's gain is not the cause, and that lever comes off the list.** Measured peak per hit — sample peak plus `20·log10(velocity/nominalVelocity)` plus template gain:

| hit | dBFS peak |
| :-- | :-- |
| kick, any quarter | −9.9 |
| **snare backbeat** | **−17.2** |
| snare push (vel 0.7) | −20.3 |
| rim clave stroke | −21.8 |
| hat downbeat | −26.9 |
| hat off-eighth · snare ghost | ≈ −33 · ≈ −31 |

The snare is the second-loudest voice in the feel — 5 dB above the clave, 10 dB above the loudest hat stroke. `−16` is the lowest *number* in `gain`, not the quietest sound: `VELOCITIES.snare.strong` is 1.0 where `rim` is 0.55, and the snare sample is 9.5 dB hotter than the rim's at peak. So the `## What` bullet's "the quietest voice in the feel" does not hold, and raising the gain would be a 16-bar lever pulled at a 2-bar problem, re-balancing an ordinary groove six sign-offs rest on. Not recommended, and now closed by Q1-A.

**Files this is expected to touch.**

* `scripts/grooves/events.ts` — `FILLS['bossa-nova']` (`:254`) and the comment at `:251`, which states the current intent and stays true under this answer: the hat and the clave still never stop, and it is still a push rather than a roll. The comment is worth extending with what the surdo now does, since opening it to quarters is the part a reader would otherwise take for a mistake. **This is the only production file the change touches.**
* `scripts/grooves/gate.test.ts` — `SIGN_OFFS` for groove-57 and groove-58. Both entries' `upstream` already names `FILLS[bossa-nova]` in as many words. The pcm hashes go null and both ids go into `PENDING_SIGN_OFFS` (`:1804`) until the listening pass; that list is empty on main today and is the declared way to hold a deferred pin.
* `scripts/grooves/events.fixture.json` — regenerate. `eventsFixture.test.ts:71` pins every event of all 54 grooves.
* Six mp3s, `src/features/daily-groove/data/grooves.generated.ts` and `scripts/grooves/grooves.lock.json`, from `npm run grooves -- --only groove-53 … groove-58`.

Not touched, and worth saying because the options priced them: `templates/bossa-nova.ts`, `PLACEMENTS`, `barRole`, `middlePassOf`, and the four `events.test.ts` fill invariants. Q2-A and Q1-A between them leave every one of those alone.

**Build it directly after quick-15, and share one render.** Quick-15 is sitting uncommitted in the working tree (`events.ts`, `patterns.ts`, `templates/bossa-nova.ts`, with `events.fixture.json` already regenerated) and has not rendered yet. It re-renders the same six grooves and voids the same two sign-offs as this ticket. Two renders and two listening passes for one set of files is waste, and a sign-off re-pinned between them would be a verdict on audio that is about to move again.

**Assumptions taken rather than asked.**

* **Every step in a bossa fill phrase must be even.** `scaleStep` is `round(step · subdivision / 16)` and `gridSteps` dedupes the collision silently, so at subdivision 8 half the written grid is unreachable: `[4, 6, 7, 10, 11, 14]` sounds as `[2, 3, 4, 5, 6, 7]` with two notes gone and no error. Every phrase in Q1 is written even. Worth one comment line in `events.ts` where the phrase is declared, because nothing catches it.
* **A `FillPhrase` cannot state dynamics.** `events.ts:806` calls `add(voice, bar, step, FILL_DURATIONS[voice])` with no velocity argument, so accenting the push without touching the other fourteen bars is not available. Adding that is a feature, not this ticket.
* **The ghosts stay out of the fill bar.** They render at ≈ −31 dBFS, 14 dB under the backbeat, and a turnaround bar should be less ambiguous than an ordinary one rather than more. Their absence is also invisible to the registry tests: `drumBars` in `events.test.ts` filters ghosts out before measuring.
* **`assertFill` should reject `bass` and `comp` keys**, the same trap quick-15 found in `assertFigure`. Nothing rejects one today: both voices pass `plays()` for this feel, so the phrase would add `midi: undefined` events that `voices.ts:163` plays at the sample's root note. Wrong music, no error. One line, and it belongs with this change because this is the ticket that edits a fill.
* **The fill's kick may leave the surdo pool.** `bossa-nova.test.ts:165` checks pool membership over `ORDINARY_BARS` only, which excludes `barInPass 3`. `:180` does bind fill bars, and only forbids the "and" of 4.
* **Gate headroom is not a risk.** +3 events on each of two bars is +0.375 events/bar against a 20–36 band checked as a loop average (`gate.ts:137`), with the six currently near 29. No onset lands later than 16th step 14, where the current fill already ends, so the seam check faces nothing new.
* **`rerender-check.ts` is not the gate here**, for the same reason quick-15 gave: its stage 4 hardcodes `ridingIds`, and bossa rides nothing.
* **Quick-16 is not a prerequisite.** It proposes relaxing the tests that pin template literals, and none of the assertions above is one this change needs relaxed — `bossa-nova.test.ts:165` and `:180` both stay green under Q1-A.
* **The fill/variation margin is one stroke, by construction.** `distance(variation)` beats `distance(fill)` by exactly 1 in all six grooves, so any later edit that adds a stroke to the variation flips `events.test.ts:1600` red. That is the test doing its job, not a fragility to design around — but it is worth knowing before the next bossa edit.
* **Both phrases keep the `hatClosed` line verbatim.** It is identical to an ordinary bar and must be: `resolvePhrase` replaces the bar wholesale, so a fill phrase that omitted the hat would stop it dead, which is the one thing `events.ts:251` says a bossa never does.

**Verdict: settled. No question is open.**

## Built

* `scripts/grooves/events.ts` — `FILLS['bossa-nova']`'s two phrases are Q1-A's: `kick [0, 4, 8, 12]` in both, `fill.snare` gaining step 8. The comment above them now says what the surdo does and why every step must be even. New exported `assertFill`, called at the `declared = FILLS[template.id]` site in `buildEvents` for both phrases, rejecting `bass` and `comp`. **The only production file the change touches**, as the notes predicted.
* `scripts/grooves/gate.test.ts` — groove-57 and groove-58 re-pinned on the listening verdict below, not deferred. New `QUICK_14_APPROVAL` / `QUICK_14_SCOPE`; `QUICK_15_APPROVAL` and `QUICK_15_SCOPE` deleted, because those two entries were their only consumers and the audio they were spoken about no longer exists. `PENDING_SIGN_OFFS` is untouched and still empty.
* `scripts/grooves/bassFloor.test.ts` — catalogue event total 20099 → 20135, exactly the +6 × 6 the two marked bars add.
* `scripts/grooves/events.fixture.json` — regenerated (`node scripts/grooves/eventsFixture.ts --write`).
* six mp3s + `grooves.lock.json` re-rendered. `grooves.generated.ts` **unmodified** — no answer moved, which is also the proof that a `FillPhrase` consumes no `rng()`.

**Measured after, against the prediction in `## Answered`.** Struck drum events per bar, ghosts excluded:

| | ordinary | variation (b7) | fill (b15) |
| :-- | :-- | :-- | :-- |
| predicted | 15–16 | 18 | 19 |
| measured | 15–17 | **18** | **19** |

Bar 3 and bar 11 are 15–16 and unmarked. RMS: 53 −22.79 · 54 −23.64 · 55 −22.45 · 56 −22.48 · 57 −22.40 · 58 −22.14 dBFS, all inside −29…−20.

**tests:**
* `bossa-nova.test.ts` — a new `describe`: the surdo pool leaves beat 2 empty; the kick opens to quarters in bars 7 and 15 **and nowhere else**, which is `## Done when`'s last bullet as a test rather than as prose; no marked bar is thinner than the bar before it, on the kick and on total struck events; bar 15 marks more than bar 7 and both more than every unmarked bar, bars 3 and 11 included, which `ORDINARY_BARS` alone excludes; the hat and the clave run unbroken through both. `Rendered` gained a ghost-excluding `struck` count for the last three.
* `events.test.ts` — `assertFill` rejects `bass` and `comp` and takes all thirteen drum voices; every phrase the registry declares passes, `DEFAULT_FILL` included; and one that swaps a pitched voice into `FILLS['bossa-nova']` and expects `buildEvents` to throw, so the guard is tested *installed* and not just written.

**checks:** see the verifier line below — lint / test / test:gen / build / grooves:verify.

**Two things the ticket got wrong, both found by building it.**

* **`grooves.generated.ts` does not change.** The notes listed it among the files to expect; `headDelaySeconds` came out identical for all six, so a render leaves it byte-for-byte.
* **`npm run grooves -- --only groove-53 … groove-58` was destructive**, and the ticket's own notes told me to run it. Fixed here, on request — see below.

## Also built — `--only` no longer truncates the catalogue

Not in the ticket. Added mid-build after `--only` wiped `grooves.generated.ts` from 54 grooves down to 6, and Fred asked for the footgun rather than a warning about it.

**What was wrong.** `optionsFrom` set `options.catalogue` to just the named ids, and `generate` builds three things from whatever catalogue it is given: the manifest (`writeManifest(entries, …)`), the option pools (`buildPools(entries)`) and the lock. So `--only` silently rewrote the manifest down to the ids it named, narrowed `SCALE_POOL` / `CHORD_POOL` / `PROGRESSION_POOL` to those grooves' answers, and dropped `HEARD_IN` — the last one deliberately, because `options.heardIn = {}` was the only way to stop `heardInFailures` complaining about the 48 scales that were no longer being rendered. A flag whose whole purpose is a subset re-render could not be used for one.

**What it does now.** `--only` sets a new `encodeOnly` instead of `catalogue`, and `generate` separates the two questions: every groove is still measured with `buildEvents` and still written to the manifest, the pools and the lock; only the named ids are mixed and encoded. Mixing is the expensive half, so a subset run stays fast. `options.heardIn = {}` is gone, so the heard-in table survives.

* `scripts/grooves/cli.ts` — `GenerateOptions.encodeOnly`; the render loop pushes every spec and `continue`s past the mix for anything not named; `optionsFrom` sets `encodeOnly` and stops narrowing the catalogue or clearing `heardIn`; the head delay is probed per file rather than all-or-nothing; the summary line reports what it encoded rather than what the manifest covers.
* `scripts/grooves/cli.test.ts` — the two option-level tests rewritten around `encodeOnly`, plus two new ones: `writes a manifest covering every groove, not only the ones it re-encodes` asserts the manifest names **every** catalogue id, that `pcm` holds only `groove-07`, and that `HEARD_IN` survives; `keeps every head delay a subset run does not re-encode` covers the probe. Reverting `cli.ts` to its old lines fails all four; verified by doing it.
* `gate.test.ts`'s two `npm run grooves -- --only <id>` recommendations are **left as they were** — they were right, the tool was broken.

Proved end to end: `npm run grooves -- --only groove-57 --only groove-58` now leaves `grooves.generated.ts` and `grooves.lock.json` byte-identical, still 54 grooves, and prints `rendered 2 of 54 grooves; the manifest covers all 54`.

**Size test, re-run with this in.** Question 1 is the one that gives: seven bullets, not five. Questions 2, 3 and 4 still pass unchanged — one module (`scripts/grooves/` is all catalogue), nothing frozen in `docs/music.md` moved, one `git revert`. Fred asked for the widening in as many words, which is the waiver, and it is recorded here rather than assumed. Worth knowing for next time: the escalation trigger was not the bossa edit outgrowing its ticket, it was a tool the ticket's own instructions told me to use being wrong.

**One detour, taken and then undone.** Following the notes, both entries first went `pcm: null` into `PENDING_SIGN_OFFS`, which meant rewording `pendingSignOff` and that list's contract — machinery shared by all twenty entries, for a mechanism feature-28 R27 wrote for "approved but not rendered" and not for "rendered but not approved". The verifier called it truthful but flagged three statements it left stale, and that the widened `upstream` strings satisfied the `/feature/i` guard through the phrase "rather than a feature" — a dodge. The listening pass landed before the fix round, so the whole detour reverted: both entries carry a hash, the list is empty, and no shared machinery moved.

**verifier: fail, then pass, then pass with findings taken.** Three rounds.

* **Round 1 — fail.** `npm run build` exited 1 on a type error vitest cannot see: `if (declared.variation)` does not narrow inside the arrow function passed to `expect`, and the repo has no standalone typecheck script, so it surfaces only in `next build`. Two coverage findings taken with it — `assertFill` was tested but not tested *installed*, and a case named for thirteen voices asserted three.
* **Round 2 — pass.** Both `pcm` hashes reproduce, the quote matches byte for byte in all three places, the `PENDING_SIGN_OFFS` detour is gone without trace, and `--only` was run for real in a scratch copy of the tree. Six non-blocking findings, four taken:
  * `QUICK_14_SCOPE` said "all six were played" where the words say "all of them" — the referent lives in the session, not the quote. Softened to claim exactly that and no more, since bounding the claim is the field's whole job.
  * **A widening this change caused.** The head-delay probe was all-or-nothing (`audioOnDisk ? probe all : zero all`). Harmless while `--only` measured only what it named; once the manifest covers the catalogue, one absent mp3 would write `headDelaySeconds: 0` for the other 53 and exit 0. Now probed per file — a first run with no audio still reads 0 everywhere, which is what the lock write keys off. `cli.test.ts` › `keeps every head delay a subset run does not re-encode` copies 53 committed renders into a temp dir, leaves one out, and fails against the old two lines.
  * `ORDINARY_BARS` filters out every `barInPass 3`, so bars 3 and 11 were pinned on their kick but never compared on struck events. That comparison now runs over `[...ORDINARY_BARS, 3, 11]`, with an assertion that neither marked bar leaked into the set.
  * The two measurement tables disagreed on ghosts and only one said so. Both now do.
  * Not taken, noted: a subset run's second half is no longer cheap — 54 `buildEvents`, 54 ffprobes, 54 lock hashes, and it fails if any *other* groove's events have drifted. That is the trade the fix buys, and it is the right way round.

Both fixes were mutation-checked by reverting the production lines and watching the new tests go red.

* D1 *bar 15 of groove-56 and groove-57 reads as a turnaround* — **settled by ear, 2026-09-09**: *"listened to all of them. I like the fill much better. Stilly subtle but audible"*. `bossa-nova.test.ts`'s `marks bar 15 more than bar 7, and both more than every unmarked bar` is the standing proxy.
* D2 *a fill bar is never thinner than the bar before it* — `bossa-nova.test.ts` › `never thins a marked bar against the bar before it`, on the kick and on struck events, all six grooves.
* D3 *all six pass the seven gate checks with RMS inside −29…−20* — `catalogue-gate.test.ts` › `accepts $id ($template)` over all 54; measured above.
* D4 *groove-57's and groove-58's `SIGN_OFFS` re-pinned on a fresh listening verdict* — both re-pinned on D1's words: `1490a02c…df57` and `2c7dbc94…8683`. `gate.test.ts` › `renders the exact audio that was played to a person and approved` passes for both.
* D5 *whether the 8-bar spacing changed is recorded either way* — it did not. `## Answered — Q2-A` is the record, and `bossa-nova.test.ts` › `opens the kick to quarters in both marked bars and nowhere else` is the test, so bars 3 and 11 staying ordinary is asserted rather than asserted-in-prose.
