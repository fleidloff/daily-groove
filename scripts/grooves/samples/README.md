# Sample pack — `vcsl-funk`

Generation-time assets. These files are decoded by `scripts/grooves/pack.ts` when a
groove is rendered; they are never served to the browser and never enter the client
bundle.

## Source and licence

The pack draws on five libraries. Three are **CC0 1.0 Universal** — public
domain, no attribution required. The drums and the ride are **CC-BY 4.0**, which
carries an obligation the other three do not:

| Library | Voices | Licence | Licence text |
| :-- | :-- | :-- | :-- |
| [MuldjordKit (FreePats edition)](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html), by Lars Muldjord | `kick`, `snare`, `hatClosed`, `hatOpen`, `rim`, `tomHigh`, `tomLow` | CC-BY 4.0 | `LICENSE-MuldjordKit.txt` |
| [DRSKit v2.1](https://drumgizmo.org/wiki/doku.php?id=kits:drskit), by the DrumGizmo team | `ride`, `rideBell` | CC-BY 4.0 | `LICENSE-DRSKit.txt` |
| [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | `bongoHigh`, `bongoLow`, `claves`, `cowbell` | CC0 | `LICENSE.txt` |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | `comp` | CC0 | `LICENSE-VSCO-2-CE.txt` |
| [Pastabass](https://shop.karoryfer.com/pages/free-pastabass), by Karoryfer Samples | `bass` | CC0 | none — see below |

`LICENSE-DRSKit.txt` is byte-for-byte `LICENSE-MuldjordKit.txt`: both kits are
CC-BY 4.0 and the text is the same. It is copied rather than shared so the source
table keeps one *Licence text* cell per library, and a reader is never asked to
know that two kits happen to sit under one licence.

**Pastabass ships no licence text of its own, and the empty cell is deliberate.**
CC0 requires none. The two older CC0 rows each carry a copy because they were
committed with one, and duplicating a public-domain dedication a third time
records nothing the row does not already say: `provenance.json` names the licence
`CC0` on all 81 bass files and the archive's own `Pastabass/LICENSE` is the
CC0 1.0 Universal text verbatim, checked at the source. `samples/pack.test.ts`
derives a required `LICENSE-<Library>.txt` from the **non-CC0** rows only, so
nothing asks for one. If a later reader would rather have every row's text on
disk, adding `LICENSE-Pastabass.txt` is one file and breaks nothing.

## ⚠ The drums and the ride carry an attribution obligation, and there are now two of them

MuldjordKit is CC-BY 4.0, and its terms name the text:

> Drum samples provided by DrumGizmo.org

DRSKit is CC-BY 4.0 as well, and neither the kit's README nor DrumGizmo's wiki
gives an exact string — CC-BY 4.0 § 3(a)(1) leaves the words to us provided they
name the creator, the licence and the fact of modification. So the ride carries
its own:

> Ride cymbal samples from DRSKit, provided by DrumGizmo.org

**It is deliberately a second string rather than a reuse of the first.**
`provenance.attributions` is the sorted set of distinct non-CC0 attributions, and
its **length is the flag Epic 3 reads** to decide whether the app's credit line
has to grow. Collapsing the two into one string would keep the array at length 1
and quietly say that no second CC-BY library entered the pack, which would be
false. It is 2 today, and `pack.test.ts` asserts that.

This is not satisfied by `provenance.json` alone. A rendered groove is a
derivative work of the samples it is built from, so the obligation follows the
committed MP3s and anything the app does with them — which means the credit has
to be visible to a person using the app, not only to someone reading this repo.
`samples/pack.test.ts` asserts that every non-CC0 row carries an attribution, so
a sample cannot enter the pack without it.

Why VCSL no longer supplies the kit: it is an *orchestral* library. Its bass
drums are concert bass drums that decay for over three seconds, its snare is a
concert snare, and it has no ride cymbal at all. The cajon that stood in for a
kick until feature-13 was not a whim — it was the closest thing VCSL had.

**The pack has a ride now**, and it was not the obvious one: see *The ride, and
the four rounds it took* below.

`provenance.json` records, for every file, which library it came from, its path inside
that library, its licence and what was done to it.

Files were capped in length, faded out, downmixed to mono and re-encoded as 44.1 kHz
16-bit FLAC. They were deliberately **not** normalized: the level differences between
velocity layers are the data, and normalizing would erase them.

One invocation does all of it. This is the shape to copy for a new voice group, so
it lands in the same room and at the same level as the voices already here:

```sh
ffmpeg -i in.wav \
  -af "pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=0.92:d=0.08" \
  -t 1 -ar 44100 -sample_fmt s16 out.flac
```

The length cap is per voice — long enough to hold that voice's decay and no longer —
and the fade is the last 80 ms of it. The kick, the snare and the toms are capped at
one second; the hats and the rim at their own, shorter lengths — a cross-stick is over
almost as soon as it starts, so `rim` is capped at 0.8 s. The pitched voices ring, and
are capped where the ring stops being useful: the electric bass at two seconds
(`afade=t=out:st=1.92:d=0.08 -t 2`) — where the cap is not what binds, and the *Length
caps* table below says what does — and the upright piano at two and a half (`afade=t=out:st=2.42:d=0.08 -t 2.5`) — VSCO's piano
takes run on for twelve. A source shorter than the fade's start comes through
untouched: nothing was cut, so there is nothing to fade.

Nothing is trimmed at the *front*: every file keeps its source lead-in, so a bass note
lands with the kick it is written beside rather than ahead of it.

**The bass's downmix is `-ac 1`, because its sources are already mono.** Every one of
Pastabass's 81 source files is single-channel — verified with `ffprobe` on all 81 — so
`pan=mono|c0=0.5*c0+0.5*c1` has nothing to fold and errors on a mono input. `-ac 1`
stands in and is a no-op on these sources. It is the same class of departure as the
ride's `c0=c7` below: a different operation, not a typo. One invocation per file, run 81
times:

```sh
ffmpeg -i Pastabass/samples/tagliatelle/db2_vl1_rr1.wav \
  -af "afade=t=out:st=1.92:d=0.08" \
  -t 2 -ac 1 -ar 44100 -sample_fmt s16 \
  bass/Pastabass_tagliatelle_db2_vl1_rr1.flac
```

Nothing else about the bass departs from the shape above: no front trim, no
normalisation, no filter.

The two percussion voices added in feature-24 were prepared with the same shape. Claves,
capped at 0.4 s — by 0.30 s the hit is 58–60 dB below its own peak, so the cap holds the
whole audible decay:

```sh
ffmpeg -i in.wav \
  -af "pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=0.32:d=0.08" \
  -t 0.4 -ar 44100 -sample_fmt s16 out.flac
```

Cowbell, capped at 0.8 s — a bell rings, and at 0.72 s it is 63–72 dB down:

```sh
ffmpeg -i in.wav \
  -af "pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=0.72:d=0.08" \
  -t 0.8 -ar 44100 -sample_fmt s16 out.flac
```

**The ride's mono downmix is one microphone, not a stereo fold.** Every other file
in this pack came from a two-channel source and was folded with
`pan=mono|c0=0.5*c0+0.5*c1`. DRSKit is a 13-channel multi-mic session, and `c0=c7`
takes channel 8 — the dedicated ride close mic, a Beyerdynamic MCE 86 II — and
nothing else. It is a different operation, not a typo. The overheads were rendered
too, time-aligned and summed at −6 dB, and rejected: a 1.77 ms offset summed to
mono puts the first comb notch at 283 Hz with notches every 565 Hz across the
cymbal's whole band, `mix.ts` already sends `ROOM_SEND = 0.18` to a reverb, and the
open-hat-shaped wash the overheads add sits in the same band as the upright piano
the game asks you to hear.

`ride`, capped at 2.0 s, with the decay envelope in place of the 80 ms fade — run
for `Ride_tip` samples 5, 6 and 7:

```sh
ffmpeg -i DRSKit/Ride_tip/samples/5-Ride_tip.wav \
  -af "pan=mono|c0=c7,afade=t=out:curve=par:st=0.10:d=1.90" \
  -t 2 -ar 44100 -sample_fmt s16 ride/DRSKit_ride_tip_5.flac
```

`rideBell`, capped at 2.0 s, with the ordinary 80 ms fade — no envelope, because
nothing plays the bell and a bell that is struck once does not overlap itself. Run
for `Ride_tip_bell` samples 7 through 11:

```sh
ffmpeg -i DRSKit/Ride_tip_bell/samples/7-Ride_tip_bell.wav \
  -af "pan=mono|c0=c7,afade=t=out:st=1.92:d=0.08" \
  -t 2 -ar 44100 -sample_fmt s16 rideBell/DRSKit_rideBell_tip_7.flac
```

## The ride, and the four rounds it took

**The pack has a ride, and it is DRSKit's — chosen by ear over a library that
measured better on every axis.** That sentence is the record R5 asks for, and the
uncomfortable half of it is the point.

Three libraries were considered, all licence-checked at the source before a byte
was downloaded:

| Library | Licence | Outcome |
| :-- | :-- | :-- |
| **DRSKit v2.1** (DrumGizmo) | CC-BY 4.0, verified in the kit's own README and on drumgizmo.org | **Chosen.** `Ride_tip` — the bow, struck with the stick tip. `Ride_tip_bell` gives `rideBell` from the same cymbal in the same session |
| CrocellKit (DrumGizmo) | CC-BY 4.0, verified the same two ways | **Prepared, heard, rejected.** Four cells rendered, none preferred |
| Freesound "Zildjian A Ping Ride" | CC0 | **Rejected unheard.** Two bow hits, one velocity group, no round robins — one sample per level is the machine-gun artefact feature-9 undid |

Salamander (CC-BY-SA 3.0) and Tchackpoum/Tchimera (CC-BY-SA 4.0) never reached
the shortlist: share-alike is not CC-BY, and every row in `provenance.json` has
to be CC0 or CC-BY 4.0.

**CrocellKit measured better and lost anyway, and the measurements are worth
keeping so nobody re-runs them.** At identical ride-track loudness it put
**6.1 dB more into the stroke** than DRSKit's preparation did (−21.02 dBFS peak
against −27.15) with no processing at all; its bloom curve — tail RMS minus
attack RMS — spans 9.0 dB and gets *drier* the harder the cymbal is struck, where
DRSKit's is flat from sample 1 to sample 8 and then gets *crashier*; its crest is
19.4 dB against DRSKit's 11.5. On paper it is a ride cymbal (an Oktava MK-012 on
a real ride) and DRSKit's is a Paiste Formula 602 **thin crash** pressed into
service, which DrumGizmo's own page says. The prediction on the record before the
audition was that CrocellKit would need less preparation and would win. It needed
less preparation and it did not win. The ear was given both, back to back, at
matched loudness, and picked DRSKit.

So: **a better cymbal measured better and sounded worse.** If you are sourcing
the next voice, that is the finding to carry, not the bloom table.

What ships is `Ride_tip` samples **5, 6 and 7** — one velocity layer, three
round-robin alternates, capped at 2 s with a decay envelope in place of the usual
80 ms fade. The two sections below say why a single layer and why an envelope,
because both are departures and neither should be copied without reading them.

### ⚠ The ride declines velocity layers the library has

`rim`, `hatOpen`, `claves` and `cowbell` each carry a paragraph saying the
recording offered nothing more. **The ride's paragraph says the opposite.**
`Ride_tip` ships fifteen dynamic levels and this pack uses three of them on
purpose.

The reason is the width of the window the generator asks for. Every step in all
three `RIDE_PATTERNS` members is even, so `velocityFor` never returns `weak`: the
ride only ever plays **0.558 to 0.780**, a **2.9 dB** window. Across the library's
full 31 dB the timbre moves a lot — bloom runs −13.3 to −9.97 dB. Across the
2.9 dB this feel uses it moves **0.23 dB of bloom and 0.58 dB of crash-band
tilt**, and it moves the wrong way: the accented stroke was the crashier one.
Two layers over that window were sampling a dimension that barely varies inside
it. Compare `hatClosed`, whose four layers span 11.8 dB and whose thresholds
split its velocity rows exactly — there the layers carry real information.

What C7 asks a repeated voice for is satisfied by the round robins instead: three
alternates, and `index % 3` cycles cleanly against the pattern's index parity,
which is the machine-gun test that set the alternate count in the first place.

**It stops being safe if the ride's dynamic range ever widens.** A feel that
plays the ride genuinely softly would ask one recording to cover a range it was
never recorded across, and the layer should come back. There is a hard edge too:
`gainFor` is `velocity / 0.5`, which reaches **1.82** at the ride's maximum
post-humanize velocity of 0.91 against `MAX_LAYER_GAIN` 2. So
`VELOCITIES.ride.strong` cannot rise above **0.87** without the ride hitting the
ceiling `rim` was once one change away from.

### The pack shapes format and envelope. It does not carry a filter.

A committed sample may lose channels, may be shortened, and may be attenuated
over time — the mono downmix, the cap, the fade, and no normalisation. Every one
of those is a reduction a listener can check against the source in one line of
`ffmpeg`. **Its balance between frequencies is not altered.** A voice that needs
EQ to be the right instrument is the wrong instrument, and the answer is a
different sample, not a filter. Where a voice must sit differently in one feel
and not another, that is the template's `gain` and `pan`: per feel, and
reversible.

**A decay envelope is a fade that has become the decay, and only a voice that
overlaps itself may carry one.** Every other voice in this pack falls silent
before its own figure strikes it again, so the fade at its cap is a cleanup and
80 ms is all it needs. The ride does not: at 91 bpm its figure strikes every
0.21–0.44 s while it is still ringing, and the measured tail turns into a
1.5–5 kHz shimmer that stacks. Its fade therefore starts where the stroke stops
being a stroke — measurement puts that inside the first 100 ms, after which the
low-biased attack gives way to that shimmer — and runs to the cap. **Record the
curve, the start and the span beside the cap**, because a voice with an envelope
no longer decays the way the recording did, and the next reader must be able to
see that at a glance rather than infer it from an `ffmpeg` line. The *Length
caps* table below does that.

The envelope is measured against the plain 80 ms fade on the same file
(`DRSKit_ride_tip_7`): peak **−28.212 dBFS** and attack RMS (0–50 ms)
**−39.974 dBFS** identical to three decimals in both, the tail down **4.08 dB**
at 0.25–0.6 s and **8.55 dB** at 0.6–1.3 s. The stroke is the recording's; the
wash is not, and `provenance.json` says so on every ride row.

### A cap is the shorter of the decay and what the figure can carry

`Length caps` below says the cap holds each voice's useful decay. **The ride is
the first voice in this pack that repeats faster than it decays**, so read the
rule as the general one it always was:

> A voice's cap is the shorter of two things: how long it takes to decay, and how
> much of it a bar can carry. Until the ride, only the first ever bound. At 92 bpm
> — the fastest tempo `shuffle` allows — an eighth-note ride figure strikes every
> 0.326 s, so a cap of *C* seconds leaves *C* ÷ 0.326 tails sounding at once, and
> past three or four of them the strokes stop reading as strokes. Quote the
> overlap beside the seconds, not the seconds alone.

For the ride the cap is not what bounds the tail anyway:
`RIDE_SUSTAIN_SIXTEENTHS = 8` in `events.ts` holds the sample for eight
sixteenths — 1.319 s at 91 bpm — and `addAt` in `voices.ts` releases it 8 ms
later. The 2.0 s cap is set long enough not to bind at the slowest shuffle tempo
(78 bpm → 1.538 s); the tail knob is that constant, which is tempo-relative and
the better place for it.

## The bass, and the audition it took

**The pack has an electric bass, and it is Pastabass's muted flatwound Bass VI —
chosen by ear over a brighter Jazz Bass that measured about as well, and over the
one library that actually holds a Precision, which no licence would let us
commit.** That sentence is the record feature-27 asks for, and the uncomfortable
half of it is the point: the brief asked for a 60s Fender Precision, and the only
freely published Precision in circulation is licence-blocked three ways over.

Every row's licence was checked **at the source, before a byte was downloaded**,
and the two bars are deliberately different. A licence that *fails* on its stated
terms needs one reading, because a second cannot rescue it. A licence that
*passes* has to hold in two independent places, because this is the check that
puts audio in the repo permanently.

| Library | Instrument | Licence | Outcome |
| :-- | :-- | :-- | :-- |
| **[Pastabass](https://shop.karoryfer.com/pages/free-pastabass) — `tagliatelle`**, Karoryfer Samples | Squier Bass VI — flatwounds, pick, muted, pickup combo | **CC0 1.0**, two ways: the archive's own `Pastabass/LICENSE` is the CC0 1.0 Universal text verbatim and its `readme.txt` grants "redistribution as part of larger sample libraries"; independently the vendor's free-samples page says all their free libraries are CC0, and GitHub reports SPDX `CC0-1.0` | **Chosen.** Prepared, rendered, heard, and preferred to the contrabass |
| Pastabass — `fetuccine`, same library and archive | Squier Bass VI — flatwounds, fingers, neck pickup | CC0 1.0, the same licence file, checked the same two ways | **No verdict.** Prepared and rendered; it reached the ear as the third A/B file and was not commented on. Nothing is inferred from that — neither approval nor rejection |
| **[Growlybass](https://shop.karoryfer.com/pages/free-growlybass)**, Karoryfer Samples | Squier Jazz Bass — roundwounds, fingers, both pickups on 10, recorded direct | CC0 1.0, two ways: the archive's `LICENSE`, plus the vendor page and the SPDX tag | **Rejected by ear** — *"02-growlybass is not what I have in mind."* The best-sampled library of the three, and it lost on tone |
| **[Bass Guitar YR](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html)**, FreePats | Yamaha RBX — a split-coil P-style pickup, which makes it the closest thing to a Precision on offer anywhere | CC0 1.0, two ways: the FreePats project page and the repo's own `README.txt` and `LICENSE.txt` | **Rejected on measurement, unheard,** and it is the costliest rejection here. 12 files (finger) / 13 (pick) **in total**: one per semitone from sounding MIDI 28 to 39/40, **one velocity layer, no round robins**. Its top note sounds at 39, so the upper third of the register would shift up 9–12 semitones, five times past the transparent bound — and one file per note is the machine-gun artefact feature-9 spent a whole feature undoing |
| **[Precision E-Bass](https://www.fiedler-audio.de/creative-commons-library/)**, Fiedler Audio | **a Fender Precision — literally the instrument the brief asked for** | modified **CC BY-NC-SA 3.0**, and the page forbids incorporating the library into sound libraries | **Rejected on licence, unheard.** Four failures at once: 3.0 is not 4.0, `-NC` is out, `-SA` is out, and this repo commits its audio, so the redistribution bar alone would end it |
| **[Rickenbacker 4001](https://sfzinstruments.github.io/basses/rickenbacker4001)**, Project16 | Rickenbacker 4001, many articulations | CC-BY-NC-SA-3.0 | **Rejected on licence, unheard.** `-NC`, `-SA`, and 3.0 |
| **[Standard Bass](https://sfzinstruments.github.io/basses/standard_bass)**, Unreal Instruments | multi-articulation bass | "Custom" — no licence text published at the source | **Rejected, unheard.** A licence whose text cannot be read cannot be read twice |
| **[Black And Blue Basses](https://shop.karoryfer.com/pages/free-black-and-blue-basses)**, Karoryfer | a hollowbody played with the fingers and a solidbody played with a pick; **the vendor names neither make nor model** | CC0 1.0, two ways | **Not shortlisted.** Three candidates is the cap; a hollowbody is a different instrument class, and with the models unnamed its fit could only have been guessed at rather than measured |
| Pastabass — `spaghetti`, `linguine`, same archive | Bass VI at the bridge pickup — roundwounds and flatwounds | CC0 1.0, two ways | **Not shortlisted.** The cap, and both sit further from the recipe: a bridge pickup is the thin end of the instrument, and roundwounds are the wrong strings for the decade |
| **[Fashionbass](https://shop.karoryfer.com/pages/free-fashionbass)** and **[Swagbass](https://shop.karoryfer.com/pages/free-swagbass)**, Karoryfer | Killer KB-Simmony and Ibanez BTB-400QM, both in **fifths tuning (CGDA)** | CC0 1.0, two ways | **Not shortlisted.** The cap. A fifths-tuned neck gives a different string gauge and speaking length per pitch than any Precision |
| Meatbass and Sneakybass, Karoryfer | **double basses**, bowed and pizzicato | CC0 1.0, two ways | **Not shortlisted.** This change exists to replace a pizzicato double bass |
| **[Big Little Bass](https://github.com/sfzinstruments/karoryfer.big-little-bass)**, Karoryfer | Washburn AB95 hollowbody, sampled at the 12th fret and above | CC0 1.0, two ways | **Not shortlisted.** Deliberately a ukulele-bass speaking length — the opposite of a 34-inch Precision |
| [VCSL](https://github.com/sgossner/VCSL) | — | CC0 | **Rejected: it holds no electric bass.** Its Composite Chordophones are two harps and a strumstick |
| VSCO 2 CE | Solo Contrabass, pizzicato | CC0 | **The incumbent, and the reference the candidates were played against.** It has no electric bass |
| GM soundfonts (FluidR3 GM, GeneralUser GS) | GM programs 34/35, "Electric Bass" | not checked at the source | **Not pursued, and the licence was never the reason.** A GM program carries one or two recordings across the whole register, so it fails Bass Guitar YR's measurement bar before a licence matters |

**Three survived to preparation, which is the cap exactly:** Pastabass
`tagliatelle`, Pastabass `fetuccine`, Growlybass. Two of the three come from one
archive, and that bought coverage rather than spending a slot: Pastabass's
mappings are four different instruments to the ear — the same bass with different
strings, a different pickup, a different hand and a mute — while sharing one
download, one licence check and one provenance source. So the three candidates
span the decision the ear actually had to make: a bright roundwound Jazz Bass
with the pickups wide open, flatwounds and fingers on the neck pickup (the 60s
Precision *recipe* on a different body), and flatwounds picked and muted, which
is the Motown thump a 60s Precision made on records.

### The verdict, in the listener's own words

Given 2026-09-07, on `groove-01` — `straight-funk`, 105 bpm, C mixolydian — the
`straight-funk` groove that spends the largest share of its bass note-time below
MIDI 32 (54.4%), which is where a pickup and a plucked string differ most. The
contrabass and all three candidates were played back to back **at matched
bass-track loudness**: post-trim bass RMS **−41.168 dBFS in all four files**,
matched to 0.000 dB. Never at matched master loudness — `mixTracks` pins true
peak onto `PEAK_CEILING`, so all four masters sit at 0.8910 by construction and
an A/B matched there would be an A/B of two different balances, in which the ear
picks the louder bass.

> "already listened to some in the audition ab folder. 02-growlybass is not what
> I have in mind. 04-pastabass-tagliatelle sounds very good. If possible, we can
> fine tune that bass. But the audition track I heard already wins against our
> upright"

**What that verdict covers, and what it does not.** It settles the instrument and
nothing else. It was explicitly not a verdict on the level — the bass in those
renders sat exactly where the contrabass sat, by construction — nor on the other
eight feels, nor on pan, humanize or reverb, none of which differed between the
four files. And **"if possible, we can fine tune that bass" is not a request to
filter or EQ.** *The pack shapes format and envelope. It does not carry a filter.*
above is the rule; the fine-tuning it points at is `gain.bass`, per feel, by ear.

**This is the one sign-off in the pack's history that `SIGN_OFFS` cannot hold,
and this section is its only committed home.** `gate.test.ts`'s `voidSignOff`
requires a pinned hash to reproduce, from the committed tree, the audio a person
actually heard, and these four renders can never satisfy it: they were built from
a scratch `pack.json` in a gitignored folder, carrying a scratch bass trim that
is no template value, against the *old* committed templates. So `straight-funk`
is heard a second time once its `gain.bass` is settled against the committed
pack, and that second verdict is the one `SIGN_OFFS` pins.

### The bass is bright, and that was kept on purpose

The picked flatwound has more pick attack in the 1–3 kHz region than a plucked
upright ever had, and it was raised as a possible change on 2026-09-07 — then
settled the other way in the same conversation: *"just go with it, no change for
now. no filter applied. it might be even good for Sam cause the bass is more
audible"*, and *"ok, got it. We keep it as is"*.

**So the brightness is a decision, not an oversight, and the reason is the
player's rather than the engineer's.** A bass you can pick out of the mix is a
bass you can play along to, which is the whole reason that voice is the one the
persona in [docs/persona.md](../../../docs/persona.md) leans on. An engineer
balancing this pack alone would probably take some of it off.

**If it is ever darkened, reach for the other mapping and not for a filter.**
Pastabass's `fetuccine` — flatwounds, fingers, neck pickup, the 60s Precision
recipe on a different body — is the shortlisted candidate that goes exactly that
way. It was prepared and rendered for the audition as
`03-pastabass-fetuccine.mp3`, so the work of measuring it is already done and
recorded in the shortlist above. *The pack shapes format and envelope. It does
not carry a filter.* is still the rule, and there is no filter anywhere in the
render path — `voices.ts`, `mix.ts` and `pack.ts` have none between them. A
darker bass is a different recording, per the rule, and never an EQ curve.

### What measurement decided, and what it did not

Two rejections were settled by measurement before anything was heard — Bass
Guitar YR on register and alternates, and every `-NC` / `-SA` / custom row on
licence. Among the three that were prepared, **measurement did not separate
them**, and the numbers are kept so nobody re-runs them looking for a winner:

| | Growlybass | `fetuccine` | **`tagliatelle`** |
| :-- | --: | --: | --: |
| sampled notes in the shipped register | 10 | 8 | **9** |
| widest gap between sampled notes, bound 4 | 3 | 3 | **3** |
| lowest sampled note, sounding | 25 | 28 | **25** |
| shortfall below the register the generator plays, bound 4 | 1 | 4 | **1** |
| worst pitch error against equal temperament | 31.1¢ | 8.9¢ | **7.0¢** |
| velocity layers declared, out of those recorded | 3 of 4 | 3 of 4 | **3 of 3** |
| worst net step at a live layer boundary, 7.5 dB flattens | 2.59 dB | 5.00 dB | **4.60 dB** |
| files reaching full scale in the shipped set | 32 of 120 | 6 of 96 | **0 of 81** |
| widest level spread between alternates inside one layer | 4.1 dB | 5.1 dB | **3.9 dB** |

All three clear every bar. **So the finding is the ride's again, one instrument
later: the best-sampled library of the three — four recorded velocity layers
against three, and the cleanest layer levelling of any design measured — was
turned down by ear in five words.** If you are sourcing the next voice, that is
the finding to carry, not the table.

Two of those rows are findings rather than scores:

- **no file in the shipped set reaches full scale** — 0 of 81, worst run 0
  samples at |v| ≥ 0.9995. That was a live risk and not a formality: Growlybass
  ships 32 of 120 that do, with runs up to 65 consecutive samples pinned at
  digital zero, and `fetuccine` 6 of 96;
- **MIDI 46's `vl1` alternates spread 3.9 dB**, the widest in the shipped set,
  and a nominal is derived from the first-listed alternate — which assumes the
  alternates inside a layer are level-matched. It is inside this pack's own norms;
  the cowbell's two alternates are 3.96 dB apart and its own section records that
  as a known concern. But it is the one bass note where the assumption is
  loosest, and a repeated note at MIDI 46 is where to listen for it.

**What none of the three fixed, and what it costs.** All three sources are
recorded **16–19 dB hotter** than VSCO's contrabass, whose files peak at −20 to
−36 dBFS, and nothing in the pack can absorb that — see *Levelling* below, which
has the arithmetic and the measured starting point. The whole of it belongs in
`gain.bass`, which is the two-job rule working exactly as written.

## Voice mapping

| Voice | Instrument | Layers × round-robins |
| :-- | :-- | :-- |
| `kick` | MuldjordKit kick drum (`KdrumL`) | 4 × 3 |
| `snare` | MuldjordKit snare (`Snare1`) | 4 × 3 |
| `hatClosed` | MuldjordKit hi-hat, closed | 4 × 3 |
| `hatOpen` | MuldjordKit hi-hat, open | 3 × 3 |
| `ride` | DRSKit ride — a Paiste Formula 602 thin crash used as a ride, bow struck with the stick tip (`Ride_tip`), samples 5–7 | 1 × 3 |
| `rideBell` | DRSKit, same cymbal and session, bell struck with the stick tip (`Ride_tip_bell`) | 2 × 2, 3 |
| `rim` | MuldjordKit snare, quiet stroke (`SnareRest1`) | 2 × 3 |
| `tomHigh` | MuldjordKit rack tom (`Tom2`) | 3 × 2 |
| `tomLow` | MuldjordKit floor tom (`Tom4`) | 3 × 2 |
| `bongoHigh` | VCSL Bongos, high (`BongoH_Hit1`) | 3 × 2 |
| `bongoLow` | VCSL Bongos, low (`BongoL_Hit1`) | 3 × 2 |
| `claves` | VCSL Claves, legacy set — one pair, resampled down a fifth, sounding ~1.56 kHz | 1 × 2 |
| `cowbell` | VCSL Cowbells — `Cowbell1` and `Cowbell2`, open strokes | 1 × 2 |
| `bass` | Squier Bass VI, picked, flatwound, muted (Pastabass `tagliatelle`) | 9 notes × 3 layers × 3 |
| `comp` | Upright Piano (VSCO 2 CE) | 11 notes × 1 |

## Two toms, and three layers that mean something

VCSL has a Tom 1 and a Tom 2 and no third drum between them, so the pack holds a
high tom and a low tom. Pitching one of them to invent a middle tom would add a
voice that sounds like a detuned copy of a voice already there.

Their three velocity layers are the library's own `v2`, `v3` and `v4` groups, and
the thresholds in `pack.json` split `VELOCITIES`'s tom rows exactly: an
off-sixteenth reaches `v2`, an off-eighth `v3`, a quarter-note position `v4`. A
fill's accents therefore change which drum hit is heard, not just how loudly the
same one is replayed.

## ⚠ A sampled note's sounding pitch is measured, never read off its filename

This is the pack's oldest rule and the one it has been burned by three times.

VCSL's TX81Z Clavisynth — the stand-in `comp` used to be — is labelled two octaves
below where it sounds: `Clavisynth_C2_vl2.wav` sounds at **C4**, with no spectral energy
at all at the named frequency. Had that been read rather than measured, every comp chord
would have been two octaves out and the game unplayable. VSCO 2 CE's contrabass was the
second instance: it names octaves with C3 as middle C, so `BKCtbss_Pizz_E0_*.wav` sounded
at MIDI 28. **Pastabass is the third, and it goes the other way** — its filenames sit an
*octave above* sounding pitch, so `e2` sounds at MIDI 28 and `db2` at **MIDI 25** (see
below). Neither of the first two is still in the pack; the rule outlives all three, and
both pitched voices carry the frequency they were measured at as `measuredHz` in
`pack.json` so the claim can be re-checked rather than trusted.

The trap has another shape again, and the upright piano is it. VSCO 2 CE's `Keys/Upright
Piano` names its files `Player_dyn{1,2,3}_rr1_{000..044}.wav`, and the numeric suffix is
neither a MIDI number nor a semitone offset: the files step by 2 while the pitch steps by
**4 semitones**, so index `012` sounds at MIDI 45, `014` at 49, `024` at 69 (measured
440.7 Hz), and so on. The set's own `MappingChart.txt` says as much, and measurement
agrees with it note for note across the register the pack uses.

Measured against equal temperament the piano is stretched, as a real piano is: −11 cents
at MIDI 45, within ±5 of nominal through the middle, +13 at MIDI 85. That is Railsback
stretch, not a tuning error. `pack.test.ts` allows half a semitone.

## ⚠ The comp declines the velocity layers the library has

`rim`, `hatOpen`, `claves` and `cowbell` each carry a paragraph saying the recording
offered nothing more. **The comp's paragraph says the opposite, and for the same reason
the ride's does.** VSCO 2 CE's `Keys/Upright Piano` ships `dyn1`, `dyn2` and `dyn3` for
every note, this pack declared all three, and quick-8 dropped two of them. Each of the
eleven notes now declares one layer — `maxVelocity: 1`, `nominalVelocity: 0.5` over
`Player_dyn2_rr1_0NN.flac` — and the whole dynamic curve is carried on `gainFor`.

**The reason is that the recorded dynamics are far wider than the bands they were put
in.** Peak dBFS per file, `ffmpeg volumedetect`, for the four notes the catalogue
actually sounds — the declared register is 55–76 and nothing outside 60–75 is ever
played, so seven of the eleven sampled notes never mattered to this table:

| note | dyn1 | dyn2 | dyn3 | net step at 0.45 | net step at 0.8 |
| :-- | --: | --: | --: | --: | --: |
| 61 | −37.6 | −24.2 | −13.6 | **+4.5** | +7.4 |
| 65 | −31.2 | −21.8 | −10.1 | +0.5 | +8.5 |
| 69 | −36.1 | −22.5 | −8.5 | **+4.7** | **+10.8** |
| 73 | −31.4 | −22.1 | −12.5 | +0.4 | +6.4 |

Net step is the recorded difference minus what the nominals paid back — 8.87 dB at 0.45
(0.225 → 0.625) and 3.16 dB at 0.8 (0.625 → 0.9). Neither `comp` nor `bass` declared a
`nominalVelocity` at the time, so both fell through `nominalOf` to the band midpoint; the
bass declares one on every layer of every note now, and the comp's single layer declares
0.5 outright. The
recorded dynamics are 10–14 dB apart and the bands imply 3–9, so no calibration of
`nominalVelocity` could close either boundary: continuity at 0.8 needs a nominal above 1,
or 2.8× against `MAX_LAYER_GAIN = 2`; the 0.45 boundary wants 3.6×.

**And the crossings were jitter, not expression.** `gaussianUnit` is bounded ±1, so
humanize adds exactly ±`humanize.velocity` — 0.04 on `bossa-nova` to 0.13 on `shuffle`.
A chord voice sitting at 0.44–0.48 before humanize lands on either side of 0.45 from one
pass to the next, on the same chord: the timbre flickered where nothing musical changed.
Only one product of `VELOCITIES.comp` × `COMP_ACCENTS` × `(1 − 0.12 × voicesBelow)`
clears 0.8 on its own — 0.72 × 1.12 = **0.8064**, top voice, strong beat, accented.
Everything else above the line got there by jitter.

**The chord-balance argument is what settled it, and it is the one the ride never had,
because a ride plays one note at a time.** At MIDI 65 as reference, dyn2's inter-note
profile is 61 −2.4, 69 −0.7, 73 −0.3; dyn1's is 61 −6.4, 69 −4.9, 73 −0.2. So one note
of a chord crossing 0.45 shifted its position *inside* that chord by up to 4.2 dB —
against the 1.1 dB per voice that `COMP_VOICE_DROP = 0.12` sets deliberately, so the top
voice is the melody a listener follows. dyn3 did the same at the top, up to 4.4 dB.

**dyn2 is the layer that survives** because it is the flattest of the three across those
four notes — 2.4 dB of spread against dyn1's 6.4 and dyn3's 5.1 — and because mf is the
touch a backing comp under a soloist wants.

**It stops being safe if the comp's dynamic range ever widens.** `gainFor` is
`velocity / 0.5`, which reaches **1.72** at the measured catalogue maximum of 0.862 and
**1.87** at the theoretical worst (`VELOCITIES.comp.strong` 0.72 × the 1.12 accent, plus
shuffle's 0.13 of jitter) against `MAX_LAYER_GAIN` 2. So **`VELOCITIES.comp.strong`
cannot rise above 0.77** without the comp hitting the ceiling — the same hard edge the
ride records, and one layer is what puts it there.

**The single layer is round-robin alternates the comp does not have.** The pack holds
only `rr1`, and every comp note now replays one file. `pack.test.ts` names `comp` in
`SINGLE_LAYER_BY_DESIGN` rather than exempting it silently, and pins what actually keeps
it off the machine-gun artefact instead: `COMP_SPREAD_RANGE` rolls each voicing over
5–15 ms so almost every comp event owns its own onset, successive chords are different
pitches, and humanize gives every event its own velocity — the same recording is never
struck twice running at the same pitch and the same gain. Three velocity layers were
never that guard: 83% of comp notes already replayed one `dyn2` file. Sourcing real
alternates is still its own ticket; the bass ticket that used to sit beside it is closed,
and the bass ships three alternates per layer.

**Two knock-on effects worth knowing before you read the tables below.**

- **The reference notes changed recording.** `NOTE_SECONDS`-long reference pitches are
  rendered from the `comp` voice at `NOTE_VELOCITY = 0.85`, which used to land in dyn3.
  They are mf now. `mixTracks` normalises onto the peak ceiling so the level barely
  moves; the timbre does, and A♭4's measured fundamental with it — 416.60 → 415.58 Hz,
  4 cents, toward nominal 415.30 rather than away from it. Run `npm run notes` after any
  change to the comp pack, or `grooves:verify` fails as `pack-stale`.
- ***The bands as committed* below lists no `comp` or `bass` row, and never did.** That
  table is built from `decl.voices[voice].layers`, and both pitched voices declare their
  layers per note under `notes` instead. Their levelling lives in this section and in the
  bass's own, not in that table.

## The bass keeps the velocity layers its library recorded

The ride's section and the comp's both say a recording offered more than the pack
declares. **The bass's says the opposite: Pastabass records three velocity layers for
every note and all three ship.** The method is quick ticket 8's — the same one that
flattened the comp — and the measurements are written down here because the answer came
out the other way, and the numbers are the only thing that makes that checkable.

**The window the bass actually plays decides everything, and it is narrower than the
declaration suggests.** `VELOCITIES.bass` is `{ strong: 0.92, medium: 0.8, weak: 0.68 }`
and the largest `humanize.velocity` in the registry is `shuffle`'s `0.13`, so the
theoretical window is 0.55 … 1.0. Measured over every bass event the catalogue produces
— 2474 of them, straight out of `buildEvents`, so these are the humanized velocities the
renderer really sees — it is **0.5796 … 1.0000, a 4.75 dB window**, median 0.817. The
library's recorded dynamics span 14–20 dB. That is the ride's situation rather than the
comp's: the ride's window is 2.9 dB, and `hatClosed`, whose four layers carry real
information, spans 11.8.

**The boundaries sit at 0.74 and 0.86 — the midpoints between `VELOCITIES.bass`'s rows.**
That is the same reasoning that put `hatClosed`'s thresholds on its velocity rows: it is
the only placement that gives a crossing a chance of being a musical accent rather than
jitter. It also avoids by construction the defect quick-8 found on the committed
contrabass, whose lower boundary sat *exactly* on `VELOCITIES.bass.medium = 0.8`, so
59.7% of bass events landed on the line and humanize flipped them from one recording to
the other on the same note.

Peak dBFS below is the first-listed alternate of each layer, measured on the prepared
FLAC with `ffmpeg volumedetect`. The **net** step at a boundary is the recorded
difference minus what the nominals pay back — `(peak₂ − peak₁) − 20·log₁₀(nominal₂ /
nominal₁)` — which is zero wherever the ratio rule is free to run, and non-zero only
where the headroom floor caps the payback:

| MIDI | `vl1` | `vl2` | `vl3` | **net @0.86** | **net @1** |
| --: | --: | --: | --: | --: | --: |
| 25 | −12.4 | −6.7 | −3.3 | +1.10 | +0.00 |
| 28 | −15.5 | −8.7 | −2.9 | **+4.60** | +0.00 |
| 31 | −13.9 | −6.9 | −1.4 | +4.50 | +0.00 |
| 34 | −13.0 | −7.2 | −2.3 | +2.70 | −0.00 |
| 37 | −11.9 | −7.8 | −0.8 | +2.79 | **+0.30** |
| 40 | −14.0 | −8.5 | −2.2 | +3.80 | −0.00 |
| 43 | −9.4 | −5.9 | −1.3 | +0.10 | −0.00 |
| 46 | −8.3 | −3.6 | −0.0 | +0.30 | −0.00 |
| 49 | −11.3 | −3.0 | −0.7 | +2.60 | +0.00 |

Median net step **+2.70 dB** at 0.86 and **+0.00 dB** at 1; worst **4.60 dB** and
**0.30 dB**. The flatten threshold is **7.5 dB** — quick-8's figure, the one number in
this repo that came with a listening verdict attached — so **neither boundary comes near
it, and both stand.** The top boundary is continuous to within 0.30 dB on every note,
because `vl2` is never so far under `vl3` that the floor bites. The lower boundary
carries the whole residue: the ratio rule wants nominals of 0.218–0.366 for `vl1` and
the floor forbids anything under 0.3701, so 0.10–4.60 dB of the recorded step is never
paid back. Even that worst case is 1.6× smaller than the *smallest* step quick-8
flattened the comp for.

**And the argument that settled the comp does not apply here at all.** What chose one
layer for the comp was chord balance: one note of a chord crossing a boundary moved its
position *inside* that chord by up to 4.2 dB, against the 1.1 dB per voice that
`COMP_VOICE_DROP` sets on purpose. **The bass plays one note at a time.** It is in the
ride's position, and a timbre step on a monophonic voice reads as expression, not as a
voice sitting wrong inside a chord.

The three layers also stand at tighter headroom targets than the one committed: at a
1.7× target the two boundaries measure 5.69 and 1.71 dB, at 1.4× they measure 6.69 and
3.40 — both still far under 7.5. **Neither losing candidate can say that:** Growlybass's
four-band design breaches at 1.7 and `fetuccine`'s top boundary breaches at 1.4. What is
committed is the 2.0× target, for one reason that outranks the extra margin — it is the
pack the audition was rendered from, and therefore the audio a person approved.

**What the measurement cannot settle, and what to listen for.** Both live boundaries sit
inside the jitter band of a `VELOCITIES.bass` row, so some crossings are humanize rather
than intent — the mechanism that made the comp's timbre flicker on an unchanged chord.
What is different is that the *level* step is 0.10–4.60 dB here against the comp's
4.5–10.8, and that the voice is monophonic. **That is a prediction, not a finding.**
Listen for a repeated bass note that changes colour between passes while its level and
timing move as they should — the 0.74 boundary, which 92.3% of events sit above and 17.7%
below; for the bottom of the register in particular, where MIDI 28 and 31 carry the two
largest net steps; and for whether the muted flatwound tone reads as *even* rather than
as *flat*. If it reads flat, quick-8's note applies: the answer is that feel's
`VELOCITIES` or its accent depth, not the pack.

## ⚠ The cross-stick has one velocity layer

`rim` is the cross-stick of the snare already in the pack — the same drum, so it is
coherent with the kit by construction rather than by mixing. VCSL recorded it once:
`Snare2_stick` is a single velocity group, `v1`, with two round-robin alternates and
nothing above or below it. So `rim` ships one layer and two alternates.

The two alternates could have been split into a soft and a hard layer — they differ by
about 1.7 dB — but that difference is take-to-take variation, not a dynamic the player
produced. Promoting it would put a number in `pack.json` that the recording does not
support, which is the same erasure normalising would be. `hatOpen` is declared the same
way and for the same reason.

## ⚠ VCSL recorded no round robins for the claves or the cowbell

Every VCSL file for both voices is `rr1`. The library has velocity groups and it has two
instruments per voice, and it has no repeated takes at one dynamic on one instrument —
which is the one thing a round robin is. A ride ping or a clave is the most repeated event
in a bar, and one identical sample replayed is the machine-gun artefact feature-9 spent a
whole feature undoing, so a single-file layer was not an option. The alternates had to come
from somewhere else, and the two voices found different answers.

**The claves keep one instrument.** `Claves1` sounds at 2001 Hz and `Claves2` at 2347 Hz —
**276 cents apart, a whisker under a minor third**. Pairing them as alternates would have
been read as a decision about variation and heard as a decision about pitch: `roundRobin`
in `voices.ts` returns `start + pass + played`, so with two files the choice strictly
alternates hit to hit, and a repeating claves figure would play a fixed two-pitch ostinato
that no pattern in `events.ts` asked for and no seed varies. A pair of claves has a
focused, definite pitch — the measured spectrum is one dominant partial with a narrow
cluster round it — so the interval is not a colour, it is a scale step in all twelve modes.
That is a bigger difference than a round robin, not a smaller one.

What ships instead is VCSL's **legacy** claves set, which does hold repeated takes: it is
the same pair as `Claves2` (2338 Hz against 2347 Hz, ~7 cents, matching partial structure)
and the library marks `claves_mf`, `claves_mf_2` and `claves_mf_3` as one dynamic. Two of
the three are committed. `claves_mf_2` is left out because it measures 8.2 dB below
`claves_mf` inside that one dynamic group, and an alternate that far down inverts the
voice's own dynamics: `VELOCITIES.claves` spans only 2.9 dB from weak to strong, so a weak
hit landing on the loud take would out-shout a strong hit landing on the quiet one.
**Both committed takes are pitched a fifth below the source, and that is a listening
decision, not a repair.** VCSL's legacy claves are a small, bright pair: `claves_mf`'s
strongest partial sat at 2337 Hz and `claves_mf_3`'s at 5640 Hz. Heard in a repeating
clave figure they read as sticks rather than as claves, so both files are resampled by 2^(-7/12) = 0.66742
— a plain playback-rate change, so the body resonance moves with the pitch and the result
is a bigger pair of sticks rather than a filtered small one — and re-capped at 0.4 s with
a fresh 80 ms fade. The partials land at 1556 Hz and 3766 Hz, which is where a large
hardwood pair sits. Nothing is normalised: the two alternates were 2.53 dB apart before
and are 2.50 dB apart after, so the round-robin variation the renderer plays is intact.
Peaks moved up 0.47 dB and 0.50 dB, which is interpolation across a resampled transient
and not a gain change. `provenance.json` records the derivation on both rows.

No registered template plays `claves`, so this re-renders nothing. The style the
resample was auditioned under, `son-montuno`, was built and then declined by the player
in feature-25; **the pitched-down pair was signed off on its own terms in the same
listening pass** and stays. See `specs/new-styles.md`.

`claves_mp`, `claves_pp1` and `claves_ff` are single takes at their own dynamics with no
partner inside 3 dB, so they would each have made a one-file layer.

**The cowbell pairs two bells, and the measurement is why that is allowed here and not
there.** `Cowbell1`'s open stroke sounds at 466 Hz and `Cowbell2`'s at 456 Hz — **37 cents
apart**, under a quarter tone, and on a spectrum that is strongly inharmonic, where the ear
reads clang rather than pitch. Two bells that close are one voice varying; two claves a
minor third apart are two instruments trading. The pairing is by measured peak, not by the
library's dynamic-group name: `Cowbell2` was recorded about 10 dB hotter throughout, so
`Cowbell1_Hit_v4` (peak 0.2210) sits beside `Cowbell2_Normal_v2` (0.1402) rather than
beside the file whose name matches.

**Neither voice declares a velocity split, and that is the recording's decision.** Both
libraries' dynamic steps are 4–14 dB apart while `VELOCITIES` asks these two voices for
2.9 dB (claves) and 3.1 dB (cowbell) from weak to strong. Declaring a layer boundary inside
that span would make `gainFor` ask a quiet layer for 1.7× its recorded level or more, on
the way to the `MAX_LAYER_GAIN` ceiling of 2 that `rim` was one change away from clipping
into. One layer at `nominalVelocity` 0.5 keeps both voices between 1.0× and 1.5×.

**Both voices have now been heard on their own, and they were liked** — auditioned as raw
samples during feature-24 and judged good enough to build on. That settles the sourcing
question and nothing else: no template plays either voice, so the alternates have still never
been heard *in sequence*, which is where all three worries below actually live. Each of them
is about what happens across a repeating loop, and a sample played once cannot show it:

- the cowbell's two alternates are 3.96 dB apart against a 3.06 dB weak-to-strong span, so
  a weak hit can land up to 0.9 dB above a strong one — at the level JND for a transient,
  and below any accent `events.ts` writes;
- the two claves takes differ in brightness as well as level: `claves_mf_3` has its
  strongest partial at 3.77 kHz where `claves_mf` has it at 1.56 kHz — 5.6 kHz and
  2.3 kHz before the fifth came off — which is where on the stick the player hit;
- the legacy claves are a drier, brighter capture than the `_Mid` files the bongos come
  from, so a style that plays claves and bongos together should be listened to for a room
  mismatch.

## Note spacing

Every note in a pitched voice's register must sit within **2 semitones** of a sampled
note — the bound that keeps linear interpolation transparent — so no gap between
sampled notes may be wider than 4 semitones.

- `bass` sounding MIDI 25–49, covering 23–51. Widest gap 3 semitones.
- `comp` sounding MIDI 45–85, covering 43–87. Widest gap 4 semitones.

`comp` is on an even 4-semitone grid because the upright piano was sampled that way —
the library holds a note every 4 semitones from MIDI 21 up, and the pack takes the
eleven of them that cover its register: 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85.
`bass` is on an even 3-semitone grid for the same reason and not by principle: Karoryfer
sampled Pastabass in minor thirds, and the pack takes all nine that cover its register —
25, 28, 31, 34, 37, 40, 43, 46, 49. The contrabass it replaced was uneven (28, 31, 34,
36, 40, 42, 45, 49), because a real instrument is sampled where its player found it
useful. Either shape is fine; what the bound cares about is the widest gap, which fell
from 4 to 3.

`Keys/Upright Nr1` was the other upright on offer and was rejected: it samples every
five to seven semitones, which would ask the resampler for 3.5-semitone shifts and break
the bound it is transparent within.

## ⚠ The bass is one semitone short at the bottom of its declared register

`bass` is asked to cover sounding MIDI 22–50. It covers **23–51**, so **only MIDI 22 is
unsampled** — and nothing ever asks for it. `inRegister` in `events.ts` places a bass
root no lower than `BASS_BASE_MIDI - 12 = 24`, which sits inside the two semitones MIDI
25 covers, so the worst real case is a **1-semitone** downshift. The contrabass this
replaced needed 4. `lowestSampledMidi - BASS_PLAYED.lowest` is **1** against a documented
bound of 4, and `pack.test.ts` asserts it.

**MIDI 25 is a real recording, and that is the whole reason it is allowed to be there.**
Karoryfer sampled the low E string tuned down to C# as well as at pitch, so `db2` is a
played note rather than arithmetic. Committing a pitched-down copy instead would be the
identical arithmetic the renderer already does at load time: it adds no information, only
the appearance of coverage. That rule has not moved. A shortfall is documented, never
faked away — this one is just a great deal smaller than the old one.

**One thing worth knowing about that note.** A low E slackened to C# is a slacker string
than the rest of the instrument, and it will not match its neighbours' tone exactly. The
catalogue's bass never goes below MIDI 28 today, so nothing reaches it. It is declared
because the register needs sounding 26 covered natively, and because a real recording
beats a 4-semitone downshift if a future feel ever drops there.

## ⚠ Pastabass's filenames sit an octave above sounding pitch

`Pastabass_tagliatelle_e2_*.wav` sounds at **MIDI 28** — 41.3 Hz, the open low E of a
bass guitar. The library's SFZ maps that file at `pitch_keycenter=40`, and every note in
it is written an octave above where it sounds, the way a bass part is notated. Read as
scientific pitch notation the whole set would be an octave sharp and the game unplayable.

`db2` is the extreme case: it **sounds at MIDI 25** — 34.8 Hz, C#1 — because the low E
string was tuned down to C# for it. Its filename says `db2`, its pitch says C#1, and only
measurement says which one the pack should believe.

The declared `midi` values were established by fitting the harmonic series of every one
of the 81 files, and each note carries the frequency it was measured at as `measuredHz`
in `pack.json`. A picked bass makes this less obvious than it sounds: on the low notes
the fundamental is *weaker* than the second and third partials, so a peak-picking tuner
reads an octave high. `measuredHz` is the **median over all nine files of a note** —
three velocity layers × three alternates — and that is not belt-and-braces. On one
candidate's lowest note, three of twelve files fitted an octave high on their own,
because H1 there sits 20–25 dB under the strongest partial. A median over nine is not
fooled by three; a single file is.

Measured against equal temperament this instrument is **within 5.6 cents on every note**
— worst +5.6¢ at MIDI 25 and −4.9¢ at MIDI 37, against the half semitone `pack.test.ts`
allows. It is a direct-recorded, freshly-tuned instrument: unlike the contrabass it
replaced (−30 to +32 cents, a real player on a real fingerboard) and unlike the piano's
Railsback stretch, there is nothing here to explain.

**`measuredHz` changes no audio, and that is worth stating.** `pack.ts` reads `note.midi`
for `rootMidi` and for `transpose`; `measuredHz` is a declared record that `pack.test.ts`
checks against the declared note's nominal frequency. Proven rather than assumed:
refining these figures from a single-file fit to the nine-file median re-rendered the
audition's four A/B MP3s byte for byte identical.

## Levelling

Levelling this pack is two independent jobs, and confusing them is the mistake
that costs the most. A voice's loudness in the finished mix is the product of:

1. **What the layer was recorded at.** The layers are deliberately not
   normalised, so the layer chosen for a velocity already carries the loudness of
   a hit at that velocity. `gainFor` in `voices.ts` scales *relative* to
   `nominalVelocity`, which is why a mis-declared nominal is heard as a step at a
   band boundary rather than as a voice being slightly wrong.
2. **Where the voice sits in the mix.** The template's `gain`, in dBFS, applied
   once per voice by `mixTracks`.

A pack error corrected in a template's gain becomes five more corrections in the
other five templates. So fix (1) in the pack, and only then set (2).

### How the nominals were derived

`level.ts` measures RMS in dBFS; `voiceLevels(tracks)` reports it per voice. Both
are pure and take PCM the renderer has already produced, so a measurement is
reproducible: same inputs, same numbers.

A layer's "measured peak" is the peak of its **first-listed alternate**; that is the
figure every committed number was derived from, and it is why the alternates inside a layer
have to be level-matched. A voice with a single layer has no ratio to take, so its nominal
is its band's midpoint — 0.5 for a layer covering all of `(0, 1]`.

Every layer declares `nominalVelocity` explicitly rather than defaulting to its
band midpoint. The figure is the top layer's midpoint scaled by the ratio of this
layer's measured peak to the top layer's — a layer recorded at half the peak
represents half the velocity. Defaulting to the midpoint assumes each recording
sits in the middle of whatever band it was assigned to, which is not true of a
kit sampled across fourteen dynamic groups and then reduced to three or four
layers: MuldjordKit's bands are evenly spaced in MIDI velocity, and its recorded
levels are not evenly spaced in amplitude.

The correction is worth real decibels. Before it, `rim` at its own strong
velocity asked its layer for 1.89× the level it was recorded at, against a
`MAX_LAYER_GAIN` ceiling of 2 — one small change away from clipping into the
clamp. After it, every voice in the kit sits between 0.67× and 1.40×.

### Worked example — the ride, both halves in order

Feature-24 is the first voice levelled from scratch since the rule above was
written, so here is the arithmetic, in the order R22 requires. Epic 2 applies
this method to `swung-sixteenth`; it should not re-derive it.

**The pack half, fixed first.** The ride ships one layer covering all of `(0, 1]`,
so there is no ratio to take and the nominal is the band's midpoint: **0.5**. That
is the whole of the pack half, and it was settled before a template gain was
touched. `rideBell` has two layers, so it does take the ratio: its lower layer's
first-listed alternate peaks at −9.236 dBFS against the top layer's −6.248, a
ratio of 0.7089, and 0.85 × 0.7089 = **0.6026**.

**The template half, second, and only then.** Four steps, each measured rather
than guessed:

| Step | Change | `shuffle.gain.ride` |
| :-- | :-- | --: |
| the first preparation | `Ride_tip` 10–15, two layers | −11 |
| quieter source takes | `Ride_tip` 5–7 / 9–11. The top layer's first-listed peak drops from −15.891 to −23.448 dBFS, **7.558 dB**, and the nominal derivation preserves that offset at every velocity | −11 + 7.558 = **−3.44** |
| one layer, not two | every hit now plays `{5,6,7}` at nominal 0.5. Off-beats: same files, nominal 0.4060 → 0.5, so 20·log₁₀(0.4060 / 0.5) = **−1.81 dB**. Quarters: (0.83 / 0.5) × 10^((−29.66 + 23.448)/20) = 1.66 × 0.4894 = 0.8124, **−1.81 dB** as well. The design is uniformly 1.81 dB quieter, which peak arithmetic alone would answer with −1.63 | measured instead on ride-track RMS, the right measure for a change of source takes: **−0.93** gave −45.53 dBFS against the two-layer design's −45.47, matched to 0.06 dB. The 0.70 dB above the peak-derived figure is tail energy that RMS sees and a peak ratio does not |
| the decay envelope | applied **without** re-gaining. The envelope leaves peak and attack RMS identical to three decimals and removes only wash, so the stroke stays at the level the ear had already judged, and the ride-track RMS falls to −47.04 dBFS | **−0.93**, unchanged |

**Committed: `nominalVelocity` 0.5 in the pack, `gain: { ride: -0.93 }` in the
template.** Verified against the render the sign-off was given on: the committed
pack and template reproduce that MP3 byte for byte, sha `e50363bf…5e09`.

**Measure the track, not the sample.** Post-gain per-voice RMS on `groove-07`:
ride **−47.04**, hatClosed −49.99, kick −36.97, snare −35.52, bass −38.74, comp
−38.18. The ride sits 11.5 dB under the snare and 2.95 dB over the hat it
replaced, which is R22 as written, and `gate.test.ts` asserts both inequalities.
A per-hit peak calculation says the opposite and is wrong: the ride plays six
hits a bar with tails that overlap, against the hat's two hits that do not.

`pan.ride` (+0.30, the drummer's-seat right, matching the toms) and
`humanize.lean.ride` (−2) were not moved. The sign-off was given on a render that
used both, so changing either would ship something nobody heard.

### Worked example — the bass, and the headroom edge it sits on

The bass is the second voice levelled from scratch under the rule above, and the first
where the rule **ran out of room**. In the README's own two-job order:

**The pack half, fixed first.** The top layer covers 0.86 … 1, so its nominal is that
band's midpoint, **0.93**. Each lower layer is 0.93 scaled by the ratio of its measured
peak to `vl3`'s, on the first-listed alternate: MIDI 49's `vl2` peaks at −3.0 dBFS
against `vl3`'s −0.7, a ratio of 0.7673, and 0.93 × 0.7673 = **0.7136**. That derivation
runs note by note, which is why `nominalVelocity` differs per note on this voice where
the drums declare one per layer — the recorded distance between `vl1`, `vl2` and `vl3` is
not the same at MIDI 28 as it is at MIDI 49.

**Where it ran out.** `gainFor` is `Math.min(velocity / nominalVelocity, MAX_LAYER_GAIN)`
with `MAX_LAYER_GAIN = 2`, so a layer's nominal has to clear `maxVelocity / 2` or the
layer asks for more gain than the clamp will give. The ratio rule wants 0.218–0.366 for
`vl1`, all of it under the 0.37 floor, so every note's `vl1` is floored at **0.3701**
instead — and the residue nobody pays back is the net step the section on the layers
measures.

| layer | maxVelocity | nominalVelocity | loudest / nominal |
| :-- | --: | --: | --: |
| `vl1`, all nine notes | 0.74 | 0.3701 | **1.99946** |
| `vl2`, MIDI 37 — the tightest | 0.86 | 0.4301 | **1.99953** |
| `vl2`, the other eight notes | 0.86 | 0.4770 … 0.7136 | 1.80294 … 1.20516 |
| `vl3`, all nine notes | 1 | 0.93 | 1.07527 |

`loudest(layer)` is `min(maxVelocity, min(1, VELOCITIES.bass.strong + max humanize.velocity))`,
which for this voice is just `min(maxVelocity, 1)`: 0.92 + 0.13 clamps to 1.

> **`VELOCITIES.bass.strong` cannot rise, and no template's `humanize.velocity` can rise,
> without the bass clamping into `MAX_LAYER_GAIN`.** `vl1`'s nominal is 0.3701 against a
> band top of 0.74, so `gainFor` reaches 1.99946 at the top of that band.

That is the same hard edge the ride records (`VELOCITIES.ride.strong` cannot rise above
0.87) and the comp (`VELOCITIES.comp.strong` cannot rise above 0.77), and it is exactly
the position `rim` was corrected *out of*. Read it as a recorded edge, not as headroom in
hand. Every layer does clear the bound, which the contrabass it replaced did not: that
voice declared no `nominalVelocity` at all, fell through to band midpoints, and sat
**exactly on 2.00** on all eight of its notes — `VELOCITIES.bass.medium` being 0.8 meant
every off-eighth bass note in the catalogue landed on that clamp. `pack.test.ts` pins the
bound per layer now.

**The template half, second, and only then.** The whole level difference between the two
instruments belongs there. Pastabass's sources are recorded 16–19 dB hotter than VSCO's
contrabass, and no pack-side value can absorb that: `nominalVelocity` is bounded above by
1 and the ratio rule already puts the top layer at 0.93, so the mechanism has about
0.6 dB left in it, not 16. Measured on `groove-01`, matching the contrabass's own
bass-track RMS needs **−18.68 dB** on top of the old `gain.bass` of `−1`. That figure is
a starting point measured against the old instrument's level, **not a value anyone has
heard** — all nine templates' `gain.bass` are set by ear, per feel.

### The bands as committed

| Voice | maxVelocity | nominalVelocity | alternates |
| :-- | --: | --: | --: |
| `kick` | 0.3465 | 0.5976 | 3 |
| `kick` | 0.6299 | 0.7857 | 3 |
| `kick` | 0.7717 | 0.8282 | 3 |
| `kick` | 1 | 0.8859 | 3 |
| `snare` | 0.3465 | 0.3785 | 3 |
| `snare` | 0.6299 | 0.6657 | 3 |
| `snare` | 0.7717 | 0.6674 | 3 |
| `snare` | 1 | 0.8859 | 3 |
| `hatClosed` | 0.3465 | 0.2283 | 3 |
| `hatClosed` | 0.5591 | 0.3658 | 3 |
| `hatClosed` | 0.7717 | 0.6056 | 3 |
| `hatClosed` | 1 | 0.8859 | 3 |
| `hatOpen` | 0.4173 | 0.5375 | 3 |
| `hatOpen` | 0.7717 | 0.8525 | 3 |
| `hatOpen` | 1 | 0.8859 | 3 |
| `ride` | 1 | 0.5 | 3 |
| `rideBell` | 0.7 | 0.6026 | 2 |
| `rideBell` | 1 | 0.85 | 3 |
| `rim` | 0.5827 | 0.6247 | 3 |
| `rim` | 1 | 0.7913 | 3 |
| `tomHigh` | 0.4803 | 0.6686 | 2 |
| `tomHigh` | 0.7874 | 0.8533 | 2 |
| `tomHigh` | 1 | 0.8937 | 2 |
| `tomLow` | 0.4882 | 0.627 | 2 |
| `tomLow` | 0.7717 | 0.9022 | 2 |
| `tomLow` | 1 | 0.8859 | 2 |
| `bongoHigh` | 0.45 | 0.0799 | 2 |
| `bongoHigh` | 0.8 | 0.277 | 2 |
| `bongoHigh` | 1 | 0.9 | 2 |
| `bongoLow` | 0.45 | 0.0934 | 2 |
| `bongoLow` | 0.8 | 0.2108 | 2 |
| `bongoLow` | 1 | 0.9 | 2 |
| `claves` | 1 | 0.5 | 2 |
| `cowbell` | 1 | 0.5 | 2 |

### Length caps

The cap holds each voice's useful decay and no more; the fade is the last 80 ms
of it.

| Voice | Cap |
| :-- | --: |
| `kick` | 0.90 s |
| `snare` | 1.00 s |
| `hatClosed` | 0.45 s |
| `hatOpen` | 1.00 s |
| `ride` | 2.00 s — parabolic decay envelope from 0.10 s to the cap, not an 80 ms fade; four overlapping tails at 92 bpm on eighths |
| `rideBell` | 2.00 s |
| `rim` | 0.80 s |
| `tomHigh` | 1.20 s |
| `tomLow` | 1.50 s |
| `bongoHigh`, `bongoLow` | 0.80 s |
| `claves` | 0.40 s |
| `cowbell` | 0.80 s |
| `bass` | 2.00 s — the note-off binds long before the cap does; see below |
| `comp` | 2.50 s |

**The bass's 2.00 s cap is not what binds, and it is kept for that reason.** The
longest bass note in the whole catalogue is **0.462 s** (`groove-78`,
`open-ballad`); `addAt` in `voices.ts` plays at most `durationSec + RELEASE_SEC`
of a sample, and `transpose` reads at most 1.12× of that in source time at the
pack's largest upward shift of 2 semitones — so **at most 0.527 s of any bass
file is ever heard**, 3.8× under the cap. At 1.92 s the source's tail is still
13.6 dB under its attack RMS, so the cap does cut a ringing tail; nothing ever
reads that far. **Do not shorten it to save bytes.** That would be a change
nobody can hear, and it would leave a future feel with a longer note running into
a cap set for the wrong reason. Per feel, the longest bass note runs
`open-ballad` 0.462, `half-time` 0.429, `shuffle` 0.380, `boom-bap` 0.349,
`second-line` 0.341, `straight-funk` 0.313, `swung-sixteenth` 0.283,
`bright-straight` 0.250, `bossa-nova` 0.244 s.
