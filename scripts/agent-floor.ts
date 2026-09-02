import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type FloorRule = { id: string; mustMatch: RegExp; why: string }

export const FLOOR_RULES: FloorRule[] = [
  {
    id: 'slice-public-surface',
    mustMatch:
      /(?:reach(?:ed|es)?|import(?:ed|s)?|consumer?s?|enter(?:ed|s)?)[\s\S]{0,60}\bonly\b[\s\S]{0,60}`?index\.ts|\bonly\b[\s\S]{0,60}(?:through|via|by)[\s\S]{0,40}`?index\.ts|public surface[\s\S]{0,80}index\.ts|index\.ts[\s\S]{0,80}public surface|(?:past|beyond|deeper than|other than)[\s\S]{0,40}(?:that |its |the )?`?index\b|nothing deeper/i,
    why: 'docs/architecture.md § The model, and docs/coding-guidelines.md § Feature slices — a slice is a unit you can hand over or delete, which only holds while its consumers know one entry point.',
  },
  {
    id: 'no-sibling-features',
    mustMatch:
      /(?:no|never|not|cannot|must not|do(?:es)? not)[\s\S]{0,40}(?:feature|slice)s?[\s\S]{0,40}(?:import|reach|depend)[\s\S]{0,40}(?:another|other|sibling)\s+(?:feature|slice)|sideways arrow|(?:sibling|another|other) (?:feature|slice)s?[\s\S]{0,60}(?:never|not|no\b|forbidden|off limits)/i,
    why: 'docs/architecture.md § Why the dependency direction is the load-bearing part — there is no sideways arrow, so anything two slices need moves up rather than making one a dependency of the other.',
  },
  {
    id: 'lib-is-a-leaf',
    mustMatch:
      /src\/lib[\s\S]{0,60}(?:is a leaf|leaf|imports nothing|nothing from the app|only channel|only way|only route|relative path|nothing else)|(?:leaf|imports nothing|only channel)[\s\S]{0,60}src\/lib/i,
    why: 'docs/architecture.md § Why the dependency direction is the load-bearing part, and docs/coding-guidelines.md § Shared code — the leaf property is exactly what lets the generator import it with no bundler and no alias.',
  },
  {
    id: 'tests-colocated',
    mustMatch:
      /(?:tests?|spec)[\s\S]{0,80}(?:colocat|sits? beside|lives? beside|beside the (?:thing|code|module|subject|file)|next to (?:the |its )?(?:thing|code|subject|file)|alongside|same folder|same directory|in the folder that owns)|colocat[\s\S]{0,80}(?:tests?|spec)/i,
    why: 'docs/testing.md § Structural tests and docs/coding-guidelines.md § Anti-patterns and their fixes — a test lives beside the code it covers and asserts that code’s subject.',
  },
  {
    id: 'tests-bound-as-source',
    mustMatch:
      /(?:boundar\w*|import rule)[\s\S]{0,80}(?:bind|appl|hold|are the same|no different)[\s\S]{0,60}(?:tests?|spec)|(?:tests?|spec)[\s\S]{0,80}(?:are bound|bind|no exemption|not exempt|exempts|same (?:rule|boundar))|vi\.mock[\s\S]{0,80}cross-boundar|cross-boundar[\s\S]{0,80}vi\.mock/i,
    why: 'docs/testing.md § How a test is judged, and docs/coding-guidelines.md § Feature slices — both boundary violations this project actually found were in tests, and a mocked path breaks with the module it names.',
  },
  {
    id: 'feature-removable',
    mustMatch:
      /(?:delet(?:e|es|ing)|remov(?:e|es|ing)|rm -rf)[\s\S]{0,120}(?:feature|slice)[\s\S]{0,160}(?:still build|still runs|still work|clean build|builds and runs)|(?:feature|slice)[\s\S]{0,60}(?:must (?:stay|remain)|stays?|remains?) removable|removability/i,
    why: 'docs/architecture.md § Every feature must be removable — removability is a test of coupling, and deletion is just the cheapest way to notice that something leaked.',
  },
]

export function findMissingFloorRules(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    entries = []
  }

  const definitions = entries.filter((name) => name.endsWith('.md')).sort()
  if (definitions.length === 0) {
    throw new Error(`no agent definitions found in ${dir}`)
  }

  const missing: string[] = []
  for (const file of definitions) {
    const source = readFileSync(join(dir, file), 'utf8')
    for (const rule of FLOOR_RULES) {
      if (!rule.mustMatch.test(source)) missing.push(`${file}: ${rule.id}`)
    }
  }

  return missing
}
