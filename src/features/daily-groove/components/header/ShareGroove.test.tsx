import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { header } from '@/lib/snippets'
import { ShareGroove } from './ShareGroove'
import type { Groove } from '../../types'

const GROOVE: Groove = {
  id: 'groove-07',
  uuid: '61607a6c-3f9e-4fd7-9724-99ea22d32e4a',
  audioSrc: '/grooves/groove-07.mp3',
  name: 'Test Groove',
  bpm: 96,
  root: 'F♯',
  flavour: 'Dorian',
  bars: 4,
  scale: 'F♯ Dorian',
  chord: 'F♯m7',
  progression: 'F♯m–Bm–C♯7',
  headDelaySeconds: 0.025057,
}

const ORIGIN = 'https://x.test'
const LINK = `${ORIGIN}/groove/${GROOVE.uuid}`

const shareControl = () => screen.getByRole('button', { name: header.share })
const liveRegion = () => document.querySelector('[aria-live="polite"]')

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function press() {
  await act(async () => {
    fireEvent.click(shareControl())
  })
  await settle()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ShareGroove (F12 E2)', () => {
  it("offers this groove's link, and the same one every time (R3, R8, AC2)", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith({ url: LINK })

    await user.click(shareControl())
    await settle()

    expect(share).toHaveBeenCalledTimes(2)
    expect(share.mock.calls[1][0]).toEqual({ url: LINK })
  })

  it('gives the link nothing about the answer to carry (R7, AC3)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    const offered = (share.mock.calls[0][0] as { url: string }).url
    expect(offered).toBe(`${ORIGIN}/groove/${GROOVE.uuid}`)
    for (const secret of [
      GROOVE.root,
      GROOVE.flavour,
      GROOVE.scale,
      GROOVE.chord,
      GROOVE.progression,
      GROOVE.name,
      GROOVE.id,
    ]) {
      expect(offered).not.toContain(secret)
    }
  })

  it("reads the page's own origin when none is given (R3)", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    expect(share).toHaveBeenCalledWith({
      url: `${window.location.origin}/groove/${GROOVE.uuid}`,
    })
  })

  it('shows nothing extra when the sheet took the link (R14)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    expect(screen.queryByText(header.linkCopied)).toBeNull()
    expect(screen.queryByText(LINK)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('copies the link from the keyboard alone, and announces it (R6, R14, AC5, AC9)', async () => {
    const user = userEvent.setup()
    const write = vi.fn().mockResolvedValue(undefined)
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />)

    expect(liveRegion()).not.toBeNull()

    await user.tab()
    expect(shareControl()).toHaveFocus()
    await user.keyboard('{Enter}')
    await settle()

    expect(write).toHaveBeenCalledWith(LINK)
    const confirmation = screen.getByText(header.linkCopied)
    expect(confirmation.closest('[aria-live="polite"]')).not.toBeNull()

    expect(shareControl()).toHaveFocus()
    expect(shareControl()).toHaveAccessibleName(header.share)
    await user.keyboard('{Enter}')
    await settle()
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('clears the confirmation on its own, without a second press (R14, AC5)', async () => {
    vi.useFakeTimers()
    const write = vi.fn().mockResolvedValue(undefined)
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />)

    await press()
    expect(screen.getByText(header.linkCopied)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.queryByText(header.linkCopied)).toBeNull()
    expect(liveRegion()).not.toBeNull()
    expect(shareControl()).toBeInTheDocument()

    await press()
    expect(screen.getByText(header.linkCopied)).toBeInTheDocument()
  })

  it('leaves no timer behind when it is unmounted mid-confirmation (R6)', async () => {
    vi.useFakeTimers()
    const write = vi.fn().mockResolvedValue(undefined)
    const view = render(
      <ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />,
    )

    await press()
    expect(screen.getByText(header.linkCopied)).toBeInTheDocument()

    view.unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('hands the URL over when the clipboard refuses (R11, R13, AC6)', async () => {
    const user = userEvent.setup()
    const write = vi.fn().mockRejectedValue(new Error('denied'))
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />)

    await user.click(shareControl())
    await settle()

    const shown = screen.getByText(LINK)
    expect(shown).toBeInTheDocument()
    expect(shown.className).toContain('select-all')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hands the URL over when the browser offers nothing at all (R11, AC6)', async () => {
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{}} />)

    await user.click(shareControl())
    await settle()

    expect(screen.getByText(LINK)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the offered URL on screen instead of clearing it (R11)', async () => {
    vi.useFakeTimers()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{}} />)

    await press()
    expect(screen.getByText(LINK)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByText(LINK)).toBeInTheDocument()
  })

  it('says nothing at all when the sheet is dismissed (R12, AC7)', async () => {
    const user = userEvent.setup()
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    const write = vi.fn().mockResolvedValue(undefined)
    render(
      <ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share, write }} />,
    )

    await user.click(shareControl())
    await settle()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(header.linkCopied)).toBeNull()
    expect(screen.queryByText(LINK)).toBeNull()
    expect(write).not.toHaveBeenCalled()

    expect(shareControl()).toBeEnabled()
    await user.click(shareControl())
    await settle()
    expect(share).toHaveBeenCalledTimes(2)
  })

  it('says "Share" whatever has just happened (R2, AC1)', async () => {
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{}} />)

    expect(shareControl()).toHaveAccessibleName(header.share)
    await user.click(shareControl())
    await settle()

    expect(shareControl()).toHaveAccessibleName(header.share)
  })
})
