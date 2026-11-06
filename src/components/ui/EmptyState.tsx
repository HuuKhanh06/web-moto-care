import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode | {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Màn hình trống chuẩn mực:
 * - Tối đa 1 câu hoặc biểu tượng + 3 - 5 chữ.
 * - Không giải thích kỹ thuật rườm rà.
 * - Nút hành động đơn giản, rõ ràng, tương thích toàn bộ hệ thống cũ.
 */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  action,
  className,
}: EmptyStateProps) {
  // Chuẩn hóa nút hành động
  let actionNode: React.ReactNode = null;
  if (React.isValidElement(action)) {
    actionNode = action;
  } else if (action && typeof action === 'object' && 'label' in action && 'onClick' in action) {
    actionNode = (
      <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-3">
        {action.label}
      </Button>
    );
  } else if (actionLabel && onAction) {
    actionNode = (
      <Button variant="secondary" size="sm" onClick={onAction} className="mt-3">
        {actionLabel}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200/80 my-4',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        {icon || <Inbox className="w-6 h-6 stroke-[1.5]" />}
      </div>
      <h3 className="text-base font-semibold text-slate-800 leading-snug">{title}</h3>
      {description && (
        <p className="text-[13px] text-slate-500 max-w-sm mt-1 mb-4 leading-normal">
          {description}
        </p>
      )}
      {actionNode}
    </div>
  );
}
