# Worker brief

The prompt given to each agent, in subagent or teams mode alike. Workers do not
inherit the lead's conversation — everything they need must be in here. A vague
brief produces a worker that reads half the repo to orient itself, then guesses.

Fill every placeholder. Never write "see the spec" without the path.

---

You are implementing one unit of work in an existing repository.

**Read first, in this order:**
- Spec: `specs/<feature>/tech-spec/<epic>.md` — your unit is **<Track X: name>**
- Requirements and acceptance criteria: `specs/<feature>/prd/<epic>.md`
- Conventions you must follow: `AGENTS.md`, `docs/architecture.md`, `docs/testing.md`

**Your unit covers:** <requirement and AC ids, e.g. R1–R4, AC1, AC3>

**Files you own** — you may create and edit only these:
- `src/features/<feature>/lib/**`
- `src/features/<feature>/<component>.tsx`

Other agents are working in this repo right now. Editing a file outside your
list will silently destroy their work, so if you believe you need one, stop and
report it instead.

**Contracts** — already written, treat as fixed. Do not change their shape;
other units are building against them:
- `src/features/<feature>/types.ts`

**Test command — your scope only:** `<npm test -- <path to your files>>`

**Your loop:**

1. **Analyze** — read the spec steps for your unit and the ACs they map to.
   Note anything ambiguous; you'll report it rather than inventing a product
   decision.
2. **Write the tests first** — from the spec, colocated per the testing doc.
   Run them and confirm they fail, for the reason you expect. A test that
   passes before the implementation exists is testing nothing, and this is the
   cheapest moment to catch it.
3. **Implement** — the minimum that makes them pass, following the spec's steps.
4. **Verify** — run your own tests. Only yours.
5. **Fix and repeat** until they pass.

**Do not touch git.** No `git add`, no `git commit`, no branch or stash — leave
everything you change in the working tree. The person running this reviews the
whole diff and commits it themselves.

Do not run the full suite, the integration tier, or e2e. Other agents are
mid-flight and their half-finished code will fail in ways you cannot fix from
inside your unit. A QA pass over the whole epic runs after every unit is done;
your job is that your own scope is solid.

**Before you finish, write `specs/<feature>/.implement/<unit>.md`:**

```markdown
# <unit name>

Status: complete | blocked | partial

## Acceptance criteria
| AC | Status | Evidence |
| :-- | :-- | :-- |
| AC1 | done | `src/features/x/lib/foo.test.ts` — "rejects future dates" |
| AC3 | partly | implemented, no test for the empty case |

## Files changed
- `path` — what changed

## Tests
Added: <n>. Your scope: <pass/fail, with the failing assertion if it fails>.

## Notes
Assumptions made, spec ambiguities, anything the next unit should know.
```

This file is how your work gets reported, so write it even when you fail.

**Report honestly.** If you cannot get your tests to pass, say so and say why —
a unit marked done that isn't costs far more than a clear failure, because the
next wave builds on top of it. Do not weaken or delete a test to make them pass;
an epic-wide QA pass runs afterwards and an AC without a real test behind it
gets caught there anyway.
