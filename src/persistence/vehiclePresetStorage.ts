import type { UnitSystem } from '../domain'

const STORAGE_KEY = 'petrol-share.vehicle-presets.v1'

export interface VehiclePreset {
  id: string
  name: string
  fuelEconomyKmpl: number
  preferredUnits: UnitSystem
  fuelType?: string
}

function isPreset(value: unknown): value is VehiclePreset {
  if (typeof value !== 'object' || value === null) return false
  const preset = value as Partial<VehiclePreset>
  return typeof preset.id === 'string' && typeof preset.name === 'string'
    && typeof preset.fuelEconomyKmpl === 'number' && Number.isFinite(preset.fuelEconomyKmpl) && preset.fuelEconomyKmpl > 0
    && ['metric', 'us', 'imperial'].includes(preset.preferredUnits ?? '')
    && (preset.fuelType === undefined || typeof preset.fuelType === 'string')
}

export function loadVehiclePresets(storage: Pick<Storage, 'getItem'> = localStorage): VehiclePreset[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPreset) : []
  } catch {
    return []
  }
}

export function saveVehiclePresets(presets: readonly VehiclePreset[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export const vehiclePresetStorageKey = STORAGE_KEY
