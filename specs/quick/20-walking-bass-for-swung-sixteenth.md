# 20 — Walking bass for swung-sixteenth

## What

* The bass plays a walking line in `swung-sixteenth` — only quarter notes.
* Every groove in that style, not one of them.
* We also try the walking bass for `open-ballad` — but only half of them.
* walking bass means the root of the chord on beat 1. the rest of the notes are chord tones or chromatic passing tones to reach the next root with very little tone jumps. twice the same not after each other is possible as well

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Every bass note in a `swung-sixteenth` groove lands on a quarter, and every quarter of the bar has one.
* No other feel's bass line changes.
* The six `swung-sixteenth` grooves in the catalogue are re-rendered, so the walking bass is what plays.

## Open questions

### Q1. How does a chromatic passing tone get past the quality gate?

*Answered — A.*

`gate.ts`'s pitch check calls `offScalePitches` (`scripts/grooves/theory/pitches.ts`),
which admits exactly one off-scale **bass** pitch per chord change and only inside the
last `APPROACH_WINDOW = 1/8` of the bar. Beat 4 sits at 0.75 of the bar; the window
opens at 0.84375. So a chromatic on beat 4 fails the gate as the code stands, and
`events.test.ts:1342` runs the same check over every feel × 12 seeds.

- [x] A) Widen `APPROACH_WINDOW` from `1/8` to `1/4`, so beat 4 falls inside it *(recommended — widening only ever admits more, and every other feel puts its approach at step 15, inside both windows. The budget stays one off-scale bass note per chord change, `claimed` still caps it, and `isApproachNote` still requires a semitone from the next root. The `musician` measured the real pressure at ~2 notes per 4-bar pass, because 3 of the 7 semitone approaches in both of this feel's flavours are themselves scale tones)*
- [ ] B) Give a walking feel its own exemption — one off-scale bass note per bar at any step, so chromatics can sit on beats 2 and 3 too *(8 free slots in 16 notes: half the bass line stops being checked, and a fold bug or a semitone-transposed voice would no longer show up in bulk. The `musician` calls this the point where the check stops being a check)*
- [ ] C) Replace the time window with a resolution test — admit an off-scale bass note iff the next bass note is a semitone away *(the invariant the window is really proxying for, and it would free beats 2 and 3 without raising the count. It changes what the gate means for every feel, which is a ticket of its own, not this one)*
- [ ] D) No chromatics — chord tones and scale tones only *(needs no gate change at all, and contradicts the third `## What` bullet: the line becomes a scalar run rather than a walk)*

### Q2. Four of the six re-rendered grooves are pinned sign-offs. How does the ticket land them?

*Answered — A.*

`gate.test.ts`'s `SIGN_OFFS` table pins the pcm and mp3 hashes of **groove-28,
groove-40, groove-48 and groove-50** — audio you listened to and approved. Re-rendering
voids all four, `voidSignOff` fires, and the suite goes red until someone's ear
re-approves them. No agent can give that back.

- [x] A) The build re-renders, then stops and hands you the six files to play; the four hashes are re-pinned in the same run once you approve, and only then does the row go ✅ *(recommended — it is what `voidSignOff` instructs in as many words, and `docs/music.md` says the tuning knobs are turned by a listening sign-off by a person. Cost: `/implement-quick-feature 20` cannot finish unattended, and the ticket sits at 🛠 until you have listened)*
- [ ] B) Re-render, re-pin all four straight away, and record the approval as carried over from the old audio *(green suite in one run, and it puts four hashes in the table for audio nobody has heard — the one thing the table exists to prevent)*
- [ ] C) Null the four pcm/mp3 fields and list them in `PENDING_SIGN_OFFS` *(the documented shape for "the render that will ship does not exist yet", which is not this case: the render will exist, it just will not have been heard. `PENDING_SIGN_OFFS` is also asserted empty on main)*

### Q3. `bassType` sits on the template, and a template is a feel. How does "half of them" get said?

*Answered — A.*

`open-ballad` has **five** grooves — groove-49, -51, -77, -78, -79 — so "half" is two or
three, and it is a per-*groove* choice that `FeelTemplate` has no way to express. Two of
the five, **groove-78 and groove-79, are pinned sign-offs**, so which half walks also
decides whether this ticket voids four listening sign-offs or six.

- [x] A) Put `bassType` on the groove instead — a field on `GrooveSpec` in `scripts/grooves/catalogue.json`, defaulting to the template's *(recommended — "try it" is a taste decision, and this is the only option where which grooves walk is visible, hand-picked and movable one at a time without re-rolling the others. It also lets the trial take groove-49, -51 and -77 and void no sign-off beyond Q2's four. Cost: `catalogue.json` gains a field and `catalogueSha256` in `grooves.lock.json` moves — neither is on the frozen list, and no `uuid` moves)*
- [ ] B) Draw it per seed on a new labelled RNG stream *(fits the generator's "every choice is drawn from a seeded generator" model, and `docs/music.md` requires a new stream rather than a draw added to `rhythmRng`. Cost: over five grooves the draw gives you one or four as easily as two or three, and you cannot move a groove between the halves without changing its seed)*
- [ ] C) Template declares a ratio, applied by rank of seed *(deterministic, and exactly half. Cost: which grooves walk is a rule nobody can read off a groove, and it re-shuffles if the catalogue is ever re-minted)*
- [ ] D) Split `open-ballad` into two templates *(the one option that needs no new field. It also puts a tenth `style` in `src/features/daily-groove/data/grooves.generated.ts`, which is part of the puzzle's answer space — two styles where players know one. Not recommended)*

## Answered — Q1-A, Q2-A, Q3-A

**Q1-A — widen `APPROACH_WINDOW` from `1/8` to `1/4`.** The chromatic slot is beat 4 and
nothing else. One off-scale bass note per chord change, `claimed` still caps it, and
`isApproachNote` still requires a semitone from the next root, so the gate keeps its job
of catching a voice sounding a wrong pitch class. Chromatics on beats 2 and 3 are out of
scope for this ticket; option C names the ticket that would open them.

Two things checked against the tree since the question was asked:

* **No existing test asserts a rejection in the band the widening opens.** The approach-note
  cases in `scripts/grooves/theory/pitches.test.ts:87-145` sit at step 15 (0.9375 of the
  bar) and at beat 1 (0.0). Beat 1 stays outside a quarter-bar window, so every one of
  them still means what it meant. The widening needs a new case, not a rewritten one.
* **`docs/music.md` does not document the window.** Its quality-gate table says only "no
  event sounds a pitch outside the scale", and the approach-note hole is undocumented
  there today. So the doc work in this ticket is the walking bass itself; the window is a
  constant with no prose behind it.

**Q2-A — the build stops for your ear.** `/implement-quick-feature 20` re-renders, runs
the checks, and hands back the four voided sign-offs plus the two grooves that were never
pinned. The suite is red at that point by design: `gate.test.ts`'s four hashes no longer
reproduce, and `voidSignOff` says in as many words not to re-pin them to make it green.
The hashes get re-pinned in the same run once you approve, and the row reaches ✅ only
then. Nothing is committed while it sits at 🛠.

**Q3-A — `bassType` moves to the groove.** An optional field on `GrooveSpec` in
`scripts/grooves/catalogue.json`, falling back to the template's when a groove does not
declare one. `swung-sixteenth` still says `bassType: 'walking-bass'` once on its
template, because there every groove walks; `open-ballad` says nothing on its template
and names the walking grooves individually.

Two things checked against the tree after the answer:

* **A hand-added field survives the next mint.** `writeBatch` in `scripts/grooves/add.ts:195`
  writes `[...existing, ...minted]`, and `existing` is whatever `readCatalogue` parsed,
  spread through untouched. `readCatalogue` casts without validating, so the field flows
  both ways. Newly minted grooves simply have no `bassType` and fall back to their
  template, which is the right default.
* **`buildEvents` already receives the spec.** Both the mint path (`add.ts:129`) and every
  render call it as `buildEvents(spec, template)`, so reading `spec.bassType` needs no
  signature change and no threading.

## Notes

### Size test — fails question 1, passes 2, 3 and 4

*Re-run against the `open-ballad` bullet. The verdict does not change, but question 1 fails
by more: a second feel, a second set of re-renders, and a per-groove mechanism that did
not exist when the ticket was one feel.*

1. **No.** Not five bullets. The change is a new bass-construction path in `events.ts`,
   a `bassType` union in `types.ts`, a per-groove override for the `open-ballad` half
   (Q3), a gate-window change in `theory/pitches.ts`, three catalogue-wide bass
   invariants re-scoped across two test files, a `docs/music.md` section with its
   `docs.test.ts` guards, and eight or nine re-renders voiding four to six listening
   sign-offs. Twelve-plus files across two feels.
2. **Yes.** One module — catalogue. `scripts/grooves/theory/` is inside the generator,
   not the app's `src/lib/theory/`. No app code moves.
3. **Yes.** Nothing in *What must never change* is touched. `src/lib/hash.ts` is
   untouched; the bass draws on `RHYTHM_LABEL`, not `MUSIC_LABEL`, so no committed answer
   moves; `flavours` is untouched; no `uuid` moves. `docs/music.md` says re-rendering
   audio is always allowed. The cost is the four sign-offs in Q2, which is not the same
   thing as a frozen value.
4. **Yes.** The MP3s are committed, so one `git revert` restores code, manifests, lock
   and audio together.

**The recommendation is `/create-feature`**, on question 1 alone. What the chain would
buy is a PRD that states the walking rule as acceptance criteria — direction, beat 3's
role, the register ceiling — before the code exists, and an epic boundary between the
generator change and the listening pass. What it costs is the four-document chain for a
change that is, musically, one well-understood idiom. **Your call**, and the ticket
carries on either way.

### Files this is expected to touch

* `scripts/grooves/events.ts` — the walking bass path, branched on `template.bassType`; the bass block is the last consumer of `rhythmRng` (draws at 695, 696, 697, 725), so changing how many values it draws re-rolls nothing else.
* `scripts/grooves/types.ts` — a `BassType = 'normal' | 'walking-bass'` union and a `bassType?: BassType` field on `FeelTemplate`.
* `scripts/grooves/templates/open-ballad.ts` — untouched by Q3-A. Its `patterns.bass` from quick-18 (`[0, 8]`, `[0, 8, 14]`, `[0, 6, 10]`, `[0, 8, 10]`) still serves the grooves that do not walk, and a walking groove ignores the pool for a fixed `[0, 4, 8, 12]`.
* `scripts/grooves/catalogue.json` — `bassType: 'walking-bass'` on the three `open-ballad` grooves the trial takes (Q3-A). `catalogueSha256` in `grooves.lock.json` moves with it.
* `scripts/grooves/types.ts` — `bassType?: BassType` on `GrooveSpec` as well as on `FeelTemplate`.
* `scripts/grooves/templates/swung-sixteenth.ts` — `bassType: 'walking-bass'`, and `patterns: { bass: [[0, 4, 8, 12]] }`. A one-member pool still costs exactly one `pick` at `events.ts:561`, so `compPhrase` and everything before it are byte-identical.
* `scripts/grooves/theory/pitches.ts` — `APPROACH_WINDOW`, `1 / 8` → `1 / 4` (Q1-A).
* `scripts/grooves/theory/pitches.test.ts` — one new case for a chromatic on beat 4. The nine existing approach-note cases all still hold.
* `scripts/grooves/events.test.ts` — `:1250` ("plays a line, not an arpeggio") and `:1280` ("walks into every chord change") both loop `allTemplates()` and both assert the approach at `subdivision - 1`; a walking feel puts it on step 12. `:1342` runs `offScalePitches` over every feel and is the fastest red/green for Q1.
* `scripts/grooves/bassFloor.test.ts` — `:313` asserts exactly one always-lift in all 54 grooves; the six walking ones have none.
* `scripts/grooves/gate.test.ts` — the four sign-off hashes, per Q2.
* `docs/music.md` — the *Voicing → Bass* section and the feel table; `scripts/grooves/docs.test.ts` guards both against the code.
* `public/grooves/groove-{28,34,40,48,50,82}.mp3` plus `groove-{49,51,77}.mp3`, and `scripts/grooves/grooves.lock.json` — `npm run grooves` then `npm run grooves:verify`.

### Assumptions taken rather than asked

* **The three "line, not an arpeggio" invariants are dropped for a walking feel** — the forced rest (`events.ts:755-774`), the forced repeat (`:796-810`) and the always-lift (`:776-794`), plus the per-note rest 0.18 and octave lift 0.32. A rest breaks "every quarter has one" and an octave lift is the exact leap the third `## What` bullet forbids. The always-lift exists to move a 3-note arpeggio out of one octave; a directed walking line moves by construction, so its reason is gone. A repeat stays *possible* and is no longer forced.
* **The downbeat root and the beat-4 approach are kept.** Beat 1 stays `inRegister(chord[0], …)` with no draws on it — the comp's rootless voicing depends on it. The approach keeps today's rule (a semitone below, above when below would fall under the floor); only its step moves from 15 to 12.
* **Beats 2 and 3 step in a chosen direction, not to the nearest note.** Direction is `sign(beat4 - beat1)`, or one seeded draw when the bar does not change chord. Beat 2 takes the smallest step in that direction from chord tones ∪ scale tones; beat 3 takes a chord tone that is not the root, so the harmony is restated mid-bar. Nearest-neighbour without direction oscillates between two notes for four bars — the same reason `voiceLead` searches all sixteen comp voicings instead of folding each tone independently. Where no candidate exists in the direction inside the register, the previous note repeats, which is where the ticket's allowed repeat comes from.
* **The walking line needs register headroom.** `BASS_BASE_MIDI = 24` folds every root to 25–35 (C to 36), and three steps from beat 1 to beat 4 hit the wall of an 11-semitone window every bar. `BASS_WALK_CEILING = 43` (G2) against the floor at 25 is the proposal — about a four-string's practical walking range, and well under the comp's floor at 55. **This is a proposal, not a measurement**, and belongs in the listening pass with Q2's four grooves.
* **The comp does not move.** `playedVoicing` drops the root by pitch class, and the walking line still states the root on beat 1 of every bar.
* **The words do not move.** `src/features/daily-groove/data/grooves.generated.ts` holds no bass-derived field — scale, chord, progression and `headDelaySeconds` are all unchanged — so only the six MP3s and their entries in `grooves.lock.json` move.
* **Density is measured, not assumed, and clears both bands.** Walking pins the bass at exactly 4 notes a bar. `swung-sixteenth` runs 3.25–4.75 today against a wide 16–42, so it does not come close. `open-ballad` is the tight one — band 27–37, and groove-77 already sits at 35.3 events a bar. Walking moves the five by +1.25, +1.0, +0.5, +0.75 and +0.25, putting the highest at **35.8 against a 37 ceiling**. It clears, with about a note and a bit of headroom, so a later change that adds an onset to this feel is the thing to watch.
* **The trial takes groove-49, groove-51 and groove-77.** Three of `open-ballad`'s five, which is the nearest thing to half an odd number, and it is the set that voids no sign-off beyond Q2's four — groove-78 and groove-79 are the two pinned ones and they keep the quick-18 pool. This is the assumption Q3-A was chosen to make cheap: moving a groove between the halves is one line in `catalogue.json` and one re-render, so say the word at the listening pass and it moves.
* **`bassType` is optional and defaults to `'normal'`.** Only `swung-sixteenth` declares it, matching `patterns?` and `figures?`, the two fields `FeelTemplate` already leaves out where a feel wants the shared behaviour. Naming it on all nine templates instead is one line in `types.ts` and eight more edits, and buys explicitness at the cost of eight lines that all say the same thing — say so and it changes.
* **No feel outside these two changes.** `rhythmRng` is keyed by `template:seed`, so a different draw count is contained to the grooves that walk, and the other seven feels take the unbranched path.

### What will need your ear — the stop Q2-A builds in

Three things nothing in the repo can measure, to be reported as *awaiting a listening
sign-off* rather than as verified: whether `BASS_WALK_CEILING = 43` keeps the line under
a countermelody, whether dropping the always-lift leaves the four bars static, and
whether the emergent repeats read as a player's choice or as the line getting stuck.

If the listening rejects one of them, the fix is a constant and the ticket iterates in
the same run rather than becoming a second ticket — `BASS_WALK_CEILING` is one number,
and the direction rule is one branch.

### One `## Done when` bullet still contradicts the `## What`

Bullet 2 reads *"No other feel's bass line changes."* It was true when the ticket was one
feel; the `open-ballad` bullet contradicts it head-on, and it is still unedited. **That
section is yours, so it is not mine to rewrite.**

This one is not cosmetic. `/implement-quick-feature` gates itself with the `verifier`,
which grades the `## Done when` bullets the way it grades an epic's acceptance criteria.
As written, bullet 2 grades **not done** the moment `open-ballad` renders, and by
`AGENTS.md`'s rule a bullet short of done keeps the row off ✅. The intent underneath it
looks like *no feel outside these two changes*, and the notes are written against that
reading — but the words are yours to fix, and until they are the ticket cannot close.

## Answered by the render — the open-ballad trial

Listened to on 2026-09-10 and turned down for that feel, in these words:

> for open-ballad, I don't like it. But for swung-sixteenth it'S really good. remove it
> from open-ballad

So the third `## What` bullet is answered rather than dropped: the trial ran, and the
answer is no. groove-49, groove-51 and groove-77 had their `bassType` removed and were
re-rendered — their MP3s are byte-identical to what they shipped before, so the trial
cost the catalogue nothing.

The reason is on the record in `docs/music.md` so it is not re-proposed as an oversight.
**The reason written here first was wrong, and quick-21 corrected it.** It said
`open-ballad` does not ride, so a walking bass becomes the only voice stating all four
quarters — but that feel's closed hat states all four quarters in 100% of its bars. What
it lacks is a voice in the *bass's own weight class* on every quarter, which comes from
feathering, and feathering is gated on the ride. At 62–74 bpm that put the line in front
of the arrangement.

**`## Done when` bullet 2 is now literally true.** It read *"No other feel's bass line
changes"*, contradicted the `open-ballad` bullet for the length of the trial, and the
revert resolved it without anyone rewording it.

## Built

* `scripts/grooves/types.ts` — `BassType = 'normal' | 'walking-bass'`, optional on `FeelTemplate` and on `GrooveSpec`, the groove winning.
* `scripts/grooves/events.ts` — the walking path: `walkPool`/`walkStep`, `BASS_WALK_CEILING` 43, `BASS_WALK_MAX_STEP` 7, `BASS_WALK_SUSTAIN` 3.5, `BASS_WALK_APPROACH_SUSTAIN` 2.5, `BASS_WALK_VELOCITIES` `[0.92, 0.78, 0.85, 0.74]`, and three `!walking &&` guards that keep the drawn figure's forced rest, forced repeat and always-lift off a walking line.
* `scripts/grooves/templates/swung-sixteenth.ts` — `bassType: 'walking-bass'`. No `patterns.bass`: a walking line fixes its own quarter grid and ignores the pool, so declaring one would have said nothing and would have cost `bassFloor.test.ts` its record.
* `scripts/grooves/theory/pitches.ts` — `APPROACH_WINDOW` `1/8` → `1/4`, so beat 4 at 0.75 of the bar is inside the gate's one-off-scale-note hole.
* `scripts/grooves/catalogue.json` — untouched in the end. Its three `bassType` entries went in for the trial and came back out.
* `docs/music.md` — a *The walking bass* section, a `bassType` row in *Where to change what*, the `open-ballad` rejection and its reason, and four corrected always-lift figures: 31 of 54 → **27 of 48**, and fourteen of twenty → **eleven of the sixteen that still draw a bass**. Stale because six grooves stopped taking a lift; `docs.test.ts` does not measure those numbers, so nothing was red.
* `scripts/grooves/gate.test.ts` — the four voided sign-offs re-pinned to the approved render, with the listening recorded as `QUICK_20_APPROVAL` / `QUICK_20_SCOPE`. `FEATURE_28_APPROVAL_GAIN` and `FEATURE_28_SCOPE_GAIN` deleted: all four entries that rested on them moved to this listening, and a scope nothing bears is a scope that misleads. groove-50's scope composes the new one and quotes the feature-28 gain history inline, because that layer is still load-bearing there.
* `scripts/grooves/events.test.ts` — `isApproachNote` accepts the bar's last quarter as well as its last step; R7's "line, not an arpeggio" and R8's approach-position test scoped to the feels that do not walk. groove-49's comp literal was re-pinned during the trial and restored on the revert.
* `scripts/grooves/bassFloor.test.ts` — builds every groove on the drawn path with `bassType` forced to `'normal'`, so all 54 stay inside feature-28's claim and **every hand-measured literal in it stands unchanged**. One assertion — the only one tying that build to what ships — scoped to the 48 grooves that ship a drawn bass.
* `scripts/grooves/events.fixture.json`, `scripts/grooves/grooves.lock.json`, and six MP3s under `public/grooves/` — groove-28, -34, -40, -48, -50, -82.

* tests: `scripts/grooves/walkingBass.test.ts`, new, 18 tests — every quarter filled and nothing between, the root on beat 1, beat 3 a chord tone that is not the root, beat 4 a semitone from the next root, no move over a fifth, no octave leap, the register rails, a repeat possible but not forced, and which grooves walk.
* checks: `npm run lint` clean · `npx vitest run` 4663 passed / 200 files, 0 failed · `npm run build` passes · `npm run grooves:verify` — 54 grooves, 24 notes, manifests and catalogue all match the lock.
* gate: all six walking grooves pass the seven checks. Loudness tops out at groove-48's RMS −21.03 against a −20 ceiling, and density at 32.88 against a 42 ceiling — both measured through `gate.ts`'s own checks by the verifier, after a first reading of mine put groove-48 at −20.45 by measuring one channel by hand.
* verifier: **pass** — D1, D2 and D3 all done, six citations all resolving. Report at `specs/quick/.verify/20.md`.
  * **D1** — every bass note lands on a quarter and every quarter has one: `walkingBass.test.ts` › *puts one bass note on each of the four quarters of every bar* and *never rests: the bass note count is four times the bar count*.
  * **D2** — no other feel's bass line changes: measured, not argued. Diffing `events.fixture.json` key-by-key against HEAD gives 6 changed of 54, all `swung-sixteenth`. The one thing that moved for every feel is `APPROACH_WINDOW`, which widens what the gate tolerates rather than what any groove plays.
  * **D3** — the six are re-rendered and the walking bass is what plays: `gate.test.ts` › *renders the exact audio that was played to a person and approved*, plus `walkingBass.test.ts` › *walks exactly the six swung-sixteenth grooves and nothing else*.

Four things it found, all fixed after the report:

* `docs/music.md:431` still said the always-lift figures count **45** grooves — the trial-era number, self-contradicting the 48 four lines above it. Now 48. Nothing catches this: `docs.test.ts` measures none of these counts.
* groove-48's loudness is **−21.03 dB**, not the −20.45 recorded above. The verifier measured it through `gate.ts`'s own `checkLoudness`; my figure came from averaging one channel by hand. A dB of headroom rather than half, and the wrong number was the one someone would later have tried to protect.
* `QUICK_20_SCOPE` said groove-34 and groove-82 "draw the figure unpinned". They are `swung-sixteenth`, so they walk — they are the two *unpinned* ones, which was the intent. Reworded. A sign-off scope is the last place to be loose.
* `isApproachNote` in `events.test.ts` had been widened for all nine feels rather than the walking one, and it gates three scale-membership checks with a `continue`. It now takes the feel and reads `bassType`, so the eight feels the ticket never meant to touch are exempted exactly as before.

Two coverage gaps it named that are **not** fixed, and are worth knowing:

* `walkStep`'s last-resort branch can return a note further than `BASS_WALK_MAX_STEP` when the in-step pool is empty. Twelve seeds across two feels never reach it, so that branch is unexercised.
* No test pins the walking line's positions for the catalogue's own six seeds directly — they are covered only through the fixture's byte-identity pin, so a careless re-pin would loosen D1's grip on the shipped grooves.

## The even-quarters change — after the row was first marked Done

Asked on 2026-09-10, once the walking bass was in and rendered:

> it seems that the musician decided that the 4th walking bass note of every bar is a
> bit shorter than the rest? Can we rather have them all equal? That'S more like a
> walking bass?

Correct, and the reasoning holds: even, driving quarters are what a walking bass *is*,
and the `musician`'s shorter beat 4 bought the chromatic a pickup feel at the cost of
that evenness. `BASS_WALK_APPROACH_SUSTAIN = 2.5` is gone; all four quarters now take
`BASS_WALK_SUSTAIN = 3.5`, which leaves half a sixteenth of gap so the note-off still
lands before the next attack. The rejected value is recorded in `docs/music.md` so it is
not re-proposed as an improvement.

* `scripts/grooves/events.ts` — `BASS_WALK_APPROACH_SUSTAIN` removed; one length for all four.
* `scripts/grooves/walkingBass.test.ts` — two new tests: all four quarters are one length, and no note reaches the next attack. Twenty tests now.
* `docs/music.md` — the *Length* paragraph records the change and the rejected 2.5.
* the six MP3s, `events.fixture.json` and `grooves.lock.json` re-rendered and re-pinned.

**The four sign-offs are void again, and are deliberately left red.** groove-28,
groove-40, groove-48 and groove-50 no longer render the audio approved on 2026-09-10 —
the note lengths are what changed. Their hashes are *not* re-pinned: nobody has heard
this version, and `voidSignOff` is explicit that a hash may not be re-pinned to make the
suite green. `QUICK_20_SCOPE` still names `BASS_WALK_APPROACH_SUSTAIN (2.5)` because
that is what the earlier listening actually covered; both the hashes and that sentence
get settled together on the next approval.

* checks: `npm run lint` clean · `npx vitest run` 4661 passed, **4 failed — the four voided sign-offs and nothing else** · `npm run grooves:verify` — 54 grooves, 24 notes, all matching the lock.
* gate: all six pass the seven checks, each with exactly one bass note length.

**Heard and approved on 2026-09-10**, in these words:

> now the walking bass sounds really good!

So the four sign-offs are re-pinned to this render and `QUICK_20_APPROVAL` carries that
sentence. `QUICK_20_SCOPE` now records both sessions and the direction of travel between
them — the shorter fourth note was heard, named and rejected on the idiom, which makes
the evenness a decision rather than a default. **Row back to ✅ Done.**

* checks after the re-pin: `npm run lint` clean · `npx vitest run` 4665 passed, 0 failed · `npm run build` passes · `npm run grooves:verify` — 54 grooves, 24 notes, all matching the lock.
