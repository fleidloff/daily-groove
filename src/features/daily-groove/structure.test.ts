import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Structural tests for the feature slice's folder rules (Epic 2, AC1–AC4) and
 * for the design system's grouped import paths as seen from its consumers
 * (Epic 1, AC3).
 *
 * They are colocated inside the feature, so deleting the feature deletes them.
 * They read the tree from disk rather than through imports, because the rule
 * being enforced is about where files live, not about what they export.
 */

const FEATURE = join(process.cwd(), 'src', 'features', 'daily-groove')
const LIB = join(FEATURE, 'lib')
const DATA = join(FEATURE, 'data')
const COMPONENTS = join(FEATURE, 'components')

const featureDir = 'src/features/daily-groove'
const hooksDir = `${featureDir}/hooks`
const stateDir = `${featureDir}/state`

/** Every file under `dir`, recursively, as absolute paths. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

/** Source modules under `hooks/`, i.e. everything that is not a test file. */
function hookModules(): string[] {
  return readdirSync(hooksDir).filter((name) => !/\.(test|spec)\.tsx?$/.test(name))
}

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

// AC1: `lib/` is split by concern. Nothing sits loose at its root.
describe('lib holds no loose modules', () => {
  const entries = () => readdirSync(LIB, { withFileTypes: true })

  it('contains only directories', () => {
    const loose = entries()
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.name)
    expect(loose).toEqual([])
  })

  // Six since feature-12: `share/` holds the URL a groove lives at and the
  // share/clipboard/manual decision behind the control that offers it. Neither
  // is presentation (nothing is rendered), neither is persistence, and neither
  // is the rules of the game — so per the guidelines' own instruction, a module
  // that fits none of the folders is a new concern rather than an exception.
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

// AC2: the generated manifest is data, not business logic, so it is not in lib/.
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

// Epic 2, Step C1 — R4, AC4: components are grouped by the screen region that
// renders them, with `GroovePuzzle` above the regions it composes.
describe('feature components sit in screen regions', () => {
  const REGIONS: Record<string, string[]> = {
    header: ['GrooveHeader', 'HelpToggle', 'ShareGroove', 'StreakBadge'],
    intro: ['HowToPlay'],
    puzzle: [
      'GrooveCard',
      'TransportPanel',
      'GuessCard',
      'ModeToggle',
      'AttemptDots',
      'FeedbackLine',
      'NudgeBox',
      'SolvedPanel',
      'LeadSheet',
      'ScaleStaff',
      // Feature-12: the two pieces of copy that frame a shared groove — one
      // above the card saying what the page is, one below the answer sending
      // the player to today's. Both render in the puzzle region; neither is on
      // the daily page.
      'SharedGrooveNotice',
      'PlayTodayLink',
    ],
  }

  const entries = () => readdirSync(COMPONENTS, { withFileTypes: true })

  it('contains exactly the three region directories', () => {
    const dirs = entries()
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(dirs).toEqual(['header', 'intro', 'puzzle'])
  })

  it('holds only the root component at the components/ root', () => {
    // Test files are excluded the way `src/components/structure.test.ts`
    // excludes them, so a colocated test never trips the file-list assertion.
    const files = entries()
      .filter((entry) => entry.isFile() && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
    expect(files).toEqual(['GroovePuzzle.tsx'])
    expect(existsSync(join(COMPONENTS, 'GroovePuzzle.test.tsx'))).toBe(true)
  })

  // The declared list is only half the rule. Iterating `REGIONS` proves every
  // *declared* component is on disk; it says nothing about a component that is
  // on disk and declared nowhere, which is exactly how `ModeToggle` slipped in
  // silently. This is the reverse direction: the tree may hold nothing the list
  // does not name (F7 E5 R1, Step D4).
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

// Epic 1, Step B1 — R4, AC3: no consumer reaches the design system through an
// ungrouped path such as `@/components/Button`.
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

// Feature 6, Epic 1, Step A3 — R8: `GroovePuzzle` composes one groove and one
// player. The archive plumbing it grew to hand a single player between today's
// card and a row of past days is gone, and the names below are how it was
// spelled. Read from the source rather than through a render, because the rule
// is about what the component no longer holds, not about what it draws.
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
