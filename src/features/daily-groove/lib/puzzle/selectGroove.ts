import type { Groove } from '../../types'
import { isoDate, parseIsoDate } from '@/lib/date'
import { seededShuffle } from '@/lib/theory/options'

// The rota epoch. The one value in the rota that deliberately moves: bumping it
// remaps every unplayed date, past and future. Every release that mints grooves
// bumps it. Epoch 1 names the order that existed before the epoch did and is
// never rendered by the seed. Epoch 3 is the constrained order below.
export const ROTA_EPOCH = 3

export function dayIndexOf(iso: string): number {
  return Math.floor(parseIsoDate(iso).getTime() / 86_400_000)
}

// Roots, modes and styles are compared far more often than there are grooves, so
// they are encoded to integers once per catalogue and counted in typed arrays.
// The straightforward shape — string keys in a Map, rebuilt inside the per-lap
// loop — costs about 7x more, which is paid on every cold page load.
type Coded = { groove: Groove; root: number; flavour: number; style: number }

type Catalogue = { pool: Coded[]; roots: number; flavours: number; styles: number }

function encode(grooves: Groove[]): Catalogue {
  const ids = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()]
  const idOf = (which: number, key: string): number => {
    const seen = ids[which].get(key)
    if (seen !== undefined) return seen
    ids[which].set(key, ids[which].size)
    return ids[which].size - 1
  }
  const pool = grooves.map((groove) => ({
    groove,
    root: idOf(0, groove.root),
    flavour: idOf(1, groove.flavour),
    style: groove.style === undefined ? -1 : idOf(2, groove.style),
  }))
  return { pool, roots: ids[0].size, flavours: ids[1].size, styles: ids[2].size }
}

function conflicts(a: Coded, b: Coded): boolean {
  return a.root === b.root || a.flavour === b.flavour || (a.style >= 0 && a.style === b.style)
}

// Places the most abundant legal candidate at each step, so the scarce roots,
// modes and styles are never stranded at the tail. That choice is what lets the
// shipped catalogue solve with no backtracking at all.
function constrainedOrder(
  catalogue: Catalogue,
  pool: Coded[],
  prefix: readonly Coded[],
): Coded[] | null {
  const rootsLeft = new Int32Array(catalogue.roots)
  const flavoursLeft = new Int32Array(catalogue.flavours)
  const stylesLeft = new Int32Array(catalogue.styles)
  for (const c of pool) {
    rootsLeft[c.root] += 1
    flavoursLeft[c.flavour] += 1
    if (c.style >= 0) stylesLeft[c.style] += 1
  }

  const used = new Uint8Array(pool.length)
  const out: Coded[] = []
  let older = prefix.at(-2)
  let newer = prefix.at(-1)

  for (let placed = 0; placed < pool.length; placed += 1) {
    let best = -1
    let bestScore = -1
    for (let i = 0; i < pool.length; i += 1) {
      if (used[i] === 1) continue
      const candidate = pool[i]
      if (newer !== undefined && conflicts(candidate, newer)) continue
      if (older !== undefined && conflicts(candidate, older)) continue
      const score =
        rootsLeft[candidate.root] +
        flavoursLeft[candidate.flavour] +
        (candidate.style >= 0 ? stylesLeft[candidate.style] : 0)
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) return null

    const chosen = pool[best]
    used[best] = 1
    out.push(chosen)
    rootsLeft[chosen.root] -= 1
    flavoursLeft[chosen.flavour] -= 1
    if (chosen.style >= 0) stylesLeft[chosen.style] -= 1
    older = newer
    newer = chosen
  }
  return out
}

function plainOrder(lap: number, catalogue: Catalogue, epoch: number): Coded[] {
  const size = catalogue.pool.length
  const order = seededShuffle(catalogue.pool, `${epoch}:lap:${lap}`)
  if (lap === 0 || size < 2) return order
  if (size === 2) return seededShuffle(catalogue.pool, `${epoch}:lap:0`)

  const closing = seededShuffle(catalogue.pool, `${epoch}:lap:${lap - 1}`)[size - 1]
  if (order[0].groove.id !== closing.groove.id) return order

  ;[order[0], order[1]] = [order[1], order[0]]
  return order
}

function buildLap(
  lap: number,
  catalogue: Catalogue,
  epoch: number,
  prefix: readonly Coded[],
): Coded[] {
  if (catalogue.pool.length < 3) return plainOrder(lap, catalogue, epoch)
  return (
    constrainedOrder(catalogue, seededShuffle(catalogue.pool, `${epoch}:lap:${lap}`), prefix) ??
    plainOrder(lap, catalogue, epoch)
  )
}

// A lap's first two days are checked against the last two of the lap before, so
// every lap depends on its predecessor's result. The chain is walked once and
// extended in place — recomputing it from lap 0 on each call makes a sweep of
// consecutive days quadratic in the lap count.
type Chain = { catalogue: Catalogue; tails: Coded[][]; order: Groove[]; lap: number }

const chains = new WeakMap<Groove[], Map<number, Chain>>()

function chainFor(grooves: Groove[], epoch: number): Chain {
  let byEpoch = chains.get(grooves)
  if (byEpoch === undefined) {
    byEpoch = new Map()
    chains.set(grooves, byEpoch)
  }
  let chain = byEpoch.get(epoch)
  if (chain === undefined) {
    const catalogue = encode(grooves)
    const first = buildLap(0, catalogue, epoch, [])
    chain = {
      catalogue,
      tails: [first.slice(-2)],
      order: first.map((c) => c.groove),
      lap: 0,
    }
    byEpoch.set(epoch, chain)
  }
  return chain
}

export function orderFor(lap: number, grooves: Groove[], epoch: number = ROTA_EPOCH): Groove[] {
  const chain = chainFor(grooves, epoch)
  for (let next = chain.tails.length; next <= lap; next += 1) {
    const order = buildLap(next, chain.catalogue, epoch, chain.tails[next - 1])
    chain.tails.push(order.slice(-2))
    chain.order = order.map((c) => c.groove)
    chain.lap = next
  }
  if (chain.lap !== lap) {
    const order = buildLap(lap, chain.catalogue, epoch, lap === 0 ? [] : chain.tails[lap - 1])
    chain.order = order.map((c) => c.groove)
    chain.lap = lap
  }
  return chain.order
}

export function selectGrooveForDate(date: Date, grooves: Groove[], pinnedId?: string): Groove {
  if (grooves.length === 0) {
    throw new Error('selectGrooveForDate: grooves must not be empty')
  }
  if (pinnedId) {
    const pinned = grooves.find((g) => g.id === pinnedId)
    if (pinned) return pinned
  }
  const dayIndex = dayIndexOf(isoDate(date))
  const lap = Math.floor(dayIndex / grooves.length)
  const position = ((dayIndex % grooves.length) + grooves.length) % grooves.length
  return orderFor(lap, grooves)[position]
}
