# Teams mode

Read this before dispatching with `--teams`. Agent teams differ from subagents
in ways that break an orchestration written for subagents.

## Check it's enabled

Agent teams are **experimental and disabled by default**. They're gated on the
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable being `1`, in the
shell or in `settings.json`. There's no key, token, or account flag — if the
user talks about a "teams key", this variable is what they mean.

```bash
echo "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-unset}"
```

Also check the project and user `settings.json` for an `env` entry, since that
sets it without exporting it into the shell.

If it's off, tell the user what to add and offer subagent mode instead. Don't
edit their settings uninvited, and don't silently fall back — they asked for
teams and should know they didn't get them.

```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

Two more preconditions: teams need an **interactive session** (in headless `-p`
runs a named subagent stays a subagent), and **teammates cannot spawn
teammates** — if this skill is itself running inside a teammate, teams mode is
unavailable and subagent mode is the answer.

## The difference that matters

**A teammate's completion notification does not carry its output.** With
subagents you get the result back; with teammates you get "this one went idle".
An orchestration that waits for returned results will stall here.

So the status file in the worker brief is not belt-and-braces in this mode —
it's the only reliable channel. Require it explicitly in every spawn prompt, and
read the files rather than waiting to be told what happened.

## Spawning

A teammate is spawned by calling the Agent tool **with a `name`** while teams
are enabled — a named subagent launches as a teammate. Give each a stable,
meaningful name (`entries-lib`, `entries-ui`), because that name is the address
for messaging it later and it's what the user sees in the agent panel.

Pass the full worker brief as the spawn prompt. Teammates load `CLAUDE.md`,
project skills, and MCP servers like any session, but inherit none of the lead's
conversation.

Start with 3–5. Coordination overhead and token cost both scale with team size,
and three focused teammates routinely beat five scattered ones.

## Coordinating

Use the shared task list: create one task per unit with real dependencies
between them. A pending task whose dependencies are unresolved can't be claimed,
which enforces your waves without you policing them, and a teammate that
finishes early self-claims the next unblocked task.

Teammates message each other directly. That's useful when one discovers
something another needs — a contract that needs widening, a shared helper — but
it also means they can talk themselves into scope creep. Tell them in the brief
that contracts are fixed and file ownership is not negotiable.

## Known rough edges

- **Task status lags.** Teammates sometimes don't mark tasks complete, which
  blocks dependents. If a unit looks stuck, check the status file and update the
  task yourself.
- **Teammates stop early on errors** instead of recovering. Read their status
  file, then message them with specifics or spawn a replacement.
- **Permission prompts surface in the lead session**, not the teammate's. Expect
  to approve there.
- **Resume doesn't restore in-process teammates.** After a `/resume`, spawn
  fresh ones rather than messaging ghosts.
- **Token cost is materially higher** than subagents — each teammate is a full
  session. Worth it for genuinely independent implementation work; wasteful for
  a couple of small units, where subagent mode is the better default.
