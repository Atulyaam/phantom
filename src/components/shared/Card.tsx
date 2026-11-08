import { type ReactNode, forwardRef, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type CardVariant = 'default' | 'raised' | 'selected' | 'danger';

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface border-border-default',
  raised: 'bg-surface-raised border-border-default shadow-mansion',
  selected: 'bg-surface-raised border-purple-500 shadow-glow',
  danger: 'bg-red-950/30 border-red-700/50',
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', interactive = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'rounded-xl border p-5 transition-all',
            variantStyles[variant],
            interactive &&
              'cursor-pointer hover:border-purple-800/80 hover:bg-surface-raised',
            interactive && 'focus-within:ring-2 focus-within:ring-cyan-400',
            className
          )
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
