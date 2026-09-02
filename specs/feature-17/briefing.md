* the root never gets revealed — only once the puzzle is solved or given up
* the nudge narrows instead of revealing — after two misses take some wrong roots off the row, so there is still help at two misses and it rewards listening rather than reading
* `docs/persona.md` already promises this: "nudges narrow the options, and giving up reveals the answer". the nudge as built does the opposite
* the day stays always resolvable either way — the dots mark par, not lives, and give-up is offered from three misses and stays
* add a check mark when something was guessed right (mode or root) — but only after pressing the check button
* the check mark is sticky — it survives every later wrong guess, or it says nothing the feedback line did not already say
* hiding the root and confirming a right one are not in conflict — the check mark says what the player found, the old nudge said what they hadn't. worth stating so nobody "resolves" it
* mark what was ruled out too — a root or a mode already checked and wrong reads as spent, so the same pair is not guessed twice. maybe gets an "X" icon?
* say what a check mark means on simple mode's Major / Minor row — confirming one of two chips is most of the answer, a different bargain from one of four modes
* the check comes after the label
* per-chip marks are a design-system change, not a prop — `ChipGroup`'s adornment is row-wide today, and its own comment says a part-marked row is not a thing it models
* if the check replaces the ♪ on that chip, that chip becomes the only one that looks silent — keep both marks, or put the check after the label => put the check after the label
* the feedback line and the check mark will then say the same thing twice — "keep the root and try another flavour" instructs what the mark already shows, so that line can get shorter
* the check mark makes grinding more legible — lock the root by brute force, then cycle the modes. it already exists through the feedback line, so nothing new to defend against; the narrowing nudge is what makes listening the faster route
* make sure the 4 bar lead sheet doesn't collapse into 2 rows. It should stay 1 row.
* one row on a phone means something gives — four bars at 360px is about 68px each before the bar's own padding, and the widest symbols are seven code points (`Gmaj7♯5`, `Bmaj7♯5`, `Amaj7♯5`, `F♯mMaj7`, measured across the thirty progressions — my earlier `C♯m7♭5` guess was one glyph short): smaller type, less padding, or a horizontal scroll. the 2 × 2 break was deliberate in feature-11, so pick the replacement rather than leaving it to the implementer
* Remove the  "that's the note doing it" -> doesn't add value
* Leave "Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it." even when tap sounds is turned off. Just remove ", or tap a root or a mode to hear it"
* that reverses feature-16's Q2, which chose the wording naming the switch. its AC11a asserts the sounds-off caption, so that acceptance criterion changes and not only the string
