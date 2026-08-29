import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLock, readLock, sha256File, verifyLock, writeLock, type Lock } from './lock.ts'

/** Bytes that stand in for an mp3 — the lock never looks inside one. */
function audioBytes(id: string, n = 2048): Buffer {
  const buf = Buffer.alloc(n)
  for (let i = 0; i < n; i += 1) buf[i] = (i * 31 + id.charCodeAt(id.length - 1)) % 251
  return buf
}

type Fixture = {
  dir: string
  grooveDir: string
  cataloguePath: string
  manifestPath: string
  lockPath: string
  lock: Lock
  paths: { grooveDir: string; cataloguePath: string; manifestPath: string }
}

/** A temp tree where audio, manifest and catalogue all match the lock. */
function fixture(ids: string[] = ['groove-01', 'groove-02']): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-lock-'))
  const grooveDir = join(dir, 'public', 'grooves')
  mkdirSync(grooveDir, { recursive: true })
  for (const id of ids) writeFileSync(join(grooveDir, `${id}.mp3`), audioBytes(id))

  const cataloguePath = join(dir, 'catalogue.json')
  writeFileSync(
    cataloguePath,
    `${JSON.stringify(
      ids.map((id, i) => ({ id, template: 'straight-funk', seed: i + 1 })),
      null,
      2,
    )}\n`,
  )

  const manifestPath = join(dir, 'grooves.generated.ts')
  writeFileSync(
    manifestPath,
    `export const GROOVES = [\n${ids.map((id) => `  { id: '${id}', bpm: 96 },`).join('\n')}\n]\n`,
  )

  const paths = { grooveDir, cataloguePath, manifestPath }
  return { dir, grooveDir, cataloguePath, manifestPath, lockPath: join(dir, 'grooves.lock.json'), lock: buildLock(paths, ids), paths }
}

describe('readLock / writeLock — Step B1', () => {
  it('round-trips a lock, including both top-level hashes', () => {
    const { lockPath } = fixture()
    const lock: Lock = {
      catalogueSha256: 'a'.repeat(64),
      manifestSha256: 'b'.repeat(64),
      grooves: [
        { id: 'groove-01', sha256: 'c'.repeat(64), bytes: 10 },
        { id: 'groove-02', sha256: 'd'.repeat(64), bytes: 20 },
      ],
    }

    writeLock(lock, lockPath)

    expect(readLock(lockPath)).toEqual(lock)
  })

  it('returns null for a missing file', () => {
    const { dir } = fixture()
    expect(readLock(join(dir, 'nope.lock.json'))).toBe(null)
  })

  it('sorts grooves by id so diffs stay stable', () => {
    const { lockPath } = fixture()
    writeLock(
      {
        catalogueSha256: 'a'.repeat(64),
        manifestSha256: 'b'.repeat(64),
        grooves: [
          { id: 'groove-09', sha256: 'c'.repeat(64), bytes: 1 },
          { id: 'groove-02', sha256: 'd'.repeat(64), bytes: 2 },
          { id: 'groove-05', sha256: 'e'.repeat(64), bytes: 3 },
        ],
      },
      lockPath,
    )

    expect(readLock(lockPath)!.grooves.map((g) => g.id)).toEqual([
      'groove-02',
      'groove-05',
      'groove-09',
    ])
    // ...and on disk, not merely in memory.
    expect(readFileSync(lockPath, 'utf8').indexOf('groove-02')).toBeLessThan(
      readFileSync(lockPath, 'utf8').indexOf('groove-09'),
    )
  })

  it('records the real sha256 and byte count of each artifact', () => {
    const f = fixture(['groove-01'])
    const file = join(f.grooveDir, 'groove-01.mp3')
    const expected = createHash('sha256').update(readFileSync(file)).digest('hex')

    expect(f.lock.grooves[0]).toEqual({ id: 'groove-01', sha256: expected, bytes: 2048 })
    expect(f.lock.catalogueSha256).toBe(sha256File(f.cataloguePath))
    expect(f.lock.manifestSha256).toBe(sha256File(f.manifestPath))
  })
})

describe('verifyLock — Step B2', () => {
  it('returns no failures when everything matches', () => {
    const f = fixture()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })

  it('fails, naming the groove, when its file is missing (AC8)', () => {
    const f = fixture()
    rmSync(join(f.grooveDir, 'groove-02.mp3'))

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('missing')
    expect(failures[0].detail).toContain('groove-02')
  })

  it('fails, naming the groove, when its file is zero bytes (AC9)', () => {
    const f = fixture()
    writeFileSync(join(f.grooveDir, 'groove-01.mp3'), Buffer.alloc(0))

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('empty')
    expect(failures[0].detail).toContain('groove-01')
  })

  it('fails, naming the groove, when a single byte is altered (AC10)', () => {
    const f = fixture()
    const file = join(f.grooveDir, 'groove-02.mp3')
    const bytes = readFileSync(file)
    bytes[100] = bytes[100] ^ 0xff
    writeFileSync(file, bytes)

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('checksum')
    expect(failures[0].detail).toContain('groove-02')
    // The size is unchanged, so only the hash can have caught this.
    expect(readFileSync(file).length).toBe(f.lock.grooves[1].bytes)
  })

  it('reports every broken groove, not just the first', () => {
    const f = fixture(['groove-01', 'groove-02', 'groove-03'])
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    writeFileSync(join(f.grooveDir, 'groove-03.mp3'), Buffer.alloc(0))

    const failures = verifyLock(f.lock, f.paths)
    expect(failures.map((x) => x.check).sort()).toEqual(['empty', 'missing'])
    expect(failures.map((x) => x.detail).join(' ')).toContain('groove-01')
    expect(failures.map((x) => x.detail).join(' ')).toContain('groove-03')
  })

  it('names the file in every detail', () => {
    const f = fixture()
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    for (const failure of verifyLock(f.lock, f.paths)) {
      expect(failure.check.length).toBeGreaterThan(0)
      expect(failure.detail).toContain('.mp3')
    }
  })
})

describe('verifyLock — Step B2b, stale inputs and outputs', () => {
  it('passes when audio, manifest and catalogue all match their hashes', () => {
    const f = fixture()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })

  it('fails when the catalogue was appended to without regenerating', () => {
    const f = fixture()
    appendFileSync(f.cataloguePath, '\n// hand-added entry\n')

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('catalogue-stale')
    expect(failures[0].detail).toContain('catalogue.json')
    expect(failures[0].detail).toContain('npm run grooves')
  })

  it('fails when the generated manifest was edited by hand', () => {
    const f = fixture()
    writeFileSync(
      f.manifestPath,
      readFileSync(f.manifestPath, 'utf8').replace('bpm: 96', 'bpm: 120'),
    )

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('manifest-stale')
    expect(failures[0].detail).toContain('grooves.generated.ts')
    expect(failures[0].detail).toContain('npm run grooves')
  })

  it('reports a missing catalogue or manifest rather than throwing', () => {
    const f = fixture()
    rmSync(f.cataloguePath)
    rmSync(f.manifestPath)

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(2)
    expect(failures.every((x) => x.check === 'missing')).toBe(true)
    expect(failures.map((x) => x.detail).join(' ')).toContain('catalogue.json')
    expect(failures.map((x) => x.detail).join(' ')).toContain('grooves.generated.ts')
  })

  it('uses a distinct check name for each way of being broken', () => {
    const f = fixture(['groove-01', 'groove-02', 'groove-03'])
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    writeFileSync(join(f.grooveDir, 'groove-02.mp3'), Buffer.alloc(0))
    const file = join(f.grooveDir, 'groove-03.mp3')
    const bytes = readFileSync(file)
    bytes[7] = bytes[7] ^ 0xff
    writeFileSync(file, bytes)
    appendFileSync(f.cataloguePath, '\n\n')
    writeFileSync(f.manifestPath, `${readFileSync(f.manifestPath, 'utf8')}\n`)

    const checks = verifyLock(f.lock, f.paths).map((x) => x.check)
    expect(new Set(checks)).toEqual(
      new Set(['missing', 'empty', 'checksum', 'catalogue-stale', 'manifest-stale']),
    )
  })
})

describe('Step B3 — the guard needs no audio toolchain (R13, AC11)', () => {
  const AUDIO_MODULES = [
    'voices',
    'mix',
    'encode',
    'pack',
    'decode',
    'pcmio',
    'events',
    'cli',
    'wav',
    'templates',
    'theory',
  ]
  const ALLOWED = new Set(['node:fs', 'node:crypto', 'node:path', './types.ts', './lock.ts'])

  function importsOf(file: string): string[] {
    const source = readFileSync(join(import.meta.dirname, file), 'utf8')
    const found: string[] = []
    for (const m of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) found.push(m[1])
    for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1])
    for (const m of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1])
    return found
  }

  for (const file of ['lock.ts', 'verify-cli.ts']) {
    it(`${file} imports only fs, crypto, path and the lock itself`, () => {
      const specifiers = importsOf(file)
      expect(specifiers.length).toBeGreaterThan(0)
      for (const specifier of specifiers) {
        expect(ALLOWED.has(specifier), `${file} imports ${specifier}`).toBe(true)
      }
    })

    it(`${file} reaches for no audio module`, () => {
      for (const specifier of importsOf(file)) {
        const base = specifier.replace(/^.*\//, '').replace(/\.ts$/, '')
        expect(AUDIO_MODULES.includes(base), `${file} imports ${specifier}`).toBe(false)
      }
    })
  }

  it('verifies a whole fixture without any audio module being loadable', () => {
    // The proof that matters: nothing in the verify path decodes or renders.
    const f = fixture()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })
})
