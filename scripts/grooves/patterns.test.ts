import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  FIGURE_BARS_PER_PASS,
  PATTERN_GRID,
  PATTERN_VOICES,
  assertFigures,
  assertPatterns,
} from './patterns.ts'
import type { FeelTemplate, FixedFigure, PatternPools } from './types.ts'
import {
  brightStraight,
  halfTime,
  shuffle,
  straightFunk,
  swungSixteenth,
} from './templates/index.ts'

const BASE: FeelTemplate = {
  id: 'x',
  tempoRange: [100, 110],
  subdivision: 8,
  swing: 0,
  flavours: ['ionian', 'dorian'],
  voices: ['kick', 'snare', 'hatClosed', 'rim', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: { timingMs: 10, velocity: 0.1, lean: {}, driftDepth: 0 },
  gain: {},
  pan: {},
  passes: 2,
  density: { minPerBar: 4, maxPerBar: 40 },
}

function withPatterns(patterns: PatternPools, id = 'x'): FeelTemplate {
  return { ...BASE, id, patterns }
}

function withFigures(figures: FixedFigure[], id = 'x'): FeelTemplate {
  return { ...BASE, id, figures }
}

describe('the pattern block', () => {
  it('names all eight pools, in order, once each', () => {
    expect([...PATTERN_VOICES]).toEqual([
      'kick',
      'hatClosed',
      'ride',
      'bass',
      'comp',
      'bongos',
      'snareGhosts',
      'kit',
    ])
    expect(new Set(PATTERN_VOICES).size).toBe(8)
  })

  it('replaces a pool events/pools.ts already carries for the first seven, and none for kit', () => {
    const source = readFileSync(join(import.meta.dirname, 'events', 'pools.ts'), 'utf8')
    const replaced: Record<string, string[]> = {
      kick: ['KICK_PATTERNS'],
      hatClosed: ['HAT_PATTERNS', 'HAT_PUNCTUATION_PATTERNS'],
      ride: ['RIDE_PATTERNS'],
      bass: ['BASS_PATTERNS'],
      comp: ['COMP_PATTERNS'],
      bongos: ['BONGO_PATTERNS'],
      snareGhosts: ['SNARE_GHOST_PATTERNS'],
    }
    expect(Object.keys(replaced)).toEqual(PATTERN_VOICES.slice(0, 7))
    for (const pools of Object.values(replaced)) {
      for (const pool of pools) {
        expect(source).toMatch(new RegExp(`\\b${pool}\\b\\s*:`))
      }
    }
    expect(PATTERN_VOICES[7]).toBe('kit')
    expect(source).not.toMatch(/\bKIT_PATTERNS\b/)
  })

  it('reads a declared block and a declared figure list back off a template', () => {
    const kickAndKit = withPatterns({
      kick: [[0, 6, 10]],
      kit: [{ snare: [3, 11], tomLow: [14] }],
    })
    expect(kickAndKit.patterns?.kick).toEqual([[0, 6, 10]])
    expect(kickAndKit.patterns?.kit?.[0].tomLow).toEqual([14])

    const clave = withFigures([
      {
        voice: 'rim',
        bars: [
          [0, 6, 12],
          [2, 8],
        ],
      },
    ])
    expect(clave.figures?.[0].bars).toHaveLength(2)
  })

  it('declares the grid bound and the pass length it validates against', () => {
    expect(PATTERN_GRID).toBe(16)
    expect(FIGURE_BARS_PER_PASS).toBe(4)
  })
})

describe('assertPatterns', () => {
  it('lets an absent block and a legal block through', () => {
    expect(() => assertPatterns(BASE)).not.toThrow()
    expect(() =>
      assertPatterns(
        withPatterns({
          kick: [
            [0, 6, 10],
            [0, 8],
          ],
          hatClosed: [[0, 2, 4, 6, 8, 10, 12, 14]],
          ride: { 8: [[0, 4, 8, 12]] },
          bass: [[0, 10]],
          comp: [[2, 10]],
          bongos: [{ high: [3, 11], low: [6] }],
          snareGhosts: [[3, 11]],
          kit: [{ snare: [3, 11], tomHigh: [6], tomLow: [14] }],
        }),
      ),
    ).not.toThrow()
  })

  it('rejects an empty pool, naming the template and the voice', () => {
    expect(() => assertPatterns(withPatterns({ kick: [] }))).toThrow(/x/)
    expect(() => assertPatterns(withPatterns({ kick: [] }))).toThrow(/kick/)
    expect(() => assertPatterns(withPatterns({ comp: [[]] }))).toThrow(/x.*comp|comp.*x/)
    expect(() => assertPatterns(withPatterns({ bongos: [{ high: [], low: [] }] }))).toThrow(
      /bongos/,
    )
    expect(() => assertPatterns(withPatterns({ kit: [{ snare: [] }] }))).toThrow(/kit/)
    expect(() => assertPatterns(withPatterns({ bongos: [] }))).toThrow(/bongos/)
    expect(() => assertPatterns(withPatterns({ kit: [] }))).toThrow(/kit/)
  })

  it('rejects a step outside the sixteenth grid, quoting it', () => {
    expect(() => assertPatterns(withPatterns({ bass: [[0, 16]] }))).toThrow(/bass/)
    expect(() => assertPatterns(withPatterns({ bass: [[0, 16]] }))).toThrow(/16/)
    expect(() => assertPatterns(withPatterns({ bass: [[-1]] }))).toThrow(/-1/)
    expect(() => assertPatterns(withPatterns({ bass: [[2.5]] }))).toThrow(/2\.5/)
    expect(() => assertPatterns(withPatterns({ bass: [[0, 15]] }))).not.toThrow()
  })

  describe('a comp figure may span bars — quick-15', () => {
    it('takes a step past the first bar, where every other pool still refuses one', () => {
      expect(() => assertPatterns(withPatterns({ comp: [[0, 6, 18, 26]] }))).not.toThrow()
      expect(() => assertPatterns(withPatterns({ comp: [[0, 16, 32, 63]] }))).not.toThrow()
      for (const voice of ['kick', 'hatClosed', 'bass', 'snareGhosts'] as const) {
        expect(() => assertPatterns(withPatterns({ [voice]: [[0, 16]] })), voice).toThrow(/16/)
      }
    })

    it('still rejects a step past the four bars of a pass, quoting it', () => {
      expect(() => assertPatterns(withPatterns({ comp: [[0, 64]] }))).toThrow(/64/)
      expect(() => assertPatterns(withPatterns({ comp: [[-1]] }))).toThrow(/-1/)
      expect(() => assertPatterns(withPatterns({ comp: [[2.5]] }))).toThrow(/2\.5/)
    })

    it('rejects a length that does not divide the pass, naming the bar count', () => {
      expect(() => assertPatterns(withPatterns({ comp: [[0, 16, 32]] }))).toThrow(/3/)
      expect(() => assertPatterns(withPatterns({ comp: [[0, 16, 32]] }))).toThrow(/comp/)
      expect(() => assertPatterns(withPatterns({ comp: [[0, 16, 32, 48]] }))).not.toThrow()
    })

    it('rejects a bar that sounds nothing, because the bar must state its chord', () => {
      expect(() => assertPatterns(withPatterns({ comp: [[0, 6, 36, 52]] }))).toThrow(/comp/)
      expect(() => assertPatterns(withPatterns({ comp: [[0, 6, 36, 52]] }))).toThrow(/bar 2/)
    })
  })

  it('keeps the bongos, the ride and the kit to their own shapes', () => {
    expect(() =>
      assertPatterns(withPatterns({ bongos: [{ high: [3, 11], low: [16] }] })),
    ).toThrow(/bongos/)
    expect(() => assertPatterns(withPatterns({ ride: { 8: [] } }))).toThrow(/ride/)
    expect(() => assertPatterns(withPatterns({ ride: {} }))).toThrow(/ride/)
    expect(() => assertPatterns(withPatterns({ ride: { 16: [[0, 4, 8, 12]] } }))).not.toThrow()

    expect(() => assertPatterns(withPatterns({ kit: [{ snare: [4, 12], tomHigh: [4] }] }))).toThrow(
      /kit/,
    )
    expect(() => assertPatterns(withPatterns({ kit: [{ snare: [4, 12], tomHigh: [4] }] }))).toThrow(
      /\b4\b/,
    )
    expect(() => assertPatterns(withPatterns({ kit: [{ snare: [4, 4] }] }))).toThrow(/kit/)
    expect(() => assertPatterns(withPatterns({ kit: [{ snare: [4], tomLow: [6, 6] }] }))).toThrow(
      /kit/,
    )
  })

  it('rejects a kit pool and a placement snare line on the same template', () => {
    const template = withPatterns({ kit: [{ snare: [3, 11] }] }, 'both')
    const placements = { both: { snare: [4, 12] } }
    expect(() => assertPatterns(template, placements)).toThrow(/patterns\.kit/)
    expect(() => assertPatterns(template, placements)).toThrow(/PLACEMENTS/)
    expect(() => assertPatterns(template, placements)).toThrow(/both/)
    expect(() => assertPatterns(template, { other: { snare: [4, 12] } })).not.toThrow()
    expect(() => assertPatterns(template, { both: { rim: [15] } })).not.toThrow()
  })
})

// Five, not six: quick-18 gave open-ballad its own pools and a hatOpen figure, so it
// left this list. The claim is unchanged for the ones still in it — these feels draw
// their rhythm from the shared pools in events.ts and state no fixed figure.
describe('the templates that declare nothing of their own', () => {
  const committed = [straightFunk, shuffle, brightStraight, halfTime, swungSixteenth]

  it('declares no pattern block and no fixed figure', () => {
    for (const template of committed) {
      expect(template.patterns, template.id).toBeUndefined()
      expect(template.figures, template.id).toBeUndefined()
    }
  })

  it('leaves every key it does not name undefined', () => {
    const pools = withPatterns({ kick: [[0, 6, 10]] }).patterns as PatternPools
    for (const voice of PATTERN_VOICES) {
      if (voice === 'kick') continue
      expect(pools[voice], voice).toBeUndefined()
    }
  })
})

describe('assertFigures', () => {
  it('takes a two-bar clave and a once-per-pass tom accent', () => {
    expect(() =>
      assertFigures(
        withFigures([
          {
            voice: 'rim',
            bars: [
              [0, 6, 12],
              [2, 8],
            ],
          },
        ]),
      ),
    ).not.toThrow()
    expect(() =>
      assertFigures(withFigures([{ voice: 'tomLow', bars: [[], [], [10], []] }])),
    ).not.toThrow()
    expect(() => assertFigures(BASE)).not.toThrow()
  })

  it('rejects an empty figure, naming the template and the voice', () => {
    expect(() => assertFigures(withFigures([{ voice: 'rim', bars: [] }]))).toThrow(/x/)
    expect(() => assertFigures(withFigures([{ voice: 'rim', bars: [] }]))).toThrow(/rim/)
    expect(() => assertFigures(withFigures([{ voice: 'rim', bars: [[]] }]))).toThrow(/rim/)
  })

  it('rejects a step outside the sixteenth grid', () => {
    expect(() => assertFigures(withFigures([{ voice: 'rim', bars: [[16]] }]))).toThrow(/16/)
    expect(() => assertFigures(withFigures([{ voice: 'rim', bars: [[-1]] }]))).toThrow(/-1/)
    expect(() => assertFigures(withFigures([{ voice: 'rim', bars: [[2.5]] }]))).toThrow(/2\.5/)
  })

  it('rejects a pitched figure, because a figure carries no midi — quick-15', () => {
    for (const voice of ['comp', 'bass'] as const) {
      expect(() => assertFigures(withFigures([{ voice, bars: [[0, 6], [2, 8]] }])), voice).toThrow(
        new RegExp(voice),
      )
      expect(() => assertFigures(withFigures([{ voice, bars: [[0, 6], [2, 8]] }])), voice).toThrow(
        /pitched|midi/i,
      )
    }
  })

  it('rejects a snare figure, because the snare has two sources already', () => {
    expect(() => assertFigures(withFigures([{ voice: 'snare', bars: [[4, 12]] }]))).toThrow(
      /snare/,
    )
  })

  it('rejects a tom that would sound in the last bar of a pass', () => {
    expect(() =>
      assertFigures(
        withFigures([
          {
            voice: 'tomHigh',
            bars: [[2], [4], [6], [8]],
          },
        ]),
      ),
    ).toThrow(/tomHigh/)
    expect(() =>
      assertFigures(withFigures([{ voice: 'tomHigh', bars: [[2], [4], [6], [8]] }])),
    ).toThrow(/variation|last bar/)
    expect(() => assertFigures(withFigures([{ voice: 'tomLow', bars: [[2], [4]] }]))).toThrow(
      /tomLow/,
    )
  })

  it('does not require the voice to be a backing voice', () => {
    expect(() => assertFigures(withFigures([{ voice: 'claves', bars: [[0, 6, 12], [2, 8]] }]))).not.toThrow()
    expect(() => assertFigures(withFigures([{ voice: 'cowbell', bars: [[0, 4, 8, 12]] }]))).not.toThrow()
  })
})
