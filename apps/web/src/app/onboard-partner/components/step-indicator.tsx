"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isClickable = step.id <= currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className={cn("relative", isLast ? "flex-shrink-0" : "flex-1")}>
              <div className="flex items-center">
                {/* Step button with circle */}
                <button
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "group relative z-10 flex flex-col items-center",
                    isClickable ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  {/* Step circle */}
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all border-2",
                      isCompleted && "bg-[#17A589] border-[#17A589] text-white",
                      isCurrent && "bg-primary border-primary text-primary-foreground",
                      !isCompleted && !isCurrent && "bg-card border-border text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                  </span>

                  {/* Step label */}
                  <span
                    className={cn(
                      "mt-1 text-xs font-medium hidden sm:block whitespace-nowrap",
                      isCurrent ? "text-foreground" : isCompleted ? "text-[#17A589]" : "text-muted-foreground"
                    )}
                  >
                    {step.name}
                  </span>
                </button>

                {/* Connector line - positioned after the circle, not behind it */}
                {!isLast && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2",
                      isCompleted ? "bg-[#17A589]" : "bg-border"
                    )}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
