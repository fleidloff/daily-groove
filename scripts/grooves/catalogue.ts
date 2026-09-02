import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { GrooveSpec } from './types.ts'

export const CATALOGUE_PATH = fileURLToPath(new URL('./catalogue.json', import.meta.url))

export function readCatalogue(path: string = CATALOGUE_PATH): GrooveSpec[] {
  return JSON.parse(readFileSync(path, 'utf8')) as GrooveSpec[]
}

export function writeCatalogue(specs: readonly GrooveSpec[], path: string = CATALOGUE_PATH): void {
  writeFileSync(path, `${JSON.stringify(specs, null, 2)}\n`)
}
