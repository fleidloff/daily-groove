import { buildEvents } from './events.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { FeelTemplate, Flavour, GrooveSpec } from './types.ts'

export type SelectOptions = {
  perTemplate: number
  startSeed?: number
  existing?: readonly GrooveSpec[]
  maxAttemptsPerTemplate?: number
}

const DEFAULT_MAX_ATTEMPTS = 4000

function idFor(n: number): string {
  return `groove-${String(n).padStart(2, '0')}`
}

function highestNumber(specs: readonly GrooveSpec[]): number {
  let max = 0
  for (const spec of specs) {
    const match = /^groove-(\d+)$/.exec(spec.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max
}

export function selectSeeds(
  templates: readonly FeelTemplate[],
  options: SelectOptions,
): GrooveSpec[] {
  const { perTemplate, startSeed = 1, existing = [] } = options
  const maxAttempts = options.maxAttemptsPerTemplate ?? DEFAULT_MAX_ATTEMPTS

  const usedSeeds = new Set(existing.map((s) => s.seed))
  const usedPairs = new Set<string>()
  const usedAnswers = new Set<string>()
  const flavourCounts = new Map<Flavour, number>()

  for (const spec of existing) {
    const template = templates.find((t) => t.id === spec.template)
    if (!template) continue
    const { music } = buildEvents(spec, template)
    usedPairs.add(`${music.scale}|${music.progression}`)
    usedAnswers.add(`${music.root}|${music.flavour}`)
    flavourCounts.set(music.flavour, (flavourCounts.get(music.flavour) ?? 0) + 1)
  }

  let nextNumber = highestNumber(existing)
  const accepted: GrooveSpec[] = []

  for (const template of templates) {
    const scarcity = (flavour: Flavour) => flavourCounts.get(flavour) ?? 0
    const byScarcity = [...template.flavours].sort((a, b) => scarcity(a) - scarcity(b))

    const quota = new Map<Flavour, number>()
    const share = Math.floor(perTemplate / template.flavours.length)
    for (const flavour of template.flavours) quota.set(flavour, share)
    let spare = perTemplate - share * template.flavours.length
    for (const flavour of byScarcity) {
      if (spare <= 0) break
      quota.set(flavour, (quota.get(flavour) ?? 0) + 1)
      spare -= 1
    }

    let takenHere = 0
    let seed = startSeed
    let attempts = 0

    while (takenHere < perTemplate) {
      if (attempts++ >= maxAttempts) {
        throw new Error(
          `selectSeeds: could not find ${perTemplate} acceptable grooves for template ` +
            `"${template.id}" within ${maxAttempts} seeds`,
        )
      }
      const candidateSeed = seed++
      if (usedSeeds.has(candidateSeed)) continue

      const candidate: GrooveSpec = {
        id: idFor(nextNumber + 1),
        uuid: '',
        template: template.id,
        seed: candidateSeed,
      }
      const { music, harmony } = buildEvents(candidate, template)

      if (!isValidHarmony(music, harmony)) continue

      const pair = `${music.scale}|${music.progression}`
      if (usedPairs.has(pair)) continue

      const answer = `${music.root}|${music.flavour}`
      if (usedAnswers.has(answer)) continue

      const remaining = quota.get(music.flavour) ?? 0
      if (remaining <= 0) {
        if (spare <= 0) continue
        spare -= 1
      } else {
        quota.set(music.flavour, remaining - 1)
      }

      usedSeeds.add(candidateSeed)
      usedPairs.add(pair)
      usedAnswers.add(answer)
      flavourCounts.set(music.flavour, (flavourCounts.get(music.flavour) ?? 0) + 1)
      nextNumber += 1
      accepted.push(candidate)
      takenHere += 1
    }
  }

  return accepted
}
