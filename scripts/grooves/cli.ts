import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Groove } from '../../src/lib/groove.ts'
import { CATALOGUE_PATH, readCatalogue } from './catalogue.ts'
import { encodeMp3 } from './encode.ts'
import { buildEvents } from './events.ts'
import { writeManifest } from './manifest.ts'
import { buildPools } from './pools.ts'
import { buildLock, writeLock } from './lock.ts'
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

/**
 * The manifest entry describing a rendered groove. `headDelaySeconds` is
 * measured from the groove's own mp3 — see `probe.ts` — and passed in rather
 * than derived here, because only the caller knows when that file exists.
 */
export function toGroove(
  spec: GrooveSpec,
  music: MusicMeta,
  headDelaySeconds: number,
): Groove {
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
    loopBars: music.loopBars,
    headDelaySeconds,
  }
}

export type GenerateOptions = {
  catalogue?: GrooveSpec[]
  packDir?: string
  outDir?: string
  manifestPath?: string
  /** Injected by tests so they never load the real pack. */
  pack?: SamplePack
  /**
   * When false, no mp3 is written: the manifest and the lock are re-rendered
   * from the audio already on disk. `npm run grooves -- --manifest-only` uses
   * it to pick up a metadata change without re-encoding the catalogue, and the
   * determinism test uses it to render PCM and nothing else.
   */
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

  // Rendered first, described second: a groove's head delay is a property of
  // the mp3 the encoder writes, so it cannot be measured until that file is on
  // disk — and the loop below pushes each groove before encoding it.
  const rendered: { spec: GrooveSpec; music: MusicMeta }[] = []
  const pcm = new Map<string, Pcm>()

  for (const spec of specs) {
    const template = templateById(spec.template)
    const { events, music } = buildEvents(spec, template)
    // Render past the loop end, then fold the overhang back onto the start, so a
    // cymbal ringing at the last bar rings over bar 1 the way a real repeat
    // would. What is rendered is `loopBars` — every pass of the figure, not the
    // four bars it repeats — so both renderers are given the file's length,
    // never the figure's.
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

  // Every artifact below is derived from the files in `outDir`, so both the
  // probe and the lock ask the same question first: is the audio there?
  const files = rendered.map(({ spec }) => join(outDir, `${spec.id}.mp3`))
  const audioOnDisk = files.every((file) => existsSync(file))
  // Nothing to measure when there is no audio — a PCM-only run renders a
  // manifest it never uses, and a made-up delay would be worse than a zero.
  const delays = audioOnDisk
    ? await Promise.all(files.map((file) => probeHeadDelaySeconds(file)))
    : files.map(() => 0)
  const entries = rendered.map(({ spec, music }, i) => toGroove(spec, music, delays[i]))

  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
  // Pools are emitted from the catalogue's own values, so a distractor can never
  // drift from the answers it is meant to sit beside.
  writeManifest(entries, manifestPath, buildPools(entries))

  // The lock records what this run produced, so the build can later prove the
  // committed artifacts still match their inputs without re-rendering anything.
  // `buildLock` hashes the files on disk rather than the PCM just rendered, so
  // what it needs is audio to hash, not an encode of its own: a manifest-only
  // run locks the existing mp3s, and a PCM-only run has none to lock.
  if (audioOnDisk) {
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
  // `--manifest-only` re-renders the manifest and the lock from the committed
  // audio. It is how a change to what a Groove carries ships without rewriting
  // sixteen mp3s that no one asked to change.
  const manifestOnly = process.argv.slice(2).includes('--manifest-only')
  const { entries } = await generate({ encode: !manifestOnly })
  if (manifestOnly) console.log('manifest-only: no audio was encoded')
  console.log(`rendered ${entries.length} grooves`)
  for (const e of entries) {
    console.log(`  ${e.id}  ${e.name.padEnd(22)} ${e.scale.padEnd(20)} ${e.chord.padEnd(10)} ${e.bpm}bpm`)
  }
}
