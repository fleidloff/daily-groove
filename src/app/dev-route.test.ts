import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import nextConfig, { pageExtensionsFor } from '../../next.config'

const DEV_ROUTE_DIR = join(process.cwd(), 'src', 'app', 'dev', 'grooves')

const A_PAGE_NEXT_ALWAYS_BUILDS = /^page\.(tsx|ts|jsx|js|mdx|md)$/

describe('the groove preview is reachable in dev and absent from a build (D1)', () => {
  it('lives at page.dev.tsx, and its folder holds no page a build would pick up', () => {
    expect(existsSync(join(DEV_ROUTE_DIR, 'page.dev.tsx'))).toBe(true)

    const pages = readdirSync(DEV_ROUTE_DIR).filter((name) =>
      A_PAGE_NEXT_ALWAYS_BUILDS.test(name),
    )
    expect(pages).toEqual([])
  })

  it('counts dev.tsx as a page only in development', () => {
    expect(pageExtensionsFor('development')).toContain('dev.tsx')
    expect(pageExtensionsFor('production')).not.toContain('dev.tsx')
  })

  it('keeps every ordinary page resolving as it does now', () => {
    expect(pageExtensionsFor('development')).toContain('tsx')
    expect(pageExtensionsFor('production')).toContain('tsx')
    expect(
      pageExtensionsFor('development').filter((ext) => ext !== 'dev.tsx'),
    ).toEqual(pageExtensionsFor('production'))
  })

  it('carries no dev extension under any env but development', () => {
    expect(process.env.NODE_ENV).not.toBe('development')
    expect(nextConfig.pageExtensions ?? []).toContain('tsx')
    expect(nextConfig.pageExtensions ?? []).not.toContain('dev.tsx')
  })
})
