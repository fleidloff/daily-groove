import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two documented conventions no linter can check, guarded here in the same
 * spirit as `scripts/grooves/boundary.test.ts` and `src/lib/hash.test.ts`:
 * this file reads markdown from disk and fails when the prose drifts back.
 *
 * 1. The generator README states no freeze rule. Re-rendering the catalogue is
 *    a normal operation — a groove is defined by its `{ id, template, seed }`,
 *    and the audio is output. A reinstated freeze rule would forbid the
 *    re-render every later epic in this feature depends on.
 * 2. `docs/coding-guidelines.md` still declares `src/lib/hash.ts` frozen, but
 *    on the justification that survives the rule above: changing the hash
 *    reassigns every past date a different puzzle. The clause that leaned on
 *    the README's freeze rule is gone.
 *
 * These read as one subject — what the docs are allowed to say about
 * re-rendering — so they live in one file.
 */

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

const GENERATOR_README = 'scripts/grooves/README.md'
const CODING_GUIDELINES = 'docs/coding-guidelines.md'

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

describe('the generator README', () => {
  it('finds the document it is meant to be checking', () => {
    // A guard on the guard: an unreadable or renamed file would make every
    // "does not contain" assertion below vacuously true.
    const source = read(GENERATOR_README)
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain('# The groove generator')
  })

  // AC1, first half: the README describes no freeze rule.
  it('describes no freeze rule', () => {
    expect(read(GENERATOR_README)).not.toMatch(/freeze rule/i)
  })

  // AC1, continued: and no reference to one either — a "freeze violation" is
  // the same rule wearing a different noun.
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

  // AC1, second half: the hash rule survives...
  it('still declares src/lib/hash.ts frozen', () => {
    expect(read(CODING_GUIDELINES)).toMatch(/`src\/lib\/hash\.ts` is frozen/)
  })

  // ...and stands on the date mapping, which is the justification that
  // outlives the README's freeze rule.
  it('justifies the hash rule by the date mapping', () => {
    expect(read(CODING_GUIDELINES)).toMatch(
      /every past date is reassigned a different puzzle/,
    )
  })

  it('no longer leans on the README freeze rule', () => {
    expect(read(CODING_GUIDELINES)).not.toMatch(/freeze rule in/)
  })
})
