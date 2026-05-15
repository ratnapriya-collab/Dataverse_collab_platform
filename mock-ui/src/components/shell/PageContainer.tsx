import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  /** "wide" allows full-width (used by /parts viewer). Default = 1400px capped. */
  width?: 'normal' | 'wide'
}

export default function PageContainer({ children, className = '', width = 'normal' }: Props) {
  const maxW = width === 'wide' ? 'max-w-none' : 'max-w-[1400px]'
  return <div className={`mx-auto ${maxW} px-6 py-8 ${className}`}>{children}</div>
}
