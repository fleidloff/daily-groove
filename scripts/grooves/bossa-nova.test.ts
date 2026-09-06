import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import {
  BARS_PER_PASS,
  DEFAULT_PLACEMENT,
  PATTERN_RESOLUTION,
  buildEvents,
  gridSteps,
} from './events.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec, NoteEvent, VoiceName } from './types.ts'

const feel = templateById('bossa-nova')

const specs = readCatalogue().filter((spec) => spec.template === 'bossa-nova')

// The 3-2 bossa clave and the surdo, written out here rather than read off the
// template: a test that derived its expectation from the declaration would move with
// it and could never say the clave had moved.
const CLAVE: number[][] = [
  [0, 6, 12],
  [4, 10],
]

const SURDO: number[][] = [
  [0, 8],
  [0, 6, 8],
  [0, 8, 12],
  [0, 6, 8, 12],
]

// The "and" of 4 on the sixteenth grid. The surdo pool exists to leave it to the bass
// approach note and the comp's anticipation, and every figure in SURDO is silent there.
const AND_OF_FOUR = 14

const BARS = BARS_PER_PASS * feel.passes

type Rendered = {
  spec: GrooveSpec
  bpm: number
  /** sixteenth-grid steps each voice states, per bar of the loop */
  bars: Map<VoiceName, number[]>[]
  offGrid: number
}

function render(spec: GrooveSpec): Rendered {
  const { events, music } = buildEvents(spec, feel)
  const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
  const bars: Map<VoiceName, number[]>[] = Array.from({ length: BARS }, () => new Map())
  let offGrid = 0

  for (const event of events as NoteEvent[]) {
    const exact = event.timeSec / stepSec
    const grid = Math.round(exact)
    offGrid = Math.max(offGrid, Math.abs(exact - grid))
    const bar = Math.floor(grid / feel.subdivision)
    const sixteenth = (grid % feel.subdivision) * (PATTERN_RESOLUTION / feel.subdivision)
    const stated = bars[bar].get(event.voice) ?? []
    if (!stated.includes(sixteenth)) stated.push(sixteenth)
    bars[bar].set(event.voice, stated.sort((a, b) => a - b))
  }

  return { spec, bpm: music.bpm, bars, offGrid }
}

const rendered = specs.map(render)

const ORDINARY_BARS = Array.from({ length: BARS }, (_, bar) => bar).filter(
  (bar) => bar % BARS_PER_PASS !== BARS_PER_PASS - 1,
)

describe('bossa-nova over the catalogue — feature-25 R21, R23, AC14, AC16', () => {
  it('mints exactly six grooves, each with its own seed — R23, AC16', () => {
    expect(specs.map((spec) => spec.id)).toHaveLength(6)
    expect(new Set(specs.map((spec) => spec.seed)).size).toBe(6)
  })

  it('recovers every event onto the eighth grid with room to spare', () => {
    // Everything below reads a step index back out of timeSec. Swing, lean and drift
    // move an event; if one ever moved it half a step this suite would silently start
    // asserting about the wrong step instead of failing.
    for (const groove of rendered) {
      expect(groove.offGrid, `${groove.spec.id} at ${groove.bpm} bpm`).toBeLessThan(0.25)
    }
  })

  it('sounds the 3-2 clave on the rim, bar for bar, in all six — R21, AC14', () => {
    expect(feel.figures, 'the template stopped declaring one figure').toHaveLength(1)
    expect(feel.figures![0].voice).toBe('rim')
    expect(feel.figures![0].bars, 'the declared clave moved').toEqual(CLAVE)

    for (const groove of rendered) {
      for (let bar = 0; bar < BARS; bar++) {
        expect(
          groove.bars[bar].get('rim') ?? [],
          `${groove.spec.id} bar ${bar}`,
        ).toEqual(CLAVE[bar % CLAVE.length])
      }
      expect(
        groove.bars.reduce((n, voices) => n + (voices.get('rim')?.length ?? 0), 0),
        `${groove.spec.id} rim strokes`,
      ).toBe(8 * CLAVE[0].length + 8 * CLAVE[1].length)
    }
  })

  it('keeps the shared rim placement suppressed, fills included — R21, AC14', () => {
    const shared = gridSteps(DEFAULT_PLACEMENT.rim, feel.subdivision).map(
      (step) => step * (PATTERN_RESOLUTION / feel.subdivision),
    )
    expect(shared, 'DEFAULT_PLACEMENT.rim no longer grids off the clave').not.toEqual([])
    for (const groove of rendered) {
      for (let bar = 0; bar < BARS; bar++) {
        for (const step of shared) {
          expect(
            groove.bars[bar].get('rim') ?? [],
            `${groove.spec.id} bar ${bar} sounds the shared rim placement`,
          ).not.toContain(step)
        }
      }
    }
  })

  it('draws the kick from the template surdo pool, one figure a groove — R21, AC14', () => {
    expect(feel.patterns?.kick, 'the declared surdo pool moved').toEqual(SURDO)

    for (const groove of rendered) {
      const figures = ORDINARY_BARS.map((bar) => groove.bars[bar].get('kick') ?? [])
      for (const [index, figure] of figures.entries()) {
        expect(
          SURDO,
          `${groove.spec.id} bar ${ORDINARY_BARS[index]} kick is outside the surdo pool`,
        ).toContainEqual(figure)
      }
      expect(
        new Set(figures.map((figure) => figure.join(','))).size,
        `${groove.spec.id} states more than one surdo figure`,
      ).toBe(1)
    }
  })

  it('never states the "and" of 4 with the kick, fills included — R21, AC14', () => {
    for (const figure of SURDO) expect(figure).not.toContain(AND_OF_FOUR)
    for (const groove of rendered) {
      for (let bar = 0; bar < BARS; bar++) {
        expect(
          groove.bars[bar].get('kick') ?? [],
          `${groove.spec.id} bar ${bar} pushes the "and" of 4`,
        ).not.toContain(AND_OF_FOUR)
      }
    }
  })
})
