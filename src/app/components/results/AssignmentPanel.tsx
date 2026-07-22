import { ArrowDown, ArrowRight, Copy, Users } from 'lucide-react'
import type { TripDraft } from '../../../domain'
import { classes } from '../../styles'

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
    <section id="assignments" className={classes('panel assignment-panel')} aria-labelledby="assignment-title">
      <div className={classes('panel-heading compact')}>
        <span className={classes('step')}>5</span>
        <div>
          <h2 id="assignment-title">Assign each leg</h2>
          <p>Check who travelled on each part.</p>
        </div>
      </div>
      {draft.people.length === 0 ? (
        <div className={classes('empty-state')}>
          <Users />
          <p>Add people to start assigning riders.</p>
        </div>
      ) : (
        <>
          {!mobile && (
            <div className={classes('assignment-scroll')}>
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
                          {index > 0 && <button className={classes('copy-assignments-button')} type="button" aria-label={`Copy rider assignments from previous leg to ${from} to ${to}`} onClick={() => onCopyPreviousAssignments(leg.id)}><Copy /><span className={classes('sr-only')}>Copy previous riders</span></button>}
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
                              <span className={classes('sr-only')}>{label}</span>
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
            <div className={classes('assignment-cards')}>
              {draft.legs.map((leg, index) => {
                const from = stopsById.get(leg.fromStopId)
                const to = stopsById.get(leg.toStopId)
                const allAssigned = draft.people.every((person) => person.assignedLegIds.includes(leg.id))
                return (
                  <section className={classes('assignment-card')} aria-label={`Riders from ${from} to ${to}`} key={leg.id}>
                    <div className={classes('assignment-card-heading')}>
                      <div className={classes('assignment-route')}>
                        <span>{from}</span>
                        <ArrowDown aria-hidden="true" />
                        <span>{to}</span>
                      </div>
                      <button className={classes('select-all-button')} type="button" onClick={() => onSetAllAssignments(leg.id, !allAssigned)}>
                        {allAssigned ? 'Clear all' : 'Select all'}
                      </button>
                    </div>
                    {index > 0 && <button className={classes('copy-button')} type="button" onClick={() => onCopyPreviousAssignments(leg.id)}><Copy /> Copy riders from previous leg</button>}
                    <div className={classes('assignment-chip-list')}>
                      {draft.people.map((person) => {
                        const label = `${person.name || 'Unnamed person'} rode from ${from} to ${to}`
                        return (
                          <label className={classes('assignment-chip')} key={person.id}>
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
