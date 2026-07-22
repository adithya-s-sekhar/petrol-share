import type { UnitSystem } from '../domain'

export const PUBLIC_SITE_URL = 'https://adithya-s-sekhar.github.io/petrol-share/'
export const MOBILE_ASSIGNMENTS_QUERY = '(max-width: 560px)'
export const UNDO_REMOVAL_TIMEOUT_MS = 8_000

export const UNIT_SYSTEM_OPTIONS: ReadonlyArray<readonly [UnitSystem, string]> = [
  ['metric', 'Metric'],
  ['us', 'US customary'],
  ['imperial', 'UK imperial'],
]

export const OPEN_EDITOR_SECTIONS = ['route', 'fuel', 'people'] as const
