import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ReferenceNote } from './notes.ts'

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
 * Unlike `grooves.generated.ts`, this module also carries its own type: the
 * `ReferenceNote` shape is not part of the app's shared `src/lib/groove.ts`
 * vocabulary, and the feature that consumes it is the only one that needs it.
 */
const BANNER = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by \`npm run notes\` (scripts/grooves/notes-manifest.ts) from the
 * sample pack. Any edit here is lost on the next render; change the generator
 * and re-render instead.
 */`

/** The declaration the entries below are typed by, emitted into the module. */
const TYPE = `/** One reference note per chromatic root, rendered from the sample pack. */
export type ReferenceNote = {
  root: Root
  /** URL under /notes, e.g. "/notes/note-c-sharp.mp3" */
  audioSrc: string
  /** Sounding pitch, scientific: C4 is 60. */
  midi: number
}`

/** The three fields of a ReferenceNote, in the order the type declares them. */
const FIELDS = ['root', 'audioSrc', 'midi'] as const

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

function renderEntry(entry: ReferenceNote): string {
  const lines = FIELDS.map((field) => `    ${field}: ${literal(entry[field])},`)
  return ['  {', ...lines, '  },'].join('\n')
}

/** The full source text of `notes.generated.ts` for these entries. */
export function renderNotesManifest(entries: readonly ReferenceNote[]): string {
  const head = `${BANNER}\n\nimport type { Root } from '@/lib/groove'\n\n${TYPE}\n\n`
  const notes =
    entries.length === 0
      ? 'export const NOTES: ReferenceNote[] = []\n'
      : `export const NOTES: ReferenceNote[] = [\n${entries.map(renderEntry).join('\n')}\n]\n`
  return `${head}${notes}`
}

/** Render the entries and write them to `path`, creating its directory. */
export function writeNotesManifest(
  entries: readonly ReferenceNote[],
  path: string,
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderNotesManifest(entries), 'utf8')
}
