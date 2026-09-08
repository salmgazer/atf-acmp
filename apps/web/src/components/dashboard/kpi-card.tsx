"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
  loading?: boolean;
}

const variantStyles = {
  default: {
    icon: "bg-primary/10 text-primary",
    trend: "",
  },
  success: {
    icon: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    trend: "text-green-600 dark:text-green-400",
  },
  warning: {
    icon: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    trend: "text-yellow-600 dark:text-yellow-400",
  },
  danger: {
    icon: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    trend: "text-red-600 dark:text-red-400",
  },
  info: {
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    trend: "text-blue-600 dark:text-blue-400",
  },
};

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
  loading = false,
}: KPICardProps) {
  const styles = variantStyles[variant];

  if (loading) {
    return (
      <div className={cn("rounded-lg border bg-card p-6", className)}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-9 w-9 rounded-md bg-muted" />
          </div>
          <div className="mt-3 h-8 w-16 rounded bg-muted" />
          <div className="mt-2 h-3 w-20 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {Icon && (
          <div className={cn("rounded-md p-2", styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="mt-2">
        <span className="text-3xl font-bold">{value}</span>
        {trend && (
          <span
            className={cn(
              "ml-2 text-sm font-medium",
              trend.value >= 0 ? "text-green-600" : "text-red-600",
              styles.trend
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
            {trend.label && <span className="text-muted-foreground"> {trend.label}</span>}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
