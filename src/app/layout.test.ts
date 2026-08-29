import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutPath = resolve(process.cwd(), 'src/app/layout.tsx')
const source = readFileSync(layoutPath, 'utf8')

function classNameStrings(code: string): string[] {
  const found: string[] = []
  const re = /className=\{?[`"']([^`"']*)[`"']/g
  let match: RegExpExecArray | null
  while ((match = re.exec(code)) !== null) found.push(match[1])
  return found
}

const LAYOUT_UTILITIES: Array<[string, RegExp]> = [
  ['flex', /(^|[\s:])flex(-|$|\s)/],
  ['grid', /(^|[\s:])grid(-|$|\s)/],
  ['gap', /(^|[\s:])gap(-x|-y)?-/],
  ['padding', /(^|[\s:])p[xytblrse]?-/],
  ['margin', /(^|[\s:])-?m[xytblrse]?-/],
  ['max-width', /(^|[\s:])max-w-/],
  ['width', /(^|[\s:])w-/],
  ['height', /(^|[\s:])(min-|max-)?h-/],
  ['alignment', /(^|[\s:])(items|justify|self|content|place)-/],
  ['space-between', /(^|[\s:])space-[xy]-/],
]

describe('layout.tsx fonts', () => {
  it('imports Newsreader and DM_Sans from next/font/google', () => {
    const importLine = source.match(/import\s*\{([^}]*)\}\s*from\s*['"]next\/font\/google['"]/)
    expect(importLine, 'no next/font/google import found').not.toBeNull()
    const imported = importLine![1].split(',').map((name) => name.trim())
    expect(imported).toContain('Newsreader')
    expect(imported).toContain('DM_Sans')
  })

  it('no longer imports Geist', () => {
    expect(source).not.toMatch(/\bGeist(_Mono)?\b/)
  })

  it('exposes the --font-newsreader and --font-dm-sans variables', () => {
    expect(source).toContain('--font-newsreader')
    expect(source).toContain('--font-dm-sans')
  })

  it('still exports metadata and takes LayoutProps<"/">', () => {
    expect(source).toMatch(/export const metadata\s*:\s*Metadata/)
    expect(source).toMatch(/LayoutProps<"\/">/)
  })
})

describe('layout.tsx holds no layout or spacing classes', () => {
  it.each(LAYOUT_UTILITIES)('uses no %s utility', (_name, pattern) => {
    const offenders = classNameStrings(source).filter((value) => pattern.test(value))
    expect(offenders).toEqual([])
  })
})
