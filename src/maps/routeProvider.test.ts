import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenRouteProvider } from './routeProvider'

describe('open route provider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps place suggestions and requests a road distance', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ place_id: 7, display_name: 'Kochi, Kerala', lat: '9.97', lon: '76.28' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 12345 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const provider = createOpenRouteProvider()
    const [place] = await provider.searchPlaces('Kochi')
    expect(place).toEqual({ id: '7', label: 'Kochi, Kerala', latitude: 9.97, longitude: 76.28 })
    await expect(provider.roadDistanceKm(place, { ...place, longitude: 77 })).resolves.toBe(12.345)
    expect(fetchMock.mock.calls[0][0]).toContain('q=Kochi')
    expect(fetchMock.mock.calls[1][0]).toContain('route/v1/driving/76.28,9.97;77,9.97')
  })

  it('turns rate limits and network failures into actionable errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 429 })).mockRejectedValueOnce(new TypeError('offline')))
    const provider = createOpenRouteProvider()
    await expect(provider.searchPlaces('A')).rejects.toMatchObject({ kind: 'rate-limit' })
    await expect(provider.searchPlaces('B')).rejects.toMatchObject({ kind: 'network' })
  })
})
