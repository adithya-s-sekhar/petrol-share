import { describe, expect, it } from 'vitest'
import { loadRecentCurrencies, rememberRecentCurrency } from './recentCurrencyStorage'

describe('recent currency storage', () => {
  it('normalizes, deduplicates, and orders currencies by recent use', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    for (const code of ['usd', 'EUR', 'INR', 'USD', 'GBP', 'JPY']) rememberRecentCurrency(code, storage)

    expect(loadRecentCurrencies(storage)).toEqual(['JPY', 'GBP', 'USD', 'INR'])
  })

  it('ignores malformed saved data and invalid codes', () => {
    const storage = { getItem: () => JSON.stringify(['USD', 'usd', '', 4, 'EURO']), setItem: () => undefined }
    expect(loadRecentCurrencies(storage)).toEqual(['USD'])
    expect(rememberRecentCurrency('US', storage)).toEqual(['USD'])
  })
})
