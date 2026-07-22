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
    fuelCost: person.fuelCost,
    expenseCost: person.expenseCost,
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
  const totalFuelCost = totalLitres * fuelPricePerLitre
  const totalAdditionalCost = (draft.expenses ?? []).reduce((sum, expense) => sum + requirePositive(expense.amount, `Amount for expense ${expense.id}`), 0)
  const totalCost = totalFuelCost + totalAdditionalCost
  const allocationRules = draft.legs.map((leg) => {
    const riders = draft.people.filter((person) => person.assignedLegIds.includes(leg.id))
    const rule = (draft.allocationRules ?? []).find((candidate) => candidate.legId === leg.id)
    if (!rule || rule.mode === 'equal') return { legId: leg.id, description: 'Equal split' }
    const entries = rule.shares.map((share) => `${draft.people.find(({ id }) => id === share.personId)?.name ?? 'Unknown'} ${share.value}${rule.mode === 'percentages' ? '%' : rule.mode === 'weights' ? '×' : ` ${draft.fuelSettings.currency}`}`)
    const label = rule.mode === 'weights' ? 'Weighted' : rule.mode === 'percentages' ? 'Percentages' : 'Fixed contributions'
    return { legId: leg.id, description: `${label}: ${entries.join(', ')}${rule.mode === 'fixed' && rule.shares.length < riders.length ? '; remainder split equally' : ''}` }
  })

  const expenseShares = new Map<string, number>()
  const unassignedExpenseIds: string[] = []
  for (const expense of draft.expenses ?? []) {
    const recipients = expense.scope === 'journey'
      ? draft.people
      : expense.scope === 'leg'
        ? draft.people.filter((person) => person.assignedLegIds.includes(expense.legId ?? ''))
        : draft.people.filter((person) => expense.personIds.includes(person.id))
    if (recipients.length === 0) { unassignedExpenseIds.push(expense.id); continue }
    const share = requirePositive(expense.amount, `Amount for expense ${expense.id}`) / recipients.length
    recipients.forEach((person) => expenseShares.set(person.id, (expenseShares.get(person.id) ?? 0) + share))
  }

  if (unassignedLegIds.length > 0 || unassignedExpenseIds.length > 0) {
    return { totalDistanceKm, totalLitres, totalCost, totalFuelCost, totalAdditionalCost, people: [], unassignedLegIds, unassignedExpenseIds, allocationRules }
  }

  const rawPeople = draft.people.map((person, creationIndex): RawPersonResult => {
    const assigned = new Set(person.assignedLegIds)
    const assignedLegs = draft.legs.filter((leg) => assigned.has(leg.id))
    const fuelCost = assignedLegs.reduce((sum, leg) => {
      const cost = legCosts.get(leg.id) ?? 0
      const riders = draft.people.filter((candidate) => candidate.assignedLegIds.includes(leg.id))
      const rule = (draft.allocationRules ?? []).find((candidate) => candidate.legId === leg.id)
      if (!rule || rule.mode === 'equal') return sum + cost / riders.length
      const value = rule.shares.find((share) => share.personId === person.id)?.value ?? 0
      if (rule.mode === 'percentages') return sum + cost * value / 100
      if (rule.mode === 'weights') {
        const totalWeight = rule.shares.reduce((total, share) => total + share.value, 0)
        return sum + cost * value / totalWeight
      }
      const fixedTotal = rule.shares.reduce((total, share) => total + share.value, 0)
      const flexible = riders.filter((rider) => !rule.shares.some((share) => share.personId === rider.id))
      return sum + (rule.shares.some((share) => share.personId === person.id) ? value : Math.max(0, cost - fixedTotal) / Math.max(1, flexible.length))
    }, 0)
    const expenseCost = expenseShares.get(person.id) ?? 0
    return {
      personId: person.id,
      personName: person.name,
      distanceKm: assignedLegs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0),
      legIds: assignedLegs.map(({ id }) => id),
      rawCost: fuelCost + expenseCost,
      displayCost: 0,
      fuelCost,
      expenseCost,
      creationIndex,
    }
  })

  const fractionDigits = getCurrencyFractionDigits(draft.fuelSettings.currency)
  const people = reconcileDisplayCosts(rawPeople, totalCost, fractionDigits)

  return { totalDistanceKm, totalLitres, totalCost, totalFuelCost, totalAdditionalCost, people, unassignedLegIds, unassignedExpenseIds, allocationRules }
}
