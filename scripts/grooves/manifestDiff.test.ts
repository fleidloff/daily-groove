import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Groove, HeardIn } from '../../src/lib/groove.ts'
import { renderManifest } from './manifest.ts'
import type { Pools } from './pools.ts'
import {
  HARMONIC_FIELDS,
  MAY_MOVE,
  diffManifests,
  readManifestEntries,
} from './manifestDiff.ts'

const COMMITTED_MANIFEST = fileURLToPath(
  new URL('../../src/features/daily-groove/data/grooves.generated.ts', import.meta.url),
)

const ENTRY: Groove = {
  id: 'groove-01',
  uuid: '4c048e58-88a1-4425-b01b-e74cefc324d1',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Velvet Pocket',
  bpm: 105,
  scale: 'C mixolydian',
  chord: 'C7',
  progression: 'C7–Em7♭5–B♭maj7–Fmaj7',
  progressionDegrees: [0, 2, 6, 3],
  root: 'C',
  flavour: 'Mixolydian',
  bars: 4,
  loopBars: 16,
  headDelaySeconds: 0.025057,
}

const SECOND: Groove = {
  id: 'groove-02',
  uuid: '1461b138-472c-4bf1-91ca-b40e7c888d7f',
  audioSrc: '/grooves/groove-02.mp3',
  name: 'Dusty Lantern',
  bpm: 96,
  scale: 'E♭ dorian',
  chord: 'E♭m7',
  progression: 'E♭m7–A♭7–E♭m7',
  progressionDegrees: [0, 3, 0],
  root: 'E♭',
  flavour: 'Dorian',
  bars: 4,
  loopBars: 8,
  headDelaySeconds: 0.03,
}

const POOLS: Pools = {
  scales: ['C mixolydian', 'E♭ dorian'],
  chords: ['C7', 'E♭m7'],
  progressions: ['C7–Em7♭5–B♭maj7–Fmaj7', 'E♭m7–A♭7–E♭m7'],
}

const HEARD_IN: Record<string, HeardIn> = {
  'C mixolydian': { track: 'Tomorrow Never Knows', artist: 'The Beatles' },
  'E♭ dorian': { track: 'So What', artist: 'Miles Davis' },
}

function manifest(entries: readonly Groove[], pools: Pools = POOLS): string {
  return renderManifest(entries, pools, HEARD_IN)
}

function changed(entry: Groove, patch: Partial<Groove>): Groove {
  return { ...entry, ...patch }
}

function without(entry: Groove, field: keyof Groove): Groove {
  const copy = { ...entry }
  delete copy[field]
  return copy
}

describe('readManifestEntries', () => {
  it('reads every entry back out of a rendered manifest, literal by literal', () => {
    const entries = readManifestEntries(manifest([ENTRY, SECOND]))

    expect(entries.map((entry) => entry.id)).toEqual(['groove-01', 'groove-02'])
    expect(entries[0].fields).toEqual({
      id: "'groove-01'",
      uuid: "'4c048e58-88a1-4425-b01b-e74cefc324d1'",
      audioSrc: "'/grooves/groove-01.mp3'",
      name: "'Velvet Pocket'",
      bpm: '105',
      scale: "'C mixolydian'",
      chord: "'C7'",
      progression: "'C7–Em7♭5–B♭maj7–Fmaj7'",
      progressionDegrees: '[0, 2, 6, 3]',
      root: "'C'",
      flavour: "'Mixolydian'",
      bars: '4',
      loopBars: '16',
      headDelaySeconds: '0.025057',
    })
    expect(entries[1].fields.loopBars).toBe('8')
    expect(entries[1].fields.headDelaySeconds).toBe('0.03')
  })

  it('omits a field the entry does not carry', () => {
    const entries = readManifestEntries(manifest([without(ENTRY, 'progressionDegrees')]))

    expect(entries[0].fields.progressionDegrees).toBeUndefined()
    expect(entries[0].fields.scale).toBe("'C mixolydian'")
  })

  it('keeps a quote that is part of a string literal', () => {
    const quoted = changed(ENTRY, { name: "Rusty's Pocket" })
    const entries = readManifestEntries(manifest([quoted]))

    expect(entries[0].fields.name).toBe("'Rusty\\'s Pocket'")
  })

  it('reads an empty GROOVES array as no entries', () => {
    expect(readManifestEntries(manifest([]))).toEqual([])
  })

  it('throws naming the block when an entry has no id', () => {
    const broken = manifest([ENTRY]).replace("    id: 'groove-01',\n", '')

    expect(() => readManifestEntries(broken)).toThrow(/id/)
  })

  it('throws rather than parsing a source with no GROOVES array', () => {
    expect(() => readManifestEntries('export const NOTHING = 1\n')).toThrow(/GROOVES/)
  })

  it('reads the committed manifest as it actually is on disk', () => {
    const entries = readManifestEntries(readFileSync(COMMITTED_MANIFEST, 'utf8'))

    const scanned = [...readFileSync(COMMITTED_MANIFEST, 'utf8').matchAll(/^ {4}id: '([^']+)',$/gm)]

    expect(scanned.length, 'the committed manifest scanned as empty').toBeGreaterThan(0)
    expect(entries.map((entry) => entry.id)).toEqual(scanned.map((match) => match[1]))
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length)
    expect(entries[0].fields).toMatchObject({
      id: "'groove-01'",
      scale: "'C mixolydian'",
      chord: "'C7'",
      progressionDegrees: '[0, 2, 6, 3]',
      bpm: '105',
      root: "'C'",
    })
    for (const entry of entries) {
      expect(Object.keys(entry.fields)).toContain('uuid')
      expect(Object.keys(entry.fields)).toContain('headDelaySeconds')
      expect(entry.fields.audioSrc).toBe(`'/grooves/${entry.id}.mp3'`)
    }
  })
})

describe('diffManifests', () => {
  it('reports nothing for an identical manifest', () => {
    const source = manifest([ENTRY, SECOND])

    expect(diffManifests(source, source)).toEqual({
      harmonic: [],
      unexpected: [],
      expected: [],
    })
  })

  it('reports nothing for the committed manifest against itself', () => {
    const source = readFileSync(COMMITTED_MANIFEST, 'utf8')

    expect(diffManifests(source, source)).toEqual({
      harmonic: [],
      unexpected: [],
      expected: [],
    })
  })

  it('finds a moved chord in the committed manifest, tail and head untouched', () => {
    const source = readFileSync(COMMITTED_MANIFEST, 'utf8')
    const diff = diffManifests(source, source.replace("chord: 'C7',", "chord: 'C9',"))

    expect(diff.harmonic).toEqual([
      { id: 'groove-01', field: 'chord', committed: "'C7'", rendered: "'C9'" },
    ])
    expect(diff.unexpected).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('finds a moved head delay in the committed manifest as expected', () => {
    const source = readFileSync(COMMITTED_MANIFEST, 'utf8')
    const diff = diffManifests(
      source,
      source.replace('headDelaySeconds: 0.025057,', 'headDelaySeconds: 0.026,'),
    )

    expect(diff.expected).toEqual([
      {
        id: 'groove-01',
        field: 'headDelaySeconds',
        committed: '0.025057',
        rendered: '0.026',
      },
    ])
    expect(diff.harmonic).toEqual([])
    expect(diff.unexpected).toEqual([])
  })

  it('reports a changed pool value in the committed manifest as a tail diff', () => {
    const source = readFileSync(COMMITTED_MANIFEST, 'utf8')
    const diff = diffManifests(source, source.replace("  'Dm7–G7–Cmaj7',", "  'Dm7–G7–Cmaj9',"))

    expect(diff.unexpected.map((entry) => entry.id)).toEqual(['(manifest tail)'])
    expect(diff.harmonic).toEqual([])
  })

  it('reports a moved chord as harmonic and nothing else', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, { chord: 'E♭m9' })]),
    )

    expect(diff.harmonic).toEqual([
      { id: 'groove-02', field: 'chord', committed: "'E♭m7'", rendered: "'E♭m9'" },
    ])
    expect(diff.unexpected).toEqual([])
    expect(diff.expected).toEqual([])
  })

  const MOVES: Array<[string, Partial<Groove>]> = [
    ['id', { id: 'groove-99' }],
    ['uuid', { uuid: '00000000-0000-4000-8000-000000000000' }],
    ['bpm', { bpm: 97 }],
    ['root', { root: 'D' }],
    ['flavour', { flavour: 'Aeolian' }],
    ['scale', { scale: 'D dorian' }],
    ['chord', { chord: 'Dm7' }],
    ['progression', { progression: 'Dm7–G7' }],
    ['progressionDegrees', { progressionDegrees: [1, 2] }],
  ]

  it('covers every harmonic field', () => {
    expect(MOVES.map(([field]) => field)).toEqual([...HARMONIC_FIELDS])
  })

  it.each(MOVES)('buckets a moved %s as harmonic', (field, patch) => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, patch)]),
    )

    expect(diff.harmonic.length).toBeGreaterThan(0)
    expect(diff.harmonic.every((entry) => entry.field === field)).toBe(true)
    expect(diff.unexpected).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('buckets a moved headDelaySeconds as expected', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, { headDelaySeconds: 0.031 })]),
    )

    expect(diff.expected).toEqual([
      { id: 'groove-02', field: 'headDelaySeconds', committed: '0.03', rendered: '0.031' },
    ])
    expect(diff.harmonic).toEqual([])
    expect(diff.unexpected).toEqual([])
  })

  it('holds headDelaySeconds as the only field that may move', () => {
    expect([...MAY_MOVE]).toEqual(['headDelaySeconds'])
  })

  it('buckets a moved name as unexpected', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, { name: 'Dusty Lamp' })]),
    )

    expect(diff.unexpected).toEqual([
      { id: 'groove-02', field: 'name', committed: "'Dusty Lantern'", rendered: "'Dusty Lamp'" },
    ])
    expect(diff.harmonic).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('buckets a moved audioSrc as unexpected', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, { audioSrc: '/grooves/groove-02.ogg' })]),
    )

    expect(diff.unexpected).toEqual([
      {
        id: 'groove-02',
        field: 'audioSrc',
        committed: "'/grooves/groove-02.mp3'",
        rendered: "'/grooves/groove-02.ogg'",
      },
    ])
    expect(diff.harmonic).toEqual([])
  })

  it.each([['bars'], ['loopBars']])('buckets a moved %s as unexpected', (field) => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, { [field]: 32 })]),
    )

    expect(diff.unexpected.map((entry) => entry.field)).toEqual([field])
    expect(diff.harmonic).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('reports an added groove as harmonic with a null committed side', () => {
    const third = changed(SECOND, { id: 'groove-03', uuid: '9f9d5cba-6c5f-4c22-9d2b-24d2bb0f2c31' })
    const diff = diffManifests(manifest([ENTRY, SECOND]), manifest([ENTRY, SECOND, third]))

    expect(diff.harmonic).toEqual([
      { id: 'groove-03', field: 'id', committed: null, rendered: "'groove-03'" },
    ])
    expect(diff.unexpected).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('reports a removed groove as harmonic with a null rendered side', () => {
    const diff = diffManifests(manifest([ENTRY, SECOND]), manifest([ENTRY]))

    expect(diff.harmonic).toEqual([
      { id: 'groove-02', field: 'id', committed: "'groove-02'", rendered: null },
    ])
    expect(diff.unexpected).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('reports two swapped grooves as harmonic on both ids', () => {
    const diff = diffManifests(manifest([ENTRY, SECOND]), manifest([SECOND, ENTRY]))

    expect(diff.harmonic.map((entry) => entry.id).sort()).toEqual(['groove-01', 'groove-02'])
    expect(diff.harmonic.every((entry) => entry.field === 'id')).toBe(true)
    expect(diff.harmonic.every((entry) => entry.committed !== null && entry.rendered !== null)).toBe(
      true,
    )
    expect(diff.unexpected).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('reports a harmonic field dropped from the render as harmonic with a null side', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, without(SECOND, 'progressionDegrees')]),
    )

    expect(diff.harmonic).toEqual([
      {
        id: 'groove-02',
        field: 'progressionDegrees',
        committed: '[0, 3, 0]',
        rendered: null,
      },
    ])
  })

  it('reports a harmonic field gained by the render as harmonic with a null side', () => {
    const diff = diffManifests(
      manifest([ENTRY, without(SECOND, 'progressionDegrees')]),
      manifest([ENTRY, SECOND]),
    )

    expect(diff.harmonic).toEqual([
      {
        id: 'groove-02',
        field: 'progressionDegrees',
        committed: null,
        rendered: '[0, 3, 0]',
      },
    ])
  })

  it('reports a non-harmonic field dropped from the render as unexpected', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, without(SECOND, 'loopBars')]),
    )

    expect(diff.unexpected).toEqual([
      { id: 'groove-02', field: 'loopBars', committed: '8', rendered: null },
    ])
    expect(diff.harmonic).toEqual([])
  })

  it('reports a changed distractor pool as unexpected against the manifest tail', () => {
    const moved: Pools = { ...POOLS, scales: ['C mixolydian', 'E♭ lydian'] }
    const diff = diffManifests(manifest([ENTRY, SECOND]), manifest([ENTRY, SECOND], moved))

    expect(diff.unexpected.length).toBe(1)
    expect(diff.unexpected[0].id).toBe('(manifest tail)')
    expect(diff.unexpected[0].committed).toContain('E♭ dorian')
    expect(diff.unexpected[0].rendered).toContain('E♭ lydian')
    expect(diff.harmonic).toEqual([])
    expect(diff.expected).toEqual([])
  })

  it('reports a changed HEARD_IN row as unexpected against the manifest tail', () => {
    const source = manifest([ENTRY, SECOND])
    const rendered = source.replace("artist: 'Miles Davis'", "artist: 'M. Davis'")
    const diff = diffManifests(source, rendered)

    expect(diff.unexpected.length).toBe(1)
    expect(diff.unexpected[0].id).toBe('(manifest tail)')
    expect(diff.harmonic).toEqual([])
  })

  it('reports a changed manifest head as unexpected', () => {
    const source = manifest([ENTRY, SECOND])
    const rendered = source.replace(
      "import type { Groove, HeardIn } from '@/lib/groove'",
      "import type { Groove, HeardIn } from '@/lib/groove2'",
    )
    const diff = diffManifests(source, rendered)

    expect(diff.unexpected.length).toBe(1)
    expect(diff.unexpected[0].id).toBe('(manifest head)')
    expect(diff.harmonic).toEqual([])
  })

  it('keeps a moved head delay separate from a moved answer on the same entry', () => {
    const diff = diffManifests(
      manifest([ENTRY, SECOND]),
      manifest([ENTRY, changed(SECOND, { headDelaySeconds: 0.031, root: 'D' })]),
    )

    expect(diff.expected.map((entry) => entry.field)).toEqual(['headDelaySeconds'])
    expect(diff.harmonic.map((entry) => entry.field)).toEqual(['root'])
    expect(diff.unexpected).toEqual([])
  })
})
