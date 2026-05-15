import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`h-9 w-full rounded border bg-white px-3 text-sm text-ink placeholder:text-ink-mute focus-ring transition-colors ${
        invalid ? 'border-state-rejected focus-visible:ring-state-rejected/30' : 'border-rule hover:border-ink-mute/50'
      } ${className}`}
      {...rest}
    />
  )
})

export default Input
