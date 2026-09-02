export type Preferences = {
  simpleMode: boolean
  tapSounds: boolean
}

export type PreferenceStore = {
  get(): Promise<Preferences>
  update(patch: Partial<Preferences>): Promise<void>
}

const STORAGE_KEY = 'daily-groove:v1:prefs'

function defaultPreferences(): Preferences {
  return { simpleMode: false, tapSounds: true }
}

function booleanField(blob: object, key: keyof Preferences): boolean {
  const value = (blob as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : defaultPreferences()[key]
}

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
    // Quota or disabled storage: the toggle still moved for this session.
  }
}

export function createLocalPreferenceStore(): PreferenceStore {
  return {
    async get(): Promise<Preferences> {
      return readPreferences()
    },

    async update(patch: Partial<Preferences>): Promise<void> {
      writePreferences({ ...readPreferences(), ...patch })
    },
  }
}
