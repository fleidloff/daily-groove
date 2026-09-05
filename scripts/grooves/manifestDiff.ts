export type ManifestEntry = { id: string; fields: Record<string, string> }

export type FieldDiff = {
  id: string
  field: string
  committed: string | null
  rendered: string | null
}

export const HARMONIC_FIELDS: readonly string[] = [
  'id',
  'uuid',
  'bpm',
  'root',
  'flavour',
  'scale',
  'chord',
  'progression',
  'progressionDegrees',
]

export const MAY_MOVE: readonly string[] = ['headDelaySeconds']

export type ManifestDiff = {
  harmonic: FieldDiff[]
  unexpected: FieldDiff[]
  expected: FieldDiff[]
}

const OPEN = 'export const GROOVES: Groove[] = ['
const EMPTY = 'export const GROOVES: Groove[] = []'
const HEAD_ID = '(manifest head)'
const TAIL_ID = '(manifest tail)'

type Sections = { head: string; body: string; tail: string }

function sections(source: string): Sections {
  const empty = source.indexOf(EMPTY)
  if (empty !== -1) {
    const end = empty + EMPTY.length
    return { head: source.slice(0, end), body: '', tail: source.slice(end) }
  }

  const open = source.indexOf(OPEN)
  if (open === -1) {
    throw new Error('manifest has no GROOVES array: expected a line reading `' + OPEN + '`')
  }

  const bodyStart = open + OPEN.length
  const close = source.indexOf('\n]', bodyStart)
  if (close === -1) {
    throw new Error('manifest GROOVES array is never closed by a `]` at column 0')
  }

  return {
    head: source.slice(0, bodyStart),
    body: source.slice(bodyStart, close),
    tail: source.slice(close + '\n]'.length),
  }
}

function parseBlock(lines: readonly string[]): ManifestEntry {
  const fields: Record<string, string> = {}
  for (const line of lines) {
    const match = /^ {4}([A-Za-z0-9_$]+): (.*),$/.exec(line)
    if (match) fields[match[1]] = match[2]
  }

  const literal = fields.id
  if (literal === undefined) {
    throw new Error(
      'manifest entry has no id field:\n' + ['  {', ...lines, '  },'].join('\n'),
    )
  }

  return { id: literal.replace(/^'|'$/g, ''), fields }
}

export function readManifestEntries(source: string): ManifestEntry[] {
  const { body } = sections(source)
  const entries: ManifestEntry[] = []
  let block: string[] | null = null

  for (const line of body.split('\n')) {
    if (line === '  {') {
      block = []
      continue
    }
    if (line === '  },') {
      if (block === null) throw new Error('manifest entry closed before it was opened: ' + line)
      entries.push(parseBlock(block))
      block = null
      continue
    }
    if (block !== null) block.push(line)
  }

  if (block !== null) {
    throw new Error('manifest entry is never closed by a `},` line')
  }

  return entries
}

function firstDifference(committed: string, rendered: string): FieldDiff['committed'][] {
  const a = committed.split('\n')
  const b = rendered.split('\n')
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) return [a[i] ?? null, b[i] ?? null]
  }
  return [null, null]
}

function bucket(diff: FieldDiff, into: ManifestDiff): void {
  if (HARMONIC_FIELDS.includes(diff.field)) into.harmonic.push(diff)
  else if (MAY_MOVE.includes(diff.field)) into.expected.push(diff)
  else into.unexpected.push(diff)
}

function byId(entries: readonly ManifestEntry[]): Map<string, ManifestEntry> {
  const map = new Map<string, ManifestEntry>()
  for (const entry of entries) {
    if (map.has(entry.id)) throw new Error('manifest holds two entries with id ' + entry.id)
    map.set(entry.id, entry)
  }
  return map
}

export function diffManifests(committed: string, rendered: string): ManifestDiff {
  const left = sections(committed)
  const right = sections(rendered)
  const diff: ManifestDiff = { harmonic: [], unexpected: [], expected: [] }

  if (left.head !== right.head) {
    const [a, b] = firstDifference(left.head, right.head)
    diff.unexpected.push({ id: HEAD_ID, field: '(head)', committed: a, rendered: b })
  }

  const committedEntries = readManifestEntries(committed)
  const renderedEntries = readManifestEntries(rendered)
  const committedById = byId(committedEntries)
  const renderedById = byId(renderedEntries)

  for (const [index, entry] of committedEntries.entries()) {
    const other = renderedById.get(entry.id)
    if (other === undefined) {
      diff.harmonic.push({
        id: entry.id,
        field: 'id',
        committed: entry.fields.id,
        rendered: null,
      })
      continue
    }
    const otherIndex = renderedEntries.indexOf(other)
    if (otherIndex !== index) {
      diff.harmonic.push({
        id: entry.id,
        field: 'id',
        committed: String(index),
        rendered: String(otherIndex),
      })
    }
  }

  for (const entry of renderedEntries) {
    if (committedById.has(entry.id)) continue
    diff.harmonic.push({
      id: entry.id,
      field: 'id',
      committed: null,
      rendered: entry.fields.id,
    })
  }

  for (const entry of committedEntries) {
    const other = renderedById.get(entry.id)
    if (other === undefined) continue
    const fields = [
      ...Object.keys(entry.fields),
      ...Object.keys(other.fields).filter((field) => !(field in entry.fields)),
    ]
    for (const field of fields) {
      const before = entry.fields[field] ?? null
      const after = other.fields[field] ?? null
      if (before === after) continue
      bucket({ id: entry.id, field, committed: before, rendered: after }, diff)
    }
  }

  if (left.tail !== right.tail) {
    const [a, b] = firstDifference(left.tail, right.tail)
    diff.unexpected.push({ id: TAIL_ID, field: '(tail)', committed: a, rendered: b })
  }

  return diff
}
