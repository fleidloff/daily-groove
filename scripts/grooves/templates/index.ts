import type { FeelTemplate } from '../types.ts'
import { straightFunk } from './straight-funk.ts'
import { shuffle } from './shuffle.ts'
import { brightStraight } from './bright-straight.ts'
import { halfTime } from './half-time.ts'
import { openBallad } from './open-ballad.ts'
import { swungSixteenth } from './swung-sixteenth.ts'

export const TEMPLATES: Record<string, FeelTemplate> = {
  [straightFunk.id]: straightFunk,
  [shuffle.id]: shuffle,
  [brightStraight.id]: brightStraight,
  [halfTime.id]: halfTime,
  [openBallad.id]: openBallad,
  [swungSixteenth.id]: swungSixteenth,
}

export function templateById(id: string): FeelTemplate {
  const template = TEMPLATES[id]
  if (!template) {
    throw new Error(`templateById: unknown template "${id}"`)
  }
  return template
}

export function allTemplates(): FeelTemplate[] {
  return Object.values(TEMPLATES)
}

export { straightFunk, shuffle, brightStraight, halfTime, openBallad, swungSixteenth }
