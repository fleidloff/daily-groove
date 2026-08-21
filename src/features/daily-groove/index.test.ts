import { describe, expect, it } from 'vitest'
import * as publicSurface from './index'
import { GroovePuzzle } from './index'

describe('daily-groove public surface', () => {
  it('exports GroovePuzzle as a component', () => {
    expect(typeof GroovePuzzle).toBe('function')
  })

  it('exports only GroovePuzzle and the shared types (no lib/component internals)', () => {
    // Types are erased at runtime; only the component remains as a value export.
    const runtimeExports = Object.keys(publicSurface)
    expect(runtimeExports).toEqual(['GroovePuzzle'])
    // Guard against leaking internals as runtime values.
    expect(runtimeExports).not.toContain('createDailyGrooveStore')
    expect(runtimeExports).not.toContain('buildOptions')
    expect(runtimeExports).not.toContain('scoreAttribute')
    expect(runtimeExports).not.toContain('ScalePicker')
    expect(runtimeExports).not.toContain('ResultReveal')
  })
})
