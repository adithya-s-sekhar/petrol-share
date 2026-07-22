import { describe, expect, it } from 'vitest'
import { loadVehiclePresets, saveVehiclePresets, type VehiclePreset } from './vehiclePresetStorage'

describe('vehicle preset persistence', () => {
  it('round-trips valid presets and ignores invalid records', () => {
    let value = ''
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next } }
    const preset: VehiclePreset = { id: 'car-1', name: 'City car', fuelEconomyKmpl: 18, preferredUnits: 'metric', fuelType: 'Petrol' }
    saveVehiclePresets([preset], storage)
    expect(loadVehiclePresets(storage)).toEqual([preset])
    value = JSON.stringify([preset, { broken: true }])
    expect(loadVehiclePresets(storage)).toEqual([preset])
  })
})
