import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { CATALOGUE_PATH, readCatalogue } from './catalogue.ts'
import { DEFAULT_LOCK_PATH, DEFAULT_MANIFEST_PATH, DEFAULT_OUT_DIR, generate } from './cli.ts'
import {
  grooveFile,
  mergeLock,
  readLock,
  sha256File,
  verifyLock,
  writeLock,
  type Lock,
  type LockEntry,
  type LockPaths,
} from './lock.ts'
import { diffManifests, type FieldDiff } from './manifestDiff.ts'
import {
  classifyAudio,
  compareChanged,
  formatLoudness,
  loudnessTable,
  ridingIds,
  type LoudnessRow,
} from './rerenderReport.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec, Pcm } from './types.ts'

export type RenderReport = {
  renderedAt: string
  scratchDir: string
  grooves: LockEntry[]
  manifestSha256: string
  changed: string[]
  loudness: LoudnessRow[]
}

export const REPORT_NAME = 'report.json'

export type CheckOptions = {
  lockPath?: string
  manifestPath?: string
  cataloguePath?: string
  grooveDir?: string
  scratchDir?: string
  promoteFrom?: string
  render?: (target: {
    outDir: string
    manifestPath: string
    lockPath: string
  }) => Promise<{ pcm: Map<string, Pcm> }>
  log?: (line: string) => void
}

/**
 * What the exit code means. A person or a CI step reads this number and
 * nothing else, so each stop has its own.
 *
 *   0  clean — every stage passed, report.json written, promotion allowed.
 *      A headDelaySeconds-only manifest move is part of clean (R5); the log
 *      names which grooves moved.
 *   1  a harmonic or otherwise unexpected manifest difference. Stages 3, 4
 *      and 5 did not run and no report was written.
 *   2  a groove outside the −29…−20 dBFS window. Stages 4 and 5 did not run.
 *   3  the changed audio is not exactly the riding feels' grooves.
 *   4  promotion refused — no report, drift against it, or a tree that does
 *      not verify after the copy.
 *   5  the run could not start or could not be judged: a missing committed
 *      lock or manifest, or a render whose output cannot be parsed.
 */
export const EXIT_CLEAN = 0
export const EXIT_HARMONIC = 1
export const EXIT_LOUDNESS = 2
export const EXIT_AUDIO_SET = 3
export const EXIT_PROMOTE = 4
export const EXIT_PRECONDITION = 5

export const SCRATCH_GROOVE_DIR = 'grooves'
export const SCRATCH_MANIFEST_NAME = 'grooves.generated.ts'
export const SCRATCH_LOCK_NAME = 'grooves.lock.json'

const WINDOW = 'the −29…−20 dBFS window'

type Log = (line: string) => void

type Destination = {
  lockPath: string
  manifestPath: string
  cataloguePath: string
  grooveDir: string
}

function destination(options: CheckOptions): Destination {
  return {
    lockPath: options.lockPath ?? DEFAULT_LOCK_PATH,
    manifestPath: options.manifestPath ?? DEFAULT_MANIFEST_PATH,
    cataloguePath: options.cataloguePath ?? CATALOGUE_PATH,
    grooveDir: options.grooveDir ?? DEFAULT_OUT_DIR,
  }
}

/**
 * `CheckOptions` names four paths; `verifyLock` checks seven. The other three
 * sit at fixed offsets from the four in the real tree, so they are derived
 * rather than guessed, and a fixture tree that mirrors the offsets is checked
 * the same way the real one is.
 */
function lockPaths(to: Destination): LockPaths {
  return {
    grooveDir: to.grooveDir,
    cataloguePath: to.cataloguePath,
    manifestPath: to.manifestPath,
    notesDir: join(dirname(to.grooveDir), 'notes'),
    notesManifestPath: join(dirname(to.manifestPath), 'notes.generated.ts'),
    packDeclarationPath: join(dirname(to.lockPath), 'samples', 'pack.json'),
  }
}

function scratchPaths(scratchDir: string): {
  outDir: string
  manifestPath: string
  lockPath: string
} {
  return {
    outDir: join(scratchDir, SCRATCH_GROOVE_DIR),
    manifestPath: join(scratchDir, SCRATCH_MANIFEST_NAME),
    lockPath: join(scratchDir, SCRATCH_LOCK_NAME),
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function lockOrNull(path: string): Lock | null {
  try {
    return readLock(path)
  } catch {
    return null
  }
}

function fieldLine(kind: string, diff: FieldDiff): string {
  const before = diff.committed ?? '(absent)'
  const after = diff.rendered ?? '(absent)'
  return `  ${kind}  ${diff.id}  ${diff.field}: ${before} -> ${after}`
}

function templateNames(specs: readonly GrooveSpec[]): Map<string, string> {
  return new Map(specs.map((spec) => [spec.id, spec.template]))
}

/**
 * The first unchanged half-time groove, then the first unchanged groove from
 * any other non-riding feel (R12). Picked from the committed order, so the
 * same render always names the same two.
 */
function controls(
  unchanged: readonly string[],
  templates: ReadonlyMap<string, string>,
  riding: ReadonlySet<string>,
): string[] {
  const eligible = unchanged.filter((id) => !riding.has(id))
  const halfTime = eligible.find((id) => templates.get(id) === 'half-time')
  const other = eligible.find((id) => id !== halfTime && templates.get(id) !== 'half-time')
  return [halfTime, other].filter((id): id is string => id !== undefined)
}

async function check(options: CheckOptions, log: Log): Promise<number> {
  const to = destination(options)

  const committedLock = lockOrNull(to.lockPath)
  if (committedLock === null) {
    log(`rerender-check — no readable lock at ${to.lockPath}; there is nothing to compare against.`)
    return EXIT_PRECONDITION
  }

  const committedManifest = readText(to.manifestPath)
  if (committedManifest === null) {
    log(`rerender-check — no readable manifest at ${to.manifestPath}.`)
    return EXIT_PRECONDITION
  }

  const scratchDir = options.scratchDir ?? mkdtempSync(join(tmpdir(), 'groove-rerender-'))
  const scratch = scratchPaths(scratchDir)
  mkdirSync(scratch.outDir, { recursive: true })

  const render = options.render ?? ((target) => generate(target))
  log(`stage 1 render — rendering the catalogue into ${scratchDir}`)
  const { pcm } = await render(scratch)

  const renderedManifest = readText(scratch.manifestPath)
  if (renderedManifest === null) {
    log(`stage 2 harmony — the render wrote no manifest at ${scratch.manifestPath}.`)
    return EXIT_PRECONDITION
  }

  let diff
  try {
    diff = diffManifests(committedManifest, renderedManifest)
  } catch (error) {
    log(`stage 2 harmony — the manifests could not be compared: ${reason(error)}`)
    log('  a manifest this cannot parse is not a clean run; nothing below this ran.')
    return EXIT_PRECONDITION
  }

  const blocking = diff.harmonic.length + diff.unexpected.length
  if (blocking > 0) {
    log(
      `stage 2 harmony — ${diff.harmonic.length} harmonic and ${diff.unexpected.length} unexpected difference(s). Nothing below this ran and nothing was written.`,
    )
    for (const entry of diff.harmonic) log(fieldLine('harmonic  ', entry))
    for (const entry of diff.unexpected) log(fieldLine('unexpected', entry))
    return EXIT_HARMONIC
  }

  log(
    `stage 2 harmony — clean. ${diff.expected.length} expected headDelaySeconds move(s); every answer held still.`,
  )
  for (const entry of diff.expected) log(fieldLine('expected  ', entry))

  const loudness = loudnessTable(pcm)
  const outside = loudness.filter((row) => !row.inWindow)
  if (outside.length > 0) {
    log(
      `stage 3 loudness — ${outside.length} of ${loudness.length} groove(s) outside ${WINDOW}. Correct the level, do not widen the band.`,
    )
    for (const line of formatLoudness(loudness)) log(line)
    return EXIT_LOUDNESS
  }
  log(`stage 3 loudness — all ${loudness.length} grooves inside ${WINDOW}.`)

  const renderedLock = lockOrNull(scratch.lockPath)
  if (renderedLock === null) {
    log(`stage 4 audio — the render wrote no readable lock at ${scratch.lockPath}.`)
    return EXIT_PRECONDITION
  }

  let specs: GrooveSpec[]
  try {
    specs = readCatalogue(to.cataloguePath)
  } catch (error) {
    log(`stage 4 audio — the catalogue could not be read: ${reason(error)}`)
    return EXIT_PRECONDITION
  }

  const expected = ridingIds(specs, templateById)
  const audio = classifyAudio(committedLock, renderedLock)
  const mismatch = compareChanged(audio, expected)
  const problems =
    mismatch.missed.length + mismatch.surprising.length + audio.missing.length + audio.extra.length

  if (problems > 0) {
    log(
      `stage 4 audio — ${audio.changed.length} groove(s) changed, ${expected.length} expected to. The two sets are not the same.`,
    )
    for (const id of mismatch.surprising) {
      log(`  changed, and was not expected to: ${id}`)
    }
    for (const id of mismatch.missed) log(`  was expected to change and did not: ${id}`)
    for (const id of audio.missing) log(`  in the committed lock, not in the render: ${id}`)
    for (const id of audio.extra) log(`  in the render, not in the committed lock: ${id}`)
    return EXIT_AUDIO_SET
  }

  log(
    `stage 4 audio — ${audio.changed.length} changed, ${audio.unchanged.length} unchanged; exactly the riding feels' grooves.`,
  )

  const templates = templateNames(specs)
  const describe = (id: string): string =>
    `${id}  ${templates.get(id) ?? '(no catalogue entry)'}  ${grooveFile(scratch.outDir, id)}`

  log(`stage 5 listening — play all ${audio.changed.length} changed groove(s), one at a time:`)
  for (const id of audio.changed) log(`  ${describe(id)}`)

  const picked = controls(audio.unchanged, templates, new Set(expected))
  log(`stage 5 listening — ${picked.length} unchanged control(s), which must be indistinguishable:`)
  for (const id of picked) log(`  control  ${describe(id)}`)

  const report: RenderReport = {
    renderedAt: new Date().toISOString(),
    scratchDir,
    grooves: renderedLock.grooves,
    manifestSha256: renderedLock.manifestSha256,
    changed: audio.changed,
    loudness,
  }
  const reportPath = join(scratchDir, REPORT_NAME)
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  log(`rerender-check — clean. Report: ${reportPath}`)
  log(`  promote with: node scripts/grooves/rerender-check.ts --promote ${scratchDir}`)
  return EXIT_CLEAN
}

function readReport(path: string): RenderReport | null {
  const text = readText(path)
  if (text === null) return null
  try {
    const parsed = JSON.parse(text) as RenderReport
    return Array.isArray(parsed.grooves) ? parsed : null
  } catch {
    return null
  }
}

function drifted(report: RenderReport, scratch: ReturnType<typeof scratchPaths>): string[] {
  const problems: string[] = []

  for (const entry of report.grooves) {
    const file = grooveFile(scratch.outDir, entry.id)
    if (!existsSync(file)) {
      problems.push(`${entry.id}: the report names ${file}, which is not there`)
      continue
    }
    const sha256 = sha256File(file)
    if (sha256 !== entry.sha256) {
      problems.push(
        `${entry.id}: ${file} hashes ${sha256.slice(0, 12)}, the report recorded ${entry.sha256.slice(0, 12)}`,
      )
    }
  }

  if (!existsSync(scratch.manifestPath)) {
    problems.push(`the report's ${SCRATCH_MANIFEST_NAME} is not there: ${scratch.manifestPath}`)
  } else if (sha256File(scratch.manifestPath) !== report.manifestSha256) {
    problems.push(
      `${SCRATCH_MANIFEST_NAME} has moved since the report was written: ${scratch.manifestPath}`,
    )
  }

  return problems
}

function promote(from: string, options: CheckOptions, log: Log): number {
  const to = destination(options)
  const scratch = scratchPaths(from)
  const reportPath = join(from, REPORT_NAME)

  const report = readReport(reportPath)
  if (report === null) {
    log(
      `--promote — ${from} holds no readable ${REPORT_NAME}: this render was never checked, so there is nothing signed off to promote.`,
    )
    return EXIT_PROMOTE
  }

  const problems = drifted(report, scratch)
  if (problems.length > 0) {
    log(
      `--promote — refusing: ${problems.length} file(s) moved since ${REPORT_NAME} was written. What was listened to is not what is on disk.`,
    )
    for (const problem of problems) log(`  ${problem}`)
    return EXIT_PROMOTE
  }

  const scratchLock = lockOrNull(scratch.lockPath)
  if (scratchLock === null) {
    log(`--promote — refusing: no readable lock at ${scratch.lockPath}.`)
    return EXIT_PROMOTE
  }

  mkdirSync(to.grooveDir, { recursive: true })
  for (const entry of report.grooves) {
    copyFileSync(grooveFile(scratch.outDir, entry.id), grooveFile(to.grooveDir, entry.id))
  }
  mkdirSync(dirname(to.manifestPath), { recursive: true })
  copyFileSync(scratch.manifestPath, to.manifestPath)
  writeLock(mergeLock(lockOrNull(to.lockPath), scratchLock), to.lockPath)

  const promoted = lockOrNull(to.lockPath)
  if (promoted === null) {
    log(`--promote — the lock at ${to.lockPath} could not be read back after it was written.`)
    return EXIT_PROMOTE
  }

  const failures = verifyLock(promoted, lockPaths(to))
  if (failures.length > 0) {
    log(`--promote — the promoted tree does not verify: ${failures.length} problem(s).`)
    for (const failure of failures) log(`  [${failure.check}] ${failure.detail}`)
    return EXIT_PROMOTE
  }

  log(
    `--promote — ${report.grooves.length} groove(s), the manifest and the lock are in the tree, and it verifies.`,
  )
  return EXIT_CLEAN
}

export async function main(options: CheckOptions = {}): Promise<number> {
  const log = options.log ?? ((line: string) => console.log(line))
  if (options.promoteFrom !== undefined) return promote(options.promoteFrom, options, log)
  return check(options, log)
}

export function optionsFromArgv(argv: readonly string[]): CheckOptions {
  const options: CheckOptions = {}

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const value = argv[i + 1]
    if (token !== '--promote' && token !== '--scratch') {
      throw new Error(`unknown argument: ${token}`)
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${token} needs a value`)
    }
    if (token === '--promote') options.promoteFrom = value
    else options.scratchDir = value
    i += 1
  }

  return options
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  try {
    process.exitCode = await main(optionsFromArgv(process.argv.slice(2)))
  } catch (error) {
    console.error(reason(error))
    process.exitCode = EXIT_PRECONDITION
  }
}
