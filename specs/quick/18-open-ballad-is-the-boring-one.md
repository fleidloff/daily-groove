# 18 — Open ballad is the boring one

## What

* Fred's ear: open-ballad is "boring and too slow". Sam half-agrees — boring yes, too slow no.
* **Keep the tempo.** Sam argues hardest for it: 440 ms per 8th at 68 bpm against bossa's 230 ms is the room to hum a note and hear whether it fits, and it is the only band on the rota he would get an instrument out over.
* If any tempo number moves it moves *up* toward 74 and spreads — all five shipped grooves sit in a 6 bpm window at the bottom of a declared 62–74 range.
* **The flavour monoculture is the real crime.** 4 of 5 grooves are lydian dominant, and `lydian-dominant` appears in no other template, so the style and the mode identify each other. Sam: "I play Wordle every morning — I will find that shortcut, and once I have, the slow day stops being a puzzle and becomes a recall."
* Both its flavours are altered scales, so it is one of three styles shipping nothing familiar to land on — the persona's premise is that he can hear it and can't name it, and two altered scales means neither.
* **It is the emptiest style in the app per second** — 6.9 events/sec against bossa-nova's 16.0, off a mid-pack 24.2 events a bar. Tempo is doing that, not the note count.
* `density.minPerBar: 8` is not the lever: the five grooves sit at 23–25 events a bar, +16 over the floor, and the floor only gates minting. More notes per bar means `patterns` / `figures`.
* **One marked bar in the 8-bar loop, not two** — `middlePassOf` returns null for a two-pass feel. Loop *duration* is a red herring: 8 bars at 68 bpm is ~28 s, the same wall-clock as 16 bars of bossa at 128.
* Whether that arrives as 16 bars or as two marked bars inside 8 has **no persona bearing** — "I can't hear a `passes` value, I can hear whether the loop breathes twice."
* No skip button and no style chooser — "a style chooser turns one thing a day into a library."
* **Size test waived in advance**, in chat: "let's do a quick ticket and ignore the size". Two asks fail it alone — the flavour edit touches `flavours` on `docs/music.md`'s frozen list, and a second marked bar needs `events.test.ts:1449`, `:1574`, `:1600` and `:1642` rewritten or it re-renders all 54 grooves and voids all twenty `SIGN_OFFS`.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Two open-ballad days running can land different modes, and no mode identifies the style.
* It ships at least one flavour a player has a chance of naming — or the ticket records why it still ships two altered scales.
* It is no longer the emptiest style per second by a clear margin, measured the way `## What` measures it.
* Its loop breathes twice — two marked bars, however that arrives.
* The tempo band still starts below 75 bpm and the shipped grooves spread across more than 6 bpm of it.
* Every groove whose answer moved is recorded, and its `SIGN_OFFS` entry re-pinned on a fresh listening verdict.
* A test covers the flavour spread and the marked-bar count.

## Open questions

### Q1. Does open-ballad move to the sixteenth grid, or stay on the eighth?

This is the density decision, and it turned out to be one question rather than two. The `musician` was asked for a hat pool and a density target separately and came back saying they are the same decision, because **on the eighth grid open-ballad's variety has nowhere to live.** Three shared pools lose their meaning at `subdivision: 8`:

| Pool | What it was written to mean | What open-ballad plays |
| :-- | :-- | :-- |
| `HAT_PATTERNS`, 3 figures | eighths / sixteenths / broken | all three grid to the same straight eighths — **the draw is a no-op** |
| `KICK_PATTERNS`, 5 figures | 2 of 5 carry an "e" or an "a" | `[0,3,6,10]` → `[0,2,3,5]`, `[0,7,10]` → `[0,4,5]`: both lose the pickup and gain a downbeat |
| `SNARE_GHOST_PATTERNS`, 5 figures | `docs/music.md` — a ghost fills the space *between* backbeats | `ghostSteps` forces odd, so `[3,11]` → `[1,5]`, the "and"s, where the hat already is |

And one more, measured rather than argued: `accentedVelocity` (`events.ts:612`) calls `velocityFor(voice, sixteenth)` on the **16-grid** position, so at `subdivision: 8` every hit lands on an even sixteenth and `weak` is unreachable — `VELOCITIES.hatClosed.weak` of `0.32` is a level this feel has never played. Measured hat velocity floor: open-ballad `0.251`, half-time `0.124`. `HAT_ACCENTS` still spreads what it gets, so the audible effect is narrower than "two levels", but the base table gives it two of three.

- [x] A) **`subdivision: 8 → 16`, plus its own `patterns` for `hatClosed`, `kick`, `bass` and `comp`** *(recommended — the `musician`'s call, and the only option that changes all 32 bars rather than one or two)*
- [ ] B) **Stay on the eighth grid.** Declare the single hat figure `[[0,2,4,6,8,10,12,14]]` so the invariance is stated in the template instead of hidden in a no-op draw, and find density by stacking more voices onto the same eight positions
- [ ] C) **A's grid move, hat pool only.** The smallest version of A: three real hat figures, no kick/bass/comp pools

What each costs:

| | A) grid + four pools | B) stay at 8 | C) grid + hat |
| :-- | :-- | :-- | :-- |
| events/sec, median | 7.32 → **9.15** (band 7.49–11.25) | **falls** — all eight eighths already sound, so any hat pool with variety in it is emptier | ~8.6 |
| rank among nine feels | 9th → 6th, and its *floor* beats half-time's and boom-bap's | stays 9th | 8th |
| `density` band | must move `{8, 30}` → `{27, 37}`; measured 28.75–36.63 per bar over 60 000 seeds | unchanged | must move |
| `events.test.ts:2213` | at risk — pins open-ballad's mean comp velocity at `0.546818` ±0.02, and a new comp pool moves which `COMP_ACCENTS` positions are used | safe | safe |
| gate risk | loudness. The comp goes 2 → 3 onsets a bar at `gain: -5.9`, the loudest voice by 9 dB — the `musician` estimates +1 to +1.5 dB RMS against ~2 dB of headroom under the −20 ceiling, and says explicitly that is an estimate from the gain table, not a measurement | none | small |

**B is listed because it is the honest alternative, not to be dismissed.** Its argument is that rhythmic interest at 68 bpm comes from subdividing, not from stacking, and B is the option that refuses to subdivide — so it has to make the bar thicker instead. The `musician` recommends against it for that reason.

### Q2. Does the loop get a second marked bar, and at what price?

`middlePassOf` returns null for a two-pass feel, so bar 8 is marked and nothing else is.

- [ ] A) **A per-feel marked-bar opt-in in `events.ts`.** At `passes: 2` the marks land on **bars 4 and 8** — antecedent and consequent of an 8-bar strain, which is the standard ballad form. Costs `events.test.ts:1449`, `:1574`, `:1600` and `:1642`, all four of which use `bars[3]` as *the* ordinary bar a fill is measured against, and bar index 3 becomes open-ballad's variation bar *(recommended — the `musician`'s call, and the only option that changes the rate)*
- [ ] B) **`passes: 2 → 4`.** One line, and `middlePassOf(4)` returns 1 so the variation bar arrives free
- [x] C) **A `figures` entry on `hatOpen`** — `bars: [[14], [14], [14], [10, 14]]`, so the hat opens twice in bar 4. No draw, no re-key, no test rewrite. Not a marked bar in the `barRole` sense, so it would not satisfy a test on the marked-bar count
- [ ] D) **Nothing.** Q1 already changes every bar; the marked bar is 2 bars of 8 against that

**B buys the listener nothing, and this is why**, because it is the option that looks obviously right:

| | marked bars | loop | one marked bar every |
| :-- | :-- | :-- | :-- |
| today | 1 (bar 8) | 28.2 s | **28.2 s** |
| B) `passes: 4` | 2 (bars 8, 16) | 56.4 s | **28.2 s** |
| A) opt-in | 2 (bars 4, 8) | 28.2 s | **14.1 s** |

B doubles the loop and the marked bars together, so the rate is unchanged — and it makes open-ballad the longest file in the catalogue by 25%, ~1.3 MB against today's 660 KB. Its marks at 8 and 16 also leave bars 4 and 12 unmarked, which is the same seven-identical-bars complaint the ticket opened with. A is both cheaper in duration and the better musical answer; what it costs is four registry tests.

## Notes

**Size test — fails questions 1 and 3, waived in `## What` before this run started.** 2 and 4 pass on their own merits.

1. **Fails.** Three independent decisions, not five bullets: the grid, the marked bar, and the flavours — each with its own mechanism and its own blast radius.
2. **Passes.** One module — **catalogue**. Everything is `scripts/grooves/`, plus the manifest, the lock and the mp3s it writes.
3. **Fails on the flavour half only.** Q1 and Q2 as scoped touch nothing frozen: `subdivision`, `patterns`, `figures`, `density` and `passes` are all template parameters that `docs/music.md`'s *Where to change what* table routes to `templates/<feel>.ts`, and none is on the *What must never change* list. The flavour ask is the one that is, and see the next section — it turns out not to be reachable from this ticket anyway.
4. **Passes.** One `git revert` — the template, `events.ts`, five mp3s, the manifest, the lock and the sign-off re-pins are one commit.

**Two `## Done when` bullets are not reachable at five grooves, and the reason is arithmetic rather than effort.** This is the ticket's main finding and it wants an answer before Q1 or Q2 matter.

* `lydian-dominant` is offered by **`open-ballad` alone** — no other template names it.
* `manifest.test.ts:397` requires the manifest to carry a groove for **all twelve** modes, so it cannot drop to zero.
* `manifest.test.ts:340` caps the spread at `DOMINANCE_RATIO = 2`. The commonest modes are dorian and phrygian at 6, so **the rarest must be ≥ 3**.
* Therefore open-ballad must render **at least 3 lydian-dominant grooves**. With five grooves and two flavours the widest available spread is **3:2** — against today's 4:1. That is the ceiling, and it does not deliver "no mode identifies the style".
* A third flavour needs ≥ 3 grooves of each of three modes, so **nine open-ballad grooves minimum** — and the third mode has to be one currently at 4 or 5, or a new entry appended to `FLAVOURS`, because a mode already at 6 would raise the cap's ceiling and with it the floor.
* **The 4:1 is not a bad draw. It is quick-12's fix working.** `manifest.test.ts:334`'s own comment: *"lydian-dominant 1 → 4 from three open-ballad grooves."* groove-77, ‑78 and ‑79 were minted precisely to raise it off the floor. Undoing the monoculture undoes that.
* So the flavour bullets need a mint, a `flavours` edit, a `ROTA_EPOCH` bump, and the cap widened in all three copies — `manifest.test.ts`, `catalogue.test.ts` and `grooves.generated.test.ts`. **That is its own ticket, and it is the one that should be a feature.** Strike those two `## Done when` bullets or split them out; nothing in Q1 or Q2 touches them.
* Also unreachable from Q1 or Q2: **the tempo-spread bullet.** `bpm` is the first draw on the frozen `MUSIC_LABEL` stream and depends only on `tempoRange`, so the five shipped grooves keep 71, 67, 70, 65 and 68 whatever else changes. Widening `tempoRange` re-rolls all five; minting spreads them without moving the existing five. Both are outside this ticket.

**A defect to fix whatever Q1 and Q2 decide.** `DEFAULT_FILL` names no `hatClosed`, and `resolvePhrase` replaces a marked bar's voices wholesale — so **bar 8 of every open-ballad groove has no hi-hat for 3.5 seconds.** Counted rather than reasoned: 49 hat hits per loop is exactly 7 bars × 7, the eighth bar contributing none. That is a hole, not a fill, and it is why bossa and second-line both declare a hat in theirs. The `musician` proposed a full `FILLS['open-ballad']` entry that marks the bar by *changing* the hat rather than out-counting the bar, keeps both backbeats, and declares only `fill` so `withoutToms` gives the variation for free.

**Files this is expected to touch.**

* `scripts/grooves/templates/open-ballad.ts` — `subdivision`, a new `patterns` block, `density`, and under Q2-B or Q2-C `passes` or `figures`. **The one template file.**
* `scripts/grooves/events.ts` — `FILLS['open-ballad']`, new, for the hat hole. Under Q2-A also `barRole` / `middlePassOf`, which is the only edit in this ticket that reaches past open-ballad.
* `scripts/grooves/events.test.ts` — `:1449`, `:1574`, `:1600`, `:1642` under Q2-A only; `:2213`'s pinned mean comp velocity under Q1-A only.
* `scripts/grooves/templates/index.test.ts` — nothing expected. Checked: `:58` needs more than one subdivision in the registry and bossa, bright-straight and shuffle keep 8; `:320` bounds `humanize.timingMs` under half a step, which at subdivision 16 and 74 bpm is 101 ms against the declared 11.
* `scripts/grooves/gate.test.ts` — `SIGN_OFFS` for **groove-78 and groove-79**, open-ballad's two entries. Both void on any re-render and both name the template file in `upstream` already.
* `scripts/grooves/events.fixture.json` — regenerate.
* Five mp3s, `grooves.lock.json`, and `src/features/daily-groove/data/grooves.generated.ts` only if a measured `headDelaySeconds` moves.

**Assumptions taken rather than asked.**

* **No committed answer moves under Q1 or Q2.** `MUSIC_LABEL`'s draw order is `bpm → root → flavour → buildHarmony`, and none of `tempoRange`, `ROOTS`, `flavours` or harmony is touched. Rhythm is drawn on `RHYTHM_LABEL`, still exactly four `pick()` calls — a declared pool is the same draw against a different table. `figures` entries cost no randomness. So the five grooves keep their bpm, root, mode and progression; only the audio moves.
* **`heard-in.json` is not at risk.** None of open-ballad's five scales appears in its 21 entries, so `heardInFailures` cannot fire on a flavour or a rhythm change here.
* **Re-render with a full `npm run grooves`, not `--only`.** Quick-14 fixed `--only` so it no longer truncates the manifest, but a full run is still what the previous bossa re-render did and it is the cheaper thing to verify.
* **No toms in the ordinary bar**, though it is the obvious extra density. Musically a ballad's toms answer a phrase rather than keep time, and it is blocked twice: a `figures` tom entry fails `events.test.ts:1477`'s `!declaresKitToms` branch, and the `patterns.kit` route only permits a tom line identical in every ordinary bar — the ostinato the `musician` rejected. Buying them would cost the same class of test rewrite as Q2-A.
* **No `patterns.kit`.** It would take over the snare line, and `[4, 12]` is right for a ballad — `docs/music.md`: *"a groove whose backbeat moves is a different groove."* It would also open a `KIT_LABEL` draw for nothing.
* **`swing` and `humanize` stay put.** `docs.test.ts:515` requires `docs/music.md` to keep naming `open-ballad` as considered-and-declined for swing and to name `0.02`, so swing is pinned by prose as well as by ear. `timingMs: 11` is left alone under Q1-A even though it would then apply to hits 220 ms apart rather than 440 ms — changing it in the same pass would muddy what the listening sign-off is signing off. 9 ms is the fallback if it flams.
* **`density.minPerBar` is a consequence, not a fix.** It only gates minting, and the five shipped grooves already sit at 23–25 a bar with +16 of headroom. It has to move under Q1-A because the measured band would otherwise breach the declared ceiling of 30.
* **Every step in a written figure must respect the grid.** Under Q1-B the eighth-grid pool must be all-even, the same trap quick-14 documented: an odd step lands on its neighbour and `gridSteps` dedupes it with no error.

**What needs an ear, and cannot be settled by a test.** The `musician` was explicit that all of this is prediction: whether a sixteenth hat reads as shimmer or as busy at 68 bpm (knob: `gain.hatClosed` −15 → −16/−17, not dropping a pool member); whether three comp onsets a bar crowd the space Sam hums in; and whether a fill that marks itself by changing the hat reads as a fill at all. `## Done when`'s last bullet is the one that holds those.

## Answered — Q1-A, Q2-C

**Q1-A. open-ballad moves to the sixteenth grid** and declares its own `patterns` for `hatClosed`, `kick`, `bass` and `comp`. `density` moves `{8, 30}` → `{27, 37}`, re-measured after the rest lands rather than trusted from the sweep. `subdivision`, `patterns` and `density` are all routed to `templates/<feel>.ts` by `docs/music.md`'s *Where to change what*, and none is on the frozen list.

**Q2-C. Bar 4 is marked by a `figures` entry on `hatOpen`**, `bars: [[14], [14], [14], [10, 14]]` — the hat opens twice in the fourth bar. No draw, no re-key, no test rewrite, and `barRole` and `middlePassOf` are untouched. The four `events.test.ts` fill invariants Q2-A would have cost are not opened.

**The size test passes again under these two answers**, which is worth recording because it failed on the maximal version. Question 3 now passes outright: with the flavour ask out of scope, nothing frozen is touched. Question 1 comes back to five — the grid, the four pools, the `figures` entry, `FILLS['open-ballad']`, and the re-render with its two re-pins. 2 and 4 were never in doubt. **The waiver in `## What` is no longer being spent.**

**But the two answers collide, and neither option priced it.** `events.ts:582` reads

```ts
const hatOpenSteps = figureVoices.has('hatOpen') ? [] : grid(placement.hatOpen)
```

so a `figures` entry on `hatOpen` empties `hatOpenSteps` — which is the value the closed-hat filter at `:856` is built from:

```ts
const closed = plays('hatOpen') ? hatSteps.filter((s) => !hatOpenSteps.includes(s)) : hatSteps
```

With `hatOpenSteps` empty the filter removes nothing, so **a closed hat sounds underneath the figure's open hat, in every bar.** `add` (`:630`) pushes without dedupe, so both events are real and `chokeOpenHats` fires on the open one. Q1-A's pool was designed against exactly this — the `musician` put step 14 in every member precisely so *"`hatOpen`'s placement line takes it in every bar and no closed hat ever sounds under the open one"* — and Q2-C is what removes the placement line that made that work. In bar 4 it is worse, because the figure opens at 10 as well and pool member 1 plays all sixteenths: two collisions in the one bar the entry exists to mark.

No template has ever declared `figures` on `hatOpen`, so this path has never been rendered. Q3 settles it.

## Open questions

### Q3. How is the closed-hat-under-open-hat collision resolved?

- [x] A) **The closed pool drops the steps the figure opens** — no member states 10 or 14, and the figure owns both. Keeps the `musician`'s stated intent, costs 1–2 hat hits a bar, and touches only `templates/open-ballad.ts` *(recommended — it is the option that changes no shared code, and the intent it preserves is the one the pool was designed around)*
- [ ] B) **Teach the emission the figure's steps** — the closed filter subtracts figure-supplied `hatOpen` steps per bar, in `events.ts`. Correct for every future feel, and the only option here that edits the shared emission path rather than one template
- [ ] C) **Let both sound.** A closed hat under an open one is a real thing a drummer's hand does, and `chokeOpenHats` already cuts the open sample. Costs nothing and asserts nothing

What each costs:

| | A) pool drops them | B) fix the emission | C) let it ring |
| :-- | :-- | :-- | :-- |
| files | `templates/open-ballad.ts` only | `events.ts` — shared by all nine feels | none |
| events/sec | 9.15 → ~8.7 | 9.15 as measured | 9.15 plus 8 doubled hits a loop |
| size test | unchanged | question 1 gains a bullet; still one module | unchanged |
| risk | the open hat loses the closed reinforcement the pool was written to avoid needing | a regression in the one path every feel's hat runs through, for a collision only open-ballad has | untested audio nobody has heard; the doubled hit is 3 dB louder at that step |

**B is the only one that is right in general**, and that is the argument for it: the collision is a latent defect in `events.ts` that open-ballad merely happens to be the first feel to reach. The argument against is that it edits the hat path for all nine feels to serve one, in a ticket whose whole point was to stay inside one template.

### Q4. What happens to the four `## Done when` bullets these answers cannot reach?

`## What` and `## Done when` are yours and this run did not touch them, but four of the seven are now unreachable — three by the arithmetic in `## Notes`, one by Q2-C's own description.

| # | Bullet | State |
| :-- | :-- | :-- |
| 1 | no mode identifies the style | **unreachable** — needs ≥9 open-ballad grooves |
| 2 | ships a flavour a player can name, *or the ticket records why not* | **reachable** on the "or" clause; `## Notes` is the record |
| 3 | no longer the emptiest per second | **Q1-A delivers it** — 7.32 → 9.15, and its floor beats half-time's and boom-bap's |
| 4 | the loop breathes twice — two marked bars | **unreachable under Q2-C**, which is not a marked bar in the `barRole` sense |
| 5 | tempo band below 75 **and** the grooves spread over more than 6 bpm | first half holds untouched; **second half unreachable** — `bpm` is the first draw on the frozen stream |
| 6 | every moved answer recorded and re-pinned on a fresh listen | **reachable** — no answer moves, and the two sign-offs re-pin on a listen |
| 7 | a test covers the flavour spread and the marked-bar count | **unreachable as written** — neither changes |

- [x] A) **Strike 1, 4, 7 and the second half of 5
- [ ] B) **Strike them and open a second quick ticket** for the mint alone, leaving the `flavours` edit out of it. A mint touches nothing frozen, so it fits — but it can only reach 3:2, which is the ceiling `## Notes` measured
- [ ] C) **Rewrite 4 and 7 to match Q2-C** — "bar 4 is audibly marked" and "a test covers the hat figure" — and strike 1 and 5's second half
- [ ] D) **Leave all seven standing** and let `/implement-quick-feature` grade four of them *not done*

## Answered — Q3-A, Q4-A

**Q3-A. The closed pool drops the steps the figure opens.** No member states 10 or 14; the `figures` entry owns both. `events.ts` is not touched for this, so the collision stays a latent defect in the shared hat path that no feel currently reaches — worth knowing, and not this ticket's to fix. `patterns.hatClosed` becomes:

```ts
hatClosed: [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15],  // sixteenths, less the two the figure opens
  [0, 2, 3, 4, 6, 7, 8, 11, 12, 15],               // eighths + every "a"
  [0, 1, 2, 4, 5, 6, 8, 9, 12, 13],                // eighths + every "e"
],
```

Member 2 keeps step 15 on purpose: it chokes the figure's open hat 220 ms later, which is what a drummer's foot does, and `chokeOpenHats` in `voices.ts` does it for free. That was the `musician`'s deliberate detail and it survives the drop.

**Q4-A, as edited. Bullets 1, 4, 7 and the second half of 5 are struck. The flavour spread is dropped, not deferred** — the user cut the "open a feature for it" half of option A. No feature, no second ticket, and `## Notes`' arithmetic stands as the record of why the monoculture is quick-12's fix working rather than a defect.

`## Done when` is not edited in place — §6 keeps it the user's — so the live set is recorded here instead:

| # | Bullet | State |
| :-- | :-- | :-- |
| 1 | no mode identifies the style | **struck** |
| 2 | ships a nameable flavour, *or records why not* | **live**, on the "or" clause — `## Notes` is the record |
| 3 | no longer the emptiest per second | **live** — the ticket's payload |
| 4 | two marked bars | **struck** |
| 5 | tempo band below 75 bpm | **live**; the ">6 bpm spread" half struck |
| 6 | moved answers recorded and re-pinned on a listen | **live** — no answer moves, and two sign-offs re-pin |
| 7 | a test covers the flavour spread and the marked-bar count | **struck** |

**Two consequences of Q2-C the option text did not carry**, both read off `events.ts:882` where figures are emitted:

* **The figures loop sits outside the `if (role)` branch**, so it plays through the fill bar — `docs/music.md`'s stated behaviour. Its index is `barInPass % figure.bars.length`, and with four bars declared against `passes: 2` that means **the entry opens twice in bars 4 *and* 8**, and once in the other six. So Q2-C delivers the antecedent-and-consequent shape Q2-A was recommended for: bar 4 marked by the double open hat, bar 8 by that plus the fill. It reaches further than the option claimed.
* **`FILLS['open-ballad']` must therefore not name `hatOpen`.** The figure already supplies step 14 in bar 8 and `add` does not dedupe, so declaring it in the fill phrase too would sound the sample twice at one instant. The `musician`'s proposed entry named it; drop that key and keep the rest.

**One behaviour difference to expect, not to fix.** The figures loop passes `velocityFor(figure.voice, sixteenth)` explicitly, bypassing `accentedVelocity` — and `hatLine` (`events.ts:595`) is built from `hatOpenSteps`, now empty. So the marking open hat takes no `HAT_ACCENTS` multiplier and plays flat at its `medium` level, where the placement route would have accented it. It is the thing meant to stand out, so unaccented is the right direction; it is recorded because a reader comparing this feel's hat accents to another's will otherwise think the map is broken.

**Size test, re-run against all four answers: passes.** Question 3 passes outright now that the flavour ask is dropped — `subdivision`, `patterns`, `figures`, `density` and `FILLS` are all off the frozen list. Question 1 lands on five: the grid move, the four pools, the `figures` entry, `FILLS['open-ballad']`, and the re-render with its two re-pins. One module, one revert. **The waiver in `## What` is not spent.**

**Verdict: settled. No question is open.**

## Built

* `scripts/grooves/templates/open-ballad.ts` — `subdivision: 8 → 16`, and its own `patterns` for `hatClosed` (3), `kick` (5), `bass` (4) and `comp` (4, two of them two-bar). `figures` marks the hat open at 14, and at 10 and 14 in the fourth bar of each pass. `density` `{8, 30}` → `{27, 37}`.
* `scripts/grooves/events.ts` — new `FILLS['open-ballad']`. It closes the defect `## Notes` found rather than adding a gesture: `DEFAULT_FILL` names no `hatClosed`, so this feel's last bar had no hi-hat at all. It names no `hatOpen` either, because the figure plays through fills and `add` does not dedupe.
* `scripts/grooves/gate.test.ts` — groove-78 and groove-79 re-pinned on the listening verdict below. New `QUICK_18_APPROVAL` / `QUICK_18_SCOPE`; `PENDING_SIGN_OFFS` untouched and still empty.
* `scripts/grooves/open-ballad.test.ts` — **new**, 13 tests.
* `scripts/grooves/bassFloor.test.ts` — six measurements re-taken and `UNBLOCKED_POPS` 10 → 13 sites.
* `scripts/grooves/events.test.ts` — the pinned comp mean and `PRE_EPIC_COMP['groove-49']`, both commented with what moved and why.
* `scripts/grooves/patterns.test.ts` — open-ballad left the "declares no pattern block and no fixed figure" list, which is five templates now.
* `docs/music.md` — the feel table's open-ballad row.
* `scripts/grooves/events.fixture.json` regenerated. Five mp3s and `grooves.lock.json` re-rendered by a full `npm run grooves`. **`grooves.generated.ts` unmodified.**

**Measured after.** Events/sec per groove: 8.38 · 8.99 · 9.48 · 9.81 · 10.28, mean **9.39** against 7.02 before. open-ballad goes from the emptiest of nine to third-emptiest, and its *floor* of 8.38 now beats half-time's 7.50 and boom-bap's 7.57 — so it is no longer the emptiest at the floor, the quartile or the median. **Not at every quantile**, and the exception is worth naming: its maximum of 10.28 is still the *lowest maximum* of the nine feels, so its busiest groove is quieter than any other feel's busiest. An earlier draft of this line claimed "no longer the emptiest at any quantile", which does not follow from a floor comparison and is false at the top. Per bar 30.00–35.25 against a declared 27–37; a 4000-seed sweep gives 28.38–35.75, so the band holds. RMS: groove-78 −21.99, groove-79 −23.25 dBFS.

**No committed answer moved**, checked three ways: all five grooves' bpm, root, mode and progression compared identical; `grooves.generated.ts` came out unmodified; and `events.test.ts`'s own `leaves the answer alone when a rhythm pool changes` passes. The verifier then re-derived it a fourth way, comparing the whole `music` and `harmony` objects including `progressionMidi`. It also corrected one of those legs: `headDelaySeconds` is `0.025057` for **every** groove in the catalogue, so an unmodified manifest says nothing about the delay — it is an encoder constant. The answer half of that leg stands.

**tests:**
* `open-ballad.test.ts` — the pool's figures stay distinct once gridded, which is the whole reason for the subdivision move and was a no-op before it; the hat reaches an odd sixteenth, which the eighth grid made unreachable; no closed hat under an open one, asserted both over the render and **statically over every pool member**; the figure opens twice in bars 4 and 8 and once elsewhere; the fill bar keeps its hat; the fill names no `hatOpen`; and the ticket's own payload — no longer the emptiest style per second, measured over the whole registry.
* Plus R7/AC7's guarantee asserted at its mechanism — `COMP_ACCENTS` averages to exactly one — for the reason two paragraphs down.

**checks:** lint clean · `tsc --noEmit` clean · `npm test` 3057 · `npm run test:gen` 1585 · `npm run build` exit 0 · `npm run grooves:verify` clean.

**The verifier's three findings, all taken.**

* **A test I re-pinned had stopped testing anything.** `events.test.ts`'s `PRE_EPIC_MEAN_VELOCITY` compares each pre-feature-22 feel's comp mean against its value before that feature. open-ballad's moved 5.0% against a 2% tolerance for a reason unrelated to feature-22, and re-pinning made the comparison self-satisfied — my first comment claimed the opposite. The pin stays as a tripwire with the consequence written down instead of denied, and R7/AC7's claim is restored in `open-ballad.test.ts`. **My first attempt at that restoration was also wrong**, and the second verifier pass caught it: it compared a humanized render to a dry one, but the dry override zeroes `humanize` while `COMP_ACCENTS` is applied on both sides (`events.ts:940`), so it measured a zero-mean gaussian rather than the accent curve — and it did not assert the "varies" half at all. It is now asserted at the mechanism instead: `COMP_ACCENTS` averages to exactly one, with one accent above the centre and one below. Pool-, seed- and feel-independent, and mutation-checked by raising an accent.
* **A mutation survived.** Putting steps 10 and 14 back into the *third* `hatClosed` member left all 11 tests green, because the five shipped grooves draw only members 0 and 1 — member 2 is never rendered. Q3-A's rule is now asserted over the declaration, not inferred from what got drawn, and reverting the production line turns it red.
* **My rank claim was one out.** 9.39 events/sec is third-emptiest of nine, not fourth; second-line's 9.70 still beats it.

**And two the second pass added, both taken.** The R7/AC7 restatement above, and the "any quantile" overstatement corrected in *Measured after*. It also noted that the blast radius outran `## Notes` by two files — `bassFloor.test.ts` and `patterns.test.ts` were not predicted there. Both edits are correct; the prediction was short.

**Three edits reverted rather than kept.** The first round unpinned both sign-offs into `PENDING_SIGN_OFFS`, which meant widening that list's contract, `pendingSignOff`'s message, and the `/feature/i` guard that gates it. The listening pass landed before the fix round, so all three came out: both entries carry a hash, the list is empty, and no shared machinery moved. **The guard defect is real and survives** — the verifier defeated even the widened version, since groove-79's `upstream` passes on an incidental `feature-28` and a *numbered denial* passes too. It is quick-14's review finding, not this ticket's, and it wants a ticket of its own.

**verifier: pass with gaps, then pass.**

* D1 — **struck** (Q4-A). The flavour spread needs ≥9 open-ballad grooves; `## Notes` has the arithmetic.
* D2 — **live, and settled on its own "or" clause**, which asks the ticket to record why it still ships two altered scales rather than to change them. `## Notes` is that record: `lydian-dominant` is offered by this template alone, `manifest.test.ts:397` requires all twelve modes present, and `DOMINANCE_RATIO = 2` against a max of 6 puts its floor at 3 of the feel's 5 grooves. The verifier graded it **partly** and put the choice here, on the ground that nothing asserts the record exists — correctly, since a test that read a spec file would be new machinery. It is settled the way D6 is settled, by a person reading it, and that is what the bullet asked for.
* D3 — **done.** `open-ballad.test.ts` › `is no longer the emptiest style in the app per second`.
* D4 — **struck** (Q4-A).
* D5 — **done** on its live half. `open-ballad.test.ts` › `keeps a tempo band a ballad can be played over`. The spread half was struck.
* D6 — **done.** No answer moved, which is recorded above and asserted; groove-78 and groove-79 re-pinned on the verdict — *"listened to the new grooves. All sound very good and more interesting than before"*.
* D7 — **struck** (Q4-A).
