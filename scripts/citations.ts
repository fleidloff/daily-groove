import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type Citation = { ac: string; file: string; testName: string }

const ROW = /^\|([^|\n]*)\|([^|\n]*)\|([\s\S]*?)\|\s*$/gm

const BACKTICKED = /`([^`\n]+)`/

const QUOTED = /["“]([^"”\n]+)["”]/

function plain(cell: string): string {
  return cell.replace(/[*_`]/g, '').trim()
}

function withoutFences(markdown: string): string {
  let inFence = false
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence
        return ''
      }
      return inFence ? '' : line
    })
    .join('\n')
}

export function parseCitations(markdown: string): Citation[] {
  const citations: Citation[] = []

  for (const [, acCell, statusCell, evidenceCell] of withoutFences(
    markdown,
  ).matchAll(ROW)) {
    const ac = plain(acCell)
    if (!/^AC\d+[a-z]?$/i.test(ac)) continue

    if (plain(statusCell).toLowerCase() !== 'done') continue

    citations.push({
      ac,
      file: BACKTICKED.exec(evidenceCell)?.[1]?.trim() ?? '',
      testName: QUOTED.exec(evidenceCell)?.[1]?.trim() ?? '',
    })
  }

  return citations
}

const DECLARATION =
  /\b(?:it|test)(?:\.\w+)*\s*(?:\([\s\S]{0,400}?\)\s*)??\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

function declaredTestNames(source: string): string[] {
  return [...source.matchAll(DECLARATION)].map(([, , name]) => name)
}

export function checkCitations(
  citations: readonly Citation[],
  repoRoot: string,
): { citation: Citation; reason: 'no-file' | 'no-test' }[] {
  const unresolved: { citation: Citation; reason: 'no-file' | 'no-test' }[] = []

  for (const citation of citations) {
    const file = citation.file.replace(/:\d+(?::\d+)?$/, '')
    const path = file ? join(repoRoot, file) : ''
    if (!path || !existsSync(path) || !statSync(path).isFile()) {
      unresolved.push({ citation, reason: 'no-file' })
      continue
    }

    const declared = declaredTestNames(readFileSync(path, 'utf8'))
    const found =
      citation.testName !== '' &&
      declared.some((name) => name.includes(citation.testName))
    if (!found) unresolved.push({ citation, reason: 'no-test' })
  }

  return unresolved
}
