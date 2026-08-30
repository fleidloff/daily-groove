import { describe, expect, it } from 'vitest'
import type { Flavour, VoiceName } from '../types.ts'
import { FLAVOURS } from '../theory/scales.ts'
import { TEMPLATES, allTemplates, templateById } from './index.ts'

/** Half of one subdivision step at the fastest tempo a template allows, in ms. */
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

// Step A1 — R1, AC1. Four templates that differ in the three things a listener
// would call the feel, not only in name.
describe('the template set — R1, AC1', () => {
  it('holds four templates with unique ids', () => {
    const templates = allTemplates()
    expect(templates).toHaveLength(4)
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('does not give every template the same subdivision, swing or tempo range', () => {
    const templates = allTemplates()
    expect(new Set(templates.map((t) => t.subdivision)).size).toBeGreaterThan(1)
    expect(new Set(templates.map((t) => t.swing)).size).toBe(4)
    expect(new Set(templates.map((t) => t.tempoRange.join('-'))).size).toBe(4)
  })

  it('gives each template its own instrumentation and mix', () => {
    const templates = allTemplates()
    const voiceSets = templates.map((t) => [...t.voices].sort().join(','))
    expect(new Set(voiceSets).size).toBe(4)
    const mixes = templates.map((t) => JSON.stringify([t.gain, t.pan]))
    expect(new Set(mixes).size).toBe(4)
    const humanizes = templates.map((t) => JSON.stringify(t.humanize))
    expect(new Set(humanizes).size).toBe(4)
  })
})

// Step A2 — R2, R5, AC15. The four pairs are what makes the game's chip row
// honest: every flavour offered has grooves behind it, and no groove answers to
// a flavour the game does not offer.
describe('flavour coverage — R2, R5, AC15', () => {
  it('gives every template exactly two flavours', () => {
    for (const template of allTemplates()) {
      expect(template.flavours, template.id).toHaveLength(2)
      expect(new Set(template.flavours).size, template.id).toBe(2)
    }
  })

  it('keeps the four pairs pairwise disjoint', () => {
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

  it('covers exactly the eight flavours the game offers', () => {
    const union = allTemplates().flatMap((t) => t.flavours)
    expect(union).toHaveLength(8)
    expect([...new Set(union)].sort()).toEqual([...(FLAVOURS as Flavour[])].sort())
  })

  it('pairs each flavour with a feel that suits it', () => {
    // The musical judgement of R2, pinned so a later edit is a deliberate one.
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
