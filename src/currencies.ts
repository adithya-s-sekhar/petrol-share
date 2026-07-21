export interface CurrencyOption { code: string; symbol: string; name: string }

const FALLBACK_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'SGD', 'AED']
const REGION_CURRENCY: Record<string, string> = { IN: 'INR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', JP: 'JPY', CN: 'CNY', SG: 'SGD', AE: 'AED' }

export function currencyOptions(locale = globalThis.navigator?.language ?? 'en-IN'): CurrencyOption[] {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'currency') => string[] }).supportedValuesOf
  const codes = supportedValuesOf?.('currency') ?? FALLBACK_CURRENCIES
  const names = new Intl.DisplayNames([locale], { type: 'currency' })
  const local = REGION_CURRENCY[new Intl.Locale(locale).region ?? '']
  return codes.map((code) => ({
    code,
    name: names.of(code) ?? code,
    symbol: new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(({ type }) => type === 'currency')?.value ?? code,
  })).sort((a, b) => (a.code === local ? -1 : b.code === local ? 1 : a.name.localeCompare(b.name, locale)))
}
