// src/components/ui/BookingProgress.tsx
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { COPY } from '@/copy';

export interface BookingProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * Thanh tiến trình 4 bước cho luồng thuê xe:
 * 1. Chọn xe ➔ 2. Giấy tờ ➔ 3. Đặt cọc ➔ 4. Nhận xe
 * Cỡ chữ tối thiểu 13px, font 400 & 600, tối ưu cho màn hình 360px trở lên.
 */
export function BookingProgress({ currentStep, className }: BookingProgressProps) {
  const steps = COPY.BOOKING_STEPS;

  return (
    <div className={cn('w-full py-4 max-w-xl mx-auto', className)}>
      <div className="flex items-center justify-between relative">
        {/* Đường kẻ nối giữa các bước */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute top-4 left-6 h-0.5 bg-teal-600 -z-0 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center z-10">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200',
                  isCompleted && 'bg-teal-600 text-white',
                  isCurrent && 'bg-teal-50 border-2 border-teal-600 text-teal-800 font-bold shadow-xs',
                  !isCompleted && !isCurrent && 'bg-white border border-slate-300 text-slate-400'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.number}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-[13px] md:text-sm whitespace-nowrap',
                  isCurrent ? 'font-semibold text-slate-900' : isCompleted ? 'font-normal text-slate-700' : 'font-normal text-slate-400'
                )}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
