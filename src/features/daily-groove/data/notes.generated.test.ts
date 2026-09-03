import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTES, PITCHES } from './notes.generated'
import { GROOVES } from './grooves.generated'
import { ROOTS } from '@/lib/theory/roots'

const PUBLIC = join(process.cwd(), 'public')

describe('the generated reference notes', () => {
  it('carries one note per chromatic root', () => {
    expect(NOTES).toHaveLength(12)
  })

  it('lists its roots as ROOTS lists them, exactly and in order', () => {
    expect(NOTES.map((note) => note.root)).toEqual(ROOTS)
  })

  it('gives every entry all three fields, correctly typed', () => {
    for (const note of NOTES) {
      expect(typeof note.root).toBe('string')
      expect(typeof note.audioSrc).toBe('string')
      expect(typeof note.midi).toBe('number')
    }
  })

  it('serves every note from /notes/, under a unique path', () => {
    for (const note of NOTES) {
      expect(note.audioSrc.startsWith('/notes/'), note.root).toBe(true)
    }
    expect(new Set(NOTES.map((note) => note.audioSrc)).size).toBe(NOTES.length)
  })

  it('has a real, non-empty file behind every entry', () => {
    for (const note of NOTES) {
      const file = join(PUBLIC, note.audioSrc)
      expect(existsSync(file), `${note.audioSrc} does not exist`).toBe(true)
      expect(statSync(file).size, `${note.audioSrc} is empty`).toBeGreaterThan(0)
    }
  })

  it('has a note for every root the catalogue answers with', () => {
    const known = new Set(NOTES.map((note) => note.root))
    for (const groove of GROOVES) {
      expect(known, `${groove.id} answers ${groove.root}, which has no note`)
        .toContain(groove.root)
    }
  })
})

describe('the generated pitch range', () => {
  it('covers C4 to B5 with no gaps', () => {
    expect(PITCHES).toHaveLength(24)
    expect(PITCHES.map((pitch) => pitch.midi)).toEqual(
      Array.from({ length: 24 }, (_, i) => 60 + i),
    )
  })

  it('gives every pitch a unique id and a unique file', () => {
    expect(new Set(PITCHES.map((pitch) => pitch.id)).size).toBe(24)
    expect(new Set(PITCHES.map((pitch) => pitch.audioSrc)).size).toBe(24)
    expect(PITCHES[0].id).toBe('C4')
    expect(PITCHES[23].id).toBe('B5')
    for (const pitch of PITCHES) {
      expect(pitch.audioSrc.startsWith('/notes/'), pitch.id).toBe(true)
      expect([4, 5], pitch.id).toContain(pitch.octave)
    }
  })

  it('has a real, non-empty file behind every entry', () => {
    for (const pitch of PITCHES) {
      const file = join(PUBLIC, pitch.audioSrc)
      expect(existsSync(file), `${pitch.audioSrc} does not exist`).toBe(true)
      expect(statSync(file).size, `${pitch.audioSrc} is empty`).toBeGreaterThan(0)
    }
  })

  it('carries the root row exactly, as its base octave', () => {
    const base = PITCHES.filter((pitch) => pitch.octave === 4).map((pitch) => ({
      root: pitch.root,
      audioSrc: pitch.audioSrc,
      midi: pitch.midi,
    }))

    expect(base).toEqual(NOTES.map((note) => ({ ...note })))
  })
})
