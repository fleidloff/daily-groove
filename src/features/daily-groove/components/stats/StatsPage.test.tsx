import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Root } from '../../types'
import type { Stats } from '../../lib/stats/types'
import { createLocalStore } from '../../lib/persistence/storage'
import { StatsPage } from './StatsPage'

const STATS: Stats = {
  puzzlesPlayed: 37,
  streak: 6,
  attempts: {
    all: { '1': 4, '2': 7, '3': 9, '4': 5, '5': 3, '6+': 1, revealed: 8 },
    last7: { '1': 1, '2': 2, '3': 2, '4': 0, '5': 1, '6+': 0, revealed: 1 },
  },
  solved: 29,
  revealed: 8,
}

function playedOn(date: string, guesses: number): DailyResult {
  const root: Root = 'C'
  return {
    date,
    answer: { root, flavour: 'Dorian' },
    attempts: Array.from({ length: guesses }, () => ({
      root,
      flavour: 'Dorian',
      correct: false,
      rootMatched: false,
      flavourMatched: false,
    })),
    solved: true,
  }
}

async function seed(...results: DailyResult[]): Promise<void> {
  const store = createLocalStore()
  for (const result of results) await store.save(result)
}

function respondWith(stats: Stats) {
  return {
    ok: true,
    status: 200,
    json: async () => stats,
  } as unknown as Response
}

const READABLE_ATTRIBUTES = [
  'aria-label',
  'title',
  'alt',
  'aria-description',
  'aria-valuetext',
  'aria-valuenow',
  'aria-roledescription',
]

function everythingTheReaderCanReach(container: HTMLElement): string {
  const attributes = [...container.querySelectorAll('*')].flatMap((element) =>
    READABLE_ATTRIBUTES.map((name) => element.getAttribute(name) ?? ''),
  )
  return [container.textContent ?? '', ...attributes].join(' ')
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StatsPage — the numbers it was given', () => {
  beforeEach(async () => {
    await seed(playedOn('2026-09-10', 3), playedOn('2026-09-09', 2))
    fetchMock.mockResolvedValue(respondWith(STATS))
  })

  it('posts the saved results to the stats route, once', async () => {
    render(<StatsPage />)

    await screen.findByTestId('attempt-bars')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/stats')
    expect(init.method).toBe('POST')
    const sent = JSON.parse(String(init.body))
    expect(sent.results).toHaveLength(2)
    expect(sent.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows the puzzles played off the response', async () => {
    render(<StatsPage />)

    const played = await screen.findByTestId('puzzles-played')
    expect(played.textContent ?? '').toContain('37')
  })

  it('renders the seven attempt buckets', async () => {
    render(<StatsPage />)

    const rows = within(await screen.findByTestId('attempt-bars')).getAllByRole(
      'listitem',
    )
    expect(rows).toHaveLength(7)
  })

  it('flips the window without a second request', async () => {
    const user = userEvent.setup()
    render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))

    expect(
      within(screen.getByTestId('attempt-bars')).getAllByRole('listitem')[2]
        .textContent,
    ).toBe('32')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('governs the bars and nothing else', async () => {
    const user = userEvent.setup()
    render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    const elsewhere = () => [
      screen.getByTestId('puzzles-played').textContent,
      screen.getByTestId('solved-count').textContent,
      screen.getByTestId('revealed-count').textContent,
    ]
    const before = elsewhere()

    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect(elsewhere()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'All data' }))
    expect(elsewhere()).toEqual(before)
  })

  it('shows the current streak off the response, in the top card', async () => {
    render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    expect(screen.getByTestId('streak-count').textContent).toBe('6')
    expect(screen.getByTestId('solved-revealed')).toContainElement(
      screen.getByTestId('streak-count'),
    )
  })

  it('keeps solved and revealed in the puzzles-played card', async () => {
    render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    const played = screen.getByTestId('puzzles-played')
    const counts = screen.getByTestId('solved-revealed')
    const card = played.closest('div[class*="rounded-card"]')

    expect(card).not.toBeNull()
    expect(card).toContainElement(counts)
    expect(screen.getByTestId('attempt-bars').closest('div[class*="rounded-card"]')).not.toBe(card)
  })

  it('names no mode anywhere on the page', async () => {
    const { container } = render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    expect(everythingTheReaderCanReach(container)).not.toMatch(
      /Dorian|Lydian|Locrian|Aeolian|Ionian|Mixolydian|Phrygian/,
    )
  })

  it('renders solved and revealed as two counts', async () => {
    render(<StatsPage />)

    const card = within(await screen.findByTestId('solved-revealed'))
    expect(card.getByTestId('solved-count').textContent).toBe('29')
    expect(card.getByTestId('revealed-count').textContent).toBe('8')
  })

  it('states no percentage anywhere on the page', async () => {
    const { container } = render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    expect(everythingTheReaderCanReach(container)).not.toContain('%')
  })

  it('counts no days missed, no best streak and no rank', async () => {
    const { container } = render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    const text = everythingTheReaderCanReach(container)
    expect(text).not.toMatch(/missed/i)
    expect(text).not.toMatch(/best streak/i)
    expect(text).not.toMatch(/\brank\b|\blevel\b/i)
  })

  it('is the full page from the second puzzle on', async () => {
    fetchMock.mockResolvedValue(
      respondWith({ ...STATS, puzzlesPlayed: 2, solved: 1, revealed: 1 }),
    )
    render(<StatsPage />)

    await screen.findByTestId('attempt-bars')
    expect(screen.getByTestId('puzzles-played').textContent).toContain('2')
    expect(screen.getByTestId('solved-revealed')).toBeInTheDocument()
    expect(screen.queryByTestId('stats-day-one')).toBeNull()
  })
})

describe('StatsPage — before the numbers arrive', () => {
  it('shows a skeleton and no spinner while the request is in flight', async () => {
    await seed(playedOn('2026-09-10', 3), playedOn('2026-09-09', 2))
    fetchMock.mockReturnValue(new Promise<Response>(() => {}))

    const { container } = render(<StatsPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('stats-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(container.querySelector('[class*="spin"]')).toBeNull()
    expect(screen.queryByTestId('attempt-bars')).toBeNull()
  })

  it('keeps the heading and the way back readable behind the skeleton', async () => {
    await seed(playedOn('2026-09-10', 3), playedOn('2026-09-09', 2))
    fetchMock.mockReturnValue(new Promise<Response>(() => {}))

    render(<StatsPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/')
  })
})

describe('StatsPage — when the request fails', () => {
  beforeEach(async () => {
    await seed(playedOn('2026-09-10', 3), playedOn('2026-09-09', 2))
  })

  it('shows one quiet line, a retry and a link back to the puzzle', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    render(<StatsPage />)

    const message = await screen.findByTestId('stats-failed')
    expect(message.textContent ?? '').toMatch(/couldn’t work out your stats/i)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(
      screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/'),
    ).toBe(true)
  })

  it('treats a non-200 answer as a failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response)

    render(<StatsPage />)

    expect(await screen.findByTestId('stats-failed')).toBeInTheDocument()
  })

  it('asks again when the retry is pressed', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    fetchMock.mockResolvedValue(respondWith(STATS))

    render(<StatsPage />)

    await screen.findByTestId('stats-failed')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByTestId('attempt-bars')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('StatsPage — nothing played yet', () => {
  it('shows one line pointing at the puzzle and sends no request', async () => {
    render(<StatsPage />)

    const empty = await screen.findByTestId('stats-empty')
    expect(empty.textContent ?? '').toMatch(/nothing to count yet/i)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/'),
    ).toBe(true)
  })

  it('renders no bars and no counts', async () => {
    render(<StatsPage />)

    await screen.findByTestId('stats-empty')
    expect(screen.queryByTestId('attempt-bars')).toBeNull()
    expect(screen.queryByTestId('solved-revealed')).toBeNull()
    expect(screen.queryByTestId('stats-skeleton')).toBeNull()
  })
})

describe('StatsPage — day one', () => {
  const dayOne: Stats = {
    puzzlesPlayed: 1,
    streak: 1,
    attempts: {
      all: { '1': 0, '2': 0, '3': 1, '4': 0, '5': 0, '6+': 0, revealed: 0 },
      last7: { '1': 0, '2': 0, '3': 1, '4': 0, '5': 0, '6+': 0, revealed: 0 },
    },
    solved: 1,
    revealed: 0,
  }

  beforeEach(async () => {
    await seed(playedOn('2026-09-10', 3))
  })

  it('is one line, read off the response', async () => {
    fetchMock.mockResolvedValue(respondWith(dayOne))

    render(<StatsPage />)

    const line = await screen.findByTestId('stats-day-one')
    expect(line.textContent ?? '').toContain('One puzzle so far, solved in 3')
  })

  it('still sends the request', async () => {
    fetchMock.mockResolvedValue(respondWith(dayOne))

    render(<StatsPage />)

    await screen.findByTestId('stats-day-one')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders no bars and no solved/revealed counts', async () => {
    fetchMock.mockResolvedValue(respondWith(dayOne))

    render(<StatsPage />)

    await screen.findByTestId('stats-day-one')
    expect(screen.queryByTestId('attempt-bars')).toBeNull()
    expect(screen.queryByTestId('solved-revealed')).toBeNull()
    expect(screen.queryByTestId('puzzles-played')).toBeNull()
  })

  it('offers the way back to today’s groove', async () => {
    fetchMock.mockResolvedValue(respondWith(dayOne))

    render(<StatsPage />)

    await screen.findByTestId('stats-day-one')
    expect(
      screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/'),
    ).toBe(true)
  })

  it('names no groove', async () => {
    fetchMock.mockResolvedValue(respondWith(dayOne))

    const { container } = render(<StatsPage />)

    await screen.findByTestId('stats-day-one')
    expect(container.textContent ?? '').not.toMatch(/dorian|ionian|lydian/i)
  })

  it('says the one puzzle was revealed when it was', async () => {
    fetchMock.mockResolvedValue(
      respondWith({
        ...dayOne,
        attempts: {
          all: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0, revealed: 1 },
          last7: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0, revealed: 1 },
        },
        solved: 0,
        revealed: 1,
      }),
    )

    render(<StatsPage />)

    const line = await screen.findByTestId('stats-day-one')
    expect(line.textContent ?? '').toMatch(/one puzzle so far, revealed/i)
  })
})
