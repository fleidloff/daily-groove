# 13 — Change the groove volume
treat it as a quick feature. Even if scope is too big. We can test it and it is easily revertable

## What

* Sam can change how loud the app plays, with a slider.
* It controls all sounds, not the groove loop alone — the reference note and the mode lick too.
* The level survives a reload, stored in `localStorage`.
* The three sound paths each connect straight to `ctx.destination` today — `lib/audio/audio.ts`, `lib/audio/reference.ts` and `lib/audio/lick.ts` — so there is no shared stage to hang a volume on yet.
* The reference note and the lick keep their own fixed levels in `lib/audio/level.ts`; the slider scales those rather than replacing them.
* "Probably a slider" was the word — the shape is the intent, not a frozen decision.

## Done when

*Derived from the `## What` bullets — strike anything that isn't the intent.*

* A slider on the page changes how loud the app plays, audibly, while the groove is looping.
* The same slider changes the reference note and the mode lick, not only the groove loop.
* At its lowest setting nothing is audible, and the groove loop keeps running rather than stopping.
* Reloading the page keeps the level Sam last set.
* The level applies to a sound started after the change, not only to one already playing.
* A test covers the level reaching the audio graph via `testing/fakeAudioContext.ts`.

## Parked — 2026-09-10

Not built, and not because it is hard. It duplicates a control Sam already has.

* Sam's verdict on the master slider: he would never touch it twice. The session
  is a win in two minutes on the phone, the page is meant to be almost all play
  button, and the volume rocker is already under his thumb while the loop runs.
* Sam offered one thing hardware volume cannot do — a balance between the loop
  and the tap sounds, so a tapped root cuts through the sax he is playing over
  it. **Fred struck that down: the taps stand in for the instrument.** With the
  sax up you play the root; with no instrument you tap. The two are never
  sounding at once, so there is no ratio to expose, and `REFERENCE_LEVEL` plus
  feature-16's tap-sounds switch already cover the one place a ratio mattered.
* Both `## Done when` bullets that were only ever about the slider's mechanics —
  silence at the lowest setting with the loop still turning, and the level
  reaching a sound started later — buy nothing for a player who reaches for the
  hardware buttons instead.
* What survives is thin: hardware volume steps are coarse, and a phone's lowest
  non-zero step can still be too loud in a quiet kitchen early on. One permanent
  control on the page for an edge hit once is the wrong trade.

Unpark it if the app turns out to be played on a laptop at a desk with an
interface. The persona says "on the phone" and nothing about headphones or
speakers, so that situation is outside what Sam can rule on.
