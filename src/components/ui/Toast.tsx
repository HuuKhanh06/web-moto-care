// src/components/ui/Toast.tsx
import { useToastStore, type ToastType } from './toastStore';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, { border: string; bg: string; text: string; icon: string }> = {
  success: {
    border: 'border-brand-300',
    bg: 'bg-brand-50',
    text: 'text-brand-900',
    icon: 'text-brand-600',
  },
  error: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    text: 'text-red-900',
    icon: 'text-red-600',
  },
  warning: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    icon: 'text-amber-600',
  },
  info: {
    border: 'border-sky-300',
    bg: 'bg-sky-50',
    text: 'text-sky-900',
    icon: 'text-sky-600',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        const style = STYLES[t.type];

        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all animate-in slide-in-from-top-2 duration-200',
              style.bg,
              style.border
            )}
          >
            <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', style.icon)} />
            <div className="flex-1 text-sm">
              {t.title && <div className={cn('font-semibold mb-0.5', style.text)}>{t.title}</div>}
              <div className={cn('text-slate-700 leading-snug', style.text)}>{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors -mr-1 -mt-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

