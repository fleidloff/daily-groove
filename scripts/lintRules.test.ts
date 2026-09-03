import { ESLint } from 'eslint'

import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: process.cwd() })

// A fixture on disk that violates the block would fail `npm run lint` for
// everyone, so the source text is synthetic and the path is virtual: ESLint
// resolves the config by the path it is given, and never reads the file.
const hits = async (filePath: string, code: string): Promise<number> => {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax')
    .length
}

const COACHING_TEST = 'src/features/daily-groove/lib/presentation/coaching.test.ts'

describe('the no-copied-sentences block fires', () => {
  it.each([
    ['toBe', `expect(a).toBe('Right home note, wrong colour.')`],
    ['toEqual', `expect(a).toEqual('You said Dorian — one note apart.')`],
    ['toContain', `expect(a).toContain('a long way from this one')`],
    ['toMatch', `expect(a).toMatch('not a near miss')`],
  ])('on a sentence passed to %s', async (_matcher, code) => {
    expect(await hits(COACHING_TEST, code)).toBe(1)
  })

  it('on a sentence written as a template literal with no substitution', async () => {
    expect(
      await hits(COACHING_TEST, 'expect(a).toBe(`Right home note, wrong colour.`)'),
    ).toBe(1)
  })

  it('names the rule and what to do instead', async () => {
    const [result] = await eslint.lintText(
      `expect(a).toBe('Right home note, wrong colour.')`,
      { filePath: COACHING_TEST, warnIgnored: false },
    )
    const [message] = result.messages.filter(
      (m) => m.ruleId === 'no-restricted-syntax',
    )

    expect(message.message).toContain('@/lib/snippets')
    expect(message.message).toContain('lib/presentation/ selects a sentence')
    expect(message.severity).toBe(2)
  })
})

describe('the no-copied-sentences block stays quiet outside its scope', () => {
  it.each([
    ['a mode', COACHING_TEST, `expect(answer.flavour).toBe('Aeolian')`],
    [
      'a data- attribute value',
      COACHING_TEST,
      `expect(el).toHaveAttribute('data-tone', 'warm')`,
    ],
    [
      'the same sentence written in a component test',
      'src/features/daily-groove/components/puzzle/GuessCard.test.tsx',
      `expect(a).toBe('Right home note, wrong colour.')`,
    ],
    [
      'an Intl-formatted date in date.test.ts',
      'src/features/daily-groove/lib/presentation/date.test.ts',
      `expect(a).toBe('Sunday, 30 August')`,
    ],
    [
      'a degree string in staffLabel.test.ts',
      'src/features/daily-groove/lib/presentation/staffLabel.test.ts',
      `expect(a).toBe('1 G')`,
    ],
    [
      'the module that defines the sentence',
      'src/lib/snippets/en/coaching.test.ts',
      `expect(nearMiss({ notes: 2 })).toBe('two notes')`,
    ],
  ])('on %s', async (_name, filePath, code) => {
    expect(await hits(filePath, code)).toBe(0)
  })

  it('leaves a composed line with substitutions alone', async () => {
    expect(
      await hits(
        COACHING_TEST,
        'expect(a).toBe(`${GROOVE.bpm} ${puzzle.bpm} · ${dateLine(DATE)}`)',
      ),
    ).toBe(0)
  })

  it('leaves the strings inside an array argument alone', async () => {
    expect(
      await hits(COACHING_TEST, `expect(a).toEqual(['guess card view', 'meta line'])`),
    ).toBe(0)
  })

  it('leaves a regex passed to toMatch alone', async () => {
    expect(await hits(COACHING_TEST, 'expect(a).toMatch(/export \\*/)')).toBe(0)
  })
})
