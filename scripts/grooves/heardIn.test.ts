import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { heardInFailures, readHeardIn } from './heardIn.ts'
import { templateById } from './templates/index.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempTable(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'heard-in-'))
  dirs.push(dir)
  const path = join(dir, 'heard-in.json')
  writeFileSync(path, contents)
  return path
}

const SCALES = ['C mixolydian', 'E♭ dorian']

describe('readHeardIn', () => {
  it('reads a scale-keyed table of track and artist', () => {
    const path = tempTable(
      '{"C mixolydian":{"track":"Sweet Home Alabama","artist":"Lynyrd Skynyrd"}}',
    )
    expect(readHeardIn(path)).toEqual({
      'C mixolydian': { track: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd' },
    })
  })

  it('reads an empty table as no entries', () => {
    expect(readHeardIn(tempTable('{}'))).toEqual({})
  })
})

describe('heardInFailures', () => {
  it('passes a table whose every key is a rendered scale', () => {
    const table = { 'C mixolydian': { track: 'A', artist: 'B' } }
    expect(heardInFailures(table, SCALES)).toEqual([])
  })

  it('passes an empty table', () => {
    expect(heardInFailures({}, SCALES)).toEqual([])
  })

  it('names a key no groove renders', () => {
    const table = { 'C♯ locrian': { track: 'A', artist: 'B' } }
    expect(heardInFailures(table, SCALES)).toEqual([
      'C♯ locrian: no groove renders this scale',
    ])
  })

  it('names an empty track or artist', () => {
    const table = {
      'C mixolydian': { track: ' ', artist: 'B' },
      'E♭ dorian': { track: 'A', artist: '' },
    }
    expect(heardInFailures(table, SCALES)).toEqual([
      'C mixolydian: empty track',
      'E♭ dorian: empty artist',
    ])
  })

  it('reports every failure, not just the first', () => {
    const table = { X: { track: '', artist: '' } }
    expect(heardInFailures(table, SCALES)).toHaveLength(3)
  })
})

describe('the committed table', () => {
  it('names only scales the catalogue renders, each with a track and an artist', () => {
    const scales = readCatalogue().map(
      (spec) => buildEvents(spec, templateById(spec.template)).music.scale,
    )
    expect(heardInFailures(readHeardIn(), scales)).toEqual([])
  })
})
