export type ChatCharacter = {
	id: string
	name: string
	avatar: string
	script: ChatScript
}

export type ChatScript = {
	// Opening sequence: greeting → optional extra yo's → problem question
	greeting: string[]
	extraYo: string[]
	extraYoCount: [min: number, max: number]
	problemQuestion: string[]
	// After first user reply
	acknowledge: string[]
	acknowledgeExtra: string[]
	// After second user reply
	wow: string[]
	wowFollow: string[]
	wowFollowCount: [min: number, max: number]
}

// Pick random item from array.
export function pick<T> (arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

// Pick random item different from the last picked value.
export function pickNew<T> (arr: T[], last: T | undefined): T {
	if(arr.length <= 1) return arr[0]
	let val = pick(arr)
	if(val === last) val = arr[(arr.indexOf(val) + 1 + Math.floor(Math.random() * (arr.length - 1))) % arr.length]
	return val
}

// Pick random int in [min, max] inclusive.
export function randInt (min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

// Build opening message sequence for a character.
export function buildOpening (script: ChatScript): string[] {
	const msgs: string[] = [pick(script.greeting)]
	const yoCount = randInt(...script.extraYoCount)
	for(let i = 0; i < yoCount; i++) msgs.push(pickNew(script.extraYo, msgs.at(-1)))
	msgs.push(pick(script.problemQuestion))
	return msgs
}

// Build acknowledge sequence after first user message.
export function buildAcknowledge (script: ChatScript): string[] {
	const ack = pick(script.acknowledge)
	return [ack, pickNew(script.acknowledgeExtra, ack)]
}

// Build wow sequence after second user message.
export function buildWow (script: ChatScript): string[] {
	const msgs: string[] = [pick(script.wow)]
	const followCount = randInt(...script.wowFollowCount)
	for(let i = 0; i < followCount; i++) msgs.push(pickNew(script.wowFollow, msgs.at(-1)))
	return msgs
}

export const BIG_SMOKE: ChatCharacter = {
	id: 'big-smoke',
	name: 'Big Smoke',
	avatar: '/assets/bigsmoke.png',
	script: {
		greeting: [
			'yo nigga',
			'yo man',
			'wassup nigga',
			'aye yo',
			'hey man',
		],
		extraYo: ['yo', 'yooo', 'aye'],
		extraYoCount: [0, 2],
		problemQuestion: [
			'whats the problem?',
			'problem?',
			'talk to me',
			'what you need?',
			'sup man, what it is?',
			'whatchu need homie?',
		],
		acknowledge: [
			'ok niga i got it',
			'aight i got u',
			'i see u homie',
			'say no more',
		],
		acknowledgeExtra: [
			'let me see..',
			'aight aight..',
			'aye hold on..',
			'one sec..',
		],
		wow: [
			'WOWOWO MAN',
			'OH HELL NAW',
			'AYE AYE AYE',
			'WOWOWO',
		],
		wowFollow: [
			'WOWOWO',
			'CHILL',
			'NAW MAN',
			'for real??',
			'no way homie',
			'u serious rn?',
		],
		wowFollowCount: [1, 3],
	},
}

export const CHAT_CHARACTERS: Record<string, ChatCharacter> = {
	'big-smoke': BIG_SMOKE,
}
