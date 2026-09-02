import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Groove } from '../../src/lib/groove.ts'
import type { Pools } from './pools.ts'

const BANNER = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by \`npm run grooves\` (scripts/grooves/manifest.ts) from
 * scripts/grooves/catalogue.json. Any edit here is lost on the next render;
 * change the catalogue or the generator instead.
 */`

const FIELDS = [
  'id',
  'uuid',
  'audioSrc',
  'name',
  'bpm',
  'scale',
  'chord',
  'progression',
  'progressionDegrees',
  'root',
  'flavour',
  'bars',
  'loopBars',
  'headDelaySeconds',
] as const

function literal(value: string | number | readonly number[]): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`
  if (typeof value === 'number') return String(value)
  const json = JSON.stringify(value)
  const inner = json
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'")
  return `'${inner}'`
}

function renderEntry(entry: Groove): string {
  const lines = FIELDS.flatMap((field) => {
    const value = entry[field]
    return value === undefined ? [] : [`    ${field}: ${literal(value)},`]
  })
  return ['  {', ...lines, '  },'].join('\n')
}

function renderPool(name: string, values: readonly string[]): string {
  const head = `export const ${name}: string[] = `
  if (values.length === 0) return `${head}[]\n`
  const body = values.map((value) => `  ${literal(value)},`).join('\n')
  return `${head}[\n${body}\n]\n`
}

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

export function renderManifest(
  entries: readonly Groove[],
  pools?: Pools,
): string {
  const head = `${BANNER}\n\nimport type { Groove } from '@/lib/groove'\n\n`
  const grooves =
    entries.length === 0
      ? 'export const GROOVES: Groove[] = []\n'
      : `export const GROOVES: Groove[] = [\n${entries.map(renderEntry).join('\n')}\n]\n`
  const tail = pools ? `\n${renderPools(pools)}` : ''
  return `${head}${grooves}${tail}`
}

export function writeManifest(
  entries: readonly Groove[],
  path: string,
  pools?: Pools,
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderManifest(entries, pools), 'utf8')
}
