export const DEFAULT_LOCALE = 'ru' as const

export const SUPPORTED_LOCALES = [
	{ code: 'ru', nativeName: 'Русский' },
	{ code: 'en', nativeName: 'English' },
	{ code: 'de', nativeName: 'Deutsch' },
	{ code: 'fr', nativeName: 'Français' },
	{ code: 'es', nativeName: 'Español' },
	{ code: 'it', nativeName: 'Italiano' },
] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']
