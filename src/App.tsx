import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CarFront,
  CircleAlert,
  Fuel,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react'
import {
  calculateTrip,
  createBlankTripDraft,
  editableTripDraftSchema,
  formatCurrency,
  normalizeTripRoute,
  type Person,
  type TripDraft,
} from './domain'
import { loadCurrentTrip, saveCurrentTrip } from './persistence/tripStorage'

type ErrorMap = Record<string, string>
type PersistenceStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'recovered' | 'error'

const AUTOSAVE_DELAY_MS = 500

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function numberFromInput(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

function validationErrors(draft: TripDraft): ErrorMap {
  const result = editableTripDraftSchema.safeParse(draft)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p className="field-error" id={id} role="alert"><CircleAlert size={14} />{message}</p>
}

function IconButton({ label, disabled, onClick, children }: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return <button className="icon-button" type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>
}

function App() {
  const [draft, setDraft] = useState<TripDraft>(() => createBlankTripDraft())
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading')
  const hydratedDraftRef = useRef<string | null>(null)
  const saveSequenceRef = useRef(0)
  const errors = useMemo(() => submitted ? validationErrors(draft) : {}, [draft, submitted])
  const parsed = useMemo(() => editableTripDraftSchema.safeParse(draft), [draft])
  const result = parsed.success ? calculateTrip(parsed.data) : null
  const stopsById = new Map(draft.stops.map((stop) => [stop.id, stop.name || 'Unnamed stop']))

  useEffect(() => {
    let active = true
    void loadCurrentTrip()
      .then((loaded) => {
        if (!active) return
        const initialDraft = loaded.status === 'restored' ? loaded.draft : createBlankTripDraft()
        hydratedDraftRef.current = JSON.stringify(initialDraft)
        setDraft(initialDraft)
        setPersistenceStatus(loaded.status === 'recovered' ? 'recovered' : 'idle')
        setHydrated(true)
      })
      .catch(() => {
        if (!active) return
        const blankDraft = createBlankTripDraft()
        hydratedDraftRef.current = JSON.stringify(blankDraft)
        setDraft(blankDraft)
        setPersistenceStatus('recovered')
        setHydrated(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const serializedDraft = JSON.stringify(draft)
    if (serializedDraft === hydratedDraftRef.current) return

    const sequence = ++saveSequenceRef.current
    setPersistenceStatus('saving')
    const timeout = window.setTimeout(() => {
      void saveCurrentTrip(draft)
        .then(() => {
          if (saveSequenceRef.current !== sequence) return
          hydratedDraftRef.current = serializedDraft
          setPersistenceStatus('saved')
        })
        .catch(() => {
          if (saveSequenceRef.current === sequence) setPersistenceStatus('error')
        })
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [draft, hydrated])

  function update(next: TripDraft) {
    setDraft({ ...next, updatedAt: new Date().toISOString() })
  }

  function changeStops(stops: TripDraft['stops']) {
    update(normalizeTripRoute(draft, stops))
  }

  function addStop() {
    changeStops([...draft.stops, { id: createId(), name: '' }])
  }

  function moveStop(index: number, direction: -1 | 1) {
    const stops = [...draft.stops]
    const target = index + direction
    ;[stops[index], stops[target]] = [stops[target], stops[index]]
    changeStops(stops)
  }

  function addPerson() {
    const person: Person = { id: createId(), name: '', assignedLegIds: [] }
    update({ ...draft, people: [...draft.people, person] })
  }

  function resetTrip() {
    if (window.confirm('Reset the complete trip? All stops, people, distances, and settings will be cleared.')) {
      setDraft(createBlankTripDraft())
      setSubmitted(false)
    }
  }

  function revealResults() {
    setSubmitted(true)
    if (!parsed.success) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  if (!hydrated) {
    return <main className="loading-screen" aria-busy="true"><Fuel /><p role="status">Loading your trip…</p></main>
  }

  const persistenceMessage = {
    loading: 'Loading your trip…',
    idle: 'Autosave ready',
    saving: 'Saving…',
    saved: 'Saved',
    recovered: 'Saved trip could not be restored. A new trip was started safely.',
    error: 'Could not save changes. Keep this page open and try another edit.',
  }[persistenceStatus]

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Petrol Share home"><span className="brand-mark"><Fuel /></span><span>Petrol <strong>Share</strong></span></a>
        <button className="reset-button" type="button" onClick={resetTrip}><RotateCcw size={17} /> Reset trip</button>
      </header>

      <main id="top">
        <div className={`persistence-status persistence-${persistenceStatus}`} role="status" aria-live="polite">{persistenceMessage}</div>
        <section className="hero" aria-labelledby="page-title">
          <div className="eyebrow"><CarFront size={16} /> Fair fuel costs, leg by leg</div>
          <h1 id="page-title">Plan the route.<br /><span>Split the ride.</span></h1>
          <p>Build your journey, choose who rode each leg, and get a fair fuel split in seconds.</p>
        </section>

        <div className="editor-grid">
          <div className="editor-column">
            <section className="panel" aria-labelledby="route-title">
              <div className="panel-heading"><span className="step">1</span><div><h2 id="route-title">Build your route</h2><p>Each stop is a distinct visit, even when its name repeats.</p></div></div>
              <ol className="stops-list">
                {draft.stops.map((stop, index) => {
                  const errorId = `stop-${stop.id}-error`
                  const error = errors[`stops.${index}.name`]
                  return <li className="stop-row" key={stop.id}>
                    <span className="stop-index" aria-hidden="true">{index + 1}</span>
                    <div className="field-grow">
                      <label className="sr-only" htmlFor={`stop-${stop.id}`}>Stop {index + 1} name</label>
                      <div className="input-with-icon"><MapPin size={18} /><input id={`stop-${stop.id}`} value={stop.name} placeholder={index === 0 ? 'Starting point' : 'Next stop'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => changeStops(draft.stops.map((item) => item.id === stop.id ? { ...item, name: event.target.value } : item))} /></div>
                      <FieldError id={errorId} message={error} />
                    </div>
                    <div className="row-actions">
                      <IconButton label={`Move stop ${index + 1} up`} disabled={index === 0} onClick={() => moveStop(index, -1)}><ArrowUp /></IconButton>
                      <IconButton label={`Move stop ${index + 1} down`} disabled={index === draft.stops.length - 1} onClick={() => moveStop(index, 1)}><ArrowDown /></IconButton>
                      <IconButton label={`Remove stop ${index + 1}`} disabled={draft.stops.length <= 2} onClick={() => changeStops(draft.stops.filter(({ id }) => id !== stop.id))}><Trash2 /></IconButton>
                    </div>
                  </li>
                })}
              </ol>
              <button className="secondary-button full-button" type="button" onClick={addStop}><Plus size={18} /> Add another stop</button>

              <div className="subsection">
                <h3>Leg distances</h3>
                <div className="leg-list">
                  {draft.legs.map((leg, index) => {
                    const error = errors[`legs.${index}.distanceKm`]
                    const errorId = `leg-${leg.id}-error`
                    return <div className="leg-row" key={leg.id}>
                      <div className="leg-name"><span>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={16} /><span>{stopsById.get(leg.toStopId)}</span></div>
                      <div><label className="sr-only" htmlFor={`leg-${leg.id}`}>Distance from {stopsById.get(leg.fromStopId)} to {stopsById.get(leg.toStopId)} in kilometres</label><div className="unit-input"><input id={`leg-${leg.id}`} type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={leg.distanceKm ?? ''} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => update({ ...draft, legs: draft.legs.map((item) => item.id === leg.id ? { ...item, distanceKm: numberFromInput(event.target.value) } : item) })} /><span>km</span></div><FieldError id={errorId} message={error} /></div>
                    </div>
                  })}
                </div>
              </div>
            </section>

            <section className="panel" aria-labelledby="fuel-title">
              <div className="panel-heading"><span className="step">2</span><div><h2 id="fuel-title">Fuel details</h2><p>Use the average economy for the complete journey.</p></div></div>
              <div className="fuel-fields">
                <div className="form-field"><label htmlFor="economy">Fuel economy</label><div className="unit-input"><input id="economy" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 15" value={draft.fuelSettings.fuelEconomyKmpl ?? ''} aria-invalid={Boolean(errors['fuelSettings.fuelEconomyKmpl'])} aria-describedby="economy-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelEconomyKmpl: numberFromInput(event.target.value) } })} /><span>km/L</span></div><FieldError id="economy-error" message={errors['fuelSettings.fuelEconomyKmpl']} /></div>
                <div className="form-field"><label htmlFor="fuel-price">Price per litre</label><input id="fuel-price" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 105" value={draft.fuelSettings.fuelPricePerLitre ?? ''} aria-invalid={Boolean(errors['fuelSettings.fuelPricePerLitre'])} aria-describedby="price-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelPricePerLitre: numberFromInput(event.target.value) } })} /><FieldError id="price-error" message={errors['fuelSettings.fuelPricePerLitre']} /></div>
                <div className="form-field currency-field"><label htmlFor="currency">Currency</label><input id="currency" maxLength={3} autoCapitalize="characters" value={draft.fuelSettings.currency} aria-invalid={Boolean(errors['fuelSettings.currency'])} aria-describedby="currency-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, currency: event.target.value.toUpperCase() } })} /><FieldError id="currency-error" message={errors['fuelSettings.currency']} /></div>
              </div>
            </section>

            <section className="panel" aria-labelledby="people-title">
              <div className="panel-heading"><span className="step">3</span><div><h2 id="people-title">Who was riding?</h2><p>Add everyone who should share the fuel cost.</p></div></div>
              <div className="people-list">
                {draft.people.map((person, index) => {
                  const error = errors[`people.${index}.name`]
                  const errorId = `person-${person.id}-error`
                  return <div className="person-row" key={person.id}><div className="field-grow"><label className="sr-only" htmlFor={`person-${person.id}`}>Person {index + 1} name</label><div className="input-with-icon"><Users size={18} /><input id={`person-${person.id}`} placeholder="Person's name" value={person.name} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => update({ ...draft, people: draft.people.map((item) => item.id === person.id ? { ...item, name: event.target.value } : item) })} /></div><FieldError id={errorId} message={error} /></div><IconButton label={`Remove ${person.name || `person ${index + 1}`}`} onClick={() => update({ ...draft, people: draft.people.filter(({ id }) => id !== person.id) })}><Trash2 /></IconButton></div>
                })}
              </div>
              <button className="secondary-button full-button" type="button" onClick={addPerson}><Plus size={18} /> Add person</button>
              {submitted && errors.people && <div className="notice error-notice" role="alert"><CircleAlert />{errors.people}</div>}
            </section>
          </div>

          <aside className="results-column">
            <section className="panel assignment-panel" aria-labelledby="assignment-title">
              <div className="panel-heading compact"><span className="step">4</span><div><h2 id="assignment-title">Assign each leg</h2><p>Check who travelled on each part.</p></div></div>
              {draft.people.length === 0 ? <div className="empty-state"><Users /><p>Add people to start assigning riders.</p></div> : <div className="assignment-scroll"><table><thead><tr><th scope="col">Passenger</th>{draft.legs.map((leg) => <th scope="col" key={leg.id}><span>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={13} /><span>{stopsById.get(leg.toStopId)}</span></th>)}</tr></thead><tbody>{draft.people.map((person) => <tr key={person.id}><th scope="row">{person.name || 'Unnamed'}</th>{draft.legs.map((leg) => <td key={leg.id}><input type="checkbox" aria-label={`${person.name || 'Unnamed person'} rode from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)}`} checked={person.assignedLegIds.includes(leg.id)} onChange={(event) => update({ ...draft, people: draft.people.map((item) => item.id !== person.id ? item : { ...item, assignedLegIds: event.target.checked ? [...item.assignedLegIds, leg.id] : item.assignedLegIds.filter((id) => id !== leg.id) }) })} /></td>)}</tr>)}</tbody></table></div>}
            </section>

            <section className="results-card" aria-labelledby="results-title" aria-live="polite">
              <div className="results-heading"><div><span className="results-kicker">Your split</span><h2 id="results-title">Journey summary</h2></div><Fuel /></div>
              {!result ? <div className="results-empty"><p>Complete the trip details to see your fair split.</p><button className="primary-button" type="button" onClick={revealResults}>Calculate split <ArrowRight size={18} /></button></div> : <>
                <div className="totals"><div><span>Total distance</span><strong>{result.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km</strong></div><div><span>Fuel used</span><strong>{result.totalLitres.toLocaleString(undefined, { maximumFractionDigits: 2 })} L</strong></div><div className="total-cost"><span>Total fuel cost</span><strong>{formatCurrency(result.totalCost, draft.fuelSettings.currency)}</strong></div></div>
                {result.unassignedLegIds.length > 0 ? <div className="notice warning-notice" role="status"><CircleAlert /><div><strong>Some legs have no riders</strong><ul>{result.unassignedLegIds.map((id) => { const leg = draft.legs.find((item) => item.id === id)!; return <li key={id}>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</li> })}</ul></div></div> : <div className="split-list">{result.people.map((person) => <div className="split-row" key={person.personId}><div className="avatar" aria-hidden="true">{person.personName.charAt(0).toUpperCase()}</div><div><strong>{person.personName}</strong><span>{person.distanceKm.toLocaleString()} km · {person.legIds.length} {person.legIds.length === 1 ? 'leg' : 'legs'}</span></div><strong>{formatCurrency(person.displayCost, draft.fuelSettings.currency)}</strong></div>)}</div>}
              </>}
            </section>
          </aside>
        </div>
      </main>
      <footer>Made for fair journeys.</footer>
    </div>
  )
}

export default App
