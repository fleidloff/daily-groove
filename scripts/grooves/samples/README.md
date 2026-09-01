# Sample pack — `vcsl-funk`

Generation-time assets. These files are decoded by `scripts/grooves/pack.ts` when a
groove is rendered; they are never served to the browser and never enter the client
bundle.

## Source and licence

The pack draws on three libraries. Two are **CC0 1.0 Universal** — public domain,
no attribution required. The drums are **CC-BY 4.0**, which carries an obligation
the other two do not:

| Library | Voices | Licence | Licence text |
| :-- | :-- | :-- | :-- |
| [MuldjordKit (FreePats edition)](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html), by Lars Muldjord | `kick`, `snare`, `hatClosed`, `hatOpen`, `rim`, `tomHigh`, `tomLow` | CC-BY 4.0 | `LICENSE-MuldjordKit.txt` |
| [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | `bongoHigh`, `bongoLow` | CC0 | `LICENSE.txt` |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | `bass`, `comp` | CC0 | `LICENSE-VSCO-2-CE.txt` |

## ⚠ The drums carry an attribution obligation

MuldjordKit is CC-BY 4.0, and its terms name the text:

> Drum samples provided by DrumGizmo.org

This is not satisfied by `provenance.json` alone. A rendered groove is a
derivative work of the samples it is built from, so the obligation follows the
committed MP3s and anything the app does with them — which means the credit has
to be visible to a person using the app, not only to someone reading this repo.
`samples/pack.test.ts` asserts that every non-CC0 row carries the attribution
text, so a sample cannot enter the pack without it.

Why VCSL no longer supplies the kit: it is an *orchestral* library. Its bass
drums are concert bass drums that decay for over three seconds, its snare is a
concert snare, and it has no ride cymbal at all. The cajon that stood in for a
kick until feature-13 was not a whim — it was the closest thing VCSL had.

**The pack has no ride, and that is a decision rather than an oversight.**
MuldjordKit ships two; one was prepared, heard and removed. It is a rock kit and
its ride reads as one, where the swung feels want a jazz ride — a lighter, washier
ping. That is a different cymbal from a library chosen for it, so the kit keeps
one timekeeper, the closed hat, until such a cymbal is sourced.

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

## Voice mapping

| Voice | Instrument | Layers × round-robins |
| :-- | :-- | :-- |
| `kick` | MuldjordKit kick drum (`KdrumL`) | 4 × 3 |
| `snare` | MuldjordKit snare (`Snare1`) | 4 × 3 |
| `hatClosed` | MuldjordKit hi-hat, closed | 4 × 3 |
| `hatOpen` | MuldjordKit hi-hat, open | 3 × 3 |
| `rim` | MuldjordKit snare, quiet stroke (`SnareRest1`) | 2 × 3 |
| `tomHigh` | MuldjordKit rack tom (`Tom2`) | 3 × 2 |
| `tomLow` | MuldjordKit floor tom (`Tom4`) | 3 × 2 |
| `bongoHigh` | VCSL Bongos, high (`BongoH_Hit1`) | 3 × 2 |
| `bongoLow` | VCSL Bongos, low (`BongoL_Hit1`) | 3 × 2 |
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

### Length caps

The cap holds each voice's useful decay and no more; the fade is the last 80 ms
of it.

| Voice | Cap |
| :-- | --: |
| `kick` | 0.90 s |
| `snare` | 1.00 s |
| `hatClosed` | 0.45 s |
| `hatOpen` | 1.00 s |
| `rim` | 0.80 s |
| `tomHigh` | 1.20 s |
| `tomLow` | 1.50 s |
| `bongoHigh`, `bongoLow` | 0.80 s |
| `bass` | 2.00 s |
| `comp` | 2.50 s |
