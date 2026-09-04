export type Root =
  | 'C'
  | 'C♯'
  | 'D'
  | 'E♭'
  | 'E'
  | 'F'
  | 'F♯'
  | 'G'
  | 'A♭'
  | 'A'
  | 'B♭'
  | 'B'

export type Flavour = string

export type Groove = {
  id: string
  uuid: string
  audioSrc: string
  name: string
  bpm: number
  scale: string
  chord: string
  progression: string
  progressionDegrees?: number[]
  root: Root
  flavour: Flavour
  bars: number
  loopBars?: number
  headDelaySeconds: number
}

export type Answer = { root: Root; flavour: Flavour }

export type Attempt = {
  root: Root
  flavour: Flavour
  correct: boolean
  rootMatched: boolean
  flavourMatched: boolean
}

export type HeardIn = { track: string; artist: string }
