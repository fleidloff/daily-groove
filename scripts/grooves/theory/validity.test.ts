import { describe, expect, it } from 'vitest'
import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour, MusicMeta } from '../types.ts'
import { rngFor } from '../rng.ts'
import { ROOTS, pitchClassOf } from './notes.ts'
import { FLAVOURS, intervalsFor, scaleName } from './scales.ts'
import type { Harmony } from './harmony.ts'
import { buildHarmony, chordNameFor, pitchClassesOf } from './harmony.ts'
import { VALIDITY, isValidHarmony, scaleDegreePitchClasses } from './validity.ts'

const MODAL: Flavour[] = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian']

/** The rule for a flavour, applied to one chord on one degree. */
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

/** Pitch classes of a chord built on a scale degree, from semitones above it. */
function chordOn(root: Root, flavour: Flavour, degree: number, above: number[]): number[] {
  const rootPc = scaleDegreePitchClasses(root, flavour)[degree]
  return [...new Set(above.map((i) => (rootPc + i) % 12))].sort((a, b) => a - b)
}

/** The first pitch class the scale does not contain. Foreign to every flavour. */
function foreignPitchClass(root: Root, flavour: Flavour): number {
  const scale = scaleDegreePitchClasses(root, flavour)
  for (let pc = 0; pc < 12; pc++) if (!scale.includes(pc)) return pc
  throw new Error('no foreign pitch class')
}

/**
 * A harmony whose progression ends on a major triad rooted a foreign pitch
 * class — plausible-looking, correctly named, and wrong under every flavour's
 * rule. Named through `chordNameFor` so the words still match the notes: what
 * the test catches is the rule, not a bookkeeping mismatch.
 */
function wrongHarmonyFor(root: Root, flavour: Flavour): { music: MusicMeta; harmony: Harmony } {
  const harmony = buildHarmony(root, flavour, rngFor(`wrong:${root}:${flavour}`))
  // The first triad root the flavour's rule refuses over the tonic degree. A
  // vacuous rule refuses none, in which case this falls back to the scale's
  // first foreign tone and the assertion below is what reports it.
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
    root,
    flavour,
    scale: scaleName(root, flavour),
    chord: harmony.chordName,
    progression: harmony.progressionName,
  }
}

describe('scaleDegreePitchClasses', () => {
  it('lists the scale in degree order, tonic first', () => {
    // Degree indexing is what the rules read, so the array is in scale order,
    // not the sorted order `pitchesOf` returns.
    expect(scaleDegreePitchClasses('C', 'minor')).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(scaleDegreePitchClasses('A', 'minor')).toEqual([9, 11, 0, 2, 4, 5, 7])
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

// Step B1 — the modal flavours require strict membership.
describe('the modal flavours', () => {
  it('accepts a chord whose every tone is in the scale', () => {
    for (const flavour of MODAL) {
      for (const root of ['C', 'F♯', 'B♭'] as Root[]) {
        const scale = scaleDegreePitchClasses(root, flavour)
        // A triad stacked by scale index: in the scale by construction.
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
    // A dominant seventh on the tonic is idiomatic blues and foreign to dorian:
    // its major third is not a scale tone. The rule table is what makes those
    // two answers different.
    expect(accepts('dorian', 'C', 0, chordOn('C', 'dorian', 0, [0, 4, 7, 10]))).toBe(false)
    // The raised seventh belongs to harmonic minor, not to natural minor.
    expect(accepts('minor', 'C', 4, chordOn('C', 'minor', 4, [0, 4, 7, 10]))).toBe(false)
  })
})

// Step B2 — blues permits dominant sevenths on I, IV and V.
describe('blues', () => {
  // I, IV and V are the degrees a fifth apart from the tonic, which in the
  // six-note blues scale [0,3,5,6,7,10] are the indices of the 0, 5 and 7
  // semitone offsets — degrees 0, 2 and 4. (The tech spec's Step B2 says
  // "0, 3 or 4"; degree 3 of this scale is the ♭5, not the subdominant.)
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
        // The major third really is outside the blues scale — this is the
        // assertion the whole rule table exists for.
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
    // C7 with a ♭9 added: the ♭9 is in neither the blues scale nor the
    // dominant seventh the rule permits over I.
    const alien = foreignPitchClass('C', 'blues')
    expect(accepts('blues', 'C', 0, [...chordOn('C', 'blues', 0, DOMINANT), alien])).toBe(false)
  })

  it('still accepts the plain in-scale chords', () => {
    expect(accepts('blues', 'C', 0, chordOn('C', 'blues', 0, [0, 3, 7, 10]))).toBe(true)
  })
})

// Step B3 — harmonic minor admits its raised seventh.
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
      // The natural seventh it leans on is exactly what harmonic minor raised.
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

// Step B4 — every flavour has a rule, and wrong harmony is rejected.
describe('VALIDITY', () => {
  it('has a rule for exactly the eight flavours the game offers', () => {
    expect(Object.keys(VALIDITY).sort()).toEqual([...FLAVOURS].sort())
    expect(Object.keys(VALIDITY).length).toBe(8)
  })

  it('rejects a deliberately wrong harmony for every flavour', () => {
    // Without this, a rule that returned `true` unconditionally would look
    // like coverage forever.
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
    // The right notes on the wrong degree: only the flavours with a
    // degree-sensitive rule can tell, so this is asserted on blues.
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
