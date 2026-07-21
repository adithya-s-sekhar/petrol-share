import { z } from 'zod'
import { TRIP_SCHEMA_VERSION } from './trip'

const idSchema = z.string().trim().min(1, 'ID is required')
const positiveNumberSchema = z.number().finite('Must be a finite number').positive('Must be a positive number')
const nullablePositiveNumberSchema = positiveNumberSchema.nullable()

const currencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .superRefine((currency, context) => {
    if (!/^[A-Z]{3}$/.test(currency)) {
      context.addIssue({ code: 'custom', message: 'Currency must be a three-letter code' })
      return
    }
    try {
      new Intl.NumberFormat(undefined, { style: 'currency', currency })
    } catch {
      context.addIssue({ code: 'custom', message: 'Currency is not supported by Intl.NumberFormat' })
    }
  })

const stopSchema = z.object({
  id: idSchema,
  name: z.string().trim(),
})

const legSchema = z.object({
  id: idSchema,
  fromStopId: idSchema,
  toStopId: idSchema,
  distanceKm: nullablePositiveNumberSchema,
})

const personSchema = z.object({
  id: idSchema,
  name: z.string().trim(),
  assignedLegIds: z.array(idSchema),
})

const fuelSettingsSchema = z.object({
  fuelEconomyKmpl: nullablePositiveNumberSchema,
  fuelPricePerLitre: nullablePositiveNumberSchema,
  currency: currencySchema,
})

const tripShapeSchema = z.object({
  schemaVersion: z.literal(TRIP_SCHEMA_VERSION),
  stops: z.array(stopSchema),
  legs: z.array(legSchema),
  people: z.array(personSchema),
  fuelSettings: fuelSettingsSchema,
  updatedAt: z.iso.datetime(),
})

function addDuplicateIdIssues(
  values: readonly { id: string }[],
  path: 'stops' | 'legs' | 'people',
  context: z.core.$RefinementCtx,
): void {
  const seen = new Set<string>()
  values.forEach(({ id }, index) => {
    if (seen.has(id)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate ${path.slice(0, -1)} ID`,
        path: [path, index, 'id'],
      })
    }
    seen.add(id)
  })
}

function validateReferences(
  draft: z.infer<typeof tripShapeSchema>,
  context: z.core.$RefinementCtx,
): void {
  addDuplicateIdIssues(draft.stops, 'stops', context)
  addDuplicateIdIssues(draft.legs, 'legs', context)
  addDuplicateIdIssues(draft.people, 'people', context)

  const stopIds = new Set(draft.stops.map(({ id }) => id))
  const legIds = new Set(draft.legs.map(({ id }) => id))

  draft.legs.forEach((leg, index) => {
    if (!stopIds.has(leg.fromStopId)) {
      context.addIssue({ code: 'custom', message: 'Leg references an unknown origin stop', path: ['legs', index, 'fromStopId'] })
    }
    if (!stopIds.has(leg.toStopId)) {
      context.addIssue({ code: 'custom', message: 'Leg references an unknown destination stop', path: ['legs', index, 'toStopId'] })
    }
  })

  draft.people.forEach((person, personIndex) => {
    const assigned = new Set<string>()
    person.assignedLegIds.forEach((legId, assignmentIndex) => {
      if (!legIds.has(legId)) {
        context.addIssue({
          code: 'custom',
          message: 'Person is assigned to an unknown leg',
          path: ['people', personIndex, 'assignedLegIds', assignmentIndex],
        })
      }
      if (assigned.has(legId)) {
        context.addIssue({
          code: 'custom',
          message: 'Person is assigned to the same leg more than once',
          path: ['people', personIndex, 'assignedLegIds', assignmentIndex],
        })
      }
      assigned.add(legId)
    })
  })
}

/** Validates data loaded from storage while allowing incomplete editor fields. */
export const persistedTripDraftSchema = tripShapeSchema.superRefine(validateReferences)

/** Validates a draft as complete and ready for calculations. */
export const tripDraftSchema = tripShapeSchema.superRefine((draft, context) => {
  validateReferences(draft, context)

  if (draft.stops.length < 2) {
    context.addIssue({ code: 'custom', message: 'At least two stops are required', path: ['stops'] })
  }

  draft.stops.forEach((stop, index) => {
    if (!stop.name) {
      context.addIssue({ code: 'custom', message: 'Stop name is required', path: ['stops', index, 'name'] })
    }
  })

  if (draft.people.length < 1) {
    context.addIssue({ code: 'custom', message: 'At least one person is required', path: ['people'] })
  }

  const personNames = new Set<string>()
  draft.people.forEach((person, index) => {
    if (!person.name) {
      context.addIssue({ code: 'custom', message: 'Person name is required', path: ['people', index, 'name'] })
      return
    }
    const comparableName = person.name.toLocaleLowerCase()
    if (personNames.has(comparableName)) {
      context.addIssue({ code: 'custom', message: 'Person names must be unique', path: ['people', index, 'name'] })
    }
    personNames.add(comparableName)
  })

  draft.legs.forEach((leg, index) => {
    if (leg.distanceKm === null) {
      context.addIssue({ code: 'custom', message: 'Distance must be a positive number', path: ['legs', index, 'distanceKm'] })
    }
  })

  const { fuelEconomyKmpl, fuelPricePerLitre } = draft.fuelSettings
  if (fuelEconomyKmpl === null) {
    context.addIssue({ code: 'custom', message: 'Fuel economy must be a positive number', path: ['fuelSettings', 'fuelEconomyKmpl'] })
  }
  if (fuelPricePerLitre === null) {
    context.addIssue({ code: 'custom', message: 'Fuel price must be a positive number', path: ['fuelSettings', 'fuelPricePerLitre'] })
  }

  if (draft.legs.length !== Math.max(0, draft.stops.length - 1)) {
    context.addIssue({ code: 'custom', message: 'Legs must match each adjacent pair of stops', path: ['legs'] })
  } else {
    draft.legs.forEach((leg, index) => {
      if (leg.fromStopId !== draft.stops[index]?.id || leg.toStopId !== draft.stops[index + 1]?.id) {
        context.addIssue({ code: 'custom', message: 'Leg does not match the route order', path: ['legs', index] })
      }
    })
  }
})

/** Editable form values may use numeric strings; successful parsing returns normalized domain data. */
export const editableTripDraftSchema = z.preprocess((input) => {
  if (typeof input !== 'object' || input === null) return input
  const draft = structuredClone(input) as Record<string, unknown>
  const toNumber = (value: unknown) => typeof value === 'string' && value.trim() !== '' ? Number(value) : value

  if (Array.isArray(draft.legs)) {
    draft.legs = draft.legs.map((leg) => typeof leg === 'object' && leg !== null
      ? { ...leg, distanceKm: toNumber((leg as Record<string, unknown>).distanceKm) }
      : leg)
  }
  if (typeof draft.fuelSettings === 'object' && draft.fuelSettings !== null) {
    const settings = draft.fuelSettings as Record<string, unknown>
    draft.fuelSettings = {
      ...settings,
      fuelEconomyKmpl: toNumber(settings.fuelEconomyKmpl),
      fuelPricePerLitre: toNumber(settings.fuelPricePerLitre),
    }
  }
  return draft
}, tripDraftSchema)

export type ValidTripDraft = z.output<typeof tripDraftSchema>
