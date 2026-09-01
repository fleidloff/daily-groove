/**
 * What happened when the player pressed share.
 *
 * Four outcomes, exhaustive by construction: the caller renders one of four
 * things and never has to ask a second question about why. `dismissed` is a
 * success, not a failure — the player saw the sheet and closed it (R12).
 */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'manual'

/**
 * The browser capabilities `shareLink` is allowed to use, passed in rather than
 * read from `navigator`.
 *
 * Capability detection is therefore "was a function passed" — never a user-agent
 * sniff (PRD assumption) — which is what makes every branch below testable
 * without shimming a global.
 */
export type ShareDeps = {
  /** navigator.share, bound — or absent when the browser has none. */
  share?: (data: { url: string }) => Promise<void>
  /** navigator.clipboard.writeText, bound — or absent. */
  write?: (text: string) => Promise<void>
}

/**
 * A dismissed share sheet rejects with an `AbortError`.
 *
 * That is the one rejection that does not fall through to the clipboard: the
 * player already had the link in front of them and said no, so copying it
 * behind their back would be the opposite of what they asked for (R12).
 * The `name` is the whole test — Safari and Chrome both reject with a
 * `DOMException`, but nothing guarantees the class, only the name.
 */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

/**
 * Offers `url` to the player by the best route the browser allows, and reports
 * which one it took.
 *
 * The order is the PRD's: the share sheet where there is one (R9), the
 * clipboard where there is not (R10), and the bare URL where neither works
 * (R11, R13). A sheet that fails for any reason other than a dismissal is
 * treated as no sheet at all and falls through to the clipboard, because the
 * player pressed a button and is owed a link either way.
 *
 * It never rejects. Every path a browser can take ends at one of the four
 * outcomes, so a caller needs no `catch` and can hold the result in state.
 *
 * The sheet is given `{ url }` and nothing else — no title, no text (R7a,
 * AC13): nothing to translate, nothing to age, and the receiving app renders
 * its own preview.
 */
export async function shareLink(url: string, deps: ShareDeps): Promise<ShareOutcome> {
  if (deps.share) {
    try {
      await deps.share({ url })
      return 'shared'
    } catch (error) {
      if (isAbort(error)) return 'dismissed'
      // Any other failure means the sheet was no use: try the clipboard.
    }
  }

  if (deps.write) {
    try {
      await deps.write(url)
      return 'copied'
    } catch {
      return 'manual'
    }
  }

  return 'manual'
}

/**
 * The real browser's capabilities, read once at press time.
 *
 * Each function is **bound** to its owner: an unbound `navigator.share` throws
 * on `this`. Neither is looked up during render — this module can be reached
 * from a server render, where there is no `navigator` at all, so the absence of
 * the global is a normal answer (`{}`) rather than an error.
 */
export function browserShareDeps(): ShareDeps {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  if (!nav) return {}

  const deps: ShareDeps = {}

  if (typeof nav.share === 'function') {
    deps.share = nav.share.bind(nav)
  }

  const clipboard = nav.clipboard as Clipboard | undefined
  if (clipboard && typeof clipboard.writeText === 'function') {
    deps.write = clipboard.writeText.bind(clipboard)
  }

  return deps
}
