import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { main } from './add-cli.ts'
import { readCatalogue, writeCatalogue } from './catalogue.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { GateFailure, GrooveSpec } from './types.ts'

const ROOT = join(process.cwd(), 'scripts', 'grooves')
const REAL_LOCK = join(ROOT, 'grooves.lock.json')
const REAL_CATALOGUE = join(ROOT, 'catalogue.json')
/**
 * A committed mp3, copied in as the stand-in for audio an earlier run minted.
 * A mint measures the head delay of every file it describes, so the fixture's
 * already-minted audio has to be audio.
 */
const REAL_MP3 = join(process.cwd(), 'public', 'grooves', 'groove-01.mp3')
const COMMITTED = {
  lock: readFileSync(REAL_LOCK, 'utf8'),
  catalogue: readFileSync(REAL_CATALOGUE, 'utf8'),
  audio: audioFingerprint(join(process.cwd(), 'public', 'grooves')),
}

/** Every file in the committed audio directory, by name and size. */
function audioFingerprint(dir: string): string {
  return readdirSync(dir)
    .sort()
    .map((name) => `${name}:${statSync(join(dir, name)).size}`)
    .join(',')
}

const SPECS: GrooveSpec[] = [
  { id: 'groove-01', uuid: 'c0105415-48cb-43cb-a54d-996fcdb40d94', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', uuid: '34d62aba-a264-469c-836b-be57fcc69c0b', template: 'straight-funk', seed: 2 },
]

const PASS = () => null
const REJECT_ALL = (): GateFailure => ({ check: 'density', detail: '0.5 events per bar' })

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-add-cli-'))
  const outDir = join(dir, 'audio')
  mkdirSync(outDir, { recursive: true })
  const cataloguePath = join(dir, 'catalogue.json')
  writeCatalogue(SPECS, cataloguePath)
  for (const spec of SPECS) copyFileSync(REAL_MP3, join(outDir, `${spec.id}.mp3`))
  return {
    outDir,
    cataloguePath,
    manifestPath: join(dir, 'grooves.generated.ts'),
    lockPath: join(dir, 'grooves.lock.json'),
    pack: placeholderPack(),
  }
}

/**
 * A render is not a unit of work you can do in five seconds any more.
 *
 * Every candidate now carries per-pass humanization, a tempo drift, note-offs, a
 * hi-hat choke, a Schroeder reverb and a fill, over a catalogue four times the
 * length it was — and these tests shell out to the real CLI. Vitest's 5 s
 * default was written against a much lighter pipeline; under parallel load these
 * time out and read as flaky when nothing is flaky but the clock.
 */
const RENDER_TIMEOUT_MS = 60_000

describe('grooves:add CLI', () => {
  it('mints the requested count and reports what it added', async () => {
    const f = fixture()
    const log: string[] = []

    const code = await main(['2'], { startSeed: 7000, gate: PASS, log: (l) => log.push(l), ...f })

    expect(code).toBe(0)
    const catalogue = readCatalogue(f.cataloguePath)
    expect(catalogue).toHaveLength(4)
    for (const spec of catalogue.slice(2)) {
      expect(log.join('\n')).toContain(spec.id)
    }
  }, RENDER_TIMEOUT_MS)

  it('refuses a missing or non-numeric count without touching the catalogue', async () => {
    const f = fixture()
    const before = readFileSync(f.cataloguePath, 'utf8')
    const log: string[] = []

    expect(await main([], { ...f, log: (l) => log.push(l) })).toBe(1)
    expect(await main(['banana'], { ...f, log: (l) => log.push(l) })).toBe(1)
    expect(await main(['0'], { ...f, log: (l) => log.push(l) })).toBe(1)
    expect(await main(['2.5'], { ...f, log: (l) => log.push(l) })).toBe(1)

    expect(log.join('\n')).toContain('npm run grooves:add <n>')
    expect(readFileSync(f.cataloguePath, 'utf8')).toBe(before)
  })

  it('exits non-zero and changes nothing when the gate rejects everything', async () => {
    const f = fixture()
    const before = readFileSync(f.cataloguePath, 'utf8')
    const log: string[] = []

    const code = await main(['1'], {
      startSeed: 8000,
      maxAttempts: 3,
      gate: REJECT_ALL,
      log: (l) => log.push(l),
      ...f,
    })

    expect(code).toBe(1)
    expect(log.join('\n')).toContain('3 attempts')
    expect(log.join('\n')).toContain('density')
    expect(readFileSync(f.cataloguePath, 'utf8')).toBe(before)
    expect(readdirSync(f.outDir).sort()).toEqual(['groove-01.mp3', 'groove-02.mp3'])
  })

  it('left every committed artifact untouched', () => {
    expect(readFileSync(REAL_LOCK, 'utf8'), 'a test rewrote the committed lock').toBe(COMMITTED.lock)
    expect(readFileSync(REAL_CATALOGUE, 'utf8'), 'a test rewrote the catalogue').toBe(
      COMMITTED.catalogue,
    )
    expect(
      audioFingerprint(join(process.cwd(), 'public', 'grooves')),
      'a test wrote into public/grooves',
    ).toBe(COMMITTED.audio)
  })
})
