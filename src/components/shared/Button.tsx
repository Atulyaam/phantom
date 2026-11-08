import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-purple-700 text-white border-purple-600 hover:bg-purple-600 shadow-sm',
  secondary:
    'bg-surface-raised text-gray-200 border-border-default hover:bg-surface-overlay',
  ghost:
    'bg-transparent text-gray-300 border-transparent hover:bg-surface-raised hover:text-white',
  danger: 'bg-red-950/60 text-red-200 border-red-700/60 hover:bg-red-900/60',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3.5 py-1.5 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center rounded-md border font-medium',
            'transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400',
            'disabled:opacity-50 disabled:pointer-events-none',
            variantStyles[variant],
            sizeStyles[size],
            className
          )
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
