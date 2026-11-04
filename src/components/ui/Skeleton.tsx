// src/components/ui/Skeleton.tsx
// Skeleton Loader với Shimmer Wave Effect chuẩn UI 2026+

import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle' | 'text';
  shimmer?: boolean;
}

export function Skeleton({
  className,
  variant = 'rect',
  shimmer = true,
  ...props
}: SkeletonProps) {
  const baseClasses = 'bg-slate-200/80 relative overflow-hidden';
  
  const variantClasses = {
    rect: 'rounded-xl',
    circle: 'rounded-full',
    text: 'rounded-md h-4 w-full',
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      )}
    </div>
  );
}

export function OcrScanningSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-brand-200 bg-brand-50/40 relative overflow-hidden space-y-4 animate-in fade-in duration-300">
      {/* Tia laser quét AI OCR */}
      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_12px_#00A651] animate-[scanLaser_2s_ease-in-out_infinite]" />

      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="w-10 h-10 bg-brand-200/70" />
        <div className="space-y-1.5 flex-1">
          <Skeleton variant="text" className="w-1/3 bg-brand-200/80 h-4" />
          <Skeleton variant="text" className="w-2/3 bg-brand-100/70 h-3" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-brand-100 space-y-2">
          <Skeleton variant="text" className="w-1/4 h-3" />
          <Skeleton variant="text" className="w-3/4 h-5" />
          <Skeleton variant="text" className="w-1/2 h-3" />
        </div>
        <div className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-brand-100 space-y-2">
          <Skeleton variant="text" className="w-1/4 h-3" />
          <Skeleton variant="text" className="w-3/4 h-5" />
          <Skeleton variant="text" className="w-1/2 h-3" />
        </div>
      </div>
    </div>
  );
}

