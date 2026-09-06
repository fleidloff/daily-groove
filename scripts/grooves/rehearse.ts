import { createHash } from 'node:crypto'
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { addGrooves, seedFromClock, type GateFn } from './add.ts'
import { CATALOGUE_PATH, readCatalogue } from './catalogue.ts'
import { DEFAULT_OUT_DIR } from './cli.ts'
import { buildEvents } from './events.ts'
import { TEMPLATES, allTemplates } from './templates/index.ts'
import type { FeelTemplate, GrooveSpec, SamplePack } from './types.ts'

const HERE = import.meta.dirname
const TEMPLATE_DIR = join(HERE, 'templates')

export type RehearsedGroove = {
  id: string
  template: string
  seed: number
  sha256: string
  bytes: number
}

export type Rehearsal = {
  template: string
  startSeed: number
  catalogueSha256: string
  dir: string
  grooves: RehearsedGroove[]
}

export type RehearseOptions = {
  template: string
  count: number
  startSeed?: number
  cataloguePath?: string
  audioDir?: string
  modulePath?: string
  pack?: SamplePack
  packDir?: string
  gate?: GateFn
  maxAttempts?: number
  now?: () => number
  log?: (line: string) => void
}

export type CommitOptions = {
  cataloguePath?: string
  outDir?: string
  manifestPath?: string
  lockPath?: string
  modulePath?: string
  pack?: SamplePack
  packDir?: string
  gate?: GateFn
  maxAttempts?: number
  log?: (line: string) => void
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function looksLikeTemplate(value: unknown): value is FeelTemplate {
  return typeof value === 'object' && value !== null && typeof (value as FeelTemplate).id === 'string'
}

export async function resolveTemplate(
  id: string,
  opts: { modulePath?: string } = {},
): Promise<FeelTemplate> {
  const registered = TEMPLATES[id]
  if (registered !== undefined && opts.modulePath === undefined) return registered

  const path = opts.modulePath ?? join(TEMPLATE_DIR, `${id}.ts`)
  const known = Object.keys(TEMPLATES).join(', ')

  let loaded: Record<string, unknown>
  try {
    loaded = (await import(pathToFileURL(path).href)) as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `resolveTemplate: no template "${id}" — it is not registered (registry holds: ${known}) ` +
        `and ${path} could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const templates = Object.values(loaded).filter(looksLikeTemplate)
  const match = templates.find((t) => t.id === id)
  if (!match) {
    throw new Error(
      `resolveTemplate: ${path} exports no template with id "${id}" — found: ` +
        `${templates.map((t) => t.id).join(', ') || 'none'} (registry holds: ${known})`,
    )
  }
  return match
}

async function templateList(
  id: string,
  modulePath: string | undefined,
): Promise<{ template: FeelTemplate; templates: FeelTemplate[] }> {
  const opts = modulePath === undefined ? {} : { modulePath }
  const template = await resolveTemplate(id, opts)
  const registry = allTemplates()
  // `add.ts` resolves every existing spec's template out of this list when it
  // rebuilds the manifest, so it must stay complete — only what gets minted is
  // narrowed, by `templateId`.
  const templates = registry.some((t) => t.id === id) ? registry : [...registry, template]
  return { template, templates }
}

// Hard links keep a rehearsal of the whole catalogue cheap enough to run three
// times in an afternoon; `linkSync` fails across filesystems, where tmpdir
// usually lives, so fall back to a copy.
function stage(from: string, to: string): void {
  try {
    linkSync(from, to)
  } catch {
    copyFileSync(from, to)
  }
}

function describeRow(spec: GrooveSpec, templates: readonly FeelTemplate[]): string {
  const template = templates.find((t) => t.id === spec.template)
  if (!template) return `  ${spec.id}  ${spec.template}  seed ${spec.seed}`
  const { music } = buildEvents(spec, template)
  return (
    `  ${spec.id}  ${spec.template.padEnd(16)} seed ${String(spec.seed).padEnd(11)} ` +
    `${String(music.bpm).padStart(3)} bpm  ${music.root.padEnd(3)} ${music.flavour.padEnd(11)}` +
    `${music.scale}  |  ${music.chord}`
  )
}

export async function rehearse(opts: RehearseOptions): Promise<Rehearsal> {
  if (!Number.isInteger(opts.count) || opts.count < 1) {
    throw new Error(`rehearse: count must be a positive integer, got ${String(opts.count)}`)
  }

  const log = opts.log ?? ((line: string) => console.log(line))
  const cataloguePath = opts.cataloguePath ?? CATALOGUE_PATH
  const audioDir = opts.audioDir ?? DEFAULT_OUT_DIR
  const catalogueSha256 = sha256File(cataloguePath)
  const { templates } = await templateList(opts.template, opts.modulePath)

  const dir = mkdtempSync(join(tmpdir(), 'grooves-rehearsal-'))
  const outDir = join(dir, 'audio')
  mkdirSync(outDir, { recursive: true })

  const existing = readCatalogue(cataloguePath)
  for (const spec of existing) stage(join(audioDir, `${spec.id}.mp3`), join(outDir, `${spec.id}.mp3`))
  copyFileSync(cataloguePath, join(dir, 'catalogue.json'))

  const startSeed = opts.startSeed ?? seedFromClock((opts.now ?? Date.now)())

  log(`rehearsing ${opts.count} ${opts.template} groove(s) — start seed ${startSeed}`)
  log(`  scratch tree: ${dir}`)

  const specs = await addGrooves(opts.count, {
    cataloguePath: join(dir, 'catalogue.json'),
    outDir,
    manifestPath: join(dir, 'grooves.generated.ts'),
    lockPath: join(dir, 'grooves.lock.json'),
    startSeed,
    templates,
    templateId: opts.template,
    ...(opts.pack === undefined ? {} : { pack: opts.pack }),
    ...(opts.packDir === undefined ? {} : { packDir: opts.packDir }),
    ...(opts.gate === undefined ? {} : { gate: opts.gate }),
    ...(opts.maxAttempts === undefined ? {} : { maxAttempts: opts.maxAttempts }),
    log,
  })

  const rehearsal: Rehearsal = {
    template: opts.template,
    startSeed,
    catalogueSha256,
    dir,
    grooves: specs.map((spec) => {
      const file = join(outDir, `${spec.id}.mp3`)
      return {
        id: spec.id,
        template: spec.template,
        seed: spec.seed,
        sha256: sha256File(file),
        bytes: statSync(file).size,
      }
    }),
  }

  writeFileSync(join(dir, 'rehearsal.json'), `${JSON.stringify(rehearsal, null, 2)}\n`, 'utf8')

  for (const spec of specs) log(describeRow(spec, templates))
  log(`  rehearsal.json: ${join(dir, 'rehearsal.json')}`)

  return rehearsal
}

export async function commit(
  rehearsal: Rehearsal,
  opts: CommitOptions = {},
): Promise<GrooveSpec[]> {
  const log = opts.log ?? ((line: string) => console.log(line))
  const cataloguePath = opts.cataloguePath ?? CATALOGUE_PATH
  const now = sha256File(cataloguePath)

  if (now !== rehearsal.catalogueSha256) {
    throw new Error(
      `commit: catalogueSha256 no longer matches — rehearsed against ${rehearsal.catalogueSha256}, ` +
        `${cataloguePath} is now ${now}. The catalogue moved since the rehearsal, so the ids and ` +
        'the answer-uniqueness checks have moved with it — re-run the rehearsal.',
    )
  }

  const { templates } = await templateList(rehearsal.template, opts.modulePath)

  const minted = await addGrooves(rehearsal.grooves.length, {
    cataloguePath,
    ...(opts.outDir === undefined ? {} : { outDir: opts.outDir }),
    ...(opts.manifestPath === undefined ? {} : { manifestPath: opts.manifestPath }),
    ...(opts.lockPath === undefined ? {} : { lockPath: opts.lockPath }),
    startSeed: rehearsal.startSeed,
    templates,
    templateId: rehearsal.template,
    ...(opts.pack === undefined ? {} : { pack: opts.pack }),
    ...(opts.packDir === undefined ? {} : { packDir: opts.packDir }),
    ...(opts.gate === undefined ? {} : { gate: opts.gate }),
    ...(opts.maxAttempts === undefined ? {} : { maxAttempts: opts.maxAttempts }),
    log,
  })

  const outDir = opts.outDir ?? DEFAULT_OUT_DIR

  for (const [i, want] of rehearsal.grooves.entries()) {
    const got = minted[i]
    if (got === undefined) {
      throw new Error(`commit: ${want.id} was rehearsed but the mint returned only ${minted.length} groove(s)`)
    }
    if (got.template !== want.template || got.seed !== want.seed || got.id !== want.id) {
      throw new Error(
        `commit: ${want.id} is not what was rehearsed — rehearsed ${want.id} ${want.template} ` +
          `seed ${want.seed}, minted ${got.id} ${got.template} seed ${got.seed}`,
      )
    }
    const sha = sha256File(join(outDir, `${got.id}.mp3`))
    if (sha !== want.sha256) {
      throw new Error(
        `commit: ${want.id}.mp3 does not match the audio that was rehearsed — rehearsed ` +
          `${want.sha256}, minted ${sha}. The six grooves in the catalogue would not be the six ` +
          'that were heard.',
      )
    }
  }

  for (const spec of minted) log(describeRow(spec, templates))
  return minted
}

export type RehearseArgs =
  | { mode: 'rehearse'; template: string; count: number; startSeed?: number }
  | { mode: 'commit'; rehearsalPath: string }

const USAGE =
  'usage: node scripts/grooves/rehearse.ts --template <id> [--count <n>] [--seed <n>]\n' +
  '       node scripts/grooves/rehearse.ts --commit <dir>/rehearsal.json'

const DEFAULT_COUNT = 6

export function parseArgs(argv: readonly string[]): RehearseArgs {
  const flags = new Map<string, string>()

  const valueFor = (flag: string, i: number): string => {
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value. ${USAGE}`)
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) throw new Error(`unknown argument: ${token}. ${USAGE}`)
    const eq = token.indexOf('=')
    if (eq > -1) {
      const flag = token.slice(0, eq)
      const value = token.slice(eq + 1)
      if (value === '') throw new Error(`${flag} needs a value. ${USAGE}`)
      flags.set(flag, value)
      continue
    }
    flags.set(token, valueFor(token, i))
    i++
  }

  for (const flag of flags.keys()) {
    if (!['--template', '--count', '--seed', '--commit'].includes(flag)) {
      throw new Error(`unknown option: ${flag}. ${USAGE}`)
    }
  }

  const rehearsalPath = flags.get('--commit')
  const template = flags.get('--template')

  if (rehearsalPath !== undefined) {
    if (template !== undefined || flags.has('--count') || flags.has('--seed')) {
      throw new Error(`--commit takes no other option. ${USAGE}`)
    }
    return { mode: 'commit', rehearsalPath }
  }

  if (template === undefined) throw new Error(`which feel? --template <id> is required. ${USAGE}`)

  const rawCount = flags.get('--count')
  const count = rawCount === undefined ? DEFAULT_COUNT : Number(rawCount)
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`--count "${String(rawCount)}" is not a positive integer. ${USAGE}`)
  }

  const rawSeed = flags.get('--seed')
  if (rawSeed === undefined) return { mode: 'rehearse', template, count }

  const startSeed = Number(rawSeed)
  if (!Number.isInteger(startSeed) || startSeed < 0) {
    throw new Error(`--seed "${rawSeed}" is not a non-negative integer. ${USAGE}`)
  }
  return { mode: 'rehearse', template, count, startSeed }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function main(argv: readonly string[] = []): Promise<number> {
  let args: RehearseArgs
  try {
    args = parseArgs(argv)
  } catch (error) {
    console.error(`grooves:rehearse — ${reason(error)}`)
    return 1
  }

  try {
    if (args.mode === 'commit') {
      const rehearsal = JSON.parse(readFileSync(args.rehearsalPath, 'utf8')) as Rehearsal
      const minted = await commit(rehearsal)
      console.log(`grooves:rehearse — committed ${minted.length} groove(s) exactly as rehearsed.`)
      console.log('  review them, then commit the audio, catalogue, manifest and lock together.')
      return 0
    }
    const rehearsal = await rehearse({
      template: args.template,
      count: args.count,
      ...(args.startSeed === undefined ? {} : { startSeed: args.startSeed }),
    })
    console.log(`grooves:rehearse — rehearsed ${rehearsal.grooves.length} groove(s), nothing in the repo was written.`)
    console.log(`  commit them with: node scripts/grooves/rehearse.ts --commit ${join(rehearsal.dir, 'rehearsal.json')}`)
    return 0
  } catch (error) {
    console.error(`grooves:rehearse — ${reason(error)}`)
    console.error('  nothing was written; the catalogue is unchanged.')
    return 1
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main(process.argv.slice(2))
}
