import { useMemo } from 'react'
import { normalizeTripRoute, type Person, type TripDraft } from '../domain'

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
    })
  }

  return { stopsById, update, changeStops, addStop, returnToStop, reuseLegDistanceForBlankReverse, moveStop, addPerson, setLegAssignment, setAllLegAssignments }
}
