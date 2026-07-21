import { describe, expect, it, vi } from 'vitest'
import { createShareMessage, shareSummary } from './shareSummary'

describe('shareSummary', () => {
  it('builds the canonical message used by both the image and share payload', () => {
    expect(createShareMessage('https://example.com/petrol-share/')).toBe(
      'Created with Petrol Share (https://example.com/petrol-share/)',
    )
  })

  it('shares the PNG card with the Petrol Share message and site URL', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    Object.defineProperties(navigator, {
      share: { configurable: true, value: share },
      canShare: { configurable: true, value: canShare },
    })
    const image = new File(['summary'], 'petrol-share-summary.png', { type: 'image/png' })

    const result = await shareSummary(image, 'https://example.com/petrol-share/')

    const expected = {
      text: 'Created with Petrol Share (https://example.com/petrol-share/)',
      files: [image],
    }
    expect(canShare).toHaveBeenCalledWith({ files: [image] })
    expect(share).toHaveBeenCalledWith(expected)
    expect(result).toEqual({ method: 'shared', messageCopied: false })
  })

  it('downloads the PNG and copies the message when file sharing is unsupported', async () => {
    vi.useFakeTimers()
    const click = vi.fn()
    const remove = vi.fn()
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({ click, remove } as unknown as HTMLAnchorElement)
    const append = vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:summary')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(navigator, {
      share: { configurable: true, value: vi.fn() },
      canShare: { configurable: true, value: vi.fn().mockReturnValue(false) },
      clipboard: { configurable: true, value: { writeText } },
    })
    const image = new File(['summary'], 'petrol-share-summary.png', { type: 'image/png' })

    const result = await shareSummary(image, 'https://example.com/')

    expect(createElement).toHaveBeenCalledWith('a')
    expect(createObjectURL).toHaveBeenCalledWith(image)
    expect(append).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('Created with Petrol Share (https://example.com/)')
    expect(result).toEqual({ method: 'downloaded', messageCopied: true })
    await vi.runAllTimersAsync()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:summary')
    vi.useRealTimers()
  })
})
