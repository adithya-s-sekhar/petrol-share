import { CircleAlert } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-extrabold leading-5 transition-colors disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-[18px] [&_svg]:shrink-0'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border-[var(--color-selected-border)] bg-[var(--color-accent)] text-white hover:not-disabled:bg-[var(--color-accent-strong)]',
  secondary: 'border-[var(--color-selected-border)] bg-[var(--color-selected)] text-[var(--color-accent)] hover:not-disabled:bg-[var(--color-accent-hover)]',
  quiet: 'border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-accent)] hover:not-disabled:bg-[var(--color-accent-hover)]',
  danger: 'border-[var(--color-destructive-border)] bg-[var(--color-panel)] text-[var(--color-destructive)] hover:not-disabled:bg-[var(--color-destructive-surface)]',
}

function controlClass(variant: ButtonVariant = 'secondary', className = '') {
  return `${buttonBase} ${buttonVariants[variant]} ${className}`.trim()
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(
  function Button({ variant = 'secondary', className = '', type = 'button', ...props }, ref) {
    return <button ref={ref} type={type} className={controlClass(variant, className)} {...props} />
  },
)

export function ButtonLabel({ variant = 'secondary', className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement> & { variant?: ButtonVariant }) {
  return <label className={controlClass(variant, `cursor-pointer ${className}`)} {...props} />
}

export function IconButton({ label, destructive = false, className = '', children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  label: string
  destructive?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={controlClass(destructive ? 'danger' : 'quiet', `size-11 shrink-0 p-0 ${className}`)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 ${className}`} {...props} />
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-destructive)]" id={id} role="alert"><CircleAlert size={14} className="shrink-0" />{message}</p>
}
