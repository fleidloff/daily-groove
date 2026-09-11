import { computeStats } from '@/features/daily-groove'
import type { DailyResult } from '@/features/daily-groove'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAttempt(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.root === 'string' &&
    typeof value.flavour === 'string' &&
    typeof value.correct === 'boolean' &&
    typeof value.rootMatched === 'boolean' &&
    typeof value.flavourMatched === 'boolean'
  )
}

function isDailyResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    isRecord(value.answer) &&
    typeof value.answer.root === 'string' &&
    typeof value.answer.flavour === 'string' &&
    Array.isArray(value.attempts) &&
    value.attempts.every(isAttempt) &&
    typeof value.solved === 'boolean'
  )
}

function invalidBody(): Response {
  return Response.json({ error: 'invalid-body' }, { status: 400 })
}

// The day is the browser's, not the server's: a player east of UTC would
// otherwise get yesterday's window and a streak that disagrees with the header.
export async function POST(request: Request): Promise<Response> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return invalidBody()
  }

  if (!isRecord(body)) return invalidBody()
  const { results, today } = body
  if (typeof today !== 'string' || !ISO_DATE.test(today)) return invalidBody()
  if (!Array.isArray(results) || !results.every(isDailyResult)) return invalidBody()

  return Response.json(computeStats(results as DailyResult[], today))
}

export function GET(): Response {
  return Response.json(
    { error: 'method-not-allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
