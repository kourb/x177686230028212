'use client'

import Image from 'next/image'
import { type ChangeEvent, type CSSProperties, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { COUNTRY_OPTIONS, DESTINATION_COUNTRY_OPTIONS, SCHENGEN_DESTINATIONS, VISA_COUNTRY_FORMS } from '@/data/countries'
import { BIG_SMOKE, buildAcknowledge, buildOpening, buildWow, pick } from '@/data/chat-characters'
import { BIRTH_PLACE_OPTIONS, CITY_OPTIONS } from '@/data/places'
import { PROFESSION_OPTIONS } from '@/data/professions'
import { SUPPORTED_LOCALES, type LocaleCode } from '@/i18n/config'
import { I18nProvider, useI18n } from '@/i18n/provider'

const HERO_IMAGE = '/assets/hero-travel.svg'
const DEVICE_ID_STORAGE_KEY = 'visa-assistent-device-id'
const AUTH_STORAGE_KEY = 'visa-assistent-auth'
const USER_PROFILE_STORAGE_KEY = 'visa-assistent-user-profile'
const VISA_DRAFTS_STORAGE_KEY = 'visa-drafts'
const ANIMATIONS_DISABLED_STORAGE_KEY = 'visa-animations-disabled'
const FILL_TEST_VALUES_STORAGE_KEY = 'visa-fill-test-values'
const AUTH_REMOTE_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL ?? 'https://133892.ip-ns.net'
const AUTH_PROXY_BASE_URL = process.env.NEXT_PUBLIC_AUTH_PROXY_BASE_URL ?? 'http://localhost:8787'
const AUTH_USE_PROXY = process.env.NEXT_PUBLIC_AUTH_USE_PROXY === '1' || (process.env.NEXT_PUBLIC_AUTH_USE_PROXY !== '0' && process.env.NODE_ENV === 'development')
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '383303576206-8svtv0iglo3sil07mlflaoulv67b9esr.apps.googleusercontent.com'

type AuthPath = '/v1/app/auth/email/send-otp' | '/v1/app/auth/email/verify-otp' | '/v1/app/auth/google' | '/v1/app/auth/register' | '/v1/app/auth/login' | '/v1/app/auth/refresh' | '/v1/app/passports'

type AuthDeletePath = '/v1/app/auth/account' | '/v1/app/auth/sessions'

type AuthDeleteDynamicPath = `/v1/app/passports/${string}` | `/v1/app/applications/${string}`

type GoogleCredentialResponse = {
	credential?: string
}

type GoogleWindow = Window & {
	google?: {
		accounts?: {
			id?: {
				initialize: (options: { client_id: string, callback: (response: GoogleCredentialResponse) => void, auto_select: boolean, cancel_on_tap_outside: boolean }) => void
				prompt: (listener?: (notification: { isNotDisplayed: () => boolean, isSkippedMoment: () => boolean }) => void) => void
			}
		}
	}
}

type ApiResponse<T> = {
	data: T | null
	error: {
		message?: string
		details?: unknown
	} | null
}

// Parse API response without crashing on empty error bodies.
async function readApiResponse<T> (response: Response) {
	const text = await response.text()
	if(!text) return { data: null, error: null } as ApiResponse<T>

	try {
		return JSON.parse(text) as ApiResponse<T>
	} catch {
		return { data: null, error: { message: text } } as ApiResponse<T>
	}
}

// Build a useful API error instead of hiding backend validation details.
function resolveApiErrorMessage<T> (path: string, response: Response, body: ApiResponse<T>) {
	if(body.error?.message) return body.error.details ? `${body.error.message}: ${JSON.stringify(body.error.details)}` : body.error.message
	return `${response.status} ${path}`
}

type AuthTokenResponse = {
	accessToken: string
	refreshToken: string
	accessTokenExpiresAt: number | string
	refreshTokenExpiresAt: number | string
	user?: {
		userId?: string
		email?: string
		role?: string
		isEmailVerified?: boolean
		linkedProviders?: string[]
		hasPassword?: boolean
	}
	isNewUser: boolean
}

type UserProfile = {
	displayName: string
}

type PassportEntry = {
	id: string
	backendId?: number | string
	fullName: string
	passportNumber: string
	visaLabel: string
	citizenship: string
	firstName: string
	lastName: string
	birthDate: string
	gender: string
	issueDate: string
	expiryDate: string
	issuedBy: string
}

type PassportDto = {
	publicId: string
	id: number | string
	firstName: string
	lastName: string
	birthDate: string
	gender: number | string
	citizenship: string | null
	passportNumber: string
	issueDate: string | null
	expiryDate: string
	issuingAuthority: string | null
}

type CountryDto = {
	id: number | string
	code: string
	name: string
}

type VisaTypeDto = {
	id: number | string
	countryId: number | string | null
	code: string
	name: string
	isSchengenStandard: boolean
}

type ApplicationDto = {
	publicId: string
	countryId?: number | string
	countryCode?: string
	countryName: string
	visaTypeId?: number | string
	visaTypeCode?: string
	visaTypeName: string
	status: number | string
	entryDate: string | null
	exitDate: string | null
	visaCenterCity?: string | null
	applicantCount: number | string
	createdAt: number | string
	updatedAt: number | string
}

type ApplicationListResponse = {
	items: ApplicationDto[]
	nextCursor: string | null
	hasMore: boolean
}

type StatusLogEntryDto = {
	oldStatus: number | string
	newStatus: number | string
	comment: string | null
	templateCode: string | null
	createdAt: number | string
}

type EntryStep = 'onboarding' | 'auth' | 'home'

type HomeTab = 'home' | 'documents' | 'visa-start' | 'visa-type' | 'visa-passport' | 'passport-camera' | 'passport-recognition' | 'visa-personal-one' | 'visa-personal-two' | 'visa-trip' | 'visa-docs' | 'visa-photo' | 'visa-photo-camera' | 'visa-photo-check' | 'visa-review-passport' | 'visa-review-personal' | 'visa-review-trip' | 'visa-review-photo' | 'visa-applicants' | 'visa-payment' | 'visa-check' | 'visa-verified' | 'visa-rejected' | 'visa-documents-ready' | 'profile' | 'profile-data' | 'developer-mode' | 'developer-data' | 'passports-list' | 'passports-step-one' | 'passports-step-two' | 'passports-review' | 'passports-edit' | 'support' | 'payment-history' | 'notifications-settings'

const HOME_TABS: HomeTab[] = ['home', 'documents', 'visa-start', 'visa-type', 'visa-passport', 'passport-camera', 'passport-recognition', 'visa-personal-one', 'visa-personal-two', 'visa-trip', 'visa-docs', 'visa-photo', 'visa-photo-camera', 'visa-photo-check', 'visa-review-passport', 'visa-review-personal', 'visa-review-trip', 'visa-review-photo', 'visa-applicants', 'visa-payment', 'visa-check', 'visa-verified', 'visa-rejected', 'visa-documents-ready', 'profile', 'profile-data', 'developer-mode', 'developer-data', 'passports-list', 'passports-step-one', 'passports-step-two', 'passports-review', 'passports-edit', 'support', 'payment-history', 'notifications-settings']

type VisaDestinationCode = 'italy' | 'france' | 'spain' | 'hungary' | 'greece'

type VisaTypeCode = 'type-c' | 'type-d'

type PaymentMethodCode = 'sbp' | 'card-new' | 'card-saved' | 'yoomoney' | 'sberpay'

type FieldIcon = 'search' | 'chevron' | 'calendar'

type HomeRootTab = 'home' | 'documents' | 'profile'

type TripData = (typeof VISA_TRIP_TEXT)['ru']

type VisaApplicant = {
	backendApplicantId?: string
	passport: PassportEntry
	personal: typeof VISA_PERSONAL_TEXT['ru']
	trip: typeof VISA_TRIP_TEXT['ru']
	docs: typeof VISA_DOCS_TEXT['ru']
	photoDataUrl: string
}

type VisaDraft = {
	id: string
	createdAt: number
	visaType: VisaTypeCode
	visaDestination: VisaDestinationCode
	visaDestinationLabel?: string
	status?: 'draft' | 'checking' | 'ready' | 'error'
	applicantCount?: number
	applicants: VisaApplicant[]
	selectedPassport?: PassportEntry | null
	reviewPassport?: PassportEntry
	reviewPersonal?: typeof VISA_PERSONAL_TEXT['ru']
	reviewTrip?: typeof VISA_TRIP_TEXT['ru']
	reviewDocs?: typeof VISA_DOCS_TEXT['ru']
	photoDataUrl?: string
}

type VisaTypeDetail = {
	durationDays: number
	entryKey: 'single' | 'multiple'
	consularFee: string
}

const VISA_DESTINATION_OPTIONS: { code: VisaDestinationCode, labelKey: 'visaDestinationItaly' | 'visaDestinationFrance' | 'visaDestinationSpain' | 'visaDestinationHungary' | 'visaDestinationGreece', flagSrc: string }[] = [
	{ code: 'italy', labelKey: 'visaDestinationItaly', flagSrc: '/assets/flag-italy.svg' },
	{ code: 'france', labelKey: 'visaDestinationFrance', flagSrc: '/assets/flag-france.svg' },
	{ code: 'spain', labelKey: 'visaDestinationSpain', flagSrc: '/assets/flag-spain.svg' },
	{ code: 'hungary', labelKey: 'visaDestinationHungary', flagSrc: '/assets/flag-hungary.svg' },
	{ code: 'greece', labelKey: 'visaDestinationGreece', flagSrc: '/assets/flag-greece.svg' },
]

const VISA_DESTINATION_VISA_TEXT: Record<LocaleCode, Record<VisaDestinationCode, string>> = {
	ru: {
		italy: 'в Италию',
		france: 'во Францию',
		spain: 'в Испанию',
		hungary: 'в Венгрию',
		greece: 'в Грецию',
	},
	en: {
		italy: 'to Italy',
		france: 'to France',
		spain: 'to Spain',
		hungary: 'to Hungary',
		greece: 'to Greece',
	},
	de: {
		italy: 'fur Italien',
		france: 'fur Frankreich',
		spain: 'fur Spanien',
		hungary: 'fur Ungarn',
		greece: 'fur Griechenland',
	},
	fr: {
		italy: 'pour l Italie',
		france: 'pour la France',
		spain: 'pour l Espagne',
		hungary: 'pour la Hongrie',
		greece: 'pour la Grece',
	},
	es: {
		italy: 'para Italia',
		france: 'para Francia',
		spain: 'para Espana',
		hungary: 'para Hungria',
		greece: 'para Grecia',
	},
	it: {
		italy: 'per Italia',
		france: 'per Francia',
		spain: 'per Spagna',
		hungary: 'per Ungheria',
		greece: 'per Grecia',
	},
}

const VISA_TYPE_DETAILS: Record<VisaDestinationCode, Record<VisaTypeCode, VisaTypeDetail>> = {
	italy: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	france: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	spain: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	hungary: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
	greece: {
		'type-c': { durationDays: 90, entryKey: 'single', consularFee: '8297.34₽' },
		'type-d': { durationDays: 365, entryKey: 'multiple', consularFee: '12296.06₽' },
	},
}

const VISA_WARNING_TEXT: Record<LocaleCode, { subtitle: string, duration: string, entry: Record<VisaTypeDetail['entryKey'], string>, fee: string, confirm: string }> = {
	ru: { subtitle: 'Ознакомьтесь с дополнительными условиями по визе.', duration: 'Срок действия', entry: { single: 'Однократный въезд', multiple: 'Многократный въезд' }, fee: 'Консульский сбор', confirm: 'Подтвердить' },
	en: { subtitle: 'Review the additional visa conditions.', duration: 'Validity period', entry: { single: 'Single entry', multiple: 'Multiple entry' }, fee: 'Consular fee', confirm: 'Confirm' },
	de: { subtitle: 'Prufen Sie die zusatzlichen Visumbedingungen.', duration: 'Gultigkeitsdauer', entry: { single: 'Einmalige Einreise', multiple: 'Mehrfache Einreise' }, fee: 'Konsulargebuhr', confirm: 'Bestatigen' },
	fr: { subtitle: 'Consultez les conditions supplementaires du visa.', duration: 'Duree de validite', entry: { single: 'Entree unique', multiple: 'Entrees multiples' }, fee: 'Frais consulaires', confirm: 'Confirmer' },
	es: { subtitle: 'Revisa las condiciones adicionales del visado.', duration: 'Periodo de validez', entry: { single: 'Entrada unica', multiple: 'Entradas multiples' }, fee: 'Tasa consular', confirm: 'Confirmar' },
	it: { subtitle: 'Consulta le condizioni aggiuntive del visto.', duration: 'Periodo di validita', entry: { single: 'Ingresso singolo', multiple: 'Ingressi multipli' }, fee: 'Tassa consolare', confirm: 'Conferma' },
}

const VISA_PASSPORT_TEXT: Record<LocaleCode, { title: string, subtitle: string, before: string, rules: string[], add: string, saved: string }> = {
	ru: { title: 'Загрузка паспорта', subtitle: 'Автоматически заполним данные, необходимые для оформления визы.', before: 'Перед загрузкой документа:', rules: ['Загрузите страницу с вашей фотографией и именем (полный разворот).', 'Убедитесь в том, что загранпаспорт не просрочен и не поврежден.', 'Изображение должно быть четким и хорошо читаемым. Без бликов, пальцев в кадре и размытия.'], add: 'Добавить паспорт', saved: 'Выбрать сохраненный паспорт' },
	en: { title: 'Passport upload', subtitle: 'We will automatically fill in the data needed for the visa application.', before: 'Before uploading the document:', rules: ['Upload the page with your photo and name (full spread).', 'Make sure your passport is not expired or damaged.', 'The image must be sharp and readable, without glare, fingers in frame, or blur.'], add: 'Add passport', saved: 'Choose saved passport' },
	de: { title: 'Pass hochladen', subtitle: 'Wir fullen die fur den Visumantrag erforderlichen Daten automatisch aus.', before: 'Vor dem Hochladen des Dokuments:', rules: ['Laden Sie die Seite mit Foto und Namen hoch (ganze Doppelseite).', 'Stellen Sie sicher, dass der Reisepass nicht abgelaufen oder beschadigt ist.', 'Das Bild muss scharf und gut lesbar sein, ohne Spiegelungen, Finger im Bild oder Unscharfe.'], add: 'Pass hinzufugen', saved: 'Gespeicherten Pass auswahlen' },
	fr: { title: 'Telechargement du passeport', subtitle: 'Nous remplirons automatiquement les donnees necessaires a la demande de visa.', before: 'Avant de telecharger le document:', rules: ['Telechargez la page avec votre photo et votre nom (double page complete).', 'Assurez-vous que le passeport n est pas expire ni endommage.', 'L image doit etre nette et lisible, sans reflets, doigts dans le cadre ni flou.'], add: 'Ajouter un passeport', saved: 'Choisir un passeport enregistre' },
	es: { title: 'Carga de pasaporte', subtitle: 'Completaremos automaticamente los datos necesarios para la solicitud de visado.', before: 'Antes de cargar el documento:', rules: ['Carga la pagina con tu foto y nombre (doble pagina completa).', 'Asegurate de que el pasaporte no este vencido ni danado.', 'La imagen debe ser nitida y legible, sin reflejos, dedos en el encuadre ni desenfoque.'], add: 'Agregar pasaporte', saved: 'Elegir pasaporte guardado' },
	it: { title: 'Caricamento passaporto', subtitle: 'Compileremo automaticamente i dati necessari per la richiesta del visto.', before: 'Prima di caricare il documento:', rules: ['Carica la pagina con foto e nome (doppia pagina completa).', 'Assicurati che il passaporto non sia scaduto o danneggiato.', 'L immagine deve essere nitida e leggibile, senza riflessi, dita nell inquadratura o sfocature.'], add: 'Aggiungi passaporto', saved: 'Scegli passaporto salvato' },
}

const PASSPORT_SCAN_TEXT: Record<LocaleCode, { cameraHint: string, checkingTitle: string, checkingSubtitle: string, searching: string }> = {
	ru: { cameraHint: 'Поместите обе страницы в рамку — ничего не должно обрезаться.', checkingTitle: 'Проверяем данные', checkingSubtitle: 'Убедимся, что все заполнено корректно. Это займет всего несколько секунд.', searching: 'Ищем данные...' },
	en: { cameraHint: 'Place both pages inside the frame so nothing is cut off.', checkingTitle: 'Checking data', checkingSubtitle: 'We will make sure everything is filled in correctly. This will only take a few seconds.', searching: 'Looking for data...' },
	de: { cameraHint: 'Platzieren Sie beide Seiten im Rahmen, damit nichts abgeschnitten wird.', checkingTitle: 'Daten werden gepruft', checkingSubtitle: 'Wir stellen sicher, dass alles korrekt ausgefullt ist. Das dauert nur wenige Sekunden.', searching: 'Daten werden gesucht...' },
	fr: { cameraHint: 'Placez les deux pages dans le cadre afin que rien ne soit coupe.', checkingTitle: 'Verification des donnees', checkingSubtitle: 'Nous verifierons que tout est correctement rempli. Cela ne prendra que quelques secondes.', searching: 'Recherche des donnees...' },
	es: { cameraHint: 'Coloca ambas paginas dentro del marco para que no se corte nada.', checkingTitle: 'Comprobando datos', checkingSubtitle: 'Nos aseguraremos de que todo este completado correctamente. Solo tardara unos segundos.', searching: 'Buscando datos...' },
	it: { cameraHint: 'Posiziona entrambe le pagine nella cornice, senza tagliare nulla.', checkingTitle: 'Verifica dei dati', checkingSubtitle: 'Controlleremo che tutto sia compilato correttamente. Serviranno solo pochi secondi.', searching: 'Ricerca dati...' },
}

const VISA_PERSONAL_TEXT: Record<LocaleCode, { title: string, subtitle: string, birthPlace: string, birthPlaceValue: string, marital: string, maritalValue: string, profession: string, professionValue: string, employer: string, employerValue: string, workAddress: string, workAddressValue: string, residenceAddress: string, residenceAddressValue: string, phone: string, phoneValue: string, email: string, emailValue: string }> = {
	ru: { title: 'Личные данные', subtitle: 'Укажите личные данные, необходимые для дальнейшего оформления визы.', birthPlace: 'Место рождения', birthPlaceValue: 'Российская Федерация, Краснодарский край', marital: 'Семейное положение', maritalValue: 'Женат / Замужем', profession: 'Профессия', professionValue: 'Менеджер', employer: 'Работодатель', employerValue: 'Сбербанк', workAddress: 'Адрес работы', workAddressValue: 'г. Москва, ул. Поклонная, д. 3, корп. 1, эт. 1, пом. 3', residenceAddress: 'Адрес проживания в России', residenceAddressValue: 'г. Москва, ул. Ленина, д. 6', phone: 'Номер телефона', phoneValue: '+7 928 920 20 24', email: 'Электронная почта', emailValue: 'alex.german@gmail.com' },
	en: { title: 'Personal data', subtitle: 'Provide the personal data needed for further visa processing.', birthPlace: 'Place of birth', birthPlaceValue: 'Russian Federation, Krasnodar Krai', marital: 'Marital status', maritalValue: 'Married', profession: 'Profession', professionValue: 'Manager', employer: 'Employer', employerValue: 'Sberbank', workAddress: 'Work address', workAddressValue: 'Moscow, Poklonnaya St., 3, bldg. 1, floor 1, room 3', residenceAddress: 'Residence address in Russia', residenceAddressValue: 'Moscow, Lenina St., 6', phone: 'Phone number', phoneValue: '+7 928 920 20 24', email: 'Email', emailValue: 'alex.german@gmail.com' },
	de: { title: 'Personliche Daten', subtitle: 'Geben Sie die personlichen Daten fur die weitere Visumbearbeitung an.', birthPlace: 'Geburtsort', birthPlaceValue: 'Russische Foderation, Region Krasnodar', marital: 'Familienstand', maritalValue: 'Verheiratet', profession: 'Beruf', professionValue: 'Manager', employer: 'Arbeitgeber', employerValue: 'Sberbank', workAddress: 'Arbeitsadresse', workAddressValue: 'Moskau, Poklonnaya Str. 3, Geb. 1, Etage 1, Raum 3', residenceAddress: 'Wohnadresse in Russland', residenceAddressValue: 'Moskau, Lenina Str. 6', phone: 'Telefonnummer', phoneValue: '+7 928 920 20 24', email: 'E-Mail', emailValue: 'alex.german@gmail.com' },
	fr: { title: 'Donnees personnelles', subtitle: 'Indiquez les donnees personnelles necessaires a la suite de la demande de visa.', birthPlace: 'Lieu de naissance', birthPlaceValue: 'Federation de Russie, krai de Krasnodar', marital: 'Situation familiale', maritalValue: 'Marie(e)', profession: 'Profession', professionValue: 'Manager', employer: 'Employeur', employerValue: 'Sberbank', workAddress: 'Adresse professionnelle', workAddressValue: 'Moscou, rue Poklonnaya, 3, bat. 1, etage 1, bureau 3', residenceAddress: 'Adresse de residence en Russie', residenceAddressValue: 'Moscou, rue Lenina, 6', phone: 'Numero de telephone', phoneValue: '+7 928 920 20 24', email: 'E-mail', emailValue: 'alex.german@gmail.com' },
	es: { title: 'Datos personales', subtitle: 'Indica los datos personales necesarios para continuar con el visado.', birthPlace: 'Lugar de nacimiento', birthPlaceValue: 'Federacion de Rusia, krai de Krasnodar', marital: 'Estado civil', maritalValue: 'Casado/a', profession: 'Profesion', professionValue: 'Gerente', employer: 'Empleador', employerValue: 'Sberbank', workAddress: 'Direccion de trabajo', workAddressValue: 'Moscu, calle Poklonnaya, 3, edif. 1, piso 1, oficina 3', residenceAddress: 'Direccion de residencia en Rusia', residenceAddressValue: 'Moscu, calle Lenina, 6', phone: 'Numero de telefono', phoneValue: '+7 928 920 20 24', email: 'Correo electronico', emailValue: 'alex.german@gmail.com' },
	it: { title: 'Dati personali', subtitle: 'Inserisci i dati personali necessari per proseguire con il visto.', birthPlace: 'Luogo di nascita', birthPlaceValue: 'Federazione Russa, territorio di Krasnodar', marital: 'Stato civile', maritalValue: 'Sposato/a', profession: 'Professione', professionValue: 'Manager', employer: 'Datore di lavoro', employerValue: 'Sberbank', workAddress: 'Indirizzo di lavoro', workAddressValue: 'Mosca, via Poklonnaya, 3, edificio 1, piano 1, ufficio 3', residenceAddress: 'Indirizzo di residenza in Russia', residenceAddressValue: 'Mosca, via Lenina, 6', phone: 'Numero di telefono', phoneValue: '+7 928 920 20 24', email: 'Email', emailValue: 'alex.german@gmail.com' },
}

const VISA_DOCS_TEXT: Record<LocaleCode, { title: string, subtitle: string, hotel: string, hotelFile: string, flights: string, flightsFile: string, insurance: string, insuranceFile: string }> = {
	ru: { title: 'Данные о поездке', subtitle: 'Заполните информацию о поездке для дальнейшего оформления визы', hotel: 'Бронирование отеля', hotelFile: 'hotel.pdf', flights: 'Бронирование авиабилетов', flightsFile: 'tickets.pdf', insurance: 'Медицинская страховка', insuranceFile: 'insurance.pdf' },
	en: { title: 'Trip data', subtitle: 'Fill in trip details for further visa processing', hotel: 'Hotel booking', hotelFile: 'hotel.pdf', flights: 'Flight ticket booking', flightsFile: 'tickets.pdf', insurance: 'Medical insurance', insuranceFile: 'insurance.pdf' },
	de: { title: 'Reisedaten', subtitle: 'Geben Sie die Reisedaten fur die weitere Visumbearbeitung an', hotel: 'Hotelbuchung', hotelFile: 'hotel.pdf', flights: 'Flugticketbuchung', flightsFile: 'tickets.pdf', insurance: 'Krankenversicherung', insuranceFile: 'insurance.pdf' },
	fr: { title: 'Donnees de voyage', subtitle: 'Remplissez les informations de voyage pour la demande de visa', hotel: 'Reservation d hotel', hotelFile: 'hotel.pdf', flights: 'Reservation de billets d avion', flightsFile: 'tickets.pdf', insurance: 'Assurance medicale', insuranceFile: 'insurance.pdf' },
	es: { title: 'Datos del viaje', subtitle: 'Completa los datos del viaje para continuar con el visado', hotel: 'Reserva de hotel', hotelFile: 'hotel.pdf', flights: 'Reserva de vuelos', flightsFile: 'tickets.pdf', insurance: 'Seguro medico', insuranceFile: 'insurance.pdf' },
	it: { title: 'Dati del viaggio', subtitle: 'Compila le informazioni del viaggio per proseguire con il visto', hotel: 'Prenotazione hotel', hotelFile: 'hotel.pdf', flights: 'Prenotazione voli', flightsFile: 'tickets.pdf', insurance: 'Assicurazione medica', insuranceFile: 'insurance.pdf' },
}

const VISA_PHOTO_TEXT: Record<LocaleCode, { title: string, subtitle: string, reqTitle: string, req1: string, req2: string, req3: string, req4: string, req5: string, upload: string, camera: string, checkTitle: string, checkSubtitle: string, checking: string, cameraHint: string }> = {
	ru: { title: 'Загрузка фотографии', subtitle: 'Загрузите соответствующее фото — мы используем его для оформления заявки.', reqTitle: 'Требования к фотографии:', req1: 'Для каждой новой визы необходима фотография, не использованная ранее.', req2: 'Размер фотографии 35×45 мм, белый фон.', req3: 'Формат фотографии: JPEG, мин. 600 DPI.', req4: 'Лицо должно занимать 70–80% площади загруженной фотографии.', req5: 'Без очков и головных уборов — лицо должно быть полностью видно.', upload: 'Загрузить с устройства', camera: 'Сделать фотографию', checkTitle: 'Проверяем фото', checkSubtitle: 'Проверяем соответствие требованиям визы. Это займёт всего несколько секунд.', checking: 'Проверяем на ошибки...', cameraHint: 'Держите лицо в центре рамки и смотрите прямо в камеру.' },
	en: { title: 'Photo upload', subtitle: 'Upload the appropriate photo — we will use it to process your application.', reqTitle: 'Photo requirements:', req1: 'Each new visa requires a photo not previously used.', req2: 'Photo size 35×45 mm, white background.', req3: 'Photo format: JPEG, min. 600 DPI.', req4: 'Face must occupy 70–80% of the uploaded photo area.', req5: 'No glasses or headwear — face must be fully visible.', upload: 'Upload from device', camera: 'Take a photo', checkTitle: 'Checking photo', checkSubtitle: 'Checking compliance with visa requirements. This will take just a few seconds.', checking: 'Checking for errors...', cameraHint: 'Keep your face in the center of the frame and look straight into the camera.' },
	de: { title: 'Foto hochladen', subtitle: 'Laden Sie das entsprechende Foto hoch — wir verwenden es fur Ihre Bewerbung.', reqTitle: 'Fotoanforderungen:', req1: 'Fur jedes neue Visum ist ein noch nicht verwendetes Foto erforderlich.', req2: 'Fotogroße 35×45 mm, weißer Hintergrund.', req3: 'Fotoformat: JPEG, min. 600 DPI.', req4: 'Das Gesicht muss 70–80% der hochgeladenen Fotoflache einnehmen.', req5: 'Keine Brille oder Kopfbedeckung — das Gesicht muss vollstandig sichtbar sein.', upload: 'Vom Gerat hochladen', camera: 'Foto aufnehmen', checkTitle: 'Foto wird gepruft', checkSubtitle: 'Wir prufen die Einhaltung der Visaanforderungen. Das dauert nur wenige Sekunden.', checking: 'Auf Fehler prufen...', cameraHint: 'Halten Sie Ihr Gesicht in der Mitte des Rahmens und schauen Sie direkt in die Kamera.' },
	fr: { title: 'Telechargement de photo', subtitle: 'Telechargez la photo appropriee — nous l utiliserons pour traiter votre demande.', reqTitle: 'Exigences photo :', req1: 'Chaque nouveau visa necessite une photo non utilisee auparavant.', req2: 'Taille de la photo 35×45 mm, fond blanc.', req3: 'Format photo : JPEG, min. 600 DPI.', req4: 'Le visage doit occuper 70 a 80% de la superficie de la photo.', req5: 'Pas de lunettes ni de couvre-chef — le visage doit etre entierement visible.', upload: 'Telecharger depuis l appareil', camera: 'Prendre une photo', checkTitle: 'Verification de la photo', checkSubtitle: 'Nous verifions la conformite aux exigences du visa. Cela ne prendra que quelques secondes.', checking: 'Verification des erreurs...', cameraHint: 'Gardez votre visage au centre du cadre et regardez directement dans la camera.' },
	es: { title: 'Subir foto', subtitle: 'Sube la foto adecuada — la usaremos para procesar tu solicitud.', reqTitle: 'Requisitos de la foto:', req1: 'Cada nuevo visado requiere una foto no usada anteriormente.', req2: 'Tamaño de foto 35×45 mm, fondo blanco.', req3: 'Formato de foto: JPEG, min. 600 DPI.', req4: 'El rostro debe ocupar el 70–80% del area de la foto.', req5: 'Sin gafas ni tocados — el rostro debe ser completamente visible.', upload: 'Subir desde dispositivo', camera: 'Tomar una foto', checkTitle: 'Verificando foto', checkSubtitle: 'Comprobamos el cumplimiento de los requisitos del visado. Solo tardara unos segundos.', checking: 'Comprobando errores...', cameraHint: 'Mantén tu rostro en el centro del encuadre y mira directamente a la cámara.' },
	it: { title: 'Caricamento foto', subtitle: 'Carica la foto appropriata — la useremo per elaborare la tua domanda.', reqTitle: 'Requisiti foto:', req1: 'Ogni nuovo visto richiede una foto non utilizzata in precedenza.', req2: 'Dimensione foto 35×45 mm, sfondo bianco.', req3: 'Formato foto: JPEG, min. 600 DPI.', req4: 'Il viso deve occupare il 70–80% dell\'area della foto.', req5: 'Senza occhiali o copricapo — il viso deve essere completamente visibile.', upload: 'Carica dal dispositivo', camera: 'Scattare una foto', checkTitle: 'Verifica foto', checkSubtitle: 'Verifichiamo la conformita ai requisiti del visto. Ci vorranno solo pochi secondi.', checking: 'Controllo errori...', cameraHint: 'Tieni il viso al centro del riquadro e guarda direttamente nella fotocamera.' },
}

const VISA_TRIP_TEXT: Record<LocaleCode, { title: string, subtitle: string, purpose: string, purposeValue: string, entryDate: string, exitDate: string, dateValue: string, exitDateValue: string, residenceCountry: string, residenceCountryValue: string, prevVisas: string, prevVisasValue: string }> = {
	ru: { title: 'Данные о поездке', subtitle: 'Заполните информацию о поездке для дальнейшего оформления визы', purpose: 'Цель поездки', purposeValue: 'Туризм', entryDate: 'Предполагаемая дата въезда', exitDate: 'Предполагаемая дата выезда', dateValue: '01.10.2020', exitDateValue: '14.10.2020', residenceCountry: 'Страна пребывания за последние 3 года', residenceCountryValue: 'Российская Федерация', prevVisas: 'Наличие предыдущих шенгенских виз', prevVisasValue: 'Нет' },
	en: { title: 'Trip data', subtitle: 'Fill in trip details for further visa processing', purpose: 'Purpose of travel', purposeValue: 'Tourism', entryDate: 'Expected entry date', exitDate: 'Expected exit date', dateValue: '01.10.2020', exitDateValue: '14.10.2020', residenceCountry: 'Country of residence in the last 3 years', residenceCountryValue: 'Russian Federation', prevVisas: 'Previous Schengen visas', prevVisasValue: 'No' },
	de: { title: 'Reisedaten', subtitle: 'Geben Sie die Reisedaten fur die weitere Visumbearbeitung an', purpose: 'Reisezweck', purposeValue: 'Tourismus', entryDate: 'Voraussichtliches Einreisedatum', exitDate: 'Voraussichtliches Ausreisedatum', dateValue: '01.10.2020', exitDateValue: '14.10.2020', residenceCountry: 'Wohnsitzland in den letzten 3 Jahren', residenceCountryValue: 'Russische Foderation', prevVisas: 'Fruhere Schengen-Visa', prevVisasValue: 'Nein' },
	fr: { title: 'Donnees de voyage', subtitle: 'Remplissez les informations de voyage pour la demande de visa', purpose: 'Objet du voyage', purposeValue: 'Tourisme', entryDate: 'Date d entree prevue', exitDate: 'Date de sortie prevue', dateValue: '01.10.2020', exitDateValue: '14.10.2020', residenceCountry: 'Pays de residence au cours des 3 dernieres annees', residenceCountryValue: 'Federation de Russie', prevVisas: 'Visas Schengen anterieurs', prevVisasValue: 'Non' },
	es: { title: 'Datos del viaje', subtitle: 'Completa los datos del viaje para continuar con el visado', purpose: 'Proposito del viaje', purposeValue: 'Turismo', entryDate: 'Fecha de entrada prevista', exitDate: 'Fecha de salida prevista', dateValue: '01.10.2020', exitDateValue: '14.10.2020', residenceCountry: 'Pais de residencia en los ultimos 3 anos', residenceCountryValue: 'Federacion de Rusia', prevVisas: 'Visados Schengen anteriores', prevVisasValue: 'No' },
	it: { title: 'Dati del viaggio', subtitle: 'Compila le informazioni del viaggio per proseguire con il visto', purpose: 'Scopo del viaggio', purposeValue: 'Turismo', entryDate: 'Data di ingresso prevista', exitDate: 'Data di uscita prevista', dateValue: '01.10.2020', exitDateValue: '14.10.2020', residenceCountry: 'Paese di residenza negli ultimi 3 anni', residenceCountryValue: 'Federazione Russa', prevVisas: 'Precedenti visti Schengen', prevVisasValue: 'No' },
}

const PURPOSE_OPTIONS = ['Туризм', 'Бизнес', 'Учеба', 'Лечение', 'Посещение родственников']
const YES_NO_OPTIONS = ['Нет', 'Да']
const MARITAL_OPTIONS = ['Не женат / Не замужем', 'Женат / Замужем', 'Разведен / Разведена', 'Вдовец / Вдова']
const GENDER_OPTIONS = ['Мужской', 'Женский']
const TIME_OPTIONS = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00']
const CENTER_OPTIONS = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск']

let lastHomeRootTabIndex = 0
let lastVisaTripProgress = 0

// Compose visa type title for the selected destination country.
function resolveVisaTypeTitle (locale: LocaleCode, destination: VisaDestinationCode, type: 'C' | 'D') {
	if(locale === 'ru') return `Шенгенская виза ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Тип ${type})`
	if(locale === 'en') return `Schengen visa ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Type ${type})`
	if(locale === 'de') return `Schengen-Visum ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Typ ${type})`
	if(locale === 'fr') return `Visa Schengen ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Type ${type})`
	if(locale === 'es') return `Visado Schengen ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Tipo ${type})`
	return `Visto Schengen ${VISA_DESTINATION_VISA_TEXT[locale][destination]} (Tipo ${type})`
}

// Compose Russian visa title from selected destination database label.
function resolveVisaTitleRu (destinationLabel: string, type: VisaTypeCode) {
	if(!destinationLabel.trim()) return `Шенгенская виза (Тип ${type === 'type-c' ? 'C' : 'D'})`
	return `Шенгенская виза ${VISA_COUNTRY_FORMS[destinationLabel] ?? `в ${destinationLabel}`} (Тип ${type === 'type-c' ? 'C' : 'D'})`
}

// Resolve visible application status label for documents list.
function resolveDraftStatusLabel (status: VisaDraft['status']) {
	if(status === 'checking') return 'На проверке'
	if(status === 'ready') return 'Документы готовы'
	if(status === 'error') return 'Требуются правки'
	return 'Черновик'
}

let googleScriptPromise: Promise<void> | null = null

// Normalize token expiration value into unix milliseconds.
function resolveExpireAtMs (value: number | string | undefined) {
	if(value === undefined || value === null) return 0
	if(typeof value === 'number') return value > 1e12 ? value : value * 1000
	if(/^\d+$/.test(value)) {
		const numeric = Number(value)
		return numeric > 1e12 ? numeric : numeric * 1000
	}
	const parsed = Date.parse(value)
	if(Number.isNaN(parsed)) return 0
	return parsed
}

// Resolve whether refresh token is still valid for session reuse.
function hasValidRefreshToken (payload: AuthTokenResponse | null) {
	if(!payload?.refreshToken) return false
	const expiresAt = resolveExpireAtMs(payload.refreshTokenExpiresAt)
	if(!expiresAt) return false
	return expiresAt > Date.now()
}

// Resolve stable device metadata required by auth endpoints.
function resolveDeviceInfo () {
	const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
	if(stored) {
		return {
			deviceId: stored,
			deviceName: 'Visa Assistent Web',
		}
	}

	const created = crypto.randomUUID()
	window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created)
	return {
		deviceId: created,
		deviceName: 'Visa Assistent Web',
	}
}

// Resolve whether user already has persisted auth token pair.
function hasPersistedAuthSession () {
	if(typeof window === 'undefined') return false

	const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
	if(!raw) return false

	try {
		const parsed = JSON.parse(raw) as AuthTokenResponse | null
		if(!parsed) return false
		if(!parsed.accessToken) return false
		if(!hasValidRefreshToken(parsed)) {
			clearPersistedSession()
			return false
		}
		return true
	} catch {
		return false
	}
}

// Decode Google ID token payload and extract first name.
function resolveGoogleDisplayName (idToken: string) {
	const tokenParts = idToken.split('.')
	if(tokenParts.length < 2) return null

	try {
		const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { given_name?: string, name?: string }
		if(payload.given_name && payload.given_name.trim()) return payload.given_name.trim()
		if(payload.name && payload.name.trim()) return payload.name.trim().split(' ')[0]
		return null
	} catch {
		return null
	}
}

// Persist resolved user profile for post-auth screens.
function setUserProfile (profile: UserProfile) {
	window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

// Resolve persisted user profile from local storage.
function resolveUserProfile () {
	const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)
	if(!raw) return null

	try {
		const profile = JSON.parse(raw) as UserProfile | null
		if(!profile?.displayName) return null
		return profile
	} catch {
		return null
	}
}

// Clear persisted auth and profile data after account logout or deletion.
function clearPersistedSession () {
	window.localStorage.removeItem(AUTH_STORAGE_KEY)
	window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY)
}

// Format API date string into dd.mm.yyyy for UI fields.
function formatPassportDate (value: string | null | undefined) {
	if(!value) return ''
	const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
	if(!match) return String(value)
	return `${match[3]}.${match[2]}.${match[1]}`
}

// Convert dd.mm.yyyy UI date into API yyyy-mm-dd.
function toApiPassportDate (value: string) {
	const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
	if(!match) return value
	return `${match[3]}-${match[2]}-${match[1]}`
}

// Parse UI date string into a local Date for calendar positioning.
function parseUiDate (value: string) {
	const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
	if(!match) return new Date()
	return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
}

// Format Date object back into dd.mm.yyyy UI date.
function formatUiDate (date: Date) {
	return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}

// Return month grid cells including leading blanks for Monday-first layout.
function resolveCalendarDays (month: Date) {
	const days: (number | null)[] = []
	const first = new Date(month.getFullYear(), month.getMonth(), 1)
	const offset = (first.getDay() + 6) % 7
	for(let i = 0; i < offset; i += 1) days.push(null)
	for(let day = 1; day <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); day += 1) days.push(day)
	return days
}

// Map API passport dto into UI passport entry model.
function mapPassportDto (dto: PassportDto): PassportEntry {
	const gender = Number(dto.gender) === 2 ? 'Женский' : 'Мужской'
	return {
		id: dto.publicId,
		backendId: dto.id,
		fullName: `${dto.firstName} ${dto.lastName}`.trim().toUpperCase(),
		passportNumber: dto.passportNumber,
		visaLabel: 'Шенгенская виза в Италию (Тип C)',
		citizenship: dto.citizenship ?? 'Российская Федерация',
		firstName: dto.firstName,
		lastName: dto.lastName,
		birthDate: formatPassportDate(dto.birthDate),
		gender,
		issueDate: formatPassportDate(dto.issueDate),
		expiryDate: formatPassportDate(dto.expiryDate),
		issuedBy: dto.issuingAuthority ?? 'Российская Федерация',
	}
}

// Build new passport draft for add flow.
function createPassportDraft (fillTestValues = false) {
	if(!fillTestValues) {
		return {
			id: `draft-${Date.now()}`,
			fullName: '',
			passportNumber: '',
			visaLabel: '',
			citizenship: '',
			firstName: '',
			lastName: '',
			birthDate: '',
			gender: '',
			issueDate: '',
			expiryDate: '',
			issuedBy: '',
		} satisfies PassportEntry
	}

	return {
		id: `draft-${Date.now()}`,
		fullName: 'ALEKS GERMAN',
		passportNumber: '650000001',
		visaLabel: 'Шенгенская виза в Италию (Тип C)',
		citizenship: 'Российская Федерация',
		firstName: 'ALEKS',
		lastName: 'GERMAN',
		birthDate: '08.02.1996',
		gender: 'Мужской',
		issueDate: '01.10.2020',
		expiryDate: '01.10.2030',
		issuedBy: 'Российская Федерация',
	} satisfies PassportEntry
}

// Build personal data draft with optional developer test values.
function createPersonalDraft (fillTestValues = false) {
	if(fillTestValues) return { ...VISA_PERSONAL_TEXT['ru'] }
	return { ...VISA_PERSONAL_TEXT['ru'], birthPlaceValue: '', maritalValue: '', professionValue: '', employerValue: '', workAddressValue: '', residenceAddressValue: '', phoneValue: '', emailValue: '' }
}

// Build trip data draft with optional developer test values.
function createTripDraft (fillTestValues = false) {
	if(fillTestValues) return { ...VISA_TRIP_TEXT['ru'] }
	return { ...VISA_TRIP_TEXT['ru'], purposeValue: '', dateValue: '', exitDateValue: '', residenceCountryValue: '', prevVisasValue: '' }
}

// Build document names draft with optional developer test values.
function createDocsDraft (fillTestValues = false) {
	if(fillTestValues) return { ...VISA_DOCS_TEXT['ru'] }
	return { ...VISA_DOCS_TEXT['ru'], hotelFile: '', flightsFile: '', insuranceFile: '' }
}

// Resolve known backend country aliases across ISO and localized names.
function resolveBackendCountryAliases (destination: VisaDestinationCode, label: string) {
	return ({
		italy: ['IT', 'ITA', 'Italy', 'Italia', 'Италия'],
		france: ['FR', 'FRA', 'France', 'Франция'],
		spain: ['ES', 'ESP', 'Spain', 'España', 'Испания'],
		hungary: ['HU', 'HUN', 'Hungary', 'Венгрия'],
		greece: ['GR', 'GRC', 'Greece', 'Греция'],
	} as Record<VisaDestinationCode, string[]>)[destination].concat(label ? [label] : [])
}

// Map backend application status into visible draft status.
function mapApplicationStatus (status: number | string): NonNullable<VisaDraft['status']> {
	const value = String(status).toLowerCase()
	if(value.includes('need') || value === '3') return 'error'
	if(value.includes('ready') || value.includes('approved') || value.includes('complete') || value === '4') return 'ready'
	if(value.includes('self') || value.includes('pending') || value === '1' || value === '2') return 'checking'
	return 'draft'
}

// Preserve local UI data while taking backend status/list identity as source of truth.
function mapApplicationDtoToDraft (dto: ApplicationDto, local?: VisaDraft): VisaDraft {
	const backendStatus = mapApplicationStatus(dto.status)
	return {
		id: dto.publicId,
		createdAt: Number(dto.createdAt) || Date.now(),
		visaType: local?.visaType ?? (String(dto.visaTypeCode).toLowerCase().includes('d') ? 'type-d' : 'type-c'),
		visaDestination: local?.visaDestination ?? (SCHENGEN_DESTINATIONS.find((item) => dto.countryName.toLowerCase().includes(item.label.toLowerCase()))?.code ?? 'italy'),
		visaDestinationLabel: local?.visaDestinationLabel ?? dto.countryName,
		status: backendStatus,
		applicantCount: Number(dto.applicantCount) || local?.applicants.length || 0,
		applicants: local?.applicants ?? [],
	}
}

// Convert UI applicant fields into backend Schengen draft fields.
function mapApplicantToSchengenFields (applicant: VisaApplicant) {
	return {
		birthPlace: applicant.personal.birthPlaceValue || null,
		maritalStatus: null,
		occupation: applicant.personal.professionValue || null,
		employerName: applicant.personal.employerValue || null,
		employerAddress: applicant.personal.workAddressValue || null,
		residenceAddress: applicant.personal.residenceAddressValue || null,
		phone: applicant.personal.phoneValue || null,
		email: applicant.personal.emailValue || null,
		travelPurpose: null,
		previousSchengenVisas: applicant.trip.prevVisasValue || null,
		countriesLast3Years: applicant.trip.residenceCountryValue || null,
	}
}

// Build backend autosave payload from current UI application state.
function mapDraftToAutoSavePayload (applicants: VisaApplicant[]) {
	return {
		entryDate: toApiPassportDate(applicants[0]?.trip.dateValue ?? ''),
		exitDate: toApiPassportDate(applicants[0]?.trip.exitDateValue ?? ''),
		visaCenterCity: null,
		applicants: applicants.filter((item) => item.backendApplicantId).map((item) => ({
			applicantPublicId: item.backendApplicantId,
			schengenFields: mapApplicantToSchengenFields(item),
			customValues: [],
		})),
	}
}

// Build create-passport API payload from UI draft data.
function mapPassportDraftToPayload (draft: PassportEntry) {
	return {
		lastName: draft.lastName,
		firstName: draft.firstName,
		middleName: null,
		birthDate: toApiPassportDate(draft.birthDate),
		gender: draft.gender === 'Женский' ? 2 : 1,
		citizenship: draft.citizenship,
		passportSeries: null,
		passportNumber: draft.passportNumber,
		issueDate: toApiPassportDate(draft.issueDate),
		expiryDate: toApiPassportDate(draft.expiryDate),
		issuingAuthority: draft.issuedBy,
		isPrimary: false,
	}
}

// Resolve persisted auth token payload from local storage.
function resolveAuthPayload () {
	const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
	if(!raw) return null

	try {
		return JSON.parse(raw) as AuthTokenResponse
	} catch {
		return null
	}
}

// Persist refreshed auth payload when API issues new token pair.
function setAuthPayload (payload: AuthTokenResponse) {
	window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

// Resolve persisted visa drafts without touching storage during SSR.
function resolveSavedDrafts () {
	if(typeof window === 'undefined') return []

	try {
		return JSON.parse(window.localStorage.getItem(VISA_DRAFTS_STORAGE_KEY) ?? '[]') as VisaDraft[]
	} catch {
		return []
	}
}

// Resolve developer-selected reduced motion preference.
function resolveAnimationsDisabled () {
	if(typeof window === 'undefined') return false
	return window.localStorage.getItem(ANIMATIONS_DISABLED_STORAGE_KEY) === 'true'
}

// Resolve developer-selected form test data preference.
function resolveFillTestValues () {
	if(typeof window === 'undefined') return false
	return window.localStorage.getItem(FILL_TEST_VALUES_STORAGE_KEY) === 'true'
}

// Resolve request URL for auth endpoint in proxy or direct mode.
function resolveAuthUrl (path: string) {
	if(AUTH_USE_PROXY) return `${AUTH_PROXY_BASE_URL}${path}`

	return `${AUTH_REMOTE_BASE_URL}${path}`
}

// Load Google Identity Services script once per app session.
function loadGoogleScript () {
	if(googleScriptPromise) return googleScriptPromise

	googleScriptPromise = new Promise<void>((resolve, reject) => {
		const found = document.querySelector('script[data-google-identity="1"]') as HTMLScriptElement | null
		if(found) {
			if((window as GoogleWindow).google?.accounts?.id) {
				resolve()
				return
			}

			found.addEventListener('load', () => resolve(), { once: true })
			found.addEventListener('error', () => reject(new Error('Failed to load Google SDK')), { once: true })
			return
		}

		const script = document.createElement('script')
		script.src = 'https://accounts.google.com/gsi/client'
		script.async = true
		script.defer = true
		script.dataset.googleIdentity = '1'
		script.onload = () => resolve()
		script.onerror = () => reject(new Error('Failed to load Google SDK'))
		document.head.appendChild(script)
	})

	return googleScriptPromise
}

// Request Google ID token via Google Identity Services.
function requestGoogleIdToken (clientId: string) {
	return new Promise<string>((resolve, reject) => {
		const google = (window as GoogleWindow).google?.accounts?.id
		if(!google) {
			reject(new Error('Google SDK is unavailable'))
			return
		}

		let done = false
		const finish = (callback: () => void) => {
			if(done) return
			done = true
			callback()
		}

		google.initialize({
			client_id: clientId,
			auto_select: false,
			cancel_on_tap_outside: true,
			callback: (response) => {
				if(response.credential) {
					finish(() => resolve(response.credential as string))
					return
				}

				finish(() => reject(new Error('Google did not return id token')))
			},
		})

		google.prompt((notification) => {
			if(notification.isNotDisplayed() || notification.isSkippedMoment()) {
				finish(() => reject(new Error('Google sign-in prompt was skipped')))
			}
		})
	})
}

// Send POST request to app auth API and unwrap data payload.
async function authPost<T> (path: AuthPath, payload: Record<string, unknown>) {
	const response = await fetch(resolveAuthUrl(path), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})
	const body = await readApiResponse<T>(response)

	if(!response.ok || !body.data && path !== '/v1/app/auth/email/send-otp') {
		throw new Error(body.error?.message ?? 'Authorization request failed')
	}

	return body.data
}

// Send authorized POST request and refresh access token before retry.
async function authPostAuthorized<T> (path: string, payload: Record<string, unknown> = {}) {
	const authPayload = resolveAuthPayload()
	if(!authPayload?.accessToken) throw new Error('Authorization token is missing')

	const requestPost = async (token: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})
		const body = await readApiResponse<T>(response)
		return { response, body }
	}

	let { response, body } = await requestPost(authPayload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(authPayload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', {
			refreshToken: authPayload.refreshToken,
			device: resolveDeviceInfo(),
		})

		if(refreshed) {
			setAuthPayload(refreshed)
			;({ response, body } = await requestPost(refreshed.accessToken))
		}
	}

	if(response.status === 401) {
		clearPersistedSession()
		throw new Error('Session expired. Sign in again')
	}
	if(!response.ok || !body.data) throw new Error(resolveApiErrorMessage(path, response, body))
	return body.data
}

// Send authorized PUT request (used for key-value state updates).
async function authPut<T> (path: string, payload: Record<string, unknown>) {
	const authPayload = resolveAuthPayload()
	if(!authPayload?.accessToken) throw new Error('Authorization token is missing')

	const requestPut = async (token: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const body = await readApiResponse<T>(response)
		return { response, body }
	}

	let { response, body } = await requestPut(authPayload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(authPayload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', { refreshToken: authPayload.refreshToken, device: resolveDeviceInfo() })
		if(refreshed) { setAuthPayload(refreshed); ;({ response, body } = await requestPut(refreshed.accessToken)) }
	}
	if(!response.ok) throw new Error(body.error?.message ?? 'State update failed')
	return body.data
}

// Send authorized DELETE request to auth API.
async function authDelete (path: AuthDeletePath) {
	return authDeletePath(path)
}

// Send authorized DELETE request with one refresh retry.
async function authDeletePath (path: AuthDeletePath | AuthDeleteDynamicPath) {
	const payload = resolveAuthPayload()
	if(!payload?.accessToken) throw new Error('Authorization token is missing')

	const requestDelete = async (accessToken: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		const body = await readApiResponse<unknown>(response)
		return { response, body }
	}

	let { response, body } = await requestDelete(payload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(payload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', {
			refreshToken: payload.refreshToken,
			device: resolveDeviceInfo(),
		})
		if(refreshed) {
			setAuthPayload(refreshed)
			;({ response, body } = await requestDelete(refreshed.accessToken))
		}
	}

	if(response.status === 401) {
		clearPersistedSession()
		throw new Error('Session expired. Sign in again and retry account deletion')
	}
	if(!response.ok) throw new Error(body.error?.message ?? 'Account deletion failed')
	return body.data
}

// Send authorized GET request and refresh expired access token once.
async function authGet<T> (path: string) {
	const payload = resolveAuthPayload()
	if(!payload?.accessToken) throw new Error('Authorization token is missing')

	const requestGet = async (accessToken: string) => {
		const response = await fetch(resolveAuthUrl(path), {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		const body = await readApiResponse<T>(response)
		return { response, body }
	}

	let { response, body } = await requestGet(payload.accessToken)
	if(response.status === 401 && hasValidRefreshToken(payload)) {
		const refreshed = await authPost<AuthTokenResponse>('/v1/app/auth/refresh', {
			refreshToken: payload.refreshToken,
			device: resolveDeviceInfo(),
		})
		if(refreshed) {
			setAuthPayload(refreshed)
			;({ response, body } = await requestGet(refreshed.accessToken))
		}
	}

	if(response.status === 401) {
		clearPersistedSession()
		throw new Error('Session expired. Sign in again')
	}
	if(!response.ok || !body.data) throw new Error(body.error?.message ?? 'Request failed')
	return body.data
}

// Load display name from backend state and merge into local profile.
async function loadProfileFromBackend () {
	try {
		const data = await authGet<{ value: string }>('/v1/app/state/profile')
		if(data?.value) {
			const parsed = JSON.parse(data.value) as { firstName?: string, lastName?: string }
			const displayName = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ')
			if(displayName) setUserProfile({ displayName })
			return parsed
		}
	} catch { /* no profile saved yet */ }
	return null
}

// Persist firstName+lastName to backend state.
async function saveProfileToBackend (firstName: string, lastName: string) {
	await authPut('/v1/app/state/profile', { value: JSON.stringify({ firstName, lastName }) })
}

// In-memory cache for reference data (countries + visa-types per countryId).
const refCache: { countries?: CountryDto[], visaTypes: Record<string, VisaTypeDto[]> } = { visaTypes: {} }

// Resolve backend country and visa type IDs from public reference data.
async function resolveApplicationRefs (destination: VisaDestinationCode, label: string, type: VisaTypeCode) {
	if(!refCache.countries) refCache.countries = await authGet<CountryDto[]>('/v1/app/reference/countries')
	const aliases = resolveBackendCountryAliases(destination, label).map((item) => item.toLowerCase())
	const country = refCache.countries.find((item) => aliases.includes(item.code.toLowerCase()) || aliases.includes(item.name.toLowerCase())) ?? refCache.countries.find((item) => aliases.some((alias) => item.name.toLowerCase().includes(alias)))
	if(!country) throw new Error('Visa country is unavailable in backend reference')

	if(!refCache.visaTypes[country.id]) refCache.visaTypes[country.id] = await authGet<VisaTypeDto[]>(`/v1/app/reference/visa-types?countryId=${country.id}`)
	const typeLetter = type === 'type-d' ? 'd' : 'c'
	const visaType = refCache.visaTypes[country.id].find((item) => item.code.toLowerCase().includes(typeLetter)) ?? refCache.visaTypes[country.id].find((item) => item.name.toLowerCase().includes(`type ${typeLetter}`)) ?? refCache.visaTypes[country.id][0]
	if(!visaType) throw new Error('Visa type is unavailable in backend reference')

	return { countryId: country.id, visaTypeId: visaType.id }
}

// Load backend applications and merge local UI-only details.
async function loadBackendDrafts () {
	const response = await authGet<ApplicationListResponse>('/v1/app/applications?pageSize=50')
	const localDrafts = resolveSavedDrafts()
	const backendDrafts = response.items.map((item) => mapApplicationDtoToDraft(item, localDrafts.find((draft) => draft.id === item.publicId)))
	return [...backendDrafts, ...localDrafts.filter((draft) => !backendDrafts.some((item) => item.id === draft.id))]
}

// Create a backend draft application for the selected route state.
async function createBackendDraft (destination: VisaDestinationCode, label: string, type: VisaTypeCode) {
	return authPostAuthorized<ApplicationDto>('/v1/app/applications', await resolveApplicationRefs(destination, label, type))
}

// Move application to backend self-check state.
async function runBackendSelfCheck (id: string) {
	return authPostAuthorized<ApplicationDto>(`/v1/app/applications/${id}/self-check`)
}

// Load backend application status by public ID.
async function loadBackendApplication (id: string) {
	return authGet<ApplicationDto>(`/v1/app/applications/${id}`)
}

// Load backend status transition history for application debugging.
async function loadBackendStatusLog (id: string) {
	return authGet<StatusLogEntryDto[]>(`/v1/app/applications/${id}/status-log`)
}

// Move editable application back to backend draft state before autosave.
async function returnBackendApplicationToDraft (id: string) {
	return authPostAuthorized<ApplicationDto>(`/v1/app/applications/${id}/return-to-draft`)
}

// Submit application to backend review state.
async function submitBackendApplication (id: string) {
	return authPostAuthorized<ApplicationDto>(`/v1/app/applications/${id}/submit`)
}

// Ensure each UI applicant has a backend applicant row before autosave.
async function syncBackendApplicants (applicationId: string, applicants: VisaApplicant[]) {
	const next = [...applicants]
	for(let i = 0; i < next.length; i++) {
		if(next[i].backendApplicantId) continue
		if(!next[i].passport.backendId) throw new Error('Select a saved passport before saving application')
		const saved = await authPostAuthorized<{ publicId: string }>(`/v1/app/applications/${applicationId}/applicants`, {
			passportId: next[i].passport.backendId,
			isPrimary: i === 0,
		})
		next[i] = { ...next[i], backendApplicantId: saved.publicId }
	}
	return next
}

// Persist backend application form data in a single autosave request.
async function autoSaveBackendDraft (applicationId: string, applicants: VisaApplicant[]) {
	return authPostAuthorized(`/v1/app/applications/${applicationId}/auto-save`, mapDraftToAutoSavePayload(applicants))
}

// Resolve splash lifecycle based on document and script readiness.
function useSplashReady () {
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		let isActive = true
		let loadHandler: (() => void) | null = null
		let settleTimer = 0
		const waitForLoad = new Promise<void>((resolve) => {
			if(document.readyState === 'complete') {
				resolve()
				return
			}

			loadHandler = () => resolve()
			window.addEventListener('load', loadHandler, { once: true })
		})
		const waitForSettle = new Promise<void>((resolve) => {
			settleTimer = window.setTimeout(() => resolve(), 850)
		})

		Promise.all([waitForLoad, waitForSettle]).then(() => {
			if(isActive) setIsReady(true)
		})

		return () => {
			isActive = false
			if(loadHandler) window.removeEventListener('load', loadHandler)
			window.clearTimeout(settleTimer)
		}
	}, [])

	return isReady
}

// Check whether email field contains minimal valid value.
function isEmailValid (email: string) {
	const value = email.trim()
	if(!value.includes('@')) return false
	const parts = value.split('@')
	if(parts.length !== 2) return false
	if(parts[0].length === 0 || parts[1].length < 3) return false
	return parts[1].includes('.')
}

// Render locale switcher control outside mobile frame.
function LocaleSwitcher () {
	const { locale, setLocale } = useI18n()
	const [isOpen, setIsOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)
	const selected = SUPPORTED_LOCALES.find((item) => item.code === locale) ?? SUPPORTED_LOCALES[0]

	useEffect(() => {
		if(!isOpen) return

		const onPointerDown = (event: PointerEvent) => {
			if(!rootRef.current) return
			if(rootRef.current.contains(event.target as Node)) return
			setIsOpen(false)
		}

		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [isOpen])

	return (
		<div className="locale-switcher" ref={rootRef}>
			<button aria-expanded={isOpen} className="locale-trigger" onClick={() => setIsOpen(!isOpen)} type="button">
				<span>{selected.nativeName}</span>
				<i aria-hidden className="locale-caret">
					<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
						<path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
					</svg>
				</i>
			</button>

			{isOpen ? (
				<ul className="locale-menu" role="listbox">
					{SUPPORTED_LOCALES.map((item) => {
						return (
							<li key={item.code}>
								<button className={item.code === locale ? 'locale-option is-active' : 'locale-option'} onClick={() => {
									setLocale(item.code)
									setIsOpen(false)
								}} type="button">
									<span>{item.nativeName}</span>
								</button>
							</li>
						)
					})}
				</ul>
			) : null}
		</div>
	)
}

// Render first onboarding screen from Figma node 591:7457.
function OnboardingScreen ({ onContinue }: { onContinue: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Onboarding" className="onboarding-screen">
			<div className="onboarding-hero">
				<Image alt="Travel illustration" className="onboarding-hero-image" height={394} priority src={HERO_IMAGE} unoptimized width={458} />
			</div>

			<div className="onboarding-copy">
				<h1>{t('onboardingTitle')}</h1>
				<p>{t('onboardingSubtitle')}</p>
			</div>

			<button className="onboarding-cta" onClick={onContinue} type="button">{t('onboardingContinue')}</button>
		</section>
	)
}

// Render second auth screen from Figma nodes 2057:2914 (email), 2057:3041 (password), 2057:3420 (register).
function AuthScreen ({ onAuthenticated }: { onAuthenticated: () => void }) {
	const { t } = useI18n()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [termsAccepted, setTermsAccepted] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [step, setStep] = useState<'email' | 'password' | 'register' | 'done'>('email')
	const [isBusy, setIsBusy] = useState(false)
	const [errorText, setErrorText] = useState('')

	const canContinueEmail = isEmailValid(email) && !isBusy
	const canContinuePassword = password.trim().length >= 6 && !isBusy
	const canContinueRegister = firstName.trim().length > 0 && lastName.trim().length > 0 && termsAccepted && !isBusy

	// Authenticate user via Google ID token, load profile from backend.
	const loginWithGoogle = async () => {
		if(!GOOGLE_CLIENT_ID) { setErrorText(t('authGoogleMissingClientId')); return }
		setIsBusy(true)
		setErrorText('')
		try {
			await loadGoogleScript()
			const idToken = await requestGoogleIdToken(GOOGLE_CLIENT_ID)
			const displayName = resolveGoogleDisplayName(idToken)
			const tokenPair = await authPost<AuthTokenResponse>('/v1/app/auth/google', { idToken, device: resolveDeviceInfo() })
			window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenPair))
			if(displayName) setUserProfile({ displayName })
			await loadProfileFromBackend()
			reloadNotifications(); reloadChatStore()
			addNotification('Вход выполнен через Google')
			setStep('done')
			onAuthenticated()
		} catch (error) {
			setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsBusy(false)
		}
	}

	// Try login; if account doesn't exist, show registration form.
	const submitPassword = async () => {
		setIsBusy(true)
		setErrorText('')
		try {
			const tokenPair = await authPost<AuthTokenResponse>('/v1/app/auth/login', {
				email: email.trim(), password: password.trim(), device: resolveDeviceInfo(),
			})
			window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenPair))
			await loadProfileFromBackend()
			reloadNotifications(); reloadChatStore()
			addNotification('Вход в аккаунт выполнен')
			setStep('done')
			onAuthenticated()
		} catch {
			// Login failed — assume no account, show registration form.
			setErrorText('')
			setStep('register')
		} finally {
			setIsBusy(false)
		}
	}

	// Register new account then save name to backend state.
	const submitRegister = async () => {
		setIsBusy(true)
		setErrorText('')
		try {
			const tokenPair = await authPost<AuthTokenResponse>('/v1/app/auth/register', {
				email: email.trim(), password: password.trim(), device: resolveDeviceInfo(),
			})
			window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenPair))
			const displayName = `${firstName.trim()} ${lastName.trim()}`
			setUserProfile({ displayName })
			await saveProfileToBackend(firstName.trim(), lastName.trim())
			reloadNotifications(); reloadChatStore()
			addNotification('Аккаунт создан и выполнен вход')
			setStep('done')
			onAuthenticated()
		} catch (error) {
			setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsBusy(false)
		}
	}

	if(step === 'register') {
		return (
			<section aria-label="Auth register" className="auth-screen">
				<header className="auth-header auth-header--with-back">
					<button aria-label={t('profileDataBack')} className="auth-back-button" onClick={() => { setStep('password'); setErrorText('') }} type="button">
						<Image alt="" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<div>
						<h1>{t('authRegisterTitle')}</h1>
						<p>{t('authRegisterSubtitle')}</p>
					</div>
				</header>

				<div className="auth-form">
					<label htmlFor="auth-first-name">{t('authFirstNameLabel')}</label>
					<input autoFocus id="auth-first-name" onChange={(e) => setFirstName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && canContinueRegister) submitRegister() }} placeholder={t('authFirstNamePlaceholder')} type="text" value={firstName} />
					<label htmlFor="auth-last-name">{t('authLastNameLabel')}</label>
					<input id="auth-last-name" onChange={(e) => setLastName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && canContinueRegister) submitRegister() }} placeholder={t('authLastNamePlaceholder')} type="text" value={lastName} />
					<label htmlFor="auth-email-reg">{t('emailLabel')}</label>
					<input disabled id="auth-email-reg" readOnly type="email" value={email} />
					{errorText ? <p className="auth-note is-error">{errorText}</p> : null}
					<label className="auth-checkbox-row">
						<input checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} type="checkbox" />
						<span>{t('authTermsText')}<a className="auth-terms-link" href="#" onClick={(e) => e.preventDefault()}>{t('authTermsService')}</a>{t('authTermsAnd')}<a className="auth-terms-link" href="#" onClick={(e) => e.preventDefault()}>{t('authTermsPrivacy')}</a>{'.'}</span>
					</label>
				</div>

				<button className="auth-continue" disabled={!canContinueRegister} onClick={submitRegister} type="button">{t('authContinue')}</button>
			</section>
		)
	}

	if(step === 'password') {
		return (
			<section aria-label="Auth password" className="auth-screen">
				<header className="auth-header auth-header--with-back">
					<button aria-label={t('profileDataBack')} className="auth-back-button" onClick={() => { setStep('email'); setErrorText(''); setPassword('') }} type="button">
						<Image alt="" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<div>
						<h1>{t('authTitle')}</h1>
						<p>{t('authSubtitle')}</p>
					</div>
				</header>

				<div className="auth-form">
					<label htmlFor="auth-email-ro">{t('emailLabel')}</label>
					<input disabled id="auth-email-ro" readOnly type="email" value={email} />
					<label htmlFor="auth-password">{t('authPasswordLabel')}</label>
					<div className="auth-password-wrap">
						<input autoFocus id="auth-password" onChange={(e) => setPassword(e.target.value)} placeholder={t('authPasswordPlaceholder')} type={showPassword ? 'text' : 'password'} value={password} />
						<button aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} className="auth-eye-button" onClick={() => setShowPassword(v => !v)} type="button">
							{showPassword ? (
								<svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" x2="23" y1="1" y2="23" /></svg>
							) : (
								<svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
							)}
						</button>
					</div>
					{errorText ? <p className="auth-note is-error">{errorText}</p> : null}
					<button className="auth-link" type="button">{t('authForgotPassword')}</button>
				</div>

				<button className="auth-continue" disabled={!canContinuePassword} onClick={submitPassword} type="button">{t('authContinue')}</button>
			</section>
		)
	}

	return (
		<section aria-label="Auth" className="auth-screen">
			<header className="auth-header">
				<h1>{t('authTitle')}</h1>
				<p>{t('authSubtitle')}</p>
			</header>

			<div className="auth-form">
				<label htmlFor="auth-email">{t('emailLabel')}</label>
				<input id="auth-email" onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} type="email" value={email} />
				{errorText ? <p className="auth-note is-error">{errorText}</p> : null}
			</div>

			<button className="auth-continue" disabled={!canContinueEmail} onClick={() => { setErrorText(''); setStep('password') }} type="button">{t('authContinue')}</button>

			<div className="auth-divider">
				<span />
				<em>{t('orLabel')}</em>
				<span />
			</div>

			<div className="auth-socials">
				<button className="auth-social" disabled={isBusy} onClick={loginWithGoogle} type="button">
					<Image alt="Google" className="auth-icon-image" height={24} src="/assets/icon-google.svg" unoptimized width={24} />
					{t('googleContinue')}
				</button>
				<button className="auth-social" type="button">
					<Image alt="Apple" className="auth-icon-image" height={24} src="/assets/icon-apple.svg" unoptimized width={24} />
					{t('appleContinue')}
				</button>
			</div>
		</section>
	)
}

// Render post-auth home screen from Figma node 2009:7697.
function HomeScreen ({ onOpenDocuments, onOpenProfile, onOpenVisaStart }: { onOpenDocuments: () => void, onOpenProfile: () => void, onOpenVisaStart: () => void }) {
	const { t } = useI18n()
	const displayName = resolveUserProfile()?.displayName ?? t('homeDefaultName')

	return (
		<section aria-label="Home" className="home-screen">
			<DesktopSidebar active="home" onOpenDocuments={onOpenDocuments} onOpenHome={() => {}} onOpenProfile={onOpenProfile} />

			<div className="home-scroll">
				<div className="home-desktop-breadcrumbs" aria-label="Breadcrumbs">
					<span>{'ShenGen'}</span>
					<i />
					<span>{'Главная страница'}</span>
				</div>

				<div className="home-hero-wrap">
					<Image alt="Travel destination" className="home-hero-image" height={460} src="/assets/home-destination.svg" unoptimized width={402} />
				</div>

				<div className="home-copy">
					<h1>{`${t('homeGreeting')} ${displayName}!\n${t('homeQuestion')}`}</h1>
					<p>{t('homeSubtitle')}</p>
				</div>

				<button className="home-cta" onClick={onOpenVisaStart} type="button">{t('homeStartVisa')}</button>
			</div>

			<DesktopRail />

			<HomeTabbar active="home" onOpenDocuments={onOpenDocuments} onOpenHome={() => {}} onOpenProfile={onOpenProfile} />
		</section>
	)
}

// --- Notification store ---
type AppNotification = { id: number, text: string, badge?: string, badgePending?: boolean, time: string }
// Resolve per-user localStorage key for notifications.
function notifKey () {
	try {
		const raw = localStorage.getItem(AUTH_STORAGE_KEY)
		const uid = raw ? (JSON.parse(raw) as AuthTokenResponse).user?.userId : undefined
		return uid ? `visa-notifications-${uid}` : 'visa-notifications-guest'
	} catch { return 'visa-notifications-guest' }
}

function loadNotifs (): AppNotification[] {
	try { return JSON.parse(localStorage.getItem(notifKey()) ?? '[]') } catch { return [] }
}

const notifStore: { items: AppNotification[], subs: Set<() => void> } = {
	items: typeof window !== 'undefined' ? loadNotifs() : [],
	subs: new Set(),
}

function notifNotify () { notifStore.subs.forEach((fn) => fn()) }

// Reload notifications from storage for the current user (call after login).
function reloadNotifications () {
	notifStore.items = loadNotifs()
	notifNotify()
}

// Format Date as "Сегодня, HH:MM" or "Вчера, HH:MM".
function formatNotifTime (d = new Date()) {
	const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
	const now = new Date()
	const isToday = d.toDateString() === now.toDateString()
	const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
	const isYesterday = d.toDateString() === yesterday.toDateString()
	return isToday ? `Сегодня, ${hm}` : isYesterday ? `Вчера, ${hm}` : hm
}

// Push a new notification (max 5 kept).
function addNotification (text: string, badge?: string, badgePending?: boolean) {
	notifStore.items = [{ id: Date.now(), text, badge, badgePending, time: formatNotifTime() }, ...notifStore.items].slice(0, 5)
	localStorage.setItem(notifKey(), JSON.stringify(notifStore.items))
	notifNotify()
}

// Clear all notifications.
function clearNotifications () {
	notifStore.items = []
	localStorage.removeItem(notifKey())
	notifNotify()
}

// Subscribe to notification store updates.
function useNotifications () {
	return useSyncExternalStore(
		(cb) => { notifStore.subs.add(cb); return () => notifStore.subs.delete(cb) },
		() => notifStore.items,
	)
}
// --- End notification store ---

// Typing delay based on message length: ~60ms per char + random 300-700ms.
function typingDelay (text: string) {
	return Math.min(text.length * 60 + 300 + Math.random() * 400, 3000)
}

// --- Chat store ---
type ChatPersistedState = { messages: ChatMessage[], unread: number, replyStage: number }
type ChatSnapshot = { messages: ChatMessage[], isTyping: boolean, joined: boolean, unread: number }
type ChatStore = {
	messages: ChatMessage[]
	isTyping: boolean
	joined: boolean
	replyStage: number
	started: boolean
	unread: number
	timers: number[]
	idleTimer: number
	subs: Set<() => void>
	snapshot: ChatSnapshot
}

// Resolve per-user localStorage key for chat history.
function chatKey () {
	try {
		const raw = localStorage.getItem(AUTH_STORAGE_KEY)
		const uid = raw ? (JSON.parse(raw) as AuthTokenResponse).user?.userId : undefined
		return uid ? `visa-chat-${uid}` : 'visa-chat-guest'
	} catch { return 'visa-chat-guest' }
}

function loadChatState (): ChatPersistedState {
	try { return JSON.parse(localStorage.getItem(chatKey()) ?? 'null') ?? { messages: [], unread: 0, replyStage: 0 } } catch { return { messages: [], unread: 0, replyStage: 0 } }
}

function saveChatState () {
	try { localStorage.setItem(chatKey(), JSON.stringify({ messages: chatStore.messages, unread: chatStore.unread, replyStage: chatStore.replyStage })) } catch {}
}

function makeChatSnapshot (): ChatSnapshot {
	return { messages: chatStore.messages, isTyping: chatStore.isTyping, joined: chatStore.joined, unread: chatStore.unread }
}

const chatStore: ChatStore = (() => {
	const saved = typeof window !== 'undefined' ? loadChatState() : { messages: [], unread: 0, replyStage: 0 }
	const msgs = saved.messages
	const joined = msgs.length > 0
	return {
		messages: msgs, isTyping: false, joined,
		replyStage: saved.replyStage,
		started: joined,
		unread: saved.unread, timers: [], idleTimer: 0, subs: new Set(),
		snapshot: { messages: msgs, isTyping: false, joined, unread: saved.unread },
	}
})()

function chatNotify () {
	chatStore.snapshot = makeChatSnapshot()
	chatStore.subs.forEach((fn) => fn())
}

// Mark all messages as read (call when chat is open/visible).
function chatMarkRead () {
	if(chatStore.unread === 0) return
	chatStore.unread = 0
	saveChatState()
	chatNotify()
}

function chatAddMsg (from: 'operator' | 'user', text: string) {
	chatStore.messages = [...chatStore.messages, { id: Date.now() + Math.random(), from, text }]
	if(from === 'operator') chatStore.unread += 1
	saveChatState()
	chatNotify()
}

function chatQueueMsgs (msgs: string[], startDelay = 0) {
	let offset = startDelay
	for(const text of msgs) {
		const delay = typingDelay(text)
		const t1 = window.setTimeout(() => { chatStore.isTyping = true; chatNotify() }, offset)
		const t2 = window.setTimeout(() => { chatStore.isTyping = false; chatAddMsg('operator', text) }, offset + delay)
		chatStore.timers.push(t1, t2)
		offset += delay + 200
	}
}

function chatResetIdle () {
	window.clearTimeout(chatStore.idleTimer)
	chatStore.idleTimer = window.setTimeout(() => {
		const text = pick(['yo u there?', 'hello??', 'aye man you still here?', 'heyyyy', 'you good?'])
		chatQueueMsgs([text])
		addNotification(`Сообщение от ${BIG_SMOKE.name}`)
	}, 12000)
}

// Start the opening sequence once — idempotent.
function chatInit () {
	if(chatStore.started) return
	chatStore.started = true
	const t = window.setTimeout(() => {
		chatStore.joined = true
		chatNotify()
		chatQueueMsgs(buildOpening(BIG_SMOKE.script), 300)
		chatResetIdle()
	}, 1400)
	chatStore.timers.push(t)
}

// Reset chat store for a new user session.
function resetChatStore () {
	chatStore.timers.forEach(window.clearTimeout)
	window.clearTimeout(chatStore.idleTimer)
	chatStore.timers = []
	chatStore.messages = []
	chatStore.isTyping = false
	chatStore.joined = false
	chatStore.replyStage = 0
	chatStore.started = false
	chatStore.unread = 0
	chatStore.idleTimer = 0
	chatNotify()
}

// Reload chat from localStorage for the current user (call after login).
function reloadChatStore () {
	resetChatStore()
	const saved = loadChatState()
	chatStore.messages = saved.messages
	chatStore.replyStage = saved.replyStage
	chatStore.unread = saved.unread
	chatStore.joined = saved.messages.length > 0
	chatStore.started = saved.messages.length > 0
	chatNotify()
}

function chatSend (text: string) {
	if(!text.trim()) return
	chatAddMsg('user', text)
	chatResetIdle()
	const stage = chatStore.replyStage
	chatStore.replyStage += 1
	saveChatState()
	chatQueueMsgs(stage === 0 ? buildAcknowledge(BIG_SMOKE.script) : buildWow(BIG_SMOKE.script), 400)
}

function useChatStore () {
	return useSyncExternalStore(
		(cb) => { chatStore.subs.add(cb); return () => chatStore.subs.delete(cb) },
		() => chatStore.snapshot,
	)
}
// --- End chat store ---

// Render persistent desktop notification rail.
type ChatMessage = { id: number, from: 'operator' | 'user', text: string }

// Typing delay based on message length: ~60ms per char + random 300-700ms.
// Render support chat widget backed by shared chatStore.
function SupportChat ({ onClose, embed, rootRef }: { onClose: () => void, embed?: boolean, rootRef?: RefObject<HTMLDivElement | null> }) {
	const { messages, isTyping, joined } = useChatStore()
	const [input, setInput] = useState('')
	const bottomRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => { chatInit() }, [])
	useEffect(() => { chatMarkRead() }, [])
	useEffect(() => { if(!embed) inputRef.current?.focus() }, [embed])
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages, joined, isTyping])

	const send = () => {
		const text = input.trim()
		if(!text) return
		setInput('')
		chatSend(text)
	}

	return (
		<div className={embed ? 'support-chat is-embed' : 'support-chat'} ref={rootRef}>
			{embed ? null : (
				<header className="support-chat-header">
					{joined ? <Image alt={BIG_SMOKE.name} className="support-chat-avatar" height={36} src={BIG_SMOKE.avatar} unoptimized width={36} /> : <div className="support-chat-avatar-placeholder" />}
					<div className="support-chat-meta">
						{joined ? <b>{BIG_SMOKE.name}</b> : <b>{'Поддержка'}</b>}
						<span>{isTyping ? 'набирает сообщение...' : joined ? 'онлайн' : 'подключается...'}</span>
					</div>
					<button className="support-chat-close" onClick={onClose} type="button">{'✕'}</button>
				</header>
			)}

			<div className="support-chat-body">
				{embed ? (
					<div className="support-chat-operator-row">
						{joined ? <Image alt={BIG_SMOKE.name} className="support-chat-avatar" height={40} src={BIG_SMOKE.avatar} unoptimized width={40} /> : <div className="support-chat-avatar-placeholder" style={{ width: 40, height: 40 }} />}
						<div className="support-chat-meta">
							{joined ? <b>{BIG_SMOKE.name}</b> : <b>{'Поддержка'}</b>}
							<span>{isTyping ? 'набирает сообщение...' : joined ? 'онлайн' : 'подключается...'}</span>
						</div>
					</div>
				) : null}
				{joined ? <p className="support-chat-system">{'Оператор присоединился'}</p> : <p className="support-chat-system">{'Ищем оператора...'}</p>}
				{messages.map((msg) => (
					<div className={`support-chat-msg is-${msg.from}`} key={msg.id}>
						{msg.from === 'operator' ? <Image alt={BIG_SMOKE.name} className="support-chat-msg-avatar" height={24} src={BIG_SMOKE.avatar} unoptimized width={24} /> : null}
						<span>{msg.text}</span>
					</div>
				))}

				<div ref={bottomRef} />
			</div>

			<div className="support-chat-input-row">
				<input
					className="support-chat-input"
					placeholder="Написать сообщение..."
					ref={inputRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => { if(e.key === 'Enter') send() }}
					type="text"
				/>
				<button className="support-chat-send" onClick={send} type="button">{'→'}</button>
			</div>
		</div>
	)
}

// Render payment history screen.
function PaymentHistoryScreen ({ onBack, onOpenHome, onOpenDocuments, onOpenProfile }: { onBack: () => void, onOpenHome: () => void, onOpenDocuments: () => void, onOpenProfile: () => void }) {
	return (
		<section aria-label="Payment history" className="simple-settings-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
			<div className="simple-settings-scroll">
				<header className="support-toolbar">
					<button aria-label="Назад" className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<h2>{'История платежей'}</h2>
				</header>
				<div className="simple-settings-empty">
					<p>{'Нет истории платежей'}</p>
				</div>
			</div>
			<DesktopRail />
			<HomeTabbar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
		</section>
	)
}

const NOTIF_STORAGE_PREFS_KEY_PREFIX = 'visa-notif-prefs-'

// Resolve per-user notification prefs key.
function notifPrefsKey () {
	try {
		const raw = localStorage.getItem(AUTH_STORAGE_KEY)
		const uid = raw ? (JSON.parse(raw) as AuthTokenResponse).user?.userId : undefined
		return `${NOTIF_STORAGE_PREFS_KEY_PREFIX}${uid ?? 'guest'}`
	} catch { return `${NOTIF_STORAGE_PREFS_KEY_PREFIX}guest` }
}

type NotifPrefs = { visaStatus: boolean, payments: boolean, security: boolean, news: boolean }

function loadNotifPrefs (): NotifPrefs {
	try { return { visaStatus: true, payments: true, security: true, news: false, ...JSON.parse(localStorage.getItem(notifPrefsKey()) ?? '{}') } } catch { return { visaStatus: true, payments: true, security: true, news: false } }
}

function saveNotifPrefs (prefs: NotifPrefs) {
	try { localStorage.setItem(notifPrefsKey(), JSON.stringify(prefs)) } catch {}
}

// Render notifications settings screen.
function NotificationsSettingsScreen ({ onBack, onOpenHome, onOpenDocuments, onOpenProfile }: { onBack: () => void, onOpenHome: () => void, onOpenDocuments: () => void, onOpenProfile: () => void }) {
	const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs)
	const [pushPermission, setPushPermission] = useState<NotificationPermission>(() =>
		typeof Notification !== 'undefined' ? Notification.permission : 'default'
	)

	const update = (key: keyof NotifPrefs, value: boolean) => {
		const next = { ...prefs, [key]: value }
		setPrefs(next)
		saveNotifPrefs(next)
	}

	// Request browser push notification permission.
	const requestPush = async () => {
		if(typeof Notification === 'undefined') return
		const result = await Notification.requestPermission()
		setPushPermission(result)
	}

	const pushLabel = pushPermission === 'granted' ? 'Включены' : pushPermission === 'denied' ? 'Заблокированы в браузере' : 'Не включены'
	const pushCanRequest = pushPermission === 'default'

	return (
		<section aria-label="Notification settings" className="simple-settings-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
			<div className="simple-settings-scroll">
				<header className="support-toolbar">
					<button aria-label="Назад" className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<h2>{'Уведомления'}</h2>
				</header>

				<div className="notif-settings-group">
					<p className="notif-settings-label">{'Push-уведомления в браузере'}</p>
					<div className="notif-settings-push-row">
						<span className={`notif-settings-push-status${pushPermission === 'granted' ? ' is-granted' : pushPermission === 'denied' ? ' is-denied' : ''}`}>{pushLabel}</span>
						{pushCanRequest ? <button className="notif-settings-enable-button" onClick={requestPush} type="button">{'Включить'}</button> : null}
					</div>
					{pushPermission === 'denied' ? <p className="notif-settings-hint">{'Чтобы включить, разрешите уведомления в настройках браузера.'}</p> : null}
				</div>

				<div className="notif-settings-group">
					<p className="notif-settings-label">{'Типы уведомлений'}</p>
					<div className="notif-settings-list">
						{([
							{ key: 'visaStatus' as const, label: 'Статус заявки на визу', hint: 'Изменения статуса, готовность документов' },
							{ key: 'payments' as const, label: 'Платежи', hint: 'Подтверждения оплаты и счета' },
							{ key: 'security' as const, label: 'Безопасность', hint: 'Новые входы в аккаунт' },
							{ key: 'news' as const, label: 'Новости и советы', hint: 'Обновления сервиса, полезные материалы' },
						]).map(({ key, label, hint }) => (
							<label className="notif-settings-row" key={key}>
								<div className="notif-settings-row-copy">
									<b>{label}</b>
									<span>{hint}</span>
								</div>
								<div className={`notif-toggle${prefs[key] ? ' is-on' : ''}`} onClick={() => update(key, !prefs[key])} role="switch" aria-checked={prefs[key]} tabIndex={0} onKeyDown={(e) => { if(e.key === ' ' || e.key === 'Enter') update(key, !prefs[key]) }}>
									<div className="notif-toggle-thumb" />
								</div>
							</label>
						))}
					</div>
				</div>
			</div>
			<DesktopRail />
			<HomeTabbar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
		</section>
	)
}

const FAQ_ITEMS = [
	{ q: 'Сколько времени занимает оформление визы?', a: 'В среднем 5–15 рабочих дней. Зависит от страны назначения и загруженности консульства.' },
	{ q: 'Какие документы нужны для шенгенской визы?', a: 'Загранпаспорт, фото, бронирование отеля и авиабилетов, медицинская страховка, справка с работы или выписка с банковского счёта.' },
	{ q: 'Можно ли подать заявку онлайн?', a: 'Заполнить анкету и загрузить документы можно онлайн. Биометрию и оригиналы нужно предоставить лично в визовом центре.' },
	{ q: 'Что делать если визу отказали?', a: 'Можно подать апелляцию или подать заявку повторно, устранив причину отказа. Причина отказа указывается в уведомлении.' },
	{ q: 'Как долго действует шенгенская виза?', a: 'Обычно 30–90 дней. Многократные визы выдаются на срок до 5 лет при наличии хорошей визовой истории.' },
]

// Render support screen with FAQ and Chat tabs.
function SupportScreen ({ onBack, onOpenHome, onOpenDocuments, onOpenProfile }: { onBack: () => void, onOpenHome: () => void, onOpenDocuments: () => void, onOpenProfile: () => void }) {
	const [tab, setTab] = useState<'faq' | 'chat'>('faq')
	const [openFaq, setOpenFaq] = useState<number | null>(null)

	return (
		<section aria-label="Support" className="support-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="support-scroll">
				<header className="support-toolbar">
					<button aria-label="Назад" className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<h2>{'Помощь'}</h2>
				</header>

				<div className="support-tabs">
					<button className={`support-tab${tab === 'faq' ? ' is-active' : ''}`} onClick={() => setTab('faq')} type="button">{'FAQ'}</button>
					<button className={`support-tab${tab === 'chat' ? ' is-active' : ''}`} onClick={() => setTab('chat')} type="button">{'Support'}</button>
				</div>

				<div className={`support-faq${tab === 'faq' ? '' : ' is-hidden'}`}>
					{FAQ_ITEMS.map((item, i) => (
						<div className={`support-faq-item${openFaq === i ? ' is-open' : ''}`} key={i}>
							<button className="support-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} type="button">
								<span>{item.q}</span>
								<Image alt="" className={`support-faq-chevron${openFaq === i ? ' is-open' : ''}`} height={20} src="/assets/icon-chevron-right.svg" unoptimized width={20} />
							</button>
							{openFaq === i ? <p className="support-faq-a">{item.a}</p> : null}
						</div>
					))}
				</div>
				<div className={`support-chat-embed${tab === 'chat' ? '' : ' is-hidden'}`}>
					<SupportChat onClose={() => setTab('faq')} embed />
				</div>
			</div>

			<DesktopRail />
			<HomeTabbar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
		</section>
	)
}

function DesktopRail () {
	const [chatOpen, setChatOpen] = useState(false)
	const notifications = useNotifications()
	const { unread } = useChatStore()
	const railRef = useRef<HTMLElement | null>(null)
	const chatRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if(!chatOpen) return
		const onPointerDown = (e: PointerEvent) => {
			if(railRef.current?.contains(e.target as Node)) return
			if(chatRef.current?.contains(e.target as Node)) return
			setChatOpen(false)
		}
		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [chatOpen])

	return <aside className="desktop-rail" aria-label="Notifications" ref={railRef}>
		<section className="desktop-rail-notifications">
			<div className="desktop-rail-notif-header">
				<span className="home-desktop-caption">{'Уведомления'}</span>
				{notifications.length > 0 ? <button className="desktop-rail-clear" onClick={clearNotifications} type="button">{'Очистить'}</button> : null}
			</div>
			{notifications.length === 0
				? <p className="desktop-rail-empty">{'Нет уведомлений'}</p>
				: notifications.map((n) => {
					const isSupport = n.text.startsWith('Сообщение от')
					return (
						<button className={`home-notification-card${n.badge ? '' : ' is-compact'}`} key={n.id} onClick={isSupport ? () => setChatOpen(true) : undefined} type="button">
							{n.badge ? <span className={`home-notification-badge${n.badgePending ? ' is-pending' : ''}`}>{n.badge}</span> : null}
							<b>{n.text}</b>
							<small>{n.time}</small>
						</button>
					)
				})
			}
		</section>

		<button className="home-support-button" onClick={() => { if(!chatOpen) chatMarkRead(); setChatOpen((v) => !v) }} type="button">
			<Image alt="Support" className="home-desktop-menu-icon" height={24} src="/assets/icon-settings-support.svg" unoptimized width={24} />
			<span>{'Есть вопросы?'}</span>
			{!chatOpen && unread > 0 ? <span className="home-support-badge">{unread}</span> : null}
		</button>

		{chatOpen ? <SupportChat onClose={() => setChatOpen(false)} rootRef={chatRef} /> : null}
	</aside>
}

// Render persistent desktop sidebar navigation.
function DesktopSidebar ({ active, onOpenDocuments, onOpenHome, onOpenProfile }: { active: HomeRootTab, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void }) {
	const homeActive = active === 'home'
	const documentsActive = active === 'documents'
	const profileActive = active === 'profile'

	return <aside className="home-desktop-sidebar" aria-label="Desktop navigation">
		<span className="home-desktop-caption">{'Навигация'}</span>
		<nav className="home-desktop-menu">
			<button className={`home-desktop-menu-item${homeActive ? ' is-active' : ''}`} onClick={homeActive ? undefined : onOpenHome} type="button">
				<Image alt="Home" className="home-desktop-menu-icon" height={24} src={homeActive ? '/assets/icon-tab-home.svg' : '/assets/icon-tab-home-inactive.svg'} unoptimized width={24} />
				<span>{'Главная страница'}</span>
			</button>
			<button className={`home-desktop-menu-item${documentsActive ? ' is-active' : ''}`} onClick={documentsActive ? undefined : onOpenDocuments} type="button">
				<Image alt="Documents" className="home-desktop-menu-icon" height={24} src="/assets/icon-tab-documents.svg" unoptimized width={24} />
				<span>{'Заявки и страховки'}</span>
			</button>
			<button className={`home-desktop-menu-item${profileActive ? ' is-active' : ''}`} onClick={profileActive ? undefined : onOpenProfile} type="button">
				<Image alt="Profile" className="home-desktop-menu-icon" height={24} src={profileActive ? '/assets/icon-tab-profile-active.svg' : '/assets/icon-tab-profile.svg'} unoptimized width={24} />
				<span>{'Профиль и настройки'}</span>
			</button>
		</nav>
	</aside>
}

// Render global desktop chrome around all signed-in screens.
function DesktopGlobalChrome ({ active, onOpenDocuments, onOpenHome, onOpenProfile }: { active: HomeRootTab, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void }) {
	return <div className="desktop-global-chrome" aria-hidden={false}>
		<DesktopSidebar active={active} onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
		<DesktopRail />
	</div>
}

type VisaDesktopStep = {
	label: string
	tab: HomeTab
	active: boolean
	completed: boolean
	invalid: boolean
	pending?: boolean
}

// Render desktop visa step rail and applicants side panel.
function DesktopVisaChrome ({ applicants, steps, onAddApplicant, onEditApplicant, onGoHome, onGoStep }: { applicants: VisaApplicant[], steps: VisaDesktopStep[], onAddApplicant: () => void, onEditApplicant: (index: number) => void, onGoHome: () => void, onGoStep: (tab: HomeTab) => void }) {
	return <div className="desktop-visa-chrome" aria-hidden={false}>
		<aside className="visa-desktop-progress" aria-label="Visa progress">
			<span className="home-desktop-caption">{'Этапы заполнения'}</span>
			<nav className="visa-desktop-steps">
				{steps.map((item) => <button className={`visa-desktop-step${item.active ? ' is-active' : ''}${item.completed ? ' is-complete' : ''}${item.invalid ? ' is-error' : ''}${item.pending ? ' is-pending' : ''}`} key={item.label} onClick={() => onGoStep(item.tab)} type="button">
					<i />
					<span>{item.label}</span>
				</button>)}
			</nav>
		</aside>

		<aside className="visa-desktop-applicants" aria-label="Visa applicants">
			<section className="visa-desktop-applicant-section">
				<span className="home-desktop-caption">{'Заявители'}</span>
				<div className="visa-desktop-applicant-list">
					{applicants.length ? applicants.map((item, index) => <button className="visa-desktop-applicant" key={index} onClick={() => onEditApplicant(index)} type="button">
						{item.passport.fullName || `${item.passport.firstName} ${item.passport.lastName}`.trim() || `Заявитель ${index + 1}`}
					</button>) : <div className="visa-desktop-empty-applicant">{'Заявители появятся после заполнения данных.'}</div>}
				</div>
				<button className="visa-desktop-add-applicant" onClick={onAddApplicant} type="button">
					<Image alt="Plus" height={24} src="/assets/icon-plus.svg" unoptimized width={24} />
					<span>{'Добавить заявителя'}</span>
				</button>
			</section>

			<div className="visa-desktop-side-actions">
				<button className="visa-desktop-home-button" onClick={onGoHome} type="button">
					<Image alt="Home" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					<span>{'Вернуться на главную'}</span>
				</button>
				<button className="home-support-button" type="button">
					<Image alt="Support" className="home-desktop-menu-icon" height={24} src="/assets/icon-settings-support.svg" unoptimized width={24} />
					<span>{'Есть вопросы?'}</span>
				</button>
			</div>
		</aside>
	</div>
}

// Render bottom tabbar with an animated marker that survives screen remounts.
function HomeTabbar ({ active, onOpenHome, onOpenDocuments, onOpenProfile }: { active: HomeRootTab, onOpenHome: () => void, onOpenDocuments: () => void, onOpenProfile: () => void }) {
	const index = active === 'home' ? 0 : active === 'documents' ? 1 : 2
	const [visualIndex, setVisualIndex] = useState(lastHomeRootTabIndex)

	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			setVisualIndex(index)
			lastHomeRootTabIndex = index
		})
		return () => cancelAnimationFrame(frame)
	}, [index])

	return (
		<nav aria-label="Bottom navigation" className="home-tabbar" style={{ '--tab-index': visualIndex } as CSSProperties}>
			<button className={`home-tab${active === 'home' ? ' is-active' : ''}`} onClick={active === 'home' ? undefined : onOpenHome} type="button">
				<Image alt="Home" className="home-tab-icon" height={24} src={active === 'home' ? '/assets/icon-tab-home.svg' : '/assets/icon-tab-home-inactive.svg'} unoptimized width={24} />
			</button>
			<button className={`home-tab${active === 'documents' ? ' is-active' : ''}`} onClick={active === 'documents' ? undefined : onOpenDocuments} type="button">
				<Image alt="Documents" className="home-tab-icon" height={24} src="/assets/icon-tab-documents.svg" unoptimized width={24} />
			</button>
			<button className={`home-tab${active === 'profile' ? ' is-active' : ''}`} onClick={active === 'profile' ? undefined : onOpenProfile} type="button">
				<Image alt="Profile" className="home-tab-icon" height={24} src={active === 'profile' ? '/assets/icon-tab-profile-active.svg' : '/assets/icon-tab-profile.svg'} unoptimized width={24} />
			</button>
		</nav>
	)
}

// Render visa setup first step screen from Figma node 520:15433.
// Guard continue button — shakes and vibrates when required fields are missing.
// Guard continue button — shakes and vibrates when required fields are missing.
function ContinueButton ({ label, canContinue = true, className = 'passport-primary', onContinue, onAttempt }: { label: string, canContinue?: boolean, className?: string, onContinue: () => void, onAttempt?: () => void }) {
	const [shaking, setShaking] = useState(false)

	const handleClick = () => {
		if (onAttempt) onAttempt()
		if (!canContinue) {
			setShaking(true)
			if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([80, 40, 80])
			setTimeout(() => setShaking(false), 450)
			return
		}
		onContinue()
	}

	return <button className={`${className}${shaking ? ' is-shaking' : ''}`} onClick={handleClick} type="button">{label}</button>
}

function VisaStartScreen ({ selectedCitizenship, selectedResidence, selectedDestination, selectedDestinationLabel, onBack, onHome, onContinue, canContinue, onSelectCitizenship, onSelectResidence, onSelectDestination }: { selectedCitizenship: string, selectedResidence: string, selectedDestination: VisaDestinationCode, selectedDestinationLabel: string, onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onSelectCitizenship: (value: string) => void, onSelectResidence: (value: string) => void, onSelectDestination: (destination: string) => void }) {
	const { t } = useI18n()
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Visa setup" className="visa-screen">
			<div className="visa-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={12} />

					<div className="visa-copy">
						<h1>{t('visaStartTitle')}</h1>
					</div>
				</header>

				<div className="visa-form">
				<LivingField icon="search" label={t('visaCitizenship')} onChange={onSelectCitizenship} options={COUNTRY_OPTIONS} required showError={attempted} value={selectedCitizenship} />
				<LivingField icon="search" label={t('visaResidence')} onChange={onSelectResidence} options={CITY_OPTIONS} required showError={attempted} value={selectedResidence} />
				<LivingField icon="search" label={t('visaDestination')} onChange={onSelectDestination} options={DESTINATION_COUNTRY_OPTIONS} required showError={attempted} value={selectedDestinationLabel} />

					{selectedDestinationLabel ? null : (
						<div className="visa-popular">
							<label>{t('visaPopularDestinations')}</label>
							<div className="visa-chip-row">
								{VISA_DESTINATION_OPTIONS.map((item) => (
									<button className={`visa-chip${selectedDestination === item.code ? ' is-active' : ''}`} key={item.code} onClick={() => onSelectDestination(t(item.labelKey))} type="button">
										<Image alt={t(item.labelKey)} className="visa-chip-flag" height={24} src={item.flagSrc} unoptimized width={24} />
										<span>{t(item.labelKey)}</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

		<div className="visa-bottom">
			<ContinueButton canContinue={canContinue} className="passport-primary" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onContinue} />
		</div>
	</section>
	)
}

// Render visa type selection screen from Figma node 520:15444.
function VisaTypeScreen ({ selectedDestination, selectedDestinationLabel, selectedType, isWarningOpen, onBack, onHome, onSelectType, onContinue, canContinue, onCloseWarning, onConfirmWarning }: { selectedDestination: VisaDestinationCode, selectedDestinationLabel: string, selectedType: VisaTypeCode, isWarningOpen: boolean, onBack: () => void, onHome: () => void, onSelectType: (type: VisaTypeCode) => void, onContinue: () => void, canContinue?: boolean, onCloseWarning: () => void, onConfirmWarning: () => void }) {
	const { locale, t } = useI18n()
	const selectedDetail = VISA_TYPE_DETAILS[selectedDestination][selectedType]
	const warningText = VISA_WARNING_TEXT[locale]
	const typeCTitle = locale === 'ru' ? resolveVisaTitleRu(selectedDestinationLabel, 'type-c') : resolveVisaTypeTitle(locale, selectedDestination, 'C')
	const typeDTitle = locale === 'ru' ? resolveVisaTitleRu(selectedDestinationLabel, 'type-d') : resolveVisaTypeTitle(locale, selectedDestination, 'D')
	const selectedTitle = selectedType === 'type-c' ? typeCTitle : typeDTitle

	return (
		<section aria-label="Visa type" className="visa-screen">
			<div className="visa-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={24} />

					<div className="visa-copy">
						<h1>{t('visaTypeTitle')}</h1>
					</div>
				</header>

				<div className="visa-form">
					<section className="visa-field">
						<label>{t('visaTypeCaption')}</label>
						<button className={`visa-type-card${selectedType === 'type-c' ? ' is-active' : ''}`} onClick={() => onSelectType('type-c')} type="button">
							<div className="visa-type-card-copy">
								<span className="visa-type-badge">{t('visaTypePopular')}</span>
								<h2>{typeCTitle}</h2>
								<b>{t('visaLearnMore')}</b>
							</div>
							<i className="visa-type-radio" />
						</button>

						<button className={`visa-type-card${selectedType === 'type-d' ? ' is-active' : ''}`} onClick={() => onSelectType('type-d')} type="button">
							<div className="visa-type-card-copy">
								<h2>{typeDTitle}</h2>
								<b>{t('visaLearnMore')}</b>
							</div>
							<i className="visa-type-radio" />
						</button>
					</section>
				</div>
			</div>

		<div className="visa-bottom">
			<ContinueButton canContinue={canContinue} className="passport-primary" label={t('authContinue')} onContinue={onContinue} />
		</div>

		{isWarningOpen ? <div className="visa-warning-overlay" role="presentation">
				<section aria-label={selectedTitle} className="visa-warning-sheet" role="dialog" aria-modal="true">
					<i className="visa-warning-grabber" />
					<div className="visa-warning-header">
						<h2>{selectedTitle}</h2>
						<button aria-label={t('notificationsClose')} className="visa-warning-close" onClick={onCloseWarning} type="button" />
					</div>

					<p>{warningText.subtitle}</p>

					<div className="visa-warning-card">
						<div className="visa-type-card-copy">
							{selectedType === 'type-c' ? <span className="visa-type-badge">{t('visaTypePopular')}</span> : null}
							<h2>{selectedTitle}</h2>
						</div>
						<i className="visa-type-radio" />
					</div>

					<ul className="visa-warning-list">
						<li>{warningText.duration} — {selectedDetail.durationDays} {locale === 'ru' ? 'дней' : 'days'}</li>
						<li>{warningText.entry[selectedDetail.entryKey]}</li>
						<li>{warningText.fee}: {selectedDetail.consularFee}</li>
					</ul>

					<button className="passport-primary visa-warning-confirm" onClick={onConfirmWarning} type="button">{warningText.confirm}</button>
				</section>
			</div> : null}
		</section>
	)
}

// Render passport upload entry screen from Figma node 520:15466.
function VisaPassportScreen ({ selectedPassport, onBack, onHome, onAddPassport, onSelectSaved }: { selectedPassport: PassportEntry | null, onBack: () => void, onHome: () => void, onAddPassport: () => void, onSelectSaved: () => void }) {
	const { locale, t } = useI18n()
	const copy = VISA_PASSPORT_TEXT[locale]

	return (
		<section aria-label="Passport upload" className="visa-screen">
			<div className="visa-scroll visa-passport-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={36} />

					<div className="visa-copy">
						<h1>{copy.title}</h1>
						<p>{copy.subtitle}</p>
					</div>
				</header>

				<section className="visa-passport-rules">
					<h2>{copy.before}</h2>
					<ul>
						{copy.rules.map((item) => <li key={item}>{item}</li>)}
					</ul>
				</section>

				{selectedPassport ? <article className="passport-card visa-selected-passport">
					<div className="passport-card-body">
						<h2>{selectedPassport.fullName}</h2>
						<p>{`${t('passportNumberLabel')}: ${selectedPassport.passportNumber}`}</p>
					</div>
				</article> : null}

				<div className="visa-passport-actions">
					<button className="passport-primary" onClick={onAddPassport} type="button">{copy.add}</button>
					<button className="visa-secondary-button" onClick={onSelectSaved} type="button">{copy.saved}</button>
				</div>
			</div>
		</section>
	)
}

// Render documents and insurance screen from Figma node 521:20268.
function DocumentsScreen ({ onOpenHome, onOpenProfile, drafts, onContinueDraft, onDeleteDraft }: { onOpenHome: () => void, onOpenProfile: () => void, drafts: VisaDraft[], onContinueDraft: (id: string) => void, onDeleteDraft: (id: string) => void }) {
	const { t } = useI18n()
	const [activeTab, setActiveTab] = useState<'visa' | 'insurance'>('visa')
	const [deleteDraftId, setDeleteDraftId] = useState<string | null>(null)
	const hasDrafts = drafts.length > 0
	const confirmDeleteDraft = () => {
		if(!deleteDraftId) return
		onDeleteDraft(deleteDraftId)
		setDeleteDraftId(null)
	}

	return (
		<section aria-label="Documents and insurances" className="documents-screen">
			<DesktopSidebar active="documents" onOpenDocuments={() => {}} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="documents-scroll">
				<section className="documents-top-copy" aria-label="Documents heading">
					<h1>{t('documentsTitle')}</h1>
					<p>{t('documentsSubtitle')}</p>
				</section>

				{hasDrafts ? (
					<section className="documents-drafts" aria-label="Visa applications">
						<div className="documents-tabs" role="tablist" aria-label="Documents tabs">
							<button aria-selected={activeTab === 'visa'} className={`documents-tab${activeTab === 'visa' ? ' is-active' : ''}`} onClick={() => setActiveTab('visa')} role="tab" type="button">{'Заявки на визу'}</button>
							<button aria-selected={activeTab === 'insurance'} className={`documents-tab${activeTab === 'insurance' ? ' is-active' : ''}`} onClick={() => setActiveTab('insurance')} role="tab" type="button">{'Страховки'}</button>
						</div>

						{activeTab === 'visa' ? <div className="documents-cards-group">
							{drafts.map((draft, i) => {
								const applicant = draft.applicants[0]
								const title = applicant?.passport.fullName || draft.reviewPassport?.fullName || `Заявление #${i + 1}`
								const passport = applicant?.passport.passportNumber || draft.reviewPassport?.passportNumber || 'Не указан'
								return <article className="draft-card" key={draft.id}>
									<div className="draft-card-info">
										<span className={`draft-card-status is-${draft.status ?? 'draft'}`}>{resolveDraftStatusLabel(draft.status)}</span>
										<div className="draft-card-copy">
											<h2>{title}</h2>
											<p>{`Номер загранпаспорта: ${passport}\n${resolveVisaTitleRu(draft.visaDestinationLabel ?? 'Италия', draft.visaType)}`}</p>
										</div>
									</div>

									<div className="draft-card-actions">
										<button className="draft-card-primary" onClick={() => onContinueDraft(draft.id)} type="button">{'К заявке'}</button>
										<button className="draft-card-secondary" onClick={() => draft.status === 'ready' ? onContinueDraft(draft.id) : setDeleteDraftId(draft.id)} type="button">{draft.status === 'ready' ? 'Скачать PDF' : 'Удалить'}</button>
									</div>
								</article>
							})}
						</div> : <div className="documents-cards-group"><article className="documents-insurance-empty"><h2>{'Страховки'}</h2><p>{'Здесь появятся оформленные страховки.'}</p></article></div>}
					</section>
				) : (
					<section className="documents-empty" aria-label="No documents">
						<div className="documents-empty-picture">
							<Image alt="Documents and insurance" className="documents-empty-image" height={316} src="/assets/documents-empty-figure.svg" unoptimized width={370} />
						</div>
						<div className="documents-empty-copy">
							<h2>{t('documentsEmptyTitle')}</h2>
							<p>{t('documentsEmptySubtitle')}</p>
						</div>
					</section>
				)}
			</div>

			<DesktopRail />

			<HomeTabbar active="documents" onOpenDocuments={() => {}} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
			{deleteDraftId ? <ConfirmDrawer confirmLabel="Удалить" title="Удалить заявку?" subtitle="Черновик заявки и добавленные заявители будут удалены." onCancel={() => setDeleteDraftId(null)} onConfirm={confirmDeleteDraft} /> : null}
		</section>
	)
}

// Render profile/settings screen from Figma node 562:10062.
function ProfileScreen ({ onOpenHome, onOpenDocuments, onOpenProfileData, onOpenDeveloper, onOpenPassports, onOpenSupport, onOpenPayments, onOpenNotifications }: { onOpenHome: () => void, onOpenDocuments: () => void, onOpenProfileData: () => void, onOpenDeveloper: () => void, onOpenPassports: () => void, onOpenSupport: () => void, onOpenPayments: () => void, onOpenNotifications: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Profile and settings" className="profile-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={() => {}} />

			<div className="profile-scroll">
				<header className="profile-header">
					<h1>{t('profileTitle')}</h1>
					<p>{t('profileSubtitle')}</p>
				</header>

				<section className="profile-section" aria-label={t('profileSectionMain')}>
					<h2>{t('profileSectionMain')}</h2>
					<div className="profile-list">
						<button className="profile-row" onClick={onOpenProfileData} type="button">
							<span className="profile-row-left">
								<Image alt="Profile data" className="profile-row-icon" height={24} src="/assets/icon-settings-profile.svg" unoptimized width={24} />
								<b>{t('profileItemProfileData')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" onClick={onOpenPassports} type="button">
							<span className="profile-row-left">
								<Image alt="Passports" className="profile-row-icon" height={24} src="/assets/icon-settings-passport.svg" unoptimized width={24} />
								<b>{t('profileItemPassports')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

					<button className="profile-row" onClick={onOpenPayments} type="button">
						<span className="profile-row-left">
							<Image alt="Payments" className="profile-row-icon" height={24} src="/assets/icon-settings-payments.svg" unoptimized width={24} />
							<b>{t('profileItemPayments')}</b>
						</span>
						<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
					</button>
					</div>
				</section>

				<section className="profile-section" aria-label={t('profileSectionExtra')}>
					<h2>{t('profileSectionExtra')}</h2>
					<div className="profile-list">
					<button className="profile-row" onClick={onOpenNotifications} type="button">
						<span className="profile-row-left">
							<Image alt="Notifications" className="profile-row-icon" height={24} src="/assets/icon-settings-notifications.svg" unoptimized width={24} />
							<b>{t('profileItemNotifications')}</b>
						</span>
						<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
					</button>

					<button className="profile-row" onClick={onOpenSupport} type="button">
						<span className="profile-row-left">
							<Image alt="Support" className="profile-row-icon" height={24} src="/assets/icon-settings-support.svg" unoptimized width={24} />
							<b>{t('profileItemHelp')}</b>
						</span>
						<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
					</button>

						<button className="profile-row" onClick={onOpenDeveloper} type="button">
							<span className="profile-row-left">
								<Image alt="Developer mode" className="profile-row-icon" height={24} src="/assets/icon-settings-profile.svg" unoptimized width={24} />
								<b>{t('profileItemDeveloperMode')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>
					</div>
				</section>
			</div>

			<DesktopRail />

			<HomeTabbar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={() => {}} />
		</section>
	)
}

// Render passport camera scanner step from Figma node 520:15963.
function PassportCameraScreen ({ onBack, onCapture }: { onBack: () => void, onCapture: () => void }) {
	const { locale, t } = useI18n()
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const [isReady, setIsReady] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true

		// Start rear camera stream for passport scanning.
		navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
			.then((stream) => {
				if(!active) { stream.getTracks().forEach((track) => track.stop()); return }
				streamRef.current = stream
				if(videoRef.current) {
					videoRef.current.srcObject = stream
					videoRef.current.play().then(() => { if(active) setIsReady(true) })
				}
			})
			.catch((err) => { if(active) setError(err instanceof Error ? err.message : 'Camera unavailable') })

		return () => {
			active = false
			streamRef.current?.getTracks().forEach((track) => track.stop())
			streamRef.current = null
		}
	}, [])

	// Capture current frame before moving into recognition state.
	const capture = () => {
		const video = videoRef.current
		const canvas = canvasRef.current
		if(video && canvas) {
			canvas.width = video.videoWidth
			canvas.height = video.videoHeight
			canvas.getContext('2d')?.drawImage(video, 0, 0)
		}
		onCapture()
	}

	return (
		<section aria-label="Passport camera" className="passport-camera-screen">
			<video autoPlay className="passport-camera-video" muted playsInline ref={videoRef} />
			<canvas className="passport-camera-canvas" ref={canvasRef} />
			<button aria-label={t('profileDataBack')} className="passport-camera-back" onClick={onBack} type="button">
				<Image alt="Back" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
			</button>

			<div className="passport-camera-frame" role="presentation">
				<i />
				<i />
				<i />
				<i />
				<span />
			</div>

			<p>{PASSPORT_SCAN_TEXT[locale].cameraHint}</p>
			{error ? <strong className="passport-camera-error">{error}</strong> : null}

			<div className="passport-camera-controls">
				<button aria-label={t('notificationsClose')} className="passport-camera-close" onClick={onBack} type="button" />
				<button aria-label="Capture" className="passport-camera-shutter" disabled={!isReady} onClick={capture} type="button" />
				<button aria-label="Flash" className="passport-camera-flash" type="button" />
			</div>

		</section>
	)
}

// Render temporary passport recognition state before manual data edit.
function PassportRecognitionScreen ({ onBack }: { onBack: () => void }) {
	const { locale, t } = useI18n()
	const copy = PASSPORT_SCAN_TEXT[locale]

	return (
		<section aria-label="Passport recognition" className="visa-screen">
			<div className="visa-scroll passport-recognition-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={42} />

					<div className="visa-copy">
						<h1>{copy.checkingTitle}</h1>
						<p>{copy.checkingSubtitle}</p>
					</div>
				</header>

				<div className="passport-recognition-picture" role="presentation" />

				<div className="passport-recognition-loader">
					<p>{copy.searching}</p>
					<i />
				</div>
			</div>
		</section>
	)
}

// Render first personal-data visa form from Figma node 520:15627.
function VisaPersonalOneScreen ({ personal, onBack, onHome, onContinue, canContinue, onChange }: { personal: typeof VISA_PERSONAL_TEXT[LocaleCode], onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onChange: (field: keyof typeof VISA_PERSONAL_TEXT[LocaleCode], value: string) => void }) {
	const { t } = useI18n()
	const copy = personal
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Personal data" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<VisaPersonalHeader copy={copy} onBack={onBack} onHome={onHome} progressClass="is-half" />
				<div className="visa-personal-form">
					<LivingField icon="search" label={copy.birthPlace} onChange={(v) => onChange('birthPlaceValue', v)} options={BIRTH_PLACE_OPTIONS} required showError={attempted} value={copy.birthPlaceValue} />
					<LivingField icon="chevron" label={copy.marital} onChange={(v) => onChange('maritalValue', v)} options={MARITAL_OPTIONS} required showError={attempted} value={copy.maritalValue} />
					<LivingField icon="search" label={copy.profession} onChange={(v) => onChange('professionValue', v)} options={PROFESSION_OPTIONS} required showError={attempted} value={copy.professionValue} />
					<LivingField label={copy.employer} onChange={(v) => onChange('employerValue', v)} required showError={attempted} value={copy.employerValue} />
					<LivingField icon="search" label={copy.workAddress} onChange={(v) => onChange('workAddressValue', v)} required showError={attempted} value={copy.workAddressValue} />
				</div>
			</div>

			<div className="visa-bottom">
				<ContinueButton canContinue={canContinue} className="passport-primary" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onContinue} />
			</div>
		</section>
	)
}

// Render second personal-data visa form from Figma node 520:15639.
function VisaPersonalTwoScreen ({ personal, onBack, onHome, onContinue, canContinue, onChange }: { personal: typeof VISA_PERSONAL_TEXT[LocaleCode], onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onChange: (field: keyof typeof VISA_PERSONAL_TEXT[LocaleCode], value: string) => void }) {
	const { t } = useI18n()
	const copy = personal
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Personal data" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<VisaPersonalHeader copy={copy} onBack={onBack} onHome={onHome} progressClass="is-full" />
				<div className="visa-personal-form">
					<LivingField icon="search" label={copy.residenceAddress} onChange={(v) => onChange('residenceAddressValue', v)} options={CITY_OPTIONS} required showError={attempted} value={copy.residenceAddressValue} />
					<LivingField label={copy.phone} onChange={(v) => onChange('phoneValue', v)} required showError={attempted} value={copy.phoneValue} />
					<LivingField label={copy.email} onChange={(v) => onChange('emailValue', v)} required showError={attempted} value={copy.emailValue} />
				</div>

				<ContinueButton canContinue={canContinue} className="passport-primary visa-personal-inline-button" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onContinue} />
			</div>
		</section>
	)
}

// Render shared personal-data toolbar and title area.
function VisaPersonalHeader ({ copy, progressClass, onBack, onHome }: { copy: (typeof VISA_PERSONAL_TEXT)[LocaleCode], progressClass: string, onBack: () => void, onHome: () => void }) {
	const { t } = useI18n()

	return (
		<header className="visa-toolbar">
			<div className="visa-toolbar-controls">
				<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
					<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
				</button>
				<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
					<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
				</button>
			</div>

			<VisaProgressTrip value={progressClass === 'is-half' ? 48 : 54} />

			<div className="visa-copy">
				<h1>{copy.title}</h1>
				<p>{copy.subtitle}</p>
			</div>
		</header>
	)
}

// Render animated trip-flow progress with continuity across screen remounts.
function VisaProgressTrip ({ value }: { value: number }) {
	const [progress, setProgress] = useState(lastVisaTripProgress)

	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			setProgress(value)
			lastVisaTripProgress = value
		})
		return () => cancelAnimationFrame(frame)
	}, [value])

	return <div className="visa-progress visa-progress-trip" role="presentation" style={{ '--visa-progress': `${progress}%` } as CSSProperties} />
}

// Render one live field row with optional calendar or dropdown sheet.
function LivingField ({ icon, label, value, options, required, showError, onChange }: { icon?: FieldIcon, label: string, value: string, options?: string[], required?: boolean, showError?: boolean, onChange: (v: string) => void }) {
	const iconSrc = icon === 'search' ? '/assets/icon-search.svg' : icon === 'calendar' ? '/assets/icon-calendar.svg' : '/assets/icon-chevron-down.svg'
	const [sheet, setSheet] = useState<'calendar' | 'options' | 'search' | null>(null)
	const isInvalid = Boolean(showError && required && !value.trim())
	const openSheet = () => {
		if(icon === 'calendar') setSheet('calendar')
		if(icon === 'chevron') setSheet('options')
		if(icon === 'search' && options) setSheet('search')
	}

	return (
		<div className={`visa-personal-field${isInvalid ? ' is-invalid' : ''}`}>
			<label>{label}</label>
			<div className={`profile-data-input${icon ? ' with-right-icon' : ''}`}>
				<input onChange={(event) => onChange(event.target.value)} onFocus={openSheet} type="text" value={value} />
				{icon ? <button aria-label={label} className="field-icon-btn" onClick={openSheet} type="button"><Image alt="Field icon" height={24} src={iconSrc} unoptimized width={24} /></button> : null}
			</div>
			{sheet === 'calendar' ? <CalendarSheet onClose={() => setSheet(null)} onSelect={(next) => { onChange(next); setSheet(null) }} value={value} /> : null}
			{sheet === 'options' ? <OptionSheet onClose={() => setSheet(null)} onSelect={(next) => { onChange(next); setSheet(null) }} options={options ?? [value]} value={value} /> : null}
			{sheet === 'search' ? <SearchSheet label={label} onClose={() => setSheet(null)} onSelect={(next) => { onChange(next); setSheet(null) }} options={options ?? [value]} value={value} /> : null}
		</div>
	)
}

// Render selectable option list as an app-local bottom sheet.
function OptionSheet ({ options, value, onSelect, onClose }: { options: string[], value: string, onSelect: (v: string) => void, onClose: () => void }) {
	return (
		<div className="field-sheet-backdrop" onClick={onClose}>
			<div className="field-sheet" onClick={(event) => event.stopPropagation()}>
				{options.map((option) => <button className={option === value ? 'is-active' : ''} key={option} onClick={() => onSelect(option)} type="button">{option}</button>)}
			</div>
		</div>
	)
}

// Render searchable option picker for country, city and profession databases.
function SearchSheet ({ label, options, value, onSelect, onClose }: { label: string, options: string[], value: string, onSelect: (v: string) => void, onClose: () => void }) {
	const [query, setQuery] = useState('')
	const normalized = query.trim().toLocaleLowerCase('ru')
	const customValue = query.trim()
	const filtered = normalized ? options.filter((option) => option.toLocaleLowerCase('ru').includes(normalized)) : options

	return (
		<div className="field-sheet-backdrop" onClick={onClose}>
			<div className="field-sheet search-sheet" onClick={(event) => event.stopPropagation()}>
				<header>
					<strong>{label}</strong>
					<button aria-label="Close" onClick={onClose} type="button">×</button>
				</header>
				<div className="search-sheet-input">
					<Image alt="Search" height={20} src="/assets/icon-search.svg" unoptimized width={20} />
					<input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" type="text" value={query} />
				</div>
				<div className="search-sheet-results">
					{customValue ? <button className="search-sheet-custom" onClick={() => onSelect(customValue)} type="button">{customValue}</button> : null}
					{filtered.map((option) => <button className={option === value ? 'is-active' : ''} key={option} onClick={() => onSelect(option)} type="button">{option}</button>)}
					{filtered.length === 0 ? <p className="search-sheet-empty">Ничего не найдено</p> : null}
				</div>
			</div>
		</div>
	)
}

// Render calendar widget for dd.mm.yyyy date fields.
function CalendarSheet ({ value, onSelect, onClose }: { value: string, onSelect: (v: string) => void, onClose: () => void }) {
	const { locale } = useI18n()
	const selected = parseUiDate(value)
	const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
	const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)

	return (
		<div className="field-sheet-backdrop" onClick={onClose}>
			<div className="calendar-sheet" onClick={(event) => event.stopPropagation()}>
				<header>
					<button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} type="button">‹</button>
					<strong>{monthTitle}</strong>
					<button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} type="button">›</button>
				</header>
				<div className="calendar-weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
				<div className="calendar-grid">
					{resolveCalendarDays(month).map((day, index) => day ? (
						<button className={formatUiDate(new Date(month.getFullYear(), month.getMonth(), day)) === value ? 'is-active' : ''} key={`${month.getMonth()}-${day}`} onClick={() => onSelect(formatUiDate(new Date(month.getFullYear(), month.getMonth(), day)))} type="button">{day}</button>
					) : <span key={`blank-${index}`} />)}
				</div>
			</div>
		</div>
	)
}

// Render trip data form from Figma node 520:15649.
function VisaTripScreen ({ trip, onBack, onHome, onContinue, canContinue, onChange }: { trip: TripData, onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onChange: (field: keyof TripData, value: string) => void }) {
	const { t } = useI18n()
	const copy = trip
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Trip data" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={55} />

					<div className="visa-copy">
						<h1>{copy.title}</h1>
						<p>{copy.subtitle}</p>
					</div>
				</header>

				<div className="visa-personal-form">
					<LivingField icon="chevron" label={copy.purpose} onChange={(v) => onChange('purposeValue', v)} options={PURPOSE_OPTIONS} required showError={attempted} value={copy.purposeValue} />
					<LivingField icon="calendar" label={copy.entryDate} onChange={(v) => onChange('dateValue', v)} required showError={attempted} value={copy.dateValue} />
					<LivingField icon="calendar" label={copy.exitDate} onChange={(v) => onChange('exitDateValue', v)} required showError={attempted} value={copy.exitDateValue} />
					<LivingField icon="search" label={copy.residenceCountry} onChange={(v) => onChange('residenceCountryValue', v)} options={COUNTRY_OPTIONS} required showError={attempted} value={copy.residenceCountryValue} />
					<LivingField icon="chevron" label={copy.prevVisas} onChange={(v) => onChange('prevVisasValue', v)} options={YES_NO_OPTIONS} required showError={attempted} value={copy.prevVisasValue} />
				</div>

				<ContinueButton canContinue={canContinue} className="passport-primary visa-personal-inline-button" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onContinue} />
			</div>
		</section>
	)
}

// Render photo upload entry screen from Figma node 593:9070.
function VisaPhotoScreen ({ onBack, onHome, onUpload, onCamera }: { onBack: () => void, onHome: () => void, onUpload: (dataUrl: string) => void, onCamera: () => void }) {
	const { locale, t } = useI18n()
	const copy = VISA_PHOTO_TEXT[locale]
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	// Convert selected file to data URL and pass up.
	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if(!file) return
		const reader = new FileReader()
		reader.onload = () => onUpload(reader.result as string)
		reader.readAsDataURL(file)
	}

	return (
		<section aria-label="Photo upload" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={66} />

					<div className="visa-copy">
						<h1>{copy.title}</h1>
						<p>{copy.subtitle}</p>
					</div>
				</header>

				<div className="visa-photo-reqs">
					<h2>{copy.reqTitle}</h2>
					<ul>
						<li><b>{copy.req1}</b></li>
						<li>{copy.req2}</li>
						<li>{copy.req3}</li>
						<li>{copy.req4}</li>
						<li>{copy.req5}</li>
					</ul>
				</div>

				<div className="visa-photo-actions">
					<input accept="image/*" className="visa-photo-file-input" onChange={handleFileChange} ref={fileInputRef} type="file" />
					<button className="passport-primary" onClick={() => fileInputRef.current?.click()} type="button">{copy.upload}</button>
					<button className="visa-secondary-button" onClick={onCamera} type="button">{copy.camera}</button>
				</div>
			</div>
		</section>
	)
}

// Render fullscreen camera screen from Figma node 520:15990.
function VisaPhotoCameraScreen ({ onBack, onCapture }: { onBack: () => void, onCapture: (dataUrl: string) => void }) {
	const { locale } = useI18n()
	const copy = VISA_PHOTO_TEXT[locale]
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const [isReady, setIsReady] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true

		// Start front camera stream via WebRTC getUserMedia.
		navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
			.then((stream) => {
				if(!active) { stream.getTracks().forEach((t) => t.stop()); return }
				streamRef.current = stream
				if(videoRef.current) {
					videoRef.current.srcObject = stream
					videoRef.current.play().then(() => { if(active) setIsReady(true) })
				}
			})
			.catch((err) => { if(active) setError(err instanceof Error ? err.message : 'Camera unavailable') })

		return () => {
			active = false
			streamRef.current?.getTracks().forEach((t) => t.stop())
			streamRef.current = null
		}
	}, [])

	// Capture current video frame to canvas and return data URL.
	const capture = () => {
		const video = videoRef.current
		const canvas = canvasRef.current
		if(!video || !canvas) return
		canvas.width = video.videoWidth
		canvas.height = video.videoHeight
		canvas.getContext('2d')?.drawImage(video, 0, 0)
		onCapture(canvas.toDataURL('image/jpeg', 0.92))
	}

	return (
		<section aria-label="Camera" className="visa-photo-camera-screen">
			<video autoPlay className="visa-photo-camera-video" muted playsInline ref={videoRef} />
			<canvas className="visa-photo-camera-canvas" ref={canvasRef} />

			{/* Dark overlay with face cutout */}
			<div aria-hidden className="visa-photo-camera-overlay">
				<div className="visa-photo-camera-cutout" />
			</div>

			{/* Corner markers */}
			<div aria-hidden className="visa-photo-camera-corners">
				<i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
			</div>

			{/* Back button */}
			<button aria-label="Back" className="visa-photo-camera-back" onClick={onBack} type="button">
				<svg fill="none" height="24" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
					<polyline points="15 18 9 12 15 6" />
				</svg>
			</button>

			{/* Hint text */}
			<p className="visa-photo-camera-hint">{copy.cameraHint}</p>

			{/* Camera controls */}
			{error ? (
				<p className="visa-photo-camera-error">{error}</p>
			) : (
				<div className="visa-photo-camera-controls">
					<span />
					<button aria-label="Capture" className="visa-photo-camera-shutter" disabled={!isReady} onClick={capture} type="button">
						<span />
					</button>
					<span />
				</div>
			)}
		</section>
	)
}

// Render photo verification screen from Figma node 527:16358.
function VisaPhotoCheckScreen ({ photoDataUrl, onBack, onHome, onDone }: { photoDataUrl: string, onBack: () => void, onHome: () => void, onDone: () => void }) {
	const { locale, t } = useI18n()
	const copy = VISA_PHOTO_TEXT[locale]

	useEffect(() => {
		// Simulate check duration then auto-advance.
		const timer = window.setTimeout(() => onDone(), 2500)
		return () => window.clearTimeout(timer)
	}, [onDone])

	return (
		<section aria-label="Photo check" className="visa-screen">
			<div className="visa-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={78} />

					<div className="visa-copy">
						<h1>{copy.checkTitle}</h1>
						<p>{copy.checkSubtitle}</p>
					</div>
				</header>

				<div className="visa-photo-preview">
					{photoDataUrl ? <Image alt="Uploaded photo" height={406} src={photoDataUrl} unoptimized width={370} /> : null}
				</div>

				<div className="visa-photo-loader">
					<p>{copy.checking}</p>
					<span className="visa-photo-spinner" />
				</div>
			</div>
		</section>
	)
}

// Shared progress bar for Step 8.x review screens — 3 complete dots/bars, current bar filling.
function ReviewProgress ({ subStep }: { subStep: 1 | 2 | 3 | 4 }) {
	return <VisaProgressTrip value={78 + subStep * 4} />
}

// One editable text field row for review screens.
function ReviewField ({ label, value, icon, options, required, showError, onChange }: { label: string, value: string, icon?: FieldIcon, options?: string[], required?: boolean, showError?: boolean, onChange: (v: string) => void }) {
	return <LivingField icon={icon} label={label} onChange={onChange} options={options} required={required} showError={showError} value={value} />
}

// One file attachment row for review trip/photo screens.
function ReviewFileField ({ label, filename, viewLabel, replaceLabel }: { label: string, filename: string, viewLabel: string, replaceLabel: string }) {
	return (
		<div className={`visa-personal-field${filename ? '' : ' is-invalid'}`}>
			<label>{label}</label>
			<div className="review-file-field">
				<div className="review-file-row">
					<svg aria-hidden fill="none" height="24" stroke="rgb(0 29 71 / 0.52)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
					</svg>
					<span className="review-file-name">{filename}</span>
					<button className="review-file-link" type="button">{viewLabel}</button>
				</div>
				<button className="review-file-replace" type="button">{replaceLabel}</button>
			</div>
		</div>
	)
}

// Render Step 8.1 — passport data review from Figma node 592:8395.
function VisaReviewPassportScreen ({ passport, onBack, onHome, onContinue, canContinue, onChange }: { passport: PassportEntry, onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onChange: (field: keyof PassportEntry, value: string) => void }) {
	const { t } = useI18n()
	const [attempted, setAttempted] = useState(false)
	return (
		<section aria-label="Review passport" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<ReviewProgress subStep={1} />
					<div className="visa-copy">
						<h1><span className="review-title-sub">{'Проверьте заявку'}</span>{'\nПаспортные данные'}</h1>
						<p>{'Проверьте данные и при необходимости внесите изменения в соответствующие поля.'}</p>
					</div>
				</header>
				<div className="visa-personal-form">
					<ReviewField icon="search" label={t('passportCitizenship')} onChange={(v) => onChange('citizenship', v)} options={COUNTRY_OPTIONS} required showError={attempted} value={passport.citizenship} />
					<ReviewField label={t('profileDataFirstName')} onChange={(v) => onChange('firstName', v)} required showError={attempted} value={passport.firstName} />
					<ReviewField label={t('profileDataLastName')} onChange={(v) => onChange('lastName', v)} required showError={attempted} value={passport.lastName} />
					<ReviewField icon="calendar" label={t('passportBirthDate')} onChange={(v) => onChange('birthDate', v)} required showError={attempted} value={passport.birthDate} />
					<ReviewField icon="chevron" label={t('passportGender')} onChange={(v) => onChange('gender', v)} options={GENDER_OPTIONS} required showError={attempted} value={passport.gender} />
					<ReviewField label={t('passportNumber')} onChange={(v) => onChange('passportNumber', v)} required showError={attempted} value={passport.passportNumber} />
					<ReviewField icon="calendar" label={t('passportIssueDate')} onChange={(v) => onChange('issueDate', v)} required showError={attempted} value={passport.issueDate} />
					<ReviewField icon="calendar" label={t('passportExpiryDate')} onChange={(v) => onChange('expiryDate', v)} required showError={attempted} value={passport.expiryDate} />
					<ReviewField icon="chevron" label={t('passportIssuedBy')} onChange={(v) => onChange('issuedBy', v)} required showError={attempted} value={passport.issuedBy} />
				</div>
			</div>
			<div className="visa-bottom">
				<ContinueButton canContinue={canContinue} className="passport-primary" label="Сохранить и продолжить" onAttempt={() => setAttempted(true)} onContinue={onContinue} />
			</div>
		</section>
	)
}

// Render Step 8.2 — personal data review from Figma node 592:8429.
function VisaReviewPersonalScreen ({ personal, onBack, onHome, onContinue, canContinue, onChange }: { personal: typeof VISA_PERSONAL_TEXT[LocaleCode], onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onChange: (field: keyof typeof VISA_PERSONAL_TEXT[LocaleCode], value: string) => void }) {
	const { t } = useI18n()
	const [attempted, setAttempted] = useState(false)
	return (
		<section aria-label="Review personal" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<ReviewProgress subStep={2} />
					<div className="visa-copy">
						<h1><span className="review-title-sub">{'Проверьте заявку'}</span>{'\nЛичные данные'}</h1>
						<p>{'Проверьте данные и при необходимости внесите изменения в соответствующие поля.'}</p>
					</div>
				</header>
				<div className="visa-personal-form">
					<ReviewField icon="search" label={personal.birthPlace} onChange={(v) => onChange('birthPlaceValue', v)} options={BIRTH_PLACE_OPTIONS} required showError={attempted} value={personal.birthPlaceValue} />
					<ReviewField icon="chevron" label={personal.marital} onChange={(v) => onChange('maritalValue', v)} options={MARITAL_OPTIONS} required showError={attempted} value={personal.maritalValue} />
					<ReviewField icon="search" label={personal.profession} onChange={(v) => onChange('professionValue', v)} options={PROFESSION_OPTIONS} required showError={attempted} value={personal.professionValue} />
					<ReviewField label={personal.employer} onChange={(v) => onChange('employerValue', v)} required showError={attempted} value={personal.employerValue} />
					<ReviewField icon="search" label={personal.workAddress} onChange={(v) => onChange('workAddressValue', v)} required showError={attempted} value={personal.workAddressValue} />
					<ReviewField icon="search" label={personal.residenceAddress} onChange={(v) => onChange('residenceAddressValue', v)} options={CITY_OPTIONS} required showError={attempted} value={personal.residenceAddressValue} />
					<ReviewField label={personal.phone} onChange={(v) => onChange('phoneValue', v)} required showError={attempted} value={personal.phoneValue} />
					<ReviewField label={personal.email} onChange={(v) => onChange('emailValue', v)} required showError={attempted} value={personal.emailValue} />
				</div>
			</div>
			<div className="visa-bottom">
				<ContinueButton canContinue={canContinue} className="passport-primary" label="Сохранить и продолжить" onAttempt={() => setAttempted(true)} onContinue={onContinue} />
			</div>
		</section>
	)
}

// Render Step 8.3 — trip data review from Figma node 592:8445.
function VisaReviewTripScreen ({ trip, docs, onBack, onHome, onContinue, canContinue, onTripChange }: { trip: typeof VISA_TRIP_TEXT[LocaleCode], docs: typeof VISA_DOCS_TEXT[LocaleCode], onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onTripChange: (field: keyof typeof VISA_TRIP_TEXT[LocaleCode], value: string) => void }) {
	const { t } = useI18n()
	const [attempted, setAttempted] = useState(false)
	return (
		<section aria-label="Review trip" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<ReviewProgress subStep={3} />
					<div className="visa-copy">
						<h1><span className="review-title-sub">{'Проверьте заявку'}</span>{'\nДанные о поездке'}</h1>
						<p>{'Проверьте данные и при необходимости внесите изменения в соответствующие поля.'}</p>
					</div>
				</header>
				<div className="visa-personal-form">
					<ReviewField icon="chevron" label={trip.purpose} onChange={(v) => onTripChange('purposeValue', v)} options={PURPOSE_OPTIONS} required showError={attempted} value={trip.purposeValue} />
					<ReviewField icon="calendar" label={trip.entryDate} onChange={(v) => onTripChange('dateValue', v)} required showError={attempted} value={trip.dateValue} />
					<ReviewField icon="calendar" label={trip.exitDate} onChange={(v) => onTripChange('exitDateValue', v)} required showError={attempted} value={trip.exitDateValue} />
					<ReviewField icon="search" label={trip.residenceCountry} onChange={(v) => onTripChange('residenceCountryValue', v)} options={COUNTRY_OPTIONS} required showError={attempted} value={trip.residenceCountryValue} />
					<ReviewField icon="chevron" label={trip.prevVisas} onChange={(v) => onTripChange('prevVisasValue', v)} options={YES_NO_OPTIONS} required showError={attempted} value={trip.prevVisasValue} />
					<ReviewFileField filename={docs.hotelFile} label={docs.hotel} replaceLabel={'Заменить бронирование отеля'} viewLabel={'Посмотреть'} />
					<ReviewFileField filename={docs.flightsFile} label={docs.flights} replaceLabel={'Заменить бронирование авиабилетов'} viewLabel={'Посмотреть'} />
					<ReviewFileField filename={docs.insuranceFile} label={docs.insurance} replaceLabel={'Заменить медицинскую страховку'} viewLabel={'Посмотреть'} />
				</div>
			</div>
			<div className="visa-bottom">
				<ContinueButton canContinue={canContinue} className="passport-primary" label="Сохранить и продолжить" onAttempt={() => setAttempted(true)} onContinue={onContinue} />
			</div>
		</section>
	)
}

// Render Step 8.4 — photo review from Figma node 520:15771.
function VisaReviewPhotoScreen ({ photoDataUrl, onBack, onHome, onContinue, onReplace }: { photoDataUrl: string, onBack: () => void, onHome: () => void, onContinue: () => void, onReplace: () => void }) {
	const { t } = useI18n()
	const [showPhoto, setShowPhoto] = useState(false)
	return (
		<section aria-label="Review photo" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<ReviewProgress subStep={4} />
					<div className="visa-copy">
						<h1><span className="review-title-sub">{'Проверьте заявку'}</span>{'\nВаша фотография'}</h1>
						<p>{'Проверьте данные и при необходимости внесите изменения в соответствующие поля.'}</p>
					</div>
				</header>
				<div className="visa-personal-form">
					<div className="visa-personal-field">
						<label>{'Фотография'}</label>
						<div className="review-file-field">
							<div className="review-file-row">
								<svg aria-hidden fill="none" height="24" stroke="rgb(0 29 71 / 0.52)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
									<polyline points="14 2 14 8 20 8" />
								</svg>
								<span className="review-file-name">{'photo.jpeg'}</span>
								<button className="review-file-link" onClick={() => setShowPhoto((v) => !v)} type="button">{'Посмотреть'}</button>
							</div>
						</div>
						<button className="review-file-replace" onClick={onReplace} type="button">{'Заменить фотографию'}</button>
					</div>
					{showPhoto && photoDataUrl ? (
						<div className="visa-photo-preview">
							<Image alt="Your photo" height={406} src={photoDataUrl} unoptimized width={370} />
						</div>
					) : null}
				</div>
			</div>
			<div className="visa-bottom">
				<button className="passport-primary" onClick={onContinue} type="button">{'Сохранить и продолжить'}</button>
			</div>
		</section>
	)
}

// Render Step 9 — visa applicants list from Figma node 520:15780.
function VisaApplicantsScreen ({ applicants, visaTitle, isEditable, onBack, onHome, onAddApplicant, onEditApplicant, onDeleteApplicant, onCancelApplication, onContinue, canContinue }: { applicants: VisaApplicant[], visaTitle: string, isEditable: boolean, onBack: () => void, onHome: () => void, onAddApplicant: () => void, onEditApplicant: (index: number) => void, onDeleteApplicant: (index: number) => void, onCancelApplication: () => void, onContinue: () => void, canContinue?: boolean }) {
	const { t } = useI18n()
	const visaLabel = visaTitle
	const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
	const [isCancelOpen, setIsCancelOpen] = useState(false)
	const deleteApplicant = () => {
		if(deleteIndex === null) return
		onDeleteApplicant(deleteIndex)
		setDeleteIndex(null)
	}

	return (
		<section aria-label="Visa applicants" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<VisaProgressTrip value={88} />
					<div className="visa-copy">
						<h1>{'Заявители на визу'}</h1>
						<p>{isEditable ? 'Вы можете добавить несколько заявителей или перейти к следующему этапу.' : 'Заявка уже отправлена на проверку. Изменение заявителей недоступно.'}</p>
					</div>
				</header>
				<div className="applicants-list">
					{applicants.map((applicant, index) => (
						<div className="applicant-card" key={index}>
							<div className="applicant-badge">{'100% заполнено'}</div>
							<div className="applicant-info">
								<span className="applicant-name">{applicant.passport.fullName || `${applicant.passport.firstName} ${applicant.passport.lastName}`.trim() || 'Заявитель'}</span>
								<span className="applicant-detail">{`Номер загранпаспорта: ${applicant.passport.passportNumber || '—'}`}</span>
								<span className="applicant-detail">{visaLabel}</span>
							</div>
							{isEditable ? <div className="applicant-actions">
								<button className="applicant-btn" onClick={() => onEditApplicant(index)} type="button">{'Изменить'}</button>
								<button className="applicant-btn applicant-btn-delete" onClick={() => setDeleteIndex(index)} type="button">{'Удалить'}</button>
							</div> : null}
						</div>
					))}
					{isEditable ? <div className="applicant-card applicant-card-add">
						<div className="applicant-info">
							<span className="applicant-name">{'Добавьте заявителя'}</span>
							<span className="applicant-detail">{visaLabel}</span>
						</div>
						<div className="applicant-actions">
							<button className="applicant-btn applicant-btn-add" onClick={onAddApplicant} type="button">
								<svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg>
								{'Добавить'}
							</button>
						</div>
					</div> : null}
					{isEditable ? <button className="application-cancel-btn" onClick={() => setIsCancelOpen(true)} type="button">{'Отменить заявление'}</button> : null}
				</div>
			</div>
		<div className="visa-bottom">
			<ContinueButton canContinue={canContinue} className="passport-primary" label={isEditable ? 'Сохранить и продолжить' : 'Продолжить'} onContinue={onContinue} />
		</div>
			{deleteIndex !== null ? <ConfirmDrawer confirmLabel="Удалить" title="Удалить заявителя?" subtitle="Данные заявителя будут удалены из этого заявления." onCancel={() => setDeleteIndex(null)} onConfirm={deleteApplicant} /> : null}
			{isCancelOpen ? <ConfirmDrawer confirmLabel="Отменить заявление" title="Отменить заявление?" subtitle="Черновик заявления и добавленные заявители будут удалены." onCancel={() => setIsCancelOpen(false)} onConfirm={onCancelApplication} /> : null}
		</section>
	)
}

// Render destructive confirmation drawer inside current app screen.
function ConfirmDrawer ({ title, subtitle, confirmLabel, onCancel, onConfirm }: { title: string, subtitle: string, confirmLabel: string, onCancel: () => void, onConfirm: () => void }) {
	return (
		<div className="profile-drawer-backdrop">
			<div className="profile-drawer-sheet" role="dialog" aria-modal="true" aria-label={title}>
				<header className="profile-drawer-header">
					<h3>{title}</h3>
					<button className="profile-drawer-close" onClick={onCancel} type="button">
						<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
						</svg>
					</button>
				</header>
				<p className="profile-drawer-subtitle">{subtitle}</p>
				<div className="profile-drawer-actions">
					<button className="profile-drawer-delete" onClick={onConfirm} type="button">{confirmLabel}</button>
					<button className="profile-drawer-cancel" onClick={onCancel} type="button">{'Оставить'}</button>
				</div>
			</div>
		</div>
	)
}

// Render Step 10 — final application summary and payment selection.
function VisaPaymentScreen ({ applicants, visaType, visaDestination, visaTitle, selectedPayment, onBack, onHome, onSelectPayment, onPay }: { applicants: VisaApplicant[], visaType: VisaTypeCode, visaDestination: VisaDestinationCode, visaTitle: string, selectedPayment: PaymentMethodCode, onBack: () => void, onHome: () => void, onSelectPayment: (method: PaymentMethodCode) => void, onPay: () => void }) {
	const { t } = useI18n()
	const detail = VISA_TYPE_DETAILS[visaDestination][visaType]
	const methods: { code: PaymentMethodCode, title: string, subtitle: string, badge?: string }[] = [
		{ code: 'sbp', title: 'Через СБП', subtitle: 'В приложении банка.', badge: 'Популярное' },
		{ code: 'card-new', title: 'Новой картой', subtitle: 'Введите данные карты.', badge: 'МИР / Visa / MasterCard' },
		{ code: 'card-saved', title: 'Сохраненной картой', subtitle: 'Оплатите ранее добавленной картой.' },
		{ code: 'yoomoney', title: 'ЮMoney', subtitle: 'Через кошелек ЮMoney.' },
		{ code: 'sberpay', title: 'SberPay', subtitle: 'В приложении СберБанк Онлайн.' },
	]

	return (
		<section aria-label="Visa payment" className="visa-screen">
			<div className="visa-scroll visa-payment-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<VisaProgressTrip value={94} />
					<div className="visa-copy">
						<h1>{'Отправка на проверку'}</h1>
						<p>{'Ещё раз проверьте детали и отправьте данные на проверку.'}</p>
					</div>
				</header>

				<section aria-label="Visa application summary" className="payment-summary-card">
					<div className="payment-summary-section">
						<h2>{visaTitle}</h2>
						<div className="payment-detail-grid">
							<span>{'Срок действия визы'}</span><b>{`${detail.durationDays} дней`}</b>
							<span>{'Срок пребывания'}</span><b>{`${Math.min(detail.durationDays, 90)} дней`}</b>
							<span>{'Въезд'}</span><b>{detail.entryKey === 'multiple' ? 'Многократный' : 'Однократный'}</b>
							<span>{'Консульский сбор'}</span><b>{detail.consularFee}</b>
						</div>
					</div>
					<div className="payment-summary-section">
						<h2>{'Заявители'}</h2>
						{applicants.map((applicant, index) => (
							<div className="payment-applicant" key={index}>
								<span>{applicant.passport.fullName || `${applicant.passport.firstName} ${applicant.passport.lastName}`.trim() || 'Заявитель'}</span>
								<b>{applicant.passport.passportNumber || '—'}</b>
							</div>
						))}
					</div>
				</section>

				<section aria-label="Payment method" className="payment-methods">
					<h2>{'Способ оплаты'}</h2>
					<div className="payment-method-list">
						{methods.map((method) => (
							<button className={`payment-method-card${selectedPayment === method.code ? ' is-active' : ''}`} key={method.code} onClick={() => onSelectPayment(method.code)} type="button">
								<div className="payment-method-copy">
									{method.badge ? <span className="payment-method-badge">{method.badge}</span> : null}
									<strong>{method.title}</strong>
									<span>{method.subtitle}</span>
								</div>
								<i className="payment-radio" />
							</button>
						))}
					</div>
				</section>

				<section aria-label="Payment composition" className="payment-composition-card">
					<h2>{'Состав платежа'}</h2>
					<div className="payment-row">
						<span>{`Сервисный сбор × ${Math.max(applicants.length, 1)}`}</span>
						<b>{'1358.28₽'}</b>
					</div>
				</section>
			</div>
			<div className="visa-bottom">
				<button className="passport-primary" onClick={onPay} type="button">{'Отправить и оплатить 1358.28₽'}</button>
			</div>
		</section>
	)
}

// Render Step 11 — application verification status screen.
function VisaCheckScreen ({ applicant, visaTitle, onBack, onHome }: { applicant: VisaApplicant | null, visaTitle: string, onBack: () => void, onHome: () => void }) {
	const { t } = useI18n()
	const passport = applicant?.passport ?? createPassportDraft()

	return (
		<section aria-label="Visa application check" className="visa-screen visa-check-screen">
			<div className="visa-scroll visa-check-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<VisaProgressTrip value={100} />
					<div className="visa-copy">
						<h1>{'Проверка заявки'}</h1>
						<p>{'Проверка на соответствие требованиям визы. После успешной проверки будет доступно скачивание заполненной анкеты.'}</p>
					</div>
				</header>

				<section aria-label="Application status" className="visa-check-card">
					<span className="visa-check-badge">{'На проверке'}</span>
					<div className="visa-check-card-copy">
						<h2>{passport.fullName || `${passport.firstName} ${passport.lastName}`.trim() || 'Заявитель'}</h2>
						<p>{`Номер загранпаспорта: ${passport.passportNumber || '—'}\n${visaTitle}`}</p>
					</div>
				</section>

				<section aria-label="Checking progress" className="visa-check-loader-block">
					<p>{'Проверяем на ошибки...'}</p>
					<div className="visa-check-loader" />
				</section>

				<div className="visa-check-actions">
					<button className="visa-check-secondary" onClick={onHome} type="button">{'Вернуться на главную страницу'}</button>
				</div>
			</div>
		</section>
	)
}

// Render final verification outcome screen after application checks complete.
function VisaCheckResultScreen ({ applicant, visaTitle, isSuccess, onBack, onHome, onDownload, onEdit }: { applicant: VisaApplicant | null, visaTitle: string, isSuccess: boolean, onBack: () => void, onHome: () => void, onDownload: () => void, onEdit: () => void }) {
	const { t } = useI18n()
	const passport = applicant?.passport ?? createPassportDraft()

	return (
		<section aria-label="Visa check result" className="visa-screen visa-check-screen">
			<div className="visa-scroll visa-check-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<VisaProgressTrip value={100} />
					<div className="visa-copy">
						<h1>{'Проверка заявки'}</h1>
						<p>{'Проверка на соответствие требованиям визы. После успешной проверки будет доступно скачивание заполненной анкеты.'}</p>
					</div>
				</header>

				<section aria-label="Application result" className={`visa-check-card${isSuccess ? ' is-success' : ' is-error'}`}>
					<div className="visa-check-main">
						<span className={`visa-check-badge${isSuccess ? ' is-success' : ' is-error'}`}>{isSuccess ? 'Проверка успешно пройдена' : 'Требуются правки'}</span>
						<div className="visa-check-card-copy">
							<h2>{passport.fullName || `${passport.firstName} ${passport.lastName}`.trim() || 'Заявитель'}</h2>
							<p>{`Номер загранпаспорта: ${passport.passportNumber || '—'}\n${visaTitle}`}</p>
						</div>
					</div>
					{isSuccess ? null : (
						<div className="visa-check-errors">
							<h3>{'Найденные ошибки'}</h3>
							<p>{'Неверно заполненные поля\nв паспорте.\nСтраховка некорректно отображается.'}</p>
							<button onClick={onEdit} type="button">{'Внести изменения'}</button>
						</div>
					)}
				</section>

				<div className="visa-check-actions">
					<button className={`visa-check-primary${isSuccess ? ' is-success' : ' is-disabled'}`} disabled={!isSuccess} onClick={onDownload} type="button">{'Получить готовую анкету'}</button>
					<button className="visa-check-secondary" onClick={onHome} type="button">{isSuccess ? 'Вернуться на главную' : 'Вернуться на главную страницу'}</button>
				</div>
			</div>
		</section>
	)
}

// Render Step 12 — ready documents and appointment selection screen.
function VisaDocumentsReadyScreen ({ applicant, visaTitle, onBack, onHome, onContinue }: { applicant: VisaApplicant | null, visaTitle: string, onBack: () => void, onHome: () => void, onContinue: () => void }) {
	const { t } = useI18n()
	const passport = applicant?.passport ?? createPassportDraft()
	const [center, setCenter] = useState('Москва')
	const [appointmentDate, setAppointmentDate] = useState('16.05.2026')
	const [appointmentTime, setAppointmentTime] = useState('14:00')

	return (
		<section aria-label="Ready visa documents" className="visa-screen">
			<div className="visa-scroll visa-ready-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>
					<VisaProgressTrip value={100} />
					<div className="visa-copy">
						<h1>{'Документы готовы'}</h1>
						<p>{'Мы подготовили вашу анкету — скачайте её и выберите удобное место и время подачи.'}</p>
					</div>
				</header>

				<section aria-label="Ready document card" className="visa-ready-card">
					<div className="visa-check-main">
						<span className="visa-check-badge is-success">{'Готовая виза'}</span>
						<div className="visa-check-card-copy">
							<h2>{passport.fullName || `${passport.firstName} ${passport.lastName}`.trim() || 'Заявитель'}</h2>
							<p>{`Номер загранпаспорта: ${passport.passportNumber || '—'}\n${visaTitle}`}</p>
						</div>
					</div>
					<div className="visa-ready-actions">
						<button type="button">{'Скачать PDF'}</button>
						<button type="button">{'На почту'}</button>
					</div>
				</section>

				<div className="visa-ready-form">
					<VisaReadyField icon="chevron" label="Визовый центр" onChange={setCenter} options={CENTER_OPTIONS} value={center} />
					<VisaReadyField icon="calendar" label="Дата подачи" onChange={setAppointmentDate} value={appointmentDate} />
					<VisaReadyField icon="chevron" label="Время подачи" onChange={setAppointmentTime} options={TIME_OPTIONS} value={appointmentTime} />
				</div>
			</div>
			<div className="visa-bottom visa-ready-bottom">
				<button className="passport-primary" onClick={onContinue} type="button">{'Продолжить'}</button>
			</div>
		</section>
	)
}

// Render appointment field row with the matching trailing icon.
function VisaReadyField ({ label, value, icon, options, onChange }: { label: string, value: string, icon: FieldIcon, options?: string[], onChange: (v: string) => void }) {
	return <div className="visa-ready-field"><LivingField icon={icon} label={label} onChange={onChange} options={options} value={value} /></div>
}

// Render document upload form from Figma node 520:15661.
function VisaDocumentsScreen ({ docs, onBack, onHome, onContinue, canContinue, onDocsChange }: { docs: typeof VISA_DOCS_TEXT['ru'], onBack: () => void, onHome: () => void, onContinue: () => void, canContinue?: boolean, onDocsChange: (field: keyof typeof VISA_DOCS_TEXT['ru'], value: string) => void }) {
	const { locale, t } = useI18n()
	const copy = VISA_DOCS_TEXT[locale]
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Trip documents" className="visa-screen">
			<div className="visa-scroll visa-personal-scroll">
				<header className="visa-toolbar">
					<div className="visa-toolbar-controls">
						<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
							<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
						</button>
						<button aria-label="Home" className="profile-data-icon-button" onClick={onHome} type="button">
							<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
						</button>
					</div>

					<VisaProgressTrip value={66} />

					<div className="visa-copy">
						<h1>{copy.title}</h1>
						<p>{copy.subtitle}</p>
					</div>
				</header>

				<div className="visa-personal-form">
					<VisaDocField filename={docs.hotelFile} label={copy.hotel} showError={attempted} onChange={(value) => onDocsChange('hotelFile', value)} onClear={() => onDocsChange('hotelFile', '')} />
					<VisaDocField filename={docs.flightsFile} label={copy.flights} showError={attempted} onChange={(value) => onDocsChange('flightsFile', value)} onClear={() => onDocsChange('flightsFile', '')} />
					<VisaDocField filename={docs.insuranceFile} label={copy.insurance} showError={attempted} onChange={(value) => onDocsChange('insuranceFile', value)} onClear={() => onDocsChange('insuranceFile', '')} />
				</div>

			<ContinueButton canContinue={canContinue} className="passport-primary visa-personal-inline-button" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onContinue} />
		</div>
	</section>
	)
}

// Render one document upload field with file name and clear button.
function VisaDocField ({ label, filename, showError, onChange, onClear }: { label: string, filename: string, showError?: boolean, onChange: (v: string) => void, onClear: () => void }) {
	const inputRef = useRef<HTMLInputElement | null>(null)
	const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if(file) onChange(file.name)
	}

	return (
		<div className={`visa-personal-field${showError && !filename ? ' is-invalid' : ''}`}>
			<label>{label}</label>
			<div className="profile-data-input with-icon with-right-icon" onClick={() => inputRef.current?.click()} role="button" tabIndex={0}>
				<input className="field-file-input" onChange={selectFile} ref={inputRef} type="file" />
				<svg aria-hidden fill="none" height="24" stroke="rgb(0 29 71 / 0.52)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
				</svg>
				<span>{filename || 'Выбрать файл'}</span>
				{filename ? (
					<button aria-label="Remove file" className="field-clear-btn" onClick={(event) => { event.stopPropagation(); onClear() }} type="button">
						<svg aria-hidden fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
							<line x1="18" x2="6" y1="6" y2="18" />
							<line x1="6" x2="18" y1="6" y2="18" />
						</svg>
					</button>
				) : null}
			</div>
		</div>
	)
}

// Render saved passports list screen from Figma node 521:20478.
function PassportsListScreen ({ passports, selectedPassportId, isSelectionMode, isLoading, errorText, onBack, onOpenDocuments, onOpenHome, onOpenProfile, onAdd, onEdit, onDelete, onSelect }: { passports: PassportEntry[], selectedPassportId: string | null, isSelectionMode: boolean, isLoading: boolean, errorText: string, onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onAdd: () => void, onEdit: (id: string) => void, onDelete: (id: string) => void, onSelect: (id: string) => void }) {
	const { t } = useI18n()
	const hasEntries = passports.length > 0

	return (
		<section aria-label="Saved passports" className="passports-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="passports-scroll">
				<header className="passports-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					{hasEntries ? null : <p className="passports-toolbar-title">{t('passportSavedTitle')}</p>}
				</header>

				{isLoading ? <p className="dev-status passports-status">{t('devLoading')}</p> : null}
				{errorText ? <p className="dev-status is-error passports-status">{errorText}</p> : null}

				{!isLoading && !errorText && hasEntries ? (
					<div className="passports-stack">
						<h1>{t('passportSavedTitle')}</h1>
						{passports.map((passport) => (
							<article className={`passport-card${selectedPassportId === passport.id ? ' is-active' : ''}`} key={passport.id}>
								<div className="passport-card-body">
									<h2>{passport.fullName}</h2>
									<p>{`${t('passportNumberLabel')}: ${passport.passportNumber}`}</p>
								</div>
								<div className="passport-card-actions">
									{isSelectionMode ? <button onClick={() => onSelect(passport.id)} type="button">{selectedPassportId === passport.id ? t('authDone') : t('authContinue')}</button> : <button onClick={() => onEdit(passport.id)} type="button">{t('passportEdit')}</button>}
									{isSelectionMode ? null : <button className="is-danger" onClick={() => onDelete(passport.id)} type="button">{t('passportDelete')}</button>}
								</div>
							</article>
						))}

						<button className="passport-add-card" onClick={onAdd} type="button">
							<span>{t('passportAddHint')}</span>
							<p>{`${t('passportNumberLabel')}: 650000001\n${t('passportAddSubhint')}`}</p>
							<i>
								<Image alt="Plus" height={24} src="/assets/icon-plus.svg" unoptimized width={24} />
							</i>
						</button>
					</div>
				) : null}

				{!isLoading && !errorText && !hasEntries ? (
					<div className="passports-empty">
						<div className="passports-empty-picture">
							<Image alt="Save passport" className="passports-empty-image" height={316} src="/assets/passports-empty-figure.svg" unoptimized width={370} />
						</div>

						<div className="passports-empty-copy">
							<h2>{t('passportEmptyTitle')}</h2>
							<p>{t('passportEmptySubtitle')}</p>
						</div>

						<button className="passport-primary" onClick={onAdd} type="button">{t('passportAddButton')}</button>
					</div>
				) : null}
			</div>

			<DesktopRail />
		</section>
	)
}

// Render passport form first step from Figma node 521:20487.
function PassportStepOneScreen ({ draft, onBack, onOpenDocuments, onOpenHome, onOpenProfile, onNext, onChange }: { draft: PassportEntry, onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onNext: () => void, onChange: (field: keyof PassportEntry, value: string) => void }) {
	const { t } = useI18n()
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Passport step one" className="passports-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy">
					<h1>{t('passportFlowTitle')}</h1>
					<p>{t('passportFlowSubtitle')}</p>
				</div>

				<div className="passport-fields">
					<LivingField icon="search" label={t('passportCitizenship')} onChange={(v) => onChange('citizenship', v)} options={COUNTRY_OPTIONS} required showError={attempted} value={draft.citizenship} />
					<div className={`passport-field-row${attempted && !draft.firstName ? ' is-invalid' : ''}`}><label>{t('profileDataFirstName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('firstName', event.target.value)} type="text" value={draft.firstName} /></div></div>
					<div className={`passport-field-row${attempted && !draft.lastName ? ' is-invalid' : ''}`}><label>{t('profileDataLastName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('lastName', event.target.value)} type="text" value={draft.lastName} /></div></div>
					<LivingField icon="calendar" label={t('passportBirthDate')} onChange={(v) => onChange('birthDate', v)} required showError={attempted} value={draft.birthDate} />
					<LivingField icon="chevron" label={t('passportGender')} onChange={(v) => onChange('gender', v)} options={GENDER_OPTIONS} required showError={attempted} value={draft.gender} />
				</div>

				<ContinueButton canContinue={Boolean(draft.citizenship && draft.firstName && draft.lastName && draft.birthDate && draft.gender)} className="passport-primary" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onNext} />
			</div>

			<DesktopRail />
		</section>
	)
}

// Render passport form second step from Figma node 521:20499.
function PassportStepTwoScreen ({ draft, onBack, onOpenDocuments, onOpenHome, onOpenProfile, onNext, onChange }: { draft: PassportEntry, onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onNext: () => void, onChange: (field: keyof PassportEntry, value: string) => void }) {
	const { t } = useI18n()
	const [attempted, setAttempted] = useState(false)

	return (
		<section aria-label="Passport step two" className="passports-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy">
					<h1>{t('passportFlowTitle')}</h1>
					<p>{t('passportFlowSubtitle')}</p>
				</div>

				<div className="passport-fields">
					<div className={`passport-field-row${attempted && !draft.passportNumber ? ' is-invalid' : ''}`}><label>{t('passportNumber')}</label><div className="profile-data-input"><input onChange={(event) => onChange('passportNumber', event.target.value)} type="text" value={draft.passportNumber} /></div></div>
					<LivingField icon="calendar" label={t('passportIssueDate')} onChange={(v) => onChange('issueDate', v)} required showError={attempted} value={draft.issueDate} />
					<LivingField icon="calendar" label={t('passportExpiryDate')} onChange={(v) => onChange('expiryDate', v)} required showError={attempted} value={draft.expiryDate} />
					<LivingField icon="search" label={t('passportIssuedBy')} onChange={(v) => onChange('issuedBy', v)} options={COUNTRY_OPTIONS} required showError={attempted} value={draft.issuedBy} />
				</div>

				<ContinueButton canContinue={Boolean(draft.passportNumber && draft.issueDate && draft.expiryDate && draft.issuedBy)} className="passport-primary" label={t('authContinue')} onAttempt={() => setAttempted(true)} onContinue={onNext} />
			</div>

			<DesktopRail />
		</section>
	)
}

// Render single-screen passport edit form with immediate save action.
function PassportEditScreen ({ draft, onBack, onOpenDocuments, onOpenHome, onOpenProfile, onChange, onSave }: { draft: PassportEntry, onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onChange: (field: keyof PassportEntry, value: string) => void, onSave: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Passport edit" className="passports-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy">
					<h1>{t('passportEditTitle')}</h1>
					<p>{t('passportFlowSubtitle')}</p>
				</div>

				<div className="passport-fields">
					<LivingField icon="search" label={t('passportCitizenship')} onChange={(v) => onChange('citizenship', v)} options={COUNTRY_OPTIONS} value={draft.citizenship} />
					<div className="passport-field-row"><label>{t('profileDataFirstName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('firstName', event.target.value)} type="text" value={draft.firstName} /></div></div>
					<div className="passport-field-row"><label>{t('profileDataLastName')}</label><div className="profile-data-input"><input onChange={(event) => onChange('lastName', event.target.value)} type="text" value={draft.lastName} /></div></div>
					<LivingField icon="calendar" label={t('passportBirthDate')} onChange={(v) => onChange('birthDate', v)} value={draft.birthDate} />
					<LivingField icon="chevron" label={t('passportGender')} onChange={(v) => onChange('gender', v)} options={GENDER_OPTIONS} value={draft.gender} />
					<div className="passport-field-row"><label>{t('passportNumber')}</label><div className="profile-data-input"><input onChange={(event) => onChange('passportNumber', event.target.value)} type="text" value={draft.passportNumber} /></div></div>
					<LivingField icon="calendar" label={t('passportIssueDate')} onChange={(v) => onChange('issueDate', v)} value={draft.issueDate} />
					<LivingField icon="calendar" label={t('passportExpiryDate')} onChange={(v) => onChange('expiryDate', v)} value={draft.expiryDate} />
					<LivingField icon="search" label={t('passportIssuedBy')} onChange={(v) => onChange('issuedBy', v)} options={COUNTRY_OPTIONS} value={draft.issuedBy} />
				</div>

				<button className="passport-primary" onClick={onSave} type="button">{t('passportSaveButton')}</button>
			</div>

			<DesktopRail />
		</section>
	)
}

// Render passport review screen from Figma node 521:20510.
function PassportReviewScreen ({ draft, actionLabel, onBack, onOpenDocuments, onOpenHome, onOpenProfile, onSave }: { draft: PassportEntry, actionLabel: string, onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onSave: () => void }) {
	const { t } = useI18n()

	return (
		<section aria-label="Passport review" className="passports-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="passports-scroll">
				<header className="passport-flow-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<button aria-label="Home" className="profile-data-icon-button" type="button">
						<Image alt="Home" className="profile-data-toolbar-icon" height={24} src="/assets/icon-tab-home-inactive.svg" unoptimized width={24} />
					</button>
				</header>

				<div className="passport-flow-copy is-review">
					<h1>{t('passportReviewTitle')}</h1>
					<p>{t('passportReviewSubtitle')}</p>
				</div>

				<div className="passport-fields is-review">
					<div className="passport-field-row"><label>{t('passportCitizenship')}</label><div className="profile-data-input">{draft.citizenship}</div></div>
					<div className="passport-field-row"><label>{t('profileDataFirstName')}</label><div className="profile-data-input">{draft.firstName}</div></div>
					<div className="passport-field-row"><label>{t('profileDataLastName')}</label><div className="profile-data-input">{draft.lastName}</div></div>
					<div className="passport-field-row"><label>{t('passportBirthDate')}</label><div className="profile-data-input">{draft.birthDate}</div></div>
					<div className="passport-field-row"><label>{t('passportGender')}</label><div className="profile-data-input">{draft.gender}</div></div>
					<div className="passport-field-row"><label>{t('passportNumber')}</label><div className="profile-data-input">{draft.passportNumber}</div></div>
					<div className="passport-field-row"><label>{t('passportIssueDate')}</label><div className="profile-data-input">{draft.issueDate}</div></div>
					<div className="passport-field-row"><label>{t('passportExpiryDate')}</label><div className="profile-data-input">{draft.expiryDate}</div></div>
					<div className="passport-field-row"><label>{t('passportIssuedBy')}</label><div className="profile-data-input">{draft.issuedBy}</div></div>
				</div>

				<div className="passport-review-bottom">
					<button className="passport-primary" onClick={onSave} type="button">{actionLabel}</button>
				</div>
			</div>

			<DesktopRail />
		</section>
	)
}

// Render developer diagnostics with server/account metadata.
function DeveloperModeScreen ({ animationsDisabled, fillTestValues, onBack, onOpenDocuments, onOpenHome, onOpenProfile, onToggleAnimationsDisabled, onToggleFillTestValues, onOpenData }: { animationsDisabled: boolean, fillTestValues: boolean, onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onToggleAnimationsDisabled: (value: boolean) => void, onToggleFillTestValues: (value: boolean) => void, onOpenData: () => void }) {
	const { t } = useI18n()
	const [isLoading, setIsLoading] = useState(true)
	const [errorText, setErrorText] = useState('')
	const [sessionsData, setSessionsData] = useState<unknown>(null)
	const [dashboardData, setDashboardData] = useState<unknown>(null)
	const [applicationStatusData, setApplicationStatusData] = useState<unknown>(null)
	const auth = resolveAuthPayload()

	useEffect(() => {
		let active = true

		const load = async () => {
			setIsLoading(true)
			setErrorText('')

			try {
				const [sessions, dashboard, applications] = await Promise.all([
					authGet<unknown>('/v1/app/auth/sessions'),
					authGet<unknown>('/v1/app/dashboard'),
					authGet<ApplicationListResponse>('/v1/app/applications?pageSize=20'),
				])
				const statusLogs = await Promise.all(applications.items.map(async (item) => ({
					publicId: item.publicId,
					status: item.status,
					mappedStatus: mapApplicationStatus(item.status),
					statusLog: await loadBackendStatusLog(item.publicId),
				})))

				if(!active) return
				setSessionsData(sessions)
				setDashboardData(dashboard)
				setApplicationStatusData({ applications: applications.items, statusLogs })
			} catch (error) {
				if(!active) return
				setErrorText(error instanceof Error ? error.message : t('authUnexpectedError'))
			} finally {
				if(active) setIsLoading(false)
			}
		}

		load()
		return () => {
			active = false
		}
	}, [t])

	return (
		<section aria-label="Developer mode" className="dev-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="dev-scroll">
				<header className="dev-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<h2>{t('profileItemDeveloperMode')}</h2>
				</header>

			<div className="dev-content">
			<div className="profile-list">
				<button className="profile-row" onClick={onOpenData} type="button">
					<span className="profile-row-left">
						<Image alt="Data" className="profile-row-icon" height={24} src="/assets/icon-settings-passport.svg" unoptimized width={24} />
						<b>{'Данные'}</b>
					</span>
					<Image alt="" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
				</button>
			</div>

			<div className="dev-card dev-switch-card">
				<div>
					<b>{'Заполнять тестовые значения'}</b>
						<p>{fillTestValues ? 'Включено' : 'Выключено'}</p>
					</div>
					<button aria-pressed={fillTestValues} className={`dev-switch${fillTestValues ? ' is-on' : ''}`} onClick={() => onToggleFillTestValues(!fillTestValues)} type="button">
						<span />
					</button>
				</div>

				<div className="dev-card dev-switch-card">
					<div>
						<b>{'Animations'}</b>
						<p>{animationsDisabled ? 'Disabled' : 'Enabled'}</p>
					</div>
					<button aria-pressed={!animationsDisabled} className={`dev-switch${!animationsDisabled ? ' is-on' : ''}`} onClick={() => onToggleAnimationsDisabled(!animationsDisabled)} type="button">
						<span />
					</button>
				</div>

				<div className="dev-card">
					<b>{t('devAccountId')}</b>
					<p>{auth?.user?.userId ?? 'n/a'}</p>
				</div>

				<div className="dev-card">
					<b>{t('emailLabel')}</b>
					<p>{auth?.user?.email ?? 'n/a'}</p>
				</div>

				<div className="dev-card">
					<b>{t('devAccountRole')}</b>
					<p>{auth?.user?.role ?? 'n/a'}</p>
				</div>

				<div className="dev-card">
					<b>{t('devLinkedProviders')}</b>
					<p>{auth?.user?.linkedProviders?.join(', ') || 'n/a'}</p>
				</div>

				{isLoading ? <p className="dev-status">{t('devLoading')}</p> : null}
				{errorText ? <p className="dev-status is-error">{errorText}</p> : null}

				{sessionsData ? (
					<div className="dev-json-block">
						<b>{t('devSessions')}</b>
						<pre>{JSON.stringify(sessionsData, null, 2)}</pre>
					</div>
				) : null}

				{dashboardData ? (
					<div className="dev-json-block">
						<b>{t('devDashboard')}</b>
						<pre>{JSON.stringify(dashboardData, null, 2)}</pre>
					</div>
				) : null}

				{applicationStatusData ? (
					<div className="dev-json-block">
						<b>{'Application statuses'}</b>
						<pre>{JSON.stringify(applicationStatusData, null, 2)}</pre>
					</div>
				) : null}
				</div>
			</div>

			<DesktopRail />
		</section>
	)
}

// Render developer data management sub-screen.
function DeveloperDataScreen ({ onBack, onOpenDocuments, onOpenHome, onOpenProfile, onClearDrafts }: { onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onClearDrafts: () => void }) {
	const { t } = useI18n()
	const [confirmOpen, setConfirmOpen] = useState(false)
	const [confirmResetOpen, setConfirmResetOpen] = useState(false)
	const [resetBusy, setResetBusy] = useState(false)
	const [resetError, setResetError] = useState('')

	// Send POST /v1/app/me/reset to wipe all backend applications for this account.
	const resetApplications = async () => {
		setResetBusy(true)
		setResetError('')
		try {
			await authPostAuthorized('/v1/app/me/reset', { confirm: 'RESET' })
		} catch (error) {
			setResetError(error instanceof Error ? error.message : 'Ошибка сброса')
		}
		setResetBusy(false)
		setConfirmResetOpen(false)
	}

	return (
		<section aria-label="Developer data" className="dev-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />
			<div className="dev-scroll">
				<header className="dev-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<h2>{'Данные'}</h2>
				</header>
				<div className="dev-content">
					<div className="dev-section-title">{'Черновики'}</div>
					<div className="dev-card">
						<button className="dev-danger-button" onClick={() => setConfirmOpen(true)} type="button">{'Удалить все черновики'}</button>
					</div>
					<div className="dev-section-title">{'Заявления'}</div>
					<div className="dev-card">
						{resetError ? <p className="dev-error">{resetError}</p> : null}
						<button className="dev-danger-button" disabled={resetBusy} onClick={() => setConfirmResetOpen(true)} type="button">{'Удалить все заявления'}</button>
					</div>
				</div>
			</div>
			<DesktopRail />
			{confirmOpen ? <ConfirmDrawer confirmLabel="Удалить" title="Удалить все черновики?" subtitle="Все сохранённые черновики заявлений будут удалены без возможности восстановления." onCancel={() => setConfirmOpen(false)} onConfirm={() => { setConfirmOpen(false); onClearDrafts() }} /> : null}
			{confirmResetOpen ? <ConfirmDrawer confirmLabel="Удалить" title="Удалить все заявления?" subtitle="Все заявления на бэкенде будут безвозвратно удалены." onCancel={() => setConfirmResetOpen(false)} onConfirm={resetApplications} /> : null}
		</section>
	)
}

// Render profile data screen from Figma node 521:20347.
function ProfileDataScreen ({ onBack, onOpenDocuments, onOpenHome, onOpenProfile, onLoggedOut, onAccountDeleted }: { onBack: () => void, onOpenDocuments: () => void, onOpenHome: () => void, onOpenProfile: () => void, onLoggedOut: () => void, onAccountDeleted: () => void }) {
	const { t, locale, setLocale } = useI18n()
	const auth = resolveAuthPayload()
	const email = auth?.user?.email ?? 'alex.german@gmail.com'
	const fullName = resolveUserProfile()?.displayName ?? t('homeDefaultName')
	const nameParts = fullName.split(' ')
	const [firstName, setFirstName] = useState(nameParts[0] ?? '')
	const [lastName, setLastName] = useState(nameParts[1] ?? '')
	const originalFirst = nameParts[0] ?? ''
	const originalLast = nameParts[1] ?? ''
	const hasNameChanges = firstName !== originalFirst || lastName !== originalLast
	const [isSaveBusy, setIsSaveBusy] = useState(false)
	const [saveError, setSaveError] = useState('')
	const [isLocaleOpen, setIsLocaleOpen] = useState(false)
	const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false)
	const [isLogoutBusy, setIsLogoutBusy] = useState(false)
	const [isDeleteBusy, setIsDeleteBusy] = useState(false)
	const [deleteError, setDeleteError] = useState('')
	const localeRootRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if(!isLocaleOpen) return

		const onPointerDown = (event: PointerEvent) => {
			if(!localeRootRef.current) return
			if(localeRootRef.current.contains(event.target as Node)) return
			setIsLocaleOpen(false)
		}

		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [isLocaleOpen])

	// Save updated first/last name to backend profile state.
	const saveName = async () => {
		setIsSaveBusy(true)
		setSaveError('')
		try {
			await saveProfileToBackend(firstName, lastName)
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'Ошибка сохранения')
		}
		setIsSaveBusy(false)
	}

	// Revoke auth sessions when possible and always reset local login state.
	const logout = async () => {
		setIsLogoutBusy(true)
		try { await authDelete('/v1/app/auth/sessions') } catch {}
		clearPersistedSession()
		resetChatStore()
		setIsLogoutBusy(false)
		onLoggedOut()
	}

	// Delete account via API and reset local auth session.
	const deleteAccount = async () => {
		setIsDeleteBusy(true)
		setDeleteError('')

		try {
			await authDelete('/v1/app/auth/account')
			clearPersistedSession()
			resetChatStore()
			onAccountDeleted()
		} catch (error) {
			setDeleteError(error instanceof Error ? error.message : t('authUnexpectedError'))
		} finally {
			setIsDeleteBusy(false)
		}
	}

	return (
		<section aria-label="Profile data" className="profile-data-screen">
			<DesktopSidebar active="profile" onOpenDocuments={onOpenDocuments} onOpenHome={onOpenHome} onOpenProfile={onOpenProfile} />

			<div className="profile-data-scroll">
				<header className="profile-data-toolbar">
					<button aria-label={t('profileDataBack')} className="profile-data-icon-button" onClick={onBack} type="button">
						<Image alt="Back" className="profile-data-toolbar-icon" height={24} src="/assets/icon-arrow-left.svg" unoptimized width={24} />
					</button>
					<div className="profile-data-language" ref={localeRootRef}>
						<button aria-expanded={isLocaleOpen} aria-label={t('profileDataLanguage')} className="profile-data-icon-button" onClick={() => setIsLocaleOpen(!isLocaleOpen)} type="button">
							<Image alt="Language" className="profile-data-toolbar-icon" height={24} src="/assets/icon-language.svg" unoptimized width={24} />
						</button>

						{isLocaleOpen ? (
							<ul className="locale-menu" role="listbox">
								{SUPPORTED_LOCALES.map((item) => (
									<li key={item.code}>
										<button className={item.code === locale ? 'locale-option is-active' : 'locale-option'} onClick={() => {
											setLocale(item.code)
											setIsLocaleOpen(false)
										}} type="button">
											<span>{item.nativeName}</span>
										</button>
									</li>
								))}
							</ul>
						) : null}
					</div>
				</header>

				<section className="profile-data-block" aria-label={t('profileItemProfileData')}>
					<h2>{t('profileItemProfileData')}</h2>

					<div className="profile-data-field">
						<label>{t('profileDataFirstName')}</label>
						<div className="profile-data-input"><input onChange={(e) => setFirstName(e.target.value)} type="text" value={firstName} /></div>
					</div>

					<div className="profile-data-field">
						<label>{t('profileDataLastName')}</label>
						<div className="profile-data-input"><input onChange={(e) => setLastName(e.target.value)} type="text" value={lastName} /></div>
					</div>

					<div className="profile-data-field">
						<label>{t('emailLabel')}</label>
						<div className="profile-data-input">{email}</div>
					</div>

					{saveError ? <p className="profile-save-error">{saveError}</p> : null}
					<button className="profile-save-button" disabled={!hasNameChanges || isSaveBusy} onClick={saveName} type="button">{'Сохранить'}</button>
				</section>

				<section className="profile-section" aria-label={t('profileSectionExtra')}>
					<h2>{t('profileSectionExtra')}</h2>
					<div className="profile-list">
						<button className="profile-row" disabled={isLogoutBusy} onClick={logout} type="button">
							<span className="profile-row-left">
								<Image alt="Logout" className="profile-row-icon" height={24} src="/assets/icon-settings-profile.svg" unoptimized width={24} />
								<b>{t('profileItemLogout')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Biometrics" className="profile-row-icon" height={24} src="/assets/icon-profile-biometrics.svg" unoptimized width={24} />
								<b>{t('profileItemBiometrics')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row" type="button">
							<span className="profile-row-left">
								<Image alt="Password" className="profile-row-icon" height={24} src="/assets/icon-profile-password.svg" unoptimized width={24} />
								<b>{t('profileItemChangePassword')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>

						<button className="profile-row is-danger" onClick={() => setIsDeleteDrawerOpen(true)} type="button">
							<span className="profile-row-left">
								<Image alt="Delete account" className="profile-row-icon" height={24} src="/assets/icon-profile-trash.svg" unoptimized width={24} />
								<b>{t('profileItemDeleteAccount')}</b>
							</span>
							<Image alt="Chevron" className="profile-row-chevron" height={24} src="/assets/icon-chevron-right.svg" unoptimized width={24} />
						</button>
					</div>
				</section>
			</div>

			{isDeleteDrawerOpen ? (
				<div className="profile-drawer-backdrop">
					<div className="profile-drawer-sheet" role="dialog" aria-modal="true" aria-label={t('profileDeleteTitle')}>
						<header className="profile-drawer-header">
							<h3>{t('profileDeleteTitle')}</h3>
							<button className="profile-drawer-close" onClick={() => setIsDeleteDrawerOpen(false)} type="button">
								<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
									<path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
								</svg>
							</button>
						</header>

						<p className="profile-drawer-subtitle">{t('profileDeleteSubtitle')}</p>
						{deleteError ? <p className="profile-drawer-error">{deleteError}</p> : null}

						<div className="profile-drawer-actions">
							<button className="profile-drawer-delete" disabled={isDeleteBusy} onClick={deleteAccount} type="button">{t('profileDeleteConfirm')}</button>
							<button className="profile-drawer-cancel" disabled={isDeleteBusy} onClick={() => setIsDeleteDrawerOpen(false)} type="button">{t('profileDeleteCancel')}</button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	)
}

// Resolve initial entry step from persisted auth state.
function resolveInitialEntryStep (): EntryStep {
	if(hasPersistedAuthSession()) return 'home'
	return 'onboarding'
}

// Convert current app view into URL hash route.
function buildEntryRoute (step: EntryStep, tab: HomeTab) {
	if(step === 'home') return tab === 'home' ? '#/home' : `#/${tab}`
	return `#/${step}`
}

// Parse URL hash route back into app view state.
function parseEntryRoute (fallbackStep: EntryStep, fallbackTab: HomeTab) {
	if(typeof window === 'undefined') return { step: fallbackStep, tab: fallbackTab }
	const hash = window.location.hash.replace(/^#\/?/, '')
	if(!hash) return { step: fallbackStep, tab: fallbackTab }
	const parts = hash.split('/').filter(Boolean)
	if(parts[0] === 'onboarding') return { step: 'onboarding' as EntryStep, tab: 'home' as HomeTab }
	if(parts[0] === 'auth') return { step: 'auth' as EntryStep, tab: 'home' as HomeTab }
	if(HOME_TABS.includes(parts[0] as HomeTab)) return { step: 'home' as EntryStep, tab: parts[0] as HomeTab }
	if(parts[0] !== 'home') return { step: fallbackStep, tab: fallbackTab }
	const tab = parts[1] as HomeTab | undefined
	if(!tab) return { step: 'home' as EntryStep, tab: 'home' as HomeTab }
	if(!HOME_TABS.includes(tab)) return { step: 'home' as EntryStep, tab: 'home' as HomeTab }
	return { step: 'home' as EntryStep, tab }
}

// Render onboarding-to-auth-to-home flow after splash.
function EntryFlow () {
	const { t } = useI18n()
	const [{ step, tab: activeTab }, setNavigation] = useState(() => {
		const fallbackStep = resolveInitialEntryStep()
		const initial = parseEntryRoute(fallbackStep, 'home')
		if(fallbackStep !== 'home' && initial.step === 'home') return { step: fallbackStep, tab: 'home' as HomeTab }
		return initial
	})
	const [passportFlowMode, setPassportFlowMode] = useState<'create' | 'edit' | 'visa-create'>('create')
	const [passportListMode, setPassportListMode] = useState<'profile' | 'visa'>('profile')
	const [fillTestValues, setFillTestValues] = useState(resolveFillTestValues)
	const [passportDraft, setPassportDraft] = useState<PassportEntry>(() => createPassportDraft(resolveFillTestValues()))
	const [passports, setPassports] = useState<PassportEntry[]>([])
	const [selectedVisaPassport, setSelectedVisaPassport] = useState<PassportEntry | null>(null)
	const [isPassportsLoading, setIsPassportsLoading] = useState(false)
	const [passportsError, setPassportsError] = useState('')
	const [selectedVisaCitizenship, setSelectedVisaCitizenship] = useState('')
	const [selectedVisaResidence, setSelectedVisaResidence] = useState('')
	const [selectedVisaDestinationLabel, setSelectedVisaDestinationLabel] = useState('')
	const [selectedVisaDestination, setSelectedVisaDestination] = useState<VisaDestinationCode>('italy')
	const [selectedVisaType, setSelectedVisaType] = useState<VisaTypeCode>('type-c')
	const [isVisaWarningOpen, setIsVisaWarningOpen] = useState(false)
	const [visaPhotoDataUrl, setVisaPhotoDataUrl] = useState('')
	const [afterPhotoCheckTab, setAfterPhotoCheckTab] = useState<'visa-review-passport' | 'visa-review-photo'>('visa-review-passport')
	const [reviewPassport, setReviewPassport] = useState<PassportEntry>(() => createPassportDraft(resolveFillTestValues()))
	const [reviewPersonal, setReviewPersonal] = useState(() => createPersonalDraft(resolveFillTestValues()))
	const [reviewTrip, setReviewTrip] = useState(() => createTripDraft(resolveFillTestValues()))
	const [reviewDocs, setReviewDocs] = useState(() => createDocsDraft(resolveFillTestValues()))
	const [currentApplicants, setCurrentApplicants] = useState<VisaApplicant[]>([])
	const [editingApplicantIndex, setEditingApplicantIndex] = useState<number | null>(null)
	const [visitedVisaTabs, setVisitedVisaTabs] = useState<Partial<Record<HomeTab, true>>>({})
	const [submittedVisaTabs, setSubmittedVisaTabs] = useState<Partial<Record<HomeTab, true>>>({})
	const [selectedPayment, setSelectedPayment] = useState<PaymentMethodCode>('sbp')
	const [animationsDisabled, setAnimationsDisabled] = useState(resolveAnimationsDisabled)
	const [savedDrafts, setSavedDrafts] = useState<VisaDraft[]>(resolveSavedDrafts)
	const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
	const [isDraftOpenedFromDocuments, setIsDraftOpenedFromDocuments] = useState(false)
	const isPopNavigationRef = useRef(false)
	const visaCheckRequestRef = useRef<string | null>(null)
	const currentVisaTitle = resolveVisaTitleRu(selectedVisaDestinationLabel, selectedVisaType)
	const activeDraftStatus = activeDraftId ? savedDrafts.find((draft) => draft.id === activeDraftId)?.status : undefined
	const isActiveDraftEditable = !activeDraftStatus || activeDraftStatus === 'draft' || activeDraftStatus === 'error'
	const desktopActiveTab: HomeRootTab = activeTab === 'documents' ? 'documents' : activeTab === 'profile' || activeTab === 'profile-data' || activeTab === 'developer-mode' || activeTab === 'support' || activeTab === 'payment-history' || activeTab === 'notifications-settings' || activeTab.startsWith('passports') ? 'profile' : 'home'

	// Move app to target view and sync browser history state.
	const navigate = (nextStep: EntryStep, nextTab: HomeTab, mode: 'push' | 'replace' = 'push') => {
		setNavigation((current) => {
			if(current.step === nextStep && current.tab === nextTab) return current
			return { step: nextStep, tab: nextTab }
		})

		const route = buildEntryRoute(nextStep, nextTab)
		if(typeof window === 'undefined') return
		if(window.location.hash === route) return
		if(mode === 'replace') {
			window.history.replaceState({ step: nextStep, tab: nextTab }, '', route)
			return
		}
		window.history.pushState({ step: nextStep, tab: nextTab }, '', route)
	}

	// Move back through actual route history, with a safe in-app fallback.
	const goBack = (fallbackTab: HomeTab) => {
		if(typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back()
			return
		}

		navigate('home', fallbackTab)
	}

	// Persist local draft cache for UI fields not returned by backend list endpoints.
	const persistLocalDrafts = (drafts: VisaDraft[]) => {
		try { localStorage.setItem(VISA_DRAFTS_STORAGE_KEY, JSON.stringify(drafts)) } catch {}
		return drafts
	}

	// Build cache draft from current in-progress visa UI state.
	const buildCurrentDraftCache = (id = activeDraftId ?? `local-${Date.now()}`): VisaDraft => ({
		id,
		createdAt: savedDrafts.find((draft) => draft.id === id)?.createdAt ?? Date.now(),
		visaType: selectedVisaType,
		visaDestination: selectedVisaDestination,
		visaDestinationLabel: selectedVisaDestinationLabel,
		status: savedDrafts.find((draft) => draft.id === id)?.status ?? 'draft',
		applicantCount: currentApplicants.length,
		applicants: currentApplicants,
		selectedPassport: selectedVisaPassport,
		reviewPassport,
		reviewPersonal,
		reviewTrip,
		reviewDocs,
		photoDataUrl: visaPhotoDataUrl,
	})

	// Store in-progress visa state locally before backend draft exists.
	const persistCurrentDraftCache = (id = activeDraftId ?? `local-${Date.now()}`) => {
		const draft = buildCurrentDraftCache(id)
		setActiveDraftId(id)
		setSavedDrafts((prev) => persistLocalDrafts(prev.some((item) => item.id === id) ? prev.map((item) => item.id === id ? draft : item) : [...prev, draft]))
		return draft
	}

	// Refresh document-list applications from backend and local UI cache.
	const refreshBackendDrafts = async () => {
		try {
			setSavedDrafts(persistLocalDrafts(await loadBackendDrafts()))
		} catch {}
	}

	// Persist visible status from backend response into local UI cache.
	const updateActiveDraftStatus = (status: NonNullable<VisaDraft['status']>) => {
		if(!activeDraftId) return
		setSavedDrafts((prev) => {
			const next = prev.map((draft) => draft.id === activeDraftId ? { ...draft, status } : draft)
			return persistLocalDrafts(next)
		})
	}

	// Submit application to backend self-check before showing waiting UI.
	const sendApplicationToBackendCheck = async () => {
		if(activeDraftId) {
			const application = await runBackendSelfCheck(activeDraftId)
			updateActiveDraftStatus(mapApplicationStatus(application.status))
		}
		visaCheckRequestRef.current = null
		navigate('home', 'visa-check')
	}

	// Remove draft from backend when possible and always clear local cache.
	const deleteSavedDraft = async (id: string) => {
		if(!id.startsWith('local-') && !id.startsWith('draft-')) {
			try { await authDeletePath(`/v1/app/applications/${id}`) } catch {}
		}
		setSavedDrafts((prev) => persistLocalDrafts(prev.filter((draft) => draft.id !== id)))
	}

	// Save current application to backend and local UI cache before payment.
	const saveCurrentApplication = async () => {
		const localId = activeDraftId ?? persistCurrentDraftCache().id
		const shouldCreateBackend = localId.startsWith('local-') || localId.startsWith('draft-')
		const backendDraft = shouldCreateBackend ? await createBackendDraft(selectedVisaDestination, selectedVisaDestinationLabel, selectedVisaType) : null
		const id = backendDraft?.publicId ?? localId
		if(!shouldCreateBackend && savedDrafts.find((draft) => draft.id === id)?.status === 'checking') await returnBackendApplicationToDraft(id)
		const normalizedApplicants = currentApplicants.map((applicant) => {
			if(applicant.passport.backendId) return applicant
			const found = passports.find((item) => item.id === applicant.passport.id || item.passportNumber === applicant.passport.passportNumber) ?? (selectedVisaPassport?.backendId ? selectedVisaPassport : null)
			return found ? { ...applicant, passport: found } : applicant
		})
		const applicants = await syncBackendApplicants(id, normalizedApplicants)
		await autoSaveBackendDraft(id, applicants)
		setCurrentApplicants(applicants)
		setIsDraftOpenedFromDocuments(false)
		const draft: VisaDraft = {
			id,
			createdAt: backendDraft ? Number(backendDraft.createdAt) || Date.now() : Date.now(),
			visaType: selectedVisaType,
			visaDestination: selectedVisaDestination,
			visaDestinationLabel: selectedVisaDestinationLabel,
			status: 'draft',
			applicantCount: applicants.length,
			applicants,
			selectedPassport: selectedVisaPassport,
			reviewPassport,
			reviewPersonal,
			reviewTrip,
			reviewDocs,
			photoDataUrl: visaPhotoDataUrl,
		}
		setSavedDrafts((prev) => persistLocalDrafts(prev.filter((item) => item.id !== localId).some((item) => item.id === id) ? prev.filter((item) => item.id !== localId).map((item) => item.id === id ? draft : item) : [...prev.filter((item) => item.id !== localId), draft]))
		setActiveDraftId(id)
		await refreshBackendDrafts()
		navigate('home', 'visa-payment')
	}

	useEffect(() => {
		if(typeof window === 'undefined') return

		if(!window.location.hash) {
			const fallbackStep = resolveInitialEntryStep()
			const initial = parseEntryRoute(fallbackStep, 'home')
			window.history.replaceState({ step: initial.step, tab: initial.tab }, '', buildEntryRoute(initial.step, initial.tab))
		}

		const onPopstate = () => {
			isPopNavigationRef.current = true
			const fallbackStep = resolveInitialEntryStep()
			const next = parseEntryRoute(fallbackStep, 'home')
			setNavigation(next)
			window.setTimeout(() => {
				isPopNavigationRef.current = false
			}, 0)
		}

		window.addEventListener('popstate', onPopstate)
		return () => window.removeEventListener('popstate', onPopstate)
	}, [])

	useEffect(() => {
		if(isPopNavigationRef.current || typeof window === 'undefined') return
		const route = buildEntryRoute(step, activeTab)
		if(window.location.hash !== route) window.history.replaceState({ step, tab: activeTab }, '', route)
	}, [step, activeTab])

	useEffect(() => {
		document.documentElement.classList.toggle('motion-disabled', animationsDisabled)
	}, [animationsDisabled])

	// Open home screen immediately after successful auth.
	const onAuthenticated = () => {
		navigate('home', 'home')
	}

	// Reset account-scoped UI state before returning to onboarding.
	const endLocalSession = () => {
		window.localStorage.removeItem(VISA_DRAFTS_STORAGE_KEY)
		setPassports([])
		setSavedDrafts([])
		setSelectedVisaPassport(null)
		setCurrentApplicants([])
		setActiveDraftId(null)
		setIsDraftOpenedFromDocuments(false)
		setVisaPhotoDataUrl('')
		setPassportDraft(createPassportDraft(fillTestValues))
		setReviewPassport(createPassportDraft(fillTestValues))
		setReviewPersonal(createPersonalDraft(fillTestValues))
		setReviewTrip(createTripDraft(fillTestValues))
		setReviewDocs(createDocsDraft(fillTestValues))
		navigate('onboarding', 'home', 'replace')
	}

	// Load saved passports list from backend API.
	const loadPassports = async () => {
		setIsPassportsLoading(true)
		setPassportsError('')

		try {
			const list = await authGet<PassportDto[]>('/v1/app/passports')
			setPassports((list ?? []).map((item) => mapPassportDto(item)))
		} catch (error) {
			setPassportsError(error instanceof Error ? error.message : 'Failed to load passports')
		} finally {
			setIsPassportsLoading(false)
		}
	}

	// Open passport add flow from saved passports list.
	const openPassportAdd = () => {
		setPassportFlowMode('create')
		setPassportDraft(createPassportDraft(fillTestValues))
		navigate('home', 'passports-step-one')
	}

	// Open passport add flow and select the saved result for visa application.
	const openVisaPassportAdd = () => {
		setPassportFlowMode('visa-create')
		setPassportDraft(createPassportDraft(fillTestValues))
		navigate('home', 'passport-camera')
	}

	// Open passports list and request latest backend records.
	const openPassportsList = () => {
		setPassportListMode('profile')
		navigate('home', 'passports-list')
	}

	// Open saved passports list for visa application selection.
	const openVisaPassportsList = () => {
		setPassportListMode('visa')
		navigate('home', 'passports-list')
	}

	// Select existing passport for the current visa application.
	const selectVisaPassport = (id: string) => {
		const found = passports.find((item) => item.id === id)
		if(!found) return
		setSelectedVisaPassport(found)
		setPassportDraft(found)
		setReviewPassport(found)
		setPassportFlowMode('visa-create')
		navigate('home', 'passports-step-one')
	}

	// Select visa type card without leaving the current step.
	const selectVisaType = (type: VisaTypeCode) => {
		setSelectedVisaType(type)
	}

	// Select destination label and sync supported Schengen flow country when available.
	const selectVisaDestinationLabel = (value: string) => {
		setSelectedVisaDestinationLabel(value)
		const found = SCHENGEN_DESTINATIONS.find((item) => item.label === value)
		if(found) setSelectedVisaDestination(found.code)
	}

	// Start a blank applicant from the desktop rail or applicants screen.
	const addVisaApplicant = () => {
		setReviewPassport(createPassportDraft(fillTestValues))
		setReviewPersonal(createPersonalDraft(fillTestValues))
		setReviewTrip(createTripDraft(fillTestValues))
		setReviewDocs(createDocsDraft(fillTestValues))
		setVisaPhotoDataUrl('')
		setEditingApplicantIndex(null)
		setAfterPhotoCheckTab('visa-review-passport')
		navigate('home', 'visa-passport')
	}

	// Open an existing applicant for step-by-step editing.
	const editVisaApplicant = (index: number) => {
		const applicant = currentApplicants[index]
		if(!applicant) return
		setReviewPassport({ ...applicant.passport })
		setReviewPersonal({ ...applicant.personal })
		setReviewTrip({ ...applicant.trip })
		setReviewDocs({ ...applicant.docs })
		setVisaPhotoDataUrl(applicant.photoDataUrl)
		setEditingApplicantIndex(index)
		setAfterPhotoCheckTab('visa-review-passport')
		navigate('home', 'visa-review-passport')
	}

	const visaPassportComplete = Boolean(reviewPassport.firstName && reviewPassport.lastName && reviewPassport.passportNumber)
	const passportDraftStepOneComplete = Boolean(passportDraft.citizenship && passportDraft.firstName && passportDraft.lastName && passportDraft.birthDate && passportDraft.gender)
	const passportDraftStepTwoComplete = Boolean(passportDraft.passportNumber && passportDraft.issueDate && passportDraft.expiryDate && passportDraft.issuedBy)
	const passportDraftComplete = passportDraftStepOneComplete && passportDraftStepTwoComplete
	const visaPersonalOneComplete = Boolean(reviewPersonal.birthPlaceValue && reviewPersonal.maritalValue && reviewPersonal.professionValue && reviewPersonal.employerValue && reviewPersonal.workAddressValue)
	const visaPersonalTwoComplete = Boolean(reviewPersonal.residenceAddressValue && reviewPersonal.phoneValue && reviewPersonal.emailValue)
	const visaTripComplete = Boolean(reviewTrip.purposeValue && reviewTrip.dateValue && reviewTrip.exitDateValue && reviewTrip.residenceCountryValue && reviewTrip.prevVisasValue)
	const visaDocsComplete = Boolean(reviewDocs.hotelFile || reviewDocs.flightsFile || reviewDocs.insuranceFile)
	const visaChoiceComplete = Boolean(selectedVisaCitizenship && selectedVisaResidence && selectedVisaDestinationLabel)
	const visaTypeComplete = Boolean(selectedVisaType)
	const visaPhotoComplete = Boolean(visaPhotoDataUrl)
	const visaReviewPassportComplete = visaPassportComplete
	const visaReviewPersonalComplete = visaPersonalOneComplete && visaPersonalTwoComplete
	const visaReviewTripComplete = visaTripComplete && visaDocsComplete
	const visaReviewPhotoComplete = visaPhotoComplete
	const visaApplicantsComplete = currentApplicants.length > 0
	const visaSubmitted = Boolean(activeDraftId && (activeDraftStatus === 'checking' || activeDraftStatus === 'ready' || activeDraftStatus === 'error' || activeTab === 'visa-check' || activeTab === 'visa-verified' || activeTab === 'visa-rejected'))
	const isVisaDesktopFlow = activeTab.startsWith('visa-') || activeTab === 'passport-camera' || activeTab === 'passport-recognition' || (activeTab.startsWith('passports') && passportListMode === 'visa') || (activeTab.startsWith('passports-step') || activeTab === 'passports-review') && passportFlowMode === 'visa-create'
	const visaDesktopSteps: VisaDesktopStep[] = [
		{ label: 'Выбор гражданства, направления и типа визы', tab: 'visa-start', active: activeTab === 'visa-start', completed: Boolean(submittedVisaTabs['visa-start'] && visaChoiceComplete), invalid: Boolean(submittedVisaTabs['visa-start'] && !visaChoiceComplete) },
		{ label: 'Выбор типа визы', tab: 'visa-type', active: activeTab === 'visa-type', completed: Boolean(submittedVisaTabs['visa-type'] && visaTypeComplete), invalid: Boolean(submittedVisaTabs['visa-type'] && !visaTypeComplete) },
		{ label: 'Заполнение паспортных данных', tab: 'visa-passport', active: activeTab === 'visa-passport', completed: Boolean(submittedVisaTabs['visa-passport'] && visaPassportComplete), invalid: Boolean(submittedVisaTabs['visa-passport'] && !visaPassportComplete) },
		{ label: 'Паспорт: личные данные', tab: 'passports-step-one', active: activeTab === 'passports-step-one', completed: Boolean(submittedVisaTabs['passports-step-one'] && passportDraftStepOneComplete), invalid: Boolean(submittedVisaTabs['passports-step-one'] && !passportDraftStepOneComplete) },
		{ label: 'Паспорт: данные документа', tab: 'passports-step-two', active: activeTab === 'passports-step-two', completed: Boolean(submittedVisaTabs['passports-step-two'] && passportDraftStepTwoComplete), invalid: Boolean(submittedVisaTabs['passports-step-two'] && !passportDraftStepTwoComplete) },
		{ label: 'Паспорт: проверка данных', tab: 'passports-review', active: activeTab === 'passports-review', completed: Boolean(submittedVisaTabs['passports-review'] && passportDraftComplete), invalid: Boolean(submittedVisaTabs['passports-review'] && !passportDraftComplete) },
		{ label: 'Личные данные: биография и работа', tab: 'visa-personal-one', active: activeTab === 'visa-personal-one', completed: Boolean(submittedVisaTabs['visa-personal-one'] && visaPersonalOneComplete), invalid: Boolean(submittedVisaTabs['visa-personal-one'] && !visaPersonalOneComplete) },
		{ label: 'Личные данные: адрес и контакты', tab: 'visa-personal-two', active: activeTab === 'visa-personal-two', completed: Boolean(submittedVisaTabs['visa-personal-two'] && visaPersonalTwoComplete), invalid: Boolean(submittedVisaTabs['visa-personal-two'] && !visaPersonalTwoComplete) },
		{ label: 'Заполнение данных о поездке', tab: 'visa-trip', active: activeTab === 'visa-trip', completed: Boolean(submittedVisaTabs['visa-trip'] && visaTripComplete), invalid: Boolean(submittedVisaTabs['visa-trip'] && !visaTripComplete) },
		{ label: 'Данные о поездке', tab: 'visa-docs', active: activeTab === 'visa-docs', completed: Boolean(submittedVisaTabs['visa-docs'] && visaDocsComplete), invalid: Boolean(submittedVisaTabs['visa-docs'] && !visaDocsComplete) },
		{ label: 'Добавление фотографии для визы', tab: 'visa-photo', active: activeTab === 'visa-photo', completed: Boolean(submittedVisaTabs['visa-photo'] && visaPhotoComplete), invalid: Boolean(submittedVisaTabs['visa-photo'] && !visaPhotoComplete) },
		{ label: 'Проверка паспорта', tab: 'visa-review-passport', active: activeTab === 'visa-review-passport', completed: Boolean(submittedVisaTabs['visa-review-passport'] && visaReviewPassportComplete), invalid: Boolean(submittedVisaTabs['visa-review-passport'] && !visaReviewPassportComplete) },
		{ label: 'Проверка личных данных', tab: 'visa-review-personal', active: activeTab === 'visa-review-personal', completed: Boolean(submittedVisaTabs['visa-review-personal'] && visaReviewPersonalComplete), invalid: Boolean(submittedVisaTabs['visa-review-personal'] && !visaReviewPersonalComplete) },
		{ label: 'Проверка данных о поездке', tab: 'visa-review-trip', active: activeTab === 'visa-review-trip', completed: Boolean(submittedVisaTabs['visa-review-trip'] && visaReviewTripComplete), invalid: Boolean(submittedVisaTabs['visa-review-trip'] && !visaReviewTripComplete) },
		{ label: 'Проверка фото', tab: 'visa-review-photo', active: activeTab === 'visa-review-photo', completed: Boolean(submittedVisaTabs['visa-review-photo'] && visaReviewPhotoComplete), invalid: Boolean(submittedVisaTabs['visa-review-photo'] && !visaReviewPhotoComplete) },
		{ label: 'Добавление заявителей на визу', tab: 'visa-applicants', active: activeTab === 'visa-applicants', completed: Boolean(submittedVisaTabs['visa-applicants'] && visaApplicantsComplete), invalid: Boolean(submittedVisaTabs['visa-applicants'] && !visaApplicantsComplete) },
		{ label: 'Отправка заполненных данных на проверку', tab: 'visa-payment', active: activeTab === 'visa-payment', completed: Boolean(visitedVisaTabs['visa-payment'] && visaSubmitted), invalid: false },
		{ label: 'Проверка заявки модератором', tab: 'visa-check', active: activeTab === 'visa-check', completed: Boolean(visitedVisaTabs['visa-check'] && visaSubmitted), invalid: false, pending: activeDraftStatus === 'checking' },
		...(activeDraftStatus === 'ready' ? [
			{ label: 'Проверка успешно пройдена', tab: 'visa-verified' as const, active: activeTab === 'visa-verified', completed: Boolean(visitedVisaTabs['visa-verified']), invalid: false },
			{ label: 'Документы готовы к получению', tab: 'visa-documents-ready' as const, active: activeTab === 'visa-documents-ready', completed: Boolean(visitedVisaTabs['visa-documents-ready']), invalid: false },
		] : []),
		...(activeDraftStatus === 'error' ? [
			{ label: 'Требуются правки', tab: 'visa-rejected' as const, active: activeTab === 'visa-rejected', completed: Boolean(visitedVisaTabs['visa-rejected']), invalid: false },
		] : []),
	]

	useEffect(() => {
		if(!isVisaDesktopFlow) return
		setVisitedVisaTabs((current) => current[activeTab] ? current : { ...current, [activeTab]: true })
	}, [isVisaDesktopFlow, activeTab])

	useEffect(() => {
		if(step !== 'home' || activeTab !== 'passports-list') return
		loadPassports()
	}, [step, activeTab])

	useEffect(() => {
		if(step !== 'home' || activeTab !== 'documents') return
		refreshBackendDrafts()
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step, activeTab])

	useEffect(() => {
		if(step !== 'home' || !activeTab.startsWith('visa-') || !activeDraftId) return
		setSavedDrafts((prev) => {
			const existing = prev.find((draft) => draft.id === activeDraftId)
			const draft = { ...buildCurrentDraftCache(activeDraftId), createdAt: existing?.createdAt ?? Date.now(), status: existing?.status ?? 'draft' }
			return persistLocalDrafts(prev.some((item) => item.id === activeDraftId) ? prev.map((item) => item.id === activeDraftId ? draft : item) : [...prev, draft])
		})
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step, activeTab, activeDraftId, selectedVisaPassport, selectedVisaType, selectedVisaDestination, selectedVisaDestinationLabel, currentApplicants, reviewPassport, reviewPersonal, reviewTrip, reviewDocs, visaPhotoDataUrl])

	useEffect(() => {
		if(step !== 'home' || activeTab !== 'passport-recognition') return
		const timer = window.setTimeout(() => navigate('home', 'passports-step-one'), 1200)
		return () => window.clearTimeout(timer)
	}, [step, activeTab])

	useEffect(() => {
		if(step !== 'home' || activeTab !== 'visa-check' || !activeDraftId || visaCheckRequestRef.current === activeDraftId) return
		visaCheckRequestRef.current = activeDraftId
		let active = true
		let timer = 0
		addNotification('Заявка на визу проверяется', 'На проверке', true)

		const check = async () => {
			const application = await loadBackendApplication(activeDraftId)
			if(!active) return
			const status = mapApplicationStatus(application.status)
			updateActiveDraftStatus(status)
			if(status === 'error') {
				addNotification('Заявка на визу отклонена', 'Отказ')
				navigate('home', 'visa-rejected')
				return
			}
			if(status === 'ready') {
				addNotification('Виза одобрена и готова', 'Готовая виза')
				navigate('home', 'visa-verified')
				return
			}
			timer = window.setTimeout(check, 3000)
		}

		check().catch(() => {
			if(active) navigate('home', 'visa-rejected')
		})
		return () => {
			active = false
			window.clearTimeout(timer)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step, activeTab, activeDraftId])

	// Persist developer-selected animation preference.
	const toggleAnimationsDisabled = (value: boolean) => {
		setAnimationsDisabled(value)
		localStorage.setItem(ANIMATIONS_DISABLED_STORAGE_KEY, String(value))
	}

	// Persist developer-selected test data filling preference.
	const toggleFillTestValues = (value: boolean) => {
		setFillTestValues(value)
		localStorage.setItem(FILL_TEST_VALUES_STORAGE_KEY, String(value))
	}

	// Start a clean visa flow using developer test data only when enabled.
	const startVisaFlow = () => {
		const id = `local-${Date.now()}`
		const passport = createPassportDraft(fillTestValues)
		const personal = createPersonalDraft(fillTestValues)
		const trip = createTripDraft(fillTestValues)
		const docs = createDocsDraft(fillTestValues)
		setSelectedVisaCitizenship(fillTestValues ? 'Российская Федерация' : '')
		setSelectedVisaResidence(fillTestValues ? 'Москва' : '')
		setSelectedVisaDestinationLabel(fillTestValues ? 'Италия' : '')
		setSelectedVisaDestination('italy')
		setSelectedVisaType('type-c')
		setSelectedVisaPassport(null)
		setPassportDraft(passport)
		setReviewPassport(passport)
		setReviewPersonal(personal)
		setReviewTrip(trip)
		setReviewDocs(docs)
		setCurrentApplicants([])
		setActiveDraftId(id)
		setVisitedVisaTabs({})
		setSavedDrafts((prev) => persistLocalDrafts([...prev, {
			id,
			createdAt: Date.now(),
			visaType: 'type-c',
			visaDestination: 'italy',
			visaDestinationLabel: fillTestValues ? 'Италия' : '',
			status: 'draft',
			applicantCount: 0,
			applicants: [],
			selectedPassport: null,
			reviewPassport: passport,
			reviewPersonal: personal,
			reviewTrip: trip,
			reviewDocs: docs,
			photoDataUrl: '',
		}]))
		setIsDraftOpenedFromDocuments(false)
		navigate('home', 'visa-start')
	}

	// Update passport draft field and recompute derived full name.
	const updatePassportDraftField = (field: keyof PassportEntry, value: string) => {
		setPassportDraft((current) => {
			const next = { ...current, [field]: value }
			if(field === 'firstName' || field === 'lastName') next.fullName = `${next.firstName} ${next.lastName}`.trim().toUpperCase()
			return next
		})
	}

	// Open single-screen passport edit form from existing passport card action.
	const openPassportEdit = (id: string) => {
		const found = passports.find((item) => item.id === id)
		if(!found) return
		setPassportFlowMode('edit')
		setPassportDraft(found)
		navigate('home', 'passports-edit')
	}

	// Remove passport from saved passports list.
	const removePassport = async (id: string) => {
		setPassportsError('')

		try {
			await authDeletePath(`/v1/app/passports/${id}`)
			await loadPassports()
		} catch (error) {
			setPassportsError(error instanceof Error ? error.message : 'Failed to delete passport')
		}
	}

	// Save current passport draft and route according to active passport flow.
	const savePassportDraft = async () => {
		if(passportFlowMode === 'visa-create') {
			setSelectedVisaPassport(passportDraft)
			setReviewPassport(passportDraft)
			navigate('home', 'visa-personal-one')
			return
		}

		setPassportsError('')
		try {
			await authPostAuthorized<PassportDto>('/v1/app/passports', mapPassportDraftToPayload(passportDraft))
			if(passportFlowMode === 'edit' && !passportDraft.id.startsWith('draft-')) await authDeletePath(`/v1/app/passports/${passportDraft.id}`)
			await loadPassports()
			navigate('home', 'passports-list')
		} catch (error) {
			setPassportsError(error instanceof Error ? error.message : 'Failed to save passport')
		}
	}

	// Cancel current visa application and remove its saved draft if present.
	// Mark a visa flow tab as successfully submitted (Continue clicked with valid data).
	const markTabSubmitted = (tab: HomeTab) => setSubmittedVisaTabs((p) => ({ ...p, [tab]: true }))

	const cancelCurrentApplication = async () => {
		if(activeDraftId) {
			try { await authDeletePath(`/v1/app/applications/${activeDraftId}`) } catch {}
			setSavedDrafts((prev) => {
				const next = prev.filter((draft) => draft.id !== activeDraftId)
				return persistLocalDrafts(next)
			})
		}

		setCurrentApplicants([])
		setEditingApplicantIndex(null)
		setActiveDraftId(null)
		setIsDraftOpenedFromDocuments(false)
		navigate('home', 'documents')
	}

	return (
		<>
			{step === 'home' ? null : <LocaleSwitcher />}
			{step === 'onboarding'
				? <OnboardingScreen onContinue={() => navigate('auth', 'home')} />
				: step === 'auth'
					? <AuthScreen onAuthenticated={onAuthenticated} />
					: activeTab === 'home'
							? <HomeScreen onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onOpenVisaStart={startVisaFlow} />
						: activeTab === 'documents'
						? <DocumentsScreen drafts={savedDrafts} onDeleteDraft={deleteSavedDraft} onContinueDraft={(id) => {
								const draft = savedDrafts.find((d) => d.id === id)
								if (!draft) return
								setActiveDraftId(id)
								setCurrentApplicants(draft.applicants)
								setSelectedVisaType(draft.visaType)
								setSelectedVisaDestination(draft.visaDestination)
								setSelectedVisaDestinationLabel(draft.visaDestinationLabel ?? SCHENGEN_DESTINATIONS.find((item) => item.code === draft.visaDestination)?.label ?? 'Италия')
					setSelectedVisaPassport(draft.selectedPassport ?? null)
					if(draft.reviewPassport) setReviewPassport(draft.reviewPassport)
					if(draft.reviewPersonal) setReviewPersonal(draft.reviewPersonal)
					if(draft.reviewTrip) setReviewTrip(draft.reviewTrip)
					if(draft.reviewDocs) setReviewDocs(draft.reviewDocs)
					setVisaPhotoDataUrl(draft.photoDataUrl ?? '')
					setVisitedVisaTabs({})
					setIsDraftOpenedFromDocuments(true)
								if(draft.status === 'ready') {
									navigate('home', 'visa-documents-ready')
									return
								}
								if(draft.status === 'error') {
									navigate('home', 'visa-rejected')
									return
								}
								if(draft.status === 'checking') {
									navigate('home', 'visa-check')
									return
								}
								navigate('home', draft.applicants.length ? 'visa-applicants' : 'visa-start')
							}} onOpenHome={() => navigate('home', 'home')} onOpenProfile={() => navigate('home', 'profile')} />
							: activeTab === 'visa-start'
								? <VisaStartScreen canContinue={visaChoiceComplete} selectedCitizenship={selectedVisaCitizenship} selectedDestination={selectedVisaDestination} selectedDestinationLabel={selectedVisaDestinationLabel} selectedResidence={selectedVisaResidence} onBack={() => goBack('home')} onContinue={() => { markTabSubmitted('visa-start'); navigate('home', 'visa-type') }} onHome={() => navigate('home', 'home')} onSelectCitizenship={setSelectedVisaCitizenship} onSelectDestination={selectVisaDestinationLabel} onSelectResidence={setSelectedVisaResidence} />
							: activeTab === 'visa-type'
						? <VisaTypeScreen canContinue={visaTypeComplete} isWarningOpen={isVisaWarningOpen} selectedDestination={selectedVisaDestination} selectedDestinationLabel={selectedVisaDestinationLabel} selectedType={selectedVisaType} onBack={() => goBack('visa-start')} onCloseWarning={() => setIsVisaWarningOpen(false)} onConfirmWarning={() => {
							setIsVisaWarningOpen(false)
							markTabSubmitted('visa-type')
							navigate('home', 'visa-passport')
						}} onContinue={() => setIsVisaWarningOpen(true)} onHome={() => navigate('home', 'home')} onSelectType={selectVisaType} />
							: activeTab === 'visa-passport'
								? <VisaPassportScreen selectedPassport={selectedVisaPassport} onAddPassport={openVisaPassportAdd} onBack={() => goBack('visa-type')} onHome={() => navigate('home', 'home')} onSelectSaved={openVisaPassportsList} />
							: activeTab === 'passport-camera'
								? <PassportCameraScreen onBack={() => goBack('visa-passport')} onCapture={() => navigate('home', 'passport-recognition')} />
							: activeTab === 'passport-recognition'
								? <PassportRecognitionScreen onBack={() => goBack('passport-camera')} />
							: activeTab === 'visa-personal-one'
								? <VisaPersonalOneScreen canContinue={visaPersonalOneComplete} personal={reviewPersonal} onBack={() => goBack('visa-passport')} onChange={(field, value) => setReviewPersonal((p) => ({ ...p, [field]: value }))} onContinue={() => { markTabSubmitted('visa-personal-one'); navigate('home', 'visa-personal-two') }} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-personal-two'
							? <VisaPersonalTwoScreen canContinue={visaPersonalTwoComplete} personal={reviewPersonal} onBack={() => goBack('visa-personal-one')} onChange={(field, value) => setReviewPersonal((p) => ({ ...p, [field]: value }))} onContinue={() => { markTabSubmitted('visa-personal-two'); navigate('home', 'visa-trip') }} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-trip'
							? <VisaTripScreen canContinue={visaTripComplete} trip={reviewTrip} onBack={() => goBack('visa-personal-two')} onChange={(field, value) => setReviewTrip((p) => ({ ...p, [field]: value }))} onContinue={() => { markTabSubmitted('visa-trip'); navigate('home', 'visa-docs') }} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-docs'
						? <VisaDocumentsScreen canContinue={visaDocsComplete} docs={reviewDocs} onBack={() => goBack('visa-trip')} onContinue={() => { markTabSubmitted('visa-docs'); navigate('home', 'visa-photo') }} onDocsChange={(field, value) => setReviewDocs((p) => ({ ...p, [field]: value }))} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-photo'
							? <VisaPhotoScreen onBack={() => goBack('visa-docs')} onCamera={() => navigate('home', 'visa-photo-camera')} onHome={() => navigate('home', 'home')} onUpload={(dataUrl) => { setVisaPhotoDataUrl(dataUrl); navigate('home', 'visa-photo-check') }} />
						: activeTab === 'visa-photo-camera'
							? <VisaPhotoCameraScreen onBack={() => goBack('visa-photo')} onCapture={(dataUrl) => { setVisaPhotoDataUrl(dataUrl); navigate('home', 'visa-photo-check') }} />
						: activeTab === 'visa-photo-check'
							? <VisaPhotoCheckScreen photoDataUrl={visaPhotoDataUrl} onBack={() => goBack('visa-photo')} onDone={() => { if (afterPhotoCheckTab === 'visa-review-passport') setReviewPassport({ ...(selectedVisaPassport ?? passportDraft) }); markTabSubmitted('visa-photo'); navigate('home', afterPhotoCheckTab) }} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-review-passport'
							? <VisaReviewPassportScreen canContinue={visaReviewPassportComplete} passport={reviewPassport} onBack={() => goBack('visa-photo')} onContinue={() => { markTabSubmitted('visa-review-passport'); navigate('home', 'visa-review-personal') }} onHome={() => navigate('home', 'home')} onChange={(field, value) => setReviewPassport((p) => ({ ...p, [field]: value }))} />
						: activeTab === 'visa-review-personal'
							? <VisaReviewPersonalScreen canContinue={visaReviewPersonalComplete} personal={reviewPersonal} onBack={() => goBack('visa-review-passport')} onContinue={() => { markTabSubmitted('visa-review-personal'); navigate('home', 'visa-review-trip') }} onHome={() => navigate('home', 'home')} onChange={(field, value) => setReviewPersonal((p) => ({ ...p, [field]: value }))} />
						: activeTab === 'visa-review-trip'
							? <VisaReviewTripScreen canContinue={visaReviewTripComplete} docs={reviewDocs} trip={reviewTrip} onBack={() => goBack('visa-review-personal')} onContinue={() => { markTabSubmitted('visa-review-trip'); navigate('home', 'visa-review-photo') }} onHome={() => navigate('home', 'home')} onTripChange={(field, value) => setReviewTrip((p) => ({ ...p, [field]: value }))} />
						: activeTab === 'visa-review-photo'
						? <VisaReviewPhotoScreen photoDataUrl={visaPhotoDataUrl} onBack={() => goBack('visa-review-trip')} onContinue={() => {
							const applicant: VisaApplicant = { passport: reviewPassport, personal: reviewPersonal, trip: reviewTrip, docs: reviewDocs, photoDataUrl: visaPhotoDataUrl }
							if (editingApplicantIndex !== null) {
								setCurrentApplicants((prev) => prev.map((a, i) => i === editingApplicantIndex ? applicant : a))
								setEditingApplicantIndex(null)
							} else {
								setCurrentApplicants((prev) => [...prev, applicant])
							}
							markTabSubmitted('visa-review-photo')
							navigate('home', 'visa-applicants')
						}} onHome={() => navigate('home', 'home')} onReplace={() => { setAfterPhotoCheckTab('visa-review-photo'); navigate('home', 'visa-photo') }} />
						: activeTab === 'visa-applicants'
						? <VisaApplicantsScreen
							canContinue={visaApplicantsComplete}
							applicants={currentApplicants}
							isEditable={isActiveDraftEditable}
							visaTitle={currentVisaTitle}
							onBack={() => goBack(isDraftOpenedFromDocuments ? 'documents' : 'visa-review-photo')}
							onCancelApplication={cancelCurrentApplication}
							onHome={() => navigate('home', 'home')}
								onAddApplicant={addVisaApplicant}
								onEditApplicant={editVisaApplicant}
								onDeleteApplicant={(index) => setCurrentApplicants((prev) => prev.filter((_, i) => i !== index))}
								onContinue={() => { markTabSubmitted('visa-applicants'); if(isActiveDraftEditable) saveCurrentApplication(); else navigate('home', 'documents') }}
							/>
							: activeTab === 'visa-payment'
								? <VisaPaymentScreen applicants={currentApplicants} selectedPayment={selectedPayment} visaDestination={selectedVisaDestination} visaTitle={currentVisaTitle} visaType={selectedVisaType} onBack={() => goBack('visa-applicants')} onHome={() => navigate('home', 'home')} onPay={sendApplicationToBackendCheck} onSelectPayment={setSelectedPayment} />
						: activeTab === 'visa-check'
							? <VisaCheckScreen applicant={currentApplicants[0] ?? null} visaTitle={currentVisaTitle} onBack={() => goBack('visa-payment')} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-verified'
								? <VisaCheckResultScreen applicant={currentApplicants[0] ?? null} isSuccess={true} visaTitle={currentVisaTitle} onBack={() => goBack('visa-payment')} onDownload={async () => { if(activeDraftId) await submitBackendApplication(activeDraftId); updateActiveDraftStatus('ready'); navigate('home', 'visa-documents-ready') }} onEdit={() => navigate('home', 'visa-review-passport')} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-rejected'
							? <VisaCheckResultScreen applicant={currentApplicants[0] ?? null} isSuccess={false} visaTitle={currentVisaTitle} onBack={() => goBack('visa-payment')} onDownload={() => navigate('home', 'documents')} onEdit={() => navigate('home', 'visa-review-passport')} onHome={() => navigate('home', 'home')} />
						: activeTab === 'visa-documents-ready'
							? <VisaDocumentsReadyScreen applicant={currentApplicants[0] ?? null} visaTitle={currentVisaTitle} onBack={() => goBack('documents')} onContinue={() => navigate('home', 'documents')} onHome={() => navigate('home', 'home')} />
						: activeTab === 'profile'
								? <ProfileScreen onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfileData={() => navigate('home', 'profile-data')} onOpenDeveloper={() => navigate('home', 'developer-mode')} onOpenPassports={openPassportsList} onOpenSupport={() => navigate('home', 'support')} onOpenPayments={() => navigate('home', 'payment-history')} onOpenNotifications={() => navigate('home', 'notifications-settings')} />
							: activeTab === 'profile-data'
								? <ProfileDataScreen onBack={() => goBack('profile')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onLoggedOut={endLocalSession} onAccountDeleted={endLocalSession} />
								: activeTab === 'developer-mode'
									? <DeveloperModeScreen animationsDisabled={animationsDisabled} fillTestValues={fillTestValues} onBack={() => goBack('profile')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onToggleAnimationsDisabled={toggleAnimationsDisabled} onToggleFillTestValues={toggleFillTestValues} onOpenData={() => navigate('home', 'developer-data')} />
								: activeTab === 'developer-data'
								? <DeveloperDataScreen onBack={() => goBack('developer-mode')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onClearDrafts={() => { setSavedDrafts(persistLocalDrafts([])); setActiveDraftId(null) }} />
								: activeTab === 'support'
								? <SupportScreen onBack={() => goBack('profile')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} />
								: activeTab === 'payment-history'
								? <PaymentHistoryScreen onBack={() => goBack('profile')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} />
								: activeTab === 'notifications-settings'
								? <NotificationsSettingsScreen onBack={() => goBack('profile')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} />
									: activeTab === 'passports-list'
										? <PassportsListScreen passports={passports} selectedPassportId={selectedVisaPassport?.id ?? null} isSelectionMode={passportListMode === 'visa'} isLoading={isPassportsLoading} errorText={passportsError} onBack={() => goBack(passportListMode === 'visa' ? 'visa-passport' : 'profile')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onAdd={passportListMode === 'visa' ? openVisaPassportAdd : openPassportAdd} onEdit={openPassportEdit} onDelete={removePassport} onSelect={selectVisaPassport} />
									: activeTab === 'passports-step-one'
								? <PassportStepOneScreen draft={passportDraft} onBack={() => goBack(passportFlowMode === 'visa-create' ? 'passport-camera' : 'passports-list')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onChange={updatePassportDraftField} onNext={() => { markTabSubmitted('passports-step-one'); navigate('home', 'passports-step-two') }} />
									: activeTab === 'passports-step-two'
									? <PassportStepTwoScreen draft={passportDraft} onBack={() => goBack('passports-step-one')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onChange={updatePassportDraftField} onNext={() => { markTabSubmitted('passports-step-two'); navigate('home', 'passports-review') }} />
										: activeTab === 'passports-review'
										? <PassportReviewScreen actionLabel={passportFlowMode === 'edit' ? t('passportEdit') : passportFlowMode === 'visa-create' ? 'Продолжить' : t('passportAddButton')} draft={passportDraft} onBack={() => goBack('passports-step-two')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onSave={() => { markTabSubmitted('passports-review'); savePassportDraft() }} />
											: <PassportEditScreen draft={passportDraft} onBack={() => goBack('passports-list')} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} onChange={updatePassportDraftField} onSave={savePassportDraft} />}
			{step === 'home' ? isVisaDesktopFlow ? <DesktopVisaChrome applicants={currentApplicants} steps={visaDesktopSteps} onAddApplicant={addVisaApplicant} onEditApplicant={editVisaApplicant} onGoHome={() => navigate('home', 'home')} onGoStep={(tab) => {
				if(tab === 'passports-list') setPassportListMode('visa')
				if(tab === 'passport-camera' || tab === 'passport-recognition' || tab.startsWith('passports-step') || tab === 'passports-review') setPassportFlowMode('visa-create')
				navigate('home', tab)
			}} /> : <DesktopGlobalChrome active={desktopActiveTab} onOpenHome={() => navigate('home', 'home')} onOpenDocuments={() => navigate('home', 'documents')} onOpenProfile={() => navigate('home', 'profile')} /> : null}
		</>
	)
}

// Render localized splash and second screen transition.
function AppEntryContent () {
	const isReady = useSplashReady()

	return (
		<main className="web-root">
			<section aria-label="App content" className="app-content">
				{isReady ? (
					<EntryFlow />
				) : (
					<div className="splash-canvas">
						<Image alt="Travel illustration" className="splash-hero-image" height={394} priority src={HERO_IMAGE} unoptimized width={458} />
						<div className="splash-loading">Loading...</div>
					</div>
				)}
			</section>
		</main>
	)
}

// Render root entry screen with i18n context.
export default function LanguageSelectionScreen () {
	return (
		<I18nProvider>
			<AppEntryContent />
		</I18nProvider>
	)
}
