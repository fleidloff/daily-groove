import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const cssPath = resolve(process.cwd(), 'src/app/globals.css')
const css = readFileSync(cssPath, 'utf8')

function blockBodyAt(source: string, from: number): string {
  const open = source.indexOf('{', from)
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return ''
}

function bodiesOf(source: string, pattern: RegExp): string[] {
  const bodies: string[] = []
  const re = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`)
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    bodies.push(blockBodyAt(source, match.index))
  }
  return bodies
}

function customPropertyNames(body: string): Set<string> {
  const names = new Set<string>()
  const re = /(--[a-z0-9-]+)\s*:/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) names.add(match[1])
  return names
}

const themeBody = bodiesOf(css, /@theme\b[^{]*/).join('\n')
const darkBody = bodiesOf(css, /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/).join('\n')

const CONTRACT_TOKENS = [
  '--color-paper',
  '--color-paper-tint',
  '--color-paper-shade',
  '--color-surface',
  '--color-surface-inset',
  '--color-border',
  '--color-border-strong',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-soft',
  '--color-accent-track',
  '--color-text',
  '--color-text-muted',
  '--color-text-faint',
  '--color-warm',
  '--radius-card',
  '--radius-panel',
  '--radius-control',
  '--radius-chip',
  '--shadow-card',
]

describe('globals.css @theme token layer', () => {
  it('defines an @theme block', () => {
    expect(themeBody.trim()).not.toBe('')
  })

  it('defines every contract token', () => {
    const defined = customPropertyNames(themeBody)
    const missing = CONTRACT_TOKENS.filter((token) => !defined.has(token))
    expect(missing).toEqual([])
  })

  it('maps the display, jazz and body font tokens', () => {
    const defined = customPropertyNames(themeBody)
    expect(defined.has('--font-display')).toBe(true)
    expect(defined.has('--font-jazz')).toBe(true)
    expect(defined.has('--font-sans')).toBe(true)
  })

  it('resolves --font-jazz through the local face and falls back to a serif', () => {
    const declaration = themeBody.match(/--font-jazz\s*:\s*([^;]+);/)
    expect(declaration, 'no --font-jazz declaration found').not.toBeNull()
    const value = declaration![1]
    expect(value).toContain('--font-jazz-hand')
    expect(value).toMatch(/serif\s*$/)
  })

  it('leaves --font-display pointing at the serif', () => {
    const declaration = themeBody.match(/--font-display\s*:\s*([^;]+);/)
    expect(declaration, 'no --font-display declaration found').not.toBeNull()
    expect(declaration![1]).toContain('--font-newsreader')
  })

  it('paints the body from the three paper tokens', () => {
    const bodyRule = blockBodyAt(css, css.search(/^body\s*\{/m))
    expect(bodyRule).toMatch(/radial-gradient/)
    for (const token of ['--color-paper-tint', '--color-paper', '--color-paper-shade']) {
      expect(bodyRule).toContain(`var(${token})`)
    }
  })

  it('carries no leftover scaffold tokens', () => {
    expect(customPropertyNames(themeBody).has('--color-background')).toBe(false)
    expect(customPropertyNames(themeBody).has('--color-foreground')).toBe(false)
  })
})

describe('globals.css dark palette', () => {
  const colorsOnly = (names: Set<string>) =>
    [...names].filter((name) => name.startsWith('--color-')).sort()

  it('defines a prefers-color-scheme: dark block', () => {
    expect(darkBody.trim()).not.toBe('')
  })

  it('redefines exactly the colour tokens declared in @theme', () => {
    expect(colorsOnly(customPropertyNames(darkBody))).toEqual(
      colorsOnly(customPropertyNames(themeBody)),
    )
  })

  it('does not restate palette-independent radius or shadow tokens', () => {
    const darkNames = [...customPropertyNames(darkBody)]
    expect(darkNames.filter((name) => !name.startsWith('--color-'))).toEqual([])
  })

  it('gives every dark colour token a value that differs from its light one', () => {
    const valuesIn = (body: string) => {
      const values = new Map<string, string>()
      const re = /(--color-[a-z0-9-]+)\s*:\s*([^;]+);/gi
      let match: RegExpExecArray | null
      while ((match = re.exec(body)) !== null) values.set(match[1], match[2].trim())
      return values
    }
    const light = valuesIn(themeBody)
    const dark = valuesIn(darkBody)
    const unchanged = [...dark].filter(([name, value]) => light.get(name) === value)
    expect(unchanged).toEqual([])
  })
})

import { readdirSync, statSync } from 'node:fs'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full)
  }
  return out
}

const DESIGN_SYSTEM = sourceFiles('src/components')
const FEATURES = sourceFiles('src/features')

describe('Epic 1 integration guards', () => {
  it('I1: no component or feature file carries a raw hex colour', () => {
    const offenders = [...DESIGN_SYSTEM, ...FEATURES].filter((f) =>
      /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('I2: the design system never imports from features', () => {
    const offenders = DESIGN_SYSTEM.filter((f) =>
      /from ['"](@\/features|\.\.\/features)/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('I3: no file uses a dark: variant — the palette swap does the work', () => {
    const offenders = [...DESIGN_SYSTEM, ...FEATURES].filter((f) =>
      /\bdark:/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('I4: no primitive offers a styling escape hatch', () => {
    const offenders = DESIGN_SYSTEM.filter((f) =>
      /\b(className|style)\s*[?:]|HTMLAttributes|ComponentProps/.test(
        readFileSync(f, 'utf8'),
      ),
    )
    expect(offenders).toEqual([])
  })

  it('I5: the design system carries no domain vocabulary (Epic 2)', () => {
    const DOMAIN =
      /\b(flavour|flavor|groove|chord|progression|bpm|streak|dorian|mixolydian|lydian|phrygian|locrian)\b/i
    const offenders = DESIGN_SYSTEM.filter((f) =>
      DOMAIN.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
