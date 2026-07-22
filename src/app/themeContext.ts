import { createContext, useContext } from 'react'
import type { useThemePreference } from './useThemePreference'

export type ThemeContextValue = ReturnType<typeof useThemePreference>
export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
