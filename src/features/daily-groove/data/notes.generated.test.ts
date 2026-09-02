import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTES, PITCHES } from './notes.generated'
import { GROOVES } from './grooves.generated'
import { ROOTS } from '../lib/theory/music'

const PUBLIC = join(process.cwd(), 'public')

/**
 * Feature-10 Epic 1, Step I1. The reference notes are generated the same way
 * the grooves are, so they are guarded the same way: the module is only as
 * good as the twelve files behind it, and the row is only playable if every
 * root a chip can offer has one.
 *
 * Modelled on `grooves.generated.test.ts` beside it.
 */
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

  // The check that would have caught twelve zero-byte placeholders shipping —
  // the same one the groove catalogue carries.
  it('has a real, non-empty file behind every entry', () => {
    for (const note of NOTES) {
      const file = join(PUBLIC, note.audioSrc)
      expect(existsSync(file), `${note.audioSrc} does not exist`).toBe(true)
      expect(statSync(file).size, `${note.audioSrc} is empty`).toBeGreaterThan(0)
    }
  })

  // The row can only ever offer roots the catalogue uses, so a groove whose
  // root has no note is a day with a silent chip on it.
  it('has a note for every root the catalogue answers with', () => {
    const known = new Set(NOTES.map((note) => note.root))
    for (const groove of GROOVES) {
      expect(known, `${groove.id} answers ${groove.root}, which has no note`)
        .toContain(groove.root)
    }
  })
})

/**
 * Feature-16 Epic 1, Track A — R26, R27, R29, AC17.
 *
 * `PITCHES` is what a lick is sequenced from, and a lick's top note is its root
 * (60..71) plus an octave — so the range has to reach 83 with no gaps, and
 * every entry has to have a real file behind it.
 *
 * The completeness assertions here are not redundant with `grooves:verify`.
 * `verifyLock` iterates whatever ids the lock happens to record, so an
 * under-render — twelve files, twelve lock entries, a twelve-entry manifest —
 * is internally consistent and passes `prebuild` in silence. Only a test that
 * knows the expected count catches it, and this is that test.
 */
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

  // R27: the row's twelve are the base octave of the range, not a second
  // rendering of it. If these ever disagree, one of the two is stale.
  it('carries the root row exactly, as its base octave', () => {
    const base = PITCHES.filter((pitch) => pitch.octave === 4).map((pitch) => ({
      root: pitch.root,
      audioSrc: pitch.audioSrc,
      midi: pitch.midi,
    }))

    expect(base).toEqual(NOTES.map((note) => ({ ...note })))
  })
})
