import type { Metadata } from 'next'
import './server-local-storage-polyfill'
import './globals.css'

export const metadata: Metadata = {
	title: 'Visa Assistent',
	description: 'Web client for visa flow',
}

// Render base app shell and metadata wrapper.
export default function RootLayout ({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="ru">
			<body>{children}</body>
		</html>
	)
}
