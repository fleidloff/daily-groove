# Two doors, one feature — feature-26 against V1

On 2026-09-11 the same six-bullet briefing — *grooves from songs* — was specced
twice, deliberately, so the two spec-driven approaches could be compared:

- **feature-26**, through the five-step chain: `/create-feature` → `/roadmap` →
  `/brainstorm` → `/writespec`. Settled 2026-09-06, in one day.
- **V1**, through the chat door: `/vibe-with-docs`, one question at a time.
  Settled 2026-09-11, `specs/tmp/1-grooves-from-songs/`.

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

## If you build it

Take feature-26 as the spine and graft V1's mechanism onto it:

- Epic 1 from feature-26 (hand-written pins ship value on day one), with V1's
  `selectHeardIn` behind the coaching door and V1's single-owner rule for the
  name.
- Epic 2 from V1 (`harmonyFromChords`, declared chords) — but keep
  feature-26's answer-rule and pair-rule analysis, which apply unchanged and
  bite harder.
- Epic 3 from feature-26, minus the refusal path, which declared chords make
  unnecessary. Keep its style-and-mode coupling argument: a feel owns two to
  four modes, so the two choices cannot be made independently.
- Decide again, deliberately, whether the substitution stays silent. It is the
  one open disagreement between the two documents and the persona.
