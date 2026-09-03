import * as fs from 'node:fs'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { GENERATOR_IMPORTS, tierReason, tiersFor } from './tiers.ts'

const globSync = (
  fs as unknown as {
    globSync: (
      pattern: string,
      options?: { exclude?: (entry: string) => boolean },
    ) => string[]
  }
).globSync

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

  it('does not select the generator tier for a src/lib file the generator never imports', () => {
    expect(tiersFor(['src/lib/branding.ts'])).toEqual(['app', 'tooling'])
    expect(tiersFor(['src/lib/theory/licks.ts'])).toEqual(['app', 'tooling'])
    expect(tiersFor(['src/lib/date.ts'])).toEqual(['app', 'tooling'])
  })

  it.each(GENERATOR_IMPORTS)('selects the generator tier for %s', (path) => {
    expect(tiersFor([path])).toContain('generator')
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
      /not run.*no path under `scripts\/` and no module the generator imports/,
    )
  })

  it('names the module that selected the generator tier', () => {
    expect(tierReason(['src/lib/theory/scales.ts'], 'generator')).toMatch(
      /selected.*src\/lib\/theory\/scales\.ts/,
    )
  })

  it('says the generator tier was not run for a src/lib module it never imports', () => {
    expect(tierReason(['src/lib/theory/licks.ts'], 'generator')).toMatch(
      /not run.*no path under `scripts\/` and no module the generator imports/,
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

describe('the config matches the rule', () => {
  const config = readFileSync('vitest.config.ts', 'utf8')

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
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(scripts.prebuild).toBe('npm run grooves:verify')
    expect(scripts['grooves:verify']).toBeDefined()
  })

  it('confines any timeout override to the slow tier', () => {
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
    expect(config).toMatch(/passWithNoTests:\s*true/)
  })
})
