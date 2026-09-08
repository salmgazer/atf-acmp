"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary";
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card p-5 border border-border/50 transition-colors hover:border-border",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  trend.isPositive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "rounded-xl p-2.5",
            variant === "primary" ? "bg-primary/10" : "bg-muted"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              variant === "primary" ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
        )}
      </div>
    </div>
  );
}

// Compact stat for inline use
export function StatBadge({
  icon: Icon,
  value,
  label,
  variant = "default",
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  variant?: "default" | "primary";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-3 border border-border/50">
      <div className={cn(
        "rounded-lg p-2",
        variant === "primary" ? "bg-primary/10" : "bg-muted"
      )}>
        <Icon className={cn(
          "h-4 w-4",
          variant === "primary" ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
