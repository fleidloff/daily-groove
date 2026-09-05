import type { HeaderSnippets } from '../types'

const currentStreakName = 'Current streak'

export const header = {
  helpToggleName: 'How to play',
  currentStreakName,
  streakName: ({ days }) =>
    `${currentStreakName}: ${days} day${days === 1 ? '' : 's'}`,
  streakCount: ({ days }) => `${days}`,
  share: 'Share',
  linkCopied: 'Link copied',
  transpose: 'Transpose',
  instruments: {
    C: 'C · concert',
    'B♭': 'B♭ · trumpet, tenor sax',
    'E♭': 'E♭ · alto sax',
    F: 'F · horn',
  },
} satisfies HeaderSnippets
