import { describe, expect, it } from 'vitest'
import type { FeelTemplate, VoiceName } from './types.ts'
import {
  DEFAULT_FILL,
  FEATHER_VELOCITY,
  FILLS,
  GHOST_VELOCITY_THRESHOLD,
  HAT_PUNCTUATION_PATTERNS,
  QUARTER_STEPS_16,
  RIDE_PATTERNS,
  VELOCITIES,
  buildEvents,
  featherSteps,
  middlePassOf,
} from './events.ts'
import { readCatalogue } from './catalogue.ts'
import { allTemplates, templateById } from './templates/index.ts'

const UUID = '2368f779-9931-44ec-9c62-3146bf20736f'

const BEATS_PER_BAR = 4

const CATALOGUE = readCatalogue()

const ridingFeels = (): FeelTemplate[] =>
  allTemplates().filter((feel) => feel.voices.includes('ride'))

function seedsFor(feelId: string): number[] {
  const catalogue = CATALOGUE.filter((groove) => groove.template === feelId).map((g) => g.seed)
  return [...new Set([...catalogue, 1, 2, 3, 4, 5, 6, 7, 8])]
}

function gridded(steps: number[], subdivision: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const source of [...steps].sort((a, b) => a - b)) {
    const step = Math.min(subdivision - 1, Math.round((source * subdivision) / 16))
    if (seen.has(step)) continue
    seen.add(step)
    out.push(step)
  }
  return out
}

const dry = (feel: FeelTemplate): FeelTemplate => ({
  ...feel,
  humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
})

const withoutRide = (feel: FeelTemplate): FeelTemplate => ({
  ...feel,
  voices: feel.voices.filter((voice) => voice !== 'ride'),
})

type Hit = { voice: VoiceName; step: number; velocity: number; timeSec: number }

function barsOf(feel: FeelTemplate, seed: number) {
  const built = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
  const stepSec = ((60 / built.music.bpm) * 4) / feel.subdivision
  const bars: Hit[][] = Array.from({ length: built.music.loopBars }, () => [])
  for (const event of built.events) {
    const grid = Math.round(event.timeSec / stepSec)
    bars[Math.floor(grid / feel.subdivision)].push({
      voice: event.voice,
      step: grid % feel.subdivision,
      velocity: event.velocity,
      timeSec: event.timeSec,
    })
  }
  return { bars, music: built.music, events: built.events }
}

const stepsIn = (bar: Hit[], voice: VoiceName): number[] =>
  bar.filter((hit) => hit.voice === voice).map((hit) => hit.step).sort((a, b) => a - b)

function phraseBars(feel: FeelTemplate): Set<number> {
  const bars = new Set([(feel.passes - 1) * 4 + 3])
  const middle = middlePassOf(feel.passes)
  if (middle !== null) bars.add(middle * 4 + 3)
  return bars
}

function fillKickOf(feel: FeelTemplate): number[] {
  const declared = FILLS[feel.id] ?? { fill: DEFAULT_FILL }
  return gridded(declared.fill.kick ?? [], feel.subdivision)
}

function variationKickOf(feel: FeelTemplate): number[] {
  const declared = FILLS[feel.id] ?? { fill: DEFAULT_FILL }
  return gridded((declared.variation ?? declared.fill).kick ?? [], feel.subdivision)
}

function authoredKickVelocity(step: number, subdivision: number): number {
  const sixteenth = (step * 16) / subdivision
  const shape = VELOCITIES.kick
  if (sixteenth % 4 === 0) return shape.strong
  if (sixteenth % 2 === 0) return shape.medium
  return shape.weak
}

describe('the sixteenth ride pool — R3, AC3', () => {
  it('stocks a pool for each subdivision a feel rides on', () => {
    expect(Object.keys(RIDE_PATTERNS).sort()).toEqual(['16', '8'])
    for (const feel of ridingFeels()) {
      expect(
        RIDE_PATTERNS[feel.subdivision],
        `${feel.id} rides on subdivision ${feel.subdivision}, which the pool does not stock`,
      ).toBeDefined()
    }
  })

  it('holds three figures on the sixteenth grid', () => {
    expect(RIDE_PATTERNS[16]).toHaveLength(3)
  })

  it('writes every sixteenth figure ascending, unique and inside the bar', () => {
    for (const figure of RIDE_PATTERNS[16] as number[][]) {
      expect(new Set(figure).size, `${figure}`).toBe(figure.length)
      expect([...figure].sort((a, b) => a - b), `${figure}`).toEqual(figure)
      for (const step of figure) {
        expect(step, `${figure}`).toBeGreaterThanOrEqual(0)
        expect(step, `${figure}`).toBeLessThan(16)
      }
    }
  })

  it('keeps every quarter of the bar in every sixteenth figure', () => {
    for (const figure of RIDE_PATTERNS[16] as number[][]) {
      for (const quarter of QUARTER_STEPS_16) {
        expect(figure, `${figure} drops the quarter on ${quarter}`).toContain(quarter)
      }
    }
  })

  it('outnumbers the busiest foot hat', () => {
    const busiestHat = Math.max(...HAT_PUNCTUATION_PATTERNS.map((figure) => figure.length))
    for (const figure of RIDE_PATTERNS[16] as number[][]) {
      expect(figure.length, `${figure}`).toBeGreaterThan(busiestHat)
    }
  })

  it('is not the shuffle pool at a higher tempo', () => {
    const eights = (RIDE_PATTERNS[8] as number[][]).map((figure) => figure.join(','))
    for (const figure of RIDE_PATTERNS[16] as number[][]) {
      expect(eights, `${figure} is already a subdivision-8 figure`).not.toContain(figure.join(','))
    }
  })

  it('states no more strokes per second than the shuffle ride a person accepted', () => {
    // Strokes per bar is the wrong quantity: this feel's bar is 25-35 % shorter than
    // the shuffle's, so equal counts are 25-35 % more cymbal per second, and per second
    // is what the ear integrates. Fred rejected the 8-hit figure at 3.32 onsets/s and
    // accepted 2.08 and 2.09 on the two renders either side of it.
    const peakRate = (feel: FeelTemplate) => {
      const barSeconds = (BEATS_PER_BAR * 60) / feel.tempoRange[1]
      const busiest = Math.max(
        ...(RIDE_PATTERNS[feel.subdivision] as number[][]).map((figure) => figure.length),
      )
      return busiest / barSeconds
    }
    const shuffleRate = peakRate(templateById('shuffle'))
    for (const feel of ridingFeels()) {
      expect(
        peakRate(feel),
        `${feel.id}'s busiest ride states more strokes per second than the shuffle's does`,
      ).toBeLessThanOrEqual(shuffleRate)
    }
  })

  it('leaves the shuffle pool exactly as Epic 1 committed it', () => {
    expect(RIDE_PATTERNS[8]).toEqual([
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 4, 6, 8, 12, 14],
      [0, 4, 6, 8, 12],
    ])
  })
})

describe('the sixteenth feel rides its own figure — R3, AC3', () => {
  const FEEL = templateById('swung-sixteenth')

  it('plays one member of the sixteenth pool in every ordinary bar', () => {
    const options = (RIDE_PATTERNS[16] as number[][]).map((figure) =>
      gridded(figure, FEEL.subdivision).join(','),
    )
    for (const seed of seedsFor(FEEL.id)) {
      const { bars } = barsOf(dry(FEEL), seed)
      const phrased = phraseBars(FEEL)
      const drawn = new Set<string>()
      for (let bar = 0; bar < bars.length; bar += 1) {
        if (phrased.has(bar)) continue
        const figure = stepsIn(bars[bar], 'ride').join(',')
        expect(options, `seed ${seed} bar ${bar} rides [${figure}]`).toContain(figure)
        drawn.add(figure)
      }
      expect(drawn.size, `seed ${seed} rides more than one figure over the loop`).toBe(1)
    }
  })
})

describe('the foot hat on every riding feel — R5, R6, AC4', () => {
  it('plays one punctuation figure in every bar, backbeat included', () => {
    for (const feel of ridingFeels()) {
      const options = HAT_PUNCTUATION_PATTERNS.map((figure) =>
        gridded(figure, feel.subdivision).join(','),
      )
      const backbeat = gridded([4, 12], feel.subdivision)
      for (const seed of seedsFor(feel.id)) {
        const { bars } = barsOf(dry(feel), seed)
        const drawn = stepsIn(bars[0], 'hatClosed').join(',')
        expect(options, `${feel.id} seed ${seed}`).toContain(drawn)
        for (let bar = 0; bar < bars.length; bar += 1) {
          const hats = stepsIn(bars[bar], 'hatClosed')
          expect(hats.join(','), `${feel.id} seed ${seed} bar ${bar}`).toBe(drawn)
          expect(hats.length, `${feel.id} seed ${seed} bar ${bar}`).toBeGreaterThanOrEqual(2)
          expect(hats.length, `${feel.id} seed ${seed} bar ${bar}`).toBeLessThanOrEqual(4)
          for (const step of backbeat) {
            expect(hats, `${feel.id} seed ${seed} bar ${bar} drops the backbeat`).toContain(step)
          }
        }
      }
    }
  })

  it('writes no open hat at all', () => {
    for (const feel of ridingFeels()) {
      for (const seed of seedsFor(feel.id)) {
        const { events } = barsOf(feel, seed)
        expect(
          events.some((event) => event.voice === 'hatOpen'),
          `${feel.id} seed ${seed}`,
        ).toBe(false)
      }
    }
  })
})

describe('featherSteps — the quarters the figure left empty — R7, R7b', () => {
  it('fills the three quarters a sixteenth figure leaves open', () => {
    expect(featherSteps([0, 6, 10], 16)).toEqual([4, 8, 12])
  })

  it('leaves a drawn quarter alone', () => {
    expect(featherSteps([0, 6, 8, 14], 16)).toEqual([4, 12])
  })

  it('reads the quarters of the eighth grid', () => {
    expect(featherSteps([0, 3, 5], 8)).toEqual([2, 4, 6])
  })

  it('adds nothing to a figure that already holds all four quarters', () => {
    expect(featherSteps([0, 2, 4, 6], 8)).toEqual([])
  })

  it('names the quarters of the sixteenth grid', () => {
    expect(QUARTER_STEPS_16).toEqual([0, 4, 8, 12])
  })

  it('stays under the ghost threshold on every riding feel, humanize included', () => {
    expect(FEATHER_VELOCITY).toBeGreaterThan(0)
    for (const feel of ridingFeels()) {
      expect(
        FEATHER_VELOCITY + feel.humanize.velocity,
        `${feel.id} can humanize a feather over the ghost threshold`,
      ).toBeLessThan(GHOST_VELOCITY_THRESHOLD)
    }
  })
})

describe('the feather sounds under the figure, in every bar — R7, R7b, R8, AC5', () => {
  it('puts exactly one kick on every quarter of every bar', () => {
    for (const feel of ridingFeels()) {
      const quarters = gridded(QUARTER_STEPS_16, feel.subdivision)
      for (const seed of seedsFor(feel.id)) {
        const { bars } = barsOf(feel, seed)
        for (let bar = 0; bar < bars.length; bar += 1) {
          for (const quarter of quarters) {
            const hits = bars[bar].filter(
              (hit) => hit.voice === 'kick' && hit.step === quarter,
            )
            expect(
              hits.length,
              `${feel.id} seed ${seed} bar ${bar} quarter ${quarter}`,
            ).toBe(1)
          }
        }
      }
    }
  })

  it('feathers only quarters, and only the ones the bar’s own figure left empty', () => {
    for (const feel of ridingFeels()) {
      const quarters = gridded(QUARTER_STEPS_16, feel.subdivision)
      const phrased = phraseBars(feel)
      const fillBar = (feel.passes - 1) * 4 + 3
      for (const seed of seedsFor(feel.id)) {
        const drawn = stepsIn(barsOf(dry(withoutRide(feel)), seed).bars[0], 'kick')
        const { bars } = barsOf(feel, seed)
        for (let bar = 0; bar < bars.length; bar += 1) {
          const sounding = phrased.has(bar)
            ? bar === fillBar
              ? fillKickOf(feel)
              : variationKickOf(feel)
            : drawn
          const where = `${feel.id} seed ${seed} bar ${bar}`
          const kicks = bars[bar].filter((hit) => hit.voice === 'kick')
          const loud = kicks
            .filter((hit) => hit.velocity >= GHOST_VELOCITY_THRESHOLD)
            .map((hit) => hit.step)
            .sort((a, b) => a - b)
          const soft = kicks
            .filter((hit) => hit.velocity < GHOST_VELOCITY_THRESHOLD)
            .map((hit) => hit.step)
            .sort((a, b) => a - b)
          expect(loud, `${where}: the drawn figure`).toEqual(sounding)
          expect(soft, `${where}: the feather`).toEqual(featherSteps(sounding, feel.subdivision))
          for (const step of soft) {
            expect(quarters, `${where}: a feather off the quarter`).toContain(step)
          }
        }
      }
    }
  })

  it('leaves every drawn kick at the velocity VELOCITIES authors for its position', () => {
    for (const feel of ridingFeels()) {
      for (const seed of seedsFor(feel.id)) {
        const { bars } = barsOf(dry(feel), seed)
        for (let bar = 0; bar < bars.length; bar += 1) {
          for (const hit of bars[bar]) {
            if (hit.voice !== 'kick') continue
            if (hit.velocity < GHOST_VELOCITY_THRESHOLD) {
              expect(hit.velocity, `${feel.id} seed ${seed} bar ${bar}`).toBe(FEATHER_VELOCITY)
              continue
            }
            expect(hit.velocity, `${feel.id} seed ${seed} bar ${bar} step ${hit.step}`).toBe(
              authoredKickVelocity(hit.step, feel.subdivision),
            )
          }
        }
      }
    }
  })
})

describe('the feather is fixed, not drawn — R7, AC6', () => {
  for (const subdivision of [8, 16] as const) {
    it(`survives a rotation of the subdivision-${subdivision} ride pool`, () => {
      const feels = ridingFeels().filter((feel) => feel.subdivision === subdivision)
      expect(feels.length, `no feel rides on subdivision ${subdivision}`).toBeGreaterThan(0)
      const pool = RIDE_PATTERNS[subdivision] as number[][]

      for (const feel of feels) {
        const seed = seedsFor(feel.id)[0]
        const before = barsOf(dry(feel), seed)
        try {
          pool.push(pool.shift() as number[])
          const after = barsOf(dry(feel), seed)
          expect(
            stepsIn(after.bars[0], 'ride').join(','),
            `${feel.id}: rotating the pool moved no ride figure, so this case proves nothing`,
          ).not.toBe(stepsIn(before.bars[0], 'ride').join(','))
          const settled = (built: ReturnType<typeof barsOf>) =>
            built.events.filter((event) => event.voice !== 'ride')
          expect(settled(after), `${feel.id} seed ${seed}`).toEqual(settled(before))
        } finally {
          pool.unshift(pool.pop() as number[])
        }
      }
    })
  }
})

describe('nothing that does not ride feathers — R9, AC7', () => {
  it('leaves every kick of a non-riding feel above the ghost threshold', () => {
    const straight = allTemplates().filter((feel) => !feel.voices.includes('ride'))
    expect(straight.length).toBeGreaterThan(0)
    for (const feel of straight) {
      for (const seed of seedsFor(feel.id)) {
        const { events } = barsOf(feel, seed)
        for (const event of events) {
          if (event.voice !== 'kick') continue
          expect(
            event.velocity,
            `${feel.id} seed ${seed} feathers a kick it should not`,
          ).toBeGreaterThanOrEqual(GHOST_VELOCITY_THRESHOLD)
        }
      }
    }
  })
})

describe('both riding feels stay inside their committed bands — R11b, R11c, AC12', () => {
  it('pins the two bands as the numbers they are', () => {
    expect(templateById('shuffle').density).toEqual({ minPerBar: 16, maxPerBar: 38 })
    expect(templateById('swung-sixteenth').density).toEqual({ minPerBar: 16, maxPerBar: 42 })
  })

  for (const feelId of ['shuffle', 'swung-sixteenth']) {
    it(`${feelId} renders inside its band at 120 seeds`, () => {
      const feel = templateById(feelId)
      let lowest = Infinity
      let highest = -Infinity
      for (let seed = 1; seed <= 120; seed += 1) {
        const { events, music } = buildEvents(
          { id: 'g', uuid: UUID, template: feel.id, seed },
          feel,
        )
        const perBar = events.length / music.loopBars
        lowest = Math.min(lowest, perBar)
        highest = Math.max(highest, perBar)
      }
      expect(lowest, `${feelId} renders sparser than its floor`).toBeGreaterThanOrEqual(
        feel.density.minPerBar,
      )
      expect(highest, `${feelId} renders denser than its ceiling`).toBeLessThanOrEqual(
        feel.density.maxPerBar,
      )
    })
  }
})
