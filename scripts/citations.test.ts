import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { checkCitations, parseCitations } from './citations.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..')

const ONE_ROW = `## Acceptance criteria

| AC | Status | Evidence |
| :-- | :-- | :-- |
| AC1 | done | \`src/lib/hash.test.ts\` — "hashes a known string" |
`

const GRADED = `## Acceptance criteria

| AC | Status | Evidence |
| :-- | :-- | :-- |
| AC1 | done | \`src/lib/hash.test.ts\` — "hashes a known string" |
| AC2 | partly | happy path only; the empty-note case in R3 is unasserted |
| AC3 | not done | |
`

const CLEAN = `## Acceptance criteria

| AC | Status | Evidence |
| :-- | :-- | :-- |
| AC1 | done | \`src/lib/hash.test.ts\` — "returns a non-negative 32-bit integer" |
| AC2 | done | \`src/lib/groove.test.ts\` — "accepts a fully-populated Groove literal" |
| AC3 | partly | implemented; awaiting a listening sign-off |

Totals: 2 done · 1 partly · 0 not done

## Checks

| Check | Result | Notes |
| :-- | :-- | :-- |
| Type check | pass | |
| Lint | pass | |
`

describe('parseCitations', () => {
  it('reads the AC, the file and the test name out of a graded row', () => {
    expect(parseCitations(ONE_ROW)).toEqual([
      {
        ac: 'AC1',
        file: 'src/lib/hash.test.ts',
        testName: 'hashes a known string',
      },
    ])
  })

  it('cites only the rows graded done', () => {
    expect(parseCitations(GRADED).map((citation) => citation.ac)).toEqual([
      'AC1',
    ])
  })

  it('leaves a partly row uncited — R17a\'s listening sign-off has no test to cite', () => {
    expect(
      parseCitations(GRADED).some((citation) => citation.ac === 'AC2'),
    ).toBe(false)
  })
})

describe('checkCitations', () => {
  it('names a citation whose file does not exist', () => {
    expect(
      checkCitations(
        [{ ac: 'AC1', file: 'src/lib/nope.test.ts', testName: 'x' }],
        REPO_ROOT,
      ),
    ).toEqual([
      {
        citation: { ac: 'AC1', file: 'src/lib/nope.test.ts', testName: 'x' },
        reason: 'no-file',
      },
    ])
  })

  it('names a citation whose test name is not in the file it cites', () => {
    expect(
      checkCitations(
        [
          {
            ac: 'AC4',
            file: 'src/lib/hash.test.ts',
            testName: 'hashes a known string',
          },
        ],
        REPO_ROOT,
      ),
    ).toEqual([
      {
        citation: {
          ac: 'AC4',
          file: 'src/lib/hash.test.ts',
          testName: 'hashes a known string',
        },
        reason: 'no-test',
      },
    ])
  })

  it('accepts a citation whose test name is in the file it cites', () => {
    expect(
      checkCitations(
        [
          {
            ac: 'AC4',
            file: 'src/lib/hash.test.ts',
            testName: 'returns a non-negative 32-bit integer',
          },
        ],
        REPO_ROOT,
      ),
    ).toEqual([])
  })

  it('returns nothing for a report whose citations all resolve', () => {
    const citations = parseCitations(CLEAN)
    expect(citations).toHaveLength(2)
    expect(checkCitations(citations, REPO_ROOT)).toEqual([])
  })

  it('resolves a citation that carries a line number', () => {
    expect(
      checkCitations(
        [
          {
            ac: 'AC1',
            file: 'src/lib/hash.test.ts:30',
            testName: 'returns a non-negative 32-bit integer',
          },
        ],
        REPO_ROOT,
      ),
    ).toEqual([])
  })
})

describe('the declaration shapes a citation may name', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'citations-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const cite = (testName: string) =>
    checkCitations([{ ac: 'AC1', file: 'suite.test.ts', testName }], root)

  const SUITE = `import { describe, expect, it, test } from 'vitest'

describe('a suite', () => {
  it('is declared plainly', () => {})

  test('is declared as a test', () => {})

  it.each(CASES)('is declared over a table', () => {})

  it.each(rows.map((row) => [row.id, row.name] as const))(
    'is declared over a mapped table',
    () => {},
  )

  it('quotes "a phrase" inside its name', () => {})
})
`

  it.each([
    'is declared plainly',
    'is declared as a test',
    'is declared over a table',
    'is declared over a mapped table',
  ])('resolves a citation naming a test that %s', (testName) => {
    writeFileSync(join(root, 'suite.test.ts'), SUITE)

    expect(cite(testName)).toEqual([])
  })

  it('does not resolve a name the file never declares', () => {
    writeFileSync(join(root, 'suite.test.ts'), SUITE)

    expect(cite('is declared nowhere')).toEqual([
      {
        citation: {
          ac: 'AC1',
          file: 'suite.test.ts',
          testName: 'is declared nowhere',
        },
        reason: 'no-test',
      },
    ])
  })

  it('does not mistake a string in a test body for a declaration', () => {
    writeFileSync(
      join(root, 'suite.test.ts'),
      `it('is the only declaration', () => {\n  expect(x).toBe('not a test name')\n})\n`,
    )

    expect(cite('not a test name')).toEqual([
      {
        citation: {
          ac: 'AC1',
          file: 'suite.test.ts',
          testName: 'not a test name',
        },
        reason: 'no-test',
      },
    ])
  })
})

describe('a report that quotes a bad citation as an example', () => {
  it('does not flag rows inside a fenced code block', () => {
    const report = [
      '| AC | Status | Evidence |',
      '| :-- | :-- | :-- |',
      '| AC1 | done | `src/lib/hash.test.ts` — "hashes a known string" |',
      '',
      'The row below is quoted as an example of what NOT to write:',
      '',
      '```markdown',
      '| AC9 | done | `nope.test.ts` — "a test that does not exist" |',
      '```',
    ].join('\n')

    expect(parseCitations(report).map((c) => c.ac)).toEqual(['AC1'])
  })
})
