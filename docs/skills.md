# Skills — the order to run them

Every feature goes through the same five steps, in this order. Each one reads
what the previous one wrote, so skipping ahead doesn't work: `/roadmap` refuses
to run without a briefing, `/writespec` without a PRD, `/implement-feature`
without a tech spec.

```
/create-feature  →  /roadmap  →  /brainstorm  →  /writespec  →  /implement-feature
   briefing.md      roadmap.md     prd/*.md      tech-spec/*.md      the code
```

## The five steps

| # | Run | What it does | Writes |
| :-- | :-- | :-- | :-- |
| 1 | `/create-feature` | Asks what the feature is, and records your answer as bullets. | `specs/feature-N/briefing.md` |
| 2 | `/roadmap feature-N` | Splits the briefing into epics that each ship something visible. | `specs/feature-N/roadmap.md` |
| 3 | `/brainstorm feature-N` | Turns each epic into a PRD — requirements and acceptance criteria. | `specs/feature-N/prd/epic-*.md` |
| 4 | `/writespec feature-N` | Turns each PRD into TDD implementation steps, split into parallel tracks. | `specs/feature-N/tech-spec/epic-*.md` |
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

## `/verify-epic`

`/implement-feature` runs `/verify-epic` itself at the end of every epic, so you
don't normally need it. Run it by hand — `/verify-epic feature-8 epic-2` — when
you want to re-check an epic later, or after changing code by hand. It runs the
tests, types, lint and build, traces every acceptance criterion, and reports
done / partly / not done. It diagnoses, it doesn't fix.

## `/create-feature-for-persona`

A different way into step 1. It walks the live app in character as the persona in
[persona.md](persona.md) — first run with empty `localStorage`, then as a
returner — reports what that person likes, what they find unclear and what they
miss, picks the single strongest finding, and hands it to `/create-feature` as
the briefing for the next free number.

```
/create-feature-for-persona  →  briefing.md  →  /roadmap feature-N  →  …
```

It stops at the briefing, like `/create-feature` does. Use it when you want the
next feature chosen by the player rather than by the person who built the app.

## Where things live

```
specs/
├── features.md              one line per feature — the index
└── feature-N/
    ├── briefing.md          step 1
    ├── roadmap.md           step 2
    ├── prd/epic-*.md        step 3
    └── tech-spec/epic-*.md  step 4
```

The skills keep `specs/features.md` in step as they go, so the index never has
to be updated by hand: `/create-feature` adds the row, `/roadmap` and
`/brainstorm` keep its summary honest, `/writespec` marks it 🛠 Ready to
implement, and `/implement-feature` marks it ✅ Done once every acceptance
criterion is verified.

See also: [architecture.md](architecture.md) · [testing.md](testing.md)
