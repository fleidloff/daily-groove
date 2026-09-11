# 0053. Stats are computed on the server

- **Status:** ✅ Accepted — amends [0001](0001-progress-lives-in-the-browser-only.md)
- **Date:** 2026-09-11
- **Source:** V2, stats page

## Context

[ADR 0001](0001-progress-lives-in-the-browser-only.md) put every piece of player
state in `localStorage`, and one of the things that bought was a deployment with
nothing behind it: "the app deploys as one static Next.js build with nothing
behind it, which is what later let the catalogue be a build-time artefact and the
routes be static."

The stats page needed arithmetic over the saved results — a distribution of
attempt counts, a streak, a per-mode first-guess tally (since cut, see
[0054](0054-the-stats-page-shows-no-guilt.md)), two counts. All of it is
addition, and a phone does it in well under a millisecond. The recommendation
at the time was to compute it in the browser and keep the static property.

## Decision

The stats page sends the browser's saved results to `POST /api/stats`, and the
server computes every number and returns them.

**The request carries the browser's date as well as its results** — the body is
`{ results, today }`, and `today` is `isoDate(new Date())` taken in the browser.
The route reads no clock of its own, and rejects a body whose `today` is missing
or not `YYYY-MM-DD`. This is not a detail: a UTC server cannot infer the
player's local calendar date, so a player east of UTC opening the page between
local midnight and UTC midnight would otherwise get yesterday's seven-day window
and a streak one behind the header's. **A future simplification that has the
route call `new Date()` reintroduces that bug silently**, which is why
`route.ts` carries a comment saying so and `route.test.ts` has a test that fails
if the day stops travelling. **Nothing is computed in the
browser** — the page reads `results.length === 0` to decide whether to send a
request at all, and branches its rendering on the `puzzlesPlayed` the server
returned, and derives no other number itself.

**The route stores nothing.** It has no module-level state, no database and no
session. The request is the whole input and the response is the whole output.

## Consequences

- **The app is no longer a static build.** `npm run build` prints
  `ƒ /api/stats` as a server-rendered route. Vercel serves it with no extra
  infrastructure, which was the deployment constraint, but the "nothing behind
  it" property in ADR 0001's consequences is now false. That ADR's *decision* is
  untouched: state still lives only in `localStorage`, there are no accounts and
  there is no sync.
- **The stats page is the app's first network dependency**, and the first part
  of the app that can fail for a reason that has nothing to do with the player.
  It therefore owes a loading state and a failure state, which no other page in
  this app has.
- **The player's whole play history crosses the wire on every visit** to
  `/stats`. It is not stored at the other end, but it leaves the device, which
  nothing else in this app does.
- **The stats logic can change without shipping a build**, which was the reason
  for taking it. The client stays a thin renderer.
- **The route is a pure function of its request.** No clock, no ambient state,
  no storage — the same body always produces the same response. That is what
  makes the seven-day window testable without faking a date on the server, and
  it is the property the `today` field buys.
- **Reading the clock in the browser is not computing in the browser.** The
  client gathers two inputs only it can know — the saved results and the
  player's calendar date — and derives no number from either. Every figure on
  screen is read straight off the response.
- **Growing a store later is not blocked.** The route takes the results as its
  whole input, so adding persistence behind it is an addition rather than a
  rewrite — the cross-device archive ADR 0001 named as blocked is one step
  closer, though nothing is being built toward it.

## Alternatives considered

- **Compute in the browser** — a `lib/stats/` module reading the same
  `ResultStore` the app already uses. No endpoint, no runtime, works offline,
  nothing leaves the device, and no ADR to write. It was the recommendation and
  the persona's preference: *"I'd rather the arithmetic just happened on my
  phone … the unhappy case you're now designing for is one the app didn't have
  to have."* It lost because keeping the calculations off the client was the
  point of the exercise.
- **A server route that also stores** — the above plus a database. That is the
  account and sync migration ADR 0001 named as blocked, and it is a feature of
  its own rather than part of a stats page.
