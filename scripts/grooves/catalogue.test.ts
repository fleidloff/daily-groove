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

// Widening this is a style epic's job, done as part of its mint and recorded in its
// report. The same constant under the same name lives in the app's manifest test,
// grooves.generated.test.ts, which cannot import from scripts/ — `grep -rn
// DOMINANCE_RATIO` finds both halves. (The app path is not spelled out here:
// boundary.test.ts forbids the literal anywhere under scripts/.)
// Tightened 6 → 2 by quick-12's mint, the first time this constant has moved down.
// Measured over the 54-groove catalogue: dorian and phrygian reach 6, ionian and
// harmonic-major 5, and the other eight modes sit at 4, so the spread is 1.50. The
// mint raised the three modes that had been holding the floor, each offered by one
// template alone — lydian-dominant 1 → 4 from three open-ballad grooves, harmonic-minor
// 2 → 4 from two half-time, phrygian-dominant 3 → 4 from one swung-sixteenth. 2 is not
// the tightest value that passes: it leaves the commonest mode room to reach 8 against
// a floor of 4, which is headroom chosen on purpose rather than a measurement. Before
// widening it again, check whether the floor can be raised instead — that is what this
// mint did, and the previous three widenings are what made it worth doing.
const DOMINANCE_RATIO = 2

function dominanceFailure(counts: Map<Flavour, number>, ratio: number): string | null {
  if (counts.size < 2) return null
  const entries = [...counts.entries()].sort((a, b) => a[1] - b[1])
  const [rarest, fewest] = entries[0]
  const [commonest, most] = entries[entries.length - 1]
  if (most <= fewest * ratio) return null
  return (
    `${commonest} carries ${most} of the answers to ${rarest}'s ${fewest} — ` +
    `more than DOMINANCE_RATIO (${ratio}) times the rarest. Widen DOMINANCE_RATIO in ` +
    `both catalogue.test.ts and grooves.generated.test.ts, and record the new spread.`
  )
}

describe('the dominance cap — R10, AC5', () => {
  it('passes a 7-to-2 spread at 5x', () => {
    expect(dominanceFailure(new Map([['ionian', 7], ['blues', 2]]), 5)).toBeNull()
  })

  it('fails an 11-to-2 spread at 5x, naming both counts and both modes', () => {
    const failure = dominanceFailure(new Map([['ionian', 11], ['blues', 2]]), 5)
    expect(failure).not.toBeNull()
    expect(failure).toContain('ionian')
    expect(failure).toContain('blues')
    expect(failure).toContain('11')
    expect(failure).toContain('2')
    expect(failure).toContain('DOMINANCE_RATIO')
  })

  it('takes the ratio as an argument — 4-to-1 passes at 5x and fails at 3x', () => {
    const counts = new Map<Flavour, number>([['ionian', 4], ['blues', 1]])
    expect(dominanceFailure(counts, 5)).toBeNull()
    expect(dominanceFailure(counts, 3)).not.toBeNull()
  })

  it('reads the rarest and commonest out of more than two modes', () => {
    const counts = new Map<Flavour, number>([
      ['ionian', 7],
      ['dorian', 4],
      ['blues', 1],
    ])
    const failure = dominanceFailure(counts, 5)
    expect(failure).toContain('ionian')
    expect(failure).toContain('blues')
    expect(failure).not.toContain('dorian')
  })
})

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

  it('puts grooves behind every mode its templates offer — R3, R4, AC3, and since feature-25 the only place those two guarantees live', () => {
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

  it('lets no mode dominate the answers — R10, AC5', () => {
    const counts = new Map<Flavour, number>()
    for (const { music } of built) counts.set(music.flavour, (counts.get(music.flavour) ?? 0) + 1)
    expect(dominanceFailure(counts, DOMINANCE_RATIO)).toBeNull()
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
