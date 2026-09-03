export type Tier = 'app' | 'generator' | 'tooling'

export const GENERATOR_IMPORTS: readonly string[] = [
  'src/lib/groove.ts',
  'src/lib/hash.ts',
  'src/lib/theory/names.ts',
  'src/lib/theory/roots.ts',
  'src/lib/theory/scales.ts',
]

export function tiersFor(paths: readonly string[] | null): Tier[] {
  if (paths === null || paths.length === 0) {
    return ['app', 'generator', 'tooling']
  }

  const appOnly = paths.every(
    (path) => path.startsWith('src/') && !GENERATOR_IMPORTS.includes(path),
  )

  return appOnly ? ['app', 'tooling'] : ['app', 'generator', 'tooling']
}

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

  const trigger = paths.find(
    (path) => path.startsWith('scripts/') || GENERATOR_IMPORTS.includes(path),
  )

  if (trigger !== undefined) {
    return `selected — the scope includes \`${trigger}\`, which the generator builds on.`
  }

  if (!paths.every((path) => path.startsWith('src/'))) {
    return 'selected — the scope includes a path outside `src/`, so tier selection takes the safe default.'
  }

  return 'not run — every path in the scope is under `src/`, with no path under `scripts/` and no module the generator imports.'
}
