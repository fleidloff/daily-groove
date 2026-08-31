/**
 * The page's one `AudioContext`.
 *
 * Two voices now share the graph: the groove's looping player and the
 * reference note a root chip sounds. A browser gives a page a small, finite
 * number of contexts, and two contexts would also mean two clocks — so the
 * context is lifted out of whichever voice happens to need it first and held
 * here (R14).
 *
 * It is a module-level singleton rather than something the transport lends
 * out, because a note must be able to sound before the groove has ever been
 * played (AC3, AC21): an owner built by the play press would not exist yet.
 *
 * Nothing is constructed at module load. The constructor is looked up at call
 * time, so importing this module during a server prerender builds nothing and
 * a browser with no Web Audio throws the same plain `Error` the player has
 * always thrown (R15, AC12).
 */

type AudioContextConstructor = new () => AudioContext

/** Built on the first `sharedAudioContext()` call, and not before. */
let context: AudioContext | null = null

function audioContextConstructor(): AudioContextConstructor {
  const ctor = (globalThis as { AudioContext?: AudioContextConstructor })
    .AudioContext
  if (typeof ctor !== 'function') {
    throw new Error('Audio playback is unavailable in this browser')
  }
  return ctor
}

/**
 * The page's one context, constructed on first call.
 *
 * Throws where the browser has no Web Audio. Callers that must not fail loudly
 * — the reference voice — catch it; the groove's player lets it reject, which
 * is the error state its retry affordance already handles.
 */
export function sharedAudioContext(): AudioContext {
  if (!context) {
    const ctor = audioContextConstructor()
    context = new ctor()
  }
  return context
}

/** Whether one has been constructed. Tests and teardown only. */
export function hasAudioContext(): boolean {
  return context !== null
}

/**
 * Close and forget it. Test teardown only; nothing in the app calls this —
 * disposing a voice must never close a context another voice is still using
 * (R16).
 */
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
