# PRD template

Copy this structure. Drop any section that would be filler for the epic at hand
— a short PRD that is entirely load-bearing beats a complete-looking one padded
to fit a template. `Requirements`, `Acceptance criteria`, and `Out of scope` are
the ones worth fighting for.

`Question log` and `Open questions` are the two sections the reconcile cycle
maintains. Keep them in this order, at the end, so answering is always the last
thing on the page.

---

# PRD — Epic <N>: <epic name>

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Two or three sentences: what this epic delivers and who it's for. A reader
should be able to stop here and know whether the rest concerns them.

## Problem

What's broken or missing today, and why it's worth solving now. If the briefing
already says this, compress it to a sentence rather than restating it.

## Scope

What this epic covers, in one short list. Then the boundary:

**Out of scope**
- <thing a reader would reasonably assume is here> — lands in Epic <M>
- <thing that is deliberately not being built at all>

The out-of-scope list prevents the most expensive kind of rework, so write it
even when it feels obvious.

## Requirements

Numbered so they can be referenced in review, in commits, and from the question
log. Each states observable behaviour, not implementation.

- **R1** — The user can <do X> from <where>.
- **R2** — When <condition>, the system <behaviour>.
- **R3** — <constraint or rule that governs the above>

Cover the unhappy paths: empty state, first run, invalid input, failure, repeat
or concurrent actions. That's where PRDs usually turn out to be silent.

Requirements that came out of an answered question read exactly like the others
— decided, unqualified, no reference to the question that produced them.

## Behaviour details

Only when a requirement needs more than a line — a rule with edge cases, a state
machine, an ordering guarantee. Use a diagram here if one earns its place (see
[uml.md](uml.md)).

## Acceptance criteria

Given / When / Then, each traceable to a requirement. These become the tests, so
write them as things that can actually be asserted.

- **AC1** (R1) — Given <state>, when <action>, then <observable result>.
- **AC2** (R2) — Given <state>, when <action>, then <observable result>.

## Dependencies

What must exist before this epic can start, and what it hands to later epics.
Name the contract — route, type, payload shape — not the implementation, so
neighbouring epics can proceed in parallel against it.

## Assumptions

Lower-stakes calls made without asking, so a reader can challenge them. Anything
here that turns out to be high-impact becomes a question in the next cycle.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — <YYYY-MM-DD>

**Q1. Can an entry be edited after its day has ended?**
Answer: **A) Editable indefinitely** — nothing depends on entries being
immutable, and a lock would need its own UI to explain itself.
Applied to: R7, AC5, Out of scope

**Q2. <question>**
Answer: **<option> <one-line reason>**
Applied to: <requirement / AC / section references>

### Cycle 2 — <YYYY-MM-DD>

...

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/brainstorm <feature> <epic>` — the answers get folded into the
sections above, moved into the log, and replaced with whatever they open up.

Remove this section entirely once nothing high-impact is left.

### Q3. <question>

- [ ] A) <option> *(recommended — <what in the briefing or roadmap supports this>)*
- [ ] B) <option>
- [ ] C) <option>
- [ ] D) <option>
