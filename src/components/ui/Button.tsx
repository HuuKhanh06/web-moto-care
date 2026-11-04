import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, loading = false, disabled, children, ...props }, ref) => {
    // Micro-interactions 2026+: active:scale-95, hover:-translate-y-0.5, transition-all mượt mà
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96] hover:-translate-y-0.5 shadow-sm';

    const variants = {
      primary: 'bg-brand-700 text-white hover:bg-brand-600 hover:shadow-md hover:shadow-brand-700/25 active:bg-brand-800',
      secondary: 'bg-brand-100 text-brand-900 hover:bg-brand-200 hover:shadow-sm',
      outline: 'border-2 border-brand-500 text-brand-700 bg-white/80 backdrop-blur-sm hover:bg-brand-50 hover:border-brand-600',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-none hover:shadow-none hover:translate-y-0',
      danger: 'bg-red-600 text-white hover:bg-red-500 hover:shadow-md hover:shadow-red-600/25 active:bg-red-700',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], fullWidth ? 'w-full' : '', className)}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
