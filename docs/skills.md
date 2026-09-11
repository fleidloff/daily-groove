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

## The quick door — when the chain costs more than the mistake

The five steps buy insurance against building the wrong thing. For a change you
can describe in five bullets that insurance costs more than the accident, so
there is a second door — two skills, analyze then build:

```
write specs/quick/N-slug.md  →  /quick-feature N  →  answer  →  /quick-feature N  →  /implement-quick-feature N
       What + Done when          Notes + questions                 folds them in            the code
```

You write what changes and what done means. `/quick-feature N` fills in the notes —
the files it expects to touch, the assumptions it took — and asks anything
blocking as tickable options inside the same file. Run it again once those are
ticked: it folds the answers in and asks whatever they opened up, the same
cycle as steps 2–4, until nothing is left open. **It writes no code at all.**
`/quick-feature <what to change>` drafts the whole ticket for you instead, when
you'd rather not open the file. `/create-quick-feature` is the middle way: it
interviews you like `/create-feature` does, writes only `What` and `Done when`,
and stops — the ticket then enters `/quick-feature N` as a hand-written one.

`/implement-quick-feature N` builds it, and refuses a ticket that was never
analyzed or still has a question open. No epics, and the build happens in the
lead — there is no parallelism to buy across two files. Two agents still run:
the `musician` for anything under `scripts/grooves/`, and the `verifier` as the
gate, grading the ticket's `## Done when` bullets over the full lint / test /
build set the way it grades an epic's acceptance criteria. The lead fixes what
it finds; the verifier cannot.

### The three skills

| Run | What it does | Writes | Refuses |
| :-- | :-- | :-- | :-- |
| `/create-quick-feature` | Interviews you the way `/create-feature` does, then stops. The middle way in, when you'd rather be asked than open the file. | `specs/quick/N-slug.md` — `## What` and `## Done when` only | nothing; it is the first step |
| `/quick-feature N` | Reads the ticket against the tree, runs the size test, names the files the change will touch and the assumptions it took, and asks anything blocking as tickable options in the ticket. Re-run folds the answers in. **Writes no code, not even a test.** | `## Notes`, `## Open questions`, `## Answered` in the ticket | nothing — but it re-analyzes no settled ticket, and says so |
| `/implement-quick-feature N` | Re-runs the size test against the real files, writes the test then the code **in the lead**, gates it with the `verifier`, fixes what comes back, and records what was built. | the code, `## Built` in the ticket, the row moved to ✅ | a ticket with no `## Notes`, an unticked question, or answers never folded in |

Neither is the cheap door for a real feature. Four questions decide:
five bullets or fewer, at most two of the six modules in
[architecture.md](architecture.md), nothing frozen in [music.md](music.md)
touched, one `git revert` to roll back. `/quick-feature` runs them against the
ticket, `/implement-quick-feature` re-runs them against the files it opens. Any
"no" is a **suggestion** to move the work to `/create-feature` — including
halfway through the build, if that is when the truth turns up. It is not a gate:
say which question failed and what it costs, then carry on unless the user moves
it. Whether a ticket is too big for this door is theirs to decide, and their
waiver goes in the ticket in their own words.

Quick changes get their own table in `specs/features.md`, so the index still
shows everything that shipped. Their status runs 📝 Drafted → ❓ Questions open →
🛠 Ready to build → ✅ Done.

The chain can hand over too. `/roadmap` runs the same four questions against
the briefing before it shapes epics, and when they all pass and the answer would
be one epic, it asks whether to move the feature here instead. Say yes and it
writes the ticket from the briefing, deletes the feature folder, moves the row,
and points at `/quick-feature N`.

## The third door — designing it in chat

The chain asks its questions inside the document; the quick door asks them
inside the ticket. This one asks them in the conversation and writes the answers
down as they land:

```
/vibe-with-docs  →  one question at a time  →  spec.md  →  tech-spec.md  →  /implement-vibe-with-docs N
                     answers written down as they land        the code, then the record
```

`/vibe-with-docs` allocates `specs/tmp/N-title/` on the first turn and starts
asking — one question per message, never a list — until it is 90% confident it
could build the right thing without guessing. Each question arrives as two to
four options with exactly one recommended and the reason for it, and `sam`'s
verdict quoted inside the options where the answer turns on the player. Every
answer goes into `spec.md` before the next question, so **stopping after any
answer is safe**: defining a feature over a week, a few questions at a time, is
the normal way to use it. Once the product is settled it moves to
`tech-spec.md` and asks the implementation questions the same way. It writes no
code.

`tech-spec.md` is decomposed the way `/writespec`'s are: contracts frozen up
front, tracks that own disjoint files, a role per track, and waves — split into
epics when the change has two things that ship and verify on their own, and left
as one track when it does not.

`/implement-vibe-with-docs N` builds it, test first: it writes the contracts in
the lead, then dispatches one agent per track in each wave by the role the track
declares, or builds in the lead when there is a single track. The `verifier`
gates it against `spec.md`'s `## Done when` bullets. Then it does the part
that makes the door work: turns the decisions worth keeping into records in
[adr/adrs.md](adr/adrs.md), updates whichever documents under `docs/` the change
made untrue, adds the row to the *Vibed changes* table in
[../specs/features.md](../specs/features.md) — and **deletes the temporary
folder**, so the deletion arrives in the same diff as the change. The archive
row and the ADRs are the only record that survives it, which is why writing
them is not optional.

### The two skills

| Run | What it does | Writes | Refuses |
| :-- | :-- | :-- | :-- |
| `/vibe-with-docs` | Allocates the folder, then interviews you in chat — one question per message, options with one recommended, every answer written down before the next question is asked. Settles the product first, then the implementation. **Writes no code.** Re-run with the number to resume where you stopped. | `specs/tmp/N-title/spec.md`, then `tech-spec.md` | nothing; it is the way in |
| `/implement-vibe-with-docs N` | Writes the contracts in the lead, runs the tracks in waves — one agent per track, by the role the track declares — or builds in the lead when there is one track. Gates with the `verifier`, then writes the permanent record and deletes the folder. | the code, the ADRs, the `docs/` corrections, the archive row — and the folder's deletion | a folder with no `tech-spec.md`, an `## Open` bullet the build needs, or an empty `## Done when` |

`/vibe-with-docs` takes a subject (`/vibe-with-docs a jam mode`), a number to
resume (`/vibe-with-docs 1`), or nothing — bare, it asks what you are building,
or lists the folders in `specs/tmp/` when some are open.

**Which door.** All three can fan work out, so size is not what picks between
them — uncertainty is. The chain is for a feature where the *requirements* are
the risky part: it writes a briefing, a roadmap and a PRD per epic before any
spec exists, and verifies each epic on its own. The quick door is for a change
already clear enough to fit in five bullets. This one is for the middle — you
know what you want, the details need talking through, and you would rather talk
than write. It runs the same four size questions and, like the quick door, only
ever *suggests* moving the work; that call is yours.

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
the quick door's four size questions against it. All four pass and it hands
the finding to `/create-quick-feature` as a ticket; any fail, or any doubt, and
it hands it to `/create-feature` as a lettered candidate.

```
/create-feature-for-persona  →  specs/quick/N-slug.md          →  /quick-feature N  →  /implement-quick-feature N
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
├── tmp/N-title/                 vibed changes — deleted once shipped
│   ├── spec.md                  what changes, and what done means
│   └── tech-spec.md             how it gets built
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
criterion is verified. Quick tickets work the same way: `/quick-feature` moves
the row to ❓ Questions open or 🛠 Ready to build, and only
`/implement-quick-feature` writes ✅. A vibed change gets no row until it
ships: `/implement-vibe-with-docs` writes one into *Vibed changes* as the last
thing it does before deleting the folder.

See also: [architecture.md](architecture.md) · [testing.md](testing.md) ·
[adr/adrs.md](adr/adrs.md)
