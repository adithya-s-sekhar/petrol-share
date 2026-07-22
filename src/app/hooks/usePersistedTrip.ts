import { useEffect, useRef, useState } from 'react'
import { createBlankTripDraft, editableTripDraftSchema, type TripDraft } from '../../domain'
import { loadTripLibrary, saveStoredTrip, type StoredTrip } from '../../persistence/tripStorage'

export type PersistenceStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'recovered' | 'migrated' | 'error'
const AUTOSAVE_DELAY_MS = 500

export function usePersistedTrip(onRestoredCompleteTrip: () => void) {
  const [draft, setDraft] = useState<TripDraft>(() => createBlankTripDraft())
  const [trips, setTrips] = useState<StoredTrip[]>([])
  const [activeTripId, setActiveTripId] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading')
  const [retryRevision, setRetryRevision] = useState(0)
  const savedDraftRef = useRef<string | null>(null)
  const saveSequenceRef = useRef(0)

  useEffect(() => {
    let active = true
    void loadTripLibrary(createBlankTripDraft).then((library) => {
      if (!active) return
      const current = library.trips.find(({ id }) => id === library.activeTripId)!
      setTrips(library.trips)
      setActiveTripId(current.id)
      setDraft(current.draft)
      savedDraftRef.current = JSON.stringify(current.draft)
      if (editableTripDraftSchema.safeParse(current.draft).success) onRestoredCompleteTrip()
      setPersistenceStatus(library.recoveredInvalidData ? 'recovered' : library.migratedLegacyDraft ? 'migrated' : 'idle')
      setHydrated(true)
    }).catch(() => {
      if (!active) return
      const blank = createBlankTripDraft()
      setDraft(blank)
      savedDraftRef.current = JSON.stringify(blank)
      setPersistenceStatus('recovered')
      setHydrated(true)
    })
    return () => { active = false }
  }, [onRestoredCompleteTrip])

  useEffect(() => {
    if (!hydrated || !activeTripId) return
    const serialized = JSON.stringify(draft)
    if (serialized === savedDraftRef.current) return
    const current = trips.find(({ id }) => id === activeTripId)
    if (!current) return
    const record = { ...current, draft, updatedAt: draft.updatedAt }
    const sequence = ++saveSequenceRef.current
    setPersistenceStatus('saving')
    const timeout = window.setTimeout(() => {
      void saveStoredTrip(record, true).then(() => {
        if (saveSequenceRef.current !== sequence) return
        savedDraftRef.current = serialized
        setTrips((items) => items.map((item) => item.id === record.id ? record : item))
        setPersistenceStatus('saved')
      }).catch(() => { if (saveSequenceRef.current === sequence) setPersistenceStatus('error') })
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [activeTripId, draft, hydrated, retryRevision, trips])

  async function selectTrip(record: StoredTrip) {
    await saveStoredTrip(record, true)
    savedDraftRef.current = JSON.stringify(record.draft)
    setTrips((items) => [record, ...items.filter(({ id }) => id !== record.id)])
    setActiveTripId(record.id)
    setDraft(record.draft)
    setPersistenceStatus('idle')
  }

  function retryAutosave() { if (persistenceStatus === 'error') setRetryRevision((value) => value + 1) }

  return { draft, setDraft, trips, setTrips, activeTripId, selectTrip, hydrated, persistenceStatus, retryAutosave }
}
