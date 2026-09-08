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
