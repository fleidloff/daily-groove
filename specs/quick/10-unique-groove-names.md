# 10 — Unique groove names

## What

* Some grooves share the same name.
* Each groove's name must be unique — now, and for every groove minted later.

## Done when

* No two grooves in the catalogue share a name.
* Minting a groove with a name already in the catalogue fails instead of writing the duplicate.
* A test covers both.

## Open questions

### Q1. What makes a name unique — the generator, or a gate that stops a duplicate?

- [x] A) `scripts/grooves/name.ts` gains a catalogue-wide pass: names are assigned in catalogue order, the first holder of a name keeps it, and a colliding groove re-rolls on a salted stream (`<id>:name:2`, `:3`, …) until it is unique *(recommended — engineering reason, no persona bearing: the only option where the property holds by construction rather than by catching a violation after the fact. It changes exactly three names, all on the later id of each pair, and every groove minted later is unique without anyone remembering to check.)*
- [ ] B) `catalogue.json` gains an optional `name` per spec, filled in for the three clashes, plus a gate that fails when two names collide. Names become curated data a human can improve — which is what the **Catalogue curation UI** candidate in `specs/features.md` wants anyway. Cost: the spec schema grows a field, and a future clash breaks the build until someone edits the file by hand, so "must never happen" becomes "is caught", not "cannot occur".
- [ ] C) Grow `ADJECTIVES` and `NOUNS` in `scripts/grooves/words.ts` until clashes are unlikely. Cheapest, and it does not satisfy `## What`: with independent draws a collision is always possible, and at 30 grooves out of 784 combinations the expectation is already ~0.6 pairs. Listed for the record, not recommended.

## Notes

* Size test: **passes.**
  * *Five bullets* — yes.
  * *At most two modules* — **one: catalogue.** `scripts/grooves/` and the manifest it writes are the same module in `docs/architecture.md`, and nothing outside it is touched.
  * *Nothing frozen in `docs/music.md`* — its "What must never change" names `src/lib/hash.ts`, `MUSIC_LABEL`'s draw order, the `FLAVOURS`/template flavour lists and a groove's `uuid`. A name is none of them, and `nameFor` draws on its own `:name` stream (`scripts/grooves/name.ts:5`), so neither the audio nor the answer moves.
  * *One revert* — the regenerated manifest and lock ride in the same commit.
* Files, under Q1-A:
  * `scripts/grooves/name.ts` — the pass. `nameFor(seedLabel)` stays as it is; the new entry point takes the ids and returns a name each.
  * `scripts/grooves/cli.ts` — line 42, `toGroove` calls `nameFor(spec.id)` one spec at a time, so it cannot see a collision. The names have to be assigned over the whole catalogue before the entries are built.
  * `scripts/grooves/name.test.ts` — the new cases. Its existing four (`nameFor` stable per label, differing across labels, no collision across eight, no note or mode word in a thousand draws) stay untouched under A.
  * `src/features/daily-groove/data/grooves.generated.ts` and `scripts/grooves/grooves.lock.json` — **regenerated, never hand-edited**: `npm run grooves -- --manifest-only`, then `npm run grooves:verify`.
  * `src/features/daily-groove/data/grooves.generated.test.ts` — the shipped-catalogue half of Done-when 3. Line 88 already asserts "uses unique ids and unique audio paths"; names join that case or sit beside it, and line 76 ("a non-empty name and a plausible tempo") is what proves the pass still produces a name at all.
* **The three clashes, and who gives way.** `Rusted Shuffle` (`groove-01`, `groove-51`), `Hazy Awning` (`groove-09`, `groove-49`), `Smoky Awning` (`groove-40`, `groove-44`). Under A the earlier id keeps the name, so `groove-51`, `groove-49` and `groove-44` get new ones — three of thirty.
* Assumption: no audio is re-encoded. `--manifest-only` writes the manifest and leaves the mp3s alone, so the lock's per-groove `sha256` entries are untouched and only `manifestSha256` moves.
* Assumption: puzzle assignment does not move. `selectGrooveForDate` shuffles by array position under the seed `lap:N` and never reads a name.
* Assumption: renaming a groove a player has already seen is acceptable. The name shows only in `components/puzzle/GrooveCard.tsx:28`; share links are built from the `uuid` (`lib/share/url.ts`), which is the frozen thing and does not move.
* Under A, names are stable only while the catalogue stays append-only: deleting a spec that a later groove had to dodge would hand that later groove its first choice back. The catalogue's ids already run `groove-01` … `groove-52` for 30 specs, so rejects are dropped *before* minting rather than removed after — but a genuine deletion later would reshuffle a name.
* The arithmetic behind Q1-C: 28 adjectives × 28 nouns = 784 names. At 30 grooves the expected number of clashing pairs is ~0.6 (we have 3); at 60 it is ~2.3. A longer list postpones the problem and never removes it.
* No `musician`: `docs/music.md` says nothing about names — they are not in its "Where to change what" table, and no musical judgement is involved. No `sam` either; this is a catalogue defect, not a call about what the player wants.

## Answered — Q1-A

* **Q1-A.** The generator makes the name unique. `scripts/grooves/name.ts` gains a pass over the whole catalogue: names are assigned in catalogue order, the first holder keeps the name it draws, and a groove that would repeat one re-rolls on a salted stream until it is free. Nothing gates, nothing fails — a duplicate cannot be produced in the first place.
* Re-running §2 against it: **passes, unchanged.** One module, catalogue. `docs/music.md`'s "What must never change" is untouched — a name is not on that list, and `nameFor` draws on its own `:name` stream, so no audio re-renders and no past date is reassigned. One revert.
* Nothing is left open. Three names change (`groove-51`, `groove-49`, `groove-44`), the other twenty-seven are the names they already were, and every groove minted later is unique without anyone remembering to check.
* Assumption from A: the re-roll is bounded rather than a `while (true)`. There are 28 × 28 = 784 names, so a catalogue that ever approached that number would spin; the pass gives up after a fixed number of attempts with an error naming the id, which is a clearer failure than a hang.
* Assumption from A: the mint path needs nothing of its own. `scripts/grooves/add.ts` and `add-cli.ts` write a spec — `id`, `uuid`, `template`, `seed` — and never a name; `cli.ts` is the only place a name is assigned, so the pass covers minting for free.

## Built

Q1-A, as ticked.

* `scripts/grooves/name.ts` — `nameFor(seedLabel)` is unchanged in behaviour; it now calls a private `draw(stream)`. New `namesFor(seedLabels)` assigns names in catalogue order: the first holder of a name keeps it, a later clash re-rolls on `<id>:name:2`, `:3`, … until the name is free, and it throws rather than looping once the 784 combinations are exhausted.
* `scripts/grooves/cli.ts` — `toGroove` takes the name as a **required fourth argument** instead of drawing one, and `generate` computes `namesFor` over the rendered specs first. Required, not optional-with-a-default: one groove cannot see a collision, so the honest signature is one where every call site has to decide, and the compiler names any that does not.
* `scripts/grooves/add.ts` — the same at its own `toGroove` call site, which rewrites the manifest over the whole catalogue whenever a groove is minted. `cli.ts:119` and `add.ts:190` are the only two production callers of `namesFor`, and no production file outside `name.ts` calls `nameFor` at all.
* `src/features/daily-groove/data/grooves.generated.ts` + `scripts/grooves/grooves.lock.json` — regenerated with `npm run grooves -- --manifest-only`. The manifest diff is **exactly six lines**: `groove-44` Smoky Awning → Sunken Canyon, `groove-49` Hazy Awning → Glassy Parlour, `groove-51` Rusted Shuffle → Restless Veranda. The lock moves one line, `manifestSha256`; no per-groove `sha256` moved, so no mp3 was re-encoded.
* tests: `scripts/grooves/name.test.ts` (+6 — every label named, no two alike, the first holder kept and the later one moved, stability, both words still from the curated lists, and the throw when the names run out); `scripts/grooves/add.test.ts` (+1 and a `manifestNames` helper); `scripts/grooves/cli.test.ts` (+1, `toGroove` carries the name it is handed; its ten existing calls now pass one); `src/features/daily-groove/data/grooves.generated.test.ts` (+1, the shipped catalogue holds no repeated name).
* **The mint-path test is the one that took a second round.** The first verify pass graded D2 *partly*: every piece was tested and the wiring in `add.ts` was not, so reverting it to per-spec naming would have stayed green until a real mint clashed and the duplicate was committed. The case now mints onto a catalogue of `groove-01` and `groove-50` — the minted id is therefore `groove-51`, whose first-choice name is the one `groove-01` already carries, which is the collision the shipped catalogue actually had. Reverting `add.ts:190` fails it with `expected 'Rusted Shuffle' not to be 'Rusted Shuffle'`.
* **D2's wording versus what shipped.** The bullet says a colliding mint "fails instead of writing the duplicate"; under Q1-A it re-rolls instead. The outcome the bullet protects — no duplicate is ever written — holds, and now holds through the mint path as well as the manifest.
* Three things the ticket claimed and the verifier checked rather than assumed: no `.mp3` under `public/grooves/` changed, no groove's `uuid` moved, and no past date is reassigned — `selectGroove.ts` never reads a name, and its 365-day golden id sweep passes unchanged.
* checks: lint — clean / tsc — clean / test — 143 files, 2876 pass / test:gen — 44 files, 1073 pass / build — pass / grooves:verify — 30 grooves, 24 notes, manifests and catalogue all match the lock.
* verifier: **pass** — D1, D2 and D3 all **done**, each citing a test that exists and passes.
