export type Move = {
  message: string
  soundsOff?: string
}

export const LADDER: readonly [Move, Move, Move, Move] = [
  {
    message:
      'Loop it a few times. Sing the note that feels like rest — that’s usually the root.',
  },
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
]
