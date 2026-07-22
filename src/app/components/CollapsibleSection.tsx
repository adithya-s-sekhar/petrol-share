import type { ReactNode, Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import { classes } from '../styles'

interface CollapsibleSectionProps {
  controls: string
  open: boolean
  step: number
  title: string
  summary: string
  buttonRef?: Ref<HTMLButtonElement>
  onOpen: () => void
  children: ReactNode
}

export function CollapsibleSection({ controls, open, step, title, summary, buttonRef, onOpen, children }: CollapsibleSectionProps) {
  const titleId = `${controls}-title`
  return (
    <section className={classes(`panel${open ? '' : ' panel-collapsed'}`)} aria-labelledby={titleId}>
      {!open ? (
        <button ref={buttonRef} className={classes('section-toggle')} type="button" aria-expanded="false" aria-controls={`${controls}-content`} onClick={onOpen}>
          <span className={classes('step')}>{step}</span>
          <div><h2 id={titleId}>{title}</h2><p>{summary}</p></div>
          <ChevronDown aria-hidden="true" />
        </button>
      ) : children}
    </section>
  )
}

export function SectionHeading({ controls, step, title, children }: { controls: string; step: number; title: string; children: ReactNode }) {
  return <div className={classes('panel-heading')}><span className={classes('step')}>{step}</span><div><h2 id={`${controls}-title`}>{title}</h2><p>{children}</p></div></div>
}
