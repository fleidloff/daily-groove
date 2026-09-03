import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const INDEX = readFileSync(join(process.cwd(), 'specs/features.md'), 'utf8')

describe('specs/features.md', () => {
  it('carries no Bugs section — a bug is briefed into a feature, not listed beside them (F22 E3 R8, AC7)', () => {
    expect(INDEX).not.toMatch(/^## Bugs\b/m)
    expect(INDEX).not.toMatch(/given up · the day is over/)
    expect(INDEX).not.toMatch(/"pick a root" button/i)
  })

  it('keeps the features table followed by the prepared candidates', () => {
    expect(INDEX).toMatch(/^## Prepared candidates$/m)
  })
})
