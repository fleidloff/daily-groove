import { describe, expect, it } from 'vitest'
import { BASS_WALK_CEILING, buildEvents } from './events.ts'
import { readCatalogue } from './catalogue.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { pitchesOf } from '../../src/lib/theory/scales.ts'
import type { BassType, FeelTemplate, GrooveSpec } from './types.ts'

const UUID = '00000000-0000-4000-8000-000000000000'
const FLOOR = 25

const pc = (midi: number) => ((Math.round(midi) % 12) + 12) % 12

const interval = (a: number, b: number) => {
  const distance = pc(a - b)
  return Math.min(distance, 12 - distance)
}

// Swing and humanize move an event off its grid position, and every claim below is
// about where a note sits in the bar. Zeroing both is what lets `step` be exact.
const still = (feel: FeelTemplate) => ({
  ...feel,
  swing: 0,
  humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
})

function played(feel: FeelTemplate, seed: number, bassType?: BassType) {
  const spec: GrooveSpec = { id: 'g', uuid: UUID, template: feel.id, seed, ...(bassType ? { bassType } : {}) }
  const { events, music, harmony } = buildEvents(spec, feel)
  const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
  return {
    music,
    harmony,
    bass: events
      .filter((event) => event.voice === 'bass')
      .map((event) => {
        const grid = Math.round(event.timeSec / stepSec)
        return {
          ...event,
          midi: event.midi as number,
          bar: Math.floor(grid / feel.subdivision),
          step: grid % feel.subdivision,
        }
      }),
  }
}

const swung = () => still(templateById('swung-sixteenth'))
const shuffle = () => still(templateById('shuffle'))

const ballad = () => still(templateById('open-ballad'))

// swung-sixteenth is on the sixteenth grid and shuffle on the eighth, so running every
// shape claim over both is what keeps `beat * subdivision / 4` honest. These ask for the
// walking line explicitly: swung-sixteenth declares it on its template, but shuffle only
// walks the three grooves catalogue.json names, so the feel alone would draw.
const walkingFeels = () => [swung(), shuffle()]
const WALK = 'walking-bass' as const

const rootAtOf = (music: { bars: number }, harmony: { progressionMidi: number[][] }) => (bar: number) =>
  harmony.progressionMidi[(bar % music.bars) % harmony.progressionMidi.length][0]

describe('a walking bass plays every quarter and nothing else — D1', () => {
  it('puts one bass note on each of the four quarters of every bar', () => {
    for (const feel of walkingFeels()) {
      const quarters = [0, 1, 2, 3].map((beat) => (beat * feel.subdivision) / 4)
      for (let seed = 1; seed <= 12; seed += 1) {
        const { bass, music } = played(feel, seed, WALK)
        for (let bar = 0; bar < music.loopBars; bar += 1) {
          const steps = bass.filter((event) => event.bar === bar).map((event) => event.step)
          expect(steps, `${feel.id}:${seed} bar ${bar + 1}`).toEqual(quarters)
        }
      }
    }
  })

  it('lands the quarters on 0, 2, 4, 6 on the eighth grid and 0, 4, 8, 12 on the sixteenth', () => {
    expect(swung().subdivision).toBe(16)
    expect(shuffle().subdivision).toBe(8)
    expect([...new Set(played(swung(), 3, WALK).bass.map((e) => e.step))].sort((a, b) => a - b)).toEqual([0, 4, 8, 12])
    expect([...new Set(played(shuffle(), 3, WALK).bass.map((e) => e.step))].sort((a, b) => a - b)).toEqual([0, 2, 4, 6])
  })

  it('is not displaced by swing, at either feel’s swing value', () => {
    for (const feel of [templateById('swung-sixteenth'), templateById('shuffle')]) {
      expect(feel.swing).toBeGreaterThan(0.4)
      const quarters = [0, 1, 2, 3].map((beat) => (beat * feel.subdivision) / 4)
      const { bass } = played({ ...feel, humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 } }, 4, WALK)
      expect([...new Set(bass.map((e) => e.step))].sort((a, b) => a - b)).toEqual(quarters)
    }
  })

  it('never rests: the bass note count is four times the bar count', () => {
    for (const feel of walkingFeels()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { bass, music } = played(feel, seed, WALK)
        expect(bass.length, `${feel.id}:${seed}`).toBe(music.loopBars * 4)
      }
    }
  })
})

describe('the shape of the line — the third ## What bullet', () => {
  it('states the bar’s root on beat one', () => {
    for (const feel of walkingFeels()) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { bass, music, harmony } = played(feel, seed, WALK)
      const rootAt = rootAtOf(music, harmony)
      for (const event of bass.filter((e) => e.step === 0)) {
        expect(pc(event.midi), `${feel.id}:${seed} bar ${event.bar + 1}`).toBe(pc(rootAt(event.bar)))
      }
    }
    }
  })

  it('moves by no more than a fifth between consecutive notes — “very little tone jumps”', () => {
    for (const feel of walkingFeels()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { bass } = played(feel, seed, 'walking-bass')
        for (let i = 1; i < bass.length; i += 1) {
          expect(
            Math.abs(bass[i].midi - bass[i - 1].midi),
            `${feel.id}:${seed} note ${i}: ${bass[i - 1].midi} -> ${bass[i].midi}`,
          ).toBeLessThanOrEqual(7)
        }
      }
    }
  })

  it('never leaps an octave: the always-lift is off for a walking line', () => {
    for (const feel of walkingFeels()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { bass } = played(feel, seed, 'walking-bass')
        for (let i = 1; i < bass.length; i += 1) {
          expect(Math.abs(bass[i].midi - bass[i - 1].midi), `${feel.id}:${seed}`).not.toBe(12)
        }
      }
    }
  })

  it('stays between the floor and BASS_WALK_CEILING', () => {
    for (const feel of walkingFeels()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        for (const { midi } of played(feel, seed, 'walking-bass').bass) {
          expect(midi, `${feel.id}:${seed}`).toBeGreaterThanOrEqual(FLOOR)
          expect(midi, `${feel.id}:${seed}`).toBeLessThanOrEqual(BASS_WALK_CEILING)
        }
      }
    }
  })

  it('gives all four quarters the same length — the evenness is the walk', () => {
    for (const feel of walkingFeels()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const lengths = new Set(
          played(feel, seed, 'walking-bass').bass.map((event) => event.durationSec.toFixed(9)),
        )
        expect(
          lengths.size,
          `${feel.id}:${seed} plays ${lengths.size} different note lengths`,
        ).toBe(1)
      }
    }
  })

  it('leaves a gap before the next attack, so the quarters never overlap', () => {
    for (const feel of walkingFeels()) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { bass, music } = played(feel, seed, WALK)
      const quarterSec = (60 / music.bpm)
      for (const event of bass) {
        expect(event.durationSec, `seed ${seed}`).toBeLessThan(quarterSec)
      }
    }
  }
  })

  it('allows a repeated note without forcing one', () => {
    for (const feel of walkingFeels()) {
    let seedsWithRepeat = 0
    for (let seed = 1; seed <= 24; seed += 1) {
      const pitches = played(feel, seed, WALK).bass.map((event) => event.midi)
      if (pitches.some((midi, i) => i > 0 && midi === pitches[i - 1])) seedsWithRepeat += 1
    }
    expect(seedsWithRepeat, 'the register wall never bites in 24 seeds').toBeGreaterThan(0)
    expect(seedsWithRepeat, 'every seed repeats — that is a forced repeat, not an allowed one').toBeLessThan(24)
  }
  })
})

describe('beat four is the chromatic approach — Q1-A', () => {
  it('lands a semitone from the next bar’s root wherever the chord changes', () => {
    for (const feel of walkingFeels()) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { bass, music, harmony } = played(feel, seed, WALK)
      const rootAt = rootAtOf(music, harmony)
      const lastQuarter = (3 * feel.subdivision) / 4
      for (let bar = 0; bar < music.loopBars; bar += 1) {
        const next = (bar + 1) % music.loopBars
        if (rootAt(next) === rootAt(bar)) continue
        const beatFour = bass.find((event) => event.bar === bar && event.step === lastQuarter)!
        expect(interval(beatFour.midi, rootAt(next)), `seed ${seed} bar ${bar + 1}`).toBe(1)
      }
    }
  }
  })

  it('keeps beats one, two and three inside the scale or the progression’s chords', () => {
    for (const feel of walkingFeels()) {
    const lastQuarter = (3 * feel.subdivision) / 4
    for (let seed = 1; seed <= 12; seed += 1) {
      const { bass, music, harmony } = played(feel, seed, WALK)
      const allowed = new Set(pitchesOf(music.root, music.flavour))
      for (const chord of harmony.progressionMidi) for (const midi of chord) allowed.add(pc(midi))
      for (const event of bass) {
        if (event.step === lastQuarter) continue
        expect(allowed, `seed ${seed} bar ${event.bar + 1} step ${event.step}`).toContain(pc(event.midi))
      }
    }
  }
  })

  // shuffle draws `blues`, whose I/IV/V are stated dominant sevenths by idiom, so its
  // chord tones include a major third the six-note scale does not hold. Running beat
  // three over both feels is what exercises that.
  it('restates the harmony on beat three with a chord tone that is not the root', () => {
    for (const feel of walkingFeels()) {
    const beatThree = (2 * feel.subdivision) / 4
    for (let seed = 1; seed <= 12; seed += 1) {
      const { bass, music, harmony } = played(feel, seed, WALK)
      const chordAt = (bar: number) =>
        harmony.progressionMidi[(bar % music.bars) % harmony.progressionMidi.length]
      for (const event of bass.filter((e) => e.step === beatThree)) {
        const chord = chordAt(event.bar)
        const tones = new Set(chord.slice(1).map(pc))
        expect(tones, `seed ${seed} bar ${event.bar + 1}`).toContain(pc(event.midi))
      }
    }
  }
  })
})

describe('bassType selects the line — Q3-A', () => {
  it('leaves every feel that declares no bassType on the drawn pool', () => {
    for (const feel of allTemplates()) {
      if (feel.bassType === 'walking-bass') continue
      const { bass, music } = played(still(feel), 3)
      expect(bass.length, feel.id).toBeLessThan(music.loopBars * 4)
    }
  })

  it('lets a groove override a feel that does not walk', () => {
    const feel = ballad()
    const normal = played(feel, 5).bass
    const walking = played(feel, 5, 'walking-bass').bass
    expect(walking.length).toBeGreaterThan(normal.length)
    expect(walking.map((e) => e.midi)).not.toEqual(normal.map((e) => e.midi))
  })

  it('lets a groove override a feel that does walk', () => {
    const feel = swung()
    const { bass, music } = played(feel, 5, 'normal')
    expect(bass.length).toBeLessThan(music.loopBars * 4)
  })

  it('reads walking-bass off the groove even when the template says normal', () => {
    const feel = ballad()
    expect(feel.bassType).toBeUndefined()
    const { bass, music } = played(feel, 7, 'walking-bass')
    expect(bass.length).toBe(music.loopBars * 4)
  })
})

describe('which grooves walk — D3', () => {
  it('walks every swung-sixteenth groove through its template', () => {
    expect(templateById('swung-sixteenth').bassType).toBe('walking-bass')
  })

  // shuffle is the mixed feel: the walk is a per-groove decision there, taken on the
  // musician's reading that the blues grooves are the ones a walk was invented for.
  it('walks shuffle’s three blues grooves and leaves its three aeolian ones drawn', () => {
    expect(templateById('shuffle').bassType).toBeUndefined()
    const shuffleGrooves = readCatalogue().filter((groove) => groove.template === 'shuffle')
    expect(shuffleGrooves).toHaveLength(6)
    const walking = shuffleGrooves.filter((groove) => groove.bassType === 'walking-bass')
    expect(walking.map((groove) => groove.id)).toEqual(['groove-42', 'groove-44', 'groove-52'])
  })

  // The open-ballad trial was walked, listened to and turned down, so the per-groove
  // override ships used by nobody. It stays because it is the mechanism that made the
  // trial one line to start and one line to reverse, and the test above it keeps the
  // code path honest.
  // quick-20 walked three open-ballad grooves as a trial and a listening turned them
  // down; quick-21 then used the same per-groove door for shuffle's blues three. So the
  // claim is not "no groove overrides its feel" any more — it is which ones do.
  it('overrides no feel that does not ride, so the open-ballad trial stays rejected', () => {
    const overriding = readCatalogue().filter((groove) => groove.bassType !== undefined)
    expect(overriding.map((groove) => groove.template)).toEqual(['shuffle', 'shuffle', 'shuffle'])
  })

  it('leaves every open-ballad groove on the drawn pool', () => {
    expect(templateById('open-ballad').bassType).toBeUndefined()
  })

  // Only a riding feel walks, but riding does not mean the whole feel walks: shuffle
  // declares nothing on its template and names three grooves in catalogue.json instead.
  it('walks nothing outside the two feels that ride', () => {
    const riding = allTemplates().filter((feel) => feel.voices.includes('ride'))
    expect(riding.map((feel) => feel.id).sort()).toEqual(['shuffle', 'swung-sixteenth'])
    for (const feel of allTemplates()) {
      if (feel.bassType === 'walking-bass') expect(feel.voices.includes('ride'), feel.id).toBe(true)
    }
    for (const groove of readCatalogue()) {
      if (groove.bassType !== 'walking-bass') continue
      expect(templateById(groove.template).voices.includes('ride'), groove.id).toBe(true)
    }
  })

  it('walks exactly nine grooves and nothing else', () => {
    const walking = readCatalogue().filter(
      (groove) =>
        (groove.bassType ?? templateById(groove.template).bassType ?? 'normal') ===
        'walking-bass',
    )
    expect(walking.map((groove) => groove.id)).toEqual([
      'groove-28',
      'groove-34',
      'groove-40',
      'groove-42',
      'groove-44',
      'groove-48',
      'groove-50',
      'groove-52',
      'groove-82',
    ])
  })
})
