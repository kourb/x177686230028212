'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { SUPPORTED_LOCALES, type LocaleCode } from '@/i18n/config'
import { I18nProvider, useI18n } from '@/i18n/provider'

const HERO_IMAGE = '/assets/hero-travel.svg'
const DEVICE_ID_STORAGE_KEY = 'visa-assistent-device-id'
const AUTH_STORAGE_KEY = 'visa-assistent-auth'
const USER_PROFILE_STORAGE_KEY = 'visa-assistent-user-profile'
const AUTH_REMOTE_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL ?? 'https://133892.ip-ns.net'
const AUTH_PROXY_BASE_URL = process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL ?? 'http://localhost:8787'
const AUTH_USE_PROXY = process.env.NEXT_PUBLIC_AUTH_USE_PROXY === '1' || (process.env.NEXT_PUBLIC_AUTH_USE_PROXY !== '0' && process.env.NODE_ENV === 'development')
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '383303576206-8svtv0iglo3sil07mlflaoulv67b9esr.apps.googleusercontent.com'

type AuthPath = '/v1/app/auth/email/send-otp' | '/v1/app/auth/email/verify-otp' | '/v1/app/auth/google' | '/v1/app/auth/refresh' | '/v1/app/passports'

type AuthDeletePath = '/v1/app/auth/account'

type AuthDeleteDynamicPath = `/v1/app/passports/${string}`

type AuthGetPath = '/v1/app/auth/sessions' | '/v1/app/dashboard' | '/v1/app/passports'

type GoogleCredentialResponse = {
	credential?: string
}

type GoogleWindow = Window & {
	google?: {
		accounts?: {
			id?: {
				initialize: (options: { client_id: string, callback: (response: GoogleCredentialResponse) => void, auto_select: boolean, cancel_on_tap_outside: boolean }) => void
				prompt: (listener?: (notification: { isNotDisplayed: () => boolean, isSkippedMoment: () => boolean }) => void) => void
			}
		}
	}
}

type ApiResponse<T> = {
	data: T | null
	error: {
		message?: string
	} | null
}

type AuthTokenResponse = {
	accessToken: string
	refreshToken: string
	accessTokenExpiresAt: number | string
	refreshTokenExpiresAt: number | string
	user?: {
		userId?: string
		email?: string
		role?: string
		isEmailVerified?: boolean
		linkedProviders?: string[]
		hasPassword?: boolean
	}
	isNewUser: boolean
}

type UserProfile = {
	displayName: string
}

type PassportEntry = {
	id: string
	fullName: string
	passportNumber: string
	visaLabel: string
	citizenship: string
	firstName: string
	lastName: string
	birthDate: string
	gender: string
	issueDate: string
	expiryDate: string
	issuedBy: string
}

type PassportDto = {
	publicId: string
	firstName: string
	lastName: string
	birthDate: string
	gender: number | string
	citizenship: string | null
	passportNumber: string
	issueDate: string | null
	expiryDate: string
	issuingAuthority: string | null
}

type EntryStep = 'onboarding' | 'auth' | 'home'

type HomeTab = 'home' | 'documents' | 'visa-start' | 'visa-type' | 'visa-passport' | 'profile' | 'profile-data' | 'developer-mode' | 'passports-list' | 'passports-step-one' | 'passports-step-two' | 'passports-review' | 'passports-edit'

type VisaDestinationCode = 'italy' | 'france' | 'spain' | 'hungary' | 'greece'

type VisaTypeCode = 'type-c' | 'type-d'

type VisaTypeDetail = {
	durationDays: number
	entryKey: 'single' | 'multiple'
	consularFee: string
}

const VISA_DESTINATION_OPTIONS: { code: VisaDestinationCode, labelKey: 'visaDestinationItaly' | 'visaDestinationFrance' | 'visaDestinationSpain' | 'visaDestinationHungary' | 'visaDestinationGreece', flagSrc: string }[] = [
	{ code: 'italy', labelKey: 'visaDestinationItaly', flagSrc: '/assets/flag-italy.svg' },
	{ code: 'france', labelKey: 'visaDestinationFrance', flagSrc: '/assets/flag-france.svg' },
	{ code: 'spain', labelKey: 'visaDestinationSpain', flagSrc: '/assets/flag-spain.svg' },
	{ code: 'hungary', labelKey: 'visaDestinationHungary', flagSrc: '/assets/flag-hungary.svg' },
	{ code: 'greece', labelKey: 'visaDestinationGreece', flagSrc: '/assets/flag-greece.svg' },
]

const VISA_DESTINATION_VISA_TEXT: Record<LocaleCode, Record<VisaDestinationCode, string>> = {
	ru: {
		italy: 'в Италию',
		france: 'во Францию',
		spain: 'в Испанию',
		hungary: 'в Венгрию',
		greece: 'в Грецию',
	},
	en: {
		italy: 'to Italy',
		france: 'to France',
		spain: 'to Spain',
		hungary: 'to Hungary',
		greece: 'to Greece',
	},
	de: {
		italy: 'fur Italien',
		france: 'fur Frankreich',
		spain: 'fur Spanien',
		hungary: 'fur Ungarn',
		greece: 'fur Griechenland',
	},
	fr: {
		italy: 'pour l Italie',
		france: 'pour la France',
		spain: 'pour l Espagne',
		hungary: 'pour la Hongrie',
		greece: 'pour la Grece',
	},
	es: {
		italy: 'para Italia',
		france: 'para Francia',
		spain: 'para Espana',
		hungary: 'para Hungria',
		greece: 'para Grecia',
	},
	it: {
		italy: 'per Italia',
		france: 'per Francia',
		spain: 'per Spagna',
		hungary: 'per Ungheria',
		greece: 'per Grecia',
	},
}

const VISA_TYPE_DETAILS: Record<VisaDestinationCode, Record<VisaTypeCode, VisaTypeDetail>> = {
	italy: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	france: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	spain: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	hungary: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	greece: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
}

const VISA_WARNING_TEXT: Record<LocaleCode, { subtitle: string, duration: string, entry: Record<VisaTypeDetail['entryKey'], string>, fee: string, confirm: string }> = {
	ru: { subtitle: 'Ознакомьтесь с дополнительными условиями по визе.', duration: 'Срок действия', entry: { single: 'Однократный въезд', multiple: 'Многократный въезд' }, fee: 'Консульский сбор', confirm: 'Подтвердить' },
	en: { subtitle: 'Review the additional visa conditions.', duration: 'Validity period', entry: { single: 'Single entry', multiple: 'Multiple entry' }, fee: 'Consular fee', confirm: 'Confirm' },
	de: { subtitle: 'Prufen Sie die zusatzlichen Visumbedingungen.', duration: 'Gultigkeitsdauer', entry: { single: 'Einmalige Einreise', multiple: 'Mehrfache Einreise' }, fee: 'Konsulargebuhr', confirm: 'Bestatigen' },
	fr: { subtitle: 'Consultez les conditions supplementaires du visa.', duration: 'Duree de validite', entry: { single: 'Entree unique', multiple: 'Entrees multiples' }, fee: 'Frais consulaires', confirm: 'Confirmer' },
	es: { subtitle: 'Revisa las condiciones adicionales del visado.', duration: 'Periodo de validez', entry: { single: 'Entrada unica', multiple: 'Entradas multiples' }, fee: 'Tasa consular', confirm: 'Confirmar' },
	it: { subtitle: 'Consulta le condizioni aggiuntive del visto.', duration: 'Periodo di validita', entry: { single: 'Ingresso singolo', multiple: 'Ingressi multipli' }, fee: 'Tassa consolare', confirm: 'Conferma' },
}

const VISA_PASSPORT_TEXT: Record<LocaleCode, { title: string, subtitle: string, before: string, rules: string[], add: string, saved: string }> = {
	ru: { title: 'Загрузка паспорта', subtitle: 'Автоматически заполним данные, необходимые для оформления визы.', before: 'Перед загрузкой документа:', rules: ['Загрузите страницу с вашей фотографией и именем (полный разворот).', 'Убедитесь в том, что загранпаспорт не просрочен и не поврежден.', 'Изображение должно быть четким и хорошо читаемым. Без бликов, пальцев в кадре и размытия.'], add: 'Добавить паспорт', saved: 'Выбрать сохраненный паспорт' },
	en: { title: 'Passport upload', subtitle: 'We will automatically fill in the data needed for the visa application.', before: 'Before uploading the document:', rules: ['Upload the page with your photo and name (full spread).', 'Make sure your passport is not expired or damaged.', 'The image must be sharp and readable, without glare, fingers in frame, or blur.'], add: 'Add passport', saved: 'Choose saved passport' },
	de: { title: 'Pass hochladen', subtitle: 'Wir fullen die fur den Visumantrag erforderlichen Daten automatisch aus.', before: 'Vor dem Hochladen des Dokuments:', rules: ['Laden Sie die Seite mit Foto und Namen hoch (ganze Doppelseite).', 'Stellen Sie sicher, dass der Reisepass nicht abgelaufen oder beschadigt ist.', 'Das Bild muss scharf und gut lesbar sein, ohne Spiegelungen, Finger im Bild oder Unscharfe.'], add: 'Pass hinzufugen', saved: 'Gespeicherten Pass auswahlen' },
	fr: { title: 'Telechargement du passeport', subtitle: 'Nous remplirons automatiquement les donnees necessaires a la demande de visa.', before: 'Avant de telecharger le document:', rules: ['Telechargez la page avec votre photo et votre nom (double page complete).', 'Assurez-vous que le passeport n est pas expire ni endommage.', 'L image doit etre nette et lisible, sans reflets, doigts dans le cadre ni flou.'], add: 'Ajouter un passeport', saved: 'Choisir un passeport enregistre' },
	es: { title: 'Carga de pasaporte', subtitle: 'Completaremos automaticamente los datos necesarios para la solicitud de visado.', before: 'Antes de cargar el documento:', rules: ['Carga la pagina con tu foto y nombre (doble pagina completa).', 'Asegurate de que el pasaporte no este vencido ni danado.', 'La imagen debe ser nitida y legible, sin reflejos, dedos en el encuadre ni desenfoque.'], add: 'Agregar pasaporte', saved: 'Elegir pasaporte guardado' },
	it: { title: 'Caricamento passaporto', subtitle: 'Compileremo automaticamente i dati necessari per la richiesta del visto.', before: 'Prima di caricare il documento:', rules: ['Carica la pagina con foto e nome (doppia pagina completa).', 'Assicurati che il passaporto non sia scaduto o danneggiato.', 'L immagine deve essere nitida e leggibile, senza riflessi, dita nell inquadratura o sfocature.'], add: 'Aggiungi passaporto', saved: 'Scegli passaporto salvato' },
}

// Compose visa type title for the selected destination country.
function resolveVisaTypeTitle (locale: LocaleCode, destination: VisaDestinationCode, type: 'C' | 'D') {
	if(locale === 'ru') return `Шенгенская виза ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Тип ${type})`
	if(locale === 'en') return `Schengen visa ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Type ${type})`
	if(locale === 'de') return `Schengen-Visum ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Typ ${type})`
	if(locale === 'fr') return `Visa Schengen ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Type ${type})`
	if(locale === 'es') return `Visado Schengen ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Tipo ${type})`
	return `Visto Schengen ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Tipo ${type})`
}

let googleScriptPromise: Promise<void> | null = null

// Normalize token expiration value into unix milliseconds.
function resolveExpireAtMs (value: number | string | undefined) {
	if(value === undefined || value === null) return 0
	if(typeof value === 'number') return value > 1e12 ? value : value * 1000
	if(/^\d+$/.test(value)) {
		const numeric = Number(value)
		return numeric > 1e12 ? numeric : numeric * 1000
	}
	const parsed = Date.parse(value)
	if(Number.isNaN(parsed)) return 0
	return parsed
}

// Resolve whether refresh token is still valid for session reuse.
function hasValidRefreshToken (payload: AuthTokenResponse | null) {
	if(!payload?.refreshToken) return false
	const expiresAt = resolveExpireAtMs(payload.refreshTokenExpiresAt)
	if(!expiresAt) return false
	return expiresAt > Date.now()
}

// Resolve stable device metadata required by auth endpoints.
function resolveDeviceInfo () {
	const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
	if(stored) {
		return {
			deviceId: stored,
			deviceName: 'Visa Assistent Web',
		}
	}

	const created = crypto.randomUUID()
	window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created)
	return {
		deviceId: created,
		deviceName: 'Visa Assistent Web',
	}
}

// Resolve whether user already has persisted auth token pair.
function hasPersistedAuthSession () {
	if(typeof window === 'undefined') return false

	const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
	if(!raw) return false

	try {
		const parsed = JSON.parse(raw) as AuthTokenResponse | null
		if(!parsed) return false
		if(!parsed.accessToken) return false
		if(!hasValidRefreshToken(parsed)) {
			clearPersistedSession()
			return false
		}
		return true
	} catch {
		return false
	}
}

// Decode Google ID token payload and extract first name.
function resolveGoogleDisplayName (idToken: string) {
	const tokenParts = idToken.split('.')
	if(tokenParts.length < 2) return null

	try {
		const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { given_name?: string, name?: string }
		if(payload.given_name && payload.given_name.trim()) return payload.given_name.trim()
		if(payload.name && payload.name.trim()) return payload.name.trim().split(' ')[0]
		return null
	} catch {
		return null
	}
}

// Persist resolved user profile for post-auth screens.
function setUserProfile (profile: UserProfile) {
	window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

// Resolve persisted user profile from local storage.
function resolveUserProfile () {
	const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)
	if(!raw) return null

	try {
		const profile = JSON.parse(raw) as UserProfile | null
		if(!profile?.displayName) return null
		return profile
	} catch {
		return null
	}
}

// Clear persisted auth and profile data after account deletion.
function clearPersistedSession () {
	window.localStorage.removeItem(AUTH_STORAGE_KEY)
	window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY)
}

// Format API date string into dd.mm.yyyy for UI fields.
function formatPassportDate (value: string | null | undefined) {
	if(!value) return ''
	const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
	if(!match) return String(value)
	return `${match[3]}.${match[2]}.${match[1]}`
}

// Convert dd.mm.yyyy UI date into API yyyy-mm-dd.
function toApiPassportDate (value: string) {
	const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
	if(!match) return value
	return `${match[3]}-${match[2]}-${match[1]}`
}

// Map API passport dto into UI passport entry model.
function mapPassportDto (dto: PassportDto): PassportEntry {
	const gender = Number(dto.gender) === 2 ? 'Женский' : 'Мужской'
	return {
		id: dto.publicId,
		fullName: `${dto.firstName} ${dto.lastName}`.trim().toUpperCase(),
		passportNumber: dto.passportNumber,
		visaLabel: 'Шенгенская виза в Италию (Тип C)',
		citizenship: dto.citizenship ?? 'THE RUSSIAN FEDERATION',
		firstName: dto.firstName,
		lastName: dto.lastName,
		birthDate: formatPassportDate(dto.birthDate),
		gender,
		issueDate: formatPassportDate(dto.issueDate),
		expiryDate: formatPassportDate(dto.expiryDate),
		issuedBy: dto.issuingAuthority ?? 'THE RUSSIAN FEDERATION',
	}
}

// Build new passport draft defaults for add flow.
function createPassportDraft () {
	return {
		id: `draft-${Date.now()}`,
		fullName: 'ALEKS GERMAN',
		passportNumber: '650000001',
		visaLabel: 'Шенгенская виза в Италию (Тип C)',
		citizenship: 'THE RUSSIAN FEDERATION',
		firstName: 'ALEKS',
		lastName: 'GERMAN',
		birthDate: '08.02.1996',
		gender: 'Мужской',
		issueDate: '01.10.2020',
		expiryDate: '01.10.2030',
		issuedBy: 'THE RUSSIAN FEDERATION',
	} satisfies PassportEntry
}

// Build create-passport API payload from UI draft data.
function mapPassportDraftToPayload (draft: PassportEntry) {
	return {
		lastName: draft.lastName,
		firstName: draft.firstName,
		middleName: null,
		birthDate: toApiPassportDate(draft.birthDate),
		gender: draft.gender === 'Женский' ? 2 : 1,
		citizenship: draft.citizenship,
		passportSeries: null,
		passportNumber: draft.passportNumber,
		issueDate: toApiPassportDate(draft.issueDate),
		expiryDate: toApiPassportDate(draft.expiryDate),
		issuingAuthority: draft.issuedBy,
		isPrimary: false,
	}
}

// Resolve persisted auth token payload from local storage.
function resolveAuthPayload () {
	const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
	if(!raw) return null

	try {
		return JSON.parse(raw) as AuthTokenResponse
	} catch {
		return null
	}
}

// Persist refreshed auth payload when API issues new token pair.
function setAuthPayload (payload: AuthTokenResponse) {
	window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

// Resolve request URL for auth endpoint in proxy or direct mode.
function resolveAuthUrl (path: AuthPath | AuthDeletePath | AuthDeleteDynamicPath | AuthGetPath) {
	if(AUTH_USE_PROXY) return `${AUTH_PROXY_BASE_URL}${path}`

	return `${AUTH_REMOTE_BASE_URL}${path}`
}

// Load Google Identity Services script once per app session.
function loadGoogleScript () {
	if(googleScriptPromise) return googleScriptPromise

	googleScriptPromise = new Promise<void>((resolve, reject) => {
		const found = document.querySelector('script[data-google-identity="1"]') as HTMLScriptElement | null
		if(found) {
			if((window as GoogleWindow).google?.accounts?.id) {
				resolve()
				return
			}

			found.addEventListener('load', () => resolve(), { once: true })
			found.addEventListener('error', () => reject(new Error('Failed to load Google SDK')), { once: true })
			return
		}

		const script = document.createElement('script')
		script.src = 'https://accounts.google.com/gsi/client'
		script.async = true
		script.defer = true
		script.dataset.googleIdentity = '1'
		script.onload = () => resolve()
		script.onerror = () => reject(new Error('Failed to load Google SDK'))
		document.head.appendChild(script)
	})

	return googleScriptPromise
}

// Request Google ID token via Google Identity Services.
function requestGoogleIdToken (clientId: string) {
	return new Promise<string>((resolve, reject) => {
		const google = (window as GoogleWindow).google?.accounts?.id
		if(!google) {
			reject(new Error('Google SDK is unavailable'))
			return
		}

		let done = false
		const finish = (callback: () => void) => {
			if(done) return
			done = true
			callback()
		}

		google.initialize({
			client_id: clientId,
			auto_select: false,
			cancel_on_tap_outside: true,
			callback: (response) => {
				if(response.credential) {
					finish(() => resolve(response.credential as string))
					return
				}

				finish(() => reject(new Error('Google did not return id token')))
			},
		})

		google.prompt((notification) => {
			if(notification.isNotDisplayed() || notification.isSkippedMoment()) {
				finish(() => reject(new Error('Google sign-in prompt was skipped')))
			}
		})
	})
}

// Send POST request to app auth API and unwrap data payload.
async function authPost<T> (path: AuthPath, payload: Record<string, unknown>) {
	const response = await fetch(resolveAuthUrl(path), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})
	const body = await response.json() as ApiResponse<T>

	if(!response.ok || !body.data && path !== '/v1/app/auth/email/send-otp') {
		throw new Error(body.error?.message ?? 'Authorization request failed')
	}

	return body.data
}

// Send authorized POST request and refresh access token before retry.
async function authPostAuthorized<T> (path: '/v1/app/passports', payload: Record<string, unknown>) {
	const authPayload = resolveAuthPayload()
	if(!authPayload?.accessToken) throw new Error('Authorization token is missing')

	const requestPost = async (token: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})
		const body = await response.json() as ApiResponse<T>
		return { response, body }
	}

	let { response, body } = await requestPost(authPayload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(authPayload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', {
			refreshToken: authPayload.refreshToken,
			device: resolveDeviceInfo(),
		})

		if(refreshed) {
			setAuthPayload(refreshed)
			;({ response, body } = await requestPost(refreshed.accessToken))
		}
	}

	if(response.status === 401) {
		clearPersistedSession()
		throw new Error('Session expired. Sign in again')
	}
	if(!response.ok || !body.data) throw new Error(body.error?.message ?? 'Authorization request failed')
	return body.data
}

// Send authorized DELETE request to auth API.
async function authDelete (path: AuthDeletePath) {
	return authDeletePath(path)
}

// Send authorized DELETE request with one refresh retry.
async function authDeletePath (path: AuthDeletePath | AuthDeleteDynamicPath) {
	const payload = resolveAuthPayload()
	if(!payload?.accessToken) throw new Error('Authorization token is missing')

	const requestDelete = async (accessToken: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		const body = await response.json() as ApiResponse<unknown>
		return { response, body }
	}

	let { response, body } = await requestDelete(payload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(payload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', {
			refreshToken: payload.refreshToken,
			device: resolveDeviceInfo(),
		})
		if(refreshed) {
			setAuthPayload(refreshed)
			;({ response, body } = await requestDelete(refreshed.accessToken))
		}
	}

	if(response.status === 401) {
		clearPersistedSession()
		throw new Error('Session expired. Sign in again and retry account deletion')
	}
	if(!response.ok) throw new Error(body.error?.message ?? 'Account deletion failed')
	return body.data
}

// Send authorized GET request and refresh expired access token once.
async function authGet<T> (path: AuthGetPath) {
	const payload = resolveAuthPayload()
	if(!payload?.accessToken) throw new Error('Authorization token is missing')

	const requestGet = async (accessToken: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		const body = await response.json() as ApiResponse<T>
		return { response, body }
	}

	let { response, body } = await requestGet(payload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(payload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', {
			refreshToken: payload.refreshToken,
			device: resolveDeviceInfo(),
		})
		if(refreshed) {
			setAuthPayload(refreshed)
			;({ response, body } = await requestGet(refreshed.accessToken))
		}
	}

	if(response.status === 401) {
		clearPersistedSession()
		throw new Error('Session expired. Sign in again')
	}
	if(!response.ok) throw new Error(body.error?.message ?? 'Request failed')
	return body.data
}

// Resolve splash lifecycle based on document and script readiness.
function useSplashReady () {
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		let isActive = true
		const waitForLoad = new Promise<void>((resolve) => {
			if(document.readyState === 'complete') {
				resolve()
				return
			}
			window.addEventListener('load', () => resolve(), { once: true })
		})
		const waitForSettle = new Promise<void>((resolve) => {
			window.setTimeout(() => resolve(), 850)
		})

		Promise.all([waitForLoad, waitForSettle]).then(() => {
			if(isActive) setIsReady(true)
		})

		return () => {
			isActive = false
		}
	}, [])

	return isReady
}

// Check whether email field contains minimal valid value.
function isEmailValid (email: string) {
	const value = email.trim()
	if(!value.includes('@')) return false
	const parts = value.split('@')
	if(parts.length !== 2) return false
	if(parts[0].length === 0 || parts[1].length < 3) return false
	return parts[1].includes('.')
}

// Render locale switcher control outside mobile frame.
function LocaleSwitcher () {
	const { locale, setLocale } = useI18n()
	const [isOpen, setIsOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)
	const selected = SUPPORTED_LOCALES.find((item) => item.code === locale) ?? SUPPORTED_LOCALES[0]

	useEffect(() => {
		if(!isOpen) return

		const onPointerDown = (event: PointerEvent) => {
			if(!rootRef.current) return
			if(rootRef.current.contains(event.target as Node)) return
			setIsOpen(false)
		}

		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [isOpen])

	return (
		<div className="locale-switcher" ref={rootRef}>
			<button aria-expanded={isOpen} className="locale-trigger" onClick={() => setIsOpen(!isOpen)} type="button">
				<span>{selected.nativeName}</span>
				<i aria-hidden className="locale-caret">
					<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
						<path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
					</svg>
				</i>
			</button>

			{isOpen ? (
				<ul className="locale-menu" role="listbox">
					{SUPPORTED_LOCALES.map((item) => {
						return (
							<li key={item.code}>
								<button className={item.code === locale ? 'locale-option is-active' : 'locale-option'} onClick={() => {
									setLocale(item.code)
									setIsOpen(false)
								}} type="button">
									<span>{item.nativeName}</span>
								</button>
							</li>
						)
					})}
				</ul>
			) : null}
		</div>
	)
}

// Render first onboarding screen from Figma node 591:7457.
function OnboardingScreen ({ onContinue }: { onContinue: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Onboarding" className="onboarding-screen">
			<div className="onboarding-hero">
				<Image alt="Travel illustration" className="onboarding-hero-image" height={394} priority src={HERO_IMAGE} unoptimized width={458} />
			</div>

			<div className="onboarding-copy">
				<h1>{t('onboardingTitle')}</h1>
				<p>{t('onboardingSubtitle')}</p>
			</div>

			<button className="onboarding-cta" onClick={onContinue} type="button">{t('onboardingContinue')}</button>
		</section>
	)
}

// Render second auth screen from Figma node 562:8041.
function AuthScreen ({ onAuthenticated }: { onAuthenticated: () => void }) {
	const { t } = useI18n()
	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [step, setStep] = useState<'email' | 'otp' | 'done'>('email')
	const [isBusy, setIsBusy] = useState(false)
	const [errorText, setErrorText] = useState('')
	const [infoText, setInfoText] = useState('')

	const isCodeValid = code.trim().length >= 4
	const canContinue = step === 'email' ? isEmailValid(email) && !isBusy : isCodeValid && !isBusy

	// Request OTP code for email login and registration flow.
	const requestOtp = async () => {
		setIsBusy(true)
		setErrorText('')

		try {
			await authPost<{ success: boolean }>('/v1/app/auth/email/send-otp', { email: email.trim() })
			setStep('otp')
			setInfoText(t('authCodeSent'))
		} catch (error) {
			setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsBusy(false)
		}
	}

	// Authenticate user via Google ID token and store token pair.
	const loginWithGoogle = async () => {
		if(!GOOGLE_CLIENT_ID) {
			setErrorText(t('authGoogleMissingClientId'))
			return
		}

		setIsBusy(true)
		setErrorText('')

		try {
			await loadGoogleScript()
			const idToken = await requestGoogleIdToken(GOOGLE_CLIENT_ID)
			const displayName = resolveGoogleDisplayName(idToken)
			const tokenPair = await authPost<AuthTokenResponse>('/v1/app/auth/google', {
				idToken,
				device: resolveDeviceInfo(),
			})

			window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenPair))
			if(displayName) setUserProfile({ displayName })
			setStep('done')
			setInfoText(t('authDone'))
			onAuthenticated()
		} catch (error) {
			setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsBusy(false)
		}
	}

	// Verify OTP and persist issued token pair in local storage.
	const verifyOtp = async () => {
		setIsBusy(true)
		setErrorText('')

		try {
			const tokenPair = await authPost<AuthTokenResponse>('/v1/app/auth/email/verify-otp', {
				email: email.trim(),
				code: code.trim(),
				device: resolveDeviceInfo(),
			})

			window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenPair))
			setStep('done')
			setInfoText(t('authDone'))
			onAuthenticated()
		} catch (error) {
			setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsBusy(false)
		}
	}

	// Dispatch primary action for current auth step.
	const onContinue = () => {
		if(step === 'email') {
			requestOtp()
			return
		}

		if(step === 'otp') verifyOtp()
	}
 
	return (
		<section aria-label="Auth" className="auth-screen">
			<header className="auth-header">
				<h1>{t('authTitle')}</h1>
				<p>{t('authSubtitle')}</p>
			</header>

			<div className="auth-form">
				<label htmlFor="email">{t('emailLabel')}</label>
				<input disabled={step !== 'email'} id="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('emailPlaceholder')} type="email" value={email} />

				{step === 'otp' ? (
					<>
						<label htmlFor="otp">{t('authCodeLabel')}</label>
						<input id="otp" inputMode="numeric" onChange={(event) => setCode(event.target.value)} placeholder={t('authCodePlaceholder')} type="text" value={code} />
					</>
				) : null}

				{infoText ? <p className="auth-note">{infoText}</p> : null}
				{errorText ? <p className="auth-note is-error">{errorText}</p> : null}

				{step === 'otp' ? (
					<button className="auth-link" onClick={requestOtp} type="button">{t('authResendCode')}</button>
				) : null}
			</div>

			<button className="auth-continue" disabled={!canContinue || step === 'done'} onClick={onContinue} type="button">{step === 'email' ? t('authSendCode') : step === 'otp' ? t('authVerifyCode') : t('authDone')}</button>

			<div className="auth-divider">
				<span />
				<em>{t('orLabel')}</em>
				<span />
			</div>

			<div className="auth-socials">
				<button className="auth-social" disabled={isBusy || step === 'done'} onClick={loginWithGoogle} type="button">
					<Image alt="Google" className="auth-icon-image" height={24} src="/assets/icon-google.svg" unoptimized width={24} />
					{t('googleContinue')}
				</button>
				<button className="auth-social" type="button">
					<Image alt="Apple" className="auth-icon-image" height={24} src="/assets/icon-apple.svg" unoptimized width={24} />
					{t('appleContinue')}
				</button>
			</div>
		</section>
	)
}

// Render post-auth home screen from Figma node 2009:7697.
function HomeScreen ({ onOpenDocuments, onOpenProfile, onOpenVisaStart }: { onOpenDocuments: () => void, onOpenProfile: () => void, onOpenVisaStart: () => void }) {
	const { t } = useI18n()
	const displayName = resolveUserProfile()?.displayName ?? t('homeDefaultName')

	return (
		<section aria-label="Home" className="home-screen">
			<div className="home-scroll">
				<div className="home-hero-wrap">
					<Image alt="Travel destination" className="home-hero-image" height={460} src="/assets/home-destination.svg" unoptimized width={402} />
				</div>

				<div className="home-copy">
					<h1>{`${t('homeGreeting')} ${displayName}!\n${t('homeQuestion')}`}</h1>
					<p>{t('homeSubtitle')}</p>
				</div>

				<button className="home-cta" onClick={onOpenVisaStart} type="button">{t('homeStartVisa')}</button>
			</div>

			<nav aria-label="Bottom navigation" className="home-tabbar">
				<button className="home-tab is-active" type="button">
					<Image alt="Home" className="home-tab-icon" height={24} src="/assets/icon-tab-home.svg" unoptimized width={24} />
				</button>
				<button className="home-tab" onClick={onOpenDocuments} type="button">
					<Image alt="Documents" className="home-tab-icon" height={24} src="/assets/icon-tab-documents.svg" unoptimized width={24} />
				</button>
				<button className="home-tab" onClick={onOpenProfile} type="button">
					<Image alt="Profile" className="home-tab-icon" height={24} src="/assets/icon-tab-profile.svg" unoptimized width={24} />
				</button>
			</nav>
		</section>
	)
}

// Render visa setup first step screen from Figma node 520:15433.
function VisaStartScreen ({ selectedDestination, onBack, onHome, onContinue, onSelectDestination }: { selectedDestination: VisaDestinationCode, onBack: () => void, onHome: () => void, onContinue: () => void, onSelectDestination: (destination: VisaDestinationCode) => void }) {
	const { t } = useI18n()
	const destinationOption = VISA_DESTINATION_OPTIONS.find((item) => item.code === selectedDestination) ?? VISA_DESTINATION_OPTIONS[0]

	return (
		<section aria-label="Visa setup" className="visa-screen">
			<div className="visa-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<div className="visa-progress" role="presentation">
						<span className="is-active" />
						<span />
						<span />
						<span />
						<span />
						<i />
					</div>

					<div className="visa-copy">
						<h1>{t('visaStartTitle')}</h1>
					</div>
				</header>

				<div className="visa-form">
					<div className="visa-field">
						<label>{t('visaCitizenship')}</label>
						<div className="profile-data-input with-right-icon">
							<span>{t('visaCitizenshipValue')}</span>
							<Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} />
						</div>
					</div>

					<div className="visa-field">
						<label>{t('visaResidence')}</label>
						<div className="profile-data-input with-right-icon">
							<span>{t('visaResidenceValue')}</span>
							<Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} />
						</div>
					</div>

					<div className="visa-field">
						<label>{t('visaDestination')}</label>
						<div className="profile-data-input with-right-icon">
							<span>{t(destinationOption.labelKey)}</span>
							<Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} />
						</div>
					</div>

					<div className="visa-popular">
						<label>{t('visaPopularDestinations')}</label>
						<div className="visa-chip-row">
							{VISA_DESTINATION_OPTIONS.map((item) => (
								<button className={`visa-chip${selectedDestination === item.code ? ' is-active' : ''}`} key={item.code} onClick={() => onSelectDestination(item.code)} type="button">
									<Image alt={t(item.labelKey)} className="visa-chip-flag" height={24} src={item.flagSrc} unoptimized width={24} />
									<span>{t(item.labelKey)}</span>
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="visa-bottom">
				<button className="passport-primary" onClick={onContinue} type="button">{t('authContinue')}</button>
			</div>
		</section>
	)
}

// Render visa type selection screen from Figma node 520:15444.
function VisaTypeScreen ({ selectedDestination, selectedType, isWarningOpen, onBack, onHome, onSelectType, onContinue, onCloseWarning, onConfirmWarning }: { selectedDestination: VisaDestinationCode, selectedType: VisaTypeCode, isWarningOpen: boolean, onBack: () => void, onHome: () => void, onSelectType: (type: VisaTypeCode) => void, onContinue: () => void, onCloseWarning: () => void, onConfirmWarning: () => void }) {
	const { locale, t } = useI18n()
	const typeLetter = selectedType === 'type-c' ? 'C' : 'D'
	const selectedDetail = VISA_TYPE_DETAILS[selectedDestination][selectedType]
	const warningText = VISA_WARNING_TEXT[locale]

	return (
		<section aria-label="Visa type" className="visa-screen">
			<div className="visa-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<div className="visa-progress" role="presentation">
						<span />
						<span className="is-active" />
						<span />
						<span />
						<span />
						<i />
					</div>

					<div className="visa-copy">
						<h1>{t('visaTypeTitle')}</h1>
					</div>
				</header>

				<div className="visa-form">
					<section className="visa-field">
						<label>{t('visaTypeCaption')}</label>
						<button className={`visa-type-card${selectedType === 'type-c' ? ' is-active' : ''}`} onClick={() => onSelectType('type-c')} type="button">
							<div className="visa-type-card-copy">
								<span className="visa-type-badge">{t('visaTypePopular')}</span>
								<h2>{resolveVisaTypeTitle(locale, selectedDestination, 'C')}</h2>
								<b>{t('visaLearnMore')}</b>
							</div>
							<i className="visa-type-radio" />
						</button>

						<button className={`visa-type-card${selectedType === 'type-d' ? ' is-active' : ''}`} onClick={() => onSelectType('type-d')} type="button">
							<div className="visa-type-card-copy">
								<h2>{resolveVisaTypeTitle(locale, selectedDestination, 'D')}</h2>
								<b>{t('visaLearnMore')}</b>
							</div>
							<i className="visa-type-radio" />
						</button>
					</section>
				</div>
			</div>

			<div className="visa-bottom">
				<button className="passport-primary" onClick={onContinue} type="button">{t('authContinue')}</button>
			</div>

			{isWarningOpen ? <div className="visa-warning-overlay" role="presentation">
				<section aria-label={resolveVisaTypeTitle(locale, selectedDestination, typeLetter)} className="visa-warning-sheet" role="dialog" aria-modal="true">
					<i className="visa-warning-grabber" />
					<div className="visa-warning-header">
						<h2>{resolveVisaTypeTitle(locale, selectedDestination, typeLetter)}</h2>
						<button aria-label={t('notificationsClose')} className="visa-warning-close" onClick={onCloseWarning} type="button" />
					</div>

					<p>{warningText.subtitle}</p>

					<div className="visa-warning-card">
						<div className="visa-type-card-copy">
							{selectedType === 'type-c' ? <span className="visa-type-badge">{t('visaTypePopular')}</span> : null}
							<h2>{resolveVisaTypeTitle(locale, selectedDestination, typeLetter)}</h2>
						</div>
						<i className="visa-type-radio" />
					</div>

					<ul className="visa-warning-list">
						<li>{warningText.duration} — {selectedDetail.durationDays} {locale === 'ru' ? 'дней' : 'days'}</li>
						<li>{warningText.entry[selectedDetail.entryKey]}</li>
						<li>{warningText.fee}: {selectedDetail.consularFee}</li>
					</ul>

					<button className="passport-primary visa-warning-confirm" onClick={onConfirmWarning} type="button">{warningText.confirm}</button>
				</section>
			</div> : null}
		</section>
	)
}

// Render passport upload entry screen from Figma node 520:15466.
function VisaPassportScreen ({ onBack, onHome, onAddPassport, onSelectSaved }: { onBack: () => void, onHome: () => void, onAddPassport: () => void, onSelectSaved: () => void }) {
	const { locale, t } = useI18n()
	const copy = VISA_PASSPORT_TEXT[locale]

	return (
		<section aria-label="Passport upload" className="visa-screen">
			<div className="visa-scroll visa-passport-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<div className="visa-progress is-half" role="presentation">
						<span />
						<span className="is-active" />
						<span />
						<span />
						<span />
						<i />
					</div>

					<div className="visa-copy">
						<h1>{copy.title}</h1>
						<p>{copy.subtitle}</p>
					</div>
				</header>

				<section className="visa-passport-rules">
					<h2>{copy.before}</h2>
					<ul>
						{copy.rules.map((item) => <li key={item}>{item}</li>)}
					</ul>
				</section>

				<div className="visa-passport-actions">
					<button className="passport-primary" onClick={onAddPassport} type="button">{copy.add}</button>
					<button className="visa-secondary-button" onClick={onSelectSaved} type="button">{copy.saved}</button>
				</div>
			</div>
		</section>
	)
}

// Render documents and insurance screen from Figma node 521:20268.
function DocumentsScreen ({ onOpenHome, onOpenProfile }: { onOpenHome: () => void, onOpenProfile: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Documents and insurances" className="documents-screen">
			<div className="documents-scroll">
				<section className="documents-top-copy" aria-label="Documents heading">
					<h1>{t('documentsTitle')}</h1>
					<p>{t('documentsSubtitle')}</p>
				</section>

				<section className="documents-empty" aria-label="No documents">
					<div className="documents-empty-picture">
						<Image alt="Documents and insurance" className="documents-empty-image" height={316} src="/assets/documents-empty-figure.svg" unoptimized width={370} />
					</div>

					<div className="documents-empty-copy">
						<h2>{t('documentsEmptyTitle')}</h2>
						<p>{t('documentsEmptySubtitle')}</p>
					</div>
				</section>
			</div>

			<nav aria-label="Bottom navigation" className="home-tabbar">
				<button className="home-tab" onClick={onOpenHome} type="button">
					<Image alt="Home" className="home-tab-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
				</button>
				<button className="home-tab is-active" type="button">
					<Image alt="Documents" className="home-tab-icon" height={24} src="/assets/icon-tab-documents.svg" unoptimized width={24} />
				</button>
				<button className="home-tab" onClick={onOpenProfile} type="button">
					<Image alt="Profile" className="home-tab-icon" height={24} src="/assets/icon-tab-profile.svg" unoptimized width={24} />
				</button>
			</nav>
		</section>
	)
}

// Render profile/settings screen from Figma node 562:10062.
function ProfileScreen ({ onOpenHome, onOpenDocuments, onOpenProfileData, onOpenDeveloper, onOpenPassports }: { onOpenHome: () => void, onOpenDocuments: () => void, onOpenProfileData: () => void, onOpenDeveloper: () => void, onOpenPassports: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Profile and settings" className="profile-screen">
			<div className="profile-scroll">
				<header className="profile-header">
					<h1>{t('profileTitle')}</h1>
					<p>{t('profileSubtitle')}</p>
				</header>

				<section className="profile-section" aria-label={t('profileSectionMain')}>
					<h2>{t('profileSectionMain')}</h2>
					<div className="profile-list">
						<button className="profile-row" onClick={onOpenProfileData} type="button">
							<span className="profile-row-left">
								<Image alt="Profile data" className="profile-row-icon" height={24} src="/assets/icon-settings-profile.svg" unoptimized width={24} />
								<b>{t('profileItemProfileData')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" onClick={onOpenPassports} type="button">
							<span className="profile-row-left">
								<Image alt="Passports" className="profile-row-icon" height={24} src="/assets/icon-settings-passport.svg" unoptimized width={24} />
								<b>{t('profileItemPassports')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Payments" className="profile-row-icon" height={24} src="/assets/icon-settings-payments.svg" unoptimized width={24} />
								<b>{t('profileItemPayments')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>
					</div>
				</section>

				<section className="profile-section" aria-label={t('profileSectionExtra')}>
					<h2>{t('profileSectionExtra')}</h2>
					<div className="profile-list">
						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Notifications" className="profile-row-icon" height={24} src="/assets/icon-settings-notifications.svg" unoptimized width={24} />
								<b>{t('profileItemNotifications')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Support" className="profile-row-icon" height={24} src="/assets/icon-settings-support.svg" unoptimized width={24} />
								<b>{t('profileItemHelp')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" onClick={onOpenDeveloper} type="button">
							<span className="profile-row-left">
								<Image alt="Developer mode" className="profile-row-icon" height={24} src="/assets/icon-settings-profile.svg" unoptimized width={24} />
								<b>{t('profileItemDeveloperMode')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>
					</div>
				</section>
			</div>

			<nav aria-label="Bottom navigation" className="home-tabbar">
				<button className="home-tab" onClick={onOpenHome} type="button">
					<Image alt="Home" className="home-tab-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
				</button>
				<button className="home-tab" onClick={onOpenDocuments} type="button">
					<Image alt="Documents" className="home-tab-icon" height={24} src="/assets/icon-tab-documents.svg" unoptimized width={24} />
				</button>
				<button className="home-tab is-active" type="button">
					<Image alt="Profile" className="home-tab-icon" height={24} src="/assets/icon-tab-profile-active.svg" unoptimized width={24} />
				</button>
			</nav>
		</section>
	)
}

// Render saved passports list screen from Figma node 521:20478.
function PassportsListScreen ({ passports, isLoading, errorText, onBack, onAdd, onEdit, onDelete }: { passports: PassportEntry[], isLoading: boolean, errorText: string, onBack: () => void, onAdd: () => void, onEdit: (id: string) => void, onDelete: (id: string) => void }) {
	const { t } = useI18n()
	const hasEntries = passports.length > 0

	return (
		<section aria-label="Saved passports" className="passports-screen">
			<div className="passports-scroll">
				<header className="passports-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					{hasEntries ? null : <p className="passports-toolbar-title">{t('passportSavedTitle')}</p>}
				</header>

				{isLoading ? <p className="dev-status passports-status">{t('devLoading')}</p> : null}
				{errorText ? <p className="dev-status is-error passports-status">{errorText}</p> : null}

				{!isLoading && !errorText && hasEntries ? (
					<div className="passports-stack">
						<h1>{t('passportSavedTitle')}</h1>
						{passports.map((passport) => (
							<article className="passport-card" key={passport.id}>
								<div className="passport-card-body">
									<h2>{passport.fullName}</h2>
									<p>{`${t('passportNumberLabel')}: ${passport.passportNumber}`}</p>
								</div>
								<div className="passport-card-actions">
									<button onClick={() => onEdit(passport.id)} type="button">{t('passportEdit')}</button>
									<button className="is-danger" onClick={() => onDelete(passport.id)} type="button">{t('passportDelete')}</button>
								</div>
							</article>
						))}

						<button className="passport-add-card" onClick={onAdd} type="button">
							<span>{t('passportAddHint')}</span>
							<p>{`${t('passportNumberLabel')}: 650000001\n${t('passportAddSubhint')}`}</p>
							<i>
								<Image alt="Plus" height={24} src="/assets/icon-plus.svg" unoptimized width={24} />
							</i>
						</button>
					</div>
				) : null}

				{!isLoading && !errorText && !hasEntries ? (
					<div className="passports-empty">
						<div className="passports-empty-picture">
							<Image alt="Save passport" className="passports-empty-image" height={316} src="/assets/passports-empty-figure.svg" unoptimized width={370} />
						</div>

						<div className="passports-empty-copy">
							<h2>{t('passportEmptyTitle')}</h2>
							<p>{t('passportEmptySubtitle')}</p>
						</div>

						<button className="passport-primary" onClick={onAdd} type="button">{t('passportAddButton')}</button>
					</div>
				) : null}
			</div>
		</section>
	)
}

// Render passport form first step from Figma node 521:20487.
function PassportStepOneScreen ({ draft, onBack, onNext, onChange }: { draft: PassportEntry, onBack: () => void, onNext: () => void, onChange: (field: keyof PassportEntry, value: string) => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Passport step one" className="passports-screen">
			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy">
					<h1>{t('passportFlowTitle')}</h1>
					<p>{t('passportFlowSubtitle')}</p>
				</div>

				<div className="passport-fields">
					<div className="passport-field-row">
						<label>{t('passportCitizenship')}</label>
						<div className="profile-data-input with-icon with-right-icon"><Image alt="Search" height={24} src="/assets/icon-search.svg" unoptimized width={24} /><input onChange={(event) => onChange('citizenship', event.target.value)} type="text" value={draft.citizenship} /><Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} /></div>
					</div>

					<div className="passport-field-row"><label>{t('profileDataFirstName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('firstName', event.target.value)} type="text" value={draft.firstName} /></div></div>
					<div className="passport-field-row"><label>{t('profileDataLastName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('lastName', event.target.value)} type="text" value={draft.lastName} /></div></div>
					<div className="passport-field-row"><label>{t('passportBirthDate')}</label><div className="profile-data-input with-right-icon"><input onChange={(event) => onChange('birthDate', event.target.value)} type="text" value={draft.birthDate} /><Image alt="Calendar" height={24} src="/assets/icon-calendar.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportGender')}</label><div className="profile-data-input with-right-icon"><select onChange={(event) => onChange('gender', event.target.value)} value={draft.gender}><option value="Мужской">Мужской</option><option value="Женский">Женский</option></select><Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} /></div></div>
				</div>

				<button className="passport-primary" onClick={onNext} type="button">{t('authContinue')}</button>
			</div>
		</section>
	)
}

// Render passport form second step from Figma node 521:20499.
function PassportStepTwoScreen ({ draft, onBack, onNext, onChange }: { draft: PassportEntry, onBack: () => void, onNext: () => void, onChange: (field: keyof PassportEntry, value: string) => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Passport step two" className="passports-screen">
			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy">
					<h1>{t('passportFlowTitle')}</h1>
					<p>{t('passportFlowSubtitle')}</p>
				</div>

				<div className="passport-fields">
					<div className="passport-field-row"><label>{t('passportNumber')}</label><div className="profile-data-input"><input onChange={(event) => onChange('passportNumber', event.target.value)} type="text" value={draft.passportNumber} /></div></div>
					<div className="passport-field-row"><label>{t('passportIssueDate')}</label><div className="profile-data-input with-right-icon"><input onChange={(event) => onChange('issueDate', event.target.value)} type="text" value={draft.issueDate} /><Image alt="Calendar" height={24} src="/assets/icon-calendar.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportExpiryDate')}</label><div className="profile-data-input with-right-icon"><input onChange={(event) => onChange('expiryDate', event.target.value)} type="text" value={draft.expiryDate} /><Image alt="Calendar" height={24} src="/assets/icon-calendar.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportIssuedBy')}</label><div className="profile-data-input"><input onChange={(event) => onChange('issuedBy', event.target.value)} type="text" value={draft.issuedBy} /></div></div>
				</div>

				<button className="passport-primary" onClick={onNext} type="button">{t('authContinue')}</button>
			</div>
		</section>
	)
}

// Render single-screen passport edit form with immediate save action.
function PassportEditScreen ({ draft, onBack, onChange, onSave }: { draft: PassportEntry, onBack: () => void, onChange: (field: keyof PassportEntry, value: string) => void, onSave: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Passport edit" className="passports-screen">
			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy">
					<h1>{t('passportEditTitle')}</h1>
					<p>{t('passportFlowSubtitle')}</p>
				</div>

				<div className="passport-fields">
					<div className="passport-field-row">
						<label>{t('passportCitizenship')}</label>
						<div className="profile-data-input with-icon with-right-icon"><Image alt="Search" height={24} src="/assets/icon-search.svg" unoptimized width={24} /><input onChange={(event) => onChange('citizenship', event.target.value)} type="text" value={draft.citizenship} /><Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} /></div>
					</div>

					<div className="passport-field-row"><label>{t('profileDataFirstName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('firstName', event.target.value)} type="text" value={draft.firstName} /></div></div>
					<div className="passport-field-row"><label>{t('profileDataLastName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('lastName', event.target.value)} type="text" value={draft.lastName} /></div></div>
					<div className="passport-field-row"><label>{t('passportBirthDate')}</label><div className="profile-data-input with-right-icon"><input onChange={(event) => onChange('birthDate', event.target.value)} type="text" value={draft.birthDate} /><Image alt="Calendar" height={24} src="/assets/icon-calendar.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportGender')}</label><div className="profile-data-input with-right-icon"><select onChange={(event) => onChange('gender', event.target.value)} value={draft.gender}><option value="Мужской">Мужской</option><option value="Женский">Женский</option></select><Image alt="Chevron down" height={24} src="/assets/icon-chevron-down.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportNumber')}</label><div className="profile-data-input"><input onChange={(event) => onChange('passportNumber', event.target.value)} type="text" value={draft.passportNumber} /></div></div>
					<div className="passport-field-row"><label>{t('passportIssueDate')}</label><div className="profile-data-input with-right-icon"><input onChange={(event) => onChange('issueDate', event.target.value)} type="text" value={draft.issueDate} /><Image alt="Calendar" height={24} src="/assets/icon-calendar.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportExpiryDate')}</label><div className="profile-data-input with-right-icon"><input onChange={(event) => onChange('expiryDate', event.target.value)} type="text" value={draft.expiryDate} /><Image alt="Calendar" height={24} src="/assets/icon-calendar.svg" unoptimized width={24} /></div></div>
					<div className="passport-field-row"><label>{t('passportIssuedBy')}</label><div className="profile-data-input"><input onChange={(event) => onChange('issuedBy', event.target.value)} type="text" value={draft.issuedBy} /></div></div>
				</div>

				<button className="passport-primary" onClick={onSave} type="button">{t('passportSaveButton')}</button>
			</div>
		</section>
	)
}

// Render passport review screen from Figma node 521:20510.
function PassportReviewScreen ({ draft, actionLabel, onBack, onSave }: { draft: PassportEntry, actionLabel: string, onBack: () => void, onSave: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Passport review" className="passports-screen">
			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy is-review">
					<h1>{t('passportReviewTitle')}</h1>
					<p>{t('passportReviewSubtitle')}</p>
				</div>

				<div className="passport-fields is-review">
					<div className="passport-field-row"><label>{t('passportCitizenship')}</label><div className="profile-data-input">{draft.citizenship}</div></div>
					<div className="passport-field-row"><label>{t('profileDataFirstName')}</label><div className="profile-data-input">{draft.firstName}</div></div>
					<div className="passport-field-row"><label>{t('profileDataLastName')}</label><div className="profile-data-input">{draft.lastName}</div></div>
					<div className="passport-field-row"><label>{t('passportBirthDate')}</label><div className="profile-data-input">{draft.birthDate}</div></div>
					<div className="passport-field-row"><label>{t('passportGender')}</label><div className="profile-data-input">{draft.gender}</div></div>
					<div className="passport-field-row"><label>{t('passportNumber')}</label><div className="profile-data-input">{draft.passportNumber}</div></div>
					<div className="passport-field-row"><label>{t('passportIssueDate')}</label><div className="profile-data-input">{draft.issueDate}</div></div>
					<div className="passport-field-row"><label>{t('passportExpiryDate')}</label><div className="profile-data-input">{draft.expiryDate}</div></div>
					<div className="passport-field-row"><label>{t('passportIssuedBy')}</label><div className="profile-data-input">{draft.issuedBy}</div></div>
				</div>

				<div className="passport-review-bottom">
					<button className="passport-primary" onClick={onSave} type="button">{actionLabel}</button>
				</div>
			</div>
		</section>
	)
}

// Render developer diagnostics with server/account metadata.
function DeveloperModeScreen ({ onBack }: { onBack: () => void }) {
	const { t } = useI18n()
	const [isLoading, setIsLoading] = useState(true)
	const [errorText, setErrorText] = useState('')
	const [sessionsData, setSessionsData] = useState<unknown>(null)
	const [dashboardData, setDashboardData] = useState<unknown>(null)
	const auth = resolveAuthPayload()

	useEffect(() => {
		let active = true

		const load = async () => {
			setIsLoading(true)
			setErrorText('')

			try {
				const [sessions, dashboard] = await Promise.all([
					authGet<unknown>('/v1/app/auth/sessions'),
					authGet<unknown>('/v1/app/dashboard'),
				])

				if(!active) return
				setSessionsData(sessions)
				setDashboardData(dashboard)
			} catch (error) {
				if(!active) return
				setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
			} finally {
				if(active) setIsLoading(false)
			}
		}

		load()
		return () => {
			active = false
		}
	}, [t])

	return (
		<section aria-label="Developer mode" className="dev-screen">
			<header className="dev-toolbar">
				<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
					<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
				</button>
				<h2>{t('profileItemDeveloperMode')}</h2>
			</header>

			<div className="dev-content">
				<div className="dev-card">
					<b>{t('devAccountId')}</b>
					<p>{auth?.user?.userId ?? 'n/a'}</p>
				</div>

				<div className="dev-card">
					<b>{t('emailLabel')}</b>
					<p>{auth?.user?.email ?? 'n/a'}</p>
				</div>

				<div className="dev-card">
					<b>{t('devAccountRole')}</b>
					<p>{auth?.user?.role ?? 'n/a'}</p>
				</div>

				<div className="dev-card">
					<b>{t('devLinkedProviders')}</b>
					<p>{auth?.user?.linkedProviders?.join(', ') || 'n/a'}</p>
				</div>

				{isLoading ? <p className="dev-status">{t('devLoading')}</p> : null}
				{errorText ? <p className="dev-status is-error">{errorText}</p> : null}

				{sessionsData ? (
					<div className="dev-json-block">
						<b>{t('devSessions')}</b>
						<pre>{JSON.stringify(sessionsData, null, 2)}</pre>
					</div>
				) : null}

				{dashboardData ? (
					<div className="dev-json-block">
						<b>{t('devDashboard')}</b>
						<pre>{JSON.stringify(dashboardData, null, 2)}</pre>
					</div>
				) : null}
			</div>
		</section>
	)
}

// Render profile data screen from Figma node 521:20347.
function ProfileDataScreen ({ onBack, onAccountDeleted }: { onBack: () => void, onAccountDeleted: () => void }) {
	const { t, locale, setLocale } = useI18n()
	const auth = resolveAuthPayload()
	const email = auth?.user?.email ?? 'alex.german@gmail.com'
	const fullName = resolveUserProfile()?.displayName ?? t('homeDefaultName')
	const nameParts = fullName.split(' ')
	const firstName = nameParts[0] ?? 'Aleks'
	const lastName = nameParts[1] ?? 'German'
	const [isLocaleOpen, setIsLocaleOpen] = useState(false)
	const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false)
	const [isDeleteBusy, setIsDeleteBusy] = useState(false)
	const [deleteError, setDeleteError] = useState('')
	const localeRootRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if(!isLocaleOpen) return

		const onPointerDown = (event: PointerEvent) => {
			if(!localeRootRef.current) return
			if(localeRootRef.current.contains(event.target as Node)) return
			setIsLocaleOpen(false)
		}

		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [isLocaleOpen])

	// Delete account via API and reset local auth session.
	const deleteAccount = async () => {
		setIsDeleteBusy(true)
		setDeleteError('')

		try {
			await authDelete('/v1/app/auth/account')
			clearPersistedSession()
			onAccountDeleted()
		} catch (error) {
			setDeleteError(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsDeleteBusy(false)
		}
	}

	return (
		<section aria-label="Profile data" className="profile-data-screen">
			<div className="profile-data-scroll">
				<header className="profile-data-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<div className="profile-data-language" ref={localeRootRef}>
						<button aria-expanded={isLocaleOpen} aria-label={t('profileDataLanguage')} className="profile-data-icon-button" onClick={() => setIsLocaleOpen(!isLocaleOpen)} type="button">
							<Image alt="Language" className="profile-data-toolbar-icon" height={24} src="/assets/icon-language.svg" unoptimized width={24} />
						</button>

						{isLocaleOpen ? (
							<ul className="locale-menu" role="listbox">
								{SUPPORTED_LOCALES.map((item) => (
									<li key={item.code}>
										<button className={item.code === locale ? 'locale-option is-active' : 'locale-option'} onClick={() => {
											setLocale(item.code)
											setIsLocaleOpen(false)
										}} type="button">
											<span>{item.nativeName}</span>
										</button>
									</li>
								))}
							</ul>
						) : null}
					</div>
				</header>

				<section className="profile-data-block" aria-label={t('profileItemProfileData')}>
					<h2>{t('profileItemProfileData')}</h2>

					<div className="profile-data-field">
						<label>{t('profileDataFirstName')}</label>
						<div className="profile-data-input">{firstName}</div>
					</div>

					<div className="profile-data-field">
						<label>{t('profileDataLastName')}</label>
						<div className="profile-data-input">{lastName}</div>
					</div>

					<div className="profile-data-field">
						<label>{t('emailLabel')}</label>
						<div className="profile-data-input">{email}</div>
					</div>
				</section>

				<section className="profile-section" aria-label={t('profileSectionExtra')}>
					<h2>{t('profileSectionExtra')}</h2>
					<div className="profile-list">
						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Biometrics" className="profile-row-icon" height={24} src="/assets/icon-profile-biometrics.svg" unoptimized width={24} />
								<b>{t('profileItemBiometrics')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Password" className="profile-row-icon" height={24} src="/assets/icon-profile-password.svg" unoptimized width={24} />
								<b>{t('profileItemChangePassword')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row is-danger" onClick={() => setIsDeleteDrawerOpen(true)} type="button">
							<span className="profile-row-left">
								<Image alt="Delete account" className="profile-row-icon" height={24} src="/assets/icon-profile-trash.svg" unoptimized width={24} />
								<b>{t('profileItemDeleteAccount')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>
					</div>
				</section>
			</div>

			{isDeleteDrawerOpen ? (
				<div className="profile-drawer-backdrop">
					<div className="profile-drawer-sheet" role="dialog" aria-modal="true" aria-label={t('profileDeleteTitle')}>
						<header className="profile-drawer-header">
							<h3>{t('profileDeleteTitle')}</h3>
							<button className="profile-drawer-close" onClick={() => setIsDeleteDrawerOpen(false)} type="button">
								<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
									<path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
								</svg>
							</button>
						</header>

						<p className="profile-drawer-subtitle">{t('profileDeleteSubtitle')}</p>
						{deleteError ? <p className="profile-drawer-error">{deleteError}</p> : null}

						<div className="profile-drawer-actions">
							<button className="profile-drawer-delete" disabled={isDeleteBusy} onClick={deleteAccount} type="button">{t('profileDeleteConfirm')}</button>
							<button className="profile-drawer-cancel" disabled={isDeleteBusy} onClick={() => setIsDeleteDrawerOpen(false)} type="button">{t('profileDeleteCancel')}</button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	)
}

// Resolve initial entry step from persisted auth state.
function resolveInitialEntryStep (): EntryStep {
	if(hasPersistedAuthSession()) return 'home'
	return 'onboarding'
}

// Convert current app view into URL hash route.
function buildEntryRoute (step: EntryStep, tab: HomeTab) {
	if(step === 'home') return `#/home/${tab}`
	return `#/${step}`
}

// Parse URL hash route back into app view state.
function parseEntryRoute (fallbackStep: EntryStep, fallbackTab: HomeTab) {
	if(typeof window === 'undefined') return { step: fallbackStep, tab: fallbackTab }
	const hash = window.location.hash.replace(/^#\/?/, '')
	if(!hash) return { step: fallbackStep, tab: fallbackTab }
	const parts = hash.split('/').filter(Boolean)
	if(parts[0] === 'onboarding') return { step: 'onboarding' as EntryStep, tab: 'home' as HomeTab }
	if(parts[0] === 'auth') return { step: 'auth' as EntryStep, tab: 'home' as HomeTab }
	if(parts[0] !== 'home') return { step: fallbackStep, tab: fallbackTab }
	const tab = parts[1] as HomeTab | undefined
	if(!tab) return { step: 'home' as EntryStep, tab: 'home' as HomeTab }
	const tabs: HomeTab[] = ['home', 'documents', 'visa-start', 'visa-type', 'visa-passport', 'profile', 'profile-data', 'developer-mode', 'passports-list', 'passports-step-one', 'passports-step-two', 'passports-review', 'passports-edit']
	if(!tabs.includes(tab)) return { step: 'home' as EntryStep, tab: 'home' as HomeTab }
	return { step: 'home' as EntryStep, tab }
}

// Render onboarding-to-auth-to-home flow after splash.
function EntryFlow () {
	const { t } = useI18n()
	const [{ step, tab: activeTab }, setNavigation] = useState(() => {
		const fallbackStep = resolveInitialEntryStep()
		const initial = parseEntryRoute(fallbackStep, 'home')
		if(fallbackStep !== 'home' && initial.step === 'home') return { step: fallbackStep, tab: 'home' as HomeTab }
		return initial
	})
	const [passportFlowMode, setPassportFlowMode] = useState<'create' | 'edit'>('create')
	const [passportDraft, setPassportDraft] = useState<PassportEntry>(createPassportDraft)
	const [passports, setPassports] = useState<PassportEntry[]>([])
	const [isPassportsLoading, setIsPassportsLoading] = useState(false)
	const [passportsError, setPassportsError] = useState('')
	const [selectedVisaDestination, setSelectedVisaDestination] = useState<VisaDestinationCode>('italy')
	const [selectedVisaType, setSelectedVisaType] = useState<VisaTypeCode>('type-c')
	const [isVisaWarningOpen, setIsVisaWarningOpen] = useState(false)
	const isPopNavigationRef = useRef(false)

	// Move app to target view and sync browser history state.
	const navigate = (nextStep: EntryStep, nextTab: HomeTab, mode: 'push' | 'replace' = 'push') => {
		setNavigation((current) => {
			if(current.step === nextStep && current.tab === nextTab) return current
			return { step: nextStep, tab: nextTab }
		})

		const route = buildEntryRoute(nextStep, nextTab)
		if(typeof window === 'undefined') return
		if(window.location.hash === route) return
		if(mode === 'replace') {
			window.history.replaceState({ step: nextStep, tab: nextTab }, '', route)
			return
		}
		window.history.pushState({ step: nextStep, tab: nextTab }, '', route)
	}

	useEffect(() => {
		if(typeof window === 'undefined') return

		if(!window.location.hash) {
			const fallbackStep = resolveInitialEntryStep()
			const initial = parseEntryRoute(fallbackStep, 'home')
			window.history.replaceState({ step: initial.step, tab: initial.tab }, '', buildEntryRoute(initial.step, initial.tab))
		}

		const onPopstate = () => {
			isPopNavigationRef.current = true
			const fallbackStep = resolveInitialEntryStep()
			const next = parseEntryRoute(fallbackStep, 'home')
			setNavigation(next)
			window.setTimeout(() => {
				isPopNavigationRef.current = false
			}, 0)
		}

		window.addEventListener('popstate', onPopstate)
		return () => window.removeEventListener('popstate', onPopstate)
	}, [])

	useEffect(() => {
		if(isPopNavigationRef.current || typeof window === 'undefined') return
		const route = buildEntryRoute(step, activeTab)
		if(window.location.hash !== route) window.history.replaceState({ step, tab: activeTab }, '', route)
	}, [step, activeTab])

	// Open home screen immediately after successful auth.
	const onAuthenticated = () => {
		navigate('home', 'home')
	}

	// Load saved passports list from backend API.
	const loadPassports = async () => {
		setIsPassportsLoading(true)
		setPassportsError('')

		try {
			const list = await authGet<PassportDto[]>('/v1/app/passports')
			setPassports((list ?? []).map((item) => mapPassportDto(item)))
		} catch (error) {
			setPassportsError(error instanceof Error ? error.message : 'Failed to load passports')
		} finally {
			setIsPassportsLoading(false)
		}
	}

	// Open passport add flow from saved passports list.
	const openPassportAdd = () => {
		setPassportFlowMode('create')
		setPassportDraft(createPassportDraft())
		navigate('home', 'passports-step-one')
	}

	// Open passports list and request latest backend records.
	const openPassportsList = () => {
		navigate('home', 'passports-list')
	}

	// Select visa type card without leaving the current step.
	const selectVisaType = (type: VisaTypeCode) => {
		setSelectedVisaType(type)
	}

	useEffect(() => {
		if(step !== 'home' || activeTab !== 'passports-list') return
		loadPassports()
	}, [step, activeTab])

	// Update passport draft field and recompute derived full name.
	const updatePassportDraftField = (field: keyof PassportEntry, value: string) => {
		setPassportDraft((current) => {
			const next = { ...current, [field]: value }
			if(field === 'firstName' || field === 'lastName') next.fullName = `${next.firstName} ${next.lastName}`.trim().toUpperCase()
			return next
		})
	}

	// Open single-screen passport edit form from existing passport card action.
	const openPassportEdit = (id: string) => {
		const found = passports.find((item) => item.id === id)
		if(!found) return
		setPassportFlowMode('edit')
		setPassportDraft(found)
		navigate('home', 'passports-edit')
	}

	// Remove passport from saved passports list.
	const removePassport = async (id: string) => {
		setPassportsError('')

		try {
			await authDeletePath(`/v1/app/passports/${id}`)
			await loadPassports()
		} catch (error) {
			setPassportsError(error instanceof Error ? error.message : 'Failed to delete passport')
		}
	}

	// Save current passport draft into list and return to overview.
	const savePassportDraft = async () => {
		setPassportsError('')

		try {
			await authPostAuthorized('/v1/app/passports', mapPassportDraftToPayload(passportDraft))
			if(passportFlowMode === 'edit' && !passportDraft.id.startsWith('draft-')) await authDeletePath(`/v1/app/passports/${passportDraft.id}`)
			await loadPassports()
			navigate('home', 'passports-list')
		} catch (error) {
			setPassportsError(error instanceof Error ? error.message : 'Failed to save passport')
		}
	}

	return (
		<>
			{step === 'home' ? null : <LocaleSwitcher />}
			{step === 'onboarding'
				? <OnboardingScreen onContinue={() => navigate('auth', 'home')} />
				: step === 'auth'
					? <AuthScreen onAuthenticated={onAuthenticated} />
					: activeTab === 'home'
						? <HomeScreen onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onOpenVisaStart={() => navigate('home', 'visa-start')} />
						: activeTab === 'documents'
							? <DocumentsScreen onOpenHome={() => navigate('home', 'home')} onOpenProfile={() => navigate('home', 'profile')} />
							: activeTab === 'visa-start'
								? <VisaStartScreen selectedDestination={selectedVisaDestination} onBack={() => navigate('home', 'home')} onContinue={() => navigate('home', 'visa-type')} onHome={() => navigate('home', 'home')} onSelectDestination={setSelectedVisaDestination} />
							: activeTab === 'visa-type'
								? <VisaTypeScreen isWarningOpen={isVisaWarningOpen} selectedDestination={selectedVisaDestination} selectedType={selectedVisaType} onBack={() => navigate('home', 'visa-start')} onCloseWarning={() => setIsVisaWarningOpen(false)} onConfirmWarning={() => {
									setIsVisaWarningOpen(false)
									navigate('home', 'visa-passport')
								}} onContinue={() => setIsVisaWarningOpen(true)} onHome={() => navigate('home', 'home')} onSelectType={selectVisaType} />
							: activeTab === 'visa-passport'
								? <VisaPassportScreen onAddPassport={openPassportAdd} onBack={() => navigate('home', 'visa-type')} onHome={() => navigate('home', 'home')} onSelectSaved={openPassportsList} />
							: activeTab === 'profile'
								? <ProfileScreen onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfileData={() => navigate('home', 'profile-data')} onOpenDeveloper={() => navigate('home', 'developer-mode')} onOpenPassports={openPassportsList} />
							: activeTab === 'profile-data'
								? <ProfileDataScreen onBack={() => navigate('home', 'profile')} onAccountDeleted={() => {
									navigate('onboarding', 'home')
								}} />
								: activeTab === 'developer-mode'
									? <DeveloperModeScreen onBack={() => navigate('home', 'profile')} />
									: activeTab === 'passports-list'
										? <PassportsListScreen passports={passports} isLoading={isPassportsLoading} errorText={passportsError} onBack={() => navigate('home', 'profile')} onAdd={openPassportAdd} onEdit={openPassportEdit} onDelete={removePassport} />
										: activeTab === 'passports-step-one'
											? <PassportStepOneScreen draft={passportDraft} onBack={() => navigate('home', 'passports-list')} onChange={updatePassportDraftField} onNext={() => navigate('home', 'passports-step-two')} />
										: activeTab === 'passports-step-two'
											? <PassportStepTwoScreen draft={passportDraft} onBack={() => navigate('home', 'passports-step-one')} onChange={updatePassportDraftField} onNext={() => navigate('home', 'passports-review')} />
											: activeTab === 'passports-review'
												? <PassportReviewScreen actionLabel={passportFlowMode === 'edit' ? t('passportEdit') : t('passportAddButton')} draft={passportDraft} onBack={() => navigate('home', 'passports-step-two')} onSave={savePassportDraft} />
												: <PassportEditScreen draft={passportDraft} onBack={() => navigate('home', 'passports-list')} onChange={updatePassportDraftField} onSave={savePassportDraft} />}
		</>
	)
}

// Render localized splash and second screen transition.
function AppEntryContent () {
	const isReady = useSplashReady()

	return (
		<main className="web-root">
			<section aria-label="App content" className="app-content">
				{isReady ? (
					<EntryFlow />
				) : (
					<div className="splash-canvas">
						<Image alt="Travel illustration" className="splash-hero-image" height={394} priority src={HERO_IMAGE} unoptimized width={458} />
						<div className="splash-loading">Loading...</div>
					</div>
				)}
			</section>
		</main>
	)
}

// Render root entry screen with i18n context.
export default function LanguageSelectionScreen () {
	return (
		<I18nProvider>
			<AppEntryContent />
		</I18nProvider>
	)
}
