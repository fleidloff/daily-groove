import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOGUE_PATH, readCatalogue, writeCatalogue } from './catalogue.ts'
import {
  DEFAULT_LOCK_PATH,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_OUT_DIR,
  DEFAULT_PACK_DIR,
  OVERHANG_BARS,
  SAMPLE_RATE,
  toGroove,
} from './cli.ts'
import { encodeMp3 } from './encode.ts'
import { buildEvents } from './events.ts'
import { gateCandidate } from './gate.ts'
import { buildLock, mergeLock, readLock, writeLock } from './lock.ts'
import { writeManifest } from './manifest.ts'
import { mixTracks } from './mix.ts'
import { loadPack } from './pack.ts'
import { probeHeadDelaySeconds } from './probe.ts'
import { buildPools } from './pools.ts'
import { selectSeeds } from './select.ts'
import { allTemplates } from './templates/index.ts'
import type { Harmony } from './theory/harmony.ts'
import type {
  FeelTemplate,
  GateFailure,
  GrooveSpec,
  MusicMeta,
  NoteEvent,
  Pcm,
  SamplePack,
} from './types.ts'
import { mintUuid } from './uuid.ts'
import { renderVoices } from './voices.ts'

/**
 * Minting. `npm run grooves:add <n>` extends the catalogue by exactly n.
 *
 * Three rules shape everything here:
 *
 * - There is ONE definition of an acceptable groove, and it lives in
 *   `selectSeeds`. The initial catalogue and the ten-thousandth addition pass
 *   the same search; this module never re-implements it.
 * - The start seed comes from the clock, not from the catalogue, so two people
 *   minting against the same catalogue get different grooves and both batches
 *   survive a merge. That is the one non-reproducible step in the pipeline, and
 *   it ends the moment the chosen seed is written into catalogue.json.
 * - Nothing partial is ever written. The whole batch is rendered and gated in
 *   memory; the first byte hits the disk only once n grooves have passed.
 */

/** The quality gate's shape. Injected in tests; `gate.ts` supplies the real one. */
export type GateFn = (args: {
  pcm: Pcm
  events: NoteEvent[]
  music: MusicMeta
  harmony: Harmony
  template: FeelTemplate
}) => GateFailure | null

export type AddOptions = {
  /** Bounded so an impossible request fails loudly instead of looping forever. */
  maxAttempts?: number
  /** Defaults to a seed derived from `now()`. Tests always pass one of the two. */
  startSeed?: number
  /** Injectable clock, so tests are deterministic. */
  now?: () => number
  cataloguePath?: string
  outDir?: string
  manifestPath?: string
  lockPath?: string
  packDir?: string
  /** Injected by tests so they never load the real pack. */
  pack?: SamplePack
  templates?: readonly FeelTemplate[]
  /** Injected by tests; defaults to the real quality gate. */
  gate?: GateFn
  /**
   * Injected by tests; defaults to `uuid.ts`'s `mintUuid`. A groove's uuid is
   * minted here, where the groove comes into existence, rather than by a later
   * pass over the catalogue — `selectSeeds` is deterministic and must stay so,
   * which is why the mint cannot live inside it (F12 E1 R7).
   */
  mintUuid?: () => string
  log?: (message: string) => void
}

/** Ten tries per requested groove: generous for a gate that rejects a few. */
export const DEFAULT_ATTEMPTS_PER_GROOVE = 10

type Minted = { spec: GrooveSpec; pcm: Pcm }

/**
 * A 31-bit seed from a clock reading. `rngFor` hashes whatever it is given, so
 * the only thing that matters is that two runs a moment apart differ.
 */
export function seedFromClock(ms: number): number {
  return Math.abs(Math.floor(ms)) % 2_147_483_647
}

/** `wanted` first, the rest after — so `selectSeeds` returns it as entry zero. */
function rotate(templates: readonly FeelTemplate[], wanted: FeelTemplate): FeelTemplate[] {
  return [wanted, ...templates.filter((t) => t.id !== wanted.id)]
}

/**
 * Add `n` grooves to the catalogue: search for seeds, render, gate, and — only
 * once the whole batch has passed — write the audio, the catalogue, the
 * manifest and the lock. Returns the specs that were minted.
 */
export async function addGrooves(n: number, opts: AddOptions = {}): Promise<GrooveSpec[]> {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`addGrooves: n must be a positive integer, got ${String(n)}`)
  }

  const cataloguePath = opts.cataloguePath ?? CATALOGUE_PATH
  const outDir = opts.outDir ?? DEFAULT_OUT_DIR
  const manifestPath = opts.manifestPath ?? DEFAULT_MANIFEST_PATH
  const lockPath = opts.lockPath ?? DEFAULT_LOCK_PATH
  const templates = opts.templates ?? allTemplates()
  const log = opts.log ?? ((message: string) => console.log(message))
  const gate: GateFn = opts.gate ?? gateCandidate
  const mint = opts.mintUuid ?? mintUuid
  const maxAttempts = opts.maxAttempts ?? n * DEFAULT_ATTEMPTS_PER_GROOVE
  const startSeed = opts.startSeed ?? seedFromClock((opts.now ?? Date.now)())

  if (templates.length === 0) throw new Error('addGrooves: no templates to mint from')

  const existing = readCatalogue(cataloguePath)
  const pack = opts.pack ?? (await loadPack(opts.packDir ?? DEFAULT_PACK_DIR))

  const minted: Minted[] = []
  let cursor = startSeed
  // Feels ordered by how little the catalogue holds of each, so a batch tops up
  // what is behind rather than what is already ahead. Computed once: it must not
  // shift as the batch mints, or a single run would keep re-targeting itself.
  const heldBy = new Map<string, number>()
  for (const spec of existing) heldBy.set(spec.template, (heldBy.get(spec.template) ?? 0) + 1)
  const byScarcity = [...templates].sort(
    (a, b) => (heldBy.get(a.id) ?? 0) - (heldBy.get(b.id) ?? 0),
  )

  let attempts = 0

  while (minted.length < n) {
    if (attempts >= maxAttempts) {
      // R8: fail loudly rather than silently adding fewer. Nothing has been
      // written yet, so the tree is exactly as it was before this call.
      throw new Error(
        `addGrooves: gave up after ${maxAttempts} attempts with ${minted.length} of ${n} ` +
          'grooves accepted — nothing was written',
      )
    }
    attempts += 1

    // Round-robin the template across the batch, starting from the feel the
    // catalogue has least of, so four new grooves land on four feels rather
    // than piling onto the first one (R4).
    //
    // The order is by scarcity rather than by registration, and that is not a
    // nicety: `minted.length % templates.length` alone always starts at index
    // zero, so a batch smaller than the template count could only ever mint the
    // first few feels. A newly registered template — which is last in the
    // registry and has nothing behind it — was unreachable by any batch smaller
    // than the whole set, while repeated small batches piled onto the feels that
    // already had the most.
    const template = byScarcity[minted.length % byScarcity.length]

    // One shared definition of an acceptable groove. Passing every template
    // (rotated so the wanted one comes first) lets the search account for the
    // whole catalogue's flavour, scale and answer coverage, not just this
    // template's slice — and it skips any seed already in use, including a
    // start seed that happens to collide with one.
    const [candidate] = selectSeeds(rotate(templates, template), {
      perTemplate: 1,
      startSeed: cursor,
      existing: [...existing, ...minted.map((m) => m.spec)],
    })
    cursor = candidate.seed + 1

    const { events, music, harmony } = buildEvents(candidate, template)
    const pcm = renderCandidate(candidate, events, music, template, pack)
    const failure = gate({ pcm, events, music, harmony, template })

    if (failure) {
      // R7: report which check failed and move on. Never stop, never wait.
      log(
        `  rejected ${candidate.template} seed ${candidate.seed}: ${failure.check} — ${failure.detail}`,
      )
      continue
    }

    // The uuid is stamped on here, at the moment the candidate is accepted: a
    // groove that exists is a groove that can be linked to, and nothing between
    // this point and the catalogue write mints one of its own (F12 E1 R7, AC6).
    minted.push({ spec: { ...candidate, uuid: mint() }, pcm })
  }

  await writeBatch(minted, existing, templates, {
    cataloguePath,
    outDir,
    manifestPath,
    lockPath,
  })

  return minted.map((m) => m.spec)
}

/** One candidate through the same render path `npm run grooves` uses. */
export function renderCandidate(
  spec: GrooveSpec,
  events: NoteEvent[],
  music: MusicMeta,
  template: FeelTemplate,
  pack: SamplePack,
): Pcm {
  // The rendered length, not the figure: `bars` is the four-bar phrase the
  // manifest names, `loopBars` is what the pass loop actually emitted. Sizing
  // the buffer from `bars` would render four bars of a longer event list and
  // silently drop every pass after the first.
  const tracks = renderVoices(events, pack, SAMPLE_RATE, {
    id: spec.id,
    bars: music.loopBars,
    bpm: music.bpm,
    passes: music.loopBars / music.bars,
    overhangBars: OVERHANG_BARS,
  })
  return mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
}

/**
 * Every write of the run, in one place and after the batch has fully passed.
 * The existing audio is never re-encoded, so a mint cannot disturb a groove
 * that is already in the catalogue (R9).
 */
/** The committed lock, or null when there is none or it will not parse. */
function readLockOrNull(path: string) {
  try {
    return readLock(path)
  } catch {
    return null
  }
}

async function writeBatch(
  minted: readonly Minted[],
  existing: readonly GrooveSpec[],
  templates: readonly FeelTemplate[],
  paths: { cataloguePath: string; outDir: string; manifestPath: string; lockPath: string },
): Promise<void> {
  mkdirSync(paths.outDir, { recursive: true })
  for (const { spec, pcm } of minted) {
    await encodeMp3(pcm, join(paths.outDir, `${spec.id}.mp3`))
  }

  const catalogue = [...existing, ...minted.map((m) => m.spec)]
  writeCatalogue(catalogue, paths.cataloguePath)

  // Every entry's head delay is measured from its own file — the ones this run
  // encoded and the ones an earlier run did — so no number is ever shared
  // across the catalogue.
  const delays = await Promise.all(
    catalogue.map((spec) => probeHeadDelaySeconds(join(paths.outDir, `${spec.id}.mp3`))),
  )

  const entries = catalogue.map((spec, i) => {
    const template = templateFor(templates, spec.template)
    return toGroove(spec, buildEvents(spec, template).music, delays[i])
  })
  writeManifest(entries, paths.manifestPath, buildPools(entries))

  // Merged, not replaced. `npm run notes` records the reference notes in this
  // same lock, and a mint neither renders them nor can vouch for them — writing
  // a fresh lock here would drop them and leave `grooves:verify` passing while
  // it silently stopped guarding the notes (F10 E1 R23).
  writeLock(
    mergeLock(
      readLockOrNull(paths.lockPath),
      buildLock(
        {
          grooveDir: paths.outDir,
          cataloguePath: paths.cataloguePath,
          manifestPath: paths.manifestPath,
        },
        entries.map((e) => e.id),
      ),
    ),
    paths.lockPath,
  )
}

function templateFor(templates: readonly FeelTemplate[], id: string): FeelTemplate {
  const template = templates.find((t) => t.id === id)
  if (!template) throw new Error(`addGrooves: unknown template "${id}"`)
  return template
}
