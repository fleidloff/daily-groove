import { describe, expect, it } from 'vitest'
import { MODE_CHARACTERS, characterOf } from './character'
import { FLAVOUR_INTERVALS, FLAVOUR_LETTER_STEPS } from './notes'
import { familyOf } from './families'
import { GROOVES } from '../../data/grooves.generated'

/**
 * The oracle for AC12, and it lives here on purpose.
 *
 * `character.ts` is a written table; if it derived its own `degrees` from the
 * intervals it would be asserting itself, and the prose could name a degree the
 * mode does not have with nothing to catch it. So the differing degrees are
 * recomputed here from `FLAVOUR_INTERVALS` and `familyOf` — the same two
 * sources the requirement names — and the table is checked against them.
 *
 * Semitones from the root for each degree of the plain major scale. A degree's
 * label is its number plus the signed distance from this, which is why
 * Mixolydian's tenth semitone reads ♭7 and not ♯6.
 */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

const ACCIDENTAL: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

/**
 * Every degree of a flavour's scale, labelled, ascending from the root.
 *
 * The degree *number* comes from `FLAVOUR_LETTER_STEPS` where the flavour
 * declares one and from the position otherwise — the blues scale is the reason:
 * six degrees, numbered 1 3 4 5 5 7, so its fourth note is a ♭5 and not a ♭4.
 */
function degreeLabels(flavour: string): string[] {
  return FLAVOUR_INTERVALS[flavour].map((semitones, index) => {
    const steps = FLAVOUR_LETTER_STEPS[flavour]
    const number = (steps ? steps[index] : index) + 1
    return `${ACCIDENTAL[semitones - MAJOR_SCALE[number - 1]]}${number}`
  })
}

/**
 * The degrees that separate a flavour from its family's plain scale: the ones
 * its own scale has that the baseline does not. Which baseline is decided by
 * the third, via `familyOf`, and the table gets no second opinion about it.
 */
function differingDegrees(flavour: string): string[] {
  const plain = new Set(degreeLabels(familyOf(flavour) === 'Major' ? 'Ionian' : 'Aeolian'))
  return degreeLabels(flavour).filter((degree) => !plain.has(degree))
}

describe('characterOf', () => {
  // AC1: the box's one line names the ♭7, which is what makes Mixolydian
  // Mixolydian and the only part of it that transfers to another key.
  it('names Mixolydian by its ♭7', () => {
    const character = characterOf('Mixolydian')
    expect(character?.degrees).toEqual(['♭7'])
    expect(character?.line).toContain('♭7')
  })

  it.each(['mixolydian', 'MIXOLYDIAN', ' Mixolydian '])(
    'matches %j to the same entry, the way notes.ts looks a flavour up',
    (flavour) => {
      expect(characterOf(flavour)).toEqual(characterOf('Mixolydian'))
    },
  )

  // AC8's library half: R3a's tolerance is the panel's, and it only works
  // because this returns rather than throws. Locrian is the real shape of it —
  // `FLAVOUR_INTERVALS` knows it, `familyOf` refuses to grade it, so it has no
  // family's plain scale to be measured against and no line.
  it.each(['Klingon', 'Locrian', '', 'toString'])(
    'returns undefined rather than throwing for %j',
    (flavour) => {
      expect(() => characterOf(flavour)).not.toThrow()
      expect(characterOf(flavour)).toBeUndefined()
    },
  )

  // AC4: driven by the shipped manifest, not by a list written here. A
  // hardcoded list stays green on precisely the day a thirteenth mode is
  // minted — in production, on the day's payoff panel — which is the failure
  // this test exists to prevent. `families.test.ts` derives its own the same
  // way, for the same reason.
  it('is total over every mode the shipped manifest carries', () => {
    const modes = [...new Set(GROOVES.map((g) => g.flavour))]
    expect(modes.length).toBeGreaterThan(0)
    for (const mode of modes) {
      expect(characterOf(mode), `no character line for "${mode}"`).toBeDefined()
    }
  })
})

const ENTRIES = Object.entries(MODE_CHARACTERS)

describe('MODE_CHARACTERS', () => {
  it('covers every mode the manifest carries and nothing the intervals do not', () => {
    const modes = [...new Set(GROOVES.map((g) => g.flavour))]
    expect(ENTRIES.length).toBeGreaterThanOrEqual(modes.length)
    for (const [flavour] of ENTRIES) {
      expect(FLAVOUR_INTERVALS, flavour).toHaveProperty(flavour)
    }
  })

  // AC12: the degrees an entry claims are exactly the degrees its intervals
  // differ by — recomputed above, not read from the prose. An entry naming one
  // of two differing degrees fails here.
  it.each(ENTRIES)('%s claims exactly the degrees its intervals differ by', (flavour, entry) => {
    expect(entry.degrees).toEqual(differingDegrees(flavour))
  })

  // AC12, the prose half: the line has to say every degree the entry claims,
  // or a correct `degrees` would sit beside a line describing another mode.
  it.each(ENTRIES)('%s names every one of those degrees in its line', (flavour, entry) => {
    for (const degree of entry.degrees) {
      expect(entry.line, `"${entry.line}" never names ${degree}`).toContain(degree)
    }
  })

  // AC13: one clause. Not two sentences, and not a sentence about what the
  // degree does to the sound.
  it.each(ENTRIES)('%s says it in one clause with no sentence break', (_flavour, entry) => {
    expect(entry.line).not.toMatch(/[.!?]\s/)
  })

  // AC10's testable proxy: 72 characters is what fits two visual lines at
  // 360px in the panel's type size. jsdom cannot measure a wrap, so the visual
  // check stays on the demo path and this stands in for it.
  it.each(ENTRIES)('%s fits in one line of prose', (_flavour, entry) => {
    expect(entry.line.length).toBeLessThanOrEqual(72)
  })

  // R2: no word the player would have to look up. They learned by ear and by
  // tab, and a line that needs a glossary re-creates the gap it exists to
  // close.
  it.each(ENTRIES)('%s uses no word the player would have to look up', (_flavour, entry) => {
    expect(entry.line).not.toMatch(/characteristic|tonality|seventh|sixth|second|fourth|fifth/i)
    expect(entry.line).not.toMatch(/\b(?:I{1,3}|IV|VI{0,2}|VII)\b/)
  })
})

describe('the blues scale', () => {
  // AC5: it gets a line like every other answer, it names the ♭5 sitting
  // between the 4 and the 5, and it is not called a mode — because it is not
  // one.
  it('names its ♭5 and does not call itself a mode', () => {
    const blues = characterOf('Blues')
    expect(blues?.degrees).toEqual(['♭5'])
    expect(blues?.line).toContain('♭5')
    expect(blues?.line).toContain('4')
    expect(blues?.line).toContain('5')
    expect(blues?.line.toLowerCase()).not.toContain('mode')
  })
})
