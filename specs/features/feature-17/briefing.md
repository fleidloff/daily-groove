* the root never gets revealed — only once the puzzle is solved or given up
* the nudge narrows instead of revealing — after two misses take some wrong roots off the row, so there is still help at two misses and it rewards listening rather than reading
* `docs/persona.md` already promises this: "nudges narrow the options, and giving up reveals the answer". the nudge as built does the opposite
* the day stays always resolvable either way — the dots mark par, not lives, and give-up is offered from three misses and stays
* once you got it right — either root or mode — disable the others in that row. it's locked in, no change possible any more
* no checkmark icon. the row collapsing to one live chip is clear enough, and the glyph didn't do it for me
* only after pressing the check button — a selection, or a chip tapped to hear it, locks nothing
* the lock is permanent for the day — it survives every later wrong guess, or it says nothing the feedback line did not already say
* hiding the root and locking in a right one are not in conflict — the lock shows what the player found, the old nudge said what they hadn't. worth stating so nobody "resolves" it
* mark what was ruled out too — a root or a mode already checked and wrong reads as spent, so the same pair is not guessed twice
* no "X" icon either. dimming does it, for the same reason the checkmark went: disabling the answers is clear enough on its own
* simple mode's Major / Minor row locks the same way, which leaves one live family chip — most of the answer, a different bargain from one of four modes, and accepted
* no design-system change is needed for this — per-option state already exists for the ruled-out row, and locking in is that same `unavailable` state applied to every option that is not the answer
* the ♪ stays on every chip, locked-out ones included, because a chip that is out still sounds — so there is no glyph-slot question left to settle
* the feedback line and the locked row then say the same thing twice — "keep the root and try another flavour" instructs what the row already shows, so that line can get shorter
* put the messages while solving, like "Right home note, wrong colour.", inside the nudge box — just above the other text. cleaner, fits better
* only show the nudge box when there is actually content in it
* call the label "Hint" instead of "A nudge"
* giving up or solving removes the Hint box. it is otherwise confusing — the solved panel is what says what happened
* the lock makes grinding more legible — pin the root by brute force, then cycle the modes. it already exists through the feedback line, so nothing new to defend against; the narrowing nudge is what makes listening the faster route
* make sure the 4 bar lead sheet doesn't collapse into 2 rows. It should stay 1 row.
* one row on a phone means something gives — four bars at 360px is about 68px each before the bar's own padding, and the widest symbols are seven code points (`Gmaj7♯5`, `Bmaj7♯5`, `Amaj7♯5`, `F♯mMaj7`, measured across the thirty progressions — my earlier `C♯m7♭5` guess was one glyph short): smaller type, less padding, or a horizontal scroll. the 2 × 2 break was deliberate in feature-11, so pick the replacement rather than leaving it to the implementer
* after guessing it right the solved box still says "You said Phrygian — the colour was right, not the home note." that doesn't make sense — it feels like an in-between comment from before the puzzle was solved. no near-miss line on a solved day
* keep it on a day given up on. that's the day it earns its place
* Remove the  "that's the note doing it" -> doesn't add value
* Leave "Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it." even when tap sounds is turned off. Just remove ", or tap a root or a mode to hear it"
* that reverses feature-16's Q2, which chose the wording naming the switch. its AC11a asserts the sounds-off caption, so that acceptance criterion changes and not only the string
