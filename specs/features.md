# Features

One line per feature. Each entry points at the feature's own `specs/feature-X/`
folder, where the briefing, roadmap, PRDs and tech specs live.

Features are named two ways:

- **`feature-N`** (a number) — on the plan, being built or already built.
- **`feature-X`** (a letter) — a future candidate that is already prepared: it
  has a briefing, but no commitment to build it yet. When one is picked up it is
  renamed to the next free number.

Status runs 📋 **Planned** → 🛠 **Ready to implement** (every epic specced, no
open questions) → 🔨 **In progress** → ✅ **Done** (every epic implemented,
tested and verified). Lettered candidates sit at ✏️ **Briefed** until promoted.

| # | Feature | Status | Summary |
| :-- | :-- | :-- | :-- |
| [1](feature-1/) | Core game | ✅ Done | The daily groove puzzle: one deterministic groove per day, guess its scale / chord / progression, progress kept in the browser. |
| [2](feature-2/) | Design implementation | ✅ Done | Dresses the app in the Claude Design canvas — warm paper, cream cards, deep-green accent, dark palette — and rebuilds the guessing flow as root + flavour with escalating attempts. |
| [3](feature-3/) | Groove generation | ✅ Done | Offline generator that mints short, funky, natural-sounding 4-bar grooves as MP3s from seeds, plus a `grooves:add` command to grow the rotating catalogue. |
| [4](feature-4/) | Clarity pass | ✅ Done | Declutters the page — date and streak in the top row, a play button as big as the solve button — fixes the streak that resets overnight, and turns the played-grooves row into something you can replay. |
| [5](feature-5/) | Structure and guidelines | ✅ Done | Reorganises the design system and the feature slice into named sub-folders, dismantles the god component and the cross-boundary test imports, and writes the resulting rules into `docs/coding-guidelines.md` where lint enforces them. |
| [6](feature-6/) | Playback and polish | ✅ Done | Ends the page at the puzzle — the played-grooves row and the shared-player machinery behind it are gone — fixes the loop visualisation so it tracks the groove you actually hear, evens out every chip row, and sets the headlines in a Real Book hand. |
| [7](feature-7/) | Guessing clarity | ✅ Done | Makes the puzzle winnable and honest — tempo back on the card, modes instead of flavours, the root handed over, a way to give up, a simple mode, and a rotation that plays every groove before repeating. |
| [8](feature-8/) | First-run clarity | ✅ Done | Names the app Eardle, says in one line what it is, greets a new or lapsed player with a four-point how-to-play that anyone can call back up, and makes the play button the obvious first move. |
| [9](feature-9/) | Natural feel | ✅ Done | Makes the grooves sound like a band rather than a sequencer — a real kit, bass and keyboard in place of the cajon and the FM piano, loops whose every pass is a different take, timing and dynamics with limbs, voicings and bass lines instead of arpeggios, a fill to end the last pass, and two more feels carrying four more modes. |
| [10](feature-10/) | Hear the root | ✅ Done | Gives the root row a voice — tap a root to hear it against the running groove, so the home note can be found by ear instead of guessed. |
| [11](feature-11/) | Lead sheet view | ✅ Done | Draws the changes as a 4-bar lead sheet with the notes in notation below it, puts the chords on the playing 4-bar visualisation, and stops the simple toggle from moving once the puzzle is solved. |
| [12](feature-12/) | Shareable grooves | ✅ Done | Gives every groove a uuid and a share button, so a groove can be sent to someone and opened on any day — and an archive becomes possible later. |
| [13](feature-13/) | Drum kit rewrite | 🛠 Ready to implement | Rebuilds every groove on a new CC0 drum kit — a ride it never had, a bongo where it fits, every voice levelled — and takes the mechanical evenness off the piano, with the harmony untouched. |

## Prepared candidates

Briefed but not yet scheduled. No roadmap, no PRDs, no tech specs — just the
briefing. Rename the folder to the next free number to put one on the plan.

| # | Feature | Status | Summary |
| :-- | :-- | :-- | :-- |
| [A](feature-a/) | Vercel & Supabase | ✏️ Briefed | Deploys to Vercel and moves user data to Supabase behind an anonymous, non-stealable local ID, with data export/import between browsers. |
| [B](feature-b/) | Internationalization | ✏️ Briefed | Replaces hardcoded text with snippets, translates them all, and automates translation at build time. |
| [C](feature-c/) | Hear the mode | ✏️ Briefed | Gives the mode row a voice — tap a mode to hear a short lick in it from the day's root, against the running groove, so the mode can be found by ear instead of read off a word. |

---

## Candidate features 

Ideas without a briefing yet. 

| Idea                               | Summary                                                                                                                                                                                                                | Why it's worth it                                                                                                                                    |
|:-----------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------|
| **claude dev speed**               | development is getting slower and slower, what can we do?                                                                                                                                                              | Speeds up development, especially for smaller features. Maybe we have a too complicated architecture or can run only subsets of tests?               |
| **count-in**                       | optional count-in before the groove starts                                                                                                                                                                             | helps to find the tempo                                                                                                                              |
| **Archive**                        | Show played or possibly all grooves?                                                                                                                                                                                   | Would be nice for jamming but could destroy the 1 quiz per day challenge                                                                             |
| **Groove selection**               | Have grooves (still 4 bars) loosely inspired by jazz standards                                                                                                                                                         | Can be shown on reveal and will teach you about jazz standards and inspire you                                                                       |
| **Jam mode**                       | Loop the groove indefinitely with tempo control, transpose, count-in and a keyboard/fretboard showing the notes that fit.                                                                                              | The feature-3 briefing asks that you can "jam with the groove with every instrument" — the audio supports it, but nothing in the UI invites it.      |
| **Share your result**              | A spoiler-free share card — the attempt dots as emoji, the date, the streak — copied to the clipboard or shared natively.                                                                                              | The standard growth loop for a daily puzzle, and the cheapest one: no accounts, no backend, no new content.                                          |
| **Explain the answer**             | After solving, show *why* it's Dorian: the scale degrees and the characteristic note, in words. The A/B listen is feature-c's. Use the bottom box and remove everything (streak, tries) related to the puzzle from it. | Turns a guessing game into ear training. This is the difference between a player who churns in a week and one who returns to learn.                  |
| **Practice mode**                  | Play unlimited grooves outside the daily puzzle, optionally filtered to the flavours you keep missing.                                                                                                                 | The catalogue is rotating and generated — there is far more content than one groove a day can surface, and daily-only means a bad day is a dead app. |
| **Progress insights**              | A stats view: per-flavour and per-root accuracy, attempts distribution, what's improving and what isn't.                                                                                                               | Feature-A puts the data in Supabase; nothing yet reads it back to the player. Cheap once the data is there.                                          |
| **More question types**            | Beyond root + flavour: guess the tempo, the time signature, the chord progression in Roman numerals, or the drum pattern.                                                                                              | The single question type is the ceiling on replay value; the generator already knows all these answers per groove.                                   |
| **Difficulty levels**              | An expert mode that drops the option narrowing entirely and offers the full set of roots and modes, with a shorter attempt budget.                                                                                     | Feature-7 adds a *simple* mode for newcomers; the opposite end — a puzzle that stops narrowing for a trained ear — is still unbuilt.                 |
| **PWA and daily reminder**         | Installable to the home screen, the day's groove cached for offline play, an opt-in notification when a new one lands.                                                                                                 | A daily habit game lives or dies on returning. Both mechanisms are standard and neither needs an account.                                            |
| **Catalogue curation UI**          | Audition, tag and reject minted grooves in the browser before they're committed, instead of via the CLI.                                                                                                               | Feature-3 auto-accepts grooves behind automated checks; those checks can't hear "this one is dull". A human ear needs a fast way in.                 |
| **Accessibility pass**             | A dedicated audit: screen-reader flow through the guessing cycle, reduced motion, contrast in both themes, and a non-audio path where one is possible.                                                                 | The epics assert a11y per component; nobody has yet tested the whole journey end to end — and an audio-first game has real obligations here.         |
| **CI pipeline**                    | GitHub Actions running tests, types, lint, build and the groove verification step on every PR.                                                                                                                         | Feature-3 has a build-time verify step and feature-A adds a deploy target; right now nothing enforces either before it reaches Vercel.               |
| **Analytics and error monitoring** | Privacy-respecting funnel events (opened, played, guessed, solved) plus client error reporting.                                                                                                                        | Feature-4 is a clarity pass made on intuition. Without numbers the next one will be too.                                                             |
