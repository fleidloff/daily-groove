export type BrandingSnippets = {
  appName: string
  tagline: string
}

export type HeaderSnippets = {
  helpToggleName: string
  currentStreakName: string
  noStreakYet: string
  streakDays: (args: { days: number }) => string
  share: string
  linkCopied: string
}

export type IntroStep = { words: string; mark: string }

export type IntroSnippets = {
  title: string
  closeName: string
  steps: readonly [IntroStep, IntroStep, IntroStep, IntroStep]
  twoWays: string
}

export type PuzzleSnippets = {
  loading: string
  audioError: string
  audioRetry: string
  playText: { play: string; stop: string; loading: string }
  playName: { play: string; stop: string }
  guessTitle: string
  rootGroup: string
  modeGroup: string
  giveUp: string
  giveUpArmed: string
  hint: string
  ruledOut: (args: { roots: number }) => string
  simpleMode: string
  simpleModeOn: string
  simpleModeOff: string
  tapSounds: string
  drumCredit: string
  sharedNotice: string
  backToToday: string
  playTodayIntro: string
  playTodayOutro: string
  bpm: (args: { bpm: number }) => string
  sharedGroove: string
}

export type CoachingMove = { message: string; soundsOff?: string }

export type CoachingSnippets = {
  opening: string
  solved: string
  rootMatched: string
  flavourMatched: string
  neitherMatched: string
  ladder: readonly [CoachingMove, CoachingMove, CoachingMove, CoachingMove]
  colour: readonly [CoachingMove, CoachingMove]
  tonic: readonly [CoachingMove, CoachingMove]
  simpleColour: readonly [CoachingMove, CoachingMove]
  nearMissColourRight: (args: { flavour: string }) => string
  nearMissFar: (args: { flavour: string }) => string
  nearMissApart: (args: {
    flavour: string
    notes: 1 | 2
    guessed: string
    answered: string
  }) => string
  checkSolved: string
  checkRevealed: string
  checkPair: (args: { root: string; flavour: string }) => string
  pickMode: string
  pickRoot: string
  pickRootAndMode: string
}

export type SolvedSnippets = {
  changes: string
  notesToLiveIn: string
  modeLine: (args: { flavour: string }) => string | undefined
}

export type RoutesSnippets = {
  notFoundTitle: string
  notFoundBody: string
  playTodayLink: string
  redirecting: string
}
