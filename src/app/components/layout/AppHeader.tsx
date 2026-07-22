import { type RefObject } from 'react'
import { FolderOpen, Fuel, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import type { ThemePreference } from '../../hooks/useThemePreference'
import { layout } from '../../designSystem'
import { Button, IconButton } from '../ui/AppControls'

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
  return <header className={layout('site-header')}>
    <a className={layout('brand')} href="#top" aria-label="Petrol Share home"><span className={layout('brand-mark')}><Fuel /></span><span>Petrol <strong>Share</strong></span></a>
    <div className={layout('header-actions')}>
      <Button variant="quiet" aria-expanded={libraryOpen} onClick={onToggleLibrary}><FolderOpen /> Trips</Button>
      <span className={layout('header-save-status')} role="status" aria-live="polite">{saveStatus}</span>
      <IconButton label={`Theme: ${themePreference}. Switch theme`} onClick={onCycleTheme}>
        {themePreference === 'system' ? <Monitor /> : themePreference === 'light' ? <Sun /> : <Moon />}
      </IconButton>
      <Button ref={resetButtonRef} variant="danger" className="border-transparent max-[359px]:size-11 max-[359px]:gap-0 max-[359px]:p-0 max-[359px]:[&_span]:hidden" aria-label="Reset trip" onClick={onReset}><RotateCcw /> <span>Reset trip</span></Button>
    </div>
  </header>
}
