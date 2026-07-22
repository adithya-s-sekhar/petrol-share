import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleAlert,
  ChevronDown,
  Fuel,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import {
  calculateTrip,
  createBlankTripDraft,
  editableTripDraftSchema,
  formatCurrency,
  defaultUnitSystem,
  distanceFromKm,
  distanceToKm,
  economyFromKmpl,
  economyToKmpl,
  priceFromPerLitre,
  priceToPerLitre,
  unitLabels,
  type TripDraft,
  type UnitSystem,
} from '../domain'
import { currencyOptions } from '../currencies'
import { createSummaryImage, shareSummary } from '../shareSummary'
import { usePersistedTrip } from './usePersistedTrip'
import { useTheme } from './themeContext'
import { useTripEditor } from './useTripEditor'
import { saveStoredTrip, type StoredTrip } from '../persistence/tripStorage'
import { loadVehiclePresets, saveVehiclePresets, type VehiclePreset } from '../persistence/vehiclePresetStorage'
import { createEditableTripLink, deserializeEditableTrip, EditableTripImportError, readEditableTripLink, serializeEditableTrip, type EditableTripImport } from '../tripSharing'
import { FieldError, IconButton } from './AppControls'
import { cloneDraft, displayNumber, numberFromInput, recordId, routeSummary, validationErrors } from './tripDraftUtils'
import { classes } from './styles'
import { useRouteLookup } from './useRouteLookup'
import { useElementVisibility } from './useElementVisibility'
import { useMediaQuery } from './useMediaQuery'
import { AppHeader } from './components/AppHeader'
import { Hero } from './components/Hero'
import { TripLibrary } from './components/TripLibrary'
import { AssignmentPanel } from './components/AssignmentPanel'
import { persistenceMessage as getPersistenceMessage, tripProgress, uniqueReturnStops, type EditorSection } from './appViewUtils'
import { ResultsPanel } from './components/ResultsPanel'

type ShareStatus = 'idle' | 'sharing' | 'shared' | 'downloaded' | 'error'
type UndoRemoval = { draft: TripDraft; message: string }
type TripDialog = { action: 'create' | 'rename' | 'delete'; trip?: StoredTrip } | null
type ImportPreview = EditableTripImport & { source: 'link' | 'file' }
type VehicleDialog = { action: 'create' | 'edit' | 'delete'; preset?: VehiclePreset } | null

const PUBLIC_SITE_URL = 'https://adithya-s-sekhar.github.io/petrol-share/'


export function AppPage() {
  const { themePreference, cycleTheme } = useTheme()
  const [submitted, setSubmitted] = useState(false)
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
  const [shareError, setShareError] = useState('')
  const [shareMessageCopied, setShareMessageCopied] = useState(false)
  const mobileAssignments = useMediaQuery('(max-width: 560px)')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => defaultUnitSystem())
  const [openSections, setOpenSections] = useState<Set<EditorSection>>(() => new Set(['route', 'fuel', 'people']))
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [tripDialog, setTripDialog] = useState<TripDialog>(null)
  const [vehicleDialog, setVehicleDialog] = useState<VehicleDialog>(null)
  const [vehiclePresets, setVehiclePresets] = useState<VehiclePreset[]>(loadVehiclePresets)
  const [vehicleName, setVehicleName] = useState('')
  const [vehicleEconomy, setVehicleEconomy] = useState('')
  const [vehicleFuelType, setVehicleFuelType] = useState('')
  const [vehicleUnits, setVehicleUnits] = useState<UnitSystem>('metric')
  const [newTripTemplateId, setNewTripTemplateId] = useState('')
  const [tripName, setTripName] = useState('')
  const [libraryMessage, setLibraryMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [undoRemoval, setUndoRemoval] = useState<UndoRemoval | null>(null)
  const closeRestoredSections = useCallback(() => setOpenSections(new Set()), [])
  const { draft, setDraft, trips, setTrips, activeTripId, selectTrip, hydrated, persistenceStatus, retryAutosave } = usePersistedTrip(closeRestoredSections)
  const resultsRef = useRef<HTMLElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const cancelResetRef = useRef<HTMLButtonElement>(null)
  const sectionButtonRefs = useRef<Partial<Record<EditorSection, HTMLButtonElement>>>({})
  const linkImportChecked = useRef(false)
  const errors = useMemo(() => submitted ? validationErrors(draft) : {}, [draft, submitted])
  const parsed = useMemo(() => editableTripDraftSchema.safeParse(draft), [draft])
  const result = parsed.success ? calculateTrip(parsed.data) : null
  const units = unitLabels(unitSystem)
  const currencies = useMemo(() => currencyOptions(), [])
  const hasResult = result !== null
  const resultsVisible = useElementVisibility(resultsRef, hasResult)
  const { stopsById, update, changeStops, addStop, returnToStop, makeRoundTrip, reuseLegDistanceForBlankReverse, moveStop, addPerson, setLegAssignment, setAllLegAssignments } = useTripEditor(draft, setDraft)
  const { mapDialog, setMapDialog, fromSuggestions, toSuggestions, selectedFrom, setSelectedFrom, selectedTo, setSelectedTo, mapStatus, mapError, showMapDialog, findPlaces, applyRoadDistance } = useRouteLookup(draft, update, stopsById)

  useEffect(() => {
    if (!resetDialogOpen) return
    cancelResetRef.current?.focus()
  }, [resetDialogOpen])

  useEffect(() => {
    if (!undoRemoval) return
    const timeout = window.setTimeout(() => setUndoRemoval(null), 8000)
    return () => window.clearTimeout(timeout)
  }, [undoRemoval])

  useEffect(() => {
    if (!hydrated || linkImportChecked.current) return
    linkImportChecked.current = true
    try {
      const imported = readEditableTripLink(window.location)
      if (imported) setImportPreview({ ...imported, source: 'link' })
    } catch (error) {
      setLibraryOpen(true)
      setImportError(error instanceof Error ? error.message : 'The editable trip link could not be opened.')
    } finally {
      if (window.location.hash.startsWith('#trip=')) history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }, [hydrated])

  function closeResetDialog() {
    setResetDialogOpen(false)
    requestAnimationFrame(() => resetButtonRef.current?.focus())
  }

  function resetTrip() {
    setDraft(createBlankTripDraft())
    setSubmitted(false)
    setUndoRemoval(null)
    setOpenSections(new Set(['route', 'fuel', 'people']))
    setResetDialogOpen(false)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Stop 1 name"]')?.focus())
  }

  function showTripDialog(action: NonNullable<TripDialog>['action'], trip?: StoredTrip) {
    setTripName(action === 'rename' ? trip?.name ?? '' : action === 'create' ? 'Untitled trip' : '')
    setTripDialog({ action, trip })
    if (action === 'create') setNewTripTemplateId('')
  }

  function showVehicleDialog(action: NonNullable<VehicleDialog>['action'], preset?: VehiclePreset) {
    setVehicleName(preset?.name ?? '')
    setVehicleEconomy(preset ? String(economyFromKmpl(preset.fuelEconomyKmpl, preset.preferredUnits)) : '')
    setVehicleFuelType(preset?.fuelType ?? '')
    setVehicleUnits(preset?.preferredUnits ?? unitSystem)
    setVehicleDialog({ action, preset })
  }

  function storeVehiclePresets(next: VehiclePreset[]) {
    saveVehiclePresets(next)
    setVehiclePresets(next)
  }

  function submitVehicleDialog() {
    if (!vehicleDialog) return
    if (vehicleDialog.action === 'delete' && vehicleDialog.preset) {
      storeVehiclePresets(vehiclePresets.filter(({ id }) => id !== vehicleDialog.preset!.id))
      setLibraryMessage(`${vehicleDialog.preset.name} deleted.`)
    } else {
      const economy = Number(vehicleEconomy)
      if (!vehicleName.trim() || !Number.isFinite(economy) || economy <= 0) return
      const preset: VehiclePreset = {
        id: vehicleDialog.preset?.id ?? recordId(),
        name: vehicleName.trim(),
        fuelEconomyKmpl: economyToKmpl(economy, vehicleUnits),
        preferredUnits: vehicleUnits,
        ...(vehicleFuelType.trim() ? { fuelType: vehicleFuelType.trim() } : {}),
      }
      storeVehiclePresets([preset, ...vehiclePresets.filter(({ id }) => id !== preset.id)])
      setLibraryMessage(`${preset.name} ${vehicleDialog.action === 'create' ? 'saved' : 'updated'}.`)
    }
    setVehicleDialog(null)
  }

  function applyVehiclePreset(preset: VehiclePreset) {
    update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelEconomyKmpl: preset.fuelEconomyKmpl, fuelType: preset.fuelType ?? '' } })
    setUnitSystem(preset.preferredUnits)
    setOpenSections((sections) => new Set(sections).add('fuel'))
    setLibraryMessage(`${preset.name} applied. Review or edit the auto-filled fuel details below.`)
  }

  async function createTripFromDraft(name: string, source: TripDraft, template = false) {
    const nextDraft = template ? cloneDraft(source, true) : source
    const record: StoredTrip = { id: recordId(), name, kind: 'trip', draft: nextDraft, updatedAt: nextDraft.updatedAt }
    await selectTrip(record)
    setOpenSections(new Set(['route', 'fuel', 'people']))
    setLibraryMessage(template ? `Created ${name} from a template. Add riders and adjust it for this journey.` : `Created ${name}.`)
  }

  async function submitTripDialog() {
    if (!tripDialog) return
    if (tripDialog.action === 'create') {
      const template = trips.find(({ id, kind, deletedAt }) => id === newTripTemplateId && kind === 'template' && !deletedAt)
      await createTripFromDraft(tripName.trim() || 'Untitled trip', template?.draft ?? createBlankTripDraft(), Boolean(template))
    } else if (tripDialog.action === 'rename' && tripDialog.trip) {
      const changed = { ...tripDialog.trip, name: tripName.trim() || 'Untitled trip', updatedAt: new Date().toISOString() }
      await saveStoredTrip(changed)
      setTrips((items) => items.map((item) => item.id === changed.id ? changed : item))
      setLibraryMessage(`Renamed trip to ${changed.name}.`)
    } else if (tripDialog.action === 'delete' && tripDialog.trip) {
      const deleted = { ...tripDialog.trip, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      await saveStoredTrip(deleted)
      setTrips((items) => items.map((item) => item.id === deleted.id ? deleted : item))
      setLibraryMessage(`${deleted.name} moved to Recently deleted.`)
      if (deleted.id === activeTripId) await createTripFromDraft('Untitled trip', createBlankTripDraft())
    }
    setTripDialog(null)
  }

  async function duplicateTrip(trip: StoredTrip) {
    const copy = cloneDraft(trip.draft)
    await createTripFromDraft(`${trip.name} copy`, copy)
  }

  async function saveTemplate(trip: StoredTrip) {
    const template: StoredTrip = { id: recordId(), name: `${trip.name} template`, kind: 'template', draft: cloneDraft(trip.draft, true), updatedAt: new Date().toISOString() }
    await saveStoredTrip(template)
    setTrips((items) => [template, ...items])
    setLibraryMessage(`${template.name} is ready to reuse.`)
  }

  async function restoreTrip(trip: StoredTrip) {
    const restored = { ...trip, deletedAt: undefined, updatedAt: new Date().toISOString() }
    await saveStoredTrip(restored)
    setTrips((items) => items.map((item) => item.id === restored.id ? restored : item))
    setLibraryMessage(`${restored.name} restored.`)
  }

  function activeTrip(): StoredTrip {
    return trips.find(({ id }) => id === activeTripId) ?? { id: activeTripId, name: 'Shared trip', kind: 'trip', draft, updatedAt: draft.updatedAt }
  }

  function editableTripJson(): string {
    return serializeEditableTrip(draft, activeTrip().name, unitSystem)
  }

  async function copyEditableLink() {
    setImportError('')
    try {
      await navigator.clipboard.writeText(createEditableTripLink(editableTripJson(), window.location.href))
      setLibraryMessage('Editable trip link copied. Recipients can preview it before saving.')
    } catch {
      setImportError('The editable link could not be copied. Allow clipboard access and try again.')
    }
  }

  function downloadEditableTrip() {
    const blobUrl = URL.createObjectURL(new Blob([editableTripJson()], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = `${activeTrip().name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'trip'}.petrol-share.json`
    anchor.click()
    URL.revokeObjectURL(blobUrl)
    setLibraryMessage('Editable trip file downloaded.')
  }

  async function chooseImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError('')
    try {
      const imported = deserializeEditableTrip(await file.text())
      setImportPreview({ ...imported, source: 'file' })
    } catch (error) {
      setImportError(error instanceof EditableTripImportError ? error.message : 'The selected file could not be read. Choose another Petrol Share trip file.')
    }
  }

  async function confirmImport(action: 'add' | 'replace') {
    if (!importPreview) return
    if (action === 'add') {
      await createTripFromDraft(importPreview.name, importPreview.draft)
    } else {
      const current = activeTrip()
      const changed: StoredTrip = { ...current, name: importPreview.name, draft: importPreview.draft, updatedAt: importPreview.draft.updatedAt }
      await selectTrip(changed)
      setLibraryMessage(`${importPreview.name} replaced the current trip.`)
    }
    setUnitSystem(importPreview.unitSystem)
    setSubmitted(false)
    setOpenSections(new Set(['route', 'fuel', 'people']))
    setImportPreview(null)
  }

  async function openLibraryTrip(trip: StoredTrip) {
    if (trip.kind === 'template') await createTripFromDraft(`Trip from ${trip.name}`, trip.draft, true)
    else {
      await selectTrip(trip)
      setOpenSections(editableTripDraftSchema.safeParse(trip.draft).success ? new Set() : new Set(['route', 'fuel', 'people']))
      setLibraryMessage(`Opened ${trip.name}.`)
    }
  }

  function removeStop(stopId: string, index: number) {
    setUndoRemoval({ draft, message: `Stop ${index + 1} removed.` })
    changeStops(draft.stops.filter(({ id }) => id !== stopId))
  }

  function removePerson(personId: string, name: string, index: number) {
    setUndoRemoval({ draft, message: `${name || `Person ${index + 1}`} removed.` })
    update({ ...draft, people: draft.people.filter(({ id }) => id !== personId), expenses: (draft.expenses ?? []).map((expense) => ({ ...expense, personIds: expense.personIds.filter((id) => id !== personId) })) })
  }

  function addExpense() {
    update({ ...draft, expenses: [...(draft.expenses ?? []), { id: recordId(), name: '', amount: null, scope: 'journey', personIds: [] }] })
  }

  function changeExpense(id: string, changes: Partial<NonNullable<TripDraft['expenses']>[number]>) {
    update({ ...draft, expenses: (draft.expenses ?? []).map((expense) => expense.id === id ? { ...expense, ...changes } : expense) })
  }

  function undoLastRemoval() {
    if (!undoRemoval) return
    setDraft({ ...undoRemoval.draft, updatedAt: new Date().toISOString() })
    setUndoRemoval(null)
  }

  function revealResults() {
    setSubmitted(true)
    if (!parsed.success) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  function openSection(section: EditorSection, firstFieldId: string) {
    setOpenSections((current) => new Set(current).add(section))
    requestAnimationFrame(() => document.getElementById(firstFieldId)?.focus())
  }

  function closeSection(section: EditorSection, nextSection?: EditorSection) {
    setOpenSections((current) => {
      const next = new Set(current)
      next.delete(section)
      return next
    })
    requestAnimationFrame(() => {
      if (!nextSection) return sectionButtonRefs.current[section]?.focus()
      const firstFieldId = nextSection === 'fuel' ? 'economy' : `person-${draft.people[0]?.id}`
      ;(document.getElementById(firstFieldId) ?? sectionButtonRefs.current[nextSection])?.focus()
    })
  }

  async function shareResult() {
    if (!result || shareStatus === 'sharing') return
    setShareStatus('sharing')
    setShareError('')
    setShareMessageCopied(false)
    try {
      const unassignedLegNames = result.unassignedLegIds.map((id) => {
        const leg = draft.legs.find((item) => item.id === id)!
        return `${stopsById.get(leg.fromStopId)} → ${stopsById.get(leg.toStopId)}`
      })
      unassignedLegNames.push(...result.unassignedExpenseIds.map((id) => `Expense: ${(draft.expenses ?? []).find((expense) => expense.id === id)?.name || 'Unnamed expense'}`))
      const image = createSummaryImage({ result, currency: draft.fuelSettings.currency, unassignedLegNames, pageUrl: PUBLIC_SITE_URL })
      const shareResult = await shareSummary(image, PUBLIC_SITE_URL)
      setShareMessageCopied(shareResult.messageCopied)
      setShareStatus(shareResult.method)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setShareStatus('idle')
        return
      }
      setShareError(error instanceof Error ? error.message : 'The summary could not be shared.')
      setShareStatus('error')
    }
  }

  if (!hydrated) {
    return <main className={classes("loading-screen")} aria-busy="true"><Fuel /><p role="status">Loading your trip…</p></main>
  }

  const persistenceMessage = getPersistenceMessage(persistenceStatus)
  const totalDistance = draft.legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0)
  const { routeComplete, fuelComplete, peopleComplete, hasProgress } = tripProgress(draft)
  const returnStops = uniqueReturnStops(draft)

  return (
    <div className={classes("app-shell")}>
      <AppHeader libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen((open) => !open)} onReset={() => setResetDialogOpen(true)} persistenceStatus={persistenceStatus} resetButtonRef={resetButtonRef} themePreference={themePreference} onCycleTheme={cycleTheme} />

      <main id="top">
        {(persistenceStatus === 'error' || persistenceStatus === 'recovered') && <div className={classes("recovery-notice")} role="alert"><CircleAlert /> <span>{persistenceMessage}</span>{persistenceStatus === 'error' && <button type="button" onClick={retryAutosave}>Try saving again</button>}</div>}
        {persistenceStatus === 'migrated' && <div className={classes("recovery-notice")} role="status"><Save /><span>Your previous draft was moved safely into Saved trips.</span></div>}
        {libraryOpen && <TripLibrary activeTripId={activeTripId} importError={importError} message={libraryMessage} trips={trips} vehiclePresets={vehiclePresets} onClose={() => setLibraryOpen(false)} onCopyLink={() => void copyEditableLink()} onDownload={downloadEditableTrip} onImport={(event) => void chooseImportFile(event)} onNewTrip={() => showTripDialog('create')} onNewVehicle={() => showVehicleDialog('create')} onUseVehicle={applyVehiclePreset} onEditVehicle={(preset) => showVehicleDialog('edit', preset)} onDeleteVehicle={(preset) => showVehicleDialog('delete', preset)} onOpenTrip={(trip) => void openLibraryTrip(trip)} onDuplicateTrip={(trip) => void duplicateTrip(trip)} onSaveTemplate={(trip) => void saveTemplate(trip)} onRenameTrip={(trip) => showTripDialog('rename', trip)} onDeleteTrip={(trip) => showTripDialog('delete', trip)} onRestoreTrip={(trip) => void restoreTrip(trip)} />}
        <Hero compact={hasProgress} />

        <div className={classes("editor-grid")}>
          <div className={classes("editor-column")}>
            <section className={classes(`panel${openSections.has('route') ? '' : ' panel-collapsed'}`)} aria-labelledby="route-title">
              {!openSections.has('route') ? <button ref={(node) => { if (node) sectionButtonRefs.current.route = node }} className={classes("section-toggle")} type="button" aria-expanded="false" aria-controls="route-content" onClick={() => openSection('route', `stop-${draft.stops[0].id}`)}><span className={classes("step")}>1</span><div><h2 id="route-title">Build your route</h2><p>{draft.stops.length} stops · {distanceFromKm(totalDistance, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} {units.distance}</p></div><ChevronDown aria-hidden="true" /></button> : <>
              <div className={classes("panel-heading")}><span className={classes("step")}>1</span><div><h2 id="route-title">Build your route</h2><p>Each stop is a distinct visit, even when its name repeats.</p></div></div>
              <div id="route-content">
              <ol className={classes("stops-list")}>
                {draft.stops.map((stop, index) => {
                  const errorId = `stop-${stop.id}-error`
                  const error = errors[`stops.${index}.name`]
                  return <li className={classes("stop-row")} key={stop.id}>
                    <span className={classes("stop-index")} aria-hidden="true">{index + 1}</span>
                    <div className={classes("field-grow")}>
                      <label className={classes("row-label")} htmlFor={`stop-${stop.id}`}>Stop {index + 1}</label>
                      <div className={classes("input-with-icon")}><MapPin size={18} /><input id={`stop-${stop.id}`} aria-label={`Stop ${index + 1} name`} value={stop.name} placeholder={index === 0 ? 'Starting point' : 'Next stop'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => changeStops(draft.stops.map((item) => item.id === stop.id ? { ...item, name: event.target.value } : item))} /></div>
                      <FieldError id={errorId} message={error} />
                    </div>
                    <div className={classes("row-actions")}>
                      <IconButton label={`Move stop ${index + 1} up`} disabled={index === 0} onClick={() => moveStop(index, -1)}><ArrowUp /></IconButton>
                      <IconButton label={`Move stop ${index + 1} down`} disabled={index === draft.stops.length - 1} onClick={() => moveStop(index, 1)}><ArrowDown /></IconButton>
                      <IconButton label={`Remove stop ${index + 1}`} destructive disabled={draft.stops.length <= 2} onClick={() => removeStop(stop.id, index)}><Trash2 /></IconButton>
                    </div>
                  </li>
                })}
              </ol>
              <button className={classes("secondary-button full-button")} type="button" onClick={addStop}><Plus size={18} /> Add another stop</button>
              {draft.stops.length > 1 && draft.stops.every(({ name }) => name.trim()) && draft.stops[0].name.trim().toLocaleLowerCase() !== draft.stops.at(-1)?.name.trim().toLocaleLowerCase() && <button className={classes("secondary-button full-button")} type="button" onClick={makeRoundTrip}><RotateCcw size={18} /> Make round trip</button>}
              {returnStops.length > 0 && <div className={classes("return-stops")} aria-label="Return to an earlier stop"><span>Going back?</span><div>{returnStops.map((stop) => <button key={stop.id} className={classes("return-stop-button")} type="button" onClick={() => returnToStop(stop)}><RotateCcw size={15} /> Return to {stop.name.trim()}</button>)}</div><p>The known distance is reused when available, and can still be changed.</p></div>}

              <div className={classes("subsection")}>
                <h3>Leg distances</h3>
                <div className={classes("unit-picker")} aria-label="Display units">{([['metric', 'Metric'], ['us', 'US customary'], ['imperial', 'UK imperial']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={unitSystem === value} onClick={() => setUnitSystem(value)}>{label}</button>)}</div>
                <div className={classes("leg-list")}>
                  {draft.legs.map((leg, index) => {
                    const error = errors[`legs.${index}.distanceKm`]
                    const errorId = `leg-${leg.id}-error`
                    return <div className={classes("leg-row")} key={leg.id}>
                      <div className={classes("leg-name")}><span title={stopsById.get(leg.fromStopId)}>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={16} /><span title={stopsById.get(leg.toStopId)}>{stopsById.get(leg.toStopId)}</span></div>
                      <div><label className={classes("row-label")} htmlFor={`leg-${leg.id}`}>Distance ({units.distance})</label><div className={classes("unit-input")}><input id={`leg-${leg.id}`} aria-label={`Distance from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)} in ${units.distanceLong}`} type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={displayNumber(leg.distanceKm, (value) => distanceFromKm(value, unitSystem))} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onBlur={() => reuseLegDistanceForBlankReverse(leg.id)} onChange={(event) => { const value = numberFromInput(event.target.value); update({ ...draft, legs: draft.legs.map((item) => item.id === leg.id ? { ...item, distanceKm: value === null ? null : distanceToKm(value, unitSystem), distanceSource: 'manual' } : item) }) }} /><span>{units.distance}</span></div>{leg.distanceKm !== null && <span className={classes(`distance-source distance-source-${leg.distanceSource ?? 'manual'}`)} title={leg.distanceSource === 'reused' ? 'Reused from the reverse leg' : undefined}>{leg.distanceSource === 'reused' ? 'Auto-filled' : leg.distanceSource === 'lookup' ? 'Looked up' : 'Manual'}</span>}<button className={classes("lookup-button")} type="button" onClick={() => showMapDialog(leg.id)}><Search /> Look up road distance</button><FieldError id={errorId} message={error} /></div>
                    </div>
                  })}
                </div>
              </div>
              {routeComplete && <button className={classes("done-button")} type="button" onClick={() => closeSection('route', 'fuel')}>Done with route <ArrowRight size={18} /></button>}
              </div></>}
            </section>

            <section className={classes(`panel${openSections.has('fuel') ? '' : ' panel-collapsed'}`)} aria-labelledby="fuel-title">
              {!openSections.has('fuel') ? <button ref={(node) => { if (node) sectionButtonRefs.current.fuel = node }} className={classes("section-toggle")} type="button" aria-expanded="false" aria-controls="fuel-content" onClick={() => openSection('fuel', 'economy')}><span className={classes("step")}>2</span><div><h2 id="fuel-title">Fuel details</h2><p>{displayNumber(draft.fuelSettings.fuelEconomyKmpl, (value) => economyFromKmpl(value, unitSystem))} {units.economy} · {formatCurrency(priceFromPerLitre(draft.fuelSettings.fuelPricePerLitre ?? 0, unitSystem), draft.fuelSettings.currency)}/{units.volume}</p></div><ChevronDown aria-hidden="true" /></button> : <>
              <div className={classes("panel-heading")}><span className={classes("step")}>2</span><div><h2 id="fuel-title">Fuel details</h2><p>Use the average economy for the complete journey.</p></div></div>
              <div id="fuel-content" className={classes("fuel-fields")}>
                <div className={classes("form-field")}><label htmlFor="economy">Fuel economy ({units.economy})</label><div className={classes("unit-input")}><input id="economy" aria-label="Fuel economy" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 15" value={displayNumber(draft.fuelSettings.fuelEconomyKmpl, (value) => economyFromKmpl(value, unitSystem))} aria-invalid={Boolean(errors['fuelSettings.fuelEconomyKmpl'])} aria-describedby="economy-error" onChange={(event) => { const value = numberFromInput(event.target.value); update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelEconomyKmpl: value === null ? null : economyToKmpl(value, unitSystem) } }) }} /><span>{units.economy}</span></div><FieldError id="economy-error" message={errors['fuelSettings.fuelEconomyKmpl']} /></div>
                <div className={classes("form-field")}><label htmlFor="fuel-price">Price per {units.priceVolume}</label><input id="fuel-price" aria-label={unitSystem === 'metric' ? 'Price per litre' : `Price per ${units.priceVolume}`} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 105" value={displayNumber(draft.fuelSettings.fuelPricePerLitre, (value) => priceFromPerLitre(value, unitSystem))} aria-invalid={Boolean(errors['fuelSettings.fuelPricePerLitre'])} aria-describedby="price-error" onChange={(event) => { const value = numberFromInput(event.target.value); update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelPricePerLitre: value === null ? null : priceToPerLitre(value, unitSystem) } }) }} /><FieldError id="price-error" message={errors['fuelSettings.fuelPricePerLitre']} /></div>
                <div className={classes("form-field currency-field")}><label htmlFor="currency">Currency</label><input id="currency" list="currency-options" role="combobox" autoComplete="off" value={draft.fuelSettings.currency} aria-invalid={Boolean(errors['fuelSettings.currency'])} aria-describedby="currency-help currency-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, currency: event.target.value.toUpperCase() } })} /><datalist id="currency-options">{currencies.map(({ code, symbol, name }) => <option key={code} value={code}>{symbol} · {code} · {name}</option>)}</datalist><small id="currency-help">Search by symbol, code, or currency name.</small><FieldError id="currency-error" message={errors['fuelSettings.currency']} /></div>
                <div className={classes("form-field")}><label htmlFor="fuel-type">Fuel type (optional)</label><input id="fuel-type" value={draft.fuelSettings.fuelType ?? ''} placeholder="e.g. Petrol" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelType: event.target.value } })} /></div>
              </div>
              {fuelComplete && <button className={classes("done-button")} type="button" onClick={() => closeSection('fuel', 'people')}>Done with fuel details <ArrowRight size={18} /></button>}
              </>}
            </section>

            <section className={classes(`panel${openSections.has('people') ? '' : ' panel-collapsed'}`)} aria-labelledby="people-title">
              {!openSections.has('people') ? <button ref={(node) => { if (node) sectionButtonRefs.current.people = node }} className={classes("section-toggle")} type="button" aria-expanded="false" aria-controls="people-content" onClick={() => openSection('people', `person-${draft.people[0]?.id}`)}><span className={classes("step")}>3</span><div><h2 id="people-title">Who was riding?</h2><p>{draft.people.length} {draft.people.length === 1 ? 'rider' : 'riders'}</p></div><ChevronDown aria-hidden="true" /></button> : <>
              <div className={classes("panel-heading")}><span className={classes("step")}>3</span><div><h2 id="people-title">Who was riding?</h2><p>Add everyone who should share the fuel cost. <strong>Include the driver if they share the cost.</strong></p></div></div>
              <div id="people-content" className={classes("people-list")}>
                {draft.people.map((person, index) => {
                  const error = errors[`people.${index}.name`]
                  const errorId = `person-${person.id}-error`
                  return <div className={classes("person-row")} key={person.id}><div className={classes("field-grow")}><label className={classes("row-label")} htmlFor={`person-${person.id}`}>Passenger {index + 1}</label><div className={classes("input-with-icon")}><Users size={18} /><input id={`person-${person.id}`} aria-label={`Person ${index + 1} name`} placeholder="Person's name" value={person.name} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => update({ ...draft, people: draft.people.map((item) => item.id === person.id ? { ...item, name: event.target.value } : item) })} /></div><FieldError id={errorId} message={error} /></div><IconButton label={`Remove ${person.name || `person ${index + 1}`}`} destructive onClick={() => removePerson(person.id, person.name, index)}><Trash2 /></IconButton></div>
                })}
              </div>
              <button className={classes("secondary-button full-button")} type="button" onClick={addPerson}><Plus size={18} /> Add person</button>
              {submitted && errors.people && <div className={classes("notice error-notice")} role="alert"><CircleAlert />{errors.people}</div>}
              {peopleComplete && <button className={classes("done-button")} type="button" onClick={() => closeSection('people')}>Done adding riders <Users size={18} /></button>}
              </>}
            </section>
            <section className={classes("panel")} aria-labelledby="expenses-title">
              <div className={classes("panel-heading")}><span className={classes("step")}>4</span><div><h2 id="expenses-title">Additional expenses</h2><p>Add tolls, parking, or other fixed journey costs and choose who shares them.</p></div></div>
              <div className={classes("expense-list")}>
                {(draft.expenses ?? []).map((expense, index) => {
                  const amountError = errors[`expenses.${index}.amount`]
                  const nameError = errors[`expenses.${index}.name`]
                  const assignmentError = errors[`expenses.${index}.personIds`] ?? errors[`expenses.${index}.legId`]
                  return <article className={classes("expense-row")} key={expense.id} aria-label={expense.name || `Expense ${index + 1}`}>
                    <div className={classes("expense-grid")}>
                      <div className={classes("form-field")}><label htmlFor={`expense-name-${expense.id}`}>Expense name</label><input id={`expense-name-${expense.id}`} aria-label={`Expense ${index + 1} name`} placeholder="e.g. Toll or parking" value={expense.name} aria-invalid={Boolean(nameError)} onChange={(event) => changeExpense(expense.id, { name: event.target.value })} /><FieldError id={`expense-name-${expense.id}-error`} message={nameError} /></div>
                      <div className={classes("form-field")}><label htmlFor={`expense-amount-${expense.id}`}>Amount</label><input id={`expense-amount-${expense.id}`} aria-label={`${expense.name || `Expense ${index + 1}`} amount`} type="number" inputMode="decimal" min="0" step="any" value={expense.amount ?? ''} aria-invalid={Boolean(amountError)} onChange={(event) => changeExpense(expense.id, { amount: numberFromInput(event.target.value) })} /><FieldError id={`expense-amount-${expense.id}-error`} message={amountError} /></div>
                      <IconButton label={`Remove ${expense.name || `expense ${index + 1}`}`} destructive onClick={() => update({ ...draft, expenses: (draft.expenses ?? []).filter(({ id }) => id !== expense.id) })}><Trash2 /></IconButton>
                    </div>
                    <div className={classes("expense-scope")} role="radiogroup" aria-label={`${expense.name || `Expense ${index + 1}`} applies to`}>
                      {([['journey', 'Whole journey'], ['leg', 'A particular leg'], ['people', 'Selected riders']] as const).map(([scope, label]) => <label key={scope}><input type="radio" name={`expense-scope-${expense.id}`} checked={expense.scope === scope} onChange={() => changeExpense(expense.id, { scope })} />{label}</label>)}
                    </div>
                    {expense.scope === 'leg' && <div className={classes("form-field")}><label htmlFor={`expense-leg-${expense.id}`}>Journey leg</label><select id={`expense-leg-${expense.id}`} aria-label={`${expense.name || `Expense ${index + 1}`} journey leg`} value={expense.legId ?? ''} aria-invalid={Boolean(assignmentError)} onChange={(event) => changeExpense(expense.id, { legId: event.target.value || undefined })}><option value="">Choose a leg</option>{draft.legs.map((leg) => <option key={leg.id} value={leg.id}>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</option>)}</select></div>}
                    {expense.scope === 'people' && <div><span className={classes("row-label")}>Riders sharing this expense</span><div className={classes("expense-people")}>{draft.people.map((person) => <label key={person.id}><input type="checkbox" aria-label={`${person.name || 'Unnamed person'} shares ${expense.name || `expense ${index + 1}`}`} checked={expense.personIds.includes(person.id)} onChange={(event) => changeExpense(expense.id, { personIds: event.target.checked ? [...new Set([...expense.personIds, person.id])] : expense.personIds.filter((id) => id !== person.id) })} />{person.name || 'Unnamed'}</label>)}</div></div>}
                    <FieldError id={`expense-assignment-${expense.id}-error`} message={assignmentError} />
                  </article>
                })}
              </div>
              <button className={classes("secondary-button full-button")} type="button" onClick={addExpense}><Plus size={18} /> Add expense</button>
            </section>
          </div>

          <aside className={classes("results-column")}>
            <AssignmentPanel draft={draft} mobile={mobileAssignments} stopsById={stopsById} onSetAssignment={setLegAssignment} onSetAllAssignments={setAllLegAssignments} />

            <ResultsPanel draft={draft} result={result} unitSystem={unitSystem} stopsById={stopsById} panelRef={resultsRef} shareStatus={shareStatus} shareError={shareError} shareMessageCopied={shareMessageCopied} onReveal={revealResults} onShare={() => void shareResult()} />
          </aside>
        </div>
      </main>
      {undoRemoval && <div className={classes("undo-toast")} role="status" aria-live="polite"><span>{undoRemoval.message}</span><button type="button" onClick={undoLastRemoval}>Undo</button></div>}
      {resetDialogOpen && <div className={classes("dialog-backdrop")} onMouseDown={(event) => { if (event.target === event.currentTarget) closeResetDialog() }}><div className={classes("reset-dialog")} role="alertdialog" aria-modal="true" aria-labelledby="reset-dialog-title" aria-describedby="reset-dialog-description" onKeyDown={(event) => { if (event.key === 'Escape') closeResetDialog() }}><h2 id="reset-dialog-title">Reset the complete trip?</h2><p id="reset-dialog-description">This deletes all stops, people, distances, assignments, and fuel settings from this device.</p><div className={classes("dialog-actions")}><button ref={cancelResetRef} className={classes("dialog-cancel")} type="button" onClick={closeResetDialog}>Cancel</button><button className={classes("dialog-confirm")} type="button" onClick={resetTrip}>Reset trip</button></div></div></div>}
      {tripDialog && <div className={classes("dialog-backdrop")}><div className={classes("reset-dialog")} role="dialog" aria-modal="true" aria-labelledby="trip-dialog-title" onKeyDown={(event) => { if (event.key === 'Escape') setTripDialog(null) }}><h2 id="trip-dialog-title">{tripDialog.action === 'create' ? 'Create a new trip' : tripDialog.action === 'rename' ? `Rename ${tripDialog.trip?.name}` : `Delete ${tripDialog.trip?.name}?`}</h2>{tripDialog.action === 'delete' ? <p>The trip will move to Recently deleted, where you can restore it later.</p> : <div className={classes("dialog-input")}><label htmlFor="trip-name">Trip name</label><input id="trip-name" autoFocus value={tripName} onChange={(event) => setTripName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitTripDialog() }} />{tripDialog.action === 'create' && <><label htmlFor="route-template">Frequently used route (optional)</label><select id="route-template" value={newTripTemplateId} onChange={(event) => setNewTripTemplateId(event.target.value)}><option value="">Start with a blank route</option>{trips.filter(({ kind, deletedAt }) => kind === 'template' && !deletedAt).map((template) => <option key={template.id} value={template.id}>{template.name} · {routeSummary(template.draft)}</option>)}</select><small>The selected route is copied into a new trip; your current trip stays unchanged.</small></>}</div>}<div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" onClick={() => setTripDialog(null)}>Cancel</button><button className={classes(tripDialog.action === 'delete' ? 'dialog-confirm' : 'done-button')} type="button" onClick={() => void submitTripDialog()}>{tripDialog.action === 'create' ? 'Create trip' : tripDialog.action === 'rename' ? 'Save name' : 'Move to Recently deleted'}</button></div></div></div>}
      {vehicleDialog && <div className={classes("dialog-backdrop")}><div className={classes("reset-dialog")} role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title"><h2 id="vehicle-dialog-title">{vehicleDialog.action === 'create' ? 'Save vehicle preset' : vehicleDialog.action === 'edit' ? `Edit ${vehicleDialog.preset?.name}` : `Delete ${vehicleDialog.preset?.name}?`}</h2>{vehicleDialog.action === 'delete' ? <p>This removes the local preset. Existing trips are not changed.</p> : <div className={classes("dialog-input")}><label htmlFor="vehicle-name">Preset name</label><input id="vehicle-name" autoFocus value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} /><label htmlFor="vehicle-units">Preferred units</label><select id="vehicle-units" value={vehicleUnits} onChange={(event) => { const next = event.target.value as UnitSystem; const current = Number(vehicleEconomy); setVehicleEconomy(Number.isFinite(current) && current > 0 ? String(economyFromKmpl(economyToKmpl(current, vehicleUnits), next)) : ''); setVehicleUnits(next) }}><option value="metric">Metric</option><option value="us">US customary</option><option value="imperial">UK imperial</option></select><label htmlFor="vehicle-economy">Fuel economy ({unitLabels(vehicleUnits).economy})</label><input id="vehicle-economy" type="number" min="0" step="any" value={vehicleEconomy} onChange={(event) => setVehicleEconomy(event.target.value)} /><label htmlFor="vehicle-fuel-type">Fuel type (optional)</label><input id="vehicle-fuel-type" value={vehicleFuelType} placeholder="e.g. Petrol" onChange={(event) => setVehicleFuelType(event.target.value)} /></div>}<div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" onClick={() => setVehicleDialog(null)}>Cancel</button><button className={classes(vehicleDialog.action === 'delete' ? 'dialog-confirm' : 'done-button')} type="button" onClick={submitVehicleDialog}>{vehicleDialog.action === 'delete' ? 'Delete preset' : 'Save preset'}</button></div></div></div>}
      {mapDialog && <div className={classes("dialog-backdrop")}><div className={classes("map-dialog")} role="dialog" aria-modal="true" aria-labelledby="map-dialog-title" onKeyDown={(event) => { if (event.key === 'Escape' && mapStatus === 'idle') setMapDialog(null) }}><h2 id="map-dialog-title">Look up road distance</h2><p>No request is made until you select an action below. Manual distance entry and your saved trip continue to work offline.</p><div className={classes("map-search-grid")}><div><label htmlFor="from-place">Origin</label><input id="from-place" value={mapDialog.fromQuery} onChange={(event) => setMapDialog({ ...mapDialog, fromQuery: event.target.value })} />{fromSuggestions.length > 0 && <div className={classes("suggestion-list")} role="radiogroup" aria-label="Origin suggestions">{fromSuggestions.map((place) => <label key={place.id}><input type="radio" name="from-place" checked={selectedFrom === place.id} onChange={() => setSelectedFrom(place.id)} /><span>{place.label}</span></label>)}</div>}</div><div><label htmlFor="to-place">Destination</label><input id="to-place" value={mapDialog.toQuery} onChange={(event) => setMapDialog({ ...mapDialog, toQuery: event.target.value })} />{toSuggestions.length > 0 && <div className={classes("suggestion-list")} role="radiogroup" aria-label="Destination suggestions">{toSuggestions.map((place) => <label key={place.id}><input type="radio" name="to-place" checked={selectedTo === place.id} onChange={() => setSelectedTo(place.id)} /><span>{place.label}</span></label>)}</div>}</div></div>{mapError && <p className={classes("error-notice notice")} role="alert">{mapError}</p>}<div className={classes("map-attribution")}>Place searches are sent to <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">Nominatim</a>; selected coordinates are sent to the <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM demo server</a>. Results use © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Provider services may receive your IP address and search text. Do not enter private addresses unless you accept this.</div><div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" disabled={mapStatus !== 'idle'} onClick={() => setMapDialog(null)}>Cancel</button><button className={classes("dialog-cancel")} type="button" disabled={mapStatus !== 'idle'} onClick={() => void findPlaces()}>{mapStatus === 'searching' ? 'Searching…' : 'Find places'}</button><button className={classes("done-button")} type="button" disabled={!selectedFrom || !selectedTo || mapStatus !== 'idle'} onClick={() => void applyRoadDistance()}>{mapStatus === 'routing' ? 'Finding route…' : 'Use road distance'}</button></div></div></div>}
      {importPreview && <div className={classes("dialog-backdrop")}><div className={classes("reset-dialog")} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title"><h2 id="import-dialog-title">Preview imported trip</h2><p>Review this trip before saving it on this device. Nothing local has changed yet.</p><div className={classes("import-preview")}><dl><dt>Name</dt><dd>{importPreview.name}</dd><dt>Route</dt><dd>{routeSummary(importPreview.draft)}</dd><dt>Stops</dt><dd>{importPreview.draft.stops.length}</dd><dt>Riders</dt><dd>{importPreview.draft.people.length}</dd><dt>Units</dt><dd>{importPreview.unitSystem === 'metric' ? 'Metric' : importPreview.unitSystem === 'us' ? 'US customary' : 'UK imperial'}</dd></dl></div><div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" onClick={() => setImportPreview(null)}>Cancel</button><button className={classes("dialog-cancel")} type="button" onClick={() => void confirmImport('add')}>Add as new trip</button><button className={classes("dialog-confirm")} type="button" onClick={() => void confirmImport('replace')}>Replace current trip</button></div></div></div>}
      {result && !resultsVisible && <a className={classes("mobile-result-action")} href="#results">View split · {formatCurrency(result.totalCost, draft.fuelSettings.currency)} <ArrowRight size={18} /></a>}
      <footer>Made for fair journeys.</footer>
    </div>
  )
}
