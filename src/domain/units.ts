export type UnitSystem = 'metric' | 'us' | 'imperial'

const KM_PER_MILE = 1.609344
const LITRES_PER_US_GALLON = 3.785411784
const LITRES_PER_IMPERIAL_GALLON = 4.54609

export function defaultUnitSystem(locale = globalThis.navigator?.language ?? 'en-IN'): UnitSystem {
  const region = new Intl.Locale(locale).region
  if (region === 'US') return 'us'
  if (region === 'GB') return 'imperial'
  return 'metric'
}

export function distanceFromKm(value: number, system: UnitSystem): number {
  return system === 'metric' ? value : value / KM_PER_MILE
}

export function distanceToKm(value: number, system: UnitSystem): number {
  return system === 'metric' ? value : value * KM_PER_MILE
}

export function economyFromKmpl(value: number, system: UnitSystem): number {
  if (system === 'metric') return value
  return value * (system === 'us' ? LITRES_PER_US_GALLON : LITRES_PER_IMPERIAL_GALLON) / KM_PER_MILE
}

export function economyToKmpl(value: number, system: UnitSystem): number {
  if (system === 'metric') return value
  return value * KM_PER_MILE / (system === 'us' ? LITRES_PER_US_GALLON : LITRES_PER_IMPERIAL_GALLON)
}

export function priceFromPerLitre(value: number, system: UnitSystem): number {
  if (system === 'metric') return value
  return value * (system === 'us' ? LITRES_PER_US_GALLON : LITRES_PER_IMPERIAL_GALLON)
}

export function priceToPerLitre(value: number, system: UnitSystem): number {
  if (system === 'metric') return value
  return value / (system === 'us' ? LITRES_PER_US_GALLON : LITRES_PER_IMPERIAL_GALLON)
}

export function volumeFromLitres(value: number, system: UnitSystem): number {
  if (system === 'metric') return value
  return value / (system === 'us' ? LITRES_PER_US_GALLON : LITRES_PER_IMPERIAL_GALLON)
}

export const unitLabels = (system: UnitSystem) => ({
  distance: system === 'metric' ? 'km' : 'mi',
  distanceLong: system === 'metric' ? 'kilometres' : 'miles',
  economy: system === 'metric' ? 'km/L' : 'MPG',
  volume: system === 'metric' ? 'L' : system === 'us' ? 'US gal' : 'imp gal',
  priceVolume: system === 'metric' ? 'litre' : system === 'us' ? 'US gallon' : 'imperial gallon',
})
