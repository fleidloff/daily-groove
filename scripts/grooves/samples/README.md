# Sample pack — `vcsl-funk`

Generation-time assets. These files are decoded by `scripts/grooves/pack.ts` when a
groove is rendered; they are never served to the browser and never enter the client
bundle.

## Source and licence

The pack draws on four libraries. Two are **CC0 1.0 Universal** — public domain,
no attribution required. The drums and the ride are **CC-BY 4.0**, which carries
an obligation the other two do not:

| Library | Voices | Licence | Licence text |
| :-- | :-- | :-- | :-- |
| [MuldjordKit (FreePats edition)](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html), by Lars Muldjord | `kick`, `snare`, `hatClosed`, `hatOpen`, `rim`, `tomHigh`, `tomLow` | CC-BY 4.0 | `LICENSE-MuldjordKit.txt` |
| [DRSKit v2.1](https://drumgizmo.org/wiki/doku.php?id=kits:drskit), by the DrumGizmo team | `ride`, `rideBell` | CC-BY 4.0 | `LICENSE-DRSKit.txt` |
| [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | `bongoHigh`, `bongoLow`, `claves`, `cowbell` | CC0 | `LICENSE.txt` |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | `bass`, `comp` | CC0 | `LICENSE-VSCO-2-CE.txt` |

`LICENSE-DRSKit.txt` is byte-for-byte `LICENSE-MuldjordKit.txt`: both kits are
CC-BY 4.0 and the text is the same. It is copied rather than shared so the source
table keeps one *Licence text* cell per library, and a reader is never asked to
know that two kits happen to sit under one licence.

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
are capped where the ring stops being useful: the pizzicato bass at two seconds
(`afade=t=out:st=1.92:d=0.08 -t 2`), which holds a plucked note's useful decay, and the
upright piano at two and a half (`afade=t=out:st=2.42:d=0.08 -t 2.5`) — VSCO's piano
takes run on for twelve. A source shorter than the fade's start comes through
untouched: nothing was cut, so there is nothing to fade.

Nothing is trimmed at the *front*: every file keeps its source lead-in, so a bass note
lands with the kick it is written beside rather than ahead of it.

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
| `claves` | VCSL Claves, legacy set — one pair, sounding ~2.34 kHz | 1 × 2 |
| `cowbell` | VCSL Cowbells — `Cowbell1` and `Cowbell2`, open strokes | 1 × 2 |
| `bass` | Solo Contrabass, pizzicato (VSCO 2 CE) | 8 notes; 5 × 2 layers × 2, 3 × 1 layer × 2 |
| `comp` | Upright Piano (VSCO 2 CE) | 11 notes × 3 |

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

This is the pack's oldest rule and the one it has been burned by twice.

VCSL's TX81Z Clavisynth — the stand-in `comp` used to be — is labelled two octaves
below where it sounds: `Clavisynth_C2_vl2.wav` sounds at **C4**, with no spectral energy
at all at the named frequency. Had that been read rather than measured, every comp chord
would have been two octaves out and the game unplayable. VSCO 2 CE's contrabass is the
second instance, and names octaves with C3 as middle C (see below). Neither sample is
still in the pack; the rule outlives both, and both pitched voices carry the frequency
they were measured at as `measuredHz` in `pack.json` so the claim can be re-checked
rather than trusted.

The trap has a third shape, and the upright piano is it. VSCO 2 CE's `Keys/Upright
Piano` names its files `Player_dyn{1,2,3}_rr1_{000..044}.wav`, and the numeric suffix is
neither a MIDI number nor a semitone offset: the files step by 2 while the pitch steps by
**4 semitones**, so index `012` sounds at MIDI 45, `014` at 49, `024` at 69 (measured
440.7 Hz), and so on. The set's own `MappingChart.txt` says as much, and measurement
agrees with it note for note across the register the pack uses.

Measured against equal temperament the piano is stretched, as a real piano is: −11 cents
at MIDI 45, within ±5 of nominal through the middle, +13 at MIDI 85. That is Railsback
stretch, not a tuning error. `pack.test.ts` allows half a semitone.

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
  strongest partial at 5.6 kHz where `claves_mf` has it at 2.3 kHz, which is where on the
  stick the player hit;
- the legacy claves are a drier, brighter capture than the `_Mid` files the bongos come
  from, so a style that plays claves and bongos together should be listened to for a room
  mismatch.

## Note spacing

Every note in a pitched voice's register must sit within **2 semitones** of a sampled
note — the bound that keeps linear interpolation transparent — so no gap between
sampled notes may be wider than 4 semitones.

- `bass` sounding MIDI 28–49, covering 26–51. Widest gap 4 semitones.
- `comp` sounding MIDI 45–85, covering 43–87. Widest gap 4 semitones.

`comp` is on an even 4-semitone grid because the upright piano was sampled that way —
the library holds a note every 4 semitones from MIDI 21 up, and the pack takes the
eleven of them that cover its register: 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85.
`bass` is not: a real instrument is sampled where its player found it useful, so the
contrabass's notes fall at 28, 31, 34, 36, 40, 42, 45, 49 — uneven, but never more than
4 apart.

`Keys/Upright Nr1` was the other upright on offer and was rejected: it samples every
five to seven semitones, which would ask the resampler for 3.5-semitone shifts and break
the bound it is transparent within.

## ⚠ The bass does not reach the bottom of its declared register

`bass` is asked to cover sounding MIDI 22–50. It covers **26–51**. The bottom four
semitones are not sampled, and they cannot be: MIDI 28 is the open low E of a
four-string contrabass, the lowest note the instrument has. VSCO 2 CE holds no
five-string or C-extension contrabass, and nothing else in either library plays in that
register.

MIDI 22–25 is therefore played by resampling the low E down by up to 6 semitones. That
is past the transparent bound, but it is the *downward* direction — interpolating a
sample longer, which images rather than aliases — and `events.ts` only ever asks for
MIDI 24 and above (`BASS_BASE_MIDI - 12`), so the worst real case is a 4-semitone drop
on a root that has been octave-displaced.

The alternative would have been to pitch a sample down offline and commit it as a
sampled note. That is the identical arithmetic the renderer already does at load time,
so it would have added no information — only the appearance of coverage.

## ⚠ VSCO 2 names octaves with C3 as middle C

`BKCtbss_Pizz_E0_*.wav` sounds at **MIDI 28** — E1 in scientific pitch notation, 41 Hz,
the contrabass's open low E. Read as scientific notation, `E0` would be 21 Hz, an octave
below anything the instrument can play; read as a written contrabass part — which is
notated an octave above sounding pitch — it would be an octave the other way. Both are
wrong, and both are the kind of wrong the measurement rule above is about.

The declared `midi` values were established by measuring the fundamental of every file,
and each note carries the frequency it was measured at as `measuredHz` in `pack.json`.
A pizzicato contrabass makes this less obvious than it sounds: on the low notes the
fundamental is *weaker* than the second and third harmonics, so a peak-picking tuner
reads an octave high. The measurement fits the whole harmonic series instead.

Measured against equal temperament the instrument is a little out, note to note:
between −30 and +32 cents, which is a real player on a real fingerboard rather than a
tuning error. `pack.test.ts` allows half a semitone.

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
| `bass` | 2.00 s |
| `comp` | 2.50 s |
