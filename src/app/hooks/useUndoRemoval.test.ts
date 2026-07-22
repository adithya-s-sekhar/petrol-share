import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBlankTripDraft } from '../../domain'
import { UNDO_REMOVAL_TIMEOUT_MS } from '../constants'
import { useUndoRemoval } from './useUndoRemoval'

describe('useUndoRemoval', () => {
  afterEach(() => vi.useRealTimers())

  it('restores the snapshot with a fresh update timestamp', () => {
    const setDraft = vi.fn()
    const draft = createBlankTripDraft({ createId: () => 'id', now: () => new Date('2026-01-01') })
    const { result } = renderHook(() => useUndoRemoval(setDraft))

    act(() => result.current.rememberRemoval(draft, 'Stop removed.'))
    expect(result.current.undoRemoval?.message).toBe('Stop removed.')
    act(() => result.current.undoLastRemoval())

    expect(setDraft).toHaveBeenCalledOnce()
    expect(setDraft.mock.calls[0][0]).toMatchObject({ stops: draft.stops })
    expect(setDraft.mock.calls[0][0].updatedAt).not.toBe(draft.updatedAt)
    expect(result.current.undoRemoval).toBeNull()
  })

  it('expires the undo action', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useUndoRemoval(vi.fn()))
    act(() => result.current.rememberRemoval(createBlankTripDraft(), 'Person removed.'))
    act(() => vi.advanceTimersByTime(UNDO_REMOVAL_TIMEOUT_MS))
    expect(result.current.undoRemoval).toBeNull()
  })
})
