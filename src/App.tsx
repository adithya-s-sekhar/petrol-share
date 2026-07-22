import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CarFront,
  CircleAlert,
  ChevronDown,
  Copy,
  Download,
  FolderOpen,
  Fuel,
  MapPin,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Sun,
  Trash2,
  Upload,
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
  volumeFromLitres,
  type TripDraft,
  type UnitSystem,
} from './domain'
import { currencyOptions } from './currencies'
import { createSummaryImage, shareSummary } from './shareSummary'
import { usePersistedTrip } from './app/usePersistedTrip'
import { useThemePreference } from './app/useThemePreference'
import { useTripEditor } from './app/useTripEditor'
import { saveStoredTrip, type StoredTrip } from './persistence/tripStorage'
import { loadVehiclePresets, saveVehiclePresets, type VehiclePreset } from './persistence/vehiclePresetStorage'
import { createEditableTripLink, deserializeEditableTrip, EditableTripImportError, readEditableTripLink, serializeEditableTrip, type EditableTripImport } from './tripSharing'

type ErrorMap = Record<string, string>
type ShareStatus = 'idle' | 'sharing' | 'shared' | 'downloaded' | 'error'
type EditorSection = 'route' | 'fuel' | 'people'
type UndoRemoval = { draft: TripDraft; message: string }
type TripDialog = { action: 'create' | 'rename' | 'delete'; trip?: StoredTrip } | null
type ImportPreview = EditableTripImport & { source: 'link' | 'file' }
type VehicleDialog = { action: 'create' | 'edit' | 'delete'; preset?: VehiclePreset } | null

const PUBLIC_SITE_URL = 'https://adithya-s-sekhar.github.io/petrol-share/'

const styles: Record<string, string> = {
  'sr-only': 'absolute -m-px size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]',
  'app-shell': 'min-h-screen bg-[radial-gradient(circle_at_50%_0,#e5f4e9_0,transparent_28rem)] bg-[#f5f7f4] text-[#152a25]',
  'site-header': 'sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#dce5df] bg-white/80 px-[max(20px,calc((100vw-1180px)/2))] backdrop-blur-[14px] max-[560px]:h-[60px] max-[560px]:px-[13px]',
  brand: 'flex min-h-11 items-center gap-2.5 text-[19px] tracking-[-.4px] text-[#18362d] no-underline',
  'brand-mark': 'grid size-9 place-items-center rounded-[11px] bg-[#14875d] text-white shadow-[0_5px_14px_rgba(20,135,93,.24)] [&_svg]:w-5',
  'header-actions': 'flex items-center gap-1',
  'trips-button': 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#c7d8cf] bg-white px-3 text-sm font-extrabold text-[#176c4d] hover:bg-[#edf7f1] max-[560px]:px-2 max-[560px]:text-xs [&_svg]:size-4',
  'header-save-status': 'inline-flex min-w-[78px] items-center justify-end gap-1.5 px-2 text-xs font-bold text-[#5d6c62] max-[560px]:min-w-0 max-[560px]:px-1 [&_svg]:size-3.5',
  'theme-button': 'grid size-11 shrink-0 place-items-center rounded-[9px] border-0 bg-transparent text-[#60706a] hover:bg-[#eef2ef] hover:text-[#147a56] active:bg-[#dfeae4] [&_svg]:size-[18px]',
  'reset-button': 'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[9px] border-0 bg-transparent px-2.5 py-[9px] font-bold text-[#8f382f] hover:bg-[#fbecea] hover:text-[#7f2f27] active:bg-[#f5d8d4] max-[560px]:text-xs',
  'recovery-notice': 'mx-auto mt-3 flex max-w-[1132px] items-center gap-3 rounded-xl border border-[#efc4bd] bg-[#fff0ee] px-4 py-3 text-sm font-semibold text-[#8f382f] [&_svg]:size-5 [&_svg]:shrink-0 [&_button]:ml-auto [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border [&_button]:border-[#d99b92] [&_button]:bg-white [&_button]:px-3 [&_button]:font-extrabold',
  'undo-toast': 'fixed bottom-5 left-1/2 z-30 flex w-[min(92vw,480px)] -translate-x-1/2 items-center gap-3 rounded-xl bg-[#173f34] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_36px_rgba(18,59,47,.3)] [&_button]:ml-auto [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border [&_button]:border-[#80d6ac] [&_button]:bg-transparent [&_button]:px-3 [&_button]:font-extrabold [&_button]:text-[#9be5c1]',
  'dialog-backdrop': 'fixed inset-0 z-40 grid place-items-center bg-[#10251f]/55 p-5',
  'reset-dialog': 'm-0 w-[min(100%,440px)] rounded-2xl border-0 bg-white p-6 text-[#152a25] shadow-[0_20px_60px_rgba(10,35,27,.35)] [&_h2]:mb-2 [&_h2]:text-xl [&_p]:leading-6 [&_p]:text-[#5d6c62]',
  'dialog-actions': 'mt-6 flex justify-end gap-2 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:px-4 [&_button]:font-extrabold',
  'dialog-cancel': 'border border-[#cad7d0] bg-white text-[#29483e]', 'dialog-confirm': 'border-0 bg-[#a13c31] text-white',
  'library': 'mx-auto mb-7 w-[min(100%-40px,1132px)] rounded-2xl border border-[#d7e3dc] bg-white p-5 shadow-[0_10px_32px_rgba(36,67,56,.08)] max-[560px]:w-[calc(100%-20px)] max-[560px]:p-4',
  'library-heading': 'mb-4 flex items-center justify-between gap-3 [&_h2]:m-0 [&_h2]:text-xl [&_p]:mb-0 [&_p]:mt-1 [&_p]:text-sm [&_p]:text-[#6b7974]',
  'library-actions': 'flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border [&_button]:border-[#bcd5c8] [&_button]:bg-[#edf7f1] [&_button]:px-3 [&_button]:font-extrabold [&_button]:text-[#176c4d]',
  'preset-list': 'mt-3 grid gap-2',
  'preset-row': 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dfe6e1] p-3 [&_p]:m-0 [&_p]:text-xs [&_p]:text-[#697772]',
  'preset-actions': 'flex flex-wrap gap-1 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-[#edf7f1] [&_button]:px-3 [&_button]:font-bold [&_button]:text-[#176c4d] [&_button:last-child]:text-[#963b32]',
  'import-error': 'mt-3 rounded-lg border border-[#efc4bd] bg-[#fff0ee] px-3 py-2 text-sm font-semibold text-[#8f382f]',
  'import-preview': 'mt-4 rounded-xl bg-[#f3f7f4] p-4 [&_dl]:m-0 [&_dl]:grid [&_dl]:grid-cols-[auto_1fr] [&_dl]:gap-x-4 [&_dl]:gap-y-2 [&_dt]:font-bold [&_dd]:m-0 [&_dd]:break-words',
  'trip-list': 'mt-4 grid gap-3',
  'trip-card': 'grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-[#dfe6e1] p-4 max-[650px]:grid-cols-1 [&_h3]:m-0 [&_h3]:text-base [&_p]:mb-0 [&_p]:mt-1 [&_p]:text-xs [&_p]:text-[#697772]',
  'trip-card-active': 'border-[#52a37d] bg-[#f0f9f4]',
  'trip-card-actions': 'flex flex-wrap items-center justify-end gap-1 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2.5 [&_button]:font-bold [&_button]:text-[#176c4d] [&_button:hover]:bg-[#e5f3eb] [&_button:last-child]:text-[#963b32]',
  'template-label': 'mb-2 inline-flex rounded-full bg-[#e9efff] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#3c5790]',
  'dialog-input': 'mt-4 grid gap-2 [&_label]:text-sm [&_label]:font-bold [&_input]:min-h-11',
  hero: 'px-0 pb-[50px] pt-[68px] text-center max-[560px]:px-2.5 max-[560px]:pb-[34px] max-[560px]:pt-[43px]',
  'hero-compact': '!pb-7 !pt-8 max-[560px]:!pb-5 max-[560px]:!pt-6 [&_.eyebrow]:hidden [&_h1]:!text-[clamp(32px,4vw,46px)] [&_p]:hidden',
  eyebrow: 'inline-flex items-center gap-[7px] rounded-full border border-[#cce4d6] bg-[#eff9f3] px-3 py-[7px] text-[11px] font-extrabold uppercase tracking-[1.25px] text-[#167451]',
  'editor-grid': 'grid w-full min-w-0 grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)] items-start gap-6 max-[880px]:grid-cols-1',
  'editor-column': 'grid min-w-0 gap-6', 'results-column': 'sticky top-[92px] grid min-w-0 gap-6 max-[880px]:static',
  panel: 'min-w-0 max-w-full rounded-[18px] border border-[#dfe6e1] bg-white/95 p-[25px] shadow-[0_8px_32px_rgba(36,67,56,.055)] max-[560px]:rounded-[15px] max-[560px]:px-[15px] max-[560px]:py-[19px]',
  'panel-heading': 'mb-6 flex items-start gap-3.5 [&_h2]:mb-1 [&_h2]:mt-px [&_h2]:text-[19px] [&_h2]:tracking-[-.35px] [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-[#7a8581] max-[560px]:mb-5',
  'panel-collapsed': '!p-0', 'section-toggle': 'flex min-h-[76px] w-full items-center gap-3.5 rounded-[18px] border-0 bg-transparent px-[25px] py-4 text-left max-[560px]:rounded-[15px] max-[560px]:px-[15px] [&>div]:min-w-0 [&_h2]:m-0 [&_h2]:text-[17px] [&_p]:m-0 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-[13px] [&_p]:font-semibold [&_p]:text-[#62716b] [&_svg]:ml-auto [&_svg]:shrink-0 [&_svg]:text-[#668078]',
  'done-button': 'mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] border border-[#b7d5c6] bg-[#eaf5ef] px-4 py-2 font-extrabold text-[#176c4d] hover:bg-[#dceee5]',
  compact: '!mb-[18px]', step: 'grid size-[31px] shrink-0 place-items-center rounded-[9px] bg-[#17875e] text-[13px] font-extrabold text-white',
  'stops-list': 'mb-3.5 grid list-none gap-2.5 p-0', 'people-list': 'mb-3.5 grid gap-2.5',
  'stop-row': 'grid grid-cols-[25px_minmax(0,1fr)_auto] items-end gap-[9px] max-[560px]:grid-cols-[20px_minmax(0,1fr)]', 'person-row': 'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-[9px]',
  'stop-index': 'grid h-[42px] w-[25px] shrink-0 place-items-center text-[11px] font-extrabold text-[#8a9692] max-[560px]:w-5',
  'field-grow': 'min-w-0 flex-1', 'row-label': 'mb-1.5 block text-xs font-bold text-[#4e5f59]', 'input-with-icon': 'relative [&_svg]:pointer-events-none [&_svg]:absolute [&_svg]:left-[11px] [&_svg]:top-3 [&_svg]:text-[#7c8c86] [&_input]:pl-[38px]',
  'row-actions': 'flex gap-1 max-[560px]:col-start-2 max-[560px]:pt-0',
  'icon-button': 'grid size-11 place-items-center rounded-lg border-0 bg-transparent p-0 text-[#5f6f69] hover:not-disabled:bg-[#e4f3eb] hover:not-disabled:text-[#116b49] active:not-disabled:bg-[#d3eadd] disabled:text-[#89948f] [&_svg]:w-4',
  'destructive-button': 'ml-1 border border-[#e8c5c1] text-[#a13c31] hover:not-disabled:!bg-[#fbecea] hover:not-disabled:!text-[#842f27] active:not-disabled:!bg-[#f5d8d4]',
  'secondary-button': 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[9px] border border-dashed border-[#94c5ad] bg-[#eef7f2] px-[15px] py-[9px] font-bold text-[#177653] hover:bg-[#e4f3eb] active:bg-[#d3eadd]',
  'full-button': 'w-full', 'return-stops': 'mt-[13px] rounded-[10px] bg-[#f8faf8] p-3 [&>span]:mb-2 [&>span]:block [&>span]:text-[13px] [&>span]:font-bold [&>span]:text-[#52615c] [&>div]:flex [&>div]:flex-wrap [&>div]:gap-[7px] [&>p]:mt-2 [&>p]:text-xs [&>p]:text-[#718079]',
  'return-stop-button': 'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#cbded4] bg-white px-[13px] py-[7px] font-bold text-[#176c4d] hover:bg-[#eef7f2] active:bg-[#dfeee6]',
  subsection: 'mt-[27px] border-t border-[#e6ebe8] pt-[22px] [&_h3]:mb-[13px] [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-[.85px] [&_h3]:text-[#66746f]',
  'leg-list': 'grid gap-[9px]', 'leg-row': 'grid grid-cols-[minmax(0,1fr)_140px] items-start gap-4 rounded-[10px] bg-[#f6f8f6] px-[13px] py-3 max-[560px]:grid-cols-[1fr_115px] max-[560px]:gap-2 max-[560px]:p-2.5',
  'leg-name': 'flex min-w-0 items-center gap-[7px] pt-2.5 text-[13px] font-bold max-[560px]:text-[11px] [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_svg]:shrink-0 [&_svg]:text-[#8c9995]',
  'unit-input': 'relative [&_input]:pr-12 [&_input]:text-right [&>span]:absolute [&>span]:right-[11px] [&>span]:top-3 [&>span]:text-xs [&>span]:font-bold [&>span]:text-[#76837f]',
  'distance-source': 'mt-[5px] inline-block rounded-full px-[7px] py-0.5 text-[10px] font-extrabold tracking-[.2px]', 'distance-source-reused': 'bg-[#dff2e8] text-[#176c4d]', 'distance-source-manual': 'bg-[#e7ebe9] text-[#596762]',
  'field-error': 'mt-[5px] flex items-center gap-1 text-[11px] text-[#b53b31] [&_svg]:shrink-0',
  'unit-picker': 'mb-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f3f7f4] p-1.5 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:text-xs [&_button]:font-bold [&_button[aria-pressed=true]]:bg-white [&_button[aria-pressed=true]]:text-[#147a56] [&_button[aria-pressed=true]]:shadow-sm',
  'fuel-fields': 'grid grid-cols-2 gap-3 max-[560px]:grid-cols-1', 'form-field': '[&_label]:mb-[7px] [&_label]:block [&_label]:text-xs [&_label]:font-bold [&_label]:text-[#4e5f59]', 'currency-field': '',
  'assignment-panel': 'max-[880px]:order-none', 'assignment-scroll': '-mx-2 -mb-[5px] max-w-[calc(100%+1rem)] overflow-x-auto px-2 pb-[5px] max-[560px]:hidden',
  'assignment-cards': 'hidden gap-3 max-[560px]:grid', 'assignment-card': 'min-w-0 rounded-xl border border-[#dfe6e1] bg-[#f8faf8] p-3.5',
  'assignment-card-heading': 'mb-3 flex min-w-0 items-start justify-between gap-3 border-b border-[#e1e8e4] pb-3', 'assignment-route': 'min-w-0 text-sm font-extrabold leading-5 [&_span]:block [&_span]:break-words [&_svg]:my-1 [&_svg]:size-4 [&_svg]:text-[#82918b]',
  'select-all-button': 'min-h-11 shrink-0 rounded-lg border border-[#9bcab4] bg-white px-3 py-2 text-xs font-extrabold text-[#176c4d] hover:bg-[#e8f5ee] active:bg-[#d7ecdf]',
  'assignment-chip-list': 'grid gap-2', 'assignment-chip': 'flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-[#d7e0db] bg-white px-3 py-2.5 text-sm font-bold [&:has(input:checked)]:border-[#64ad89] [&:has(input:checked)]:bg-[#e5f4ec] [&:has(input:focus-visible)]:outline [&:has(input:focus-visible)]:outline-3 [&:has(input:focus-visible)]:outline-offset-2 [&:has(input:focus-visible)]:outline-[#0f7652] [&_span]:min-w-0 [&_span]:break-words',
  'empty-state': 'rounded-[11px] border border-dashed border-[#d5deda] bg-[#fafbfa] px-[18px] py-[30px] text-center text-[#88938f] [&_svg]:mx-auto [&_svg]:w-7 [&_p]:mb-0 [&_p]:mt-[5px] [&_p]:text-[13px]',
  'results-card': 'min-w-0 max-w-full overflow-hidden rounded-[19px] bg-[#173f34] text-white shadow-[0_16px_40px_rgba(18,59,47,.18)]',
  'results-heading': 'flex items-center justify-between border-b border-white/10 px-[25px] pb-5 pt-6 max-[560px]:px-5 [&_h2]:mb-0 [&_h2]:mt-1 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-medium [&>svg]:w-7 [&>svg]:text-[#6ec59e]', 'results-kicker': 'text-[10px] font-extrabold uppercase tracking-[1.3px] text-[#83d0ad]',
  'results-empty': 'px-[25px] pb-[25px] pt-[31px] text-center [&_p]:text-[13px] [&_p]:leading-[1.6] [&_p]:text-[#b8cbc4]', 'primary-button': 'mt-2 inline-flex min-h-[45px] w-full items-center justify-center gap-2 rounded-[10px] border-0 bg-[#80d6ac] px-[18px] py-2.5 font-bold text-[#163b30] hover:bg-[#96e2bc]',
  'live-result-note': 'mx-[25px] mb-0 border-t border-white/10 py-3 text-center text-xs text-[#b8cbc4] max-[560px]:mx-5',
  totals: 'grid grid-cols-2 gap-5 px-[25px] py-[22px] max-[560px]:px-5 [&>div]:grid [&>div]:gap-1 [&_span]:text-[11px] [&_span]:text-[#a9c1b8] [&_strong]:text-[17px]', 'total-cost': 'col-span-full border-t border-white/10 pt-4 [&_strong]:font-serif [&_strong]:!text-[32px] [&_strong]:font-medium [&_strong]:text-[#88dfb5]',
  notice: 'mx-[25px] mb-6 flex items-start gap-2.5 rounded-[9px] p-[13px] text-xs leading-6 [&>svg]:w-[18px] [&>svg]:shrink-0', 'warning-notice': 'border border-[#ffcf7040] bg-[#ebab3321] text-[#ffe4a3] [&_strong]:text-[#fff0c8] [&_ul]:mb-0 [&_ul]:mt-[5px] [&_ul]:pl-[17px]', 'error-notice': '!mx-0 !mb-0 mt-3 border border-[#f1c8c3] bg-[#fff0ee] text-[#a5362d]',
  'split-list': 'border-t border-white/10', 'split-row': 'grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-white/10 px-[25px] py-[15px] max-[560px]:px-5 [&>div:nth-child(2)]:grid [&>div:nth-child(2)]:gap-0.5 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_span]:text-[11px] [&_span]:text-[#9fb8af] [&>strong]:text-[#95e2bb]', avatar: 'grid size-[34px] place-items-center rounded-full bg-[#86d9b1] font-extrabold text-[#173f34]',
  'calculation-details': 'border-t border-white/10 px-[25px] py-4 text-xs text-[#c4d5cf] max-[560px]:px-5 [&_summary]:flex [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:justify-between [&_summary]:font-extrabold [&_summary]:text-white [&_summary]:marker:content-none [&_summary::-webkit-details-marker]:hidden [&_summary_svg]:transition-transform [&[open]_summary_svg]:rotate-180',
  'calculation-content': 'grid gap-4 pb-1 pt-3 leading-5 [&_h3]:mb-1 [&_h3]:text-xs [&_h3]:text-[#83d0ad] [&_p]:mb-0',
  'formula-box': 'rounded-lg bg-white/[.07] p-3 font-mono text-[11px] text-[#e5f1ec]',
  'allocation-list': 'grid gap-2', 'allocation-row': 'rounded-lg border border-white/10 p-3 [&_strong]:text-white [&_span]:mt-1 [&_span]:block [&_span]:text-[#a9c1b8]',
  'share-area': 'border-t border-white/10 px-[25px] py-5 max-[560px]:px-5',
  'share-button': 'inline-flex min-h-[45px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#9be5c1]/40 bg-[#80d6ac] px-[18px] py-2.5 font-extrabold text-[#163b30] hover:not-disabled:bg-[#96e2bc]',
  'share-status': 'mb-0 mt-2.5 text-center text-xs text-[#b8cbc4]', 'share-error': '!text-[#ffe4a3]',
  'loading-screen': 'grid min-h-screen place-content-center justify-items-center gap-3 text-[#47604f] [&_svg]:size-8',
  'mobile-result-action': 'fixed inset-x-3 bottom-3 z-20 hidden min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#173f34] px-5 font-extrabold text-white no-underline shadow-[0_10px_30px_rgba(18,59,47,.3)] max-[560px]:flex',
}

function classes(names: string): string {
  return names.split(/\s+/).flatMap((name) => [name, styles[name] ?? '']).filter(Boolean).join(' ')
}

function numberFromInput(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

function displayNumber(value: number | null, convert: (value: number) => number): string | number {
  if (value === null) return ''
  return Number(convert(value).toFixed(6))
}

function recordId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cloneDraft(source: TripDraft, template = false): TripDraft {
  const stopIds = new Map(source.stops.map(({ id }) => [id, recordId()]))
  const legIds = new Map(source.legs.map(({ id }) => [id, recordId()]))
  const now = new Date().toISOString()
  return {
    ...structuredClone(source),
    stops: source.stops.map((stop) => ({ ...stop, id: stopIds.get(stop.id)! })),
    legs: source.legs.map((leg) => ({ ...leg, id: legIds.get(leg.id)!, fromStopId: stopIds.get(leg.fromStopId)!, toStopId: stopIds.get(leg.toStopId)! })),
    people: template ? [] : source.people.map((person) => ({ ...person, id: recordId(), assignedLegIds: person.assignedLegIds.map((id) => legIds.get(id)!).filter(Boolean) })),
    updatedAt: now,
  }
}

function routeSummary(draft: TripDraft): string {
  const names = draft.stops.map(({ name }) => name.trim()).filter(Boolean)
  return names.length ? names.join(' → ') : 'Route not named yet'
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

function IconButton({ label, disabled, destructive = false, onClick, children }: {
  label: string
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return <button className={classes(`icon-button${destructive ? ' destructive-button' : ''}`)} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>
}

function App() {
  const { themePreference, cycleTheme } = useThemePreference()
  const [submitted, setSubmitted] = useState(false)
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
  const [shareError, setShareError] = useState('')
  const [shareMessageCopied, setShareMessageCopied] = useState(false)
  const [mobileAssignments, setMobileAssignments] = useState(() => window.innerWidth <= 560)
  const [resultsVisible, setResultsVisible] = useState(false)
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
  const { stopsById, update, changeStops, addStop, returnToStop, makeRoundTrip, reuseLegDistanceForBlankReverse, moveStop, addPerson, setLegAssignment, setAllLegAssignments } = useTripEditor(draft, setDraft)
  const calculationLegs = result ? draft.legs.map((leg) => {
    const riders = draft.people.filter((person) => person.assignedLegIds.includes(leg.id))
    const cost = (leg.distanceKm ?? 0) / draft.fuelSettings.fuelEconomyKmpl! * draft.fuelSettings.fuelPricePerLitre!
    return { leg, riders, cost }
  }) : []

  useEffect(() => {
    const updateAssignmentLayout = () => setMobileAssignments(window.innerWidth <= 560)
    window.addEventListener('resize', updateAssignmentLayout)
    return () => window.removeEventListener('resize', updateAssignmentLayout)
  }, [])

  useEffect(() => {
    const card = resultsRef.current
    if (!hasResult || !card || !globalThis.IntersectionObserver) {
      setResultsVisible(false)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.15 })
    observer.observe(card)
    return () => observer.disconnect()
  }, [hasResult])

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
    update({ ...draft, people: draft.people.filter(({ id }) => id !== personId) })
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
    migrated: 'Previous draft migrated to Saved trips.',
    recovered: 'Saved trip could not be restored. A new trip was started safely.',
    error: 'Could not save changes. Keep this page open and try another edit.',
  }[persistenceStatus]
  const currentStop = draft.stops.at(-1)
  const totalDistance = draft.legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0)
  const routeComplete = draft.stops.every((stop) => stop.name.trim()) && draft.legs.every((leg) => leg.distanceKm !== null && leg.distanceKm > 0)
  const fuelComplete = (draft.fuelSettings.fuelEconomyKmpl ?? 0) > 0 && (draft.fuelSettings.fuelPricePerLitre ?? 0) > 0 && draft.fuelSettings.currency.length === 3
  const peopleComplete = draft.people.length > 0 && draft.people.every((person) => person.name.trim())
  const hasProgress = draft.stops.some((stop) => stop.name.trim()) || draft.people.length > 0 || draft.legs.some((leg) => leg.distanceKm !== null)
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
          <button className={classes("trips-button")} type="button" aria-expanded={libraryOpen} onClick={() => setLibraryOpen((open) => !open)}><FolderOpen /> Trips</button>
          <span className={classes("header-save-status")} role="status" aria-live="polite">{persistenceStatus === 'saving' ? 'Saving…' : persistenceStatus === 'error' ? 'Not saved' : persistenceStatus === 'saved' ? 'Saved' : 'Autosave'}</span>
          <button className={classes("theme-button")} type="button" onClick={cycleTheme} aria-label={`Theme: ${themePreference}. Switch theme`} title={`Theme: ${themePreference}`}>
            {themePreference === 'system' ? <Monitor /> : themePreference === 'light' ? <Sun /> : <Moon />}
          </button>
          <button ref={resetButtonRef} className={classes("reset-button")} type="button" onClick={() => setResetDialogOpen(true)}><RotateCcw size={17} /> Reset trip</button>
        </div>
      </header>

      <main id="top">
        {(persistenceStatus === 'error' || persistenceStatus === 'recovered') && <div className={classes("recovery-notice")} role="alert"><CircleAlert /> <span>{persistenceMessage}</span>{persistenceStatus === 'error' && <button type="button" onClick={retryAutosave}>Try saving again</button>}</div>}
        {persistenceStatus === 'migrated' && <div className={classes("recovery-notice")} role="status"><Save /><span>Your previous draft was moved safely into Saved trips.</span></div>}
        {libraryOpen && <section className={classes("library")} aria-labelledby="trip-library-title">
          <div className={classes("library-heading")}><div><h2 id="trip-library-title">Saved trips</h2><p>Keep journeys separate or reuse a familiar route.</p></div><button className={classes("trips-button")} type="button" onClick={() => setLibraryOpen(false)}>Close</button></div>
          <div className={classes("library-actions")}><button type="button" onClick={() => showTripDialog('create')}><Plus size={17} /> New trip</button><button type="button" onClick={() => void copyEditableLink()}><Copy size={17} /> Copy editable link</button><button type="button" onClick={downloadEditableTrip}><Download size={17} /> Download trip file</button><label className={classes("trips-button")}><Upload size={17} /> Import trip file<input className={classes("sr-only")} type="file" accept="application/json,.json" onChange={(event) => void chooseImportFile(event)} /></label></div>
          {importError && <p className={classes("import-error")} role="alert">{importError}</p>}
          {libraryMessage && <p role="status">{libraryMessage}</p>}
          <div className={classes("subsection")}><h3>Vehicle presets</h3><div className={classes("library-actions")}><button type="button" onClick={() => showVehicleDialog('create')}><Plus size={17} /> Save vehicle preset</button></div>
            {vehiclePresets.length === 0 ? <p>No vehicle presets saved yet.</p> : <div className={classes("preset-list")}>{vehiclePresets.map((preset) => <article className={classes("preset-row")} key={preset.id} aria-label={preset.name}><div><strong>{preset.name}</strong><p>{displayNumber(preset.fuelEconomyKmpl, (value) => economyFromKmpl(value, preset.preferredUnits))} {unitLabels(preset.preferredUnits).economy}{preset.fuelType ? ` · ${preset.fuelType}` : ''} · {preset.preferredUnits === 'metric' ? 'Metric' : preset.preferredUnits === 'us' ? 'US customary' : 'UK imperial'}</p></div><div className={classes("preset-actions")}><button type="button" onClick={() => applyVehiclePreset(preset)}>Use</button><button type="button" onClick={() => showVehicleDialog('edit', preset)}>Edit</button><button type="button" onClick={() => showVehicleDialog('delete', preset)}>Delete</button></div></article>)}</div>}
          </div>
          <div className={classes("trip-list")}>
            {trips.filter(({ deletedAt }) => !deletedAt).map((trip) => {
              const complete = editableTripDraftSchema.safeParse(trip.draft)
              const total = complete.success ? calculateTrip(complete.data).totalCost : null
              return <article className={classes(`trip-card${trip.id === activeTripId ? ' trip-card-active' : ''}`)} key={trip.id} aria-label={trip.name}>
                <div>{trip.kind === 'template' && <span className={classes("template-label")}>Template</span>}<h3>{trip.name}{trip.id === activeTripId ? ' · Current' : ''}</h3><p>{routeSummary(trip.draft)}</p><p>Updated {new Date(trip.updatedAt).toLocaleDateString()} · {total === null ? 'Incomplete' : formatCurrency(total, trip.draft.fuelSettings.currency)}</p></div>
                <div className={classes("trip-card-actions")}><button type="button" onClick={() => void openLibraryTrip(trip)}>{trip.kind === 'template' ? 'Use template' : 'Open'}</button>{trip.kind === 'trip' && <><button type="button" onClick={() => void duplicateTrip(trip)}><Copy size={15} /> Duplicate</button><button type="button" onClick={() => void saveTemplate(trip)}>Save template</button></>}<button type="button" onClick={() => showTripDialog('rename', trip)}>Rename</button><button type="button" onClick={() => showTripDialog('delete', trip)}>Delete</button></div>
              </article>
            })}
          </div>
          {trips.some(({ deletedAt }) => deletedAt) && <details><summary>Recently deleted</summary><div className={classes("trip-list")}>{trips.filter(({ deletedAt }) => deletedAt).map((trip) => <article className={classes("trip-card")} key={trip.id} aria-label={trip.name}><div><h3>{trip.name}</h3><p>{routeSummary(trip.draft)}</p></div><div className={classes("trip-card-actions")}><button type="button" onClick={() => void restoreTrip(trip)}>Restore</button></div></article>)}</div></details>}
        </section>}
        <section className={classes(`hero${hasProgress ? ' hero-compact' : ''}`)} aria-labelledby="page-title">
          <div className={classes("eyebrow")}><CarFront size={16} /> Fair fuel costs, leg by leg</div>
          <h1 id="page-title">Plan the route.<br /><span>Split the ride.</span></h1>
          <p>Build your journey, choose who rode each leg, and get a fair fuel split in seconds.</p>
        </section>

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
                      <div className={classes("leg-name")}><span>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={16} /><span>{stopsById.get(leg.toStopId)}</span></div>
                      <div><label className={classes("row-label")} htmlFor={`leg-${leg.id}`}>Distance ({units.distance})</label><div className={classes("unit-input")}><input id={`leg-${leg.id}`} aria-label={`Distance from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)} in ${units.distanceLong}`} type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={displayNumber(leg.distanceKm, (value) => distanceFromKm(value, unitSystem))} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onBlur={() => reuseLegDistanceForBlankReverse(leg.id)} onChange={(event) => { const value = numberFromInput(event.target.value); update({ ...draft, legs: draft.legs.map((item) => item.id === leg.id ? { ...item, distanceKm: value === null ? null : distanceToKm(value, unitSystem), distanceSource: 'manual' } : item) }) }} /><span>{units.distance}</span></div>{leg.distanceKm !== null && <span className={classes(`distance-source distance-source-${leg.distanceSource === 'reused' ? 'reused' : 'manual'}`)}>{leg.distanceSource === 'reused' ? 'Auto-filled' : 'Manual'}</span>}<FieldError id={errorId} message={error} /></div>
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
          </div>

          <aside className={classes("results-column")}>
            <section className={classes("panel assignment-panel")} aria-labelledby="assignment-title">
              <div className={classes("panel-heading compact")}><span className={classes("step")}>4</span><div><h2 id="assignment-title">Assign each leg</h2><p>Check who travelled on each part.</p></div></div>
              {draft.people.length === 0 ? <div className={classes("empty-state")}><Users /><p>Add people to start assigning riders.</p></div> : <>
                {!mobileAssignments && <div className={classes("assignment-scroll")}><table><thead><tr><th scope="col">Passenger</th>{draft.legs.map((leg) => <th scope="col" key={leg.id}><span>{stopsById.get(leg.fromStopId)}</span><ArrowRight size={13} /><span>{stopsById.get(leg.toStopId)}</span></th>)}</tr></thead><tbody>{draft.people.map((person) => <tr key={person.id}><th scope="row">{person.name || 'Unnamed'}</th>{draft.legs.map((leg) => { const assignmentLabel = `${person.name || 'Unnamed person'} rode from ${stopsById.get(leg.fromStopId)} to ${stopsById.get(leg.toStopId)}`; return <td key={leg.id}><label className="assignment-target"><input type="checkbox" aria-label={assignmentLabel} checked={person.assignedLegIds.includes(leg.id)} onChange={(event) => setLegAssignment(person.id, leg.id, event.target.checked)} /><span className={classes("sr-only")}>{assignmentLabel}</span></label></td> })}</tr>)}</tbody></table></div>}
                {mobileAssignments && <div className={classes("assignment-cards")}>{draft.legs.map((leg) => {
                  const from = stopsById.get(leg.fromStopId)
                  const to = stopsById.get(leg.toStopId)
                  const allAssigned = draft.people.every((person) => person.assignedLegIds.includes(leg.id))
                  return <section className={classes("assignment-card")} aria-label={`Riders from ${from} to ${to}`} key={leg.id}>
                    <div className={classes("assignment-card-heading")}><div className={classes("assignment-route")}><span>{from}</span><ArrowDown aria-hidden="true" /><span>{to}</span></div><button className={classes("select-all-button")} type="button" onClick={() => setAllLegAssignments(leg.id, !allAssigned)}>{allAssigned ? 'Clear all' : 'Select all'}</button></div>
                    <div className={classes("assignment-chip-list")}>{draft.people.map((person) => { const assignmentLabel = `${person.name || 'Unnamed person'} rode from ${from} to ${to}`; return <label className={classes("assignment-chip")} key={person.id}><input type="checkbox" aria-label={assignmentLabel} checked={person.assignedLegIds.includes(leg.id)} onChange={(event) => setLegAssignment(person.id, leg.id, event.target.checked)} /><span>{person.name || 'Unnamed'}</span></label> })}</div>
                  </section>
                })}</div>}
              </>}
            </section>

            <section ref={resultsRef} id="results" className={classes("results-card")} aria-labelledby="results-title" aria-live="polite">
              <div className={classes("results-heading")}><div><span className={classes("results-kicker")}>Your split</span><h2 id="results-title">Journey summary</h2></div><Fuel /></div>
              {!result ? <div className={classes("results-empty")}><p>Complete the trip details to see your fair split. Once they are valid, the split updates automatically.</p><button className={classes("primary-button")} type="button" onClick={revealResults}>Check trip details <ArrowRight size={18} /></button></div> : <>
                <div className={classes("totals")}><div><span>Total distance</span><strong>{distanceFromKm(result.totalDistanceKm, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} {units.distance}</strong></div><div><span>Fuel used</span><strong>{volumeFromLitres(result.totalLitres, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} {units.volume}</strong></div><div className={classes("total-cost")}><span>Total fuel cost</span><strong>{formatCurrency(result.totalCost, draft.fuelSettings.currency)}</strong></div></div>
                <p className={classes("live-result-note")}>This split updates automatically as you edit trip details.</p>
                {result.unassignedLegIds.length > 0 ? <div className={classes("notice warning-notice")} role="status"><CircleAlert /><div><strong>Some legs have no riders</strong><ul>{result.unassignedLegIds.map((id) => { const leg = draft.legs.find((item) => item.id === id)!; return <li key={id}>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</li> })}</ul></div></div> : <div className={classes("split-list")}>{result.people.map((person) => <div className={classes("split-row")} key={person.personId}><div className={classes("avatar")} aria-hidden="true">{person.personName.charAt(0).toUpperCase()}</div><div><strong>{person.personName}</strong><span>{distanceFromKm(person.distanceKm, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} {units.distance} · {person.legIds.length} {person.legIds.length === 1 ? 'leg' : 'legs'}</span></div><strong>{formatCurrency(person.displayCost, draft.fuelSettings.currency)}</strong></div>)}</div>}
                <details className={classes("calculation-details")}><summary>How this was calculated <ChevronDown aria-hidden="true" /></summary><div className={classes("calculation-content")}>
                  <section><h3>Route totals and formula</h3><p>{result.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km ÷ {draft.fuelSettings.fuelEconomyKmpl!.toLocaleString()} km/L = {result.totalLitres.toLocaleString(undefined, { maximumFractionDigits: 2 })} L</p><p>{result.totalLitres.toLocaleString(undefined, { maximumFractionDigits: 2 })} L × {formatCurrency(draft.fuelSettings.fuelPricePerLitre!, draft.fuelSettings.currency)} per litre = {formatCurrency(result.totalCost, draft.fuelSettings.currency)}</p></section>
                  <div className={classes("formula-box")}>Each rider’s leg share = leg distance ÷ fuel economy × price per litre ÷ riders on that leg</div>
                  <section><h3>Per-leg allocation</h3><div className={classes("allocation-list")}>{calculationLegs.map(({ leg, riders, cost }) => <div className={classes("allocation-row")} key={leg.id}><strong>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</strong><span>{leg.distanceKm!.toLocaleString()} km · {formatCurrency(cost, draft.fuelSettings.currency)} · {riders.length === 0 ? 'No riders assigned' : `${formatCurrency(cost / riders.length, draft.fuelSettings.currency)} each for ${riders.map(({ name }) => name).join(', ')}`}</span></div>)}</div></section>
                  <section><h3>Rounding</h3><p>Calculations keep full precision. Displayed shares use the currency’s minor units, then any leftover units go to the largest fractional remainders (ties follow rider order) so the displayed shares add up exactly to the rounded total.</p></section>
                </div></details>
                <div className={classes("share-area")}><button className={classes("share-button")} type="button" disabled={shareStatus === 'sharing'} onClick={() => void shareResult()}><Share2 size={18} />{shareStatus === 'sharing' ? 'Preparing summary…' : 'Share summary'}</button>{shareStatus === 'shared' && <p className={classes("share-status")} role="status">Summary shared.</p>}{shareStatus === 'downloaded' && <p className={classes("share-status")} role="status">Summary image downloaded.{shareMessageCopied ? ' Message copied to clipboard.' : ''}</p>}{shareStatus === 'error' && <p className={classes("share-status share-error")} role="alert">{shareError}</p>}</div>
              </>}
            </section>
          </aside>
        </div>
      </main>
      {undoRemoval && <div className={classes("undo-toast")} role="status" aria-live="polite"><span>{undoRemoval.message}</span><button type="button" onClick={undoLastRemoval}>Undo</button></div>}
      {resetDialogOpen && <div className={classes("dialog-backdrop")} onMouseDown={(event) => { if (event.target === event.currentTarget) closeResetDialog() }}><div className={classes("reset-dialog")} role="alertdialog" aria-modal="true" aria-labelledby="reset-dialog-title" aria-describedby="reset-dialog-description" onKeyDown={(event) => { if (event.key === 'Escape') closeResetDialog() }}><h2 id="reset-dialog-title">Reset the complete trip?</h2><p id="reset-dialog-description">This deletes all stops, people, distances, assignments, and fuel settings from this device.</p><div className={classes("dialog-actions")}><button ref={cancelResetRef} className={classes("dialog-cancel")} type="button" onClick={closeResetDialog}>Cancel</button><button className={classes("dialog-confirm")} type="button" onClick={resetTrip}>Reset trip</button></div></div></div>}
      {tripDialog && <div className={classes("dialog-backdrop")}><div className={classes("reset-dialog")} role="dialog" aria-modal="true" aria-labelledby="trip-dialog-title" onKeyDown={(event) => { if (event.key === 'Escape') setTripDialog(null) }}><h2 id="trip-dialog-title">{tripDialog.action === 'create' ? 'Create a new trip' : tripDialog.action === 'rename' ? `Rename ${tripDialog.trip?.name}` : `Delete ${tripDialog.trip?.name}?`}</h2>{tripDialog.action === 'delete' ? <p>The trip will move to Recently deleted, where you can restore it later.</p> : <div className={classes("dialog-input")}><label htmlFor="trip-name">Trip name</label><input id="trip-name" autoFocus value={tripName} onChange={(event) => setTripName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitTripDialog() }} />{tripDialog.action === 'create' && <><label htmlFor="route-template">Frequently used route (optional)</label><select id="route-template" value={newTripTemplateId} onChange={(event) => setNewTripTemplateId(event.target.value)}><option value="">Start with a blank route</option>{trips.filter(({ kind, deletedAt }) => kind === 'template' && !deletedAt).map((template) => <option key={template.id} value={template.id}>{template.name} · {routeSummary(template.draft)}</option>)}</select><small>The selected route is copied into a new trip; your current trip stays unchanged.</small></>}</div>}<div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" onClick={() => setTripDialog(null)}>Cancel</button><button className={classes(tripDialog.action === 'delete' ? 'dialog-confirm' : 'done-button')} type="button" onClick={() => void submitTripDialog()}>{tripDialog.action === 'create' ? 'Create trip' : tripDialog.action === 'rename' ? 'Save name' : 'Move to Recently deleted'}</button></div></div></div>}
      {vehicleDialog && <div className={classes("dialog-backdrop")}><div className={classes("reset-dialog")} role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title"><h2 id="vehicle-dialog-title">{vehicleDialog.action === 'create' ? 'Save vehicle preset' : vehicleDialog.action === 'edit' ? `Edit ${vehicleDialog.preset?.name}` : `Delete ${vehicleDialog.preset?.name}?`}</h2>{vehicleDialog.action === 'delete' ? <p>This removes the local preset. Existing trips are not changed.</p> : <div className={classes("dialog-input")}><label htmlFor="vehicle-name">Preset name</label><input id="vehicle-name" autoFocus value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} /><label htmlFor="vehicle-units">Preferred units</label><select id="vehicle-units" value={vehicleUnits} onChange={(event) => { const next = event.target.value as UnitSystem; const current = Number(vehicleEconomy); setVehicleEconomy(Number.isFinite(current) && current > 0 ? String(economyFromKmpl(economyToKmpl(current, vehicleUnits), next)) : ''); setVehicleUnits(next) }}><option value="metric">Metric</option><option value="us">US customary</option><option value="imperial">UK imperial</option></select><label htmlFor="vehicle-economy">Fuel economy ({unitLabels(vehicleUnits).economy})</label><input id="vehicle-economy" type="number" min="0" step="any" value={vehicleEconomy} onChange={(event) => setVehicleEconomy(event.target.value)} /><label htmlFor="vehicle-fuel-type">Fuel type (optional)</label><input id="vehicle-fuel-type" value={vehicleFuelType} placeholder="e.g. Petrol" onChange={(event) => setVehicleFuelType(event.target.value)} /></div>}<div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" onClick={() => setVehicleDialog(null)}>Cancel</button><button className={classes(vehicleDialog.action === 'delete' ? 'dialog-confirm' : 'done-button')} type="button" onClick={submitVehicleDialog}>{vehicleDialog.action === 'delete' ? 'Delete preset' : 'Save preset'}</button></div></div></div>}
      {importPreview && <div className={classes("dialog-backdrop")}><div className={classes("reset-dialog")} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title"><h2 id="import-dialog-title">Preview imported trip</h2><p>Review this trip before saving it on this device. Nothing local has changed yet.</p><div className={classes("import-preview")}><dl><dt>Name</dt><dd>{importPreview.name}</dd><dt>Route</dt><dd>{routeSummary(importPreview.draft)}</dd><dt>Stops</dt><dd>{importPreview.draft.stops.length}</dd><dt>Riders</dt><dd>{importPreview.draft.people.length}</dd><dt>Units</dt><dd>{importPreview.unitSystem === 'metric' ? 'Metric' : importPreview.unitSystem === 'us' ? 'US customary' : 'UK imperial'}</dd></dl></div><div className={classes("dialog-actions")}><button className={classes("dialog-cancel")} type="button" onClick={() => setImportPreview(null)}>Cancel</button><button className={classes("dialog-cancel")} type="button" onClick={() => void confirmImport('add')}>Add as new trip</button><button className={classes("dialog-confirm")} type="button" onClick={() => void confirmImport('replace')}>Replace current trip</button></div></div></div>}
      {result && !resultsVisible && <a className={classes("mobile-result-action")} href="#results">View split · {formatCurrency(result.totalCost, draft.fuelSettings.currency)} <ArrowRight size={18} /></a>}
      <footer>Made for fair journeys.</footer>
    </div>
  )
}

export default App
