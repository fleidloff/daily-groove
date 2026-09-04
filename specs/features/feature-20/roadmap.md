# Roadmap — Modular architecture

Source: [briefing.md](briefing.md)

## Overview

Eighteen features have all landed in one slice. The slice shape promises that
work can be picked up independently, and it has never once paid out, because
`daily-groove` *is* the app. This feature draws the boundaries that were only
ever implied: one body of music theory both halves of the system share, one door
into the coaching modules, and a written module map with lint behind it.

A fourth epic — every word the app says, gathered into one file — was cut and
moved to [feature-21](../feature-21/), where translation pays for the same sweep.
Its settled PRD went with it.

Three epics, each independently useful: a duplication removed, a hub file
demoted, and a rule that stops both growing back. They run one after another
rather than in parallel — the reason is under Execution waves, and it is the same reason the
feature is worth building. Nothing here changes what the app
does — the app's behaviour is the invariant every epic is judged against, and
for Epic 1 the generator's *output* is a second invariant just as hard.

## Epics

### Epic 1 — One body of theory

**Visible when done:** music theory lives in one place, `src/lib/theory/`,
imported by both the generator and the app. `ROOTS` and the twelve scales exist
once. A thirteenth scale, or a change to an existing one, is one edit instead of
two that can disagree. Every rendered MP3 is byte-identical and
`grooves.lock.json` is untouched.

**Depends on:** none
**Parallel with:** none — it is first in a chain of three

**Contract frozen here, for Epic 3 to build against**
- the path and public surface of `src/lib/theory/` — Epic 3's lint zone names it,
  so the name is fixed on day one and the contents can follow.
- **no shims.** This epic moves every consumer to the new paths itself, so what
  Epic 3 builds against is the final surface rather than a temporary one. The
  cost is that Epic 2 cannot run beside it: both would edit `GroovePuzzle.tsx`,
  `GuessCard.test.tsx` and `puzzleHarness.tsx`. The three epics run in sequence,
  and the parallelism this feature buys is for the *features after it*, not for
  its own epics.

**Scope**
- the duplication is literal, not thematic. `ROOTS` is the same twelve-element
  array in `src/features/daily-groove/lib/theory/music.ts:6` and
  `scripts/grooves/theory/notes.ts:3`. The twelve scales' semitone sets are
  identical in `lib/theory/notes.ts:40` (`FLAVOUR_INTERVALS`, keyed `Ionian`)
  and `scripts/grooves/theory/scales.ts:20` (`INTERVALS`, keyed `ionian`)
- **all thirteen modules of `src/features/daily-groove/lib/theory/` move to
  `src/lib/theory/`** — `changes`, `character`, `degrees`, `difference`,
  `families`, `licks`, `music`, `notes`, `numerals`, `options`, `phrase`,
  `simpleModes`, `staff`. One theory module, no per-module argument about what
  counts as shared (Q2)
- **from the generator, `theory/notes.ts` and `theory/scales.ts` merge in** —
  they are the duplicated primitives. `harmony.ts`, `pitches.ts` and
  `validity.ts` stay in `scripts/grooves/theory/` and import the shared module:
  they take `MusicMeta`, `NoteEvent` and `VoiceName` from the generator's own
  `types.ts`, so they are the quality gate rather than theory, and dragging
  generator event types into `src/lib/` would invert the dependency the leaf rule
  protects
- **the slug is canonical** (Q1). `displayFlavour` — today at
  `scripts/grooves/cli.ts:31`, applied when the manifest is written — moves into
  the shared module, and the app converts at the edge. The slug is what
  `catalogue.json` and `grooves.lock.json` already hold, and `docs/music.md`
  pins the order of `FLAVOURS`
- resolve the one name collision the merge creates: `notes.ts` exists on both
  sides with different contents — the app's holds `FLAVOUR_INTERVALS` and
  `scaleNotes`, the generator's holds `ROOTS`, `pitchClassOf`, `midiOf`,
  `noteName`. Proposed split: `scales.ts` for the twelve and their intervals,
  `roots.ts` for the root list and pitch-class/midi conversion, `names.ts` for
  the slug-to-display conversion. The other eleven keep their names
- **one signature has to change, and it is the only one.** `music.ts` is pure
  except for `flavourOptions(date, groove)`, which closes over `GROOVES` from
  `../../data/grooves.generated` — an app import that `src/lib/` may not make.
  `flavourPool` already takes its grooves as a parameter; `flavourOptions` gains
  the same argument, and this epic updates the one call site in
  `GroovePuzzle.tsx` to pass its pool
- `isoDate` moves with them. It is a five-line date formatter that sits in
  `lib/puzzle/selectGroove.ts` by accident of history, and `music.ts` and
  `simpleModes.ts` both need it
- `Answer` and `Attempt` move from the feature's `types.ts` into
  `src/lib/groove.ts`, which already holds `Root`, `Flavour` and `Groove`.
  `types.ts` re-exports them, as it already does for the other three
- `options.ts` imports `@/lib/hash`. The `@/` alias does not resolve from
  `scripts/` — `docs/architecture.md` is explicit that this is why `src/lib/` is
  a leaf the generator reaches by relative path — so it becomes a relative import
- `scripts/grooves/boundary.test.ts` already asserts the generator reaches
  `src/features` only as the two manifests it writes. Extend it: `src/lib/` is
  the one channel in, and this move must not open a second
- **one existing assertion has to change, and it is load-bearing.**
  `boundary.test.ts:96` asserts `scripts/grooves/types.ts` still declares
  `Flavour`, and `coding-guidelines.md` explains at length why the generator's
  slug union and the app's display string are "not a duplicate" and why
  "unifying the two would be a behaviour change wearing a de-duplication's
  clothes". Q1 does not unify them — both spellings survive — but it moves the
  slug union and the conversion into `src/lib/theory/names.ts`, so the sentence
  the test guards stops being where the distinction lives. Rewrite the
  assertion and the paragraph together, or the guard fails for the right reason
  and gets deleted for the wrong one
- **narrow the generator tier trigger** (Q5). Feature-14 keyed it on the folder
  name, which was fair when `src/lib/` was two files the generator imports. After
  this epic it is roughly twenty and the generator imports five:
  `src/lib/groove.ts`, `src/lib/hash.ts`, and the shared primitives
  `theory/roots.ts`, `theory/scales.ts`, `theory/names.ts`. Trigger on those.
  Feature-14's own words are that "tier selection has to follow the import graph,
  not the folder name", and this epic is the change that makes the folder name
  stop being a good proxy

**Out of scope**
- any change to the generated catalogue. Not one MP3 re-renders, not one uuid
  moves. `docs/music.md` §"What must never change" names `MUSIC_LABEL`'s draw
  order and the order of `FLAVOURS` for the reason that matters to Sam: a
  re-render reassigns every past date's puzzle and breaks every share link
  already sent
- `src/lib/hash.ts`. Frozen, pinned by a fixed table in `hash.test.ts`, and not
  touched here
- adding a thirteenth scale. This epic makes that a one-edit job; it does not do
  it
- the generator's `harmony.ts`, `pitches.ts` and `validity.ts`, per the scope
  note above
- nothing deferred to Epic 3. The import lines under `components/` are this
  epic's to fix, mechanical as they are, because the alternative is two paths to
  the same module for as long as Epic 3 takes

**Validation**
- the demo path: `npm run grooves:verify` passes and `git status` shows
  `grooves.lock.json`, `catalogue.json` and `public/grooves/*.mp3` unchanged.
  Necessary, and **not sufficient** — `grooves:verify` hashes the committed
  outputs against the lock, so it proves nobody edited them; it never re-renders,
  so it cannot prove the refactored generator would still produce them. Epic 1's
  PRD carries that as its own requirement and asks how hard to prove it
- the generator tier (`npm run test:gen`) is green
- the same twelve interval sets and the same root order, asserted once, in the
  shared module's own test — the duplicate tests on both sides collapse into it
- the slug/display conversion is tested in both directions for all twelve,
  including the multi-word ones (`harmonic-minor` ↔ `Harmonic minor`) where the
  naive capitalisation is the thing that breaks
- `boundary.test.ts` still green, with its new `src/lib/` assertion failing when
  deliberately broken. A guard nobody has seen fail is not known to work
- `structure.test.ts` updated: `lib/` holds five concern folders now, not six
- the narrowed tier trigger is tested in both directions: editing
  `src/lib/theory/scales.ts` runs the generator tier, editing
  `src/lib/theory/licks.ts` does not. A trigger that fires on everything is the
  old rule with extra steps

### Epic 2 — The puzzle card feeds itself

**Visible when done:** `GuessCard` gets its derived state from one call into the
coaching module instead of 28 props, and `GroovePuzzle` stops computing what it
does not render. Two tracks that both add coaching behaviour can be dispatched
into the same wave. The puzzle plays, scores, nudges, locks and solves exactly
as it does today.

**Depends on:** Epic 1, and feature-18 finished
**Parallel with:** none

**Scope**
- `GroovePuzzle.tsx` is the serialization point: 9 of the last 40 commits, 395
  lines, 40 imports — 33 from its own feature, 23 of those reaching sideways into
  `lib/`, `data/` and `hooks/` — and a `GuessCard` call site passing 28 props.
  Feature-14
  split it to 274 lines by lifting `usePuzzleSession` and `useTransport`; it is
  back at 395. More hooks is not the fix
- of the 28 props, 13 are derived — `feedback`, `coaching`, `showVerdict`,
  `showNudge`, `dots`, `ruledOutRoots`, `ruledOutFlavours`, `confirmedRoots`,
  `confirmedFlavours`, `eliminated`, `showReveal`, `roots`, `flavours`. Every one
  is a pure function of attempts, answer, date and the two settings, and every
  one is currently `useMemo`'d in the parent and posted down
- **one entry point returning one view model for the whole guess card** (Q3):
  state in, every derived value out. A door that returns half the card leaves
  the parent computing the other half, which is the shape being removed
- it is a pure function, not a hook, so it is tested as a plain function per
  `docs/testing.md`
- `lib/presentation/` is eleven modules today — `coaching`, `coachingFamily`,
  `coachingMoves`, `confirmed`, `feedback`, `moves`, `nearMiss`, `ruledOut`,
  `verdict`, plus `date` and `staffLabel` — five of which arrived with
  feature-18
- `GuessCard` calls the entry point. The briefing settles this: a boundary only
  the parent may cross is not a boundary. The remaining props are the genuinely
  interactive ones — the callbacks, the two selections, `solved` and `revealed`
- the 2,426-line `GuessCard.test.tsx` — the largest file in the repo — should
  shrink as assertions about *what the coaching says* move to the module that
  decides it. Per `docs/testing.md`, a relocated assertion keeps its subject:
  this is a move, not a rewrite
- `date` and `staffLabel` are not coaching and do not belong behind that door.
  They stay as they are; the door is for the guess card's view model

**Out of scope**
- **any change to what the coaching says.** Feature-18 is choosing those words
  right now. This epic moves where they are computed and nothing else, and the
  existing cases passing unchanged is the proof
- the audio and puzzle modules. `lib/audio/`, `state/`, `lib/puzzle/` and
  `lib/persistence/` are named as modules in the briefing but are already behind
  reasonable seams and are not touched here
- a second `features/` slice. Deliberate, per the briefing: wait for a screen
  that is not the puzzle
- splitting `GuessCard.tsx` itself. It should shed props and test lines here; if
  it is still too big afterwards that is a finding, not this epic's job

**Validation**
- the demo path: play a full puzzle in the browser — first visit, a wrong guess
  at each rung of the ladder, the nudge, a lock-in, a solve, a give-up, a shared
  link — and see no difference
- every existing case still exists and passes, distributed across the new files.
  Count them before and after; a refactor that quietly drops tests is the failure
  mode to guard against
- `GuessCard`'s prop count is down from 28, and the removed ones are the derived
  thirteen — not thirteen arbitrary ones bundled into an object
- the view model is tested directly as a pure function, with the card's rendered
  behaviour still tested through the feature's public surface
- `structure.test.ts` knows about whatever the split creates, and the
  design-system boundary tests stay green

### Epic 3 — The module map is written down and enforced

**Visible when done:** `docs/architecture.md` names the six modules and the
arrows between them, `docs/coding-guidelines.md` carries the rules, and `npm run
lint` rejects an import that crosses a boundary the wrong way. `GroovePuzzle.tsx`
reaches coaching only through the narrow door Epic 2 builds, and a structural
test fails the moment it goes back to reaching past it.

**Depends on:** Epics 1 and 2 — it names what they create, and its guards would
fail against today's tree.

**Scope**
- name the six in `docs/architecture.md`: catalogue (`scripts/grooves/` + the
  generated manifests), theory (`src/lib/theory/`), audio (`lib/audio/` + its
  four hooks), puzzle (`state/`, `lib/puzzle/`, `lib/persistence/`), coaching
  (`lib/presentation/`), shell (`GroovePuzzle` + the routes). The document
  already explains why the dependency *direction* is load-bearing; this adds the
  arrows inside the slice, which it currently does not draw
- **a structural test on fan-in, expressed as a rule rather than a number**
  (Q4, Q6): assert `GroovePuzzle.tsx` imports nothing from `lib/presentation/`
  directly — only the coaching door. `coding-guidelines.md` already names the
  import list as "the tell": "a composer reaches *down* into the regions it
  assembles, so a long list of sideways `../lib/` imports means the file is
  holding logic that belongs behind a seam." The rule states what the count was a
  proxy for, for the one folder where the count actually grew
- **which means one entry point, and Epic 2 has already built it** (Q6). Of
  `GroovePuzzle.tsx`'s 23 sideways imports, **15 name a `lib/` module** across
  five concern folders — `presentation` (6), `theory` (4, in `src/lib/` after
  Epic 1), `audio` (3), `puzzle` (1), `persistence` (1). The other 8 are
  `../data/` (2) and `../hooks/` (6), which are not `lib/` and are unaffected, as
  is `../types`. The rule binds the six that name `lib/presentation/` and no
  others: that folder went from two modules to eleven, and the other four have
  been stable across nineteen features. So this epic adds no production file —
  it puts `metaLine` behind Epic 2's door and rewrites six import lines into one.
  Note the door is per concern *folder*, while the map's `puzzle` module spans two
  of them and its `audio` module includes hooks outside any folder — the map is
  how a reader groups the code, a door is what the import rule can check, and
  four of the six modules have no door at all
- **the entry point is narrow, and a test says so** (Q7). It exports what its
  consumers import through it and nothing more. This is the half of the
  `src/components/` no-barrel rule that transfers: "the grouping would stop
  telling a reader anything, because every path would end at the barrel." A wide
  barrel would let `GroovePuzzle.tsx` read as one import while reaching exactly
  as far as it does today — the rule would pass and the coupling would be
  invisible. A narrow door moves the tell from *how many paths* to *how wide is
  the door*, which is the question the fan-in count was always a proxy for. The
  test's one known limit: a test file counts as an importer, so the guard catches
  carelessness rather than determination
- so `coding-guidelines.md` gains the entry-point rule next to the no-barrel one,
  in two halves. Why one folder set gets doors and the other does not: the design
  system is a flat catalogue of interchangeable primitives, a feature module is a
  seam with a job. And **when a folder earns one: measured growth, not policy** —
  eleven modules and six of the composer's fifteen direct `lib/` imports bought
  coaching a door; four, three, one and one bought the others none. That second
  half is what lets a later feature add a door when its folder grows, instead of
  reading this epic's scope as a verdict
- extend the existing ESLint zone config rather than inventing a second
  mechanism. `docs/coding-guidelines.md` §"The five zones" documents what is
  there; this adds **three** — no `lib/` module imports UI, hooks or the store;
  audio imports neither coaching nor the puzzle module; the puzzle module imports
  neither coaching nor audio — each carrying a `message` naming the rule and the
  reason, as the existing ones do. Writing the first at `lib/` granularity is
  what collapses four missing arrows into three zones. One of them has a real
  violation to fire on: `lib/puzzle/narrowing.test.ts:4` imports
  `'../presentation/ruledOut'`, and the fix moves that assertion into
  `lib/presentation/ruledOut.test.ts`, whose arrow allows it. The only violation
  in the tree being in a test file is the case the guidelines say matters most
- there is nothing to unshim and no import block to fix: Epic 1 did that work
  itself. This epic checks it rather than performs it — no file imports an old
  `lib/theory/` path, and `flavourOptions` is called with its pool everywhere —
  which is why the epic is guards and documents rather than a diff across
  `components/`
- the honest part: **guard against regrowth this time.** Feature-5 cut
  `GroovePuzzle.tsx` from 362 lines to 274; it was 488 by feature-14, which
  looked at it, declined the split, and recorded the residual in its
  assumptions; it stands at 395 today with the fan-in worse than either. Both
  features shipped with no guard, and feature-14 said so in as many words
- update the agent definitions under `.claude/agents/` if the module map changes
  what a role needs to know

**Out of scope**
- **doors for the other four concern folders, deliberately.** `src/lib/theory/`,
  `lib/audio/`, `lib/puzzle/` and `lib/persistence/` get no `index.ts`, and
  `GroovePuzzle.tsx` keeps importing their modules directly — four, three, one
  and one specifier. Not an oversight: the guard follows the measured growth.
  `lib/presentation/` grew from two modules to eleven while supplying six of the
  shell's fifteen direct `lib/` imports; the other four have been stable across
  nineteen features, and a door on a folder that has not grown buys a barrel with
  no measurement behind it. The cost is real and worth naming — nothing guards
  the shell's imports into those four, so a regrowth there is caught by review
  alone, which is what failed twice before. The mitigation is the guideline rule:
  a door is earned by growth, so the next feature to grow one of those folders
  knows to add one, at the cost of one `index.ts` and one line in the fan-in
  test's ignore list
- **anything under `scripts/`.** With no door in `src/lib/theory/` there is
  nothing generator-side left: Epic 1 already extends
  `scripts/grooves/boundary.test.ts` with the `src/lib/` channel assertion,
  rewrites the `Flavour` assertion and narrows the tier trigger. This epic's one
  generator-adjacent job is documentary — repointing the guidelines' `Flavour`
  paragraph at `src/lib/theory/names.ts`
- restructuring `docs/coding-guidelines.md`. It stays the source of truth and
  keeps its shape; this epic adds the entry-point rule, rewrites the `src/lib/`
  "genuinely shared" bar that Q2 invalidated, and touches the `Flavour` paragraph
  Epic 1 moved — nothing else
- `docs/music.md`. It documents the generator's musical model, which Epic 1 does
  not change
- enforcing anything about `scripts/grooves/` beyond the boundary test that
  already exists

**Validation**
- the demo path: write an import that crosses a boundary the wrong way — a
  design-system component reaching into coaching, the shell reaching past a
  module's entry point — and watch `npm run lint` reject it with a message that
  says why
- the fan-in test fails when a direct `lib/presentation/` import — or a
  `vi.mock` of one — is added to `GroovePuzzle.tsx`, and passes on the tree this
  epic leaves. Both directions, or the rule is a claim nobody checked
- and a third direction, because the scope is a decision rather than an accident:
  adding a direct `lib/audio/` import to `GroovePuzzle.tsx` fails **nothing**,
  asserted by a case in the suite rather than left to be inferred
- the coaching door exports strictly what its consumers import through it,
  asserted by a structural test that reads both sides from disk. A door that
  re-exports its whole folder passes the fan-in test while defeating it, so this
  is the assertion that makes the other one mean anything
- break it deliberately: widen the door with an unused re-export and watch the
  test fail; then replace a line with `export *` and watch it fail on sight
- each new zone is tested by breaking it deliberately, once. A rule that has
  never been seen to fire is a comment. For both structural tests the
  demonstration is permanent as well as one-off: each is a pure predicate plus a
  disk read, and the predicate is unit-tested against a hand-written violation
- read the arrow list back against the import graph. Three of the arrows first
  written down are wrong — the shell *is* imported, by the feature's `index.ts`
  and the test harness; coaching is imported by five region components, not by
  the shell alone; audio has three hooks, not four — and the map is what changes
- no file imports the old `lib/theory/` paths
- the full gate is green: `npm test`, `npm run test:gen`, types, lint, build
- read `docs/architecture.md` back against the tree. If the map and the folders
  disagree, the map is wrong — it describes a shape that exists, it does not
  propose one

## Dependency map

```mermaid
graph LR
  F18[feature-18 finished] --> E2
  E1[Epic 1 — One body of theory] --> E2[Epic 2 — The puzzle card feeds itself]
  E2 --> E3[Epic 3 — The module map is enforced]
```

A chain, not a fan. Epic 1 hands Epic 2 the rewritten imports in the three files
they share; every later arrow is a file-ownership dependency rather than a
contract one.

## Execution waves

**All three epics run in sequence.** The obvious plan was Epics 1 and 2 at once
behind re-export shims, and it was rejected while the PRDs were written: a shim
means two paths to the same module for as long as the epic that removes them
takes, and if that epic slips the tree is worse than before the move. Epic 1
updates every consumer itself instead, which puts it inside `GroovePuzzle.tsx`,
`GuessCard.test.tsx` and `puzzleHarness.tsx` — the same three files Epic 2
rewrites. There is no honest way to run those two at once.

Worth naming plainly: this feature buys parallelism for the features that come
*after* it, and pays for it with a serial build of its own.

- **Wave 1:** Epic 1 — the only epic that can start immediately. It has no
  overlap with feature-18, and its internal tracks split cleanly: the primitives
  merge (roots, scales, names — the part the generator imports) is separable from
  the wholesale move of the app-only eleven, and the first is what the second
  depends on.
- **Wave 2:** Epic 2 — after Epic 1's import rewrite lands in the three files
  they share, and after feature-18 is finished.
- **Wave 3:** Epic 3 — its guards describe Epic 2's result and its lint zone
  names Epic 1's path, so it cannot start meaningfully before both land.
- **Feature-18 must finish first.** It owns the files under `lib/presentation/`
  that Epic 2 puts behind a door — `coaching.ts`, `coachingFamily.ts`,
  `coachingMoves.ts`, `moves.ts`, `verdict.ts`. Feature-18 is done and accepted as
  of 2026-09-03, so it no longer blocks Epic 2. Variations on the coaching
  wording may come later; if one is in flight when Epic 2 starts the original
  rule applies again — refactoring code whose wording is still being chosen is
  work done twice.

## Assumptions

- **The app's behaviour is unchanged by all three epics.** A player should not be
  able to tell this shipped. This is the invariant, not a goal.
- **No epic here is visible to Sam, and that is a deliberate exception to the
  rule that epics must be.** Feature-5 and feature-14 made the same exception for
  the same reason: the cost of building features is paid by every feature after
  it. This one is judged by the builder, and it should not be the next such
  feature for a while — three of nineteen is a defensible ratio, four would need
  an argument.
- **Epic 1 renders nothing.** The generator's output is frozen, and
  `grooves.lock.json` plus `grooves:verify` are what prove it. If the move turns
  out to require a re-render, that is not a refactor and the epic stops.
- **`src/lib/` goes from three files to roughly twenty.** That is what Q2's
  answer buys, and it is a real change in what the leaf directory is for:
  `coding-guidelines.md` currently admits a module only if it is "pure,
  dependency-free" *and* needed by both halves, and staff positions and mode
  descriptions meet the first test but not the second. Epic 3 rewrites that rule
  to match. Stated plainly because it is the assumption most likely to be
  regretted: if `src/lib/` becomes the place things go when nobody wants to
  decide, this feature caused it.
- **No shims, and therefore no parallel wave.** Epic 1 moves every consumer
  itself, so the tree never holds two paths to the same module. The price is that
  the three epics are serial — stated here because this feature's own pitch is
  parallelism, and it does not deliver any for itself.
- **`GuessCard` importing the coaching module directly widens what a feature
  component may know.** It is not a design-system primitive, so no architecture
  rule is breached — but the reflex that says "components take props" is worth
  overriding explicitly rather than quietly.
- **The 13-of-28 prop count is measured with feature-18's uncommitted work
  applied.** Feature-18 may change it before Epic 2 starts; re-count then.
- **Q2 weakens removability, and the guidelines say so out loud.** The bar for
  `src/lib/` is "genuinely shared — two callers on opposite sides of the
  app/generator boundary. Something only the feature uses belongs in
  `src/features/<feature>/lib/`, *where deleting the feature deletes it*." After
  Epic 1, deleting `src/features/daily-groove/` leaves eleven orphan theory
  modules — `licks`, `staff`, `character`, `numerals`, `degrees` and the rest —
  that nothing imports. `architecture.md`'s removability standard still holds
  literally (the app builds), but the folder stops being a clean cut. Accepted as
  the price of one theory module; worth revisiting if a second slice arrives and
  wants none of it.
- Six modules describes the tree as it is, not a target shape. If Epic 3 finds
  one does not survive contact with a lint zone, the map is what changes.
- Nothing here is a rewrite. Every epic rearranges code that already exists and
  already passes.

## Decisions taken

Settled through the roadmap cycles; `/brainstorm` inherits these rather than
reopening them.

1. **The slug is canonical.** `displayFlavour` moves into the shared module; the
   app converts at the edge. Both spellings survive — they are not unified.
2. **All thirteen of `lib/theory/` move** to `src/lib/theory/`, not only the
   duplicated primitives. From the generator, `notes.ts` and `scales.ts` merge
   in; `harmony.ts`, `pitches.ts` and `validity.ts` stay behind.
3. **One view model for the whole guess card**, returned by one pure function —
   not a per-concern set of doors, and not a hook.
4. **The hub file is guarded**, which neither feature-5 nor feature-14 did.
5. **The generator tier triggers on the five modules the generator imports**, not
   on the `src/lib/` folder name.
6. **The guard is a rule, not a number, and it is scoped to the folder that
   grew:** `GroovePuzzle.tsx` imports no `lib/presentation/` module directly,
   only the coaching door Epic 2 builds — one entry point, not five. The doors
   for theory, audio, puzzle and persistence were priced and cut: that folder
   went from 2 modules to 11 and supplies 6 of the shell's 15 direct `lib/`
   imports, while the other four have been stable across nineteen features. The
   choice is additive to reverse — one `index.ts` and one line in the fan-in
   test's ignore list per folder — and the guideline rule is written so a later
   feature knows when to.
7. **The coaching door is narrow, and a test asserts it.** Without this, 6 is a
   barrel file that hides the coupling it was written to expose. The test's
   limit is known and recorded: a test file counts as an importer, so it catches
   carelessness rather than determination — which matters more at one door than
   it would at five.
8. **The snippets decisions moved with Epic 4 to feature-21** — where they
   land, the "would a translator translate it" line, how the test half is
   guarded, and constants versus functions. They are recorded in
   [feature-21/every-word-in-one-place.md](../feature-21/every-word-in-one-place.md)
   rather than reopened here.
