import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as snippets from './index'

const SNIPPETS_ROOT = import.meta.dirname
const SRC_ROOT = join(SNIPPETS_ROOT, '..', '..')

const AREAS = [
  'branding',
  'coaching',
  'header',
  'intro',
  'puzzle',
  'routes',
  'solved',
] as const

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return filesUnder(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

describe('the snippets module is one file per area behind one index', () => {
  it('holds an en/ folder whose files are exactly the areas', () => {
    const names = readdirSync(join(SNIPPETS_ROOT, 'en'))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => name.replace(/\.ts$/, ''))
      .sort()

    expect(names).toEqual([...AREAS].sort())
  })

  it('re-exports every area under its own name and nothing else', () => {
    expect(Object.keys(snippets).sort()).toEqual([...AREAS].sort())
  })

  it('exports a non-empty object per area', () => {
    for (const area of AREAS) {
      const values = Object.values(snippets[area] as Record<string, unknown>)
      expect(values.length, area).toBeGreaterThan(0)
    }
  })
})

describe('the language folder is private to the index', () => {
  it('is named by no import specifier outside src/lib/snippets/', () => {
    const offenders = filesUnder(SRC_ROOT)
      .filter((file) => !file.startsWith(SNIPPETS_ROOT))
      .filter((file) => readFileSync(file, 'utf8').includes('snippets/en'))
      .map((file) => file.slice(SRC_ROOT.length + 1))

    expect(offenders).toEqual([])
  })
})

describe('an interpolating snippet is a function of its arguments', () => {
  it('returns the same string for the same arguments', () => {
    expect(snippets.puzzle.bpm({ bpm: 96 })).toBe(snippets.puzzle.bpm({ bpm: 96 }))
    expect(snippets.header.streakName({ days: 3 })).toBe(
      snippets.header.streakName({ days: 3 }),
    )
  })

  it('renders its argument into the string', () => {
    expect(snippets.puzzle.bpm({ bpm: 96 })).toContain('96')
    expect(snippets.header.streakName({ days: 3 })).toContain('3')
    expect(snippets.header.streakCount({ days: 3 })).toBe('3')
  })
})

describe('the heard-in line (quick 001)', () => {
  const args = { track: 'So What', artist: 'Miles Davis' }

  it('returns the same string for the same arguments', () => {
    expect(snippets.solved.heardIn(args)).toBe(snippets.solved.heardIn({ ...args }))
  })

  it('renders both the track and the artist', () => {
    const line = snippets.solved.heardIn(args)
    expect(line).toContain('So What')
    expect(line).toContain('Miles Davis')
    expect(line.indexOf('So What')).toBeLessThan(line.indexOf('Miles Davis'))
  })

})

describe('the next-groove line (quick 3)', () => {
  it('renders the hours and the minutes as a clock reading', () => {
    expect(snippets.solved.nextGrooveIn({ hours: 7, minutes: 12 })).toContain('7h 12m')
    expect(snippets.solved.nextGrooveIn({ hours: 13, minutes: 5 })).toContain('13h 05m')
  })

  it('keeps the hours and pads the minutes when few are left', () => {
    expect(snippets.solved.nextGrooveIn({ hours: 0, minutes: 5 })).toContain('0h 05m')
    expect(snippets.solved.nextGrooveIn({ hours: 0, minutes: 0 })).toContain('0h 00m')
  })

  it('returns the same string for the same arguments', () => {
    expect(snippets.solved.nextGrooveIn({ hours: 1, minutes: 1 })).toBe(
      snippets.solved.nextGrooveIn({ hours: 1, minutes: 1 }),
    )
  })

  it('has a line for the moment the next groove is already there', () => {
    expect(snippets.solved.nextGrooveReady.length).toBeGreaterThan(0)
    expect(snippets.solved.nextGrooveReady).not.toBe(
      snippets.solved.nextGrooveIn({ hours: 0, minutes: 0 }),
    )
  })
})

describe('feature-22 wording', () => {
  it('names both ways to play and points at the switch by its name (F22 E2 R4)', () => {
    expect(snippets.intro.twoWays).toBe(
      'Two ways to play: Simple mode is six roots, Major or Minor. The switch on the card opens up the full set.',
    )
    expect(snippets.intro.twoWays).toContain(snippets.puzzle.simpleMode)
    expect(snippets.intro.steps).toHaveLength(4)
  })

  it('describes each side of the switch by what the row shows (F22 E2 R2)', () => {
    expect(snippets.puzzle.simpleModeOn).toBe('Six roots, Major or Minor')
    expect(snippets.puzzle.simpleModeOff).toBe('Twelve roots, four modes')
    expect(snippets.puzzle.simpleMode).toBe('Simple mode')
  })

  it('holds the drum credit under puzzle (F22 E2 R8)', () => {
    expect(snippets.puzzle.drumCredit).toBe(
      'Drum samples provided by DrumGizmo.org',
    )
  })

  it('opens the ladder on the listening line, on and off (F22 E2 R6, R7)', () => {
    const [first] = snippets.coaching.ladder
    expect(first.message).toBe(
      'Loop it a few times. Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.',
    )
    expect(first.soundsOff).toBe(
      'Loop it a few times. Find the note that feels like home — Play along with your instrument.',
    )
    expect(snippets.coaching.opening).toBe(first.message)
    expect(
      first.message.replace(', or tap a root or a mode to hear it', ''),
    ).toBe(first.soundsOff)
  })
  it('carries no caption and files the credit under puzzle only (F22 E2 R5, R8, R9)', () => {
    expect(snippets.puzzle).not.toHaveProperty('captionSoundsOn')
    expect(snippets.puzzle).not.toHaveProperty('captionSoundsOff')
    expect(snippets.intro).not.toHaveProperty('drumCredit')
  })
})

describe('the give-up ending (F22 E3)', () => {
  it('labels the revealed button from coaching, beside the solved label (R7, AC6)', () => {
    expect(typeof snippets.coaching.checkRevealed).toBe('string')
    expect(snippets.coaching.checkRevealed).not.toBe('')
  })

  it('no longer carries the given-up line (R7, AC6)', () => {
    expect(snippets.solved).not.toHaveProperty('givenUp')
  })
})

describe('feature-23 wording', () => {
  it('names the transpose select and each key’s instrument (F23 E1 R1, AC1, AC1b)', () => {
    expect(snippets.header.transpose).toBe('Transpose')
    expect(snippets.header.instruments).toEqual({
      C: 'C · concert',
      'B♭': 'B♭ · trumpet, tenor sax',
      'E♭': 'E♭ · alto sax',
      F: 'F · horn',
    })
  })

  it('opens each option with the key it sets (F23 E1 R1, AC1b)', () => {
    const { instruments } = snippets.header
    for (const key of ['C', 'B♭', 'E♭', 'F'] as const) {
      expect(instruments[key].startsWith(key)).toBe(true)
    }
  })

  it('leaves the root eyebrow one word, on every instrument (F23 E1 R11, AC13)', () => {
    expect(snippets.puzzle.rootGroup).toBe('Root')
  })

  it('explains the transpose select in one line that names it (F23 E1 R12, AC15)', () => {
    expect(snippets.intro.transpose).toBe(
      "Play a sax or a trumpet? Pick your key beside Transpose in the top row and the roots, chords and notes read in your instrument's pitch.",
    )
    expect(snippets.intro.transpose).toContain(snippets.header.transpose)
    expect(snippets.intro.steps).toHaveLength(4)
  })
})

describe('the concert line (F23 E2)', () => {
  it('names the concert answer and says which pitch it is in (F23 E2 R5, AC6)', () => {
    expect(snippets.solved.concertPitch({ root: 'E♭', flavour: 'Dorian' })).toBe(
      'E♭ Dorian in concert pitch',
    )
  })

  it('returns the same string for the same arguments', () => {
    const args = { root: 'A♭', flavour: 'Phrygian' }
    expect(snippets.solved.concertPitch(args)).toBe(snippets.solved.concertPitch({ ...args }))
  })

  it('puts the root before the flavour and both before the qualifier', () => {
    const line = snippets.solved.concertPitch({ root: 'F♯', flavour: 'Blues' })
    expect(line.indexOf('F♯')).toBeLessThan(line.indexOf('Blues'))
    expect(line.indexOf('Blues')).toBeLessThan(line.indexOf('concert'))
  })
})
