import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { FLAVOURS } from '../../src/lib/theory/names.ts'
import { readCatalogue } from './catalogue.ts'
import {
  BACKING_VOICES,
  DEFAULT_FILL,
  FILLS,
  GHOST_VELOCITY_THRESHOLD,
  PLACEMENTS,
  buildEvents,
  gridSteps,
  middlePassOf,
} from './events.ts'
import { rmsDbfs } from './level.ts'
import { loadPack } from './pack.ts'
import { assertPatterns } from './patterns.ts'
import { renderVoices } from './voices.ts'
import { TEMPLATES, allTemplates, templateById } from './templates/index.ts'
import { secondLine } from './templates/second-line.ts'
import type {
  FeelTemplate,
  KitFigure,
  MusicMeta,
  NoteEvent,
  SamplePack,
  VoiceName,
} from './types.ts'

// second-line is registered, so the registry it had to be checked against as a
// candidate is now simply the registry. The alias is kept so the whole-registry rules
// below read unchanged.
const CANDIDATE: FeelTemplate[] = allTemplates()

const UUID = '00000000-0000-4000-8000-000000000000'

type Placed = NoteEvent & { bar: number; step: number }

function render(feel: FeelTemplate, seed: number): { placed: Placed[]; music: MusicMeta } {
  const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
  const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
  const placed = events.map((event) => {
    const grid = Math.round(event.timeSec / stepSec)
    return {
      ...event,
      bar: Math.floor(grid / feel.subdivision),
      step: grid % feel.subdivision,
    }
  })
  return { placed, music }
}

// The Contracts' helper. Every per-bar claim in this file is a claim about these bars:
// the fill bar and the variation bar sound a FILLS phrase instead of the drawn pools.
function ordinaryBars(feel: FeelTemplate, music: MusicMeta): number[] {
  const fill = (feel.passes - 1) * 4 + 3
  const middle = middlePassOf(feel.passes)
  const variation = middle === null ? -1 : middle * 4 + 3
  return Array.from({ length: music.loopBars }, (_, bar) => bar).filter(
    (bar) => bar !== fill && bar !== variation,
  )
}

// GHOST_VELOCITY_THRESHOLD stops classifying snares once patterns.kit exists: a kit
// snare on an odd sixteenth is nominally 0.45, under the 0.5 split. Duration is what
// still separates them — a struck snare is two sixteenths, a ghost is one.
function isGhost(event: Placed, feel: FeelTemplate, music: MusicMeta): boolean {
  const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
  return event.voice === 'snare' && event.durationSec < stepSec * 1.5
}

function stepsOf(placed: Placed[], voice: VoiceName, bar: number): number[] {
  return [...new Set(placed.filter((e) => e.voice === voice && e.bar === bar).map((e) => e.step))]
    .sort((a, b) => a - b)
}

function offBeat(step: number, feel: FeelTemplate): boolean {
  return ((step * 16) / feel.subdivision) % 4 !== 0
}

const TOMS: VoiceName[] = ['tomHigh', 'tomLow']

const SAMPLE_RATE = 44100
const OVERHANG_BARS = 1

// How far the median comp and bass may sit from straight-funk's own before the mix the
// listening verdict on the harmony bought has been given back. Reasoning at the
// assertion, in `second-line harmony balance`.
const ON_THE_LINE_DB = 1.5

let samples: Promise<SamplePack> | null = null
function pack(): Promise<SamplePack> {
  samples ??= loadPack(fileURLToPath(new URL('./samples', import.meta.url)))
  return samples
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const half = sorted.length / 2
  return sorted.length % 2 === 1 ? sorted[Math.floor(half)] : (sorted[half - 1] + sorted[half]) / 2
}

// The measurement a mix balance is actually made of, and the one the re-gain was set
// from: post-gain track RMS against the kick, per committed groove, median over the
// feel's own six. It is not the gain block — a comp that stabs once a bar measures about
// 3 dB under a comp that plays two at the same gain, which is why the declared numbers
// cannot be compared across feels. Pan drops out: cos²+sin² is 1, so panning a track
// moves no energy.
async function harmonyOverKick(id: string): Promise<{ comp: number; bass: number }> {
  const template = templateById(id)
  const specs = readCatalogue().filter((spec) => spec.template === id)
  expect(specs.length, `${id} has no committed grooves to measure`).toBeGreaterThan(0)

  const rendered = await pack()
  const comp: number[] = []
  const bass: number[] = []

  for (const spec of specs) {
    const { events, music } = buildEvents(spec, template)
    const tracks = renderVoices(events, rendered, SAMPLE_RATE, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      passes: music.loopBars / music.bars,
      overhangBars: OVERHANG_BARS,
    })
    const level = (voice: VoiceName) => {
      const track = tracks.find((t) => t.voice === voice)
      if (!track) throw new Error(`${spec.id} renders no ${voice}`)
      return rmsDbfs(track.pcm) + (template.gain[voice] as number)
    }
    comp.push(level('comp') - level('kick'))
    bass.push(level('bass') - level('kick'))
  }

  return { comp: median(comp), bass: median(bass) }
}

// The declared tom steps of one kit figure, on the feel's own grid, the way events.ts
// resolves them.
function kitTomSteps(feel: FeelTemplate, figure: KitFigure): number[] {
  return [
    ...new Set([
      ...gridSteps(figure.tomHigh ?? [], feel.subdivision),
      ...gridSteps(figure.tomLow ?? [], feel.subdivision),
    ]),
  ].sort((a, b) => a - b)
}

describe('second-line — the template exists and is this template', () => {
  it('declares a kit pool, and the registry holds this template under its own id', () => {
    expect(secondLine.id).toBe('second-line')
    expect(secondLine.patterns?.kit, 'the kit pool is what this whole feel rests on').toBeDefined()
    expect(TEMPLATES['second-line'], 'second-line is not registered').toBe(secondLine)
    expect(templateById('second-line')).toBe(secondLine)
  })
})

describe('second-line kit — A1, R3, R5, AC3', () => {
  const pool = secondLine.patterns!.kit!

  it('holds three or four figures, each a figure and not a backbeat', () => {
    expect(pool.length).toBeGreaterThanOrEqual(3)
    expect(pool.length).toBeLessThanOrEqual(4)
    expect(new Set(pool.map((f) => f.snare.join(','))).size, 'two figures are the same').toBe(
      pool.length,
    )

    for (const figure of pool) {
      const snare = figure.snare
      const where = `snare ${snare.join(',')}`
      expect(snare.length, where).toBeGreaterThanOrEqual(4)
      expect(snare.length, where).toBeLessThanOrEqual(8)
      expect([...snare].sort((a, b) => a - b), `${where} is not ascending`).toEqual(snare)
      expect(new Set(snare).size, `${where} repeats a step`).toBe(snare.length)
      for (const step of snare) {
        expect(step, where).toBeGreaterThanOrEqual(0)
        expect(step, where).toBeLessThan(16)
      }

      expect(snare, `${where} is the backbeat`).not.toEqual([4, 12])
      expect(
        snare.every((step) => [4, 12].includes(step)),
        `${where} is part of the backbeat and nothing else`,
      ).toBe(false)
      expect(
        snare.filter((step) => step % 4 !== 0).length,
        `${where} states fewer than two off-beats`,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  // VELOCITIES gives a snare 1.0 on a quarter, 0.7 on an even off-sixteenth and 0.45 on
  // an odd one. Without a quarter the bar has no accent to hang on — and
  // events.test.ts's `leaves kick, snare and bass reading from metric position` says so
  // registry-wide: every bar's loudest snare must sit on a quarter.
  it('gives every figure exactly one accent, on a quarter', () => {
    for (const figure of pool) {
      const quarters = figure.snare.filter((step) => step % 4 === 0)
      expect(quarters.length, `snare ${figure.snare.join(',')}`).toBe(1)
    }
  })

  it('answers every figure with both toms, one or two hits each, off the snare', () => {
    for (const figure of pool) {
      const where = `snare ${figure.snare.join(',')}`
      for (const line of TOMS) {
        const steps = figure[line as 'tomHigh' | 'tomLow']
        expect(steps, `${where} declares no ${line}`).toBeDefined()
        expect(steps!.length, `${where} ${line}`).toBeGreaterThanOrEqual(1)
        expect(steps!.length, `${where} ${line} is a machine gun`).toBeLessThanOrEqual(2)
        for (const step of steps!) {
          expect(step, `${where} ${line}`).toBeGreaterThanOrEqual(0)
          expect(step, `${where} ${line}`).toBeLessThan(16)
          expect(figure.snare, `${where} puts ${line} on its own snare`).not.toContain(step)
        }
      }
    }
  })

  it('names no voice it does not play, and declares no snare placement of its own', () => {
    for (const voice of TOMS) expect(secondLine.voices).toContain(voice)
    expect(secondLine.voices).toContain('snare')
    expect(PLACEMENTS['second-line']?.snare, 'patterns.kit owns the snare line').toBeUndefined()
    expect(() => assertPatterns(secondLine, PLACEMENTS)).not.toThrow()
  })

  // The rim is a cross-stick on the snare drum, so a bar cannot ask for both at once.
  it('leaves the rim’s step free in every figure, and the ghosts’ steps too', () => {
    const rim = PLACEMENTS['second-line']!.rim!
    const ghosts = secondLine.patterns!.snareGhosts!
    for (const figure of pool) {
      const struck = [...figure.snare, ...(figure.tomHigh ?? []), ...(figure.tomLow ?? [])]
      for (const step of rim) {
        expect(struck, `rim ${step} lands on a struck drum`).not.toContain(step)
      }
    }
    for (const line of ghosts) {
      for (const step of rim) expect(line, `ghost ${step} lands on the rim click`).not.toContain(step)
      // ghostSteps snaps to an odd step, so an even one declared here would move.
      for (const step of line) expect(step % 2, `ghost step ${step} is even`).toBe(1)
    }
  })
})

describe('second-line snare — A2, R3, AC3, AC12', () => {
  it('sounds one drawn figure in every ordinary bar, and it is not the backbeat', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      const bars = ordinaryBars(secondLine, music)
      const seen = new Set<string>()

      for (const bar of bars) {
        const struck = placed
          .filter((e) => e.voice === 'snare' && e.bar === bar && !isGhost(e, secondLine, music))
          .map((e) => e.step)
        const steps = [...new Set(struck)].sort((a, b) => a - b)
        const match = secondLine.patterns!.kit!.find(
          (figure) => gridSteps(figure.snare, secondLine.subdivision).join(',') === steps.join(','),
        )
        expect(match, `seed ${seed} bar ${bar} plays ${steps.join(',')}`).toBeDefined()
        expect(steps, `seed ${seed} bar ${bar}`).not.toEqual(gridSteps([4, 12], secondLine.subdivision))
        expect(
          steps.some((step) => offBeat(step, secondLine)),
          `seed ${seed} bar ${bar} states no off-beat`,
        ).toBe(true)
        seen.add(steps.join(','))
      }

      expect(seen.size, `seed ${seed} changes figure mid-loop`).toBe(1)
      expect(bars.length, `seed ${seed}`).toBe(music.loopBars - 2)
    }
  })

  it('moves no other feel’s snare — AC12', () => {
    for (const id of ['straight-funk', 'half-time']) {
      const feel = templateById(id)
      const expected = gridSteps(
        PLACEMENTS[id]?.snare ?? [4, 12],
        feel.subdivision,
      )
      for (let seed = 1; seed <= 6; seed += 1) {
        const { placed, music } = render(feel, seed)
        for (const bar of ordinaryBars(feel, music)) {
          const struck = [
            ...new Set(
              placed
                .filter((e) => e.voice === 'snare' && e.bar === bar && !isGhost(e, feel, music))
                .map((e) => e.step),
            ),
          ].sort((a, b) => a - b)
          expect(struck, `${id} seed ${seed} bar ${bar}`).toEqual(expected)
        }
      }
    }
  })
})

describe('second-line draws its kit on its own stream — A3, R3, AC12', () => {
  it('re-keys nothing when the kit pool rotates', () => {
    const pool = secondLine.patterns!.kit!
    const before = render(secondLine, 3)

    pool.push(pool.shift()!)
    try {
      const after = render(secondLine, 3)

      const kitOf = (r: typeof before) =>
        r.placed
          .filter((e) => e.voice === 'tomHigh' || e.voice === 'tomLow')
          .map((e) => `${e.voice}@${e.bar}:${e.step}`)
          .join('|')
      expect(kitOf(after), 'the rotation changed nothing, so the case proves nothing').not.toBe(
        kitOf(before),
      )

      for (const key of ['root', 'flavour', 'chord', 'progression', 'bpm'] as const) {
        expect(after.music[key], key).toEqual(before.music[key])
      }
      for (const voice of ['kick', 'bass', 'comp', 'hatClosed'] as VoiceName[]) {
        const line = (r: typeof before) =>
          r.placed
            .filter((e) => e.voice === voice)
            .map((e) => `${e.bar}:${e.step}:${e.midi ?? ''}:${e.velocity.toFixed(6)}`)
            .join('|')
        expect(line(after), voice).toBe(line(before))
      }
    } finally {
      pool.unshift(pool.pop()!)
    }
  })
})

describe('second-line toms — A4, A5, R5, AC5', () => {
  // The registry-wide guard events.test.ts carries, run over the registry second-line
  // would join, so the branch that only a kit-carrying template reaches is not vacuous.
  it('plays toms in the fill, and elsewhere only where a kit figure declares them', () => {
    const withKitToms = CANDIDATE.filter((feel) =>
      (feel.patterns?.kit ?? []).some((f) => (f.tomHigh ?? []).length + (f.tomLow ?? []).length > 0),
    )
    expect(withKitToms.map((f) => f.id), 'no candidate declares kit toms').toContain('second-line')

    for (const feel of CANDIDATE) {
      const { placed, music } = render(feel, 1)
      const fillBar = music.loopBars - 1
      const middle = middlePassOf(feel.passes)
      const declaresKitToms = withKitToms.includes(feel)

      if (feel.voices.some((voice) => TOMS.includes(voice))) {
        const inFill = [
          ...new Set(placed.filter((e) => e.bar === fillBar && TOMS.includes(e.voice)).map((e) => e.voice)),
        ].sort()
        expect(inFill, `${feel.id} fill plays no tom`).toEqual(['tomHigh', 'tomLow'])
      }

      if (!declaresKitToms) {
        for (let bar = 0; bar < fillBar; bar += 1) {
          const toms = placed.filter((e) => e.bar === bar && TOMS.includes(e.voice))
          expect(toms.length, `${feel.id} bar ${bar} plays a tom it never declared`).toBe(0)
        }
        continue
      }

      const inBarZero = [
        ...new Set([...stepsOf(placed, 'tomHigh', 0), ...stepsOf(placed, 'tomLow', 0)]),
      ]
        .sort((a, b) => a - b)
        .join(',')
      const figure = feel
        .patterns!.kit!.find((f) => kitTomSteps(feel, f).join(',') === inBarZero)
      expect(figure, `${feel.id} bar 0 sounds ${inBarZero}, which it never declared`).toBeDefined()
      const declared = kitTomSteps(feel, figure!)

      for (const bar of ordinaryBars(feel, music)) {
        const sounded = [
          ...new Set(placed.filter((e) => e.bar === bar && TOMS.includes(e.voice)).map((e) => e.step)),
        ].sort((a, b) => a - b)
        expect(sounded, `${feel.id} bar ${bar}`).toEqual(declared)
      }
      if (middle !== null) {
        const variation = middle * 4 + 3
        const toms = placed.filter((e) => e.bar === variation && TOMS.includes(e.voice))
        expect(toms.length, `${feel.id} variation bar ${variation} keeps a tom`).toBe(0)
      }
    }
  })

  it('puts both toms and the rim in every pass, and both toms in every ordinary bar', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      const passes = music.loopBars / music.bars

      for (let pass = 0; pass < passes; pass += 1) {
        const bars = new Set(
          Array.from({ length: music.bars }, (_, i) => pass * music.bars + i),
        )
        for (const voice of ['tomHigh', 'tomLow', 'rim'] as VoiceName[]) {
          const hits = placed.filter((e) => e.voice === voice && bars.has(e.bar))
          expect(hits.length, `seed ${seed} pass ${pass} plays no ${voice}`).toBeGreaterThan(0)
        }
      }

      for (const bar of ordinaryBars(secondLine, music)) {
        for (const voice of TOMS) {
          expect(
            placed.filter((e) => e.voice === voice && e.bar === bar).length,
            `seed ${seed} bar ${bar} plays no ${voice}`,
          ).toBeGreaterThan(0)
        }
      }
    }
  })

  it('mixes the toms and the rim inside a snare’s reach, and pans all three', () => {
    const snare = secondLine.gain.snare as number
    for (const voice of ['tomHigh', 'tomLow', 'rim'] as VoiceName[]) {
      expect(secondLine.voices, voice).toContain(voice)
      expect(typeof secondLine.gain[voice], `gain.${voice}`).toBe('number')
      expect(typeof secondLine.pan[voice], `pan.${voice}`).toBe('number')
      expect(
        Math.abs((secondLine.gain[voice] as number) - snare),
        `${voice} is more than 6 dB off the snare`,
      ).toBeLessThanOrEqual(6)
    }
  })

  it('clicks the rim in every bar of the pass, so a fill pass still has one', () => {
    expect(PLACEMENTS['second-line']?.rimBars).toEqual([0, 1, 2, 3])
    expect(PLACEMENTS['second-line']?.rim?.length).toBeGreaterThan(0)
  })
})

describe('second-line kick and bass — A6, A7, R4, AC4', () => {
  const kick = secondLine.patterns!.kick!
  const bass = secondLine.patterns!.bass!

  it('states a clave-ish kick, three to six hits, two of them off the beat', () => {
    expect(kick.length).toBeGreaterThanOrEqual(3)
    expect(kick.length).toBeLessThanOrEqual(4)
    expect(new Set(kick.map((f) => f.join(','))).size).toBe(kick.length)
    for (const figure of kick) {
      const where = figure.join(',')
      expect(figure.length, where).toBeGreaterThanOrEqual(3)
      expect(figure.length, where).toBeLessThanOrEqual(6)
      expect([...figure].sort((a, b) => a - b), where).toEqual(figure)
      expect(new Set(figure).size, where).toBe(figure.length)
      for (const step of figure) {
        expect(step, where).toBeGreaterThanOrEqual(0)
        expect(step, where).toBeLessThan(16)
      }
      expect(
        figure.filter((step) => step % 4 !== 0).length,
        `${where} only plays quarters, which is not a clave`,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('keeps one anchor set every kick figure states, starting on the downbeat', () => {
    const anchors = kick.reduce((shared, figure) => shared.filter((step) => figure.includes(step)))
    expect(anchors.length, 'the kick figures share no anchor').toBeGreaterThan(0)
    expect(anchors, 'the anchor set does not state the bar line').toContain(0)
  })

  it('plays the bass on anchors only, and never on the approach step', () => {
    expect(bass.length).toBeGreaterThanOrEqual(3)
    expect(bass.length).toBeLessThanOrEqual(4)
    for (const figure of bass) {
      const where = figure.join(',')
      expect(figure.length, where).toBeGreaterThan(0)
      for (const step of figure) {
        expect(step, where).toBeGreaterThanOrEqual(0)
        expect(step, where).toBeLessThan(16)
        for (const kicks of kick) {
          expect(kicks, `bass ${step} is outside kick ${kicks.join(',')}`).toContain(step)
        }
      }
      expect(figure, `${where} takes the chord approach's step`).not.toContain(15)
    }
  })

  it('lands every bass note on a kick, in every ordinary bar', () => {
    let inspected = 0
    let busiest = 0
    for (let seed = 1; seed <= 20; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      for (const bar of ordinaryBars(secondLine, music)) {
        inspected += 1
        const kicks = new Set(stepsOf(placed, 'kick', bar))
        const notes = placed.filter((e) => e.voice === 'bass' && e.bar === bar)
        busiest = Math.max(busiest, notes.length)
        for (const note of notes) {
          const ok = kicks.has(note.step) || note.step === secondLine.subdivision - 1
          expect(
            ok,
            `seed ${seed} bar ${bar}: bass on ${note.step}, kick on ${[...kicks].join(',')}`,
          ).toBe(true)
        }
      }
    }
    expect(inspected, 'the loop inspected too little to mean anything').toBeGreaterThan(12)
    expect(busiest, 'no bar carries a bass line worth checking').toBeGreaterThanOrEqual(3)
  })

  it('excludes exactly the fill bar and the variation bar', () => {
    const { music } = render(secondLine, 1)
    const bars = ordinaryBars(secondLine, music)
    expect(music.loopBars).toBe(16)
    expect(bars.length).toBe(14)
    const excluded = Array.from({ length: 16 }, (_, b) => b).filter((b) => !bars.includes(b))
    expect(excluded).toEqual([(middlePassOf(4) as number) * 4 + 3, (4 - 1) * 4 + 3])
  })
})

describe('second-line comp — A8, R6, AC6', () => {
  const RICHER = ['straight-funk', 'swung-sixteenth', 'bright-straight']

  it('declares one stab a figure, always off the beat', () => {
    const pool = secondLine.patterns!.comp!
    expect(pool.length).toBeGreaterThanOrEqual(3)
    expect(pool.length).toBeLessThanOrEqual(4)
    for (const figure of pool) {
      expect(figure, 'a comp figure carries exactly one onset').toHaveLength(1)
      expect(figure[0]).toBeGreaterThanOrEqual(0)
      expect(figure[0]).toBeLessThan(16)
      expect(figure[0] % 4, `stab on ${figure[0]} is on the beat`).not.toBe(0)
    }
  })

  it('draws the shared pool on the three feels it is measured against', () => {
    for (const id of RICHER) {
      expect(templateById(id).patterns?.comp, `${id} declares its own comp pool`).toBeUndefined()
    }
  })

  it('comps under every one of them, measured over 120 seeds', () => {
    const perBar = (feel: FeelTemplate) => {
      let low = Infinity
      let high = -Infinity
      for (let seed = 1; seed <= 120; seed += 1) {
        const { placed, music } = render(feel, seed)
        for (const bar of ordinaryBars(feel, music)) {
          const count = placed.filter((e) => e.voice === 'comp' && e.bar === bar).length
          low = Math.min(low, count)
          high = Math.max(high, count)
        }
      }
      return { low, high }
    }

    const mine = perBar(secondLine)
    for (const id of RICHER) {
      const theirs = perBar(templateById(id))
      expect(
        mine.high,
        `second-line comps ${mine.high} a bar, ${id} as few as ${theirs.low}`,
      ).toBeLessThan(theirs.low)
    }
  })
})

describe('second-line over the catalogue — R8, AC8', () => {
  const specs = readCatalogue().filter((spec) => spec.template === 'second-line')

  // A literal, and it has to be one. The shipped per-feel counts are uneven — the six
  // feels that predate this feature run 6, 6, 5, 5, 2 and 6 — so there is nothing in the
  // catalogue or the registry to derive six from. What the literal records is the mint's
  // decision: one rehearsal, six seeds, six grooves. The same shape bossa-nova.test.ts
  // pins for its own six. catalogue.test.ts asks only for more than zero, which a mint
  // of four would satisfy.
  it('mints exactly six grooves, each with its own seed', () => {
    expect(specs.map((spec) => spec.id)).toHaveLength(6)
    expect(new Set(specs.map((spec) => spec.seed)).size).toBe(6)
  })
})

describe('second-line harmony balance — the mix the harmony verdict bought', () => {
  // second-line was re-gained alongside boom-bap, on the same verdict — "the comp
  // (piano) is too quiet. Remember: this app is about finding the harmony" — and aimed
  // at the same target: straight-funk's own comp and bass, because straight-funk is a
  // drum-led feel the player has heard and passed. The whole kit moved by one uniform
  // 5 dB offset, so every relationship between two drums is still the one the mint
  // declared; what moved is the kit against the band.
  //
  // Asserted against straight-funk rather than against a number on purpose. A literal
  // would freeze an arithmetic result; this freezes the decision. Nothing else in this
  // file reads a gain as a level — the two gain assertions it has check a type and a
  // relationship to the snare, both of which a uniform kit offset preserves, so a comp
  // handed back 6 dB would go unremarked by every one of them.
  //
  // Tolerance. The six committed grooves spread about 2 dB between them (comp −4.03 …
  // −2.23 against the kick), so only the median reads the balance rather than one
  // groove's voicing. Measured today the medians are comp −2.61 / bass −5.15 against
  // straight-funk's −2.69 / −5.28: deviations of 0.08 and 0.13 dB.
  it('puts its comp and its bass where straight-funk puts them, over the six that shipped', async () => {
    const mine = await harmonyOverKick('second-line')
    const funk = await harmonyOverKick('straight-funk')

    for (const voice of ['comp', 'bass'] as const) {
      expect(
        Math.abs(mine[voice] - funk[voice]),
        `${voice} sits ${mine[voice].toFixed(2)} dB over the kick, against straight-funk's ${funk[voice].toFixed(2)} dB`,
      ).toBeLessThanOrEqual(ON_THE_LINE_DB)
    }
  }, 60_000)
})

describe('second-line fills — A9, R7, AC4, AC7', () => {
  const declared = FILLS['second-line']

  it('declares a fill and a variation of its own', () => {
    expect(declared).toBeDefined()
    expect(declared!.fill).toBeDefined()
    expect(declared!.variation).toBeDefined()
    expect(declared!.fill).not.toEqual(DEFAULT_FILL)
    expect(declared!.variation).not.toEqual(DEFAULT_FILL)
    const withoutToms = Object.fromEntries(
      Object.entries(DEFAULT_FILL).filter(([voice]) => !TOMS.includes(voice as VoiceName)),
    )
    expect(declared!.variation).not.toEqual(withoutToms)
  })

  it('rolls the snare past the default and answers with both toms', () => {
    expect(declared!.fill.snare!.length).toBeGreaterThan(DEFAULT_FILL.snare!.length)
    for (const voice of TOMS) expect(declared!.fill[voice], `fill has no ${voice}`).toBeDefined()
    for (const voice of TOMS) {
      expect(declared!.variation![voice], `variation keeps ${voice}`).toBeUndefined()
    }
    expect(declared!.fill.kick, 'the bar after the fill is position zero of the file').toContain(0)
  })

  it('names only voices it plays, and only voices the backing kit has', () => {
    for (const phrase of [declared!.fill, declared!.variation!]) {
      for (const voice of Object.keys(phrase) as VoiceName[]) {
        expect(secondLine.voices, `${voice} is not declared`).toContain(voice)
        expect(BACKING_VOICES, `${voice} is not a backing voice`).toContain(voice)
      }
      // Both phrases carry an accent on a quarter, for the same reason a kit figure
      // does: the loudest snare of a bar has to sit on one.
      expect(phrase.snare!.some((step) => step % 4 === 0)).toBe(true)
    }
  })

  it('marks the middle pass more lightly than it fills', () => {
    const distance = (a: string[], b: string[]) => {
      const left = new Set(a)
      const right = new Set(b)
      return (
        [...left].filter((k) => !right.has(k)).length +
        [...right].filter((k) => !left.has(k)).length
      )
    }
    const DRUMS: VoiceName[] = ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow']

    for (let seed = 1; seed <= 4; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      const keys = (bar: number) =>
        placed
          .filter((e) => e.bar === bar && DRUMS.includes(e.voice) && !isGhost(e, secondLine, music))
          .map((e) => `${e.voice}@${e.step}`)
          .sort()
      const fillBar = music.loopBars - 1
      const variationBar = (middlePassOf(secondLine.passes) as number) * 4 + 3
      const ordinary = keys(variationBar % 4)

      const toVariation = distance(keys(variationBar), ordinary)
      const toFill = distance(keys(fillBar), ordinary)
      expect(toVariation, `seed ${seed} does not mark its middle`).toBeGreaterThan(0)
      expect(toVariation, `seed ${seed} marks its middle as heavily as it fills`).toBeLessThan(toFill)
    }
  })

  // The claim above is a property of the *draw*, not of the seed. A loop draws one kit
  // figure, one kick figure and one hat figure and keeps all three for every ordinary
  // bar, so there are 4 × 4 × 3 = 48 ordinary bars this feel can render and the claim
  // either holds on each of them or it does not. Both committed copies of it — the case
  // above and `events.test.ts › marks the last bar of the middle pass more lightly than
  // the fill` — run seeds 1–4, which reach four of the 48. The tightest combination is
  // under test only because seed 2 happens to draw it; reordering a pool would move that
  // and nothing would go red. This walks seeds until every combination has been drawn
  // once and checks it on each, so the property is protected by the property rather than
  // by a coincidence. The failure the fix in events.ts repaired ran at 107 of 400 seeds.
  //
  // Both classifiers, because they disagree here and the disagreement is the point.
  // Under this file's duration split the fill sits 3 to 11 marks further from an
  // ordinary bar than the variation does; under the canonical velocity split it is 1 to
  // 11, and that 1 — the combination seed 2 draws — is the whole of the margin. A change
  // that held one reading and broke the other would be a change in what a ghost is.
  it('marks it more lightly at every one of the 48 figures it can draw', () => {
    const pools = secondLine.patterns!
    const COMBINATIONS = pools.kit!.length * pools.kick!.length * pools.hatClosed!.length
    const SEED_LIMIT = 400

    const DRUMS: VoiceName[] = ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow']
    const distance = (a: string[], b: string[]) => {
      const left = new Set(a)
      const right = new Set(b)
      return (
        [...left].filter((k) => !right.has(k)).length + [...right].filter((k) => !left.has(k)).length
      )
    }

    const seen = new Set<string>()
    let tightest = Infinity

    for (let seed = 1; seed <= SEED_LIMIT && seen.size < COMBINATIONS; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      const fillBar = music.loopBars - 1
      const variationBar = (middlePassOf(secondLine.passes) as number) * 4 + 3
      const ordinaryBar = variationBar % 4

      const drawn = (voice: VoiceName) =>
        [
          ...new Set(
            placed
              .filter(
                (e) =>
                  e.voice === voice &&
                  e.bar === ordinaryBar &&
                  !isGhost(e, secondLine, music),
              )
              .map((e) => e.step),
          ),
        ]
          .sort((a, b) => a - b)
          .join(',')
      const combination = `${drawn('snare')}/${drawn('kick')}/${drawn('hatClosed')}`
      if (seen.has(combination)) continue
      seen.add(combination)

      for (const [reading, ghost] of [
        ['duration', (e: Placed) => isGhost(e, secondLine, music)],
        [
          'velocity',
          (e: Placed) => e.voice === 'snare' && e.velocity < GHOST_VELOCITY_THRESHOLD,
        ],
      ] as const) {
        const keys = (bar: number) =>
          placed
            .filter((e) => e.bar === bar && DRUMS.includes(e.voice) && !ghost(e))
            .map((e) => `${e.voice}@${e.step}`)
            .sort()
        const ordinary = keys(ordinaryBar)
        const toVariation = distance(keys(variationBar), ordinary)
        const toFill = distance(keys(fillBar), ordinary)
        const where = `${reading}, figures ${combination} (seed ${seed})`

        expect(toVariation, `${where} does not mark its middle`).toBeGreaterThan(0)
        expect(toVariation, `${where} marks its middle as heavily as it fills`).toBeLessThan(toFill)
        tightest = Math.min(tightest, toFill - toVariation)
      }
    }

    expect(
      seen.size,
      `only ${seen.size} of ${COMBINATIONS} draws in ${SEED_LIMIT} seeds — the sweep no longer exhausts the pools`,
    ).toBe(COMBINATIONS)
    expect(tightest, 'the margin is an integer count of marks and cannot be under one').toBeGreaterThanOrEqual(1)
  })

  it('sounds the phrase’s kick in the fill and the variation, where the bass-follows-kick claim does not apply', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      const fillBar = music.loopBars - 1
      const variationBar = (middlePassOf(secondLine.passes) as number) * 4 + 3
      const drawn = stepsOf(placed, 'kick', 0)

      for (const [bar, phrase] of [
        [fillBar, declared!.fill],
        [variationBar, declared!.variation!],
      ] as const) {
        const expected = gridSteps(phrase.kick!, secondLine.subdivision)
        expect(stepsOf(placed, 'kick', bar), `seed ${seed} bar ${bar}`).toEqual(expected)
        expect(stepsOf(placed, 'snare', bar), `seed ${seed} bar ${bar}`).toEqual(
          gridSteps(phrase.snare!, secondLine.subdivision),
        )
        expect(
          placed.filter((e) => e.voice === 'bass' && e.bar === bar).length,
          `seed ${seed} bar ${bar} drops the bass`,
        ).toBeGreaterThan(0)
        expect(
          placed.filter((e) => e.voice === 'comp' && e.bar === bar).length,
          `seed ${seed} bar ${bar} drops the comp`,
        ).toBeGreaterThan(0)
      }

      expect(
        stepsOf(placed, 'kick', fillBar),
        `seed ${seed} fills with the drawn figure`,
      ).not.toEqual(drawn)
    }
  })
})

describe('second-line declares itself — A10, R1, R2, AC1, AC2', () => {
  it('takes a swing, a tempo range, a mix and a feel nobody else holds', () => {
    const unique = (keys: string[]) => expect(new Set(keys).size).toBe(CANDIDATE.length)
    unique(CANDIDATE.map((t) => t.id))
    unique(CANDIDATE.map((t) => String(t.swing)))
    unique(CANDIDATE.map((t) => t.tempoRange.join('-')))
    unique(CANDIDATE.map((t) => JSON.stringify([t.gain, t.pan])))
    unique(CANDIDATE.map((t) => JSON.stringify(t.humanize)))
    unique(CANDIDATE.map((t) => JSON.stringify(t.density)))
  })

  it('stays inside the lane the feature reserved for it', () => {
    expect(secondLine.tempoRange[0]).toBeGreaterThanOrEqual(84)
    expect(secondLine.tempoRange[1]).toBeLessThanOrEqual(98)
    expect(secondLine.tempoRange[0]).toBeLessThan(secondLine.tempoRange[1])
    expect(secondLine.swing).toBeGreaterThanOrEqual(0.2)
    expect(secondLine.swing).toBeLessThanOrEqual(0.26)
    expect(secondLine.subdivision).toBe(16)
    expect(secondLine.passes).toBe(4)
  })

  it('carries two to four distinct modes the game already offers', () => {
    expect(secondLine.flavours.length).toBeGreaterThanOrEqual(2)
    expect(secondLine.flavours.length).toBeLessThanOrEqual(4)
    expect(new Set(secondLine.flavours).size).toBe(secondLine.flavours.length)
    for (const flavour of secondLine.flavours) {
      expect(FLAVOURS as string[], `${flavour} is not a flavour the game names`).toContain(flavour)
    }
    // Frozen the moment the first groove is minted: pick indexes this list.
    expect([...secondLine.flavours].sort()).toEqual([
      'blues',
      'harmonic-major',
      'ionian',
      'mixolydian',
    ])
    const offered = new Set(allTemplates().flatMap((t) => t.flavours))
    for (const flavour of secondLine.flavours) expect(offered).toContain(flavour)
  })

  it('plays a hat-led kit with no ride and nothing in the soloist’s way', () => {
    expect(secondLine.voices).toEqual([
      'kick',
      'snare',
      'hatClosed',
      'hatOpen',
      'rim',
      'tomHigh',
      'tomLow',
      'bass',
      'comp',
    ])
    for (const voice of ['ride', 'rideBell', 'claves', 'cowbell', 'bongoHigh', 'bongoLow']) {
      expect(secondLine.voices, `${voice} is not this kit`).not.toContain(voice)
    }
  })

  it('declares five pools and no fixed figure', () => {
    expect(Object.keys(secondLine.patterns!).sort()).toEqual([
      'bass',
      'comp',
      'hatClosed',
      'kick',
      'kit',
      'snareGhosts',
    ])
    expect(secondLine.figures).toBeUndefined()
  })

  it('gives every voice it plays a gain and a pan, and names no other', () => {
    for (const voice of secondLine.voices) {
      expect(typeof secondLine.gain[voice], `gain.${voice}`).toBe('number')
      expect(typeof secondLine.pan[voice], `pan.${voice}`).toBe('number')
      expect(Math.abs(secondLine.pan[voice] as number), `pan.${voice}`).toBeLessThanOrEqual(1)
    }
    for (const voice of [...Object.keys(secondLine.gain), ...Object.keys(secondLine.pan)]) {
      expect(secondLine.voices, `mixes ${voice}, which it never plays`).toContain(voice)
    }
  })

  it('drags the snare, pushes the hats, and leans nothing it does not play', () => {
    const lean = secondLine.humanize.lean
    expect(lean.snare as number).toBeGreaterThan(0)
    for (const hat of ['hatClosed', 'hatOpen'] as const) {
      expect(lean[hat] ?? 0, `${hat} does not push`).toBeLessThanOrEqual(0)
    }
    for (const voice of Object.keys(lean)) {
      expect(secondLine.voices, `leans ${voice}, which it never plays`).toContain(voice)
    }
    expect(secondLine.humanize.driftDepth).toBeGreaterThan(0)
    expect(secondLine.humanize.driftDepth).toBeLessThanOrEqual(0.01)
    // A snare tap on an odd sixteenth is 0.45 and every velocity-based reading splits
    // at 0.5, so a wider bound would make the same tap read differently bar to bar.
    expect(secondLine.humanize.velocity, 'a tap could cross the ghost threshold').toBeLessThan(0.05)
  })

  it('renders every seed as the feel it declares', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { music } = render(secondLine, seed)
      expect(secondLine.flavours as string[]).toContain(music.flavour)
      expect(music.bpm).toBeGreaterThanOrEqual(secondLine.tempoRange[0])
      expect(music.bpm).toBeLessThanOrEqual(secondLine.tempoRange[1])
      expect(music.loopBars).toBe(4 * secondLine.passes)
    }
  })

  it('plays every voice it declares, and no other', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { placed } = render(secondLine, seed)
      const played = new Set(placed.map((e) => e.voice))
      for (const voice of secondLine.voices) expect(played, `seed ${seed}`).toContain(voice)
      for (const voice of played) expect(secondLine.voices, `seed ${seed}`).toContain(voice)
    }
  })
})

describe('second-line density — A11, R9, AC9', () => {
  // Seeds 1–120, the measurement the band was set from. The wider sweep the band was
  // actually cut to — 120 000 seeds over three ranges — finds 21.313 and 29.25, and
  // those numbers are what the floor and the ceiling clear. Both rose 0.125 when the
  // fill took a second low tom and the variation took the rim back: two events over a
  // sixteen-bar loop, and the extremes are still the same two seeds.
  const MEASURED = { min: 22.375, max: 28.0625, mean: 25.414 }

  // Pinned literals, deliberately, and this is the note that makes them re-derivable.
  // The sweep behind them is 120 000 renders — 40 000 seeds from each of the bases 0,
  // 1 000 000 and 1 700 000 000 — which is minutes of work and no business of a unit
  // test; the two cases below re-render the two extreme seeds instead, one render each,
  // so the pinned numbers are checked rather than merely written down. What that cannot
  // catch is a pool edit that moves the true extreme to some other seed: that needs the
  // sweep re-run, not this file re-run. Re-derive with
  //   for (const base of [0, 1_000_000, 1_700_000_000])
  //     for (let i = 0; i < 40_000; i += 1) render(secondLine, base + i)
  // and take min and max of `placed.length / music.loopBars`.
  const SWEPT = {
    min: 21.3125,
    minSeed: 1_700_010_315,
    max: 29.25,
    maxSeed: 35_187,
  }

  it('declares the measured band as a literal', () => {
    expect(secondLine.density).toEqual({ minPerBar: 21, maxPerBar: 30 })
    const span = secondLine.density.maxPerBar - secondLine.density.minPerBar
    const funk = templateById('straight-funk').density
    expect(span, 'wider than straight-funk is not how this band got wide').toBeLessThanOrEqual(
      funk.maxPerBar - funk.minPerBar,
    )
  })

  it('renders every one of 120 seeds inside it, at the extremes it was cut from', () => {
    let low = Infinity
    let high = -Infinity
    for (let seed = 1; seed <= 120; seed += 1) {
      const { placed, music } = render(secondLine, seed)
      const perBar = placed.length / music.loopBars
      low = Math.min(low, perBar)
      high = Math.max(high, perBar)
    }
    expect(low).toBeCloseTo(MEASURED.min, 3)
    expect(high).toBeCloseTo(MEASURED.max, 3)
    expect(low).toBeGreaterThanOrEqual(secondLine.density.minPerBar)
    expect(high).toBeLessThanOrEqual(secondLine.density.maxPerBar)
  })

  // The floor is tight against the sparsest groove this feel can render, not against the
  // sparsest of the first 120 seeds: four voices sound exactly once in every ordinary
  // bar — hatOpen, rim, tomHigh, tomLow — so losing any one of their lines costs one
  // event a bar, and the floor sits 0.31 under the swept minimum.
  it('sits close enough under its sparsest groove that a missing voice falls out', () => {
    const { placed, music } = render(secondLine, SWEPT.minSeed)
    const perBar = placed.length / music.loopBars
    expect(perBar).toBeCloseTo(SWEPT.min, 3)

    const everyBar = new Map<VoiceName, number>()
    for (const voice of secondLine.voices) {
      const counts = ordinaryBars(secondLine, music).map(
        (bar) => placed.filter((e) => e.voice === voice && e.bar === bar).length,
      )
      if (counts.some((count) => count === 0)) continue
      everyBar.set(voice, Math.min(...counts))
    }
    const sparsest = Math.min(...everyBar.values())
    expect(sparsest, 'no voice sounds in every ordinary bar').toBeGreaterThan(0)
    expect(
      perBar - secondLine.density.minPerBar,
      `floor ${secondLine.density.minPerBar} is more than ${sparsest} under the sparsest groove ${perBar}`,
    ).toBeLessThan(sparsest)
  })

  // The ceiling half of the same pin, and the reason the band ends at 30 rather than at
  // the 29 the 120-seed formula gives: the thickest groove this feel can render measures
  // 29.25, so a ceiling of 29 would have rejected a legitimate second-line at mint time,
  // which R9 forbids. Nothing asserted that number before — the case above re-rendered
  // the sparsest seed and the densest was written down and left. One render.
  it('renders its thickest groove under a ceiling no lower one would clear', () => {
    const { placed, music } = render(secondLine, SWEPT.maxSeed)
    const perBar = placed.length / music.loopBars
    expect(perBar).toBeCloseTo(SWEPT.max, 3)
    expect(perBar, `ceiling ${secondLine.density.maxPerBar}`).toBeLessThanOrEqual(
      secondLine.density.maxPerBar,
    )
    expect(
      perBar,
      `${secondLine.density.maxPerBar} is no longer the smallest integer ceiling the sweep clears`,
    ).toBeGreaterThan(secondLine.density.maxPerBar - 1)
  })
})
