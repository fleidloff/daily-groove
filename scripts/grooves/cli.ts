import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Groove } from '../../src/features/daily-groove/types.ts'
import { CATALOGUE_PATH, readCatalogue } from './catalogue.ts'
import { encodeMp3 } from './encode.ts'
import { buildEvents } from './events.ts'
import { writeManifest } from './manifest.ts'
import { buildPools } from './pools.ts'
import { buildLock, writeLock } from './lock.ts'
import { mixTracks } from './mix.ts'
import { nameFor } from './name.ts'
import { loadPack } from './pack.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec, MusicMeta, Pcm, SamplePack } from './types.ts'
import { renderVoices } from './voices.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_PACK_DIR = join(HERE, 'samples')
export const DEFAULT_OUT_DIR = join(HERE, '../../public/grooves')
export const DEFAULT_MANIFEST_PATH = join(
  HERE,
  '../../src/features/daily-groove/lib/grooves.generated.ts',
)
export const DEFAULT_LOCK_PATH = join(HERE, 'grooves.lock.json')
export const SAMPLE_RATE = 44100
/** Rendered past the loop end so instrument tails can wrap onto the start. */
export const OVERHANG_BARS = 1

/**
 * The generator's internal flavour is a lowercase union ('harmonic-minor');
 * the app displays a title-cased string ('Harmonic minor'). Converting here,
 * once, keeps the two spellings from ever drifting — and matches exactly what
 * the app's own parseScale() derives from the scale string.
 */
export function displayFlavour(flavour: string): string {
  const words = flavour.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The manifest entry describing a rendered groove. */
export function toGroove(spec: GrooveSpec, music: MusicMeta): Groove {
  return {
    id: spec.id,
    audioSrc: `/grooves/${spec.id}.mp3`,
    name: nameFor(spec.id),
    bpm: music.bpm,
    scale: music.scale,
    chord: music.chord,
    progression: music.progression,
    root: music.root,
    flavour: displayFlavour(music.flavour),
    bars: music.bars,
  }
}

export type GenerateOptions = {
  catalogue?: GrooveSpec[]
  packDir?: string
  outDir?: string
  manifestPath?: string
  /** Injected by tests so they never load the real pack. */
  pack?: SamplePack
  /** When false, skip mp3 encoding (used by the determinism test). */
  encode?: boolean
  cataloguePath?: string
  lockPath?: string
}

export type GenerateResult = {
  entries: Groove[]
  /** Pre-encode PCM, keyed by groove id. Determinism is asserted on this. */
  pcm: Map<string, Pcm>
}

export async function generate(options: GenerateOptions = {}): Promise<GenerateResult> {
  const specs = options.catalogue ?? readCatalogue()
  const outDir = options.outDir ?? DEFAULT_OUT_DIR
  const pack = options.pack ?? (await loadPack(options.packDir ?? DEFAULT_PACK_DIR))
  const shouldEncode = options.encode ?? true

  mkdirSync(outDir, { recursive: true })

  const entries: Groove[] = []
  const pcm = new Map<string, Pcm>()

  for (const spec of specs) {
    const template = templateById(spec.template)
    const { events, music } = buildEvents(spec, template)
    // Render past the loop end, then fold the overhang back onto the start, so a
    // cymbal ringing at bar 4 rings over bar 1 the way a real repeat would.
    const tracks = renderVoices(events, pack, SAMPLE_RATE, {
      id: spec.id,
      bars: music.bars,
      bpm: music.bpm,
      overhangBars: OVERHANG_BARS,
    })
    const master = mixTracks(tracks, template, {
      loopBars: music.bars,
      bpm: music.bpm,
    })

    pcm.set(spec.id, master)
    entries.push(toGroove(spec, music))

    if (shouldEncode) await encodeMp3(master, join(outDir, `${spec.id}.mp3`))
  }

  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
  // Pools are emitted from the catalogue's own values, so a distractor can never
  // drift from the answers it is meant to sit beside.
  writeManifest(entries, manifestPath, buildPools(entries))

  // The lock records what this run produced, so the build can later prove the
  // committed artifacts still match their inputs without re-rendering anything.
  // Skipped when nothing was encoded, or it would hash mp3s that do not exist.
  if (shouldEncode) {
    writeLock(
      buildLock(
        {
          grooveDir: outDir,
          cataloguePath: options.cataloguePath ?? CATALOGUE_PATH,
          manifestPath,
        },
        entries.map((e) => e.id),
      ),
      options.lockPath ?? DEFAULT_LOCK_PATH,
    )
  }

  return { entries, pcm }
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { entries } = await generate()
  console.log(`rendered ${entries.length} grooves`)
  for (const e of entries) {
    console.log(`  ${e.id}  ${e.name.padEnd(22)} ${e.scale.padEnd(20)} ${e.chord.padEnd(10)} ${e.bpm}bpm`)
  }
}
