# 0054. The stats page shows no guilt

- **Status:** ✅ Accepted
- **Date:** 2026-09-11
- **Source:** V2, stats page

## Context

A stats page is the first screen in this app whose whole job is to tell the
player how they are doing. [persona.md](../persona.md) says what that player
wants — *"One thing per day. Not a curriculum, not a streak of guilt"* — and
what loses them: *"Homework. Anything that feels like a lesson plan, a syllabus,
or a level."*

The obvious contents of such a page are exactly the things that break that:
days missed, a best streak, a solve percentage, a level.

## Decision

**Nothing on the stats page counts days missed, shows a best streak, states a
percentage, or labels the player with a level or a rank.** The page shows counts
and a distribution, never a rate.

Two things follow from that and are part of the decision:

- **Solved and revealed are two counts, side by side**, not one ratio. A reveal
  is allowed and is not graded.
- **With exactly one saved result the page is one sentence**, not a chart with
  one bar and six empty slots. The player's own words for why: *"One bar and six
  gaps isn't a shape, it's a to-do list."*

## Consequences

- **Tests defend it, not just review.** `StatsPage.test.tsx` asserts no `%` and
  no rank or level string appears anywhere the reader can reach — visible text
  plus every `aria-label`, `title`, `alt`, `aria-description`, `aria-valuetext`,
  `aria-valuenow` and `aria-roledescription` in the tree.
- **A future contributor adding an engagement metric has to argue with a failing
  test**, which is the point. The *current* streak is shown, in the header and in
  the stats page's top card; what this rules out is a **best** streak, a count of
  days missed, and any page that counts what the player did not do.
- **The one-line state is a second rendering path** for the same data, and it
  costs a branch and its tests.
- **The threshold is day one only** — from the second result the full page
  appears, bars mostly empty. That errs earlier than the persona's own advice
  (*"too early is the failure mode, not too late"*), and was taken knowingly: a
  data-dependent threshold was the alternative, and a fixed count of five the
  other.

## Alternatives considered

- **The full page from day one, zeroes and all** — honest and consistent, and
  the thing the persona named as what loses them.
- **A threshold on the data** — show the bars once more than one bucket has
  something in it. It is the persona's own rule and the recommendation; it lost
  to the simpler day-one rule.
- **A play button on the last groove played** — asked for by the persona
  (*"if the stats page is just arithmetic I've left the app"*) and dropped,
  because it pulls the audio module onto a page that is otherwise numbers and
  `/groove/[uuid]` already has the full player.
- **A mode breakdown** — "you miss most: Dorian, Lydian, Locrian" against the
  three named first-try most, measured by first-guess accuracy because unlimited
  guesses make eventual solving meaningless. It was the persona's strongest ask
  (*"a line saying 'Dorian: you've missed it 6 of 8 times' tells me my ear has a
  specific hole"*), it was built and verified, and it was cut on a look at the
  finished page. Its arithmetic left the `Stats` contract with it. **It is the
  likeliest thing to come back**, and if it does it comes back measured this
  way — the ranking, the tie-break and the treatment of a guessless day are all
  in the git history of `lib/stats/computeStats.ts`.
