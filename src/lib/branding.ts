/**
 * The app's name and its one-line pitch, in one place.
 *
 * Both are needed in two layers — the document's metadata in `src/app/layout.tsx`
 * and the masthead inside the feature — and the tagline is a full sentence that
 * must not end up spelled two ways. `docs/architecture.md` says anything two
 * slices need moves up here, and a leaf module keeps the feature removable:
 * deleting `src/features/daily-groove/` leaves the root layout importing a
 * module that is still there.
 *
 * Deliberately not exported from the feature's `index.ts`. That would make the
 * root layout depend on the feature, which is the removability standard's one
 * hard rule.
 */

/** The app's name, as the masthead and the browser tab spell it. */
export const APP_NAME = 'Eardle'

/** What the app is, in one sentence. The header's subtitle and the meta description. */
export const TAGLINE =
  "Wordle for your ears. Listen to today's groove, figure out the key, and test your musicianship daily."
