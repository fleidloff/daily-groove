# 12 — Raise the dominance floor

## What

* Raise the dominance guard's floor by minting more `open-ballad` grooves, instead of widening `DOMINANCE_RATIO` again.
* The floor is `lydian-dominant` at 1 groove, offered by `open-ballad` alone, which ships 2 — so every new style pushes the commonest mode up while the floor stays put. The ratio went 5 → 6 during feature-25.
* How many `open-ballad` grooves to mint is open; the count is what sets the new floor.
* Whether `DOMINANCE_RATIO` tightens again afterwards is open — a higher floor could either buy headroom at 6 or let the guard come back down.
* `DOMINANCE_RATIO` lives in three files and they must stay in step: `scripts/grooves/catalogue.test.ts`, `scripts/grooves/manifest.test.ts`, `src/features/daily-groove/data/grooves.generated.test.ts`.
* Minting changes the catalogue length, which reshuffles the rota, so this bumps `ROTA_EPOCH` per the rule in `docs/music.md`.
* The guard is a guard against one mode swallowing the catalogue, not a coverage target — asked directly, Sam's answer was "I can't feel a ratio. I can feel a repeat."

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* `catalogue.json` holds more `open-ballad` grooves than the two it ships today, and every new one passes all seven gate checks.
* The measured dominance spread is recorded, and all three `DOMINANCE_RATIO` copies agree with each other.
* `ROTA_EPOCH` is bumped, and `src/lib/hash.ts` and its fixed table are untouched.
* No existing groove re-renders: `node scripts/grooves/rerender-check.ts` stage 4 reports 0 changed, and `npm run grooves:verify` is clean.
* The uuid freeze tables in `scripts/grooves/uuidFreeze.test.ts` and `src/features/daily-groove/data/uuidFreeze.test.ts` carry the new grooves.
* The new grooves are heard and signed off before the ticket is called done.

## Open questions

### Q1. Which templates does this mint, and how many grooves? — answered, C

- [ ] A) `open-ballad` ×4 only — the ticket as written *(recommended — `open-ballad` goes 2 → 6, in line with the six styles that already hold 6, and the `musician` grounded the count on feel balance rather than on the guard: at 6/52 the slow feel is 11.5% of the rota, the same cadence as every other style. lydian-dominant lands at 4, melodic-minor at 5, spread 6/2 = **3.00**)*
- [ ] B) `open-ballad` ×4 + `half-time` ×2 — six new grooves, spread 6/3 = **2.00**. `half-time`'s mints all land on harmonic-minor, which is the mode actually holding the floor down after A. Costs: `half-time` goes 5 → 7, one over every other style, and two more grooves to listen to
- [x] C) `open-ballad` ×3 + `half-time` ×2 + `swung-sixteenth` ×1 — six new grooves, floor 4, spread 6/4 = **1.50**, the tightest available without touching a template's `flavours`. Costs: three styles pushed off the shared count of 6, and `open-ballad` stops at 5 rather than joining the others
- [ ] D) `open-ballad` ×1 — the minimum that moves the floor at all: lydian-dominant 1 → 2, spread **3.00**, same as A. Leaves `open-ballad` at 3 against everyone else's 5–6

*A, B and C all reach floor 2 or better and all stay inside the catalogue and
puzzle modules, so none of them fails the size test. The difference is feel
balance, not architecture.*

### Q2. Does `DOMINANCE_RATIO` tighten in this ticket? — answered, A

- [x] A) Yes — down to the measured spread, 3 under Q1-A or Q1-B, 2 under Q1-C *(recommended — the constant's own comment in all three copies records it as "the tightest value that passes" and says widening it is a style epic's job, done as part of its mint. That makes it a ratchet: the next mint that pushes dominance has to widen it deliberately and record why, which is the property that caught this one)*
- [ ] B) No — leave it at 6 and bank the headroom, recording only the measured spread. The `musician` argued for this, on the grounds that a guard set to one measurement becomes a tripwire the next mint trips for no musical reason
- [ ] C) Part-way — 4. Keeps a ratchet without making the next mint's first attempt red

## Notes

* Size test: **passes**, on any of Q1's options.
  1. Five bullets: yes — mint, three constants, one epoch, two freeze tables, one listen.
  2. Two modules: **catalogue** (`scripts/grooves/`, `data/grooves.generated.ts`) and **puzzle** (`lib/puzzle/selectGroove.ts`). No option in Q1 adds a third.
  3. Frozen things untouched: `src/lib/hash.ts`, `MUSIC_LABEL` and its draw order, the order of `FLAVOURS` and every existing `uuid` are all unread by a mint. `ROTA_EPOCH` is named in `docs/music.md` § What deliberately may — "it changes a seed string, not `hashString`" — and a date already played keeps its groove through the pin in `lib/puzzle/dailyGroove.ts`. No template file is edited, so no committed groove re-renders.
  4. One revert: yes — one commit carrying the new mp3s, the catalogue, the manifest, the lock and the tests.

* **The floor is not lydian-dominant's alone, and the ticket's third bullet is
  half right.** Measured over the shipped manifest: lydian-dominant 1,
  harmonic-minor 2, phrygian-dominant 3, then aeolian / blues / lydian /
  melodic-minor / mixolydian at 4, harmonic-major / ionian at 5, dorian /
  phrygian at 6. Each of the three rarest is offered by exactly one template —
  `open-ballad`, `half-time`, `swung-sixteenth`. So minting `open-ballad` alone
  caps the new floor at **2**, whatever the count: harmonic-minor takes over as
  the rarest the moment lydian-dominant passes it. Q1 is that finding.

* **The flavour a mint lands on is not a draw.** `selectSeeds`
  (`scripts/grooves/select.ts:53`) builds a per-flavour quota, and at
  `perTemplate: 1` — which is what `addGrooves` passes for every groove
  (`scripts/grooves/add.ts:123`) — `share` is 0 and the single spare slot goes to
  the scarcest flavour first. Every `--template open-ballad` mint is therefore
  lydian-dominant until it ties melodic-minor, then alternates. Minting 4 gives
  lydian-dominant 4 and melodic-minor 5 deterministically, not 2/2 with a tail.
  The `musician`'s variance argument, and its "measure before bumping
  `ROTA_EPOCH`, re-mint if it lands 4/0" branch, rest on a coin flip the code
  does not make — but its count and its reasoning for 6 stand.

* **`## Done when` bullet 4 cannot be met as written.**
  `node scripts/grooves/rerender-check.ts` stage 4 does not ask "did anything
  change" — it asks "did *exactly the riding feels' grooves* change".
  `ridingIds` (`scripts/grooves/rerenderReport.ts:38`) returns every groove whose
  template declares a `ride` voice, which today is `shuffle` and
  `swung-sixteenth`: 11 grooves. A mint re-renders none of them, so all 11 land
  in `mismatch.missed` and the run exits `EXIT_AUDIO_SET`. The tool is
  feature-24/25's, bound to a generator change, and no mint can make it green.
  What proves the same thing: `git diff scripts/grooves/grooves.lock.json` shows
  only appended entries — `mergeLock` re-hashes the files on disk and `addGrooves`
  encodes only the new ids — and `npm run grooves:verify` then checks every
  shipped mp3, both manifests and the catalogue against that lock. **Fred's call
  to amend the bullet; this skill does not edit `## Done when`.**

* Assumptions taken rather than asked:
  * **No `SIGN_OFFS` entry is added.** `scripts/grooves/gate.test.ts:981` pins
    groove-07, 08, 28, 40, 48, 58, 65 and 71 — `shuffle`, `swung-sixteenth`,
    `bossa-nova`, `second-line`, `boom-bap`. `open-ballad` has no pin today, and
    the table's stated compression is one pin per *feel*, guarding a move in that
    feel's template file. This ticket edits no template, so it voids no approval
    and owes no new pin. The listening in bullet 6 is a judgement on the new
    renders, not a re-pin.
  * **Existing names stay put.** `namesFor` (`scripts/grooves/name.ts:18`) is
    first-holder-keeps over the catalogue in order, and a mint appends, so
    quick-10's uniqueness rule renames nothing.
  * **New roots ship without a "where you've heard it" line.**
    `heard-in.json` holds 21 keys for 48 grooves and `heardIn.test.ts` only
    forbids a key no groove renders, so a new `F lydian dominant` is simply
    silent there. Filling it in is quick-1's territory, not this ticket's.
  * **What to listen for**, from the `musician`: `open-ballad` declares
    `density.minPerBar: 8`, six lower than any other feel, with `passes: 2`. A
    new groove can clear the gate and still be too sparse to name the mode from.
    The expectation on each new render is that the characteristic degree — the
    ♮7 in melodic minor, the ♯4 in lydian dominant — sounds in the comp at least
    once per chord. A groove that fails it is re-minted, not answered by widening
    the density band.
  * **Sam has no objection to more ballads**, and wants them: *"A 65 bpm ballad
    is the one groove in the catalogue I'd actually keep looping while I get the
    sax out."* Their one soft limit is `open-ballad` past about one day in six,
    which no option here reaches. On the guard itself they repeat the ticket's
    own line — they cannot feel a ratio.

* Files expected to change:
  * `scripts/grooves/catalogue.json` — the new specs appended, ids from `groove-77`.
  * `public/grooves/groove-77.mp3` … — new audio only; no existing file is rewritten.
  * `scripts/grooves/grooves.lock.json` — appended entries, via `mergeLock`.
  * `src/features/daily-groove/data/grooves.generated.ts` — regenerated whole: the new entries plus whatever `buildPools` now yields.
  * `scripts/grooves/catalogue.test.ts:32`, `scripts/grooves/manifest.test.ts:326`, `src/features/daily-groove/data/grooves.generated.test.ts:37` — `DOMINANCE_RATIO` and the measured-spread paragraph above each, which carries the count history and has to be rewritten, not just re-numbered.
  * `scripts/grooves/uuidFreeze.test.ts` and `src/features/daily-groove/data/uuidFreeze.test.ts` — one appended row per new groove, pasted from the failure.
  * `src/features/daily-groove/lib/puzzle/selectGroove.ts:9` — `ROTA_EPOCH` 2 → 3.
  * `src/features/daily-groove/lib/puzzle/selectGroove.test.ts:86,273` — the two `expect(ROTA_EPOCH).toBe(2)` pins, and the pinned order strings at :65 that the file says move only in a commit that also moves the epoch.

* **Overlap with quick-11.** That ticket edits `selectGroove.ts` and adds a
  `style` field to `grooves.generated.ts` — the same two files. Its Q1 answer was
  measured over the 48-groove catalogue ("a first-fit backtracking shuffle over
  all 48 grooves solved 20 of 20 seeds"); a 52- or 54-groove catalogue with a
  sixth `open-ballad` makes the style constraint easier, not harder, but the
  measurement is stale either way. Whichever ships second re-runs it. This ticket
  assumes nothing about the order.

## Answered — Q1-C, Q2-A

**Q1-C — six new grooves across three templates.** `open-ballad` ×3,
`half-time` ×2, `swung-sixteenth` ×1. Catalogue 48 → 54, ids `groove-77` …
`groove-82`.

The flavour each mint lands on is decided, not drawn — `selectSeeds` gives the
single quota slot to the scarcest flavour of the template it is minting for
(`select.ts:53`, and `add.ts:123` passes `perTemplate: 1`). So the six land
exactly here:

| Template | Mints | Flavour each lands on | Template count |
| :-- | :-- | :-- | :-- |
| `open-ballad` | 3 | lydian-dominant ×3 (1 → 4; melodic-minor never ties it) | 2 → 5 |
| `half-time` | 2 | harmonic-minor ×2 (2 → 4; phrygian sits at 6) | 5 → 7 |
| `swung-sixteenth` | 1 | phrygian-dominant ×1 (3 → 4; harmonic-major sits at 5) | 5 → 6 |

Resulting spread over 54: **eight modes at 4** — lydian-dominant,
harmonic-minor, phrygian-dominant, aeolian, blues, lydian, melodic-minor,
mixolydian — harmonic-major and ionian at 5, dorian and phrygian at 6. Floor 4,
ceiling 6, **spread 1.50**, down from 6.00.

**Q2-A — the guard tightens to the measured spread.** That opens Q3, because the
two halves of the option disagree once C is the answer: the measured spread is
1.50, and the parenthetical named 2. Both are on offer below.

**Size test re-run against C: still passes.** Three templates are minted *from*,
none is edited, so question 3 is untouched and no committed groove re-renders.
Still catalogue and puzzle only. Six new renders to listen to instead of four is
the real cost, and it is a cost in your time, not in the test.

## Open questions — round 2

### Q3. What number does `DOMINANCE_RATIO` become? — answered, B

- [ ] A) `1.5` — the measured spread exactly *(recommended — it is what Q2-A's headline says, and it matches the one precedent: feature-25 set the constant to 6 when the spread it had just measured was exactly 6.00. It also gives the ratchet its full bite — the next mint that takes any mode to 7 against the floor of 4 has to widen the constant deliberately and say why, which is the mechanism that produced this ticket)*
- [x] B) `2` — what the parenthetical in Q2-A named. 6 ≤ 4 × 2 = 8, so the ceiling may drift to 8 before the guard bites. Keeps the constant an integer, as all three copies have been, at the price of slack no measurement justifies
- [ ] C) `1.75` — halfway. The ceiling may reach 7 but not 8; the next style that pushes one mode to 7 lands green and the one after it does not

## Notes — round 2

* Files, revised for C. Six new grooves instead of four, and one more template
  minted from; the file list itself does not grow.
  * `scripts/grooves/catalogue.json` — six appended specs, `groove-77` … `groove-82`.
  * `public/grooves/groove-77.mp3` … `groove-82.mp3` — new audio only.
  * `scripts/grooves/grooves.lock.json` — six appended entries.
  * `src/features/daily-groove/data/grooves.generated.ts` — regenerated whole.
  * `scripts/grooves/catalogue.test.ts:32`, `scripts/grooves/manifest.test.ts:326`, `src/features/daily-groove/data/grooves.generated.test.ts:37` — the constant and the measured-spread paragraph above each.
  * `scripts/grooves/uuidFreeze.test.ts` and `src/features/daily-groove/data/uuidFreeze.test.ts` — six appended rows each.
  * `src/features/daily-groove/lib/puzzle/selectGroove.ts:9` — `ROTA_EPOCH` 2 → 3.
  * `src/features/daily-groove/lib/puzzle/selectGroove.test.ts:65,86,273` — the two epoch pins and the pinned order strings.

* **`swung-sixteenth` is a riding feel, and its ride coverage test survives —
  checked, not assumed.** `gate.test.ts:996` requires every ride figure the
  catalogue ships to have a `SIGN_OFFS` entry among the grooves that draw it.
  Measured: `RIDE_PATTERNS[16]` holds three figures and `swung-sixteenth`
  already ships all three, each group already pinned — `[0,4,8,12,15]` on
  groove-28 and 50, `[0,4,7,8,12,15]` on groove-34 and 48, `[0,3,4,8,11,12]` on
  groove-40. A seventh `swung-sixteenth` groove must draw one of those three and
  joins a group that is already covered, so the test stays green and this ticket
  still owes no new sign-off pin. This is the one thing C risked that A and B
  did not — `open-ballad` and `half-time` ride nothing.

* **Three mint runs, not one.** `npm run grooves:add 3 -- --template open-ballad`,
  then `2 -- --template half-time`, then `1 -- --template swung-sixteenth`.
  Each run reads the catalogue the previous one wrote, so the scarcity counts are
  live and the order between the three templates changes nothing but which ids
  land where. Seeds come from the clock (`seedFromClock`, `add.ts:68`), so the
  grooves you get are not reproducible from the ticket — which is why bullet 6 of
  `## Done when` is a listening pass and not a fixture.

* **The slow end of the rota grows more than Q1's cost line said.**
  `open-ballad` (62–74) and `half-time` (68–80) are the two feels below 80 bpm;
  together they go 7/48 = 15% to 12/54 = 22% of days. Sam's soft limit was on
  `open-ballad` alone past about one day in six, and 5/54 is one in eleven, so
  it is not crossed — but the ticket is now moving the tempo profile as well as
  the mode histogram, and that is worth hearing rather than reading.

* Everything in `## Notes` round 1 still holds unchanged: the `rerender-check.ts`
  bullet cannot go green for any mint, names stay put, new roots ship without a
  heard-in line, and no `SIGN_OFFS` entry is owed.

## Answered — Q3-B

`DOMINANCE_RATIO` goes **6 → 2** in all three copies. Against the post-mint
spread — ceiling 6, floor 4 — the guard reads `6 ≤ 4 × 2 = 8` and passes with
room for the commonest mode to reach 8 before it bites.

This is the first time the constant has moved down; every previous edit widened
it. The failure message the three copies print still says "Widen
`DOMINANCE_RATIO`", and that stays correct — it is the instruction for the run
where the guard is red, not a claim about which way the constant has travelled.
What has to be rewritten in each copy is the measured-spread paragraph above the
constant, which currently records the feature-25 widening and the 48-groove
measurement, and which the next mint reads to know what it is changing.

**Nothing is left open.** The answer names a number in three files that were
already on the list, adds no module, no file and no test.

## Notes — final

* Size test: **passes**, on Q1-C / Q2-A / Q3-B.
  1. Five bullets: mint six grooves across three templates; `DOMINANCE_RATIO`
     6 → 2 in three copies with their comment blocks rewritten; `ROTA_EPOCH`
     2 → 3 and its three pins; six rows appended to each uuid-freeze table;
     listen to the six new renders.
  2. Two modules — **catalogue** and **puzzle**. Unchanged from round 1.
  3. Frozen things untouched. Three templates are minted from, none is edited,
     so no committed groove re-renders and no past answer moves.
  4. One revert — one commit carrying the six mp3s, the catalogue, the manifest,
     the lock and the tests.

* The full file list is in `## Notes — round 2`. Q3 changes a value in three
  files already named there and adds nothing.

* Two things the build has to carry from these notes, because no test states
  them:
  * `node scripts/grooves/rerender-check.ts` cannot report what `## Done when`
    bullet 4 asks of it — see round 1. `git diff scripts/grooves/grooves.lock.json`
    showing only appends, plus `npm run grooves:verify`, is the check that
    proves the same property.
  * The listening pass is on six renders, and the thing to listen for is whether
    the characteristic degree sounds — the ♮7 in melodic minor, the ♯4 in lydian
    dominant, and for the two new `half-time` grooves the ♭2 against the ♮7 that
    separates harmonic minor from phrygian. A groove that fails it is re-minted.

## Built

* `scripts/grooves/catalogue.json` — six specs appended, `groove-77` … `groove-82`, minted in three runs: `grooves:add 3 -- --template open-ballad`, `2 -- --template half-time`, `1 -- --template swung-sixteenth`.
* `public/grooves/groove-77.mp3` … `groove-82.mp3` — new audio; no existing file rewritten.
* `scripts/grooves/grooves.lock.json` — six entries appended; the only two lines removed are the top-level `catalogueSha256` and `manifestSha256`.
* `src/features/daily-groove/data/grooves.generated.ts` — regenerated; **zero removed lines**, a pure append.
* `scripts/grooves/catalogue.test.ts`, `scripts/grooves/manifest.test.ts`, `src/features/daily-groove/data/grooves.generated.test.ts` — `DOMINANCE_RATIO` 6 → 2, each one's measured-spread paragraph rewritten with the new histogram.
* `scripts/grooves/uuidFreeze.test.ts`, `src/features/daily-groove/data/uuidFreeze.test.ts` — six rows appended to each.
* `src/features/daily-groove/lib/puzzle/selectGroove.ts` — `ROTA_EPOCH` **3 → 4**, and the comment above it.
* `src/features/daily-groove/lib/puzzle/selectGroove.test.ts` — both epoch pins to 4, both sweep strings recaptured, the epoch loop extended to 4.
* `scripts/grooves/events.fixture.json` — regenerated by `node scripts/grooves/eventsFixture.ts --write`; **zero removed lines** over 54 grooves and 20 123 events.
* `scripts/grooves/harmony.fixture.json` — six entries appended by hand in the file's own `\uXXXX` escaping, derived through `toGroove` and cross-checked field by field against the manifest, per the note the file carries.
* `scripts/grooves/events.test.ts` — six rows appended to `PRE_EPIC_MUSIC`.
* `src/features/daily-groove/data/grooves.generated.test.ts` — catalogue length 48 → 54; one entry added to the double-accidental set, `E♭: E Lydian dominant`, and its count 12 → 13.
* `src/features/daily-groove/components/solved/LeadSheet.test.tsx` — the widest-symbol pin 7 → 8, `E♭maj7♯5`.
* `src/features/daily-groove/lib/audio/beat.test.ts` — the catalogue's slowest tempo 67 → 65 and the worst-case wait bound 0.9 → 0.93.

**Tests:** no new test file. Six catalogue-derived pins across four test files were re-read, which is what a mint does to them — `beat.test.ts` says so above the two it owns: *"A mint that widens the span edits these two and re-reads the bounds above."* Every bound was re-read against the new extreme, none was loosened past it, and `LeadSheet`'s two `it.each(WIDEST)` cases proved the wider symbol still draws whole before its pin was moved.

**Checks:** `npm run lint` clean · `npm test` 3057 in 145 files · `npm run test:gen` 1474 in 51 files · `npm run build` clean · `npm run grooves:verify` — 54 grooves, 24 notes, manifests and catalogue all match the lock.

**Verifier: pass.** `specs/quick/.verify/12.md`. D1–D5 **done**; D6 **partly** in the report on the single ground that a listening sign-off relayed through the lead is not the verifier's to claim — it is settled here, see below. Its eight citations were resolved by hand: `parseCitations` reads a three-column table and the report wrote four, so the tool parsed nothing rather than failing anything.

* **D1** — `catalogue-gate.test.ts` › `accepts $id ($template)` puts all six through the seven gate checks.
* **D2** — `catalogue.test.ts`, `manifest.test.ts` and `grooves.generated.test.ts` each assert the spread at the same constant, from three tiers.
* **D3** — `selectGroove.test.ts` › `ships as 4`. `src/lib/hash.ts` and its fixed table were never opened.
* **D4** — settled by the substitute this ticket named in round 1, plus a stronger witness the verifier found: `events.fixture.json` regenerated with zero removals, and `eventsFixture.test.ts` › `deep-equals what the generator builds today` checks it against a live rebuild. No committed groove's event stream moved. `rerender-check.ts` was not run, for the reason in `## Notes`.
* **D5** — `uuidFreeze.test.ts` › `pins a uuid for every groove the catalogue holds`, both halves.
* **D6** — **done.** Fred played all six and signed them off: *"listened to all the new grooves. All are good to my ears."* That is the sign-off `docs/music.md` asks for, and no test stands behind it.

**The measurement, as shipped.** `open-ballad` 2 → 5, `half-time` 5 → 7, `swung-sixteenth` 5 → 6; catalogue 48 → 54. Eight modes at 4 — lydian-dominant, harmonic-minor, phrygian-dominant, aeolian, blues, lydian, melodic-minor, mixolydian — harmonic-major and ionian at 5, dorian and phrygian at 6. Floor 4, ceiling 6, **spread 1.50** against a `DOMINANCE_RATIO` of 2. Q1-C's prediction held exactly, flavour for flavour, which is what `selectSeeds`' quota was expected to do.

**Three corrections to the notes above, recorded rather than edited in place:**

* `ROTA_EPOCH` went **3 → 4**, not the 2 → 3 the round-1 and round-2 notes say. Quick-11 shipped between this ticket's analysis and its build and took the epoch to 3; the build read the file rather than the ticket.
* The round-2 file list did not foresee `events.fixture.json`, `harmony.fixture.json`, `events.test.ts`, `beat.test.ts`, `LeadSheet.test.tsx` or the two length pins in `grooves.generated.test.ts`. Seven files of catalogue-derived pins, all mechanical, none a change of behaviour — but the honest count is that a mint moves pins in four modules' tests while changing production code in two.
* The listening check in `## Notes` — *"the characteristic degree sounds in the comp at least once per chord"* — is unmeetable as written, and the `musician` withdrew it on measuring: a chord carries four of seven degrees, and a lydian dominant's tonic I7 can never contain the ♯4, so no groove of any flavour in the catalogue meets it. The form that holds is **once per progression cycle, counting the bass as well as the comp** — the bass because the rootless voicing rule drops any degree that is the bar's chord root, which is exactly `groove-79`, whose ♯4 is the root of `Dm7♭5` and sounds in the bass on the downbeats instead. On that reading all six pass, and so does every groove already shipped.

**Two things found in passing, neither this ticket's to fix:**

* `open-ballad` declares `density.minPerBar: 8` in `templates/open-ballad.ts`, and its five grooves measure 23.3–24.6. The feel's own eighth-note `hatClosed` contributes about 8/bar before anything else plays, so the floor is unreachable — a dead guard, not a loose one. Worth its own ticket.
* Nothing pins the per-template groove counts, and nothing asserts the three `DOMINANCE_RATIO` copies agree — that one is a grep by convention, and a structural test reading the three files from disk would close it, the way `src/lib/hash.test.ts` does for the FNV-1a constant.
