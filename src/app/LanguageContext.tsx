'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Language } from '@/lib/language'
import { readChosenLanguage } from './language'

const LanguageValue = createContext<Language | null>(null)

export function LanguageProvider(props: { children: ReactNode }): ReactNode {
  const [language] = useState<Language>(() => readChosenLanguage())
  return <LanguageValue value={language}>{props.children}</LanguageValue>
}

export function useLanguageContext(): Language {
  const value = useContext(LanguageValue)
  if (value === null) {
    throw new Error('useLanguageContext must be used inside <LanguageProvider>')
  }
  return value
}
