"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  danger: "bg-red-500",
};

const sizeStyles = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  variant = "default",
  size = "md",
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && <span className="font-medium">{percentage.toFixed(1)}%</span>}
        </div>
      )}
      <div className={cn("w-full rounded-full bg-muted", sizeStyles[size])}>
        <div
          className={cn("rounded-full transition-all duration-300", variantStyles[variant], sizeStyles[size])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ProgressListProps {
  items: Array<{
    label: string;
    value: number;
    max?: number;
    variant?: "default" | "success" | "warning" | "danger";
  }>;
  title?: string;
  className?: string;
}

export function ProgressList({ items, title, className }: ProgressListProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      {title && <h3 className="mb-4 font-semibold">{title}</h3>}
      <div className="space-y-4">
        {items.map((item, index) => (
          <ProgressBar
            key={index}
            label={item.label}
            value={item.value}
            max={item.max}
            variant={item.variant}
          />
        ))}
      </div>
    </div>
  );
}
