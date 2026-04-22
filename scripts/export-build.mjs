import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'

const SOURCE_DIR = 'out'
const TARGET_DIR = 'build'

// Sync static Next export output into XEAM build folder.
function syncBuildFolder () {
	if(!existsSync(SOURCE_DIR)) throw new Error('Next export folder not found: out')
	if(existsSync(TARGET_DIR)) rmSync(TARGET_DIR, { recursive: true, force: true })
	mkdirSync(TARGET_DIR, { recursive: true })
	cpSync(SOURCE_DIR, TARGET_DIR, { recursive: true })
}

syncBuildFolder()
