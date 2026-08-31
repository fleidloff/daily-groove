import { describe, expect, it } from 'vitest'
import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour, MusicMeta } from '../types.ts'
import { rngFor } from '../rng.ts'
import { buildHarmony, chordNameFor, pitchClassesOf } from './harmony.ts'
import { FLAVOURS, intervalsFor, pitchesOf, scaleName } from './scales.ts'
import { ROOTS } from './notes.ts'
import { VALIDITY, isValidHarmony, scaleDegreePitchClasses } from './validity.ts'

/** The pitch classes a chord's MIDI notes sound, ascending and deduplicated. */
function pitchClassesOfMidi(midi: number[]): number[] {
  return [...new Set(midi.map((m) => m % 12))].sort((a, b) => a - b)
}

function musicFor(root: Root, flavour: Flavour, chord: string, progression: string): MusicMeta {
  return {
    bpm: 100,
    bars: 4,
  loopBars: 4,
    root,
    flavour,
    scale: scaleName(root, flavour),
    chord,
    progression,
  }
}

describe('buildHarmony', () => {
  it('builds a tonic chord that lives inside the scale', () => {
    const scale = pitchesOf('C', 'aeolian')
    const harmony = buildHarmony('C', 'aeolian', rngFor('h:minor'))
    expect(harmony.chordMidi.length).toBeGreaterThanOrEqual(3)
    for (const midi of harmony.chordMidi) {
      expect(scale).toContain(midi % 12)
    }
  })

  it('names the minor tonic Cm7', () => {
    expect(buildHarmony('C', 'aeolian', rngFor('h:minor')).chordName).toBe('Cm7')
  })

  it('names the dorian and mixolydian tonics', () => {
    expect(buildHarmony('C', 'dorian', rngFor('h:dorian')).chordName).toBe('Cm7')
    expect(buildHarmony('C', 'mixolydian', rngFor('h:mixo')).chordName).toBe('C7')
    expect(buildHarmony('C', 'ionian', rngFor('h:major')).chordName).toBe('Cmaj7')
  })

  it('roots the tonic chord on the scale root', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ROOTS) {
        const harmony = buildHarmony(root, flavour, rngFor(`h:${root}:${flavour}`))
        expect(harmony.chordMidi[0] % 12).toBe(ROOTS.indexOf(root))
        expect(pitchClassesOf(harmony.chordName)).toEqual(
          [...new Set(harmony.chordMidi.map((m) => m % 12))].sort((a, b) => a - b),
        )
      }
    }
  })

  // Epic 1 asserted every progression chord was strictly inside the scale. Epic
  // 3 supersedes that for blues, whose I7, IV7 and V7 carry a major third the
  // six-note blues scale does not: the chord is now checked against its
  // flavour's rule, which is strict membership for the other seven.
  it('returns a progression of three or four chords valid for its flavour, starting on the tonic', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ['C', 'F♯', 'A'] as Root[]) {
        const scalePitchClasses = scaleDegreePitchClasses(root, flavour)
        const h = buildHarmony(root, flavour, rngFor(`p:${root}:${flavour}`))
        expect(h.progressionDegrees.length).toBeGreaterThanOrEqual(3)
        expect(h.progressionDegrees.length).toBeLessThanOrEqual(4)
        expect(h.progressionMidi.length).toBe(h.progressionDegrees.length)
        expect(h.progressionDegrees[0]).toBe(0)
        // The first chord of the progression IS the named chord.
        expect(h.progressionMidi[0]).toEqual(h.chordMidi)
        h.progressionMidi.forEach((chord, i) => {
          expect(chord.length).toBeGreaterThanOrEqual(2)
          expect(
            VALIDITY[flavour]({
              scalePitchClasses,
              chordPitchClasses: pitchClassesOfMidi(chord),
              degree: h.progressionDegrees[i],
            }),
          ).toBe(true)
        })
        const names = h.progressionName.split('–')
        expect(names.length).toBe(h.progressionDegrees.length)
        expect(names[0]).toBe(h.chordName)
        // Every progression chord name round-trips to the pitches played.
        names.forEach((name, i) => {
          expect(pitchClassesOf(name)).toEqual(
            [...new Set(h.progressionMidi[i].map((m) => m % 12))].sort((a, b) => a - b),
          )
        })
      }
    }
  })

  it('joins the progression with en-dashes, not hyphens', () => {
    const h = buildHarmony('C', 'aeolian', rngFor('dash'))
    expect(h.progressionName).toContain('–')
    expect(h.progressionName).not.toMatch(/[A-Za-z0-9]-[A-Z]/)
  })

  it('is deterministic for a given generator label', () => {
    const a = buildHarmony('E♭', 'lydian', rngFor('same'))
    const b = buildHarmony('E♭', 'lydian', rngFor('same'))
    expect(a).toEqual(b)
  })

  it('varies the progression with the generator', () => {
    const names = new Set(
      Array.from(
        { length: 12 },
        (_, i) => buildHarmony('C', 'aeolian', rngFor(`vary-${i}`)).progressionName,
      ),
    )
    expect(names.size).toBeGreaterThan(1)
  })
})

describe('chordNameFor', () => {
  it('names the qualities the modes produce', () => {
    expect(chordNameFor('C', [0, 4, 7, 11])).toBe('Cmaj7')
    expect(chordNameFor('C', [0, 3, 7, 10])).toBe('Cm7')
    expect(chordNameFor('C', [0, 4, 7, 10])).toBe('C7')
    expect(chordNameFor('C', [0, 3, 6, 10])).toBe('Cm7♭5')
    expect(chordNameFor('C', [0, 3, 7, 11])).toBe('CmMaj7')
    expect(chordNameFor('C', [0, 4, 7])).toBe('C')
    expect(chordNameFor('C', [0, 3, 7])).toBe('Cm')
    expect(chordNameFor('E♭', [0, 4, 7, 9])).toBe('E♭6')
  })

  it('returns null for an interval set it cannot name', () => {
    expect(chordNameFor('C', [0, 1, 2, 3, 4, 5])).toBeNull()
  })
})

describe('pitchClassesOf', () => {
  it('reverses a chord name back to its pitch classes', () => {
    expect(pitchClassesOf('Cm7')).toEqual([0, 3, 7, 10])
    expect(pitchClassesOf('Cmaj7')).toEqual([0, 4, 7, 11])
    expect(pitchClassesOf('F♯7')).toEqual([1, 4, 6, 10])
    expect(pitchClassesOf('E♭6')).toEqual([0, 3, 7, 10])
    expect(pitchClassesOf('B♭m7♭5')).toEqual([1, 4, 8, 10])
  })

  it('throws on a name it cannot parse', () => {
    expect(() => pitchClassesOf('Hwibble')).toThrow()
  })
})

describe('every flavour', () => {
  it('yields a nameable tonic chord for every root', () => {
    for (const flavour of FLAVOURS as Flavour[]) {
      for (const root of ROOTS) {
        const h = buildHarmony(root, flavour, rngFor(`t:${root}:${flavour}`))
        expect(h.chordName.startsWith(root)).toBe(true)
        expect(h.chordName.length).toBeGreaterThan(root.length - 1)
      }
    }
  })
})

// Step B5 — the harmony builder produces valid harmony for all eight flavours.
describe('buildHarmony — valid for every flavour and every root', () => {
  it('passes its flavour’s validity rule for all 96 combinations', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ROOTS) {
        const h = buildHarmony(root, flavour, rngFor(`v:${root}:${flavour}`))
        const music = musicFor(root, flavour, h.chordName, h.progressionName)
        expect({ root, flavour, valid: isValidHarmony(music, h) }).toEqual({
          root,
          flavour,
          valid: true,
        })
      }
    }
  })

  it('plays exactly the pitches its chord and progression name, for all 96', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ROOTS) {
        const h = buildHarmony(root, flavour, rngFor(`v:${root}:${flavour}`))
        expect(pitchClassesOf(h.chordName)).toEqual(pitchClassesOfMidi(h.chordMidi))
        h.progressionName.split('–').forEach((name, i) => {
          expect(pitchClassesOf(name)).toEqual(pitchClassesOfMidi(h.progressionMidi[i]))
        })
      }
    }
  })
})

describe('buildHarmony — the blues idiom', () => {
  const degreeOf = (semitones: number) => intervalsFor('blues').indexOf(semitones)

  it('builds the blues on dominant sevenths on I, IV and V', () => {
    for (const root of ROOTS) {
      const h = buildHarmony(root, 'blues', rngFor(`b:${root}`))
      expect(h.chordName).toBe(`${root}7`)
      const allowed = [0, 5, 7].map(degreeOf)
      for (const degree of h.progressionDegrees) {
        expect(allowed).toContain(degree)
      }
      // Every chord of the progression is a dominant seventh on its own root.
      const scale = scaleDegreePitchClasses(root, 'blues')
      h.progressionMidi.forEach((chord, i) => {
        const chordRoot = scale[h.progressionDegrees[i]]
        expect(pitchClassesOfMidi(chord)).toEqual(
          [0, 4, 7, 10].map((n) => (chordRoot + n) % 12).sort((a, b) => a - b),
        )
      })
    }
  })

  it('reaches beyond the tonic, so a blues is a progression and not a drone', () => {
    const degrees = new Set(
      ROOTS.flatMap((root) => buildHarmony(root, 'blues', rngFor(`b:${root}`)).progressionDegrees),
    )
    expect(degrees.size).toBeGreaterThan(1)
  })
})

// Epic 6 — the four modes added on top of the original eight. The sweeps above
// already cover them by iterating FLAVOURS; this states the property those
// modes were chosen for, so a candidate that could not name its own tonic
// could never have been adopted quietly.
describe('buildHarmony — the modes Epic 6 added', () => {
  const ADDED: Flavour[] = [
    'melodic-minor',
    'lydian-dominant',
    'phrygian-dominant',
    'harmonic-major',
  ]

  it('names a tonic chord the scale entirely contains, for all 48 combinations', () => {
    for (const flavour of ADDED) {
      for (const root of ROOTS) {
        const scale = pitchesOf(root, flavour)
        const h = buildHarmony(root, flavour, rngFor(`e6:${root}:${flavour}`))
        const outside = pitchClassesOf(h.chordName).filter((pc) => !scale.includes(pc))
        expect({ root, flavour, outside }).toEqual({ root, flavour, outside: [] })
        expect(h.chordName.startsWith(root)).toBe(true)
      }
    }
  })

  it('states the tonic quality each mode was chosen for', () => {
    const expected: Record<string, string> = {
      'melodic-minor': 'mMaj7',
      'lydian-dominant': '7',
      'phrygian-dominant': '7',
      'harmonic-major': 'maj7',
    }
    for (const flavour of ADDED) {
      for (const root of ROOTS) {
        const h = buildHarmony(root, flavour, rngFor(`e6q:${root}:${flavour}`))
        expect({ root, flavour, chord: h.chordName }).toEqual({
          root,
          flavour,
          chord: `${root}${expected[flavour]}`,
        })
      }
    }
  })
})

describe('buildHarmony — the harmonic-minor idiom', () => {
  it('builds the tonic as a minor-major seventh and offers the V7', () => {
    for (const root of ROOTS) {
      const h = buildHarmony(root, 'harmonic-minor', rngFor(`hm:${root}`))
      expect(h.chordName).toBe(`${root}mMaj7`)
      // The raised seventh is a scale tone, so the dominant on degree 4 is a
      // dominant seventh — the chord the flavour is recognised by.
      const scale = scaleDegreePitchClasses(root, 'harmonic-minor')
      const v7 = [0, 4, 7, 10].map((n) => (scale[4] + n) % 12).sort((a, b) => a - b)
      expect(v7).toContain((scale[0] + 11) % 12)
      expect(
        VALIDITY['harmonic-minor']({
          scalePitchClasses: scale,
          chordPitchClasses: v7,
          degree: 4,
        }),
      ).toBe(true)
    }
  })
})
