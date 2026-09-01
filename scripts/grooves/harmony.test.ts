import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'

/**
 * The one constraint feature-13 is not allowed to break.
 *
 * The feature changes what a groove is *played on* - a new kit, a levelled
 * pack, a velocity curve on the piano - and explicitly not what it *is*. A
 * re-cut that quietly retuned a groove would change the puzzle's answer for a
 * date that has already been played, and for a share link that has already been
 * sent, with nothing to notice it.
 *
 * The fixture was written from the manifest as it stood *before* any
 * re-rendering, which is the whole point: a fixture generated from the new
 * manifest would be a copy of the output it is meant to be checking, and a test
 * that cannot fail is worse than no test because it reads as evidence.
 *
 * `headDelaySeconds` and `audioSrc` are deliberately absent. The first is
 * measured from the audio and is *expected* to move; the second is a path. Both
 * would make this fail for reasons that have nothing to do with harmony.
 */

/**
 * Written in the same relative form the generator writes the manifest through,
 * because `boundary.test.ts` allows exactly these two literals and forbids any
 * other mention of the app's feature tree from under `scripts/`. Spelling it
 * repo-relative instead would have meant widening that allowlist, whose length
 * is part of its own assertion for good reason.
 */
const MANIFEST = '../../src/features/daily-groove/data/grooves.generated.ts'

/** The eight fields that say what a groove is, rather than how it sounds. */
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

/**
 * Read the committed manifest as text rather than importing it.
 *
 * The module lives under `src/` and is written for the bundler; parsing the
 * literal keeps this test in the generator project with no app machinery, and it
 * checks what is actually on disk rather than what a transform makes of it.
 */
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

/** Every mismatch, named, rather than one bare boolean. */
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
    // A guard on the guard: an empty fixture would make every check below
    // vacuously true.
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
    // The failure has to be legible, because when it fires the reader needs to
    // know which epic moved what — not merely that something did.
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
    // Checked against the catalogue rather than the fixture: the catalogue is
    // the input, and a uuid that drifted from it is a mint that should never
    // have happened. Feature-12's share links resolve through these.
    const source = readFileSync(join(import.meta.dirname, MANIFEST), 'utf8')
    for (const groove of readCatalogue()) {
      expect(source, `${groove.id} is missing from the manifest`).toContain(`'${groove.id}'`)
      expect(source, `${groove.id}'s uuid changed`).toContain(`'${groove.uuid}'`)
    }
  })
})
