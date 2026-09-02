import { describe, expect, it } from 'vitest'
import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour, MusicMeta } from '../types.ts'
import { rngFor } from '../rng.ts'
import { ROOTS, pitchClassOf } from './notes.ts'
import { FLAVOURS, intervalsFor, scaleName } from './scales.ts'
import type { Harmony } from './harmony.ts'
import { buildHarmony, chordNameFor, pitchClassesOf } from './harmony.ts'
import { VALIDITY, isValidHarmony, scaleDegreePitchClasses } from './validity.ts'

const MODAL: Flavour[] = ['ionian', 'aeolian', 'dorian', 'mixolydian', 'lydian', 'phrygian']

function accepts(
  flavour: Flavour,
  root: Root,
  degree: number,
  chordPitchClasses: number[],
): boolean {
  return VALIDITY[flavour]({
    scalePitchClasses: scaleDegreePitchClasses(root, flavour),
    chordPitchClasses,
    degree,
  })
}

function chordOn(root: Root, flavour: Flavour, degree: number, above: number[]): number[] {
  const rootPc = scaleDegreePitchClasses(root, flavour)[degree]
  return [...new Set(above.map((i) => (rootPc + i) % 12))].sort((a, b) => a - b)
}

function foreignPitchClass(root: Root, flavour: Flavour): number {
  const scale = scaleDegreePitchClasses(root, flavour)
  for (let pc = 0; pc < 12; pc++) if (!scale.includes(pc)) return pc
  throw new Error('no foreign pitch class')
}

function wrongHarmonyFor(root: Root, flavour: Flavour): { music: MusicMeta; harmony: Harmony } {
  const harmony = buildHarmony(root, flavour, rngFor(`wrong:${root}:${flavour}`))
  const triadAt = (pc: number) => [pc, (pc + 4) % 12, (pc + 7) % 12].sort((a, b) => a - b)
  const rejected = Array.from({ length: 12 }, (_, pc) => pc).find(
    (pc) => !accepts(flavour, root, 0, triadAt(pc)),
  )
  const alienPc = rejected ?? foreignPitchClass(root, flavour)
  const alienName = chordNameFor(ROOTS[alienPc], [0, 4, 7]) as string
  const alienMidi = [0, 4, 7].map((i) => 60 + alienPc + i)
  const wrong: Harmony = {
    ...harmony,
    progressionDegrees: [...harmony.progressionDegrees, 0],
    progressionMidi: [...harmony.progressionMidi, alienMidi],
    progressionName: `${harmony.progressionName}–${alienName}`,
  }
  return { music: musicFor(root, flavour, wrong), harmony: wrong }
}

function musicFor(root: Root, flavour: Flavour, harmony: Harmony): MusicMeta {
  return {
    bpm: 100,
    bars: 4,
  loopBars: 4,
    root,
    flavour,
    scale: scaleName(root, flavour),
    chord: harmony.chordName,
    progression: harmony.progressionName,
    progressionDegrees: harmony.progressionDegrees,
  }
}

describe('scaleDegreePitchClasses', () => {
  it('lists the scale in degree order, tonic first', () => {
    expect(scaleDegreePitchClasses('C', 'aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(scaleDegreePitchClasses('A', 'aeolian')).toEqual([9, 11, 0, 2, 4, 5, 7])
    expect(scaleDegreePitchClasses('C', 'blues')).toEqual([0, 3, 5, 6, 7, 10])
  })

  it('starts on the root for every root and flavour', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ROOTS) {
        const scale = scaleDegreePitchClasses(root, flavour)
        expect(scale[0]).toBe(pitchClassOf(root))
        expect(scale.length).toBe(intervalsFor(flavour).length)
      }
    }
  })
})

describe('the modal flavours', () => {
  it('accepts a chord whose every tone is in the scale', () => {
    for (const flavour of MODAL) {
      for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
        const scale = scaleDegreePitchClasses(root, flavour)
        const triad = [scale[0], scale[2], scale[4]]
        expect(accepts(flavour, root, 0, triad)).toBe(true)
      }
    }
  })

  it('rejects a chord containing one non-scale tone', () => {
    for (const flavour of MODAL) {
      for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
        const scale = scaleDegreePitchClasses(root, flavour)
        const alien = foreignPitchClass(root, flavour)
        expect(accepts(flavour, root, 0, [scale[0], scale[2], scale[4], alien])).toBe(false)
      }
    }
  })

  it('rejects the borrowed chords the other flavours are allowed', () => {
    expect(accepts('dorian', 'C', 0, chordOn('C', 'dorian', 0, [0, 4, 7, 10]))).toBe(false)
    expect(accepts('aeolian', 'C', 4, chordOn('C', 'aeolian', 4, [0, 4, 7, 10]))).toBe(false)
  })
})

describe('blues', () => {
  const degreeOf = (semitones: number) => intervalsFor('blues').indexOf(semitones)
  const DOMINANT = [0, 4, 7, 10]

  it('numbers I, IV and V as degrees 0, 2 and 4', () => {
    expect([degreeOf(0), degreeOf(5), degreeOf(7)]).toEqual([0, 2, 4])
  })

  it('permits a dominant seventh on I, IV and V, major third and all', () => {
    for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
      const scale = scaleDegreePitchClasses(root, 'blues')
      for (const semitones of [0, 5, 7]) {
        const degree = degreeOf(semitones)
        const chord = chordOn(root, 'blues', degree, DOMINANT)
        const third = (scale[degree] + 4) % 12
        expect(scale).not.toContain(third)
        expect(chord).toContain(third)
        expect(accepts('blues', root, degree, chord)).toBe(true)
      }
    }
  })

  it('rejects the same dominant seventh on any other degree', () => {
    for (const degree of [1, 3, 5]) {
      const chord = chordOn('C', 'blues', degree, DOMINANT)
      expect(accepts('blues', 'C', degree, chord)).toBe(false)
    }
  })

  it('rejects a chord with a tone outside both the scale and the alterations', () => {
    const alien = foreignPitchClass('C', 'blues')
    expect(accepts('blues', 'C', 0, [...chordOn('C', 'blues', 0, DOMINANT), alien])).toBe(false)
  })

  it('still accepts the plain in-scale chords', () => {
    expect(accepts('blues', 'C', 0, chordOn('C', 'blues', 0, [0, 3, 7, 10]))).toBe(true)
  })
})

describe('harmonic minor', () => {
  const raisedSeventhDegree = 6
  const dominantDegree = 4

  it('admits the raised seventh and the V7 built over it', () => {
    for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
      const scale = scaleDegreePitchClasses(root, 'harmonic-minor')
      const raised = (scale[0] + 11) % 12
      expect(scale[raisedSeventhDegree]).toBe(raised)
      const v7 = chordOn(root, 'harmonic-minor', dominantDegree, [0, 4, 7, 10])
      expect(v7).toContain(raised)
      expect(accepts('harmonic-minor', root, dominantDegree, v7)).toBe(true)
    }
  })

  it('admits the diminished seventh built on the raised seventh', () => {
    const chord = chordOn('C', 'harmonic-minor', raisedSeventhDegree, [0, 3, 6, 9])
    expect(accepts('harmonic-minor', 'C', raisedSeventhDegree, chord)).toBe(true)
  })

  it('rejects a natural-minor v7', () => {
    for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
      const scale = scaleDegreePitchClasses(root, 'harmonic-minor')
      const v7 = chordOn(root, 'harmonic-minor', dominantDegree, [0, 3, 7, 10])
      expect(v7).toContain((scale[0] + 10) % 12)
      expect(accepts('harmonic-minor', root, dominantDegree, v7)).toBe(false)
    }
  })

  it('rejects a chord with an unrelated tone', () => {
    const alien = foreignPitchClass('C', 'harmonic-minor')
    const tonic = chordOn('C', 'harmonic-minor', 0, [0, 3, 7, 11])
    expect(accepts('harmonic-minor', 'C', 0, tonic)).toBe(true)
    expect(accepts('harmonic-minor', 'C', 0, [...tonic, alien])).toBe(false)
  })
})

describe('the modes Epic 6 added', () => {
  const ADDED: Flavour[] = [
    'melodic-minor',
    'lydian-dominant',
    'phrygian-dominant',
    'harmonic-major',
  ]

  it('accepts a triad stacked by scale degree, on every degree', () => {
    for (const flavour of ADDED) {
      for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
        const scale = scaleDegreePitchClasses(root, flavour)
        for (let degree = 0; degree < scale.length; degree++) {
          const triad = [
            scale[degree],
            scale[(degree + 2) % scale.length],
            scale[(degree + 4) % scale.length],
          ]
          expect({ flavour, root, degree, ok: accepts(flavour, root, degree, triad) }).toEqual({
            flavour,
            root,
            degree,
            ok: true,
          })
        }
      }
    }
  })

  it('rejects a chord borrowing one note from outside the scale', () => {
    for (const flavour of ADDED) {
      for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
        const scale = scaleDegreePitchClasses(root, flavour)
        const alien = foreignPitchClass(root, flavour)
        const triad = [scale[0], scale[2], scale[4]]
        expect(accepts(flavour, root, 0, triad)).toBe(true)
        expect({ flavour, root, ok: accepts(flavour, root, 0, [...triad, alien]) }).toEqual({
          flavour,
          root,
          ok: false,
        })
      }
    }
  })

  it('refuses the alterations the neighbouring modes are built on', () => {
    const flatSixth = chordOn('C', 'melodic-minor', 3, [0, 3, 7, 10])
    expect(accepts('melodic-minor', 'C', 3, flatSixth)).toBe(false)
    expect(accepts('lydian-dominant', 'C', 0, [0, 4, 5, 7])).toBe(false)
    expect(accepts('phrygian-dominant', 'C', 0, [0, 2, 4, 7])).toBe(false)
    expect(accepts('harmonic-major', 'C', 0, [0, 4, 7, 9])).toBe(false)
  })
})

describe('VALIDITY', () => {
  it('has a rule for exactly the flavours the game offers', () => {
    expect(Object.keys(VALIDITY).sort()).toEqual([...FLAVOURS].sort())
    expect(Object.keys(VALIDITY).length).toBe(FLAVOURS.length)
    expect(FLAVOURS.length).toBe(12)
    for (const flavour of FLAVOURS) expect(typeof VALIDITY[flavour]).toBe('function')
  })

  it('rejects a deliberately wrong harmony for every flavour', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ['C', 'E', 'A♭'] as Root[]) {
        const { music, harmony } = wrongHarmonyFor(root, flavour)
        expect(isValidHarmony(music, harmony)).toBe(false)
      }
    }
  })

  it('accepts the harmony the builder actually produces, for every flavour', () => {
    for (const flavour of FLAVOURS) {
      for (const root of ['C', 'E', 'A♭'] as Root[]) {
        const harmony = buildHarmony(root, flavour, rngFor(`ok:${root}:${flavour}`))
        expect(isValidHarmony(musicFor(root, flavour, harmony), harmony)).toBe(true)
      }
    }
  })
})

describe('isValidHarmony', () => {
  const root: Root = 'C'
  const flavour: Flavour = 'dorian'
  const harmony = buildHarmony(root, flavour, rngFor('iv:C:dorian'))
  const music = musicFor(root, flavour, harmony)

  it('accepts harmony whose words and notes agree', () => {
    expect(isValidHarmony(music, harmony)).toBe(true)
    expect(pitchClassesOf(music.chord)).toEqual(
      [...new Set(harmony.chordMidi.map((m) => m % 12))].sort((a, b) => a - b),
    )
  })

  it('rejects a chord name that does not name the notes played', () => {
    expect(isValidHarmony({ ...music, chord: 'Cmaj7' }, { ...harmony, chordName: 'Cmaj7' })).toBe(
      false,
    )
  })

  it('rejects words that disagree with the harmony they describe', () => {
    expect(isValidHarmony({ ...music, chord: 'Cm7♭5' }, harmony)).toBe(false)
    expect(isValidHarmony({ ...music, progression: 'Cm7–Fm7' }, harmony)).toBe(false)
  })

  it('rejects a progression whose degree and chord disagree', () => {
    const blues = buildHarmony('C', 'blues', rngFor('deg:C:blues'))
    expect(isValidHarmony(musicFor('C', 'blues', blues), blues)).toBe(true)
    const shifted: Harmony = { ...blues, progressionDegrees: blues.progressionDegrees.map(() => 1) }
    expect(isValidHarmony(musicFor('C', 'blues', shifted), shifted)).toBe(false)
  })

  it('rejects a flavour with no rule rather than throwing', () => {
    expect(isValidHarmony({ ...music, flavour: 'bebop' as Flavour }, harmony)).toBe(false)
  })

  it('rejects a malformed harmony rather than throwing', () => {
    expect(isValidHarmony(music, { ...harmony, progressionDegrees: [] })).toBe(false)
    expect(isValidHarmony(music, { ...harmony, chordName: 'Hwibble' })).toBe(false)
  })
})
