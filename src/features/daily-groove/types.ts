export type Attribute = 'scale' | 'chord' | 'progression'

export type Groove = {
  id: string
  audioSrc: string // URL under /grooves, e.g. "/grooves/groove-01.mp3"
  scale: string // absolute, e.g. "C minor"
  chord: string // absolute, e.g. "Dmaj7"
  progression: string // absolute, e.g. "Dm–G–C"
}

export type DailyResult = {
  date: string // ISO date "YYYY-MM-DD"
  guesses: Partial<Record<Attribute, string>>
  correctness: Partial<Record<Attribute, boolean>>
}
