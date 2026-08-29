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

## Voice mapping

| Voice | VCSL instrument | Layers × round-robins |
| :-- | :-- | :-- |
| `kick` | Cajon, bass tone (`hit1`) | 3 × 2 |
| `snare` | Snare Drum, Modern 1 (`HitNS`) | 4 × 2 |
| `hatClosed` | Hi-Hat Cymbal (`HitC`) | 4 × 2 |
| `hatOpen` | Hi-Hat Cymbal (`HitO`, `HitLoose`) | 1 × 4 |
| `rim` | Woodblock | 2 × 3 |
| `bass` | TX81Z FM Piano | 7 notes × 3 |
| `comp` | TX81Z Clavisynth | 10 notes × 3 |

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
