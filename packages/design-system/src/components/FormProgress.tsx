import { CheckCircle2 } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface FormStep {
  id: string;
  label: string;
  description?: string;
}

export interface FormProgressProps {
  steps: FormStep[];
  currentStep: number;
  className?: string;
}

export function FormProgress({ steps, currentStep, className }: FormProgressProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200',
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isCurrent
                        ? 'bg-lime-500 text-white ring-2 ring-blue-300 dark:ring-lime-500'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 dark:bg-zinc-700 dark:bg-zinc-300 dark:text-zinc-400',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <span className="font-semibold text-sm">{index + 1}</span>
                  )}
                </div>

                <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-white text-center">
                  {step.label}
                </p>

                {step.description && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-20">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 my-5">
                  <div
                    className={cn(
                      'h-full transition-colors duration-200',
                      isCompleted
                        ? 'bg-green-600'
                        : 'bg-zinc-200 dark:bg-zinc-700 dark:bg-zinc-700 dark:bg-zinc-300',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile indicator */}
      <div className="mt-4 sm:hidden">
        <p className="text-sm text-center text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}
