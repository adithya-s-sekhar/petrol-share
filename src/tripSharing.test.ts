import { describe, expect, it, vi } from 'vitest'
import { createBlankTripDraft } from './domain'
import { createEditableTripLink, deserializeEditableTrip, MAX_EDITABLE_TRIP_BYTES, readEditableTripLink, serializeEditableTrip } from './tripSharing'

function representativeTrip() {
  const draft = createBlankTripDraft({ createId: vi.fn().mockReturnValueOnce('s1').mockReturnValueOnce('s2').mockReturnValueOnce('l1'), now: () => new Date('2025-01-01') })
  draft.stops[0].name = 'Home'
  draft.stops[1].name = 'Café'
  draft.legs[0].distanceKm = 12.5
  draft.people = [{ id: 'p1', name: 'Asha', assignedLegIds: ['l1'] }]
  draft.fuelSettings = { fuelEconomyKmpl: 15, fuelPricePerLitre: 100, currency: 'INR' }
  return draft
}

describe('editable trip sharing', () => {
  it('round trips trip inputs and units without local metadata', () => {
    const draft = representativeTrip()
    draft.allocationRules = [{ legId: 'l1', mode: 'percentages', shares: [{ personId: 'p1', value: 100 }] }]
    const serialized = serializeEditableTrip(draft, 'Evening ride', 'imperial')
    expect(serialized).not.toContain('updatedAt')
    expect(serialized).not.toContain('p1')
    const imported = deserializeEditableTrip(serialized)
    expect(imported.name).toBe('Evening ride')
    expect(imported.unitSystem).toBe('imperial')
    expect(imported.draft.stops.map(({ name }) => name)).toEqual(['Home', 'Café'])
    expect(imported.draft.people[0].assignedLegIds).toEqual([imported.draft.legs[0].id])
    expect(imported.draft.allocationRules).toEqual([{ legId: imported.draft.legs[0].id, mode: 'percentages', shares: [{ personId: imported.draft.people[0].id, value: 100 }] }])
  })

  it('encodes unicode payloads in an editable link', () => {
    const serialized = serializeEditableTrip(representativeTrip(), 'Café trip', 'us')
    const link = createEditableTripLink(serialized, 'https://example.com/app')
    expect(readEditableTripLink({ hash: new URL(link).hash } as Location)?.name).toBe('Café trip')
  })

  it('rejects malformed, oversized, and newer payloads safely', () => {
    expect(() => deserializeEditableTrip('{bad')).toThrow(/not a valid Petrol Share trip/)
    expect(() => deserializeEditableTrip(JSON.stringify({ format: 'petrol-share-trip', version: 2 }))).toThrow(/newer version/)
    expect(() => deserializeEditableTrip('x'.repeat(MAX_EDITABLE_TRIP_BYTES + 1))).toThrow(/too large/)
    expect(() => deserializeEditableTrip(JSON.stringify({ format: 'petrol-share-trip', version: 1 }))).toThrow(/malformed or incomplete/)
  })
})
