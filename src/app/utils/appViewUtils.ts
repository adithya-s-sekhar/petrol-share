import type { TripDraft } from '../../domain'

export type EditorSection = 'route' | 'fuel' | 'people'

export function tripProgress(draft: TripDraft) {
  return {
    routeComplete: draft.stops.every((stop) => stop.name.trim()) && draft.legs.every((leg) => leg.distanceKm !== null && leg.distanceKm > 0),
    fuelComplete: (draft.fuelSettings.fuelEconomyKmpl ?? 0) > 0 && (draft.fuelSettings.fuelPricePerLitre ?? 0) > 0 && draft.fuelSettings.currency.length === 3,
    peopleComplete: draft.people.length > 0 && draft.people.every((person) => person.name.trim()),
    hasProgress: draft.stops.some((stop) => stop.name.trim()) || draft.people.length > 0 || draft.legs.some((leg) => leg.distanceKm !== null) || (draft.expenses?.length ?? 0) > 0,
  }
}

export function uniqueReturnStops(draft: TripDraft) {
  const currentName = draft.stops.at(-1)?.name.trim().toLocaleLowerCase()
  return draft.stops.filter((stop, index, stops) => {
    const name = stop.name.trim().toLocaleLowerCase()
    return name !== '' && name !== currentName && stops.findIndex((candidate) => candidate.name.trim().toLocaleLowerCase() === name) === index
  })
}

export function persistenceMessage(status: string) {
  return ({
    loading: 'Loading your trip…', idle: 'Autosave ready', saving: 'Saving…', saved: 'Saved',
    migrated: 'Previous draft migrated to Saved trips.', recovered: 'Saved trip could not be restored. A new trip was started safely.',
    error: 'Could not save changes. Keep this page open and try another edit.',
  } as Record<string, string>)[status] ?? ''
}
