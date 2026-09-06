import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readLock, sha256File } from '../lock.ts'
import { VELOCITIES, buildEvents } from '../events.ts'
import { readCatalogue } from '../catalogue.ts'
import { templateById } from '../templates/index.ts'
import { shuffle } from '../templates/shuffle.ts'
import { VOICE_NAMES } from '../types.ts'
import type { PackDeclaration, VelocityLayer, VoiceName } from '../types.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const decl = JSON.parse(readFileSync(join(HERE, 'pack.json'), 'utf8')) as PackDeclaration
const provenance = JSON.parse(readFileSync(join(HERE, 'provenance.json'), 'utf8')) as {
  pack: string
  licence: string
  attributions?: string[]
  samples: {
    file: string
    source: string
    sourceFile: string
    url: string
    licence: string
    modifications?: string
    attribution?: string
  }[]
}

const README = readFileSync(join(HERE, 'README.md'), 'utf8')
const LOCK_PATH = join(HERE, '..', 'grooves.lock.json')

const NEW_PERCUSSION: VoiceName[] = ['claves', 'cowbell']

const NEW_VOICES: VoiceName[] = [...NEW_PERCUSSION, 'ride', 'rideBell']

function layersOf(voice: VoiceName): VelocityLayer[] {
  return decl.voices[voice]?.layers ?? []
}

function readmeTable(heading: string): string[] {
  const after = README.split(heading)[1] ?? ''
  return after
    .split('\n')
    .slice(0, 60)
    .filter((line) => line.trimStart().startsWith('|'))
}

function audioFiles(dir = HERE, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...audioFiles(join(dir, entry.name), rel))
    else if (/\.(flac|wav|ogg|mp3)$/i.test(entry.name)) out.push(rel)
  }
  return out
}

function declaredFiles(): string[] {
  const out: string[] = []
  for (const voice of Object.values(decl.voices)) {
    for (const layer of voice?.layers ?? []) out.push(...layer.files)
    for (const note of voice?.notes ?? []) {
      for (const layer of note.layers) out.push(...layer.files)
    }
  }
  return out
}

const DRUM_VOICES: VoiceName[] = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'rim',
  'tomHigh',
  'tomLow',
]
const PITCHED_VOICES: VoiceName[] = ['bass', 'comp']

describe('the pack declares itself', () => {
  it('parses as a PackDeclaration with an id and a sample rate', () => {
    expect(typeof decl.id).toBe('string')
    expect(decl.id.length).toBeGreaterThan(0)
    expect(decl.sampleRate).toBe(44100)
  })

  it('declares every voice the renderer can ask for', () => {
    for (const voice of [...DRUM_VOICES, ...PITCHED_VOICES]) {
      expect(decl.voices[voice], `${voice} is not declared`).toBeDefined()
    }
  })

  it('names only files that exist', () => {
    for (const file of declaredFiles()) {
      expect(existsSync(join(HERE, file)), `${file} is declared but missing`).toBe(true)
    }
  })

  it('gives every layer at least one file and a maxVelocity in (0, 1]', () => {
    const layers: VelocityLayer[] = []
    for (const voice of Object.values(decl.voices)) {
      layers.push(...(voice?.layers ?? []))
      for (const note of voice?.notes ?? []) layers.push(...note.layers)
    }
    expect(layers.length).toBeGreaterThan(0)
    for (const layer of layers) {
      expect(layer.files.length).toBeGreaterThan(0)
      expect(layer.maxVelocity).toBeGreaterThan(0)
      expect(layer.maxVelocity).toBeLessThanOrEqual(1)
    }
  })

  it('orders each voice’s layers by ascending maxVelocity, so lookup picks the first match', () => {
    for (const [name, voice] of Object.entries(decl.voices)) {
      const sets = [voice?.layers ?? [], ...(voice?.notes ?? []).map((n) => n.layers)]
      for (const layers of sets) {
        const v = layers.map((l) => l.maxVelocity)
        expect([...v].sort((a, b) => a - b), `${name} layers are out of order`).toEqual(v)
      }
    }
  })

  it('reaches full velocity, so a velocity of 1 always finds a layer', () => {
    for (const [name, voice] of Object.entries(decl.voices)) {
      const sets = [voice?.layers ?? [], ...(voice?.notes ?? []).map((n) => n.layers)]
      for (const layers of sets) {
        if (layers.length === 0) continue
        expect(layers[layers.length - 1].maxVelocity, `${name} tops out below 1`).toBe(1)
      }
    }
  })
})

describe('every sample is CC0 and accounted for', () => {
  const ALLOWED = ['CC0', 'CC-BY-4.0']

  it('lists every audio file present in the pack', () => {
    const listed = new Set(provenance.samples.map((s) => s.file))
    for (const file of audioFiles()) {
      expect(listed.has(file), `${file} is in the pack but not in provenance.json`).toBe(true)
    }
  })

  it('names no file that is absent', () => {
    for (const s of provenance.samples) {
      expect(existsSync(join(HERE, s.file)), `${s.file} is recorded but missing`).toBe(true)
    }
  })

  it('records a non-empty source and origin for every sample', () => {
    expect(provenance.samples.length).toBeGreaterThan(0)
    for (const s of provenance.samples) {
      expect(s.source?.length, `${s.file} has no source`).toBeGreaterThan(0)
      expect(s.sourceFile?.length, `${s.file} has no upstream path`).toBeGreaterThan(0)
      expect(s.url?.length, `${s.file} has no url`).toBeGreaterThan(0)
    }
  })

  it('carries only a licence that permits redistribution', () => {
    for (const s of provenance.samples) {
      expect(ALLOWED, `${s.file} is licensed "${s.licence}"`).toContain(s.licence)
    }
    expect(provenance.licence).toContain('CC0')
    expect(provenance.licence).toContain('CC-BY-4.0')
  })

  it('records the required attribution on every row that is not CC0', () => {
    const attributed = provenance.samples.filter((s) => s.licence !== 'CC0')
    expect(attributed.length, 'no non-CC0 samples to check').toBeGreaterThan(0)
    for (const s of attributed) {
      expect(
        s.attribution?.length ?? 0,
        `${s.file} is ${s.licence} but names no attribution`,
      ).toBeGreaterThan(0)
    }
  })

  it('lists the distinct attributions the pack owes, so a second one is visible', () => {
    const owed = [
      ...new Set(provenance.samples.filter((s) => s.licence !== 'CC0').map((s) => s.attribution!)),
    ].sort()
    expect(Array.isArray(provenance.attributions)).toBe(true)
    expect(provenance.attributions).toEqual(owed)
    expect(provenance.attributions!.length).toBeGreaterThan(0)
    expect(provenance.attributions).toContain('Drum samples provided by DrumGizmo.org')
  })

  it('owes a second attribution once a second CC-BY library ships, which is Epic 3’s flag', () => {
    if (decl.voices.ride === undefined) return
    expect(provenance.attributions).toContain(
      'Ride cymbal samples from DRSKit, provided by DrumGizmo.org',
    )
    expect(provenance.attributions!.length).toBe(2)
  })

  it('ships the licence text alongside the audio', () => {
    expect(existsSync(join(HERE, 'LICENSE.txt'))).toBe(true)
    expect(readFileSync(join(HERE, 'LICENSE.txt'), 'utf8')).toContain('CC0 1.0 Universal')
    expect(existsSync(join(HERE, 'LICENSE-MuldjordKit.txt'))).toBe(true)
    expect(readFileSync(join(HERE, 'LICENSE-MuldjordKit.txt'), 'utf8')).toContain(
      'Attribution 4.0 International',
    )
  })

  it('ships a licence text for every library that requires one', () => {
    const required = new Set(
      provenance.samples
        .filter((s) => s.licence !== 'CC0')
        .map((s) => `LICENSE-${s.source.split(/[\s,(]/)[0].trim()}.txt`),
    )
    for (const file of required) {
      expect(existsSync(join(HERE, file)), `${file} is required but missing`).toBe(true)
      expect(readFileSync(join(HERE, file), 'utf8')).toContain('Attribution 4.0 International')
    }
  })
})

describe('the pack is stocked for Epic 2', () => {
  it('gives every drum voice either multiple velocity layers or multiple alternates', () => {
    for (const voice of DRUM_VOICES) {
      const layers = decl.voices[voice]?.layers ?? []
      const alternates = Math.max(...layers.map((l) => l.files.length))
      expect(
        layers.length > 1 || alternates > 1,
        `${voice} offers neither velocity layers nor round-robins`,
      ).toBe(true)
    }
  })

  it('gives the voices that repeat most a real velocity range', () => {
    for (const voice of ['kick', 'snare', 'hatClosed'] as VoiceName[]) {
      const layers = decl.voices[voice]?.layers ?? []
      expect(layers.length, `${voice} has too few velocity layers`).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every drum voice round-robin alternates, so repeated hits differ', () => {
    for (const voice of DRUM_VOICES) {
      const layers = decl.voices[voice]?.layers ?? []
      for (const layer of layers) {
        expect(
          layer.files.length,
          `${voice} layer at ${layer.maxVelocity} has a single alternate`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('samples pitched voices densely enough that nothing shifts more than two semitones', () => {
    for (const voice of PITCHED_VOICES) {
      const notes = decl.voices[voice]?.notes ?? []
      expect(notes.length, `${voice} has too few sampled notes`).toBeGreaterThanOrEqual(5)
      const midi = notes.map((n) => n.midi).sort((a, b) => a - b)
      for (let i = 1; i < midi.length; i++) {
        const gap = midi[i] - midi[i - 1]
        expect(
          Math.floor(gap / 2),
          `${voice} has a ${gap}-semitone gap at MIDI ${midi[i - 1]}`,
        ).toBeLessThanOrEqual(2)
      }
    }
  })

  const SINGLE_VELOCITY_IN_SOURCE: Partial<Record<VoiceName, number[]>> = {
    bass: [42, 45, 49],
  }

  // quick-8: the comp is not short of recordings — VSCO 2 CE ships three dynamics and
  // this pack declined two of them. Its layers were 10–14 dB apart while the bands
  // imply 3–9, so both boundaries stepped audibly and a chord voice drifting over one
  // on humanize jitter changed timbre mid-part. dyn2 alone is the flattest of the
  // three across the four notes the catalogue actually plays (2.4 dB of spread against
  // dyn1's 6.4 and dyn3's 5.1), and mf is the touch a backing comp under a soloist
  // wants. The reason belongs in the assertion rather than in a silent exemption:
  // see the README's "The comp declines the velocity layers the library has".
  const SINGLE_LAYER_BY_DESIGN: Partial<Record<VoiceName, string>> = {
    comp: 'one dyn2 layer across the whole range — quick-8, to close both layer steps',
  }

  it('velocity-layers the pitched voices too, or names why it does not', () => {
    for (const voice of PITCHED_VOICES) {
      if (SINGLE_LAYER_BY_DESIGN[voice]) continue
      const exempt = SINGLE_VELOCITY_IN_SOURCE[voice] ?? []
      for (const note of decl.voices[voice]?.notes ?? []) {
        if (exempt.includes(note.midi)) continue
        expect(
          note.layers.length,
          `${voice} MIDI ${note.midi} has a single velocity layer`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('round-robins the notes it cannot velocity-layer, so a repeat never replays one file', () => {
    for (const voice of PITCHED_VOICES) {
      if (SINGLE_LAYER_BY_DESIGN[voice]) continue
      for (const midi of SINGLE_VELOCITY_IN_SOURCE[voice] ?? []) {
        const note = decl.voices[voice]?.notes?.find((n) => n.midi === midi)
        expect(note, `${voice} MIDI ${midi} is exempted but not declared`).toBeDefined()
        expect(
          note!.layers.flatMap((l) => l.files).length,
          `${voice} MIDI ${midi} has one velocity layer and no alternates`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('velocity-layers most of every pitched voice that declares layers at all', () => {
    for (const voice of PITCHED_VOICES) {
      if (SINGLE_LAYER_BY_DESIGN[voice]) continue
      const notes = decl.voices[voice]?.notes ?? []
      const layered = notes.filter((n) => n.layers.length >= 2).length
      expect(
        layered * 2,
        `${voice} carries velocity layers on only ${layered} of its ${notes.length} notes`,
      ).toBeGreaterThan(notes.length)
    }
  })

  it('holds every single-layer pitched voice to exactly one layer, so the reason still fits', () => {
    for (const voice of Object.keys(SINGLE_LAYER_BY_DESIGN) as VoiceName[]) {
      const notes = decl.voices[voice]?.notes ?? []
      expect(notes.length, `${voice} is named single-layer but declares no notes`).toBeGreaterThan(0)
      for (const note of notes) {
        expect(
          note.layers.length,
          `${voice} MIDI ${note.midi} has grown a second layer — ` +
            `${SINGLE_LAYER_BY_DESIGN[voice]} no longer describes the pack`,
        ).toBe(1)
      }
    }
  })

  // What the removed assertion was a proxy for. Three velocity layers were never a
  // machine-gun guard — 83% of comp notes already replayed one dyn2 file. This is the
  // guard that was actually doing the work, so it is pinned where the proxy was:
  // COMP_SPREAD_RANGE rolls each voicing over 5-15 ms, so almost every comp event
  // owns its own onset, successive chords are different pitches, and humanize gives
  // every event its own velocity. The same recording is never struck twice running at
  // the same pitch and the same gain.
  describe('what actually keeps the comp off the machine-gun artefact', () => {
    const grooves = readCatalogue().map((spec) => {
      const { events } = buildEvents(spec, templateById(spec.template))
      return {
        id: spec.id,
        comp: events
          .filter((event) => event.voice === 'comp')
          .sort((a, b) => a.timeSec - b.timeSec),
      }
    })

    it('renders comp events the catalogue can be measured on', () => {
      expect(grooves.length, 'the catalogue is empty').toBeGreaterThan(0)
      expect(
        grooves.reduce((total, groove) => total + groove.comp.length, 0),
        'no groove plays a comp',
      ).toBeGreaterThan(0)
    })

    it('never strikes one pitch twice running at the same velocity', () => {
      for (const groove of grooves) {
        const last = new Map<number, number>()
        for (const event of groove.comp) {
          const previous = last.get(event.midi!)
          if (previous !== undefined) {
            expect(
              Math.abs(event.velocity - previous) > 1e-9,
              `${groove.id} replays MIDI ${event.midi} at velocity ${event.velocity} twice running`,
            ).toBe(true)
          }
          last.set(event.midi!, event.velocity)
        }
      }
    })

    it('gives all but a handful of comp events an onset of their own', () => {
      let events = 0
      let onsets = 0
      for (const groove of grooves) {
        events += groove.comp.length
        onsets += new Set(groove.comp.map((event) => event.timeSec.toFixed(4))).size
      }
      expect(onsets / events, 'the comp lands as blocks, not as a rolled voicing').toBeGreaterThan(
        0.98,
      )
    })

    it('repeats a whole voicing on consecutive onsets only rarely', () => {
      let consecutive = 0
      let repeated = 0
      for (const groove of grooves) {
        const byOnset = new Map<string, number[]>()
        for (const event of groove.comp) {
          const key = event.timeSec.toFixed(4)
          byOnset.set(key, [...(byOnset.get(key) ?? []), event.midi!])
        }
        const keys = [...byOnset.keys()].sort((a, b) => Number(a) - Number(b))
        for (let i = 1; i < keys.length; i += 1) {
          consecutive += 1
          const before = [...byOnset.get(keys[i - 1])!].sort().join(',')
          const after = [...byOnset.get(keys[i])!].sort().join(',')
          if (before === after) repeated += 1
        }
      }
      expect(consecutive, 'nothing consecutive to measure').toBeGreaterThan(0)
      expect(
        repeated / consecutive,
        `${repeated} of ${consecutive} consecutive comp onsets repeat their pitches`,
      ).toBeLessThan(0.02)
    })
  })
})

describe('the four voices feature-24 adds are stocked, sourced and levelled', () => {
  it('declares every one of them with at least one velocity layer', () => {
    for (const voice of NEW_VOICES) {
      expect(decl.voices[voice], `${voice} is not declared`).toBeDefined()
      expect(layersOf(voice).length, `${voice} declares no layer`).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives every layer two or more round-robin alternates', () => {
    for (const voice of NEW_VOICES) {
      for (const layer of layersOf(voice)) {
        expect(
          layer.files.length,
          `${voice} layer at ${layer.maxVelocity} cannot round-robin`,
        ).toBeGreaterThanOrEqual(2)
        expect(new Set(layer.files).size, `${voice} repeats a file inside one layer`).toBe(
          layer.files.length,
        )
      }
    }
  })

  it('declares an explicit nominalVelocity on every layer', () => {
    for (const voice of NEW_VOICES) {
      for (const layer of layersOf(voice)) {
        expect(
          typeof layer.nominalVelocity,
          `${voice} layer at ${layer.maxVelocity} defaults to its band midpoint`,
        ).toBe('number')
        expect(layer.nominalVelocity!).toBeGreaterThan(0)
        expect(layer.nominalVelocity!).toBeLessThanOrEqual(1)
      }
    }
  })

  it('orders the layers ascending and tops them out at exactly 1', () => {
    for (const voice of NEW_VOICES) {
      const v = layersOf(voice).map((l) => l.maxVelocity)
      expect([...v].sort((a, b) => a - b), `${voice} layers are out of order`).toEqual(v)
      expect(v[v.length - 1], `${voice} tops out below 1`).toBe(1)
    }
  })

  it('keeps every declared layer inside MAX_LAYER_GAIN at the voice\u2019s strongest hit', () => {
    for (const voice of NEW_VOICES) {
      for (const layer of layersOf(voice)) {
        expect(
          VELOCITIES[voice].strong / layer.nominalVelocity!,
          `${voice} layer at ${layer.maxVelocity} asks for more than 2x its recorded level`,
        ).toBeLessThan(2)
      }
    }
  })

  it('leaves the ride headroom for the jitter humanize adds on top of a strong hit', () => {
    const loudest = VELOCITIES.ride.strong + shuffle.humanize.velocity
    for (const layer of layersOf('ride')) {
      expect(
        loudest / layer.nominalVelocity!,
        `a humanized strong ride hit asks its layer for more than 2x its recorded level`,
      ).toBeLessThan(2)
    }
  })

  it('provenances every file the four voices ship', () => {
    const rows = provenance.samples.filter((s) => /^(claves|cowbell|ride|rideBell)\//.test(s.file))
    const declared = new Set(NEW_VOICES.flatMap((v) => layersOf(v).flatMap((l) => l.files)))
    expect(new Set(rows.map((s) => s.file))).toEqual(declared)
    for (const s of rows) {
      expect(s.source?.length, `${s.file} has no source`).toBeGreaterThan(0)
      expect(s.sourceFile?.length, `${s.file} has no upstream path`).toBeGreaterThan(0)
      expect(s.url?.length, `${s.file} has no url`).toBeGreaterThan(0)
      expect(s.modifications?.length, `${s.file} does not say what was done to it`).toBeGreaterThan(
        0,
      )
      expect(['CC0', 'CC-BY-4.0'], `${s.file} is licensed "${s.licence}"`).toContain(s.licence)
    }
  })

  it('names the decay envelope in the ride\u2019s modifications, not only in the README', () => {
    const rows = provenance.samples.filter((s) => s.file.startsWith('ride/'))
    expect(rows.length, 'the ride ships no files').toBeGreaterThan(0)
    for (const s of rows) {
      expect(s.modifications, `${s.file} does not record its decay envelope`).toMatch(
        /decay envelope/i,
      )
    }
  })
})

describe('the pack declares the whole vocabulary the generator can ask for', () => {
  it('declares exactly the voices VOICE_NAMES names', () => {
    expect(Object.keys(decl.voices).sort()).toEqual([...VOICE_NAMES].sort())
  })
})

describe('the README documents the pack it ships beside', () => {
  it('maps every voice pack.json declares', () => {
    const listed = new Set(
      readmeTable('## Voice mapping').flatMap((line) => [
        ...(line.split('|')[1] ?? '').matchAll(/`([^`]+)`/g),
      ].map((m) => m[1])),
    )
    for (const voice of Object.keys(decl.voices)) {
      expect(listed.has(voice), `${voice} is declared but has no voice-mapping row`).toBe(true)
    }
  })

  it('names every library provenance.json draws on', () => {
    for (const source of new Set(provenance.samples.map((s) => s.source))) {
      const library = source.split(/[,(]/)[0].trim()
      expect(README.includes(library), `${library} supplies files but is not in the README`).toBe(
        true,
      )
    }
  })

  it('records a levelling band for every layer pack.json declares', () => {
    const rows = new Set(
      readmeTable('### The bands as committed')
        .map((line) => /\|\s*`([^`]+)`\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(\d+)\s*\|/.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => `${m[1]}|${Number(m[2])}|${Number(m[3])}|${Number(m[4])}`),
    )
    for (const [voice, block] of Object.entries(decl.voices)) {
      for (const layer of block?.layers ?? []) {
        const key = `${voice}|${layer.maxVelocity}|${layer.nominalVelocity}|${layer.files.length}`
        expect(rows.has(key), `the levelling table has no row for ${key}`).toBe(true)
      }
    }
  })

  it('records a length cap for every voice it levels', () => {
    const capped = new Set(
      readmeTable('### Length caps').flatMap((line) => [
        ...(line.split('|')[1] ?? '').matchAll(/`([^`]+)`/g),
      ].map((m) => m[1])),
    )
    for (const [voice, block] of Object.entries(decl.voices)) {
      if ((block?.layers ?? []).length === 0) continue
      expect(capped.has(voice), `${voice} ships with no recorded length cap`).toBe(true)
    }
  })

  it('no longer says the pack has no ride, once one is declared', () => {
    if (decl.voices.ride === undefined) return
    expect(README).not.toContain('The pack has no ride')
  })
})

function readmeTables(): string[][][] {
  const tables: string[][][] = []
  let current: string[][] | null = null
  for (const line of README.split('\n')) {
    if (!line.trimStart().startsWith('|')) {
      current = null
      continue
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
    if (current === null) {
      current = []
      tables.push(current)
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue
    current.push(cells)
  }
  return tables
}

describe('the README records the ride audition R5 asked for — R4, R5, AC13b', () => {
  const CANDIDATES = [
    { library: 'DRSKit', verdict: /chosen/i },
    { library: 'CrocellKit', verdict: /rejected/i },
    { library: 'Zildjian', verdict: /rejected/i },
  ]

  const shortlist = readmeTables().find((rows) =>
    CANDIDATES.every(({ library }) => rows.some((row) => row.join(' ').includes(library))),
  )

  it('carries one table naming all three candidate libraries', () => {
    expect(
      shortlist,
      `no README table names all of ${CANDIDATES.map((c) => c.library).join(', ')} — the shortlist R5 requires is the epic's report, and it is gone`,
    ).toBeDefined()
    expect(shortlist!.length, 'the shortlist table has no rows under its header').toBeGreaterThan(
      CANDIDATES.length,
    )
  })

  it('gives every candidate a verdict and the licence it was checked under', () => {
    for (const { library, verdict } of CANDIDATES) {
      const row = shortlist!.find((cells) => cells.join(' ').includes(library))
      expect(row, `${library} has no row in the shortlist`).toBeDefined()
      const text = row!.join(' ')
      expect(text, `${library} is listed with no verdict`).toMatch(verdict)
      expect(text, `${library} is listed with no licence`).toMatch(/CC0|CC-BY/)
    }
  })

  it('names exactly one of them as the library that shipped', () => {
    const chosen = shortlist!.filter((cells) => /chosen/i.test(cells.join(' ')))
    expect(
      chosen.length,
      'the shortlist does not say which candidate was chosen, or says it of more than one',
    ).toBe(1)
    expect(chosen[0].join(' ')).toContain('DRSKit')
  })

  it('says why the candidate that was never heard was rejected — R4', () => {
    const row = shortlist!.find((cells) => cells.join(' ').includes('Zildjian'))!.join(' ')
    expect(
      row,
      'the R4 rejection counts against R5\u2019s bound of three, so the reason has to travel with it',
    ).toMatch(/round.?robin|alternate|one sample|single velocity|one velocity/i)
  })
})

describe('the lock is in step with the pack it hashes', () => {
  it('records the current pack.json hash, so prebuild does not fail as pack-stale', () => {
    const lock = readLock(LOCK_PATH)
    expect(lock, 'grooves.lock.json is missing or unreadable').not.toBeNull()
    expect(lock!.packSha256).toBe(sha256File(join(HERE, 'pack.json')))
  })
})
