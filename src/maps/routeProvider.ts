export interface PlaceSuggestion {
  id: string
  label: string
  latitude: number
  longitude: number
}

export interface RouteProvider {
  searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]>
  roadDistanceKm(from: PlaceSuggestion, to: PlaceSuggestion, signal?: AbortSignal): Promise<number>
}

export class RouteLookupError extends Error {
  readonly kind: 'network' | 'rate-limit' | 'no-route' | 'provider'

  constructor(message: string, kind: 'network' | 'rate-limit' | 'no-route' | 'provider') {
    super(message)
    this.name = 'RouteLookupError'
    this.kind = kind
  }
}

async function providerResponse(url: string, signal?: AbortSignal): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new RouteLookupError('You appear to be offline. Your existing trip is unchanged; enter the distance manually.', 'network')
  }
  if (response.status === 429) throw new RouteLookupError('The map service is busy or rate-limited. Try later or enter the distance manually.', 'rate-limit')
  if (!response.ok) throw new RouteLookupError('The map service could not complete the request. Your existing trip is unchanged.', 'provider')
  return response
}

export function createOpenRouteProvider(): RouteProvider {
  return {
    async searchPlaces(query, signal) {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', query.trim())
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', '5')
      url.searchParams.set('addressdetails', '0')
      const response = await providerResponse(url.toString(), signal)
      const results = await response.json() as Array<{ place_id: number | string; display_name: string; lat: string; lon: string }>
      return results.flatMap((place) => {
        const latitude = Number(place.lat)
        const longitude = Number(place.lon)
        return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [{ id: String(place.place_id), label: place.display_name, latitude, longitude }]
          : []
      })
    },
    async roadDistanceKm(from, to, signal) {
      const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`
      const response = await providerResponse(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`, signal)
      const result = await response.json() as { code?: string; routes?: Array<{ distance?: number }> }
      const metres = result.routes?.[0]?.distance
      if (result.code !== 'Ok' || typeof metres !== 'number' || !Number.isFinite(metres) || metres <= 0) {
        throw new RouteLookupError('No driving route was found between those places. Choose different suggestions or enter the distance manually.', 'no-route')
      }
      return metres / 1000
    },
  }
}

export const openRouteProvider = createOpenRouteProvider()
