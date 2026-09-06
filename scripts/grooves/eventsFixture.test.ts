import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FIXTURE_PATH,
  buildFixture,
  fixtureFeels,
  fixtureKey,
  fixtureSpecs,
  readFixture,
  serialiseGroove,
} from './eventsFixture.ts'
import { buildEvents } from './events.ts'
import { readCatalogue } from './catalogue.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec } from './types.ts'

const DIGEST = /^([a-zA-Z]+)@(-?\d+\.\d{9}):(-?\d+\.\d{9}):(-?\d+\.\d{9})(?::(-?\d+))?$/

function specFor(template: string, seed: number): GrooveSpec {
  const spec = readCatalogue().find((s) => s.template === template && s.seed === seed)
  if (!spec) throw new Error(`no catalogue entry for ${template}:${seed}`)
  return spec
}

describe('serialiseGroove', () => {
  const spec = specFor('straight-funk', 1)
  const built = buildEvents(spec, templateById(spec.template))
  const digest = serialiseGroove(spec)

  it('keeps the MusicMeta the generator built', () => {
    expect(digest.music).toEqual(built.music)
  })

  it('writes one string per built event, in order', () => {
    expect(digest.events).toHaveLength(built.events.length)
    expect(built.events.length).toBeGreaterThan(0)
  })

  it('writes voice, time, duration and velocity to nine decimal places', () => {
    for (const line of digest.events) {
      expect(line).toMatch(DIGEST)
    }
  })

  it('recovers every field of every event, and only carries midi when the event does', () => {
    digest.events.forEach((line, index) => {
      const match = DIGEST.exec(line)
      expect(match, line).not.toBeNull()
      const [, voice, timeSec, durationSec, velocity, midi] = match!
      const event = built.events[index]
      expect(voice).toBe(event.voice)
      expect(Number(timeSec)).toBeCloseTo(event.timeSec, 9)
      expect(Number(durationSec)).toBeCloseTo(event.durationSec, 9)
      expect(Number(velocity)).toBeCloseTo(event.velocity, 9)
      expect(midi === undefined ? undefined : Number(midi)).toBe(event.midi)
    })
  })

  it('carries a midi field for the pitched voices and none for the drums', () => {
    const pitched = digest.events.filter((line) => line.startsWith('bass@') || line.startsWith('comp@'))
    const drums = digest.events.filter((line) => line.startsWith('kick@') || line.startsWith('snare@'))
    expect(pitched.length).toBeGreaterThan(0)
    expect(drums.length).toBeGreaterThan(0)
    expect(pitched.every((line) => DIGEST.exec(line)![5] !== undefined)).toBe(true)
    expect(drums.every((line) => DIGEST.exec(line)![5] === undefined)).toBe(true)
  })
})

describe('the byte-identity fixture', () => {
  it('deep-equals what the generator builds today', () => {
    expect(buildFixture()).toEqual(readFixture())
  })

  it('names every feel the committed catalogue uses', () => {
    const named = [...new Set(readCatalogue().map((spec) => spec.template))].sort()
    expect(fixtureFeels()).toEqual(named)
    expect(fixtureFeels()).toContain('shuffle')
    expect(new Set(fixtureFeels()).size).toBe(fixtureFeels().length)
  })

  it('covers every committed groove, riding feels included', () => {
    expect(fixtureSpecs()).toHaveLength(readCatalogue().length)
    expect(Object.keys(readFixture())).toHaveLength(readCatalogue().length)
  })

  it('holds exactly the catalogue keys — nothing dropped, nothing stale', () => {
    const committed = readCatalogue().map(fixtureKey).sort()
    const pinned = Object.keys(readFixture()).sort()
    expect(pinned).toEqual(committed)
    for (const key of committed) expect(pinned, key).toContain(key)
    for (const key of pinned) expect(committed, key).toContain(key)
  })

  it('has no empty entry', () => {
    for (const [key, digest] of Object.entries(readFixture())) {
      expect(digest.events.length, key).toBeGreaterThan(0)
      expect(digest.music.bpm, key).toBeGreaterThan(0)
    }
  })

  it('is committed at the path the writer writes', () => {
    expect(FIXTURE_PATH.endsWith('/scripts/grooves/events.fixture.json')).toBe(true)
    expect(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))).toEqual(readFixture())
  })
})
