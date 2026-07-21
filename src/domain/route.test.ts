import { describe, expect, it } from 'vitest'
import { normalizeRoute, normalizeTripRoute, type Leg, type Person, type Stop, type TripDraft } from './index'

const stops: Stop[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
]
const legs: Leg[] = [
  { id: 'ab', fromStopId: 'a', toStopId: 'b', distanceKm: 10 },
  { id: 'bc', fromStopId: 'b', toStopId: 'c', distanceKm: 20 },
]
const people: Person[] = [
  { id: 'p1', name: 'Alex', assignedLegIds: ['ab', 'bc'] },
]

describe('normalizeRoute', () => {
  it('preserves unchanged adjacent pairs when a stop is renamed', () => {
    const renamed = stops.map((stop) => stop.id === 'b' ? { ...stop, name: 'Bee' } : stop)

    const result = normalizeRoute(renamed, legs, people)

    expect(result.legs).toEqual(legs)
    expect(result.people).toEqual(people)
  })

  it('creates blank legs around an inserted stop and removes obsolete assignments', () => {
    const ids = ['ax', 'xb'][Symbol.iterator]()
    const inserted = [stops[0], { id: 'x', name: 'X' }, stops[1], stops[2]]

    const result = normalizeRoute(inserted, legs, people, { createId: () => ids.next().value! })

    expect(result.legs).toEqual([
      { id: 'ax', fromStopId: 'a', toStopId: 'x', distanceKm: null },
      { id: 'xb', fromStopId: 'x', toStopId: 'b', distanceKm: null },
      legs[1],
    ])
    expect(result.people[0].assignedLegIds).toEqual(['bc'])
  })

  it('preserves pairs that remain adjacent after removing a stop', () => {
    const result = normalizeRoute([stops[1], stops[2]], legs, people)

    expect(result.legs).toEqual([legs[1]])
    expect(result.people[0].assignedLegIds).toEqual(['bc'])
  })

  it('creates new reversed legs while reusing their known distances', () => {
    const newIds = ['cb', 'ba'][Symbol.iterator]()

    const result = normalizeRoute([...stops].reverse(), legs, people, { createId: () => newIds.next().value! })

    expect(result.legs).toEqual([
      { id: 'cb', fromStopId: 'c', toStopId: 'b', distanceKm: 20, distanceSource: 'reused' },
      { id: 'ba', fromStopId: 'b', toStopId: 'a', distanceKm: 10, distanceSource: 'reused' },
    ])
    expect(result.people[0].assignedLegIds).toEqual([])
  })

  it('reuses a known distance for a new reverse leg between repeated locations', () => {
    const returnVisit: Stop = { id: 'b-return', name: 'B' }

    const result = normalizeRoute(
      [...stops, returnVisit],
      legs,
      people,
      { createId: () => 'cb' },
    )

    expect(result.legs[2]).toEqual({
      id: 'cb',
      fromStopId: 'c',
      toStopId: 'b-return',
      distanceKm: 20,
      distanceSource: 'reused',
    })
  })

  it('returns a new draft without mutating its inputs', () => {
    const draft: TripDraft = {
      schemaVersion: 1,
      stops,
      legs,
      people,
      fuelSettings: { fuelEconomyKmpl: 10, fuelPricePerLitre: 100, currency: 'INR' },
      updatedAt: '2026-07-22T10:00:00.000Z',
    }
    const nextStops = [stops[0], stops[2]]

    const result = normalizeTripRoute(draft, nextStops, { createId: () => 'ac' })

    expect(result).not.toBe(draft)
    expect(result.legs).toEqual([{ id: 'ac', fromStopId: 'a', toStopId: 'c', distanceKm: null }])
    expect(draft.legs).toEqual(legs)
    expect(draft.people[0].assignedLegIds).toEqual(['ab', 'bc'])
  })
})
