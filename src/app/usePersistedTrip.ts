import { useEffect, useRef, useState } from 'react'
import { createBlankTripDraft, editableTripDraftSchema, type TripDraft } from '../domain'
import { loadCurrentTrip, saveCurrentTrip } from '../persistence/tripStorage'

export type PersistenceStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'recovered' | 'error'

const AUTOSAVE_DELAY_MS = 500

export function usePersistedTrip(onRestoredCompleteTrip: () => void) {
  const [draft, setDraft] = useState<TripDraft>(() => createBlankTripDraft())
  const [hydrated, setHydrated] = useState(false)
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading')
  const [retryRevision, setRetryRevision] = useState(0)
  const hydratedDraftRef = useRef<string | null>(null)
  const saveSequenceRef = useRef(0)

  useEffect(() => {
    let active = true
    void loadCurrentTrip()
      .then((loaded) => {
        if (!active) return
        const initialDraft = loaded.status === 'restored' ? loaded.draft : createBlankTripDraft()
        hydratedDraftRef.current = JSON.stringify(initialDraft)
        setDraft(initialDraft)
        if (loaded.status === 'restored' && editableTripDraftSchema.safeParse(initialDraft).success) onRestoredCompleteTrip()
        setPersistenceStatus(loaded.status === 'recovered' ? 'recovered' : 'idle')
        setHydrated(true)
      })
      .catch(() => {
        if (!active) return
        const blankDraft = createBlankTripDraft()
        hydratedDraftRef.current = JSON.stringify(blankDraft)
        setDraft(blankDraft)
        setPersistenceStatus('recovered')
        setHydrated(true)
      })
    return () => { active = false }
  }, [onRestoredCompleteTrip])

  useEffect(() => {
    if (!hydrated) return
    const serializedDraft = JSON.stringify(draft)
    if (serializedDraft === hydratedDraftRef.current) return

    const sequence = ++saveSequenceRef.current
    setPersistenceStatus('saving')
    const timeout = window.setTimeout(() => {
      void saveCurrentTrip(draft)
        .then(() => {
          if (saveSequenceRef.current !== sequence) return
          hydratedDraftRef.current = serializedDraft
          setPersistenceStatus('saved')
        })
        .catch(() => {
          if (saveSequenceRef.current === sequence) setPersistenceStatus('error')
        })
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [draft, hydrated, retryRevision])

  function retryAutosave() {
    if (persistenceStatus === 'error') setRetryRevision((revision) => revision + 1)
  }

  return { draft, setDraft, hydrated, persistenceStatus, retryAutosave }
}
