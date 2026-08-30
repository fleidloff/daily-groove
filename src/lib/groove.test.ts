import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Flavour, Groove, Root } from '@/lib/groove'

/**
 * `src/lib/groove.ts` is the contract between the groove generator and the app.
 * The generator imports it by relative path from outside the `@/` alias, so the
 * assertions here are about the shape of the types and about the module staying
 * a leaf: type-only, with no import of its own that `scripts/` cannot resolve.
 */
describe('src/lib/groove', () => {
  it('accepts a fully-populated Groove literal', () => {
    // Compile-time assertion: `satisfies` fails `tsc` if a field is missing,
    // renamed, or retyped. The runtime expectations keep the object honest.
    const groove = {
      id: 'groove-01',
      audioSrc: '/grooves/groove-01.mp3',
      name: 'Velvet Pocket',
      bpm: 98,
      scale: 'C♯ minor',
      chord: 'C♯m7',
      progression: 'C♯m–F♯m–G♯7',
      root: 'C♯',
      flavour: 'Harmonic minor',
      bars: 4,
    } satisfies Groove

    expect(Object.keys(groove).sort()).toEqual([
      'audioSrc',
      'bars',
      'bpm',
      'chord',
      'flavour',
      'id',
      'name',
      'progression',
      'root',
      'scale',
    ])
  })

  it('rejects a root outside the twelve chromatic spellings', () => {
    // @ts-expect-error 'H' is not one of the twelve roots. If Root ever widens
    // to `string`, this directive becomes unused and `tsc` fails on it.
    const wrong: Root = 'H'
    expect(wrong).toBe('H')

    // The twelve members, each asserted assignable.
    const roots: Root[] = [
      'C',
      'C♯',
      'D',
      'E♭',
      'E',
      'F',
      'F♯',
      'G',
      'A♭',
      'A',
      'B♭',
      'B',
    ]
    expect(roots).toHaveLength(12)
  })

  it('treats Flavour as a display string, not a closed union', () => {
    // The pool is derived from the seed data at runtime, so any string is a
    // valid Flavour on the app side. (The generator's own Flavour is a
    // different, closed type — see scripts/grooves/types.ts.)
    const flavour: Flavour = 'Harmonic minor'
    expect(flavour).toBe('Harmonic minor')
  })

  it('imports nothing — the generator resolves it without the @/ alias', () => {
    // `scripts/` reaches this module by relative path through Node's type
    // stripping, which does not resolve `@/`. Any import here would break that.
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/groove.ts'),
      'utf8',
    )
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    )
    expect(specifiers).toEqual([])
  })
})
