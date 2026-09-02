import { describe, it, expect } from 'vitest'
import { staffLabel } from './staffLabel'

const G_MIXOLYDIAN_DEGREES = ['1', '2', '3', '4', '5', '6', '♭7']
const G_MIXOLYDIAN_NOTES = ['G', 'A', 'B', 'C', 'D', 'E', 'F']

const G_DORIAN_DEGREES = ['1', '2', '♭3', '4', '5', '6', '♭7']
const G_DORIAN_NOTES = ['G', 'A', 'B♭', 'C', 'D', 'E', 'F']

const C_BLUES_DEGREES = ['1', '♭3', '4', '♭5', '5', '♭7']
const C_BLUES_NOTES = ['C', 'E♭', 'F', 'G♭', 'G', 'B♭']

describe('staffLabel', () => {
  it('names each degree with its own note, in order, for a seven-note scale', () => {
    expect(staffLabel(G_DORIAN_DEGREES, G_DORIAN_NOTES)).toBe(
      '1 G, 2 A, ♭3 B♭, 4 C, 5 D, 6 E, ♭7 F',
    )
  })

  it('keeps the Unicode ♭ of a degree and of a note distinct in the pair', () => {
    expect(staffLabel(G_MIXOLYDIAN_DEGREES, G_MIXOLYDIAN_NOTES)).toBe(
      '1 G, 2 A, 3 B, 4 C, 5 D, 6 E, ♭7 F',
    )
  })

  it('names the blues scale’s six pairs, in order', () => {
    expect(staffLabel(C_BLUES_DEGREES, C_BLUES_NOTES)).toBe(
      '1 C, ♭3 E♭, 4 F, ♭5 G♭, 5 G, ♭7 B♭',
    )
  })

  it('names nothing when there is nothing to name', () => {
    expect(staffLabel([], [])).toBe('')
  })

  it('names nothing when one side is empty', () => {
    expect(staffLabel([], ['G', 'A'])).toBe('')
    expect(staffLabel(['1', '2'], [])).toBe('')
  })

  it('pairs what it can and drops the rest rather than printing undefined', () => {
    expect(staffLabel(['1'], ['G', 'A'])).toBe('1 G')
    expect(staffLabel(['1', '2'], ['G'])).toBe('1 G')
  })
})
