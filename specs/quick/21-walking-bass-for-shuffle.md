# 21 — Walking bass for shuffle

## What

* `shuffle` gets the walking bass too — the same line quick-20 built for `swung-sixteenth`.
* Every groove in that style.

## Done when

* Every bass note in a walking `shuffle` groove lands on a quarter, and every quarter of the bar has one.
* No feel other than `shuffle` and `swung-sixteenth` walks its bass.
* `shuffle`'s three blues grooves are re-rendered, so the walking bass is what plays.

*D1 and D3 were narrowed on 2026-09-10, on the user's instruction, after the ticket's own
scope narrowed from the whole feel to its three blues grooves. They previously read
"Every bass note in a `shuffle` groove…" and "The six `shuffle` grooves are
re-rendered…", and the verifier graded both **partly** against that wording, correctly:
the three aeolian grooves put 24, 24 and 40 bass notes off a quarter and every one of
their bars is missing at least one. The behaviour never changed; only these two
sentences did.*

## Open questions

_None._

## Notes

Asked directly, after hearing quick-20's result on `swung-sixteenth`: *"please use the
walking-bass for shuffle. I think that fits."* The mechanism already exists, so this
ticket is one template line plus the consequences of a re-render.

### Size test — passes all four

1. **Yes.** One line on the template, six re-renders, three voided sign-offs, and whatever the catalogue-wide tests say about a second walking feel.
2. **Yes.** One module — catalogue.
3. **Yes.** Nothing on *What must never change*. `bassType` selects a code path; it draws nothing from `MUSIC_LABEL` and moves no `uuid`.
4. **Yes.** One `git revert`.

Cheaper than quick-20 by the whole of its design: `BassType`, the walking path,
`BASS_WALK_*`, the widened `APPROACH_WINDOW` and the guards on the drawn figure's
invariants all already ship.

### Why `shuffle` and not one of the other seven

`open-ballad` was tried under quick-20 and rejected. **The reason written in this
section when the ticket was drafted was wrong**, and the corrected one is in
*What the `musician` measured* below: it is not that the ballad has nothing on the
quarters — its closed hat states all four in 100% of bars — but that it has no voice in
the *bass's own weight class* there, because feathering is gated on the ride. `shuffle`
rides, so its kick feathers every quarter the drawn figure leaves, and its walk is
doubled rather than carrying the pulse alone. That is the condition `open-ballad`
failed, and riding is an exact proxy for it only because `docs/music.md` bolted the two
together on purpose.

### What subdivision 8 changes, and what it does not

`shuffle` is the first walking feel on the eighth grid, and every constant is expressed
in units that survive it:

* **Quarters.** `quarterBassSteps` is `beat * subdivision / 4`, so the line lands on grid steps **0, 2, 4, 6** rather than 0, 4, 8, 12. Nothing hard-codes 4.
* **Sustain.** `BASS_WALK_SUSTAIN` is 3.5 *sixteenths* and `add` computes `sixteenths * (barSec / PATTERN_RESOLUTION)`, so 3.5 is 0.875 of a quarter at either subdivision. The half-sixteenth gap before the next attack is unchanged.
* **The approach note** moves with the grid to step 6. `events.test.ts`'s R8 check reads `(subdivision * 3) / 4`, so it follows.
* **Swing** is irrelevant to the line at 0.64 exactly as it was at 0.44: every walking note is on a beat, and swing displaces off-beats only.

### `blues` is the awkward flavour, and it is fine

`shuffle` draws `blues` and `aeolian`. `blues` is the six-note scale, and by the harmony
idiom its I, IV and V are stated **dominant sevenths** whose major third the scale does
not contain. So beats 2 and 3 will spell a major third that is not a scale tone.

* The gate admits it: `admittedPitchClasses` unions the scale with every pitch class of every chord in the progression, so a stated chord tone is legal by construction.
* It is also right musically — a blues walking bass plays the major third of the I7. The scale is the answer the puzzle asks for; the chord is what the bass spells.
* What to watch instead is the **six-note scale's effect on the `restating` pool**: a `5` or `sus4` quality leaves few chord tones that are not the root, so beat 3 falls back more often. `walkStep`'s pool-preserving fallback covers it, and this is the first feel to exercise that path.

### Files this is expected to touch

* `scripts/grooves/templates/shuffle.ts` — `bassType: 'walking-bass'`.
* `scripts/grooves/patterns.test.ts` — `shuffle` leaves the declares-nothing list only if a pool is declared; it is not, so this may not move at all.
* `scripts/grooves/bassFloor.test.ts` — the drawn-bass count drops 48 → 42.
* `scripts/grooves/walkingBass.test.ts` — the walking set becomes twelve grooves across two feels, and its shape assertions should run against `shuffle` too.
* `scripts/grooves/events.test.ts` — the two R7/R8 tests already scope by `bassType`, so they should follow on their own.
* `docs/music.md` — the feel table's prose, the walking-bass section, and the always-lift figures again (48 → 42 drawn).
* `scripts/grooves/gate.test.ts` — groove-07, groove-08 and groove-44 are pinned sign-offs and will be voided.
* `scripts/grooves/events.fixture.json`, `scripts/grooves/grooves.lock.json`, and six MP3s.

### Assumption

**No constant is re-turned for this feel.** The sustain, the velocity table and the
ceiling were approved by ear on `swung-sixteenth`, and `docs/music.md` already warns
that a second feel should expect to re-turn them rather than inherit them. They are
inherited here as the starting point, and the listening at the end is what decides
whether `shuffle` wants its own — its bass sits at −19 against `swung-sixteenth`'s
−19.5, and it is 30 bpm slower, which is the direction that exposed `open-ballad`.

## Built

Built twice. The feel walked first, was heard and approved, and then narrowed to the
musician's recommendation on the user's call: *"let's go with the musician's
recommendation."*

* `scripts/grooves/catalogue.json` — `bassType: 'walking-bass'` on **groove-42, groove-44, groove-52**, the feel's three blues grooves.
* `scripts/grooves/templates/shuffle.ts` — **unchanged in the end.** No `bassType`, and `gain.bass` back at `-19`. The whole-feel version had both.
* `scripts/grooves/walkingBass.test.ts` — every shape claim now runs over both walking feels and asks for the line explicitly, since `shuffle` walks per groove rather than per template. New tests: the quarters land on 0/2/4/6 on the eighth grid and 0/4/8/12 on the sixteenth, swing displaces neither at 0.64 nor 0.44, all four notes are one length, and which nine grooves walk. 24 tests.
* `scripts/grooves/bassFloor.test.ts` — drawn-bass count 48 → 45. Still forces the drawn path, so feature-28's hand-measured literals stand untouched for a third ticket.
* `scripts/grooves/lowRegister.test.ts` — one test asserted catalogue order for the first two shuffle grooves, which held only while groove-07 outranked groove-08. Now asserts membership; the two tests above it own the ordering.
* `docs/music.md` — the always-lift figures (26 of 45, ten in bar 1, ten of fifteen signed-off-and-still-drawing), the nine walking grooves and how they are selected, the mixed-feel gain problem, and three stale `events.ts` line citations.
* `scripts/grooves/gate.test.ts` — groove-44 re-pinned; `QUICK_21_APPROVAL` / `QUICK_21_SCOPE`. groove-07 and groove-08 **restored to their original pins**: narrowing the walk put their audio back byte-identical, so their older listenings stand again and `FEATURE_27_*` are load-bearing once more.
* `scripts/grooves/events.fixture.json`, `scripts/grooves/grooves.lock.json`, and nine MP3s — `swung-sixteenth`'s six plus `shuffle`'s three blues.

### What the `musician` measured

It ranked `shuffle` first, said **never** to `bossa-nova`, `second-line`, `half-time`,
`boom-bap` and `open-ballad`, and *plausible but don't* to `straight-funk` and
`bright-straight` — a funk bass is syncopated by definition and a walk deletes the style
rather than dressing it. Its case for the blues three specifically: they sit on I–V–IV–V
dominant sevenths, the one progression a walk was invented for, and a walk there is the
default arrangement rather than a variation.

It also **corrected quick-20's stated reason for the `open-ballad` rejection**, which
this session had written into `docs/music.md` as fact. That reason — "does not ride, so
the walking bass becomes the only voice stating all four quarters" — is false:
`open-ballad`'s closed hat states all four quarters in 100% of ordinary bars. The real
discriminator is **feathering**, which fills the quarters `KICK_PATTERNS` leaves and is
gated on `rides`: kick on every quarter in 100% of `shuffle` and `swung-sixteenth` bars,
7% of `bossa-nova`'s, 0% elsewhere. Riding is an exact *proxy* only because
`docs/music.md` bolted the two together on purpose. Both `docs/music.md` and quick-20's
own notes now carry the retraction.

One recommendation still **not** taken: it named the **boogie figure** (root–3–5–6 in
shuffled eighths) as equally idiomatic over a shuffle blues. That is a different ticket.

### The gain, which is the one thing left open

`gain.bass` is per feel, and `shuffle` is now the first feel with a walking half and a
drawn half. One number cannot serve both:

| | walking three | drawn three |
| :-- | :-- | :-- |
| at `-19` (**ships**) | −0.35, +0.01, −0.22 dB | −2.87, −1.13, −2.61 dB — untouched |
| at `-20.4` | ≈ −1.7 dB, as approved | ≈ 1.4 dB quieter than approved |

`-19` ships because narrowing the walk was chosen precisely to leave the aeolian three
alone, and `-20.4` would have quietened them instead. The consequence is that the three
walking grooves have their bass level with the kick — the most forward in the catalogue,
and groove-42 is the only groove of the 54 whose bass sits above its own kick. **That
went unheard for one round and was then approved on its own listening**, recorded below.

The walk's **1.40 dB** (measured 1.35, 1.34, 1.52 on the three) splits as **1.21 dB from
`BASS_WALK_SUSTAIN`** and only **0.19 dB from note count**. Two earlier drafts of this
ticket had it wrong in opposite directions: the first credited it all to note count, and
the second quoted 0.53/0.90 — which was a sum reconstructed to total 1.43 rather than a
measurement, and computed over the feel's six grooves forced drawn instead of the three
that actually walk. It is the note-*time* that moves the level.

* checks: `npm run lint` clean · `npx vitest run` 4669 passed, 0 failed · `npm run grooves:verify` — 54 grooves, 24 notes, all matching the lock.
* gate: all six shuffle grooves pass the seven checks. Tightest margins are loudness on groove-42, 3.38 dB under the ceiling, and density on groove-19, 5.50 events/bar under 38.

## Heard and approved

2026-09-10, third listening, over the catalogue as it now stands:

> listened to all grooves. All sound good.

That is what closes the level. The first listening had approved the walk on all six
grooves at `-20.4`; narrowing the scope moved the balance to `-19` and left it owing a
pass, and this is the pass. groove-44 is re-pinned on these words, and
`QUICK_21_SCOPE` records all three listenings and which one closed what — the balance
went unheard for exactly one round, and the record says so rather than letting the pin
imply the first approval covered it.

Three claims in groove-44's own notes were stale from the whole-feel version and were
corrected with it: that the declared gain was `-20.4`, that the walk moved groove-08's
audio (narrowing put it back byte-identical), and that groove-19 walks the shared ride
figure unpinned — it draws it, being one of the three aeolian grooves the walk left
alone.

## Verified

`specs/quick/.verify/21.md`, second run — the first graded the whole-feel tree and was
superseded when the scope narrowed under it mid-run.

* **D1 — done** against the narrowed wording. `walkingBass.test.ts` › *puts one bass note on each of the four quarters of every bar*, which runs over both walking feels and requests the line explicitly. The verifier confirmed all 14 shape assertions pass `WALK` rather than relying on the template, so dropping it would make them silently measure the drawn figure.
* **D2 — done.** Three tests hold it from three directions: no feel declares `walking-bass` without a ride, no groove overrides a feel that does not ride, and the walking set is exactly nine named grooves.
* **D3 — done** against the narrowed wording. `gate.test.ts`'s re-pinned groove-44 plus `walkingBass.test.ts` › *walks shuffle's three blues grooves and leaves its three aeolian ones drawn*.

Both bullets graded **partly** on their original whole-feel wording and were narrowed on
the user's instruction; the behaviour they describe was already asserted and correct.

What it checked that this ticket had claimed: exactly nine MP3s differ from HEAD and they
are the named nine, with the lock agreeing independently (nine `sha256` moved,
`manifestSha256` unchanged, so no answer moved) and `src/` untouched; all four touched
hashes reproduce; the restored groove-07 and groove-08 pins match HEAD's values and
`FEATURE_27_*` are load-bearing again; the always-lift figures are exact at 26 of 45, ten
in bar 1, five C-rooted 36→48 and ten of fifteen; all three `events.ts` citations point
at what the prose claims; the blues beat-3 path is genuinely exercised — five of twelve
seeds draw blues, four spelling the major third the six-note scale lacks, and beat 3 is
the root in none of the 96 committed bars, so the assertion never passes trivially.

Six defects it found were fixed rather than recorded: groove-07's `upstream` still naming
the −20.4 gain, the dB split above, a `lowRegister.test.ts` assertion weakened on a cause
that no longer held, two wrong figures in the voices-per-quarter list, this ticket
asserting the retracted `open-ballad` reason in the present tense, and the gain section
reading "nobody has heard that" above the approval.

**Row ✅ Done.**
