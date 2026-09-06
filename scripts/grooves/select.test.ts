import { describe, expect, it } from 'vitest'
import { buildEvents } from './events.ts'
import { selectSeeds } from './select.ts'
import { allTemplates, templateById } from './templates/index.ts'
import type { FeelTemplate, Flavour, GrooveSpec } from './types.ts'
import { isValidHarmony } from './theory/validity.ts'

const musicOf = (spec: GrooveSpec) => buildEvents(spec, templateById(spec.template)).music

// selectSeeds is handed the list it should select over, so a synthetic seventh feel
// is not in the registry and cannot be looked up by id.
function flavoursByTemplate(
  specs: readonly GrooveSpec[],
  templates: readonly FeelTemplate[],
): Map<string, Flavour[]> {
  const drawn = new Map<string, Flavour[]>()
  for (const spec of specs) {
    const template = templates.find((t) => t.id === spec.template)
    if (!template) throw new Error(`no template for ${spec.id}: ${spec.template}`)
    const { flavour } = buildEvents(spec, template).music
    drawn.set(spec.template, [...(drawn.get(spec.template) ?? []), flavour])
  }
  return drawn
}

function expectEvenSpread(
  templates: readonly FeelTemplate[],
  perTemplate: number,
  specs: readonly GrooveSpec[],
): void {
  const drawn = flavoursByTemplate(specs, templates)
  const reached = new Set<Flavour>()

  for (const template of templates) {
    const mine = drawn.get(template.id) ?? []
    expect(mine, template.id).toHaveLength(perTemplate)
    const k = template.flavours.length
    const floor = Math.floor(perTemplate / k)
    const ceil = Math.ceil(perTemplate / k)
    for (const flavour of template.flavours) {
      const n = mine.filter((f) => f === flavour).length
      expect(n, `${template.id} draws ${flavour} ${n} times, not ${floor}-${ceil}`)
        .toBeGreaterThanOrEqual(floor)
      expect(n, `${template.id} draws ${flavour} ${n} times, not ${floor}-${ceil}`)
        .toBeLessThanOrEqual(ceil)
      reached.add(flavour)
    }
    for (const flavour of mine) {
      expect(template.flavours, `${template.id} drew ${flavour}, which it does not offer`)
        .toContain(flavour)
    }
  }

  const offered = new Set(templates.flatMap((t) => t.flavours))
  for (const flavour of offered) {
    expect(reached, `${flavour} is offered but no selected spec answers to it`).toContain(
      flavour,
    )
  }
}

describe('selectSeeds', () => {
  it('accepts the asked-for number per template', () => {
    const specs = selectSeeds(allTemplates(), { perTemplate: 4 })
    expect(specs).toHaveLength(allTemplates().length * 4)
    for (const template of allTemplates()) {
      expect(specs.filter((s) => s.template === template.id)).toHaveLength(4)
    }
  })

  // feature-25 R7, R9: the spread is even inside a template's own quota, not across
  // the catalogue. Six pairs made those the same number; two-to-four with overlap
  // does not.
  it('reaches every flavour it offers, and splits each template’s quota as evenly as its list allows', () => {
    const templates = allTemplates()
    const specs = selectSeeds(templates, { perTemplate: 4 })
    expectEvenSpread(templates, 4, specs)
  })

  it('splits a four-flavour template’s quota one apiece, sharing a mode with a sixth', () => {
    const fourMode: FeelTemplate = {
      ...templateById('bright-straight'),
      id: 'synth-four',
      flavours: ['ionian', 'lydian', 'dorian', 'melodic-minor'] as Flavour[],
    }
    const templates = [...allTemplates(), fourMode]
    const specs = selectSeeds(templates, { perTemplate: 4 })
    expectEvenSpread(templates, 4, specs)

    const mine = flavoursByTemplate(specs, templates).get('synth-four') ?? []
    expect([...mine].sort()).toEqual(['dorian', 'ionian', 'lydian', 'melodic-minor'])
  })

  it('splits a three-flavour template’s four into 2-1-1', () => {
    const threeMode: FeelTemplate = {
      ...templateById('bright-straight'),
      id: 'synth-three',
      flavours: ['ionian', 'lydian', 'dorian'] as Flavour[],
    }
    const templates = [...allTemplates(), threeMode]
    const specs = selectSeeds(templates, { perTemplate: 4 })
    expectEvenSpread(templates, 4, specs)

    const mine = flavoursByTemplate(specs, templates).get('synth-three') ?? []
    const counts = threeMode.flavours.map((f) => mine.filter((x) => x === f).length).sort()
    expect(counts).toEqual([1, 1, 2])
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
