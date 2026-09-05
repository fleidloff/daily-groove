* add a ride cymbal and use it in the feels where it makes sense
* a jazz ride: light, washy ping, not a rock ride. tried in feature-13 and removed because MuldjordKit's ride was far too heavy
* the feel that takes the ride hands it the timekeeping, and its hat drops to punctuation
* docs/music.md already specifies all of this — voice list, "the bow not the bell", four of six feels riding, HAT_PUNCTUATION_PATTERNS, RIDE_LABEL — and none of it is in the code. the docs and the code have to end up agreeing
* find the sample library first. MuldjordKit has no jazz ride at any velocity, so this needs a permissively-licensed one, auditioned before anything is built
* feather the kick under the swung feels — quarter notes at low velocity. no new sample, and it is half of what makes a swung feel sound like jazz
* add claves and a cowbell, and the ride's bell as its own articulation — for the styles in specs/new-styles.md, son montuno above all, where the bell keeps time and the claves carry the clave. not used in any of today's six feels
* the claves need real round robins — a bare wood transient repeating over a 4-bar loop machine-guns — and never sound in the same groove as the rim
* check VCSL first: it is already a CC0 source in this pack, and claves and a cowbell are likely already in it. only the jazz ride needs a new library
* no crash. the tail crosses the loop point, and events.test.ts bans it today
* brushes on the snare are the right sound for open-ballad and are not in this feature — a new articulation set, its own thing
* adding a voice re-renders every groove of the feels that take it, so past puzzles' audio changes while their answers do not
