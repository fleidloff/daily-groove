import { describe, expect, it } from 'vitest'
import { VOICE_NAMES } from './types.ts'
import type { VoiceName } from './types.ts'
import { FILL_DURATIONS, VELOCITIES } from './events.ts'
import { placeholderPack } from './testing/placeholderPack.ts'

const EXPECTED_VOICES: VoiceName[] = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'ride',
  'rideBell',
  'rim',
  'tomHigh',
  'tomLow',
  'bongoHigh',
  'bongoLow',
  'claves',
  'cowbell',
  'bass',
  'comp',
]

const NEW_VOICES: VoiceName[] = ['ride', 'rideBell', 'claves', 'cowbell']

describe('VOICE_NAMES', () => {
  it('holds fifteen names', () => {
    expect(VOICE_NAMES).toHaveLength(15)
  })

  it('holds each name once', () => {
    expect(new Set(VOICE_NAMES).size).toBe(VOICE_NAMES.length)
  })

  it('lists the voices in the documented order', () => {
    expect([...VOICE_NAMES]).toEqual(EXPECTED_VOICES)
  })

  it('contains the four voices this epic adds', () => {
    for (const voice of NEW_VOICES) expect(VOICE_NAMES).toContain(voice)
  })
})

describe('the total records over VoiceName', () => {
  it('gives VELOCITIES a row for every voice and no other', () => {
    expect(Object.keys(VELOCITIES).sort()).toEqual([...VOICE_NAMES].sort())
  })

  it('gives FILL_DURATIONS a row for every voice and no other', () => {
    expect(Object.keys(FILL_DURATIONS).sort()).toEqual([...VOICE_NAMES].sort())
  })

  it('shapes every velocity row strong over medium over weak', () => {
    for (const voice of VOICE_NAMES) {
      const shape = VELOCITIES[voice]
      expect(shape.strong, voice).toBeGreaterThanOrEqual(shape.medium)
      expect(shape.medium, voice).toBeGreaterThanOrEqual(shape.weak)
    }
  })

  it('keeps every velocity inside (0, 1]', () => {
    for (const voice of VOICE_NAMES) {
      for (const level of Object.values(VELOCITIES[voice])) {
        expect(level, voice).toBeGreaterThan(0)
        expect(level, voice).toBeLessThanOrEqual(1)
      }
    }
  })

  it('gives every fill duration a positive number of sixteenths', () => {
    for (const voice of VOICE_NAMES) {
      expect(FILL_DURATIONS[voice], voice).toBeGreaterThan(0)
    }
  })
})

describe('the default placeholder pack', () => {
  it('plays every voice this epic adds', () => {
    const pack = placeholderPack()

    for (const voice of NEW_VOICES) {
      const sample = pack.get(voice, { velocity: 0.7, index: 0 })
      expect(sample, voice).not.toBeNull()
      expect(sample!.pcm.left.length, voice).toBeGreaterThan(0)
    }
  })

  it('still plays the voices it played before', () => {
    const pack = placeholderPack()

    for (const voice of ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim'] as VoiceName[]) {
      expect(pack.get(voice, { velocity: 0.7, index: 0 }), voice).not.toBeNull()
    }
    expect(pack.get('bass', { velocity: 0.7, index: 0, midi: 40 })).not.toBeNull()
  })
})
