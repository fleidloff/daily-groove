export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'manual'

export type ShareDeps = {
  share?: (data: { url: string }) => Promise<void>
  write?: (text: string) => Promise<void>
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

export async function shareLink(url: string, deps: ShareDeps): Promise<ShareOutcome> {
  if (deps.share) {
    try {
      await deps.share({ url })
      return 'shared'
    } catch (error) {
      if (isAbort(error)) return 'dismissed'
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
