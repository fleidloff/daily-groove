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
      uuid: '7c3f1b0a-5d84-4e29-9b61-0c2af8d3e517',
      audioSrc: '/grooves/groove-01.mp3',
      name: 'Velvet Pocket',
      bpm: 98,
      scale: 'C♯ minor',
      chord: 'C♯m7',
      progression: 'C♯m–F♯m–G♯7',
      root: 'C♯',
      flavour: 'Harmonic minor',
      bars: 4,
      headDelaySeconds: 0.025057,
    } satisfies Groove

    expect(Object.keys(groove).sort()).toEqual([
      'audioSrc',
      'bars',
      'bpm',
      'chord',
      'flavour',
      'headDelaySeconds',
      'id',
      'name',
      'progression',
      'root',
      'scale',
      'uuid',
    ])
  })

  it('may carry the degrees its progression was built from, or not', () => {
    // `progressionDegrees` is optional, as `loopBars` is: a manifest written
    // before the field existed still describes a groove. Both halves asserted
    // rather than assumed — the app's fallback depends on the second one.
    const withDegrees = {
      id: 'groove-01',
      uuid: '7c3f1b0a-5d84-4e29-9b61-0c2af8d3e517',
      audioSrc: '/grooves/groove-01.mp3',
      name: 'Velvet Pocket',
      bpm: 98,
      scale: 'C♯ minor',
      chord: 'C♯m7',
      progression: 'C♯m–F♯m–G♯7',
      progressionDegrees: [0, 2, 6, 3],
      root: 'C♯',
      flavour: 'Harmonic minor',
      bars: 4,
      headDelaySeconds: 0.025057,
    } satisfies Groove

    expect(withDegrees.progressionDegrees).toEqual([0, 2, 6, 3])

    const withoutDegrees = {
      id: 'groove-02',
      uuid: '9a1d4c62-0b3e-4f78-8d55-1e6b7a90c4f3',
      audioSrc: '/grooves/groove-02.mp3',
      name: 'Sunroom Shuffle',
      bpm: 104,
      scale: 'E♭ dorian',
      chord: 'E♭m7',
      progression: 'E♭m7–A♭7–E♭m7',
      root: 'E♭',
      flavour: 'Dorian',
      bars: 4,
      headDelaySeconds: 0.025057,
    } satisfies Groove

    // Read back through `Groove`, not through the literal's own inferred type:
    // the point of the assertion is that a consumer holding a `Groove` finds
    // the field absent rather than that this object shape lacks it.
    const asGroove: Groove = withoutDegrees
    expect(asGroove.progressionDegrees).toBeUndefined()
  })

  it('rejects a Groove that carries no measured head delay', () => {
    // The head delay is measured per file at mint time, so a Groove without
    // one is not a Groove: nothing downstream may fall back to a shared
    // constant. If the field is ever made optional, this directive becomes
    // unused and `tsc` fails on it.
    // @ts-expect-error headDelaySeconds is missing.
    const incomplete: Groove = {
      id: 'groove-01',
      // Present, so the directive below still fails for the head delay alone —
      // a fixture missing two required fields would pass this test while
      // proving nothing about either.
      uuid: '7c3f1b0a-5d84-4e29-9b61-0c2af8d3e517',
      audioSrc: '/grooves/groove-01.mp3',
      name: 'Velvet Pocket',
      bpm: 98,
      scale: 'C♯ minor',
      chord: 'C♯m7',
      progression: 'C♯m–F♯m–G♯7',
      root: 'C♯',
      flavour: 'Harmonic minor',
      bars: 4,
    }
    expect(incomplete.id).toBe('groove-01')

    const complete: Groove = { ...incomplete, headDelaySeconds: 0.025057 }
    expect(complete.headDelaySeconds).toBeCloseTo(0.025057, 6)
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
