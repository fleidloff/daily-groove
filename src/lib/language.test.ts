import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  resolveLanguage,
} from './language'

const LIB_ROOT = import.meta.dirname
const REPO_ROOT = join(LIB_ROOT, '..', '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'public'])

function sourceFilesUnder(dirs: string[]): string[] {
  const out: string[] = []
  for (const dir of dirs) {
    for (const entry of readdirSync(join(REPO_ROOT, dir), {
      withFileTypes: true,
    })) {
      if (SKIP.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) out.push(...sourceFilesUnder([full]))
      else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) out.push(full)
    }
  }
  return out
}

function specifiersOf(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) found.push(m[1])
  for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(m[1])
  }
  for (const m of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(m[1])
  }
  return found
}

describe('the language vocabulary', () => {
  it('is one exported list holding en', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en'])
  })

  it('defaults to a member of that list, not a second opinion about it', () => {
    expect(DEFAULT_LANGUAGE).toBe('en')
    expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE)
  })

  it('exposes three runtime names and no fourth', async () => {
    const surface = await import('./language')
    expect(Object.keys(surface).sort()).toEqual([
      'DEFAULT_LANGUAGE',
      'SUPPORTED_LANGUAGES',
      'resolveLanguage',
    ])
  })
})

describe('the supported set is declared once', () => {
  it('is the only file in the repo that writes the set down', () => {
    const holders = sourceFilesUnder(['src', 'scripts'])
      .filter((file) => !/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/.test(file))
      .filter((file) =>
        /(\bSUPPORTED_LANGUAGES\b\s*[:=])|(\[\s*['"]en['"]\s*\])/.test(
          readFileSync(join(REPO_ROOT, file), 'utf8'),
        ),
      )
      .map((file) => relative('.', file))
      .sort()
    expect(holders).toEqual(['src/lib/language.ts'])
  })
})

describe('resolveLanguage', () => {
  it('resolves nothing stored to the default', () => {
    expect(resolveLanguage(null)).toBe('en')
    expect(resolveLanguage(null)).toBe(DEFAULT_LANGUAGE)
  })

  it('returns a supported value identically, so nothing needs repairing', () => {
    expect(resolveLanguage('en')).toBe('en')
    expect(resolveLanguage('en') !== 'en').toBe(false)
  })

  it('holds for the whole list, so a resolver that ignores its argument goes red the day a second language is added', () => {
    for (const tag of SUPPORTED_LANGUAGES) {
      expect(resolveLanguage(tag)).toBe(tag)
      expect(resolveLanguage(tag) !== tag).toBe(false)
    }
  })

  it.each([
    'de',
    'EN',
    '',
    'en-GB',
    ' en',
    'fr',
    '0',
    'null',
    '{"language":"en"}',
    '["en"]',
    'undefined',
  ])('resolves %j to the default and fires the repair predicate', (raw) => {
    expect(resolveLanguage(raw)).toBe('en')
    expect(resolveLanguage(raw) !== raw).toBe(true)
  })

  it('resolves a non-string forced past the type to the default', () => {
    expect(resolveLanguage(0 as unknown as string)).toBe('en')
    expect(resolveLanguage(undefined as unknown as string)).toBe('en')
    expect(resolveLanguage({ language: 'en' } as unknown as string)).toBe('en')
    expect(resolveLanguage(['en'] as unknown as string)).toBe('en')
  })
})

describe('src/lib/language.ts is pure', () => {
  const source = readFileSync(join(LIB_ROOT, 'language.ts'), 'utf8')

  it('imports nothing at all, aliased or relative', () => {
    expect(source).not.toMatch(/^\s*(import|export)\s+.*\bfrom\b/m)
    expect(source).not.toMatch(/\brequire\s*\(/)
    expect(specifiersOf(source)).toEqual([])
  })

  it('clears docs/coding-guidelines.md §Shared code: pure, dependency-free, runtime-safe (R1)', () => {
    for (const forbidden of [
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bdocument\b/,
      /\bwindow\b/,
      /\bnavigator\b/,
      /['"]use client['"]/,
      /\breact\b/i,
    ]) {
      expect(source).not.toMatch(forbidden)
    }
  })
})

describe('the generator does not reach the language module', () => {
  it('names neither the pure half nor its app-side adapter anywhere under scripts/', () => {
    const files = sourceFilesUnder(['scripts']).filter((file) =>
      file.endsWith('.ts'),
    )
    expect(files.length).toBeGreaterThan(40)

    const offenders: string[] = []
    for (const file of files) {
      for (const specifier of specifiersOf(
        readFileSync(join(REPO_ROOT, file), 'utf8'),
      )) {
        if (
          specifier.includes('src/lib/language') ||
          specifier.includes('src/app/language') ||
          specifier.includes('src/app/LanguageContext')
        ) {
          offenders.push(`${file} imports ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
