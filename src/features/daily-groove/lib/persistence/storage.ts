import type { DailyResult } from '../../types'

/**
 * The single persistence seam for the daily-groove feature. Every read/write of
 * saved results goes through a `ResultStore`; no component or hook touches
 * `localStorage` directly. Methods are `Promise`-returning even though the
 * localStorage implementation is synchronous, so a future login-backed/server
 * store can implement the same interface without changing any caller.
 */
export type ResultStore = {
  get(date: string): Promise<DailyResult | null>
  getAll(): Promise<DailyResult[]>
  save(result: DailyResult): Promise<void>
  /**
   * `false` on a store whose `save` keeps nothing *by design*, so a caller
   * holding results in memory can tell "this write went nowhere" apart from
   * "this write failed". Absent means it persists, which is what every store
   * that actually writes leaves it as.
   *
   * `useProgress` is the one reader: it merges each record into the list the
   * streak is derived from before the write, so that a failing store never costs
   * the player their guess. A store that persists nothing must not feed that
   * list at all, or a shared groove would move a streak it never wrote
   * (F12 E1 R19, AC9).
   */
  readonly persists?: boolean
}

/**
 * The version-2 key. Feature-1's records were keyed by scale/chord/progression
 * attributes that no longer exist, so v2 is a clean break under its own key: the
 * v1 blob is left in place, never read, and never migrated.
 */
const STORAGE_KEY = 'daily-groove:v2:results'

type Envelope = {
  version: 2
  byDate: Record<string, DailyResult>
}

function emptyEnvelope(): Envelope {
  return { version: 2, byDate: {} }
}

/**
 * Read and validate the versioned envelope from localStorage. Guards against an
 * absent store, corrupt JSON, or a wrong-shaped blob by falling back to an empty
 * envelope, so a bad read never throws into the UI.
 */
function readEnvelope(): Envelope {
  let storage: Storage
  try {
    storage = localStorage
    if (!storage) return emptyEnvelope()
  } catch {
    return emptyEnvelope()
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return emptyEnvelope()
  }
  if (raw === null) return emptyEnvelope()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyEnvelope()
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 2 ||
    typeof (parsed as { byDate?: unknown }).byDate !== 'object' ||
    (parsed as { byDate?: unknown }).byDate === null
  ) {
    return emptyEnvelope()
  }

  return { version: 2, byDate: (parsed as Envelope).byDate }
}

function writeEnvelope(envelope: Envelope): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    // Best-effort: if the write fails (quota, disabled storage), silently drop
    // rather than crashing the play flow.
  }
}

/**
 * A localStorage-backed `ResultStore`. All results live in one versioned JSON
 * blob under `daily-groove:v2:results`; each call reads/merges/writes that blob.
 */
export function createLocalStore(): ResultStore {
  return {
    async get(date: string): Promise<DailyResult | null> {
      const { byDate } = readEnvelope()
      return byDate[date] ?? null
    },

    async getAll(): Promise<DailyResult[]> {
      const { byDate } = readEnvelope()
      return Object.values(byDate)
    },

    async save(result: DailyResult): Promise<void> {
      const envelope = readEnvelope()
      envelope.byDate[result.date] = result
      writeEnvelope(envelope)
    },
  }
}

/**
 * The seam a shared groove is played through (F12 E1 R18, R19).
 *
 * A decorator rather than a flag threaded to each write site: `ResultStore` is
 * already the one place saved results are read and written, so wrapping it here
 * means a shared session has no write path left to reach by accident, however
 * the puzzle grows.
 *
 * The two reads are deliberately *not* symmetrical, and the asymmetry is the
 * whole design:
 *
 * - `getAll` delegates, because the streak the header shows is derived from the
 *   real saved results and a shared page shows the player's true streak. It just
 *   must not move it (R19; F12 E3 R7a).
 * - `get` does not, because it answers "what has been played on this date", and
 *   on a shared groove the answer is always nothing. Delegating it would hydrate
 *   *today's* saved attempts into a puzzle for a different groove — a shared
 *   link opened after the daily was solved would show as already solved, its
 *   attempt row scored against another answer entirely. A shared groove opens
 *   fresh every visit (R21, AC11).
 *
 * `save` is dropped but still resolves, so every caller's `await` behaves
 * exactly as it does on the daily page, and `persists: false` tells the one
 * caller that holds records in memory not to hold this one.
 */
export function createReadOnlyStore(inner: ResultStore): ResultStore {
  return {
    async get(): Promise<DailyResult | null> {
      return null
    },
    getAll: () => inner.getAll(),
    async save(): Promise<void> {
      // Deliberately nothing. A shared groove is practice: no record is created
      // or amended under today's date, or under any date (R18).
    },
    persists: false,
  }
}
