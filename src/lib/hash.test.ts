import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashString } from './hash'

// A change-detector. When this table fails, restore hashString — never
// regenerate the table.
const PIN: ReadonlyArray<readonly [string, number]> = [
  ['', 2166136261],
  ['a', 3826002220],
  ['2026-08-30', 1258545406],
  ['groove-01', 699487093],
  ['groove-16', 884187997],
  ['E♭ dorian', 2486161818],
  ['2026-01-01', 2049302883],
  ['straight-funk:1:events', 3151190932],
  ['🥁', 2083220512],
]

describe('hashString', () => {
  it.each(PIN)('hashes %j to the pinned value', (input, expected) => {
    expect(hashString(input)).toBe(expected)
  })

  it('returns a non-negative 32-bit integer', () => {
    for (const [input] of PIN) {
      const h = hashString(input)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(2 ** 32)
    }
  })

  it('is pure: the same input hashes the same on every call', () => {
    expect(hashString('groove-01')).toBe(hashString('groove-01'))
  })
})

const FNV_PRIME = String(2 ** 24 + 403)

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'public'])

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFilesUnder(full))
    else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('the FNV-1a constant', () => {
  it('appears in exactly one file under src/ and scripts/', () => {
    const files = [
      ...sourceFilesUnder(join(REPO_ROOT, 'src')),
      ...sourceFilesUnder(join(REPO_ROOT, 'scripts')),
    ]
    const holders = files
      .filter((file) => readFileSync(file, 'utf8').includes(FNV_PRIME))
      .map((file) => relative(REPO_ROOT, file))
      .sort()
    expect(holders).toEqual(['src/lib/hash.ts'])
  })
})
