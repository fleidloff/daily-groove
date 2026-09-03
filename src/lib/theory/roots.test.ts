import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOTS, midiOf, noteName, pitchClassOf } from './roots'

describe('ROOTS', () => {
  it('is the twelve chromatic roots in the app’s spelling', () => {
    expect(ROOTS).toEqual([
      'C',
      'C♯',
      'D',
      'E♭',
      'E',
      'F',
      'F♯',
      'G',
      'A♭',
      'A',
      'B♭',
      'B',
    ])
  })
})

describe('midiOf', () => {
  it('places middle C at 60', () => {
    expect(midiOf('C', 4)).toBe(60)
  })

  it('walks up in semitones across an octave', () => {
    expect(midiOf('C♯', 4)).toBe(61)
    expect(midiOf('B', 4)).toBe(71)
    expect(midiOf('C', 5)).toBe(72)
    expect(midiOf('C', 1)).toBe(24)
  })
})

describe('noteName', () => {
  it('names middle C', () => {
    expect(noteName(60)).toBe('C')
  })

  it('round-trips every one of the twelve roots', () => {
    for (const root of ROOTS) {
      expect(noteName(midiOf(root, 4))).toBe(root)
      expect(noteName(midiOf(root, 1))).toBe(root)
    }
  })

  it('is octave-independent', () => {
    expect(noteName(48)).toBe('C')
    expect(noteName(0)).toBe('C')
    expect(noteName(70)).toBe('B♭')
  })
})

describe('pitchClassOf', () => {
  it('maps a root to its 0..11 pitch class', () => {
    expect(pitchClassOf('C')).toBe(0)
    expect(pitchClassOf('E♭')).toBe(3)
    expect(pitchClassOf('B')).toBe(11)
  })

  it('throws on a root outside the twelve', () => {
    expect(() => pitchClassOf('H' as (typeof ROOTS)[number])).toThrow(/H/)
  })
})

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'public'])

function sourceFilesUnder(dirs: string[]): string[] {
  const out: string[] = []
  for (const dir of dirs) {
    for (const entry of readdirSync(join(REPO_ROOT, dir), {
      withFileTypes: true,
    })) {
      if (SKIP.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) out.push(...sourceFilesUnder([full]))
      else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) out.push(full)
    }
  }
  return out
}

// Built, never written: keeping the list out of its own search is what lets the
// scan mean what it says, the way src/lib/hash.test.ts derives the FNV prime.
const NEEDLE = ROOTS.map((r) => `'${r}'`).join(',')

describe('the root list is declared once', () => {
  it('is the only file in the repo that lists the twelve roots', () => {
    const holders = sourceFilesUnder(['src', 'scripts'])
      .filter((file) => !/\.(test|spec)\.tsx?$/.test(file))
      .filter((file) =>
        readFileSync(join(REPO_ROOT, file), 'utf8')
          .replace(/\s+/g, '')
          .includes(NEEDLE),
      )
      .map((file) => relative('.', file))
      .sort()
    expect(holders).toEqual(['src/lib/theory/roots.ts'])
  })
})
