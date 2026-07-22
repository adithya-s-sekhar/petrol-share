import type { ReactNode } from 'react'
import { useThemePreference } from './useThemePreference'
import { ThemeContext } from './themeContext'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemePreference()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
