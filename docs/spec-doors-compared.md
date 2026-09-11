# Two doors, one feature — feature-26 against V1

On 2026-09-11 the same six-bullet briefing — *grooves from songs* — was specced
twice, deliberately, so the two spec-driven approaches could be compared:

- **feature-26**, through the five-step chain: `/create-feature` → `/roadmap` →
  `/brainstorm` → `/writespec`. Settled 2026-09-06, in one day.
- **V1**, through the chat door: `/vibe-with-docs`, one question at a time.
  Settled 2026-09-11, `specs/tmp/1-grooves-from-songs/`, **and built the same
  day** — which is what the last section is about.

V1 was written without reading feature-26's documents, so what follows is a
comparison of two independent readings of one briefing, not of a draft and its
revision.

## What each one costs

| | feature-26 | V1 |
| :-- | :-- | :-- |
| Documents | briefing, roadmap, 3 PRDs, 3 tech specs | spec.md, tech-spec.md |
| Lines | 4 408 | 255 |
| Question cycles | 9 — each skill re-run until its own questions were ticked | 8, asked and answered in one sitting |
| Decomposition | 3 epics, 28 tracks, 79 red-green steps | 3 epics, 3 tracks, no steps written |
| Requirements / criteria | 54 requirements, 49 acceptance criteria | 9 `## Done when` bullets |
| Persona | `sam` dispatched per epic, quoted throughout | `sam` dispatched once, quoted, overruled twice |

Seventeen times the prose for the same feature. That ratio is the thing to
judge, and the rest of this document is what the extra prose bought and what it
did not.

## Where they genuinely disagree

### 1. How a groove reaches a song's chords

This is the load-bearing difference, and the two answers are incompatible.

**feature-26 searches seeds.** `buildEvents` yields root, mode and progression
without rendering audio, so four thousand seeds a template can be scanned and
scored against a wanted chord shape. The winner is minted. The generator is
never told what to play — it is *aimed*. The consequence is stated plainly: the
result **resembles** the tune, it does not transcribe it.

**V1 declares the chords.** The catalogue entry gains a `chords` field and
`theory/harmony.ts` gains `harmonyFromChords` beside `buildHarmony`. Any song
becomes reachable exactly.

**feature-26 did not consider V1's mechanism**, and its reasoning shows why:
it read the frozen-draw rule as forbidding any override at all — *"nothing may
be added to that stream … so there is no override to write."* That is true of
the stream and not of harmony: a second constructor adds no draw, and a groove
that does not exist yet has no committed answer to reassign. **V1's mechanism
is legitimate, and finding it is V1's one real contribution.**

The cost V1 accepted in exchange is a second harmony path in a generator that
has had exactly one, and a manifest whose chords, for those grooves, stop being
a function of the seed.

### 2. What the reveal promises

**feature-26 hedges.** A pinned line reads *"built on the changes of
'Summertime'"* and never *"this is"*, precisely because a searched groove only
resembles the tune. Sam asked for it: *"Mode change or 'resembles', say so in
the line."*

**V1 does not hedge**, and it does not have to for the same reason — under
declared chords the changes *are* the tune's, up to the in-scale substitution.
But V1 then also allows silent substitution (`spec.md` Q2 and Q3), which
reintroduces exactly the gap the hedge covers. Sam argued against it and was
overruled: *"I can hear the clash, I can't name it, and the thing that's
supposed to be teaching me just told me a fact I now can't trust."*

Both calls are Fred's and both are recorded. The point for this comparison is
that **the chain surfaced the hedge as a requirement and the chat door surfaced
it as a question that got answered the other way.** Neither door decided it;
one of them made it harder to skip.

### 3. What ships first

**feature-26's Epic 1 pins songs on existing grooves by hand**, so the morning
it lands the reveal says something new — without a single groove being minted.
Sam is quoted on exactly this: *"A is the only one of the three that changes
tomorrow morning and the morning after."*

**V1's Epic 1 ships the mechanism and no pins.** It is provable with a
hand-written entry; it changes nothing a player sees until Epic 2 mints.

This is a roadmap-shaped insight, and V1 has no roadmap step.

## What the chain found that the chat door missed

These are not stylistic. They are constraints in the code that V1's spec is
silent about, and each one would have surfaced during the build instead.

- **The answer rule.** `selectSeeds` refuses two grooves sharing a root+mode;
  48 of the 144 combinations are taken. A song groove has to transpose into a
  free root, or take a used answer anyway. feature-26 works this through,
  quotes Sam on it (*"the key is the least of my problems … move it wherever
  you have room"*), and names the test that has to narrow.
- **The pair rule.** No two grooves share `scale|progression`. feature-26's
  answer is that the song **replaces the colliding groove in place** — the slot
  keeps its `groove-NN` and its uuid, because a uuid is on the never-change
  list and a share link must survive.
- **The cost of that replacement.** One stored `DailyResult` points at a slot
  whose audio has changed, so a player revisiting that date hears a different
  groove beside their old attempts. feature-26 names the price and accepts it
  on one date per replacement.
- **The refusal path.** When nothing scores close enough, feature-26's skill
  declines and names the three nearest rather than shipping a bad match under a
  famous title. V1 cannot refuse — substitution always succeeds — which is a
  consequence of V1's Q2 nobody stated.
- **The licensing line.** *"Titles and artists are credit text … no audio, no
  lyrics, no notation."* V1 never raises it.

**V1's declared-chord approach makes the first two worse, not better.** Aiming
at a real tune's changes lands on common progressions, which is exactly where
collisions live. V1's spec has no answer.

## What the chat door found that the chain missed

Shorter, but not empty.

- **`harmonyFromChords`** — the mechanism above. feature-26 ruled out the whole
  category on a reading of the frozen-draw rule that is stricter than the rule.
- **Where the resolution lives.** V1 noticed that `GroovePuzzle.tsx:325` does
  `HEARD_IN[groove.scale]` inline, and put `selectHeardIn` behind
  `lib/presentation/`'s door per ADR 0033. feature-26 says the reveal "resolves
  the groove's uuid first and its scale second" without saying where that rule
  sits — the composer would have grown it.
- **One owner for the song's name.** V1 asked which file owns title and artist
  and put it in `heard-in.json` alone. feature-26 carries the name in the pin
  and the target in the search, and does not address the duplication.

## The honest read

**The chain is better here, and it is not close.** feature-26 found three code
constraints that decide whether the feature works at all, shipped visible value
in its first epic, and wrote 79 executable steps. V1 found one better mechanism
and two placement improvements, and left the collision problem undiscovered.

The reason is structural rather than a matter of effort. **Step 3 is what did
it** — `/brainstorm` writes requirements and acceptance criteria per epic
*before* any spec exists, and writing 49 acceptance criteria against 54
requirements forces a reading of
`selectSeeds`, `uuidFreeze.test.ts` and `DailyResult` that eight conversational
questions never demanded. The chat door asks what the *user* has not decided;
the chain asks what the *code* has not been checked against.

Two qualifications, in fairness to the chat door:

1. **It cost a seventeenth of the prose and about an hour.** For a change whose
   constraints are shallow — V1 the rename, quick tickets — that trade is
   plainly right, and this comparison is evidence about a hard feature, not
   about all features.
2. **V1's one find is the more valuable half of the design.** A mechanism that
   hits the target exactly is worth more than a thorough plan for approximating
   it, which is why the best version of this feature is neither document: it is
   **V1's `harmonyFromChords` built against feature-26's constraint analysis.**

## What the build actually taught us

V1 was built on 2026-09-11, the same day, through `/implement-vibe-with-docs`.
All three epics landed. This section is what the code said that neither
document did — and the first thing it says is a caveat about this comparison.

### The caveat: this document contaminated the build

The collision problem above was found *here*, by reading feature-26 to write
this comparison — and then carried into the build as a §3 escalation before a
line of Epic 2 existed. So the build is **not independent evidence** that the
chat door would have caught it. It is evidence that the escalation step works
once somebody knows what to look for.

The honest counterfactual is unknown. `/implement-vibe-with-docs` §3 does say to
re-run the size test against the files you actually open, and `select.ts` is one
of them — but I opened it because this document told me to.

### V1's mechanism survived contact with the code

The one thing the chat door found that the chain did not is now built and green.
`harmonyFromChords` sits beside an untouched `buildHarmony`, takes no `rng`,
adds nothing to `MUSIC_LABEL`, and a full re-render to a scratch directory
hashed every one of the 54 mp3s against the lock unchanged. 19 new generator
tests.

**feature-26's reason for ruling out the whole category was too strict, and the
build proves it** rather than merely arguing it.

### The `musician` found more than either document

Neither spec knew any of this, and all of it is load-bearing:

- `chordsForScale` returns **at most one chord per degree**, so "nearest chord"
  collapses to "nearest degree" and a root match is unique. That turns a
  distance function into a lookup.
- **`chordName` must be bar 1's chord, not the tonic**, or
  `theory/validity.ts:94`'s `names[0] === chordName` fails the harmony gate. In
  the drawn path the two coincide, which is why no document noticed.
- `blues` offers only three candidates through its idiom, so any non-blues tune
  flattens onto three chords there.
- A progression that never states the tonic is unanswerable, so it must throw.

The lesson is not about doors: **a spec written by anyone who has not read
`docs/music.md` will be missing the musical constraints, whichever door it came
through.** What saved it was dispatching the agent that has read it.

### The verifier caught three things the spec's own author missed

All three were mine, in the build, not in either document:

- **D3 was simply not built.** V1's own `## Done when` says a second command
  commits the candidate; I built the other seven bullets and left that one as a
  sentence in the skill saying somebody else would do it. The verifier failed
  the whole change on it. Eight bullets were enough to catch a missing skill —
  **a short criteria list still worked as a gate**, which is the strongest
  result the chat door got all day.
- **The uniqueness exception was implemented wider than the decision.** Fred
  decided "two grooves may share an answer when one is pinned"; both narrowed
  tests dropped *every* pinned groove before checking, so two song grooves
  could quietly take the same answer.
- **A file I reported as written did not exist.** The fix for D3 was a heredoc
  whose parent directory I had not created, so the write failed — and the
  `npm` commands on the following lines still ran and still reported green. I
  relayed a green suite and a delivered file in the same breath, and only one
  of them was true. The verifier looked for the file four ways and said so.

  **That is the case for a gate that cannot fix anything.** A green suite is not
  evidence that the thing you meant to write exists, because the suite does not
  know what you meant to write. Nothing else in this repo would have caught it:
  not lint, not 3 069 tests, not the build.

### One guard had to be widened, and no document predicted it

V1's Q7 put the uuid-before-scale rule behind `lib/presentation/`'s door.
feature-20 had pinned that door's runtime exports to exactly two names, with a
test. Adding a third is legitimate — the guard exists to force deliberation, not
to forbid growth — but it was a decision made at build time, by whoever was
holding the keyboard, on a boundary a whole feature was spent creating.

**Neither spec mentioned the guard.** A tech spec that names a file it will
widen should name the test that will stop it.

### What it cost

Three agent dispatches beyond the lead: the `musician` for the substitution
rule, one `implementer` for `harmonyFromChords`, and the `verifier` twice. Epic
1 and Epic 3 were built in the lead. The build was roughly the same order of
effort as the speccing conversation — which, for a feature this size, is the
number that should make anyone think twice about a 4 408-line spec.

## What is left

V1 is built, so this is no longer a plan — it is the list of things feature-26
holds that the shipped code does not.

- **feature-26's Epic 1 pins.** It would hand-pin a handful of existing grooves
  whose four chords already resemble a nameable tune, so the reveal changes the
  morning it lands rather than waiting for a mint. V1 shipped the mechanism and
  zero pins, so nothing a player sees has changed yet. **This is the cheapest
  unbuilt thing in either document.**
- **The style-and-mode coupling argument**, which `song-groove` has as a table
  but not as the reasoning: a feel owns two to four modes, so wanting harmonic
  minor picks `half-time` and nothing else.
- **The seed search itself.** Declared chords made it unnecessary for reaching a
  tune, but a search that scores `{template, seed}` candidates is still the only
  way to mint a groove that is *musically* the best of many. Nothing in V1
  compares candidates.
- **The `scale|progression` pair rule.** Fred's collision decision covered
  `root|flavour`; the pair rule is still unexcepted, and a song whose changes
  land on a pair an existing groove holds will fail the suite with no rule
  saying what to do. feature-26's answer was to replace the colliding groove in
  place, keeping its id and uuid.
- **The open disagreement.** Whether the substitution stays silent is still
  decided against the persona, twice, deliberately. `spec.md` said what that
  costs on the day a player who knows the tune meets a moved chord; the built
  reveal says nothing. Worth revisiting when the first song groove is actually
  heard.
