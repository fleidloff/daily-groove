import { DEFAULT_LANGUAGE, resolveLanguage, type Language } from '@/lib/language'

export const LANGUAGE_STORAGE_KEY = 'daily-groove:v1:language'

function writeLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Quota or disabled storage: the language still holds for this session.
  }
}

export function readChosenLanguage(): Language {
  // Server render: Node exposes a localStorage accessor that warns when touched.
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE

  let storage: Storage
  try {
    storage = localStorage
    if (!storage) return DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }

  let raw: string | null
  try {
    raw = storage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    return DEFAULT_LANGUAGE
  }

  const resolved = resolveLanguage(raw)
  if (resolved !== raw) writeLanguage(resolved)
  return resolved
}
