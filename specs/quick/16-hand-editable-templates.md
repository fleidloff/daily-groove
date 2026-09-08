# 16 — Hand-editable templates

## What

* I want to change any `patterns` or `figures` in a template by hand without a test failing because of it.
* Leave the tests that make sense. Rewrite the rest.
* Changing a feel is meant to be a normal thing to do — `docs/music.md` says re-rendering every mp3 is always allowed — so the suite should catch a template that is *wrong*, not one that is *different*.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Editing any step list in any `templates/*.ts` — a pool figure, a `figures` bar, a pool's length — leaves `npm run test:gen` green, as long as the edit is musically legal.
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

**B) and C) both fail size-test question 3** — they unfreeze something `docs/music.md` freezes, or remove the guard that catches it. Listed so the choice is yours rather than mine, not because I think either is right.

### Q2. Is "a bossa clave is exactly this rhythm" a test that makes sense?

`bossa-nova.test.ts:20` writes the clave out as a literal and says why, in a comment that is the clearest statement of the posture this ticket is pushing against:

> *"written out here rather than read off the template: a test that derived its expectation from the declaration would move with it and could never say the clave had moved."*

That reasoning is sound where the literal **is** the requirement. It is exactly wrong where the literal is just what happened to be written.

- [ ] A) **Keep the clave literal, drop the surdo one** *(recommended — a bossa clave is a named rhythm and a test may say so; the four surdo figures are one arrangement of a rule the same file already states, that every figure hits 1 and 3 and none hits the "and" of 4)*
- [ ] B) Property-test both — the clave becomes "two bars, different from each other, 3 hits then 2"
- [ ] C) Keep both literals, and treat bossa as the exception this ticket does not touch

Whichever way this goes is the rule the rest of the rewrite follows, which is why it is a question and not an assumption.

## Notes

**Size test — passes, on all four, conditional on Q1-A.**

1. Five bullets: name the pins · rewrite content pins as property tests · keep the identity and ear pins · write down which is which · render nothing. Five.
2. One module — **catalogue**. Every file is under `scripts/grooves/`.
3. Nothing frozen moves *under Q1-A*. Under Q1-B it fails outright and goes to `/create-feature`.
4. One `git revert` — test files only.

**The three kinds of assertion, and only one is the target.**

| Kind | Example | Verdict |
| :-- | :-- | :-- |
| **Content pin** — asserts the literal that is in the template today | `bossa-nova.test.ts:124` `expect(feel.patterns?.kick).toEqual(SURDO)` | **rewrite** as the property the literal was standing in for |
| **Property over what the template declares** | `boom-bap.test.ts:258-273` reads `patterns.snareGhosts` and asserts ascending, no repeats, every step odd | **keep** — already survives a hand edit that is legal |
| **Pure function** | `riding.test.ts:240` `featherSteps([0, 6, 10], 16)` | **keep** — nothing to do with a template |

**Files this is expected to touch.**

* `scripts/grooves/bossa-nova.test.ts:20`, `:26` — `CLAVE` and `SURDO`, and the comment at `:18` that states the posture. Settled by Q2.
* `scripts/grooves/templates/index.test.ts:443` — asserts bossa's `patterns` keys exactly and `figures.length === 1`; `:110` asserts the feels that play no ride are exactly `['bossa-nova']`; `:126` asserts the riding feels are exactly `['shuffle', 'swung-sixteenth']`. The last two are arguably registry facts rather than template content — they move when a *feel* changes voices, not when a step list moves — so they may survive as-is.
* `scripts/grooves/second-line.test.ts:428` — `PLACEMENTS['second-line'].rimBars` pinned to `[0, 1, 2, 3]`. The file's own comment at `events.ts:226` gives the reason (the cross-stick clicks in all four bars so a fill bar still has it three times), which is a property, not a literal.
* `scripts/grooves/patterns.test.ts` — the validators are where a rewritten test's rule belongs, so a rule stated once in `assert*` beats the same rule restated in six test files.
* `docs/testing.md` — the rule this ticket settles is a testing standard and belongs beside "test behaviour, not implementation details", which is the same idea one level down.

**Assumptions taken rather than asked.**

* **`npm test` never sees any of this.** `vitest.config.ts` puts all of `scripts/grooves/**` in the `generator` project, and `npm test` runs `app` and `tooling` only. The friction is on `npm run test:gen` and `npm run test:all`.
* **A rewritten test keeps its subject.** `docs/testing.md` already says a relocated assertion keeps its subject; the same applies to a re-expressed one. Turning `toEqual(SURDO)` into "every figure states 1 and 3 and none states the 'and' of 4" is the same assertion said properly. Turning it into `expect(pool.length).toBeGreaterThan(0)` is deleting it and keeping the name.
* **The seven gate thresholds are not in scope.** `gate.ts` rejects a *rendered candidate*, not a template, and a template edit that pushes a groove outside the density band should still fail — that is the suite catching a wrong template, which is what `## Done when` asks for.
* **Ticket 15 is not blocked by this and does not wait for it.** Under 15's Q1-A nothing it touches is a content pin: `templates/index.test.ts:443` stays green because bossa's `patterns` keys do not change.
