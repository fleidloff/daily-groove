# Skills — the order to run them

Every feature goes through the same five steps, in this order. Each one reads
what the previous one wrote, so skipping ahead doesn't work: `/roadmap` refuses
to run without a briefing, `/brainstorm` without a roadmap, `/writespec` without
a PRD, `/implement-feature` without a tech spec.

**Step 3 is the one that gets skipped, and it is the one that cannot be.** A
roadmap names the epics; only the PRD carries the requirements and the
acceptance criteria, and `/writespec` reads `prd/*.md` and nothing else. Going
from step 2 to step 4 means specifying against requirements nobody wrote down.

```
/create-feature  →  /roadmap  →  /brainstorm  →  /writespec  →  /implement-feature
   briefing.md      roadmap.md     prd/*.md      tech-spec/*.md      the code
```

## The five steps

| # | Run | What it does | Writes |
| :-- | :-- | :-- | :-- |
| 1 | `/create-feature` | Asks what the feature is, and records your answer as bullets. | `specs/features/feature-N/briefing.md` |
| 2 | `/roadmap feature-N` | Splits the briefing into epics that each ship something visible. | `specs/features/feature-N/roadmap.md` |
| 3 | `/brainstorm feature-N` | Turns each epic into a PRD — requirements and acceptance criteria. | `specs/features/feature-N/prd/epic-*.md` |
| 4 | `/writespec feature-N` | Turns each PRD into TDD implementation steps, split into parallel tracks. | `specs/features/feature-N/tech-spec/epic-*.md` |
| 5 | `/implement-feature feature-N` | Builds every epic from the specs, in parallel, until the tests pass. | the code |

Steps 2–5 all take an optional epic: `/brainstorm feature-8 epic-2` runs just
that one.

## The bit that isn't a straight line

Steps 2, 3 and 4 end by asking you questions — tickable multiple-choice, at the
bottom of the file they just wrote. **Answer them and run the same command
again.** The skill folds your answers into the document, then asks whatever the
answers opened up. Repeat until it tells you nothing is left open.

```
/brainstorm feature-8  →  tick the answers  →  /brainstorm feature-8  →  … until settled
```

Don't move to the next step while questions are still open. Specifying against
unsettled requirements produces work that gets thrown away — and `/writespec`
and `/implement-feature` will stop and tell you so anyway.

## `/quick-feature` — when the chain costs more than the mistake

The five steps buy insurance against building the wrong thing. For a change you
can describe in five bullets that insurance costs more than the accident, so
there is a second door:

```
write specs/quick/N-slug.md  →  /quick-feature N  →  answer  →  /quick-feature N  →  the code
       What + Done when            Notes + questions
```

You write what changes and what done means. `/quick-feature N` fills in the notes —
the files it expects to touch, the assumptions it took — and asks anything
blocking as tickable options inside the same file. Run it again once those are
ticked and it builds in this session: no epics, no agents except the `musician`
for anything under `scripts/grooves/`, and the full lint / test / build set
before reporting. `/quick-feature <what to change>` drafts the whole ticket for you
instead, when you'd rather not open the file. `/create-quick-feature` is the
middle way: it interviews you like `/create-feature` does, writes only `What`
and `Done when`, and stops — the ticket then enters `/quick-feature N` as a
hand-written one.

It refuses to be the cheap door for a real feature. Four questions decide:
five bullets or fewer, at most two of the six modules in
[architecture.md](architecture.md), nothing frozen in [music.md](music.md)
touched, one `git revert` to roll back. Any "no" and it hands the work to
`/create-feature` instead — including halfway through the build, if that is when
the truth turns up.

Quick changes get their own table in `specs/features.md`, so the index still
shows everything that shipped.

The chain can hand over too. `/roadmap` runs the same four questions against
the briefing before it shapes epics, and when they all pass and the answer would
be one epic, it asks whether to move the feature here instead. Say yes and it
writes the ticket from the briefing, deletes the feature folder, moves the row,
and points at `/quick-feature N`.

## `/verify-epic`

`/implement-feature` runs `/verify-epic` itself at the end of every epic, so you
don't normally need it. Run it by hand — `/verify-epic feature-8 epic-2` — when
you want to re-check an epic later, or after changing code by hand. It runs the
tests, types, lint and build, traces every acceptance criterion, and reports
done / partly / not done. It diagnoses, it doesn't fix.

## `/prototype`

Off the chain, and optional. `/prototype feature-8` turns settled PRDs into one
clickable HTML file under `specs/features/feature-8/prototype/` — the app's own
tokens, phone width, every state the PRD names reachable from a switcher bar at
the top. `/prototype 7` does the same for a quick ticket.

It refuses to run while a PRD still has open questions, for the same reason
`/writespec` does: drawing a screen decides a hundred things, and a picture the
user has clicked through quietly becomes the requirement before the question
gets asked.

What it hands back is a list of everything the drawing had to invent because the
requirements were silent. That list is the point — it goes into the PRD, and a
long one is a reason to run `/brainstorm` again.

## `/create-feature-for-persona`

A different way into step 1, or into the quick door. It walks the live app in
character as the persona in [persona.md](persona.md) — first run with empty
`localStorage`, then as a returner — reports what that person likes, what they
find unclear and what they miss, picks the single strongest finding, and runs
`/quick-feature`'s four size questions against it. All four pass and it hands
the finding to `/create-quick-feature` as a ticket; any fail, or any doubt, and
it hands it to `/create-feature` as a lettered candidate.

```
/create-feature-for-persona  →  specs/quick/N-slug.md          →  /quick-feature N  →  …
                             →  specs/features/feature-X/briefing.md  →  promote to a number  →  /roadmap feature-N  →  …
```

It stops at the ticket or the briefing, like `/create-quick-feature` and
`/create-feature` do. Use it when you want the next change chosen by the player
rather than by the person who built the app.

## Where things live

```
specs/
├── features.md                  one line per feature — the index
├── quick/N-slug.md              one-page tickets, outside the chain
└── features/feature-N/
    ├── briefing.md              step 1
    ├── roadmap.md               step 2
    ├── prd/epic-*.md            step 3
    ├── tech-spec/epic-*.md      step 4
    └── prototype/*.html         optional, /prototype
```

The skills keep `specs/features.md` in step as they go, so the index never has
to be updated by hand: `/create-feature` adds the row, `/roadmap` and
`/brainstorm` keep its summary honest, `/writespec` marks it 🛠 Ready to
implement, and `/implement-feature` marks it ✅ Done once every acceptance
criterion is verified.

See also: [architecture.md](architecture.md) · [testing.md](testing.md)
