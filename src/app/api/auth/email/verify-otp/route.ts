const AUTH_API_BASE_URL = process.env.AUTH_API_BASE_URL ?? 'https://133892.ip-ns.net'

// Proxy email OTP verification request to backend origin to avoid browser CORS.
export async function POST (request: Request) {
	const response = await fetch(`${AUTH_API_BASE_URL}/v1/app/auth/email/verify-otp`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: await request.text(),
		cache: 'no-store',
	})

	return new Response(await response.text(), {
		status: response.status,
		headers: {
			'Content-Type': 'application/json',
		},
	})
}
