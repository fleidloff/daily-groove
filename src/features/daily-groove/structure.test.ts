import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FEATURE = join(process.cwd(), 'src', 'features', 'daily-groove')
const LIB = join(FEATURE, 'lib')
const DATA = join(FEATURE, 'data')
const COMPONENTS = join(FEATURE, 'components')

const featureDir = 'src/features/daily-groove'
const hooksDir = `${featureDir}/hooks`
const stateDir = `${featureDir}/state`

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

function hookModules(): string[] {
  return readdirSync(hooksDir).filter((name) => !/\.(test|spec)\.tsx?$/.test(name))
}

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

describe('lib holds no loose modules', () => {
  const entries = () => readdirSync(LIB, { withFileTypes: true })

  it('contains only directories', () => {
    const loose = entries()
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.name)
    expect(loose).toEqual([])
  })

  it('contains exactly the six concern folders', () => {
    const dirs = entries()
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(dirs).toEqual([
      'audio',
      'persistence',
      'presentation',
      'puzzle',
      'share',
      'theory',
    ])
  })
})

describe('the generated manifest lives in data, not lib', () => {
  it('has no grooves.generated.ts anywhere under lib', () => {
    const offenders = filesUnder(LIB).filter((file) =>
      file.endsWith('grooves.generated.ts'),
    )
    expect(offenders).toEqual([])
  })

  it('has the manifest in data with its test beside it', () => {
    expect(existsSync(join(DATA, 'grooves.generated.ts'))).toBe(true)
    expect(existsSync(join(DATA, 'grooves.generated.test.ts'))).toBe(true)
  })
})

describe('daily-groove feature structure', () => {
  it('holds only `use`-prefixed files under hooks/', () => {
    const entries = readdirSync(hooksDir, { withFileTypes: true })
    const misnamed = entries
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('use'))
    expect(misnamed).toEqual([])
  })

  it('holds only genuine React hook modules under hooks/', () => {
    const notHooks = hookModules().filter((name) => {
      const source = readFileSync(`${hooksDir}/${name}`, 'utf8')
      const importsReact = /from ['"]react['"]/.test(source)
      const exportsHook = /export (?:function|const) use[A-Z]/.test(source)
      return !importsReact || !exportsHook
    })
    expect(notHooks).toEqual([])
  })

  it('holds the store factory under state/', () => {
    expect(existsSync(`${stateDir}/useDailyGrooveStore.ts`)).toBe(true)
  })
})

describe('feature components sit in screen regions', () => {
  const REGIONS: Record<string, string[]> = {
    header: ['GrooveHeader', 'HelpToggle', 'ShareGroove', 'StreakBadge'],
    intro: ['HowToPlay'],
    puzzle: [
      'GrooveCard',
      'TransportPanel',
      'GuessCard',
      'ModeToggle',
      'TapSoundsToggle',
      'AttemptDots',
      'FeedbackLine',
      'NudgeBox',
      'SharedGrooveNotice',
      'PlayTodayLink',
    ],
    solved: ['SolvedPanel', 'LeadSheet', 'ScaleStaff'],
  }

  const entries = () => readdirSync(COMPONENTS, { withFileTypes: true })

  it('contains exactly the four region directories', () => {
    const dirs = entries()
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(dirs).toEqual(['header', 'intro', 'puzzle', 'solved'])
  })

  it('holds only the root component at the components/ root', () => {
    const files = entries()
      .filter((entry) => entry.isFile() && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
    expect(files).toEqual(['GroovePuzzle.tsx'])
    const composedTests = [
      'GroovePuzzle.page.test.tsx',
      'GroovePuzzle.guessing.test.tsx',
      'GroovePuzzle.sounding.test.tsx',
      'GroovePuzzle.intro.test.tsx',
      'GroovePuzzle.header.test.tsx',
    ]
    const absent = composedTests.filter((name) => !existsSync(join(COMPONENTS, name)))
    expect(absent).toEqual([])
    expect(existsSync(join(COMPONENTS, 'GroovePuzzle.test.tsx'))).toBe(false)
  })

  it('names every component that exists in a region directory', () => {
    const undeclared: string[] = []

    for (const [region, names] of Object.entries(REGIONS)) {
      const declared = new Set(names)
      const present = readdirSync(join(COMPONENTS, region), { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.tsx') &&
            !/\.test\.tsx$/.test(entry.name),
        )
        .map((entry) => entry.name.replace(/\.tsx$/, ''))

      for (const name of present) {
        if (!declared.has(name)) undeclared.push(`${region}/${name}`)
      }
    }

    expect(undeclared).toEqual([])
  })

  it('places every other component in its region beside its own test', () => {
    const missing: string[] = []

    for (const [region, names] of Object.entries(REGIONS)) {
      for (const name of names) {
        for (const file of [`${name}.tsx`, `${name}.test.tsx`]) {
          const path = join(COMPONENTS, region, file)
          if (!existsSync(path)) missing.push(`${region}/${file}`)
        }
      }
    }

    expect(missing).toEqual([])
  })
})

describe('design-system consumers use grouped paths', () => {
  it('has no ungrouped @/components import under src/app or src/features', () => {
    const roots = [
      join(process.cwd(), 'src', 'app'),
      join(process.cwd(), 'src', 'features'),
    ]
    const offenders: string[] = []

    for (const root of roots) {
      for (const file of filesUnder(root).filter((f) => /\.tsx?$/.test(f))) {
        const source = readFileSync(file, 'utf8')
        for (const specifier of importSpecifiers(source)) {
          if (/^@\/components\/[A-Z]/.test(specifier)) {
            offenders.push(`${file.slice(process.cwd().length + 1)} -> ${specifier}`)
          }
        }
      }
    }

    expect(offenders).toEqual([])
  })
})

describe('GroovePuzzle holds no archive plumbing', () => {
  const REMOVED = [
    'groovesByDate',
    'archiveEntries',
    'handleArchiveToggle',
    'toggleSource',
    'lastSource',
  ]

  it('names none of the removed archive bindings', () => {
    const source = readFileSync(join(COMPONENTS, 'GroovePuzzle.tsx'), 'utf8')
    const present = REMOVED.filter((name) => source.includes(name))
    expect(present).toEqual([])
  })

  it('imports nothing from the deleted archive modules', () => {
    const source = readFileSync(join(COMPONENTS, 'GroovePuzzle.tsx'), 'utf8')
    const offenders = importSpecifiers(source).filter((specifier) =>
      /archive|resolveGroove/.test(specifier),
    )
    expect(offenders).toEqual([])
  })
})
