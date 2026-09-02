import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { BASE_OCTAVE, type ReferenceNote } from './notes.ts'

/**
 * The generated module for the reference notes.
 *
 * A sibling of `manifest.ts`, not a caller of it. The two render different
 * modules from different inputs for different commands, and the only thing they
 * share is a house style — a banner, single-quoted literals, one field per
 * line. Reaching into `manifest.ts` for its private helpers would make a module
 * that is about grooves export internals so a module about notes can borrow
 * them; the two helpers below are four lines each, and copying them is cheaper
 * than that coupling.
 *
 * Unlike `grooves.generated.ts`, this module also carries its own types: the
 * `ReferenceNote` and `PitchSample` shapes are not part of the app's shared
 * `src/lib/groove.ts` vocabulary, and the feature that consumes them is the
 * only one that needs them.
 *
 * **Two exports, and they are not interchangeable.** `NOTES` is the root row's
 * twelve — one per chromatic root, in the base octave — and `PITCHES` is every
 * pitch the render produces, C4 to B5. They stay separate because
 * `lib/audio/reference.ts` keys the row by root: a `NOTES` widened to
 * twenty-four would re-key every root to the octave above and silently
 * transpose the row.
 */
const BANNER = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by \`npm run notes\` (scripts/grooves/notes-manifest.ts) from the
 * sample pack. Any edit here is lost on the next render; change the generator
 * and re-render instead.
 */`

/** The declaration the row's twelve are typed by, emitted into the module. */
const NOTE_TYPE = `/** One reference note per chromatic root, rendered from the sample pack. */
export type ReferenceNote = {
  root: Root
  /** URL under /notes, e.g. "/notes/note-c-sharp.mp3" */
  audioSrc: string
  /** Sounding pitch, scientific: C4 is 60. */
  midi: number
}`

/** The declaration the whole rendered range is typed by. */
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

/** The three fields of a ReferenceNote, in the order the type declares them. */
const NOTE_FIELDS = ['root', 'audioSrc', 'midi'] as const

/** The five fields of a PitchSample, in the order the type declares them. */
const PITCH_FIELDS = ['id', 'root', 'octave', 'midi', 'audioSrc'] as const

/**
 * A literal for one field value, single-quoted like the rest of the codebase so
 * the committed module needs no reformatting to pass lint. Escaping is JSON's,
 * with the quote characters swapped over.
 */
function literal(value: string | number): string {
  if (typeof value === 'number') return String(value)
  const json = JSON.stringify(value)
  const inner = json
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'")
  return `'${inner}'`
}

/** One entry literal, carrying only the fields the target type declares. */
function renderEntry(
  entry: ReferenceNote,
  fields: readonly (keyof ReferenceNote)[],
): string {
  const lines = fields.map((field) => `    ${field}: ${literal(entry[field])},`)
  return ['  {', ...lines, '  },'].join('\n')
}

/** `export const <name>: <type>[] = [...]`, or an empty array literal. */
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

/** The full source text of `notes.generated.ts` for these entries. */
export function renderNotesManifest(entries: readonly ReferenceNote[]): string {
  const head = `${BANNER}\n\nimport type { Root } from '@/lib/groove'\n\n${NOTE_TYPE}\n\n`
  // The row's twelve are the base octave, projected down to the three fields
  // `ReferenceNote` has always had — so `lib/audio/reference.ts` reads exactly
  // what it read before the render widened.
  const notes = renderArray(
    'NOTES',
    'ReferenceNote',
    entries.filter((entry) => entry.octave === BASE_OCTAVE),
    NOTE_FIELDS,
  )
  const pitches = renderArray('PITCHES', 'PitchSample', entries, PITCH_FIELDS)
  return `${head}${notes}\n${PITCH_TYPE}\n\n${pitches}`
}

/** Render the entries and write them to `path`, creating its directory. */
export function writeNotesManifest(
  entries: readonly ReferenceNote[],
  path: string,
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderNotesManifest(entries), 'utf8')
}
