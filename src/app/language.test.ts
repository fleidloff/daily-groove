import { afterEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGE_STORAGE_KEY, readChosenLanguage } from './language'

const REAL_STORAGE = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', REAL_STORAGE)
  vi.restoreAllMocks()
})

describe('the key the chosen language is stored under', () => {
  it('follows the daily-groove:v1:<name> convention (R4)', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('daily-groove:v1:language')
  })
})

describe('nothing stored is written and returned as en', () => {
  it('returns en and leaves en behind (R4, AC2)', () => {
    expect(readChosenLanguage()).toBe('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })

  it('is stable on the next read (R4, AC2)', () => {
    readChosenLanguage()
    expect(readChosenLanguage()).toBe('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })
})

describe('a stored en is returned unchanged', () => {
  it('writes nothing at all (R4, AC3)', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    const setItem = vi.spyOn(localStorage, 'setItem')

    expect(readChosenLanguage()).toBe('en')

    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })
})

const CORRUPT = ['de', 'EN', '', 'en-GB', '{"language":"en"}', '["en"]']

describe('a value the app does not have is repaired', () => {
  it.each(CORRUPT)('resolves %j to en and writes en back (R5, AC4)', (raw) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, raw)

    expect(readChosenLanguage()).toBe('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })

  it('repairs once, then leaves the good value alone (R5, AC3, AC4)', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')
    const setItem = vi.spyOn(localStorage, 'setItem')

    expect(readChosenLanguage()).toBe('en')
    expect(readChosenLanguage()).toBe('en')

    expect(setItem).toHaveBeenCalledTimes(1)
  })
})

describe('the read touches its own key and no other', () => {
  it('leaves the preferences and results envelopes byte-identical (R4)', () => {
    const prefs = '{"simpleMode":true,"tapSounds":false}'
    const results = '{"version":2,"byDate":{}}'
    localStorage.setItem('daily-groove:v1:prefs', prefs)
    localStorage.setItem('daily-groove:v2:results', results)

    readChosenLanguage()
    readChosenLanguage()

    expect(localStorage.getItem('daily-groove:v1:prefs')).toBe(prefs)
    expect(localStorage.getItem('daily-groove:v2:results')).toBe(results)
  })
})

describe('storage that throws', () => {
  it('falls back to en when the accessor itself throws (R6, AC5)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })

    expect(() => readChosenLanguage()).not.toThrow()
    expect(readChosenLanguage()).toBe('en')
  })

  it('falls back to en when there is no storage at all (R6, AC5)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: undefined,
    })

    expect(() => readChosenLanguage()).not.toThrow()
    expect(readChosenLanguage()).toBe('en')
  })

  it('falls back to en when getItem throws, and never writes (R6, AC5)', () => {
    const setItem = vi.fn()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() {
          throw new Error('read')
        },
        setItem,
      },
    })

    expect(() => readChosenLanguage()).not.toThrow()
    expect(readChosenLanguage()).toBe('en')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('swallows a setItem that throws and still returns en (R6, AC5)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem() {
          throw new Error('quota')
        },
      },
    })

    expect(() => readChosenLanguage()).not.toThrow()
    expect(readChosenLanguage()).toBe('en')
  })

  it('still reads normally once the storage is back (R6)', () => {
    expect(readChosenLanguage()).toBe('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })
})
