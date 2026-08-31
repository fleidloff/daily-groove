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

  it('gives each template its own mix and its own feel', () => {
    const templates = allTemplates()
    const mixes = templates.map((t) => JSON.stringify([t.gain, t.pan]))
    expect(new Set(mixes).size).toBe(4)
    const humanizes = templates.map((t) => JSON.stringify(t.humanize))
    expect(new Set(humanizes).size).toBe(4)
  })

  // Instrumentation used to be unique per template too, and is no longer: every
  // feel now plays both hats, because a kit has both and the two feels that went
  // without were the poorer for it. What is left to differentiate a voice set is
  // the cross-stick, so the assertion is what remains true — the kits are not
  // all the same — rather than a uniqueness the design no longer wants.
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

// Feature 9, Epic 1, Step B1 — R2, R2a, AC2. A groove is several passes of the
// same four-bar figure, and how many is a property of the feel: the count sits
// beside the tempo range that causes the spread, so a slow feel can declare
// fewer without every other feel getting shorter.
describe('the pass count — R2, R2a, AC2', () => {
  // Feature-9, Epic 3, Step D1 (R1, R2, AC2). Lean is declared per template with
  // no shared default: a shuffle and a half-time groove do not lay back by the
  // same amount, and a default would quietly make them.
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
    // One pass is a loop that repeats itself byte for byte — the behaviour
    // passes exist to replace (R2a).
    for (const template of allTemplates()) {
      expect(template.passes, template.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('lets the slow feel declare fewer passes than the fast ones', () => {
    // R2: templates may differ. Half-time's 68–80 bpm makes four passes a
    // ~56-second file, so it declares two.
    const counts = new Set(allTemplates().map((t) => t.passes))
    expect(counts.size).toBeGreaterThan(1)
    expect(templateById('half-time').passes).toBeLessThan(
      templateById('straight-funk').passes,
    )
  })
})
