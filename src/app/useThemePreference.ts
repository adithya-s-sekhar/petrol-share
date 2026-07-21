import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'petrol-share-theme'

export function useThemePreference() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  })

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

  return { themePreference, cycleTheme }
}
