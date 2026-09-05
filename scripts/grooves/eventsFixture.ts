import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec, MusicMeta, NoteEvent } from './types.ts'

export const FIXTURE_PATH = fileURLToPath(new URL('./events.fixture.json', import.meta.url))

export const FIXTURE_FEELS = [
  'straight-funk',
  'bright-straight',
  'half-time',
  'open-ballad',
] as const

export type GrooveDigest = { music: MusicMeta; events: string[] }

export type EventsFixture = Record<string, GrooveDigest>

// Nine decimals is far below the 22.7 µs sample period at 44.1 kHz, so the
// rounding discards nothing audible while keeping the fixture stable against
// float-printing differences.
const PLACES = 9

export function fixtureKey(spec: Pick<GrooveSpec, 'template' | 'seed'>): string {
  return `${spec.template}:${spec.seed}`
}

export function fixtureSpecs(catalogue: readonly GrooveSpec[] = readCatalogue()): GrooveSpec[] {
  const feels: readonly string[] = FIXTURE_FEELS
  return catalogue.filter((spec) => feels.includes(spec.template))
}

export function serialiseEvent(event: NoteEvent): string {
  const head = `${event.voice}@${event.timeSec.toFixed(PLACES)}`
  const body = `${event.durationSec.toFixed(PLACES)}:${event.velocity.toFixed(PLACES)}`
  return event.midi === undefined ? `${head}:${body}` : `${head}:${body}:${event.midi}`
}

export function serialiseGroove(spec: GrooveSpec): GrooveDigest {
  const { events, music } = buildEvents(spec, templateById(spec.template))
  return { music, events: events.map(serialiseEvent) }
}

export function buildFixture(catalogue: readonly GrooveSpec[] = readCatalogue()): EventsFixture {
  const fixture: EventsFixture = {}
  for (const spec of fixtureSpecs(catalogue)) fixture[fixtureKey(spec)] = serialiseGroove(spec)
  return fixture
}

export function readFixture(path: string = FIXTURE_PATH): EventsFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as EventsFixture
}

export function writeFixture(path: string = FIXTURE_PATH): EventsFixture {
  const fixture = buildFixture()
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`)
  return fixture
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly && process.argv.slice(2).includes('--write')) {
  const fixture = writeFixture()
  const events = Object.values(fixture).reduce((sum, d) => sum + d.events.length, 0)
  console.log(`wrote ${Object.keys(fixture).length} grooves, ${events} events to ${FIXTURE_PATH}`)
}
