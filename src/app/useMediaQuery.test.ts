import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

afterEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  it('uses viewport width and responds to resize when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    const { result } = renderHook(() => useMediaQuery('(max-width: 560px)'))
    expect(result.current).toBe(true)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(result.current).toBe(false)
  })
})
