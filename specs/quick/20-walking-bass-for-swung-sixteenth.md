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
