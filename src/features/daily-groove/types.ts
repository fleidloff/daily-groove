export type { Flavour, Groove, Root } from '@/lib/groove'

import type { Flavour, Root } from '@/lib/groove'

export type Answer = { root: Root; flavour: Flavour }

export type Attempt = {
  root: Root
  flavour: Flavour
  correct: boolean
  rootMatched: boolean
  flavourMatched: boolean
}

export type DailyResult = {
  date: string
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  grooveId?: string
  revealed?: boolean
}
