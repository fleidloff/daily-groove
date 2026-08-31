import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The generator's one channel into the app is `src/lib/`.
 *
 * `src/lib/` is a leaf — it imports nothing from the app — which is what lets
 * `scripts/` reach it by relative path from outside the `@/` alias. Everything
 * else in `src/` is off limits: the generator produces grooves, it does not
 * play them, and a feature must stay deletable without breaking the tool that
 * fills it.
 *
 * `import/no-restricted-paths` in `eslint.config.mjs` is the real guard. This
 * test is the fast one: it needs no eslint run and fails inside the generator
 * project, where the crossing would be introduced.
 */

const SCRIPTS_DIR = resolve(import.meta.dirname, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')

/**
 * The only places `src/features` may legitimately be named under `scripts/`:
 * the paths the generator *writes* its manifests to. Writing a file into the
 * feature is not importing from it — each of these is generated data that lives
 * in the feature's `data/` folder, and the generator has to know where to put
 * it. Every entry here is a write destination, never an import specifier.
 *
 * There are two because two commands render: `npm run grooves` writes the
 * groove catalogue's manifest, and `npm run notes` writes the reference notes'.
 * The count is asserted below, so a third destination is a deliberate edit here
 * rather than a silent widening of the boundary.
 */
const MANIFEST_OUTPUT_PATHS = [
  '../../src/features/daily-groove/data/grooves.generated.ts',
  '../../src/features/daily-groove/data/notes.generated.ts',
]

/** Every `.ts` file under `scripts/`, recursively, as a repo-relative path. */
function scriptFiles(dir: string = SCRIPTS_DIR): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...scriptFiles(full))
    else if (entry.name.endsWith('.ts')) out.push(relative(REPO_ROOT, full))
  }
  return out.sort()
}

/** Every module specifier a file imports, requires, or re-exports. */
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
    // A guard on the guard: a broken walk would make every assertion below
    // vacuously true.
    const files = scriptFiles()
    expect(files.length).toBeGreaterThan(40)
    expect(files).toContain('scripts/grooves/cli.ts')
    expect(files).toContain('scripts/grooves/manifest.ts')
    expect(files).toContain('scripts/grooves/pools.ts')
  })

  // AC11: no file under scripts/ imports from src/features/**.
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

  // AC11, continued: and it names src/features nowhere else either, except at
  // the one path it writes the generated manifest to.
  it('names src/features only as the manifests it writes', () => {
    // Two write destinations, and only two. Widening this list is how a third
    // one gets in, so the length is part of the assertion.
    expect(MANIFEST_OUTPUT_PATHS).toHaveLength(2)

    const offenders: string[] = []
    for (const file of scriptFiles()) {
      // This guard is exempt from its own literal check: it has to name the
      // path it forbids in order to forbid it. Its *imports* are checked above
      // like every other file's.
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
    // The two the generator legitimately shares with the app.
    expect([...crossings].sort()).toEqual([
      '../../src/lib/groove.ts',
      '../../src/lib/hash.ts',
      '../../../src/lib/groove.ts',
    ].sort())
  })

  // Step A3b: one declaration of Root, in src/lib/groove.ts.
  it('does not redeclare Root in the generator, it imports the shared one', () => {
    const source = readFileSync(join(SCRIPTS_DIR, 'grooves/types.ts'), 'utf8')
    expect(source).not.toMatch(/\bexport\s+type\s+Root\b/)
    // Flavour is NOT a duplicate and stays: the generator's is a closed union
    // of eight internal mode names, the app's is a display string.
    expect(source).toMatch(/\bexport\s+type\s+Flavour\b/)
  })
})
