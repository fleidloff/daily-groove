/**
 * Which test tiers a change has to run.
 *
 * The suite is split into three vitest projects serving two tiers of cost:
 * `app` and `tooling` are both fast and both run on every gate; `generator`
 * decodes the committed sample pack and renders audio, and is the one that
 * gets selected. A gate asks this module which tiers an epic's file scope
 * requires, so the rule has one home that can be tested rather than a sentence
 * repeated in two skill files.
 *
 * This module imports nothing. Deciding whether to run the tests must not
 * depend on anything being installed.
 */

export type Tier = 'app' | 'generator' | 'tooling'

/**
 * Which tiers an epic's file scope requires.
 *
 * `paths` are repo-relative, POSIX-separated, as a tech spec's file-ownership
 * lists write them. `null` means the scope could not be determined.
 */
export function tiersFor(paths: readonly string[] | null): Tier[] {
  // An empty list is not "a scope with nothing in it", it is a scope nobody
  // established — the same unknown as null. Guessing wrong towards running
  // less is a silent miss; guessing wrong towards running more costs a minute.
  if (paths === null || paths.length === 0) {
    return ['app', 'generator', 'tooling']
  }

  // Stated positively, the way the rule is written down: the fast tiers run
  // alone only for a scope that is entirely app code. Everything else — a path
  // under scripts/, a path under src/lib/, a docs- or skills-only scope — takes
  // the safe default and runs all three.
  //
  // src/lib/ is the whole folder, not just the two files the generator imports
  // today: it is *defined* as the code the app and the generator may share, so
  // the trigger follows the folder's contract rather than today's import graph.
  // Narrowing it to hash.ts and groove.ts would leave the next shared module
  // silently unguarded.
  const appOnly = paths.every(
    (path) => path.startsWith('src/') && !path.startsWith('src/lib/'),
  )

  return appOnly ? ['app', 'tooling'] : ['app', 'generator', 'tooling']
}

/** Why a tier was or was not selected, for the report's Checks table. */
export function tierReason(
  paths: readonly string[] | null,
  tier: Tier,
): string {
  if (tier !== 'generator') {
    return `selected — the ${tier} tier is fast and runs on every gate.`
  }

  if (paths === null || paths.length === 0) {
    return 'selected — the scope could not be determined, so every tier runs.'
  }

  if (
    paths.some(
      (path) => path.startsWith('scripts/') || path.startsWith('src/lib/'),
    )
  ) {
    return 'selected — the scope includes a path under `scripts/` or `src/lib/`.'
  }

  if (!paths.every((path) => path.startsWith('src/'))) {
    return 'selected — the scope includes a path outside `src/`, so tier selection takes the safe default.'
  }

  return 'not run — every path in the scope is under `src/`, with no path under `scripts/` or `src/lib/`.'
}
