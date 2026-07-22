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
  distanceSource: z.enum(['manual', 'reused', 'lookup', 'copied']).optional(),
})

const personSchema = z.object({
  id: idSchema,
  name: z.string().trim(),
  assignedLegIds: z.array(idSchema),
})

const allocationRuleSchema = z.object({
  legId: idSchema,
  mode: z.enum(['equal', 'weights', 'percentages', 'fixed']),
  shares: z.array(z.object({ personId: idSchema, value: z.number().finite().nonnegative() })),
})

const expenseSchema = z.object({
  id: idSchema,
  name: z.string().trim(),
  amount: nullablePositiveNumberSchema,
  scope: z.enum(['journey', 'leg', 'people']),
  legId: idSchema.optional(),
  personIds: z.array(idSchema),
})

const fuelSettingsSchema = z.object({
  fuelEconomyKmpl: nullablePositiveNumberSchema,
  fuelPricePerLitre: nullablePositiveNumberSchema,
  currency: currencySchema,
  fuelType: z.string().trim().optional(),
})

const tripShapeSchema = z.object({
  schemaVersion: z.literal(TRIP_SCHEMA_VERSION),
  stops: z.array(stopSchema),
  legs: z.array(legSchema),
  people: z.array(personSchema),
  fuelSettings: fuelSettingsSchema,
  expenses: z.array(expenseSchema).default([]),
  allocationRules: z.array(allocationRuleSchema).default([]),
  updatedAt: z.iso.datetime(),
})

function addDuplicateIdIssues(
  values: readonly { id: string }[],
  path: 'stops' | 'legs' | 'people' | 'expenses',
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
  addDuplicateIdIssues(draft.expenses, 'expenses', context)

  const stopIds = new Set(draft.stops.map(({ id }) => id))
  const legIds = new Set(draft.legs.map(({ id }) => id))
  const personIds = new Set(draft.people.map(({ id }) => id))

  const ruleLegIds = new Set<string>()
  draft.allocationRules.forEach((rule, ruleIndex) => {
    if (!legIds.has(rule.legId)) context.addIssue({ code: 'custom', message: 'Allocation rule references an unknown leg', path: ['allocationRules', ruleIndex, 'legId'] })
    if (ruleLegIds.has(rule.legId)) context.addIssue({ code: 'custom', message: 'A leg can only have one allocation rule', path: ['allocationRules', ruleIndex, 'legId'] })
    ruleLegIds.add(rule.legId)
    const sharePeople = new Set<string>()
    rule.shares.forEach((share, shareIndex) => {
      if (!personIds.has(share.personId)) context.addIssue({ code: 'custom', message: 'Allocation references an unknown person', path: ['allocationRules', ruleIndex, 'shares', shareIndex, 'personId'] })
      if (sharePeople.has(share.personId)) context.addIssue({ code: 'custom', message: 'A rider can only have one share per leg', path: ['allocationRules', ruleIndex, 'shares', shareIndex, 'personId'] })
      sharePeople.add(share.personId)
    })
  })

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
  draft.expenses.forEach((expense, expenseIndex) => {
    if (expense.scope === 'leg' && expense.legId && !legIds.has(expense.legId)) {
      context.addIssue({ code: 'custom', message: 'Choose a journey leg for this expense', path: ['expenses', expenseIndex, 'legId'] })
    }
    const assigned = new Set<string>()
    expense.personIds.forEach((personId, assignmentIndex) => {
      if (!personIds.has(personId)) context.addIssue({ code: 'custom', message: 'Expense references an unknown person', path: ['expenses', expenseIndex, 'personIds', assignmentIndex] })
      if (assigned.has(personId)) context.addIssue({ code: 'custom', message: 'Person is assigned to the expense more than once', path: ['expenses', expenseIndex, 'personIds', assignmentIndex] })
      assigned.add(personId)
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

  draft.expenses.forEach((expense, index) => {
    if (!expense.name) context.addIssue({ code: 'custom', message: 'Expense name is required', path: ['expenses', index, 'name'] })
    if (expense.amount === null) context.addIssue({ code: 'custom', message: 'Expense amount must be a positive number', path: ['expenses', index, 'amount'] })
    if (expense.scope === 'leg' && !expense.legId) context.addIssue({ code: 'custom', message: 'Choose a journey leg for this expense', path: ['expenses', index, 'legId'] })
    if (expense.scope === 'people' && expense.personIds.length === 0) context.addIssue({ code: 'custom', message: 'Select at least one person for this expense', path: ['expenses', index, 'personIds'] })
  })

  draft.allocationRules.forEach((rule, index) => {
    const riders = draft.people.filter((person) => person.assignedLegIds.includes(rule.legId))
    const riderIds = new Set(riders.map(({ id }) => id))
    if (rule.shares.some(({ personId }) => !riderIds.has(personId))) context.addIssue({ code: 'custom', message: 'Shares can only be set for riders assigned to this leg', path: ['allocationRules', index, 'shares'] })
    if (rule.mode === 'weights' && rule.shares.reduce((sum, share) => sum + share.value, 0) <= 0) context.addIssue({ code: 'custom', message: 'Weights must include at least one positive share', path: ['allocationRules', index, 'shares'] })
    if (rule.mode === 'percentages' && Math.abs(rule.shares.reduce((sum, share) => sum + share.value, 0) - 100) > 0.000001) context.addIssue({ code: 'custom', message: 'Percentages must add up to exactly 100%', path: ['allocationRules', index, 'shares'] })
    if (rule.mode === 'fixed') {
      const leg = draft.legs.find(({ id }) => id === rule.legId)
      const cost = leg?.distanceKm && draft.fuelSettings.fuelEconomyKmpl && draft.fuelSettings.fuelPricePerLitre ? leg.distanceKm / draft.fuelSettings.fuelEconomyKmpl * draft.fuelSettings.fuelPricePerLitre : null
      const fixedTotal = rule.shares.reduce((sum, share) => sum + share.value, 0)
      if (cost !== null && (fixedTotal > cost + 0.000001 || (rule.shares.length === riders.length && Math.abs(fixedTotal - cost) > 0.000001))) context.addIssue({ code: 'custom', message: rule.shares.length === riders.length ? 'Fixed contributions must add up to the leg cost' : 'Fixed contributions cannot exceed the leg cost', path: ['allocationRules', index, 'shares'] })
    }
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
  if (Array.isArray(draft.expenses)) {
    draft.expenses = draft.expenses.map((expense) => typeof expense === 'object' && expense !== null
      ? { ...expense, amount: toNumber((expense as Record<string, unknown>).amount) }
      : expense)
  }
  if (Array.isArray(draft.allocationRules)) {
    draft.allocationRules = draft.allocationRules.map((rule) => typeof rule === 'object' && rule !== null
      ? { ...rule, shares: Array.isArray((rule as Record<string, unknown>).shares) ? ((rule as Record<string, unknown>).shares as Array<Record<string, unknown>>).map((share) => ({ ...share, value: toNumber(share.value) })) : [] }
      : rule)
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
