import type { PersonResult, TripDraft, TripResult } from './trip'

export interface CurrencyFormatOptions {
  locale?: Intl.LocalesArgument
}

/** Returns the number of minor-unit digits used by Intl for a currency. */
export function getCurrencyFractionDigits(
  currency: string,
  options: CurrencyFormatOptions = {},
): number {
  const resolved = new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency,
  }).resolvedOptions()
  return resolved.maximumFractionDigits ?? resolved.minimumFractionDigits ?? 0
}

/** Formats an amount using Intl's rules for the selected currency. */
export function formatCurrency(
  amount: number,
  currency: string,
  options: CurrencyFormatOptions = {},
): string {
  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

function requirePositive(value: number | null, label: string): number {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return value
}

interface RawPersonResult extends PersonResult {
  creationIndex: number
}

function reconcileDisplayCosts(
  people: RawPersonResult[],
  totalCost: number,
  fractionDigits: number,
): PersonResult[] {
  const minorUnitFactor = 10 ** fractionDigits
  const roundedTotalUnits = Math.round(totalCost * minorUnitFactor)
  const allocations = people.map((person) => {
    const exactUnits = person.rawCost * minorUnitFactor
    const floorUnits = Math.floor(exactUnits)
    return {
      person,
      units: floorUnits,
      remainder: exactUnits - floorUnits,
    }
  })
  const allocatedUnits = allocations.reduce((sum, allocation) => sum + allocation.units, 0)
  const unitsToDistribute = roundedTotalUnits - allocatedUnits

  const byRemainder = [...allocations].sort((left, right) =>
    right.remainder - left.remainder
      || left.person.creationIndex - right.person.creationIndex)

  for (let index = 0; index < unitsToDistribute; index += 1) {
    byRemainder[index % byRemainder.length].units += 1
  }

  return allocations.map(({ person, units }) => ({
    personId: person.personId,
    personName: person.personName,
    distanceKm: person.distanceKm,
    legIds: person.legIds,
    rawCost: person.rawCost,
    displayCost: units / minorUnitFactor,
  }))
}

/**
 * Calculates journey and passenger totals without depending on UI state.
 * The draft's numeric fields must be complete; use tripDraftSchema before
 * calling when handling untrusted or editable data.
 */
export function calculateTrip(draft: TripDraft): TripResult {
  const fuelEconomyKmpl = requirePositive(
    draft.fuelSettings.fuelEconomyKmpl,
    'Fuel economy',
  )
  const fuelPricePerLitre = requirePositive(
    draft.fuelSettings.fuelPricePerLitre,
    'Fuel price',
  )

  const occupantsByLeg = new Map<string, number>()
  for (const person of draft.people) {
    for (const legId of new Set(person.assignedLegIds)) {
      occupantsByLeg.set(legId, (occupantsByLeg.get(legId) ?? 0) + 1)
    }
  }

  const legCosts = new Map<string, number>()
  let totalDistanceKm = 0
  const unassignedLegIds: string[] = []

  for (const leg of draft.legs) {
    const distanceKm = requirePositive(leg.distanceKm, `Distance for leg ${leg.id}`)
    totalDistanceKm += distanceKm
    legCosts.set(leg.id, distanceKm / fuelEconomyKmpl * fuelPricePerLitre)
    if ((occupantsByLeg.get(leg.id) ?? 0) === 0) unassignedLegIds.push(leg.id)
  }

  const totalLitres = totalDistanceKm / fuelEconomyKmpl
  const totalCost = totalLitres * fuelPricePerLitre

  if (unassignedLegIds.length > 0) {
    return { totalDistanceKm, totalLitres, totalCost, people: [], unassignedLegIds }
  }

  const rawPeople = draft.people.map((person, creationIndex): RawPersonResult => {
    const assigned = new Set(person.assignedLegIds)
    const assignedLegs = draft.legs.filter((leg) => assigned.has(leg.id))
    return {
      personId: person.id,
      personName: person.name,
      distanceKm: assignedLegs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0),
      legIds: assignedLegs.map(({ id }) => id),
      rawCost: assignedLegs.reduce((sum, leg) =>
        sum + (legCosts.get(leg.id) ?? 0) / (occupantsByLeg.get(leg.id) ?? 1), 0),
      displayCost: 0,
      creationIndex,
    }
  })

  const fractionDigits = getCurrencyFractionDigits(draft.fuelSettings.currency)
  const people = reconcileDisplayCosts(rawPeople, totalCost, fractionDigits)

  return { totalDistanceKm, totalLitres, totalCost, people, unassignedLegIds }
}
