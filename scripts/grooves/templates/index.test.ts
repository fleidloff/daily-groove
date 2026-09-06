import { describe, expect, it } from 'vitest'
import type { FeelTemplate, Flavour, VoiceName } from '../types.ts'
import { FLAVOURS } from '../../../src/lib/theory/names.ts'
import { INTERVALS } from '../../../src/lib/theory/scales.ts'
import { TEMPLATES, allTemplates, templateById } from './index.ts'
import { FLAVOURS_MAX, FLAVOURS_MIN, flavourFailures } from './rules.ts'

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

  it('returns the second-line template — feature-25 epic-3 R1, AC1', () => {
    const template = templateById('second-line')
    expect(template.id).toBe('second-line')
    expect(template.subdivision).toBe(16)
    expect(template.tempoRange).toEqual([88, 96])
    expect(template.swing).toBe(0.22)
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


describe('the template set — feature-25 R9', () => {
  it('holds every template under a unique id', () => {
    const templates = allTemplates()
    expect(templates.length, 'the registry is empty or truncated').toBeGreaterThanOrEqual(6)
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(templates.length)
  })

  it('does not give every template the same subdivision, swing or tempo range', () => {
    const templates = allTemplates()
    expect(new Set(templates.map((t) => t.subdivision)).size).toBeGreaterThan(1)
    expect(new Set(templates.map((t) => t.swing)).size).toBe(templates.length)
    expect(new Set(templates.map((t) => t.tempoRange.join('-'))).size).toBe(templates.length)
  })

  it('gives each template its own mix and its own feel', () => {
    const templates = allTemplates()
    const mixes = templates.map((t) => JSON.stringify([t.gain, t.pan]))
    expect(new Set(mixes).size).toBe(templates.length)
    const humanizes = templates.map((t) => JSON.stringify(t.humanize))
    expect(new Set(humanizes).size).toBe(templates.length)
  })

  it('does not give every template the same kit', () => {
    const voiceSets = allTemplates().map((t) => [...t.voices].sort().join(','))
    expect(new Set(voiceSets).size).toBeGreaterThan(1)
  })

  it('gives every template a closed hat', () => {
    for (const template of allTemplates()) {
      expect(template.voices, `${template.id} plays no closed hat`).toContain('hatClosed')
    }
  })

  it('never lets a feel ride and carry an open hat as well', () => {
    for (const template of allTemplates()) {
      if (!template.voices.includes('ride')) continue
      expect(
        template.voices,
        `${template.id} rides and still carries an open hat`,
      ).not.toContain('hatOpen')
      expect(template.gain.hatOpen, `${template.id} rides and still gains an open hat`)
        .toBeUndefined()
      expect(template.pan.hatOpen, `${template.id} rides and still pans an open hat`)
        .toBeUndefined()
      expect(
        template.humanize.lean.hatOpen,
        `${template.id} rides and still leans an open hat`,
      ).toBeUndefined()
    }
  })

  // feature-25: bossa-nova is the third case. It neither rides nor opens its hat —
  // a bossa keeps time on a tight closed hat and answers it with the clave on the
  // rim. Naming the one exception keeps the guard's teeth: a later feel that quietly
  // drops its open hat fails here until someone decides that it should.
  it('names the one feel that plays neither a ride nor an open hat', () => {
    const neither = allTemplates()
      .filter((t) => !t.voices.includes('ride') && !t.voices.includes('hatOpen'))
      .map((t) => t.id)
    expect(neither).toEqual(['bossa-nova'])
    for (const template of allTemplates()) {
      if (template.voices.includes('ride') || neither.includes(template.id)) continue
      expect(template.voices, `${template.id} plays no open hat`).toContain('hatOpen')
      expect(typeof template.gain.hatOpen, `${template.id}.gain.hatOpen`).toBe('number')
      expect(typeof template.pan.hatOpen, `${template.id}.pan.hatOpen`).toBe('number')
    }
  })
})

describe('the two feels that ride — feature-24 epic-2, R1, R11, AC1, AC2, AC8, AC10', () => {
  it('rides on exactly two of the six, and names them', () => {
    const riding = allTemplates()
      .filter((t) => t.voices.includes('ride'))
      .map((t) => t.id)
      .sort()
    expect(riding).toEqual(['shuffle', 'swung-sixteenth'])
  })

  it('places each ride in its own feel’s mix rather than copying one', () => {
    const gains = allTemplates()
      .filter((t) => t.voices.includes('ride'))
      .map((t) => t.gain.ride)
    for (const gain of gains) expect(typeof gain).toBe('number')
    expect(new Set(gains).size, 'both riding feels put the ride at the same gain').toBe(
      gains.length,
    )
  })

  it('leans and pans the ride on every feel that plays one', () => {
    for (const template of allTemplates()) {
      if (!template.voices.includes('ride')) continue
      expect(typeof template.pan.ride, `${template.id}.pan.ride`).toBe('number')
      expect(typeof template.humanize.lean.ride, `${template.id}.lean.ride`).toBe('number')
    }
  })

  it('does not raise the kick to accommodate the feather — AC8', () => {
    expect(templateById('shuffle').gain.kick).toBe(-10)
    expect(templateById('swung-sixteenth').gain.kick).toBe(-8)
  })

  it('leaves everything about swung-sixteenth but the cymbal where it was — AC1', () => {
    const feel = templateById('swung-sixteenth')
    expect(feel.tempoRange).toEqual([106, 116])
    expect(feel.subdivision).toBe(16)
    expect(feel.swing).toBe(0.44)
    expect(feel.passes).toBe(4)
    expect(feel.flavours).toEqual(['phrygian-dominant', 'harmonic-major'])
    expect(feel.density).toEqual({ minPerBar: 16, maxPerBar: 42 })
    expect(feel.gain.hatClosed).toBe(-12)
    expect(feel.pan.hatClosed).toBe(0.33)
    expect(feel.humanize.lean.snare).toBe(11)
    expect(feel.humanize.lean.hatClosed).toBe(-5)
  })
})

// feature-25 retired `keeps the pairs pairwise disjoint`. Two templates sharing a
// flavour is the point of the feature, not an oversight; `flavourFailures` is
// deliberately silent about overlap and the assertion below proves it stays silent.
describe('flavour coverage — feature-25 R1, R2, R7, AC1, AC2', () => {
  it('gives every template two, three or four distinct flavours', () => {
    expect(flavourFailures(allTemplates())).toEqual([])
    for (const template of allTemplates()) {
      expect(template.flavours.length, template.id).toBeGreaterThanOrEqual(FLAVOURS_MIN)
      expect(template.flavours.length, template.id).toBeLessThanOrEqual(FLAVOURS_MAX)
      expect(new Set(template.flavours).size, `${template.id} repeats a flavour`).toBe(
        template.flavours.length,
      )
    }
  })

  it('forbids no overlap — a seventh feel may share a mode with a sixth', () => {
    const sharesIonian: FeelTemplate = {
      ...templateById('bright-straight'),
      id: 'synthetic-overlap',
      flavours: ['ionian', 'dorian', 'mixolydian'] as Flavour[],
    }
    expect(flavourFailures([...allTemplates(), sharesIonian])).toEqual([])
  })

  it('offers exactly the flavours the game names, and no others', () => {
    const offered = new Set(allTemplates().flatMap((t) => t.flavours))
    expect([...offered].sort()).toEqual([...(FLAVOURS as Flavour[])].sort())
    for (const flavour of offered) {
      expect(FLAVOURS as string[], `${flavour} is offered but not in FLAVOURS`).toContain(
        flavour,
      )
    }
  })

  it('renders twelve of the thirteen scales the shared table carries', () => {
    expect(Object.keys(INTERVALS)).toHaveLength(13)
    expect(Object.keys(INTERVALS)).toContain('locrian')
    expect(FLAVOURS).toHaveLength(12)
    expect(FLAVOURS as string[]).not.toContain('locrian')
    expect(allTemplates().flatMap((t) => t.flavours as string[])).not.toContain(
      'locrian',
    )
  })

  // music.md constraint 2, over the set of distinct offered flavours rather than
  // over the multiset the disjoint pairs used to make of it.
  it('splits the distinct offered flavours evenly between the two families', () => {
    const offered = [...new Set(allTemplates().flatMap((t) => t.flavours))]
    const byThird = { major: [] as Flavour[], minor: [] as Flavour[] }
    for (const flavour of offered) {
      const intervals = INTERVALS[flavour]
      const major = intervals.includes(4)
      const minor = intervals.includes(3)
      expect(major !== minor, `${flavour} has no single third to grade it by`).toBe(true)
      byThird[major ? 'major' : 'minor'].push(flavour)
    }
    expect(byThird.major.sort(), 'major-third modes').toHaveLength(FLAVOURS.length / 2)
    expect(byThird.minor.sort(), 'minor-third modes').toHaveLength(FLAVOURS.length / 2)
  })

  it('names the twelve in a frozen order, with locrian absent — R6', () => {
    expect(FLAVOURS).toEqual([
      'ionian',
      'aeolian',
      'dorian',
      'mixolydian',
      'lydian',
      'phrygian',
      'harmonic-minor',
      'blues',
      'melodic-minor',
      'lydian-dominant',
      'phrygian-dominant',
      'harmonic-major',
    ])
    expect(FLAVOURS).toHaveLength(12)
    expect(FLAVOURS as string[]).not.toContain('locrian')
  })

  it('pairs each flavour with a feel that suits it', () => {
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
    expect([...templateById('open-ballad').flavours].sort()).toEqual([
      'lydian-dominant',
      'melodic-minor',
    ])
    expect([...templateById('swung-sixteenth').flavours].sort()).toEqual([
      'harmonic-major',
      'phrygian-dominant',
    ])
    expect([...templateById('bossa-nova').flavours].sort()).toEqual([
      'dorian',
      'ionian',
      'lydian',
      'melodic-minor',
    ])
    expect([...templateById('second-line').flavours].sort()).toEqual([
      'blues',
      'harmonic-major',
      'ionian',
      'mixolydian',
    ])
    expect([...templateById('boom-bap').flavours].sort()).toEqual([
      'aeolian',
      'dorian',
      'phrygian',
    ])
  })

  // R5: the six lists are frozen in content and order. An append to one of them
  // re-renders that feel's grooves and reassigns their committed answers, so it
  // fails here rather than in a re-render.
  it('leaves the six original lists at two entries each — R5, AC4', () => {
    for (const id of [
      'straight-funk',
      'shuffle',
      'bright-straight',
      'half-time',
      'open-ballad',
      'swung-sixteenth',
    ]) {
      expect(templateById(id).flavours, id).toHaveLength(2)
    }
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

describe('the pass count — R2, R2a, AC2', () => {
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
    for (const template of allTemplates()) {
      expect(template.passes, template.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('lets the slow feel declare fewer passes than the fast ones', () => {
    const counts = new Set(allTemplates().map((t) => t.passes))
    expect(counts.size).toBeGreaterThan(1)
    expect(templateById('half-time').passes).toBeLessThan(
      templateById('straight-funk').passes,
    )
  })
})

describe('the seventh feel — feature-25 R19, R20, AC13', () => {
  // Was `registers bossa-nova last`. What that assertion protected was never bossa's
  // position: catalogue.test.ts's `leaves every first-generation survivor exactly as
  // selectSeeds produced it` calls allTemplates().slice(0, 4) and compares the result
  // against grooves 01–16, so what may not move is the *first four* entries and their
  // order. Reading it as "bossa is last" made every later registration a red test for
  // no reason — feature-25 registers three more feels after it. The slice assertion
  // below is the same guard stated as what it guards.
  it('holds the four first-generation feels at the head of the registry — R19', () => {
    expect(templateById('bossa-nova').subdivision).toBe(8)
    expect(allTemplates().slice(0, 4).map((t) => t.id)).toEqual([
      'straight-funk',
      'shuffle',
      'bright-straight',
      'half-time',
    ])
  })

  it('takes the near-zero end of the swing register, at 120–140 — R19, AC13', () => {
    const feel = templateById('bossa-nova')
    expect(feel.swing).toBeGreaterThan(0)
    expect(feel.swing).toBeLessThan(0.02)
    expect(feel.tempoRange[0]).toBeGreaterThanOrEqual(120)
    expect(feel.tempoRange[1]).toBeLessThanOrEqual(140)
    const others = allTemplates().filter((t) => t.id !== 'bossa-nova')
    expect(others.map((t) => t.swing), 'another feel already swings this much').not.toContain(
      feel.swing,
    )
    expect(
      others.map((t) => t.tempoRange.join('-')),
      'another feel already holds this tempo range',
    ).not.toContain(feel.tempoRange.join('-'))
  })

  it('carries four modes, every one of them already in FLAVOURS — R20', () => {
    const feel = templateById('bossa-nova')
    expect(feel.flavours).toHaveLength(4)
    for (const flavour of feel.flavours) {
      expect(FLAVOURS as string[], `${flavour} is not a flavour the game names`).toContain(
        flavour,
      )
    }
    expect(flavourFailures(allTemplates())).toEqual([])
  })

  it('declares its own kick, hat, bass, comp and ghost pools, and a two-bar clave — R21', () => {
    const feel = templateById('bossa-nova')
    expect(Object.keys(feel.patterns ?? {}).sort()).toEqual([
      'bass',
      'comp',
      'hatClosed',
      'kick',
      'snareGhosts',
    ])
    expect(feel.figures).toHaveLength(1)
    expect(feel.figures![0].voice).toBe('rim')
    expect(feel.figures![0].bars).toHaveLength(2)
    expect(feel.figures![0].bars[0]).not.toEqual(feel.figures![0].bars[1])
  })

  it('plays none of the four sourced-but-unplayed voices — R22, AC15', () => {
    const feel = templateById('bossa-nova')
    for (const voice of ['ride', 'rideBell', 'claves', 'cowbell'] as VoiceName[]) {
      expect(feel.voices, `${feel.id} names ${voice}`).not.toContain(voice)
    }
    for (const voice of ['kick', 'snare', 'hatClosed', 'rim', 'bass', 'comp'] as VoiceName[]) {
      expect(feel.voices, `${feel.id} does not name ${voice}`).toContain(voice)
    }
  })
})
