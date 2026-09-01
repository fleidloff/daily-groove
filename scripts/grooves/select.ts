import { buildEvents } from './events.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { FeelTemplate, Flavour, GrooveSpec } from './types.ts'

export type SelectOptions = {
  /** How many grooves to accept per template. */
  perTemplate: number
  /** First seed to try. Epic 4 continues from a higher one. */
  startSeed?: number
  /** Already-minted specs. Never re-used, never re-numbered. */
  existing?: readonly GrooveSpec[]
  /** Give up rather than loop forever on a template that cannot satisfy the constraints. */
  maxAttemptsPerTemplate?: number
}

const DEFAULT_MAX_ATTEMPTS = 4000

function idFor(n: number): string {
  return `groove-${String(n).padStart(2, '0')}`
}

/** The highest groove number already used, so ids are never re-issued. */
function highestNumber(specs: readonly GrooveSpec[]): number {
  let max = 0
  for (const spec of specs) {
    const match = /^groove-(\d+)$/.exec(spec.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max
}

/**
 * Walk seeds in order and keep the ones that make the catalogue better.
 *
 * A seed is accepted only when its groove is musically valid AND it fills a gap
 * the catalogue still has — an uncovered flavour for its template, and a
 * scale-and-progression pair nobody else uses. Flavour draws are uniform, so
 * without the coverage constraint four seeds on a two-flavour template routinely
 * land 3–1 or 4–0; this is what makes every flavour come out evenly represented.
 *
 * Deterministic given the same arguments, and resumable: pass `existing` and a
 * higher `startSeed` and it continues where the catalogue left off. Epic 4's
 * minting calls exactly this, so the first sixteen grooves and the ten-thousandth
 * addition pass the same test.
 */
export function selectSeeds(
  templates: readonly FeelTemplate[],
  options: SelectOptions,
): GrooveSpec[] {
  const { perTemplate, startSeed = 1, existing = [] } = options
  const maxAttempts = options.maxAttemptsPerTemplate ?? DEFAULT_MAX_ATTEMPTS

  const usedSeeds = new Set(existing.map((s) => s.seed))
  const usedPairs = new Set<string>()
  // The answer the player is asked for. Two grooves with the same root and
  // flavour are the same puzzle twice, however different they sound.
  const usedAnswers = new Set<string>()
  const flavourCounts = new Map<Flavour, number>()

  // Whatever already exists counts toward coverage, so a resumed run balances
  // against the catalogue rather than against its own batch alone.
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
    // Spread this template's allocation evenly across the flavours it offers,
    // starting from the flavour the *catalogue* has least of.
    //
    // The share alone is not enough, and was silently inert for the commonest
    // batch there is: `grooves:add 6` over six templates allocates one each, and
    // `floor(1 / 2)` is zero, so every flavour began over quota and the first
    // valid candidate won regardless of which one it was. A template could go
    // three mints running without its second flavour ever being drawn — which is
    // exactly what happened to `shuffle`'s blues.
    //
    // Seeding the quota by scarcity fixes it at any batch size: the flavour with
    // fewer grooves behind it is asked for first, and only once it has had its
    // turn does the other become eligible through `spare`.
    const scarcity = (flavour: Flavour) => flavourCounts.get(flavour) ?? 0
    const byScarcity = [...template.flavours].sort((a, b) => scarcity(a) - scarcity(b))

    const quota = new Map<Flavour, number>()
    const share = Math.floor(perTemplate / template.flavours.length)
    for (const flavour of template.flavours) quota.set(flavour, share)
    let spare = perTemplate - share * template.flavours.length
    // Hand the remainder to the scarcest flavours rather than to whichever the
    // seed stream happens to offer first.
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
        // Deliberately empty. Minting a uuid belongs to `addGrooves`, at the
        // moment it accepts a candidate: this function is deterministic — the
        // same arguments must give the same specs, and `select.test.ts` asserts
        // it — so a fresh uuid in here would end that (F12 E1 R7).
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
        // Only take an over-quota flavour once every flavour has had its share.
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
