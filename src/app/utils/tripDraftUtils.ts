import { editableTripDraftSchema, type TripDraft } from '../../domain'

export type ErrorMap = Record<string, string>

export function numberFromInput(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

export function displayNumber(value: number | null, convert: (value: number) => number): string | number {
  if (value === null) return ''
  return Number(convert(value).toFixed(6))
}

export function recordId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function cloneDraft(source: TripDraft, template = false): TripDraft {
  const stopIds = new Map(source.stops.map(({ id }) => [id, recordId()]))
  const legIds = new Map(source.legs.map(({ id }) => [id, recordId()]))
  const personIds = new Map(source.people.map(({ id }) => [id, recordId()]))
  const now = new Date().toISOString()
  return {
    ...structuredClone(source),
    stops: source.stops.map((stop) => ({ ...stop, id: stopIds.get(stop.id)! })),
    legs: source.legs.map((leg) => ({ ...leg, id: legIds.get(leg.id)!, fromStopId: stopIds.get(leg.fromStopId)!, toStopId: stopIds.get(leg.toStopId)! })),
    people: template ? [] : source.people.map((person) => ({ ...person, id: personIds.get(person.id)!, assignedLegIds: person.assignedLegIds.map((id) => legIds.get(id)!).filter(Boolean) })),
    expenses: template ? [] : (source.expenses ?? []).map((expense) => ({ ...expense, id: recordId(), ...(expense.legId ? { legId: legIds.get(expense.legId) } : {}), personIds: expense.personIds.map((id) => personIds.get(id)!).filter(Boolean) })),
    updatedAt: now,
  }
}

export function routeSummary(draft: TripDraft): string {
  const names = draft.stops.map(({ name }) => name.trim()).filter(Boolean)
  return names.length ? names.join(' → ') : 'Route not named yet'
}

export function validationErrors(draft: TripDraft): ErrorMap {
  const result = editableTripDraftSchema.safeParse(draft)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}
