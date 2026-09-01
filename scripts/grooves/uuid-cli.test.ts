import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeCatalogue } from './catalogue.ts'
import type { GrooveSpec } from './types.ts'
import { backfillUuids } from './uuid-cli.ts'
import { isCanonicalUuid } from './uuid.ts'

/**
 * Feature-12, Epic 1, Step A4. The backfill is committed rather than deleted
 * after its one run, so it is tested like anything else that ships: it fills the
 * gaps, it reports what it did, and it is safe to run again.
 */

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const HELD = '9f1c2e40-7b3a-4c15-9d8e-2a6b41f0c7de'

function tempCatalogue(specs: readonly GrooveSpec[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-uuid-'))
  dirs.push(dir)
  const path = join(dir, 'catalogue.json')
  writeCatalogue(specs, path)
  return path
}

const SPECS = [
  { id: 'groove-01', template: 'straight-funk', seed: 1 } as unknown as GrooveSpec,
  { id: 'groove-02', uuid: HELD, template: 'shuffle', seed: 2 },
  { id: 'groove-03', template: 'half-time', seed: 3 } as unknown as GrooveSpec,
]

const silent = () => {}

describe('backfillUuids', () => {
  it('mints one uuid for each groove that has none and leaves the rest alone', () => {
    const path = tempCatalogue(SPECS)

    const result = backfillUuids({ cataloguePath: path, log: silent })

    expect(result).toEqual({ minted: 2, kept: 1 })
    const written = JSON.parse(readFileSync(path, 'utf8')) as GrooveSpec[]
    expect(written).toHaveLength(3)
    expect(written[1].uuid).toBe(HELD)
    for (const spec of written) expect(isCanonicalUuid(spec.uuid), spec.id).toBe(true)
    expect(new Set(written.map((s) => s.uuid)).size).toBe(3)
  })

  it('writes uuid directly after id, so the catalogue diff is one line per groove', () => {
    const path = tempCatalogue(SPECS)
    backfillUuids({ cataloguePath: path, log: silent })
    expect(readFileSync(path, 'utf8')).toMatch(/"id": "groove-01",\n\s+"uuid": "/)
  })

  it('mints nothing on a second run and leaves the file byte-identical', () => {
    const path = tempCatalogue(SPECS)
    backfillUuids({ cataloguePath: path, log: silent })
    const first = readFileSync(path)

    const again = backfillUuids({
      cataloguePath: path,
      mint: () => {
        throw new Error('the backfill minted again over a complete catalogue')
      },
      log: silent,
    })

    expect(again).toEqual({ minted: 0, kept: 3 })
    expect(readFileSync(path).equals(first)).toBe(true)
  })

  it('reports what it did, both halves of it', () => {
    const path = tempCatalogue(SPECS)
    const lines: string[] = []
    backfillUuids({ cataloguePath: path, log: (line) => lines.push(line) })
    expect(lines.join('\n')).toContain('2 minted, 1 already present')
  })
})
