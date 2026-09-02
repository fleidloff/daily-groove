import type { DailyResult } from '../../types'

export type ResultStore = {
  get(date: string): Promise<DailyResult | null>
  getAll(): Promise<DailyResult[]>
  save(result: DailyResult): Promise<void>
  readonly persists?: boolean
}

const STORAGE_KEY = 'daily-groove:v2:results'

type Envelope = {
  version: 2
  byDate: Record<string, DailyResult>
}

function emptyEnvelope(): Envelope {
  return { version: 2, byDate: {} }
}

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
    // Quota or disabled storage must not crash the play flow.
  }
}

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

export function createReadOnlyStore(inner: ResultStore): ResultStore {
  return {
    async get(): Promise<DailyResult | null> {
      return null
    },
    getAll: () => inner.getAll(),
    async save(): Promise<void> {
      // Deliberately nothing: a shared groove is never recorded.
    },
    persists: false,
  }
}
