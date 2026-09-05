import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FIXTURE_FEELS,
  FIXTURE_PATH,
  buildFixture,
  fixtureKey,
  fixtureSpecs,
  readFixture,
  serialiseGroove,
} from './eventsFixture.ts'
import { buildEvents } from './events.ts'
import { readCatalogue } from './catalogue.ts'
import { allTemplates, templateById } from './templates/index.ts'
import type { GrooveSpec } from './types.ts'

const DIGEST = /^([a-zA-Z]+)@(-?\d+\.\d{9}):(-?\d+\.\d{9}):(-?\d+\.\d{9})(?::(-?\d+))?$/

// Named literally, not derived from `voices.includes('ride')`: swung-sixteenth is
// mid-flight in this epic and a derived list would be red until it lands.
const RIDING_FEELS = ['shuffle', 'swung-sixteenth']

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

  it('covers every catalogue seed of the four feels that do not ride', () => {
    const keys = fixtureSpecs().map(fixtureKey)
    expect(Object.keys(readFixture())).toHaveLength(19)
    expect(Object.keys(readFixture()).sort()).toEqual([...keys].sort())
  })

  it('names the four feels that do not ride', () => {
    expect([...FIXTURE_FEELS].sort()).toEqual(
      ['bright-straight', 'half-time', 'open-ballad', 'straight-funk'],
    )
  })

  it('partitions the feels — every template either rides or is in the fixture', () => {
    expect([...FIXTURE_FEELS, ...RIDING_FEELS].sort()).toEqual(
      allTemplates()
        .map((t) => t.id)
        .sort(),
    )
  })

  it('holds every catalogue seed each of those feels is used at', () => {
    const fixture = readFixture()
    for (const spec of readCatalogue()) {
      const covered = (FIXTURE_FEELS as readonly string[]).includes(spec.template)
      expect(Object.hasOwn(fixture, fixtureKey(spec)), fixtureKey(spec)).toBe(covered)
    }
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
