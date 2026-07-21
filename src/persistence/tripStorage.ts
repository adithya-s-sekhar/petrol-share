import { persistedTripDraftSchema, type TripDraft } from '../domain'

const DATABASE_NAME = 'petrol-share'
const DATABASE_VERSION = 1
const STORE_NAME = 'trips'
const CURRENT_TRIP_KEY = 'current-trip'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')))
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed')))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error ?? new Error('Could not open IndexedDB')))
    request.addEventListener('blocked', () => reject(new Error('IndexedDB upgrade was blocked')))
  })
}

export type LoadTripResult =
  | { status: 'missing' }
  | { status: 'restored'; draft: TripDraft }
  | { status: 'recovered' }

export async function loadCurrentTrip(): Promise<LoadTripResult> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const stored = await requestResult(transaction.objectStore(STORE_NAME).get(CURRENT_TRIP_KEY))
    await transactionComplete(transaction)
    if (stored === undefined) return { status: 'missing' }

    const parsed = persistedTripDraftSchema.safeParse(stored)
    return parsed.success ? { status: 'restored', draft: parsed.data } : { status: 'recovered' }
  } finally {
    database.close()
  }
}

export async function saveCurrentTrip(draft: TripDraft): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(draft, CURRENT_TRIP_KEY)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

export const tripStorageConfig = {
  databaseName: DATABASE_NAME,
  storeName: STORE_NAME,
  currentTripKey: CURRENT_TRIP_KEY,
}
