import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FLOOR_RULES, findMissingFloorRules } from './agent-floor.ts'

describe('FLOOR_RULES', () => {
  it('declares a floor at all', () => {
    expect(FLOOR_RULES.length).toBeGreaterThan(0)
  })

  it('gives every rule an id, a pattern and a reason', () => {
    for (const rule of FLOOR_RULES) {
      expect(rule.id).toMatch(/^[a-z][a-z-]+$/)
      expect(rule.mustMatch).toBeInstanceOf(RegExp)
      expect(rule.why.length).toBeGreaterThan(0)
    }
  })

  it('names the document each rule comes from', () => {
    // A floor rule nobody can trace back to a doc is a rule this file invented,
    // and `docs/coding-guidelines.md` stays the single source of truth.
    for (const rule of FLOOR_RULES) {
      expect(rule.why).toMatch(/docs\/(architecture|coding-guidelines)\.md/)
    }
  })

  it('gives every rule a distinct id', () => {
    expect(new Set(FLOOR_RULES.map((rule) => rule.id)).size).toBe(
      FLOOR_RULES.length,
    )
  })
})

/**
 * A definition carrying all six floor rules, worded as a definition would word
 * them rather than copied from `FLOOR_RULES` — the patterns are meant to match
 * the substance, so the fixture has to be prose.
 *
 * It names no path under the feature tree: `scripts/grooves/boundary.test.ts`
 * string-scans every `.ts` file under `scripts/` and fails on that literal.
 */
const COMPLETE = `---
name: complete
description: A definition that carries the whole floor.
---

# Complete

## The placement floor

1. **A feature slice is reached only through its \`index.ts\`.** No consumer —
   route, sibling, test, script — imports a path inside a feature folder other
   than that index.
2. **No feature imports another feature, not even its \`index.ts\`.** There is no
   sideways arrow; anything two slices both need moves up instead.
3. **\`src/lib/\` is a leaf: it imports nothing from the app**, and it is the only
   channel \`scripts/\` has into \`src/\`.
4. **A test sits beside the thing it tests.** Colocation is the rule.
5. **The import boundaries bind test files exactly as they bind source**, and a
   \`vi.mock\` of a cross-boundary path is the same violation wearing setup's
   clothes.
6. **A feature must stay removable.** Deleting a feature folder, deleting its
   route folder and removing its one registration entry leaves an app that still
   builds.
`

/**
 * `COMPLETE` states the six rules as a numbered list, in `FLOOR_RULES` order.
 * Dropping item `n` drops exactly the rule `FLOOR_RULES[n - 1]` names.
 */
function withoutRule(source: string, n: number): string {
  const item = new RegExp(`^${n}\\. [\\s\\S]*?(?=^${n + 1}\\. |^$)`, 'm')
  const out = source.replace(item, '')
  if (out === source) throw new Error(`item ${n} was not in the fixture`)
  return out
}

/** The same definition with rule 4 — and only rule 4 — struck out. */
const INCOMPLETE = withoutRule(COMPLETE, 4).replace(
  'name: complete',
  'name: incomplete',
)

describe('findMissingFloorRules', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-floor-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('names the definition and the rule it is missing, and nothing else', () => {
    writeFileSync(join(dir, 'complete.md'), COMPLETE)
    writeFileSync(join(dir, 'incomplete.md'), INCOMPLETE)

    expect(findMissingFloorRules(dir)).toEqual([
      'incomplete.md: tests-colocated',
    ])
  })

  it.each(FLOOR_RULES.map((rule, index) => [index + 1, rule.id] as const))(
    'catches rule %i, %s, when it alone is struck out',
    (n, id) => {
      // AC17, one rule at a time. A pattern that cannot notice its own rule
      // being deleted reports the floor as carried forever, which is worse
      // than no guard at all — so each of the six is deleted in turn.
      writeFileSync(join(dir, 'complete.md'), withoutRule(COMPLETE, n))

      expect(findMissingFloorRules(dir)).toEqual([`complete.md: ${id}`])
    },
  )

  it('passes a directory whose definitions all carry the floor', () => {
    writeFileSync(join(dir, 'complete.md'), COMPLETE)
    writeFileSync(join(dir, 'also-complete.md'), COMPLETE)

    expect(findMissingFloorRules(dir)).toEqual([])
  })

  it('refuses a directory with no definitions in it rather than passing', () => {
    // A guard on the guard. If an empty or missing directory answered `[]`,
    // the assertion below about the real definitions would pass while there
    // were no definitions at all — the one way this test could report a floor
    // that nobody carries.
    expect(() => findMissingFloorRules(dir)).toThrow(/no agent definitions/i)
    expect(() => findMissingFloorRules(join(dir, 'absent'))).toThrow(
      /no agent definitions/i,
    )
  })
})

/**
 * The floor is only real if the five definitions carry it. This reads them from
 * disk rather than trusting that five markdown files agree by inspection, and
 * it is the checklist the definitions are written against: every entry it
 * returns is a rule missing from a file, named.
 */
describe('the definitions carry the floor', () => {
  const AGENTS = '.claude/agents'

  /** R1's five roles. `findMissingFloorRules` grades the files it finds, so a
   * definition that does not exist yet is not a rule it can report missing —
   * which is why the roster is asserted here rather than folded into the
   * function, whose fixture contract is to judge exactly the directory it is
   * given. */
  const ROLES = [
    'architect',
    'implementer',
    'musician',
    'test-writer',
    'verifier',
  ]

  it('has a definition for each of the five roles', () => {
    expect(
      readdirSync(AGENTS)
        .filter((name) => name.endsWith('.md'))
        .sort(),
    ).toEqual(ROLES.map((role) => `${role}.md`))
  })

  it('leaves no floor rule missing from any definition', () => {
    expect(findMissingFloorRules(AGENTS)).toEqual([])
  })
})
