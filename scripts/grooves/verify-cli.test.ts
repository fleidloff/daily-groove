import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLock, writeLock } from './lock.ts'
import { main } from './verify-cli.ts'

function audioBytes(id: string, n = 2048): Buffer {
  const buf = Buffer.alloc(n)
  for (let i = 0; i < n; i += 1) buf[i] = (i * 17 + id.charCodeAt(id.length - 1)) % 253
  return buf
}

type Fixture = {
  grooveDir: string
  cataloguePath: string
  manifestPath: string
  lockPath: string
}

/** An intact tree plus a lock that describes it. */
function fixture(ids: string[] = ['groove-01', 'groove-02']): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-verify-'))
  const grooveDir = join(dir, 'public', 'grooves')
  mkdirSync(grooveDir, { recursive: true })
  for (const id of ids) writeFileSync(join(grooveDir, `${id}.mp3`), audioBytes(id))

  const cataloguePath = join(dir, 'catalogue.json')
  writeFileSync(
    cataloguePath,
    `${JSON.stringify(ids.map((id, i) => ({ id, template: 'straight-funk', seed: i + 1 })), null, 2)}\n`,
  )

  const manifestPath = join(dir, 'grooves.generated.ts')
  writeFileSync(manifestPath, `export const GROOVES = [\n${ids.map((id) => `  { id: '${id}' },`).join('\n')}\n]\n`)

  const lockPath = join(dir, 'grooves.lock.json')
  writeLock(buildLock({ grooveDir, cataloguePath, manifestPath }, ids), lockPath)

  return { grooveDir, cataloguePath, manifestPath, lockPath }
}

function run(f: Fixture) {
  const lines: string[] = []
  return {
    lines,
    code: main({ ...f, log: (line: string) => lines.push(line) }),
  }
}

describe('verify-cli main — Step B4', () => {
  it('exits zero on an intact tree (AC11)', async () => {
    const r = run(fixture())
    await expect(r.code).resolves.toBe(0)
  })

  it('exits non-zero and names the groove whose file is missing (AC8)', async () => {
    const f = fixture()
    rmSync(join(f.grooveDir, 'groove-02.mp3'))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-02')
    expect(output).toContain('missing')
  })

  it('exits non-zero and names the groove whose file is empty (AC9)', async () => {
    const f = fixture()
    writeFileSync(join(f.grooveDir, 'groove-01.mp3'), Buffer.alloc(0))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-01')
    expect(output).toContain('empty')
  })

  it('exits non-zero and names the groove whose checksum moved (AC10)', async () => {
    const f = fixture()
    const file = join(f.grooveDir, 'groove-02.mp3')
    const bytes = readFileSync(file)
    bytes[3] = bytes[3] ^ 0xff
    writeFileSync(file, bytes)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-02')
    expect(output).toContain('checksum')
  })

  it('exits non-zero naming the manifest when it is stale (AC8)', async () => {
    const f = fixture()
    writeFileSync(f.manifestPath, `${readFileSync(f.manifestPath, 'utf8')}// edited\n`)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('grooves.generated.ts')
    expect(output).toContain('npm run grooves')
  })

  it('exits non-zero naming the catalogue when it is stale (AC8)', async () => {
    const f = fixture()
    writeFileSync(f.cataloguePath, `${readFileSync(f.cataloguePath, 'utf8')}\n`)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('catalogue.json')
    expect(output).toContain('npm run grooves')
  })

  it('exits non-zero when the lock file itself is missing', async () => {
    const f = fixture()
    rmSync(f.lockPath)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    expect(r.lines.join('\n')).toContain('grooves.lock.json')
  })

  it('reports every failure, not only the first', async () => {
    const f = fixture(['groove-01', 'groove-02', 'groove-03'])
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    writeFileSync(join(f.grooveDir, 'groove-03.mp3'), Buffer.alloc(0))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-01')
    expect(output).toContain('groove-03')
  })

  it('importing the module runs nothing — the top-level call is guarded', async () => {
    // Reaching this line at all proves it: the import above did not exit the
    // process, and no verification ran against the real tree.
    const source = readFileSync(join(import.meta.dirname, 'verify-cli.ts'), 'utf8')
    expect(source).toMatch(/process\.argv\[1\]/)
    expect(typeof main).toBe('function')
  })
})
