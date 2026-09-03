export const SUPPORTED_LANGUAGES = ['en'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

function isSupported(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function resolveLanguage(raw: string | null): Language {
  if (raw === null) return DEFAULT_LANGUAGE
  if (isSupported(raw)) return raw
  return DEFAULT_LANGUAGE
}
