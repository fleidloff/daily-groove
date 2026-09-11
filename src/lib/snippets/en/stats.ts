import type { StatsSnippets } from '../types'

export const stats = {
  title: 'Your stats',
  subtitle: 'Everything you’ve played in this browser.',
  back: '← Today’s groove',
  playedLabel: 'Puzzles played',
  playedUnit: 'grooves total',
  streak: 'current streak',
  attemptsLabel: 'How many guesses it took',
  last7: 'Last 7 days',
  all: 'All data',
  noteAll: 'All the grooves you’ve played.',
  noteLast7: 'The grooves you played in the last 7 days.',
  solved: 'solved',
  revealed: 'revealed',
  failed: 'Couldn’t work out your stats just now.',
  retry: 'Try again',
  empty: 'Nothing to count yet.',
  emptyHint: 'Play today’s groove and this page starts filling in.',
  dayOneSolved: ({ guesses }) => `One puzzle so far, solved in ${guesses}.`,
  dayOneRevealed: 'One puzzle so far, revealed.',
} satisfies StatsSnippets
