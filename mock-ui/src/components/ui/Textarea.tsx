import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`w-full resize-y rounded border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus-ring transition-colors ${
        invalid ? 'border-state-rejected focus-visible:ring-state-rejected/30' : 'border-rule hover:border-ink-mute/50'
      } ${className}`}
      {...rest}
    />
  )
})

export default Textarea
