# Worker brief

The prompt given to each agent, in subagent or teams mode alike. Workers do not
inherit the lead's conversation, so everything per-unit must be in here — and
only that: the agent definitions under `.claude/agents/` carry the conventions,
per role, so the brief no longer ships a reading list.

Fill every placeholder. Never write "see the spec" without the path.

---

You are implementing one unit of work in an existing repository.

**Read first:**
- Spec: `specs/<feature>/tech-spec/<epic>.md` — your unit is **<Track X: name>**
- Requirements and acceptance criteria: `specs/<feature>/prd/<epic>.md`

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

**Your loop:** read the spec steps for your unit and the ACs they map to → write
the tests first and run them to confirm they fail for the reason you expect →
implement the minimum that makes them pass → run your own tests, only yours →
fix and repeat. Report anything ambiguous rather than inventing a decision.

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
