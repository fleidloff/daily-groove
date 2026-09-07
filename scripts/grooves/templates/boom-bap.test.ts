import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import type { FeelTemplate, SamplePack, VoiceName } from '../types.ts'
import { FLAVOURS } from '../../../src/lib/theory/names.ts'
import { readCatalogue } from '../catalogue.ts'
import {
  FILLS,
  GHOST_VELOCITY_THRESHOLD,
  PLACEMENTS,
  buildEvents,
  middlePassOf,
} from '../events.ts'
import { rmsDbfs } from '../level.ts'
import { loadPack } from '../pack.ts'
import { assertPatterns } from '../patterns.ts'
import { renderVoices } from '../voices.ts'
import { TEMPLATES, allTemplates, templateById } from './index.ts'
import { boomBap } from './boom-bap.ts'

// Track A checked every whole-registry rule against the registry boom-bap would join,
// so Track E's registration was one line and not a debugging session inside a file two
// other epics are appending to. boomBap is now in `allTemplates()` itself.
const CANDIDATE: FeelTemplate[] = allTemplates()

// Both assertions below are about what the *rest* of the registry declares, so they
// have to exclude boom-bap itself now that it is in it.
function others(): FeelTemplate[] {
  return allTemplates().filter((t) => t.id !== boomBap.id)
}

const UUID = '00000000-0000-4000-8000-000000000000'

function halfStepMs(subdivision: number, topBpm: number): number {
  return (((60 / topBpm) * 4) / subdivision) * 500
}

function render(feel: FeelTemplate, seed: number) {
  return buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
}

// A comp event is one note of a voicing, so raw event counts measure the voicing.
// Onsets are what the figure sets: distinct sixteenths, per bar.
function compOnsetsPerBar(feel: FeelTemplate, seed: number): number[] {
  const { events, music } = render(feel, seed)
  const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
  const bars: Set<number>[] = Array.from({ length: music.loopBars }, () => new Set<number>())
  for (const event of events) {
    if (event.voice !== 'comp') continue
    const grid = Math.round(event.timeSec / stepSec)
    bars[Math.floor(grid / feel.subdivision)].add(grid % feel.subdivision)
  }
  return bars.map((bar) => bar.size)
}

const SAMPLE_RATE = 44100
const OVERHANG_BARS = 1

// How far the median comp and bass may sit from straight-funk's own before the mix the
// listening verdict bought has been given back. Reasoning at the assertion.
const ON_THE_LINE_DB = 1.5

let samples: Promise<SamplePack> | null = null
function pack(): Promise<SamplePack> {
  samples ??= loadPack(fileURLToPath(new URL('../samples', import.meta.url)))
  return samples
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const half = sorted.length / 2
  return sorted.length % 2 === 1
    ? sorted[Math.floor(half)]
    : (sorted[half - 1] + sorted[half]) / 2
}

// The measurement a mix balance is actually made of, and the one the re-gain was set
// from: post-gain track RMS against the kick, per committed groove, median over the
// feel's own six. It is not the gain block — a comp that stabs once a bar measures
// about 3 dB under a comp that plays two at the same gain, which is why the declared
// numbers cannot be compared across feels. Pan drops out: cos²+sin² is 1, so panning a
// track moves no energy.
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

describe('boom-bap — A1, R1, AC1', () => {
  it('is a swung-sixteenth feel at 86–92, and it is registered', () => {
    expect(boomBap.id).toBe('boom-bap')
    expect(boomBap.subdivision).toBe(16)
    expect(boomBap.tempoRange[0]).toBeGreaterThanOrEqual(85)
    expect(boomBap.tempoRange[1]).toBeLessThanOrEqual(95)
    expect(boomBap.tempoRange[1]).toBeLessThanOrEqual(92)
    expect(boomBap.tempoRange[0]).toBeLessThan(boomBap.tempoRange[1])
    expect(boomBap.swing).toBeGreaterThanOrEqual(0.3)
    expect(boomBap.swing).toBeLessThanOrEqual(0.4)
    expect(TEMPLATES['boom-bap'], 'registered by Track E').toBe(boomBap)
  })

  it('leaves two bpm of daylight under straight-funk’s floor', () => {
    expect(boomBap.tempoRange[1]).toBeLessThan(templateById('straight-funk').tempoRange[0])
  })

  it('takes an id, a swing, a tempo range, a mix and a feel nobody else holds', () => {
    const unique = (keys: string[]) => expect(new Set(keys).size).toBe(CANDIDATE.length)
    unique(CANDIDATE.map((t) => t.id))
    unique(CANDIDATE.map((t) => String(t.swing)))
    unique(CANDIDATE.map((t) => t.tempoRange.join('-')))
    unique(CANDIDATE.map((t) => JSON.stringify([t.gain, t.pan])))
    unique(CANDIDATE.map((t) => JSON.stringify(t.humanize)))
  })

  it('edits no line of events.ts — no placement, no fill of its own', () => {
    expect(PLACEMENTS['boom-bap']).toBeUndefined()
    expect(FILLS['boom-bap']).toBeUndefined()
    expect(() => assertPatterns(boomBap, PLACEMENTS)).not.toThrow()
  })

  // `withoutToms(DEFAULT_FILL)` is the default variation, so a kit with no toms makes
  // the variation identical to the fill it thins. Two passes declare no middle pass,
  // so the loop carries one fill bar rather than two identical ones.
  it('declares no variation bar it could not tell from its fill', () => {
    for (const voice of ['tomHigh', 'tomLow'] as VoiceName[]) {
      expect(boomBap.voices).not.toContain(voice)
    }
    expect(middlePassOf(boomBap.passes)).toBeNull()
  })
})

describe('boom-bap flavours — A2, R2, AC2', () => {
  it('carries three distinct modes the game already offers', () => {
    expect(boomBap.flavours.length).toBeGreaterThanOrEqual(2)
    expect(boomBap.flavours.length).toBeLessThanOrEqual(4)
    expect(new Set(boomBap.flavours).size).toBe(boomBap.flavours.length)
    for (const flavour of boomBap.flavours) {
      expect(FLAVOURS as string[], `${flavour} is not a flavour the game names`).toContain(
        flavour,
      )
    }
  })

  // Frozen the moment the first groove is minted: `pick` indexes this list, so a
  // later edit re-renders and re-answers every boom-bap groove.
  it('names the three in a frozen list', () => {
    expect([...boomBap.flavours].sort()).toEqual(['aeolian', 'dorian', 'phrygian'])
  })

  it('adds no mode the registry does not already offer', () => {
    const offered = new Set(allTemplates().flatMap((t) => t.flavours))
    for (const flavour of boomBap.flavours) expect(offered).toContain(flavour)
  })
})

describe('boom-bap mix — A3, R3, AC3', () => {
  it('gives every voice it plays a gain and a pan, and names no other', () => {
    for (const voice of boomBap.voices) {
      expect(typeof boomBap.gain[voice], `gain.${voice}`).toBe('number')
      expect(typeof boomBap.pan[voice], `pan.${voice}`).toBe('number')
      expect(Math.abs(boomBap.pan[voice] as number), `pan.${voice}`).toBeLessThanOrEqual(1)
    }
    for (const voice of [...Object.keys(boomBap.gain), ...Object.keys(boomBap.pan)]) {
      expect(boomBap.voices, `mixes ${voice}, which it never plays`).toContain(voice)
    }
  })

  // Both assertions this replaces asserted the drum-forward inversion — kick and snare
  // over every voice including the bass — as boom-bap's identity. A listening pass on
  // groove-71 … groove-76 rejected it: the comp and the bass are the two voices that
  // carry the answer this app asks the player to hear, and at comp -15.0 dB and bass
  // -16.1 dB against the kick they did not carry it. The claim below is the half of the
  // old one that survives.
  it('leads its kit with the kick and the snare', () => {
    const drums = Math.min(boomBap.gain.kick as number, boomBap.gain.snare as number)
    for (const voice of ['hatClosed', 'hatOpen'] as VoiceName[]) {
      expect(
        drums,
        `${voice} at ${boomBap.gain[voice]} is not below the drums at ${drums}`,
      ).toBeGreaterThan(boomBap.gain[voice] as number)
    }
  })

  // One-sided on purpose. A gain number is not a level: boom-bap's comp plays one stab a
  // bar where every other feel's draws two or more onsets, so its comp track measures
  // about 3 dB quieter than another feel's at the same gain, and its gain has to run
  // correspondingly higher to reach the same balance. What can be checked here is the
  // floor — that the harmony is no longer mixed below every other feel's. The mint
  // failed both of these; the measured figures behind them are in
  // specs/features/feature-25/.implement/harmony-regain.md.
  it('no longer mixes its harmony below the rest of the registry', () => {
    const overKick = (feel: FeelTemplate, voice: 'comp' | 'bass') =>
      (feel.gain[voice] as number) - (feel.gain.kick as number)

    for (const voice of ['comp', 'bass'] as const) {
      const floor = Math.min(...others().map((feel) => overKick(feel, voice)))
      expect(
        overKick(boomBap, voice),
        `${voice} sits ${overKick(boomBap, voice).toFixed(1)} dB over the kick, under every other feel's ${floor.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(floor)
    }
  })

  // The floor above is a floor: `gain.comp` could fall 6.4 dB from where it sits and
  // still clear it, which is most of the change the verdict bought given back without
  // a test going red. This is the balance itself, and it is asserted against
  // `straight-funk` rather than against a number on purpose — straight-funk is a
  // drum-led feel the player has heard and passed, and "the harmony sits where it sits
  // in a groove you approved" is the claim the re-gain was actually aimed at. A bare
  // literal would freeze an arithmetic result; this freezes the decision.
  //
  // Tolerance. The six committed grooves spread about 4 dB between them (comp −3.84 …
  // +0.23 against the kick), so only the median reads the balance rather than one
  // groove's voicing. Re-measured on the picked electric bass feature-27 swapped in,
  // the medians are comp −2.42 / bass −5.19 against straight-funk's −2.69 / −5.25:
  // deviations of 0.27 and 0.07 dB. The larger is still the comp's, which the bass swap
  // did not touch, and it is the same 0.27 dB the contrabass measured — so 1.5 dB is
  // five times the larger of the two and leaves 1.23 dB of room above it, still four
  // times tighter than the floor's slack.
  it('puts its comp and its bass where straight-funk puts them, over the six that shipped', async () => {
    const mine = await harmonyOverKick('boom-bap')
    const funk = await harmonyOverKick('straight-funk')

    for (const voice of ['comp', 'bass'] as const) {
      expect(
        Math.abs(mine[voice] - funk[voice]),
        `${voice} sits ${mine[voice].toFixed(2)} dB over the kick, against straight-funk's ${funk[voice].toFixed(2)} dB`,
      ).toBeLessThanOrEqual(ON_THE_LINE_DB)
    }
  }, 60_000)
})

describe('boom-bap ghosts — A4, R3, R4, AC3', () => {
  it('declares a pool of one to four odd sixteenths, with more than one figure', () => {
    const pool = boomBap.patterns?.snareGhosts
    expect(Array.isArray(pool)).toBe(true)
    expect(pool!.length, 'ghostsForBar draws per bar, so one figure means one bar').toBeGreaterThan(
      1,
    )
    expect(new Set(pool!.map((f) => f.join(','))).size).toBe(pool!.length)
    for (const figure of pool!) {
      expect(figure.length).toBeGreaterThanOrEqual(1)
      expect(figure.length).toBeLessThanOrEqual(4)
      expect([...figure].sort((a, b) => a - b), 'not ascending').toEqual(figure)
      expect(new Set(figure).size, 'repeats a step').toBe(figure.length)
      for (const step of figure) {
        expect(step).toBeGreaterThanOrEqual(0)
        expect(step).toBeLessThan(16)
        // ghostSteps snaps to an odd step; an even one declared here would move.
        expect(step % 2, `step ${step} is even and would be snapped`).toBe(1)
      }
    }
  })

  it('sounds every ghost under every backbeat, with 0.2 of velocity to spare', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { events, music } = render(boomBap, seed)
      const stepSec = ((60 / music.bpm) * 4) / boomBap.subdivision
      const snares = events.filter((e) => e.voice === 'snare')
      // A ghost is one sixteenth long; a placed or filled snare is two.
      const ghosts = snares.filter((e) => e.durationSec < stepSec * 1.5)
      const struck = snares.filter((e) => e.durationSec >= stepSec * 1.5)

      expect(ghosts.length, `seed ${seed} has no ghosts`).toBeGreaterThan(0)
      expect(struck.length, `seed ${seed} has no backbeat`).toBeGreaterThan(0)

      const loudestGhost = Math.max(...ghosts.map((e) => e.velocity))
      const quietestStruck = Math.min(...struck.map((e) => e.velocity))
      expect(loudestGhost, `seed ${seed}`).toBeLessThan(quietestStruck)
      expect(quietestStruck - loudestGhost, `seed ${seed} margin`).toBeGreaterThanOrEqual(0.2)

      // The duration split and the velocity threshold agree, so events.ts' own
      // classifier reads this feel the way the mix does.
      expect(loudestGhost, `seed ${seed}`).toBeLessThan(GHOST_VELOCITY_THRESHOLD)
      expect(quietestStruck, `seed ${seed}`).toBeGreaterThan(GHOST_VELOCITY_THRESHOLD)
    }
  })
})

describe('boom-bap over the catalogue — A4, R3, R4, R6, AC3, AC5', () => {
  const specs = readCatalogue().filter((spec) => spec.template === 'boom-bap')

  // A literal, and it has to be one. The shipped per-feel counts are uneven — the six
  // feels that predate this feature run 6, 6, 5, 5, 2 and 6 — so there is nothing in
  // the catalogue or the registry to derive six from. What the literal records is the
  // mint's decision: one rehearsal, six seeds, six grooves. The same shape
  // bossa-nova.test.ts pins for its own six. catalogue.test.ts asks only for more than
  // zero, which a mint of four would satisfy.
  it('mints exactly six grooves, each with its own seed — R6, AC5', () => {
    expect(specs.map((spec) => spec.id)).toHaveLength(6)
    expect(new Set(specs.map((spec) => spec.seed)).size).toBe(6)
  })

  // Frozen by the rehearsal that minted them: these six seeds off start seed 1981233041
  // are what `commit` wrote, and re-issuing any of them re-answers a puzzle a player may
  // already have played.
  it('mints them on the six seeds the rehearsal committed', () => {
    expect(specs.map((spec) => spec.seed)).toEqual([
      1981233047, 1981233050, 1981233052, 1981233055, 1981233063, 1981233067,
    ])
  })

  // The ghost claim above runs on seeds 1–40, none of which is a groove anybody can
  // play. This is the same claim, at the same margin, on the six that actually shipped —
  // the gate checks peak, silence, seam, harmony, pitch, density and loudness, and none
  // of those is ghost separation.
  //
  // Classified by duration, deliberately, and it is the same reading the case above
  // takes: a ghost is one sixteenth, a placed or filled snare is two.
  // GHOST_VELOCITY_THRESHOLD is the canonical reading and it is correct for this feel —
  // boom-bap declares no `patterns.kit`, so no snare of its is nominally 0.45 the way
  // second-line's figure notes are — so both are asserted, and their agreeing is itself
  // the claim that the mix and events.ts read this feel the same way.
  it('sounds every ghost under every backbeat on the six that shipped', () => {
    for (const spec of specs) {
      const { events, music } = buildEvents(spec, boomBap)
      const stepSec = ((60 / music.bpm) * 4) / boomBap.subdivision
      const snares = events.filter((e) => e.voice === 'snare')
      const ghosts = snares.filter((e) => e.durationSec < stepSec * 1.5)
      const struck = snares.filter((e) => e.durationSec >= stepSec * 1.5)

      expect(ghosts.length, `${spec.id} has no ghosts`).toBeGreaterThan(0)
      expect(struck.length, `${spec.id} has no backbeat`).toBeGreaterThan(0)

      const loudestGhost = Math.max(...ghosts.map((e) => e.velocity))
      const quietestStruck = Math.min(...struck.map((e) => e.velocity))
      expect(
        quietestStruck - loudestGhost,
        `${spec.id} margin: ghost ${loudestGhost.toFixed(3)} against backbeat ${quietestStruck.toFixed(3)}`,
      ).toBeGreaterThanOrEqual(0.2)

      expect(loudestGhost, spec.id).toBeLessThan(GHOST_VELOCITY_THRESHOLD)
      expect(quietestStruck, spec.id).toBeGreaterThan(GHOST_VELOCITY_THRESHOLD)
    }
  })
})

describe('boom-bap comp — A5, R5, AC4', () => {
  it('declares single-step figures only', () => {
    const pool = boomBap.patterns?.comp
    expect(Array.isArray(pool)).toBe(true)
    expect(pool!.length).toBeGreaterThan(0)
    for (const figure of pool!) {
      expect(figure, 'a comp figure carries exactly one onset').toHaveLength(1)
      expect(figure[0]).toBeGreaterThanOrEqual(0)
      expect(figure[0]).toBeLessThan(16)
    }
  })

  it('stabs once a bar where the three named feels play two or three', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const count of compOnsetsPerBar(boomBap, seed)) {
        expect(count, `boom-bap seed ${seed}`).toBe(1)
      }
      for (const id of ['straight-funk', 'swung-sixteenth', 'bright-straight']) {
        const feel = templateById(id)
        for (const count of compOnsetsPerBar(feel, seed)) {
          expect(count, `${id} seed ${seed}`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })
})

describe('boom-bap kick — R1', () => {
  it('declares three to five steps a figure, every one stating the downbeat', () => {
    const pool = boomBap.patterns?.kick
    expect(Array.isArray(pool)).toBe(true)
    expect(new Set(pool!.map((f) => f.join(','))).size).toBe(pool!.length)
    for (const figure of pool!) {
      expect(figure.length).toBeGreaterThanOrEqual(3)
      expect(figure.length).toBeLessThanOrEqual(5)
      expect([...figure].sort((a, b) => a - b)).toEqual(figure)
      expect(new Set(figure).size).toBe(figure.length)
      expect(figure[0], 'every bar starts with the boom').toBe(0)
      for (const step of figure) {
        expect(step).toBeGreaterThanOrEqual(0)
        expect(step).toBeLessThan(16)
      }
      expect(
        figure.some((step) => step % 2 === 1),
        `${figure.join(',')} lands on no swung sixteenth`,
      ).toBe(true)
    }
  })
})

describe('boom-bap density — A6, R7, AC6', () => {
  it('declares a band no registered template already holds', () => {
    expect(boomBap.density).toEqual({ minPerBar: 17, maxPerBar: 33 })
    const bands = others().map((t) => JSON.stringify(t.density))
    expect(bands, 'another feel already declares this band').not.toContain(
      JSON.stringify(boomBap.density),
    )
  })

  it('lands every seed inside it, with 1.5 events a bar of margin at both ends', () => {
    let low = Infinity
    let high = -Infinity
    for (let seed = 1; seed <= 200; seed += 1) {
      const { events, music } = render(boomBap, seed)
      const perBar = events.length / music.loopBars
      low = Math.min(low, perBar)
      high = Math.max(high, perBar)
    }
    expect(low - boomBap.density.minPerBar, `measured floor ${low}`).toBeGreaterThanOrEqual(1.5)
    expect(boomBap.density.maxPerBar - high, `measured ceiling ${high}`).toBeGreaterThanOrEqual(
      1.5,
    )
  })
})

describe('the registry — A7, R1, R2, AC1', () => {
  it('gives every template a closed hat, and an open one unless it rides', () => {
    for (const feel of CANDIDATE) {
      expect(feel.voices, `${feel.id} plays no closed hat`).toContain('hatClosed')
      if (feel.voices.includes('ride') || feel.id === 'bossa-nova') continue
      expect(feel.voices, `${feel.id} plays no open hat`).toContain('hatOpen')
    }
    expect(boomBap.voices).not.toContain('ride')
    expect(boomBap.voices).toContain('hatOpen')
  })

  it('plays drums, a bass and a comp, and names no voice twice', () => {
    for (const feel of CANDIDATE) {
      for (const voice of ['kick', 'snare', 'hatClosed', 'bass', 'comp'] as VoiceName[]) {
        expect(feel.voices, feel.id).toContain(voice)
      }
      expect(new Set(feel.voices).size, feel.id).toBe(feel.voices.length)
    }
  })

  it('declares a feel: some swing, and a player’s worth of slop', () => {
    for (const feel of CANDIDATE) {
      expect(feel.swing, feel.id).toBeGreaterThan(0)
      expect(feel.swing, feel.id).toBeLessThanOrEqual(1)
      expect(feel.humanize.timingMs, feel.id).toBeGreaterThan(0)
      expect(feel.humanize.timingMs, feel.id).toBeLessThan(
        halfStepMs(feel.subdivision, feel.tempoRange[1]),
      )
      expect(feel.humanize.velocity, feel.id).toBeGreaterThan(0)
      expect(feel.humanize.velocity, feel.id).toBeLessThan(0.5)
      expect(feel.humanize.driftDepth, feel.id).toBeGreaterThan(0)
      expect(feel.humanize.driftDepth, feel.id).toBeLessThanOrEqual(0.01)
    }
  })

  it('drags the snare, pushes the hats, and leans nothing it does not play', () => {
    for (const feel of CANDIDATE) {
      const lean = feel.humanize.lean
      expect(Object.keys(lean).length, `${feel.id} inherits its lean`).toBeGreaterThan(0)
      expect(lean.snare, `${feel.id} does not lean its snare`).toBeGreaterThan(0)
      for (const hat of ['hatClosed', 'hatOpen'] as const) {
        if (!feel.voices.includes(hat)) continue
        expect(lean[hat] ?? 0, `${feel.id} ${hat} does not push`).toBeLessThanOrEqual(0)
      }
      for (const voice of Object.keys(lean)) {
        expect(feel.voices, `${feel.id} leans ${voice}, which it never plays`).toContain(voice)
      }
    }
  })

  it('declares a whole number of passes, never fewer than two', () => {
    for (const feel of CANDIDATE) {
      expect(Number.isInteger(feel.passes), feel.id).toBe(true)
      expect(feel.passes, feel.id).toBeGreaterThanOrEqual(2)
    }
    expect(new Set(CANDIDATE.map((t) => t.passes)).size).toBeGreaterThan(1)
  })

  it('declares a sane tempo range and a gain and a pan for every voice', () => {
    for (const feel of CANDIDATE) {
      expect(feel.tempoRange[0], feel.id).toBeGreaterThan(0)
      expect(feel.tempoRange[0], feel.id).toBeLessThan(feel.tempoRange[1])
      for (const voice of feel.voices) {
        expect(typeof feel.gain[voice], `${feel.id}.gain.${voice}`).toBe('number')
        expect(typeof feel.pan[voice], `${feel.id}.pan.${voice}`).toBe('number')
        expect(feel.pan[voice], `${feel.id}.pan.${voice}`).toBeGreaterThanOrEqual(-1)
        expect(feel.pan[voice], `${feel.id}.pan.${voice}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps the offered flavours exactly the twelve the game names', () => {
    const offered = new Set(CANDIDATE.flatMap((t) => t.flavours))
    expect([...offered].sort()).toEqual([...(FLAVOURS as string[])].sort())
  })

  it('renders every seed as the feel it declares', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { music } = render(boomBap, seed)
      expect(boomBap.flavours as string[]).toContain(music.flavour)
      expect(music.bpm).toBeGreaterThanOrEqual(boomBap.tempoRange[0])
      expect(music.bpm).toBeLessThanOrEqual(boomBap.tempoRange[1])
      expect(music.loopBars).toBe(4 * boomBap.passes)
    }
  })

  it('never feathers a kick — it does not ride', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { events } = render(boomBap, seed)
      for (const event of events) {
        if (event.voice !== 'kick') continue
        expect(event.velocity, `seed ${seed} feathers a kick`).toBeGreaterThanOrEqual(
          GHOST_VELOCITY_THRESHOLD,
        )
      }
    }
  })

  it('plays every voice it declares, and no other', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { events } = render(boomBap, seed)
      const played = new Set(events.map((e) => e.voice))
      for (const voice of boomBap.voices) expect(played, `seed ${seed}`).toContain(voice)
      for (const voice of played) expect(boomBap.voices, `seed ${seed}`).toContain(voice)
    }
  })
})
