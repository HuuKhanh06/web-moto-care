// src/components/ui/Modal.tsx
// Nâng cấp Glassmorphism bề mặt kính mờ cao cấp chuẩn UI 2026+

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  closeOnBackdrop?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth,
  size,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actualWidth = size || maxWidth || 'md';

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop kính mờ sâu (Deep Glass Blur) */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Modal Dialog Card với Glassmorphism Surface */}
      <div
        className={cn(
          'relative w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden z-10',
          'animate-in zoom-in-95 fade-in duration-200',
          maxWidthClasses[actualWidth]
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-5 pb-4 border-b border-slate-100/80 bg-white/50 backdrop-blur-sm flex items-start justify-between gap-4">
            <div>
              {title && <h3 className="text-lg font-bold text-slate-900 leading-6">{title}</h3>}
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-100 transition-colors -mr-2 -mt-1 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
