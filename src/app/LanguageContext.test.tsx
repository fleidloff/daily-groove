import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { useState } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LANGUAGE_STORAGE_KEY } from './language'
import { LanguageProvider, useLanguageContext } from './LanguageContext'

const REAL_STORAGE = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', REAL_STORAGE)
  vi.restoreAllMocks()
})

let reads: string[] = []

function Probe({ name }: { name: string }) {
  const language = useLanguageContext()
  reads.push(language)
  return <p data-testid={name}>{language}</p>
}

function Counter() {
  const [count, setCount] = useState(0)
  useLanguageContext()
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {`clicked ${count}`}
    </button>
  )
}

function languageReads(spy: ReturnType<typeof vi.spyOn<Storage, 'getItem'>>) {
  return spy.mock.calls.filter(([key]) => key === LANGUAGE_STORAGE_KEY)
}

describe('the language context', () => {
  it('throws rather than returning a default outside the provider (R7, AC6a)', () => {
    expect(() => renderHook(() => useLanguageContext())).toThrow(
      /must be used inside <LanguageProvider>/,
    )
  })

  it('hands every consumer under one provider the same language (R7)', () => {
    reads = []

    render(
      <LanguageProvider>
        <Probe name="one" />
        <Probe name="two" />
      </LanguageProvider>,
    )

    expect(screen.getByTestId('one')).toHaveTextContent('en')
    expect(screen.getByTestId('two')).toHaveTextContent('en')
    expect(reads).toHaveLength(2)
    expect(reads[0]).toBe(reads[1])
  })

  it('emits no DOM node of its own (R7a, AC6b)', () => {
    expect(
      renderToString(
        <LanguageProvider>
          <p>x</p>
        </LanguageProvider>,
      ),
    ).toBe(renderToString(<p>x</p>))
  })
})

describe('the language is resolved from storage, once per mount', () => {
  it('goes through the storage adapter rather than past it (R7, AC6)', () => {
    render(
      <LanguageProvider>
        <Probe name="one" />
      </LanguageProvider>,
    )

    expect(screen.getByTestId('one')).toHaveTextContent('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })

  it('reads once per mount, not once per render (R7, AC6)', async () => {
    const getItem = vi.spyOn(localStorage, 'getItem')

    const { rerender } = render(
      <LanguageProvider>
        <Counter />
      </LanguageProvider>,
    )

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('clicked 1')

    rerender(
      <LanguageProvider>
        <Counter />
      </LanguageProvider>,
    )
    rerender(
      <LanguageProvider>
        <Counter />
      </LanguageProvider>,
    )

    expect(languageReads(getItem)).toHaveLength(1)
  })

  it('reads again on the next app start, because a reload is a new mount (R7, AC6)', () => {
    const getItem = vi.spyOn(localStorage, 'getItem')

    const { unmount } = render(
      <LanguageProvider>
        <Probe name="one" />
      </LanguageProvider>,
    )
    expect(languageReads(getItem)).toHaveLength(1)

    unmount()

    render(
      <LanguageProvider>
        <Probe name="one" />
      </LanguageProvider>,
    )
    expect(languageReads(getItem)).toHaveLength(2)
  })
})

describe('hydrating a server pass that resolved a different language', () => {
  it('warns about nothing, because the provider renders no markup (R7a, AC6b)', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('no storage on the server')
      },
    })
    const html = renderToString(
      <LanguageProvider>
        <Probe name="one" />
      </LanguageProvider>,
    )
    Object.defineProperty(globalThis, 'localStorage', REAL_STORAGE)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const before = container.textContent

    const recoverable = vi.fn()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(
        container,
        <LanguageProvider>
          <Probe name="one" />
        </LanguageProvider>,
        { onRecoverableError: recoverable },
      )
    })

    expect(recoverable).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(container.textContent).toBe(before)
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')

    errors.mockRestore()
    await act(async () => {
      root?.unmount()
    })
    container.remove()
  })
})

const SRC = resolve(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('nothing consumes the language yet', () => {
  it('no rendering path reads the language yet (R9) — the translation feature deletes this case', () => {
    const own = ['src/app/LanguageContext.tsx', 'src/app/LanguageContext.test.tsx']
    const files = sourceFiles(SRC)
      .map((path) => relative(process.cwd(), path))
      .filter((path) => !own.includes(path))

    expect(files.length).toBeGreaterThan(100)

    const consumers = files.filter((path) =>
      readFileSync(resolve(process.cwd(), path), 'utf8').includes(
        'useLanguageContext',
      ),
    )
    expect(consumers).toEqual([])
  })
})
