import { describe, expect, it } from 'vitest'
import type { Flavour, VoiceName } from '../types.ts'
import { FLAVOURS } from '../../../src/lib/theory/names.ts'
import { INTERVALS } from '../../../src/lib/theory/scales.ts'
import { TEMPLATES, allTemplates, templateById } from './index.ts'

function halfStepMs(subdivision: number, topBpm: number): number {
  return (((60 / topBpm) * 4) / subdivision) * 500
}

describe('templateById', () => {
  it('returns the straight-funk template', () => {
    const template = templateById('straight-funk')
    expect(template.id).toBe('straight-funk')
    expect(template.subdivision).toBe(16)
  })

  it('has a tempo range inside 90–110', () => {
    const [lo, hi] = templateById('straight-funk').tempoRange
    expect(lo).toBeGreaterThanOrEqual(90)
    expect(hi).toBeLessThanOrEqual(110)
    expect(lo).toBeLessThanOrEqual(hi)
  })

  it('throws on an unknown id rather than returning undefined', () => {
    expect(() => templateById('no-such-template')).toThrow(/no-such-template/)
  })
})

describe('the registry', () => {
  it('lists every template under its own id', () => {
    expect(allTemplates().length).toBeGreaterThan(0)
    for (const template of allTemplates()) {
      expect(TEMPLATES[template.id]).toBe(template)
      expect(templateById(template.id)).toBe(template)
    }
  })
})

const TEMPLATE_COUNT = 6

describe('the template set — R1, AC1', () => {
  it('holds six templates with unique ids', () => {
    const templates = allTemplates()
    expect(templates).toHaveLength(TEMPLATE_COUNT)
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(TEMPLATE_COUNT)
  })

  it('does not give every template the same subdivision, swing or tempo range', () => {
    const templates = allTemplates()
    expect(new Set(templates.map((t) => t.subdivision)).size).toBeGreaterThan(1)
    expect(new Set(templates.map((t) => t.swing)).size).toBe(TEMPLATE_COUNT)
    expect(new Set(templates.map((t) => t.tempoRange.join('-'))).size).toBe(TEMPLATE_COUNT)
  })

  it('gives each template its own mix and its own feel', () => {
    const templates = allTemplates()
    const mixes = templates.map((t) => JSON.stringify([t.gain, t.pan]))
    expect(new Set(mixes).size).toBe(TEMPLATE_COUNT)
    const humanizes = templates.map((t) => JSON.stringify(t.humanize))
    expect(new Set(humanizes).size).toBe(TEMPLATE_COUNT)
  })

  it('does not give every template the same kit', () => {
    const voiceSets = allTemplates().map((t) => [...t.voices].sort().join(','))
    expect(new Set(voiceSets).size).toBeGreaterThan(1)
  })

  it('gives every template both hats', () => {
    for (const template of allTemplates()) {
      expect(template.voices, `${template.id} plays no closed hat`).toContain('hatClosed')
      expect(template.voices, `${template.id} plays no open hat`).toContain('hatOpen')
    }
  })
})

describe('flavour coverage — R2, R5, AC15', () => {
  it('gives every template exactly two flavours', () => {
    for (const template of allTemplates()) {
      expect(template.flavours, template.id).toHaveLength(2)
      expect(new Set(template.flavours).size, template.id).toBe(2)
    }
  })

  it('keeps the pairs pairwise disjoint', () => {
    const templates = allTemplates()
    for (let i = 0; i < templates.length; i++) {
      for (let j = i + 1; j < templates.length; j++) {
        const shared = templates[i].flavours.filter((f) =>
          templates[j].flavours.includes(f),
        )
        expect(shared, `${templates[i].id} vs ${templates[j].id}`).toEqual([])
      }
    }
  })

  it('covers exactly the twelve flavours the game offers', () => {
    const union = allTemplates().flatMap((t) => t.flavours)
    expect(union).toHaveLength(2 * TEMPLATE_COUNT)
    expect(union).toHaveLength(FLAVOURS.length)
    expect([...new Set(union)].sort()).toEqual([...(FLAVOURS as Flavour[])].sort())
  })

  it('renders twelve of the thirteen scales the shared table carries', () => {
    expect(Object.keys(INTERVALS)).toHaveLength(13)
    expect(Object.keys(INTERVALS)).toContain('locrian')
    expect(FLAVOURS).toHaveLength(12)
    expect(FLAVOURS as string[]).not.toContain('locrian')
    expect(allTemplates().flatMap((t) => t.flavours as string[])).not.toContain(
      'locrian',
    )
  })

  it('splits the twelve evenly between the two families', () => {
    const union = allTemplates().flatMap((t) => t.flavours)
    const byThird = { major: [] as Flavour[], minor: [] as Flavour[] }
    for (const flavour of union) {
      const intervals = INTERVALS[flavour]
      const major = intervals.includes(4)
      const minor = intervals.includes(3)
      expect(major !== minor, `${flavour} has no single third to grade it by`).toBe(true)
      byThird[major ? 'major' : 'minor'].push(flavour)
    }
    expect(byThird.major.sort(), 'major-third modes').toHaveLength(TEMPLATE_COUNT)
    expect(byThird.minor.sort(), 'minor-third modes').toHaveLength(TEMPLATE_COUNT)
  })

  it('pairs each flavour with a feel that suits it', () => {
    expect([...templateById('straight-funk').flavours].sort()).toEqual([
      'dorian',
      'mixolydian',
    ])
    expect([...templateById('shuffle').flavours].sort()).toEqual(['aeolian', 'blues'])
    expect([...templateById('bright-straight').flavours].sort()).toEqual([
      'ionian',
      'lydian',
    ])
    expect([...templateById('half-time').flavours].sort()).toEqual([
      'harmonic-minor',
      'phrygian',
    ])
    expect([...templateById('open-ballad').flavours].sort()).toEqual([
      'lydian-dominant',
      'melodic-minor',
    ])
    expect([...templateById('swung-sixteenth').flavours].sort()).toEqual([
      'harmonic-major',
      'phrygian-dominant',
    ])
  })
})

describe('every template', () => {
  it('plays drums, a bass and a comp', () => {
    for (const template of allTemplates()) {
      for (const voice of ['kick', 'snare', 'hatClosed', 'bass', 'comp'] as VoiceName[]) {
        expect(template.voices, template.id).toContain(voice)
      }
      expect(new Set(template.voices).size, template.id).toBe(template.voices.length)
    }
  })

  it('declares a feel: some swing, and a player’s worth of slop', () => {
    for (const template of allTemplates()) {
      expect(template.swing, template.id).toBeGreaterThan(0)
      expect(template.swing, template.id).toBeLessThanOrEqual(1)
      expect(template.humanize.timingMs, template.id).toBeGreaterThan(0)
      expect(template.humanize.timingMs, template.id).toBeLessThan(
        halfStepMs(template.subdivision, template.tempoRange[1]),
      )
      expect(template.humanize.velocity, template.id).toBeGreaterThan(0)
      expect(template.humanize.velocity, template.id).toBeLessThan(0.5)
    }
  })

  it('declares a sane tempo range', () => {
    for (const template of allTemplates()) {
      const [lo, hi] = template.tempoRange
      expect(lo, template.id).toBeGreaterThan(0)
      expect(lo, template.id).toBeLessThan(hi)
    }
  })

  it('declares a gain and a pan for every voice it plays', () => {
    for (const template of allTemplates()) {
      for (const voice of template.voices) {
        expect(typeof template.gain[voice], `${template.id}.gain.${voice}`).toBe('number')
        expect(typeof template.pan[voice], `${template.id}.pan.${voice}`).toBe('number')
        expect(template.pan[voice], `${template.id}.pan.${voice}`).toBeGreaterThanOrEqual(-1)
        expect(template.pan[voice], `${template.id}.pan.${voice}`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('the pass count — R2, R2a, AC2', () => {
  it('declares a signed lean for the voices that carry the feel', () => {
    for (const template of allTemplates()) {
      const lean = template.humanize.lean
      expect(Object.keys(lean).length, `${template.id} inherits its lean`).toBeGreaterThan(0)
      expect(lean.snare, `${template.id} does not lean its snare`).toBeGreaterThan(0)
      for (const hat of ['hatClosed', 'hatOpen'] as const) {
        if (!template.voices.includes(hat)) continue
        expect(lean[hat] ?? 0, `${template.id} ${hat} does not push`).toBeLessThanOrEqual(0)
      }
    }
  })

  it('lets the tempo breathe, but only a little', () => {
    for (const template of allTemplates()) {
      expect(template.humanize.driftDepth, `${template.id}`).toBeGreaterThan(0)
      expect(template.humanize.driftDepth, `${template.id}`).toBeLessThanOrEqual(0.01)
    }
  })

  it('leans every voice it names, and names no voice it does not play', () => {
    for (const template of allTemplates()) {
      for (const voice of Object.keys(template.humanize.lean)) {
        expect(template.voices, `${template.id} leans ${voice}, which it never plays`).toContain(
          voice,
        )
      }
    }
  })

  it('declares a whole number of passes on every template', () => {
    for (const template of allTemplates()) {
      expect(Number.isInteger(template.passes), template.id).toBe(true)
    }
  })

  it('never declares fewer than two passes', () => {
    for (const template of allTemplates()) {
      expect(template.passes, template.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('lets the slow feel declare fewer passes than the fast ones', () => {
    const counts = new Set(allTemplates().map((t) => t.passes))
    expect(counts.size).toBeGreaterThan(1)
    expect(templateById('half-time').passes).toBeLessThan(
      templateById('straight-funk').passes,
    )
  })
})
