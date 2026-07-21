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

  const legs = stops.slice(0, -1).map((stop, index): Leg => {
    const nextStop = stops[index + 1]
    const existing = existingByPair.get(`${stop.id}\u0000${nextStop.id}`)
    return existing ?? {
      id: createId(),
      fromStopId: stop.id,
      toStopId: nextStop.id,
      distanceKm: null,
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
  return { ...draft, stops: [...stops], ...normalized }
}
