import { useState } from 'react'
import type { TripDraft } from '../../domain'
import { openRouteProvider, type PlaceSuggestion } from '../../maps/routeProvider'

export type MapDialog = { legId: string; fromQuery: string; toQuery: string }

export function useRouteLookup(draft: TripDraft, update: (draft: TripDraft) => void, stopsById: Map<string, string>) {
  const [mapDialog, setMapDialog] = useState<MapDialog | null>(null)
  const [fromSuggestions, setFromSuggestions] = useState<PlaceSuggestion[]>([])
  const [toSuggestions, setToSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedFrom, setSelectedFrom] = useState('')
  const [selectedTo, setSelectedTo] = useState('')
  const [mapStatus, setMapStatus] = useState<'idle' | 'searching' | 'routing'>('idle')
  const [mapError, setMapError] = useState('')

  function showMapDialog(legId: string) {
    const leg = draft.legs.find((item) => item.id === legId)
    if (!leg) return
    setMapDialog({ legId, fromQuery: stopsById.get(leg.fromStopId) ?? '', toQuery: stopsById.get(leg.toStopId) ?? '' })
    setFromSuggestions([]); setToSuggestions([]); setSelectedFrom(''); setSelectedTo(''); setMapError(''); setMapStatus('idle')
  }

  async function findPlaces() {
    if (!mapDialog?.fromQuery.trim() || !mapDialog.toQuery.trim()) {
      setMapError('Enter both place names before searching.')
      return
    }
    setMapStatus('searching'); setMapError('')
    try {
      // Searches are deliberately sequential to respect the public geocoder's usage limits.
      const from = await openRouteProvider.searchPlaces(mapDialog.fromQuery)
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      const to = await openRouteProvider.searchPlaces(mapDialog.toQuery)
      setFromSuggestions(from); setToSuggestions(to); setSelectedFrom(from[0]?.id ?? ''); setSelectedTo(to[0]?.id ?? '')
      if (!from.length || !to.length) setMapError('No matching places were found. Refine the names or keep entering the distance manually.')
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Place search failed. Your existing trip is unchanged.')
    } finally { setMapStatus('idle') }
  }

  async function applyRoadDistance() {
    if (!mapDialog) return
    const from = fromSuggestions.find(({ id }) => id === selectedFrom)
    const to = toSuggestions.find(({ id }) => id === selectedTo)
    if (!from || !to) { setMapError('Choose an origin and destination suggestion first.'); return }
    setMapStatus('routing'); setMapError('')
    try {
      const distanceKm = await openRouteProvider.roadDistanceKm(from, to)
      const leg = draft.legs.find(({ id }) => id === mapDialog.legId)
      if (!leg) return
      update({
        ...draft,
        stops: draft.stops.map((stop) => stop.id === leg.fromStopId ? { ...stop, name: from.label } : stop.id === leg.toStopId ? { ...stop, name: to.label } : stop),
        legs: draft.legs.map((item) => item.id === leg.id ? { ...item, distanceKm, distanceSource: 'lookup' } : item),
      })
      setMapDialog(null)
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Route lookup failed. Your existing trip is unchanged.')
    } finally { setMapStatus('idle') }
  }

  return { mapDialog, setMapDialog, fromSuggestions, toSuggestions, selectedFrom, setSelectedFrom, selectedTo, setSelectedTo, mapStatus, mapError, showMapDialog, findPlaces, applyRoadDistance }
}
