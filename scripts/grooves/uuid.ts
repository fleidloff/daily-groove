import { randomUUID } from 'node:crypto'
import type { GateFailure, GrooveSpec } from './types.ts'

const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isCanonicalUuid(value: unknown): boolean {
  return typeof value === 'string' && CANONICAL.test(value)
}

export function mintUuid(): string {
  return randomUUID()
}

function withUuid(spec: GrooveSpec, uuid: string): GrooveSpec {
  return { id: spec.id, uuid, template: spec.template, seed: spec.seed }
}

export function assignMissingUuids(
  specs: readonly GrooveSpec[],
  mint: () => string = mintUuid,
): GrooveSpec[] {
  return specs.map((spec) => (isCanonicalUuid(spec.uuid) ? spec : withUuid(spec, mint())))
}

export function uuidFailures(specs: readonly GrooveSpec[]): GateFailure[] {
  const failures: GateFailure[] = []
  const holders = new Map<string, string[]>()

  for (const spec of specs) {
    const value: unknown = spec.uuid
    if (value === undefined || value === null || value === '') {
      failures.push({
        check: 'uuid-missing',
        detail: `${spec.id} has no uuid — run \`npm run grooves:uuid\` to mint one`,
      })
      continue
    }
    if (typeof value !== 'string' || !isCanonicalUuid(value)) {
      failures.push({
        check: 'uuid-malformed',
        detail:
          `${spec.id} has a malformed uuid: ${JSON.stringify(value)} — a uuid is a canonical ` +
          'lowercase hyphenated v4 uuid, all 36 characters of it',
      })
      continue
    }
    const held = holders.get(value)
    if (held) held.push(spec.id)
    else holders.set(value, [spec.id])
  }

  for (const [uuid, ids] of holders) {
    if (ids.length > 1) {
      failures.push({
        check: 'uuid-duplicate',
        detail: `${ids.join(', ')} all hold the uuid ${uuid} — a uuid belongs to one groove`,
      })
    }
  }

  return failures
}
