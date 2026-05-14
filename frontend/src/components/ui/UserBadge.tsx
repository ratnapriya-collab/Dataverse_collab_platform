/**
 * Circular initials badge — first letter of first name + first letter of last name.
 * Falls back to first two letters of name, then email's first letter.
 */

interface Props {
  name: string
  email?: string
  className?: string
}

export function initialsOf(name: string, email?: string): string {
  const cleaned = name.trim()
  if (cleaned.length > 0) {
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const first = parts[0] ?? ''
      const last = parts[parts.length - 1] ?? ''
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    const only = parts[0] ?? ''
    return only.slice(0, 2).toUpperCase()
  }
  return (email ?? '?').charAt(0).toUpperCase()
}

export default function UserBadge({ name, email, className = '' }: Props) {
  const initials = initialsOf(name, email)
  return (
    <div
      title={name || email}
      aria-label={`Signed in as ${name || email}`}
      className={[
        'flex h-9 w-9 items-center justify-center rounded-full',
        'bg-gradient-to-br from-primary to-brand text-white',
        'text-xs font-bold tracking-wider shadow-sm ring-2 ring-white',
        className,
      ].join(' ')}
    >
      {initials}
    </div>
  )
}
