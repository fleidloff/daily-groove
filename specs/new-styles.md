# New styles

Candidates for new feels, to come back to. Everything here fits the voices we
already sample — kit (kick, snare, hats, rim, toms), bongos, bass, keys — and the
four-bar, four-beat loop. Written after quick ticket 3, 2026-09-04.

## The rule we dropped — done, feature-25 epic 1

**Dropped.** Until feature-25 each feel owned exactly one pair of modes, and the
six pairs were disjoint. It came from feature-3's PRD (epic 3, Q4: a pair per
template, chosen for musical fit) and feature-9's (epic 6: hearing the feel
narrows the mode). With twelve flavours across six feels every flavour was taken,
so a seventh feel could not get a pair of its own — which is what this page was
written to unblock.

**What replaced it:** each style owns two to four modes, and the sets may
overlap. `FLAVOURS_MIN`, `FLAVOURS_MAX` and `flavourFailures` in
`scripts/grooves/templates/rules.ts` are the rule; [music.md](../docs/music.md)
"The feels" states it. A feel is still a clue to the mode, just a weaker one.
What stayed: every flavour the game offers has grooves behind it, and no groove
answers to a flavour the game does not offer. Existing templates kept their
`flavours` lists untouched — reordering or removing an entry re-renders that
template's grooves and reassigns past puzzles; a list freezes at that feel's
first mint.

## Candidates

Ordered by how well they fit what we have.

| Style | What it sounds like on our voices | Modes | Notes |
| :-- | :-- | :-- | :-- |
| **Bossa Nova** — *shipped and approved, feature-25 epic 1* | Rim click on the bossa clave, kick as the surdo (1 and the "and" of 2, or dotted), ride or hat in straight eighths, root–fifth bass locked to the kick, keys on the syncopated bossa comp figure. Straight, 122–138 bpm. | ionian, lydian, dorian, melodic-minor — all four shipped | Shipped as `templates/bossa-nova.ts`: the clave is a `figures` entry on the rim, the surdo and the comp are the template's own `patterns` pools. Harmony is maj7 / m7 / mMaj7, which the chord derivation already produces. Six grooves committed and **approved on 2026-09-06** at the Wave 5 listening pass. |
| **Afro-Cuban / son montuno** — *built and declined, feature-25 epic 5* | 2-3 clave on the claves, cowbell as the timekeeper, tumbao bass anticipating the "and" of 2 and beat 4, guajeo on the keys, bongos as a lead voice for once. | mixolydian, dorian, phrygian-dominant | Built and iterated four times, then heard and **declined by the player** on 2026-09-06: "too far away from real son montuno… the style is too specific for our app here." Never registered, never minted. See *Son montuno — declined* below before proposing it again. |
| **Reggae one-drop** — *built and withdrawn, feature-25 epic 2* | Kick and rim together on 3, nothing on 1, hat on the off-beats, skank keys on the "and"s, bass very present. 70–80 bpm. | aeolian, mixolydian, harmonic-minor, blues as built | Built, gated and minted as six grooves, then heard and **declined by the player** on 2026-09-06: "I honestly don't like it… it's just not for me." Nothing was committed, so no uuid was released. See *Reggae one-drop — declined* below before proposing it again. |
| **Second line / New Orleans** — *shipped and approved, feature-25 epic 3* | Syncopated snare over a clave-ish kick, bass following the kick, keys sparse. Toms and rim earn their place, and the fill is part of the idiom. | blues, mixolydian, ionian, harmonic-major as built | Shipped as `templates/second-line.ts`: four kit figures in `patterns.kit`, its own `FILLS` entry, and the kick keeping the son clave's 3-side. Six grooves committed and **approved on 2026-09-06**. Their mix was raised 5 dB toward the harmony before that hearing — see *Boom-bap* below for the verdict that caused it. |
| **Boom-bap** — *shipped and approved, feature-25 epic 4* | 86–92 bpm swung sixteenths, hard kick and snare, sparse keys, ghost notes. | dorian, aeolian, phrygian — all three shipped | Shipped as `templates/boom-bap.ts`. It sits close to `straight-funk` and `half-time` by design; six grooves committed and **approved on 2026-09-06**, and the distinctness question was graded positive on that verdict's words rather than on the A/B/C comparison it was framed as. See *Boom-bap — heard and approved* below. |

## Reggae one-drop — declined

Feature-25 epic 2 built `templates/reggae-one-drop.ts`, registered it and minted
`groove-59`…`groove-64` — 70–80 bpm, swing 0.04, subdivision 8, two passes, a kick pool
that states no step 0, a `figures` rim struck with the kick and the snare on beat 3, an
off-beat hat and comp, and the loudest bass in the registry. All six cleared all seven
gate checks. The player then heard them and asked for the style to be removed entirely,
with no iteration. It was withdrawn on 2026-09-06, before any of it was committed.

**This is a verdict on the style, not on the build.** The measurements were sound and
nothing failed; the feel simply is not wanted. So a future attempt is not a bug fix and
should not start from the withdrawn parameters — anyone reviving it starts from the
question of whether the one-drop belongs in this catalogue at all, and the answer on
record is no.

What such an attempt would have to redo, since none of it survives: the template, its
`PLACEMENTS` and `FILLS` keys in `events.ts`, its registration, `docs/music.md`'s row
and the two prose passages that went with it, a fresh mint with fresh uuids, and the
`docs.test.ts` empty-downbeat cases, which are dormant and pinned as such because
reggae was the only feel that ever left beat one empty.

## Son montuno — declined

Feature-25 epic 5 built `templates/son-montuno.ts` and iterated on it four times against
the player's own notes — the clave rate, the cowbell's phase lock, the comp figure, the
octave doubling and a two-bar melodic period. It cleared all seven gate checks on 60 of
60 candidates. It was **never registered in `TEMPLATES` and never minted**, so no uuid
was released and the catalogue never moved off 48. The player then heard the fourth
version and asked for the style to go, with no further iteration:

> "For me this is too far away from real son montuno. Let's remove son montuno
> completely for now. The style is too specific for our app here."

Withdrawn on **2026-09-06**. The template, its test, and `compArpeggio` — the
`FeelTemplate` field and the `events.ts` comp branch that were built for it and for
nothing else — all came out. `cli.ts`'s `--template`/`--seed` off-catalogue render and
`rehearse.ts` stay: they audition any template and are not this style's.

**The verdict is on the style, not on the build.** Nothing measured wrong. So a revival
starts from the question of whether an Afro-Cuban feel belongs in this catalogue at all,
and the answer on record is no.

### Four findings a future attempt should not have to rediscover

These are mechanism, not taste, and three of the four outlive the style.

1. **A clave belongs inside one bar of the loop, not across two.** Salsa notates the
   son clave across two bars of cut time, but a bar here is a bar of 4/4 sixteenths, so
   a `figures` entry that spreads it over two `bars` entries sounds it at half tempo —
   a slow accent rather than a pattern you can count against. Compressed into one bar of
   sixteenths, 2-3 is `[2, 4, 8, 11, 14]` and 3-2 is `[0, 3, 6, 10, 12]`.

2. **A comp cell that states an onset later than step 12 is guillotined at the loop
   point.** A comp event rings four sixteenths, so an onset at 13, 14 or 15 of the
   loop's *last* bar is cut mid-sample with no room for `addAt`'s 8 ms release, and the
   gate reads it as a seam. Written with the "and" and the "a" of 4 in them — where a
   montuno cell naturally wants to end — the cells put this feel at **24 seam rejections
   in 40 seeds, the worst in the registry**. Ending by step 12 put it at **6 in 40**,
   between `open-ballad`'s 4 and `bright-straight`'s 9. Nothing musical is lost: a note
   struck on the "a" of 3 sustains through beat 4 and over the bar line, which is what a
   piano does against a tumbao. **This binds any feel whose comp syncopates late**, not
   only this one.

3. **An even hit count per bar phase-locks a two-alternate round robin to metrical
   position.** `roundRobin` returns `start + pass + played` and `played` runs on across
   the bars of a pass, so with two alternates and `h` hits a bar the file at bar `b`,
   position `j` is `(start + pass + b·h + j) mod 2`. **Even `h` cancels `b`** and the
   take becomes a function of metrical position alone — one alternate welded to beats 2
   and 4 for two passes and then to 1 and 3 for the next two, measured here as a
   3.96 dB step migrating across the bar every four bars against a humanize spread of
   1.0 dB. **Odd `h` keeps `b`** and the parity flips bar to bar. This binds every
   `figures` entry on a voice with two alternates — claves and cowbell both.

4. **A guajeo is a fixed repeating cell, not an index that rotates by pass.** Rotating
   the voicing index per pass gives an ascending walk that transposes up one chord tone
   every four bars — a broken-chord exercise, and no amount of thinning the onsets fixes
   it, because the rotation is what stops the cell from being a cell. The line has to be
   identical in every bar of every pass: a montuno is hypnotic because it does not
   develop. The field that expressed this, `compArpeggio`, is gone with the style, so a
   revival rebuilds it.

### What a revival would have to redo

The template; `compArpeggio` on `FeelTemplate` and its branch in the `events.ts` comp
block; the three registry-wide comp assertions in `events.test.ts` (*the un-laddered
velocity check*, *shapes a chord so the top voice sings*, *still rolls the chord and lets
the top voice sing*) plus *spreads a chord like a hand*, all four of which were taught
the arpeggio and have been reverted to their whole-chord claims; the `ARPEGGIO_FIXTURE`,
`GRIP_FIXTURE` and `TWO_BAR_FIXTURE` that made those testable; registration; a
`docs/music.md` feel-table row, which was never written because the style never
registered; and a fresh mint with fresh uuids.

## Boom-bap — heard and approved

Feature-25 epic 4 registered the feel and committed six grooves on gate
measurements alone. **They were heard on 2026-09-06 and approved**, in one
sentence over the eighteen new grooves of all three styles:

> listened to all the new grooves and approve them. They add nice new colours to
> the app

The full record, including exactly what that sentence does and does not answer, is
[`features/feature-25/.implement/wave-5-signoff.md`](features/feature-25/.implement/wave-5-signoff.md).

**What it settles.** R9's retune loop and R9a's stop procedure are both the
negative path and **neither runs**. `swing` 0.34, `tempoRange` [86, 92] and
`patterns.snareGhosts` stay exactly as committed, no groove is pulled, no uuid is
burned, and R9b's two-verdict budget went unspent at one.

**What it does not settle.** It is a blanket verdict, so R10's per-groove half is
not met and the four listening points below drew no individual comment. R8 was not
asked in R8's terms — the A/B/C playlist against `groove-02` and `groove-13` was
not run — and is graded **positive on the words given**, since a colour is a thing
that sounds different from what is already there. That is a reading of a general
remark, and the record says so rather than dressing it up as an answer to the
framed question. The listening points and R8's pairing are kept below because
they are still the right questions, not because a verdict is outstanding.

What shipped is recorded in [music.md](../docs/music.md)'s feel table; the rest of
this section is the hand-off that says what to play and what to listen for.

**One hearing has happened, and it changed the mix.** The player heard the six
and said the comp was too quiet — *"Remember: this app is about finding the
harmony"* — so the gain block was re-balanced and all six mp3s were re-rendered.
No answer moved. The numbers below are the **re-rendered** ones; the working is in
[`features/feature-25/.implement/harmony-regain.md`](features/feature-25/.implement/harmony-regain.md),
and `prd/epic-4-boom-bap.md` § *Amendments* records what it overturned. That
hearing was about the mix and is neither of the two the PRD budgets.

### What is committed

| id | uuid | name | seed | bpm | answer |
| :-- | :-- | :-- | --: | --: | :-- |
| `groove-71` | `f3ee8631-e9e7-4379-aef3-7ce0ae4c0b81` | Plush Alley | 1981233047 | 92 | B phrygian |
| `groove-72` | `cc666694-9d7c-4b3c-856f-b8361aecf0ae` | Gilded Drizzle | 1981233050 | 89 | C dorian |
| `groove-73` | `b648ad0c-a2fa-457e-9cbd-0504a72cb1bb` | Smoky Ravine | 1981233052 | 91 | C♯ phrygian |
| `groove-74` | `b79625d9-501e-4477-b42f-81e5506d0b28` | Salted Cassette | 1981233055 | 87 | A♭ dorian |
| `groove-75` | `cd1d5f2e-8788-44b7-bd47-883cda16ad22` | Slanted Mirage | 1981233063 | 89 | F aeolian |
| `groove-76` | `2e0d7708-a0d6-4dbc-9277-9a79fd261df9` | Quiet Cassette | 1981233067 | 86 | F♯ phrygian |

Play them at `public/grooves/groove-71.mp3` … `groove-76.mp3`, or in the app at
`/groove/<uuid>`. The mint's start seed was **1981233041** and the six
`(template, seed)` pairs are the column above, so
`node scripts/grooves/rehearse.ts --template boom-bap --count 6 --seed 1981233041`
reproduces the same six answers from a catalogue of the same length. Ids and
round-robin sample choice move with the catalogue's length, so a later re-run is the
same music, not the same bytes.

### The three fields a retune may move

`swing` (0.34, band [0.30, 0.40]), `tempoRange` ([86, 92]) and
`patterns.snareGhosts` — figure and placement only. Everything else, `gain.bass`
included, is a wider change than the retune budget permits and has to be said out
loud rather than slipped in. The re-gain above is exactly such a change: it moved
`gain.bass` and `gain.comp` and every kit gain, and it was said out loud in
[`harmony-regain.md`](features/feature-25/.implement/harmony-regain.md) rather
than slipped in. It is not a retune under R9 and spends none of that budget.

### The four listening points

1. **Do the kick and the snare read as *sampled* rather than played?** That is the
   style's whole claim and no gate check measures it. It rests on `swing 0.34`
   (29 ms of delay on every odd sixteenth at 88 bpm), `lean.snare +12 ms`,
   `humanize.timingMs 10` — deliberately low, so the kick does not wander across the
   loop — and `humanize.velocity 0.07`, flatter than every other sixteenth feel. Post-gain
   track RMS over the six: kick −39.0, snare −38.5 dBFS, against hatClosed −57.6,
   hatOpen −66.2, bass −44.1, comp −41.3. The kit still leads, but by 2.3 dB over the
   comp and 5.1 over the bass, not the ~15 it was minted with; what is 18.5 and 27.2 dB
   under the kick is the pair of hats. **Listen to it as a break with a band behind
   it, not underneath it** — the drum-forward mix was minted, heard and reversed.
2. **Are the ghosts texture rather than a second backbeat?** 1.13 – 1.63 ghosts a
   bar, all on odd sixteenths. Velocity separation from the quietest struck snare is
   0.375 – 0.506, structural rather than tuned. The lever, if they read as a
   backbeat, is `patterns.snareGhosts` — level is not this template's to set.
3. **Are the keys sparse rather than absent?** Exactly one comp onset per bar on all
   six, a 3-note voicing rolled over 5–15 ms, on one even step held constant for the
   whole groove: step 6 (`groove-71`), step 8 (`groove-73`, `groove-76`), step 10
   (`groove-72`, `groove-74`, `groove-75`). None drew step 2, so the chord is not
   heard until at least 37 % of the way into the bar.
4. **Is the root still audible enough to answer the puzzle from?** Boom-bap's bass
   now sits **5.1 dB** under its kick (3.4 … 6.5), against `straight-funk`'s 5.5 and
   `half-time`'s 6.7 — level with both, where at the mint it was 16.0 dB under
   (14.3 … 17.4) because of the mix inversion the feel used to rest on. The re-gain
   was aimed at exactly this question, so it is now a check on a fix rather than a
   worry: the bass still states the chord root at step 0 of every bar and the comp
   still arrives late (point 3), so listen for the root explicitly and say whether it
   is enough.

One more: the fill bar drops the hats entirely, one bar in eight. Whether that reads
as a break or as a dropout is a listening question.

### R8 — the distinctness question, and its two neighbours

> Does `boom-bap` read as its own feel, heard against its two closest neighbours?

| file | route | feel | bpm | answer | why this one |
| :-- | :-- | :-- | --: | :-- | :-- |
| `public/grooves/groove-02.mp3` | `/groove/323eedd7-0c46-4394-abed-21e601dd0f94` | `straight-funk` | 96 | E dorian | closest committed groove above the 86–92 band; dorian is on boom-bap's own list |
| `public/grooves/groove-13.mp3` | `/groove/da953189-43ff-47a5-aa34-30152adffb49` | `half-time` | 79 | A♭ phrygian | closest committed groove below the band; phrygian is on boom-bap's own list |

Both in modes boom-bap's own list carries, so what is judged is the feel and not the
mode. **Playlist shape — eighteen files:** for each of the six, the straight-funk
groove, then the half-time groove, then the boom-bap one, with the file names hidden
where that is practical.

It is a genuine question because in *absolute* milliseconds the three swings nearly
coincide: half-time at 74 bpm delays an odd sixteenth by 28.4 ms, boom-bap at 88 by
29.0, swung-sixteenth at 111 by 29.7. What separates them is the ratio and the tempo.

| | `straight-funk` | `half-time` | `boom-bap` |
| :-- | :-- | :-- | :-- |
| tempo | 94–106 | 68–80 | **86–92** |
| swing | 0.18 | 0.28 | **0.34** |
| voices | 8, with toms | 8, with toms | **6, no toms** |
| bass under kick | 5.5 dB | 6.7 dB | **5.1 dB** (minted at 16.0) |
| comp onsets/bar | ≥ 2 | ≥ 2 | **1** |
| loop | 12 bars | 8 bars | **8 bars** |

**One of those six rows stopped separating it.** The mix used to, and the re-gain
put boom-bap's bass on `straight-funk`'s line deliberately. So the distinctness
question now rests on tempo, swing, the missing toms, the one-stab comp and the
loop length — five rows, not six. That is a real narrowing of the case and the
listening pass should weigh it.

**Both verdicts are in, and both are positive** — R10 as a blanket approval over
eighteen grooves, R8 as a reading of the same sentence rather than an answer to the
pairing above. The negative branch, which would have unregistered the template and
removed the six from the catalogue, never opened.

## Not cheap

These break something structural and are their own features:

- **12-bar blues** — `BARS_PER_PASS = 4`, the four-segment transport, the
  four-bar lead sheet and quick ticket 2's "always four chords" all assume four
  bars. Already a candidate idea in `features.md` ("more styles").
- **Jazz waltz, 6/8 Afro, gospel 12/8** — the sixteenth grid assumes four beats
  a bar; a 3/4 or 12/8 feel wants a 12- or 24-step grid, which touches
  `events.ts` throughout.

## The claves are heard now; the cowbell and the ride bell are not

Feature-24 sources `claves`, `cowbell` and `rideBell` into the sample pack and
plays none of them — son montuno above all is what they were bought for, and it
has since been built and declined. The samples themselves were auditioned during
that feature and liked, so the sourcing is settled: budget nothing for
re-sourcing.

**The claves have since been heard in sequence, and they were signed off.** The
withdrawn `son-montuno` played a clave figure over four bars and the player heard
four versions of it. Both takes were pitched down a fifth in the course of that
iteration, and the verdict on the samples was explicit and separate from the
verdict on the style: *"The claves sound really good now. very nice. Making them
lower was the right call."* So the pitched-down pair, its `provenance.json`
derivation rows and the `samples/README.md` note **stay**, and the machine-gunning
worry is closed for the claves. No registered template plays them, so they go back
to being unplayed — sourced, retuned, heard, and waiting.

**The cowbell's is not closed.** It sounded in the same renders, but the player
commented only on the claves, so its 0.9 dB overshoot — a weak hit landing louder
than a strong one — has still never been judged by ear. So has the third worry in
`samples/README.md`: whether a drier, brighter clave capture and the bongos' `_Mid`
files read as one room. **The next style that reaches for the cowbell owns that
pass**; the one that reaches for the claves owns only the room question.

## How it would go

Full feature, not a quick ticket: a template is tempo, swing, subdivision,
voices, gains, pans, a humanize block, placements, a fill vocabulary, minted
grooves, a re-rendered manifest and a listening sign-off. `/create-feature`
with a briefing along the lines of "Bossa Nova and a montuno; two to four
modes per feel, no longer disjoint", then `/roadmap`. Epics would likely be:
the rule and its tests, one epic per template, minting and sign-off. The
`musician` decides each template's parameters.

That is what feature-25 did. Bossa Nova shipped with the rule change in epic 1,
second line and boom-bap in epics 3 and 4; reggae one-drop and son montuno were
built as epics 2 and 5 and both were declined on hearing. **Three of five
survived, and all three were heard and approved on 2026-09-06** — so budget a
style as something that can be built correctly and still not be wanted, and
audition it before it is minted where the tooling allows. Two further things the
run showed: a mix can be right for a genre and wrong for this app — boom-bap's
comp was buried and had to be raised on a verdict before anyone would keep it —
and a listener asked for eighteen verdicts may reasonably give one, so a
criterion written as *per groove* should expect to be graded **partly**.
