import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'

/**
 * The declared level, and the guard that keeps it the only one.
 *
 * Nothing here asserts the literal numbers. They are what a listen produced
 * (Step V2), and the listen has to be able to move them with a one-line diff —
 * so the assertions state the properties that must hold at any value: below
 * full scale, and a fade long enough to stop a click but short enough that a
 * finger run down the chip row does not smear.
 */

// Step B1 — R1, R2, R4: one declared level, below unity.
describe('the declared reference level (R1, R2, R4)', () => {
  it('is below full scale', () => {
    expect(REFERENCE_LEVEL).toBeGreaterThan(0)
    expect(REFERENCE_LEVEL).toBeLessThan(1)
  })

  it('fades over long enough to stop a click and short enough not to smear (R5)', () => {
    expect(REFERENCE_FADE_SECONDS).toBeGreaterThan(0)
    expect(REFERENCE_FADE_SECONDS).toBeLessThanOrEqual(0.1)
  })
})

// Step B2 — R2, AC2: one number, in one place, not a copy per voice.
describe('nothing under lib/audio declares a level of its own (R2, AC2)', () => {
  const AUDIO = join(
    process.cwd(),
    'src',
    'features',
    'daily-groove',
    'lib',
    'audio',
  )

  /** Every non-test module under `lib/audio/`, `level.ts` itself excluded. */
  function modules(): string[] {
    return readdirSync(AUDIO)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => !name.endsWith('.test.ts'))
      .filter((name) => name !== 'level.ts')
  }

  /** The modules that build a gain node, and so must read the shared level. */
  const inspected = modules().filter((name) =>
    readFileSync(join(AUDIO, name), 'utf8').includes('createGain('),
  )

  it('makes every gain-building module read REFERENCE_LEVEL from ./level', () => {
    const offenders = inspected.filter((name) => {
      const source = readFileSync(join(AUDIO, name), 'utf8')
      return !(source.includes('REFERENCE_LEVEL') && /from\s*'\.\/level'/.test(source))
    })

    expect(offenders).toEqual([])
  })

  /*
   * Step D1 — without this the rule above could pass by finding nothing to
   * check. The reference voice builds a gain, so it must appear here.
   */
  it('has the reference voice among the modules it inspects', () => {
    expect(inspected).toContain('reference.ts')
  })
})
