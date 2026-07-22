import { CircleAlert } from 'lucide-react'
import { classes } from './styles'

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p className={classes('field-error')} id={id} role="alert"><CircleAlert size={14} />{message}</p>
}

export function IconButton({ label, disabled, destructive = false, onClick, children }: {
  label: string
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return <button className={classes(`icon-button${destructive ? ' destructive-button' : ''}`)} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>
}
