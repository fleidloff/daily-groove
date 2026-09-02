import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'

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

describe('nothing under lib/audio declares a level of its own (R2, AC2)', () => {
  const AUDIO = join(
    process.cwd(),
    'src',
    'features',
    'daily-groove',
    'lib',
    'audio',
  )

  function modules(): string[] {
    return readdirSync(AUDIO)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => !name.endsWith('.test.ts'))
      .filter((name) => name !== 'level.ts')
  }

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

  it('has the reference voice among the modules it inspects', () => {
    expect(inspected).toContain('reference.ts')
  })
})
