import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPTS_DIR = resolve(import.meta.dirname, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')

const MANIFEST_OUTPUT_PATHS = [
  '../../src/features/daily-groove/data/grooves.generated.ts',
  '../../src/features/daily-groove/data/notes.generated.ts',
]

function scriptFiles(dir: string = SCRIPTS_DIR): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...scriptFiles(full))
    else if (entry.name.endsWith('.ts')) out.push(relative(REPO_ROOT, full))
  }
  return out.sort()
}

function specifiersOf(file: string): string[] {
  const source = readFileSync(join(REPO_ROOT, file), 'utf8')
  const found: string[] = []
  for (const m of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) found.push(m[1])
  for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(m[1])
  }
  for (const m of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(m[1])
  }
  return found
}

describe('the generator/app boundary', () => {
  it('finds the generator sources it is meant to be checking', () => {
    const files = scriptFiles()
    expect(files.length).toBeGreaterThan(40)
    expect(files).toContain('scripts/grooves/cli.ts')
    expect(files).toContain('scripts/grooves/manifest.ts')
    expect(files).toContain('scripts/grooves/pools.ts')
  })

  it('imports nothing from src/features', () => {
    const offenders: string[] = []
    for (const file of scriptFiles()) {
      for (const specifier of specifiersOf(file)) {
        if (specifier.includes('src/features')) {
          offenders.push(`${file} imports ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('names src/features only as the manifests it writes', () => {
    expect(MANIFEST_OUTPUT_PATHS).toHaveLength(2)

    const offenders: string[] = []
    for (const file of scriptFiles()) {
      if (file === 'scripts/grooves/boundary.test.ts') continue
      const source = readFileSync(join(REPO_ROOT, file), 'utf8')
      let stripped = source
      for (const path of MANIFEST_OUTPUT_PATHS) stripped = stripped.split(path).join('')
      if (stripped.includes('src/features')) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('reaches the app only through src/lib', () => {
    const crossings = new Set<string>()
    for (const file of scriptFiles()) {
      for (const specifier of specifiersOf(file)) {
        if (specifier.includes('/src/') || specifier.startsWith('src/')) {
          crossings.add(specifier)
        }
      }
    }
    for (const specifier of crossings) {
      expect(
        specifier.includes('src/lib/'),
        `scripts/ may only import src/lib/, not ${specifier}`,
      ).toBe(true)
    }
    const shared = [...crossings]
      .map((specifier) => specifier.slice(specifier.indexOf('src/lib/')))
      .sort()
    expect([...new Set(shared)]).toEqual([
      'src/lib/groove.ts',
      'src/lib/hash.ts',
      'src/lib/theory/names.ts',
      'src/lib/theory/roots.ts',
      'src/lib/theory/scales.ts',
    ])
  })

  it('declares neither Root nor the Flavour union, it imports both', () => {
    const source = readFileSync(join(SCRIPTS_DIR, 'grooves/types.ts'), 'utf8')
    expect(source).not.toMatch(/\bexport\s+type\s+Root\b/)
    expect(source).not.toMatch(/\bexport\s+type\s+Flavour\s*=/)
    expect(source).toMatch(
      /export\s+type\s*\{\s*FlavourSlug\s+as\s+Flavour\s*\}\s*from\s*'[^']*src\/lib\/theory\/names\.ts'/,
    )
    expect(source).not.toMatch(/\bFlavour\b[^\n]*src\/lib\/groove\.ts/)
  })
})
