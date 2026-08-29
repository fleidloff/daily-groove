import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Groove } from '../../src/features/daily-groove/types.ts'
import type { Pools } from './pools.ts'

/**
 * The generated module is committed and imported directly by the feature, so
 * it is written the way a hand-written module would be: the app's own import
 * style (no file extension), one entry per catalogue groove, and a banner that
 * tells the next reader where the real source is.
 */
const BANNER = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by \`npm run grooves\` (scripts/grooves/manifest.ts) from
 * scripts/grooves/catalogue.json. Any edit here is lost on the next render;
 * change the catalogue or the generator instead.
 */`

/** The ten fields of a Groove, in the order the type declares them. */
const FIELDS = [
  'id',
  'audioSrc',
  'name',
  'bpm',
  'scale',
  'chord',
  'progression',
  'root',
  'flavour',
  'bars',
] as const

/**
 * A literal for one field value, single-quoted like the rest of the codebase
 * so the committed module needs no reformatting to pass lint. Escaping is
 * JSON's, with the quote characters swapped over.
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

function renderEntry(entry: Groove): string {
  const lines = FIELDS.map((field) => `    ${field}: ${literal(entry[field])},`)
  return ['  {', ...lines, '  },'].join('\n')
}

/** One `export const NAME: string[] = [...]` block, one value per line. */
function renderPool(name: string, values: readonly string[]): string {
  const head = `export const ${name}: string[] = `
  if (values.length === 0) return `${head}[]\n`
  const body = values.map((value) => `  ${literal(value)},`).join('\n')
  return `${head}[\n${body}\n]\n`
}

/**
 * The distractor pools, as a comment and three exported arrays. Emitted only
 * when the caller has pools to emit, so the renderer keeps working for a
 * caller that has none yet.
 */
const POOL_BANNER = `/**
 * Distractor pools: every value the catalogue uses, plus a fixed vocabulary of
 * plausible alternatives it does not, so a four-option set can always be built
 * for any groove.
 */`

function renderPools(pools: Pools): string {
  return [
    POOL_BANNER,
    renderPool('SCALE_POOL', pools.scales),
    renderPool('CHORD_POOL', pools.chords),
    renderPool('PROGRESSION_POOL', pools.progressions),
  ].join('\n')
}

/**
 * The full source text of `grooves.generated.ts` for these entries, and for
 * the distractor pools when they are given. `pools` is optional so a caller
 * that only has entries still renders a valid module.
 */
export function renderManifest(
  entries: readonly Groove[],
  pools?: Pools,
): string {
  const head = `${BANNER}\n\nimport type { Groove } from '../types'\n\n`
  const grooves =
    entries.length === 0
      ? 'export const GROOVES: Groove[] = []\n'
      : `export const GROOVES: Groove[] = [\n${entries.map(renderEntry).join('\n')}\n]\n`
  const tail = pools ? `\n${renderPools(pools)}` : ''
  return `${head}${grooves}${tail}`
}

/** Render the entries and write them to `path`, creating its directory. */
export function writeManifest(
  entries: readonly Groove[],
  path: string,
  pools?: Pools,
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderManifest(entries, pools), 'utf8')
}
