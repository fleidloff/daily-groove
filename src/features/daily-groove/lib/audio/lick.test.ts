import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLickVoice, type PhraseClock, type ReferenceOutput } from './lick'
import { releaseAudioContext } from './context'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'
import { referenceOutput, type OutputClaim } from './output'
import {
  installFakeAudioContext,
  type FakeContext,
} from '../../testing/fakeAudioContext'
import type { PitchSample } from '../../data/notes.generated'
import type { ScheduledNote } from '@/lib/theory/phrase'

const THREE: PitchSample[] = [
  { id: 'C4', root: 'C', octave: 4, midi: 60, audioSrc: '/notes/note-c.mp3' },
  { id: 'D4', root: 'D', octave: 4, midi: 62, audioSrc: '/notes/note-d.mp3' },
  { id: 'E4', root: 'E', octave: 4, midi: 64, audioSrc: '/notes/note-e.mp3' },
]

const TWO_NOTES: ScheduledNote[] = [
  { midi: 60, offsetSeconds: 0, durationSeconds: 0.5 },
  { midi: 64, offsetSeconds: 0.5, durationSeconds: 0.5 },
]

const FOUR_NOTES: ScheduledNote[] = [
  { midi: 60, offsetSeconds: 0, durationSeconds: 0.25 },
  { midi: 62, offsetSeconds: 0.25, durationSeconds: 0.25 },
  { midi: 64, offsetSeconds: 0.5, durationSeconds: 0.25 },
  { midi: 60, offsetSeconds: 0.75, durationSeconds: 0.25 },
]

afterEach(async () => {
  await releaseAudioContext()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function recordingOutput(fake?: FakeContext) {
  const real = referenceOutput()
  const cancels: Array<() => void> = []
  const claims: OutputClaim[] = []
  const nodesAtClaim: number[] = []

  const output: ReferenceOutput = {
    claim: vi.fn((cancel: () => void) => {
      cancels.push(cancel)
      nodesAtClaim.push(fake ? fake.sources.length : 0)
      const held = real.claim(cancel)
      claims.push(held)
      return held
    }),
  }

  return { output, cancels, claims, nodesAtClaim }
}

function stubClock(beat: number | null): PhraseClock & {
  nextBeat: ReturnType<typeof vi.fn>
} {
  return { nextBeat: vi.fn(() => beat) }
}

async function settle() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('a phrase sounds, one node per note (R1, R12, R32)', () => {
  it('creates one source per note and starts each at its own offset', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)

    expect(fake.sources).toHaveLength(2)
    expect(fake.sources[0].start).toHaveBeenCalledWith(fake.currentTime + 0)
    expect(fake.sources[1].start).toHaveBeenCalledWith(fake.currentTime + 0.5)
  })

  it('gives every node the decoded buffer, and fetches one file per pitch', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)

    expect(fake.fetchCalls).toBe(2)
    for (const node of fake.sources) {
      expect(node.buffer).toEqual(fake.contexts[0].decodedBuffer)
    }
  })
})

describe('each note carries its own envelope (R5, R7)', () => {
  it('opens every note at the injected level and ramps it to zero', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)

    expect(fake.gains).toHaveLength(2)
    TWO_NOTES.forEach((note, index) => {
      const gain = fake.gains[index]
      const when = fake.currentTime + note.offsetSeconds
      const end = when + note.durationSeconds + REFERENCE_FADE_SECONDS

      expect(gain.gain.value).toBe(REFERENCE_LEVEL)
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, end)
      expect(fake.sources[index].stop).toHaveBeenCalledWith(end)
    })
  })

  it('uses the one level for every note of every phrase (R7)', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)
    await voice.play(TWO_NOTES)

    expect(fake.gains).toHaveLength(4)
    const levels = new Set(fake.gains.map((gain) => gain.gain.value))
    expect([...levels]).toEqual([REFERENCE_LEVEL])
  })
})

describe('the phrase starts where the clock says (R11, R12, R14)', () => {
  it('schedules the first note on the next beat while the groove runs (AC8)', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const clock = stubClock(4.25)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock,
    })

    fake.advance(3)
    await voice.play(TWO_NOTES)

    expect(fake.sources[0].start).toHaveBeenCalledWith(4.25)
    expect(fake.sources[1].start).toHaveBeenCalledWith(4.25 + 0.5)
  })

  it('starts at the context clock when there is no beat to wait for (AC9)', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock: stubClock(null),
    })

    fake.advance(1.75)
    await voice.play(TWO_NOTES)

    expect(fake.sources[0].start).toHaveBeenCalledWith(1.75)
  })

  it('asks the clock once, after the buffers land and not before (R11)', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const clock = stubClock(9)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock,
    })

    fake.deferNextDecode()
    const playing = voice.play(TWO_NOTES)
    await settle()

    expect(clock.nextBeat).not.toHaveBeenCalled()

    fake.advance(2)
    fake.releaseDecodes()
    await playing

    expect(clock.nextBeat).toHaveBeenCalledTimes(1)
    expect(clock.nextBeat).toHaveBeenCalledWith(2)
  })
})

describe('one sound at a time, across both rows (R8, R8a)', () => {
  it('takes the output over before it schedules anything', async () => {
    const fake = installFakeAudioContext()
    const { output, nodesAtClaim } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock: stubClock(10),
    })

    await voice.play(FOUR_NOTES)
    await voice.play(FOUR_NOTES)

    expect(output.claim).toHaveBeenCalledTimes(2)
    expect(nodesAtClaim).toEqual([0, 4])
  })

  it('stops and tears down the first phrase, unsounded notes included (AC6)', async () => {
    const fake = installFakeAudioContext()
    const { output, claims } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock: stubClock(10),
    })

    await voice.play(FOUR_NOTES)
    await voice.play(FOUR_NOTES)

    for (const node of fake.sources.slice(0, 4)) {
      expect(node.stop).toHaveBeenLastCalledWith(fake.currentTime)
      expect(node.disconnect).toHaveBeenCalled()
    }
    for (const gain of fake.gains.slice(0, 4)) {
      expect(gain.disconnect).toHaveBeenCalled()
    }

    fake.sources.slice(4).forEach((node, index) => {
      const note = FOUR_NOTES[index]
      const end =
        10 + note.offsetSeconds + note.durationSeconds + REFERENCE_FADE_SECONDS
      expect(node.stop).toHaveBeenCalledTimes(1)
      expect(node.stop).toHaveBeenCalledWith(end)
      expect(node.disconnect).not.toHaveBeenCalled()
    })

    expect(claims[0].isHeld()).toBe(false)
    expect(claims[1].isHeld()).toBe(true)
  })

  it('lets the other row silence a lick through the cancel it handed in (R8a)', async () => {
    const fake = installFakeAudioContext()
    const { output, cancels } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock: stubClock(10),
    })

    await voice.play(FOUR_NOTES)
    expect(cancels).toHaveLength(1)

    cancels[0]()

    for (const node of fake.sources) {
      expect(node.stop).toHaveBeenLastCalledWith(fake.currentTime)
      expect(node.disconnect).toHaveBeenCalled()
    }
  })

  it('fades a note that is already sounding rather than cutting it (R8)', async () => {
    const fake = installFakeAudioContext()
    const { output, cancels } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)
    cancels[0]()

    const sounding = fake.gains[0]
    const at = fake.currentTime
    expect(sounding.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0,
      at + REFERENCE_FADE_SECONDS,
    )
    expect(fake.sources[0].stop).toHaveBeenLastCalledWith(
      at + REFERENCE_FADE_SECONDS,
    )
    expect(fake.sources[0].disconnect).not.toHaveBeenCalled()
    fake.sources[0].onended?.()
    expect(fake.sources[0].disconnect).toHaveBeenCalled()
  })

  it('releases the claim once the last note has ended', async () => {
    const fake = installFakeAudioContext()
    const { output, claims } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)
    expect(claims[0].isHeld()).toBe(true)

    for (const node of fake.sources) node.onended?.()

    expect(claims[0].isHeld()).toBe(false)
    expect(referenceOutput().isClaimed()).toBe(false)
  })
})

describe('a pitch is fetched once, and warming is never a precondition (R32, R33)', () => {
  it('reuses a decoded buffer for every later phrase', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)
    const fetches = fake.fetchCalls
    const decodes = fake.decodeCalls

    await voice.play(TWO_NOTES)

    expect(fake.fetchCalls).toBe(fetches)
    expect(fake.decodeCalls).toBe(decodes)
  })

  it('sounds a phrase on a voice that was never warmed (AC20)', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await voice.play(TWO_NOTES)

    expect(fake.sources).toHaveLength(2)
    for (const node of fake.sources) {
      expect(node.start).toHaveBeenCalled()
    }
  })

  it('warms the pitches it can when one file is missing', async () => {
    const fake = installFakeAudioContext()
    fake.failFetchFor('/notes/note-d.mp3')
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await expect(voice.warm()).resolves.toBeUndefined()

    expect(fake.fetchCalls).toBe(3)
    expect(fake.decodeCalls).toBe(2)
    expect(fake.sources).toHaveLength(0)
  })
})

describe('every failure is silence (R20, R21, AC14)', () => {
  it('does nothing at all where the browser has no Web Audio (AC14)', async () => {
    const fake = installFakeAudioContext()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('AudioContext', undefined)
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await expect(voice.play(TWO_NOTES)).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    expect(output.claim).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
  })

  it('leaves whatever is already ringing alone when a decode fails', async () => {
    const fake = installFakeAudioContext()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const earlier = vi.fn()
    const held = referenceOutput().claim(earlier)

    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    fake.failNextDecode()
    await expect(voice.play(TWO_NOTES)).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    expect(output.claim).not.toHaveBeenCalled()
    expect(earlier).not.toHaveBeenCalled()
    expect(held.isHeld()).toBe(true)
    expect(referenceOutput().isClaimed()).toBe(true)
    expect(errors).not.toHaveBeenCalled()
  })

  it('is silent for a pitch the manifest does not carry', async () => {
    const fake = installFakeAudioContext()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await expect(
      voice.play([{ midi: 83, offsetSeconds: 0, durationSeconds: 0.5 }]),
    ).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    expect(output.claim).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
  })

  it('is silent for an empty phrase, and claims nothing', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
    })

    await expect(voice.play([])).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    expect(output.claim).not.toHaveBeenCalled()
  })

  it('survives a clock that throws by sounding immediately', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock: {
        nextBeat: () => {
          throw new Error('no grid')
        },
      },
    })

    fake.advance(0.5)
    await voice.play(TWO_NOTES)

    expect(fake.sources[0].start).toHaveBeenCalledWith(0.5)
  })
})

describe('disposing lets go of what it is holding', () => {
  it('stops the live phrase and forgets the buffers', async () => {
    const fake = installFakeAudioContext()
    const { output } = recordingOutput(fake)
    const voice = createLickVoice({
      pitches: THREE,
      output,
      level: REFERENCE_LEVEL,
      fadeSeconds: REFERENCE_FADE_SECONDS,
      clock: stubClock(10),
    })

    await voice.play(FOUR_NOTES)
    voice.dispose()

    for (const node of fake.sources) {
      expect(node.stop).toHaveBeenLastCalledWith(fake.currentTime)
    }

    await voice.play(FOUR_NOTES)
    expect(fake.fetchCalls).toBe(6)
  })
})

describe('the coupling to the groove is one-way (R9, R10, R14)', () => {
  const SOURCE = readFileSync(
    join(
      process.cwd(),
      'src',
      'features',
      'daily-groove',
      'lib',
      'audio',
      'lick.ts',
    ),
    'utf8',
  )

  it('imports nothing that can move the groove', () => {
    const specifiers = [...SOURCE.matchAll(/from\s*'([^']+)'/g)].map(
      (match) => match[1],
    )

    expect(specifiers.length).toBeGreaterThan(0)
    expect(
      specifiers.filter((s) => /transport|loop|\/audio\/audio/.test(s)),
    ).toEqual([])
  })

  it('names no member that would write to the groove or watch it', () => {
    for (const forbidden of [
      'getElapsed',
      'getPosition',
      'getStartTime',
      'toggle',
      'subscribe',
      'isRunning',
    ]) {
      expect(SOURCE.includes(forbidden), forbidden).toBe(false)
    }
  })

  it('declares no level or fade of its own', () => {
    expect(SOURCE).toMatch(/from\s*'\.\/level'/)
    expect(SOURCE).not.toMatch(/const\s+\w*(LEVEL|FADE|GAIN|RELEASE)\w*\s*=/)
  })
})
