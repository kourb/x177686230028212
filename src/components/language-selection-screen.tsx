'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { I18nProvider, useI18n } from '@/i18n/provider'

const HERO_IMAGE = '/assets/hero-travel.svg'

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
			<button className="locale-trigger" onClick={() => setIsOpen(!isOpen)} type="button">
				<span>{selected.nativeName}</span>
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
 
	return (
		<section aria-label="Auth" className="auth-screen">
			<header className="auth-header">
				<h1>{t('authTitle')}</h1>
				<p>{t('authSubtitle')}</p>
			</header>

			<div className="auth-form">
				<label htmlFor="email">{t('emailLabel')}</label>
				<input id="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('emailPlaceholder')} type="email" value={email} />
			</div>

			<button className="auth-continue" disabled={!isEmailValid(email)} type="button">{t('authContinue')}</button>

			<div className="auth-divider">
				<span />
				<em>{t('orLabel')}</em>
				<span />
			</div>

			<div className="auth-socials">
				<button className="auth-social" type="button">
					<b className="auth-icon google">G</b>
					{t('googleContinue')}
				</button>
				<button className="auth-social" type="button">
					<b className="auth-icon apple">A</b>
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
	const { t } = useI18n()

	return (
		<main className="web-root">
			<section aria-label="App content" className="app-content">
				{isReady ? <LocaleSwitcher /> : null}

				{isReady ? (
					<EntryFlow />
				) : (
					<div className="splash-canvas">
						<Image alt="Travel illustration" className="splash-hero-image" height={394} priority src={HERO_IMAGE} unoptimized width={458} />
						<div className="splash-loading">{t('loadingLabel')}</div>
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
