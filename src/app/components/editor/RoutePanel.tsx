import { ArrowDown, ArrowRight, ArrowUp, Copy, MapPin, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { distanceFromKm, distanceToKm, type Stop, type TripDraft, type UnitSystem } from '../../../domain'
import { FieldError, IconButton } from '../ui/AppControls'
import { UNIT_SYSTEM_OPTIONS } from '../../constants'
import { displayNumber, numberFromInput, type ErrorMap } from '../../utils/tripDraftUtils'
import { classes } from '../../styles'
import { CollapsibleSection, SectionHeading } from './CollapsibleSection'
import { RouteOverview } from './RouteOverview'

interface RoutePanelProps {
  draft: TripDraft
  errors: ErrorMap
  stopsById: Map<string, string>
  returnStops: Stop[]
  unitSystem: UnitSystem
  units: ReturnType<typeof import('../../../domain').unitLabels>
  open: boolean
  complete: boolean
  buttonRef: (node: HTMLButtonElement | null) => void
  onOpen: () => void
  onDone: () => void
  onAddStop: () => void
  onChangeStops: (stops: Stop[]) => void
  onMakeRoundTrip: () => void
  onMoveStop: (index: number, direction: -1 | 1) => void
  onRemoveStop: (stopId: string, index: number) => void
  onReturnToStop: (stop: Stop) => void
  onShowMapDialog: (legId: string) => void
  onUnitSystemChange: (unitSystem: UnitSystem) => void
  onUpdate: (draft: TripDraft) => void
  onReuseReverseDistance: (legId: string) => void
  onCopyPreviousLeg: (legId: string) => void
}

export function RoutePanel(props: RoutePanelProps) {
  const { draft, errors, stopsById, returnStops, unitSystem, units, open, complete, buttonRef } = props
  const totalDistance = draft.legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0)
  const summary = `${draft.stops.length} stops · ${distanceFromKm(totalDistance, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units.distance}`
  return <CollapsibleSection controls="route" open={open} step={1} title="Build your route" summary={summary} buttonRef={buttonRef} onOpen={props.onOpen}>
    <>
      <SectionHeading controls="route" step={1} title="Build your route">Each stop is a distinct visit, even when its name repeats.</SectionHeading>
      <div id="route-content">
        <ol className={classes('stops-list')}>
          {draft.stops.map((stop, index) => {
            const errorId = `stop-${stop.id}-error`
            const error = errors[`stops.${index}.name`]
            return <li className={classes('stop-row')} key={stop.id}>
              <span className={classes('stop-index')} aria-hidden="true">{index + 1}</span>
              <div className={classes('field-grow')}><label className={classes('row-label')} htmlFor={`stop-${stop.id}`}>Stop {index + 1}</label><div className={classes('input-with-icon')}><MapPin size={18} /><input id={`stop-${stop.id}`} aria-label={`Stop ${index + 1} name`} value={stop.name} placeholder={index === 0 ? 'Starting point' : 'Next stop'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => props.onChangeStops(draft.stops.map((item) => item.id === stop.id ? { ...item, name: event.target.value } : item))} /></div><FieldError id={errorId} message={error} /></div>
              <div className={classes('row-actions')}><IconButton label={`Move stop ${index + 1} up`} disabled={index === 0} onClick={() => props.onMoveStop(index, -1)}><ArrowUp /></IconButton><IconButton label={`Move stop ${index + 1} down`} disabled={index === draft.stops.length - 1} onClick={() => props.onMoveStop(index, 1)}><ArrowDown /></IconButton><IconButton label={`Remove stop ${index + 1}`} destructive disabled={draft.stops.length <= 2} onClick={() => props.onRemoveStop(stop.id, index)}><Trash2 /></IconButton></div>
            </li>
          })}
        </ol>
        <button className={classes('secondary-button full-button')} type="button" onClick={props.onAddStop}><Plus size={18} /> Add another stop</button>
        {draft.stops.length > 1 && draft.stops.every(({ name }) => name.trim()) && draft.stops[0].name.trim().toLocaleLowerCase() !== draft.stops.at(-1)?.name.trim().toLocaleLowerCase() && <button className={classes('secondary-button full-button')} type="button" onClick={props.onMakeRoundTrip}><RotateCcw size={18} /> Make round trip</button>}
        {returnStops.length > 0 && <div className={classes('return-stops')} aria-label="Return to an earlier stop"><span>Going back?</span><div>{returnStops.map((stop) => <button key={stop.id} className={classes('return-stop-button')} type="button" onClick={() => props.onReturnToStop(stop)}><RotateCcw size={15} /> Return to {stop.name.trim()}</button>)}</div><p>The known distance is reused when available, and can still be changed.</p></div>}
        <RouteOverview draft={draft} unitSystem={unitSystem} distanceUnit={units.distance} />
        <div className={classes('subsection')}>
          <h3>Leg distances</h3>
          <div className={classes('unit-picker')} aria-label="Display units">{UNIT_SYSTEM_OPTIONS.map(([value, label]) => <button key={value} type="button" aria-pressed={unitSystem === value} onClick={() => props.onUnitSystemChange(value)}>{label}</button>)}</div>
          <div className={classes('leg-list')}>
            {draft.legs.map((leg, index) => {
              const error = errors[`legs.${index}.distanceKm`]
              const errorId = `leg-${leg.id}-error`
              return <div className={classes('leg-row')} key={leg.id}>
                <div className={classes('leg-name')}><span title={stopsById.get(leg.fromStopId)}>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={16} /><span title={stopsById.get(leg.toStopId)}>{stopsById.get(leg.toStopId)}</span></div>
                <div><label className={classes('row-label')} htmlFor={`leg-${leg.id}`}>Distance ({units.distance})</label><div className={classes('unit-input')}><input id={`leg-${leg.id}`} aria-label={`Distance from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)} in ${units.distanceLong}`} type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={displayNumber(leg.distanceKm, (value) => distanceFromKm(value, unitSystem))} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onBlur={() => props.onReuseReverseDistance(leg.id)} onChange={(event) => { const value = numberFromInput(event.target.value); props.onUpdate({ ...draft, legs: draft.legs.map((item) => item.id === leg.id ? { ...item, distanceKm: value === null ? null : distanceToKm(value, unitSystem), distanceSource: 'manual' } : item) }) }} /><span>{units.distance}</span></div>{leg.distanceKm !== null && <span className={classes(`distance-source distance-source-${leg.distanceSource ?? 'manual'}`)} title={leg.distanceSource === 'reused' ? 'Reused from the reverse leg' : undefined}>{leg.distanceSource === 'reused' ? 'Auto-filled' : leg.distanceSource === 'lookup' ? 'Looked up' : leg.distanceSource === 'copied' ? 'Copied' : 'Manual'}</span>}{index > 0 && <button className={classes('copy-button')} type="button" onClick={() => props.onCopyPreviousLeg(leg.id)}><Copy /> Copy previous distance</button>}<button className={classes('lookup-button')} type="button" onClick={() => props.onShowMapDialog(leg.id)}><Search /> Look up road distance</button><FieldError id={errorId} message={error} /></div>
              </div>
            })}
          </div>
        </div>
        {complete && <button className={classes('done-button')} type="button" onClick={props.onDone}>Done with route <ArrowRight size={18} /></button>}
      </div>
    </>
  </CollapsibleSection>
}
