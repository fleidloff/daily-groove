import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { noteSpecs } from './notes.ts'
import { renderNotesManifest, writeNotesManifest } from './notes-manifest.ts'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'groove-notes-manifest-'))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('renderNotesManifest', () => {
  it('opens with a banner naming the command that writes it', () => {
    const source = renderNotesManifest(noteSpecs())

    expect(source.startsWith('/**\n * GENERATED FILE - DO NOT EDIT.')).toBe(true)
    expect(source).toContain('npm run notes')
  })

  it('imports Root from the app alias and declares both exported shapes', () => {
    const source = renderNotesManifest(noteSpecs())

    expect(source).toContain("import type { Root } from '@/lib/groove'")
    expect(source).toMatch(/export type ReferenceNote = \{/)
    expect(source).toContain('export const NOTES: ReferenceNote[] = [')
    expect(source).toMatch(/export type PitchSample = \{/)
    expect(source).toContain('export const PITCHES: PitchSample[] = [')
  })

  it('writes the row twelve first, then the range twenty-four', () => {
    const source = renderNotesManifest(noteSpecs())
    const split = source.indexOf('export const PITCHES: PitchSample[] = [')

    expect(split).toBeGreaterThan(source.indexOf('export const NOTES: ReferenceNote[] = ['))
    expect([...source.slice(0, split).matchAll(/^ {4}root: /gm)]).toHaveLength(12)
    expect([...source.matchAll(/^ {4}root: /gm)]).toHaveLength(36)
  })

  it('writes one NOTES entry per root', () => {
    const source = renderNotesManifest(noteSpecs())

    expect(source).toContain("root: 'C♯',")
    expect(source).toContain("audioSrc: '/notes/note-c-sharp.mp3',")
    expect(source).toContain('midi: 61,')
  })

  it('writes every pitch into PITCHES, ascending from 60 to 83', () => {
    const source = renderNotesManifest(noteSpecs())
    const pitches = source.slice(source.indexOf('export const PITCHES: PitchSample[] = ['))

    expect([...pitches.matchAll(/^ {4}midi: (\d+),/gm)].map((m) => Number(m[1]))).toEqual(
      Array.from({ length: 24 }, (_, i) => 60 + i),
    )
    expect([...pitches.matchAll(/^ {4}id: /gm)]).toHaveLength(24)
    expect(pitches).toContain("id: 'C♯5',")
    expect(pitches).toContain("audioSrc: '/notes/note-c-sharp-5.mp3',")
    expect(pitches).toContain('octave: 5,')
  })

  it('quotes every literal with single quotes', () => {
    expect(code(renderNotesManifest(noteSpecs()))).not.toContain('"')
  })

  it('ends with a single trailing newline', () => {
    const source = renderNotesManifest(noteSpecs())

    expect(source.endsWith(']\n')).toBe(true)
  })

  it('renders the same text every time', () => {
    expect(renderNotesManifest(noteSpecs())).toBe(renderNotesManifest(noteSpecs()))
  })
})

describe('writeNotesManifest', () => {
  it('creates the directory and writes the rendered source', () => {
    const path = join(dir, 'nested', 'notes.generated.ts')

    writeNotesManifest(noteSpecs(), path)

    expect(readFileSync(path, 'utf8')).toBe(renderNotesManifest(noteSpecs()))
  })
})
