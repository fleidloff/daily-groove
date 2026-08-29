import { describe, expect, it } from 'vitest'
import type { Pcm } from '../types.ts'
import { placeholderPack } from './placeholderPack.ts'

function peak(pcm: Pcm): number {
  let max = 0
  for (let i = 0; i < pcm.left.length; i += 1) max = Math.max(max, Math.abs(pcm.left[i]))
  return max
}

describe('placeholderPack', () => {
  it('returns a non-silent sample for a percussive voice', () => {
    const sample = placeholderPack().get('kick', { velocity: 1, index: 0 })

    expect(sample).not.toBeNull()
    expect(sample!.pcm.left.length).toBeGreaterThan(0)
    expect(sample!.pcm.left.length).toBe(sample!.pcm.right.length)
    expect(peak(sample!.pcm)).toBeGreaterThan(0.01)
  })

  it('returns a rooted sample for a pitched voice', () => {
    const sample = placeholderPack().get('bass', { velocity: 1, index: 0, midi: 40 })

    expect(sample).not.toBeNull()
    expect(sample!.rootMidi).toBe(40)
    expect(peak(sample!.pcm)).toBeGreaterThan(0.01)
  })

  it('picks the nearest sampled note for a pitch it does not hold', () => {
    const pack = placeholderPack({ notes: { bass: [40] } })
    const sample = pack.get('bass', { velocity: 1, index: 0, midi: 52 })

    expect(sample!.rootMidi).toBe(40)
  })

  it('returns null for a voice it does not declare', () => {
    const pack = placeholderPack({ voices: ['kick'] })
    expect(pack.get('snare', { velocity: 1, index: 0 })).toBeNull()
  })

  it('describes itself as a PackDeclaration whose voices are stocked', () => {
    const declaration = placeholderPack({ layers: 3, roundRobins: 2 }).describe()

    expect(declaration.sampleRate).toBe(44100)
    expect(declaration.voices.kick!.layers!.length).toBe(3)
    expect(declaration.voices.kick!.layers!.at(-1)!.maxVelocity).toBe(1)
    expect(declaration.voices.kick!.layers!.at(-1)!.files.length).toBe(2)
    expect(declaration.voices.bass!.notes!.length).toBeGreaterThan(1)
  })

  it('synthesizes the same audio for the same file across pack shapes', () => {
    const plain = placeholderPack()
    const stocked = placeholderPack({ layers: 3, roundRobins: 3 })

    const a = plain.get('kick', { velocity: 1, index: 0 })!
    const b = stocked.get('kick', { velocity: 1, index: 0 })!

    expect(Array.from(b.pcm.left)).toEqual(Array.from(a.pcm.left))
  })

  it('is deterministic across calls', () => {
    const a = placeholderPack().get('snare', { velocity: 1, index: 0 })!
    const b = placeholderPack().get('snare', { velocity: 1, index: 0 })!

    expect(Array.from(b.pcm.left)).toEqual(Array.from(a.pcm.left))
  })
})
