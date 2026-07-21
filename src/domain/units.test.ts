import { describe, expect, it } from 'vitest'
import { defaultUnitSystem, distanceFromKm, distanceToKm, economyFromKmpl, economyToKmpl, priceFromPerLitre, priceToPerLitre, volumeFromLitres } from './units'

describe('display unit conversions', () => {
  it('chooses a locale-aware system', () => {
    expect(defaultUnitSystem('en-US')).toBe('us')
    expect(defaultUnitSystem('en-GB')).toBe('imperial')
    expect(defaultUnitSystem('en-IN')).toBe('metric')
  })

  it.each(['us', 'imperial'] as const)('round trips values through %s units', (system) => {
    expect(distanceToKm(distanceFromKm(123, system), system)).toBeCloseTo(123, 10)
    expect(economyToKmpl(economyFromKmpl(15, system), system)).toBeCloseTo(15, 10)
    expect(priceToPerLitre(priceFromPerLitre(105, system), system)).toBeCloseTo(105, 10)
  })

  it('uses the correct US and imperial gallon sizes', () => {
    expect(volumeFromLitres(3.785411784, 'us')).toBeCloseTo(1, 10)
    expect(volumeFromLitres(4.54609, 'imperial')).toBeCloseTo(1, 10)
    expect(economyFromKmpl(10, 'us')).toBeCloseTo(23.5214583, 6)
    expect(economyFromKmpl(10, 'imperial')).toBeCloseTo(28.2480937, 6)
  })
})
