import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { HeardIn } from '../../src/lib/groove.ts'

export const HEARD_IN_PATH = fileURLToPath(new URL('./heard-in.json', import.meta.url))

export type HeardInTable = Record<string, HeardIn>

export function readHeardIn(path: string = HEARD_IN_PATH): HeardInTable {
  return JSON.parse(readFileSync(path, 'utf8')) as HeardInTable
}

export function heardInFailures(
  table: HeardInTable,
  scales: readonly string[],
): string[] {
  const rendered = new Set(scales)
  const failures: string[] = []
  for (const [scale, entry] of Object.entries(table)) {
    if (!rendered.has(scale)) failures.push(`${scale}: no groove renders this scale`)
    if (entry.track.trim() === '') failures.push(`${scale}: empty track`)
    if (entry.artist.trim() === '') failures.push(`${scale}: empty artist`)
  }
  return failures
}
