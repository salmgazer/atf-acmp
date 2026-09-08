"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        success:
          "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        info:
          "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        purple:
          "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
        pink:
          "border-transparent bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
        orange:
          "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        teal:
          "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
      },
      size: {
        default: "px-3 py-1 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-4 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

// Status Badge with dot indicator
interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: "active" | "inactive" | "pending" | "draft" | "completed" | "error";
}

const statusConfig = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  inactive: {
    label: "Inactive",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    dotColor: "bg-gray-400",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    dotColor: "bg-slate-400",
  },
  completed: {
    label: "Completed",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotColor: "bg-red-500",
  },
};

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-transparent px-3 py-1 text-xs font-semibold",
        config.className,
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </div>
  );
}

export { Badge, StatusBadge, badgeVariants };
