import { describe, expect, it } from 'vitest'
import { LOUDNESS_CEILING_DB, LOUDNESS_FLOOR_DB } from './gate.ts'
import { rmsDbfs } from './level.ts'
import {
  classifyAudio,
  compareChanged,
  formatLoudness,
  loudnessTable,
  ridingIds,
} from './rerenderReport.ts'
import type { Lock, LockEntry } from './lock.ts'
import type { FeelTemplate, GrooveSpec, Pcm, VoiceName } from './types.ts'

function lock(grooves: readonly LockEntry[]): Lock {
  return { catalogueSha256: 'cat', manifestSha256: 'man', grooves: [...grooves] }
}

function row(id: string, sha256: string, bytes = 1000): LockEntry {
  return { id, sha256, bytes }
}

function template(id: string, voices: VoiceName[]): FeelTemplate {
  return {
    id,
    tempoRange: [90, 110],
    subdivision: 8,
    swing: 0,
    flavours: [],
    voices,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
    gain: {},
    pan: {},
    passes: 1,
    density: { minPerBar: 1, maxPerBar: 8 },
  }
}

function spec(id: string, templateId: string): GrooveSpec {
  return { id, uuid: `uuid-${id}`, template: templateId, seed: 1 }
}

const SAMPLE_RATE = 44100
const FRAMES = 512

function steady(dbfs: number): Pcm {
  const amplitude = 10 ** (dbfs / 20)
  const channel = new Float32Array(FRAMES).fill(amplitude)
  return { sampleRate: SAMPLE_RATE, left: channel, right: channel.slice() }
}

function silence(): Pcm {
  return {
    sampleRate: SAMPLE_RATE,
    left: new Float32Array(FRAMES),
    right: new Float32Array(FRAMES),
  }
}

describe('classifyAudio', () => {
  it('separates the grooves whose hash moved from the ones that held still', () => {
    const committed = lock([
      row('groove-01', 'aaa'),
      row('groove-02', 'bbb'),
      row('groove-03', 'ccc'),
      row('groove-04', 'ddd'),
    ])
    const rendered = lock([
      row('groove-01', 'aaa'),
      row('groove-02', 'bbb-moved'),
      row('groove-03', 'ccc'),
      row('groove-04', 'ddd-moved'),
    ])

    expect(classifyAudio(committed, rendered)).toEqual({
      changed: ['groove-02', 'groove-04'],
      unchanged: ['groove-01', 'groove-03'],
      missing: [],
      extra: [],
    })
  })

  it('calls a groove changed when only its byte count moved', () => {
    const committed = lock([row('groove-01', 'aaa', 1000)])
    const rendered = lock([row('groove-01', 'aaa', 1200)])

    expect(classifyAudio(committed, rendered).changed).toEqual(['groove-01'])
    expect(classifyAudio(committed, rendered).unchanged).toEqual([])
  })

  it('reports a committed groove the render did not produce as missing, not as a change', () => {
    const committed = lock([row('groove-01', 'aaa'), row('groove-02', 'bbb')])
    const rendered = lock([row('groove-01', 'aaa')])

    const result = classifyAudio(committed, rendered)
    expect(result.missing).toEqual(['groove-02'])
    expect(result.changed).not.toContain('groove-02')
    expect(result.unchanged).not.toContain('groove-02')
    expect(result.extra).toEqual([])
  })

  it('reports a rendered groove the committed lock does not know as extra', () => {
    const committed = lock([row('groove-01', 'aaa')])
    const rendered = lock([row('groove-01', 'aaa'), row('groove-99', 'zzz')])

    const result = classifyAudio(committed, rendered)
    expect(result.extra).toEqual(['groove-99'])
    expect(result.changed).toEqual([])
    expect(result.unchanged).toEqual(['groove-01'])
    expect(result.missing).toEqual([])
  })

  it('handles two empty locks', () => {
    expect(classifyAudio(lock([]), lock([]))).toEqual({
      changed: [],
      unchanged: [],
      missing: [],
      extra: [],
    })
  })
})

describe('ridingIds', () => {
  const templates = new Map<string, FeelTemplate>([
    ['shuffle', template('shuffle', ['kick', 'snare', 'ride'])],
    ['swung-sixteenth', template('swung-sixteenth', ['kick', 'ride', 'bass'])],
    ['half-time', template('half-time', ['kick', 'snare', 'hatClosed'])],
  ])

  function templateFor(id: string): FeelTemplate {
    const found = templates.get(id)
    if (found === undefined) throw new Error(`no template ${id}`)
    return found
  }

  const specs = [
    spec('groove-01', 'shuffle'),
    spec('groove-02', 'half-time'),
    spec('groove-03', 'swung-sixteenth'),
    spec('groove-04', 'half-time'),
    spec('groove-05', 'shuffle'),
  ]

  it('returns the specs on every template that declares a ride, in catalogue order', () => {
    expect(ridingIds(specs, templateFor)).toEqual(['groove-01', 'groove-03', 'groove-05'])
  })

  it('shrinks with the templates when only one feel rides', () => {
    const narrowed = new Map(templates)
    narrowed.set('swung-sixteenth', template('swung-sixteenth', ['kick', 'hatClosed', 'bass']))

    expect(
      ridingIds(specs, (id) => {
        const found = narrowed.get(id)
        if (found === undefined) throw new Error(`no template ${id}`)
        return found
      }),
    ).toEqual(['groove-01', 'groove-05'])
  })

  it('returns nothing for an empty catalogue', () => {
    expect(ridingIds([], templateFor)).toEqual([])
  })
})

describe('compareChanged', () => {
  function classification(changed: string[]): ReturnType<typeof classifyAudio> {
    return { changed, unchanged: [], missing: [], extra: [] }
  }

  it('is silent when the changed set is exactly the expected set', () => {
    expect(compareChanged(classification(['a', 'b']), ['a', 'b'])).toEqual({
      missed: [],
      surprising: [],
    })
  })

  it('names an expected groove that did not change as missed', () => {
    expect(compareChanged(classification(['a']), ['a', 'b'])).toEqual({
      missed: ['b'],
      surprising: [],
    })
  })

  it('names a groove that changed and was not expected to as surprising', () => {
    expect(compareChanged(classification(['a', 'b', 'rogue']), ['a', 'b'])).toEqual({
      missed: [],
      surprising: ['rogue'],
    })
  })

  it('reports both failures at once', () => {
    expect(compareChanged(classification(['a', 'rogue']), ['a', 'b'])).toEqual({
      missed: ['b'],
      surprising: ['rogue'],
    })
  })

  it('treats every change as surprising when nothing was expected to move', () => {
    expect(compareChanged(classification(['a', 'b']), [])).toEqual({
      missed: [],
      surprising: ['a', 'b'],
    })
  })

  it('is silent when nothing was expected and nothing changed', () => {
    expect(compareChanged(classification([]), [])).toEqual({ missed: [], surprising: [] })
  })
})

describe('loudnessTable', () => {
  it('measures every groove against the gate window, in insertion order', () => {
    const middle = steady(-24)
    const loud = steady(-6)
    const quiet = steady(-60)
    const pcm = new Map<string, Pcm>([
      ['groove-loud', loud],
      ['groove-ok', middle],
      ['groove-quiet', quiet],
    ])

    const rows = loudnessTable(pcm)

    expect(rows.map((r) => r.id)).toEqual(['groove-loud', 'groove-ok', 'groove-quiet'])
    expect(rows[0].dbfs).toBeCloseTo(rmsDbfs(loud), 6)
    expect(rows[1].dbfs).toBeCloseTo(rmsDbfs(middle), 6)
    expect(rows[2].dbfs).toBeCloseTo(rmsDbfs(quiet), 6)
    expect(rows.map((r) => r.inWindow)).toEqual([false, true, false])
  })

  it('takes its window from the gate, not from a second set of numbers', () => {
    const rows = loudnessTable(
      new Map<string, Pcm>([
        ['just-inside-floor', steady(LOUDNESS_FLOOR_DB + 0.05)],
        ['just-below-floor', steady(LOUDNESS_FLOOR_DB - 0.05)],
        ['just-inside-ceiling', steady(LOUDNESS_CEILING_DB - 0.05)],
        ['just-above-ceiling', steady(LOUDNESS_CEILING_DB + 0.05)],
      ]),
    )

    expect(rows.map((r) => r.inWindow)).toEqual([true, false, true, false])
  })

  it('measures a digitally silent render as -Infinity without crashing', () => {
    const rows = loudnessTable(new Map<string, Pcm>([['groove-dead', silence()]]))

    expect(rows).toEqual([{ id: 'groove-dead', dbfs: Number.NEGATIVE_INFINITY, inWindow: false }])
  })

  it('returns nothing for an empty map', () => {
    expect(loudnessTable(new Map())).toEqual([])
  })
})

describe('formatLoudness', () => {
  const rows = [
    { id: 'groove-01', dbfs: -24.13, inWindow: true },
    { id: 'groove-02', dbfs: -18.7, inWindow: false },
    { id: 'groove-03', dbfs: -31.4, inWindow: false },
  ]

  it('marks only the out-of-window rows, so they are findable at a glance', () => {
    const lines = formatLoudness(rows)

    expect(lines).toHaveLength(3)
    expect(lines[0].startsWith('!!')).toBe(false)
    expect(lines[1].startsWith('!!')).toBe(true)
    expect(lines[2].startsWith('!!')).toBe(true)
  })

  it('gives a row above the ceiling the dB it is out by', () => {
    const line = formatLoudness(rows)[1]

    expect(line).toContain('groove-02')
    expect(line).toContain('-18.7 dBFS')
    expect(line).toContain('1.3 dB above the ceiling')
    expect(line).toContain(String(LOUDNESS_CEILING_DB))
  })

  it('gives a row below the floor the dB it is out by', () => {
    const line = formatLoudness(rows)[2]

    expect(line).toContain('groove-03')
    expect(line).toContain('-31.4 dBFS')
    expect(line).toContain('2.4 dB below the floor')
    expect(line).toContain(String(LOUDNESS_FLOOR_DB))
  })

  it('says a passing row is ok and gives no correction', () => {
    const line = formatLoudness(rows)[0]

    expect(line).toContain('groove-01')
    expect(line).toContain('-24.1 dBFS')
    expect(line).toContain('ok')
    expect(line).not.toContain('dB below')
    expect(line).not.toContain('dB above')
  })

  it('renders a silent groove as silence rather than as -Infinity dB out', () => {
    const line = formatLoudness([
      { id: 'groove-dead', dbfs: Number.NEGATIVE_INFINITY, inWindow: false },
    ])[0]

    expect(line.startsWith('!!')).toBe(true)
    expect(line).toContain('groove-dead')
    expect(line).toContain('silent')
    expect(line).not.toContain('Infinity')
    expect(line).not.toContain('NaN')
  })

  it('aligns the ids into a column so thirty rows scan as a table', () => {
    const lines = formatLoudness([
      { id: 'a', dbfs: -24, inWindow: true },
      { id: 'a-much-longer-groove-id', dbfs: -24, inWindow: true },
    ])

    expect(lines[0].indexOf('dBFS')).toBe(lines[1].indexOf('dBFS'))
  })

  it('returns nothing for no rows', () => {
    expect(formatLoudness([])).toEqual([])
  })
})
