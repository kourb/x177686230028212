import { spawn } from 'node:child_process'

// Start local auth proxy and Next dev server together.
function run () {
	const proxy = spawn('node', ['--watch', 'scripts/auth-proxy.mjs'], { stdio: 'inherit', env: process.env })
	const next = spawn('next', ['dev'], {
		stdio: 'inherit',
		env: {
			...process.env,
			NEXT_PUBLIC_AUTH_USE_PROXY: process.env.NEXT_PUBLIC_AUTH_USE_PROXY ?? '1',
		},
		shell: true,
	})

	const stop = () => {
		if(!proxy.killed) proxy.kill('SIGTERM')
		if(!next.killed) next.kill('SIGTERM')
	}

	next.on('exit', () => {
		stop()
		process.exit(0)
	})

	proxy.on('exit', (code) => {
		if(code === 0) return
		stop()
		process.exit(code ?? 1)
	})

	process.on('SIGINT', stop)
	process.on('SIGTERM', stop)
}

run()
