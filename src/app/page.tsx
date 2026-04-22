import Image from 'next/image'

const SPLASH_IMAGE = '/assets/splash-screen.svg'

// Render first Figma screen as responsive hero frame.
export default function HomePage () {
	return (
		<main className="screen-root">
			<section aria-label="Splash screen" className="phone-frame">
				<Image alt="Shengen App splash" className="phone-image" height={852} priority src={SPLASH_IMAGE} unoptimized width={393} />
			</section>
		</main>
	)
}
