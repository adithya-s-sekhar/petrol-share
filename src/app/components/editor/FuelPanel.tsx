import { ArrowRight } from 'lucide-react'
import type { CurrencyOption } from '../../../currencies'
import { displayNumber, numberFromInput, type ErrorMap } from '../../utils/tripDraftUtils'
import { layout } from '../../designSystem'
import { Button, FieldError } from '../ui/AppControls'
import { economyFromKmpl, economyToKmpl, formatCurrency, priceFromPerLitre, priceToPerLitre, type TripDraft, type UnitSystem } from '../../../domain'
import { CollapsibleSection, SectionHeading } from './CollapsibleSection'

interface FuelPanelProps {
  currencies: CurrencyOption[]
  draft: TripDraft
  errors: ErrorMap
  open: boolean
  complete: boolean
  unitSystem: UnitSystem
  units: ReturnType<typeof import('../../../domain').unitLabels>
  buttonRef: (node: HTMLButtonElement | null) => void
  onOpen: () => void
  onDone: () => void
  onUpdate: (draft: TripDraft) => void
}

export function FuelPanel({ currencies, draft, errors, open, complete, unitSystem, units, buttonRef, onOpen, onDone, onUpdate }: FuelPanelProps) {
  const settings = draft.fuelSettings
  const updateSettings = (changes: Partial<TripDraft['fuelSettings']>) => onUpdate({ ...draft, fuelSettings: { ...settings, ...changes } })
  const summary = `${displayNumber(settings.fuelEconomyKmpl, (value) => economyFromKmpl(value, unitSystem))} ${units.economy} · ${formatCurrency(priceFromPerLitre(settings.fuelPricePerLitre ?? 0, unitSystem), settings.currency)}/${units.volume}`
  return <CollapsibleSection controls="fuel" open={open} step={2} title="Fuel details" summary={summary} buttonRef={buttonRef} onOpen={onOpen}>
    <>
      <SectionHeading controls="fuel" step={2} title="Fuel details">Use the average economy for the complete journey.</SectionHeading>
      <div id="fuel-content" className={layout('fuel-fields')}>
        <div className={layout('form-field')}><label htmlFor="economy">Fuel economy ({units.economy})</label><div className={layout('unit-input')}><input id="economy" aria-label="Fuel economy" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 15" value={displayNumber(settings.fuelEconomyKmpl, (value) => economyFromKmpl(value, unitSystem))} aria-invalid={Boolean(errors['fuelSettings.fuelEconomyKmpl'])} aria-describedby="economy-error" onChange={(event) => { const value = numberFromInput(event.target.value); updateSettings({ fuelEconomyKmpl: value === null ? null : economyToKmpl(value, unitSystem) }) }} /><span>{units.economy}</span></div><FieldError id="economy-error" message={errors['fuelSettings.fuelEconomyKmpl']} /></div>
        <div className={layout('form-field')}><label htmlFor="fuel-price">Price per {units.priceVolume}</label><input id="fuel-price" aria-label={unitSystem === 'metric' ? 'Price per litre' : `Price per ${units.priceVolume}`} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 105" value={displayNumber(settings.fuelPricePerLitre, (value) => priceFromPerLitre(value, unitSystem))} aria-invalid={Boolean(errors['fuelSettings.fuelPricePerLitre'])} aria-describedby="price-error" onChange={(event) => { const value = numberFromInput(event.target.value); updateSettings({ fuelPricePerLitre: value === null ? null : priceToPerLitre(value, unitSystem) }) }} /><FieldError id="price-error" message={errors['fuelSettings.fuelPricePerLitre']} /></div>
        <div className={layout('form-field currency-field')}><label htmlFor="currency">Currency</label><input id="currency" list="currency-options" role="combobox" autoComplete="off" value={settings.currency} aria-invalid={Boolean(errors['fuelSettings.currency'])} aria-describedby="currency-help currency-error" onChange={(event) => updateSettings({ currency: event.target.value.toUpperCase() })} /><datalist id="currency-options">{currencies.map(({ code, symbol, name }) => <option key={code} value={code}>{symbol} · {code} · {name}</option>)}</datalist><small id="currency-help">Search by symbol, code, or currency name.</small><FieldError id="currency-error" message={errors['fuelSettings.currency']} /></div>
        <div className={layout('form-field')}><label htmlFor="fuel-type">Fuel type (optional)</label><input id="fuel-type" value={settings.fuelType ?? ''} placeholder="e.g. Petrol" onChange={(event) => updateSettings({ fuelType: event.target.value })} /></div>
      </div>
      {complete && <Button className="mt-5 w-full" onClick={onDone}>Done with fuel details <ArrowRight /></Button>}
    </>
  </CollapsibleSection>
}
