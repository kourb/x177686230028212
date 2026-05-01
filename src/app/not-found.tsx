import Link from 'next/link'

// Render static 404 page required by Next export.
export default function NotFoundPage () {
	return (
		<main className="not-found-screen">
			<h1>{'Страница не найдена'}</h1>
			<p>{'Вернитесь на главную страницу и продолжите оформление визы.'}</p>
			<Link href="/">{'На главную'}</Link>
		</main>
	)
}
