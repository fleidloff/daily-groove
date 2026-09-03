import type { CoachingSnippets } from '../types'

const opening =
  'Loop it a few times. Sing the note that feels like rest — that’s usually the root.'

export const coaching = {
  opening,
  solved: 'That’s it. The groove is yours now — stay in it as long as you like.',
  rootMatched: 'Right home note, wrong colour.',
  flavourMatched: 'The mode is right. But the tonic is somewhere else.',
  neitherMatched: 'Not it. Keep playing and try again.',

  ladder: [
    { message: opening },
    {
      message:
        'Now listen lower. Hum the bass note on the first beat of each bar — the one at the top of the loop is home, and every pass puts it back.',
    },
    {
      message:
        'Hold that home note steady in your voice and let the loop run under it. The third bar brings a chord neither of the first two played — hear whether it leaves your note at rest or leaves it leaning.',
    },
    {
      message:
        'Tap each mode chip while the loop plays — the ruled-out ones still sound. Listen for the phrase that belongs inside the loop rather than sitting on top of it.',
      soundsOff:
        'Play the loop and find your home note on your instrument, then walk up from it one fret or key at a time. The notes that ring and the notes that scrape are the loop spelling out its colour.',
    },
  ],

  colour: [
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
  ],

  tonic: [
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
  ],

  simpleColour: [
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
  ],

  nearMissColourRight: ({ flavour }) =>
    `You said ${flavour} — the colour was right, not the home note.`,
  nearMissFar: ({ flavour }) =>
    `You said ${flavour} — a long way from this one, not a near miss.`,
  nearMissApart: ({ flavour, notes, guessed, answered }) =>
    `You said ${flavour} — ${notes === 1 ? 'one note' : 'two notes'} apart: ${guessed}, not ${answered}.`,

  checkSolved: 'Solved',
  checkPair: ({ root, flavour }) => `Check ${root} ${flavour}`,
  pickMode: 'Pick a mode',
  pickRoot: 'Pick a root',
  pickRootAndMode: 'Pick a root and a mode',
} satisfies CoachingSnippets
