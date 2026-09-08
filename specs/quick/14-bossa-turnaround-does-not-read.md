# 14 — Bossa turnaround does not read

## What

* bossa-nova's turnaround does not read — the fill exists but is inaudible against an ordinary bar.
* It lands twice in the 16-bar loop, not four times: `barRole` fires only on the last bar of a pass, and only the last pass gets `fill` and the middle pass `variation`, so bars 3 and 11 get nothing at all.
* The fill's only content is 4 snare hits at `gain -16`, the quietest voice in the feel. `hatClosed` is identical to an ordinary bar, the rim clave is untouched, and the fill's kick `[0,8]` is the sparsest of the four figures in the pool — so a fill bar can be thinner than the bar before it.
* The variation is the same minus one snare hit: `[4,12,14]` against `[4,10,12,14]`.
* `events.ts:251` states the intent — "A bossa has no drum fill: the hat and the clave never stop, and the turnaround is a snare push rather than a roll." The design is deliberate; what's open is whether a snare push should be audible at all.
* What changes is open: the snare's gain, the fill's snare figure, the kick figure, or the 8-bar spacing.
* Six grooves re-render (groove-53 … groove-58) and two sign-offs go void, groove-57 and groove-58.
* We will iterate on the bossa groove more generally — it can become more authentic.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* Played back to back, bar 15 of groove-56 and groove-57 reads as a turnaround rather than as another ordinary bar.
* A fill bar is never thinner than the bar before it — its kick figure is at least as dense.
* All six bossa grooves pass the seven gate checks with RMS inside −29…−20 dBFS.
* groove-57's and groove-58's `SIGN_OFFS` entries are re-pinned on a fresh listening verdict.
* Whether the 8-bar spacing changed is recorded either way.
