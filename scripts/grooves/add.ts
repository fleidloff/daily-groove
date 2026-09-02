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

export type GateFn = (args: {
  pcm: Pcm
  events: NoteEvent[]
  music: MusicMeta
  harmony: Harmony
  template: FeelTemplate
}) => GateFailure | null

export type AddOptions = {
  maxAttempts?: number
  startSeed?: number
  now?: () => number
  cataloguePath?: string
  outDir?: string
  manifestPath?: string
  lockPath?: string
  packDir?: string
  pack?: SamplePack
  templates?: readonly FeelTemplate[]
  gate?: GateFn
  mintUuid?: () => string
  log?: (message: string) => void
}

export const DEFAULT_ATTEMPTS_PER_GROOVE = 10

type Minted = { spec: GrooveSpec; pcm: Pcm }

export function seedFromClock(ms: number): number {
  return Math.abs(Math.floor(ms)) % 2_147_483_647
}

function rotate(templates: readonly FeelTemplate[], wanted: FeelTemplate): FeelTemplate[] {
  return [wanted, ...templates.filter((t) => t.id !== wanted.id)]
}

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
  const heldBy = new Map<string, number>()
  for (const spec of existing) heldBy.set(spec.template, (heldBy.get(spec.template) ?? 0) + 1)
  const byScarcity = [...templates].sort(
    (a, b) => (heldBy.get(a.id) ?? 0) - (heldBy.get(b.id) ?? 0),
  )

  let attempts = 0

  while (minted.length < n) {
    if (attempts >= maxAttempts) {
      throw new Error(
        `addGrooves: gave up after ${maxAttempts} attempts with ${minted.length} of ${n} ` +
          'grooves accepted — nothing was written',
      )
    }
    attempts += 1

    const template = byScarcity[minted.length % byScarcity.length]

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
      log(
        `  rejected ${candidate.template} seed ${candidate.seed}: ${failure.check} — ${failure.detail}`,
      )
      continue
    }

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

export function renderCandidate(
  spec: GrooveSpec,
  events: NoteEvent[],
  music: MusicMeta,
  template: FeelTemplate,
  pack: SamplePack,
): Pcm {
  const tracks = renderVoices(events, pack, SAMPLE_RATE, {
    id: spec.id,
    bars: music.loopBars,
    bpm: music.bpm,
    passes: music.loopBars / music.bars,
    overhangBars: OVERHANG_BARS,
  })
  return mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
}

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

  const delays = await Promise.all(
    catalogue.map((spec) => probeHeadDelaySeconds(join(paths.outDir, `${spec.id}.mp3`))),
  )

  const entries = catalogue.map((spec, i) => {
    const template = templateFor(templates, spec.template)
    return toGroove(spec, buildEvents(spec, template).music, delays[i])
  })
  writeManifest(entries, paths.manifestPath, buildPools(entries))

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
