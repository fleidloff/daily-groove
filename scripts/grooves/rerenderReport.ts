import { LOUDNESS_CEILING_DB, LOUDNESS_FLOOR_DB } from './gate.ts'
import { rmsDbfs } from './level.ts'
import type { Lock } from './lock.ts'
import type { FeelTemplate, GrooveSpec, Pcm } from './types.ts'

export type AudioClassification = {
  changed: string[]
  unchanged: string[]
  missing: string[]
  extra: string[]
}

export function classifyAudio(committed: Lock, rendered: Lock): AudioClassification {
  const renderedById = new Map(rendered.grooves.map((entry) => [entry.id, entry]))
  const committedIds = new Set(committed.grooves.map((entry) => entry.id))

  const changed: string[] = []
  const unchanged: string[] = []
  const missing: string[] = []

  for (const entry of committed.grooves) {
    const fresh = renderedById.get(entry.id)
    if (fresh === undefined) {
      missing.push(entry.id)
      continue
    }
    if (fresh.sha256 === entry.sha256 && fresh.bytes === entry.bytes) unchanged.push(entry.id)
    else changed.push(entry.id)
  }

  const extra = rendered.grooves
    .filter((entry) => !committedIds.has(entry.id))
    .map((entry) => entry.id)

  return { changed, unchanged, missing, extra }
}

export function ridingIds(
  specs: readonly GrooveSpec[],
  templateFor: (id: string) => FeelTemplate,
): string[] {
  return specs
    .filter((spec) => templateFor(spec.template).voices.includes('ride'))
    .map((spec) => spec.id)
}

export type CountMismatch = { missed: string[]; surprising: string[] }

export function compareChanged(
  actual: AudioClassification,
  expected: readonly string[],
): CountMismatch {
  const changed = new Set(actual.changed)
  const wanted = new Set(expected)
  return {
    missed: expected.filter((id) => !changed.has(id)),
    surprising: actual.changed.filter((id) => !wanted.has(id)),
  }
}

export type LoudnessRow = { id: string; dbfs: number; inWindow: boolean }

export function loudnessTable(pcm: ReadonlyMap<string, Pcm>): LoudnessRow[] {
  return [...pcm].map(([id, buffer]) => {
    const dbfs = rmsDbfs(buffer)
    return { id, dbfs, inWindow: dbfs >= LOUDNESS_FLOOR_DB && dbfs <= LOUDNESS_CEILING_DB }
  })
}

function levelText(dbfs: number): string {
  return Number.isFinite(dbfs) ? dbfs.toFixed(1) : '-inf'
}

function verdict(row: LoudnessRow): string {
  if (row.inWindow) return 'ok'
  if (!Number.isFinite(row.dbfs)) return `silent, below the floor (${LOUDNESS_FLOOR_DB})`
  if (row.dbfs > LOUDNESS_CEILING_DB) {
    return `${(row.dbfs - LOUDNESS_CEILING_DB).toFixed(1)} dB above the ceiling (${LOUDNESS_CEILING_DB})`
  }
  return `${(LOUDNESS_FLOOR_DB - row.dbfs).toFixed(1)} dB below the floor (${LOUDNESS_FLOOR_DB})`
}

export function formatLoudness(rows: readonly LoudnessRow[]): string[] {
  const idWidth = Math.max(0, ...rows.map((row) => row.id.length))
  const levelWidth = Math.max(0, ...rows.map((row) => levelText(row.dbfs).length))

  return rows.map((row) => {
    const mark = row.inWindow ? '  ' : '!!'
    const level = levelText(row.dbfs).padStart(levelWidth)
    return `${mark} ${row.id.padEnd(idWidth)}  ${level} dBFS  ${verdict(row)}`
  })
}
