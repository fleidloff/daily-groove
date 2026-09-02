export type Tier = 'app' | 'generator' | 'tooling'

export function tiersFor(paths: readonly string[] | null): Tier[] {
  if (paths === null || paths.length === 0) {
    return ['app', 'generator', 'tooling']
  }

  const appOnly = paths.every(
    (path) => path.startsWith('src/') && !path.startsWith('src/lib/'),
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
