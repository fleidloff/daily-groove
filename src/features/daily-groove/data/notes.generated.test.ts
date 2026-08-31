import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTES } from './notes.generated'
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
