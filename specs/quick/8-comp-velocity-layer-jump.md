# 8 — Comp velocity layer jump

## What

* The piano comp leaps out on some downbeats — on `groove-40`, bar 2 and bar 3 beat 1 of the first pass.
* Cause: comp velocity crossing 0.8 swaps in the dyn3 sample, recorded ~10 dB hotter, while `gainFor` in `scripts/grooves/voices.ts` normalises only by nominal velocity — a net ~7.5 dB step for 0.002 of velocity.
* On `groove-40` it hits 4 of 96 comp notes: bars 2, 3, 15 and 16, all on beat 1.
* Smooth the step so no single comp note jumps out of the part.
* Three candidates, none picked: calibrate each layer's `nominalVelocity` to its measured loudness; crossfade the layers over a velocity band; keep post-humanize comp velocity under the boundary.
* Confined to `scripts/grooves/` — rendering only, so no RNG draw changes.

## Done when

* Re-rendered `groove-40`: the comp peaks of bars 2 and 3 sit within a few dB of the other fourteen bars, and nothing pops by ear.
* A generator test pins the layer transition — two comp notes either side of a boundary render within a few dB of each other.
* The full catalogue re-renders and the quality gate plus `grooves:verify` still pass.
* `src/lib/hash.ts` and the `events` draw order are untouched: the groove of the day and every past answer are unchanged.

## Un-parked and built — 2026-09-06, inside feature-25

**The masking went away, exactly as the park note predicted it would.** feature-25
shipped `bossa-nova`, which plays no ride, and Fred heard the pop in its grooves. The
park note named the trigger in as many words: *"it comes back the moment the masking
does: a new feel that plays no ride, a quieter mix, or the bass re-gain moving the
balance."* The first of those three happened. Built on Fred's explicit instruction, as
part of feature-25 rather than as a quick ticket of its own.

**bossa-nova is now the worst feel in the catalogue for this defect, by a wide margin.**
Re-measured over the 36 committed grooves with `buildEvents` — every count in the
analysis below predates `bossa-nova` and is superseded by these:

| | ticket, 30 grooves | built, 36 grooves |
| :-- | --: | --: |
| comp events | 3048 | **3912** |
| above 0.8 (the dyn3 pop) | 20 (0.66%) | **76 (1.94%)** |
| at or below 0.45 (the dyn1 step) | 494 (16.2%) | **535 (13.7%)** |
| feels to re-gain | 6 | **7** |

Per feel, dyn1 / dyn3: bossa-nova **4.7% / 6.5%** (56 of 864, about nine a groove),
bright-straight 12.2% / 1.0%, shuffle 13.1% / 1.0%, swung-sixteenth 18.2% / 0.6%,
open-ballad 8.3% / 3.1%, half-time 20.2% / 0%, straight-funk 21.6% / 0%. `groove-55`
and `groove-56` cross fourteen times each, against the three on `groove-40` that got
this ticket filed.

**Built as Q1-A and Q2-A specify.** What was done, and where it differs from the plan
above, is in `specs/features/feature-25/.implement/quick-8-comp-layers.md`. The two
differences worth knowing here:

* **Two files the ticket did not name had to change.** `scripts/grooves/pack.test.ts`
  (not the one under `samples/`) asserted three rising dynamics per comp note, and
  `scripts/grooves/notes.test.ts` pins the measured pitch and peak of all 24 reference
  notes — which are rendered **from the comp voice** at `NOTE_VELOCITY = 0.85`, a
  velocity that used to land in dyn3. `npm run notes` is part of this change, and
  `grooves:verify` says so itself when it fails as `pack-stale`.
* **`gain.comp` moved per feel and not flat**, as the ticket insisted: −1.07 dB on
  `bossa-nova` against −1.93 on `straight-funk`, because bossa's dyn3 hits were the
  loudest events in its comp track and they are the ones that came *down*.

**The listening pass is done.** It could not be done by the build, and it was not; it
was given by Fred on 2026-09-06 and is recorded below.

### Signed off by ear — 2026-09-06

**Fred listened and approved it.** His message, in full:

> sounds much better, sign off - continue with the mints

**What that sentence covers, stated exactly.** It was given once, over the whole
listening set he was handed — not as five separate per-groove verdicts. The set was the
five pinned renders `groove-07`, `groove-08`, `groove-28`, `groove-40` and `groove-48`;
the six `bossa-nova` grooves `groove-53` … `groove-58`, unpinned, ordered by dyn3
crossing count with 55 and 56 first at fourteen each; and one reference note,
`public/notes/note-a.mp3`. The brief he was working from is *The listening set* in
`specs/features/feature-25/.implement/quick-8-comp-layers.md`. The second half of the
sentence is an instruction to carry on with feature-25's minting, not a musical verdict.
Nothing beyond that was said, and nothing beyond that is recorded.

**The five `SIGN_OFFS` are re-pinned.** `scripts/grooves/gate.test.ts` carries new `pcm`
hashes for all five and a new `mp3` hash for `groove-07`; the other four stay
encoder-unpinned for the reason `groove-40`'s comment gives. Each entry's `scope` states
the qualification above, and each `upstream` now names the comp's single dyn2 layer in
`samples/pack.json` and the template `gain.comp` beside the ride causes it carried from
feature-24. The table's header comment also records what the pass did **not** cover: the
six unpinned same-figure grooves — 19, 34, 42, 44, 50, 52 — were not replayed, so their
feature-24 approval still covers their ride figure and no longer covers their comp.

**How each hash was tied to what was actually heard.** A fresh render of each of the five
from this tree encodes byte for byte to the committed `public/grooves/<id>.mp3` — the
exact file that was played, on the same encoder the table pins (ffmpeg 6.0 /
libmp3lame 3.100, `-b:a 192k`). No hash was pinned that does not correspond to a file in
the listening set.

| id | old pcm | new pcm | mp3 |
| :-- | :-- | :-- | :-- |
| `groove-07` | `68002353…aaaf` | `e7664e75…f76e` | `9aa83533…4333` → `9c1a3bbd…9d57` |
| `groove-08` | `1eb966c4…0dc0` | `f0c8d5d9…439a` | null (file `0359db2c…853b`, 1 014 430 bytes) |
| `groove-28` | `0f89ea15…5d8c` | `fb658dcc…36e5` | null (file `68699d3a…3c1b`, 855 187 bytes) |
| `groove-40` | `00d66faa…a4f7` | `126621dd…2584` | null (file `5d16d492…823f`, 839 514 bytes) |
| `groove-48` | `3ba2a4fa…a5cb` | `20607f33…07fb` | null (file `67a8b136…7dce`, 810 048 bytes) |

**Tests.** `npx vitest run --project generator scripts/grooves/gate.test.ts` — 63 passed,
0 failed. `scripts/grooves/notes.test.ts` — 17 passed, 0 failed.

**The `## Done when` bullets.**

* *`groove-40`'s comp peaks sit within a few dB of the other bars, and nothing pops by
  ear* — **done.** Its three crossings are gone by construction, and the ear confirmed it.
* *A generator test pins the layer transition* — **done**, in the stronger shape the
  notes predicted: `voices.test.ts` holds every one of the 11 committed comp pitches to
  within 0.5 dB across 0.44/0.46 and 0.79/0.81 (measured 0.39 dB and 0.22 dB, against
  8.49 dB before the change).
* *The full catalogue re-renders and the gate plus `grooves:verify` still pass* —
  **done**, with `npm run notes` as part of it.
* *`src/lib/hash.ts` and the `events` draw order untouched* — **done**;
  `events.fixture.json` is unchanged and `eventsFixture.test.ts` is green.

**Full record:** `specs/features/feature-25/.implement/quick-8-signoff.md`.

## Parked — 2026-09-06 · superseded the same day

**This section no longer holds.** It is kept as the record of why the ticket sat
parked for part of a day, and of the trigger it named for un-parking, which then
happened. What was actually built and signed off is *Un-parked and built* above.

**The symptom was gone at the time, so this was not being built.** Fred re-listened to
`groove-40` after feature-24's ride landed (670652b) and the comp no longer pops.
The ticket's first `## Done when` bullet is "nothing pops by ear", and it is
already satisfied.

**Masked, not fixed.** The analysis below was measured *after* the ride shipped,
against the committed catalogue: `buildEvents` still puts three comp notes above
0.8 on `groove-40`, 20 across the catalogue, and 494 at or below 0.45. Nothing
about comp velocity changed. What changed is that `swung-sixteenth` and `shuffle`
now carry a sustained cymbal in the same band as the piano — and those are two of
the three feels with any dyn3 crossings at all. So the step is covered, not
removed, and it comes back the moment the masking does: a new feel that plays no
ride, a quieter mix, or the bass re-gain moving the balance.

**Why not build it anyway.** The fix costs a full catalogue re-render, all five
`SIGN_OFFS` in `gate.test.ts` voided, `gain.comp` re-measured in six templates,
and a listening pass over 30 grooves. `docs/music.md` gives that judgement to the
ear — "nothing here can hear" — and the ear currently says there is nothing
wrong. Paying a whole-catalogue re-approval against a defect nobody can hear
inverts the rule.

**Where it should go instead.** Fold it into the bass levelling, which the same
measurements rate the more audible defect: 901 of 1510 bass events (59.7%) sit
above a boundary 6.9–21.8 dB wide, and `VELOCITIES.bass.medium` is exactly 0.80,
so the line is crossed by construction rather than by jitter. Both voices are the
same shape of change — pack, provenance, template gain, re-render — and the
expensive half is paid once whether one voice is fixed or two. Comp on its own
now means paying it twice. The two together fail the quick door's size test, so
that goes to `/create-feature`.

Everything below stood as analysed; only the decision to build changed — and then that
changed too, when `bossa-nova` shipped and unmasked the step exactly as this section
predicted it would.

## Open questions

**Nothing is open.** Both are answered; the ticks below are the record, and the
`## Answered` sections say what follows from each.

### Q1. Which fix?

The ticket's first candidate is dead: calibrating `nominalVelocity` cannot make
either comp boundary continuous. Continuity at 0.8 needs `n3 = n2 × P3/P2` — a
nominal above 1 with `n2` where it is, or a gain of 2.8× against
`MAX_LAYER_GAIN = 2` if `n3` stays at 0.9. The 0.45 boundary wants 3.6×. The
piano's recorded dynamics are 10–14 dB apart and the bands imply 3–9 dB, so the
mechanism has nothing left to give. The three live options are below.

- [x] A) **The comp keeps one layer — dyn2 — for its whole range.** *(recommended
      — the `musician`'s call: it fixes the busy boundary as well as the loud
      one, and it is a voicing defect, not just a level step.)* Each of the 11
      notes declares one layer, `maxVelocity: 1`, `nominalVelocity: 0.5`; the 22
      dyn1/dyn3 files and their `provenance.json` rows go. **Cost:** every comp
      note in all 30 grooves changes level, so `gain.comp` comes down ~2.0–2.6 dB
      in all six templates (measured per feel, not applied flat), the whole
      catalogue re-renders, all five `SIGN_OFFS` in `gate.test.ts` void, and it
      needs a full listening pass before it can be called done.
- [ ] B) **The comp declines only its top layer.** dyn3 goes, dyn2's
      `maxVelocity` becomes 1 with `nominalVelocity` pinned at **0.625** so the
      band midpoint does not move. Only the 20 notes above 0.8 re-render —
      grooves 08, 12, 21, 40, 44 and 49; the other 24 are byte-identical, no
      template re-gain, and only the `groove-08` and `groove-40` pins void.
      **Cost:** leaves the 0.45 boundary, which 494 of 3048 comp notes cross —
      a +4.5 to +4.7 dB step on two of the four notes the catalogue actually
      plays, and up to 4.2 dB of error *inside* a chord, against the 1.1 dB
      `COMP_VOICE_DROP` sets on purpose.
- [ ] C) **Crossfade the layers in `voices.ts`.** General: fixes both comp
      boundaries, the bass, and every voice at once. **Cost:** changes the
      renderer for the whole kit, so every groove re-renders audibly, all five
      pins void, `pack.get` has to return two samples without double-advancing
      the round-robin counter, and the listening pass covers the entire
      catalogue rather than the comp.

Ticking A or C means the build stops for your ears before it can report done —
`voidSignOff` says so in the failure, and nothing in the repo can give that
sign-off.


### Q2. One layer means one file per comp note. What carries the rule that a repeat never replays one file?

`pack.test.ts` binds `bass` and `comp` as `PITCHED_VOICES` and asserts, in three
places, that a pitched note has either velocity layers *or* round-robin
alternates. Comp today passes on the layers limb; A removes it, and comp has
exactly one file per note per layer, so all three assertions fail and two of them
cannot be satisfied by adding an exemption. This has to be settled before the
pack is edited.

- [x] A) **Name the comp as a deliberate exception, in the test and in the
      README.** *(recommended — the rule is a proxy the comp already fails in
      substance: layers are not alternates, and 83% of comp notes today already
      replay the same `Player_dyn2_rr1_0NN.flac`. A makes the pack honest about
      what was already true.)* Rewrite the three assertions so `comp` is named
      with its reason rather than silently exempted, and pin what actually keeps
      it from machine-gunning: consecutive comp events are a different chord at
      different pitches, offset per groove and humanized in time. Opens the
      sourcing as its own ticket beside the bass one.
- [ ] B) **Source `rr2`/`rr3` for the 11 notes first, then apply A.** Satisfies
      the rule properly rather than restating it. **Cost:** the repo holds only
      `rr1` and `provenance.json` points at
      `Keys/Upright Piano/Player_dyn2_rr1_020.wav`, so whether VSCO 2 CE ships
      alternates at all is unknown without downloading it; then 11+ new files,
      11+ provenance rows, and the alternates must be level-matched before the
      nominal means anything, because it is derived from the first-listed one —
      the `claves_mf_2` precedent. That is a second ticket's work folded in, and
      it fails the five-bullet test.

## Notes

**Size test — passes, at the edge.** Five bullets: the pack's comp layers; the
22 files and their provenance rows; `gain.comp` in the six templates; the
pitched-voice rule in `pack.test.ts`; the re-render, the README and the re-pin.
One module — catalogue (`scripts/grooves/` plus the two generated manifests).
None of the four frozen things in `docs/music.md` is touched: no RNG draw is
added or reordered, so `src/lib/hash.ts`, `MUSIC_LABEL`'s draw order, `FLAVOURS`,
every template's `flavours` list and every `uuid` stand, and each groove keeps
its name, chords and mode. One `git revert` covers it.

What it does *not* clear is a human gate. Every comp note in all 30 grooves
changes level, so this is a full catalogue re-render and all five `SIGN_OFFS`
void at once. `/implement-quick-feature` can build it and run the checks; it
cannot report it done.

**Files this is expected to touch:**

* `scripts/grooves/samples/pack.json` — voice `comp`, all 11 notes, each down to
  one layer: `{ "maxVelocity": 1, "nominalVelocity": 0.5, "files": ["comp/Player_dyn2_rr1_0NN.flac"] }`.
  0.5 is the band midpoint, the rule `ride`, `claves` and `cowbell` already
  follow.
* `scripts/grooves/samples/provenance.json` — 22 rows out. `pack.test.ts` walks
  the directory, so a deleted file must lose its row and a kept file must keep
  one.
* `scripts/grooves/samples/comp/Player_dyn1_*.flac`, `Player_dyn3_*.flac` — 22
  files deleted.
* `scripts/grooves/samples/pack.test.ts` — the three pitched-voice assertions
  at lines 267, 280 and 293, per Q2-A. The density rule at line 248 is unaffected
  and stays: comp's 11 notes are four semitones apart, so nothing shifts more
  than two either way.
* `scripts/grooves/templates/*.ts` — `gain.comp`, all six. Currently
  `bright-straight` −5, `open-ballad` −4, `shuffle` −4, `half-time` −3,
  `straight-funk` −3, `swung-sixteenth` −2. Expect roughly −2.0 to −2.6 dB, but
  measure per feel with `voiceLevels` — the dyn1/dyn3 mix differs by feel, so a
  flat correction is wrong.
* `scripts/grooves/samples/README.md` — a ⚠ section mirroring *The ride declines
  velocity layers the library has*, carrying the step table below, and the fact
  that *The bands as committed* lists no `comp` or `bass` row.
* `scripts/grooves/gate.test.ts` — five re-pinned `SIGN_OFFS` hashes, after the
  ears and not before.
* `scripts/grooves/voices.test.ts` — the new assertion, per *the test changes
  shape* below.
* `public/grooves/*.mp3`, `scripts/grooves/grooves.lock.json`,
  `src/features/daily-groove/data/grooves.generated.ts` — regenerated.

**Why one layer rather than better nominals.** Calibrating `nominalVelocity`
cannot close either boundary. Continuity at 0.8 needs `n3 = n2 × P3/P2` — a
nominal above 1, or a gain of 2.8× against `MAX_LAYER_GAIN = 2` if `n3` stays at
0.9; the 0.45 boundary wants 3.6×. The clamp is already live elsewhere in the
catalogue (`bongoHigh` at its own strong velocity asks 2.38×), so raising it is
not free either. The piano's recorded dynamics are 10–14 dB apart and the bands
imply 3–9 dB.

**The measurements.** Peak dBFS per comp file, `ffmpeg volumedetect`, for the
four notes the catalogue actually sounds — 61, 65, 69, 73, files `020`, `022`,
`024`, `026`. The declared register is 55–76; nothing outside 60–75 is ever
played, so seven of the eleven sampled notes are dead weight in every table
below.

| note | dyn1 | dyn2 | dyn3 | net step at 0.45 | net step at 0.8 | hits below / above |
| :-- | --: | --: | --: | --: | --: | --: |
| 61 | −37.6 | −24.2 | −13.6 | **+4.5** | +7.4 | 92 / 0 |
| 65 | −31.2 | −21.8 | −10.1 | +0.5 | +8.5 | 305 / 0 |
| 69 | −36.1 | −22.5 | −8.5 | **+4.7** | **+10.8** | 86 / 7 |
| 73 | −31.4 | −22.1 | −12.5 | +0.4 | +6.4 | 11 / 13 |

Net step is the recorded difference minus what the fallback nominals pay back —
8.87 dB at 0.45 (0.225 → 0.625), 3.16 dB at 0.8 (0.625 → 0.9). Neither `comp`
nor `bass` declares `nominalVelocity` at all, so both fall through `nominalOf` to
the band midpoint. dyn2 is also the flattest of the three across those four notes
— 2.4 dB of spread against dyn1's 6.4 and dyn3's 5.1 — which is why it is the
layer that survives.

**Counts, from `buildEvents` over all 30 catalogue grooves** — no render, so
these are the humanized velocities the renderer sees. 3048 comp events: **20
above 0.8** (0.66%), in grooves 08, 12, 21, 40, 44, 49; **494 at or below 0.45**
(16.2%). Per feel, dyn1 / dyn3: straight-funk 21.6% / 0%, half-time 20.2% / 0%,
swung-sixteenth 18.2% / 0.6%, shuffle 13.1% / 1.0%, bright-straight 12.2% / 1.0%,
open-ballad 8.3% / 3.1%.

**`groove-40` reads three, not four.** `buildEvents` puts comp above 0.8 at
0.02 s (0.832), 30.56 s (0.861) and 32.73 s (0.806) of 96 comp events, and nine
below 0.45. The ticket says four, at bars 2, 3, 15 and 16. Same phenomenon, one
note apart — worth reconciling against however it was counted, because a fourth
audible pop that is not a boundary crossing would mean something else is also
wrong. Under A it stops mattering: all twelve of that groove's crossings go.

**The crossings are random, not expressive.** `gaussianUnit` is bounded ±1, so
humanize adds exactly ±`humanize.velocity` (0.05 on `bright-straight` to 0.13 on
`shuffle`). A chord voice sitting at 0.44–0.48 before humanize lands on either
side of 0.45 from one pass to the next, on the same chord — the timbre flickers
where nothing musical changed. Only one product of `VELOCITIES.comp` ×
`COMP_ACCENTS` × `(1 − 0.12 × voicesBelow)` clears 0.8 on its own: 0.72 × 1.12 =
**0.8064**, top voice, strong beat, accented. Everything else above the line got
there by jitter.

**The chord-balance argument is what chose A over the surgical fix.** At MIDI 65
as reference, dyn2's inter-note profile is 61 −2.4, 69 −0.7, 73 −0.3; dyn1's is
61 −6.4, 69 −4.9, 73 −0.2. So one note of a chord crossing 0.45 shifts its
position *inside* that chord by up to 4.2 dB, against the 1.1 dB per voice that
`COMP_VOICE_DROP = 0.12` sets deliberately so the top voice is the melody a
listener follows. dyn3 does the same at the top, up to 4.4 dB. The ride never had
this — it plays one note at a time.

**Direction check, so the re-gain arithmetic is verifiable.** dyn2 notes go from
`v/0.625` to `v/0.5`, **+1.94 dB**; dyn1 notes rise **+2.4 to +6.7 dB** — today's
quiet inner voices are too quiet, not too loud; the 20 dyn3 notes fall **−4.5 to
−8.9 dB**, which is the pop. Measured max comp velocity in the catalogue is
0.862, so `gainFor` reaches 1.72× against `MAX_LAYER_GAIN = 2`; the theoretical
worst with full jitter is 1.87×. Record the ceiling the way the README records
the ride's: **`VELOCITIES.comp.strong` cannot rise above 0.77** without clamping.

**`gate.test.ts` pins five signed-off renders and will fail loudly.**
`SIGN_OFFS` holds `groove-07`, `08`, `28`, `40`, `48` with PCM hashes, and
`voidSignOff` refuses to let a hash move without a fresh human listening pass —
"do not re-pin it to make the suite green". Every entry's `upstream` string names
`samples/pack.json` first. Under A all five void. The ticket's `## Done when`
does not mention this, and it is the part `/implement-quick-feature` cannot
finish on its own.

**The test in `## Done when` changes shape.** With one layer there is no
transition left to pin, so "two comp notes either side of a boundary render
within a few dB of each other" becomes: `comp` declares exactly one layer per
note, and one pitch rendered at 0.44 / 0.46 and at 0.79 / 0.81 peaks within
0.5 dB. Same subject, and strictly stronger — it holds at every velocity rather
than at two chosen points.

**What to listen for, so the sign-off has something to check:**

* The beat-1 chords on `groove-40` no longer sit above the surrounding bars — a
  −8.9 dB correction on MIDI 69.
* A repeated chord stops changing colour between passes: pass 1 and pass 3
  should differ in timing and level, not in tone.
* The inside of a chord reads as one instrument — the middle voice of a 61-65-69
  voicing was up to 4.2 dB out of place.
* The comp will sound slightly *less* dynamic overall: soft chords become loud
  chords turned down rather than darker ones. If a feel reads as flat rather
  than merely even, that is the cost of the change showing, and the answer is
  that feel's `VELOCITIES` or accent depth, not the pack.
* Check the gate's loudness after the re-gain. Feels span −27.1 to −22.1 dBFS in
  a −29…−20 band; `bright-straight` at −22.1 has the least room.

**Assumptions taken rather than asked:**

* dyn2 is the layer that survives, not dyn1 or dyn3 — it is the flattest across
  the four played notes, and mf is the touch a backing comp under a soloist
  wants.
* **Round robins for the comp get their own ticket, beside the bass one.** The
  repo holds only `rr1`, and `provenance.json` points at
  `Keys/Upright Piano/Player_dyn2_rr1_020.wav`, so finding out whether VSCO 2 CE
  ships alternates at all needs the library downloaded. If it does, the eleven
  new files have to be level-matched against the first-listed one before the
  nominal means anything — the `claves_mf_2` precedent, where an 8.2 dB outlier
  was left out of the pack rather than shipped.
* The 22 orphaned FLACs get deleted with their `provenance.json` rows rather
  than left undeclared on disk. Both pass the tests — `pack.test.ts` only
  requires provenance to cover what is on disk — but leaving them makes the
  README's tables describe a pack that is no longer shipped.
* `headDelaySeconds` in `grooves.generated.ts` may shift for re-encoded grooves;
  it is probed from the MP3 rather than computed, so a diff there is expected,
  not a defect.
* **`bass` has the same defect and gets its own ticket.** Its two layers are
  **+6.9 to +21.8 dB** apart against 7.04 dB of fallback compensation, and
  `VELOCITIES.bass.medium` is exactly 0.80 — the boundary sits *on* a declared
  velocity, so 901 of 1510 bass events (59.7%) are above it and the line flips
  side note to note. It carries two problems the comp does not: notes 42, 45 and
  49 have a single layer and so run under a different gain law from the rest of
  the register, and the alternates inside a layer are not level-matched (`G0_v1`
  rr1/rr2 are 7.9 dB apart) where the nominal derivation assumes they are. The
  `musician` rates it the more audible of the two and would run it next.
  Folding it in here would fail the size test.

## Answered — Q1-A

**The comp keeps one layer, dyn2, across its whole range.** Each of the 11
sampled notes declares `{ maxVelocity: 1, nominalVelocity: 0.5 }` over
`Player_dyn2_rr1_0NN.flac`; dyn1 and dyn3 leave the pack with their provenance
rows. What follows from it:

* Both boundaries go, not just the loud one. The 20 events above 0.8 were the
  symptom; the 494 at or below 0.45 were the larger half, and the same edit
  removes both.
* Every comp note in all 30 grooves changes level, so `gain.comp` has to come
  down in all six templates — measured per feel, because the dyn1/dyn3 mix runs
  from 21.6% / 0% on `straight-funk` to 8.3% / 3.1% on `open-ballad`.
* The whole catalogue re-renders and all five `SIGN_OFFS` void. The build stops
  for a listening pass before this can be called done.
* The size test still passes — one module, nothing frozen, one revert — but it
  now carries a fifth bullet it did not have when it was drafted: the
  pitched-voice rule in `pack.test.ts`, which is Q2.

## Answered — Q2-A

**The comp is named as a deliberate exception rather than given alternates it
does not have.** `pack.test.ts` lines 267, 280 and 293 get rewritten so `comp`
carries its reason in the assertion, and the README's ⚠ section says the same
thing in prose. What follows from it:

* The rule those three lines encode — a pitched note has velocity layers *or*
  round-robin alternates — was already a proxy the comp failed in substance.
  Layers are not alternates, and the 83% of comp notes that sit inside dyn2
  today already replay one file. A states what was true before this ticket
  touched anything.
* What actually keeps the comp off the machine-gun artefact is worth pinning
  where the removed assertion was: consecutive comp events are a different
  chord at different pitches, rolled by a per-groove offset and humanized in
  time. That is a real guard; three velocity layers never were one.
* The sourcing question does not go away, it moves. A comp round-robin ticket
  goes in the queue beside the bass one.
* The size test is unchanged by this answer — still one module, nothing frozen,
  one revert.

**The ticket is settled.** Nothing is open.
