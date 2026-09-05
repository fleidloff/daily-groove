# Roadmap — Five new styles

Source: [briefing.md](briefing.md)

## Overview

The catalogue has six feels and twelve modes, paired one-to-one, and that pairing
is the reason a seventh feel cannot exist. Epic 1 removes it, gives a template a
way to declare rhythm figures the shared pools do not carry, and spends both on
Bossa Nova, so the mechanism is proved by something Sam can hear. Epics 2–5 are
one style each, in decreasing order of how different they sound from what is
already there. Son montuno goes last because it is the only one waiting on
another feature's voices. Each style mints six grooves, so the catalogue goes
from thirty to sixty — two months before anything repeats. Epic 6 is the release:
it reshuffles all sixty into one new mix, and makes mixing new grooves through
the old ones the rule for every addition after this one rather than something
this feature did once.

## Epics

### Epic 1 — A feel can carry more than two modes, and Bossa Nova proves it

**Visible when done:** Sam hits play and hears a bossa — rim clicking the clave,
the kick as a surdo, keys on the syncopated comp — a style the app has never made
before, and the mode behind it is one they have already met under a different
feel.
**Depends on:** none
**Parallel with:** none — every later epic adds a template, and this epic decides
what a template is

**Scope**
- drop the "exactly two flavours, pairwise disjoint" rule: a template declares
  at least two modes and at most four, and two templates may share one. Both
  ends are asserted in `templates/index.test.ts` — the lower bound is what keeps
  a feel from being a giveaway, the upper what keeps it a clue at all
- rewrite the assertions in `scripts/grooves/templates/index.test.ts` that
  encode it — `gives every template exactly two flavours`, `keeps the pairs
  pairwise disjoint`, `covers exactly the twelve flavours the game offers`,
  `pairs each flavour with a feel that suits it` — and the `TEMPLATE_COUNT`-derived
  counts that ride on them (`splits the twelve evenly between the two families`,
  the unique-swing and unique-tempo-range assertions)
- keep the two guarantees the rule was standing in for, as their own assertions:
  every flavour the game offers has at least one groove behind it, and no groove
  answers to a flavour no template offers (`catalogue.test.ts` already tests both)
- widen `catalogue.test.ts`'s `lets no mode dominate the answers` cap from 3× to
  5×. Overlapping sets put ionian in three templates and harmonic-major in one,
  a spread near 7-to-2, which fails at 3× and clears 4× too narrowly for a sixth
  style to be added later without breaking it again. The exact number is Epic 1's
  to set once the mint's real counts are in; the cap is a guard against one mode
  swallowing the catalogue, not a coverage target — asked directly, Sam's answer
  was "I can't feel a ratio. I can feel a repeat"
- rewrite `docs/music.md` "The six feels" — the sentence, the heading, the table
  — and add the per-template `patterns` block to "Where to change what", beside
  the row that sends rhythm figures to the pools in `events.ts`
- add an optional `patterns` block to `FeelTemplate`: per voice, the rhythm
  figures a template draws from instead of the shared pool in `events.ts`,
  falling back to that pool for every voice it does not name. The existing six
  omit it and draw exactly what they draw today, so nothing re-renders — it is
  the shape `PLACEMENTS` and `FILLS` already use, one level down
- the block covers **every** drawn pool from the start — kick, foot hat, ride,
  bass, comp, bongos and snare ghosts — each field optional, each keeping its
  pool's own shape: flat step lists for most, `{ high, low }` for the bongos,
  keyed by subdivision for the ride. Three epics write templates against this in
  parallel in wave 2 and none of them can afford to reopen it, so Bossa Nova
  leaves four of the seven fields empty and that is the price
- write `templates/bossa-nova.ts` — 120–140 bpm, straight, the modes
  `new-styles.md` proposes and the `musician` settles; the bossa clave on the
  rim through `PLACEMENTS`, the surdo kick and the syncopated comp figure
  through the new `patterns` block
- register it in `templates/index.ts`, mint **six** grooves, re-render the
  manifest and the lock
- listening sign-off: it sounds like the style it claims to be

**Out of scope**
- the other four styles — epics 2–5
- adding modes to any of the six existing templates. `pick` scales the draw by
  the list's length, so an append re-renders that template's grooves and
  reassigns their answers; `docs/music.md` "What must never change" already
  freezes those six lists and this epic does not unfreeze them

**Validation**
- `npm run test:gen` — the rewritten flavour-coverage suite is green, and
  `catalogue.test.ts`'s coverage assertions still are
- `npm run grooves:verify` — no unrendered catalogue, no stale manifest
- `git status` after `npm run grooves` shows the thirty existing mp3s unchanged
- `npm test`, `npm run lint`, `npm run build`
- open the app, reach the new style's groove by uuid, and play it

### Epic 2 — Reggae one-drop

**Visible when done:** Sam meets a groove with nothing on beat one — kick and rim
together on three, hat on the off-beats, bass carrying it — and hears something
the app has never sounded like.
**Depends on:** Epic 1
**Parallel with:** Epics 3, 4 (see the waves note)

**Scope**
- `templates/reggae-one-drop.ts`: 70–80 bpm, straight, aeolian / mixolydian /
  ionian
- the one-drop: the rim on 3 through `PLACEMENTS`, and a kick figure that leaves
  beat one empty — which needs the `patterns` block, because every figure in
  `KICK_PATTERNS` hits step 0 — plus the skank comp figure
- mint six grooves, re-render the manifest and the lock, sign off by ear

**Out of scope**
- new voices. Everything it needs is in today's eleven

**Validation**
- `npm run test:gen`, `npm run grooves:verify`, the full pre-push set
- play it: beat one is empty and it still keeps time

### Epic 3 — Second line / New Orleans

**Visible when done:** Sam meets a kit-led groove — syncopated snare over a
clave-ish kick, toms and rim earning their place, keys sparse.
**Depends on:** Epic 1
**Parallel with:** Epics 2, 4

**Scope**
- `templates/second-line.ts`: blues / mixolydian, bass following the kick
- its snare and kick figures, and a fill vocabulary — this is the style where
  the fill is part of the idiom rather than a bar-four punctuation
- mint six grooves, re-render, sign off by ear

**Out of scope**
- new voices

**Validation**
- as Epic 2, plus: the density band holds with a busy snare

### Epic 4 — Boom-bap

**Visible when done:** Sam meets an 85–95 bpm groove with swung sixteenths, a
hard kick and snare and ghost notes underneath.
**Depends on:** Epic 1
**Parallel with:** Epics 2, 3

**Scope**
- `templates/boom-bap.ts`: dorian / aeolian / phrygian, swung sixteenths, sparse
  comp
- mint six grooves, re-render, sign off by ear

**Out of scope**
- new voices

**Validation**
- as Epic 2, plus one judgement made out loud: back to back with `straight-funk`
  and `half-time`, does it read as its own feel? `new-styles.md` flags it as the
  closest of the five to what exists

### Epic 5 — Son montuno, and the claves finally get heard

**Visible when done:** Sam meets a groove where the bongos lead instead of
decorate, the claves carry the 2-3 clave and the bass anticipates — and the four
voices feature-24 bought get played for the first time.
**Depends on:** Epic 1, and feature-24 shipped
**Parallel with:** nothing — it is last

**Scope**
- `templates/son-montuno.ts`: mixolydian / dorian / phrygian-dominant
- the 2-3 clave on the claves, the tumbao bass, the montuno comp figure, bongos
  as a lead voice, cowbell keeping time
- **the claves' and cowbell's listening pass.** Feature-24 verified their round
  robins by counting files in `pack.json` and rendered neither. This epic is the
  first to hear them, and owns finding out whether a bare wood transient
  machine-guns over a four-bar loop
- budget for re-sourcing one voice if it does
- mint six grooves, re-render, sign off by ear

**Out of scope**
- the ride bell, unless the cowbell turns out to be the wrong sound for the part

**Validation**
- as Epic 2, plus: the claves survive four bars without sounding like a sample
  trigger, and the rim is silent in every groove this template renders

### Epic 6 — New grooves mix into the rota, this release and every one after

**Visible when done:** Sam plays through the week after the release and the
order is one two months of playing gives them no way to predict — new styles and
old favourites interleaved by the shuffle, with the sixty coming round in a
sequence that has nothing to do with the thirty they had learned. The same is
true the next time styles are added, without anyone having to remember to make
it true.
**Depends on:** Epics 1–5 — the mix can only be fixed over grooves that exist
**Parallel with:** nothing — it is last, and it is the release

**Scope**
- add a rota epoch to `selectGroove.ts`: the per-lap shuffle seed goes from
  `lap:${lap}` to `${ROTA_EPOCH}:lap:${lap}`, and this feature bumps the epoch.
  It changes the seed *string*, not the hash — `src/lib/hash.ts` and its fixed
  table are untouched, which is exactly what keeps this a reshuffle and not one
  of the re-releases `docs/music.md` forbids
- **the standing rule, which is the point of the epic:** every release that
  mints grooves bumps the epoch, so the whole catalogue reshuffles rather than
  new grooves being appended to an order that already exists. The mixing is what
  a uniform shuffle over all of them gives you — no interleave, no front-loading,
  and no promise about *when* a new style first turns up. Day one after the
  release may well be a groove Sam already knows, and that is accepted: the mix
  is genuinely new every time and which morning the bossa lands on is luck
- the epoch is one integer. Because the shuffle is uniform, nothing has to know
  which grooves are new — no index into `GROOVES`, no field on `Groove`, no
  manifest change
- carry the epoch into `orderFor`'s lap-boundary guard. It reads the previous
  lap's closing groove to stop the same groove landing twice running; seeded
  from the old epoch it would be comparing against an order that no longer
  exists, and the guard would silently stop guarding
- pin a played day to the groove it was played on: read `DailyResult.grooveId`,
  which is written today and read nowhere, and serve that groove for that date
  whatever the new mix says. Only unplayed dates take the new order, so nobody
  is handed a different groove under their own solved panel — on release morning
  or at any later reshuffle
- fall back cleanly when there is no `grooveId` to pin to. The field is optional
  and results saved before it existed carry none; those days take the new mix,
  because a stored answer with no groove behind it is the one case where there is
  nothing to be honest to
- two rows in `docs/music.md`. One beside "What must never change", for the epoch
  as the thing that deliberately *may* — bumping it remaps every unplayed date,
  past or future. One in "Where to change what", so the next release that mints
  grooves bumps it by default instead of rediscovering this
- assert what the epoch is for: the same date under two epochs gives two
  different grooves, every groove still appears exactly once a lap, and no
  groove repeats across a lap boundary

**Out of scope**
- minting anything. This epic decides the order of what Epics 1–5 left behind
- back-filling the epoch over past releases. The rule starts here; the reshuffles
  that already happened stay as they were
- a shuffle button or a "give me another" control. One puzzle a day, and it ends
- re-rendering audio. No mp3 changes, no lock change, no manifest change

**Validation**
- `npm test` — the rota suite covers the epoch, the lap boundary and the pin;
  `src/lib/hash.test.ts`'s fixed table is still green, which is the proof this
  was a reshuffle
- `npm run grooves:verify` reports nothing — no groove was touched
- with a saved result for today in `localStorage`, the release does not change
  which groove that day shows
- the full pre-push set, then open the app on three consecutive simulated dates
  and see three grooves nobody could have guessed from the old order

## Dependency map

```mermaid
graph LR
  E1[Epic 1 — the rule, the figures, the first style] --> E2[Epic 2 — reggae one-drop]
  E1 --> E3[Epic 3 — second line]
  E1 --> E4[Epic 4 — boom-bap]
  E1 --> E5[Epic 5 — son montuno]
  F24[feature-24 — swing ride] --> E5
  E2 --> E6[Epic 6 — a new mix]
  E3 --> E6
  E4 --> E6
  E5 --> E6
```

## Execution waves

- **Wave 1:** Epic 1
- **Wave 2 (parallel):** Epic 2, Epic 3, Epic 4
- **Wave 3:** Epic 5 — needs feature-24's claves and cowbell in the pack
- **Wave 4:** Epic 6 — the mix over all sixty grooves, which is also the release

**What "parallel" means in wave 2, honestly.** Each epic's own
`templates/<style>.ts` and its half of `events.ts` are disjoint and can be
written at once. Four files are not: `templates/index.ts`,
`templates/index.test.ts`, `catalogue.json` and `grooves.lock.json` — every mint
appends to the catalogue and rewrites the lock and the manifest. So the three
epics can be built in parallel and must be *minted* one after another, in
whatever order they finish. The minting step is minutes; the template is the
work.

## Assumptions

- **No new modes.** All five styles' modes are among the twelve `FLAVOURS`
  already offers, so nothing is appended to `names.ts`, `scales.ts` or
  `theory/validity.ts`, and the app's option pools do not change.
- **The app never learns what a feel is.** `Groove` has no feel field and the
  manifest carries none, so the whole rule change is generator-side. Epics 1–5
  change nothing in `src/features/daily-groove/` but the regenerated manifest;
  Epic 6 is the one that touches app code, and only `lib/puzzle/selectGroove.ts`
  and the hook that reads a stored day.
- **Weakening the clue costs the player nothing they had.** The option pool the
  puzzle offers is all twelve flavours whatever the groove's feel is, and the
  nudges narrow that pool, not a per-feel subset — so a four-mode template does
  not make a day harder to solve or harder to resolve. Asked directly, Sam's
  answer was that it is not a clue they lose but "a clue I was never handed",
  and that solving by style-spotting would work against "get better at hearing,
  not at reading" anyway. Their one condition — that the nudges still walk down
  to one and giving up still reveals — is satisfied by the pool being unchanged.
- **The six existing templates' `flavours` lists stay exactly as they are** — see
  Epic 1's out-of-scope. `new-styles.md` reads as if appending to one were the
  safe operation; it is not, and `docs/music.md` already says so.
- **Eleven templates need eleven distinct swing values and eleven distinct tempo
  ranges**, because `index.test.ts` asserts uniqueness across the set. The five
  new styles' tempos are spread enough (70–80, 85–95, 120–140, plus two mid) that
  this is a constraint, not a problem.
- **Each new style mints six grooves** — thirty new, matching the three fullest
  existing feels, and doubling the catalogue to sixty. At one a day that is
  another month before anything repeats.
- **The daily rota is reshuffled by every mint, and Epic 6 makes that the
  point.** `selectGrooveForDate` takes `dayIndex % grooves.length` on a per-lap
  shuffle, so growing the catalogue already reassigns which groove each date
  lands on — every past release that added grooves did it incidentally. Nothing
  in `docs/music.md` "What must never change" freezes it: what is frozen is
  `hashString`, a groove's uuid and the answer behind it, and a reshuffle moves
  none of those. Epic 6 stops treating the reassignment as a side effect and
  spends it deliberately, on one new mix of all sixty.
- **A pinned day and the new rota may name the same groove.** Epic 6 serves a
  played date its recorded groove and gives unplayed dates the new mix, so one
  groove can be both a date in the past and a date to come. Nothing in the app
  replays a past date — the results store feeds the streak, not a history view —
  so the overlap is invisible, and it stops being a question if a history view is
  ever built.
- **`PLACEMENTS` and `FILLS` are already per-template**, keyed by id, so a
  style's fixed hits and fill vocabulary need no new mechanism. Only the drawn
  pools do.
