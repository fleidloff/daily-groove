import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIB_ROOT = import.meta.dirname
const REPO_ROOT = join(LIB_ROOT, '..', '..')

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFilesUnder(full))
    else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) out.push(full)
  }
  return out
}

const SPECIFIER_FORMS = [
  /\bfrom\s*(['"])([^'"]+)\1/g,
  /\bimport\s*(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1/g,
  /\bvi\s*\.\s*(?:mock|doMock)\s*\(\s*(['"])([^'"]+)\1/g,
]

function liveCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    .join('\n')
}

function aliasedSpecifiers(source: string): string[] {
  const hits = new Set<string>()
  for (const form of SPECIFIER_FORMS) {
    for (const match of liveCode(source).matchAll(form)) {
      const specifier = match[2]
      if (specifier === '@' || specifier.startsWith(`@${'/'}`)) {
        hits.add(specifier)
      }
    }
  }
  return [...hits].sort()
}

describe('src/lib is a leaf the generator can resolve', () => {
  it('has no file that imports through the @/ alias', () => {
    const files = sourceFilesUnder(LIB_ROOT)
    expect(files.length).toBeGreaterThan(1)

    const violations = files.flatMap((file) =>
      aliasedSpecifiers(readFileSync(file, 'utf8')).map(
        (specifier) => `${relative(REPO_ROOT, file)} imports ${specifier}`,
      ),
    )

    expect(violations).toEqual([])
  })

  it('recognises an aliased specifier in every form it can be written', () => {
    const alias = `@${'/'}lib/hash`
    const samples = [
      `import { hashString } from '${alias}'`,
      `import { hashString } from "${alias}"`,
      `import '${alias}'`,
      `const m = await import('${alias}')`,
      `const m = require("${alias}")`,
      `vi.mock('${alias}', () => ({}))`,
      `vi . mock ( "${alias}" )`,
      `vi.doMock('${alias}', () => ({}))`,
      `import type { Groove } from '${alias}'`,
      `export { hashString } from '${alias}'`,
      `export * from '${alias}'`,
      `import x = require('${alias}')`,
      `import {\n  hashString,\n} from '${alias}'`,
    ]
    for (const sample of samples) {
      expect(aliasedSpecifiers(sample)).toEqual([alias])
    }
    expect(aliasedSpecifiers(`import { x } from './roots'`)).toEqual([])
    expect(aliasedSpecifiers(`import { x } from '@scope/pkg'`)).toEqual([])
    expect(aliasedSpecifiers(`// import { x } from '${alias}'`)).toEqual([])
    expect(aliasedSpecifiers(`/* import { x } from '${alias}' */`)).toEqual([])
  })
})
