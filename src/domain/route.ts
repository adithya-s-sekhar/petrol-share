import type { Leg, Person, Stop, TripDraft } from './trip'

export interface NormalizedRoute {
  legs: Leg[]
  people: Person[]
}

export interface NormalizeRouteOptions {
  createId?: () => string
}

function defaultCreateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function normalizedStopName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function undirectedNamePair(fromName: string, toName: string): string | null {
  const names = [normalizedStopName(fromName), normalizedStopName(toName)]
  if (names.some((name) => name === '')) return null
  return names.sort().join('\u0000')
}

/**
 * Builds the legs implied by `stops`. Data is retained only for an existing
 * directed adjacent stop-ID pair; assignments to removed legs are discarded.
 */
export function normalizeRoute(
  stops: readonly Stop[],
  existingLegs: readonly Leg[],
  people: readonly Person[],
  options: NormalizeRouteOptions = {},
): NormalizedRoute {
  const createId = options.createId ?? defaultCreateId
  const existingByPair = new Map(existingLegs.map((leg) => [
    `${leg.fromStopId}\u0000${leg.toStopId}`,
    leg,
  ]))
  const stopNamesById = new Map(stops.map((stop) => [stop.id, stop.name]))
  const reusableDistanceByNamePair = new Map<string, number>()
  for (const leg of existingLegs) {
    if (leg.distanceKm === null) continue
    const pair = undirectedNamePair(
      stopNamesById.get(leg.fromStopId) ?? '',
      stopNamesById.get(leg.toStopId) ?? '',
    )
    if (pair !== null && !reusableDistanceByNamePair.has(pair)) {
      reusableDistanceByNamePair.set(pair, leg.distanceKm)
    }
  }

  const legs = stops.slice(0, -1).map((stop, index): Leg => {
    const nextStop = stops[index + 1]
    const existing = existingByPair.get(`${stop.id}\u0000${nextStop.id}`)
    const reusedDistance = reusableDistanceByNamePair.get(
      undirectedNamePair(stop.name, nextStop.name) ?? '',
    )
    return existing ?? {
      id: createId(),
      fromStopId: stop.id,
      toStopId: nextStop.id,
      distanceKm: reusedDistance ?? null,
      ...(reusedDistance === undefined ? {} : { distanceSource: 'reused' as const }),
    }
  })
  const retainedLegIds = new Set(legs.map(({ id }) => id))

  return {
    legs,
    people: people.map((person) => ({
      ...person,
      assignedLegIds: person.assignedLegIds.filter((legId) => retainedLegIds.has(legId)),
    })),
  }
}

export function normalizeTripRoute(
  draft: TripDraft,
  stops: readonly Stop[],
  options: NormalizeRouteOptions = {},
): TripDraft {
  const normalized = normalizeRoute(stops, draft.legs, draft.people, options)
  const retainedLegIds = new Set(normalized.legs.map(({ id }) => id))
  const expenses = (draft.expenses ?? []).map((expense) => expense.scope === 'leg' && expense.legId && !retainedLegIds.has(expense.legId)
    ? { ...expense, legId: undefined }
    : expense)
  return { ...draft, stops: [...stops], ...normalized, expenses }
}
