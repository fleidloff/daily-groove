import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, posix } from 'node:path'
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

const COACHING_DIR = ['lib', 'presentation'].join('/')
const DOOR_DIR = `${featureDir}/${COACHING_DIR}`
const DOOR_FILE = `${DOOR_DIR}/index.ts`
const DOOR_LABEL = `${COACHING_DIR}/index.ts`
const GUARD_FILE = `${featureDir}/structure.test.ts`
const DEEP_COACHING = ['..', COACHING_DIR].join('/')
const SLICE_THEORY = ['features/daily-groove', 'lib', 'theory'].join('/')

const FAN_IN_FILES = ['components/GroovePuzzle.tsx']

function mockSpecifiers(source: string): string[] {
  return [...source.matchAll(/\bvi\.mock\s*\(\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  )
}

function toRepoPath(specifier: string): string {
  return specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : specifier
}

function deepCoachingSpecifiers(source: string): string[] {
  const deep = new RegExp(`(^|/)${COACHING_DIR}/.+`)
  return [...importSpecifiers(source), ...mockSpecifiers(source)].filter(
    (specifier) => deep.test(toRepoPath(specifier)),
  )
}

function resolveSpecifier(specifier: string, importer: string): string | null {
  let path: string
  if (specifier.startsWith('.')) {
    path = posix.join(posix.dirname(importer), specifier)
  } else if (specifier.startsWith('@/')) {
    path = toRepoPath(specifier)
  } else {
    return null
  }
  return path
    .replace(/\/index\.tsx?$/, '')
    .replace(/\/index$/, '')
    .replace(/\.tsx?$/, '')
}

function doorExports(source: string): string[] {
  if (/export\s*\*/.test(source)) {
    throw new Error(
      `${DOOR_LABEL} uses \`export *\`. A door lists its exports by name, or it is a barrel and the fan-in rule it serves means nothing (R4a).`,
    )
  }
  const names: string[] = []
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '')
      if (name !== '') names.push(name.split(/\s+as\s+/).slice(-1)[0])
    }
  }
  const declared =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\s*\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g
  for (const match of source.matchAll(declared)) names.push(match[1])
  return [...new Set(names)]
}

function importedNamesFrom(
  source: string,
  importer: string,
  doorDir: string,
): string[] {
  const names: string[] = []
  for (const match of source.matchAll(
    /\bimport\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g,
  )) {
    if (resolveSpecifier(match[2], importer) !== doorDir) continue
    const clause = match[1]
    const braced = clause.match(/\{([\s\S]*)\}/)
    if (braced) {
      for (const part of braced[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]
        if (name !== '') names.push(name)
      }
    }
    const namespaced = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
    if (namespaced) {
      const uses = new RegExp(`\\b${namespaced[1]}\\.([A-Za-z_$][\\w$]*)`, 'g')
      for (const use of source.matchAll(uses)) names.push(use[1])
    }
  }
  return names
}

function narrowDoorMessage(name: string): string {
  return `${DOOR_LABEL} exports \`${name}\`, and nothing in the repo imports it through the door. Import it through the door or delete the line — a door exports what its consumers use and nothing more (R4). This is a one-line fix.`
}

function narrowDoorReport(
  doorSource: string,
  importers: readonly { path: string; source: string }[],
): string[] {
  const used = new Set(
    importers.flatMap((importer) =>
      importedNamesFrom(importer.source, importer.path, DOOR_DIR),
    ),
  )
  return doorExports(doorSource)
    .filter((name) => !used.has(name))
    .map(narrowDoorMessage)
}

function repoSources(root: string): string[] {
  return filesUnder(join(process.cwd(), root))
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => file.slice(process.cwd().length + 1))
}

const SNIPPETS_ROOT = ['src', 'lib', 'snippets'].join('/')
const THEORY_ROOT = ['src', 'lib', 'theory'].join('/')

function isUnder(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`)
}

function siblingLeafOffenders(
  files: readonly { path: string; source: string }[],
): string[] {
  const offenders: string[] = []
  for (const { path, source } of files) {
    const home = isUnder(path, SNIPPETS_ROOT)
      ? SNIPPETS_ROOT
      : isUnder(path, THEORY_ROOT)
        ? THEORY_ROOT
        : null
    if (home === null) continue
    const sibling = home === SNIPPETS_ROOT ? THEORY_ROOT : SNIPPETS_ROOT
    for (const specifier of [
      ...importSpecifiers(source),
      ...mockSpecifiers(source),
    ]) {
      const resolved = resolveSpecifier(specifier, path) ?? toRepoPath(specifier)
      if (isUnder(resolved, sibling)) offenders.push(`${path} -> ${specifier}`)
    }
  }
  return offenders
}

describe('lib holds no loose modules', () => {
  const entries = () => readdirSync(LIB, { withFileTypes: true })

  it('contains only directories', () => {
    const loose = entries()
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.name)
    expect(loose).toEqual([])
  })

  it('contains exactly the five concern folders', () => {
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

  it('holds the store factory and the session context under state/ (F20 E2 R12)', () => {
    const files = readdirSync(stateDir)
      .filter((name) => !/\.(test|spec)\.tsx?$/.test(name))
      .sort()
    expect(files).toEqual(['PuzzleSessionContext.tsx', 'useDailyGrooveStore.ts'])
  })
})

describe('the coaching module has one door', () => {
  it('has an index.ts beside the modules it fronts (F20 E2 R1, R11)', () => {
    expect(existsSync(join(LIB, 'presentation', 'index.ts'))).toBe(true)
    expect(existsSync(join(LIB, 'presentation', 'index.test.ts'))).toBe(true)
  })

  it('imports nothing from the design system (F20 E2 R3b, AC3)', () => {
    const offenders: string[] = []
    for (const file of filesUnder(join(LIB, 'presentation'))) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('@/components/')) {
          offenders.push(`${file.slice(process.cwd().length + 1)} -> ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('feature components sit in screen regions', () => {
  const REGIONS: Record<string, string[]> = {
    header: [
      'GrooveHeader',
      'HelpToggle',
      'ShareGroove',
      'StreakBadge',
      'TransposeSelect',
    ],
    intro: ['HowToPlay'],
    puzzle: [
      'GrooveCard',
      'TransportPanel',
      'GuessCard',
      'ModeToggle',
      'TapSoundsToggle',
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
      'GroovePuzzle.copy.test.tsx',
      'GroovePuzzle.firstVisit.test.tsx',
      'GroovePuzzle.written.test.tsx',
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

describe('GroovePuzzle composes rather than calculates', () => {
  const source = () => readFileSync(join(COMPONENTS, 'GroovePuzzle.tsx'), 'utf8')

  it('imports none of the coaching modules (F20 E2 R6, AC6)', () => {
    const banned = ['feedback', 'coaching', 'verdict', 'confirmed', 'ruledOut']
    const offenders = importSpecifiers(source()).filter((specifier) =>
      banned.some((name) => specifier === `../lib/presentation/${name}`),
    )
    expect(offenders).toEqual([])
  })

  it('computes no offered selection (F20 E2 R6, AC6)', () => {
    const offenders = ['offeredRoot', 'offeredFlavour', 'canCheckOffered'].filter(
      (binding) => source().includes(binding),
    )
    expect(offenders).toEqual([])
  })

  it('provides the session it creates (F20 E2 R4b, AC4a)', () => {
    expect(source()).toContain('PuzzleSessionProvider')
  })
})


describe('the shell reaches coaching only through its door', () => {
  it('fires on a deep coaching import and on a mock of one (F20 E3 R3, R10, AC3)', () => {
    const violation = [
      `import { metaLine } from '${DEEP_COACHING}/date'`,
      `vi.mock('${DEEP_COACHING}/coaching')`,
    ].join('\n')
    expect(deepCoachingSpecifiers(violation)).toEqual([
      `${DEEP_COACHING}/date`,
      `${DEEP_COACHING}/coaching`,
    ])
  })

  it('ignores the four folders that get no door (F20 E3 R3a, AC3)', () => {
    const source = [
      `import { guessCardView } from '${DEEP_COACHING}'`,
      "import type { Root } from '../types'",
      "import { GROOVES } from '../data/grooves.generated'",
      "import { useProgress } from '../hooks/useProgress'",
      "import { Card } from '@/components/surfaces/Card'",
      "import { flavourPool } from '@/lib/theory/music'",
      "import { referenceOutput } from '../lib/audio/output'",
      "import { selectGrooveForDate } from '../lib/puzzle/selectGroove'",
      "import { createLocalStore } from '../lib/persistence/storage'",
    ].join('\n')
    expect(deepCoachingSpecifiers(source)).toEqual([])
  })

  it('reads the composer and nothing else (F20 E3 R3b, AC3)', () => {
    expect(FAN_IN_FILES).toEqual(['components/GroovePuzzle.tsx'])
  })

  it('holds the shell to the door (F20 E3 R3, AC3)', () => {
    for (const relative of FAN_IN_FILES) {
      const source = readFileSync(join(FEATURE, relative), 'utf8')
      expect(deepCoachingSpecifiers(source)).toEqual([])
    }
  })

  it('leaves puzzle/FeedbackLine.tsx importing coaching directly (F20 E3 R3b, AC3)', () => {
    const source = readFileSync(join(COMPONENTS, 'puzzle', 'FeedbackLine.tsx'), 'utf8')
    expect(deepCoachingSpecifiers(source).length).toBeGreaterThan(0)
  })
})

describe('the coaching door is narrow', () => {
  it('fails on sight on `export *` (F20 E3 R4a, R10, AC4)', () => {
    const wide = ['export', '* from', "'./date'"].join(' ')
    expect(() => doorExports(wide)).toThrow(/export \*/)
    expect(() => doorExports(wide)).toThrow(/R4a/)
  })

  it('names an export nobody imports, and says it is a one-line fix (F20 E3 R4, R10, AC4)', () => {
    const door = ['export const a = 1', "export type { b } from './b'"].join('\n')
    const report = narrowDoorReport(door, [
      {
        path: `${featureDir}/components/Synthetic.tsx`,
        source: `import { a } from '${DEEP_COACHING}'`,
      },
    ])
    expect(report).toHaveLength(1)
    expect(report[0]).toContain('`b`')
    expect(report[0]).toContain('This is a one-line fix.')
  })

  it('exists beside the modules it fronts (F20 E3 R4, AC4)', () => {
    expect(existsSync(join(process.cwd(), DOOR_FILE))).toBe(true)
  })

  it('is the slice’s only door, and src/lib/theory/ has none (F20 E3 R2a, AC2)', () => {
    const doors = readdirSync(LIB, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(join(LIB, entry.name, 'index.ts')))
      .map((entry) => ['lib', entry.name, 'index.ts'].join('/'))
    expect(doors).toEqual([DOOR_LABEL])
    expect(existsSync(join(process.cwd(), 'src', 'lib', 'theory', 'index.ts'))).toBe(
      false,
    )
  })

  it('exports nothing the repo does not import through it (F20 E3 R4, AC4)', () => {
    const importers = repoSources('src')
      .filter((path) => path !== DOOR_FILE && path !== GUARD_FILE)
      .map((path) => ({
        path,
        source: readFileSync(join(process.cwd(), path), 'utf8'),
      }))
    const doorSource = readFileSync(join(process.cwd(), DOOR_FILE), 'utf8')
    expect(narrowDoorReport(doorSource, importers)).toEqual([])
  })
})

describe('Epic 1 left no theory residue in the slice', () => {
  it('has no theory folder under lib/ (F20 E3 R8, AC7)', () => {
    expect(readdirSync(LIB).includes('theory')).toBe(false)
  })

  it('has no import anywhere resolving to it (F20 E3 R8, AC7)', () => {
    const offenders: string[] = []
    for (const relative of [...repoSources('src'), ...repoSources('scripts')]) {
      if (relative === GUARD_FILE) continue
      const source = readFileSync(join(process.cwd(), relative), 'utf8')
      for (const specifier of importSpecifiers(source)) {
        const resolved = resolveSpecifier(specifier, relative) ?? toRepoPath(specifier)
        if (resolved.includes(SLICE_THEORY)) {
          offenders.push(`${relative} -> ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('snippets and theory are siblings', () => {
  it('reports an arrow in either direction, import or mock (F21 E1 R7a, R10, AC9)', () => {
    const offenders = siblingLeafOffenders([
      {
        path: `${SNIPPETS_ROOT}/index.ts`,
        source: `import { FLAVOURS } from '../theory/names'`,
      },
      {
        path: `${THEORY_ROOT}/character.ts`,
        source: `import { solved } from '../snippets'`,
      },
      {
        path: `${THEORY_ROOT}/character.test.ts`,
        source: `vi.mock('@${'/'}lib/snippets')`,
      },
    ])
    expect(offenders).toEqual([
      `${SNIPPETS_ROOT}/index.ts -> ../theory/names`,
      `${THEORY_ROOT}/character.ts -> ../snippets`,
      `${THEORY_ROOT}/character.test.ts -> @${'/'}lib/snippets`,
    ])
  })

  it('finds neither arrow on the real tree (F21 E1 R7a, R10, AC9)', () => {
    const files = repoSources('src')
      .filter((path) => path !== GUARD_FILE)
      .map((path) => ({
        path,
        source: readFileSync(join(process.cwd(), path), 'utf8'),
      }))
    const scanned = (root: string) =>
      files.filter((file) => isUnder(file.path, root)).length

    expect(scanned(SNIPPETS_ROOT)).toBeGreaterThan(0)
    expect(scanned(THEORY_ROOT)).toBeGreaterThan(0)
    expect(siblingLeafOffenders(files)).toEqual([])
  })
})
