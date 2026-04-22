'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { I18nProvider, useI18n } from '@/i18n/provider'

const HERO_IMAGE = '/assets/hero-travel.svg'
const DEVICE_ID_STORAGE_KEY = 'visa-assistent-device-id'
const AUTH_STORAGE_KEY = 'visa-assistent-auth'
const USER_PROFILE_STORAGE_KEY = 'visa-assistent-user-profile'
const AUTH_REMOTE_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL ?? 'https://133892.ip-ns.net'
const AUTH_PROXY_BASE_URL = process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL ?? 'http://localhost:8787'
const AUTH_USE_PROXY = process.env.NEXT_PUBLIC_AUTH_USE_PROXY === '1' || (process.env.NEXT_PUBLIC_AUTH_USE_PROXY !== '0' && process.env.NODE_ENV === 'development')
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '383303576206-8svtv0iglo3sil07mlflaoulv67b9esr.apps.googleusercontent.com'

type AuthPath = '/v1/app/auth/email/send-otp' | '/v1/app/auth/email/verify-otp' | '/v1/app/auth/google'

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
		email?: string
	}
	isNewUser: boolean
}

type UserProfile = {
	displayName: string
}

let googleScriptPromise: Promise<void> | null = null

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
		return Boolean(parsed.accessToken && parsed.refreshToken)
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

// Resolve request URL for auth endpoint in proxy or direct mode.
function resolveAuthUrl (path: AuthPath) {
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
function HomeScreen ({ onOpenProfile }: { onOpenProfile: () => void }) {
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

				<button className="home-cta" type="button">{t('homeStartVisa')}</button>
			</div>

			<nav aria-label="Bottom navigation" className="home-tabbar">
				<button className="home-tab is-active" type="button">
					<Image alt="Home" className="home-tab-icon" height={24} src="/assets/icon-tab-home.svg" unoptimized width={24} />
				</button>
				<button className="home-tab" type="button">
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
function ProfileScreen ({ onOpenHome, onOpenProfileData }: { onOpenHome: () => void, onOpenProfileData: () => void }) {
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

						<button className="profile-row" type="button">
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
					</div>
				</section>
			</div>

			<nav aria-label="Bottom navigation" className="home-tabbar">
				<button className="home-tab" onClick={onOpenHome} type="button">
					<Image alt="Home" className="home-tab-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
				</button>
				<button className="home-tab" type="button">
					<Image alt="Documents" className="home-tab-icon" height={24} src="/assets/icon-tab-documents.svg" unoptimized width={24} />
				</button>
				<button className="home-tab is-active" type="button">
					<Image alt="Profile" className="home-tab-icon" height={24} src="/assets/icon-tab-profile-active.svg" unoptimized width={24} />
				</button>
			</nav>
		</section>
	)
}

// Render profile data screen from Figma node 521:20347.
function ProfileDataScreen ({ onBack }: { onBack: () => void }) {
	const { t } = useI18n()
	const auth = resolveAuthPayload()
	const email = auth?.user?.email ?? 'alex.german@gmail.com'
	const fullName = resolveUserProfile()?.displayName ?? t('homeDefaultName')
	const nameParts = fullName.split(' ')
	const firstName = nameParts[0] ?? 'Aleks'
	const lastName = nameParts[1] ?? 'German'

	return (
		<section aria-label="Profile data" className="profile-data-screen">
			<div className="profile-data-scroll">
				<header className="profile-data-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label={t('profileDataLanguage')} className="profile-data-icon-button" type="button">
						<Image alt="Language" className="profile-data-toolbar-icon" height={24} src="/assets/icon-language.svg" unoptimized width={24} />
					</button>
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

						<button className="profile-row is-danger" type="button">
							<span className="profile-row-left">
								<Image alt="Delete account" className="profile-row-icon" height={24} src="/assets/icon-profile-trash.svg" unoptimized width={24} />
								<b>{t('profileItemDeleteAccount')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>
					</div>
				</section>
			</div>
		</section>
	)
}

// Resolve initial entry step from persisted auth state.
function resolveInitialEntryStep () {
	if(hasPersistedAuthSession()) return 'home'
	return 'onboarding'
}

// Render onboarding-to-auth-to-home flow after splash.
function EntryFlow () {
	const [step, setStep] = useState<'onboarding' | 'auth' | 'home'>(resolveInitialEntryStep)
	const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'profile-data'>('home')

	// Open home screen immediately after successful auth.
	const onAuthenticated = () => {
		setStep('home')
		setActiveTab('home')
	}

	return (
		<>
			{step === 'home' ? null : <LocaleSwitcher />}
			{step === 'onboarding'
				? <OnboardingScreen onContinue={() => setStep('auth')} />
				: step === 'auth'
					? <AuthScreen onAuthenticated={onAuthenticated} />
					: activeTab === 'home'
						? <HomeScreen onOpenProfile={() => setActiveTab('profile')} />
						: activeTab === 'profile'
							? <ProfileScreen onOpenHome={() => setActiveTab('home')} onOpenProfileData={() => setActiveTab('profile-data')} />
							: <ProfileDataScreen onBack={() => setActiveTab('profile')} />}
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
