// src/components/ui/StatusChip.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export type StatusChipType = 'success' | 'pending' | 'error' | 'inactive';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusChipType;
  label: string;
  size?: 'sm' | 'md';
}

/**
 * Chip trạng thái chuẩn hóa theo Mục 3:
 * - Bo góc 999px (rounded-full).
 * - 4 nhóm màu chuẩn: Xanh lá (xong), Vàng (chờ), Đỏ (lỗi/từ chối), Xám (không hoạt động).
 * - Luôn có chấm tròn trạng thái kèm nhãn chữ (AA Contrast), cỡ chữ tối thiểu 13px.
 */
export function StatusChip({ status, label, size = 'md', className, ...props }: StatusChipProps) {
  const styles = {
    success: {
      container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    pending: {
      container: 'bg-amber-50 text-amber-900 border-amber-200',
      dot: 'bg-amber-500',
    },
    error: {
      container: 'bg-rose-50 text-rose-800 border-rose-200',
      dot: 'bg-rose-500',
    },
    inactive: {
      container: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
  };

  const current = styles[status] || styles.inactive;

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-[13px]',
    md: 'px-3 py-1 text-[13px] md:text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border select-none',
        current.container,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', current.dot)} />
      <span className="leading-tight">{label}</span>
    </span>
  );
}
