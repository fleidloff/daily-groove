import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Groove } from '../../src/lib/groove.ts'
import { displayFlavour } from '../../src/lib/theory/names.ts'
import { CATALOGUE_PATH, readCatalogue } from './catalogue.ts'
import { encodeMp3 } from './encode.ts'
import { buildEvents } from './events.ts'
import { heardInFailures, readHeardIn, type HeardInTable } from './heardIn.ts'
import { writeManifest } from './manifest.ts'
import { buildPools } from './pools.ts'
import { buildLock, mergeLock, readLock, writeLock, type Lock } from './lock.ts'
import { mixTracks } from './mix.ts'
import { namesFor } from './name.ts'
import { loadPack } from './pack.ts'
import { probeHeadDelaySeconds } from './probe.ts'
import { TEMPLATES, templateById } from './templates/index.ts'
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
  name: string,
): Groove {
  return {
    id: spec.id,
    uuid: spec.uuid,
    audioSrc: `/grooves/${spec.id}.mp3`,
    name,
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
  heardIn?: HeardInTable
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
  const names = namesFor(rendered.map(({ spec }) => spec.id))
  const entries = rendered.map(({ spec, music }, i) =>
    toGroove(spec, music, delays[i], names.get(spec.id) as string),
  )

  const heardIn = options.heardIn ?? readHeardIn()
  const heardInProblems = heardInFailures(heardIn, entries.map((e) => e.scale))
  if (heardInProblems.length > 0) {
    throw new Error(`heard-in.json: ${heardInProblems.join('; ')}`)
  }

  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
  writeManifest(entries, manifestPath, buildPools(entries), heardIn)

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

export type CliArgs = {
  only: string[]
  seeds: number[]
  template?: string
  outDir?: string
  packDir?: string
  manifestOnly: boolean
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { only: [], seeds: [], manifestOnly: false }

  const valueFor = (flag: string, i: number): string => {
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} needs a value`)
    }
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    switch (token) {
      case '--manifest-only':
        args.manifestOnly = true
        break
      case '--only':
        args.only.push(valueFor(token, i))
        i++
        break
      case '--out':
        args.outDir = valueFor(token, i)
        i++
        break
      case '--pack':
        args.packDir = valueFor(token, i)
        i++
        break
      case '--template':
        args.template = valueFor(token, i)
        i++
        break
      case '--seed': {
        const raw = valueFor(token, i)
        const seed = Number(raw)
        if (!Number.isInteger(seed) || seed < 0) {
          throw new Error(`--seed "${raw}" is not a non-negative integer`)
        }
        args.seeds.push(seed)
        i++
        break
      }
      default:
        throw new Error(`unknown argument: ${token}`)
    }
  }

  if (args.template === undefined && args.seeds.length > 0) {
    throw new Error('--seed names a groove for --template to render; --template is missing')
  }

  if (args.template !== undefined) {
    if (args.seeds.length === 0) {
      throw new Error(`--template ${args.template} renders nothing without at least one --seed`)
    }
    if (args.only.length > 0) {
      throw new Error(
        '--template renders a groove the catalogue does not hold; --only names one it does — pick one',
      )
    }
    if (args.outDir === undefined) {
      throw new Error('--template needs --out: an off-catalogue render never writes into the repo')
    }
  }

  return args
}

export function optionsFrom(args: CliArgs): GenerateOptions {
  const options: GenerateOptions = { encode: !args.manifestOnly }

  if (args.outDir !== undefined) {
    options.outDir = args.outDir
    options.manifestPath = join(args.outDir, 'grooves.generated.ts')
    options.lockPath = join(args.outDir, 'grooves.lock.json')
  }

  if (args.packDir !== undefined) options.packDir = args.packDir

  if (args.template !== undefined) {
    const template = args.template
    if (TEMPLATES[template] === undefined) {
      throw new Error(
        `--template: unknown template "${template}" — known ids: ${Object.keys(TEMPLATES).join(', ')}`,
      )
    }
    options.catalogue = args.seeds.map((seed) => ({
      id: `audition-${template}-${seed}`,
      uuid: '',
      template,
      seed,
    }))
    options.heardIn = {}
  }

  if (args.only.length > 0) {
    const wanted = new Set(args.only)
    const catalogue = readCatalogue().filter((spec) => wanted.has(spec.id))
    const missing = args.only.filter((id) => !catalogue.some((spec) => spec.id === id))
    if (missing.length > 0) {
      throw new Error(`--only: no catalogue entry named ${missing.join(', ')}`)
    }
    options.catalogue = catalogue
    options.heardIn = {}
  }

  return options
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  let args: CliArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error))
    process.exit(1)
  }

  let options: GenerateOptions
  try {
    options = optionsFrom(args)
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error))
    process.exit(1)
  }

  const { entries } = await generate(options)
  if (args.manifestOnly) console.log('manifest-only: no audio was encoded')
  console.log(`rendered ${entries.length} grooves`)
  for (const e of entries) {
    console.log(`  ${e.id}  ${e.name.padEnd(22)} ${e.scale.padEnd(20)} ${e.chord.padEnd(10)} ${e.bpm}bpm`)
  }
}
