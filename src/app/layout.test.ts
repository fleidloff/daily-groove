import { existsSync, readFileSync, statSync } from 'node:fs'
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

  it('imports localFont from next/font/local', () => {
    expect(source).toMatch(/import\s+localFont\s+from\s*['"]next\/font\/local['"]/)
  })

  it('reaches no third-party font host', () => {
    expect(source).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(source).not.toMatch(/<link\b/)
  })

  it('loads every face with display: swap', () => {
    const declarations = source.match(/display:\s*['"](\w+)['"]/g) ?? []
    expect(declarations, 'expected one display per font').toHaveLength(3)
    for (const declaration of declarations) {
      expect(declaration).toMatch(/['"]swap['"]/)
    }
  })

  it('exposes the --font-jazz-hand variable', () => {
    expect(source).toContain('--font-jazz-hand')
  })

  it('applies all three font variables to the html element', () => {
    const htmlClassName = source.match(/<html[\s\S]*?className=\{`([^`]*)`\}/)
    expect(htmlClassName, 'no html className template found').not.toBeNull()
    const applied = htmlClassName![1]
    expect(applied).toContain('newsreader.variable')
    expect(applied).toContain('dmSans.variable')
    expect(applied).toContain('jazzHand.variable')
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

describe('the jazz face is vendored into the repo', () => {
  const fontPath = resolve(process.cwd(), 'src/app/fonts/PetalumaScript.woff2')
  const licencePath = resolve(process.cwd(), 'src/app/fonts/OFL.txt')

  it('commits the font file', () => {
    expect(existsSync(fontPath)).toBe(true)
    expect(statSync(fontPath).size).toBeGreaterThan(0)
  })

  it('commits the licence beside it', () => {
    expect(existsSync(licencePath)).toBe(true)
  })

  it('is licensed under the SIL Open Font License', () => {
    expect(readFileSync(licencePath, 'utf8')).toContain('SIL OPEN FONT LICENSE')
  })
})

describe('layout.tsx metadata names the app', () => {
  it('imports the branding constants', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bbranding\b[^}]*\}\s*from\s*['"]@\/lib\/snippets['"]/)
    expect(source).toMatch(/\bappName:\s*APP_NAME\b/)
    expect(source).toMatch(/\btagline:\s*TAGLINE\b/)
  })

  it('sets the document title to APP_NAME', () => {
    expect(source).toMatch(/title:\s*APP_NAME/)
  })

  it('sets the meta description to TAGLINE', () => {
    expect(source).toMatch(/description:\s*TAGLINE/)
  })

  it('no longer names the app Daily Groove', () => {
    expect(source).not.toContain('Daily Groove')
  })

  it('no longer carries the old description sentence', () => {
    expect(source).not.toContain('Guess today')
    expect(source).not.toContain('its scale, chord, and progression')
  })
})
