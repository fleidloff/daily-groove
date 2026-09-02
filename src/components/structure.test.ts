import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const componentsDir = resolve(process.cwd(), 'src/components')

const GROUPS = ['controls', 'display', 'layout', 'surfaces', 'typography']

const COMPONENTS: Record<string, string[]> = {
  layout: ['Container', 'PageShell', 'Row', 'Stack', 'LabelledColumn'],
  surfaces: ['Card', 'Panel'],
  controls: ['Button', 'Chip', 'ChipGroup', 'InlineButton', 'PlayControl', 'Switch'],
  typography: ['Heading', 'Text', 'EyebrowLabel', 'SectionLabel', 'Lettering'],
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
  it('has no barrel files', () => {
    const barrels = allFiles
      .filter((f) => /(^|\/)index\.tsx?$/.test(f))
      .map((f) => f.slice(componentsDir.length + 1))

    expect(barrels).toEqual([])
  })

  it('contains exactly the five role folders plus tokens.ts', () => {
    const entries = readdirSync(componentsDir, { withFileTypes: true })

    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(directories).toEqual(GROUPS)

    const files = entries
      .filter((entry) => entry.isFile() && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
    expect(files).toEqual(['tokens.ts'])
  })

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

  it('has no component file its role folder does not list', () => {
    const unlisted: string[] = []

    for (const [group, names] of Object.entries(COMPONENTS)) {
      const present = new Set(
        readdirSync(join(componentsDir, group))
          .filter((file) => /\.tsx?$/.test(file))
          .map((file) => file.replace(/(\.test)?\.tsx?$/, '')),
      )
      for (const name of present) {
        if (!names.includes(name)) unlisted.push(`${group}/${name}`)
      }
    }

    expect(unlisted.sort()).toEqual([])
  })

  it('gives PlayControl only the four props its one caller can reach', () => {
    const source = readFileSync(join(componentsDir, 'controls/PlayControl.tsx'), 'utf8')

    const block = source.match(/type PlayControlProps = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()

    const props = [...(block as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm)].map(
      (match) => match[1],
    )
    expect(props).toEqual(['isPlaying', 'onToggle', 'busy', 'text'])

    expect(source).not.toContain('PlayControlSize')
    expect(source).not.toContain('IconButton')
    expect(source).not.toMatch(/^\s{2}size\??:/m)
    expect(source).toContain('size="lg"')
  })

  it('has no tooltip component', () => {
    const tooltips = allFiles
      .map((f) => f.slice(componentsDir.length + 1))
      .filter((f) => /Tooltip/.test(f))

    expect(tooltips).toEqual([])
  })

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
