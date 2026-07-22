import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CircleAlert, Fuel, Save, X } from 'lucide-react'
import { calculateTrip, createBlankTripDraft, editableTripDraftSchema, formatCurrency, defaultUnitSystem, economyFromKmpl, economyToKmpl, unitLabels, type TripDraft, type UnitSystem } from '../domain'
import { currencyOptions } from '../currencies'
import { createSummaryImage, shareSummary } from '../shareSummary'
import { usePersistedTrip } from './hooks/usePersistedTrip'
import { useTheme } from './theme/themeContext'
import { useTripEditor } from './hooks/useTripEditor'
import { saveStoredTrip, type StoredTrip } from '../persistence/tripStorage'
import { loadVehiclePresets, saveVehiclePresets, type VehiclePreset } from '../persistence/vehiclePresetStorage'
import { createEditableTripLink, deserializeEditableTrip, EditableTripImportError, readEditableTripLink, serializeEditableTrip } from '../tripSharing'
import { cloneDraft, recordId, routeSummary, validationErrors } from './utils/tripDraftUtils'
import { classes } from './styles'
import { useRouteLookup } from './hooks/useRouteLookup'
import { useElementVisibility } from './hooks/useElementVisibility'
import { useMediaQuery } from './hooks/useMediaQuery'
import { AppHeader } from './components/layout/AppHeader'
import { Hero } from './components/layout/Hero'
import { TripLibrary } from './components/library/TripLibrary'
import { AssignmentPanel } from './components/results/AssignmentPanel'
import { persistenceMessage as getPersistenceMessage, tripProgress, uniqueReturnStops, type EditorSection } from './utils/appViewUtils'
import { ResultsPanel } from './components/results/ResultsPanel'
import { RoutePanel } from './components/editor/RoutePanel'
import { FuelPanel } from './components/editor/FuelPanel'
import { PeoplePanel } from './components/editor/PeoplePanel'
import { ExpensesPanel } from './components/editor/ExpensesPanel'
import { MOBILE_ASSIGNMENTS_QUERY, OPEN_EDITOR_SECTIONS, PUBLIC_SITE_URL } from './constants'
import type { ImportPreview, ShareStatus, TripDialog, VehicleDialog } from './types'
import { useUndoRemoval } from './hooks/useUndoRemoval'
import { useModalFocus } from './hooks/useModalFocus'
import { WorkflowNavigator } from './components/layout/WorkflowNavigator'

export function AppPage() {
  const { themePreference, cycleTheme } = useTheme()
  const [submitted, setSubmitted] = useState(false)
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
  const [shareError, setShareError] = useState('')
  const [shareMessageCopied, setShareMessageCopied] = useState(false)
  const mobileAssignments = useMediaQuery(MOBILE_ASSIGNMENTS_QUERY)
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => defaultUnitSystem())
  const [openSections, setOpenSections] = useState<Set<EditorSection>>(() => new Set(OPEN_EDITOR_SECTIONS))
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
  const [compactHeroOverride, setCompactHeroOverride] = useState(false)
  const closeRestoredSections = useCallback(() => setOpenSections(new Set()), [])
  const { draft, setDraft, trips, setTrips, activeTripId, selectTrip, hydrated, restoredWithProgress, persistenceStatus, retryAutosave } = usePersistedTrip(closeRestoredSections)
  const { undoRemoval, clearUndoRemoval, rememberRemoval, undoLastRemoval } = useUndoRemoval(setDraft)
  const resultsRef = useRef<HTMLElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const cancelResetRef = useRef<HTMLButtonElement>(null)
  const sectionButtonRefs = useRef<Partial<Record<EditorSection, HTMLButtonElement>>>({})
  const linkImportChecked = useRef(false)
  const errors = useMemo(() => (submitted ? validationErrors(draft) : {}), [draft, submitted])
  const parsed = useMemo(() => editableTripDraftSchema.safeParse(draft), [draft])
  const result = parsed.success ? calculateTrip(parsed.data) : null
  const { routeComplete, fuelComplete, peopleComplete } = tripProgress(draft)
  const compactHero = restoredWithProgress || compactHeroOverride
  const units = unitLabels(unitSystem)
  const currencies = useMemo(() => currencyOptions(), [])
  const hasResult = result !== null
  const resultsVisible = useElementVisibility(resultsRef, hasResult)
  const { stopsById, update, changeStops, addStop, returnToStop, makeRoundTrip, reuseLegDistanceForBlankReverse, moveStop, addPerson, setLegAssignment, setAllLegAssignments, copyPreviousLegDistance, copyPreviousLegAssignments } = useTripEditor(draft, setDraft)
  const { mapDialog, setMapDialog, fromSuggestions, toSuggestions, selectedFrom, setSelectedFrom, selectedTo, setSelectedTo, mapStatus, mapError, showMapDialog, findPlaces, applyRoadDistance } = useRouteLookup(draft, update, stopsById)
  const overlayOpen = resetDialogOpen || Boolean(tripDialog || vehicleDialog || mapDialog || importPreview)
  const libraryRef = useModalFocus(libraryOpen && mobileAssignments && !overlayOpen, () => setLibraryOpen(false))
  const resetDialogRef = useModalFocus(resetDialogOpen, closeResetDialog)
  const tripDialogRef = useModalFocus(Boolean(tripDialog), () => setTripDialog(null))
  const vehicleDialogRef = useModalFocus(Boolean(vehicleDialog), () => setVehicleDialog(null))
  const mapDialogRef = useModalFocus(Boolean(mapDialog), () => {
    if (mapStatus === 'idle') setMapDialog(null)
  })
  const importDialogRef = useModalFocus(Boolean(importPreview), () => setImportPreview(null))

  useEffect(() => {
    if (!resetDialogOpen) return
    cancelResetRef.current?.focus()
  }, [resetDialogOpen])

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
    clearUndoRemoval()
    setOpenSections(new Set(OPEN_EDITOR_SECTIONS))
    setResetDialogOpen(false)
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Stop 1 name"]')?.focus()))
  }

  function showTripDialog(action: NonNullable<TripDialog>['action'], trip?: StoredTrip) {
    setTripName(action === 'rename' ? (trip?.name ?? '') : action === 'create' ? 'Untitled trip' : '')
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
    update({
      ...draft,
      fuelSettings: {
        ...draft.fuelSettings,
        fuelEconomyKmpl: preset.fuelEconomyKmpl,
        fuelType: preset.fuelType ?? '',
      },
    })
    setUnitSystem(preset.preferredUnits)
    setOpenSections((sections) => new Set(sections).add('fuel'))
    setLibraryMessage(`${preset.name} applied. Review or edit the auto-filled fuel details below.`)
  }

  async function createTripFromDraft(name: string, source: TripDraft, template = false) {
    const nextDraft = template ? cloneDraft(source, true) : source
    const record: StoredTrip = {
      id: recordId(),
      name,
      kind: 'trip',
      draft: nextDraft,
      updatedAt: nextDraft.updatedAt,
    }
    await selectTrip(record)
    if (tripProgress(nextDraft).hasProgress) setCompactHeroOverride(true)
    setOpenSections(new Set(OPEN_EDITOR_SECTIONS))
    setLibraryMessage(template ? `Created ${name} from a template. Add riders and adjust it for this journey.` : `Created ${name}.`)
  }

  async function submitTripDialog() {
    if (!tripDialog) return
    if (tripDialog.action === 'create') {
      const template = trips.find(({ id, kind, deletedAt }) => id === newTripTemplateId && kind === 'template' && !deletedAt)
      await createTripFromDraft(tripName.trim() || 'Untitled trip', template?.draft ?? createBlankTripDraft(), Boolean(template))
    } else if (tripDialog.action === 'rename' && tripDialog.trip) {
      const changed = {
        ...tripDialog.trip,
        name: tripName.trim() || 'Untitled trip',
        updatedAt: new Date().toISOString(),
      }
      await saveStoredTrip(changed)
      setTrips((items) => items.map((item) => (item.id === changed.id ? changed : item)))
      setLibraryMessage(`Renamed trip to ${changed.name}.`)
    } else if (tripDialog.action === 'delete' && tripDialog.trip) {
      const deleted = {
        ...tripDialog.trip,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await saveStoredTrip(deleted)
      setTrips((items) => items.map((item) => (item.id === deleted.id ? deleted : item)))
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
    const template: StoredTrip = {
      id: recordId(),
      name: `${trip.name} template`,
      kind: 'template',
      draft: cloneDraft(trip.draft, true),
      updatedAt: new Date().toISOString(),
    }
    await saveStoredTrip(template)
    setTrips((items) => [template, ...items])
    setLibraryMessage(`${template.name} is ready to reuse.`)
  }

  async function restoreTrip(trip: StoredTrip) {
    const restored = {
      ...trip,
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
    }
    await saveStoredTrip(restored)
    setTrips((items) => items.map((item) => (item.id === restored.id ? restored : item)))
    setLibraryMessage(`${restored.name} restored.`)
  }

  function activeTrip(): StoredTrip {
    return (
      trips.find(({ id }) => id === activeTripId) ?? {
        id: activeTripId,
        name: 'Shared trip',
        kind: 'trip',
        draft,
        updatedAt: draft.updatedAt,
      }
    )
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
    anchor.download = `${
      activeTrip()
        .name.replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'trip'
    }.petrol-share.json`
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
      const changed: StoredTrip = {
        ...current,
        name: importPreview.name,
        draft: importPreview.draft,
        updatedAt: importPreview.draft.updatedAt,
      }
      await selectTrip(changed)
      if (tripProgress(changed.draft).hasProgress) setCompactHeroOverride(true)
      setLibraryMessage(`${importPreview.name} replaced the current trip.`)
    }
    setUnitSystem(importPreview.unitSystem)
    setSubmitted(false)
    setOpenSections(new Set(OPEN_EDITOR_SECTIONS))
    setImportPreview(null)
  }

  async function openLibraryTrip(trip: StoredTrip) {
    if (trip.kind === 'template') await createTripFromDraft(`Trip from ${trip.name}`, trip.draft, true)
    else {
      await selectTrip(trip)
      if (tripProgress(trip.draft).hasProgress) setCompactHeroOverride(true)
      setOpenSections(editableTripDraftSchema.safeParse(trip.draft).success ? new Set() : new Set(OPEN_EDITOR_SECTIONS))
      setLibraryMessage(`Opened ${trip.name}.`)
    }
  }

  function removeStop(stopId: string, index: number) {
    rememberRemoval(draft, `Stop ${index + 1} removed.`)
    changeStops(draft.stops.filter(({ id }) => id !== stopId))
  }

  function removePerson(personId: string, name: string, index: number) {
    rememberRemoval(draft, `${name || `Person ${index + 1}`} removed.`)
    update({
      ...draft,
      people: draft.people.filter(({ id }) => id !== personId),
      expenses: (draft.expenses ?? []).map((expense) => ({
        ...expense,
        personIds: expense.personIds.filter((id) => id !== personId),
      })),
    })
  }

  function copyLegDistance(legId: string) {
    rememberRemoval(draft, 'Previous leg distance copied. You can edit the copy independently.')
    copyPreviousLegDistance(legId)
  }

  function copyLegAssignments(legId: string) {
    rememberRemoval(draft, 'Previous leg rider assignments copied. You can edit the copy independently.')
    copyPreviousLegAssignments(legId)
  }

  function addExpense() {
    update({
      ...draft,
      expenses: [
        ...(draft.expenses ?? []),
        {
          id: recordId(),
          name: '',
          amount: null,
          scope: 'journey',
          personIds: [],
        },
      ],
    })
  }

  function changeExpense(id: string, changes: Partial<NonNullable<TripDraft['expenses']>[number]>) {
    update({
      ...draft,
      expenses: (draft.expenses ?? []).map((expense) => (expense.id === id ? { ...expense, ...changes } : expense)),
    })
  }

  function revealResults() {
    setSubmitted(true)
    if (!parsed.success) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  function openSection(section: EditorSection, firstFieldId: string) {
    setOpenSections((current) => new Set(current).add(section))
    requestAnimationFrame(() => document.getElementById(firstFieldId)?.focus())
  }

  function navigateToSection(section: EditorSection) {
    const complete = {
      route: routeComplete,
      fuel: fuelComplete,
      people: peopleComplete,
    }
    setOpenSections((current) => {
      const next = new Set([...current].filter((item) => !complete[item]))
      next.add(section)
      return next
    })
    const firstFieldId = section === 'route' ? `stop-${draft.stops[0].id}` : section === 'fuel' ? 'economy' : `person-${draft.people[0]?.id}`
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.getElementById(firstFieldId) ?? sectionButtonRefs.current[section]
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    }))
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
      const image = createSummaryImage({
        result,
        currency: draft.fuelSettings.currency,
        unassignedLegNames,
        pageUrl: PUBLIC_SITE_URL,
      })
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
    return (
      <main className={classes('loading-screen')} aria-busy="true">
        <Fuel />
        <p role="status">Loading your trip…</p>
      </main>
    )
  }

  const persistenceMessage = getPersistenceMessage(persistenceStatus)
  const returnStops = uniqueReturnStops(draft)

  return (
    <div className={classes('app-shell')}>
      <AppHeader libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen((open) => !open)} onReset={() => setResetDialogOpen(true)} persistenceStatus={persistenceStatus} resetButtonRef={resetButtonRef} themePreference={themePreference} onCycleTheme={cycleTheme} />

      <main id="top">
        {(persistenceStatus === 'error' || persistenceStatus === 'recovered') && (
          <div className={classes('recovery-notice')} role="alert">
            <CircleAlert /> <span>{persistenceMessage}</span>
            {persistenceStatus === 'error' && (
              <button type="button" onClick={retryAutosave}>
                Try saving again
              </button>
            )}
          </div>
        )}
        {persistenceStatus === 'migrated' && (
          <div className={classes('recovery-notice')} role="status">
            <Save />
            <span>Your previous draft was moved safely into Saved trips.</span>
          </div>
        )}
        {libraryOpen && (
          <div
            ref={libraryRef as React.RefObject<HTMLDivElement>}
            className={classes('library-backdrop')}
            role={mobileAssignments ? 'dialog' : undefined}
            aria-modal={mobileAssignments ? 'true' : undefined}
            aria-labelledby={mobileAssignments ? 'trip-library-title' : undefined}
            onMouseDown={(event) => {
              if (mobileAssignments && event.target === event.currentTarget) setLibraryOpen(false)
            }}
          >
            <TripLibrary activeTripId={activeTripId} importError={importError} message={libraryMessage} trips={trips} vehiclePresets={vehiclePresets} onClose={() => setLibraryOpen(false)} onCopyLink={() => void copyEditableLink()} onDownload={downloadEditableTrip} onImport={(event) => void chooseImportFile(event)} onNewTrip={() => showTripDialog('create')} onNewVehicle={() => showVehicleDialog('create')} onUseVehicle={applyVehiclePreset} onEditVehicle={(preset) => showVehicleDialog('edit', preset)} onDeleteVehicle={(preset) => showVehicleDialog('delete', preset)} onOpenTrip={(trip) => void openLibraryTrip(trip)} onDuplicateTrip={(trip) => void duplicateTrip(trip)} onSaveTemplate={(trip) => void saveTemplate(trip)} onRenameTrip={(trip) => showTripDialog('rename', trip)} onDeleteTrip={(trip) => showTripDialog('delete', trip)} onRestoreTrip={(trip) => void restoreTrip(trip)} />
          </div>
        )}
        <Hero compact={compactHero} />
        <WorkflowNavigator
          complete={{
            route: routeComplete,
            fuel: fuelComplete,
            people: peopleComplete,
          }}
          onSelect={navigateToSection}
        />

        <div className={classes('editor-grid')}>
          <div className={classes('editor-column')}>
            <RoutePanel
              draft={draft}
              errors={errors}
              stopsById={stopsById}
              returnStops={returnStops}
              unitSystem={unitSystem}
              units={units}
              open={openSections.has('route')}
              complete={routeComplete}
              buttonRef={(node) => {
                if (node) sectionButtonRefs.current.route = node
              }}
              onOpen={() => openSection('route', `stop-${draft.stops[0].id}`)}
              onDone={() => closeSection('route', 'fuel')}
              onAddStop={addStop}
              onChangeStops={changeStops}
              onMakeRoundTrip={makeRoundTrip}
              onMoveStop={moveStop}
              onRemoveStop={removeStop}
              onReturnToStop={returnToStop}
              onShowMapDialog={showMapDialog}
              onUnitSystemChange={setUnitSystem}
              onUpdate={update}
              onReuseReverseDistance={reuseLegDistanceForBlankReverse}
              onCopyPreviousLeg={copyLegDistance}
            />
            <FuelPanel
              currencies={currencies}
              draft={draft}
              errors={errors}
              open={openSections.has('fuel')}
              complete={fuelComplete}
              unitSystem={unitSystem}
              units={units}
              buttonRef={(node) => {
                if (node) sectionButtonRefs.current.fuel = node
              }}
              onOpen={() => openSection('fuel', 'economy')}
              onDone={() => closeSection('fuel', 'people')}
              onUpdate={update}
            />
            <PeoplePanel
              draft={draft}
              errors={errors}
              open={openSections.has('people')}
              complete={peopleComplete}
              submitted={submitted}
              buttonRef={(node) => {
                if (node) sectionButtonRefs.current.people = node
              }}
              onOpen={() => openSection('people', `person-${draft.people[0]?.id}`)}
              onDone={() => closeSection('people')}
              onAdd={addPerson}
              onRemove={removePerson}
              onUpdate={update}
            />
            <ExpensesPanel draft={draft} errors={errors} stopsById={stopsById} onChange={changeExpense} onAdd={addExpense} onUpdate={update} />
          </div>

          <aside className={classes('results-column')}>
            <AssignmentPanel draft={draft} mobile={mobileAssignments} stopsById={stopsById} onSetAssignment={setLegAssignment} onSetAllAssignments={setAllLegAssignments} onCopyPreviousAssignments={copyLegAssignments} />

            <ResultsPanel draft={draft} result={result} unitSystem={unitSystem} stopsById={stopsById} panelRef={resultsRef} shareStatus={shareStatus} shareError={shareError} shareMessageCopied={shareMessageCopied} onReveal={revealResults} onShare={() => void shareResult()} />
          </aside>
        </div>
      </main>
      <div className={classes('floating-action-stack')}>
        {undoRemoval && (
          <div className={classes('undo-toast')} role="status" aria-live="polite">
            <span>{undoRemoval.message}</span>
            <button type="button" onClick={undoLastRemoval}>
              Undo
            </button>
          </div>
        )}
        {result && !resultsVisible && (
          <a className={classes('mobile-result-action')} href="#results">
            View split · {formatCurrency(result.totalCost, draft.fuelSettings.currency)} <ArrowRight size={18} />
          </a>
        )}
      </div>
      {resetDialogOpen && (
        <div
          ref={resetDialogRef as React.RefObject<HTMLDivElement>}
          className={classes('dialog-backdrop')}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResetDialog()
          }}
        >
          <div
            className={classes('reset-dialog')}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeResetDialog()
            }}
          >
            <h2 id="reset-dialog-title">Reset the complete trip?</h2>
            <p id="reset-dialog-description">This deletes all stops, people, distances, assignments, and fuel settings from this device.</p>
            <div className={classes('dialog-actions')}>
              <button ref={cancelResetRef} className={classes('dialog-cancel')} type="button" onClick={closeResetDialog}>
                Cancel
              </button>
              <button className={classes('dialog-confirm')} type="button" onClick={resetTrip}>
                Reset trip
              </button>
            </div>
          </div>
        </div>
      )}
      {tripDialog && (
        <div ref={tripDialogRef as React.RefObject<HTMLDivElement>} className={classes('dialog-backdrop')}>
          <div
            className={classes('reset-dialog')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-dialog-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setTripDialog(null)
            }}
          >
            <h2 id="trip-dialog-title">{tripDialog.action === 'create' ? 'Create a new trip' : tripDialog.action === 'rename' ? `Rename ${tripDialog.trip?.name}` : `Delete ${tripDialog.trip?.name}?`}</h2>
            {tripDialog.action === 'delete' ? (
              <p>The trip will move to Recently deleted, where you can restore it later.</p>
            ) : (
              <div className={classes('dialog-input')}>
                <label htmlFor="trip-name">Trip name</label>
                <input
                  id="trip-name"
                  autoFocus
                  value={tripName}
                  onChange={(event) => setTripName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitTripDialog()
                  }}
                />
                {tripDialog.action === 'create' && (
                  <>
                    <label htmlFor="route-template">Frequently used route (optional)</label>
                    <select id="route-template" value={newTripTemplateId} onChange={(event) => setNewTripTemplateId(event.target.value)}>
                      <option value="">Start with a blank route</option>
                      {trips
                        .filter(({ kind, deletedAt }) => kind === 'template' && !deletedAt)
                        .map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} · {routeSummary(template.draft)}
                          </option>
                        ))}
                    </select>
                    <small>The selected route is copied into a new trip; your current trip stays unchanged.</small>
                  </>
                )}
              </div>
            )}
            <div className={classes('dialog-actions')}>
              <button className={classes('dialog-cancel')} type="button" onClick={() => setTripDialog(null)}>
                Cancel
              </button>
              <button className={classes(tripDialog.action === 'delete' ? 'dialog-confirm' : 'done-button')} type="button" onClick={() => void submitTripDialog()}>
                {tripDialog.action === 'create' ? 'Create trip' : tripDialog.action === 'rename' ? 'Save name' : 'Move to Recently deleted'}
              </button>
            </div>
          </div>
        </div>
      )}
      {vehicleDialog && (
        <div ref={vehicleDialogRef as React.RefObject<HTMLDivElement>} className={classes('dialog-backdrop')}>
          <div className={classes('reset-dialog')} role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title">
            <h2 id="vehicle-dialog-title">{vehicleDialog.action === 'create' ? 'Save vehicle preset' : vehicleDialog.action === 'edit' ? `Edit ${vehicleDialog.preset?.name}` : `Delete ${vehicleDialog.preset?.name}?`}</h2>
            {vehicleDialog.action === 'delete' ? (
              <p>This removes the local preset. Existing trips are not changed.</p>
            ) : (
              <div className={classes('dialog-input')}>
                <label htmlFor="vehicle-name">Preset name</label>
                <input id="vehicle-name" autoFocus value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} />
                <label htmlFor="vehicle-units">Preferred units</label>
                <select
                  id="vehicle-units"
                  value={vehicleUnits}
                  onChange={(event) => {
                    const next = event.target.value as UnitSystem
                    const current = Number(vehicleEconomy)
                    setVehicleEconomy(Number.isFinite(current) && current > 0 ? String(economyFromKmpl(economyToKmpl(current, vehicleUnits), next)) : '')
                    setVehicleUnits(next)
                  }}
                >
                  <option value="metric">Metric</option>
                  <option value="us">US customary</option>
                  <option value="imperial">UK imperial</option>
                </select>
                <label htmlFor="vehicle-economy">Fuel economy ({unitLabels(vehicleUnits).economy})</label>
                <input id="vehicle-economy" type="number" min="0" step="any" value={vehicleEconomy} onChange={(event) => setVehicleEconomy(event.target.value)} />
                <label htmlFor="vehicle-fuel-type">Fuel type (optional)</label>
                <input id="vehicle-fuel-type" value={vehicleFuelType} placeholder="e.g. Petrol" onChange={(event) => setVehicleFuelType(event.target.value)} />
              </div>
            )}
            <div className={classes('dialog-actions')}>
              <button className={classes('dialog-cancel')} type="button" onClick={() => setVehicleDialog(null)}>
                Cancel
              </button>
              <button className={classes(vehicleDialog.action === 'delete' ? 'dialog-confirm' : 'done-button')} type="button" onClick={submitVehicleDialog}>
                {vehicleDialog.action === 'delete' ? 'Delete preset' : 'Save preset'}
              </button>
            </div>
          </div>
        </div>
      )}
      {mapDialog && (
        <div ref={mapDialogRef as React.RefObject<HTMLDivElement>} className={classes('dialog-backdrop')}>
          <div
            className={classes('map-dialog')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-dialog-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && mapStatus === 'idle') setMapDialog(null)
            }}
          >
            <button className={classes('dialog-close')} type="button" aria-label="Close road distance dialog" disabled={mapStatus !== 'idle'} onClick={() => setMapDialog(null)}>
              <X />
            </button>
            <h2 id="map-dialog-title">Look up road distance</h2>
            <p>No request is made until you select an action below. Manual distance entry and your saved trip continue to work offline.</p>
            <div className={classes('map-search-grid')}>
              <div>
                <label htmlFor="from-place">Origin</label>
                <input
                  id="from-place"
                  value={mapDialog.fromQuery}
                  onChange={(event) =>
                    setMapDialog({
                      ...mapDialog,
                      fromQuery: event.target.value,
                    })
                  }
                />
                {fromSuggestions.length > 0 && (
                  <div className={classes('suggestion-list')} role="radiogroup" aria-label="Origin suggestions">
                    {fromSuggestions.map((place) => (
                      <label key={place.id}>
                        <input type="radio" name="from-place" checked={selectedFrom === place.id} onChange={() => setSelectedFrom(place.id)} />
                        <span>{place.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="to-place">Destination</label>
                <input id="to-place" value={mapDialog.toQuery} onChange={(event) => setMapDialog({ ...mapDialog, toQuery: event.target.value })} />
                {toSuggestions.length > 0 && (
                  <div className={classes('suggestion-list')} role="radiogroup" aria-label="Destination suggestions">
                    {toSuggestions.map((place) => (
                      <label key={place.id}>
                        <input type="radio" name="to-place" checked={selectedTo === place.id} onChange={() => setSelectedTo(place.id)} />
                        <span>{place.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {mapError && (
              <p className={classes('error-notice notice')} role="alert">
                {mapError}
              </p>
            )}
            <div className={classes('map-attribution')}>
              Place searches are sent to{' '}
              <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">
                Nominatim
              </a>
              ; selected coordinates are sent to the{' '}
              <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">
                OSRM demo server
              </a>
              . Results use ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap contributors
              </a>
              . Provider services may receive your IP address and search text. Do not enter private addresses unless you accept this.
            </div>
            <div className={classes('dialog-actions')}>
              <button className={classes('dialog-cancel')} type="button" disabled={mapStatus !== 'idle'} onClick={() => setMapDialog(null)}>
                Cancel
              </button>
              <button className={classes('dialog-cancel')} type="button" disabled={mapStatus !== 'idle'} onClick={() => void findPlaces()}>
                {mapStatus === 'searching' ? 'Searching…' : 'Find places'}
              </button>
              <button className={classes('done-button')} type="button" disabled={!selectedFrom || !selectedTo || mapStatus !== 'idle'} onClick={() => void applyRoadDistance()}>
                {mapStatus === 'routing' ? 'Finding route…' : 'Use road distance'}
              </button>
            </div>
          </div>
        </div>
      )}
      {importPreview && (
        <div ref={importDialogRef as React.RefObject<HTMLDivElement>} className={classes('dialog-backdrop')}>
          <div className={classes('reset-dialog')} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
            <h2 id="import-dialog-title">Preview imported trip</h2>
            <p>Review this trip before saving it on this device. Nothing local has changed yet.</p>
            <div className={classes('import-preview')}>
              <dl>
                <dt>Name</dt>
                <dd>{importPreview.name}</dd>
                <dt>Route</dt>
                <dd>{routeSummary(importPreview.draft)}</dd>
                <dt>Stops</dt>
                <dd>{importPreview.draft.stops.length}</dd>
                <dt>Riders</dt>
                <dd>{importPreview.draft.people.length}</dd>
                <dt>Units</dt>
                <dd>{importPreview.unitSystem === 'metric' ? 'Metric' : importPreview.unitSystem === 'us' ? 'US customary' : 'UK imperial'}</dd>
              </dl>
            </div>
            <div className={classes('dialog-actions')}>
              <button className={classes('dialog-cancel')} type="button" onClick={() => setImportPreview(null)}>
                Cancel
              </button>
              <button className={classes('dialog-cancel')} type="button" onClick={() => void confirmImport('add')}>
                Add as new trip
              </button>
              <button className={classes('dialog-confirm')} type="button" onClick={() => void confirmImport('replace')}>
                Replace current trip
              </button>
            </div>
          </div>
        </div>
      )}
      <footer>Made for fair journeys.</footer>
    </div>
  )
}
