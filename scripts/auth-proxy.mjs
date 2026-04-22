import { createServer } from 'node:http'

const UPSTREAM = process.env.AUTH_API_BASE_URL ?? 'https://133892.ip-ns.net'
const PORT = Number(process.env.AUTH_PROXY_PORT ?? 8787)
const ALLOW_ORIGIN = process.env.AUTH_PROXY_ALLOW_ORIGIN ?? 'http://localhost:3000'
const ROUTES = new Set(['/v1/app/auth/email/send-otp', '/v1/app/auth/email/verify-otp'])

// Apply CORS headers for local browser access.
function setCors (response) {
	response.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN)
	response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
	response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// Read raw request body into utf-8 string.
function readBody (request) {
	return new Promise((resolve, reject) => {
		const chunks = []
		request.on('data', (chunk) => chunks.push(chunk))
		request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
		request.on('error', reject)
	})
}

// Proxy allowed auth request to upstream API.
async function handleProxy (request, response) {
	const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname
	if(!ROUTES.has(path)) {
		setCors(response)
		response.writeHead(404, { 'Content-Type': 'application/json' })
		response.end(JSON.stringify({ error: { message: 'Proxy route not found' }, data: null }))
		return
	}

	const upstreamResponse = await fetch(`${UPSTREAM}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: await readBody(request),
	})
	const text = await upstreamResponse.text()

	setCors(response)
	response.writeHead(upstreamResponse.status, { 'Content-Type': 'application/json' })
	response.end(text)
}

// Start local auth proxy server.
createServer(async (request, response) => {
	if(request.method === 'OPTIONS') {
		setCors(response)
		response.writeHead(204)
		response.end()
		return
	}

	if(request.method !== 'POST') {
		setCors(response)
		response.writeHead(405, { 'Content-Type': 'application/json' })
		response.end(JSON.stringify({ error: { message: 'Method not allowed' }, data: null }))
		return
	}

	try {
		await handleProxy(request, response)
	} catch {
		setCors(response)
		response.writeHead(502, { 'Content-Type': 'application/json' })
		response.end(JSON.stringify({ error: { message: 'Proxy request failed' }, data: null }))
	}
}).listen(PORT, () => {
	console.log(`[auth-proxy] listening on http://localhost:${PORT}`)
})
