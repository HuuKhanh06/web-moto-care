import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

/**
 * Ô nhập liệu chuẩn hóa MotoCare:
 * - Nhãn nằm phía trên rõ ràng (text-sm font-semibold text-slate-800).
 * - Chiều cao 48px (h-12), cỡ chữ 16px (ngăn trình duyệt mobile tự zoom).
 * - Bo góc 12px (rounded-xl), viền 1px xám nhẹ.
 * - Trạng thái focus màu Teal rõ ràng, báo lỗi đỏ đạt chuẩn tương phản AA.
 * - Hỗ trợ icon bên trái (icon) và nút/phần tử bên phải (rightElement).
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, rightElement, type = 'text', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-slate-800">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-4 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'w-full h-12 min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-base text-slate-900 placeholder:text-slate-400',
              'transition-colors duration-150 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              icon ? 'pl-11' : '',
              rightElement ? 'pr-11' : '',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : '',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3.5 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-[13px] font-normal text-rose-600 mt-1">{error}</p>}
        {!error && helperText && <p className="text-[13px] font-normal text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
