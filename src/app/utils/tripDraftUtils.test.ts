import { describe, expect, it } from 'vitest'
import { createBlankTripDraft } from '../../domain'
import { cloneDraft, displayNumber, numberFromInput, routeSummary, validationErrors } from './tripDraftUtils'

describe('trip draft utilities', () => {
  it('parses and formats controlled numeric inputs', () => {
    expect(numberFromInput('')).toBeNull()
    expect(numberFromInput(' 12.5 ')).toBe(12.5)
    expect(displayNumber(null, (value) => value)).toBe('')
    expect(displayNumber(1, (value) => value / 3)).toBe(0.333333)
  })

  it('summarizes named route stops', () => {
    const draft = createBlankTripDraft()
    expect(routeSummary(draft)).toBe('Route not named yet')
    draft.stops[0].name = ' Home '
    draft.stops[1].name = 'Work'
    expect(routeSummary(draft)).toBe('Home → Work')
  })

  it('clones every relational id and strips journey-specific data for templates', () => {
    const draft = createBlankTripDraft()
    draft.stops[0].name = 'A'
    draft.stops[1].name = 'B'
    draft.legs[0].distanceKm = 10
    draft.people = [{ id: 'person', name: 'Asha', assignedLegIds: [draft.legs[0].id] }]
    draft.expenses = [{ id: 'expense', name: 'Toll', amount: 5, scope: 'people', personIds: ['person'] }]

    const copy = cloneDraft(draft)
    expect(copy.stops.map(({ id }) => id)).not.toEqual(draft.stops.map(({ id }) => id))
    expect(copy.legs[0].fromStopId).toBe(copy.stops[0].id)
    expect(copy.people[0].assignedLegIds).toEqual([copy.legs[0].id])
    expect(copy.expenses?.[0].personIds).toEqual([copy.people[0].id])

    const template = cloneDraft(draft, true)
    expect(template.people).toEqual([])
    expect(template.expenses).toEqual([])
  })

  it('maps schema errors to field paths', () => {
    const errors = validationErrors(createBlankTripDraft())
    expect(errors['stops.0.name']).toBe('Stop name is required')
    expect(errors.people).toBe('At least one person is required')
  })
})
