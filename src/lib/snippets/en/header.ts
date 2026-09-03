import type { HeaderSnippets } from '../types'

export const header = {
  helpToggleName: 'How to play',
  currentStreakName: 'Current streak',
  noStreakYet: 'No streak yet',
  streakDays: ({ days }) => `${days} day${days === 1 ? '' : 's'} streak`,
  share: 'Share',
  linkCopied: 'Link copied',
} satisfies HeaderSnippets
