import { describe, expect, it } from 'vitest'
import { createBlankTripDraft } from '../../domain'
import { persistenceMessage, tripProgress, uniqueReturnStops } from './appViewUtils'

describe('app view utilities', () => {
  it('summarizes incomplete and completed editor progress', () => {
    const blank = createBlankTripDraft()
    expect(tripProgress(blank)).toEqual({ routeComplete: false, fuelComplete: false, peopleComplete: false, hasProgress: false })
    const complete = { ...blank, stops: blank.stops.map((stop, index) => ({ ...stop, name: index ? 'Work' : 'Home' })), legs: blank.legs.map((leg) => ({ ...leg, distanceKm: 10 })), people: [{ id: 'p1', name: 'Asha', assignedLegIds: [] }], fuelSettings: { ...blank.fuelSettings, fuelEconomyKmpl: 10, fuelPricePerLitre: 100 } }
    expect(tripProgress(complete)).toEqual({ routeComplete: true, fuelComplete: true, peopleComplete: true, hasProgress: true })
  })

  it('returns earlier unique named stops but excludes the current stop', () => {
    const draft = createBlankTripDraft()
    draft.stops = [{ id: '1', name: 'Home' }, { id: '2', name: 'Work' }, { id: '3', name: 'home' }, { id: '4', name: 'Gym' }]
    expect(uniqueReturnStops(draft).map(({ name }) => name)).toEqual(['Home', 'Work'])
  })

  it('maps persistence errors to user guidance', () => {
    expect(persistenceMessage('error')).toContain('Could not save')
    expect(persistenceMessage('unknown')).toBe('')
  })
})
