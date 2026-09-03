import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Answer, Attempt, Flavour, Groove, Root } from './groove'

describe('src/lib/groove', () => {
  it('accepts a fully-populated Groove literal', () => {
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

    const asGroove: Groove = withoutDegrees
    expect(asGroove.progressionDegrees).toBeUndefined()
  })

  it('rejects a Groove that carries no measured head delay', () => {
    // @ts-expect-error headDelaySeconds is missing.
    const incomplete: Groove = {
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
    }
    expect(incomplete.id).toBe('groove-01')

    const complete: Groove = { ...incomplete, headDelaySeconds: 0.025057 }
    expect(complete.headDelaySeconds).toBeCloseTo(0.025057, 6)
  })

  it('rejects a root outside the twelve chromatic spellings', () => {
    // @ts-expect-error 'H' is not one of the twelve roots. If Root ever widens
    const wrong: Root = 'H'
    expect(wrong).toBe('H')

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
    const flavour: Flavour = 'Harmonic minor'
    expect(flavour).toBe('Harmonic minor')
  })

  it('carries the answer and the attempt the puzzle is graded on', () => {
    const answer = {
      root: 'C♯',
      flavour: 'Harmonic minor',
    } satisfies Answer

    expect(Object.keys(answer).sort()).toEqual(['flavour', 'root'])

    const attempt = {
      root: 'C♯',
      flavour: 'Dorian',
      correct: false,
      rootMatched: true,
      flavourMatched: false,
    } satisfies Attempt

    expect(Object.keys(attempt).sort()).toEqual([
      'correct',
      'flavour',
      'flavourMatched',
      'root',
      'rootMatched',
    ])
  })

  it('imports nothing at all, aliased or relative', () => {
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
