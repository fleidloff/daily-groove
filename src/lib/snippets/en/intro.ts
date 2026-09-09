import type { IntroSnippets } from '../types'

export const intro = {
  title: 'How to play',
  closeName: 'Close how to play',
  steps: [
    { words: 'Listen to the groove ', mark: '🎧' },
    { words: 'Jam along ', mark: '🎸' },
    { words: 'Guess the Root & Mode ', mark: '🎯' },
    { words: 'Come back every day for a new challenge ', mark: '⏭' },
  ],
  twoWays:
    'Two ways to play: Simple mode is six roots, Major or Minor. Switch it off for all roots and six named modes.',
  transpose:
    "Play a sax or a trumpet? Pick your key beside Transpose in the top row and the roots, chords and notes read in your instrument's pitch.",
} satisfies IntroSnippets
