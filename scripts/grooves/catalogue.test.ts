import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { Flavour } from './types.ts'

const specs = readCatalogue()
const built = specs.map((spec) => ({ spec, ...buildEvents(spec, templateById(spec.template)) }))

describe('the committed catalogue', () => {
  it('holds sixteen grooves, four per template', () => {
    expect(specs).toHaveLength(16)
    for (const template of allTemplates()) {
      expect(specs.filter((s) => s.template === template.id), template.id).toHaveLength(4)
    }
  })

  it('gives every groove a unique, well-formed id and a unique seed', () => {
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length)
    expect(new Set(specs.map((s) => s.seed)).size).toBe(specs.length)
    for (const s of specs) expect(s.id).toMatch(/^groove-\d{2}$/)
  })

  it('names only templates that exist', () => {
    for (const s of specs) expect(() => templateById(s.template)).not.toThrow()
  })

  it('puts exactly two grooves behind every flavour the game offers', () => {
    const counts = new Map<Flavour, number>()
    for (const { music } of built) counts.set(music.flavour, (counts.get(music.flavour) ?? 0) + 1)
    const offered = new Set(allTemplates().flatMap((t) => t.flavours))
    expect(new Set(counts.keys()), 'a flavour the game offers has no groove').toEqual(offered)
    for (const [flavour, n] of counts) expect(n, flavour).toBe(2)
  })

  it('asks a different question every time — no repeated root and flavour', () => {
    const answers = built.map(({ music }) => `${music.root}|${music.flavour}`)
    expect(new Set(answers).size).toBe(built.length)
  })

  it('never repeats a scale-and-progression pair', () => {
    const pairs = built.map(({ music }) => `${music.scale}|${music.progression}`)
    expect(new Set(pairs).size).toBe(built.length)
  })

  // Step I1 — validity is per flavour, so this must go through the rule table
  // rather than scanning for strict scale membership, or blues fails its own check.
  it('plays harmony its flavour’s rule allows, for every entry', () => {
    for (const { spec, music, harmony } of built) {
      expect(isValidHarmony(music, harmony), `${spec.id} — ${music.scale} ${music.progression}`).toBe(
        true,
      )
    }
  })

  it('spreads grooves across keys and tempos rather than clustering', () => {
    expect(new Set(built.map((b) => b.music.root)).size).toBeGreaterThanOrEqual(8)
    const tempos = built.map((b) => b.music.bpm)
    expect(Math.max(...tempos) - Math.min(...tempos)).toBeGreaterThanOrEqual(40)
  })

  it('matches what selectSeeds would produce, so the committed file is not hand-edited', async () => {
    const { selectSeeds } = await import('./select.ts')
    expect(specs).toEqual(selectSeeds(allTemplates(), { perTemplate: 4 }))
  })
})
