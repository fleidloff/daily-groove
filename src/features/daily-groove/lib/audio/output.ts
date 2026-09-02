/**
 * Who is making the reference sound right now (R10a, R10b).
 *
 * At most one reference sound plays at a time across both chip rows: a root tap
 * silences a lick, and a mode tap silences a ringing root. Neither voice can
 * reach into the other to do that — they are built by two different hooks and
 * neither is ever handed the other — so the arbitration lives here, in one
 * place both of them can see.
 *
 * This module arbitrates *who* is sounding, not *what* comes out: there is no
 * Web Audio in it at all. A voice hands in the callback that silences its own
 * note, and claiming runs the previous holder's callback first. That is the
 * whole mechanism, and it means the owner can be tested with no context.
 *
 * It is a module-level singleton for the same reason `context.ts` is one: the
 * two voices are constructed independently, and there is no shared object to
 * hang it off.
 */

/** One voice's hold on the shared reference output. */
export type OutputClaim = {
  /** False once another sound has taken the output, or `release()` was called. */
  isHeld(): boolean
  /** Give it back. Idempotent, and a no-op once superseded. */
  release(): void
}

export type ReferenceOutput = {
  /**
   * Take the output for a new sound. The current holder's `cancel` runs first,
   * so at most one reference sound is ever live across both chip rows (R10a).
   */
  claim(cancel: () => void): OutputClaim
  /** Whether anything holds it. Tests and teardown only. */
  isClaimed(): boolean
}

/** What the owner remembers about the voice currently sounding. */
type Entry = {
  cancel: () => void
  live: boolean
}

let holder: Entry | null = null

function claim(cancel: () => void): OutputClaim {
  const previous = holder
  const entry: Entry = { cancel, live: true }

  /*
   * The new entry is installed *before* the previous one is cancelled, and the
   * ordering is load-bearing: a cancel callback typically calls `release()` on
   * its own claim, and a release that ran while the old entry was still the
   * holder would clear the claim that just replaced it.
   */
  holder = entry

  if (previous?.live) {
    previous.live = false
    try {
      previous.cancel()
    } catch {
      // A voice that cannot silence itself must not stop the arriving one.
    }
  }

  return {
    isHeld: () => entry.live && holder === entry,
    release: () => {
      if (!entry.live) return
      entry.live = false
      if (holder === entry) holder = null
    },
  }
}

const output: ReferenceOutput = Object.freeze({
  claim,
  isClaimed: () => holder !== null,
})

/** The page's single owner of the reference output (R10b). */
export function referenceOutput(): ReferenceOutput {
  return output
}

/**
 * Drop the holder without cancelling it. Test teardown only.
 *
 * Deliberately silent: a claim held by a voice built over a torn-down fake
 * context has nothing left to cancel, and calling into it would fail rather
 * than clean up.
 */
export function resetReferenceOutput(): void {
  if (holder) holder.live = false
  holder = null
}
