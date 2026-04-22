'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type LocaleCode } from './config'
import { DICTIONARY, type I18nKey } from './dictionary'

type I18nContextValue = {
	locale: LocaleCode
	setLocale: (next: LocaleCode) => void
	t: (key: I18nKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// Normalize persisted locale value against supported locale list.
function resolveLocale (value: string | null) {
	if(!value) return DEFAULT_LOCALE
	for(const locale of SUPPORTED_LOCALES) {
		if(locale.code === value) return locale.code
	}
	return DEFAULT_LOCALE
}

// Build localization context provider for web app screens.
export function I18nProvider ({ children }: { children: React.ReactNode }) {
	const [locale, setLocaleState] = useState<LocaleCode>(() => {
		if(typeof window === 'undefined') return DEFAULT_LOCALE
		return resolveLocale(window.localStorage.getItem('visa-assistent-locale'))
	})

	const contextValue = useMemo<I18nContextValue>(() => {
		return {
			locale,
			setLocale (next) {
				setLocaleState(next)
				if(typeof window !== 'undefined') window.localStorage.setItem('visa-assistent-locale', next)
			},
			t (key) {
				return DICTIONARY[locale][key]
			},
		}
	}, [locale])

	return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

// Return i18n context for localized UI components.
export function useI18n () {
	const context = useContext(I18nContext)
	if(context) return context
	throw new Error('useI18n must be used within I18nProvider')
}
