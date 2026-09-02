/**
 * The player's settings, as opposed to their play. Preferences outlive a day and
 * belong to nobody's record, so they live under their own key rather than inside
 * the results envelope (E5 R7, A2).
 */
export type Preferences = {
  /** Simple mode: six roots and a major-or-minor second row (E5 R2, R4). */
  simpleMode: boolean
  /**
   * Whether tapping a root or a mode chip sounds. On unless the player turned
   * it off (F16 E2 R2), and a setting rather than a record of the day (R5a).
   */
  tapSounds: boolean
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
  /**
   * Merge a subset of the preferences into what is stored, leaving every field
   * the patch does not name exactly as it was found.
   *
   * The whole-object `set` it replaces is gone deliberately: with two fields and
   * two independent writers, a writer that passes a complete object erases the
   * field it has never heard of. A merge makes that unrepresentable rather than
   * something both hooks have to remember (F16 E2 R7).
   */
  update(patch: Partial<Preferences>): Promise<void>
}

/**
 * Versioned like the results key, so a future change to the preference shape is
 * a clean break under a new key rather than a migration of this one.
 */
const STORAGE_KEY = 'daily-groove:v1:prefs'

/**
 * Simple mode is off unless the player turned it on: a returning player who has
 * never touched the toggle sees exactly the puzzle they saw before (E5 A3). The
 * tap sounds are on for the same reason in the other direction — a player who
 * never touches the switch gets the app as it behaved before it existed
 * (F16 E2 R2).
 */
function defaultPreferences(): Preferences {
  return { simpleMode: false, tapSounds: true }
}

/** Keep a stored field only when it is the boolean it is meant to be. */
function booleanField(blob: object, key: keyof Preferences): boolean {
  const value = (blob as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : defaultPreferences()[key]
}

/**
 * Read and validate the stored preferences. Guards against an absent store, a
 * throwing store, an absent key, corrupt JSON or a wrong-shaped blob by falling
 * back to the defaults, so a bad read never throws into the UI.
 *
 * Validation goes field by field rather than over the whole object: with two
 * fields, a whole-object check would let one corrupt or absent field reset the
 * other, which is the inverse of F16 E2 R7. Per-field reading is also what makes
 * backwards compatibility fall out — a blob written before `tapSounds` existed
 * loads with its simple mode intact and the sounds at their default.
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

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return defaultPreferences()
  }

  return {
    simpleMode: booleanField(parsed, 'simpleMode'),
    tapSounds: booleanField(parsed, 'tapSounds'),
  }
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

    async update(patch: Partial<Preferences>): Promise<void> {
      // Read-modify-write on the seam, so round-tripping the field this caller
      // has never heard of is a property of the store rather than a rule every
      // writer has to remember (F16 E2 R7). Both halves already swallow their
      // own failures, so a hostile storage still resolves (R8).
      writePreferences({ ...readPreferences(), ...patch })
    },
  }
}
