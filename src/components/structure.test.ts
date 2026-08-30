import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const componentsDir = resolve(process.cwd(), 'src/components')

const GROUPS = ['controls', 'display', 'layout', 'surfaces', 'typography']

const COMPONENTS: Record<string, string[]> = {
  layout: ['Container', 'PageShell', 'Row', 'Stack', 'LabelledColumn'],
  surfaces: ['Card', 'MiniCard', 'Panel'],
  controls: ['Button', 'IconButton', 'Chip', 'ChipGroup', 'PlayControl'],
  typography: ['Heading', 'Text', 'EyebrowLabel', 'SectionLabel'],
  display: ['Pill', 'ProgressTrack'],
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const allFiles = walk(componentsDir)
const sourceFiles = allFiles.filter((f) => /\.tsx?$/.test(f))

/** Every `from '…'` and `import('…')` specifier in a source file. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1])
  }
  return specifiers
}

describe('design system structure', () => {
  // Step A1 — R3, AC2
  it('has no barrel files', () => {
    const barrels = allFiles
      .filter((f) => /(^|\/)index\.tsx?$/.test(f))
      .map((f) => f.slice(componentsDir.length + 1))

    expect(barrels).toEqual([])
  })

  // Step A2 — R1, R2, AC1
  it('contains exactly the five role folders plus tokens.ts', () => {
    const entries = readdirSync(componentsDir, { withFileTypes: true })

    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(directories).toEqual(GROUPS)

    // Structural tests are the only test files allowed to sit at the root;
    // no component or its test may.
    const files = entries
      .filter((entry) => entry.isFile() && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
    expect(files).toEqual(['tokens.ts'])
  })

  // Step A2 — R1, AC1
  it('places every component in its role folder beside its own test', () => {
    const missing: string[] = []

    for (const [group, names] of Object.entries(COMPONENTS)) {
      for (const name of names) {
        for (const file of [`${name}.tsx`, `${name}.test.tsx`]) {
          const path = join(componentsDir, group, file)
          if (!existsSync(path)) missing.push(`${group}/${file}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  // Step A3 — R10, AC8
  it('has no import that climbs out of its own folder', () => {
    const offenders: string[] = []

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      for (const specifier of importSpecifiers(source)) {
        if (/^\.\.\//.test(specifier)) {
          offenders.push(`${file.slice(componentsDir.length + 1)} -> ${specifier}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
