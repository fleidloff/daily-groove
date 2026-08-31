import { vi, type Mock } from 'vitest'
import { releaseAudioContext } from '../lib/audio/context'

/**
 * A driveable stand-in for the Web Audio API.
 *
 * jsdom implements no Web Audio at all, so this is the seam every timing
 * assertion in the epic runs against: the clock only moves when a test says
 * `advance`, so "one loop later" is an exact number rather than a wait.
 *
 * It lives inside the feature, beside `renderFeature.tsx`, so deleting the
 * feature deletes it.
 */

/** A decoded buffer, as much of one as anything under test reads. */
export type FakeAudioBuffer = {
  duration: number
  length: number
  sampleRate: number
  numberOfChannels: number
}

/** One `AudioBufferSourceNode`, with everything the player sets recorded. */
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

/** One constructed context. */
export type FakeAudioContextHandle = {
  readonly currentTime: number
  readonly outputLatency: number | undefined
  readonly baseLatency: number | undefined
  state: AudioContextState
  destination: unknown
  /** The buffer `decodeAudioData` resolves, once it has resolved one. */
  decodedBuffer: FakeAudioBuffer | null
  resume: Mock<() => Promise<void>>
  close: Mock<() => Promise<void>>
  decodeAudioData(bytes: ArrayBuffer): Promise<FakeAudioBuffer>
  createBufferSource(): FakeSourceNode
}

export type FakeContext = {
  /** Advance the context clock, in seconds. */
  advance(seconds: number): void
  /** Every source node the context created, in creation order. */
  sources: FakeSourceNode[]
  /** Every context constructed since the fake was installed. */
  contexts: FakeAudioContextHandle[]
  /** The clock the constructed contexts read. */
  readonly currentTime: number
  /**
   * The latency the contexts report. `undefined` models a browser that reports
   * none — Safari reports only `baseLatency`, and older engines neither.
   */
  outputLatency: number | undefined
  baseLatency: number | undefined
  decodeCalls: number
  fetchCalls: number
  /** Make the next decode reject. */
  failNextDecode(): void
  /**
   * Make every fetch of this URL answer 404. Per-URL rather than global,
   * because warming asks for twelve files and one of them failing is its own
   * case (R18).
   */
  failFetchFor(url: string): void
  /** Make the next decode hang until `releaseDecodes()`. */
  deferNextDecode(): void
  /** Resolve every decode held by `deferNextDecode()`. */
  releaseDecodes(): void
}

export type InstallOptions = {
  /** Length of the buffer `decodeAudioData` resolves. */
  bufferSeconds?: number
  outputLatency?: number | undefined
  baseLatency?: number | undefined
  /** The state a freshly constructed context reports. */
  state?: AudioContextState
}

const SAMPLE_RATE = 44100

/**
 * Installs the stub on `globalThis` — `AudioContext` and `fetch` both — and
 * returns the handle.
 *
 * `vi.stubGlobal` is used throughout, so a suite's `vi.unstubAllGlobals()`
 * removes it. Passing `outputLatency: undefined` explicitly is different from
 * omitting it: the key's presence is what selects "reports no figure at all",
 * which is the AC4a case.
 */
export function installFakeAudioContext(opts: InstallOptions = {}): FakeContext {
  // The page holds one `AudioContext` in a module-level singleton, and a
  // context built under the *previous* stub is stale the moment this one is
  // installed: it would report the old clock and push its nodes onto the old
  // handle. Handing it back here is what keeps `contexts` a per-test list.
  // The close is deliberately not awaited — `releaseAudioContext` forgets the
  // context synchronously, which is the half that has to happen before the
  // caller's first `sharedAudioContext()`.
  void releaseAudioContext()

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

    // Takes no argument: the bytes are irrelevant to a fake, and the handle
    // type keeps the real shape for anything reading it.
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
