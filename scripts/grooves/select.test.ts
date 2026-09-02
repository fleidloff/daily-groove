import { describe, expect, it } from 'vitest'
import { buildEvents } from './events.ts'
import { selectSeeds } from './select.ts'
import { allTemplates, templateById } from './templates/index.ts'
import type { Flavour, GrooveSpec } from './types.ts'
import { isValidHarmony } from './theory/validity.ts'

const musicOf = (spec: GrooveSpec) => buildEvents(spec, templateById(spec.template)).music

describe('selectSeeds', () => {
  it('accepts the asked-for number per template', () => {
    const specs = selectSeeds(allTemplates(), { perTemplate: 4 })
    expect(specs).toHaveLength(allTemplates().length * 4)
    for (const template of allTemplates()) {
      expect(specs.filter((s) => s.template === template.id)).toHaveLength(4)
    }
  })

  it('covers every flavour the game offers, evenly', () => {
    const specs = selectSeeds(allTemplates(), { perTemplate: 4 })
    const counts = new Map<Flavour, number>()
    for (const spec of specs) {
      const f = musicOf(spec).flavour
      counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    const offered = allTemplates().flatMap((t) => t.flavours)
    expect(new Set(counts.keys())).toEqual(new Set(offered))
    for (const [flavour, n] of counts) expect(n, flavour).toBe(2)
  })

  it('never repeats an answer — root and flavour are unique across the catalogue', () => {
    const specs = selectSeeds(allTemplates(), { perTemplate: 4 })
    const answers = specs.map((s) => {
      const m = musicOf(s)
      return `${m.root}|${m.flavour}`
    })
    expect(new Set(answers).size).toBe(specs.length)
  })

  it('never repeats a scale-and-progression pair', () => {
    const specs = selectSeeds(allTemplates(), { perTemplate: 4 })
    const pairs = specs.map((s) => {
      const m = musicOf(s)
      return `${m.scale}|${m.progression}`
    })
    expect(new Set(pairs).size).toBe(specs.length)
  })

  it('only accepts harmony its flavour’s rule allows', () => {
    for (const spec of selectSeeds(allTemplates(), { perTemplate: 4 })) {
      const { music, harmony } = buildEvents(spec, templateById(spec.template))
      expect(isValidHarmony(music, harmony), `${spec.id} ${music.scale}`).toBe(true)
    }
  })

  it('gives every groove a unique id and a unique seed', () => {
    const specs = selectSeeds(allTemplates(), { perTemplate: 4 })
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length)
    expect(new Set(specs.map((s) => s.seed)).size).toBe(specs.length)
    for (const s of specs) expect(s.id).toMatch(/^groove-\d{2}$/)
  })

  it('is deterministic — the same arguments give the same specs', () => {
    expect(selectSeeds(allTemplates(), { perTemplate: 2 })).toEqual(
      selectSeeds(allTemplates(), { perTemplate: 2 }),
    )
  })

  it('resumes from an existing catalogue without colliding or renumbering', () => {
    const first = selectSeeds(allTemplates(), { perTemplate: 2 })
    const more = selectSeeds(allTemplates(), {
      perTemplate: 1,
      startSeed: 500,
      existing: first,
    })
    const firstIds = new Set(first.map((s) => s.id))
    const firstSeeds = new Set(first.map((s) => s.seed))
    for (const spec of more) {
      expect(firstIds.has(spec.id), `${spec.id} was re-issued`).toBe(false)
      expect(firstSeeds.has(spec.seed), `seed ${spec.seed} was re-used`).toBe(false)
    }
    const highest = Math.max(...first.map((s) => Number(s.id.slice(-2))))
    expect(Number(more[0].id.slice(-2))).toBe(highest + 1)
  })

  it('fails loudly rather than looping when a template cannot satisfy the constraints', () => {
    expect(() =>
      selectSeeds(allTemplates().slice(0, 1), { perTemplate: 4, maxAttemptsPerTemplate: 1 }),
    ).toThrow(/could not find/)
  })
})
