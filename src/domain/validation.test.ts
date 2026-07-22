import { describe, expect, it } from 'vitest'
import {
  createBlankTripDraft,
  editableTripDraftSchema,
  persistedTripDraftSchema,
  tripDraftSchema,
  type TripDraft,
} from './index'

function validDraft(): TripDraft {
  return {
    schemaVersion: 1,
    stops: [
      { id: 'stop-a', name: ' Town ' },
      { id: 'stop-b', name: 'Town' },
    ],
    legs: [{ id: 'leg-a-b', fromStopId: 'stop-a', toStopId: 'stop-b', distanceKm: 12 }],
    people: [
      { id: 'person-1', name: ' Alex ', assignedLegIds: ['leg-a-b'] },
      { id: 'person-2', name: 'Blair', assignedLegIds: [] },
    ],
    fuelSettings: { fuelEconomyKmpl: 15, fuelPricePerLitre: 105, currency: 'inr' },
    updatedAt: '2026-07-22T10:00:00.000Z',
  }
}

describe('trip validation', () => {
  it('accepts repeated stop names because stop occurrences have distinct IDs', () => {
    const result = tripDraftSchema.parse(validDraft())

    expect(result.stops.map(({ name }) => name)).toEqual(['Town', 'Town'])
    expect(result.people[0].name).toBe('Alex')
    expect(result.fuelSettings.currency).toBe('INR')
  })

  it('rejects case-insensitive duplicate trimmed person names', () => {
    const draft = validDraft()
    draft.people[1].name = '  aLEX '

    const result = tripDraftSchema.safeParse(draft)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ message: 'Person names must be unique', path: ['people', 1, 'name'] }),
      ]))
    }
  })

  it('reports invalid numeric inputs and currencies at useful paths', () => {
    const draft = validDraft()
    draft.legs[0].distanceKm = Number.POSITIVE_INFINITY
    draft.fuelSettings.fuelEconomyKmpl = 0
    draft.fuelSettings.fuelPricePerLitre = -2
    draft.fuelSettings.currency = 'rupees'

    const result = tripDraftSchema.safeParse(draft)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(({ path }) => path)).toEqual(expect.arrayContaining([
        ['legs', 0, 'distanceKm'],
        ['fuelSettings', 'fuelEconomyKmpl'],
        ['fuelSettings', 'fuelPricePerLitre'],
        ['fuelSettings', 'currency'],
      ]))
    }
  })

  it('rejects stale stop references, assignments, and legs out of route order', () => {
    const draft = validDraft()
    draft.legs[0].toStopId = 'missing-stop'
    draft.people[0].assignedLegIds.push('missing-leg')

    const result = tripDraftSchema.safeParse(draft)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message)).toEqual(expect.arrayContaining([
        'Leg references an unknown destination stop',
        'Person is assigned to an unknown leg',
        'Leg does not match the route order',
      ]))
    }
  })

  it('accepts incomplete but structurally sound persisted editor state', () => {
    const draft = createBlankTripDraft({
      createId: (() => {
        let id = 0
        return () => `id-${++id}`
      })(),
      now: () => new Date('2026-07-22T10:00:00.000Z'),
    })

    expect(persistedTripDraftSchema.safeParse(draft).success).toBe(true)
    expect(tripDraftSchema.safeParse(draft).success).toBe(false)
    expect(draft).toMatchObject({
      schemaVersion: 1,
      stops: [{ name: '' }, { name: '' }],
      legs: [{ distanceKm: null }],
      people: [],
      fuelSettings: { currency: 'INR' },
      updatedAt: '2026-07-22T10:00:00.000Z',
    })
  })

  it('normalizes numeric strings from editable form values', () => {
    const draft = validDraft() as unknown as Record<string, unknown>
    const legs = draft.legs as Array<Record<string, unknown>>
    const settings = draft.fuelSettings as Record<string, unknown>
    legs[0].distanceKm = '12.5'
    settings.fuelEconomyKmpl = '16'
    settings.fuelPricePerLitre = '104.25'

    const result = editableTripDraftSchema.parse(draft)

    expect(result.legs[0].distanceKm).toBe(12.5)
    expect(result.fuelSettings).toMatchObject({ fuelEconomyKmpl: 16, fuelPricePerLitre: 104.25 })
  })

  it('defaults expenses for older persisted trips and validates editable expense fields', () => {
    expect(persistedTripDraftSchema.parse(validDraft()).expenses).toEqual([])
    const draft = validDraft()
    draft.expenses = [{ id: 'expense-1', name: '', amount: null, scope: 'people', personIds: [] }]
    const result = editableTripDraftSchema.safeParse(draft)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'Expense name is required', path: ['expenses', 0, 'name'] }),
      expect.objectContaining({ message: 'Expense amount must be a positive number', path: ['expenses', 0, 'amount'] }),
      expect.objectContaining({ message: 'Select at least one person for this expense', path: ['expenses', 0, 'personIds'] }),
    ]))
  })

  it('defaults allocation rules for old trips and rejects under-allocated percentages', () => {
    expect(persistedTripDraftSchema.parse(validDraft()).allocationRules).toEqual([])
    const draft = validDraft()
    draft.allocationRules = [{ legId: 'leg-a-b', mode: 'percentages', shares: [{ personId: 'person-1', value: 90 }] }]
    const result = editableTripDraftSchema.safeParse(draft)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ message: 'Percentages must add up to exactly 100%' }))
  })

  it('rejects fixed contributions that exceed the leg cost', () => {
    const draft = validDraft()
    draft.allocationRules = [{ legId: 'leg-a-b', mode: 'fixed', shares: [{ personId: 'person-1', value: 1_000 }] }]
    const result = tripDraftSchema.safeParse(draft)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ message: 'Fixed contributions must add up to the leg cost' }))
  })
})
