import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

const GENERATOR_README = 'scripts/grooves/README.md'
const CODING_GUIDELINES = 'docs/coding-guidelines.md'

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

describe('the generator README', () => {
  it('finds the document it is meant to be checking', () => {
    const source = read(GENERATOR_README)
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain('# The groove generator')
  })

  it('describes no freeze rule', () => {
    expect(read(GENERATOR_README)).not.toMatch(/freeze rule/i)
  })

  it('makes no reference to freezing a groove at all', () => {
    const offenders = [...read(GENERATOR_README).matchAll(/.*freez|.*frozen/gi)]
      .map((m) => m[0].trim())
    expect(offenders).toEqual([])
  })

  it('still documents regenerating the catalogue', () => {
    const source = read(GENERATOR_README)
    expect(source).toMatch(/^## Regenerating$/m)
    expect(source).toContain('npm run grooves')
  })
})

describe('the coding guidelines', () => {
  it('finds the document it is meant to be checking', () => {
    const source = read(CODING_GUIDELINES)
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain('src/lib/hash.ts')
  })

  it('still declares src/lib/hash.ts frozen', () => {
    expect(read(CODING_GUIDELINES)).toMatch(/`src\/lib\/hash\.ts` is frozen/)
  })

  it('justifies the hash rule by the date mapping', () => {
    expect(read(CODING_GUIDELINES)).toMatch(
      /every past date is reassigned a different puzzle/,
    )
  })

  it('no longer leans on the README freeze rule', () => {
    expect(read(CODING_GUIDELINES)).not.toMatch(/freeze rule in/)
  })
})
