import { useMemo } from 'react'
import { normalizeTripRoute, type Person, type TripDraft } from '../../domain'

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export function useTripEditor(draft: TripDraft, setDraft: React.Dispatch<React.SetStateAction<TripDraft>>) {
  const stopsById = useMemo(() => new Map(draft.stops.map((stop) => [stop.id, stop.name || 'Unnamed stop'])), [draft.stops])

  function update(next: TripDraft) {
    setDraft({ ...next, updatedAt: new Date().toISOString() })
  }

  function changeStops(stops: TripDraft['stops']) {
    update(normalizeTripRoute(draft, stops))
  }

  function addStop() {
    changeStops([...draft.stops, { id: createId(), name: '' }])
  }

  function returnToStop(stop: TripDraft['stops'][number]) {
    changeStops([...draft.stops, { id: createId(), name: stop.name.trim() }])
  }

  function makeRoundTrip() {
    const returnStops = draft.stops.slice(0, -1).reverse().map((stop) => ({
      id: createId(),
      name: stop.name.trim(),
    }))
    changeStops([...draft.stops, ...returnStops])
  }

  function reuseLegDistanceForBlankReverse(legId: string) {
    const changedLeg = draft.legs.find((leg) => leg.id === legId)
    if (!changedLeg) return
    const fromName = stopsById.get(changedLeg.fromStopId)?.trim().toLocaleLowerCase()
    const toName = stopsById.get(changedLeg.toStopId)?.trim().toLocaleLowerCase()
    update({
      ...draft,
      legs: draft.legs.map((leg) => {
        const isBlankReverse = leg.distanceKm === null
          && stopsById.get(leg.fromStopId)?.trim().toLocaleLowerCase() === toName
          && stopsById.get(leg.toStopId)?.trim().toLocaleLowerCase() === fromName
        return isBlankReverse ? { ...leg, distanceKm: changedLeg.distanceKm, distanceSource: 'reused' } : leg
      }),
    })
  }

  function moveStop(index: number, direction: -1 | 1) {
    const stops = [...draft.stops]
    const target = index + direction
    ;[stops[index], stops[target]] = [stops[target], stops[index]]
    changeStops(stops)
  }

  function addPerson() {
    const person: Person = { id: createId(), name: '', assignedLegIds: [] }
    update({ ...draft, people: [...draft.people, person] })
  }

  function setLegAssignment(personId: string, legId: string, assigned: boolean) {
    update({
      ...draft,
      people: draft.people.map((person) => person.id !== personId ? person : {
        ...person,
        assignedLegIds: assigned
          ? [...new Set([...person.assignedLegIds, legId])]
          : person.assignedLegIds.filter((id) => id !== legId),
      }),
      allocationRules: (draft.allocationRules ?? []).map((rule) => rule.legId === legId ? { ...rule, shares: rule.shares.filter((share) => share.personId !== personId) } : rule),
    })
  }

  function setAllLegAssignments(legId: string, assigned: boolean) {
    update({
      ...draft,
      people: draft.people.map((person) => ({
        ...person,
        assignedLegIds: assigned
          ? [...new Set([...person.assignedLegIds, legId])]
          : person.assignedLegIds.filter((id) => id !== legId),
      })),
      allocationRules: assigned ? draft.allocationRules : (draft.allocationRules ?? []).filter((rule) => rule.legId !== legId),
    })
  }

  function copyPreviousLegDistance(legId: string) {
    const index = draft.legs.findIndex((leg) => leg.id === legId)
    if (index < 1) return
    const previous = draft.legs[index - 1]
    update({ ...draft, legs: draft.legs.map((leg) => leg.id === legId ? { ...leg, distanceKm: previous.distanceKm, distanceSource: 'copied' } : leg) })
  }

  function copyPreviousLegAssignments(legId: string) {
    const index = draft.legs.findIndex((leg) => leg.id === legId)
    if (index < 1) return
    const previousLegId = draft.legs[index - 1].id
    const previousRule = (draft.allocationRules ?? []).find((rule) => rule.legId === previousLegId)
    update({
      ...draft,
      people: draft.people.map((person) => ({
        ...person,
        assignedLegIds: person.assignedLegIds.includes(previousLegId)
          ? [...new Set([...person.assignedLegIds, legId])]
          : person.assignedLegIds.filter((id) => id !== legId),
      })),
      allocationRules: previousRule ? [...(draft.allocationRules ?? []).filter((rule) => rule.legId !== legId), { ...previousRule, legId }] : (draft.allocationRules ?? []).filter((rule) => rule.legId !== legId),
    })
  }

  function setAllocationRule(rule: NonNullable<TripDraft['allocationRules']>[number]) {
    update({ ...draft, allocationRules: [...(draft.allocationRules ?? []).filter(({ legId }) => legId !== rule.legId), rule] })
  }

  return { stopsById, update, changeStops, addStop, returnToStop, makeRoundTrip, reuseLegDistanceForBlankReverse, moveStop, addPerson, setLegAssignment, setAllLegAssignments, copyPreviousLegDistance, copyPreviousLegAssignments, setAllocationRule }
}
