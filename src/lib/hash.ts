/**
 * The one hash. Editing this function is not a refactor — it is a re-release.
 *
 * The same `hashString` seeds the generator's RNG (`scripts/grooves/rng.ts`,
 * which imports this file by relative path) *and* picks the player's groove of
 * the day (`selectGrooveForDate`). Change a single character and both move:
 * every groove re-renders to different audio, and — the half that cannot be
 * undone by re-rendering — every past date is reassigned a different puzzle
 * from the one the player was shown.
 *
 * `src/lib/hash.test.ts` pins it against a fixed table for exactly that reason.
 * If that table fails, the fix is to restore the function — never to regenerate
 * the table.
 *
 * This file must stay runtime-safe TypeScript: a plain function, no enums,
 * namespaces or decorators, and no `@/` imports, because the generator runs it
 * through Node's type stripping, which erases types but does not resolve the
 * alias.
 */

/**
 * Deterministic 32-bit string hash (FNV-1a variant). Stable and dependency-free
 * so the same seed always maps to the same non-negative integer.
 */
export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // Force to an unsigned 32-bit integer.
  return hash >>> 0
}
