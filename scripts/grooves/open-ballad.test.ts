import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import {
  BARS_PER_PASS,
  COMP_ACCENTS,
  FILLS,
  PATTERN_RESOLUTION,
  buildEvents,
  gridSteps,
} from './events.ts'
import { allTemplates, templateById } from './templates/index.ts'
import type { FeelTemplate, GrooveSpec, NoteEvent, VoiceName } from './types.ts'

const feel = templateById('open-ballad')
const specs = readCatalogue().filter((spec) => spec.template === 'open-ballad')
const BARS = BARS_PER_PASS * feel.passes

// The bars the hatOpen figure marks. `barInPass % figure.bars.length` with four bars
// declared against two passes lands the fourth entry on both — quick-18 Q2-C.
const MARKED_BARS = [3, 7]

type Rendered = {
  spec: GrooveSpec
  bpm: number
  bars: Map<VoiceName, number[]>[]
  events: NoteEvent[]
  perSecond: number
}

function render(spec: GrooveSpec, template: FeelTemplate = feel): Rendered {
  const { events, music } = buildEvents(spec, template)
  const stepSec = ((60 / music.bpm) * 4) / template.subdivision
  const bars: Map<VoiceName, number[]>[] = Array.from(
    { length: music.loopBars },
    () => new Map(),
  )
  for (const event of events as NoteEvent[]) {
    const grid = Math.round(event.timeSec / stepSec)
    const bar = Math.floor(grid / template.subdivision)
    const sixteenth = (grid % template.subdivision) * (PATTERN_RESOLUTION / template.subdivision)
    const stated = bars[bar].get(event.voice) ?? []
    if (!stated.includes(sixteenth)) stated.push(sixteenth)
    bars[bar].set(event.voice, stated.sort((a, b) => a - b))
  }
  const barSec = (60 / music.bpm) * 4
  return { spec, bpm: music.bpm, bars, events, perSecond: events.length / (music.loopBars * barSec) }
}

const rendered = specs.map((spec) => render(spec))

describe('open-ballad — quick-18', () => {
  it('mints five grooves', () => {
    expect(specs).toHaveLength(5)
  })

  describe('the grid it is written on', () => {
    // The reason for the move. At subdivision 8 `gridSteps` halved the 16-grid, and
    // all three shared HAT_PATTERNS collapsed to the same straight eighths — the draw
    // picked one of three and always got one line.
    it('keeps every declared figure distinct once gridded', () => {
      const pools = feel.patterns
      expect(pools, 'open-ballad declares no pools of its own').toBeDefined()
      for (const [voice, pool] of Object.entries(pools!)) {
        const figures = pool as number[][]
        const gridded = new Set(figures.map((f) => String(gridSteps(f, feel.subdivision))))
        expect(
          gridded.size,
          `patterns.${voice} draws from ${figures.length} figures but states ${gridded.size} on the subdivision-${feel.subdivision} grid`,
        ).toBe(figures.length)
      }
    })

    it('reaches the weak velocity level, which the eighth grid cannot', () => {
      // accentedVelocity reads velocityFor(voice, sixteenth) and the sixteenth is
      // step * 16 / subdivision, so at subdivision 8 every hit is on an even sixteenth
      // and `weak` is unreachable. An odd sixteenth is the proof it no longer is.
      for (const groove of rendered) {
        const odd = (groove.bars.flatMap((voices) => voices.get('hatClosed') ?? [])).filter(
          (step) => step % 2 === 1,
        )
        expect(odd.length, `${groove.spec.id} states no odd sixteenth on the hat`).toBeGreaterThan(0)
      }
    })
  })

  describe('the hat the figure opens', () => {
    it('never sounds a closed hat under an open one', () => {
      for (const groove of rendered) {
        for (let bar = 0; bar < BARS; bar++) {
          const open = groove.bars[bar].get('hatOpen') ?? []
          const closed = groove.bars[bar].get('hatClosed') ?? []
          const both = open.filter((step) => closed.includes(step))
          expect(both, `${groove.spec.id} bar ${bar} sounds both hats at ${both}`).toEqual([])
        }
      }
    })

    it('opens twice in the marked bars and once everywhere else', () => {
      for (const groove of rendered) {
        for (let bar = 0; bar < BARS; bar++) {
          const open = groove.bars[bar].get('hatOpen') ?? []
          expect(open.length, `${groove.spec.id} bar ${bar}`).toBe(
            MARKED_BARS.includes(bar) ? 2 : 1,
          )
        }
      }
    })

    // The rendered assertion above only reaches the pool members the five grooves
    // happen to draw — two of the three. A verifier put 10 and 14 back into the third
    // member and every test stayed green, so the rule Q3-A actually decided is stated
    // here over the declaration instead of inferred from what got rendered.
    it('states neither step the figure opens, in any member of the pool', () => {
      const opened = new Set((feel.figures ?? []).flatMap((f) => f.bars.flat()))
      expect([...opened].sort((a, b) => a - b)).toEqual([10, 14])
      for (const [index, member] of (feel.patterns?.hatClosed ?? []).entries()) {
        for (const step of opened) {
          expect(
            member,
            `patterns.hatClosed[${index}] states step ${step}, which the hatOpen figure opens`,
          ).not.toContain(step)
        }
      }
    })

    it('declares the figure rather than leaning on the shared placement', () => {
      expect(feel.figures, 'open-ballad stopped declaring its figure').toHaveLength(1)
      expect(feel.figures![0].voice).toBe('hatOpen')
      expect(feel.figures![0].bars).toEqual([[14], [14], [14], [10, 14]])
    })
  })

  describe('the fill bar', () => {
    it('keeps the hat running, where DEFAULT_FILL would drop it', () => {
      expect(FILLS['open-ballad'], 'open-ballad has no fill of its own').toBeDefined()
      for (const groove of rendered) {
        const last = groove.bars[BARS - 1]
        expect(
          (last.get('hatClosed') ?? []).length,
          `${groove.spec.id} fill bar plays no hat`,
        ).toBeGreaterThan(0)
      }
    })

    it('does not name hatOpen, which the figure already supplies', () => {
      expect(FILLS['open-ballad'].fill.hatOpen).toBeUndefined()
    })
  })

  // events.test.ts pins this feel's mean comp velocity against the value it had before
  // feature-22, and quick-18 re-pinned it because the comp pool changed — which makes
  // that comparison self-satisfied for open-ballad and leaves R7/AC7 with no live
  // evidence here. So the guarantee is asserted at its mechanism instead of over a
  // rendered mean: the comp is accented by a cycle whose mean is exactly one, which is
  // *why* the accent varies the comp without raising it. Pool-, seed- and
  // feel-independent, and nothing a future edit to this template can hollow out.
  //
  // A first version of this test compared a humanized render to a dry one. That was
  // wrong and a verifier caught it: `humanize` is what the dry override zeroes, but
  // COMP_ACCENTS is applied on both sides (events.ts:940), so it measured the zero-mean
  // gaussian and not the curve. It is a registry fact rather than an open-ballad one and
  // sits here because this is the feel whose pin stopped carrying it; moving it into
  // events.test.ts would retire all six of those pins, which is quick-16's to do.
  it('accents the comp around its centre rather than raising it — R7, AC7', () => {
    const mean = COMP_ACCENTS.reduce((a, b) => a + b, 0) / COMP_ACCENTS.length
    expect(mean, 'COMP_ACCENTS no longer averages to unity, so the comp is being raised').toBe(1)
    expect(Math.max(...COMP_ACCENTS), 'no accent is above the centre').toBeGreaterThan(1)
    expect(Math.min(...COMP_ACCENTS), 'no accent is below the centre').toBeLessThan(1)
  })

  describe('what the ticket asked for', () => {
    it('is no longer the emptiest style in the app per second', () => {
      const perSecond = new Map<string, number>()
      for (const template of allTemplates()) {
        const own = readCatalogue().filter((spec) => spec.template === template.id)
        if (own.length === 0) continue
        const rates = own.map((spec) => render(spec, template).perSecond)
        perSecond.set(template.id, rates.reduce((a, b) => a + b, 0) / rates.length)
      }
      const sorted = [...perSecond.entries()].sort((a, b) => a[1] - b[1])
      const emptiest = sorted[0][0]
      const mine = perSecond.get('open-ballad') as number
      expect(
        emptiest,
        `open-ballad is still the emptiest at ${mine.toFixed(2)} events/sec — ${sorted
          .map(([id, r]) => `${id} ${r.toFixed(2)}`)
          .join(', ')}`,
      ).not.toBe('open-ballad')
    })

    it('keeps a tempo band a ballad can be played over', () => {
      expect(feel.tempoRange[0], 'the slow end moved').toBeLessThan(75)
    })

    it('declares a density band its own grooves sit inside', () => {
      for (const groove of rendered) {
        const perBar = groove.events.length / groove.bars.length
        expect(perBar, `${groove.spec.id} is under the declared floor`).toBeGreaterThanOrEqual(
          feel.density.minPerBar,
        )
        expect(perBar, `${groove.spec.id} is over the declared ceiling`).toBeLessThanOrEqual(
          feel.density.maxPerBar,
        )
      }
    })
  })
})
