import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'

const MANIFEST = '../../src/features/daily-groove/data/grooves.generated.ts'

const HARMONIC_FIELDS = [
  'bpm',
  'bars',
  'loopBars',
  'root',
  'flavour',
  'scale',
  'chord',
  'progression',
] as const

type Harmonic = Record<(typeof HARMONIC_FIELDS)[number], string | undefined>

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, 'harmony.fixture.json'), 'utf8'),
) as { note: string; grooves: Record<string, Harmonic> }

function manifestHarmony(): Record<string, Harmonic> {
  const source = readFileSync(join(import.meta.dirname, MANIFEST), 'utf8')
  const out: Record<string, Harmonic> = {}
  for (const block of source.match(/\{[^{}]+\}/g) ?? []) {
    const fields: Record<string, string> = {}
    for (const m of block.matchAll(/(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|([-\d.]+))/g)) {
      fields[m[1]] = m[2] ?? m[3]
    }
    if (fields.id) {
      out[fields.id] = Object.fromEntries(
        HARMONIC_FIELDS.map((f) => [f, fields[f]]),
      ) as Harmonic
    }
  }
  return out
}

function drift(expected: Record<string, Harmonic>, actual: Record<string, Harmonic>): string[] {
  const problems: string[] = []
  for (const id of Object.keys(expected).sort()) {
    const got = actual[id]
    if (!got) {
      problems.push(`${id}: present in the fixture, absent from the manifest`)
      continue
    }
    for (const field of HARMONIC_FIELDS) {
      if (expected[id][field] !== got[field]) {
        problems.push(`${id} ${field}: expected ${expected[id][field]}, got ${got[field]}`)
      }
    }
  }
  return problems
}

describe('the harmony survives the re-cut', () => {
  it('finds a fixture covering every catalogue groove', () => {
    const ids = readCatalogue().map((g) => g.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(Object.keys(fixture.grooves).sort()).toEqual([...ids].sort())
  })

  it('pins exactly the eight harmonic fields, and no audio-derived ones', () => {
    for (const [id, entry] of Object.entries(fixture.grooves)) {
      expect(Object.keys(entry).sort(), `${id} pins the wrong fields`).toEqual(
        [...HARMONIC_FIELDS].sort(),
      )
    }
  })

  it('leaves every groove’s harmony exactly as it was', () => {
    expect(drift(fixture.grooves, manifestHarmony())).toEqual([])
  })

  it('names the groove, the field and both values when something moves', () => {
    const actual = manifestHarmony()
    const id = Object.keys(fixture.grooves)[0]
    const tampered = { ...actual, [id]: { ...actual[id], flavour: 'not-a-mode' } }
    const problems = drift(fixture.grooves, tampered)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(id)
    expect(problems[0]).toContain('flavour')
    expect(problems[0]).toContain(String(fixture.grooves[id].flavour))
    expect(problems[0]).toContain('not-a-mode')
  })

  it('keeps every id and uuid the catalogue minted', () => {
    const source = readFileSync(join(import.meta.dirname, MANIFEST), 'utf8')
    for (const groove of readCatalogue()) {
      expect(source, `${groove.id} is missing from the manifest`).toContain(`'${groove.id}'`)
      expect(source, `${groove.id}'s uuid changed`).toContain(`'${groove.uuid}'`)
    }
  })
})
