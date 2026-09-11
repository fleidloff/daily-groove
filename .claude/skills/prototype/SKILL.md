---
name: prototype
description: Build a clickable HTML prototype of a feature, a quick ticket or a vibed change — one self-contained file under the spec folder, dressed in the app's own tokens, with every screen and state reachable from a switcher bar. Reads `specs/features/feature-X/prd/*.md`, `specs/quick/N-slug.md` or `specs/tmp/N-title/spec.md` and refuses to run while their questions are open. Use whenever the user runs `/prototype`, or asks for a clickable mockup, a click-dummy, a walkthrough, or to see what a spec would look like before it is built.
argument-hint: [feature-X [epic-N] | N | VN]
---

# Prototype

A spec you can click. One HTML file, opened straight from disk, that shows what
the settled requirements actually feel like on a phone — before an epic is
specced into tracks and long before any of it is built.

**It exists to be wrong cheaply.** The PRD says the hint box keeps the coaching
line all day; the prototype is where you find out it pushes the chips below the
fold. Finding that here costs one file. Finding it in `/implement-feature` costs
an epic.

It is a step in no door. `/writespec` doesn't wait for it,
`/implement-feature` never reads it, and `/implement-vibe-with-docs` doesn't
either. Run it when a PRD, a ticket or a vibed `spec.md` is settled and you want
to look at it, or skip it entirely.

## 0. Never commit, never touch `src/`

No `git add`, no `git commit`, no branch. And nothing outside the prototype file
itself changes — not a component, not a token, not a test. A prototype that
edited the app would be the feature, badly.

## 1. Resolve the target

| Invocation | Reads | Writes |
| :-- | :-- | :-- |
| `/prototype feature-8` | every PRD in `specs/features/feature-8/prd/` | `specs/features/feature-8/prototype/index.html` |
| `/prototype feature-8 epic-2` | that one PRD | `specs/features/feature-8/prototype/epic-2-<slug>.html` |
| `/prototype 7` | `specs/quick/7-*.md` | `specs/quick/7-<slug>.prototype.html` |
| `/prototype V4` | `specs/tmp/4-<title>/spec.md` | `specs/tmp/4-<title>/prototype.html` |
| bare `/prototype` | — | list what is prototypable and ask which |

Accept loose input the way `/brainstorm` §1 does: `8`, `feature 8` and
`specs/features/feature-8` all resolve. A bare number is a quick ticket only
when `specs/quick/N-*.md` exists and no feature folder was named.

**A vibed change is addressed by its `V`**, the same letter the terminal title
and the *Vibed changes* table use — `V4`, and `tmp-4` or
`specs/tmp/4-jam-mode` as well. Bare `4` stays the quick ticket, because that
is already what it means; a bare number never resolves to `specs/tmp/`.

A vibed prototype lives inside the folder it describes, and
`/implement-vibe-with-docs` §9 deletes that folder once the change ships. That
is the right lifetime — the picture expires with the spec it drew — but it
means the file is not where anything is preserved. §7 says what has to leave it
first.

Re-running over an existing prototype rewrites it. Say so first if the user's
own edits are in the file — check `git status` before overwriting.

## 2. The gate

**A feature is prototypable only once its PRDs are settled.** For every epic in
scope: `specs/features/<feature>/prd/epic-<N>-*.md` exists, and its
`## Open questions` section is either gone or holds nothing unticked. If a PRD
is missing, point at `/brainstorm <feature>` and stop. If questions are open,
name them and stop.

The gate is not bureaucracy. Drawing a screen forces a hundred small decisions,
and against an unsettled PRD you make every one of them yourself — then the
answers come back and the prototype is arguing with the requirements. Worse, the
picture is persuasive: a screen the user has clicked through quietly becomes the
requirement, and the question they were about to answer never gets asked.

**A quick ticket needs less.** `## What` and `## Done when` are enough — the
analyze phase is `/quick-feature`'s job, not a precondition for a picture. But
if `## Open questions` is there with anything unticked, the same rule applies:
say what is open, stop.

**A vibed change is gated on `spec.md`, not on `tech-spec.md`.** A prototype is
a question about the product, and `tech-spec.md` is the code — a spec still in
its `spec` phase is prototypable, and often that is exactly when it is worth
drawing. What must hold: `## What` and `## Done when` both say something, and
nothing under `## Open` is a question the drawing would have to answer. Per
`/vibe-with-docs` §5 that section carries the question currently being asked,
so an open bullet there is usually the live one — if it decides a screen, name
it and stop, the way a PRD's does. A bullet parked on something the picture
never shows — a storage key, a test boundary — doesn't block.

The `**Phase:**` line is the quick read: `tech spec` or `ready to build` means
the product is settled.

**Most quick tickets don't want one at all.** A ticket you can describe in five
bullets is usually faster to build than to draw. Say so and point at
`/quick-feature N` — or `/implement-quick-feature N` if it is already analyzed —
unless the change is visual enough that a picture settles something words are
circling.

## 3. Read the inputs

- **The PRD, the ticket, or the vibed `spec.md`.** The requirements are the
  brief. Every screen and every state in the prototype should trace to a line
  in it. For a vibed change that is `## What` and `## Done when`; read
  `## Decided` too, because a decision with its reason written down is one the
  drawing must not quietly re-take. Don't read `tech-spec.md` — it is the code,
  and drawing from it makes the picture a diagram of the build.
- **`docs/persona.md`.** Sam is on a phone, twenty minutes before dinner. That
  decides the frame width, the tap targets and what has to be visible without
  scrolling — the same tie-breaker `/brainstorm` §2 uses.
  Where the drawing has to invent something the requirements left silent *and*
  the invention is the player's business — what sits above the fold, whether a
  control is there at all, what the copy calls a mode — dispatch the `sam` agent
  and record its verdict in the invented-list, instead of settling it by taste.
- **`src/app/globals.css`.** The `@theme` block is the palette, the radii and
  the shadow. Copy the values; do not invent a second set.
- **The nearest existing components**, for shapes you are reusing — a chip row,
  a card, the header. Read them to match the look. Never import them.

Don't read `docs/architecture.md`, the lint zones or `docs/music.md` for this.
None of them binds a file that no build touches, and a prototype written as if
they do turns into a draft implementation.

## 4. What the file is

One self-contained `.html`: inline `<style>`, inline `<script>`, no npm, no
build step, no CDN, no framework, no external request of any kind. It has to
open with `open <path>` from a clean checkout on a plane.

```
:root { tokens copied from globals.css }   <- one place, both palettes
.frame { max-width: 420px; margin: auto }  <- the phone, centred
<nav class="states">                       <- §5, the switcher
<section data-state="…"> … </section>      <- one per state, one visible
<script> switcher + the two or three fake interactions </script>
```

- **Both palettes.** Copy the `@media (prefers-color-scheme: dark)` overrides
  too. Half the point of matching the tokens is seeing the dark one.
- **Fonts fall back.** The app loads Newsreader, DM Sans and the jazz hand
  through `next/font`; a file on disk can't. Use `Georgia, serif` and
  `system-ui, sans-serif` and note in the report that the display face is
  standing in.
- **Fake data, plainly fake.** Hand-written groove names, a hand-written date.
  No import from `data/*.generated.ts`, no reading of the real catalogue.
- **No audio.** A play button toggles a visible playing state and nothing else.
  Sound is the one thing a prototype can't help with, and wiring an `<audio>` to
  a file under `public/grooves/` buys a demo the spec didn't ask for.

## 5. Every state reachable in one click

This is what separates a prototype from a screenshot, and it is the part worth
spending the effort on.

A fixed bar at the top of the page, outside the frame, with one button per state
the PRD — or the vibed spec's `## Done when` — describes — *first run · unsolved · one miss · root confirmed · solved ·
gave up*. Clicking one shows that state. Label the bar as scaffolding, in a
colour nothing in the app uses, so nobody mistakes it for a screen.

**Both routes into every state.** The bar jumps there; the screen's own controls
also get there — a guess that lands wrong moves to the miss state, Check moves
to solved. Only the flows the PRD actually names need to work; a control that is
out of scope for this feature can be inert, as long as it looks inert.

Anything genuinely uncertain gets both versions as two states side by side, and
say in the report which two you want the user to compare. That is the fastest
question this skill can ask.

## 6. Fidelity: the look, never the code

Match the app closely enough that a judgement made here holds when it is built —
the tokens, the spacing, the radii, the phone width, the type scale.

Then stop. No React, no TypeScript, no component split, no state machine, no
accessibility work beyond real `<button>`s and readable contrast, no test. The
prototype is thrown away the moment the epic is built, and every hour spent
making it good code is an hour spent on a file with a known expiry date. If you
catch yourself factoring out a component, you are building the feature.

Vanilla JS, one script block, `data-` attributes and `classList`. Thirty lines
is a normal amount.

## 7. Record it beside the spec

Append to the PRD, to a quick ticket's `## Notes`, or to a vibed `spec.md`:

```markdown
## Prototype

* `prototype/index.html` — states: first run, unsolved, one miss, solved, gave up
* invented, not in the PRD: <each thing the drawing needed and the spec doesn't say>
* to compare: <the fork you built twice, if any>
```

**The invented list is the output that matters most.** Everything the prototype
had to decide because the requirements were silent is a gap the PRD didn't know
it had, and the list is what turns a picture back into a question. Keep it
literal — "the miss counter's position", "what the button says after a give-up"
— not "some visual details".

Nothing else changes: not `specs/features.md`, not the PRD's requirements, not
its `## Question log`. If the invented list is long enough to reshape the
requirements, say so and point at `/brainstorm <feature>`; folding answers in is
that skill's job and doing it here would bypass the log.

**For a vibed change the list has one more place to go, and it is not optional.**
The folder is deleted when the change ships, so a gap recorded only in the
`## Prototype` note dies with the file that found it. Anything the drawing
invented that the user should actually decide goes under `## Open` in `spec.md`
as a question — written the way `/vibe-with-docs` §5 writes one, with its two to
four options and which you would recommend — so the next `/vibe-with-docs <N>`
picks it up and the answer lands in `## Decided`, where §8 of the build can turn
it into a record. Don't answer it here: this skill draws, it does not settle.

## 8. Checks

There are none to run. The file is outside `src/`, no build compiles it and no
test imports it — running `npm run lint` or `npm test` here proves nothing about
the prototype and only tells you whether the tree was already green.

What replaces them is looking at it. Open it, click every button in the
switcher, click through each state's own flow, and check the dark palette by
flipping the system appearance. Say in the report that you did, or say which
parts you couldn't check.

## 9. Report

The file path and the `open` command to run it. The states it holds. The
invented list from §7, in full — it is the reason to read the report. Anything
standing in for the real thing (fonts, data, silence where audio would be). Then
the next step: `/writespec <feature>` if the picture confirmed the spec,
`/brainstorm <feature>` if it opened questions, `/quick-feature N` for a ticket,
`/vibe-with-docs <N>` for a vibed change — which is the next step either way
there, whether to answer what the drawing opened or to move on to the tech
spec.
