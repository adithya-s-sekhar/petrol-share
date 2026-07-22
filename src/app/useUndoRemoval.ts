import { useCallback, useEffect, useState } from 'react'
import type { TripDraft } from '../domain'
import { UNDO_REMOVAL_TIMEOUT_MS } from './constants'
import type { UndoRemoval } from './types'

export function useUndoRemoval(setDraft: (draft: TripDraft) => void) {
  const [undoRemoval, setUndoRemoval] = useState<UndoRemoval | null>(null)

  useEffect(() => {
    if (!undoRemoval) return
    const timeout = window.setTimeout(() => setUndoRemoval(null), UNDO_REMOVAL_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [undoRemoval])

  const rememberRemoval = useCallback((draft: TripDraft, message: string) => {
    setUndoRemoval({ draft, message })
  }, [])

  const undoLastRemoval = useCallback(() => {
    if (!undoRemoval) return
    setDraft({ ...undoRemoval.draft, updatedAt: new Date().toISOString() })
    setUndoRemoval(null)
  }, [setDraft, undoRemoval])

  return { undoRemoval, clearUndoRemoval: () => setUndoRemoval(null), rememberRemoval, undoLastRemoval }
}
