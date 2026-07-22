import { describe, expect, it, vi } from 'vitest'
import type { PersonResult } from './domain'
import { createSettlementMessage, shareSettlement } from './settlementSharing'

const person: PersonResult = {
  personId: 'asha',
  personName: 'Asha',
  distanceKm: 16.09344,
  legIds: ['out', 'back'],
  rawCost: 25,
  displayCost: 25,
  fuelCost: 20,
  expenseCost: 5,
}

describe('settlementSharing', () => {
  it('creates an individual message with the selected currency and units', () => {
    const message = createSettlementMessage({ tripName: 'Office commute', person, currency: 'USD', unitSystem: 'us' })

    expect(message).toContain('Office commute: Asha owes $25.00')
    expect(message).toContain('10 mi across 2 legs')
    expect(message).toContain('$20.00 for fuel and $5.00 for additional expenses')
    expect(message).not.toContain('other riders')
  })

  it('uses Web Share when it is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })

    await expect(shareSettlement('Asha owes $25.00')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 'Asha owes $25.00' })
  })

  it('copies when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(navigator, {
      share: { configurable: true, value: undefined },
      clipboard: { configurable: true, value: { writeText } },
    })

    await expect(shareSettlement('Asha owes $25.00')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Asha owes $25.00')
  })
})
