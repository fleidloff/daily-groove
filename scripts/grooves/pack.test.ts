import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadPack } from './pack.ts'
import type { PackDeclaration, Pcm, VelocityLayer, VoiceName } from './types.ts'

const here = dirname(fileURLToPath(import.meta.url))

const declaration: PackDeclaration = {
  id: 'temp-pack',
  sampleRate: 44100,
  voices: {
    kick: {
      layers: [
        { maxVelocity: 0.5, files: ['kick_soft.wav'] },
        { maxVelocity: 1, files: ['kick_hard_a.wav', 'kick_hard_b.wav'] },
      ],
    },
    bass: {
      notes: [
        { midi: 36, layers: [{ maxVelocity: 1, files: ['bass_36.wav'] }] },
        { midi: 48, layers: [{ maxVelocity: 1, files: ['bass_48.wav'] }] },
      ],
    },
  },
}

const files = ['kick_soft.wav', 'kick_hard_a.wav', 'kick_hard_b.wav', 'bass_36.wav', 'bass_48.wav']

let dir: string

function tone(path: string, frequency: number) {
  const made = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=0.2:sample_rate=44100`,
    '-ac', '1', path,
  ])
  if (made.status !== 0) {
    throw new Error(`ffmpeg is required for the generator tests: ${made.stderr}`)
  }
}

function silence(sampleRate = 44100, frames = 8): Pcm {
  return { sampleRate, left: new Float32Array(frames), right: new Float32Array(frames) }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'groove-pack-'))
  mkdirSync(dir, { recursive: true })
  files.forEach((name, i) => tone(join(dir, name), 220 + i * 55))
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(declaration, null, 2))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadPack', () => {
  it('loads a directory into a SamplePack', async () => {
    const pack = await loadPack(dir)

    expect(pack.id).toBe('temp-pack')
    expect(pack.describe()).toEqual(declaration)

    const kick = pack.get('kick', { velocity: 1, index: 0 })
    expect(kick).not.toBeNull()
    expect(kick!.pcm.left.length).toBeGreaterThan(0)
    expect(kick!.pcm.left.length).toBe(kick!.pcm.right.length)
  })

  it('decodes every declared file exactly once and never again', async () => {
    const seen: string[] = []
    const pack = await loadPack(dir, async (path) => {
      seen.push(path)
      return silence()
    })

    expect(seen.length).toBe(files.length)
    expect(new Set(seen).size).toBe(files.length)

    for (let i = 0; i < 100; i += 1) {
      expect(pack.get('kick', { velocity: 1, index: i })).not.toBeNull()
      expect(pack.get('bass', { velocity: 1, index: i, midi: 36 + i })).not.toBeNull()
    }

    expect(seen.length).toBe(files.length)
  })

  it('picks the first layer whose maxVelocity covers the request', async () => {
    const decoded = new Map<string, Pcm>()
    const pack = await loadPack(dir, async (path) => {
      const pcm = silence(44100, decoded.size + 1)
      decoded.set(path, pcm)
      return pcm
    })

    const soft = pack.get('kick', { velocity: 0.3, index: 0 })!
    const hard = pack.get('kick', { velocity: 0.9, index: 0 })!

    expect(soft.pcm).toBe(decoded.get(join(dir, 'kick_soft.wav')))
    expect(hard.pcm).toBe(decoded.get(join(dir, 'kick_hard_a.wav')))
  })

  it('round-robins through a layer alternates by index', async () => {
    const decoded = new Map<string, Pcm>()
    const pack = await loadPack(dir, async (path) => {
      const pcm = silence(44100, decoded.size + 1)
      decoded.set(path, pcm)
      return pcm
    })

    const a = pack.get('kick', { velocity: 1, index: 0 })!
    const b = pack.get('kick', { velocity: 1, index: 1 })!
    const wrapped = pack.get('kick', { velocity: 1, index: 2 })!

    expect(b.pcm).not.toBe(a.pcm)
    expect(wrapped.pcm).toBe(a.pcm)
  })

  it('picks the nearest sampled note for a pitched voice', async () => {
    const pack = await loadPack(dir)

    expect(pack.get('bass', { velocity: 1, index: 0, midi: 38 })!.rootMidi).toBe(36)
    expect(pack.get('bass', { velocity: 1, index: 0, midi: 45 })!.rootMidi).toBe(48)
  })

  it('returns null for an undeclared voice', async () => {
    const pack = await loadPack(dir)
    expect(pack.get('hatOpen', { velocity: 1, index: 0 })).toBeNull()
  })
})

describe('the committed sample pack', () => {
  it('loads through the same interface as any other pack', async () => {
    const pack = await loadPack(join(here, 'samples'))

    expect(pack.describe().sampleRate).toBe(44100)

    const kick = pack.get('kick', { velocity: 1, index: 0 })!
    expect(kick.pcm.left.length).toBeGreaterThan(0)

    const bass = pack.get('bass', { velocity: 1, index: 0, midi: 38 })!
    expect(typeof bass.rootMidi).toBe('number')
    expect(bass.pcm.left.length).toBeGreaterThan(0)
  }, 120_000)
})

const SAMPLES = join(here, 'samples')

const committed = JSON.parse(
  readFileSync(join(SAMPLES, 'pack.json'), 'utf8'),
) as PackDeclaration

const committedProvenance = JSON.parse(
  readFileSync(join(SAMPLES, 'provenance.json'), 'utf8'),
) as { samples: { file: string; source: string; sourceFile: string; licence: string }[] }

const PERCUSSIVE: VoiceName[] = ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow']

const TOMS: VoiceName[] = ['tomHigh', 'tomLow']

function layersOf(voice: VoiceName): VelocityLayer[] {
  return committed.voices[voice]?.layers ?? []
}

function filesOf(voice: VoiceName): string[] {
  return layersOf(voice).flatMap((layer) => layer.files)
}

function format(file: string): string {
  const probed = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,sample_rate,channels',
    '-of', 'csv=p=0',
    join(SAMPLES, file),
  ])
  if (probed.status !== 0) {
    throw new Error(`ffprobe is required for the generator tests: ${probed.stderr}`)
  }
  return probed.stdout.toString().trim()
}

function samplesOf(file: string): Float32Array {
  const decoded = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', join(SAMPLES, file), '-f', 'f32le', 'pipe:1'],
    { maxBuffer: 1 << 26 },
  )
  if (decoded.status !== 0) {
    throw new Error(`ffmpeg could not decode ${file}: ${decoded.stderr}`)
  }
  const bytes = decoded.stdout
  const out = new Float32Array(Math.floor(bytes.length / 4))
  for (let i = 0; i < out.length; i += 1) out[i] = bytes.readFloatLE(i * 4)
  return out
}

function peakOf(file: string): number {
  let peak = 0
  for (const sample of samplesOf(file)) peak = Math.max(peak, Math.abs(sample))
  return peak
}

function levelOf(layer: VelocityLayer): number {
  return layer.files.reduce((sum, file) => sum + peakOf(file), 0) / layer.files.length
}

describe('the committed pack’s percussion', () => {
  it('declares a high tom and a low tom', () => {
    for (const tom of TOMS) {
      expect(committed.voices[tom], `${tom} is not declared`).toBeDefined()
      expect(layersOf(tom).length, `${tom} has no velocity layers`).toBeGreaterThan(0)
    }
  })

  it('layers and round-robins every tom, so a fill never repeats one sample', () => {
    for (const tom of TOMS) {
      const layers = layersOf(tom)
      expect(layers.length, `${tom} has too few velocity layers`).toBeGreaterThanOrEqual(2)
      for (const layer of layers) {
        expect(
          layer.files.length,
          `${tom} layer at ${layer.maxVelocity} has a single alternate`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('names only tom files that are on disk', () => {
    for (const tom of TOMS) {
      const files = filesOf(tom)
      expect(files.length, `${tom} declares no files`).toBeGreaterThan(0)
      for (const file of files) {
        expect(existsSync(join(SAMPLES, file)), `${file} is declared but missing`).toBe(true)
      }
    }
  })

  it('stores every percussive sample as mono 44.1 kHz FLAC', () => {
    for (const voice of PERCUSSIVE) {
      for (const file of filesOf(voice)) {
        expect(format(file), `${file} is not mono 44.1 kHz FLAC`).toBe('flac,44100,1')
      }
    }
  }, 120_000)

  it('leaves the velocity layers un-normalised, so each is louder than the one below', () => {
    for (const voice of PERCUSSIVE) {
      const levels = layersOf(voice).map(levelOf)
      for (let i = 1; i < levels.length; i += 1) {
        expect(
          levels[i],
          `${voice}: layer ${i} is not louder than layer ${i - 1} — was it normalised?`,
        ).toBeGreaterThan(levels[i - 1])
      }
    }
  }, 120_000)

  it('starts every tom near silence and never leaves it silent', () => {
    for (const tom of TOMS) {
      for (const file of filesOf(tom)) {
        const pcm = samplesOf(file)
        expect(pcm.length, `${file} decodes to nothing`).toBeGreaterThan(0)
        expect(Math.abs(pcm[0]), `${file} opens on a discontinuity`).toBeLessThan(0.01)
        expect(peakOf(file), `${file} is silent`).toBeGreaterThan(0.001)
      }
    }
  }, 120_000)

  it('records a provenance entry for every tom file, naming the snare’s source', () => {
    const recorded = new Map(committedProvenance.samples.map((s) => [s.file, s]))
    const snare = recorded.get(filesOf('snare')[0])!
    expect(snare, 'the snare has no provenance entry to compare against').toBeDefined()

    for (const tom of TOMS) {
      for (const file of filesOf(tom)) {
        const entry = recorded.get(file)
        expect(entry, `${file} is in the pack but not in provenance.json`).toBeDefined()
        expect(entry!.source, `${file} names a different library than the snare`).toBe(snare.source)
        expect(entry!.licence).toBe('CC-BY-4.0')
        expect(entry!.sourceFile).toMatch(/^samples\/Tom\d\//)
      }
    }
  })

  it('takes the high tom and the low tom from different drums', () => {
    const upstream = (voice: VoiceName) =>
      new Set(
        filesOf(voice).map(
          (file) =>
            committedProvenance.samples.find((s) => s.file === file)!.sourceFile.split('/')[1],
        ),
      )
    const high = [...upstream('tomHigh')]
    const low = [...upstream('tomLow')]
    expect(high.length, 'tomHigh mixes drums').toBe(1)
    expect(low.length, 'tomLow mixes drums').toBe(1)
    expect(high[0], 'the two toms are the same drum').not.toBe(low[0])
  })
})

type MeasuredNote = { midi: number; measuredHz?: number; layers: VelocityLayer[] }

function notesOf(voice: VoiceName): MeasuredNote[] {
  return [...((committed.voices[voice]?.notes ?? []) as MeasuredNote[])].sort(
    (a, b) => a.midi - b.midi,
  )
}

function pitchedFilesOf(voice: VoiceName): string[] {
  return notesOf(voice).flatMap((note) => note.layers.flatMap((layer) => layer.files))
}

function midiOf(hz: number): number {
  return 12 * Math.log2(hz / 440) + 69
}

const BASS_PLAYED = { lowest: 24, highest: 47 }

describe('the committed pack’s bass', () => {
  it('is a pizzicato contrabass from VSCO 2 CE, and no FM Piano file survives', () => {
    const files = pitchedFilesOf('bass')
    expect(files.length, 'bass declares no files').toBeGreaterThan(0)
    for (const file of files) {
      expect(file, `${file} is not a contrabass pizzicato sample`).toMatch(
        /^bass\/BKCtbss_Pizz_/,
      )
    }
    expect(readdirSync(join(SAMPLES, 'bass')).sort()).toEqual(
      files.map((file) => file.slice('bass/'.length)).sort(),
    )
  })

  it('names only bass files that are on disk', () => {
    for (const file of pitchedFilesOf('bass')) {
      expect(existsSync(join(SAMPLES, file)), `${file} is declared but missing`).toBe(true)
    }
  })

  it('stores every bass sample as mono 44.1 kHz FLAC', () => {
    for (const file of pitchedFilesOf('bass')) {
      expect(format(file), `${file} is not mono 44.1 kHz FLAC`).toBe('flac,44100,1')
    }
  }, 120_000)

  it('starts every bass sample near silence and never leaves it silent', () => {
    for (const file of pitchedFilesOf('bass')) {
      const pcm = samplesOf(file)
      expect(pcm.length, `${file} decodes to nothing`).toBeGreaterThan(0)
      expect(Math.abs(pcm[0]), `${file} opens on a discontinuity`).toBeLessThan(0.01)
      expect(peakOf(file), `${file} is silent`).toBeGreaterThan(0.001)
    }
  }, 120_000)

  it('leaves each note’s velocity layers un-normalised, so v3 is louder than v1', () => {
    for (const note of notesOf('bass')) {
      const levels = note.layers.map(levelOf)
      for (let i = 1; i < levels.length; i += 1) {
        expect(
          levels[i],
          `bass MIDI ${note.midi}: layer ${i} is not louder than layer ${i - 1} — was it normalised?`,
        ).toBeGreaterThan(levels[i - 1])
      }
    }
  }, 120_000)

  it('samples the bass no more than four semitones apart', () => {
    const midi = notesOf('bass').map((note) => note.midi)
    expect(midi.length, 'bass has too few sampled notes').toBeGreaterThanOrEqual(8)
    for (let i = 1; i < midi.length; i += 1) {
      expect(
        midi[i] - midi[i - 1],
        `bass has a ${midi[i] - midi[i - 1]}-semitone gap at MIDI ${midi[i - 1]}`,
      ).toBeLessThanOrEqual(4)
    }
  })

  it('covers the register the contrabass has: MIDI 26 up, not the 22 the spec asks for', () => {
    const midi = notesOf('bass').map((note) => note.midi)
    const lowest = midi[0]
    const highest = midi[midi.length - 1]

    expect(lowest, 'the lowest sampled note is not the contrabass’s open low E').toBe(28)
    expect(highest + 2, 'the bass does not reach the top of its register').toBeGreaterThanOrEqual(50)

    expect(BASS_PLAYED.highest).toBeLessThanOrEqual(highest + 2)
    expect(lowest - BASS_PLAYED.lowest, 'the low octave drops further than 4 semitones below the pack').toBeLessThanOrEqual(4)
  })

  it('declares a midi that its measured fundamental agrees with, within half a semitone', () => {
    const notes = notesOf('bass')
    expect(notes.length).toBeGreaterThan(0)
    for (const note of notes) {
      expect(typeof note.measuredHz, `bass MIDI ${note.midi} has no measuredHz`).toBe('number')
      const measured = midiOf(note.measuredHz!)
      expect(
        Math.abs(measured - note.midi),
        `bass MIDI ${note.midi} was measured at ${note.measuredHz} Hz, which sounds ${measured.toFixed(2)}`,
      ).toBeLessThan(0.5)
    }
  })

  it('is not the octave the filenames would suggest read as scientific pitch', () => {
    const lowest = notesOf('bass')[0]
    expect(lowest.midi).toBe(28)
    expect(lowest.measuredHz).toBeGreaterThan(39)
    expect(lowest.measuredHz).toBeLessThan(43)
  })

  it('records a VSCO 2 CE provenance entry for every bass file', () => {
    const recorded = new Map(committedProvenance.samples.map((s) => [s.file, s]))
    for (const file of pitchedFilesOf('bass')) {
      const entry = recorded.get(file)
      expect(entry, `${file} is in the pack but not in provenance.json`).toBeDefined()
      expect(entry!.source, `${file} does not name VSCO 2 CE`).toContain('VSCO-2-CE')
      expect(entry!.licence).toBe('CC0')
      expect(entry!.sourceFile).toMatch(/^Strings\/Solo Contrabass\/Pizz\//)
    }
  })

  it('ships the VSCO 2 CE licence beside the VCSL one', () => {
    for (const licence of ['LICENSE.txt', 'LICENSE-VSCO-2-CE.txt']) {
      expect(existsSync(join(SAMPLES, licence)), `${licence} is missing`).toBe(true)
      expect(readFileSync(join(SAMPLES, licence), 'utf8')).toContain('CC0 1.0 Universal')
    }
  })
})

const COMP_REGISTER = { lowest: 46, highest: 86 }

describe('the committed pack’s comp', () => {
  it('is an upright piano from VSCO 2 CE, and no Clavisynth file survives', () => {
    const files = pitchedFilesOf('comp')
    expect(files.length, 'comp declares no files').toBeGreaterThan(0)
    for (const file of files) {
      expect(file, `${file} is not an Upright Piano sample`).toMatch(
        /^comp\/Player_dyn[123]_rr1_\d{3}\.flac$/,
      )
    }
    expect(readdirSync(join(SAMPLES, 'comp')).sort()).toEqual(
      files.map((file) => file.slice('comp/'.length)).sort(),
    )
  })

  it('names only comp files that are on disk', () => {
    for (const file of pitchedFilesOf('comp')) {
      expect(existsSync(join(SAMPLES, file)), `${file} is declared but missing`).toBe(true)
    }
  })

  it('stores every comp sample as mono 44.1 kHz FLAC', () => {
    for (const file of pitchedFilesOf('comp')) {
      expect(format(file), `${file} is not mono 44.1 kHz FLAC`).toBe('flac,44100,1')
    }
  }, 120_000)

  it('starts every comp sample near silence and never leaves it silent', () => {
    for (const file of pitchedFilesOf('comp')) {
      const pcm = samplesOf(file)
      expect(pcm.length, `${file} decodes to nothing`).toBeGreaterThan(0)
      expect(Math.abs(pcm[0]), `${file} opens on a discontinuity`).toBeLessThan(0.01)
      expect(peakOf(file), `${file} is silent`).toBeGreaterThan(0.001)
    }
  }, 120_000)

  it('leaves each note’s velocity layers un-normalised, so dyn3 is louder than dyn1', () => {
    const notes = notesOf('comp')
    expect(notes.length, 'comp declares no notes').toBeGreaterThan(0)
    for (const note of notes) {
      expect(
        note.layers.length,
        `comp MIDI ${note.midi} does not carry three dynamics`,
      ).toBeGreaterThanOrEqual(3)
      const levels = note.layers.map(levelOf)
      for (let i = 1; i < levels.length; i += 1) {
        expect(
          levels[i],
          `comp MIDI ${note.midi}: layer ${i} is not louder than layer ${i - 1} — was it normalised?`,
        ).toBeGreaterThan(levels[i - 1])
      }
    }
  }, 120_000)

  it('covers the comp register with no gap wider than four semitones', () => {
    const midi = notesOf('comp').map((note) => note.midi)
    expect(midi.length, 'comp has too few sampled notes').toBeGreaterThanOrEqual(11)
    for (let i = 1; i < midi.length; i += 1) {
      expect(
        midi[i] - midi[i - 1],
        `comp has a ${midi[i] - midi[i - 1]}-semitone gap at MIDI ${midi[i - 1]}`,
      ).toBeLessThanOrEqual(4)
    }
    expect(midi[0] - 2, 'comp does not reach the bottom of its register').toBeLessThanOrEqual(
      COMP_REGISTER.lowest,
    )
    expect(
      midi[midi.length - 1] + 2,
      'comp does not reach the top of its register',
    ).toBeGreaterThanOrEqual(COMP_REGISTER.highest)
  })

  it('declares a midi that its measured fundamental agrees with, within half a semitone', () => {
    const notes = notesOf('comp')
    expect(notes.length).toBeGreaterThan(0)
    for (const note of notes) {
      expect(typeof note.measuredHz, `comp MIDI ${note.midi} has no measuredHz`).toBe('number')
      const measured = midiOf(note.measuredHz!)
      expect(
        Math.abs(measured - note.midi),
        `comp MIDI ${note.midi} was measured at ${note.measuredHz} Hz, which sounds ${measured.toFixed(2)}`,
      ).toBeLessThan(0.5)
    }
  })

  it('is not the pitch the file index would suggest read as a semitone offset', () => {
    const notes = notesOf('comp')
    const indexOf = (note: (typeof notes)[number]) =>
      Number(note.layers[0].files[0].match(/_(\d{3})\.flac$/)![1])

    for (const note of notes) {
      expect(indexOf(note), `comp MIDI ${note.midi} is indexed as its own MIDI number`).not.toBe(
        note.midi,
      )
    }
    for (let i = 1; i < notes.length; i += 1) {
      expect(indexOf(notes[i]) - indexOf(notes[i - 1]), 'the file index does not step by 2').toBe(2)
      expect(notes[i].midi - notes[i - 1].midi, 'the pitch does not step by 4').toBe(4)
    }
  })

  it('records a VSCO 2 CE Upright Piano provenance entry for every comp file', () => {
    const recorded = new Map(committedProvenance.samples.map((s) => [s.file, s]))
    for (const file of pitchedFilesOf('comp')) {
      const entry = recorded.get(file)
      expect(entry, `${file} is in the pack but not in provenance.json`).toBeDefined()
      expect(entry!.source, `${file} does not name VSCO 2 CE`).toContain('VSCO-2-CE')
      expect(entry!.licence).toBe('CC0')
      expect(entry!.sourceFile).toMatch(/^Keys\/Upright Piano\//)
    }
  })
})

describe('the committed pack’s rim', () => {
  it('is a quieter stroke of the snare already in the pack, and no woodblock survives', () => {
    const files = filesOf('rim')
    expect(files.length, 'rim declares no files').toBeGreaterThan(0)
    for (const file of files) {
      expect(file, `${file} is not a snare-derived sample`).toMatch(/^rim\/Muldjord_rim_/)
    }
    expect(readdirSync(join(SAMPLES, 'rim')).sort()).toEqual(
      files.map((file) => file.slice('rim/'.length)).sort(),
    )
  })

  it('comes off the same drum as the snare, so the kit coheres by source', () => {
    const recorded = new Map(committedProvenance.samples.map((s) => [s.file, s]))
    const sourceOf = (file: string) => {
      const entry = recorded.get(file)
      expect(entry, `${file} is in the pack but not in provenance.json`).toBeDefined()
      expect(entry!.licence).toBe('CC-BY-4.0')
      return entry!.source
    }
    const snare = sourceOf(filesOf('snare')[0])
    expect(snare).toContain('MuldjordKit')
    for (const file of filesOf('rim')) {
      expect(sourceOf(file), `${file} is not from the snare's own kit`).toBe(snare)
    }
  })

  it('declares real velocity layers, each round-robined so a repeat never replays one file', () => {
    const layers = layersOf('rim')
    expect(layers.length, 'rim declares too few layers').toBeGreaterThanOrEqual(2)
    expect(layers[layers.length - 1].maxVelocity, 'rim’s top layer misses full velocity').toBe(1)
    for (const layer of layers) {
      expect(layer.files.length, 'a rim layer has too few alternates').toBeGreaterThanOrEqual(2)
      expect(new Set(layer.files).size).toBe(layer.files.length)
    }
  })

  it('is named in the README’s voice-mapping table, and so is the piano', () => {
    const readme = readFileSync(join(SAMPLES, 'README.md'), 'utf8')
    const table = readme
      .split('\n')
      .filter((line) => line.startsWith('| `'))
      .join('\n')
    expect(table).toMatch(/^\| `rim` \| MuldjordKit snare, quiet stroke/m)
    expect(table).toMatch(/^\| `comp` \| .*Upright Piano/m)
    expect(table, 'the table still offers a woodblock').not.toMatch(/Woodblock/i)
    expect(table, 'the table still offers a Clavisynth').not.toMatch(/Clavisynth/i)
  })

  it('stores every rim sample as mono 44.1 kHz FLAC, starting near silence and never silent', () => {
    for (const file of filesOf('rim')) {
      expect(format(file), `${file} is not mono 44.1 kHz FLAC`).toBe('flac,44100,1')
      const pcm = samplesOf(file)
      expect(pcm.length, `${file} decodes to nothing`).toBeGreaterThan(0)
      expect(Math.abs(pcm[0]), `${file} opens on a discontinuity`).toBeLessThan(0.01)
      expect(peakOf(file), `${file} is silent`).toBeGreaterThan(0.001)
    }
  }, 120_000)
})
