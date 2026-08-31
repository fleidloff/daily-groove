# Sample pack — `vcsl-funk`

Generation-time assets. These files are decoded by `scripts/grooves/pack.ts` when a
groove is rendered; they are never served to the browser and never enter the client
bundle.

## Source and licence

Every file comes from the [Versilian Community Sample Library
(VCSL)](https://github.com/sgossner/VCSL), released under **CC0 1.0 Universal** — public
domain, no attribution required, redistribution permitted. The full licence text is in
`LICENSE.txt`, and `provenance.json` records the original VCSL path for every file.

Files were trimmed, faded out, downmixed to mono and re-encoded as 44.1 kHz 16-bit FLAC.
They were deliberately **not** normalized: the level differences between velocity layers
are the data, and normalizing would erase them.

One invocation does all of it. This is the one the toms were prepared with, and it is
the shape to copy for a new voice group, so it lands in the same room and at the same
level as the voices already here:

```sh
ffmpeg -i in.wav \
  -af "pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=0.92:d=0.08" \
  -t 1 -ar 44100 -sample_fmt s16 out.flac
```

The length cap is per voice — long enough to hold that drum's decay and no longer —
and the fade is the last 80 ms of it. The kick, the snare and the toms are capped at
one second; the hats, the rim and the pitched voices at their own lengths. A source
shorter than the fade's start comes through untouched: nothing was cut, so there is
nothing to fade.

## Voice mapping

| Voice | VCSL instrument | Layers × round-robins |
| :-- | :-- | :-- |
| `kick` | Cajon, bass tone (`hit1`) | 3 × 2 |
| `snare` | Snare Drum, Modern 1 (`HitNS`) | 4 × 2 |
| `hatClosed` | Hi-Hat Cymbal (`HitC`) | 4 × 2 |
| `hatOpen` | Hi-Hat Cymbal (`HitO`, `HitLoose`) | 1 × 4 |
| `rim` | Woodblock | 2 × 3 |
| `tomHigh` | Tom 1, stick (`HitS`) | 3 × 2 |
| `tomLow` | Tom 2, stick (`HitS`) | 3 × 2 |
| `bass` | TX81Z FM Piano | 7 notes × 3 |
| `comp` | TX81Z Clavisynth | 10 notes × 3 |

## Two toms, and three layers that mean something

VCSL has a Tom 1 and a Tom 2 and no third drum between them, so the pack holds a
high tom and a low tom. Pitching one of them to invent a middle tom would add a
voice that sounds like a detuned copy of a voice already there.

Their three velocity layers are the library's own `v2`, `v3` and `v4` groups, and
the thresholds in `pack.json` split `VELOCITIES`'s tom rows exactly: an
off-sixteenth reaches `v2`, an off-eighth `v3`, a quarter-note position `v4`. A
fill's accents therefore change which drum hit is heard, not just how loudly the
same one is replayed.

## ⚠ Clavisynth is labelled two octaves below its sounding pitch

VCSL's `Clavisynth_C2_vl2.wav` sounds at **C4**, not C2. This was measured, not assumed:
there is no spectral energy at all at the named frequency, and the fundamental sits
consistently 24 semitones above the filename across every note and octave sampled. FM
Piano, by contrast, is labelled correctly.

`pack.json` therefore declares `midi` values that are the **sounding** pitch — the
filename plus 24 for every `comp` entry. Do not "correct" them to match the filenames;
every comp chord would move two octaves and the game would be unplayable.

## Note spacing

Both pitched voices are sampled every 4 semitones (C, E, G♯ per octave), so the renderer
never shifts a sample by more than **2 semitones** — the bound that keeps linear
interpolation transparent.

- `bass` sounding MIDI 24–48, covering 22–50
- `comp` sounding MIDI 48–84, covering 46–86
