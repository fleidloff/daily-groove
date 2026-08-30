/**
 * The player's settings, as opposed to their play. Preferences outlive a day and
 * belong to nobody's record, so they live under their own key rather than inside
 * the results envelope (E5 R7, A2).
 */
export type Preferences = {
  /** Simple mode: six roots and a major-or-minor second row (E5 R2, R4). */
  simpleMode: boolean
}

/**
 * The persistence seam for preferences, mirroring `ResultStore`: every read and
 * write goes through it, so no component or hook touches `localStorage`
 * directly. `Promise`-returning even though the localStorage implementation is
 * synchronous, so a future login-backed/server store can implement the same
 * interface without changing any caller.
 */
export type PreferenceStore = {
  get(): Promise<Preferences>
  set(prefs: Preferences): Promise<void>
}

/**
 * Versioned like the results key, so a future change to the preference shape is
 * a clean break under a new key rather than a migration of this one.
 */
const STORAGE_KEY = 'daily-groove:v1:prefs'

/**
 * Simple mode is off unless the player turned it on: a returning player who has
 * never touched the toggle sees exactly the puzzle they saw before (E5 A3).
 */
function defaultPreferences(): Preferences {
  return { simpleMode: false }
}

/**
 * Read and validate the stored preferences. Guards against an absent store, a
 * throwing store, an absent key, corrupt JSON or a wrong-shaped blob by falling
 * back to the defaults, so a bad read never throws into the UI.
 */
function readPreferences(): Preferences {
  let storage: Storage
  try {
    storage = localStorage
    if (!storage) return defaultPreferences()
  } catch {
    return defaultPreferences()
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return defaultPreferences()
  }
  if (raw === null) return defaultPreferences()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultPreferences()
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { simpleMode?: unknown }).simpleMode !== 'boolean'
  ) {
    return defaultPreferences()
  }

  return { simpleMode: (parsed as Preferences).simpleMode }
}

function writePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Best-effort: if the write fails (quota, disabled storage), silently drop
    // rather than crashing the play flow. The toggle still moved for this
    // session; only its survival across a reload is lost.
  }
}

/**
 * A localStorage-backed `PreferenceStore`. The preferences live in one JSON
 * object under `daily-groove:v1:prefs`, beside — never inside — the results
 * envelope: a preference is not a day's play, and the two version
 * independently.
 */
export function createLocalPreferenceStore(): PreferenceStore {
  return {
    async get(): Promise<Preferences> {
      return readPreferences()
    },

    async set(prefs: Preferences): Promise<void> {
      writePreferences(prefs)
    },
  }
}
