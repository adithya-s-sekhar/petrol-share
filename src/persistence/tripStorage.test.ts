import { beforeEach, describe, expect, it } from 'vitest'
import { createBlankTripDraft } from '../domain'
import { loadTripLibrary, saveStoredTrip, tripStorageConfig, type StoredTrip } from './tripStorage'

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(tripStorageConfig.databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function createLegacyDatabase(draft: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(tripStorageConfig.databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(tripStorageConfig.storeName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(tripStorageConfig.storeName, 'readwrite')
      transaction.objectStore(tripStorageConfig.storeName).put(draft, tripStorageConfig.currentTripKey)
      transaction.oncomplete = () => { database.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  })
}

beforeEach(deleteDatabase)

describe('trip storage library', () => {
  it('migrates the v1 current-trip record without changing the draft', async () => {
    const legacyDraft = createBlankTripDraft({ createId: (() => { let id = 0; return () => `id-${++id}` })(), now: () => new Date('2026-01-02T03:04:05.000Z') })
    legacyDraft.stops[0].name = 'Home'
    await createLegacyDatabase(legacyDraft)

    const library = await loadTripLibrary(createBlankTripDraft)

    expect(library.migratedLegacyDraft).toBe(true)
    expect(library.recoveredInvalidData).toBe(false)
    expect(library.trips).toHaveLength(1)
    expect(library.trips[0]).toMatchObject({ id: library.activeTripId, name: 'My saved trip', kind: 'trip', draft: legacyDraft })
  })

  it('keeps multiple trips and templates independent across reloads', async () => {
    const library = await loadTripLibrary(createBlankTripDraft)
    const original = library.trips[0]
    const templateDraft = createBlankTripDraft()
    templateDraft.stops[0].name = 'Station'
    const template: StoredTrip = { id: 'template-1', name: 'Station run', kind: 'template', draft: templateDraft, updatedAt: templateDraft.updatedAt }
    await saveStoredTrip(template)

    const reloaded = await loadTripLibrary(createBlankTripDraft)

    expect(reloaded.trips.map(({ id }) => id)).toEqual(expect.arrayContaining([original.id, template.id]))
    expect(reloaded.trips.find(({ id }) => id === original.id)?.draft.stops[0].name).toBe('')
    expect(reloaded.trips.find(({ id }) => id === template.id)?.draft.stops[0].name).toBe('Station')
  })

  it('recovers safely when the legacy record is invalid', async () => {
    await createLegacyDatabase({ broken: true })
    const library = await loadTripLibrary(createBlankTripDraft)
    expect(library.recoveredInvalidData).toBe(true)
    expect(library.trips).toHaveLength(1)
    expect(library.trips[0].name).toBe('Untitled trip')
  })
})
