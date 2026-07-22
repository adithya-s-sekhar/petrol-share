import type { TripDraft, UnitSystem } from '../domain'
import type { StoredTrip } from '../persistence/tripStorage'
import type { VehiclePreset } from '../persistence/vehiclePresetStorage'
import type { EditableTripImport } from '../tripSharing'

export type ShareStatus = 'idle' | 'sharing' | 'shared' | 'downloaded' | 'error'
export type UndoRemoval = { draft: TripDraft; message: string }
export type TripDialog = { action: 'create' | 'rename' | 'delete'; trip?: StoredTrip } | null
export type ImportPreview = EditableTripImport & { source: 'link' | 'file' }
export type VehicleDialog = { action: 'create' | 'edit' | 'delete'; preset?: VehiclePreset } | null

export interface VehicleFormState {
  name: string
  economy: string
  fuelType: string
  units: UnitSystem
}
