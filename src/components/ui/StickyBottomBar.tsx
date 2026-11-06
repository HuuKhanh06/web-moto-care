// src/components/ui/StickyBottomBar.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface StickyBottomBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Thanh nút hành động dính cạnh dưới màn hình trên mobile (Sticky Bottom CTA):
 * - Mobile: Dính cố định ở đáy, nền trắng mờ 95%, viền trên 1px, đệm phím bấm công thái học cho ngón cái.
 * - Desktop: Tự động chuyển thành khối inline bình thường, không chiếm dụng màn hình.
 */
export function StickyBottomBar({ children, className }: StickyBottomBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40',
        'md:static md:p-0 md:bg-transparent md:border-0 md:backdrop-blur-none',
        className
      )}
    >
      <div className="max-w-[1200px] mx-auto w-full">
        {children}
      </div>
    </div>
  );
}
