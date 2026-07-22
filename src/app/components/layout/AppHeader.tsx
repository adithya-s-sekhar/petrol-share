import { type RefObject } from 'react'
import { FolderOpen, Fuel, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import type { ThemePreference } from '../../hooks/useThemePreference'
import { classes } from '../../styles'

type AppHeaderProps = {
  libraryOpen: boolean
  onToggleLibrary: () => void
  onReset: () => void
  persistenceStatus: string
  resetButtonRef: RefObject<HTMLButtonElement | null>
  themePreference: ThemePreference
  onCycleTheme: () => void
}

export function AppHeader({ libraryOpen, onToggleLibrary, onReset, persistenceStatus, resetButtonRef, themePreference, onCycleTheme }: AppHeaderProps) {
  const saveStatus = persistenceStatus === 'saving' ? 'Saving…' : persistenceStatus === 'error' ? 'Not saved' : persistenceStatus === 'saved' ? 'Saved' : 'Autosave'
  return <header className={classes('site-header')}>
    <a className={classes('brand')} href="#top" aria-label="Petrol Share home"><span className={classes('brand-mark')}><Fuel /></span><span>Petrol <strong>Share</strong></span></a>
    <div className={classes('header-actions')}>
      <button className={classes('trips-button')} type="button" aria-expanded={libraryOpen} onClick={onToggleLibrary}><FolderOpen /> Trips</button>
      <span className={classes('header-save-status')} role="status" aria-live="polite">{saveStatus}</span>
      <button className={classes('theme-button')} type="button" onClick={onCycleTheme} aria-label={`Theme: ${themePreference}. Switch theme`} title={`Theme: ${themePreference}`}>
        {themePreference === 'system' ? <Monitor /> : themePreference === 'light' ? <Sun /> : <Moon />}
      </button>
      <button ref={resetButtonRef} className={classes('reset-button')} type="button" aria-label="Reset trip" onClick={onReset}><RotateCcw size={17} /> <span>Reset trip</span></button>
    </div>
  </header>
}
