'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { I18nProvider, useI18n } from '@/i18n/provider'

const HERO_IMAGE = '/assets/hero-travel.svg'
const DEVICE_ID_STORAGE_KEY = 'visa-assistent-device-id'
const AUTH_STORAGE_KEY = 'visa-assistent-auth'
const AUTH_REMOTE_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL ?? 'https://133892.ip-ns.net'
const AUTH_PROXY_BASE_URL = process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL ?? 'http://localhost:8787'
const AUTH_USE_PROXY = process.env.NEXT_PUBLIC_AUTH_USE_PROXY === '1' || (process.env.NEXT_PUBLIC_AUTH_USE_PROXY !== '0' && process.env.NODE_ENV === 'development')

type AuthPath = '/v1/app/auth/email/send-otp' | '/v1/app/auth/email/verify-otp'

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
	isNewUser: boolean
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

// Resolve request URL for auth endpoint in proxy or direct mode.
function resolveAuthUrl (path: AuthPath) {
	if(AUTH_USE_PROXY) return `${AUTH_PROXY_BASE_URL}${path}`

	return `${AUTH_REMOTE_BASE_URL}${path}`
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

	if(!response.ok || !body.data && path === '/v1/app/auth/email/verify-otp') {
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
function AuthScreen () {
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
				<button className="auth-social" type="button">
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

// Render onboarding-to-auth flow after splash.
function EntryFlow () {
	const [step, setStep] = useState<'onboarding' | 'auth'>('onboarding')

	return (
		step === 'onboarding'
			? <OnboardingScreen onContinue={() => setStep('auth')} />
			: <AuthScreen />
	)
}

// Render localized splash and second screen transition.
function AppEntryContent () {
	const isReady = useSplashReady()

	return (
		<main className="web-root">
			<section aria-label="App content" className="app-content">
				{isReady ? <LocaleSwitcher /> : null}

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
