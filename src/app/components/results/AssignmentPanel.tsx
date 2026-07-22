import { ArrowDown, ArrowRight, Copy, Users } from 'lucide-react'
import { formatCurrency, type AllocationMode, type LegAllocationRule, type TripDraft } from '../../../domain'
import { layout } from '../../designSystem'
import { Button, IconButton } from '../ui/AppControls'

type Props = {
  draft: TripDraft
  mobile: boolean
  stopsById: Map<string, string>
  onSetAssignment: (personId: string, legId: string, assigned: boolean) => void
  onSetAllAssignments: (legId: string, assigned: boolean) => void
  onCopyPreviousAssignments: (legId: string) => void
  onSetAllocationRule: (rule: LegAllocationRule) => void
}

const modeLabels: Record<AllocationMode, string> = { equal: 'Equal split', weights: 'Custom weights', percentages: 'Percentages', fixed: 'Fixed contributions' }

function AllocationEditor({ draft, legId, onChange }: { draft: TripDraft; legId: string; onChange: (rule: LegAllocationRule) => void }) {
  const riders = draft.people.filter((person) => person.assignedLegIds.includes(legId))
  const rule = (draft.allocationRules ?? []).find((candidate) => candidate.legId === legId) ?? { legId, mode: 'equal' as const, shares: [] }
  const valueFor = (personId: string) => rule.shares.find((share) => share.personId === personId)?.value
  const setMode = (mode: AllocationMode, preset?: 'driver' | 'half') => {
    const shares = mode === 'fixed' ? riders.slice(0, 1).map((person) => ({ personId: person.id, value: 0 })) : mode === 'equal' ? [] : riders.map((person, index) => ({
      personId: person.id,
      value: preset === 'driver' ? (index === 0 ? 0 : 1) : preset === 'half' ? (index === riders.length - 1 ? 0.5 : 1) : mode === 'percentages' ? Number((100 / Math.max(1, riders.length)).toFixed(6)) : 1,
    }))
    if (mode === 'percentages' && shares.length) shares[shares.length - 1].value += 100 - shares.reduce((sum, share) => sum + share.value, 0)
    onChange({ legId, mode, shares })
  }
  const total = rule.shares.reduce((sum, share) => sum + share.value, 0)
  const leg = draft.legs.find(({ id }) => id === legId)
  const legCost = leg?.distanceKm && draft.fuelSettings.fuelEconomyKmpl && draft.fuelSettings.fuelPricePerLitre ? leg.distanceKm / draft.fuelSettings.fuelEconomyKmpl * draft.fuelSettings.fuelPricePerLitre : null
  const invalid = rule.mode === 'percentages' ? Math.abs(total - 100) >= 0.000001 : rule.mode === 'weights' ? total <= 0 : rule.mode === 'fixed' && legCost !== null ? total > legCost + 0.000001 || (rule.shares.length === riders.length && Math.abs(total - legCost) >= 0.000001) : false
  const status = rule.mode === 'percentages' ? `${total.toLocaleString()}% allocated${invalid ? ' — must equal 100%' : ''}` : rule.mode === 'weights' ? `${total.toLocaleString()} total weight${invalid ? ' — at least one weight must be positive' : ''}` : rule.mode === 'fixed' ? `${formatCurrency(total, draft.fuelSettings.currency)} fixed${legCost === null ? '' : ` of ${formatCurrency(legCost, draft.fuelSettings.currency)}`}${invalid ? ' — cannot leave the leg under- or over-allocated' : '; the remainder is split equally'}` : 'Every assigned rider pays an equal share'
  return <details className={layout('allocation-editor')}>
    <summary>Split rule: {modeLabels[rule.mode]}</summary>
    <div className={layout('allocation-presets')}>
      <Button variant="quiet" onClick={() => setMode('equal')}>Equal</Button>
      <Button variant="quiet" disabled={riders.length < 2} onClick={() => setMode('weights', 'driver')}>Driver excluded</Button>
      <Button variant="quiet" disabled={riders.length < 2} onClick={() => setMode('fixed')}>Driver fixed</Button>
      <Button variant="quiet" disabled={riders.length < 2} onClick={() => setMode('weights', 'half')}>Child / half</Button>
      <Button variant="quiet" disabled={riders.length < 1} onClick={() => setMode('weights')}>Custom</Button>
      <Button variant="quiet" disabled={riders.length < 1} onClick={() => setMode('percentages')}>Percent</Button>
    </div>
    {rule.mode !== 'equal' && <div className={layout('allocation-inputs')}>{riders.map((person) => <label key={person.id}><span>{person.name || 'Unnamed'}</span><input type="number" min="0" step="any" aria-label={`${person.name || 'Unnamed rider'} ${rule.mode === 'percentages' ? 'percentage' : rule.mode === 'fixed' ? 'fixed contribution' : 'weight'} for this leg`} value={valueFor(person.id) ?? ''} onChange={(event) => onChange({ ...rule, shares: [...rule.shares.filter((share) => share.personId !== person.id), { personId: person.id, value: Math.max(0, Number(event.target.value) || 0) }] })} /></label>)}</div>}
    <p className={invalid ? 'text-[#a13c31]' : ''} role="status">{status}</p>
  </details>
}

export function AssignmentPanel({ draft, mobile, stopsById, onSetAssignment, onSetAllAssignments, onCopyPreviousAssignments, onSetAllocationRule }: Props) {
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
                    <AllocationEditor draft={draft} legId={leg.id} onChange={onSetAllocationRule} />
                  </section>
                )
              })}
            </div>
          )}
          {!mobile && <div className={layout('desktop-allocation-list')}>{draft.legs.map((leg) => <section key={leg.id}><strong>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</strong><AllocationEditor draft={draft} legId={leg.id} onChange={onSetAllocationRule} /></section>)}</div>}
        </>
      )}
    </section>
  )
}
