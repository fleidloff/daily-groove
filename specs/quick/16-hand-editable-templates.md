# 16 — Hand-editable templates

## What

* I want to change any `patterns` or `figures` in a template by hand without a test failing because of it.
* Same for the parameters around them: the shared pattern pools, `PLACEMENTS` and `FILLS` in `events.ts`, and a feel's own `tempoRange`, `swing`, `density`, `gain`, `pan` and `humanize`.
* Possibly the chord vocabulary and the progression rules in `theory/harmony.ts` too — `docs/music.md` already sends me there to change them.
* Leave the tests that make sense. Rewrite the rest.
* Changing a feel is meant to be a normal thing to do — `docs/music.md` says re-rendering every mp3 is always allowed — so the suite should catch a template that is *wrong*, not one that is *different*.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Editing any step list in any `templates/*.ts` — a pool figure, a `figures` bar, a pool's length — leaves `npm run test:gen` green, as long as the edit is musically legal.
* The same holds for the parameters around the step lists: a feel's scalars, the shared pools and placements in `events.ts`, and the chord vocabulary in `theory/harmony.ts`.
* An edit that is genuinely wrong still fails, and the failure says what rule it broke rather than which literal moved.
* No test derives its expectation by reading the same declaration it is checking, unless that is the point of the test and it says so.
* Nothing renders: no mp3, no manifest, no lock, no catalogue entry changes.

## Open questions

### Q1. Do `SIGN_OFFS` and the frozen pins count as "tests that make sense"?

Two groups fail on a template edit and are not the kind this ticket is about. They need an explicit answer, because relaxing either is a much larger change than the rest of the ticket put together.

- [ ] A) **Both stay exactly as they are** *(recommended — neither is a test of the template; one is a person's ear and the other is `docs/music.md`'s frozen list)*
- [ ] B) Relax the frozen pins too — `flavours` order and catalogue seeds stop being asserted
- [ ] C) Relax `SIGN_OFFS` too — a re-render stops voiding a listening verdict

**A) what stays, and why it is not what the ticket is complaining about.**

* `gate.test.ts`'s twenty `SIGN_OFFS` fail only *after* `npm run grooves`, not when a template is edited — and they are the only thing in the repo standing between a changed groove and a re-pin nobody listened to. `voidSignOff` (`:1806`) says it in the failure: *"the sign-off it invalidates is a human's ear and nothing in this repo can re-give it… Do not re-pin it to make the suite green."*
* `templates/index.test.ts:158`, `events.test.ts:2459` and `templates/boom-bap.test.ts:170` pin a feel's `flavours`, and `boom-bap.test.ts:321` pins its seeds. `docs/music.md:511` lists **each template's own `flavours` list** among the four things that must never change, because the draw indexes it and moving it re-keys every committed answer. These are identity, not content.

**The widening does not move this question.** It enlarges what it protects: after the widening, `theory/harmony.ts` is in scope, and a chord change is exactly the kind that re-renders the catalogue and voids the sign-offs the moment `npm run grooves` runs. Under A that is correct and the ticket simply renders nothing.

**B) and C) both fail size-test question 3** — they unfreeze something `docs/music.md` freezes, or remove the guard that catches it. Listed so the choice is yours rather than mine, not because I think either is right.

### Q2. Is "a bossa clave is exactly this rhythm" a test that makes sense?

`bossa-nova.test.ts:20` writes the clave out as a literal and says why, in a comment that is the clearest statement of the posture this ticket is pushing against:

> *"written out here rather than read off the template: a test that derived its expectation from the declaration would move with it and could never say the clave had moved."*

That reasoning is sound where the literal **is** the requirement. It is exactly wrong where the literal is just what happened to be written.

- [ ] A) **Keep the clave literal, drop the surdo one** *(recommended — a bossa clave is a named rhythm and a test may say so; the four surdo figures are one arrangement of a rule the same file already states, that every figure hits 1 and 3 and none hits the "and" of 4)*
- [ ] B) Property-test both — the clave becomes "two bars, different from each other, 3 hits then 2"
- [ ] C) Keep both literals, and treat bossa as the exception this ticket does not touch

**Whichever way this goes is the rule the rest of the rewrite follows**, and the widening is what makes that sentence expensive rather than tidy. The same fork decides `templates/index.test.ts:152`'s block of swung-sixteenth scalars, the two `gain.kick` literals at `:147`, and the four tonic chord names in `theory/harmony.test.ts:45`. Under A each is judged by one question — is the literal the requirement, or a record of what is written today? A bossa clave and "the dorian tonic is a minor seventh" are requirements. A gain of −10 dB is not: `docs/music.md` says the gains are turned by a listening sign-off, so the only honest assertion left is a band. That is why there is no Q3.

## Notes

**Size test — passes, on all four, conditional on Q1-A. The widening changes the volume, not the verdict.**

1. Five bullets: name the pins across the three surfaces · rewrite each content pin as the property it stood for · keep the identity, ear and grid pins · write the rule down in `docs/testing.md` · render nothing. Five.
2. One module — **catalogue**. `scripts/grooves/theory/` is the generator's own harmony, not the `theory` module in `src/lib/theory/`; the map files the whole of `scripts/grooves/` under catalogue. `docs/testing.md` is in no module.
3. Nothing frozen moves *under Q1-A*, harmony included. `buildHarmony` draws on `musicRng` — the frozen `MUSIC_LABEL` stream — but its draw *count* is `1 + (length − 1)` and depends on the rng, not on `QUALITIES`, so editing or reordering that table changes what is drawn and not how much or in what order. Inserting an rng call into `buildHarmony` is a different thing, and no test in scope may be relaxed to allow it. Under Q1-B it fails outright and goes to `/create-feature`.
4. One `git revert` — test files, plus one doc.

**The three kinds of assertion, and only one is the target.**

| Kind | Example | Verdict |
| :-- | :-- | :-- |
| **Content pin** — asserts the literal that is in the declaration today | `bossa-nova.test.ts:124` `expect(feel.patterns?.kick).toEqual(SURDO)` | **rewrite** as the property the literal was standing in for |
| **Property over what is declared** | `boom-bap.test.ts:258-273` reads `patterns.snareGhosts` and asserts ascending, no repeats, every step odd | **keep** — already survives a hand edit that is legal |
| **Pure function** | `riding.test.ts:240` `featherSteps([0, 6, 10], 16)` | **keep** — nothing to do with a template |

**What the widening adds, measured rather than guessed.** Four surfaces, and only two of them carry real work.

* **A feel's scalars — the bulk of the new work.** `templates/index.test.ts:30-31` (second-line's `tempoRange` and `swing`), `:147-150` (two `gain.kick` literals), `:152-165` (swung-sixteenth's whole block: tempo, swing, density, one gain, one pan, two leans), and `events.test.ts:2559-2576` (shuffle's tempo, swing and density). **The shape they become already exists in the tree twice**, which is why this is a rewrite and not a design: `templates/index.test.ts:416-428` states bossa's swing and tempo as a *band* plus "no other feel holds this swing, and none holds this range", and `:58-62` states that uniqueness for every feel at once. A `gain` is the one scalar with no property under it, and `second-line.test.ts:414-425` shows the only honest form — the toms and the rim within 6 dB of the snare, not at a number.
* **`subdivision` and `passes` — keep, and say why.** Pinned at `templates/index.test.ts:16`, `:29`, `:155`, `:407` and `events.test.ts:2571`. A feel's grid is the unit every step list in it is written in: change bossa from 8 to 16 and every literal in `patterns` means a different rhythm. Not identity, not content — the thing the content is measured in.
* **The shared tables in `events.ts` — almost nothing to do.** Two content pins only: `events.test.ts:2542-2555` restates straight-funk's hat pool as a literal in the test, and `second-line.test.ts:427-430` pins `PLACEMENTS['second-line'].rimBars` to `[0, 1, 2, 3]` (already on the list; `events.ts:226`'s own comment gives the property). The accent and duration tables are already property-tested — `events.test.ts:2416` asserts `RIDE_ACCENTS.length` is coprime with the four-beat bar, `voiceContract.test.ts:51` asserts `FILL_DURATIONS` names every voice — and `FILLS` and `DEFAULT_FILL` are only ever compared for *difference* (`second-line.test.ts:616-617`), never to a literal.
* **`theory/harmony.ts` — the cheapest of the three, and it passes today.** `theory/harmony.test.ts` is property-shaped throughout: every progression is graded against `VALIDITY[flavour]` and every chord name re-derived from its own midi, so adding, removing or reordering a quality in `QUALITIES` breaks nothing there. Its only literals are the four tonic names at `:45-52` — `Cm7` for aeolian and dorian, `C7` for mixolydian, `Cmaj7` for ionian — and those are facts about a mode, not a record of what `QUALITIES` currently says. Q2-A keeps them. The thing a chord change *does* break is `catalogue.json`, `grooves.lock.json` and the twenty `SIGN_OFFS`, all of them only after `npm run grooves`, all of them Q1's territory, and this ticket runs nothing.

**Files this is expected to touch.**

* `scripts/grooves/bossa-nova.test.ts:20`, `:26` — `CLAVE` and `SURDO`, and the comment at `:18` that states the posture. Settled by Q2.
* `scripts/grooves/templates/index.test.ts` — `:30-31`, `:147-150`, `:152-165` are the scalar content pins; `:443` asserts bossa's `patterns` keys exactly and `figures.length === 1`; `:110` asserts the feels that play no ride are exactly `['bossa-nova']`; `:126` asserts the riding feels are exactly `['shuffle', 'swung-sixteenth']`. The last two are registry facts rather than template content — they move when a *feel* changes voices, not when a step list or a gain moves — so they may survive as-is.
* `scripts/grooves/events.test.ts:2542-2555`, `:2559-2576` — straight-funk's restated hat pool and shuffle's scalar block. This file is the largest in the generator suite at 3189 lines and most of it is already property-shaped; these two are the ones the widening puts in scope.
* `scripts/grooves/second-line.test.ts:427-430` — `PLACEMENTS['second-line'].rimBars`.
* `scripts/grooves/patterns.test.ts` — the validators are where a rewritten test's rule belongs, so a rule stated once in `assert*` beats the same rule restated in six test files.
* `scripts/grooves/theory/harmony.test.ts` — **read, expected not to change.** Listed so the claim can be checked rather than believed.
* `docs/testing.md` — the rule this ticket settles is a testing standard and belongs beside "test behaviour, not implementation details", which is the same idea one level down.

**Assumptions taken rather than asked.**

* **The widening opens no third question.** Q2 is the general rule and it already reaches the scalars, the shared pools and the chord names; §5's ceiling holds because the new surfaces are more of the same fork, not a new one.
* **`npm test` never sees any of this.** `vitest.config.ts` puts all of `scripts/grooves/**` in the `generator` project, and `npm test` runs `app` and `tooling` only. The friction is on `npm run test:gen` and `npm run test:all`.
* **A rewritten test keeps its subject.** `docs/testing.md` already says a relocated assertion keeps its subject; the same applies to a re-expressed one. Turning `toEqual(SURDO)` into "every figure states 1 and 3 and none states the 'and' of 4" is the same assertion said properly. Turning it into `expect(pool.length).toBeGreaterThan(0)` is deleting it and keeping the name. This is what stops the scalar rewrite from becoming `expect(typeof feel.swing).toBe('number')`.
* **The seven gate thresholds are not in scope.** `gate.ts` rejects a *rendered candidate*, not a template, and a template edit that pushes a groove outside the density band should still fail — that is the suite catching a wrong template, which is what `## Done when` asks for. `density` on the template is the *declaration* of that band, so its literal pins are in scope while the gate that reads them is not.
* **Ticket 15 is not blocked by this and does not wait for it.** Under 15's Q1-A nothing it touches is a content pin: `templates/index.test.ts:443` stays green because bossa's `patterns` keys do not change.
