// Normalize server-side localStorage shape for non-standard runtimes.
function createLocalStorageShim () {
	const state = new Map<string, string>()

	return {
		getItem (key: string) {
			const value = state.get(String(key))
			return value === undefined ? null : value
		},
		setItem (key: string, value: string) {
			state.set(String(key), String(value))
		},
		removeItem (key: string) {
			state.delete(String(key))
		},
		clear () {
			state.clear()
		},
		key (index: number) {
			return Array.from(state.keys())[index] ?? null
		},
		get length () {
			return state.size
		},
	}
}

const isServer = typeof window === 'undefined'
const currentStorage = (globalThis as { localStorage?: unknown }).localStorage

if(isServer && (!currentStorage || typeof currentStorage !== 'object' || typeof (currentStorage as { getItem?: unknown }).getItem !== 'function')) {
	;(globalThis as { localStorage: ReturnType<typeof createLocalStorageShim> }).localStorage = createLocalStorageShim()
}
