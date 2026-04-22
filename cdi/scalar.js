import { readFile } from 'node:fs/promises'

// Parse scalar credentials from source file.
function parseScalarConfig (raw) {
	const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
	if(lines.length < 3) throw new Error('doc/scalar.txt must contain url, login, password')
	return {
		baseUrl: lines[0].replace(/\/+$/, ''),
		username: lines[1],
		password: lines[2],
	}
}

// Build Basic auth header from credentials.
function buildBasicAuth (username, password) {
	return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

// Parse scalar HTML config and return source URLs.
function extractSpecSourcesFromHtml (html) {
	const match = html.match(/"sources"\s*:\s*\[(.*?)\]/su)
	if(!match) return []

	const sourceMatches = [...match[1].matchAll(/"url"\s*:\s*"([^"]+)"/g)]
	return sourceMatches.map((source) => source[1])
}

// Build absolute URL using scalar page location.
function buildAbsoluteUrl (value, baseUrl) {
	if(value.startsWith('http://') || value.startsWith('https://')) return value
	return new URL(value, `${baseUrl}/`).toString()
}

// Return unique list of candidate spec URLs.
function buildSpecCandidates (baseUrl, htmlSources) {
	const rootUrl = new URL(baseUrl)
	const root = `${rootUrl.origin}`
	const candidates = [
		...htmlSources.map((source) => buildAbsoluteUrl(source, baseUrl)),
		`${baseUrl}/openapi.json`,
		`${baseUrl}/swagger.json`,
		`${baseUrl}/v3/api-docs`,
		`${baseUrl}/api-docs`,
		`${root}/openapi/v1.json`,
		`${root}/openapi.json`,
		`${root}/swagger.json`,
		`${root}/v3/api-docs`,
		`${root}/api-docs`,
	]

	return [...new Set(candidates)]
}

// Scalar/OpenAPI connector for probing docs and methods.
class ScalarClient {
	// Build client with scalar credentials.
	constructor ({ baseUrl, username, password }) {
		this.baseUrl = baseUrl
		this.authHeader = buildBasicAuth(username, password)
	}

	// Execute HTTP request with auth and JSON/text handling.
	async request (url) {
		const response = await fetch(url, {
			headers: {
				Authorization: this.authHeader,
				Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
			},
		})

		const contentType = response.headers.get('content-type') || ''
		if(contentType.includes('application/json')) {
			return {
				ok: response.ok,
				status: response.status,
				type: 'json',
				body: await response.json(),
				url,
			}
		}

		return {
			ok: response.ok,
			status: response.status,
			type: 'text',
			body: await response.text(),
			url,
		}
	}

	// Verify base endpoint is reachable with provided auth.
	async testConnection () {
		const response = await this.request(this.baseUrl)
		if(!response.ok) throw new Error(`Connection failed: HTTP ${response.status} at ${this.baseUrl}`)
		return response
	}

	// Resolve OpenAPI spec from scalar HTML sources and common paths.
	async loadOpenApiSpec () {
		const base = await this.testConnection()
		const htmlSources = base.type === 'text' ? extractSpecSourcesFromHtml(base.body) : []
		const candidates = buildSpecCandidates(this.baseUrl, htmlSources)

		for(const url of candidates) {
			const response = await this.request(url)
			if(!response.ok || response.type !== 'json') continue
			if(response.body?.openapi || response.body?.swagger || response.body?.paths) return { spec: response.body, url }
		}

		throw new Error('OpenAPI spec not found on common paths')
	}

	// Extract endpoint methods from OpenAPI paths map.
	static extractMethods (spec) {
		const allowed = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'])
		const methods = []
		for(const [route, ops] of Object.entries(spec.paths || {})) {
			for(const method of Object.keys(ops || {})) {
				if(!allowed.has(method.toLowerCase())) continue
				methods.push(`${method.toUpperCase()} ${route}`)
			}
		}
		return methods.sort((a, b) => a.localeCompare(b))
	}
}

// Load scalar source config from doc/scalar.txt.
async function loadScalarConfig () {
	const raw = await readFile(new URL('../doc/scalar.txt', import.meta.url), 'utf8')
	return parseScalarConfig(raw)
}

// Run connectivity check and print discovered methods.
async function main () {
	const config = await loadScalarConfig()
	const client = new ScalarClient(config)

	const base = await client.testConnection()
	console.log(`Connected: ${config.baseUrl} (status ${base.status})`)

	const { spec, url } = await client.loadOpenApiSpec()
	const methods = ScalarClient.extractMethods(spec)
	console.log(`Spec: ${url}`)
	console.log(`Methods: ${methods.length}`)
	for(const method of methods) console.log(method)
}

// Execute script in CLI mode.
main().catch((error) => {
	console.error(error.message)
	process.exit(1)
})
