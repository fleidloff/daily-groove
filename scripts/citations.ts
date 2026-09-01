/**
 * The citation check behind R12 and R13.
 *
 * `/verify-epic` writes a QA report whose acceptance-criteria table grades each
 * AC and cites the test that proves it. A grade of **done** resting on a test
 * that was never written, or one renamed since the grade was given, is the
 * failure this module exists to catch — and it catches it mechanically, so the
 * lead does not re-trace every AC by hand before relaying a verdict it did not
 * form.
 *
 * It checks that the cited test exists. It cannot check that the test asserts
 * what the AC claims; that remains a judgement the verifier owns.
 *
 * This module imports nothing but `node:fs` and `node:path`.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** One AC row's evidence, as the QA report's table writes it. */
export type Citation = { ac: string; file: string; testName: string }

/**
 * A table row's three leading cells: `| AC1 | done | evidence |`.
 * The AC cell is what identifies the row as an acceptance criterion rather
 * than a row of the Checks table, which never starts with `AC`.
 */
const ROW = /^\|([^|\n]*)\|([^|\n]*)\|([\s\S]*?)\|\s*$/gm

/** The first inline-code span in a cell — the report writes the path in one. */
const BACKTICKED = /`([^`\n]+)`/

/** The first double-quoted string in a cell, straight or curly. */
const QUOTED = /["“]([^"”\n]+)["”]/

/** Markdown emphasis around a cell's text, which a report is free to add. */
function plain(cell: string): string {
  return cell.replace(/[*_`]/g, '').trim()
}

/** Every citation in a QA report's acceptance-criteria table. */
/**
 * Blank out fenced code blocks, keeping the line count so nothing else shifts.
 *
 * A QA report that *quotes* a bad citation as an example — which AC12 asks for,
 * and which this repo's own reports now do — would otherwise flag itself, and a
 * guard that fires on its own documentation trains people to ignore it.
 */
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

    // Only **done** carries a citation. **Partly** is R17a's case — a change
    // awaiting a listening sign-off is implemented and untested, so it has no
    // test to cite by definition — and **not done** has nothing to cite either.
    if (plain(statusCell).toLowerCase() !== 'done') continue

    citations.push({
      ac,
      file: BACKTICKED.exec(evidenceCell)?.[1]?.trim() ?? '',
      testName: QUOTED.exec(evidenceCell)?.[1]?.trim() ?? '',
    })
  }

  return citations
}

/**
 * Every name declared by an `it(...)` or `test(...)` call in a source file.
 *
 * The optional parenthesised group before the name is what lets `it.each(...)`
 * — a shape this repo uses — be read like any other declaration, including when
 * its argument is itself a call, as `it.each(rows.map((row) => ...))` is. The
 * group is lazy so that a plain `it('name', () => …)` is read as itself rather
 * than as a table whose name is some string inside the callback.
 *
 * A name built from a template literal is collected as written, so a citation
 * must quote it the same way.
 */
const DECLARATION =
  /\b(?:it|test)(?:\.\w+)*\s*(?:\([\s\S]{0,400}?\)\s*)??\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

function declaredTestNames(source: string): string[] {
  return [...source.matchAll(DECLARATION)].map(([, , name]) => name)
}

/** Citations whose file is missing or whose test name is not in it. */
export function checkCitations(
  citations: readonly Citation[],
  repoRoot: string,
): { citation: Citation; reason: 'no-file' | 'no-test' }[] {
  const unresolved: { citation: Citation; reason: 'no-file' | 'no-test' }[] = []

  for (const citation of citations) {
    // A report is free to cite `file.test.ts:190` — the line number is where
    // the reader should look, not part of the path. The rest must be
    // repo-relative: a bare basename is not a mechanically checkable citation,
    // which is what R12 asks the grade to rest on, and guessing which
    // `page.test.tsx` was meant would resolve it against a file nobody cited.
    //
    // An empty path is a **done** row that cited nothing at all, which R12
    // forbids as squarely as a path that does not resolve.
    const file = citation.file.replace(/:\d+(?::\d+)?$/, '')
    const path = file ? join(repoRoot, file) : ''
    if (!path || !existsSync(path) || !statSync(path).isFile()) {
      unresolved.push({ citation, reason: 'no-file' })
      continue
    }

    // Substring rather than equality, so a report may cite the stable part of
    // a parameterised name. The reverse is not allowed: a citation longer than
    // anything declared is a name that is not there.
    const declared = declaredTestNames(readFileSync(path, 'utf8'))
    const found =
      citation.testName !== '' &&
      declared.some((name) => name.includes(citation.testName))
    if (!found) unresolved.push({ citation, reason: 'no-test' })
  }

  return unresolved
}
