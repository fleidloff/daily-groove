import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import type { GrooveSpec } from './types.ts'
import { assignMissingUuids, isCanonicalUuid, mintUuid, uuidFailures } from './uuid.ts'

const A = '9f1c2e40-7b3a-4c15-9d8e-2a6b41f0c7de'
const B = 'c0105415-48cb-43cb-a54d-996fcdb40d94'
const C = '34d62aba-a264-469c-836b-be57fcc69c0b'

function spec(id: string, uuid: string): GrooveSpec {
  return { id, uuid, template: 'straight-funk', seed: Number(id.slice(-2)) }
}

describe('isCanonicalUuid', () => {
  it('accepts a canonical lowercase hyphenated v4 uuid', () => {
    expect(isCanonicalUuid(A)).toBe(true)
  })

  it('rejects everything that is not one', () => {
    expect(isCanonicalUuid('')).toBe(false)
    expect(isCanonicalUuid('groove-01')).toBe(false)
    expect(isCanonicalUuid(A.toUpperCase())).toBe(false)
    expect(isCanonicalUuid('9f1c2e40-7b3a-1c15-9d8e-2a6b41f0c7de')).toBe(false)
    expect(isCanonicalUuid(A.slice(0, 35))).toBe(false)
  })

  it('rejects a value that is not a string at all', () => {
    expect(isCanonicalUuid(undefined)).toBe(false)
    expect(isCanonicalUuid(42)).toBe(false)
  })
})

describe('mintUuid', () => {
  it('mints what isCanonicalUuid accepts', () => {
    expect(isCanonicalUuid(mintUuid())).toBe(true)
  })

  it('is a field of GrooveSpec', () => {
    const value: GrooveSpec = { id: 'groove-99', uuid: mintUuid(), template: 't', seed: 1 }
    expect(isCanonicalUuid(value.uuid)).toBe(true)
  })

  it('mints a different value every time', () => {
    expect(mintUuid()).not.toBe(mintUuid())
  })
})

describe('assignMissingUuids', () => {
  const specs: GrooveSpec[] = [spec('groove-01', ''), spec('groove-02', A), spec('groove-03', '')]

  function fakeMint(): () => string {
    const values = [B, C]
    let i = 0
    return () => values[i++]
  }

  it('leaves a uuid a groove already holds exactly as it was', () => {
    const out = assignMissingUuids(specs, fakeMint())
    expect(out).toHaveLength(3)
    expect(out[1].uuid).toBe(A)
  })

  it('mints one for each groove that has none', () => {
    const out = assignMissingUuids(specs, fakeMint())
    expect(out[0].uuid).toBe(B)
    expect(out[2].uuid).toBe(C)
  })

  it('changes nothing on a second pass', () => {
    const once = assignMissingUuids(specs, fakeMint())
    const twice = assignMissingUuids(once, () => {
      throw new Error('assignMissingUuids minted again on an already-complete catalogue')
    })
    expect(twice).toEqual(once)
  })

  it('re-mints a uuid that is present but malformed', () => {
    const [out] = assignMissingUuids([spec('groove-01', 'not-a-uuid')], () => B)
    expect(out.uuid).toBe(B)
  })

  it('writes uuid directly after id, so the catalogue diff is one line per groove', () => {
    const [out] = assignMissingUuids([spec('groove-01', '')], () => B)
    expect(Object.keys(out)).toEqual(['id', 'uuid', 'template', 'seed'])
  })
})

describe('the committed catalogue', () => {
  const specs = readCatalogue()

  it('gives every groove a canonical uuid', () => {
    for (const s of specs) {
      expect(isCanonicalUuid(s.uuid), `${s.id} has no canonical uuid: ${String(s.uuid)}`).toBe(true)
    }
  })

  it('gives no two grooves the same uuid', () => {
    expect(new Set(specs.map((s) => s.uuid)).size).toBe(specs.length)
  })

  it('passes the guard it is checked by', () => {
    expect(uuidFailures(specs)).toEqual([])
  })
})

describe('uuidFailures', () => {
  it('finds nothing wrong with a clean catalogue', () => {
    expect(uuidFailures([spec('groove-01', A), spec('groove-02', B)])).toEqual([])
  })

  it('names the groove whose uuid is absent', () => {
    const failures = uuidFailures([spec('groove-01', A), { id: 'groove-02', template: 'straight-funk', seed: 2 } as GrooveSpec])
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('uuid-missing')
    expect(failures[0].detail).toContain('groove-02')
  })

  it('names both grooves that share a uuid', () => {
    const failures = uuidFailures([
      spec('groove-01', A),
      spec('groove-02', B),
      spec('groove-03', A),
    ])
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('uuid-duplicate')
    expect(failures[0].detail).toContain('groove-01')
    expect(failures[0].detail).toContain('groove-03')
    expect(failures[0].detail).toContain(A)
    expect(failures[0].detail).not.toContain('groove-02')
  })

  it('names the groove whose uuid is malformed, and the value it holds', () => {
    const failures = uuidFailures([spec('groove-04', 'not-a-uuid')])
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('uuid-malformed')
    expect(failures[0].detail).toContain('groove-04')
    expect(failures[0].detail).toContain('not-a-uuid')
  })

  it('reports every fault in one pass rather than the first one it meets', () => {
    const checks = uuidFailures([
      spec('groove-01', A),
      { id: 'groove-02', template: 'straight-funk', seed: 2 } as GrooveSpec,
      spec('groove-03', A),
      spec('groove-04', 'NOT-A-UUID'),
    ]).map((f) => f.check)
    expect(new Set(checks)).toEqual(new Set(['uuid-missing', 'uuid-duplicate', 'uuid-malformed']))
  })
})
