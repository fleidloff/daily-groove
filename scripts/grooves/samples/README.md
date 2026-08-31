# Sample pack — `vcsl-funk`

Generation-time assets. These files are decoded by `scripts/grooves/pack.ts` when a
groove is rendered; they are never served to the browser and never enter the client
bundle.

## Source and licence

The pack draws on two libraries, both released under **CC0 1.0 Universal** — public
domain, no attribution required, redistribution permitted:

| Library | Voices | Licence text |
| :-- | :-- | :-- |
| [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | `kick`, `snare`, `hatClosed`, `hatOpen`, `rim`, `tomHigh`, `tomLow` | `LICENSE.txt` |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | `bass`, `comp` | `LICENSE-VSCO-2-CE.txt` |

`provenance.json` records, for every file, which library it came from, its path inside
that library, its licence and what was done to it.

Files were capped in length, faded out, downmixed to mono and re-encoded as 44.1 kHz
16-bit FLAC. They were deliberately **not** normalized: the level differences between
velocity layers are the data, and normalizing would erase them.

One invocation does all of it. This is the one the toms were prepared with, and it is
the shape to copy for a new voice group, so it lands in the same room and at the same
level as the voices already here:

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
| `kick` | Cajon, bass tone (`hit1`) | 3 × 2 |
| `snare` | Snare Drum, Modern 1 (`HitNS`) | 4 × 2 |
| `hatClosed` | Hi-Hat Cymbal (`HitC`) | 4 × 2 |
| `hatOpen` | Hi-Hat Cymbal (`HitO`, `HitLoose`) | 1 × 4 |
| `rim` | Snare Drum, Modern 1, cross-stick (`stick`) | 1 × 2 |
| `tomHigh` | Tom 1, stick (`HitS`) | 3 × 2 |
| `tomLow` | Tom 2, stick (`HitS`) | 3 × 2 |
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
