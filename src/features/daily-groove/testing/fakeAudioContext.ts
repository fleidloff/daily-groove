import { vi, type Mock } from 'vitest'
import { releaseAudioContext } from '../lib/audio/context'
import { resetReferenceOutput } from '../lib/audio/output'

export type FakeAudioBuffer = {
  duration: number
  length: number
  sampleRate: number
  numberOfChannels: number
}

export type FakeSourceNode = {
  buffer: FakeAudioBuffer | null
  loop: boolean
  loopStart: number
  loopEnd: number
  onended: (() => void) | null
  start: Mock<(when?: number, offset?: number, duration?: number) => void>
  stop: Mock<(when?: number) => void>
  connect: Mock<(destination: unknown) => unknown>
  disconnect: Mock<() => void>
}

export type FakeAudioParam = {
  value: number
  setValueAtTime: Mock<(value: number, when: number) => void>
  linearRampToValueAtTime: Mock<(value: number, when: number) => void>
  cancelScheduledValues: Mock<(when: number) => void>
}

export type FakeGainNode = {
  gain: FakeAudioParam
  connect: Mock<(destination: unknown) => unknown>
  disconnect: Mock<() => void>
}

export type FakeAudioContextHandle = {
  readonly currentTime: number
  readonly outputLatency: number | undefined
  readonly baseLatency: number | undefined
  state: AudioContextState
  destination: unknown
  decodedBuffer: FakeAudioBuffer | null
  resume: Mock<() => Promise<void>>
  close: Mock<() => Promise<void>>
  decodeAudioData(bytes: ArrayBuffer): Promise<FakeAudioBuffer>
  createBufferSource(): FakeSourceNode
  createGain(): FakeGainNode
}

export type FakeContext = {
  advance(seconds: number): void
  sources: FakeSourceNode[]
  gains: FakeGainNode[]
  contexts: FakeAudioContextHandle[]
  readonly currentTime: number
  outputLatency: number | undefined
  baseLatency: number | undefined
  decodeCalls: number
  fetchCalls: number
  failNextDecode(): void
  failFetchFor(url: string): void
  deferNextDecode(): void
  releaseDecodes(): void
}

export type InstallOptions = {
  bufferSeconds?: number
  outputLatency?: number | undefined
  baseLatency?: number | undefined
  state?: AudioContextState
}

const SAMPLE_RATE = 44100

export function installFakeAudioContext(opts: InstallOptions = {}): FakeContext {
  void releaseAudioContext()
  resetReferenceOutput()

  const bufferSeconds = opts.bufferSeconds ?? 10

  const state = {
    currentTime: 0,
    outputLatency: 'outputLatency' in opts ? opts.outputLatency : 0,
    baseLatency: 'baseLatency' in opts ? opts.baseLatency : 0,
    decodeCalls: 0,
    fetchCalls: 0,
    failNext: false,
    deferNext: false,
  }

  const sources: FakeSourceNode[] = []
  const gains: FakeGainNode[] = []
  const failingUrls = new Set<string>()
  const contexts: FakeAudioContextHandle[] = []
  const held: Array<() => void> = []

  function makeBuffer(): FakeAudioBuffer {
    return {
      duration: bufferSeconds,
      length: Math.round(bufferSeconds * SAMPLE_RATE),
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 2,
    }
  }

  class FakeAudioContext implements FakeAudioContextHandle {
    state: AudioContextState = opts.state ?? 'running'
    destination: unknown = { name: 'destination' }
    decodedBuffer: FakeAudioBuffer | null = null
    sampleRate = SAMPLE_RATE

    resume = vi.fn(async () => {
      this.state = 'running'
    })

    close = vi.fn(async () => {
      this.state = 'closed'
    })

    constructor() {
      contexts.push(this)
    }

    get currentTime(): number {
      return state.currentTime
    }

    get outputLatency(): number | undefined {
      return state.outputLatency
    }

    get baseLatency(): number | undefined {
      return state.baseLatency
    }

    decodeAudioData(): Promise<FakeAudioBuffer> {
      state.decodeCalls += 1

      if (state.failNext) {
        state.failNext = false
        return Promise.reject(new Error('decode failed'))
      }

      const settle = () => {
        const buffer = makeBuffer()
        this.decodedBuffer = buffer
        return buffer
      }

      if (state.deferNext) {
        state.deferNext = false
        return new Promise<FakeAudioBuffer>((resolve) => {
          held.push(() => {
            resolve(settle())
          })
        })
      }

      return Promise.resolve(settle())
    }

    createBufferSource(): FakeSourceNode {
      const node: FakeSourceNode = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      sources.push(node)
      return node
    }

    createGain(): FakeGainNode {
      const gain: FakeAudioParam = {
        value: 1,
        setValueAtTime: vi.fn<(value: number, when: number) => void>(
          (value) => {
            gain.value = value
          },
        ),
        linearRampToValueAtTime: vi.fn<(value: number, when: number) => void>(),
        cancelScheduledValues: vi.fn<(when: number) => void>(),
      }
      const node: FakeGainNode = {
        gain,
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(node)
      return node
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      state.fetchCalls += 1
      const failed = failingUrls.has(String(input))
      return {
        ok: !failed,
        status: failed ? 404 : 200,
        arrayBuffer: async () => new ArrayBuffer(SAMPLE_RATE),
      }
    }),
  )

  return {
    advance(seconds: number) {
      state.currentTime += seconds
    },
    sources,
    gains,
    contexts,
    get currentTime() {
      return state.currentTime
    },
    get outputLatency() {
      return state.outputLatency
    },
    set outputLatency(value: number | undefined) {
      state.outputLatency = value
    },
    get baseLatency() {
      return state.baseLatency
    },
    set baseLatency(value: number | undefined) {
      state.baseLatency = value
    },
    get decodeCalls() {
      return state.decodeCalls
    },
    set decodeCalls(value: number) {
      state.decodeCalls = value
    },
    get fetchCalls() {
      return state.fetchCalls
    },
    set fetchCalls(value: number) {
      state.fetchCalls = value
    },
    failNextDecode() {
      state.failNext = true
    },
    failFetchFor(url: string) {
      failingUrls.add(url)
    },
    deferNextDecode() {
      state.deferNext = true
    },
    releaseDecodes() {
      const pending = held.splice(0, held.length)
      for (const release of pending) release()
    },
  }
}
