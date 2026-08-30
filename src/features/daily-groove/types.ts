/**
 * The feature's gameplay and persistence types.
 *
 * `Root`, `Flavour` and `Groove` are no longer declared here: they are the
 * contract the groove generator shares with the app, so Epic 4 moved them to
 * `src/lib/groove.ts`, which `scripts/` can reach without the `@/` alias. They
 * are re-exported below so the feature's own modules keep importing everything
 * they need from `'../types'`.
 *
 * What remains is what the generator has never heard of: one day's answer, the
 * attempts spent on it, and the record that survives a reload.
 */
export type { Flavour, Groove, Root } from '@/lib/groove'

import type { Flavour, Root } from '@/lib/groove'

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
  /**
   * The day was given up on: the answer was revealed without being found.
   * Optional, and absent rather than `false` on a day that was not — records
   * written before feature-7 have no such field, and must keep loading.
   */
  revealed?: boolean
}
