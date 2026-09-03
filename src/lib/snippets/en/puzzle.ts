import type { PuzzleSnippets } from '../types'

export const puzzle = {
  loading: "Loading today's groove…",
  captionSoundsOn:
    'Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.',
  captionSoundsOff:
    'Find the note that feels like home — Play along with your instrument.',
  audioError: "Couldn't play the groove.",
  audioRetry: 'Retry',
  playText: { play: 'Play the groove', stop: 'Stop', loading: 'Loading…' },
  playName: { play: 'Play the loop', stop: 'Stop the loop' },
  guessTitle: 'What is it?',
  rootGroup: 'Root',
  modeGroup: 'Mode',
  giveUp: 'Give up and show the answer',
  giveUpArmed: 'Yes — end the day and show the answer',
  hint: 'Hint',
  ruledOut: ({ roots }) => `${roots} roots ruled out. Narrowing as you go.`,
  simpleMode: 'Simple mode',
  tapSounds: 'Tap sounds',
  sharedNotice:
    "This is a shared groove, not today's puzzle. Playing it won't change your streak, and it won't use up your day.",
  backToToday: "Back to today's puzzle",
  playTodayIntro: 'That was a shared groove.',
  playTodayOutro: ' — your own streak is waiting.',
  bpm: ({ bpm }) => `${bpm} bpm`,
  sharedGroove: 'shared groove',
} satisfies PuzzleSnippets
