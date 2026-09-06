# Follow-ups — feature-24 (Swing ride)

Written 2026-09-05, at the end of the implementation run. Feature-24 is ✅ Done
and committed (`670652b`). Nothing here is broken; every item is something the
repo *asserts* that is no longer true, or a guard that does not guard what it
claims.

**This file is self-contained** — every fact needed to act is repeated here, so
it still works from a fresh clone.

**On this machine there is more.** The run's own records are gitignored, so they
are not in the repo, but they are on disk and worth opening for anything below
where you want the reasoning rather than the conclusion:

All paths below are under `specs/features/feature-24/`.

| Path | What is in it |
| :-- | :-- |
| `.implement/report.md` | The run report: all 45 acceptance criteria with evidence, the wave schedule, and every follow-up in its original wording |
| `.verify/epic-1.md`, `-2.md`, `-3.md` | The three QA passes. Epic 2's was re-graded after its gap closed; epic 3's carries the AC8 reasoning in §4 below |
| `.implement/epic-1-track-f.md` | The four ride audition rounds — the shortlist, every measurement, and why DRSKit beat CrocellKit despite measuring worse |
| `.implement/epic-2-track-a-musician.md` | Both `swung-sixteenth` rounds, including the p10 measure derived when wash floor and duty cycle turned out blind to onset rate |
| `.implement/epic-3-track-e-musician.md` | The migration: blast radius, loudness table, and the listening brief for the thirteen files |

They are scratch by policy, so treat them as reference rather than as something
to maintain — if a fact in one of them matters later, it belongs in a tracked
file like this one.

Total work: **under an hour.** Four items are one-line edits.

---

## 1. Two tech-spec values the shipped code deliberately refuses — ✅ done 2026-09-06

`specs/features/feature-24/tech-spec/epic-2-both-swung-feels-ride.md`, in the
`Contracts` section under *This epic's own*.

| Contract says | Shipped | Where the shipped value lives |
| :-- | :-- | :-- |
| `pan.ride: +0.26` | **−0.28** | `scripts/grooves/templates/swung-sixteenth.ts` |
| `FEATHER_VELOCITY 0.26` | **0.21** | `scripts/grooves/events.ts` |

Both deviations were made by the `musician` and independently endorsed by
verification. The recommendation was to **change the contract**, not to carry a
permanent deviation note — a contract that keeps asserting a value the
implementation is right to refuse teaches readers to discount it.

**`pan.ride` — the reason is that this feel's kit image is mirrored** relative to
`shuffle`'s. Measured, so it can be re-checked rather than believed:

| Voice | `swung-sixteenth` | `shuffle` |
| :-- | --: | --: |
| `hatClosed` | +0.33 | −0.32 |
| `tomHigh` | +0.18 | −0.22 |
| `tomLow` | −0.20 | +0.26 |
| `comp` | −0.31 | +0.28 |

`+0.26` was `shuffle`'s sign copied without noticing the mirror. It would stack
both cymbals in the right ear and leave a rack tom and the comp alone on the
left.

**`FEATHER_VELOCITY` — the contract names the wrong governing constraint.** It
asserts `FEATHER_VELOCITY + max(humanize.velocity) < GHOST_VELOCITY_THRESHOLD`,
i.e. `v + 0.13 < 0.5`. The real bound is the **kick pack's softest layer, which
tops out at `maxVelocity 0.3465`**: at 0.26, `0.26 + 0.13 = 0.39` escapes into
`kick_v80`, a harder strike with audible beater click. At 0.21 it stays inside.
Measured over 1086 feathers: **0.21 → 0 escapes, 0.26 → 15, 0.30 → 168.**

Write the layer boundary into the contract as the reason, not just the number.

**Size:** two line edits plus their justifications. No code, no tests, no
re-render.

---

## 2. Two dead values in the pack data — ✅ done 2026-09-06

**`public-domain` in `scripts/grooves/samples/pack.test.ts`** (around line 135).
The licence guard admits three values; epic 1's AC5 permits only `CC0` and
`CC-BY-4.0`. Evidence it is an oversight rather than a deliberate allowance:

- the string appears in **exactly one place in the whole repo**
- **no provenance row has ever used it** — all 158 rows are `CC0` (87) or
  `CC-BY-4.0` (71)
- it dates to `7d7f46e`, the commit that created `provenance.json`, when all 83
  rows were CC0

Removing it is one word, and the suite is already green under the tighter pair.

**The singular `attribution` in `scripts/grooves/samples/provenance.json`.** The
file carries both `attribution` (a string) and `attributions` (an array); the
singular duplicates `attributions[0]` and **nothing reads it**. Grep before
deleting — that finding came from one search, not an exhaustive audit.

Note that `attributions.length` **is** load-bearing: it is the CC-BY flag epic 3
branches on, and `src/features/daily-groove/components/puzzle/GrooveCard.provenance.test.tsx`
asserts it equals 2. Do not touch the array.

**Size:** two deletions plus a grep.

---

## 3. Three guards that do not guard what they claim

### 3a. `snippets.test.ts` scans for a substring, not an import — ✅ done 2026-09-06

`src/lib/snippets/snippets.test.ts`, the case *is named by no import specifier
outside src/lib/snippets/*. It is a **substring scan for `snippets/en`**, not an
import parse. It was tripped during this run by a test's own **prose** — a
failure message containing that string — which is a false positive it will keep
producing.

Fix by parsing import specifiers. `src/lib/hash.test.ts` already composes a path
to dodge the same class of problem; that technique is the local precedent.

**Size:** the only real code here. ~20 minutes.

### 3b. `SIGNED_OFF_FILE` names a path that no longer exists — ✅ done 2026-09-06

`scripts/grooves/gate.test.ts`. Each `SIGN_OFFS` entry carries a `file` field
naming the mp3 a person approved, and it is interpolated into the guard's
failure message. **Those files lived in session scratch and are gone.** So when
the guard next fires, its message points at a file nobody can play.

The hash is the real guarantee and it is intact — this is only about the message
being actionable. Two options:

- drop the filename and have the message say *re-render this groove and listen*;
- or commit an approved render somewhere durable, which adds binary to the repo.

**The first is recommended.** The whole point of the guard is that the render is
reproducible from the tree, so telling the reader to reproduce it is both
cheaper and more honest than pointing at a copy.

### 3c. `streak` is named but not asserted — ✅ done 2026-09-06

`src/features/daily-groove/data/pastPuzzles.test.ts`. The subject covers "the
puzzle, the answer, the attempts and the streak"; nothing computes a streak. It
is carried by implication — all 90 results round-trip intact and resolve
identically, and a streak is a pure function of those results, so it cannot have
moved.

The reasoning is sound and verification graded the AC done on it. But it is the
one noun of the four without a test. Either add the assertion or narrow the
subject line so the file stops claiming it.

**Size:** 10 minutes of thought about what the assertion should check, then small.

---

## 4. Still genuinely open — AC8, the returning-browser check

**Feature-24's row is ✅ Done, and AC8 is the one criterion not backed by the
evidence its own requirement asks for.** Recorded here so it is not lost.

Epic 3's **R10** says: *"A returning player gets the new audio rather than a
cached old file on the same path. The MP3 paths are stable
(`/grooves/groove-01.mp3`), so this is verified against the deployed app rather
than assumed from the build."*

What is proven: the right bytes are in the tree. All 30 promoted mp3s were
hash-verified, 13 of them against the exact files that were played and approved.

What is not proven: that a browser holding a cached `/grooves/*.mp3` from before
the deploy picks up the new bytes at the same path. **Eleven mp3s changed under
the same filenames, and no cache headers are configured anywhere** —
`next.config.*` and `src/app/` declare none — so the behaviour rests on the
host's defaults for `public/`. A local check cannot exercise it: there is no CDN
in front, and dev servers send no-cache.

**To close it:** after a deploy, open the app in a browser that played a
`shuffle` groove before it, and confirm you hear the ride rather than a hi-hat.

**If it serves stale audio:** cache headers on `public/grooves/`. Small.

---

## 5. Two things parked for a future feature, not for this list

**DRSKit has brush articulations.** `_whisker` variants for snare, hi-hat, toms
and ride, already licence-cleared (CC-BY 4.0) and on disk at
`~/dev/.sample-libraries/DRSKit`. The briefing ruled brushes out of feature-24 as
"a new articulation set, its own thing". This is the library that would supply
them.

**The claves and cowbell have been heard alone, but never in sequence.** The
sourcing question is closed — they were auditioned and liked. No template plays
either voice, so the two failures that only appear across a repeating loop have
never been tested: a bare wood transient machine-gunning over four bars, and the
cowbell's alternates being 3.96 dB apart against a 3.06 dB weak-to-strong span,
so a weak hit can land 0.9 dB *above* a strong one. Both are recorded in
`specs/new-styles.md` and `scripts/grooves/samples/README.md`; the first style
that plays claves owns that listening pass.

---

## 6. One design consequence to know about before adding a groove

Not a defect and nothing to fix — but it will surprise whoever hits it.

`src/features/daily-groove/data/pastPuzzles.test.ts` pins 90 pre-feature dates to
the grooves they resolved to. **The catalogue can no longer grow without that
test going red**, because `selectGrooveForDate` shuffles the whole catalogue, so
a 31st groove reassigns past dates — 86 of the 90 in the fixture.

This is not a data-integrity event. Nothing in the app ever re-resolves a past
date: `selectGrooveForDate` has exactly two production callers and both pass
`new Date()`, stored results carry `grooveId`, and share links resolve by `uuid`.
Feature-7's R6 settled it — *"Days before the change keep whatever they were
shown, because `DailyResult.grooveId` records what was actually played."* Every
assertion in that file about what a player actually holds — the answer, the
identity fields, opening by uuid — **passes** under growth.

The failure message already distinguishes the two causes and states the
procedure. Repeated here because it is the part that is easy to get wrong:
**archive the pre-growth tree and regenerate the fixture from that**, never from
the tree that made the change. Regenerating from the post-growth tree would
silently bless whatever moved, which is the exact failure the fixture exists to
prevent.

---

## What was done, 2026-09-06

§1, §2, §3a, §3b and §3c are closed. §4 waits on a deploy; §5 and §6 were never
items.

- **§1** — `pan.ride` is `-0.28` in the contract with the mirrored kit image as
  its reason, and `FEATHER_VELOCITY` is `0.21` with the kick pack's softest
  layer (`maxVelocity 0.3465`) named as the governing bound. The decision note
  further down the same spec was corrected to match.
- **§2** — `public-domain` is gone from `pack.test.ts`'s `ALLOWED` and from the
  type it declares; the dead **top-level** `attribution` is gone from
  `provenance.json`. The follow-up's "nothing reads it" was true of that one
  only — the **per-sample** `attribution` is read twice by `pack.test.ts` and
  is what `attributions` is derived from, so it stayed. A stale sentence in
  `GrooveCard.provenance.test.tsx` naming the old three-value list was fixed too.
- **§3a** — `src/lib/leaf.test.ts` already had the parser this needed, comment
  stripping and all. Rather than write a second one, it moved to
  `src/lib/testing/specifiers.ts` and both guards call it: `leaf.test.ts`
  filters for `@/`, `snippets.test.ts` for the private folder. Both keep a
  self-test proving they read imports and not prose. Verified live by dropping a
  real offender under `src/lib/` and watching each guard fire.
- **§3b** — `voidSignOff` no longer names the vanished mp3. It says the approved
  file was session scratch, gives `npm run grooves -- --only <id>` as the way to
  reproduce the render, and tells the reader to listen before re-pinning. The
  `file` field stays as the record of which audition round gave the approval,
  and its doc comment now says it is not a file anyone can open.
- **§3c** — `pastPuzzles.test.ts` now asserts the streak: all 90 stored days go
  through the store, and `computeStreak` anchored on the day after the last must
  return 90. Its failure message says what the other messages in that file
  cannot — growth can never cause this one, because a streak reads results and
  not the catalogue.

**Checks:** `npm run lint`, `npx tsc --noEmit`, `npm run build` and
`npm run test:all` (3911 tests, 184 files) all clean. Two tests were red when
this started, for a reason that had nothing to do with the follow-ups; §7 has
them.

## 7. Two date-dependent tests, found and fixed 2026-09-06

Not follow-ups. Found because a full suite run came back with two failures, and
worth recording because the cause is a trap the next test in this area can fall
into just as easily.

**They fail on roughly one day in five, and 2026-09-06 was one.** The run report
for feature-24 records `npm run test:all` green at 3909 tests on 2026-09-05, and
the same tree fails on 2026-09-06 with nothing committed in between.

| Test | Symptom |
| :-- | :-- |
| `GroovePuzzle.copy.test.tsx` → *counts nothing while the guessing is going on* | `giveUp()` is `null` after what looks like three wrong guesses |
| `GroovePuzzle.header.test.tsx` → *reads the recomputed streak…once the day is given up on* | `getByLabelText(header.streakName({ days: 0 }))` finds nothing |

**One cause, and it is not what either symptom suggests.** Both tests spent
their third guess on a hardcoded root, `'A'`. After two misses
`eliminatedRoots` takes two roots out of play, and *which* two is
`seededShuffle(pool, `${isoDate(date)}:eliminate`)` — a different pair every
day. On 2026-09-06 the pair was A♭ and A. So the third guess clicked a dead chip,
never landed, and only two attempts were ever saved: `REVEAL_AFTER_MISSES` is 3,
so no give-up button appeared, the two `user.click(giveUp() as HTMLElement)`
calls no-opped on `null`, the day was never given up on, and the streak stayed
at 3. The streak wording is not involved — `Current streak: 0 days` is still
exactly what `StreakBadge` renders at zero, and its own test asserts it and
passes.

Measured over 365 days, against the two misses those tests make: **A dies on 68
days, B on 90, F on 78, E on 74.** `C` never dies because it is the answer, and
a root the player has already guessed never dies, which is why `'G'` first and
`'D'` second were always safe.

**Fixed** by taking the third root from the page instead of from the source:
`liveRoot()` moved into `testing/puzzleHarness.tsx` next to a new exported
`liveIn`, which is where `GroovePuzzle.guessing.test.tsx` had been carrying its
own copy — that file's three-miss test never broke, because it had always picked
a live root. `liveRoot()` throws with a readable message rather than returning
`undefined` when C is the only root left.

**The third occurrence was latent, not failing.** `copy.test.tsx`'s *counts
nothing…on a day given up on* also spent guess three on `'A'`, and passed on
2026-09-06 by luck of a different shuffle. It needed a different fix: its first
guess is `'C'`, which confirms the root and kills every other chip, so `'C'` is
the only guess the card will take. The `'A'` click there was always a no-op that
left C selected from before — it submitted C either way. It now says `'C'`.

A scan of every `guess(user, …)` call in `src/features/daily-groove/components/`
found no other hardcoded non-`C` root at guess three or later that is exposed:
the remaining ones are in simple-mode tests, where the six-root pool is at
`LIVE_ROOT_FLOOR + ELIMINATED_PER_MISS` and `eliminatedRoots` returns `[]`, or
they re-guess a root the player already spent.

**The rule this leaves behind:** past the second miss, a test may not name a root
in its source. Ask the page which ones are still live.
