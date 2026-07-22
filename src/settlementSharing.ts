import { distanceFromKm, formatCurrency, unitLabels, type PersonResult, type UnitSystem } from './domain'

export type SettlementShareInput = {
  tripName: string
  person: PersonResult
  currency: string
  unitSystem: UnitSystem
}

export function createSettlementMessage({ tripName, person, currency, unitSystem }: SettlementShareInput): string {
  const units = unitLabels(unitSystem)
  const distance = distanceFromKm(person.distanceKm, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const legs = `${person.legIds.length} ${person.legIds.length === 1 ? 'leg' : 'legs'}`
  const breakdown = person.expenseCost > 0
    ? ` This includes ${formatCurrency(person.fuelCost, currency)} for fuel and ${formatCurrency(person.expenseCost, currency)} for additional expenses.`
    : ' This is their share of the fuel cost.'

  return `${tripName || 'Untitled trip'}: ${person.personName} owes ${formatCurrency(person.displayCost, currency)} for ${distance} ${units.distance} across ${legs}.${breakdown}`
}

function legacyCopy(text: string): boolean {
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  const copied = document.execCommand?.('copy') ?? false
  input.remove()
  return copied
}

export async function shareSettlement(message: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ text: message })
    return 'shared'
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message)
    return 'copied'
  }

  if (legacyCopy(message)) return 'copied'
  throw new Error('Sharing and clipboard access are unavailable in this browser.')
}
