# 5 — Lick variations

Moved from feature-25's briefing.

## What

* three hand-written licks per mode instead of the one in `LICKS`
* which of the three sounds is picked at random
* the pick holds for the day — once chosen, tapping that mode plays the same lick all day
* solves the moment one lick per mode gets memorised and the puzzle tests recall instead of the ear

## Done when

* Every mode in `LICKS` has three licks, and each one still fits the mode's scale.
* Tapping the same mode twice on the same day plays the same lick.
* The pick changes from one day to the next.
* Tests cover the three-per-mode shape, the pick holding within a day, and the pick changing across days.

## Open questions

### Q1. Where does the day's identity come from?

- [ ] A) `scheduleLick` gains a variation argument; `useModeLick` derives the day itself with `isoDate(new Date())`, as an optional input defaulting to today *(recommended — engineering reason, no persona bearing: two modules (theory, audio), the shell untouched, and the day is injectable in a test)*
- [x] B) The composer passes `today` or `groove.uuid` into the hook. The truest seed — the pick follows the puzzle rather than the clock — but `GroovePuzzle.tsx` is the shell, a third module, and §2's second question fails: the ticket goes back to `/create-feature`.
- [ ] C) Seed from what `scheduleLick` already holds — `root` and `bpm`. One module, no signature change anywhere. Ruled out by two things: `phrase.test.ts` proves a tempo change must not change the notes, so `bpm` cannot seed; and `root` alone repeats the lick on every later day that shares a root, which Done-when 3 forbids.

### Q2. Does every mode pick its own variation, or does the day pick one for all twelve?

- [ ] A) Per mode — `hash(day + flavour) % 3`, so tapping across the row is three unrelated phrases *(recommended — persona: Sam taps several modes to compare them, and "nothing new to come back to tomorrow" is what loses them; 3¹² combinations rather than 3)*
- [x] B) One index for the whole day — every chip plays variation 2 today. Simpler to hold in the head and to test, and the day has one identity, but it repeats across the catalogue three times faster.

## Notes

* Size test: **passes under Q1-A** (theory, audio), **fails under Q1-B** (theory, audio, shell). Nothing frozen in `docs/music.md` is touched — licks are scheduled in the browser, re-render no audio, and `music.md` does not mention them. One revert.
* Files, under Q1-A:
  * `src/lib/theory/licks.ts` — `LICKS` becomes three phrases per mode; 24 new licks; `lickFor` takes the variation. The existing lick stays as one of the three, so nothing already heard is lost.
  * `src/lib/theory/phrase.ts` — `scheduleLick` takes the variation and passes it to `lickFor`.
  * `src/features/daily-groove/hooks/useModeLick.ts` — optional `day?: string` input defaulting to `isoDate(new Date())` once at mount; derives the variation per mode and hands it to `scheduleLick`.
  * tests: `licks.test.ts`, `phrase.test.ts`, `useModeLick.test.ts`.
* **The gate for the new licks already exists.** `licks.test.ts` holds four: about one bar and rising in time, the mode's signature degrees present, a set of pitch classes **no other scale can hold**, and no repeated pitch sequence or rhythm. They currently judge 12 licks and would judge 36 — the uniqueness one is the hard one, and it is what stops a second Ionian lick from also fitting Lydian. Writing the licks is musical work done in the lead: §7 sends the `musician` only to `scripts/grooves/`, and `docs/music.md` says nothing about licks.
* Assumption: the pick is deterministic from the day, not stored. "Picked at random" in the ticket means the player cannot predict which one, not that a `Math.random()` is rolled — a stored roll would need `lib/persistence/`, a third module, and a reload mid-day must not change the lick anyway.
* Assumption: a shared groove opened on another day plays *that* day's pick, not the pick of the day the groove was set. The lick is a hint, not part of the answer.
* Assumption: transpose does not move the pick. The hook is handed `answer.root`, the concert root, so a sax player and a guitarist hear the same lick.
* `phrase.test.ts`'s "scales %s with the tempo, pitch for pitch" compares bpm 67 against bpm 130 for one root; it stays true only while the variation is pinned across both calls. That test is what rules Q1-C out.

## Answered — Q1-B, Q2-B

* Q1-B ticked. Re-running §2 against it: **question 2 fails.** `GroovePuzzle.tsx` is the shell, so the modules are theory (`licks.ts`, `phrase.ts`), audio (`useModeLick.ts`) and shell (one prop on the `useModeLick` call) — three of six. `/quick-feature` §2 sends that to `/create-feature` and forbids trimming the ticket until it fits.
* The failure is marginal and the ticket should say so rather than only cite the rule: under Q1-B the change is four files plus their tests, no generated data, one revert. The shell edit is `seed={groove.uuid}` — a prop, not a behaviour. The rule is a proxy for blast radius, and here the proxy is stricter than the thing it stands for.
* Q1-A reaches the same visible behaviour and stays at two modules. The only difference: A seeds on the calendar day, B on the groove. They diverge in exactly one place — a shared groove opened on a different day plays that day's lick under A, and the groove's own lick under B.
* Q2-B ticked: one variation index for the whole day, every mode chip on the same one. Costs nothing under either Q1 answer.

## Built

Q1-B and Q2-B, with the two-module rule waived in chat: "still keep it in quick-feature and just go on. I accept the risk."

* `src/lib/theory/licks.ts` — `LICKS` is now three phrases per mode (36 in all); the existing twelve stay as variation 1 and 24 are new. `LICK_VARIATIONS = 3`; `lickFor(flavour, variation = 0)` wraps the index in both directions.
* `src/lib/theory/phrase.ts` — `scheduleLick` takes an optional `variation`, defaulting to the first.
* `src/features/daily-groove/hooks/useModeLick.ts` — optional `seed`; `variationFor(seed)` is `hashString(seed) % LICK_VARIATIONS`, memoised, and drives every mode the same way (Q2-B). No seed means variation 1.
* `src/features/daily-groove/components/GroovePuzzle.tsx` — `seed: groove.uuid`. One line, and the shell edit the size test objected to.
* **How the 24 were written.** `licks.test.ts` already held four gates and they now judge all 36 rather than 12: 4–12 notes rising in time and ending by beat 4.5, the mode's signature degrees present, a pitch-class set **no other scale can hold**, and no repeated pitch sequence or rhythm anywhere in the set. The uniqueness gate is the binding one — it is what stops a second Ionian phrase from also fitting Lydian, and it rejected five drafts. Range was checked against `LOWEST_MIDI`/`HIGHEST_MIDI` from every root, which caps degrees at 7 for the seven-note scales and 6 for Blues.
* tests: `licks.test.ts` (20, was 15 — three-per-mode, every gate over all 36, `lickFor`'s variation and its wrap); `phrase.test.ts` (24, was 22 — the variation is played and the three differ, twelve distinct sequences in *every* variation, range from every root × variation); `useModeLick.test.ts` (17, was 13 — the seed's variation on every mode, the same phrase twice on the same day, variation 1 with no seed, and the catalogue spreading across all three); `GroovePuzzle.sounding.test.tsx` (+1 — a second groove sounds a different variation of the same mode) and `GuessCard.test.tsx`, both now asserting against the day's own variation rather than the first.
* The harness groove picks variation 2 of 3, so the component suites would fail if `seed` were dropped — the wiring is asserted, not assumed.
* checks: lint — clean / tsc — pass / test — 138 files, 2821 pass / build — pass
* **Blues v2, second pass.** Reworked from chat to put the blue note in the foreground: degree 3 (the ♭5) is now hit twice and held — three quarters of a beat off the "and" of one, then a full beat on beat three — approached from the 4 below and answered by the 5 above, ♭3 → 4 → ♭5 → 5 → ♭5 → 4 → ♭3 → root. It carries 1.75 of the bar's four beats. The 5 is there for more than colour: without it the phrase's pitch set also fits Locrian and the uniqueness gate rejects it.
* **Not heard.** Nothing in this run listened to the 24 new licks. They are correct against the gates and idiomatic on paper; whether each one sounds like its mode is still an open ear-check.
