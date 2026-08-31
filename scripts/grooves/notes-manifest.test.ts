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

/** The source with its block comments removed, so quoting is judged on code. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('renderNotesManifest', () => {
  it('opens with a banner naming the command that writes it', () => {
    const source = renderNotesManifest(noteSpecs())

    expect(source.startsWith('/**\n * GENERATED FILE - DO NOT EDIT.')).toBe(true)
    expect(source).toContain('npm run notes')
  })

  it('imports Root from the app alias and declares the exported shape', () => {
    const source = renderNotesManifest(noteSpecs())

    expect(source).toContain("import type { Root } from '@/lib/groove'")
    expect(source).toMatch(/export type ReferenceNote = \{/)
    expect(source).toContain('export const NOTES: ReferenceNote[] = [')
  })

  it('writes one entry per root', () => {
    const source = renderNotesManifest(noteSpecs())

    expect([...source.matchAll(/^ {4}root: /gm)]).toHaveLength(12)
    expect(source).toContain("root: 'C♯',")
    expect(source).toContain("audioSrc: '/notes/note-c-sharp.mp3',")
    expect(source).toContain('midi: 61,')
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
