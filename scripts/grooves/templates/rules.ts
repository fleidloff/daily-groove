import { FLAVOURS } from '../../../src/lib/theory/names.ts'
import type { FeelTemplate } from '../types.ts'

export const FLAVOURS_MIN = 2
export const FLAVOURS_MAX = 4

export function flavourFailures(templates: readonly FeelTemplate[]): string[] {
  const offered = new Set<string>(FLAVOURS)
  const failures: string[] = []

  for (const template of templates) {
    const flavours = template.flavours

    if (flavours.length < FLAVOURS_MIN) {
      failures.push(
        `${template.id}: declares ${flavours.length} flavour(s); the floor is ${FLAVOURS_MIN}`,
      )
    }
    if (flavours.length > FLAVOURS_MAX) {
      failures.push(
        `${template.id}: declares ${flavours.length} flavour(s); the ceiling is ${FLAVOURS_MAX}`,
      )
    }

    const seen = new Set<string>()
    for (const flavour of flavours) {
      if (seen.has(flavour)) {
        failures.push(`${template.id}: declares "${flavour}" more than once`)
      }
      seen.add(flavour)
      if (!offered.has(flavour)) {
        failures.push(`${template.id}: declares "${flavour}", which FLAVOURS does not name`)
      }
    }
  }

  return failures
}
