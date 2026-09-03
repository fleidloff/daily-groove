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
