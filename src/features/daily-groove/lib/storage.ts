import type { DailyResult } from '../types'

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
}

const STORAGE_KEY = 'daily-groove:v1:results'

type Envelope = {
  version: 1
  byDate: Record<string, DailyResult>
}

function emptyEnvelope(): Envelope {
  return { version: 1, byDate: {} }
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
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { byDate?: unknown }).byDate !== 'object' ||
    (parsed as { byDate?: unknown }).byDate === null
  ) {
    return emptyEnvelope()
  }

  return { version: 1, byDate: (parsed as Envelope).byDate }
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
 * blob under `daily-groove:v1:results`; each call reads/merges/writes that blob.
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
