import { persistedTripDraftSchema, type TripDraft } from '../domain'

const DATABASE_NAME = 'petrol-share'
const DATABASE_VERSION = 2
const LEGACY_STORE_NAME = 'trips'
const LIBRARY_STORE_NAME = 'trip-library'
const META_STORE_NAME = 'trip-meta'
const CURRENT_TRIP_KEY = 'current-trip'
const ACTIVE_TRIP_KEY = 'active-trip-id'

export type TripKind = 'trip' | 'template'

export interface StoredTrip {
  id: string
  name: string
  kind: TripKind
  draft: TripDraft
  updatedAt: string
  deletedAt?: string
}

export interface TripLibrary {
  trips: StoredTrip[]
  activeTripId: string
  migratedLegacyDraft: boolean
  recoveredInvalidData: boolean
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

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
    request.addEventListener('upgradeneeded', (event) => {
      const database = request.result
      if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) database.createObjectStore(LEGACY_STORE_NAME)
      if (!database.objectStoreNames.contains(LIBRARY_STORE_NAME)) database.createObjectStore(LIBRARY_STORE_NAME, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(META_STORE_NAME)) database.createObjectStore(META_STORE_NAME)

      if (event.oldVersion < 2) {
        const transaction = request.transaction!
        const legacyRequest = transaction.objectStore(LEGACY_STORE_NAME).get(CURRENT_TRIP_KEY)
        legacyRequest.addEventListener('success', () => {
          if (legacyRequest.result === undefined) return
          const parsed = persistedTripDraftSchema.safeParse(legacyRequest.result)
          if (!parsed.success) {
            transaction.objectStore(META_STORE_NAME).put(true, 'legacy-data-invalid')
            return
          }
          const id = createId()
          const record: StoredTrip = {
            id,
            name: 'My saved trip',
            kind: 'trip',
            draft: parsed.data,
            updatedAt: parsed.data.updatedAt,
          }
          transaction.objectStore(LIBRARY_STORE_NAME).put(record)
          transaction.objectStore(META_STORE_NAME).put(id, ACTIVE_TRIP_KEY)
          transaction.objectStore(META_STORE_NAME).put(true, 'legacy-draft-migrated')
        })
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error ?? new Error('Could not open IndexedDB')))
    request.addEventListener('blocked', () => reject(new Error('IndexedDB upgrade was blocked')))
  })
}

function validRecord(value: unknown): StoredTrip | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Partial<StoredTrip>
  const draft = persistedTripDraftSchema.safeParse(record.draft)
  if (!draft.success || typeof record.id !== 'string' || typeof record.name !== 'string' || !['trip', 'template'].includes(record.kind ?? '')) return null
  return { ...record, draft: draft.data } as StoredTrip
}

export async function loadTripLibrary(createBlankDraft: () => TripDraft): Promise<TripLibrary> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([LIBRARY_STORE_NAME, META_STORE_NAME], 'readwrite')
    const rawRecords = await requestResult(transaction.objectStore(LIBRARY_STORE_NAME).getAll())
    const activeId = await requestResult(transaction.objectStore(META_STORE_NAME).get(ACTIVE_TRIP_KEY))
    const migratedLegacyDraft = Boolean(await requestResult(transaction.objectStore(META_STORE_NAME).get('legacy-draft-migrated')))
    const invalidLegacy = Boolean(await requestResult(transaction.objectStore(META_STORE_NAME).get('legacy-data-invalid')))
    const records = rawRecords.map(validRecord).filter((record): record is StoredTrip => record !== null)
    const hadInvalidRecords = rawRecords.length !== records.length
    let active = records.find(({ id, kind, deletedAt }) => id === activeId && kind === 'trip' && !deletedAt)
    if (!active) {
      active = records.find(({ kind, deletedAt }) => kind === 'trip' && !deletedAt)
      if (!active) {
        const draft = createBlankDraft()
        active = { id: createId(), name: 'Untitled trip', kind: 'trip', draft, updatedAt: draft.updatedAt }
        transaction.objectStore(LIBRARY_STORE_NAME).put(active)
        records.push(active)
      }
      transaction.objectStore(META_STORE_NAME).put(active.id, ACTIVE_TRIP_KEY)
    }
    await transactionComplete(transaction)
    return {
      trips: records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      activeTripId: active.id,
      migratedLegacyDraft,
      recoveredInvalidData: invalidLegacy || hadInvalidRecords,
    }
  } finally {
    database.close()
  }
}

export async function saveStoredTrip(record: StoredTrip, makeActive = false): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([LIBRARY_STORE_NAME, META_STORE_NAME], 'readwrite')
    transaction.objectStore(LIBRARY_STORE_NAME).put(record)
    if (makeActive) transaction.objectStore(META_STORE_NAME).put(record.id, ACTIVE_TRIP_KEY)
    await transactionComplete(transaction)
  } finally { database.close() }
}

export async function deleteStoredTrip(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(LIBRARY_STORE_NAME, 'readwrite')
    transaction.objectStore(LIBRARY_STORE_NAME).delete(id)
    await transactionComplete(transaction)
  } finally { database.close() }
}

/** Compatibility helpers retained for integrations using the original single-draft API. */
export async function loadCurrentTrip() {
  const library = await loadTripLibrary(() => { throw new Error('No current trip exists') })
  const current = library.trips.find(({ id }) => id === library.activeTripId)
  return current ? { status: 'restored' as const, draft: current.draft } : { status: 'missing' as const }
}

export async function saveCurrentTrip(draft: TripDraft): Promise<void> {
  const library = await loadTripLibrary(() => draft)
  const current = library.trips.find(({ id }) => id === library.activeTripId)!
  await saveStoredTrip({ ...current, draft, updatedAt: draft.updatedAt }, true)
}

export const tripStorageConfig = {
  databaseName: DATABASE_NAME,
  databaseVersion: DATABASE_VERSION,
  storeName: LEGACY_STORE_NAME,
  libraryStoreName: LIBRARY_STORE_NAME,
  currentTripKey: CURRENT_TRIP_KEY,
}
