import * as fs from 'node:fs'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { tierReason, tiersFor } from './tiers.ts'

/**
 * `fs.globSync` has shipped in Node since 22 and is what this repo runs on,
 * but the pinned `@types/node` (^20) predates it. Declaring the one call
 * signature used here is narrower than loosening the whole dependency.
 */
const globSync = (
  fs as unknown as {
    globSync: (
      pattern: string,
      options?: { exclude?: (entry: string) => boolean },
    ) => string[]
  }
).globSync

/**
 * The app-scope fixtures below name `src/components/` and `src/app/` rather
 * than the feature folder. `scripts/grooves/boundary.test.ts` forbids the
 * literal feature path anywhere under `scripts/`, and the rule under test does
 * not distinguish between app subtrees: every path under `src/` that is not
 * under `src/lib/` takes the same arm.
 */

describe('tiersFor', () => {
  it('always runs the fast tiers for an app-only scope', () => {
    expect(tiersFor(['src/components/controls/Button.tsx'])).toEqual([
      'app',
      'tooling',
    ])
  })

  it('selects the generator tier for a scope under scripts/', () => {
    expect(tiersFor(['scripts/grooves/events.ts'])).toEqual([
      'app',
      'generator',
      'tooling',
    ])
  })

  it('selects the generator tier when only one path in a mixed scope is under scripts/', () => {
    expect(
      tiersFor(['src/app/page.tsx', 'scripts/grooves/gate.ts']),
    ).toContain('generator')
  })

  it('selects the generator tier for a scope under neither src/ nor scripts/', () => {
    expect(tiersFor(['.claude/agents/musician.md', 'docs/music.md'])).toContain(
      'generator',
    )
  })
})

describe('src/lib is a shared leaf', () => {
  it('selects the generator tier for src/lib/hash.ts', () => {
    expect(tiersFor(['src/lib/hash.ts'])).toContain('generator')
  })

  it('selects the generator tier for src/lib/groove.ts', () => {
    expect(tiersFor(['src/lib/groove.ts'])).toContain('generator')
  })

  it('selects the generator tier for a src/lib file the generator does not import today', () => {
    expect(tiersFor(['src/lib/branding.ts'])).toContain('generator')
  })
})

describe('an unresolved scope', () => {
  it('selects every tier when the scope could not be determined', () => {
    expect(tiersFor(null)).toEqual(['app', 'generator', 'tooling'])
  })

  it('selects every tier for an empty scope', () => {
    expect(tiersFor([])).toEqual(['app', 'generator', 'tooling'])
  })
})

describe('tierReason', () => {
  it('says why the generator tier was not run for an app-only scope', () => {
    expect(tierReason(['src/app/page.tsx'], 'generator')).toMatch(
      /not run.*no path under `scripts\/` or `src\/lib\/`/,
    )
  })

  it('says the scope could not be determined when it is unknown', () => {
    expect(tierReason(null, 'generator')).toMatch(/scope could not be determined/)
  })

  it('says the generator tier was selected for a scope under scripts/', () => {
    expect(tierReason(['scripts/grooves/x.ts'], 'generator')).toMatch(/selected/)
  })

  it('says the generator tier was selected for a scope outside src/ and scripts/', () => {
    expect(tierReason(['docs/music.md'], 'generator')).toMatch(/selected/)
  })

  it('says the always-on tiers were selected', () => {
    expect(tierReason(['src/app/page.tsx'], 'app')).toMatch(/selected/)
    expect(tierReason(['src/app/page.tsx'], 'tooling')).toMatch(/selected/)
  })
})

/**
 * The tiers are only real if the config draws them. These read the config from
 * disk rather than importing it, so a hand edit that drifts from the rule is
 * caught by the same suite the rule lives in.
 */
describe('the config matches the rule', () => {
  const config = readFileSync('vitest.config.ts', 'utf8')

  /** Each project block writes `name` before `include`. */
  const projects = [
    ...config.matchAll(/name:\s*'([^']+)'[\s\S]*?include:\s*\[\s*'([^']+)'\s*\]/g),
  ].map(([, name, include]) => ({ name, include }))

  const ignoredDirectories = new Set([
    '.git',
    '.next',
    'coverage',
    'node_modules',
  ])

  const isIgnored = (entry: string | { name: string }) => {
    const name =
      typeof entry === 'string'
        ? (entry.split('/').pop() ?? entry)
        : entry.name
    return ignoredDirectories.has(name)
  }

  it('defines exactly the three projects the tiers are made of', () => {
    expect(projects.map((project) => project.name)).toEqual([
      'app',
      'generator',
      'tooling',
    ])
  })

  it('keeps the slow tier to the generator itself', () => {
    expect(
      projects.find((project) => project.name === 'generator')?.include,
    ).toBe('scripts/grooves/**/*.{test,spec}.ts')
  })

  it('partitions every test file in the repo across the three projects', () => {
    // A guard on the guard: without a working walk every assertion below is
    // vacuously true.
    expect(typeof globSync).toBe('function')

    const everyTestFile = globSync('**/*.{test,spec}.*', {
      exclude: isIgnored,
    })
    expect(everyTestFile.length).toBeGreaterThan(100)

    const owners = new Map<string, string[]>(
      everyTestFile.map((file) => [file, []]),
    )
    for (const project of projects) {
      for (const file of globSync(project.include, { exclude: isIgnored })) {
        owners.get(file)?.push(project.name)
      }
    }

    const unowned = [...owners].filter(([, names]) => names.length === 0)
    const shared = [...owners].filter(([, names]) => names.length > 1)
    expect({ unowned, shared }).toEqual({ unowned: [], shared: [] })
  })

  it('gives each tier a command of its own', () => {
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(scripts.test).toBe('vitest run --project app --project tooling')
    expect(scripts['test:gen']).toBe('vitest run --project generator')
    expect(scripts['test:all']).toBe('vitest run')
  })

  it('keeps the committed audio guarded once the render tests leave the gate', () => {
    // R11/AC12. The render tests moved off the default gate, so `grooves:verify`
    // on `prebuild` is what still checks the committed mp3s — and nothing
    // asserted that wiring, so deleting the script left every check green.
    // Graded `done` on "the build compiles", which is not a test; this is.
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(scripts.prebuild).toBe('npm run grooves:verify')
    expect(scripts['grooves:verify']).toBeDefined()
  })

  it('confines any timeout override to the slow tier', () => {
    // Feature-14 R10 wanted NO override anywhere. That requirement rested on a
    // false premise — that the 30s budget papered over contention between the
    // app and generator projects — and the measurements in `vitest.config.ts`
    // disprove it: 25 of the generator's 811 cases exceed half the 5s default
    // with the app project not running at all. The override is back, documented.
    //
    // What is still worth guarding, and is the honest version of R10, is that
    // the override stays where the slowness is. A `testTimeout` on `app` or
    // `tooling` would mean the fast tiers had grown something slow enough to
    // need one, and that is exactly the drift this feature exists to prevent.
    //
    // Matched as a SETTING, not a substring: the config's comment explains the
    // override at length and a scan for the word would forbid the explanation.
    const projectBlocks = config.split(/name:\s*'/).slice(1)
    const withTimeout = projectBlocks
      .map((block) => ({
        name: block.slice(0, block.indexOf("'")),
        hasTimeout: /^\s*testTimeout\s*:/m.test(block),
      }))
      .filter((project) => project.hasTimeout)
      .map((project) => project.name)

    expect(withTimeout).toEqual(['generator'])
  })

  it('lets a tier that matches nothing exit zero', () => {
    // R12: a scope-driven selection must never fail merely for having selected
    // a tier with no files in it. Vitest's default is the opposite — it exits 1
    // with "No test files found" — so the config has to say otherwise.
    expect(config).toMatch(/passWithNoTests:\s*true/)
  })
})
