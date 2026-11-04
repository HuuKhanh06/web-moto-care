// src/components/ui/Stepper.tsx
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  className?: string;
}

export function Stepper({ steps, currentStepIndex, className }: StepperProps) {
  return (
    <div className={cn('w-full py-4', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center relative">
              {/* Connecting line */}
              {index > 0 && (
                <div
                  className={cn(
                    'absolute top-4 -left-1/2 w-full h-0.5 -z-0 transition-colors',
                    index <= currentStepIndex ? 'bg-brand-500' : 'bg-slate-200'
                  )}
                />
              )}

              {/* Step indicator circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold z-10 transition-colors',
                  isCompleted && 'bg-brand-600 text-white',
                  isCurrent && 'bg-brand-50 border-2 border-brand-600 text-brand-700 font-bold',
                  !isCompleted && !isCurrent && 'bg-slate-100 border border-slate-300 text-slate-400'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>

              {/* Title & Description */}
              <div className="text-center mt-2 px-1">
                <div
                  className={cn(
                    'text-xs font-medium',
                    isCurrent ? 'text-brand-800 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                  )}
                >
                  {step.title}
                </div>
                {step.description && (
                  <div className="text-[10px] text-slate-400 hidden sm:block mt-0.5">{step.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

