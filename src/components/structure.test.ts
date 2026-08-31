import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const componentsDir = resolve(process.cwd(), 'src/components')

const GROUPS = ['controls', 'display', 'layout', 'surfaces', 'typography']

const COMPONENTS: Record<string, string[]> = {
  layout: ['Container', 'PageShell', 'Row', 'Stack', 'LabelledColumn'],
  surfaces: ['Card', 'Panel'],
  controls: ['Button', 'Chip', 'ChipGroup', 'PlayControl'],
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

  // Step D2, D3 — R7, R10, AC8
  it('has no component file its role folder does not list', () => {
    // The converse of the assertion above. Without it a deletion is not
    // provable: dropping a name from COMPONENTS while the file stays on disk
    // would leave every assertion green.
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

  // Step D1 — R9, AC8a
  // Step D1 widened by Epic 2 Step C1 — R7a, AC8b: `busy` joins them, because
  // the page has a pending press to report. The rule is unchanged — a prop no
  // caller can reach does not survive — so the list stays exact.
  // feature-8 Epic 2, Step B4 — R3, R4, AC10: the rule is about *reachable
  // props*, which the exact list below enforces on its own. The old blanket ban
  // on the word `size` was only a proxy for it. The control now asks `Button`
  // for the large size, and that is the control's own choice, not a knob a
  // caller turns — so the ban narrows to a `size` prop, and the choice is
  // pinned instead.
  it('gives PlayControl only the four props its one caller can reach', () => {
    const source = readFileSync(join(componentsDir, 'controls/PlayControl.tsx'), 'utf8')

    const block = source.match(/type PlayControlProps = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()

    const props = [...(block as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm)].map(
      (match) => match[1],
    )
    expect(props).toEqual(['isPlaying', 'onToggle', 'busy', 'text'])

    // The `size` *prop* is gone, and with it the branch that rendered
    // `IconButton`. What survives is the control naming its own size on the
    // `Button` it renders.
    expect(source).not.toContain('PlayControlSize')
    expect(source).not.toContain('IconButton')
    expect(source).not.toMatch(/^\s{2}size\??:/m)
    expect(source).toContain('size="lg"')
  })

  // feature-7 Epic 3, Step C2 — R2, AC1. The dot row's explanation is carried
  // by its own `aria-label` and a native `title`, so the epic adds no
  // design-system primitive to deliver it.
  it('has no tooltip component', () => {
    const tooltips = allFiles
      .map((f) => f.slice(componentsDir.length + 1))
      .filter((f) => /Tooltip/.test(f))

    expect(tooltips).toEqual([])
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
