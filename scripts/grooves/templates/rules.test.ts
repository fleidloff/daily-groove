import { describe, expect, it } from 'vitest'
import type { FeelTemplate, Flavour } from '../types.ts'
import { FLAVOURS_MAX, FLAVOURS_MIN, flavourFailures } from './rules.ts'
import { templateById } from './index.ts'

const base = templateById('bright-straight')

function synthetic(id: string, flavours: string[]): FeelTemplate {
  return { ...base, id, flavours: flavours as Flavour[] }
}

const ONE = synthetic('synth-one', ['ionian'])
const TWO = synthetic('synth-two', ['ionian', 'lydian'])
const THREE = synthetic('synth-three', ['ionian', 'lydian', 'dorian'])
const FOUR = synthetic('synth-four', ['ionian', 'lydian', 'dorian', 'melodic-minor'])
const FIVE = synthetic('synth-five', [
  'ionian',
  'lydian',
  'dorian',
  'melodic-minor',
  'aeolian',
])
const DUPLICATE = synthetic('synth-duplicate', ['ionian', 'ionian'])
const UNKNOWN = synthetic('synth-unknown', ['ionian', 'locrian'])

describe('the flavour rule — feature-25 R1, R2, AC1', () => {
  it('declares two as the floor and four as the ceiling', () => {
    expect(FLAVOURS_MIN).toBe(2)
    expect(FLAVOURS_MAX).toBe(4)
  })

  it('accepts two, three or four distinct flavours', () => {
    expect(flavourFailures([TWO])).toEqual([])
    expect(flavourFailures([THREE])).toEqual([])
    expect(flavourFailures([FOUR])).toEqual([])
    expect(flavourFailures([TWO, THREE, FOUR])).toEqual([])
  })

  it('rejects one flavour, naming the template and the floor', () => {
    const failures = flavourFailures([ONE])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('synth-one')
    expect(failures[0]).toContain('2')
  })

  it('rejects five flavours, naming the template and the ceiling', () => {
    const failures = flavourFailures([FIVE])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('synth-five')
    expect(failures[0]).toContain('4')
  })

  it('rejects a duplicate inside one list, naming the flavour', () => {
    const failures = flavourFailures([DUPLICATE])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('synth-duplicate')
    expect(failures[0]).toContain('ionian')
  })

  it('rejects a flavour the game does not offer, naming it', () => {
    const failures = flavourFailures([UNKNOWN])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('synth-unknown')
    expect(failures[0]).toContain('locrian')
  })

  it('reports one string per broken rule, across every template it is handed', () => {
    expect(flavourFailures([ONE, FIVE, DUPLICATE])).toHaveLength(3)
  })

  it('is empty for an empty list', () => {
    expect(flavourFailures([])).toEqual([])
  })
})

describe('overlap is allowed — feature-25 R1, AC2', () => {
  it('lets two templates declare the same flavour', () => {
    const a = synthetic('synth-a', ['ionian', 'lydian'])
    const b = synthetic('synth-b', ['ionian', 'dorian'])
    expect(flavourFailures([a, b])).toEqual([])
  })

  it('lets three templates share one flavour', () => {
    const a = synthetic('synth-a', ['ionian', 'lydian'])
    const b = synthetic('synth-b', ['ionian', 'dorian'])
    const c = synthetic('synth-c', ['ionian', 'mixolydian', 'blues'])
    expect(flavourFailures([a, b, c])).toEqual([])
  })

  it('lets two templates declare identical lists', () => {
    const a = synthetic('synth-a', ['ionian', 'lydian'])
    const b = synthetic('synth-b', ['ionian', 'lydian'])
    expect(flavourFailures([a, b])).toEqual([])
  })
})
