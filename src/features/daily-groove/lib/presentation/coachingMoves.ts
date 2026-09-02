import type { Move } from './moves'

export type { Move }

export const COLOUR_MOVES: readonly Move[] = [
  {
    message:
      'Tap the Mode chips you have not tried and let each lick run over the loop: the one that belongs lands on the same third the first chord is playing.',
    soundsOff:
      'Sing up from the bass note step by step while the loop runs and mark the one step that rubs against the chords — that note is what tells the choices apart.',
  },
  {
    message:
      'Now the seventh. Sing down from the octave into the first chord: a tight half step in leans and pulls, a whole step in sits open and easy.',
  },
]

export const TONIC_MOVES: readonly Move[] = [
  {
    message:
      'Hum the note the bass lands on with the very first beat, then tap along the Root row until a chip sounds the note you are humming.',
    soundsOff:
      'Catch the bass note under the very first beat and find it on your instrument — the fret or the key you land on names it for you.',
  },
  {
    message:
      'Sing one note and hold it through all four bars. The wrong pick fights one of the chords on the way; the one you want leans against them but never grates.',
  },
]

export const SIMPLE_COLOUR_MOVES: readonly Move[] = [
  {
    message:
      'Tap one Mode chip, then the other, and let each lick run over the loop. Only one of them lands on the same third the chord underneath is already playing.',
    soundsOff:
      'Play the bass note on your instrument, then feel for the third above it: two candidates sit a half step apart, and the loop only accepts one.',
  },
  {
    message:
      'Sing the third over the first chord, then push it a half step each way. One side lifts and brightens, the other drops and darkens — only one fits.',
  },
]
