const STORAGE_KEY = 'petrol-share.recent-currencies.v1'
const MAX_RECENT_CURRENCIES = 4

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

export function loadRecentCurrencies(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.map(normalizeCurrency).filter((code): code is string => code !== null))].slice(0, MAX_RECENT_CURRENCIES)
  } catch {
    return []
  }
}

export function rememberRecentCurrency(code: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string[] {
  const normalized = normalizeCurrency(code)
  const recent = loadRecentCurrencies(storage)
  if (!normalized) return recent
  const next = [normalized, ...recent.filter((item) => item !== normalized)].slice(0, MAX_RECENT_CURRENCIES)
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export const recentCurrencyStorageKey = STORAGE_KEY
