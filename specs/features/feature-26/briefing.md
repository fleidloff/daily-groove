* a Claude skill that takes a song (e.g. Summertime) and figures out which of our existing styles works best for it
* the same skill figures out the four chords that resemble the song best
* the skill creates the groove
* no new style is created for it — do everything inside the boundaries we already have
* `heard-in.json` gains the possibility to reference a heard-in entry by groove uuid
* a groove with a uuid entry uses that entry; every other groove falls back to the current root + mode lookup
* constraint that made this a feature rather than a quick ticket: the generator derives harmony from the seed, and `MUSIC_LABEL`'s draw order is frozen (docs/music.md) — four named chords have to be reached inside that, or the whole catalogue re-renders and every past puzzle is reassigned
