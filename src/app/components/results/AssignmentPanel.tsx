import { ArrowDown, ArrowRight, Copy, Users } from 'lucide-react'
import type { TripDraft } from '../../../domain'
import { layout } from '../../designSystem'
import { Button, IconButton } from '../ui/AppControls'

type Props = {
  draft: TripDraft
  mobile: boolean
  stopsById: Map<string, string>
  onSetAssignment: (personId: string, legId: string, assigned: boolean) => void
  onSetAllAssignments: (legId: string, assigned: boolean) => void
  onCopyPreviousAssignments: (legId: string) => void
}

export function AssignmentPanel({ draft, mobile, stopsById, onSetAssignment, onSetAllAssignments, onCopyPreviousAssignments }: Props) {
  return (
    <section id="assignments" className={layout('panel assignment-panel')} aria-labelledby="assignment-title">
      <div className={layout('panel-heading compact')}>
        <span className={layout('step')}>5</span>
        <div>
          <h2 id="assignment-title">Assign each leg</h2>
          <p>Check who travelled on each part.</p>
        </div>
      </div>
      {draft.people.length === 0 ? (
        <div className={layout('empty-state')}>
          <Users />
          <p>Add people to start assigning riders.</p>
        </div>
      ) : (
        <>
          {!mobile && (
            <div className={layout('assignment-scroll')}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Passenger</th>
                    {draft.legs.map((leg, index) => {
                      const from = stopsById.get(leg.fromStopId)
                      const to = stopsById.get(leg.toStopId)
                      return (
                        <th scope="col" key={leg.id} title={`${from} to ${to}`}>
                          <span>{from}</span>
                          <ArrowRight size={16} />
                          <span>{to}</span>
                          {index > 0 && <IconButton className="mx-auto mt-1" label={`Copy rider assignments from previous leg to ${from} to ${to}`} onClick={() => onCopyPreviousAssignments(leg.id)}><Copy /></IconButton>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {draft.people.map((person) => (
                    <tr key={person.id}>
                      <th scope="row" title={person.name || 'Unnamed'}>
                        {person.name || 'Unnamed'}
                      </th>
                      {draft.legs.map((leg) => {
                        const label = `${person.name || 'Unnamed person'} rode from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)}`
                        return (
                          <td key={leg.id}>
                            <label className="assignment-target">
                              <input type="checkbox" aria-label={label} checked={person.assignedLegIds.includes(leg.id)} onChange={(event) => onSetAssignment(person.id, leg.id, event.target.checked)} />
                              <span className={layout('sr-only')}>{label}</span>
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {mobile && (
            <div className={layout('assignment-cards')}>
              {draft.legs.map((leg, index) => {
                const from = stopsById.get(leg.fromStopId)
                const to = stopsById.get(leg.toStopId)
                const allAssigned = draft.people.every((person) => person.assignedLegIds.includes(leg.id))
                return (
                  <section className={layout('assignment-card')} aria-label={`Riders from ${from} to ${to}`} key={leg.id}>
                    <div className={layout('assignment-card-heading')}>
                      <div className={layout('assignment-route')}>
                        <span>{from}</span>
                        <ArrowDown aria-hidden="true" />
                        <span>{to}</span>
                      </div>
                      <Button variant="quiet" onClick={() => onSetAllAssignments(leg.id, !allAssigned)}>
                        {allAssigned ? 'Clear all' : 'Select all'}
                      </Button>
                    </div>
                    {index > 0 && <Button variant="quiet" className="mb-3 w-full" onClick={() => onCopyPreviousAssignments(leg.id)}><Copy /> Copy riders from previous leg</Button>}
                    <div className={layout('assignment-chip-list')}>
                      {draft.people.map((person) => {
                        const label = `${person.name || 'Unnamed person'} rode from ${from} to ${to}`
                        return (
                          <label className={layout('assignment-chip')} key={person.id}>
                            <input type="checkbox" aria-label={label} checked={person.assignedLegIds.includes(leg.id)} onChange={(event) => onSetAssignment(person.id, leg.id, event.target.checked)} />
                            <span>{person.name || 'Unnamed'}</span>
                          </label>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
