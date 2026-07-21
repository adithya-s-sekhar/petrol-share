export const TRIP_SCHEMA_VERSION = 1 as const

export type TripId = string

export interface Stop {
  id: TripId
  name: string
}

export interface Leg {
  id: TripId
  fromStopId: TripId
  toStopId: TripId
  distanceKm: number | null
  distanceSource?: 'manual' | 'reused'
}

export interface Person {
  id: TripId
  name: string
  assignedLegIds: TripId[]
}

export interface FuelSettings {
  fuelEconomyKmpl: number | null
  fuelPricePerLitre: number | null
  currency: string
}

export interface TripDraft {
  schemaVersion: typeof TRIP_SCHEMA_VERSION
  stops: Stop[]
  legs: Leg[]
  people: Person[]
  fuelSettings: FuelSettings
  updatedAt: string
}

export interface PersonResult {
  personId: TripId
  personName: string
  distanceKm: number
  legIds: TripId[]
  rawCost: number
  displayCost: number
}

export interface TripResult {
  totalDistanceKm: number
  totalLitres: number
  totalCost: number
  people: PersonResult[]
  unassignedLegIds: TripId[]
}

export interface DraftFactoryOptions {
  createId?: () => string
  now?: () => Date
}

function defaultCreateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

/**
 * Creates an intentionally incomplete, but structurally safe editor state.
 * Blank fields use empty strings/null rather than invalid numeric sentinels.
 */
export function createBlankTripDraft(options: DraftFactoryOptions = {}): TripDraft {
  const createId = options.createId ?? defaultCreateId
  const now = options.now ?? (() => new Date())
  const firstStopId = createId()
  const secondStopId = createId()

  return {
    schemaVersion: TRIP_SCHEMA_VERSION,
    stops: [
      { id: firstStopId, name: '' },
      { id: secondStopId, name: '' },
    ],
    legs: [
      {
        id: createId(),
        fromStopId: firstStopId,
        toStopId: secondStopId,
        distanceKm: null,
      },
    ],
    people: [],
    fuelSettings: {
      fuelEconomyKmpl: null,
      fuelPricePerLitre: null,
      currency: 'INR',
    },
    updatedAt: now().toISOString(),
  }
}
