import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  'default' | 'purple' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-raised border-border-subtle text-gray-300',
  purple: 'bg-purple-950/60 border-purple-700/40 text-purple-200',
  success: 'bg-emerald-950/60 border-emerald-700/40 text-emerald-300',
  warning: 'bg-yellow-950/60 border-yellow-700/40 text-yellow-300',
  danger: 'bg-red-950/60 border-red-700/40 text-red-300',
  info: 'bg-blue-950/60 border-blue-700/40 text-blue-300',
  muted: 'bg-surface border-border-subtle text-gray-400',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium',
          variantStyles[variant],
          className
        )
      )}
    >
      {children}
    </span>
  );
}
