"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepInfo {
  id: number;
  label: string;
}

export function StepIndicator({
  steps,
  current,
}: {
  steps: StepInfo[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {steps.map((step, index) => {
        const isDone = step.id < current;
        const isCurrent = step.id === current;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  isDone &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isDone &&
                    !isCurrent &&
                    "border-border text-muted-foreground"
                )}
              >
                {isDone ? <Check className="size-3.5" /> : step.id}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className="hidden h-px w-6 bg-border sm:inline-block"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
