import { describe, it, expect, vi, afterEach } from 'vitest'
import { shareLink, browserShareDeps } from './share'

const LINK = 'https://x.test/groove/u'

type ShareFn = (data: { url: string }) => Promise<void>
type WriteFn = (text: string) => Promise<void>

/** A share sheet that opens and completes. */
function openingSheet() {
  return vi.fn<ShareFn>(() => Promise.resolve())
}

/** A share sheet the player dismisses: the browser rejects with an AbortError. */
function dismissedSheet() {
  return vi.fn<ShareFn>(() =>
    Promise.reject(new DOMException('Share canceled', 'AbortError')),
  )
}

/** A share sheet that fails for some other reason. */
function failingSheet(error: unknown) {
  return vi.fn<ShareFn>(() => Promise.reject(error))
}

/** A clipboard that accepts the write. */
function workingClipboard() {
  return vi.fn<WriteFn>(() => Promise.resolve())
}

/** A clipboard the browser refuses — no permission, or no clipboard at all. */
function refusingClipboard() {
  return vi.fn<WriteFn>(() =>
    Promise.reject(new Error('Write permission denied')),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shareLink', () => {
  describe('with a share sheet', () => {
    it('opens the sheet with the link and reports it shared (R9, AC4)', async () => {
      const share = openingSheet()

      await expect(shareLink(LINK, { share })).resolves.toBe('shared')
      expect(share).toHaveBeenCalledTimes(1)
      expect(share).toHaveBeenCalledWith({ url: LINK })
    })

    it('gives the sheet the URL alone — no title and no text (R7a, AC13)', async () => {
      const share = openingSheet()

      await shareLink(LINK, { share })

      const data = share.mock.calls[0][0]
      expect(Object.keys(data)).toEqual(['url'])
      expect(data).not.toHaveProperty('title')
      expect(data).not.toHaveProperty('text')
    })

    it('prefers the sheet over the clipboard when both are available (R9)', async () => {
      const share = openingSheet()
      const write = workingClipboard()

      await expect(shareLink(LINK, { share, write })).resolves.toBe('shared')
      expect(write).not.toHaveBeenCalled()
    })

    it('reports a dismissed sheet as dismissed, and copies nothing (R12, AC7)', async () => {
      const share = dismissedSheet()
      const write = workingClipboard()

      await expect(shareLink(LINK, { share, write })).resolves.toBe('dismissed')
      expect(write).not.toHaveBeenCalled()
    })

    it('treats any error named AbortError as a dismissal, not only a DOMException (R12)', async () => {
      const aborted = new Error('Abort due to cancellation of share')
      aborted.name = 'AbortError'
      const share = failingSheet(aborted)
      const write = workingClipboard()

      await expect(shareLink(LINK, { share, write })).resolves.toBe('dismissed')
      expect(write).not.toHaveBeenCalled()
    })

    it('falls through to the clipboard when the sheet fails for another reason (R10, R13)', async () => {
      const share = failingSheet(
        new DOMException('Permission denied', 'NotAllowedError'),
      )
      const write = workingClipboard()

      await expect(shareLink(LINK, { share, write })).resolves.toBe('copied')
      expect(write).toHaveBeenCalledWith(LINK)
    })

    it('hands the URL over when a failed sheet is followed by a refusing clipboard (R11, R13, AC6)', async () => {
      const share = failingSheet(new Error('sheet is broken'))
      const write = refusingClipboard()

      await expect(shareLink(LINK, { share, write })).resolves.toBe('manual')
      expect(write).toHaveBeenCalledWith(LINK)
    })
  })

  describe('without a share sheet', () => {
    it('copies the link to the clipboard (R10, R14, AC5)', async () => {
      const write = workingClipboard()

      await expect(shareLink(LINK, { write })).resolves.toBe('copied')
      expect(write).toHaveBeenCalledTimes(1)
      expect(write).toHaveBeenCalledWith(LINK)
    })

    it('reports manual when there is no clipboard either (R11, AC6)', async () => {
      await expect(shareLink(LINK, {})).resolves.toBe('manual')
    })

    it('reports manual when the clipboard write is refused (R11, R13, AC6)', async () => {
      const write = refusingClipboard()

      await expect(shareLink(LINK, { write })).resolves.toBe('manual')
      expect(write).toHaveBeenCalledWith(LINK)
    })

    it('never rejects, whatever the browser does (R12, R13)', async () => {
      const share = failingSheet(new Error('boom'))
      const write = refusingClipboard()

      await expect(shareLink(LINK, { share, write })).resolves.toBeTypeOf('string')
    })
  })
})

describe('browserShareDeps', () => {
  it('reports no capabilities when the browser has neither API (R9, R10)', () => {
    vi.stubGlobal('navigator', {})

    expect(browserShareDeps()).toEqual({})
  })

  it('reports no clipboard when the clipboard cannot write (R10)', () => {
    vi.stubGlobal('navigator', { clipboard: {} })

    expect(browserShareDeps().write).toBeUndefined()
  })

  it('passes both APIs through, bound to their owners (R9, R10)', async () => {
    const shared: { url: string }[] = []
    const written: string[] = []
    const clipboard = {
      writeText(this: unknown, text: string) {
        if (this !== clipboard) throw new TypeError('Illegal invocation')
        written.push(text)
        return Promise.resolve()
      },
    }
    const nav = {
      clipboard,
      share(this: unknown, data: { url: string }) {
        if (this !== nav) throw new TypeError('Illegal invocation')
        shared.push(data)
        return Promise.resolve()
      },
    }
    vi.stubGlobal('navigator', nav)

    const deps = browserShareDeps()
    expect(deps.share).toBeTypeOf('function')
    expect(deps.write).toBeTypeOf('function')

    // Unbound, each of these would throw on `this`.
    await deps.share?.({ url: LINK })
    await deps.write?.(LINK)

    expect(shared).toEqual([{ url: LINK }])
    expect(written).toEqual([LINK])
  })

  it('does not throw where there is no navigator at all — a server render (R9, R10)', () => {
    vi.stubGlobal('navigator', undefined)

    expect(() => browserShareDeps()).not.toThrow()
    expect(browserShareDeps()).toEqual({})
  })
})
