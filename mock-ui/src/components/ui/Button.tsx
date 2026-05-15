import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-2 active:bg-accent-2 shadow-sm disabled:bg-accent/40 disabled:cursor-not-allowed',
  secondary:
    'bg-white text-ink border border-rule hover:bg-rule-soft hover:border-ink-mute/40 active:bg-rule disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-ink-soft hover:bg-rule-soft hover:text-ink active:bg-rule disabled:opacity-50',
  danger:
    'bg-state-rejected text-white hover:bg-state-rejected/90 active:bg-state-rejected/80 shadow-sm disabled:opacity-50',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      className={`inline-flex items-center justify-center rounded font-medium transition-colors focus-ring ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        children
      )}
    </button>
  )
})

export default Button
