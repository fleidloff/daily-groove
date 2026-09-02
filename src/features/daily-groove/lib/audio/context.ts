type AudioContextConstructor = new () => AudioContext

let context: AudioContext | null = null

function audioContextConstructor(): AudioContextConstructor {
  const ctor = (globalThis as { AudioContext?: AudioContextConstructor })
    .AudioContext
  if (typeof ctor !== 'function') {
    throw new Error('Audio playback is unavailable in this browser')
  }
  return ctor
}

export function sharedAudioContext(): AudioContext {
  if (!context) {
    const ctor = audioContextConstructor()
    context = new ctor()
  }
  return context
}

export function hasAudioContext(): boolean {
  return context !== null
}

export async function releaseAudioContext(): Promise<void> {
  const current = context
  context = null
  if (!current) return
  try {
    await current.close()
  } catch {
    // A context already closed by the browser throws. Nothing to undo.
  }
}
