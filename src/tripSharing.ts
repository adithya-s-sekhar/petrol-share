import { z } from 'zod'
import { persistedTripDraftSchema, TRIP_SCHEMA_VERSION, type TripDraft, type UnitSystem } from './domain'

export const EDITABLE_TRIP_FORMAT_VERSION = 1 as const
export const MAX_EDITABLE_TRIP_BYTES = 64 * 1024
export const EDITABLE_TRIP_HASH_KEY = 'trip'

const portableTripSchema = z.object({
  format: z.literal('petrol-share-trip'),
  version: z.literal(EDITABLE_TRIP_FORMAT_VERSION),
  name: z.string().trim().min(1).max(120),
  unitSystem: z.enum(['metric', 'us', 'imperial']),
  trip: z.object({
    stops: z.array(z.string().max(200)).min(2).max(100),
    legs: z.array(z.object({
      distanceKm: z.number().finite().positive().nullable(),
      distanceSource: z.enum(['manual', 'reused', 'lookup', 'copied']).optional(),
    })).max(99),
    people: z.array(z.object({
      name: z.string().max(200),
      assignedLegIndexes: z.array(z.number().int().nonnegative()).max(99),
    })).max(100),
    allocationRules: z.array(z.object({
      legIndex: z.number().int().nonnegative(),
      mode: z.enum(['equal', 'weights', 'percentages', 'fixed']),
      shares: z.array(z.object({ personIndex: z.number().int().nonnegative(), value: z.number().finite().nonnegative() })).max(100),
    })).max(99).optional().default([]),
    expenses: z.array(z.object({
      name: z.string().max(200),
      amount: z.number().finite().positive().nullable(),
      scope: z.enum(['journey', 'leg', 'people']),
      legIndex: z.number().int().nonnegative().optional(),
      personIndexes: z.array(z.number().int().nonnegative()).max(100),
    })).max(100).optional().default([]),
    fuelSettings: z.object({
      fuelEconomyKmpl: z.number().finite().positive().nullable(),
      fuelPricePerLitre: z.number().finite().positive().nullable(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      fuelType: z.string().max(100).optional(),
    }).strict(),
  }).strict(),
}).strict().superRefine((payload, context) => {
  if (payload.trip.legs.length !== payload.trip.stops.length - 1) {
    context.addIssue({ code: 'custom', message: 'Legs must match the route', path: ['trip', 'legs'] })
  }
  payload.trip.people.forEach((person, personIndex) => {
    if (new Set(person.assignedLegIndexes).size !== person.assignedLegIndexes.length || person.assignedLegIndexes.some((index) => index >= payload.trip.legs.length)) {
      context.addIssue({ code: 'custom', message: 'Rider assignments reference an unknown leg', path: ['trip', 'people', personIndex, 'assignedLegIndexes'] })
    }
  })
  payload.trip.expenses.forEach((expense, expenseIndex) => {
    if (expense.scope === 'leg' && (expense.legIndex === undefined || expense.legIndex >= payload.trip.legs.length)) context.addIssue({ code: 'custom', message: 'Expense references an unknown leg', path: ['trip', 'expenses', expenseIndex, 'legIndex'] })
    if (new Set(expense.personIndexes).size !== expense.personIndexes.length || expense.personIndexes.some((index) => index >= payload.trip.people.length)) context.addIssue({ code: 'custom', message: 'Expense references an unknown rider', path: ['trip', 'expenses', expenseIndex, 'personIndexes'] })
  })
  payload.trip.allocationRules.forEach((rule, ruleIndex) => {
    if (rule.legIndex >= payload.trip.legs.length) context.addIssue({ code: 'custom', message: 'Allocation references an unknown leg', path: ['trip', 'allocationRules', ruleIndex, 'legIndex'] })
    if (rule.shares.some(({ personIndex }) => personIndex >= payload.trip.people.length)) context.addIssue({ code: 'custom', message: 'Allocation references an unknown rider', path: ['trip', 'allocationRules', ruleIndex, 'shares'] })
  })
})

export interface EditableTripImport {
  name: string
  unitSystem: UnitSystem
  draft: TripDraft
}

export class EditableTripImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EditableTripImportError'
  }
}

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function assertSize(value: string): void {
  if (byteLength(value) > MAX_EDITABLE_TRIP_BYTES) throw new EditableTripImportError('This trip is too large to import. Choose a Petrol Share file smaller than 64 KB.')
}

export function serializeEditableTrip(draft: TripDraft, name: string, unitSystem: UnitSystem): string {
  const legIndexes = new Map(draft.legs.map((leg, index) => [leg.id, index]))
  const personIndexes = new Map(draft.people.map((person, index) => [person.id, index]))
  return JSON.stringify({
    format: 'petrol-share-trip',
    version: EDITABLE_TRIP_FORMAT_VERSION,
    name: name.trim() || 'Shared trip',
    unitSystem,
    trip: {
      stops: draft.stops.map(({ name: stopName }) => stopName),
      legs: draft.legs.map(({ distanceKm, distanceSource }) => ({ distanceKm, ...(distanceSource ? { distanceSource } : {}) })),
      people: draft.people.map(({ name: personName, assignedLegIds }) => ({
        name: personName,
        assignedLegIndexes: assignedLegIds.map((legId) => legIndexes.get(legId)).filter((index): index is number => index !== undefined),
      })),
      allocationRules: (draft.allocationRules ?? []).map((rule) => ({
        legIndex: legIndexes.get(rule.legId),
        mode: rule.mode,
        shares: rule.shares.map((share) => ({ personIndex: personIndexes.get(share.personId), value: share.value })).filter((share): share is { personIndex: number; value: number } => share.personIndex !== undefined),
      })).filter((rule): rule is typeof rule & { legIndex: number } => rule.legIndex !== undefined),
      expenses: (draft.expenses ?? []).map(({ name: expenseName, amount, scope, legId, personIds }) => ({
        name: expenseName,
        amount,
        scope,
        ...(legId && legIndexes.has(legId) ? { legIndex: legIndexes.get(legId) } : {}),
        personIndexes: personIds.map((personId) => personIndexes.get(personId)).filter((index): index is number => index !== undefined),
      })),
      fuelSettings: draft.fuelSettings,
    },
  })
}

export function deserializeEditableTrip(serialized: string): EditableTripImport {
  assertSize(serialized)
  let unknownPayload: unknown
  try { unknownPayload = JSON.parse(serialized) } catch { throw new EditableTripImportError('This is not a valid Petrol Share trip. Check the link or choose another file.') }
  if (typeof unknownPayload === 'object' && unknownPayload !== null && 'version' in unknownPayload && (unknownPayload as { version?: unknown }).version !== EDITABLE_TRIP_FORMAT_VERSION) {
    throw new EditableTripImportError('This trip was created by a newer version of Petrol Share. Update the app before importing it.')
  }
  const parsed = portableTripSchema.safeParse(unknownPayload)
  if (!parsed.success) throw new EditableTripImportError('This trip is malformed or incomplete. Ask the sender to export it again.')
  const stopIds = parsed.data.trip.stops.map(() => id())
  const legIds = parsed.data.trip.legs.map(() => id())
  const draft: TripDraft = {
    schemaVersion: TRIP_SCHEMA_VERSION,
    stops: parsed.data.trip.stops.map((name, index) => ({ id: stopIds[index], name })),
    legs: parsed.data.trip.legs.map((leg, index) => ({ id: legIds[index], fromStopId: stopIds[index], toStopId: stopIds[index + 1], ...leg })),
    people: parsed.data.trip.people.map((person) => ({ id: id(), name: person.name, assignedLegIds: person.assignedLegIndexes.map((index) => legIds[index]) })),
    expenses: [],
    allocationRules: [],
    fuelSettings: parsed.data.trip.fuelSettings,
    updatedAt: new Date().toISOString(),
  }
  const personIds = draft.people.map(({ id: personId }) => personId)
  draft.allocationRules = parsed.data.trip.allocationRules.map((rule) => ({ legId: legIds[rule.legIndex], mode: rule.mode, shares: rule.shares.map((share) => ({ personId: personIds[share.personIndex], value: share.value })) }))
  draft.expenses = parsed.data.trip.expenses.map((expense) => ({
    id: id(), name: expense.name, amount: expense.amount, scope: expense.scope,
    ...(expense.legIndex === undefined ? {} : { legId: legIds[expense.legIndex] }),
    personIds: expense.personIndexes.map((index) => personIds[index]),
  }))
  if (!persistedTripDraftSchema.safeParse(draft).success) throw new EditableTripImportError('This trip is malformed or incomplete. Ask the sender to export it again.')
  return { name: parsed.data.name, unitSystem: parsed.data.unitSystem, draft }
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  try {
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
  } catch { throw new EditableTripImportError('This editable trip link is damaged. Ask the sender to copy it again.') }
}

export function createEditableTripLink(serialized: string, pageUrl: string): string {
  assertSize(serialized)
  const url = new URL(pageUrl)
  url.hash = `${EDITABLE_TRIP_HASH_KEY}=${toBase64Url(serialized)}`
  return url.toString()
}

export function readEditableTripLink(location: Pick<Location, 'hash'>): EditableTripImport | null {
  const match = location.hash.match(/^#trip=(.+)$/)
  return match ? deserializeEditableTrip(fromBase64Url(match[1])) : null
}
