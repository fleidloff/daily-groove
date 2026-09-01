/**
 * The placement floor every agent definition must carry.
 *
 * R2 repeats the floor inside each of the five definitions under
 * `.claude/agents/` rather than putting it in a document beside
 * `docs/coding-guidelines.md` that could drift from it. Five copies is five
 * places to update, and a missed one is silent — so this module is the repo's
 * usual answer to a convention no linter can check: a test that reads the files
 * from disk, the way `structure.test.ts`, `route-boundary.test.ts` and
 * `scripts/grooves/boundary.test.ts` already do.
 *
 * `mustMatch` is a regex, not an exact string. A definition is expected to word
 * a rule in its own voice — the musician states the same boundary in terms of
 * the generator — so the guard checks that the rule is *present*, not that it
 * was copy-pasted.
 *
 * Each pattern is tolerant about *wording* and strict about *substance*, and
 * the two pull against each other. A pattern loose enough to match any phrasing
 * stops noticing when the rule is gone, which is the one failure a structural
 * test must not have: it reads as a pass forever. So each is written as the
 * rule's claim in proximity — a verb and its object within a sentence or two —
 * rather than a bag of words the whole document is scanned for, and each is
 * checked by deleting it from the fixture in `agent-floor.test.ts` and
 * confirming the guard names it.
 *
 * The guard asks whether the rule is present *anywhere* in a definition, not
 * whether it is in a section called "the placement floor". A definition that
 * states a rule twice — once in the floor and once where its role needs it —
 * keeps the rule when one copy goes, and that is the correct answer.
 *
 * This module imports nothing but `node:fs` and `node:path`.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** A rule every agent definition must carry, however it is worded. */
export type FloorRule = { id: string; mustMatch: RegExp; why: string }

/**
 * The shared placement floor. R2 duplicates it across five definitions.
 *
 * Six rules, and they are the ones that are genuinely universal across all five
 * roles. The musician is the test of that: it carries the generator's boundary
 * rule instead of the React and design-system placement rules, so a
 * React-specific rule added here would fail on `musician.md` — and the floor,
 * not the definition, would be what is wrong.
 */
export const FLOOR_RULES: FloorRule[] = [
  {
    id: 'slice-public-surface',
    // "reached only through its index.ts", "never import past index.ts",
    // "exposes one public surface, index.ts", "nothing deeper" — all the same
    // rule. The pattern wants an exclusivity phrase near the file name.
    mustMatch:
      /(?:reach(?:ed|es)?|import(?:ed|s)?|consumer?s?|enter(?:ed|s)?)[\s\S]{0,60}\bonly\b[\s\S]{0,60}`?index\.ts|\bonly\b[\s\S]{0,60}(?:through|via|by)[\s\S]{0,40}`?index\.ts|public surface[\s\S]{0,80}index\.ts|index\.ts[\s\S]{0,80}public surface|(?:past|beyond|deeper than|other than)[\s\S]{0,40}(?:that |its |the )?`?index\b|nothing deeper/i,
    why: 'docs/architecture.md § The model, and docs/coding-guidelines.md § Feature slices — a slice is a unit you can hand over or delete, which only holds while its consumers know one entry point.',
  },
  {
    id: 'no-sibling-features',
    // "no feature imports another feature", "no sibling import", "there is no
    // sideways arrow". Needs the notion of importing AND a second feature as
    // the object of it.
    //
    // The object used to allow a bare "each other", and that was a FALSE PASS:
    // floor rule 1 ends "The rule binds consumers, not the slice: inside its own
    // folder a feature's files import each other freely" — a sentence that
    // *permits* intra-slice imports — so `implementer.md` passed this rule with
    // every statement of it deleted. Requiring "another/other/sibling" to be
    // followed by "feature" or "slice" is what separates the prohibition from
    // the carve-out. All five definitions say "No feature imports another
    // feature", so nothing real depends on the looser form.
    mustMatch:
      /(?:no|never|not|cannot|must not|do(?:es)? not)[\s\S]{0,40}(?:feature|slice)s?[\s\S]{0,40}(?:import|reach|depend)[\s\S]{0,40}(?:another|other|sibling)\s+(?:feature|slice)|sideways arrow|(?:sibling|another|other) (?:feature|slice)s?[\s\S]{0,60}(?:never|not|no\b|forbidden|off limits)/i,
    why: 'docs/architecture.md § Why the dependency direction is the load-bearing part — there is no sideways arrow, so anything two slices need moves up rather than making one a dependency of the other.',
  },
  {
    id: 'lib-is-a-leaf',
    // "src/lib/ imports nothing from the app, and it is the only channel
    // scripts/ has into src/" — or, in the musician's voice, "the generator
    // reaches src/lib/ by relative path and nothing else".
    mustMatch:
      /src\/lib[\s\S]{0,60}(?:is a leaf|leaf|imports nothing|nothing from the app|only channel|only way|only route|relative path|nothing else)|(?:leaf|imports nothing|only channel)[\s\S]{0,60}src\/lib/i,
    why: 'docs/architecture.md § Why the dependency direction is the load-bearing part, and docs/coding-guidelines.md § Shared code — the leaf property is exactly what lets the generator import it with no bundler and no alias.',
  },
  {
    id: 'tests-colocated',
    // "a test sits beside the thing it tests", "colocation is the rule".
    mustMatch:
      /(?:tests?|spec)[\s\S]{0,80}(?:colocat|sits? beside|lives? beside|beside the (?:thing|code|module|subject|file)|next to (?:the |its )?(?:thing|code|subject|file)|alongside|same folder|same directory|in the folder that owns)|colocat[\s\S]{0,80}(?:tests?|spec)/i,
    why: 'docs/testing.md § Structural tests and docs/coding-guidelines.md § Anti-patterns and their fixes — a test lives beside the code it covers and asserts that code’s subject.',
  },
  {
    id: 'tests-bound-as-source',
    // "the import boundaries bind test files exactly as they bind source; a
    // vi.mock of a cross-boundary path is the same violation."
    //
    // The `vi.mock` alternative requires "cross-boundary" rather than a loose
    // "the same". It used to accept the latter, and that was a FALSE PASS:
    // `test-writer.md` separately carries the testing-style rule "a `vi.mock`
    // of an internal path is the same coupling wearing a different hat", which
    // is a different rule, so deleting the boundary rule from that file left
    // the guard silent — in the definition where boundary rules matter most.
    // Found by probing the guard: strike each floor rule from each definition
    // and check it fires.
    mustMatch:
      /(?:boundar\w*|import rule)[\s\S]{0,80}(?:bind|appl|hold|are the same|no different)[\s\S]{0,60}(?:tests?|spec)|(?:tests?|spec)[\s\S]{0,80}(?:are bound|bind|no exemption|not exempt|exempts|same (?:rule|boundar))|vi\.mock[\s\S]{0,80}cross-boundar|cross-boundar[\s\S]{0,80}vi\.mock/i,
    why: 'docs/testing.md § How a test is judged, and docs/coding-guidelines.md § Feature slices — both boundary violations this project actually found were in tests, and a mocked path breaks with the module it names.',
  },
  {
    id: 'feature-removable',
    // "deleting the slice, its route folder and its one registration entry
    // leaves an app that still builds."
    mustMatch:
      /(?:delet(?:e|es|ing)|remov(?:e|es|ing)|rm -rf)[\s\S]{0,120}(?:feature|slice)[\s\S]{0,160}(?:still build|still runs|still work|clean build|builds and runs)|(?:feature|slice)[\s\S]{0,60}(?:must (?:stay|remain)|stays?|remains?) removable|removability/i,
    why: 'docs/architecture.md § Every feature must be removable — removability is a test of coupling, and deletion is just the cheapest way to notice that something leaked.',
  },
]

/**
 * Definitions missing a floor rule, as `${file}: ${ruleId}`. Empty is good.
 *
 * Throws when the directory holds no definitions at all. Answering `[]` there
 * would make the guard report a floor that nobody carries — the one failure a
 * structural test must not have, since it reads as a pass forever.
 */
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
