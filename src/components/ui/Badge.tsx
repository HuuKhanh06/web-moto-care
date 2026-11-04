import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'processing' | 'waiting' | 'danger' | 'completed' | 'neutral' | 'success' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export function Badge({ className, variant = 'neutral', size = 'sm', children, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    // Đang xử lý: Xanh nhạt
    processing: 'bg-brand-50 text-brand-700 border-brand-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    // Chờ khách / Chờ việc: Vàng
    waiting: 'bg-amber-50 text-amber-700 border-amber-200',
    // Từ chối / Hủy / Lỗi: Đỏ
    danger: 'bg-red-50 text-red-700 border-red-200',
    // Hoàn tất: Xanh đậm
    completed: 'bg-brand-100 text-brand-900 border-brand-300 font-semibold',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    // Trung tính
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
