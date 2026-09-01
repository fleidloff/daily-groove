import { randomUUID } from 'node:crypto'
import type { GateFailure, GrooveSpec } from './types.ts'

/**
 * A groove's permanent identity.
 *
 * The uuid is the generator's INPUT, not its output: it is minted into
 * catalogue.json once — by `npm run grooves:uuid` for a groove that has none,
 * by `npm run grooves:add` for one it appends — and copied outward from there by
 * the manifest renderer, which never mints. Minting inside the renderer would
 * make two runs of `npm run grooves` disagree and take the determinism the lock
 * depends on with it (F12 E1 R2, R5).
 *
 * This module imports nothing but `node:crypto`, which is why `lock.ts` — the
 * build guard, which must run on a machine with no ffmpeg and no sample pack —
 * is allowed to reach it.
 */

/**
 * Canonical v4: lowercase, hyphenated, all 36 characters, `4` in the version
 * position and one of `8 9 a b` in the variant position. There is no short form
 * and no uppercase form — a link a mail client capitalised is folded back to
 * this on the way in, not stored as it arrived (R1a).
 */
const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/**
 * Whether `value` is a canonical v4 uuid. Takes `unknown` deliberately: the
 * catalogue is JSON, so a hand edit can put anything in a `uuid` field, and the
 * guard has to be able to say no rather than throw.
 */
export function isCanonicalUuid(value: unknown): boolean {
  return typeof value === 'string' && CANONICAL.test(value)
}

/** One new uuid. The only source of randomness in the pipeline's input. */
export function mintUuid(): string {
  return randomUUID()
}

/**
 * `spec` rebuilt with `uuid`, field by field rather than by spread, so `uuid`
 * lands directly after `id`. That is what makes the backfill's diff one added
 * line per groove instead of a trailing key on every entry.
 */
function withUuid(spec: GrooveSpec, uuid: string): GrooveSpec {
  return { id: spec.id, uuid, template: spec.template, seed: spec.seed }
}

/**
 * Every spec, with a uuid minted for each one that does not already hold a
 * canonical uuid. Idempotent: a spec that has one is returned untouched, so
 * running the backfill twice mints nothing the second time. A value that is
 * present but malformed is treated as missing — what the catalogue holds is not
 * a uuid either way, and re-minting is the repair (R2, R6).
 */
export function assignMissingUuids(
  specs: readonly GrooveSpec[],
  mint: () => string = mintUuid,
): GrooveSpec[] {
  return specs.map((spec) => (isCanonicalUuid(spec.uuid) ? spec : withUuid(spec, mint())))
}

/**
 * Every way a catalogue's uuids can be wrong, each failure naming the groove it
 * is about — one missing, one malformed, one shared by two grooves (R8, R9,
 * R10). Reports all of them in one pass: a catalogue with two faults should not
 * need two runs of the guard to find out.
 */
export function uuidFailures(specs: readonly GrooveSpec[]): GateFailure[] {
  const failures: GateFailure[] = []
  const holders = new Map<string, string[]>()

  for (const spec of specs) {
    // Typed `unknown`, because the catalogue is JSON: the field is declared a
    // string, and a hand edit can still put a number or nothing at all in it.
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

  // Named after the collision, not after the file: two grooves sharing a uuid is
  // one fault with two grooves in it, and naming only the second would hide
  // which one it collided with (R9).
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
