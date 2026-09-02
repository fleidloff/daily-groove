import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { BASE_OCTAVE, type ReferenceNote } from './notes.ts'

const BANNER = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by \`npm run notes\` (scripts/grooves/notes-manifest.ts) from the
 * sample pack. Any edit here is lost on the next render; change the generator
 * and re-render instead.
 */`

const NOTE_TYPE = `/** One reference note per chromatic root, rendered from the sample pack. */
export type ReferenceNote = {
  root: Root
  /** URL under /notes, e.g. "/notes/note-c-sharp.mp3" */
  audioSrc: string
  /** Sounding pitch, scientific: C4 is 60. */
  midi: number
}`

const PITCH_TYPE = `/** Every pitch the render produces, C4 to B5. What a lick is sequenced from. */
export type PitchSample = {
  /** Scientific pitch, e.g. 'C4', 'C♯5'. Unique across the set. */
  id: string
  root: Root
  /** 4 or 5. */
  octave: number
  /** Sounding pitch, scientific: C4 is 60. 60..83. */
  midi: number
  /** URL under /notes, e.g. "/notes/note-c-sharp-5.mp3" */
  audioSrc: string
}`

const NOTE_FIELDS = ['root', 'audioSrc', 'midi'] as const

const PITCH_FIELDS = ['id', 'root', 'octave', 'midi', 'audioSrc'] as const

function literal(value: string | number): string {
  if (typeof value === 'number') return String(value)
  const json = JSON.stringify(value)
  const inner = json
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'")
  return `'${inner}'`
}

function renderEntry(
  entry: ReferenceNote,
  fields: readonly (keyof ReferenceNote)[],
): string {
  const lines = fields.map((field) => `    ${field}: ${literal(entry[field])},`)
  return ['  {', ...lines, '  },'].join('\n')
}

function renderArray(
  name: string,
  type: string,
  entries: readonly ReferenceNote[],
  fields: readonly (keyof ReferenceNote)[],
): string {
  const head = `export const ${name}: ${type}[] = [`
  if (entries.length === 0) return `${head}]\n`
  return `${head}\n${entries.map((entry) => renderEntry(entry, fields)).join('\n')}\n]\n`
}

export function renderNotesManifest(entries: readonly ReferenceNote[]): string {
  const head = `${BANNER}\n\nimport type { Root } from '@/lib/groove'\n\n${NOTE_TYPE}\n\n`
  const notes = renderArray(
    'NOTES',
    'ReferenceNote',
    entries.filter((entry) => entry.octave === BASE_OCTAVE),
    NOTE_FIELDS,
  )
  const pitches = renderArray('PITCHES', 'PitchSample', entries, PITCH_FIELDS)
  return `${head}${notes}\n${PITCH_TYPE}\n\n${pitches}`
}

export function writeNotesManifest(
  entries: readonly ReferenceNote[],
  path: string,
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderNotesManifest(entries), 'utf8')
}
