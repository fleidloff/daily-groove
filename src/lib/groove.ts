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
