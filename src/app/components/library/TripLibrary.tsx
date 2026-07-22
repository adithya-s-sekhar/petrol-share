import type { ChangeEvent } from 'react'
import { Copy, Download, Plus, Upload } from 'lucide-react'
import { calculateTrip, editableTripDraftSchema, economyFromKmpl, formatCurrency, unitLabels } from '../../../domain'
import type { StoredTrip } from '../../../persistence/tripStorage'
import type { VehiclePreset } from '../../../persistence/vehiclePresetStorage'
import { displayNumber, routeSummary } from '../../utils/tripDraftUtils'
import { classes } from '../../styles'

type Props = {
  activeTripId: string; importError: string; message: string; trips: StoredTrip[]; vehiclePresets: VehiclePreset[]
  onClose: () => void; onCopyLink: () => void; onDownload: () => void; onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onNewTrip: () => void; onNewVehicle: () => void
  onUseVehicle: (preset: VehiclePreset) => void; onEditVehicle: (preset: VehiclePreset) => void; onDeleteVehicle: (preset: VehiclePreset) => void
  onOpenTrip: (trip: StoredTrip) => void; onDuplicateTrip: (trip: StoredTrip) => void; onSaveTemplate: (trip: StoredTrip) => void
  onRenameTrip: (trip: StoredTrip) => void; onDeleteTrip: (trip: StoredTrip) => void; onRestoreTrip: (trip: StoredTrip) => void
}

export function TripLibrary(props: Props) {
  const activeTrips = props.trips.filter(({ deletedAt }) => !deletedAt)
  const deletedTrips = props.trips.filter(({ deletedAt }) => deletedAt)
  return <section className={classes('library')} aria-labelledby="trip-library-title">
    <div className={classes('library-heading')}><div><h2 id="trip-library-title">Saved trips</h2><p>Keep journeys separate or reuse a familiar route.</p></div><button className={classes('trips-button')} type="button" onClick={props.onClose}>Close</button></div>
    <div className={classes('library-actions')}><button type="button" onClick={props.onNewTrip}><Plus size={17} /> New trip</button><button type="button" onClick={props.onCopyLink}><Copy size={17} /> Copy editable link</button><button type="button" onClick={props.onDownload}><Download size={17} /> Download trip file</button><label className={classes('trips-button')}><Upload size={17} /> Import trip file<input className={classes('sr-only')} type="file" accept="application/json,.json" onChange={props.onImport} /></label></div>
    {props.importError && <p className={classes('import-error')} role="alert">{props.importError}</p>}
    {props.message && <p role="status">{props.message}</p>}
    <div className={classes('subsection')}><h3>Vehicle presets</h3><div className={classes('library-actions')}><button type="button" onClick={props.onNewVehicle}><Plus size={17} /> Save vehicle preset</button></div>
      {props.vehiclePresets.length === 0 ? <p>No vehicle presets saved yet.</p> : <div className={classes('preset-list')}>{props.vehiclePresets.map((preset) => <article className={classes('preset-row')} key={preset.id} aria-label={preset.name}><div><strong>{preset.name}</strong><p>{displayNumber(preset.fuelEconomyKmpl, (value) => economyFromKmpl(value, preset.preferredUnits))} {unitLabels(preset.preferredUnits).economy}{preset.fuelType ? ` · ${preset.fuelType}` : ''} · {preset.preferredUnits === 'metric' ? 'Metric' : preset.preferredUnits === 'us' ? 'US customary' : 'UK imperial'}</p></div><div className={classes('preset-actions')}><button type="button" onClick={() => props.onUseVehicle(preset)}>Use</button><button type="button" onClick={() => props.onEditVehicle(preset)}>Edit</button><button type="button" onClick={() => props.onDeleteVehicle(preset)}>Delete</button></div></article>)}</div>}
    </div>
    <div className={classes('trip-list')}>{activeTrips.map((trip) => {
      const complete = editableTripDraftSchema.safeParse(trip.draft)
      const total = complete.success ? calculateTrip(complete.data).totalCost : null
      return <article className={classes(`trip-card${trip.id === props.activeTripId ? ' trip-card-active' : ''}`)} key={trip.id} aria-label={trip.name}><div>{trip.kind === 'template' && <span className={classes('template-label')}>Template</span>}<h3>{trip.name}{trip.id === props.activeTripId ? ' · Current' : ''}</h3><p>{routeSummary(trip.draft)}</p><p>Updated {new Date(trip.updatedAt).toLocaleDateString()} · {total === null ? 'Incomplete' : formatCurrency(total, trip.draft.fuelSettings.currency)}</p></div><div className={classes('trip-card-actions')}><button type="button" onClick={() => props.onOpenTrip(trip)}>{trip.kind === 'template' ? 'Use template' : 'Open'}</button>{trip.kind === 'trip' && <><button type="button" onClick={() => props.onDuplicateTrip(trip)}><Copy size={15} /> Duplicate</button><button type="button" onClick={() => props.onSaveTemplate(trip)}>Save template</button></>}<button type="button" onClick={() => props.onRenameTrip(trip)}>Rename</button><button type="button" onClick={() => props.onDeleteTrip(trip)}>Delete</button></div></article>
    })}</div>
    {deletedTrips.length > 0 && <details><summary>Recently deleted</summary><div className={classes('trip-list')}>{deletedTrips.map((trip) => <article className={classes('trip-card')} key={trip.id} aria-label={trip.name}><div><h3>{trip.name}</h3><p>{routeSummary(trip.draft)}</p></div><div className={classes('trip-card-actions')}><button type="button" onClick={() => props.onRestoreTrip(trip)}>Restore</button></div></article>)}</div></details>}
  </section>
}
