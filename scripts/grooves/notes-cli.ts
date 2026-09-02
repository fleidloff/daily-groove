import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeMp3 } from './encode.ts'
import { type Lock, type LockEntry, noteFile, readLock, sha256File, writeLock } from './lock.ts'
import { type ReferenceNote, noteFileName, noteSpecs, renderNote } from './notes.ts'
import { writeNotesManifest } from './notes-manifest.ts'
import { loadPack } from './pack.ts'
import type { SamplePack } from './types.ts'

/**
 * `npm run notes` — render the reference notes, C4 to B5.
 *
 * Its own command, not a stage of `npm run grooves`. The notes are a function
 * of the sample pack alone, and the pack changes far less often than the
 * catalogue does: folding them in would re-render twenty-four files on every
 * catalogue edit, and hand the same cost to `grooves:add`.
 *
 * The price of two commands is one lock written by both, and this is the side
 * that pays it: the notes are merged into whatever the groove render left
 * behind. Nothing here rebuilds the groove entries — this command has not
 * rendered a groove and cannot vouch for one.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_PACK_DIR = join(HERE, 'samples')
export const DEFAULT_NOTES_DIR = join(HERE, '../../public/notes')
export const DEFAULT_NOTES_MANIFEST_PATH = join(
  HERE,
  '../../src/features/daily-groove/data/notes.generated.ts',
)
export const DEFAULT_LOCK_PATH = join(HERE, 'grooves.lock.json')
export const SAMPLE_RATE = 44100

/** The pack's declaration, whose hash is what makes a stale render visible. */
export function packDeclarationPath(packDir: string): string {
  return join(packDir, 'pack.json')
}

export type NotesOptions = {
  packDir?: string
  outDir?: string
  manifestPath?: string
  lockPath?: string
  /** Injected by tests that have a pack already loaded. */
  pack?: SamplePack
  /** When false, no mp3 is written and the lock is left alone. */
  encode?: boolean
}

export type NotesResult = {
  specs: ReferenceNote[]
  /**
   * Pre-encode PCM, keyed by scientific pitch id. Determinism is asserted on
   * this. Keyed by root it would hold twelve entries for a twenty-four-pitch
   * run — the octave-5 render overwriting its octave-4 namesake — and the
   * assertion would silently cover half the set.
   */
  pcm: Map<string, { left: Float32Array; right: Float32Array }>
}

export async function main(options: NotesOptions = {}): Promise<NotesResult> {
  const packDir = options.packDir ?? DEFAULT_PACK_DIR
  const outDir = options.outDir ?? DEFAULT_NOTES_DIR
  const manifestPath = options.manifestPath ?? DEFAULT_NOTES_MANIFEST_PATH
  const lockPath = options.lockPath ?? DEFAULT_LOCK_PATH
  const shouldEncode = options.encode ?? true
  const pack = options.pack ?? (await loadPack(packDir))

  mkdirSync(outDir, { recursive: true })

  const specs = noteSpecs()
  const pcm = new Map<string, { left: Float32Array; right: Float32Array }>()

  for (const spec of specs) {
    const note = renderNote(pack, spec.midi, SAMPLE_RATE)
    pcm.set(spec.id, { left: note.left, right: note.right })
    if (shouldEncode) await encodeMp3(note, join(outDir, noteFileName(spec.root, spec.octave)))
  }

  writeNotesManifest(specs, manifestPath)

  if (shouldEncode) {
    recordInLock(specs, { outDir, manifestPath, lockPath, packDir })
  }

  return { specs, pcm }
}

type LockTargets = {
  outDir: string
  manifestPath: string
  lockPath: string
  packDir: string
}

/**
 * Merge what this render produced into the committed lock.
 *
 * A note's lock id is its scientific pitch — `C♯5`, not `c-sharp-5` — and
 * `lock.ts` derives the file name from it, so the recorded key stays the thing
 * the app and the catalogue both speak in. It is the pitch and not the root
 * because there are two octaves: root ids would record twenty-four entries
 * under twelve names, hash `note-c.mp3` twice and `note-c-5.mp3` never, and
 * leave `grooves:verify` green with the upper octave unchecked (AC19).
 *
 * With no lock on disk there is nothing to merge into, and inventing a
 * catalogue hash here would record a groove render that never happened. The
 * audio and the manifest are already written; the run says what it skipped and
 * leaves the guard to be re-established by `npm run grooves`.
 */
function recordInLock(specs: readonly ReferenceNote[], targets: LockTargets): void {
  const existing = readLock(targets.lockPath)
  if (existing === null) {
    console.warn(
      `no lock at ${targets.lockPath}: the notes were rendered but not recorded. Run \`npm run grooves\` to write one.`,
    )
    return
  }

  const notes: LockEntry[] = specs.map((spec) => {
    const file = noteFile(targets.outDir, spec.id)
    return { id: spec.id, sha256: sha256File(file), bytes: statSync(file).size }
  })

  const merged: Lock = {
    catalogueSha256: existing.catalogueSha256,
    manifestSha256: existing.manifestSha256,
    grooves: existing.grooves,
    notes,
    notesManifestSha256: sha256File(targets.manifestPath),
    packSha256: sha256File(packDeclarationPath(targets.packDir)),
  }

  writeLock(merged, targets.lockPath)
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { specs } = await main()
  console.log(`rendered ${specs.length} reference notes`)
  for (const spec of specs) {
    console.log(`  ${spec.id.padEnd(4)} midi ${spec.midi}  ${spec.audioSrc}`)
  }
}
