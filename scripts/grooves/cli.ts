import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Groove } from '../../src/lib/groove.ts'
import { displayFlavour } from '../../src/lib/theory/names.ts'
import { CATALOGUE_PATH, readCatalogue } from './catalogue.ts'
import { encodeMp3 } from './encode.ts'
import { buildEvents } from './events.ts'
import { writeManifest } from './manifest.ts'
import { buildPools } from './pools.ts'
import { buildLock, mergeLock, readLock, writeLock, type Lock } from './lock.ts'
import { mixTracks } from './mix.ts'
import { nameFor } from './name.ts'
import { loadPack } from './pack.ts'
import { probeHeadDelaySeconds } from './probe.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec, MusicMeta, Pcm, SamplePack } from './types.ts'
import { renderVoices } from './voices.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_PACK_DIR = join(HERE, 'samples')
export const DEFAULT_OUT_DIR = join(HERE, '../../public/grooves')
export const DEFAULT_MANIFEST_PATH = join(
  HERE,
  '../../src/features/daily-groove/data/grooves.generated.ts',
)
export const DEFAULT_LOCK_PATH = join(HERE, 'grooves.lock.json')
export const SAMPLE_RATE = 44100
export const OVERHANG_BARS = 1

export function toGroove(
  spec: GrooveSpec,
  music: MusicMeta,
  headDelaySeconds: number,
): Groove {
  return {
    id: spec.id,
    uuid: spec.uuid,
    audioSrc: `/grooves/${spec.id}.mp3`,
    name: nameFor(spec.id),
    bpm: music.bpm,
    scale: music.scale,
    chord: music.chord,
    progression: music.progression,
    progressionDegrees: music.progressionDegrees,
    root: music.root,
    flavour: displayFlavour(music.flavour),
    bars: music.bars,
    loopBars: music.loopBars,
    headDelaySeconds,
  }
}

export type GenerateOptions = {
  catalogue?: GrooveSpec[]
  packDir?: string
  outDir?: string
  manifestPath?: string
  pack?: SamplePack
  encode?: boolean
  cataloguePath?: string
  lockPath?: string
}

export type GenerateResult = {
  entries: Groove[]
  pcm: Map<string, Pcm>
}

function existingLock(path: string): Lock | null {
  try {
    return readLock(path)
  } catch {
    return null
  }
}

export async function generate(options: GenerateOptions = {}): Promise<GenerateResult> {
  const specs = options.catalogue ?? readCatalogue()
  const outDir = options.outDir ?? DEFAULT_OUT_DIR
  const pack = options.pack ?? (await loadPack(options.packDir ?? DEFAULT_PACK_DIR))
  const shouldEncode = options.encode ?? true

  mkdirSync(outDir, { recursive: true })

  const rendered: { spec: GrooveSpec; music: MusicMeta }[] = []
  const pcm = new Map<string, Pcm>()

  for (const spec of specs) {
    const template = templateById(spec.template)
    const { events, music } = buildEvents(spec, template)
    const tracks = renderVoices(events, pack, SAMPLE_RATE, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      passes: music.loopBars / music.bars,
      overhangBars: OVERHANG_BARS,
    })
    const master = mixTracks(tracks, template, {
      loopBars: music.loopBars,
      bpm: music.bpm,
    })

    pcm.set(spec.id, master)
    rendered.push({ spec, music })

    if (shouldEncode) await encodeMp3(master, join(outDir, `${spec.id}.mp3`))
  }

  const files = rendered.map(({ spec }) => join(outDir, `${spec.id}.mp3`))
  const audioOnDisk = files.every((file) => existsSync(file))
  const delays = audioOnDisk
    ? await Promise.all(files.map((file) => probeHeadDelaySeconds(file)))
    : files.map(() => 0)
  const entries = rendered.map(({ spec, music }, i) => toGroove(spec, music, delays[i]))

  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
  writeManifest(entries, manifestPath, buildPools(entries))

  if (audioOnDisk) {
    const lockPath = options.lockPath ?? DEFAULT_LOCK_PATH
    const grooves = buildLock(
      {
        grooveDir: outDir,
        cataloguePath: options.cataloguePath ?? CATALOGUE_PATH,
        manifestPath,
      },
      entries.map((e) => e.id),
    )
    writeLock(mergeLock(existingLock(lockPath), grooves), lockPath)
  }

  return { entries, pcm }
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const manifestOnly = process.argv.slice(2).includes('--manifest-only')
  const { entries } = await generate({ encode: !manifestOnly })
  if (manifestOnly) console.log('manifest-only: no audio was encoded')
  console.log(`rendered ${entries.length} grooves`)
  for (const e of entries) {
    console.log(`  ${e.id}  ${e.name.padEnd(22)} ${e.scale.padEnd(20)} ${e.chord.padEnd(10)} ${e.bpm}bpm`)
  }
}
