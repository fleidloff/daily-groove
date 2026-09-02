import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { Flavour, GrooveSpec } from './types.ts'

const specs = readCatalogue()
const built = specs.map((spec) => ({ spec, ...buildEvents(spec, templateById(spec.template)) }))

function numberOf(id: string): number {
  const match = /^groove-(\d+)$/.exec(id)
  if (!match) throw new Error(`not a groove id: ${id}`)
  return Number(match[1])
}

const RETIRED = ['groove-05', 'groove-06', 'groove-15', 'groove-16']

describe('the committed catalogue', () => {
  it('draws grooves from every template', () => {
    expect(specs.length).toBeGreaterThanOrEqual(18)
    for (const template of allTemplates()) {
      expect(
        specs.filter((s) => s.template === template.id).length,
        template.id,
      ).toBeGreaterThan(0)
    }
  })

  it('gives every groove a unique, well-formed id and a unique seed', () => {
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length)
    expect(new Set(specs.map((s) => s.seed)).size).toBe(specs.length)
    for (const s of specs) expect(s.id).toMatch(/^groove-\d{2}$/)
  })

  it('never re-issues an id', () => {
    const numbers = specs.map((s) => numberOf(s.id))
    expect(new Set(numbers).size, 'an id was issued twice').toBe(numbers.length)
    expect(Math.max(...numbers)).toBeGreaterThan(specs.length)
    for (const id of RETIRED) {
      expect(specs.map((s) => s.id), `${id} came back`).not.toContain(id)
    }
  })

  it('no longer carries the four retired grooves', () => {
    for (const id of RETIRED) {
      expect(specs.map((s) => s.id), id).not.toContain(id)
    }
  })

  it('names only templates that exist', () => {
    for (const s of specs) expect(() => templateById(s.template)).not.toThrow()
  })

  it('puts grooves behind every mode its templates offer', () => {
    const counts = new Map<Flavour, number>()
    for (const { music } of built) counts.set(music.flavour, (counts.get(music.flavour) ?? 0) + 1)

    const offered = new Set(allTemplates().flatMap((t) => t.flavours))
    for (const flavour of offered) {
      expect(counts.get(flavour) ?? 0, `${flavour} has no groove behind it`).toBeGreaterThan(0)
    }
    for (const flavour of counts.keys()) {
      expect(offered, `${flavour} is not offered by any template`).toContain(flavour)
    }
  })

  it('lets no mode dominate the answers', () => {
    const counts = new Map<Flavour, number>()
    for (const { music } of built) counts.set(music.flavour, (counts.get(music.flavour) ?? 0) + 1)
    const n = [...counts.values()]
    expect(Math.max(...n), 'one mode carries more than three times the least').toBeLessThanOrEqual(
      Math.min(...n) * 3,
    )
  })

  it('asks a different question every time — no repeated root and flavour', () => {
    const answers = built.map(({ music }) => `${music.root}|${music.flavour}`)
    expect(new Set(answers).size).toBe(built.length)
  })

  it('never repeats a scale-and-progression pair', () => {
    const pairs = built.map(({ music }) => `${music.scale}|${music.progression}`)
    expect(new Set(pairs).size).toBe(built.length)
  })

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

  it('leaves every first-generation survivor exactly as selectSeeds produced it', async () => {
    const { selectSeeds } = await import('./select.ts')
    const original = selectSeeds(
      allTemplates().slice(0, 4),
      { perTemplate: 4 },
    )
    expect(original).toHaveLength(16)

    const survivors = specs.filter((s) => numberOf(s.id) <= 16)
    expect(survivors).toHaveLength(16 - RETIRED.length)
    const identity = (s: GrooveSpec) => ({ id: s.id, template: s.template, seed: s.seed })
    expect(survivors.map(identity)).toEqual(
      original.filter((s) => !RETIRED.includes(s.id)).map(identity),
    )
  })

  it('lists the grooves in issue order', () => {
    const numbers = specs.map((s) => numberOf(s.id))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
  })
})
