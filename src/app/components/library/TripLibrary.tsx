import type { ChangeEvent } from 'react'
import { Copy, Download, Plus, Upload, X } from 'lucide-react'
import { calculateTrip, editableTripDraftSchema, economyFromKmpl, formatCurrency, unitLabels } from '../../../domain'
import type { StoredTrip } from '../../../persistence/tripStorage'
import type { VehiclePreset } from '../../../persistence/vehiclePresetStorage'
import { displayNumber, routeSummary } from '../../utils/tripDraftUtils'
import { layout } from '../../designSystem'
import { Button, ButtonLabel, Card, IconButton } from '../ui/AppControls'

type Props = {
  activeTripId: string
  importError: string
  message: string
  trips: StoredTrip[]
  vehiclePresets: VehiclePreset[]
  onClose: () => void
  onCopyLink: () => void
  onDownload: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onNewTrip: () => void
  onNewVehicle: () => void
  onUseVehicle: (preset: VehiclePreset) => void
  onEditVehicle: (preset: VehiclePreset) => void
  onDeleteVehicle: (preset: VehiclePreset) => void
  onOpenTrip: (trip: StoredTrip) => void
  onDuplicateTrip: (trip: StoredTrip) => void
  onSaveTemplate: (trip: StoredTrip) => void
  onRenameTrip: (trip: StoredTrip) => void
  onDeleteTrip: (trip: StoredTrip) => void
  onRestoreTrip: (trip: StoredTrip) => void
}

export function TripLibrary(props: Props) {
  const activeTrips = props.trips.filter(({ deletedAt, kind }) => !deletedAt && kind === 'trip')
  const templates = props.trips.filter(({ deletedAt, kind }) => !deletedAt && kind === 'template')
  const deletedTrips = props.trips.filter(({ deletedAt }) => deletedAt)
  const tripCards = (items: StoredTrip[]) => (
    <div className={layout('trip-list')}>
      {items.map((trip) => {
        const complete = editableTripDraftSchema.safeParse(trip.draft)
        const total = complete.success ? calculateTrip(complete.data).totalCost : null
        return (
          <Card className={layout(`trip-card${trip.id === props.activeTripId ? ' trip-card-active' : ''}`)} key={trip.id} aria-label={trip.name}>
            <div>
              {trip.kind === 'template' && <span className={layout('template-label')}>Template</span>}
              <h3>
                {trip.name}
                {trip.id === props.activeTripId ? ' · Current' : ''}
              </h3>
              <p>{routeSummary(trip.draft)}</p>
              <p>
                Updated {new Date(trip.updatedAt).toLocaleDateString()} · {total === null ? 'Incomplete' : formatCurrency(total, trip.draft.fuelSettings.currency)}
              </p>
            </div>
            <div className={layout('trip-card-actions')}>
              <Button variant="primary" onClick={() => props.onOpenTrip(trip)}>
                {trip.kind === 'template' ? 'Use template' : 'Open'}
              </Button>
              {trip.kind === 'trip' && (
                <>
                  <Button variant="quiet" onClick={() => props.onDuplicateTrip(trip)}>
                    <Copy size={15} /> Duplicate
                  </Button>
                  <Button variant="quiet" onClick={() => props.onSaveTemplate(trip)}>
                    Save template
                  </Button>
                </>
              )}
              <Button variant="quiet" onClick={() => props.onRenameTrip(trip)}>
                Rename
              </Button>
              <Button variant="danger" onClick={() => props.onDeleteTrip(trip)}>
                Delete
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
  return (
    <section className={layout('library')} aria-labelledby="trip-library-title">
      <div className={layout('library-heading')}>
        <div>
          <h2 id="trip-library-title">Saved trips</h2>
          <p>Keep journeys separate or reuse a familiar route.</p>
        </div>
        <IconButton className={layout('library-close')} label="Close saved trips" onClick={props.onClose}>
          <X />
        </IconButton>
      </div>
      <div className={layout('library-actions')}>
        <Button onClick={props.onNewTrip}>
          <Plus size={17} /> New trip
        </Button>
        <Button onClick={props.onCopyLink}>
          <Copy size={17} /> Copy editable link
        </Button>
        <Button onClick={props.onDownload}>
          <Download size={17} /> Download trip file
        </Button>
        <ButtonLabel variant="quiet">
          <Upload size={17} /> Import trip file
          <input className={layout('sr-only')} type="file" accept="application/json,.json" onChange={props.onImport} />
        </ButtonLabel>
      </div>
      {props.importError && (
        <p className={layout('import-error')} role="alert">
          {props.importError}
        </p>
      )}
      {props.message && <p role="status">{props.message}</p>}
      <div className={layout('library-group')}>
        <h3>Trips</h3>
        {activeTrips.length ? tripCards(activeTrips) : <p>No trips saved yet.</p>}
      </div>
      <div className={layout('library-group')}>
        <h3>Templates</h3>
        {templates.length ? tripCards(templates) : <p>No templates saved yet.</p>}
      </div>
      <div className={layout('library-group')}>
        <h3>Vehicle presets</h3>
        <div className={layout('library-actions')}>
          <Button className="col-span-full justify-self-start max-[360px]:w-full" onClick={props.onNewVehicle}>
            <Plus size={17} /> Save vehicle preset
          </Button>
        </div>
        {props.vehiclePresets.length === 0 ? (
          <p>No vehicle presets saved yet.</p>
        ) : (
          <div className={layout('preset-list')}>
            {props.vehiclePresets.map((preset) => (
              <Card className={layout('preset-row')} key={preset.id} aria-label={preset.name}>
                <div>
                  <strong>{preset.name}</strong>
                  <p>
                    {displayNumber(preset.fuelEconomyKmpl, (value) => economyFromKmpl(value, preset.preferredUnits))} {unitLabels(preset.preferredUnits).economy}
                    {preset.fuelType ? ` · ${preset.fuelType}` : ''} · {preset.preferredUnits === 'metric' ? 'Metric' : preset.preferredUnits === 'us' ? 'US customary' : 'UK imperial'}
                  </p>
                </div>
                <div className={layout('preset-actions')}>
                  <Button variant="secondary" onClick={() => props.onUseVehicle(preset)}>
                    Use
                  </Button>
                  <Button variant="quiet" onClick={() => props.onEditVehicle(preset)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => props.onDeleteVehicle(preset)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {deletedTrips.length > 0 && (
        <details className={layout('library-group')}>
          <summary>Recently deleted</summary>
          <div className={layout('trip-list')}>
            {deletedTrips.map((trip) => (
              <Card className={layout('trip-card')} key={trip.id} aria-label={trip.name}>
                <div>
                  <h3>{trip.name}</h3>
                  <p>{routeSummary(trip.draft)}</p>
                </div>
                <div className={layout('trip-card-actions')}>
                  <Button variant="primary" onClick={() => props.onRestoreTrip(trip)}>
                    Restore
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
