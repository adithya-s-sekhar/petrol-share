import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CarFront,
  CircleAlert,
  Fuel,
  MapPin,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Share2,
  Sun,
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
import { createSummaryImage, shareSummary } from './shareSummary'

type ErrorMap = Record<string, string>
type PersistenceStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'recovered' | 'error'
type ShareStatus = 'idle' | 'sharing' | 'shared' | 'downloaded' | 'error'
type ThemePreference = 'system' | 'light' | 'dark'

const AUTOSAVE_DELAY_MS = 500
const PUBLIC_SITE_URL = 'https://adithya-s-sekhar.github.io/petrol-share/'
const THEME_STORAGE_KEY = 'petrol-share-theme'

const styles: Record<string, string> = {
  'sr-only': 'absolute -m-px size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]',
  'app-shell': 'min-h-screen bg-[radial-gradient(circle_at_50%_0,#e5f4e9_0,transparent_28rem)] bg-[#f5f7f4] text-[#152a25]',
  'site-header': 'sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#dce5df] bg-white/80 px-[max(20px,calc((100vw-1180px)/2))] backdrop-blur-[14px] max-[560px]:h-[60px] max-[560px]:px-[13px]',
  brand: 'flex items-center gap-2.5 text-[19px] tracking-[-.4px] text-[#18362d] no-underline',
  'brand-mark': 'grid size-9 place-items-center rounded-[11px] bg-[#14875d] text-white shadow-[0_5px_14px_rgba(20,135,93,.24)] [&_svg]:w-5',
  'header-actions': 'flex items-center gap-1',
  'theme-button': 'grid size-10 place-items-center rounded-[9px] border-0 bg-transparent text-[#60706a] hover:bg-[#eef2ef] hover:text-[#147a56] [&_svg]:size-[18px]',
  'reset-button': 'inline-flex items-center justify-center gap-2 rounded-[9px] border-0 bg-transparent px-2.5 py-[9px] font-bold text-[#60706a] hover:bg-[#eef2ef] hover:text-[#a13c31] max-[560px]:text-xs',
  'persistence-status': 'mx-auto max-w-[1180px] px-6 pt-[.65rem] text-right text-[.85rem] text-[#5d6c62]',
  'persistence-recovered': 'font-semibold !text-[#9a3412]', 'persistence-error': 'font-semibold !text-[#9a3412]',
  hero: 'px-0 pb-[50px] pt-[68px] text-center max-[560px]:px-2.5 max-[560px]:pb-[34px] max-[560px]:pt-[43px]',
  eyebrow: 'inline-flex items-center gap-[7px] rounded-full border border-[#cce4d6] bg-[#eff9f3] px-3 py-[7px] text-[11px] font-extrabold uppercase tracking-[1.25px] text-[#167451]',
  'editor-grid': 'grid w-full min-w-0 grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)] items-start gap-6 max-[880px]:grid-cols-1',
  'editor-column': 'grid min-w-0 gap-6', 'results-column': 'sticky top-[92px] grid min-w-0 gap-6 max-[880px]:static',
  panel: 'min-w-0 max-w-full rounded-[18px] border border-[#dfe6e1] bg-white/95 p-[25px] shadow-[0_8px_32px_rgba(36,67,56,.055)] max-[560px]:rounded-[15px] max-[560px]:px-[15px] max-[560px]:py-[19px]',
  'panel-heading': 'mb-6 flex items-start gap-3.5 [&_h2]:mb-1 [&_h2]:mt-px [&_h2]:text-[19px] [&_h2]:tracking-[-.35px] [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-[#7a8581] max-[560px]:mb-5',
  compact: '!mb-[18px]', step: 'grid size-[31px] shrink-0 place-items-center rounded-[9px] bg-[#17875e] text-[13px] font-extrabold text-white',
  'stops-list': 'mb-3.5 grid list-none gap-2.5 p-0', 'people-list': 'mb-3.5 grid gap-2.5',
  'stop-row': 'flex items-start gap-[9px] max-[560px]:flex-wrap', 'person-row': 'flex items-start gap-[9px]',
  'stop-index': 'grid h-[42px] w-[25px] shrink-0 place-items-center text-[11px] font-extrabold text-[#8a9692] max-[560px]:w-5',
  'field-grow': 'min-w-0 flex-1', 'input-with-icon': 'relative [&_svg]:pointer-events-none [&_svg]:absolute [&_svg]:left-[11px] [&_svg]:top-3 [&_svg]:text-[#7c8c86] [&_input]:pl-[38px]',
  'row-actions': 'flex gap-[3px] pt-[3px] max-[560px]:-mt-[5px] max-[560px]:ml-[29px]',
  'icon-button': 'grid size-[35px] place-items-center rounded-lg border-0 bg-transparent p-0 text-[#6d7b76] hover:not-disabled:bg-[#edf6f1] hover:not-disabled:text-[#147a56] [&_svg]:w-4',
  'secondary-button': 'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[9px] border border-dashed border-[#94c5ad] bg-[#eef7f2] px-[15px] py-[9px] font-bold text-[#177653] hover:bg-[#e4f3eb]',
  'full-button': 'w-full', 'return-stops': 'mt-[13px] rounded-[10px] bg-[#f8faf8] p-3 [&>span]:mb-2 [&>span]:block [&>span]:text-[13px] [&>span]:font-bold [&>span]:text-[#52615c] [&>div]:flex [&>div]:flex-wrap [&>div]:gap-[7px] [&>p]:mt-2 [&>p]:text-xs [&>p]:text-[#718079]',
  'return-stop-button': 'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#cbded4] bg-white px-[11px] py-[7px] font-bold text-[#176c4d] hover:bg-[#eef7f2]',
  subsection: 'mt-[27px] border-t border-[#e6ebe8] pt-[22px] [&_h3]:mb-[13px] [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-[.85px] [&_h3]:text-[#66746f]',
  'leg-list': 'grid gap-[9px]', 'leg-row': 'grid grid-cols-[minmax(0,1fr)_140px] items-start gap-4 rounded-[10px] bg-[#f6f8f6] px-[13px] py-3 max-[560px]:grid-cols-[1fr_115px] max-[560px]:gap-2 max-[560px]:p-2.5',
  'leg-name': 'flex min-w-0 items-center gap-[7px] pt-2.5 text-[13px] font-bold max-[560px]:text-[11px] [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_svg]:shrink-0 [&_svg]:text-[#8c9995]',
  'unit-input': 'relative [&_input]:pr-12 [&_input]:text-right [&>span]:absolute [&>span]:right-[11px] [&>span]:top-3 [&>span]:text-xs [&>span]:font-bold [&>span]:text-[#76837f]',
  'distance-source': 'mt-[5px] inline-block rounded-full px-[7px] py-0.5 text-[10px] font-extrabold tracking-[.2px]', 'distance-source-reused': 'bg-[#dff2e8] text-[#176c4d]', 'distance-source-manual': 'bg-[#e7ebe9] text-[#596762]',
  'field-error': 'mt-[5px] flex items-center gap-1 text-[11px] text-[#b53b31] [&_svg]:shrink-0',
  'fuel-fields': 'grid grid-cols-[1fr_1fr_100px] gap-3 max-[560px]:grid-cols-2', 'form-field': '[&_label]:mb-[7px] [&_label]:block [&_label]:text-xs [&_label]:font-bold [&_label]:text-[#4e5f59]', 'currency-field': 'max-[560px]:col-span-full',
  'assignment-panel': 'max-[880px]:order-none', 'assignment-scroll': '-mx-2 -mb-[5px] max-w-[calc(100%+1rem)] overflow-x-auto px-2 pb-[5px]', 'empty-state': 'rounded-[11px] border border-dashed border-[#d5deda] bg-[#fafbfa] px-[18px] py-[30px] text-center text-[#88938f] [&_svg]:mx-auto [&_svg]:w-7 [&_p]:mb-0 [&_p]:mt-[5px] [&_p]:text-[13px]',
  'results-card': 'min-w-0 max-w-full overflow-hidden rounded-[19px] bg-[#173f34] text-white shadow-[0_16px_40px_rgba(18,59,47,.18)]',
  'results-heading': 'flex items-center justify-between border-b border-white/10 px-[25px] pb-5 pt-6 max-[560px]:px-5 [&_h2]:mb-0 [&_h2]:mt-1 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-medium [&>svg]:w-7 [&>svg]:text-[#6ec59e]', 'results-kicker': 'text-[10px] font-extrabold uppercase tracking-[1.3px] text-[#83d0ad]',
  'results-empty': 'px-[25px] pb-[25px] pt-[31px] text-center [&_p]:text-[13px] [&_p]:leading-[1.6] [&_p]:text-[#b8cbc4]', 'primary-button': 'mt-2 inline-flex min-h-[45px] w-full items-center justify-center gap-2 rounded-[10px] border-0 bg-[#80d6ac] px-[18px] py-2.5 font-bold text-[#163b30] hover:bg-[#96e2bc]',
  totals: 'grid grid-cols-2 gap-5 px-[25px] py-[22px] max-[560px]:px-5 [&>div]:grid [&>div]:gap-1 [&_span]:text-[11px] [&_span]:text-[#a9c1b8] [&_strong]:text-[17px]', 'total-cost': 'col-span-full border-t border-white/10 pt-4 [&_strong]:font-serif [&_strong]:!text-[32px] [&_strong]:font-medium [&_strong]:text-[#88dfb5]',
  notice: 'mx-[25px] mb-6 flex items-start gap-2.5 rounded-[9px] p-[13px] text-xs leading-6 [&>svg]:w-[18px] [&>svg]:shrink-0', 'warning-notice': 'border border-[#ffcf7040] bg-[#ebab3321] text-[#ffe4a3] [&_strong]:text-[#fff0c8] [&_ul]:mb-0 [&_ul]:mt-[5px] [&_ul]:pl-[17px]', 'error-notice': '!mx-0 !mb-0 mt-3 border border-[#f1c8c3] bg-[#fff0ee] text-[#a5362d]',
  'split-list': 'border-t border-white/10', 'split-row': 'grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-white/10 px-[25px] py-[15px] max-[560px]:px-5 [&>div:nth-child(2)]:grid [&>div:nth-child(2)]:gap-0.5 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_span]:text-[11px] [&_span]:text-[#9fb8af] [&>strong]:text-[#95e2bb]', avatar: 'grid size-[34px] place-items-center rounded-full bg-[#86d9b1] font-extrabold text-[#173f34]',
  'share-area': 'border-t border-white/10 px-[25px] py-5 max-[560px]:px-5',
  'share-button': 'inline-flex min-h-[45px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#9be5c1]/40 bg-[#80d6ac] px-[18px] py-2.5 font-extrabold text-[#163b30] hover:not-disabled:bg-[#96e2bc]',
  'share-status': 'mb-0 mt-2.5 text-center text-xs text-[#b8cbc4]', 'share-error': '!text-[#ffe4a3]',
  'loading-screen': 'grid min-h-screen place-content-center justify-items-center gap-3 text-[#47604f] [&_svg]:size-8',
}

function classes(names: string): string {
  return names.split(/\s+/).flatMap((name) => [name, styles[name] ?? '']).filter(Boolean).join(' ')
}

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
  return <p className={classes("field-error")} id={id} role="alert"><CircleAlert size={14} />{message}</p>
}

function IconButton({ label, disabled, onClick, children }: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return <button className={classes("icon-button")} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>
}

function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  })
  const [draft, setDraft] = useState<TripDraft>(() => createBlankTripDraft())
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading')
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
  const [shareError, setShareError] = useState('')
  const [shareMessageCopied, setShareMessageCopied] = useState(false)
  const hydratedDraftRef = useRef<string | null>(null)
  const saveSequenceRef = useRef(0)
  const errors = useMemo(() => submitted ? validationErrors(draft) : {}, [draft, submitted])
  const parsed = useMemo(() => editableTripDraftSchema.safeParse(draft), [draft])
  const result = parsed.success ? calculateTrip(parsed.data) : null
  const stopsById = new Map(draft.stops.map((stop) => [stop.id, stop.name || 'Unnamed stop']))

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolvedTheme = themePreference === 'system' ? (media?.matches ? 'dark' : 'light') : themePreference
      document.documentElement.dataset.theme = resolvedTheme
      document.documentElement.style.colorScheme = resolvedTheme
    }
    applyTheme()
    if (themePreference === 'system') media?.addEventListener('change', applyTheme)
    return () => media?.removeEventListener('change', applyTheme)
  }, [themePreference])

  function cycleTheme() {
    const nextPreference = themePreference === 'system' ? 'light' : themePreference === 'light' ? 'dark' : 'system'
    setThemePreference(nextPreference)
    if (nextPreference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
  }

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

  function returnToStop(stop: TripDraft['stops'][number]) {
    changeStops([...draft.stops, { id: createId(), name: stop.name.trim() }])
  }

  function reuseLegDistanceForBlankReverse(legId: string) {
    const changedLeg = draft.legs.find((leg) => leg.id === legId)
    if (!changedLeg) return
    const fromName = stopsById.get(changedLeg.fromStopId)?.trim().toLocaleLowerCase()
    const toName = stopsById.get(changedLeg.toStopId)?.trim().toLocaleLowerCase()

    update({
      ...draft,
      legs: draft.legs.map((leg) => {
        const isBlankReverse = leg.distanceKm === null
          && stopsById.get(leg.fromStopId)?.trim().toLocaleLowerCase() === toName
          && stopsById.get(leg.toStopId)?.trim().toLocaleLowerCase() === fromName
        return isBlankReverse ? { ...leg, distanceKm: changedLeg.distanceKm, distanceSource: 'reused' } : leg
      }),
    })
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

  const persistenceMessage = {
    loading: 'Loading your trip…',
    idle: 'Autosave ready',
    saving: 'Saving…',
    saved: 'Saved',
    recovered: 'Saved trip could not be restored. A new trip was started safely.',
    error: 'Could not save changes. Keep this page open and try another edit.',
  }[persistenceStatus]
  const currentStop = draft.stops.at(-1)
  const returnStops = draft.stops.filter((stop, index, stops) => {
    const name = stop.name.trim().toLocaleLowerCase()
    return name !== ''
      && name !== currentStop?.name.trim().toLocaleLowerCase()
      && stops.findIndex((candidate) => candidate.name.trim().toLocaleLowerCase() === name) === index
  })

  return (
    <div className={classes("app-shell")}>
      <header className={classes("site-header")}>
        <a className={classes("brand")} href="#top" aria-label="Petrol Share home"><span className={classes("brand-mark")}><Fuel /></span><span>Petrol <strong>Share</strong></span></a>
        <div className={classes("header-actions")}>
          <button className={classes("theme-button")} type="button" onClick={cycleTheme} aria-label={`Theme: ${themePreference}. Switch theme`} title={`Theme: ${themePreference}`}>
            {themePreference === 'system' ? <Monitor /> : themePreference === 'light' ? <Sun /> : <Moon />}
          </button>
          <button className={classes("reset-button")} type="button" onClick={resetTrip}><RotateCcw size={17} /> Reset trip</button>
        </div>
      </header>

      <main id="top">
        <div className={classes(`persistence-status persistence-${persistenceStatus}`)} role="status" aria-live="polite">{persistenceMessage}</div>
        <section className={classes("hero")} aria-labelledby="page-title">
          <div className={classes("eyebrow")}><CarFront size={16} /> Fair fuel costs, leg by leg</div>
          <h1 id="page-title">Plan the route.<br /><span>Split the ride.</span></h1>
          <p>Build your journey, choose who rode each leg, and get a fair fuel split in seconds.</p>
        </section>

        <div className={classes("editor-grid")}>
          <div className={classes("editor-column")}>
            <section className={classes("panel")} aria-labelledby="route-title">
              <div className={classes("panel-heading")}><span className={classes("step")}>1</span><div><h2 id="route-title">Build your route</h2><p>Each stop is a distinct visit, even when its name repeats.</p></div></div>
              <ol className={classes("stops-list")}>
                {draft.stops.map((stop, index) => {
                  const errorId = `stop-${stop.id}-error`
                  const error = errors[`stops.${index}.name`]
                  return <li className={classes("stop-row")} key={stop.id}>
                    <span className={classes("stop-index")} aria-hidden="true">{index + 1}</span>
                    <div className={classes("field-grow")}>
                      <label className={classes("sr-only")} htmlFor={`stop-${stop.id}`}>Stop {index + 1} name</label>
                      <div className={classes("input-with-icon")}><MapPin size={18} /><input id={`stop-${stop.id}`} value={stop.name} placeholder={index === 0 ? 'Starting point' : 'Next stop'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => changeStops(draft.stops.map((item) => item.id === stop.id ? { ...item, name: event.target.value } : item))} /></div>
                      <FieldError id={errorId} message={error} />
                    </div>
                    <div className={classes("row-actions")}>
                      <IconButton label={`Move stop ${index + 1} up`} disabled={index === 0} onClick={() => moveStop(index, -1)}><ArrowUp /></IconButton>
                      <IconButton label={`Move stop ${index + 1} down`} disabled={index === draft.stops.length - 1} onClick={() => moveStop(index, 1)}><ArrowDown /></IconButton>
                      <IconButton label={`Remove stop ${index + 1}`} disabled={draft.stops.length <= 2} onClick={() => changeStops(draft.stops.filter(({ id }) => id !== stop.id))}><Trash2 /></IconButton>
                    </div>
                  </li>
                })}
              </ol>
              <button className={classes("secondary-button full-button")} type="button" onClick={addStop}><Plus size={18} /> Add another stop</button>
              {returnStops.length > 0 && <div className={classes("return-stops")} aria-label="Return to an earlier stop"><span>Going back?</span><div>{returnStops.map((stop) => <button key={stop.id} className={classes("return-stop-button")} type="button" onClick={() => returnToStop(stop)}><RotateCcw size={15} /> Return to {stop.name.trim()}</button>)}</div><p>The known distance is reused when available, and can still be changed.</p></div>}

              <div className={classes("subsection")}>
                <h3>Leg distances</h3>
                <div className={classes("leg-list")}>
                  {draft.legs.map((leg, index) => {
                    const error = errors[`legs.${index}.distanceKm`]
                    const errorId = `leg-${leg.id}-error`
                    return <div className={classes("leg-row")} key={leg.id}>
                      <div className={classes("leg-name")}><span>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={16} /><span>{stopsById.get(leg.toStopId)}</span></div>
                      <div><label className={classes("sr-only")} htmlFor={`leg-${leg.id}`}>Distance from {stopsById.get(leg.fromStopId)} to {stopsById.get(leg.toStopId)} in kilometres</label><div className={classes("unit-input")}><input id={`leg-${leg.id}`} type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={leg.distanceKm ?? ''} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onBlur={() => reuseLegDistanceForBlankReverse(leg.id)} onChange={(event) => update({ ...draft, legs: draft.legs.map((item) => item.id === leg.id ? { ...item, distanceKm: numberFromInput(event.target.value), distanceSource: 'manual' } : item) })} /><span>km</span></div>{leg.distanceKm !== null && <span className={classes(`distance-source distance-source-${leg.distanceSource === 'reused' ? 'reused' : 'manual'}`)}>{leg.distanceSource === 'reused' ? 'Auto-filled' : 'Manual'}</span>}<FieldError id={errorId} message={error} /></div>
                    </div>
                  })}
                </div>
              </div>
            </section>

            <section className={classes("panel")} aria-labelledby="fuel-title">
              <div className={classes("panel-heading")}><span className={classes("step")}>2</span><div><h2 id="fuel-title">Fuel details</h2><p>Use the average economy for the complete journey.</p></div></div>
              <div className={classes("fuel-fields")}>
                <div className={classes("form-field")}><label htmlFor="economy">Fuel economy</label><div className={classes("unit-input")}><input id="economy" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 15" value={draft.fuelSettings.fuelEconomyKmpl ?? ''} aria-invalid={Boolean(errors['fuelSettings.fuelEconomyKmpl'])} aria-describedby="economy-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelEconomyKmpl: numberFromInput(event.target.value) } })} /><span>km/L</span></div><FieldError id="economy-error" message={errors['fuelSettings.fuelEconomyKmpl']} /></div>
                <div className={classes("form-field")}><label htmlFor="fuel-price">Price per litre</label><input id="fuel-price" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 105" value={draft.fuelSettings.fuelPricePerLitre ?? ''} aria-invalid={Boolean(errors['fuelSettings.fuelPricePerLitre'])} aria-describedby="price-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, fuelPricePerLitre: numberFromInput(event.target.value) } })} /><FieldError id="price-error" message={errors['fuelSettings.fuelPricePerLitre']} /></div>
                <div className={classes("form-field currency-field")}><label htmlFor="currency">Currency</label><input id="currency" maxLength={3} autoCapitalize="characters" value={draft.fuelSettings.currency} aria-invalid={Boolean(errors['fuelSettings.currency'])} aria-describedby="currency-error" onChange={(event) => update({ ...draft, fuelSettings: { ...draft.fuelSettings, currency: event.target.value.toUpperCase() } })} /><FieldError id="currency-error" message={errors['fuelSettings.currency']} /></div>
              </div>
            </section>

            <section className={classes("panel")} aria-labelledby="people-title">
              <div className={classes("panel-heading")}><span className={classes("step")}>3</span><div><h2 id="people-title">Who was riding?</h2><p>Add everyone who should share the fuel cost.</p></div></div>
              <div className={classes("people-list")}>
                {draft.people.map((person, index) => {
                  const error = errors[`people.${index}.name`]
                  const errorId = `person-${person.id}-error`
                  return <div className={classes("person-row")} key={person.id}><div className={classes("field-grow")}><label className={classes("sr-only")} htmlFor={`person-${person.id}`}>Person {index + 1} name</label><div className={classes("input-with-icon")}><Users size={18} /><input id={`person-${person.id}`} placeholder="Person's name" value={person.name} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => update({ ...draft, people: draft.people.map((item) => item.id === person.id ? { ...item, name: event.target.value } : item) })} /></div><FieldError id={errorId} message={error} /></div><IconButton label={`Remove ${person.name || `person ${index + 1}`}`} onClick={() => update({ ...draft, people: draft.people.filter(({ id }) => id !== person.id) })}><Trash2 /></IconButton></div>
                })}
              </div>
              <button className={classes("secondary-button full-button")} type="button" onClick={addPerson}><Plus size={18} /> Add person</button>
              {submitted && errors.people && <div className={classes("notice error-notice")} role="alert"><CircleAlert />{errors.people}</div>}
            </section>
          </div>

          <aside className={classes("results-column")}>
            <section className={classes("panel assignment-panel")} aria-labelledby="assignment-title">
              <div className={classes("panel-heading compact")}><span className={classes("step")}>4</span><div><h2 id="assignment-title">Assign each leg</h2><p>Check who travelled on each part.</p></div></div>
              {draft.people.length === 0 ? <div className={classes("empty-state")}><Users /><p>Add people to start assigning riders.</p></div> : <div className={classes("assignment-scroll")}><table><thead><tr><th scope="col">Passenger</th>{draft.legs.map((leg) => <th scope="col" key={leg.id}><span>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={13} /><span>{stopsById.get(leg.toStopId)}</span></th>)}</tr></thead><tbody>{draft.people.map((person) => <tr key={person.id}><th scope="row">{person.name || 'Unnamed'}</th>{draft.legs.map((leg) => <td key={leg.id}><input type="checkbox" aria-label={`${person.name || 'Unnamed person'} rode from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)}`} checked={person.assignedLegIds.includes(leg.id)} onChange={(event) => update({ ...draft, people: draft.people.map((item) => item.id !== person.id ? item : { ...item, assignedLegIds: event.target.checked ? [...item.assignedLegIds, leg.id] : item.assignedLegIds.filter((id) => id !== leg.id) }) })} /></td>)}</tr>)}</tbody></table></div>}
            </section>

            <section className={classes("results-card")} aria-labelledby="results-title" aria-live="polite">
              <div className={classes("results-heading")}><div><span className={classes("results-kicker")}>Your split</span><h2 id="results-title">Journey summary</h2></div><Fuel /></div>
              {!result ? <div className={classes("results-empty")}><p>Complete the trip details to see your fair split.</p><button className={classes("primary-button")} type="button" onClick={revealResults}>Calculate split <ArrowRight size={18} /></button></div> : <>
                <div className={classes("totals")}><div><span>Total distance</span><strong>{result.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km</strong></div><div><span>Fuel used</span><strong>{result.totalLitres.toLocaleString(undefined, { maximumFractionDigits: 2 })} L</strong></div><div className={classes("total-cost")}><span>Total fuel cost</span><strong>{formatCurrency(result.totalCost, draft.fuelSettings.currency)}</strong></div></div>
                {result.unassignedLegIds.length > 0 ? <div className={classes("notice warning-notice")} role="status"><CircleAlert /><div><strong>Some legs have no riders</strong><ul>{result.unassignedLegIds.map((id) => { const leg = draft.legs.find((item) => item.id === id)!; return <li key={id}>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</li> })}</ul></div></div> : <div className={classes("split-list")}>{result.people.map((person) => <div className={classes("split-row")} key={person.personId}><div className={classes("avatar")} aria-hidden="true">{person.personName.charAt(0).toUpperCase()}</div><div><strong>{person.personName}</strong><span>{person.distanceKm.toLocaleString()} km · {person.legIds.length} {person.legIds.length === 1 ? 'leg' : 'legs'}</span></div><strong>{formatCurrency(person.displayCost, draft.fuelSettings.currency)}</strong></div>)}</div>}
                <div className={classes("share-area")}><button className={classes("share-button")} type="button" disabled={shareStatus === 'sharing'} onClick={() => void shareResult()}><Share2 size={18} />{shareStatus === 'sharing' ? 'Preparing summary…' : 'Share summary'}</button>{shareStatus === 'shared' && <p className={classes("share-status")} role="status">Summary shared.</p>}{shareStatus === 'downloaded' && <p className={classes("share-status")} role="status">Summary image downloaded.{shareMessageCopied ? ' Message copied to clipboard.' : ''}</p>}{shareStatus === 'error' && <p className={classes("share-status share-error")} role="alert">{shareError}</p>}</div>
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
