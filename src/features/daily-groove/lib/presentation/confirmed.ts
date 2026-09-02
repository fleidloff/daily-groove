import type { Attempt, Flavour, Root } from '../../types'

export type Confirmed = {
  roots: Root[]
  flavours: Flavour[]
}

export function confirmedHalves(attempts: Attempt[]): Confirmed {
  const roots: Root[] = []
  const flavours: Flavour[] = []
  const seenRoots = new Set<Root>()
  const seenFlavours = new Set<Flavour>()

  for (const attempt of attempts) {
    if (attempt.rootMatched && !seenRoots.has(attempt.root)) {
      seenRoots.add(attempt.root)
      roots.push(attempt.root)
    }
    if (attempt.flavourMatched && !seenFlavours.has(attempt.flavour)) {
      seenFlavours.add(attempt.flavour)
      flavours.push(attempt.flavour)
    }
  }

  return { roots, flavours }
}
