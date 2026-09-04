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
    expect(snippets.header.streakDays({ days: 3 })).toBe(
      snippets.header.streakDays({ days: 3 }),
    )
  })

  it('renders its argument into the string', () => {
    expect(snippets.puzzle.bpm({ bpm: 96 })).toContain('96')
    expect(snippets.header.streakDays({ days: 3 })).toContain('3')
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
