import { describe, expect, it } from 'vitest'
import {
  calculateTrip,
  formatCurrency,
  getCurrencyFractionDigits,
  type TripDraft,
} from './index'

function draft(overrides: Partial<TripDraft> = {}): TripDraft {
  return {
    schemaVersion: 1,
    stops: [
      { id: 'a1', name: 'A' },
      { id: 'b1', name: 'B' },
    ],
    legs: [{ id: 'ab', fromStopId: 'a1', toStopId: 'b1', distanceKm: 10 }],
    people: [{ id: 'p1', name: 'Alex', assignedLegIds: ['ab'] }],
    fuelSettings: { fuelEconomyKmpl: 10, fuelPricePerLitre: 100, currency: 'INR' },
    updatedAt: '2026-07-22T10:00:00.000Z',
    ...overrides,
  }
}

describe('calculateTrip', () => {
  it('calculates a single-leg journey and divides it equally', () => {
    const result = calculateTrip(draft({
      people: [
        { id: 'p1', name: 'Alex', assignedLegIds: ['ab'] },
        { id: 'p2', name: 'Blair', assignedLegIds: ['ab'] },
      ],
    }))

    expect(result).toMatchObject({
      totalDistanceKm: 10,
      totalLitres: 1,
      totalCost: 100,
      unassignedLegIds: [],
      people: [
        { personId: 'p1', distanceKm: 10, legIds: ['ab'], rawCost: 50, displayCost: 50 },
        { personId: 'p2', distanceKm: 10, legIds: ['ab'], rawCost: 50, displayCost: 50 },
      ],
    })
  })

  it('handles repeated locations, changing groups, and partial-route travellers', () => {
    const trip = draft({
      stops: [
        { id: 'a1', name: 'A' },
        { id: 'b1', name: 'B' },
        { id: 'a2', name: 'A' },
      ],
      legs: [
        { id: 'out', fromStopId: 'a1', toStopId: 'b1', distanceKm: 30 },
        { id: 'back', fromStopId: 'b1', toStopId: 'a2', distanceKm: 20 },
      ],
      people: [
        { id: 'driver', name: 'Driver', assignedLegIds: ['out', 'back'] },
        { id: 'outbound', name: 'Outbound', assignedLegIds: ['out'] },
        { id: 'return', name: 'Return', assignedLegIds: ['back'] },
      ],
    })

    const result = calculateTrip(trip)

    expect(result).toMatchObject({ totalDistanceKm: 50, totalLitres: 5, totalCost: 500 })
    expect(result.people).toEqual([
      expect.objectContaining({ personId: 'driver', distanceKm: 50, legIds: ['out', 'back'], rawCost: 250 }),
      expect.objectContaining({ personId: 'outbound', distanceKm: 30, legIds: ['out'], rawCost: 150 }),
      expect.objectContaining({ personId: 'return', distanceKm: 20, legIds: ['back'], rawCost: 100 }),
    ])
    expect(result.people.reduce((sum, person) => sum + person.rawCost, 0)).toBeCloseTo(result.totalCost)
  })

  it('returns journey totals but withholds people when a positive-distance leg is unoccupied', () => {
    const result = calculateTrip(draft({
      stops: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      legs: [
        { id: 'ab', fromStopId: 'a', toStopId: 'b', distanceKm: 10 },
        { id: 'bc', fromStopId: 'b', toStopId: 'c', distanceKm: 20 },
      ],
      people: [{ id: 'p1', name: 'Alex', assignedLegIds: ['ab'] }],
    }))

    expect(result).toMatchObject({
      totalDistanceKm: 30,
      totalLitres: 3,
      totalCost: 300,
      people: [],
      unassignedLegIds: ['bc'],
    })
  })

  it.each([
    ['JPY', 0],
    ['USD', 2],
    ['KWD', 3],
  ] as const)('uses Intl precision for %s', (currency, digits) => {
    expect(getCurrencyFractionDigits(currency, { locale: 'en-US' })).toBe(digits)
  })

  it('uses creation order to resolve tied largest remainders', () => {
    const result = calculateTrip(draft({
      people: [
        { id: 'first', name: 'First', assignedLegIds: ['ab'] },
        { id: 'second', name: 'Second', assignedLegIds: ['ab'] },
        { id: 'third', name: 'Third', assignedLegIds: ['ab'] },
      ],
      fuelSettings: { fuelEconomyKmpl: 10, fuelPricePerLitre: 100, currency: 'JPY' },
    }))

    expect(result.people.map(({ displayCost }) => displayCost)).toEqual([34, 33, 33])
  })

  it.each([
    ['weights', [{ personId: 'p1', value: 1 }, { personId: 'p2', value: 0.5 }], [66.67, 33.33]],
    ['percentages', [{ personId: 'p1', value: 25 }, { personId: 'p2', value: 75 }], [25, 75]],
    ['fixed', [{ personId: 'p1', value: 30 }], [30, 70]],
  ] as const)('supports %s allocation and reconciles exactly', (mode, shares, expected) => {
    const result = calculateTrip(draft({ people: [{ id: 'p1', name: 'Driver', assignedLegIds: ['ab'] }, { id: 'p2', name: 'Rider', assignedLegIds: ['ab'] }], allocationRules: [{ legId: 'ab', mode, shares: [...shares] }] }))
    expect(result.people.map(({ displayCost }) => displayCost)).toEqual(expected)
    expect(result.people.reduce((sum, person) => sum + person.displayCost, 0)).toBe(result.totalCost)
    expect(result.allocationRules[0].description).not.toBe('Equal split')
  })

  it('supports excluding the driver with a zero weight', () => {
    const result = calculateTrip(draft({ people: [{ id: 'p1', name: 'Driver', assignedLegIds: ['ab'] }, { id: 'p2', name: 'Rider', assignedLegIds: ['ab'] }], allocationRules: [{ legId: 'ab', mode: 'weights', shares: [{ personId: 'p1', value: 0 }, { personId: 'p2', value: 1 }] }] }))
    expect(result.people.map(({ displayCost }) => displayCost)).toEqual([0, 100])
  })

  it('allocates journey, leg, and selected-rider expenses and reconciles the combined total', () => {
    const result = calculateTrip(draft({
      people: [
        { id: 'p1', name: 'Alex', assignedLegIds: ['ab'] },
        { id: 'p2', name: 'Blair', assignedLegIds: ['ab'] },
        { id: 'p3', name: 'Casey', assignedLegIds: [] },
      ],
      expenses: [
        { id: 'toll', name: 'Toll', amount: 10, scope: 'journey', personIds: [] },
        { id: 'parking', name: 'Parking', amount: 5, scope: 'leg', legId: 'ab', personIds: [] },
        { id: 'snacks', name: 'Snacks', amount: 2, scope: 'people', personIds: ['p1'] },
      ],
    }))

    expect(result).toMatchObject({ totalFuelCost: 100, totalAdditionalCost: 17, totalCost: 117, unassignedExpenseIds: [] })
    expect(result.people.map(({ displayCost }) => displayCost)).toEqual([57.84, 55.83, 3.33])
    expect(result.people.reduce((sum, person) => sum + person.displayCost, 0)).toBe(117)
  })

  it('withholds shares when a leg-scoped expense has no riders', () => {
    const result = calculateTrip(draft({ expenses: [{ id: 'parking', name: 'Parking', amount: 50, scope: 'leg', legId: 'ab', personIds: [] }], people: [{ id: 'p1', name: 'Alex', assignedLegIds: [] }] }))
    expect(result.unassignedExpenseIds).toEqual(['parking'])
    expect(result.people).toEqual([])
  })

  it.each([
    ['JPY', 1, [1, 0, 0]],
    ['USD', 0.01, [0.01, 0, 0]],
    ['KWD', 0.001, [0.001, 0, 0]],
  ] as const)('reconciles %s person costs exactly to the displayed total', (currency, price, expected) => {
    const result = calculateTrip(draft({
      people: [
        { id: 'p1', name: 'One', assignedLegIds: ['ab'] },
        { id: 'p2', name: 'Two', assignedLegIds: ['ab'] },
        { id: 'p3', name: 'Three', assignedLegIds: ['ab'] },
      ],
      fuelSettings: { fuelEconomyKmpl: 10, fuelPricePerLitre: price, currency },
    }))

    expect(result.people.map(({ displayCost }) => displayCost)).toEqual(expected)
    const formattedPeople = result.people.map(({ displayCost }) => formatCurrency(displayCost, currency, { locale: 'en-US' }))
    expect(formattedPeople).toHaveLength(3)
    expect(result.people.reduce((sum, person) => sum + person.displayCost, 0)).toBe(
      Number(result.totalCost.toFixed(getCurrencyFractionDigits(currency))),
    )
  })
})
