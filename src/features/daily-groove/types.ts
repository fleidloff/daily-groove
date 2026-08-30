/** The twelve chromatic roots, in the design's order. */
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

/**
 * A scale flavour as displayed, e.g. 'Dorian'. A plain string rather than a
 * union: the pool is derived from the seed data at runtime, so a union would
 * have to be regenerated whenever a groove is added.
 */
export type Flavour = string

/** The day's answer, or one guess at it: a root paired with a flavour. */
export type Answer = { root: Root; flavour: Flavour }

/** One checked pair, scored. */
export type Attempt = {
  root: Root
  flavour: Flavour
  correct: boolean
  rootMatched: boolean
  flavourMatched: boolean
}

export type Groove = {
  id: string
  audioSrc: string // URL under /grooves, e.g. "/grooves/groove-01.mp3"
  name: string // display name shown on the groove card, e.g. "Sunroom Shuffle"
  bpm: number // display only; does not drive playback or the progress bar
  scale: string // absolute, e.g. "C minor"
  chord: string // absolute, e.g. "Dmaj7"
  progression: string // absolute, e.g. "Dm–G–C"
  /**
   * The answer, carried as its own fields rather than parsed back out of
   * `scale`. The generator knows both because it rendered them, and a parsed
   * string is a second source of truth waiting to disagree with the first.
   */
  root: Root
  flavour: Flavour
  bars: number // loop length, always 4
}

/** One day's play: the answer, the attempts spent on it, and how it ended. */
export type DailyResult = {
  date: string // ISO date "YYYY-MM-DD"
  /** The day's correct pair, stored so a missed day can still show its answer. */
  answer: Answer
  /** The day's scored pairs, in the order they were checked. */
  attempts: Attempt[]
  /** Whether the day was solved. */
  solved: boolean
  /**
   * The id of the groove this day played. Optional: records saved before
   * feature-4 have none, and resolve their groove by date instead.
   */
  grooveId?: string
}
