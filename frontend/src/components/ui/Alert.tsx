import type { HTMLAttributes } from 'react'

type Variant = 'error' | 'warning' | 'info'

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant
  children: React.ReactNode
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  error: {
    borderColor: 'var(--danger)',
    color: 'var(--danger)',
  },
  warning: {
    borderColor: 'var(--accent-purple)',
    color: 'var(--accent-purple)',
  },
  info: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
}

export default function Alert({ variant = 'error', children, style, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid',
        background: 'var(--bg-elevated)',
        fontSize: 'var(--size-sm)',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
