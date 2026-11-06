import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

/**
 * Nút bấm chuẩn mực MotoCare theo Design System:
 * - Nút chính: 48px, chữ 16/600, nền Teal đặc, bo góc 12px, vùng chạm >= 44x44px.
 * - Nút phụ: viền mảnh 1px, chữ Teal, bo góc 12px.
 * - Trạng thái focus rõ ràng cho phím Tab, active nén nhẹ tự nhiên.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ' +
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ' +
      'active:scale-[0.98] select-none min-h-[44px] min-w-[44px]';

    const variants = {
      // Nút chính: Nền Teal đặc (#0d9488), hover đậm (#0f766e)
      primary:
        'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm border border-transparent',
      // Nút phụ: Viền mảnh 1px, chữ Teal
      secondary:
        'bg-teal-50 text-teal-800 hover:bg-teal-100 active:bg-teal-200 border border-teal-200',
      outline:
        'border border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100',
      ghost:
        'text-slate-700 hover:bg-slate-100 active:bg-slate-200 hover:text-slate-900 border border-transparent',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm border border-transparent',
    };

    const sizes = {
      // sm: Thao tác phụ hoặc trên bảng
      sm: 'h-10 px-3.5 text-[14px]',
      // md: Chuẩn 48px cho nút chính công thái học mobile & desktop
      md: 'h-12 px-5 text-base',
      // lg: Khối đặt cọc / thanh toán nhấn mạnh
      lg: 'h-14 px-7 text-base font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth ? 'w-full' : '',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin text-current shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
