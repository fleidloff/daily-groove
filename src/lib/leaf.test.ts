import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleSpecifiers } from './testing/specifiers'

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

function aliasedSpecifiers(source: string): string[] {
  return moduleSpecifiers(source).filter(
    (specifier) => specifier === '@' || specifier.startsWith(`@${'/'}`),
  )
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
